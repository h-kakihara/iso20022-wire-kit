import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  Iso20022WireError,
  Money,
  auditStatementBalances,
} from '../index.js';

describe('camt.053 signed overdraft and ledger balance equation auditor', () => {
  it('audits overdraft transitions from DBIT opening to CRDT closing', () => {
    const summary = auditStatementBalances(
      {
        id: 'STMT-OVERDRAFT-01',
        creationDateTime: '2026-11-20T23:59:00Z',
        account: { iban: 'NL91ABNA0417164300', currency: 'EUR' },
        balances: [
          {
            type: 'OPBD',
            amount: Money.fromMinor(20000n, 'EUR'),
            creditDebitIndicator: 'DBIT',
            date: '2026-11-20',
          },
          {
            type: 'CLBD',
            amount: Money.fromMinor(30000n, 'EUR'),
            creditDebitIndicator: 'CRDT',
            date: '2026-11-20',
          },
        ],
        entries: [
          {
            amount: Money.fromMinor(50000n, 'EUR'),
            creditDebitIndicator: 'CRDT',
            status: 'BOOK',
            bookingDate: '2026-11-20',
            bankTransactionCode: {
              domainCode: 'PMNT',
              familyCode: 'RCDT',
              subFamilyCode: 'ESCT',
            },
          },
        ],
      },
      'Stmt[0]',
    );

    assert.equal(summary.totalNetAmount.minorUnits, 50000n);
    assert.equal(summary.totalNetCreditDebitIndicator, 'CRDT');
  });

  it('throws ERR_CONTROL_SUM_MISMATCH when CLBD is off by 1 minor unit', () => {
    assert.throws(
      () =>
        auditStatementBalances(
          {
            id: 'STMT-BROKEN-01',
            creationDateTime: '2026-11-20T23:59:00Z',
            account: { iban: 'NL91ABNA0417164300', currency: 'EUR' },
            balances: [
              {
                type: 'OPBD',
                amount: Money.fromMinor(10000n, 'EUR'),
                creditDebitIndicator: 'CRDT',
                date: '2026-11-20',
              },
              {
                type: 'CLBD',
                amount: Money.fromMinor(10001n, 'EUR'),
                creditDebitIndicator: 'CRDT',
                date: '2026-11-20',
              },
            ],
            entries: [],
          },
          'Stmt[0]',
        ),
      (err: unknown) =>
        err instanceof Iso20022WireError &&
        err.code === 'ERR_CONTROL_SUM_MISMATCH',
    );
  });
});
