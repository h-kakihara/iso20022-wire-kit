import { Money } from '../currency/money.js';
import { Iso20022WireError } from '../errors/wire-error.js';
import {
  readAgent,
  writeAgent,
  type FinancialInstitutionAgent,
} from '../models/account.js';
import { parseControlSumScaled } from '../models/control-sum.js';
import {
  validateIsoDate,
  validateIsoDateTime,
} from '../validators/iso-datetime.js';
import { validateReferenceId } from '../validators/swift-charset.js';
import { findChild, requireChildText, type XmlNode } from '../xml/tokenizer.js';
import type { XmlWriter } from '../xml/writer.js';
import {
  readSettlementInstruction,
  writeSettlementInstruction,
  type SettlementInstruction,
} from './settlement-info.js';

export interface Pacs008GroupHeader {
  readonly messageId: string;
  readonly creationDateTime: string;
  readonly numberOfTransactions: number;
  readonly controlSum?: string | undefined;
  readonly totalInterbankSettlementAmount?: Money | undefined;
  readonly interbankSettlementDate?: string | undefined;
  readonly settlementInfo: SettlementInstruction;
  readonly instructingAgent?: FinancialInstitutionAgent | undefined;
  readonly instructedAgent?: FinancialInstitutionAgent | undefined;
}

export function writePacs008GroupHeader(
  writer: XmlWriter,
  header: Pacs008GroupHeader,
  fieldPath = 'GrpHdr',
): void {
  const msgId = validateReferenceId(header.messageId, `${fieldPath}.MsgId`);
  const creDtTm = validateIsoDateTime(header.creationDateTime, `${fieldPath}.CreDtTm`);

  if (!Number.isInteger(header.numberOfTransactions) || header.numberOfTransactions < 1) {
    throw new Iso20022WireError(
      'ERR_TRANSACTION_COUNT_MISMATCH',
      `pacs.008 NbOfTxs must be a positive integer, received ${header.numberOfTransactions}`,
      `${fieldPath}.NbOfTxs`,
    );
  }

  if (header.controlSum !== undefined) {
    parseControlSumScaled(header.controlSum, `${fieldPath}.CtrlSum`);
  }

  const sttlmDate =
    header.interbankSettlementDate !== undefined
      ? validateIsoDate(header.interbankSettlementDate, `${fieldPath}.IntrBkSttlmDt`)
      : undefined;

  writer.openTag('GrpHdr');
  writer.leafTag('MsgId', msgId);
  writer.leafTag('CreDtTm', creDtTm);
  writer.leafTag('NbOfTxs', String(header.numberOfTransactions));

  if (header.controlSum !== undefined) {
    writer.leafTag('CtrlSum', header.controlSum.trim());
  }

  if (header.totalInterbankSettlementAmount !== undefined) {
    const ttl = header.totalInterbankSettlementAmount.assertPositive(
      `${fieldPath}.TtlIntrBkSttlmAmt`,
    );
    writer.leafTag('TtlIntrBkSttlmAmt', ttl.toWireString(), { Ccy: ttl.currency });
  }

  if (sttlmDate !== undefined) {
    writer.leafTag('IntrBkSttlmDt', sttlmDate);
  }

  writeSettlementInstruction(writer, header.settlementInfo, `${fieldPath}.SttlmInf`);

  if (header.instructingAgent !== undefined) {
    writeAgent(writer, 'InstgAgt', header.instructingAgent, `${fieldPath}.InstgAgt`);
  }
  if (header.instructedAgent !== undefined) {
    writeAgent(writer, 'InstdAgt', header.instructedAgent, `${fieldPath}.InstdAgt`);
  }

  writer.closeTag('GrpHdr');
}

export function readPacs008GroupHeader(
  node: XmlNode,
  fieldPath = 'GrpHdr',
): Pacs008GroupHeader {
  const messageId = validateReferenceId(
    requireChildText(node, 'MsgId', `${fieldPath}.MsgId`),
    `${fieldPath}.MsgId`,
  );
  const creationDateTime = validateIsoDateTime(
    requireChildText(node, 'CreDtTm', `${fieldPath}.CreDtTm`),
    `${fieldPath}.CreDtTm`,
  );
  const nbText = requireChildText(node, 'NbOfTxs', `${fieldPath}.NbOfTxs`);
  if (!/^[1-9]\d{0,14}$/.test(nbText)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Invalid pacs.008 NbOfTxs integer: "${nbText}"`,
      `${fieldPath}.NbOfTxs`,
    );
  }

  const rawCtrlSum = findChild(node, 'CtrlSum')?.text;
  if (rawCtrlSum !== undefined) {
    parseControlSumScaled(rawCtrlSum, `${fieldPath}.CtrlSum`);
  }

  const ttlNode = findChild(node, 'TtlIntrBkSttlmAmt');
  let totalInterbankSettlementAmount: Money | undefined;
  if (ttlNode !== undefined) {
    const ccy = ttlNode.attributes['Ccy'];
    if (ccy === undefined) {
      throw new Iso20022WireError(
        'ERR_INVALID_CURRENCY',
        'Missing mandatory Ccy attribute on <TtlIntrBkSttlmAmt>',
        `${fieldPath}.TtlIntrBkSttlmAmt`,
      );
    }
    totalInterbankSettlementAmount = Money.fromWireString(
      ttlNode.text,
      ccy,
      `${fieldPath}.TtlIntrBkSttlmAmt`,
    ).assertPositive(`${fieldPath}.TtlIntrBkSttlmAmt`);
  }

  const rawSttlmDate = findChild(node, 'IntrBkSttlmDt')?.text;
  const sttlmNode = findChild(node, 'SttlmInf');
  if (sttlmNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory <SttlmInf> in pacs.008 GroupHeader',
      `${fieldPath}.SttlmInf`,
    );
  }

  const instgNode = findChild(node, 'InstgAgt');
  const instdNode = findChild(node, 'InstdAgt');

  return {
    messageId,
    creationDateTime,
    numberOfTransactions: Number(nbText),
    controlSum: rawCtrlSum,
    totalInterbankSettlementAmount,
    interbankSettlementDate:
      rawSttlmDate !== undefined
        ? validateIsoDate(rawSttlmDate, `${fieldPath}.IntrBkSttlmDt`)
        : undefined,
    settlementInfo: readSettlementInstruction(sttlmNode, `${fieldPath}.SttlmInf`),
    instructingAgent:
      instgNode !== undefined ? readAgent(instgNode, `${fieldPath}.InstgAgt`) : undefined,
    instructedAgent:
      instdNode !== undefined ? readAgent(instdNode, `${fieldPath}.InstdAgt`) : undefined,
  };
}
