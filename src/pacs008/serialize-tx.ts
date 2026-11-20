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
import {
  readPaymentTypeInfo,
  validateChargeBearer,
  writePaymentTypeInfo,
} from '../models/payment-type.js';
import {
  readRemittanceInfo,
  writeRemittanceInfo,
} from '../models/remittance.js';
import { validateIsoDate } from '../validators/iso-datetime.js';
import { validateReferenceId } from '../validators/swift-charset.js';
import { findChild, requireChildText, type XmlNode } from '../xml/tokenizer.js';
import type { XmlWriter } from '../xml/writer.js';
import type { Pacs008CreditTransferTx } from './types.js';
import { validateExchangeRate } from './validate-pacs008.js';

export function writePacs008Tx(
  writer: XmlWriter,
  tx: Pacs008CreditTransferTx,
  fieldPath: string,
): void {
  const sttlmAmt = tx.interbankSettlementAmount.assertPositive(
    `${fieldPath}.IntrBkSttlmAmt`,
  );

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
  if (tx.transactionId !== undefined) {
    writer.leafTag(
      'TxId',
      validateReferenceId(tx.transactionId, `${fieldPath}.PmtId.TxId`),
    );
  }
  writer.leafTag('UETR', tx.uetr.trim());
  writer.closeTag('PmtId');

  if (tx.paymentTypeInfo !== undefined) {
    writePaymentTypeInfo(writer, tx.paymentTypeInfo, `${fieldPath}.PmtTpInf`);
  }

  writer.leafTag('IntrBkSttlmAmt', sttlmAmt.toWireString(), {
    Ccy: sttlmAmt.currency,
  });

  if (tx.interbankSettlementDate !== undefined) {
    writer.leafTag(
      'IntrBkSttlmDt',
      validateIsoDate(tx.interbankSettlementDate, `${fieldPath}.IntrBkSttlmDt`),
    );
  }

  if (tx.instructedAmount !== undefined) {
    const instd = tx.instructedAmount.assertPositive(`${fieldPath}.InstdAmt`);
    writer.leafTag('InstdAmt', instd.toWireString(), { Ccy: instd.currency });
  }

  if (tx.exchangeRate !== undefined) {
    writer.leafTag(
      'XchgRate',
      validateExchangeRate(tx.exchangeRate, `${fieldPath}.XchgRate`),
    );
  }

  writer.leafTag(
    'ChrgBr',
    validateChargeBearer(tx.chargeBearer, `${fieldPath}.ChrgBr`),
  );

  if (tx.intermediaryAgent1 !== undefined) {
    writeAgent(
      writer,
      'IntrmyAgt1',
      tx.intermediaryAgent1,
      `${fieldPath}.IntrmyAgt1`,
    );
  }

  writePartyIdentification(writer, 'Dbtr', tx.debtor, `${fieldPath}.Dbtr`);
  if (tx.debtorAccount !== undefined) {
    writeCashAccount(writer, 'DbtrAcct', tx.debtorAccount, `${fieldPath}.DbtrAcct`);
  }
  writeAgent(writer, 'DbtrAgt', tx.debtorAgent, `${fieldPath}.DbtrAgt`);

  writeAgent(writer, 'CdtrAgt', tx.creditorAgent, `${fieldPath}.CdtrAgt`);
  writePartyIdentification(writer, 'Cdtr', tx.creditor, `${fieldPath}.Cdtr`);
  if (tx.creditorAccount !== undefined) {
    writeCashAccount(
      writer,
      'CdtrAcct',
      tx.creditorAccount,
      `${fieldPath}.CdtrAcct`,
    );
  }

  if (tx.remittanceInfo !== undefined) {
    writeRemittanceInfo(writer, tx.remittanceInfo, `${fieldPath}.RmtInf`);
  }

  writer.closeTag('CdtTrfTxInf');
}

