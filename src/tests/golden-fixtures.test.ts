import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CAMT053_EOD_STATEMENT_XML } from '../fixtures/camt053-eod-statement.fixture.js';
import { PACS002_RJCT_AM04_XML } from '../fixtures/pacs002-rjct-am04.fixture.js';
import {
  BAH_TARGET2_RTGS_XML,
  PACS008_TARGET2_RTGS_XML,
} from '../fixtures/pacs008-target2-rtgs.fixture.js';
import { PAIN001_CBPR_USD_XML } from '../fixtures/pain001-cbpr-usd.fixture.js';
import { PAIN001_SEPA_PAYROLL_XML } from '../fixtures/pain001-sepa-payroll.fixture.js';
import {
  computeWireSha256,
  parseAppHdrXml,
  parseCamt053Xml,
  parsePacs002Xml,
  parsePacs008Xml,
  parsePain001Xml,
  verifyWireSha256,
} from '../index.js';

describe('Golden banking XML fixture conformance suite', () => {
  it('validates EPC SEPA pain.001 payroll fixture and deterministic digest', () => {
    const doc = parsePain001Xml(PAIN001_SEPA_PAYROLL_XML);
    assert.equal(doc.header.messageId, 'FIX-SEPA-20261120-001');
    assert.equal(doc.header.initiatingParty.lei, '5493001KJTIIGC8Y1R12');
    assert.equal(doc.paymentInstructions[0]?.transactions.length, 2);

    const digest = computeWireSha256(PAIN001_SEPA_PAYROLL_XML);
    assert.equal(verifyWireSha256(PAIN001_SEPA_PAYROLL_XML, digest), true);
  });

  it('validates SWIFT CBPR+ USD treasury wire fixture', () => {
    const doc = parsePain001Xml(PAIN001_CBPR_USD_XML);
    const tx = doc.paymentInstructions[0]?.transactions[0];
    assert(tx !== undefined);
    assert.equal(tx.amount.minorUnits, 12500050n);
    assert.equal(tx.creditor.postalAddress?.country, 'CH');
    assert.equal(tx.creditorAccount.iban, 'CH9300762011623852957');
  });

  it('correlates BAH head.001, TARGET2 pacs.008, and pacs.002 AM04 rejection', () => {
    const bah = parseAppHdrXml(BAH_TARGET2_RTGS_XML);
    const pacs008 = parsePacs008Xml(PACS008_TARGET2_RTGS_XML);
    const pacs002 = parsePacs002Xml(PACS002_RJCT_AM04_XML);

    assert.equal(bah.messageDefinitionId, 'pacs.008.001.08');
    assert.equal(
      pacs002.originalGroupInfo.originalMessageId,
      pacs008.header.messageId,
    );
    assert.equal(
      pacs002.transactionStatuses[0]?.originalUetr,
      pacs008.transactions[0]?.uetr,
    );
  });

  it('reconciles EOD camt.053 golden statement balances', () => {
    const stmtDoc = parseCamt053Xml(CAMT053_EOD_STATEMENT_XML);
    const stmt = stmtDoc.statements[0];
    assert(stmt !== undefined);
    assert.equal(stmt.electronicSequenceNumber, 105);
    assert.equal(stmt.transactionsSummary?.totalNetAmount.minorUnits, 5000000n);
  });
});
