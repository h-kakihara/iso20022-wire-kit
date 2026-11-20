import { Iso20022WireError } from '../errors/wire-error.js';
import { readAgent } from '../models/account.js';
import { validateIsoDateTime } from '../validators/iso-datetime.js';
import { validateReferenceId } from '../validators/swift-charset.js';
import {
  findChild,
  findChildren,
  parseSafeXml,
  requireChildText,
  type XmlNode,
} from '../xml/tokenizer.js';
import {
  validateGroupStatus,
  validateStatusReasonCode,
  validateTxStatus,
} from './reason-codes.js';
import type {
  OriginalGroupInformation,
  Pacs002Document,
  StatusReasonInformation,
  TransactionStatusEntry,
} from './types.js';
import { validatePacs002Input } from './validate-pacs002.js';

function readStatusReasons(
  parentNode: XmlNode,
  fieldPath: string,
): readonly StatusReasonInformation[] | undefined {
  const rsnNodes = findChildren(parentNode, 'StsRsnInf');
  if (rsnNodes.length === 0) {
    return undefined;
  }

  return rsnNodes.map((node, idx) => {
    const rsnPath = `${fieldPath}.StsRsnInf[${idx}]`;
    const innerRsn = findChild(node, 'Rsn');
    if (innerRsn === undefined) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        'Missing mandatory <Rsn> inside <StsRsnInf>',
        `${rsnPath}.Rsn`,
      );
    }
    const rawCd = findChild(innerRsn, 'Cd')?.text;
    const rawPrtry = findChild(innerRsn, 'Prtry')?.text;
    const rawAddtl = findChild(node, 'AddtlInf')?.text;

    return {
      reasonCode:
        rawCd !== undefined
          ? validateStatusReasonCode(rawCd, `${rsnPath}.Rsn.Cd`)
          : undefined,
      proprietaryReason: rawPrtry,
      additionalInformation: rawAddtl,
    };
  });
}

export function parsePacs002Xml(xml: string): Pacs002Document {
  const root = parseSafeXml(xml);
  if (root.name !== 'Document') {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Expected <Document> root in pacs.002 payload, found <${root.name}>`,
      'Document',
    );
  }

  const bodyNode = findChild(root, 'FIToFIPmtStsRpt');
  if (bodyNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory <FIToFIPmtStsRpt> body in pacs.002 payload',
      'Document.FIToFIPmtStsRpt',
    );
  }

  const grpHdrNode = findChild(bodyNode, 'GrpHdr');
  if (grpHdrNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory <GrpHdr> in pacs.002 payload',
      'FIToFIPmtStsRpt.GrpHdr',
    );
  }

  const messageId = validateReferenceId(
    requireChildText(grpHdrNode, 'MsgId', 'GrpHdr.MsgId'),
    'GrpHdr.MsgId',
  );
  const creationDateTime = validateIsoDateTime(
    requireChildText(grpHdrNode, 'CreDtTm', 'GrpHdr.CreDtTm'),
    'GrpHdr.CreDtTm',
  );
  const instgNode = findChild(grpHdrNode, 'InstgAgt');
  const instdNode = findChild(grpHdrNode, 'InstdAgt');

  const orgnlGrpNode = findChild(bodyNode, 'OrgnlGrpInfAndSts');
  if (orgnlGrpNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory <OrgnlGrpInfAndSts> in pacs.002 payload',
      'FIToFIPmtStsRpt.OrgnlGrpInfAndSts',
    );
  }

  const rawGrpSts = findChild(orgnlGrpNode, 'GrpSts')?.text;
  const originalGroupInfo: OriginalGroupInformation = {
    originalMessageId: requireChildText(
      orgnlGrpNode,
      'OrgnlMsgId',
      'OrgnlGrpInfAndSts.OrgnlMsgId',
    ),
    originalMessageNameId: requireChildText(
      orgnlGrpNode,
      'OrgnlMsgNmId',
      'OrgnlGrpInfAndSts.OrgnlMsgNmId',
    ),
    originalCreationDateTime: findChild(orgnlGrpNode, 'OrgnlCreDtTm')?.text,
    groupStatus:
      rawGrpSts !== undefined
        ? validateGroupStatus(rawGrpSts, 'OrgnlGrpInfAndSts.GrpSts')
        : undefined,
    statusReasons: readStatusReasons(orgnlGrpNode, 'OrgnlGrpInfAndSts'),
  };

  const txStatuses: TransactionStatusEntry[] = findChildren(
    bodyNode,
    'TxInfAndSts',
  ).map((txNode, idx) => {
    const txPath = `TxInfAndSts[${idx}]`;
    const rawTxSts = requireChildText(txNode, 'TxSts', `${txPath}.TxSts`);
    return {
      statusId: findChild(txNode, 'StsId')?.text,
      originalInstructionId: findChild(txNode, 'OrgnlInstrId')?.text,
      originalEndToEndId: requireChildText(
        txNode,
        'OrgnlEndToEndId',
        `${txPath}.OrgnlEndToEndId`,
      ),
      originalTransactionId: findChild(txNode, 'OrgnlTxId')?.text,
      originalUetr: findChild(txNode, 'OrgnlUETR')?.text,
      transactionStatus: validateTxStatus(rawTxSts, `${txPath}.TxSts`),
      acceptanceDateTime: findChild(txNode, 'AccptncDtTm')?.text,
      clearingSystemReference: findChild(txNode, 'ClrSysRef')?.text,
      statusReasons: readStatusReasons(txNode, txPath),
    };
  });

  const header = {
    messageId,
    creationDateTime,
    instructingAgent:
      instgNode !== undefined ? readAgent(instgNode, 'GrpHdr.InstgAgt') : undefined,
    instructedAgent:
      instdNode !== undefined ? readAgent(instdNode, 'GrpHdr.InstdAgt') : undefined,
  };

  validatePacs002Input({
    messageId: header.messageId,
    creationDateTime: header.creationDateTime,
    instructingAgent: header.instructingAgent,
    instructedAgent: header.instructedAgent,
    originalGroupInfo,
    transactionStatuses: txStatuses,
  });

  return {
    header,
    originalGroupInfo,
    transactionStatuses: txStatuses,
  };
}
