import { Money } from '../currency/money.js';
import { Iso20022WireError } from '../errors/wire-error.js';

export type CreditDebitIndicator = 'CRDT' | 'DBIT';

export interface DirectedAmount {
  readonly amount: Money;
  readonly creditDebitIndicator: CreditDebitIndicator;
}

export function validateCreditDebitIndicator(
  code: string,
  fieldPath: string,
): CreditDebitIndicator {
  const upper = code.trim().toUpperCase();
  if (upper !== 'CRDT' && upper !== 'DBIT') {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Invalid CreditDebitIndicator (expected CRDT or DBIT): "${code}"`,
      fieldPath,
    );
  }
  return upper;
}

export function toSignedMinorUnits(
  amount: Money,
  indicator: CreditDebitIndicator,
): bigint {
  return indicator === 'CRDT' ? amount.minorUnits : -amount.minorUnits;
}

export function fromSignedMinorUnits(
  signedMinorUnits: bigint,
  currency: string,
  fieldPath?: string,
): DirectedAmount {
  if (signedMinorUnits >= 0n) {
    return {
      amount: Money.fromMinor(signedMinorUnits, currency, fieldPath),
      creditDebitIndicator: 'CRDT',
    };
  }
  return {
    amount: Money.fromMinor(-signedMinorUnits, currency, fieldPath),
    creditDebitIndicator: 'DBIT',
  };
}
