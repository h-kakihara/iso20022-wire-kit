import { resolveCurrency } from '../currency/iso4217.js';
import type { Money } from '../currency/money.js';
import { Iso20022WireError } from '../errors/wire-error.js';

const INTERNAL_SCALE = 4;
const SCALE_BASE = 10_000n;

export class DecimalSumAccumulator {
  private scaledTotal = 0n;
  private count = 0;

  public addMoney(amount: Money): void {
    const spec = resolveCurrency(amount.currency);
    const scaleDiff = BigInt(INTERNAL_SCALE - spec.minorUnits);
    const factor = 10n ** scaleDiff;
    this.scaledTotal += amount.minorUnits * factor;
    this.count += 1;
  }

  public get transactionCount(): number {
    return this.count;
  }

  public get rawScaledTotal(): bigint {
    return this.scaledTotal;
  }

  public formatControlSum(): string {
    const whole = this.scaledTotal / SCALE_BASE;
    const remainder = (this.scaledTotal % SCALE_BASE).toString().padStart(INTERNAL_SCALE, '0');
    const trimmedFrac = remainder.replace(/0+$/, '');
    const normalizedFrac = trimmedFrac.length < 2 ? trimmedFrac.padEnd(2, '0') : trimmedFrac;
    return `${whole.toString()}.${normalizedFrac}`;
  }

  public verifyControlSum(declaredControlSum: string, fieldPath: string): void {
    const parsedScaled = parseControlSumScaled(declaredControlSum, fieldPath);
    if (parsedScaled !== this.scaledTotal) {
      throw new Iso20022WireError(
        'ERR_CONTROL_SUM_MISMATCH',
        `Declared CtrlSum "${declaredControlSum}" does not match computed sum "${this.formatControlSum()}"`,
        fieldPath,
      );
    }
  }
}

export function parseControlSumScaled(decimalText: string, fieldPath: string): bigint {
  const trimmed = decimalText.trim();
  if (!/^\d+(?:\.\d{1,18})?$/.test(trimmed)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Malformed ISO 20022 CtrlSum decimal value: "${decimalText}"`,
      fieldPath,
    );
  }

  const parts = trimmed.split('.');
  const whole = parts[0] ?? '0';
  const rawFrac = (parts[1] ?? '').replace(/0+$/, '');

  if (rawFrac.length > INTERNAL_SCALE) {
    throw new Iso20022WireError(
      'ERR_SCALE_OVERFLOW',
      `CtrlSum "${decimalText}" exceeds maximum 4 decimal places supported across ISO 4217`,
      fieldPath,
    );
  }

  const paddedFrac = rawFrac.padEnd(INTERNAL_SCALE, '0');
  return BigInt(`${whole}${paddedFrac}`);
}
