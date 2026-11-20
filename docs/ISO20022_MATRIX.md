# ISO 20022 Schema & Network Validation Matrix

## Supported Message Definitions

| Domain | Message ID | XSD Namespace | Builder | Parser | Built-in Integrity Invariants |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Payments Initiation | `pain.001.001.09` | `urn:iso:std:iso:20022:tech:xsd:pain.001.001.09` | `buildPain001Xml`, `buildSepaPain001Xml` | `parsePain001Xml` | Dual-level `NbOfTxs` & `CtrlSum`, SEPA EUR/`SLEV` reachability, unique `PmtInfId` |
| Interbank Clearing | `pacs.008.001.08` | `urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08` | `buildPacs008Xml` | `parsePacs008Xml` | Mandatory lowercase UUIDv4 `UETR` uniqueness, `TtlIntrBkSttlmAmt`, cross-currency `XchgRate` |
| Routing Header | `head.001.001.02` | `urn:iso:std:iso:20022:tech:xsd:head.001.001.02` | `buildAppHdrXml` | `parseAppHdrXml` | `Fr`/`To` BICFI validation, `MsgDefIdr` syntax, UTC `CreDt` |
| Cash Management | `camt.053.001.08` | `urn:iso:std:iso:20022:tech:xsd:camt.053.001.08` | `buildCamt053Xml` | `parseCamt053Xml` | Signed `OPBD + BOOK = CLBD` equation, `TxsSummry` net direction & entry counts |
| Status Reporting | `pacs.002.001.10` | `urn:iso:std:iso:20022:tech:xsd:pacs.002.001.10` | `buildPacs002Xml` | `parsePacs002Xml` | Mandatory `StsRsnInf` on `RJCT`, ISO `ExternalStatusReason1Code` dictionary |

## Deterministic Error Taxonomy (`WireErrorCode`)

| Error Code | Trigger Condition |
| :--- | :--- |
| `ERR_INVALID_CURRENCY` | Unknown ISO 4217 code, missing `Ccy` attribute, or heterogeneous currency addition |
| `ERR_NEGATIVE_AMOUNT` | Negative `bigint` minor units or `-` prefix on wire decimal |
| `ERR_ZERO_AMOUNT_FORBIDDEN` | Zero settlement amount on `pain.001` or `pacs.008` transfer leg |
| `ERR_SCALE_OVERFLOW` | Fractional digits exceed ISO 4217 currency `minorUnits` (e.g., `10.999` USD or `5.5` JPY) |
| `ERR_INVALID_BIC` | Fails ISO 9362 8/11-character institution, country, or location rules |
| `ERR_INVALID_IBAN` | Fails ISO 13616 national length, ISO 7064 MOD-97-10 check digit, or SEPA zone check |
| `ERR_INVALID_END_TO_END_ID` | Violates 1–35 SWIFT X-charset bounds or SWIFT rule T26 (`/` leading, trailing, or `//`) |
| `ERR_CONTROL_SUM_MISMATCH` | Declared `CtrlSum`, `TtlIntrBkSttlmAmt`, or `camt.053` `CLBD` differs by $\ge 1$ minor unit |
| `ERR_TRANSACTION_COUNT_MISMATCH` | Declared `NbOfTxs` or `NbOfNtries` disagrees with parsed legs |
| `ERR_XXE_OR_DOCTYPE_DETECTED` | XML contains forbidden `<!DOCTYPE` or `<!ENTITY` declarations |
| `ERR_XML_DEPTH_EXCEEDED` | XML element nesting exceeds configured `maxElementDepth` |
| `ERR_SCHEMA_VIOLATION` | Missing mandatory XSD tag, invalid date/LEI/SCOR checksum, or malformed XML |
