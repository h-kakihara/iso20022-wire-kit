import { Iso20022WireError } from '../errors/wire-error.js';
import { formatMinorUnits, resolveCurrency } from './iso4217.js';
import { parseWireAmount } from './parse-amount.js';

export class Money {
  public readonly minorUnits: bigint;
  public readonly currency: string;

  private constructor(minorUnits: bigint, currency: string) {
    this.minorUnits = minorUnits;
    this.currency = currency;
  }

  public static fromMinor(minorUnits: bigint, currency: string, fieldPath?: string): Money {
    if (minorUnits < 0n) {
      throw new Iso20022WireError(
        'ERR_NEGATIVE_AMOUNT',
        'Monetary value in ISO 20022 instruction cannot be negative',
        fieldPath,
      );
    }
    const spec = resolveCurrency(currency, fieldPath);
    return new Money(minorUnits, spec.code);
  }

  public static fromWireString(decimal: string, currency: string, fieldPath?: string): Money {
    const spec = resolveCurrency(currency, fieldPath);
    const minor = parseWireAmount(decimal, spec.code, fieldPath);
    return new Money(minor, spec.code);
  }

  public assertPositive(fieldPath?: string): Money {
    if (this.minorUnits <= 0n) {
      throw new Iso20022WireError(
        'ERR_ZERO_AMOUNT_FORBIDDEN',
        `Settlement amount for ${this.currency} must be strictly greater than zero`,
        fieldPath,
      );
    }
    return this;
  }

  public add(other: Money, fieldPath?: string): Money {
    if (this.currency !== other.currency) {
      throw new Iso20022WireError(
        'ERR_INVALID_CURRENCY',
        `Cannot sum heterogeneous currencies: ${this.currency} and ${other.currency}`,
        fieldPath,
      );
    }
    return new Money(this.minorUnits + other.minorUnits, this.currency);
  }

  public equals(other: Money): boolean {
    return this.currency === other.currency && this.minorUnits === other.minorUnits;
  }

  public toWireString(): string {
    return formatMinorUnits(this.minorUnits, this.currency);
  }
}
