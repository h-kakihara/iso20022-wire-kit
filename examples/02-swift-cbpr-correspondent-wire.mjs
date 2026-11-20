import assert from 'node:assert/strict';
import {
  Money,
  buildAppHdrXml,
  buildPacs008Xml,
  parseAppHdrXml,
  parsePacs008Xml,
} from '../dist/index.js';

const uetr = '97ed4827-7b6f-4491-a06f-b548d5a7512d';

const appHdrXml = buildAppHdrXml({
  fromBic: 'CHASUS33XXX',
  toBic: 'DEUTDEFFXXX',
  businessMessageId: 'CBPR-MSG-20261120-09',
  messageDefinitionId: 'pacs.008.001.08',
  businessService: 'swift.cbprplus.02',
  creationDate: '2026-11-20T15:00:00Z',
});

const pacs008Xml = buildPacs008Xml({
  messageId: 'CBPR-MSG-20261120-09',
  creationDateTime: '2026-11-20T15:00:00Z',
  interbankSettlementDate: '2026-11-20',
  settlementInfo: { settlementMethod: 'INDA' },
  instructingAgent: { bic: 'CHASUS33XXX' },
  instructedAgent: { bic: 'DEUTDEFFXXX' },
  transactions: [
    {
      instructionId: 'CBPR-INSTR-09',
      endToEndId: 'CORP-ACQ-8821',
      uetr,
      paymentTypeInfo: {
        instructionPriority: 'HIGH',
        serviceLevel: 'URGP',
      },
      interbankSettlementAmount: Money.fromMinor(46250000n, 'EUR'),
      instructedAmount: Money.fromMinor(50000000n, 'USD'),
      exchangeRate: '0.925000',
      chargeBearer: 'SHAR',
      debtor: {
        name: 'Pacific Venture Partners LP',
        postalAddress: {
          townName: 'San Francisco',
          country: 'US',
        },
      },
      debtorAccount: { otherId: '9910028374', currency: 'USD' },
      debtorAgent: { bic: 'CHASUS33XXX' },
      creditorAgent: { bic: 'DEUTDEFFXXX' },
      creditor: {
        name: 'Berlin DeepTech Foundry AG',
        postalAddress: {
          townName: 'Berlin',
          country: 'DE',
        },
      },
      creditorAccount: {
        iban: 'DE89370400440532013000',
        currency: 'EUR',
      },
    },
  ],
});

const parsedBah = parseAppHdrXml(appHdrXml);
const parsedWire = parsePacs008Xml(pacs008Xml);
assert.equal(parsedBah.businessMessageId, parsedWire.header.messageId);
console.log(
  `[example:02] SWIFT CBPR+ pacs.008 ready | route=${parsedBah.fromBic}->${parsedBah.toBic} | uetr=${uetr}`,
);
