# Changelog

All notable changes to `@h-kakihara/iso20022-wire-kit` are documented in this file.
This project adheres to [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-20

### Added

* **Monetary Primitives:** `ISO4217_REGISTRY` (`0`, `2`, `3`, and `4` minor-unit scales), lossless decimal wire parser, immutable `Money` value object, and $10^{-4}$ scaled `DecimalSumAccumulator`.
* **Banking Validators:** ISO 9362 `BIC8`/`BIC11` parser with test-BIC detection, arbitrary-precision `bigint` MOD-97-10 ISO 13616 `IBAN` & SEPA reachability verifier, ISO 17442 `LEI` validator, ISO 11649 `SCOR` (`RF`) creditor reference verifier, SWIFT CBPR+ X-charset & T26 slash rules, and leap-year-aware ISO 8601 date/timestamp guards.
* **XML Hardening & Integrity:** Zero-dependency stack-checked `XmlWriter`, namespace-normalizing `parseSafeXml` tokenizer, pre-parse XXE & depth-limit firewall (`inspectXmlSafety`), deterministic XML canonicalizer, and constant-time SHA-256 / HMAC-SHA256 wire verifiers.
* **ISO 20022 Codecs:** Full builders, parsers, and mathematical control-sum / balance-equation auditors for `pain.001.001.09` (including SEPA Credit Transfer preset), `pacs.008.001.08`, `head.001.001.02` (`AppHdr`), `camt.053.001.08`, and `pacs.002.001.10`, plus polymorphic `parseAnyIso20022Xml` routing.
