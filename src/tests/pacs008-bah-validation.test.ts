import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  Iso20022WireError,
  Money,
  buildAppHdrXml,
  buildPacs008Xml,
  parseAppHdrXml,
} from '../index.js';

describe('SWIFT CBPR+ BusinessApplicationHeader and pacs.008 UETR guards', () => {
  it('builds and parses head.001.001.02 routing envelopes', () => {
    const bahXml = buildAppHdrXml({
      fromBic: 'DEUTDEFFXXX',
      toBic: 'CHASUS33XXX',
      businessMessageId: 'BAH-20261120-0042',
      messageDefinitionId: 'pacs.008.001.08',
      businessService: 'swift.cbprplus.02',
      creationDate: '2026-11-20T12:00:00Z',
    });

    const parsed = parseAppHdrXml(bahXml);
    assert.equal(parsed.fromBic, 'DEUTDEFFXXX');
    assert.equal(parsed.toBic, 'CHASUS33XXX');
    assert.equal(parsed.messageDefinitionId, 'pacs.008.001.08');
    assert.equal(parsed.businessService, 'swift.cbprplus.02');
  });

  it('rejects duplicate UETRs and missing cross-currency XchgRate', () => {
    const sharedUetr = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    const baseTx = {
      endToEndId: 'E2E-1',
      uetr: sharedUetr,
      interbankSettlementAmount: Money.fromMinor(10000n, 'EUR'),
      chargeBearer: 'SLEV' as const,
      debtor: { name: 'Debtor A' },
      debtorAgent: { bic: 'DEUTDEFFXXX' },
      creditorAgent: { bic: 'ABNANL2AXXX' },
      creditor: { name: 'Creditor B' },
    };

    assert.throws(
      () =>
        buildPacs008Xml({
          messageId: 'DUP-UETR-MSG',
          creationDateTime: '2026-11-20T12:00:00Z',
          interbankSettlementDate: '2026-11-20',
          settlementInfo: { settlementMethod: 'INDA' },
          instructingAgent: { bic: 'DEUTDEFFXXX' },
          instructedAgent: { bic: 'ABNANL2AXXX' },
          transactions: [baseTx, { ...baseTx, endToEndId: 'E2E-2' }],
        }),
      (err: unknown) =>
        err instanceof Iso20022WireError && err.code === 'ERR_SCHEMA_VIOLATION',
    );

    assert.throws(
      () =>
        buildPacs008Xml({
          messageId: 'MISSING-FX-MSG',
          creationDateTime: '2026-11-20T12:00:00Z',
          interbankSettlementDate: '2026-11-20',
          settlementInfo: { settlementMethod: 'INDA' },
          instructingAgent: { bic: 'DEUTDEFFXXX' },
          instructedAgent: { bic: 'ABNANL2AXXX' },
          transactions: [
            {
              ...baseTx,
              instructedAmount: Money.fromMinor(11000n, 'USD'),
            },
          ],
        }),
      (err: unknown) =>
        err instanceof Iso20022WireError && err.code === 'ERR_SCHEMA_VIOLATION',
    );
  });
});
