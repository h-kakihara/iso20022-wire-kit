import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Money, buildPain001Xml, parsePain001Xml } from '../index.js';

describe('Institutional large-value >53-bit bigint precision guarantees', () => {
  it('preserves exact integer precision above Number.MAX_SAFE_INTEGER', () => {
    const ultraHighYen = 99_999_999_999_999_999n;
    const singleYen = 1n;

    const xml = buildPain001Xml({
      messageId: 'BOJ-RTGS-ULTRA-2026',
      creationDateTime: '2026-11-20T01:00:00Z',
      initiatingParty: { name: 'Tokyo Sovereign Clearing Corp' },
      paymentInstructions: [
        {
          paymentInformationId: 'BATCH-JPY-SOVEREIGN',
          requestedExecutionDate: '2026-11-20',
          debtor: { name: 'Tokyo Sovereign Clearing Corp' },
          debtorAccount: { otherId: 'BOJ-00019283', currency: 'JPY' },
          debtorAgent: { bic: 'BOTKJPJTXXX' },
          transactions: [
            {
              endToEndId: 'JGB-SETTLE-LEG-1',
              amount: Money.fromMinor(ultraHighYen, 'JPY'),
              creditor: { name: 'Osaka Trust Bank' },
              creditorAccount: { otherId: 'OSK-99182736', currency: 'JPY' },
            },
            {
              endToEndId: 'JGB-SETTLE-LEG-2',
              amount: Money.fromMinor(singleYen, 'JPY'),
              creditor: { name: 'Osaka Trust Bank' },
              creditorAccount: { otherId: 'OSK-99182736', currency: 'JPY' },
            },
          ],
        },
      ],
    });

    const parsed = parsePain001Xml(xml);
    assert.equal(parsed.header.controlSum, '100000000000000000.00');
    const legs = parsed.paymentInstructions[0]?.transactions ?? [];
    assert.equal(legs[0]?.amount.minorUnits, 99_999_999_999_999_999n);
    assert.equal(legs[1]?.amount.minorUnits, 1n);
  });

  it('roundtrips 4-decimal CLF accounting units without truncation', () => {
    const clfAmount = Money.fromWireString('1450.0075', 'CLF');
    assert.equal(clfAmount.minorUnits, 14500075n);
    assert.equal(clfAmount.toWireString(), '1450.0075');
  });
});
