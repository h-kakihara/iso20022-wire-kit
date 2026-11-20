import assert from 'node:assert/strict';
import {
  buildSepaPain001Xml,
  computeWireHmacSha256,
  parsePain001Xml,
  verifyWireHmacSha256,
} from '../dist/index.js';

const hsmChannelKey = 'ebics-transport-signing-secret-2026';

const sepaXml = buildSepaPain001Xml({
  messageId: 'EX-SEPA-20261120-01',
  creationDateTime: '2026-11-20T08:30:00Z',
  paymentInformationId: 'EX-BATCH-EUR-01',
  requestedExecutionDate: '2026-11-20',
  debtor: {
    name: 'Kakihara Cloud Systems GmbH',
    lei: '5493001KJTIIGC8Y1R12',
  },
  debtorIban: 'DE89370400440532013000',
  debtorBic: 'DEUTDEFFXXX',
  categoryPurpose: 'SUPP',
  transfers: [
    {
      endToEndId: 'VENDOR-INV-401',
      uetr: 'eb6305c9-1f7f-49de-aed0-16487c27b42d',
      amountCents: 485000n,
      creditorName: 'Rotterdam Fiber Networks BV',
      creditorIban: 'NL91ABNA0417164300',
      creditorBic: 'ABNANL2AXXX',
      creditorReferenceScor: 'RF18539007547034',
    },
    {
      endToEndId: 'VENDOR-INV-402',
      amountCents: 115000n,
      creditorName: 'Paris Datacenter Operations SAS',
      creditorIban: 'FR7630006000011234567890189',
      creditorBic: 'BNPAFRPPXXX',
      remittanceUnstructured: 'Rack Colocation Fee Nov 2026',
    },
  ],
});

const mac = computeWireHmacSha256(sepaXml, hsmChannelKey);
assert.equal(verifyWireHmacSha256(sepaXml, hsmChannelKey, mac), true);

const verifiedDoc = parsePain001Xml(sepaXml);
assert.equal(verifiedDoc.header.controlSum, '6000.00');
console.log(
  `[example:01] SEPA pain.001 verified | txs=${verifiedDoc.header.numberOfTransactions} | sum=${verifiedDoc.header.controlSum} EUR | hmac=${mac.slice(0, 16)}...`,
);
