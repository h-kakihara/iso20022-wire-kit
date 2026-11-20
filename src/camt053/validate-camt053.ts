import { resolveCurrency } from '../currency/iso4217.js';
import { Iso20022WireError } from '../errors/wire-error.js';
import { DecimalSumAccumulator } from '../models/control-sum.js';
import type { CashBalance } from './balance.js';
import type { StatementEntry } from './entry.js';
import {
  fromSignedMinorUnits,
  toSignedMinorUnits,
} from './signed-balance.js';
import type { AccountStatement, TransactionsSummary } from './types.js';

export function computeTransactionsSummary(
  entries: readonly StatementEntry[],
  accountCurrency: string,
  fieldPath: string,
): TransactionsSummary {
  const ccy = resolveCurrency(accountCurrency, `${fieldPath}.Acct.Ccy`).code;
  const allAccumulator = new DecimalSumAccumulator();
  const creditAccumulator = new DecimalSumAccumulator();
  const debitAccumulator = new DecimalSumAccumulator();
  let signedNetMinor = 0n;

  for (const [idx, entry] of entries.entries()) {
    if (entry.amount.currency !== ccy) {
      throw new Iso20022WireError(
        'ERR_INVALID_CURRENCY',
        `Statement entry Ntry[${idx}] currency ${entry.amount.currency} does not match statement account currency ${ccy}`,
        `${fieldPath}.Ntry[${idx}].Amt`,
      );
    }
    allAccumulator.addMoney(entry.amount);
    if (entry.creditDebitIndicator === 'CRDT') {
      creditAccumulator.addMoney(entry.amount);
    } else {
      debitAccumulator.addMoney(entry.amount);
    }
    signedNetMinor += toSignedMinorUnits(entry.amount, entry.creditDebitIndicator);
  }

  const directedNet = fromSignedMinorUnits(
    signedNetMinor,
    ccy,
    `${fieldPath}.TxsSummry.TtlNtries.TtlNetNtry`,
  );

  return {
    totalEntriesCount: allAccumulator.transactionCount,
    totalEntriesSum: allAccumulator.formatControlSum(),
    totalNetAmount: directedNet.amount,
    totalNetCreditDebitIndicator: directedNet.creditDebitIndicator,
    totalCreditCount: creditAccumulator.transactionCount,
    totalCreditSum: creditAccumulator.formatControlSum(),
    totalDebitCount: debitAccumulator.transactionCount,
    totalDebitSum: debitAccumulator.formatControlSum(),
  };
}

export function auditStatementBalances(
  statement: AccountStatement,
  fieldPath: string,
): TransactionsSummary {
  if (statement.account.currency === undefined) {
    throw new Iso20022WireError(
      'ERR_INVALID_CURRENCY',
      'camt.053 AccountStatement requires explicit Acct.Ccy for balance equation auditing',
      `${fieldPath}.Acct.Ccy`,
    );
  }
  const ccy = resolveCurrency(statement.account.currency, `${fieldPath}.Acct.Ccy`).code;

  let openingBooked: CashBalance | undefined;
  let closingBooked: CashBalance | undefined;

  for (const [idx, bal] of statement.balances.entries()) {
    if (bal.amount.currency !== ccy) {
      throw new Iso20022WireError(
        'ERR_INVALID_CURRENCY',
        `Balance Bal[${idx}] (${bal.type}) currency ${bal.amount.currency} mismatches account currency ${ccy}`,
        `${fieldPath}.Bal[${idx}].Amt`,
      );
    }
    if (bal.type === 'OPBD') {
      if (openingBooked !== undefined) {
        throw new Iso20022WireError(
          'ERR_SCHEMA_VIOLATION',
          'Duplicate OPBD (Opening Booked) balance in camt.053 statement',
          `${fieldPath}.Bal[${idx}]`,
        );
      }
      openingBooked = bal;
    } else if (bal.type === 'CLBD') {
      if (closingBooked !== undefined) {
        throw new Iso20022WireError(
          'ERR_SCHEMA_VIOLATION',
          'Duplicate CLBD (Closing Booked) balance in camt.053 statement',
          `${fieldPath}.Bal[${idx}]`,
        );
      }
      closingBooked = bal;
    }
  }

  if (openingBooked === undefined || closingBooked === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'camt.053 statement must declare both OPBD (Opening Booked) and CLBD (Closing Booked) balances',
      `${fieldPath}.Bal`,
    );
  }

  let bookedDeltaMinor = 0n;
  for (const [idx, entry] of statement.entries.entries()) {
    if (entry.amount.currency !== ccy) {
      throw new Iso20022WireError(
        'ERR_INVALID_CURRENCY',
        `Entry Ntry[${idx}] currency ${entry.amount.currency} mismatches account currency ${ccy}`,
        `${fieldPath}.Ntry[${idx}].Amt`,
      );
    }
    if (entry.status === 'BOOK') {
      bookedDeltaMinor += toSignedMinorUnits(entry.amount, entry.creditDebitIndicator);
    }
  }

  const openingSigned = toSignedMinorUnits(
    openingBooked.amount,
    openingBooked.creditDebitIndicator,
  );
  const closingSigned = toSignedMinorUnits(
    closingBooked.amount,
    closingBooked.creditDebitIndicator,
  );

  if (openingSigned + bookedDeltaMinor !== closingSigned) {
    const expectedClosing = fromSignedMinorUnits(openingSigned + bookedDeltaMinor, ccy);
    throw new Iso20022WireError(
      'ERR_CONTROL_SUM_MISMATCH',
      `Ledger balance equation failed: OPBD + booked entries = ${expectedClosing.creditDebitIndicator} ${expectedClosing.amount.toWireString()} ${ccy}, but CLBD declared ${closingBooked.creditDebitIndicator} ${closingBooked.amount.toWireString()} ${ccy}`,
      `${fieldPath}.Bal`,
    );
  }

  const computedSummary = computeTransactionsSummary(
    statement.entries,
    ccy,
    fieldPath,
  );

  if (statement.transactionsSummary !== undefined) {
    const decl = statement.transactionsSummary;
    if (
      decl.totalEntriesCount !== computedSummary.totalEntriesCount ||
      decl.totalCreditCount !== computedSummary.totalCreditCount ||
      decl.totalDebitCount !== computedSummary.totalDebitCount
    ) {
      throw new Iso20022WireError(
        'ERR_TRANSACTION_COUNT_MISMATCH',
        'Declared camt.053 TxsSummry entry counts do not match parsed statement entries',
        `${fieldPath}.TxsSummry`,
      );
    }
    if (
      !decl.totalNetAmount.equals(computedSummary.totalNetAmount) ||
      (decl.totalNetAmount.minorUnits > 0n &&
        decl.totalNetCreditDebitIndicator !==
          computedSummary.totalNetCreditDebitIndicator)
    ) {
      throw new Iso20022WireError(
        'ERR_CONTROL_SUM_MISMATCH',
        'Declared camt.053 TxsSummry TtlNetNtry does not match signed sum of entries',
        `${fieldPath}.TxsSummry.TtlNtries.TtlNetNtry`,
      );
    }
  }

  return computedSummary;
}
