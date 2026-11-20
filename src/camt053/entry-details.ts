import { Money } from '../currency/money.js';
import { Iso20022WireError } from '../errors/wire-error.js';
import {
  readCashAccount,
  writeCashAccount,
  type CashAccount,
} from '../models/account.js';
import {
  readPartyIdentification,
  writePartyIdentification,
  type PartyIdentification,
} from '../models/party.js';
import {
  readRemittanceInfo,
  writeRemittanceInfo,
  type RemittanceInformation,
} from '../models/remittance.js';
import { validateReferenceId } from '../validators/swift-charset.js';
import { findChild, requireChildText, type XmlNode } from '../xml/tokenizer.js';
import type { XmlWriter } from '../xml/writer.js';
import {
  validateCreditDebitIndicator,
  type CreditDebitIndicator,
} from './signed-balance.js';

export interface StatementTxDetails {
  readonly messageId?: string | undefined;
  readonly accountServicerRef?: string | undefined;
  readonly paymentInformationId?: string | undefined;
  readonly instructionId?: string | undefined;
  readonly endToEndId?: string | undefined;
  readonly transactionId?: string | undefined;
  readonly uetr?: string | undefined;
  readonly amount: Money;
  readonly creditDebitIndicator: CreditDebitIndicator;
  readonly debtor?: PartyIdentification | undefined;
  readonly debtorAccount?: CashAccount | undefined;
  readonly creditor?: PartyIdentification | undefined;
  readonly creditorAccount?: CashAccount | undefined;
  readonly remittanceInfo?: RemittanceInformation | undefined;
}

const UETR_UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function writeEntryTxDetails(
  writer: XmlWriter,
  tx: StatementTxDetails,
  fieldPath: string,
): void {
  writer.openTag('TxDtls');

  const hasRefs =
    tx.messageId !== undefined ||
    tx.accountServicerRef !== undefined ||
    tx.paymentInformationId !== undefined ||
    tx.instructionId !== undefined ||
    tx.endToEndId !== undefined ||
    tx.transactionId !== undefined ||
    tx.uetr !== undefined;

  if (hasRefs) {
    writer.openTag('Refs');
    if (tx.messageId !== undefined) {
      writer.leafTag(
        'MsgId',
        validateReferenceId(tx.messageId, `${fieldPath}.Refs.MsgId`),
      );
    }
    if (tx.accountServicerRef !== undefined) {
      writer.leafTag(
        'AcctSvcrRef',
        validateReferenceId(tx.accountServicerRef, `${fieldPath}.Refs.AcctSvcrRef`),
      );
    }
    if (tx.paymentInformationId !== undefined) {
      writer.leafTag(
        'PmtInfId',
        validateReferenceId(tx.paymentInformationId, `${fieldPath}.Refs.PmtInfId`),
      );
    }
    if (tx.instructionId !== undefined) {
      writer.leafTag(
        'InstrId',
        validateReferenceId(tx.instructionId, `${fieldPath}.Refs.InstrId`),
      );
    }
    if (tx.endToEndId !== undefined) {
      writer.leafTag(
        'EndToEndId',
        validateReferenceId(tx.endToEndId, `${fieldPath}.Refs.EndToEndId`),
      );
    }
    if (tx.transactionId !== undefined) {
      writer.leafTag(
        'TxId',
        validateReferenceId(tx.transactionId, `${fieldPath}.Refs.TxId`),
      );
    }
    if (tx.uetr !== undefined) {
      if (!UETR_UUID_V4_REGEX.test(tx.uetr)) {
        throw new Iso20022WireError(
          'ERR_SCHEMA_VIOLATION',
          `Invalid UUIDv4 UETR in camt.053 TxDtls: "${tx.uetr}"`,
          `${fieldPath}.Refs.UETR`,
        );
      }
      writer.leafTag('UETR', tx.uetr);
    }
    writer.closeTag('Refs');
  }

  writer.leafTag('Amt', tx.amount.toWireString(), { Ccy: tx.amount.currency });
  writer.leafTag(
    'CdtDbtInd',
    validateCreditDebitIndicator(tx.creditDebitIndicator, `${fieldPath}.CdtDbtInd`),
  );

  if (
    tx.debtor !== undefined ||
    tx.debtorAccount !== undefined ||
    tx.creditor !== undefined ||
    tx.creditorAccount !== undefined
  ) {
    writer.openTag('RltdPties');
    if (tx.debtor !== undefined) {
      writer.openTag('Dbtr');
      writePartyIdentification(writer, 'Pty', tx.debtor, `${fieldPath}.RltdPties.Dbtr.Pty`);
      writer.closeTag('Dbtr');
    }
    if (tx.debtorAccount !== undefined) {
      writeCashAccount(
        writer,
        'DbtrAcct',
        tx.debtorAccount,
        `${fieldPath}.RltdPties.DbtrAcct`,
      );
    }
    if (tx.creditor !== undefined) {
      writer.openTag('Cdtr');
      writePartyIdentification(
        writer,
        'Pty',
        tx.creditor,
        `${fieldPath}.RltdPties.Cdtr.Pty`,
      );
      writer.closeTag('Cdtr');
    }
    if (tx.creditorAccount !== undefined) {
      writeCashAccount(
        writer,
        'CdtrAcct',
        tx.creditorAccount,
        `${fieldPath}.RltdPties.CdtrAcct`,
      );
    }
    writer.closeTag('RltdPties');
  }

  if (tx.remittanceInfo !== undefined) {
    writeRemittanceInfo(writer, tx.remittanceInfo, `${fieldPath}.RmtInf`);
  }

  writer.closeTag('TxDtls');
}

