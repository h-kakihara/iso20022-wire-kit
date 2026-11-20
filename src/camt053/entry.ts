import { Money } from '../currency/money.js';
import { Iso20022WireError } from '../errors/wire-error.js';
import { validateReferenceId } from '../validators/swift-charset.js';
import {
  findChild,
  findChildren,
  requireChildText,
  type XmlNode,
} from '../xml/tokenizer.js';
import type { XmlWriter } from '../xml/writer.js';
import {
  readDateOrDateTimeChoice,
  writeDateOrDateTimeChoice,
} from './balance.js';
import {
  readBankTxCode,
  writeBankTxCode,
  type BankTransactionCode,
} from './bk-tx-code.js';
import {
  readEntryTxDetails,
  writeEntryTxDetails,
  type StatementTxDetails,
} from './entry-details.js';
import {
  validateCreditDebitIndicator,
  type CreditDebitIndicator,
} from './signed-balance.js';

export type EntryStatusCode = 'BOOK' | 'PDNG' | 'INFO';

export interface StatementEntry {
  readonly entryReference?: string | undefined;
  readonly amount: Money;
  readonly creditDebitIndicator: CreditDebitIndicator;
  readonly reversalIndicator?: boolean | undefined;
  readonly status: EntryStatusCode;
  readonly bookingDate?: string | undefined;
  readonly valueDate?: string | undefined;
  readonly accountServicerRef?: string | undefined;
  readonly bankTransactionCode: BankTransactionCode;
  readonly transactions?: readonly StatementTxDetails[] | undefined;
}

const ENTRY_STATUS_CODES: ReadonlySet<string> = new Set(['BOOK', 'PDNG', 'INFO']);

export function writeStatementEntry(
  writer: XmlWriter,
  entry: StatementEntry,
  fieldPath: string,
): void {
  const statusUpper = entry.status.trim().toUpperCase();
  if (!ENTRY_STATUS_CODES.has(statusUpper)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Invalid camt.053 EntryStatusCode "${entry.status}"`,
      `${fieldPath}.Sts.Cd`,
    );
  }

  if (statusUpper === 'BOOK' && entry.bookingDate === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Booked (BOOK) statement entries require a BookingDate (<BookgDt>)',
      `${fieldPath}.BookgDt`,
    );
  }

  writer.openTag('Ntry');
  if (entry.entryReference !== undefined) {
    writer.leafTag(
      'NtryRef',
      validateReferenceId(entry.entryReference, `${fieldPath}.NtryRef`),
    );
  }
  writer.leafTag('Amt', entry.amount.toWireString(), {
    Ccy: entry.amount.currency,
  });
  writer.leafTag(
    'CdtDbtInd',
    validateCreditDebitIndicator(entry.creditDebitIndicator, `${fieldPath}.CdtDbtInd`),
  );
  if (entry.reversalIndicator !== undefined) {
    writer.leafTag('RvslInd', entry.reversalIndicator ? 'true' : 'false');
  }

  writer.openTag('Sts').leafTag('Cd', statusUpper).closeTag('Sts');

  if (entry.bookingDate !== undefined) {
    writeDateOrDateTimeChoice(
      writer,
      'BookgDt',
      entry.bookingDate,
      `${fieldPath}.BookgDt`,
    );
  }
  if (entry.valueDate !== undefined) {
    writeDateOrDateTimeChoice(writer, 'ValDt', entry.valueDate, `${fieldPath}.ValDt`);
  }
  if (entry.accountServicerRef !== undefined) {
    writer.leafTag(
      'AcctSvcrRef',
      validateReferenceId(entry.accountServicerRef, `${fieldPath}.AcctSvcrRef`),
    );
  }

  writeBankTxCode(writer, entry.bankTransactionCode, `${fieldPath}.BkTxCd`);

  if (entry.transactions !== undefined && entry.transactions.length > 0) {
    writer.openTag('NtryDtls');
    for (const [idx, tx] of entry.transactions.entries()) {
      writeEntryTxDetails(writer, tx, `${fieldPath}.NtryDtls.TxDtls[${idx}]`);
    }
    writer.closeTag('NtryDtls');
  }

  writer.closeTag('Ntry');
}

export function readStatementEntry(node: XmlNode, fieldPath: string): StatementEntry {
  const rawNtryRef = findChild(node, 'NtryRef')?.text;
  const amtNode = findChild(node, 'Amt');
  if (amtNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory <Amt> in camt.053 <Ntry>',
      `${fieldPath}.Amt`,
    );
  }
  const ccy = amtNode.attributes['Ccy'];
  if (ccy === undefined) {
    throw new Iso20022WireError(
      'ERR_INVALID_CURRENCY',
      'Missing Ccy attribute on Ntry <Amt>',
      `${fieldPath}.Amt`,
    );
  }
  const amount = Money.fromWireString(amtNode.text, ccy, `${fieldPath}.Amt`);
  const creditDebitIndicator = validateCreditDebitIndicator(
    requireChildText(node, 'CdtDbtInd', `${fieldPath}.CdtDbtInd`),
    `${fieldPath}.CdtDbtInd`,
  );

  const rawRvsl = findChild(node, 'RvslInd')?.text;
  const reversalIndicator =
    rawRvsl === 'true' ? true : rawRvsl === 'false' ? false : undefined;

  const stsNode = findChild(node, 'Sts');
  if (stsNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory <Sts> in camt.053 <Ntry>',
      `${fieldPath}.Sts`,
    );
  }
  const rawStatus = (findChild(stsNode, 'Cd')?.text ?? stsNode.text).trim().toUpperCase();
  if (!ENTRY_STATUS_CODES.has(rawStatus)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Unsupported camt.053 EntryStatusCode "${rawStatus}"`,
      `${fieldPath}.Sts`,
    );
  }

  const bookgNode = findChild(node, 'BookgDt');
  const valNode = findChild(node, 'ValDt');
  const rawAcctSvcrRef = findChild(node, 'AcctSvcrRef')?.text;

  const bkTxNode = findChild(node, 'BkTxCd');
  if (bkTxNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory <BkTxCd> in camt.053 <Ntry>',
      `${fieldPath}.BkTxCd`,
    );
  }

  const ntryDtlsNodes = findChildren(node, 'NtryDtls');
  const parsedDetails: StatementTxDetails[] = [];
  for (const dtlsNode of ntryDtlsNodes) {
    const txNodes = findChildren(dtlsNode, 'TxDtls');
    for (const [idx, txNode] of txNodes.entries()) {
      parsedDetails.push(
        readEntryTxDetails(txNode, `${fieldPath}.NtryDtls.TxDtls[${idx}]`),
      );
    }
  }

  return {
    entryReference:
      rawNtryRef !== undefined
        ? validateReferenceId(rawNtryRef, `${fieldPath}.NtryRef`)
        : undefined,
    amount,
    creditDebitIndicator,
    reversalIndicator,
    status: rawStatus as EntryStatusCode,
    bookingDate:
      bookgNode !== undefined
        ? readDateOrDateTimeChoice(bookgNode, `${fieldPath}.BookgDt`)
        : undefined,
    valueDate:
      valNode !== undefined
        ? readDateOrDateTimeChoice(valNode, `${fieldPath}.ValDt`)
        : undefined,
    accountServicerRef:
      rawAcctSvcrRef !== undefined
        ? validateReferenceId(rawAcctSvcrRef, `${fieldPath}.AcctSvcrRef`)
        : undefined,
    bankTransactionCode: readBankTxCode(bkTxNode, `${fieldPath}.BkTxCd`),
    transactions: parsedDetails.length > 0 ? parsedDetails : undefined,
  };
}
