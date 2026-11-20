# Financial Messaging Threat Model (STRIDE)

`iso20022-wire-kit` sits on the critical path between treasury/ledger databases and external banking rails (SEPA, SWIFT CBPR+, TARGET2, EBICS). Below is the threat taxonomy mitigated by the library's core architecture.

## 1. Tampering — Monetary Precision & Amount Manipulation

* **Threat:** IEEE-754 floating-point conversions (`parseFloat("19.99") * 100`) silently drop or add minor units during batch serialization, or an attacker modifies a single `<InstdAmt>` tag in transit without updating batch headers.
* **Mitigation:**
  * All monetary amounts are represented exclusively as `bigint` minor units validated against `ISO4217_REGISTRY` (`0`, `2`, `3`, or `4` decimal places).
  * `DecimalSumAccumulator` computes and verifies `<CtrlSum>` in exact $10^{-4}$ scaled `bigint` integers on both `<GrpHdr>` and `<PmtInf>` levels.
  * `camt.053` ingestion enforces the signed accounting equation: $\text{OPBD} + \sum \text{BOOK} = \text{CLBD}$.

## 2. Information Disclosure & DoS — XML External Entities (XXE)

* **Threat:** Malicious inbound `camt.053` or `pacs.002` payloads include `<!DOCTYPE>` or `<!ENTITY>` declarations to exfiltrate local filesystem secrets (XXE) or trigger exponential memory expansion (Billion Laughs).
* **Mitigation:** `inspectXmlSafety()` executes prior to tokenization, rejecting any payload containing `<!DOCTYPE`, `<!ENTITY`, null bytes (`\0`), payloads exceeding `maxPayloadBytes` (default 5 MiB), or element trees deeper than `maxElementDepth` (default 32).

## 3. Spoofing & Tag Injection — Remittance Smuggling

* **Threat:** Untrusted user input inside unstructured remittance notes (`</Ustrd></RmtInf><Amt>...`) injects rogue XML elements into outbound `pain.001` batches.
* **Mitigation:** Every element body and attribute passes through `escapeXmlText()` plus SWIFT CBPR+ X-character set validation (`assertSwiftText`) and T26 slash placement guards (`validateReferenceId`).

## 4. Information Disclosure — Cryptographic Timing Side Channels

* **Threat:** Byte-by-byte string comparison (`===`) on transport HMAC signatures leaks partial MAC validity via response latency.
* **Mitigation:** `verifyWireSha256` and `verifyWireHmacSha256` normalize XML trees deterministically via `canonicalizeIsoXml` and compare digests exclusively with `node:crypto` `timingSafeEqual`.

## 5. Supply-Chain Compromise — Transitive NPM Dependencies

* **Threat:** A compromised transitive formatting or XML helper steals banking credentials or mutates destination IBANs at runtime.
* **Mitigation:** Zero runtime dependencies (`"dependencies"` is absent in `package.json`, enforced automatically by CI on every commit).
