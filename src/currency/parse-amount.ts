import { Iso20022WireError } from '../errors/wire-error.js';
import { resolveCurrency } from './iso4217.js';

export function parseWireAmount(
  wireDecimal: string,
  currencyCode: string,
  fieldPath?: string,
): bigint {
  const trimmed = wireDecimal.trim();
  if (trimmed.startsWith('-')) {
    throw new Iso20022WireError(
      'ERR_NEGATIVE_AMOUNT',
      `ISO 20022 wire amount cannot be negative: "${wireDecimal}"`,
      fieldPath,
    );
  }
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Malformed decimal wire amount: "${wireDecimal}"`,
      fieldPath,
    );
  }

  const spec = resolveCurrency(currencyCode, fieldPath);
  const parts = trimmed.split('.');
  const wholePart = parts[0] ?? '0';
  const fracPart = parts[1] ?? '';

  if (fracPart.length > spec.minorUnits) {
    throw new Iso20022WireError(
      'ERR_SCALE_OVERFLOW',
      `Amount "${wireDecimal}" exceeds ${spec.minorUnits} decimal places allowed for ${spec.code}`,
      fieldPath,
    );
  }

  const paddedFrac = fracPart.padEnd(spec.minorUnits, '0');
  return BigInt(`${wholePart}${paddedFrac}`);
}
