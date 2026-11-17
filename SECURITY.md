# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |

## Threat Scope in Financial Messaging

`iso20022-wire-kit` processes untrusted XML payloads and constructs high-value payment instructions. Security reports involving the following vectors receive critical priority:

1. **XML External Entity (XXE) & Billion Laughs DoS:** Any bypass of DOCTYPE or entity expansion guards.
2. **Monetary Precision Loss:** Any discrepancy between `bigint` minor units and serialized decimal wire amounts.
3. **Tag Injection:** Unescaped debtor/creditor remittance fields altering payment routing or control sums.

## Coordinated Vulnerability Disclosure

Do not open public GitHub issues for suspected security vulnerabilities. Use GitHub Private Vulnerability Reporting on this repository so patches can be released before public disclosure.
