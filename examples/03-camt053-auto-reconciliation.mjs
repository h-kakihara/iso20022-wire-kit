import assert from 'node:assert/strict';
import { Money, buildCamt053Xml, parseCamt053Xml } from '../dist/index.js';

const expectedInvoices = new Map([
  ['RF18539007547034', 250000n],
  ['RF10INV2026001', 175000n],
]);

const camtXml = buildCamt053Xml({
  messageId: 'RECON-CAMT-20261120',
  creationDateTime: '2026-11-20T23:59:59Z',
  statements: [
    {
      id: 'STMT-MERCHANT-01',
      electronicSequenceNumber: 88,
      creationDateTime: '2026-11-20T23:59:59Z',
      account: {
        iban: 'DE89370400440532013000',
        currency: 'EUR',
      },
      balances: [
        {
          type: 'OPBD',
          amount: Money.fromMinor(1000000n, 'EUR'),
          creditDebitIndicator: 'CRDT',
          date: '2026-11-20',
        },
        {
          type: 'CLBD',
          amount: Money.fromMinor(1425000n, 'EUR'),
          creditDebitIndicator: 'CRDT',
          date: '2026-11-20',
        },
      ],
      entries: [
        {
          entryReference: 'BOOK-CR-01',
          amount: Money.fromMinor(425000n, 'EUR'),
          creditDebitIndicator: 'CRDT',
          status: 'BOOK',
          bookingDate: '2026-11-20',
          bankTransactionCode: {
            domainCode: 'PMNT',
            familyCode: 'RCDT',
            subFamilyCode: 'ESCT',
          },
          transactions: [
            {
              endToEndId: 'CUST-PAY-1',
              amount: Money.fromMinor(250000n, 'EUR'),
              creditDebitIndicator: 'CRDT',
              remittanceInfo: { creditorReference: 'RF18539007547034' },
            },
            {
              endToEndId: 'CUST-PAY-2',
              amount: Money.fromMinor(175000n, 'EUR'),
              creditDebitIndicator: 'CRDT',
              remittanceInfo: { creditorReference: 'RF10INV2026001' },
            },
          ],
        },
      ],
    },
  ],
});

const statementDoc = parseCamt053Xml(camtXml);
let reconciledCount = 0;

for (const stmt of statementDoc.statements) {
  for (const entry of stmt.entries) {
    if (entry.status !== 'BOOK' || entry.creditDebitIndicator !== 'CRDT') {
      continue;
    }
    for (const detail of entry.transactions ?? []) {
      const scor = detail.remittanceInfo?.creditorReference;
      if (scor !== undefined && expectedInvoices.get(scor) === detail.amount.minorUnits) {
        reconciledCount += 1;
      }
    }
  }
}

assert.equal(reconciledCount, 2);
console.log(
  `[example:03] camt.053 reconciliation complete | matchedInvoices=${reconciledCount}/2 | closingBalance=14250.00 EUR`,
);
