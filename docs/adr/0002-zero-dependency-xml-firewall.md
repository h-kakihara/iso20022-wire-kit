# ADR 0002: Zero Runtime Dependencies and Dedicated ISO 20022 XML Firewall

* **Status:** Accepted
* **Date:** 2026-11-20

## Context

Regulated payment institutions, sponsor banks, and PCI-DSS / SOC 2 Type II audited fintech startups perform strict vendor and SBOM (Software Bill of Materials) reviews on every package touching payment initiation (`pain.001`) or interbank settlement (`pacs.008`). General-purpose JavaScript XML parsers pull in deep transitive dependency trees and often expose permissive DTD/entity expansion defaults.

## Decision

1. Ship `@h-kakihara/iso20022-wire-kit` with **zero runtime dependencies**, relying exclusively on ECMAScript 2022 primitives and built-in `node:crypto`.
2. Implement a dedicated stack-checked `XmlWriter` and namespace-normalizing `parseSafeXml` tokenizer tailored strictly to the subset of XML permitted by ISO 20022 financial schemas (no DTDs, no external entities, no processing-instruction execution).
3. Enforce a CI gate in `.github/workflows/ci.yml` that fails the build if any `"dependencies"` entry is ever introduced into `package.json`.

## Consequences

* **Positive:** Bank security teams can audit the entire runtime codebase in a single afternoon with zero transitive CVE churn.
* **Positive:** `DOCTYPE` and `ENTITY` payloads are deterministically rejected with `ERR_XXE_OR_DOCTYPE_DETECTED` before memory allocation for tree nodes begins.
