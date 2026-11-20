import { writeAgent, writeCashAccount } from '../models/account.js';
import { DecimalSumAccumulator } from '../models/control-sum.js';
import { writeGroupHeader } from '../models/group-header.js';
import { writePartyIdentification } from '../models/party.js';
import {
  validateChargeBearer,
  writePaymentTypeInfo,
} from '../models/payment-type.js';
import { XmlWriter } from '../xml/writer.js';
import { writeCreditTransferTx } from './serialize-tx.js';
import { PAIN001_NAMESPACE, type Pain001BuildInput } from './types.js';
import { validatePain001Input } from './validate-pain001.js';

export function buildPain001Xml(input: Pain001BuildInput): string {
  validatePain001Input(input);

  const envelopeSum = new DecimalSumAccumulator();
  for (const pmt of input.paymentInstructions) {
    for (const tx of pmt.transactions) {
      envelopeSum.addMoney(tx.amount);
    }
  }

  const writer = new XmlWriter();
  writer.openTag('Document', { xmlns: PAIN001_NAMESPACE });
  writer.openTag('CstmrCdtTrfInitn');

  writeGroupHeader(writer, {
    messageId: input.messageId,
    creationDateTime: input.creationDateTime,
    numberOfTransactions: envelopeSum.transactionCount,
    controlSum: envelopeSum.formatControlSum(),
    initiatingParty: input.initiatingParty,
  });

  for (let i = 0; i < input.paymentInstructions.length; i += 1) {
    const pmt = input.paymentInstructions[i];
    if (pmt === undefined) {
      continue;
    }
    const batchPath = `PmtInf[${i}]`;
    const batchSum = new DecimalSumAccumulator();
    for (const tx of pmt.transactions) {
      batchSum.addMoney(tx.amount);
    }

    writer.openTag('PmtInf');
    writer.leafTag('PmtInfId', pmt.paymentInformationId.trim());
    writer.leafTag('PmtMtd', pmt.paymentMethod ?? 'TRF');
    if (pmt.batchBooking !== undefined) {
      writer.leafTag('BtchBookg', pmt.batchBooking ? 'true' : 'false');
    }
    writer.leafTag('NbOfTxs', String(batchSum.transactionCount));
    writer.leafTag('CtrlSum', batchSum.formatControlSum());

    if (pmt.paymentTypeInfo !== undefined) {
      writePaymentTypeInfo(writer, pmt.paymentTypeInfo, `${batchPath}.PmtTpInf`);
    }

    writer
      .openTag('ReqdExctnDt')
      .leafTag('Dt', pmt.requestedExecutionDate.trim())
      .closeTag('ReqdExctnDt');

    writePartyIdentification(writer, 'Dbtr', pmt.debtor, `${batchPath}.Dbtr`);
    writeCashAccount(writer, 'DbtrAcct', pmt.debtorAccount, `${batchPath}.DbtrAcct`);
    writeAgent(writer, 'DbtrAgt', pmt.debtorAgent, `${batchPath}.DbtrAgt`);

    if (pmt.chargeBearer !== undefined) {
      writer.leafTag(
        'ChrgBr',
        validateChargeBearer(pmt.chargeBearer, `${batchPath}.ChrgBr`),
      );
    }

    for (let t = 0; t < pmt.transactions.length; t += 1) {
      const tx = pmt.transactions[t];
      if (tx !== undefined) {
        writeCreditTransferTx(writer, tx, `${batchPath}.CdtTrfTxInf[${t}]`);
      }
    }

    writer.closeTag('PmtInf');
  }

  writer.closeTag('CstmrCdtTrfInitn');
  writer.closeTag('Document');
  return writer.toXmlString();
}
