import { Iso20022WireError } from '../errors/wire-error.js';
import { readAgent, readCashAccount } from '../models/account.js';
import { DecimalSumAccumulator } from '../models/control-sum.js';
import { readGroupHeader } from '../models/group-header.js';
import { readPartyIdentification } from '../models/party.js';
import {
  readPaymentTypeInfo,
  validateChargeBearer,
} from '../models/payment-type.js';
import { validateIsoDate } from '../validators/iso-datetime.js';
import { validateReferenceId } from '../validators/swift-charset.js';
import {
  findChild,
  findChildren,
  parseSafeXml,
  requireChildText,
} from '../xml/tokenizer.js';
import { readCreditTransferTx } from './serialize-tx.js';
import type { Pain001Document, Pain001PaymentInstruction } from './types.js';
import { validatePain001Input } from './validate-pain001.js';

export function parsePain001Xml(xml: string): Pain001Document {
  const root = parseSafeXml(xml);
  if (root.name !== 'Document') {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Expected ISO 20022 <Document> root element, found <${root.name}>`,
      'Document',
    );
  }

  const initnNode = findChild(root, 'CstmrCdtTrfInitn');
  if (initnNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing <CstmrCdtTrfInitn> root message body in pain.001 payload',
      'Document.CstmrCdtTrfInitn',
    );
  }

  const grpHdrNode = findChild(initnNode, 'GrpHdr');
  if (grpHdrNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory <GrpHdr> in pain.001 payload',
      'CstmrCdtTrfInitn.GrpHdr',
    );
  }
  const header = readGroupHeader(grpHdrNode, 'GrpHdr');

  const pmtNodes = findChildren(initnNode, 'PmtInf');
  if (pmtNodes.length === 0) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'pain.001 payload contains zero <PmtInf> blocks',
      'CstmrCdtTrfInitn.PmtInf',
    );
  }

  const envelopeAccumulator = new DecimalSumAccumulator();
  const paymentInstructions: Pain001PaymentInstruction[] = [];

  for (let i = 0; i < pmtNodes.length; i += 1) {
    const pmtNode = pmtNodes[i];
    if (pmtNode === undefined) {
      continue;
    }
    const batchPath = `PmtInf[${i}]`;
    const paymentInformationId = validateReferenceId(
      requireChildText(pmtNode, 'PmtInfId', `${batchPath}.PmtInfId`),
      `${batchPath}.PmtInfId`,
    );

    const rawMethod = requireChildText(pmtNode, 'PmtMtd', `${batchPath}.PmtMtd`);
    if (rawMethod !== 'TRF' && rawMethod !== 'TRA') {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        `Unsupported pain.001 PmtMtd "${rawMethod}"`,
        `${batchPath}.PmtMtd`,
      );
    }

    const rawBtchBookg = findChild(pmtNode, 'BtchBookg')?.text;
    const batchBooking =
      rawBtchBookg === 'true' ? true : rawBtchBookg === 'false' ? false : undefined;

    const declaredBatchCount = findChild(pmtNode, 'NbOfTxs')?.text;
    const declaredBatchSum = findChild(pmtNode, 'CtrlSum')?.text;
    const pmtTpNode = findChild(pmtNode, 'PmtTpInf');

    const reqdNode = findChild(pmtNode, 'ReqdExctnDt');
    if (reqdNode === undefined) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        'Missing mandatory <ReqdExctnDt> in PmtInf',
        `${batchPath}.ReqdExctnDt`,
      );
    }
    const rawExecDate = findChild(reqdNode, 'Dt')?.text ?? reqdNode.text;
    const requestedExecutionDate = validateIsoDate(
      rawExecDate,
      `${batchPath}.ReqdExctnDt.Dt`,
    );

    const dbtrNode = findChild(pmtNode, 'Dbtr');
    const dbtrAcctNode = findChild(pmtNode, 'DbtrAcct');
    const dbtrAgtNode = findChild(pmtNode, 'DbtrAgt');
    if (dbtrNode === undefined || dbtrAcctNode === undefined || dbtrAgtNode === undefined) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        'Missing mandatory <Dbtr>, <DbtrAcct>, or <DbtrAgt> in PmtInf',
        batchPath,
      );
    }

    const rawChrgBr = findChild(pmtNode, 'ChrgBr')?.text;
    const txNodes = findChildren(pmtNode, 'CdtTrfTxInf');
    const batchAccumulator = new DecimalSumAccumulator();
    const transactions = txNodes.map((txNode, tIdx) => {
      const tx = readCreditTransferTx(txNode, `${batchPath}.CdtTrfTxInf[${tIdx}]`);
      batchAccumulator.addMoney(tx.amount);
      envelopeAccumulator.addMoney(tx.amount);
      return tx;
    });

    if (
      declaredBatchCount !== undefined &&
      Number(declaredBatchCount) !== batchAccumulator.transactionCount
    ) {
      throw new Iso20022WireError(
        'ERR_TRANSACTION_COUNT_MISMATCH',
        `Batch "${paymentInformationId}" declared NbOfTxs=${declaredBatchCount} but parsed ${batchAccumulator.transactionCount}`,
        `${batchPath}.NbOfTxs`,
      );
    }

    if (declaredBatchSum !== undefined) {
      batchAccumulator.verifyControlSum(declaredBatchSum, `${batchPath}.CtrlSum`);
    }

    paymentInstructions.push({
      paymentInformationId,
      paymentMethod: rawMethod,
      batchBooking,
      paymentTypeInfo:
        pmtTpNode !== undefined
          ? readPaymentTypeInfo(pmtTpNode, `${batchPath}.PmtTpInf`)
          : undefined,
      requestedExecutionDate,
      debtor: readPartyIdentification(dbtrNode, `${batchPath}.Dbtr`),
      debtorAccount: readCashAccount(dbtrAcctNode, `${batchPath}.DbtrAcct`),
      debtorAgent: readAgent(dbtrAgtNode, `${batchPath}.DbtrAgt`),
      chargeBearer:
        rawChrgBr !== undefined
          ? validateChargeBearer(rawChrgBr, `${batchPath}.ChrgBr`)
          : undefined,
      transactions,
    });
  }

  if (header.numberOfTransactions !== envelopeAccumulator.transactionCount) {
    throw new Iso20022WireError(
      'ERR_TRANSACTION_COUNT_MISMATCH',
      `GroupHeader declared NbOfTxs=${header.numberOfTransactions} but parsed ${envelopeAccumulator.transactionCount} transactions`,
      'GrpHdr.NbOfTxs',
    );
  }

  if (header.controlSum !== undefined) {
    envelopeAccumulator.verifyControlSum(header.controlSum, 'GrpHdr.CtrlSum');
  }

  validatePain001Input({
    messageId: header.messageId,
    creationDateTime: header.creationDateTime,
    initiatingParty: header.initiatingParty,
    paymentInstructions,
  });

  return { header, paymentInstructions };
}
