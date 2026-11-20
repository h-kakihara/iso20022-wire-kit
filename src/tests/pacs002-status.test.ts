import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  Iso20022WireError,
  buildPacs002Xml,
  parsePacs002Xml,
} from '../index.js';

describe('ISO 20022 pacs.002.001.10 payment status report codec', () => {
  it('roundtrips RJCT status reports with AM04 insufficient funds reason', () => {
    const xml = buildPacs002Xml({
      messageId: 'PACS002-20261120-RJCT',
      creationDateTime: '2026-11-20T11:02:15Z',
      instructingAgent: { bic: 'BNPAFRPPXXX' },
      instructedAgent: { bic: 'DEUTDEFFXXX' },
      originalGroupInfo: {
        originalMessageId: 'PACS008-20261120-77',
        originalMessageNameId: 'pacs.008.001.08',
        groupStatus: 'PART',
      },
      transactionStatuses: [
        {
          statusId: 'STS-001',
          originalEndToEndId: 'E2E-FX-991',
          originalUetr: '97ed4827-7b6f-4491-a06f-b548d5a7512d',
          transactionStatus: 'RJCT',
          statusReasons: [
            {
              reasonCode: 'AM04',
              additionalInformation: 'Insufficient intraday liquidity on debtor account',
            },
          ],
        },
      ],
    });

    const parsed = parsePacs002Xml(xml);
    assert.equal(parsed.originalGroupInfo.groupStatus, 'PART');
    const firstTx = parsed.transactionStatuses[0];
    assert(firstTx !== undefined);
    assert.equal(firstTx.transactionStatus, 'RJCT');
    assert.equal(firstTx.statusReasons?.[0]?.reasonCode, 'AM04');
  });

  it('rejects RJCT status entries that omit StatusReasonInformation', () => {
    assert.throws(
      () =>
        buildPacs002Xml({
          messageId: 'PACS002-NO-RSN',
          creationDateTime: '2026-11-20T11:05:00Z',
          originalGroupInfo: {
            originalMessageId: 'PACS008-20261120-77',
            originalMessageNameId: 'pacs.008.001.08',
          },
          transactionStatuses: [
            {
              originalEndToEndId: 'E2E-FX-991',
              transactionStatus: 'RJCT',
            },
          ],
        }),
      (err: unknown) =>
        err instanceof Iso20022WireError && err.code === 'ERR_SCHEMA_VIOLATION',
    );
  });
});
