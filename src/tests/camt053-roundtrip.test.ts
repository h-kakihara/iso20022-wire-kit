import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Money, buildCamt053Xml, parseCamt053Xml } from '../index.js';

describe('ISO 20022 camt.053.001.08 bank-to-customer statement roundtrip', () => {
  it('builds and parses booked and pending entries with TxsSummry', () => {
    const xml = buildCamt053Xml({
      messageId: 'CAMT053-20261120-EOD',
      creationDateTime: '2026-11-20T23:59:00Z',
      pagination: { pageNumber: '1', lastPageIndicator: true },
      statements: [
        {
          id: 'STMT-EUR-2026-324',
          electronicSequenceNumber: 324,
          creationDateTime: '2026-11-20T23:59:00Z',
          fromDateTime: '2026-11-20T00:00:00Z',
          toDateTime: '2026-11-20T23:59:00Z',
          account: {
            iban: 'DE89370400440532013000',
            currency: 'EUR',
            name: 'Operating Settlement Account',
          },
          servicerAgent: { bic: 'DEUTDEFFXXX' },
          balances: [
            {
              type: 'OPBD',
              amount: Money.fromMinor(1000000n, 'EUR'),
              creditDebitIndicator: 'CRDT',
              date: '2026-11-20',
            },
            {
              type: 'CLBD',
              amount: Money.fromMinor(1350000n, 'EUR'),
              creditDebitIndicator: 'CRDT',
              date: '2026-11-20',
            },
          ],
          entries: [
            {
              entryReference: 'NTRY-001',
              amount: Money.fromMinor(500000n, 'EUR'),
              creditDebitIndicator: 'CRDT',
              status: 'BOOK',
              bookingDate: '2026-11-20',
              valueDate: '2026-11-20',
              bankTransactionCode: {
                domainCode: 'PMNT',
                familyCode: 'RCDT',
                subFamilyCode: 'ESCT',
              },
              transactions: [
                {
                  endToEndId: 'CUST-IN-882',
                  uetr: 'eb6305c9-1f7f-49de-aed0-16487c27b42d',
                  amount: Money.fromMinor(500000n, 'EUR'),
                  creditDebitIndicator: 'CRDT',
                  debtor: { name: 'Nordic Retail AB' },
                },
              ],
            },
            {
              entryReference: 'NTRY-002',
              amount: Money.fromMinor(150000n, 'EUR'),
              creditDebitIndicator: 'DBIT',
              status: 'BOOK',
              bookingDate: '2026-11-20',
              bankTransactionCode: {
                domainCode: 'PMNT',
                familyCode: 'ICDT',
                subFamilyCode: 'ESCT',
              },
            },
            {
              entryReference: 'NTRY-003-PDNG',
              amount: Money.fromMinor(99900n, 'EUR'),
              creditDebitIndicator: 'DBIT',
              status: 'PDNG',
              bankTransactionCode: {
                proprietaryCode: 'CARD-AUTH-HOLD',
                proprietaryIssuer: 'DEUT',
              },
            },
          ],
        },
      ],
    });

    const parsed = parseCamt053Xml(xml);
    assert.equal(parsed.header.pagination?.lastPageIndicator, true);
    const stmt = parsed.statements[0];
    assert(stmt !== undefined);
    assert.equal(stmt.entries.length, 3);
    assert.equal(stmt.transactionsSummary?.totalCreditCount, 1);
    assert.equal(stmt.transactionsSummary?.totalDebitCount, 2);
  });
});
