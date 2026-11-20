import { Money } from '../currency/money.js';
import { DecimalSumAccumulator } from '../models/control-sum.js';
import { XmlWriter } from '../xml/writer.js';
import { writePacs008GroupHeader } from './group-header.js';
import { writePacs008Tx } from './serialize-tx.js';
import { PACS008_NAMESPACE, type Pacs008BuildInput } from './types.js';
import { validatePacs008Transactions } from './validate-pacs008.js';

export function buildPacs008Xml(input: Pacs008BuildInput): string {
  validatePacs008Transactions(input.transactions, input.interbankSettlementDate);

  const sumAccumulator = new DecimalSumAccumulator();
  const firstTx = input.transactions[0];
  let homogeneousTotal: Money | undefined =
    firstTx !== undefined
      ? Money.fromMinor(0n, firstTx.interbankSettlementAmount.currency)
      : undefined;

  for (const tx of input.transactions) {
    sumAccumulator.addMoney(tx.interbankSettlementAmount);
    if (homogeneousTotal !== undefined) {
      if (tx.interbankSettlementAmount.currency === homogeneousTotal.currency) {
        homogeneousTotal = homogeneousTotal.add(tx.interbankSettlementAmount);
      } else {
        homogeneousTotal = undefined;
      }
    }
  }

  const writer = new XmlWriter();
  writer.openTag('Document', { xmlns: PACS008_NAMESPACE });
  writer.openTag('FIToFICstmrCdtTrf');

  writePacs008GroupHeader(writer, {
    messageId: input.messageId,
    creationDateTime: input.creationDateTime,
    numberOfTransactions: sumAccumulator.transactionCount,
    controlSum: sumAccumulator.formatControlSum(),
    totalInterbankSettlementAmount: homogeneousTotal,
    interbankSettlementDate: input.interbankSettlementDate,
    settlementInfo: input.settlementInfo,
    instructingAgent: input.instructingAgent,
    instructedAgent: input.instructedAgent,
  });

  for (const [idx, tx] of input.transactions.entries()) {
    writePacs008Tx(writer, tx, `CdtTrfTxInf[${idx}]`);
  }

  writer.closeTag('FIToFICstmrCdtTrf');
  writer.closeTag('Document');
  return writer.toXmlString();
}
