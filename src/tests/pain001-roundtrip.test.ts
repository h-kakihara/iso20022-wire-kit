import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Money, buildPain001Xml, parsePain001Xml } from '../index.js';

describe('ISO 20022 pain.001.001.09 treasury wire roundtrip', () => {
  it('builds and parses multi-currency corporate credit transfers losslessly', () => {
    const xml = buildPain001Xml({
      messageId: 'PAIN-MSG-20261120-01',
      creationDateTime: '2026-11-20T10:15:30Z',
      initiatingParty: {
        name: 'Kakihara Treasury Holdings Inc',
        lei: '5493001KJTIIGC8Y1R12',
        postalAddress: {
          streetName: 'Market Street',
          buildingNumber: '500',
          postCode: '94105',
          townName: 'San Francisco',
          countrySubDivision: 'CA',
          country: 'US',
        },
      },
      paymentInstructions: [
        {
          paymentInformationId: 'BATCH-USD-01',
          paymentMethod: 'TRF',
          batchBooking: false,
          paymentTypeInfo: {
            instructionPriority: 'HIGH',
            serviceLevel: 'URGP',
            categoryPurpose: 'SUPP',
          },
          requestedExecutionDate: '2026-11-20',
          debtor: {
            name: 'Kakihara Treasury Holdings Inc',
            lei: '5493001KJTIIGC8Y1R12',
          },
          debtorAccount: {
            otherId: '880019283746',
            currency: 'USD',
          },
          debtorAgent: { bic: 'CHASUS33XXX' },
          chargeBearer: 'SHAR',
          transactions: [
            {
              instructionId: 'INSTR-001',
              endToEndId: 'E2E-SUPPLIER-9001',
              uetr: 'eb6305c9-1f7f-49de-aed0-16487c27b42d',
              amount: Money.fromMinor(250075n, 'USD'),
              creditorAgent: { bic: 'NWBKGB2LXXX' },
              creditor: {
                name: 'Thames Cloud Infrastructure Ltd',
                postalAddress: {
                  townName: 'London',
                  country: 'GB',
                },
              },
              creditorAccount: {
                iban: 'GB29NWBK60161331926819',
                currency: 'USD',
              },
              purposeCode: 'SUPP',
              remittanceInfo: {
                unstructured: 'Invoice INV-2026-9001 settlement',
              },
            },
          ],
        },
      ],
    });

    const parsed = parsePain001Xml(xml);
    assert.equal(parsed.header.messageId, 'PAIN-MSG-20261120-01');
    assert.equal(parsed.header.numberOfTransactions, 1);
    assert.equal(parsed.header.controlSum, '2500.75');

    const batch = parsed.paymentInstructions[0];
    assert(batch !== undefined);
    assert.equal(batch.paymentInformationId, 'BATCH-USD-01');
    const tx = batch.transactions[0];
    assert(tx !== undefined);
    assert.equal(tx.amount.minorUnits, 250075n);
    assert.equal(tx.uetr, 'eb6305c9-1f7f-49de-aed0-16487c27b42d');
    assert.equal(tx.creditorAccount.iban, 'GB29NWBK60161331926819');
  });
});
