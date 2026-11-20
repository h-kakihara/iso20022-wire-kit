import { Iso20022WireError } from '../errors/wire-error.js';

export type TransactionGroupStatusCode =
  | 'ACTC'
  | 'RCVD'
  | 'PART'
  | 'RJCT'
  | 'PDNG'
  | 'ACCP'
  | 'ACSC'
  | 'ACSP'
  | 'ACWC';

export type TransactionIndividualStatusCode =
  | 'ACTC'
  | 'RJCT'
  | 'PDNG'
  | 'ACCP'
  | 'ACSC'
  | 'ACSP'
  | 'ACWC'
  | 'ACCC';

export type StatusReasonCode =
  | 'AC01'
  | 'AC04'
  | 'AC06'
  | 'AG01'
  | 'AM04'
  | 'AM05'
  | 'BE04'
  | 'DNOR'
  | 'FF01'
  | 'MD01'
  | 'MS03'
  | 'NARR'
  | 'RC01'
  | 'RR01'
  | 'RR04'
  | 'TM01';

export const ISO20022_STATUS_REASON_DESCRIPTIONS: Readonly<
  Record<StatusReasonCode, string>
> = {
  AC01: 'IncorrectAccountNumber',
  AC04: 'ClosedAccountNumber',
  AC06: 'BlockedAccount',
  AG01: 'TransactionForbidden',
  AM04: 'InsufficientFunds',
  AM05: 'Duplication',
  BE04: 'MissingCreditorAddress',
  DNOR: 'DebtorBankNotRegistered',
  FF01: 'InvalidFileFormat',
  MD01: 'NoMandate',
  MS03: 'NotSpecifiedReasonAgentGenerated',
  NARR: 'Narrative',
  RC01: 'BankIdentifierIncorrect',
  RR01: 'MissingDebtorAccountOrIdentification',
  RR04: 'RegulatoryReason',
  TM01: 'InvalidCutOffTime',
};

const GROUP_STATUS_SET: ReadonlySet<string> = new Set([
  'ACTC',
  'RCVD',
  'PART',
  'RJCT',
  'PDNG',
  'ACCP',
  'ACSC',
  'ACSP',
  'ACWC',
]);

const TX_STATUS_SET: ReadonlySet<string> = new Set([
  'ACTC',
  'RJCT',
  'PDNG',
  'ACCP',
  'ACSC',
  'ACSP',
  'ACWC',
  'ACCC',
]);

export function validateGroupStatus(
  code: string,
  fieldPath: string,
): TransactionGroupStatusCode {
  const upper = code.trim().toUpperCase();
  if (!GROUP_STATUS_SET.has(upper)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Unsupported ISO 20022 GroupStatus code "${code}"`,
      fieldPath,
    );
  }
  return upper as TransactionGroupStatusCode;
}

export function validateTxStatus(
  code: string,
  fieldPath: string,
): TransactionIndividualStatusCode {
  const upper = code.trim().toUpperCase();
  if (!TX_STATUS_SET.has(upper)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Unsupported ISO 20022 TransactionStatus code "${code}"`,
      fieldPath,
    );
  }
  return upper as TransactionIndividualStatusCode;
}

export function validateStatusReasonCode(
  code: string,
  fieldPath: string,
): StatusReasonCode {
  const upper = code.trim().toUpperCase() as StatusReasonCode;
  if (!(upper in ISO20022_STATUS_REASON_DESCRIPTIONS)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Unsupported ISO 20022 ExternalStatusReason1Code "${code}"`,
      fieldPath,
    );
  }
  return upper;
}
