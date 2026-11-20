# ADR 0001: Native `bigint` Minor Units Over Floating-Point or External Decimal Libraries

* **Status:** Accepted
* **Date:** 2026-11-20

## Context

ISO 20022 XML wire messages serialize monetary quantities as base-10 decimal strings (`<InstdAmt Ccy="EUR">3200.50</InstdAmt>`), while internal ledgers store integer minor units (cents, pence, fil, yen). JavaScript's `number` type uses 64-bit IEEE-754 floating-point representation, which:
1. Cannot represent `0.10 + 0.20` without binary rounding noise (`0.30000000000000004`).
2. Loses integer precision above `Number.MAX_SAFE_INTEGER` ($9,007,199,254,740,991$), corrupting high-value institutional JPY or IDR RTGS settlements.

## Decision

1. Represent all currency amounts via an immutable `Money` value object backed by ECMAScript native `bigint` minor units paired with an validated ISO 4217 currency code.
2. Convert wire decimal strings directly via string slicing and zero-padding (`parseWireAmount` / `formatMinorUnits`) with zero intermediate `Number` casts.
3. Compute heterogeneous ISO 20022 `<CtrlSum>` headers in `DecimalSumAccumulator` by scaling each currency's `bigint` minor units to $10^{-4}$ (the maximum minor-unit scale in ISO 4217, e.g., `CLF`).

## Consequences

* **Positive:** Exact, arbitrary-precision arithmetic across `0`, `2`, `3`, and `4` decimal settlement currencies with zero external BigDecimal dependencies.
* **Positive:** Sub-cent scale overflow (`10.999` USD) is caught deterministically with `ERR_SCALE_OVERFLOW` at parse time.
* **Trade-off:** Callers pass `bigint` literals (`15000n`) rather than untyped JS numbers, making minor-unit semantics explicit at compile time.
