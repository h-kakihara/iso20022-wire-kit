import { Money } from '../currency/money.js';
import { Iso20022WireError } from '../errors/wire-error.js';
import {
  readAgent,
  readCashAccount,
  writeAgent,
  writeCashAccount,
} from '../models/account.js';
import {
  readPartyIdentification,
  writePartyIdentification,
} from '../models/party.js';
import { validateChargeBearer } from '../models/payment-type.js';
import {
  readRemittanceInfo,
  writeRemittanceInfo,
} from '../models/remittance.js';
import { assertSwiftText, validateReferenceId } from '../validators/swift-charset.js';
import { findChild, requireChildText, type XmlNode } from '../xml/tokenizer.js';
import type { XmlWriter } from '../xml/writer.js';
import type { Pain001CreditTransferTx } from './types.js';

export function writeCreditTransferTx(
  writer: XmlWriter,
  tx: Pain001CreditTransferTx,
  fieldPath: string,
): void {
  tx.amount.assertPositive(`${fieldPath}.Amt.InstdAmt`);

  writer.openTag('CdtTrfTxInf');

  writer.openTag('PmtId');
  if (tx.instructionId !== undefined) {
    writer.leafTag(
      'InstrId',
      validateReferenceId(tx.instructionId, `${fieldPath}.PmtId.InstrId`),
    );
  }
  writer.leafTag(
    'EndToEndId',
    validateReferenceId(tx.endToEndId, `${fieldPath}.PmtId.EndToEndId`),
  );
  if (tx.uetr !== undefined) {
    writer.leafTag('UETR', tx.uetr);
  }
  writer.closeTag('PmtId');

  writer.openTag('Amt');
  writer.leafTag('InstdAmt', tx.amount.toWireString(), { Ccy: tx.amount.currency });
  writer.closeTag('Amt');

  if (tx.chargeBearer !== undefined) {
    writer.leafTag(
      'ChrgBr',
      validateChargeBearer(tx.chargeBearer, `${fieldPath}.ChrgBr`),
    );
  }

  if (tx.creditorAgent !== undefined) {
    writeAgent(writer, 'CdtrAgt', tx.creditorAgent, `${fieldPath}.CdtrAgt`);
  }

  writePartyIdentification(writer, 'Cdtr', tx.creditor, `${fieldPath}.Cdtr`);
  writeCashAccount(writer, 'CdtrAcct', tx.creditorAccount, `${fieldPath}.CdtrAcct`);

  if (tx.purposeCode !== undefined) {
    writer
      .openTag('Purp')
      .leafTag('Cd', assertSwiftText(tx.purposeCode, 4, `${fieldPath}.Purp.Cd`).toUpperCase())
      .closeTag('Purp');
  }

  if (tx.remittanceInfo !== undefined) {
    writeRemittanceInfo(writer, tx.remittanceInfo, `${fieldPath}.RmtInf`);
  }

  writer.closeTag('CdtTrfTxInf');
}

export function readCreditTransferTx(
  node: XmlNode,
  fieldPath: string,
): Pain001CreditTransferTx {
  const pmtIdNode = findChild(node, 'PmtId');
  if (pmtIdNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory <PmtId> in CdtTrfTxInf',
      `${fieldPath}.PmtId`,
    );
  }

  const instructionId = findChild(pmtIdNode, 'InstrId')?.text;
  const endToEndId = validateReferenceId(
    requireChildText(pmtIdNode, 'EndToEndId', `${fieldPath}.PmtId.EndToEndId`),
    `${fieldPath}.PmtId.EndToEndId`,
  );
  const uetr = findChild(pmtIdNode, 'UETR')?.text;

  const amtNode = findChild(node, 'Amt');
  const instdAmtNode = amtNode !== undefined ? findChild(amtNode, 'InstdAmt') : undefined;
  if (instdAmtNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory <Amt><InstdAmt> in CdtTrfTxInf',
      `${fieldPath}.Amt.InstdAmt`,
    );
  }

  const currency = instdAmtNode.attributes['Ccy'];
  if (currency === undefined) {
    throw new Iso20022WireError(
      'ERR_INVALID_CURRENCY',
      'Missing mandatory Ccy attribute on <InstdAmt>',
      `${fieldPath}.Amt.InstdAmt`,
    );
  }

  const amount = Money.fromWireString(
    instdAmtNode.text,
    currency,
    `${fieldPath}.Amt.InstdAmt`,
  ).assertPositive(`${fieldPath}.Amt.InstdAmt`);

  const rawChrgBr = findChild(node, 'ChrgBr')?.text;
  const cdtrAgtNode = findChild(node, 'CdtrAgt');
  const cdtrNode = findChild(node, 'Cdtr');
  const cdtrAcctNode = findChild(node, 'CdtrAcct');

  if (cdtrNode === undefined || cdtrAcctNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory <Cdtr> or <CdtrAcct> in CdtTrfTxInf',
      fieldPath,
    );
  }

  const purpNode = findChild(node, 'Purp');
  const rmtNode = findChild(node, 'RmtInf');

  return {
    instructionId:
      instructionId !== undefined
        ? validateReferenceId(instructionId, `${fieldPath}.PmtId.InstrId`)
        : undefined,
    endToEndId,
    uetr,
    amount,
    chargeBearer:
      rawChrgBr !== undefined
        ? validateChargeBearer(rawChrgBr, `${fieldPath}.ChrgBr`)
        : undefined,
    creditorAgent:
      cdtrAgtNode !== undefined
        ? readAgent(cdtrAgtNode, `${fieldPath}.CdtrAgt`)
        : undefined,
    creditor: readPartyIdentification(cdtrNode, `${fieldPath}.Cdtr`),
    creditorAccount: readCashAccount(cdtrAcctNode, `${fieldPath}.CdtrAcct`),
    purposeCode: purpNode !== undefined ? findChild(purpNode, 'Cd')?.text : undefined,
    remittanceInfo:
      rmtNode !== undefined
        ? readRemittanceInfo(rmtNode, `${fieldPath}.RmtInf`)
        : undefined,
  };
}
