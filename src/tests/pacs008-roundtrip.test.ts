import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Money, buildPacs008Xml, parsePacs008Xml } from '../index.js';

describe('ISO 20022 pacs.008.001.08 interbank clearing roundtrip', () => {
  it('serializes and reconciles TARGET2 RTGS cross-currency FX legs', () => {
    const xml = buildPacs008Xml({
      messageId: 'PACS008-20261120-77',
      creationDateTime: '2026-11-20T11:00:00Z',
      interbankSettlementDate: '2026-11-20',
      settlementInfo: {
        settlementMethod: 'CLRG',
        clearingSystemCode: 'TGT',
      },
      instructingAgent: { bic: 'DEUTDEFFXXX' },
      instructedAgent: { bic: 'BNPAFRPPXXX' },
      transactions: [
        {
          instructionId: 'IBK-INSTR-01',
          endToEndId: 'E2E-FX-991',
          transactionId: 'TX-RTGS-001',
          uetr: '97ed4827-7b6f-4491-a06f-b548d5a7512d',
          paymentTypeInfo: {
            instructionPriority: 'HIGH',
            serviceLevel: 'URGP',
          },
          interbankSettlementAmount: Money.fromMinor(925000n, 'EUR'),
          instructedAmount: Money.fromMinor(1000000n, 'USD'),
          exchangeRate: '0.925000',
          chargeBearer: 'SHAR',
          debtor: { name: 'Apex Semiconductor Corp' },
          debtorAccount: { otherId: '4491029384', currency: 'USD' },
          debtorAgent: { bic: 'CHASUS33XXX' },
          creditorAgent: { bic: 'BNPAFRPPXXX' },
          creditor: { name: 'Lumiere Photonics SAS' },
          creditorAccount: {
            iban: 'DE89370400440532013000',
            currency: 'EUR',
          },
          remittanceInfo: {
            creditorReference: 'RF10INV2026001',
          },
        },
      ],
    });

    const doc = parsePacs008Xml(xml);
    assert.equal(doc.header.settlementInfo.settlementMethod, 'CLRG');
    assert.equal(doc.header.settlementInfo.clearingSystemCode, 'TGT');
    assert(doc.header.totalInterbankSettlementAmount !== undefined);
    assert.equal(doc.header.totalInterbankSettlementAmount.minorUnits, 925000n);

    const leg = doc.transactions[0];
    assert(leg !== undefined);
    assert.equal(leg.exchangeRate, '0.925000');
    assert.equal(leg.instructedAmount?.currency, 'USD');
  });
});
