import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  Money,
  buildAppHdrXml,
  buildCamt053Xml,
  buildPacs002Xml,
  buildPacs008Xml,
  buildSepaPain001Xml,
  detectIso20022MessageType,
  parseAnyIso20022Xml,
} from '../index.js';

describe('Polymorphic ISO 20022 message detector and router', () => {
  it('classifies and parses all 5 supported ISO 20022 wire schemas', () => {
    const painXml = buildSepaPain001Xml({
      messageId: 'RTR-PAIN-1',
      creationDateTime: '2026-11-20T09:00:00Z',
      paymentInformationId: 'RTR-PMT-1',
      requestedExecutionDate: '2026-11-20',
      debtor: { name: 'Debtor GmbH' },
      debtorIban: 'DE89370400440532013000',
      debtorBic: 'DEUTDEFFXXX',
      transfers: [
        {
          endToEndId: 'E2E-1',
          amountCents: 1000n,
          creditorName: 'Creditor BV',
          creditorIban: 'NL91ABNA0417164300',
        },
      ],
    });

    const pacs008Xml = buildPacs008Xml({
      messageId: 'RTR-PACS8-1',
      creationDateTime: '2026-11-20T09:01:00Z',
      interbankSettlementDate: '2026-11-20',
      settlementInfo: { settlementMethod: 'INDA' },
      instructingAgent: { bic: 'DEUTDEFFXXX' },
      instructedAgent: { bic: 'ABNANL2AXXX' },
      transactions: [
        {
          endToEndId: 'E2E-1',
          uetr: 'eb6305c9-1f7f-49de-aed0-16487c27b42d',
          interbankSettlementAmount: Money.fromMinor(1000n, 'EUR'),
          chargeBearer: 'SLEV',
          debtor: { name: 'Debtor GmbH' },
          debtorAgent: { bic: 'DEUTDEFFXXX' },
          creditorAgent: { bic: 'ABNANL2AXXX' },
          creditor: { name: 'Creditor BV' },
        },
      ],
    });

    const camtXml = buildCamt053Xml({
      messageId: 'RTR-CAMT-1',
      creationDateTime: '2026-11-20T23:59:00Z',
      statements: [
        {
          id: 'STMT-1',
          creationDateTime: '2026-11-20T23:59:00Z',
          account: { iban: 'DE89370400440532013000', currency: 'EUR' },
          balances: [
            {
              type: 'OPBD',
              amount: Money.fromMinor(1000n, 'EUR'),
              creditDebitIndicator: 'CRDT',
              date: '2026-11-20',
            },
            {
              type: 'CLBD',
              amount: Money.fromMinor(1000n, 'EUR'),
              creditDebitIndicator: 'CRDT',
              date: '2026-11-20',
            },
          ],
          entries: [],
        },
      ],
    });

    const pacs002Xml = buildPacs002Xml({
      messageId: 'RTR-PACS2-1',
      creationDateTime: '2026-11-20T09:02:00Z',
      originalGroupInfo: {
        originalMessageId: 'RTR-PACS8-1',
        originalMessageNameId: 'pacs.008.001.08',
        groupStatus: 'ACSC',
      },
    });

    const bahXml = buildAppHdrXml({
      fromBic: 'DEUTDEFFXXX',
      toBic: 'ABNANL2AXXX',
      businessMessageId: 'RTR-BAH-1',
      messageDefinitionId: 'pacs.008.001.08',
      creationDate: '2026-11-20T09:01:00Z',
    });

    assert.equal(detectIso20022MessageType(painXml), 'pain.001');
    assert.equal(detectIso20022MessageType(pacs008Xml), 'pacs.008');
    assert.equal(detectIso20022MessageType(camtXml), 'camt.053');
    assert.equal(detectIso20022MessageType(pacs002Xml), 'pacs.002');
    assert.equal(detectIso20022MessageType(bahXml), 'head.001');

    const envelope = parseAnyIso20022Xml(pacs002Xml);
    assert.equal(envelope.kind, 'pacs.002');
    if (envelope.kind === 'pacs.002') {
      assert.equal(envelope.document.originalGroupInfo.groupStatus, 'ACSC');
    }
  });
});
