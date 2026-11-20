import { Money } from '../currency/money.js';
import { Iso20022WireError } from '../errors/wire-error.js';
import { DecimalSumAccumulator } from '../models/control-sum.js';
import { findChild, findChildren, parseSafeXml } from '../xml/tokenizer.js';
import { readPacs008GroupHeader } from './group-header.js';
import { readPacs008Tx } from './serialize-tx.js';
import type { Pacs008Document } from './types.js';
import { validatePacs008Transactions } from './validate-pacs008.js';

export function parsePacs008Xml(xml: string): Pacs008Document {
  const root = parseSafeXml(xml);
  if (root.name !== 'Document') {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Expected <Document> root in pacs.008 payload, found <${root.name}>`,
      'Document',
    );
  }

  const bodyNode = findChild(root, 'FIToFICstmrCdtTrf');
  if (bodyNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory <FIToFICstmrCdtTrf> body in pacs.008 payload',
      'Document.FIToFICstmrCdtTrf',
    );
  }

  const grpHdrNode = findChild(bodyNode, 'GrpHdr');
  if (grpHdrNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory <GrpHdr> in pacs.008 payload',
      'FIToFICstmrCdtTrf.GrpHdr',
    );
  }
  const header = readPacs008GroupHeader(grpHdrNode, 'GrpHdr');

  const txNodes = findChildren(bodyNode, 'CdtTrfTxInf');
  const accumulator = new DecimalSumAccumulator();
  const transactions = txNodes.map((txNode, idx) => {
    const tx = readPacs008Tx(txNode, `CdtTrfTxInf[${idx}]`);
    accumulator.addMoney(tx.interbankSettlementAmount);
    return tx;
  });

  if (header.numberOfTransactions !== accumulator.transactionCount) {
    throw new Iso20022WireError(
      'ERR_TRANSACTION_COUNT_MISMATCH',
      `pacs.008 GrpHdr declared NbOfTxs=${header.numberOfTransactions} but parsed ${accumulator.transactionCount}`,
      'GrpHdr.NbOfTxs',
    );
  }

  if (header.controlSum !== undefined) {
    accumulator.verifyControlSum(header.controlSum, 'GrpHdr.CtrlSum');
  }

  if (header.totalInterbankSettlementAmount !== undefined) {
    const expectedCcy = header.totalInterbankSettlementAmount.currency;
    let runningMoney = Money.fromMinor(0n, expectedCcy);
    for (const [idx, tx] of transactions.entries()) {
      if (tx.interbankSettlementAmount.currency !== expectedCcy) {
        throw new Iso20022WireError(
          'ERR_INVALID_CURRENCY',
          `Leg CdtTrfTxInf[${idx}] settles in ${tx.interbankSettlementAmount.currency} but TtlIntrBkSttlmAmt is ${expectedCcy}`,
          `CdtTrfTxInf[${idx}].IntrBkSttlmAmt`,
        );
      }
      runningMoney = runningMoney.add(tx.interbankSettlementAmount);
    }
    if (!runningMoney.equals(header.totalInterbankSettlementAmount)) {
      throw new Iso20022WireError(
        'ERR_CONTROL_SUM_MISMATCH',
        `Declared TtlIntrBkSttlmAmt (${header.totalInterbankSettlementAmount.toWireString()} ${expectedCcy}) does not match leg sum (${runningMoney.toWireString()} ${expectedCcy})`,
        'GrpHdr.TtlIntrBkSttlmAmt',
      );
    }
  }

  validatePacs008Transactions(transactions, header.interbankSettlementDate);

  return { header, transactions };
}
