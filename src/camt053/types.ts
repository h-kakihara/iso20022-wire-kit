import type { Money } from '../currency/money.js';
import type { CashAccount, FinancialInstitutionAgent } from '../models/account.js';
import type { CashBalance } from './balance.js';
import type { StatementEntry } from './entry.js';
import type { CreditDebitIndicator } from './signed-balance.js';

export const CAMT053_NAMESPACE =
  'urn:iso:std:iso:20022:tech:xsd:camt.053.001.08' as const;

export interface StatementPagination {
  readonly pageNumber: string;
  readonly lastPageIndicator: boolean;
}

export interface Camt053GroupHeader {
  readonly messageId: string;
  readonly creationDateTime: string;
  readonly pagination?: StatementPagination | undefined;
}

export interface TransactionsSummary {
  readonly totalEntriesCount: number;
  readonly totalEntriesSum: string;
  readonly totalNetAmount: Money;
  readonly totalNetCreditDebitIndicator: CreditDebitIndicator;
  readonly totalCreditCount: number;
  readonly totalCreditSum: string;
  readonly totalDebitCount: number;
  readonly totalDebitSum: string;
}

export interface AccountStatement {
  readonly id: string;
  readonly electronicSequenceNumber?: number | undefined;
  readonly creationDateTime: string;
  readonly fromDateTime?: string | undefined;
  readonly toDateTime?: string | undefined;
  readonly account: CashAccount;
  readonly servicerAgent?: FinancialInstitutionAgent | undefined;
  readonly balances: readonly CashBalance[];
  readonly transactionsSummary?: TransactionsSummary | undefined;
  readonly entries: readonly StatementEntry[];
}

export interface Camt053BuildInput {
  readonly messageId: string;
  readonly creationDateTime: string;
  readonly pagination?: StatementPagination | undefined;
  readonly statements: readonly AccountStatement[];
}

export interface Camt053Document {
  readonly header: Camt053GroupHeader;
  readonly statements: readonly AccountStatement[];
}