export function readPacs008Tx(
  node: XmlNode,
  fieldPath: string,
): Pacs008CreditTransferTx {
  const pmtIdNode = findChild(node, 'PmtId');
  if (pmtIdNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory <PmtId> in pacs.008 CdtTrfTxInf',
      `${fieldPath}.PmtId`,
    );
  }

  const rawInstrId = findChild(pmtIdNode, 'InstrId')?.text;
  const endToEndId = validateReferenceId(
    requireChildText(pmtIdNode, 'EndToEndId', `${fieldPath}.PmtId.EndToEndId`),
    `${fieldPath}.PmtId.EndToEndId`,
  );
  const rawTxId = findChild(pmtIdNode, 'TxId')?.text;
  const uetr = requireChildText(pmtIdNode, 'UETR', `${fieldPath}.PmtId.UETR`);

  const pmtTpNode = findChild(node, 'PmtTpInf');
  const sttlmAmtNode = findChild(node, 'IntrBkSttlmAmt');
  if (sttlmAmtNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory <IntrBkSttlmAmt> in pacs.008 CdtTrfTxInf',
      `${fieldPath}.IntrBkSttlmAmt`,
    );
  }
  const sttlmCcy = sttlmAmtNode.attributes['Ccy'];
  if (sttlmCcy === undefined) {
    throw new Iso20022WireError(
      'ERR_INVALID_CURRENCY',
      'Missing Ccy attribute on <IntrBkSttlmAmt>',
      `${fieldPath}.IntrBkSttlmAmt`,
    );
  }
  const interbankSettlementAmount = Money.fromWireString(
    sttlmAmtNode.text,
    sttlmCcy,
    `${fieldPath}.IntrBkSttlmAmt`,
  ).assertPositive(`${fieldPath}.IntrBkSttlmAmt`);

  const rawSttlmDt = findChild(node, 'IntrBkSttlmDt')?.text;
  const instdAmtNode = findChild(node, 'InstdAmt');
  let instructedAmount: Money | undefined;
  if (instdAmtNode !== undefined) {
    const instdCcy = instdAmtNode.attributes['Ccy'];
    if (instdCcy === undefined) {
      throw new Iso20022WireError(
        'ERR_INVALID_CURRENCY',
        'Missing Ccy attribute on <InstdAmt>',
        `${fieldPath}.InstdAmt`,
      );
    }
    instructedAmount = Money.fromWireString(
      instdAmtNode.text,
      instdCcy,
      `${fieldPath}.InstdAmt`,
    ).assertPositive(`${fieldPath}.InstdAmt`);
  }

  const rawXchgRate = findChild(node, 'XchgRate')?.text;
  const chargeBearer = validateChargeBearer(
    requireChildText(node, 'ChrgBr', `${fieldPath}.ChrgBr`),
    `${fieldPath}.ChrgBr`,
  );

  const intrmyNode = findChild(node, 'IntrmyAgt1');
  const dbtrNode = findChild(node, 'Dbtr');
  const dbtrAcctNode = findChild(node, 'DbtrAcct');
  const dbtrAgtNode = findChild(node, 'DbtrAgt');
  const cdtrAgtNode = findChild(node, 'CdtrAgt');
  const cdtrNode = findChild(node, 'Cdtr');
  const cdtrAcctNode = findChild(node, 'CdtrAcct');

  if (
    dbtrNode === undefined ||
    dbtrAgtNode === undefined ||
    cdtrAgtNode === undefined ||
    cdtrNode === undefined
  ) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory Dbtr, DbtrAgt, CdtrAgt, or Cdtr in pacs.008 CdtTrfTxInf',
      fieldPath,
    );
  }

  const rmtNode = findChild(node, 'RmtInf');

  return {
    instructionId:
      rawInstrId !== undefined
        ? validateReferenceId(rawInstrId, `${fieldPath}.PmtId.InstrId`)
        : undefined,
    endToEndId,
    transactionId:
      rawTxId !== undefined
        ? validateReferenceId(rawTxId, `${fieldPath}.PmtId.TxId`)
        : undefined,
    uetr,
    paymentTypeInfo:
      pmtTpNode !== undefined
        ? readPaymentTypeInfo(pmtTpNode, `${fieldPath}.PmtTpInf`)
        : undefined,
    interbankSettlementAmount,
    interbankSettlementDate:
      rawSttlmDt !== undefined
        ? validateIsoDate(rawSttlmDt, `${fieldPath}.IntrBkSttlmDt`)
        : undefined,
    instructedAmount,
    exchangeRate:
      rawXchgRate !== undefined
        ? validateExchangeRate(rawXchgRate, `${fieldPath}.XchgRate`)
        : undefined,
    chargeBearer,
    intermediaryAgent1:
      intrmyNode !== undefined
        ? readAgent(intrmyNode, `${fieldPath}.IntrmyAgt1`)
        : undefined,
    debtor: readPartyIdentification(dbtrNode, `${fieldPath}.Dbtr`),
    debtorAccount:
      dbtrAcctNode !== undefined
        ? readCashAccount(dbtrAcctNode, `${fieldPath}.DbtrAcct`)
        : undefined,
    debtorAgent: readAgent(dbtrAgtNode, `${fieldPath}.DbtrAgt`),
    creditorAgent: readAgent(cdtrAgtNode, `${fieldPath}.CdtrAgt`),
    creditor: readPartyIdentification(cdtrNode, `${fieldPath}.Cdtr`),
    creditorAccount:
      cdtrAcctNode !== undefined
        ? readCashAccount(cdtrAcctNode, `${fieldPath}.CdtrAcct`)
        : undefined,
    remittanceInfo:
      rmtNode !== undefined
        ? readRemittanceInfo(rmtNode, `${fieldPath}.RmtInf`)
        : undefined,
  };
}
