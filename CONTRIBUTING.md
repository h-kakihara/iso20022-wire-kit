# Contributing to `iso20022-wire-kit`

Thank you for helping harden open-source ISO 20022 financial infrastructure. Because banks and payment processors rely on deterministic behavior from this package, every contribution must satisfy strict engineering invariants.

## Core Invariants

1. **Zero Runtime Dependencies:** Pull requests adding packages to `"dependencies"` in `package.json` will be automatically rejected by CI.
2. **No Floating-Point Money:** Never convert monetary quantities to JavaScript `number`. Use `Money` (`bigint` minor units) and `DecimalSumAccumulator` exclusively.
3. **Strict XSD Tag Ordering:** ISO 20022 XML schemas use `<xs:sequence>`, not `<xs:all>`. Child elements written by `XmlWriter` must match exact XSD sequence order.
4. **Sanitized Fixtures Only:** Use official ISO/EPC test IBANs (such as `DE89370400440532013000` or `NL91ABNA0417164300`) and synthetic BICs. Never commit production wire logs.

## Local Verification Workflow

Requires **Node.js >= 20.0.0**:

```bash
npm install
npm run typecheck
npm run build
npm test
node benchmarks/throughput-bench.mjs
```

## Conventional Commits

Format commit titles as `feat(<scope>): ...`, `fix(<scope>): ...`, `test(<scope>): ...`, or `docs(<scope>): ...` so release notes remain auditable.
