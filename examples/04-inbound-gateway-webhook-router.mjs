import assert from 'node:assert/strict';
import {
  ISO20022_STATUS_REASON_DESCRIPTIONS,
  Iso20022WireError,
  buildPacs002Xml,
  parseAnyIso20022Xml,
} from '../dist/index.js';

const inboundPacs002 = buildPacs002Xml({
  messageId: 'GW-PACS002-991',
  creationDateTime: '2026-11-20T16:04:12Z',
  instructingAgent: { bic: 'ABNANL2AXXX' },
  instructedAgent: { bic: 'DEUTDEFFXXX' },
  originalGroupInfo: {
    originalMessageId: 'EX-SEPA-20261120-01',
    originalMessageNameId: 'pain.001.001.09',
    groupStatus: 'PART',
  },
  transactionStatuses: [
    {
      originalEndToEndId: 'VENDOR-INV-401',
      originalUetr: 'eb6305c9-1f7f-49de-aed0-16487c27b42d',
      transactionStatus: 'RJCT',
      statusReasons: [
        {
          reasonCode: 'AC04',
          additionalInformation: 'Beneficiary IBAN closed by account holder',
        },
      ],
    },
  ],
});

const routed = parseAnyIso20022Xml(inboundPacs002);
assert.equal(routed.kind, 'pacs.002');

const rejectedTx = routed.document.transactionStatuses[0];
const code = rejectedTx?.statusReasons?.[0]?.reasonCode;
assert.equal(code, 'AC04');

const hostileXxe = `<!DOCTYPE bomb [<!ENTITY xxe SYSTEM "file:///etc/shadow">]><Document>&xxe;</Document>`;
let blockedXxe = false;
try {
  parseAnyIso20022Xml(hostileXxe);
} catch (err) {
  if (err instanceof Iso20022WireError && err.code === 'ERR_XXE_OR_DOCTYPE_DETECTED') {
    blockedXxe = true;
  }
}
assert.equal(blockedXxe, true);

console.log(
  `[example:04] Gateway routed ${routed.kind} (${ISO20022_STATUS_REASON_DESCRIPTIONS[code]}) & blocked hostile XXE payload`,
);