export function readEntryTxDetails(
  node: XmlNode,
  fieldPath: string,
): StatementTxDetails {
  const refsNode = findChild(node, 'Refs');
  const amtNode = findChild(node, 'Amt');
  if (amtNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory <Amt> in camt.053 TxDtls',
      `${fieldPath}.Amt`,
    );
  }
  const ccy = amtNode.attributes['Ccy'];
  if (ccy === undefined) {
    throw new Iso20022WireError(
      'ERR_INVALID_CURRENCY',
      'Missing Ccy attribute on TxDtls <Amt>',
      `${fieldPath}.Amt`,
    );
  }
  const amount = Money.fromWireString(amtNode.text, ccy, `${fieldPath}.Amt`);
  const creditDebitIndicator = validateCreditDebitIndicator(
    requireChildText(node, 'CdtDbtInd', `${fieldPath}.CdtDbtInd`),
    `${fieldPath}.CdtDbtInd`,
  );

  const rltdNode = findChild(node, 'RltdPties');
  const dbtrOuter = rltdNode !== undefined ? findChild(rltdNode, 'Dbtr') : undefined;
  const dbtrPty = dbtrOuter !== undefined ? (findChild(dbtrOuter, 'Pty') ?? dbtrOuter) : undefined;
  const dbtrAcctNode =
    rltdNode !== undefined ? findChild(rltdNode, 'DbtrAcct') : undefined;
  const cdtrOuter = rltdNode !== undefined ? findChild(rltdNode, 'Cdtr') : undefined;
  const cdtrPty = cdtrOuter !== undefined ? (findChild(cdtrOuter, 'Pty') ?? cdtrOuter) : undefined;
  const cdtrAcctNode =
    rltdNode !== undefined ? findChild(rltdNode, 'CdtrAcct') : undefined;

  const rmtNode = findChild(node, 'RmtInf');
  const rawUetr = refsNode !== undefined ? findChild(refsNode, 'UETR')?.text : undefined;
  if (rawUetr !== undefined && !UETR_UUID_V4_REGEX.test(rawUetr)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Invalid UUIDv4 UETR in camt.053 TxDtls: "${rawUetr}"`,
      `${fieldPath}.Refs.UETR`,
    );
  }

  const readOptRef = (tag: string): string | undefined => {
    const val = refsNode !== undefined ? findChild(refsNode, tag)?.text : undefined;
    return val !== undefined
      ? validateReferenceId(val, `${fieldPath}.Refs.${tag}`)
      : undefined;
  };

  return {
    messageId: readOptRef('MsgId'),
    accountServicerRef: readOptRef('AcctSvcrRef'),
    paymentInformationId: readOptRef('PmtInfId'),
    instructionId: readOptRef('InstrId'),
    endToEndId: readOptRef('EndToEndId'),
    transactionId: readOptRef('TxId'),
    uetr: rawUetr,
    amount,
    creditDebitIndicator,
    debtor:
      dbtrPty !== undefined
        ? readPartyIdentification(dbtrPty, `${fieldPath}.RltdPties.Dbtr`)
        : undefined,
    debtorAccount:
      dbtrAcctNode !== undefined
        ? readCashAccount(dbtrAcctNode, `${fieldPath}.RltdPties.DbtrAcct`)
        : undefined,
    creditor:
      cdtrPty !== undefined
        ? readPartyIdentification(cdtrPty, `${fieldPath}.RltdPties.Cdtr`)
        : undefined,
    creditorAccount:
      cdtrAcctNode !== undefined
        ? readCashAccount(cdtrAcctNode, `${fieldPath}.RltdPties.CdtrAcct`)
        : undefined,
    remittanceInfo:
      rmtNode !== undefined
        ? readRemittanceInfo(rmtNode, `${fieldPath}.RmtInf`)
        : undefined,
  };
}
