import { Iso20022WireError } from '../errors/wire-error.js';

export interface CurrencyMetadata {
  readonly code: string;
  readonly numericCode: string;
  readonly minorUnits: 0 | 2 | 3 | 4;
  readonly displayName: string;
}

export const ISO4217_REGISTRY: Readonly<Record<string, CurrencyMetadata>> = {
  USD: { code: 'USD', numericCode: '840', minorUnits: 2, displayName: 'US Dollar' },
  EUR: { code: 'EUR', numericCode: '978', minorUnits: 2, displayName: 'Euro' },
  GBP: { code: 'GBP', numericCode: '826', minorUnits: 2, displayName: 'Pound Sterling' },
  JPY: { code: 'JPY', numericCode: '392', minorUnits: 0, displayName: 'Japanese Yen' },
  CHF: { code: 'CHF', numericCode: '756', minorUnits: 2, displayName: 'Swiss Franc' },
  CAD: { code: 'CAD', numericCode: '124', minorUnits: 2, displayName: 'Canadian Dollar' },
  AUD: { code: 'AUD', numericCode: '036', minorUnits: 2, displayName: 'Australian Dollar' },
  SGD: { code: 'SGD', numericCode: '702', minorUnits: 2, displayName: 'Singapore Dollar' },
  HKD: { code: 'HKD', numericCode: '344', minorUnits: 2, displayName: 'Hong Kong Dollar' },
  SEK: { code: 'SEK', numericCode: '752', minorUnits: 2, displayName: 'Swedish Krona' },
  NOK: { code: 'NOK', numericCode: '578', minorUnits: 2, displayName: 'Norwegian Krone' },
  DKK: { code: 'DKK', numericCode: '208', minorUnits: 2, displayName: 'Danish Krone' },
  PLN: { code: 'PLN', numericCode: '985', minorUnits: 2, displayName: 'Polish Zloty' },
  NZD: { code: 'NZD', numericCode: '554', minorUnits: 2, displayName: 'New Zealand Dollar' },
  MXN: { code: 'MXN', numericCode: '484', minorUnits: 2, displayName: 'Mexican Peso' },
  AED: { code: 'AED', numericCode: '784', minorUnits: 2, displayName: 'UAE Dirham' },
  KWD: { code: 'KWD', numericCode: '414', minorUnits: 3, displayName: 'Kuwaiti Dinar' },
  BHD: { code: 'BHD', numericCode: '048', minorUnits: 3, displayName: 'Bahraini Dinar' },
  OMR: { code: 'OMR', numericCode: '512', minorUnits: 3, displayName: 'Omani Rial' },
  CLF: { code: 'CLF', numericCode: '990', minorUnits: 4, displayName: 'Unidad de Fomento' },
};

export function resolveCurrency(code: string, fieldPath?: string): CurrencyMetadata {
  const normalized = code.trim().toUpperCase();
  const entry = ISO4217_REGISTRY[normalized];
  if (entry === undefined) {
    throw new Iso20022WireError(
      'ERR_INVALID_CURRENCY',
      `Unsupported or malformed ISO 4217 currency code: "${code}"`,
      fieldPath,
    );
  }
  return entry;
}

export function formatMinorUnits(minorAmount: bigint, currencyCode: string, fieldPath?: string): string {
  if (minorAmount < 0n) {
    throw new Iso20022WireError(
      'ERR_NEGATIVE_AMOUNT',
      'ISO 20022 wire amounts cannot be negative',
      fieldPath,
    );
  }
  const spec = resolveCurrency(currencyCode, fieldPath);
  if (spec.minorUnits === 0) {
    return minorAmount.toString();
  }
  const padded = minorAmount.toString().padStart(spec.minorUnits + 1, '0');
  const splitIndex = padded.length - spec.minorUnits;
  return `${padded.slice(0, splitIndex)}.${padded.slice(splitIndex)}`;
}
