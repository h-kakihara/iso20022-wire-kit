import { Iso20022WireError } from '../errors/wire-error.js';
import { readAgent, writeAgent } from '../models/account.js';
import { validateIsoDateTime } from '../validators/iso-datetime.js';
import { assertSwiftText, validateReferenceId } from '../validators/swift-charset.js';
import {
  findChild,
  parseSafeXml,
  requireChildText,
} from '../xml/tokenizer.js';
import { XmlWriter } from '../xml/writer.js';

export const APP_HDR_NAMESPACE =
  'urn:iso:std:iso:20022:tech:xsd:head.001.001.02' as const;

const MSG_DEF_ID_REGEX = /^[a-z]{4}\.\d{3}\.\d{3}\.\d{2}$/;

export interface BusinessApplicationHeader {
  readonly fromBic: string;
  readonly toBic: string;
  readonly businessMessageId: string;
  readonly messageDefinitionId: string;
  readonly businessService?: string | undefined;
  readonly creationDate: string;
}

export function buildAppHdrXml(header: BusinessApplicationHeader): string {
  const bizMsgId = validateReferenceId(header.businessMessageId, 'AppHdr.BizMsgIdr');
  const msgDefId = header.messageDefinitionId.trim();
  if (!MSG_DEF_ID_REGEX.test(msgDefId)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Invalid ISO 20022 MsgDefIdr format (expected e.g. pacs.008.001.08): "${header.messageDefinitionId}"`,
      'AppHdr.MsgDefIdr',
    );
  }
  const bizSvc =
    header.businessService !== undefined
      ? assertSwiftText(header.businessService, 35, 'AppHdr.BizSvc')
      : undefined;
  const creDt = validateIsoDateTime(header.creationDate, 'AppHdr.CreDt');

  const writer = new XmlWriter();
  writer.openTag('AppHdr', { xmlns: APP_HDR_NAMESPACE });
  writer.openTag('Fr');
  writeAgent(writer, 'FIId', { bic: header.fromBic }, 'AppHdr.Fr.FIId');
  writer.closeTag('Fr');
  writer.openTag('To');
  writeAgent(writer, 'FIId', { bic: header.toBic }, 'AppHdr.To.FIId');
  writer.closeTag('To');
  writer.leafTag('BizMsgIdr', bizMsgId);
  writer.leafTag('MsgDefIdr', msgDefId);
  if (bizSvc !== undefined) {
    writer.leafTag('BizSvc', bizSvc);
  }
  writer.leafTag('CreDt', creDt);
  writer.closeTag('AppHdr');
  return writer.toXmlString();
}

export function parseAppHdrXml(xml: string): BusinessApplicationHeader {
  const root = parseSafeXml(xml);
  if (root.name !== 'AppHdr') {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Expected <AppHdr> root element, found <${root.name}>`,
      'AppHdr',
    );
  }

  const frNode = findChild(root, 'Fr');
  const frFiNode = frNode !== undefined ? findChild(frNode, 'FIId') : undefined;
  const toNode = findChild(root, 'To');
  const toFiNode = toNode !== undefined ? findChild(toNode, 'FIId') : undefined;

  if (frFiNode === undefined || toFiNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory <Fr><FIId> or <To><FIId> inside BusinessApplicationHeader',
      'AppHdr',
    );
  }

  const fromAgent = readAgent(frFiNode, 'AppHdr.Fr.FIId');
  const toAgent = readAgent(toFiNode, 'AppHdr.To.FIId');
  const businessMessageId = validateReferenceId(
    requireChildText(root, 'BizMsgIdr', 'AppHdr.BizMsgIdr'),
    'AppHdr.BizMsgIdr',
  );
  const messageDefinitionId = requireChildText(root, 'MsgDefIdr', 'AppHdr.MsgDefIdr');
  if (!MSG_DEF_ID_REGEX.test(messageDefinitionId)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Invalid ISO 20022 MsgDefIdr "${messageDefinitionId}"`,
      'AppHdr.MsgDefIdr',
    );
  }
  const rawBizSvc = findChild(root, 'BizSvc')?.text;
  const creationDate = validateIsoDateTime(
    requireChildText(root, 'CreDt', 'AppHdr.CreDt'),
    'AppHdr.CreDt',
  );

  return {
    fromBic: fromAgent.bic,
    toBic: toAgent.bic,
    businessMessageId,
    messageDefinitionId,
    businessService:
      rawBizSvc !== undefined
        ? assertSwiftText(rawBizSvc, 35, 'AppHdr.BizSvc')
        : undefined,
    creationDate,
  };
}
