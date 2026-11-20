import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  Iso20022WireError,
  buildSepaPain001Xml,
  parsePain001Xml,
} from '../index.js';

describe('SEPA Credit Transfer preset and pain.001 tamper detection', () => {
  const validSepaXml = buildSepaPain001Xml({
    messageId: 'SEPA-20261120-001',
    creationDateTime: '2026-11-20T08:00:00Z',
    paymentInformationId: 'SEPA-PMT-01',
    requestedExecutionDate: '2026-11-20',
    debtor: { name: 'Kakihara EU GmbH' },
    debtorIban: 'DE89370400440532013000',
    debtorBic: 'DEUTDEFFXXX',
    categoryPurpose: 'SALA',
    transfers: [
      {
        endToEndId: 'SEPA-E2E-1',
        amountCents: 320050n,
        creditorName: 'Anna Schmidt',
        creditorIban: 'NL91ABNA0417164300',
        creditorBic: 'ABNANL2AXXX',
        creditorReferenceScor: 'RF18539007547034',
      },
      {
        endToEndId: 'SEPA-E2E-2',
        amountCents: 179950n,
        creditorName: ' Lukas Weber ',
        creditorIban: 'DE89370400440532013000',
        remittanceUnstructured: 'Payroll November 2026',
      },
    ],
  });

  it('parses valid SEPA batches and verifies 5000.00 EUR control sum', () => {
    const doc = parsePain001Xml(validSepaXml);
    assert.equal(doc.header.numberOfTransactions, 2);
    assert.equal(doc.header.controlSum, '5000.00');
  });

  it('detects 1-cent XML amount tampering against CtrlSum', () => {
    const tamperedXml = validSepaXml.replace('3200.50', '3200.51');
    assert.throws(
      () => parsePain001Xml(tamperedXml),
      (err: unknown) =>
        err instanceof Iso20022WireError &&
        err.code === 'ERR_CONTROL_SUM_MISMATCH',
    );
  });

  it('rejects non-SEPA destination IBANs inside SEPA preset', () => {
    assert.throws(
      () =>
        buildSepaPain001Xml({
          messageId: 'SEPA-BAD-01',
          creationDateTime: '2026-11-20T08:00:00Z',
          paymentInformationId: 'SEPA-PMT-BAD',
          requestedExecutionDate: '2026-11-20',
          debtor: { name: 'Kakihara EU GmbH' },
          debtorIban: 'DE89370400440532013000',
          debtorBic: 'DEUTDEFFXXX',
          transfers: [
            {
              endToEndId: 'NON-SEPA-1',
              amountCents: 10000n,
              creditorName: 'Gulf Trading LLC',
              creditorIban: 'AE070331234567890123456',
            },
          ],
        }),
      (err: unknown) =>
        err instanceof Iso20022WireError && err.code === 'ERR_INVALID_IBAN',
    );
  });
});
