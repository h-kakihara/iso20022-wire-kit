# iso20022-wire-kit

[![CI](https://github.com/h-kakihara/iso20022-wire-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/h-kakihara/iso20022-wire-kit/actions/workflows/ci.yml)
[![CodeQL](https://github.com/h-kakihara/iso20022-wire-kit/actions/workflows/codeql.yml/badge.svg)](https://github.com/h-kakihara/iso20022-wire-kit/actions/workflows/codeql.yml)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#why-engineering-teams-choose-iso20022-wire-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ea4aaa?logo=github)](https://github.com/sponsors/h-kakihara)

**Zero-dependency TypeScript toolkit for building, parsing, and mathematically auditing ISO 20022 financial messages (`pain.001`, `pacs.008`, `head.001`, `camt.053`, `pacs.002`) with strict `bigint` minor-unit currency safety.**

Built for payment orchestration teams, neo-banks, treasury platforms, and ERP settlement pipelines that cannot afford IEEE-754 cent-rounding bugs, XML External Entity (XXE) vulnerabilities, or sprawling transitive `node_modules` trees in regulated environments.

---

## Why Engineering Teams Choose `iso20022-wire-kit`

* **Zero Floating-Point Money:** Every amount is stored and validated in `bigint` minor units mapped strictly to ISO 4217 scales (`0` for `JPY`, `2` for `EUR`/`USD`, `3` for `KWD`/`BHD`, `4` for `CLF`), preserving exact precision well beyond `Number.MAX_SAFE_INTEGER`.
* **Automatic Mathematical Tamper Auditing:**
  * `pain.001` & `pacs.008` verify `NbOfTxs`, $10^{-4}$ scaled `CtrlSum`, and homogeneous `TtlIntrBkSttlmAmt` down to a single minor unit.
  * `camt.053` enforces the signed ledger balance equation ($\text{OPBD} + \sum \text{BOOK} = \text{CLBD}$) across overdraft sign flips (`DBIT` $\leftrightarrow$ `CRDT`).
* **Pre-Tokenization Banking Validators:** Built-in ISO 13616 `IBAN` (MOD-97-10 + SEPA zone reachability), ISO 9362 `BIC8`/`BIC11`, ISO 17442 `LEI`, ISO 11649 `SCOR` (`RF` creditor reference), and SWIFT CBPR+ X-charset / T26 slash placement guards.
* **Hardened XML & Cryptographic Integrity:** Pre-parse O(n) XXE / `DOCTYPE` firewall, element nesting depth caps, canonical XML normalization, and constant-time SHA-256 / HMAC-SHA256 wire verification via `node:crypto`.
* **Zero Runtime Dependencies:** Auditable in a single sitting by bank compliance and AppSec teams.

---

## Supported ISO 20022 Schemas

| Schema | Standard Name | Builder API | Parser API | Network Presets & Rules |
| :--- | :--- | :--- | :--- | :--- |
| `pain.001.001.09` | Customer Credit Transfer Initiation | `buildPain001Xml`, `buildSepaPain001Xml` | `parsePain001Xml` | EPC SEPA (`EUR`, `SLEV`), SWIFT CBPR+ (`UETR`, `LEI`) |
| `pacs.008.001.08` | FI-to-FI Customer Credit Transfer | `buildPacs008Xml` | `parsePacs008Xml` | RTGS (`CLRG`/`TGT`), `INDA`/`INGA`/`COVE`, Cross-CCY FX |
| `head.001.001.02` | Business Application Header (BAH) | `buildAppHdrXml` | `parseAppHdrXml` | `swift.cbprplus.02` routing envelope |
| `camt.053.001.08` | Bank-to-Customer Statement | `buildCamt053Xml` | `parseCamt053Xml` | Signed `OPBD`/`CLBD` balance equation & `TxsSummry` audit |
| `pacs.002.001.10` | FI-to-FI Payment Status Report | `buildPacs002Xml` | `parsePacs002Xml` | Mandatory `RJCT` reason enforcement (`AM04`, `AC04`, `RR04`) |

---

## Installation

Requires **Node.js >= 20.0.0** (ESM).

**1. Checksum-Verified Install from Signed GitHub Release (Recommended — Zero Registry Trust):**

Download the pre-compiled release tarball and `.sha256` attestation via GitHub CLI (or directly from [Release v0.1.0 Assets](https://github.com/h-kakihara/iso20022-wire-kit/releases/tag/v0.1.0)):

```bash
gh release download v0.1.0 --repo h-kakihara/iso20022-wire-kit --pattern "*.tgz*"
sha256sum -c h-kakihara-iso20022-wire-kit-0.1.0.tgz.sha256
npm install ./h-kakihara-iso20022-wire-kit-0.1.0.tgz
```

**2. Internal Enterprise Registry Mirror (Artifactory / Verdaccio / NPM):**

```bash
npm install @h-kakihara/iso20022-wire-kit
```

---

## Quickstart

### 1. Build & Sign a SEPA Credit Transfer Batch (`pain.001.001.09`)

```ts
import {
  buildSepaPain001Xml,
  computeWireHmacSha256,
  parsePain001Xml,
} from '@h-kakihara/iso20022-wire-kit';

const xml = buildSepaPain001Xml({
  messageId: 'SEPA-20261120-001',
  creationDateTime: '2026-11-20T08:30:00Z',
  paymentInformationId: 'PMT-BATCH-EUR-01',
  requestedExecutionDate: '2026-11-20',
  debtor: {
    name: 'Kakihara Payments Europe GmbH',
    lei: '5493001KJTIIGC8Y1R12',
  },
  debtorIban: 'DE89370400440532013000',
  debtorBic: 'DEUTDEFFXXX',
  categoryPurpose: 'SUPP',
  transfers: [
    {
      endToEndId: 'INV-2026-9001',
      uetr: 'eb6305c9-1f7f-49de-aed0-16487c27b42d',
      amountCents: 320050n, // Exact 3,200.50 EUR in minor units
      creditorName: 'Rotterdam Fiber Networks BV',
      creditorIban: 'NL91ABNA0417164300',
      creditorBic: 'ABNANL2AXXX',
      creditorReferenceScor: 'RF18539007547034',
    },
  ],
});

const signature = computeWireHmacSha256(xml, process.env.EBICS_HMAC_SECRET ?? 'dev-key');
const parsed = parsePain001Xml(xml);
console.log(parsed.header.controlSum); // "3200.50"
```

### 2. Polymorphic Inbound Bank Feed & Webhook Routing

```ts
import { parseAnyIso20022Xml } from '@h-kakihara/iso20022-wire-kit';

export function handleInboundBankXml(rawXml: string): void {
  const envelope = parseAnyIso20022Xml(rawXml);

  switch (envelope.kind) {
    case 'camt.053':
      // Guaranteed: OPBD + booked entries == CLBD for every statement
      for (const stmt of envelope.document.statements) {
        console.log('Audited statement:', stmt.id, 'entries:', stmt.entries.length);
      }
      break;
    case 'pacs.002':
      for (const status of envelope.document.transactionStatuses) {
        if (status.transactionStatus === 'RJCT') {
          console.error('Wire rejected:', status.originalEndToEndId, status.statusReasons);
        }
      }
      break;
  }
}
```

---

## Documentation & Architecture

* [ISO 20022 Schema & Error Code Matrix](./docs/ISO20022_MATRIX.md)
* [STRIDE Financial Messaging Threat Model](./docs/THREAT_MODEL.md)
* [ADR-0001: Native `bigint` Minor-Unit Money Arithmetic](./docs/adr/0001-bigint-minor-unit-money.md)
* [ADR-0002: Zero-Dependency Architecture & XML Firewall](./docs/adr/0002-zero-dependency-xml-firewall.md)
* [Runnable Production Examples (`./examples`)](./examples)

---

## Part of the Open-Source Payment Infrastructure Suite

1. **`iso20022-wire-kit`** — Zero-dependency ISO 20022 builder, parser & validator (TypeScript)
2. **`atomic-ledger-engine`** — Immutable double-entry accounting ledger with Merkle audit proofs (Go 1.22)
3. **`idempotent-pay-guard`** — Distributed IETF idempotency-key enforcement middleware (TypeScript)
4. **`webhook-vault-verifier`** — Constant-time signature & replay defense for Stripe, Adyen & Wise (Go 1.22)
5. **`recon-stream-core`** — Streaming multi-currency settlement & fee-split reconciliation engine (TypeScript)

---

## Sustaining Regulated-Grade Open Source

Maintaining compliance-ready ISO 20022 schemas, EPC SEPA rulebook updates, and SWIFT CBPR+ network validations with zero external dependencies requires continuous engineering effort.

If `iso20022-wire-kit` saves your team weeks of banking integration and security audit work, please back ongoing maintenance via **[GitHub Sponsors](https://github.com/sponsors/h-kakihara)**:

* **Priority Triage ($25/mo):** 48-hour SLA on protocol bug reports.
* **Fintech Startup Backer ($100/mo):** Priority roadmap requests (e.g., `pain.008`, `camt.054`, `pacs.004`) + brand recognition.
* **Enterprise Sponsor ($500/mo):** Monthly payment architecture review + prominent Enterprise logo placement.

## License

Released under the [MIT License](./LICENSE).
