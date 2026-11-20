import { Iso20022WireError } from '../errors/wire-error.js';
import { validateIsoDateTime } from '../validators/iso-datetime.js';
import { validateReferenceId } from '../validators/swift-charset.js';
import { findChild, requireChildText, type XmlNode } from '../xml/tokenizer.js';
import type { XmlWriter } from '../xml/writer.js';
import { parseControlSumScaled } from './control-sum.js';
import {
  readPartyIdentification,
  writePartyIdentification,
  type PartyIdentification,
} from './party.js';

export interface GroupHeader {
  readonly messageId: string;
  readonly creationDateTime: string;
  readonly numberOfTransactions: number;
  readonly controlSum?: string | undefined;
  readonly initiatingParty: PartyIdentification;
}

export function writeGroupHeader(
  writer: XmlWriter,
  header: GroupHeader,
  fieldPath = 'GrpHdr',
): void {
  const msgId = validateReferenceId(header.messageId, `${fieldPath}.MsgId`);
  const creDtTm = validateIsoDateTime(header.creationDateTime, `${fieldPath}.CreDtTm`);

  if (!Number.isInteger(header.numberOfTransactions) || header.numberOfTransactions < 1) {
    throw new Iso20022WireError(
      'ERR_TRANSACTION_COUNT_MISMATCH',
      `GroupHeader NbOfTxs must be a positive integer, received ${header.numberOfTransactions}`,
      `${fieldPath}.NbOfTxs`,
    );
  }

  if (header.controlSum !== undefined) {
    parseControlSumScaled(header.controlSum, `${fieldPath}.CtrlSum`);
  }

  writer.openTag('GrpHdr');
  writer.leafTag('MsgId', msgId);
  writer.leafTag('CreDtTm', creDtTm);
  writer.leafTag('NbOfTxs', String(header.numberOfTransactions));
  if (header.controlSum !== undefined) {
    writer.leafTag('CtrlSum', header.controlSum.trim());
  }
  writePartyIdentification(writer, 'InitgPty', header.initiatingParty, `${fieldPath}.InitgPty`);
  writer.closeTag('GrpHdr');
}

export function readGroupHeader(node: XmlNode, fieldPath = 'GrpHdr'): GroupHeader {
  const messageId = validateReferenceId(
    requireChildText(node, 'MsgId', `${fieldPath}.MsgId`),
    `${fieldPath}.MsgId`,
  );
  const creationDateTime = validateIsoDateTime(
    requireChildText(node, 'CreDtTm', `${fieldPath}.CreDtTm`),
    `${fieldPath}.CreDtTm`,
  );
  const nbOfTxsText = requireChildText(node, 'NbOfTxs', `${fieldPath}.NbOfTxs`);
  if (!/^[1-9]\d{0,14}$/.test(nbOfTxsText)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Invalid GroupHeader NbOfTxs integer format: "${nbOfTxsText}"`,
      `${fieldPath}.NbOfTxs`,
    );
  }

  const rawCtrlSum = findChild(node, 'CtrlSum')?.text;
  if (rawCtrlSum !== undefined) {
    parseControlSumScaled(rawCtrlSum, `${fieldPath}.CtrlSum`);
  }

  const initgPtyNode = findChild(node, 'InitgPty');
  if (initgPtyNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory <InitgPty> in GroupHeader',
      `${fieldPath}.InitgPty`,
    );
  }

  return {
    messageId,
    creationDateTime,
    numberOfTransactions: Number(nbOfTxsText),
    controlSum: rawCtrlSum,
    initiatingParty: readPartyIdentification(initgPtyNode, `${fieldPath}.InitgPty`),
  };
}
