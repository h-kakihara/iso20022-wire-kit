import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  buildSepaPain001Xml,
  computeWireSha256,
  parsePain001Xml,
} from '../dist/index.js';

const ITERATIONS = 1_000;

const sampleInput = {
  messageId: 'BENCH-SEPA-2026',
  creationDateTime: '2026-11-20T12:00:00Z',
  paymentInformationId: 'BENCH-PMT-01',
  requestedExecutionDate: '2026-11-20',
  debtor: { name: 'Kakihara Benchmark AG' },
  debtorIban: 'DE89370400440532013000',
  debtorBic: 'DEUTDEFFXXX',
  transfers: [
    {
      endToEndId: 'BENCH-LEG-1',
      amountCents: 125000n,
      creditorName: 'Counterparty Alpha BV',
      creditorIban: 'NL91ABNA0417164300',
      creditorReferenceScor: 'RF18539007547034',
    },
    {
      endToEndId: 'BENCH-LEG-2',
      amountCents: 875000n,
      creditorName: 'Counterparty Beta SAS',
      creditorIban: 'FR7630006000011234567890189',
      remittanceUnstructured: 'Settlement Batch Benchmark',
    },
  ],
};

const sampleXml = buildSepaPain001Xml(sampleInput);

const startBuild = performance.now();
for (let i = 0; i < ITERATIONS; i += 1) {
  buildSepaPain001Xml(sampleInput);
}
const buildMs = performance.now() - startBuild;

const startParse = performance.now();
for (let i = 0; i < ITERATIONS; i += 1) {
  const doc = parsePain001Xml(sampleXml);
  assert.equal(doc.header.numberOfTransactions, 2);
}
const parseMs = performance.now() - startParse;

const digest = computeWireSha256(sampleXml);
assert.equal(digest.length, 64);

const buildOpsSec = Math.round((ITERATIONS / buildMs) * 1000);
const parseOpsSec = Math.round((ITERATIONS / parseMs) * 1000);

console.log(
  `[benchmark] ${ITERATIONS} iterations | build=${buildOpsSec} msg/s | parse+audit=${parseOpsSec} msg/s | zero-deps`,
);
