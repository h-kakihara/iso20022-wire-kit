import { Iso20022WireError } from '../errors/wire-error.js';
import { IBAN_COUNTRY_LENGTHS, SEPA_COUNTRY_CODES } from './iban-countries.js';

export interface ParsedIban {
  readonly compact: string;
  readonly countryCode: string;
  readonly checkDigits: string;
  readonly bban: string;
  readonly isSepa: boolean;
}

export function validateIban(iban: string, fieldPath?: string): ParsedIban {
  const compact = iban.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact)) {
    throw new Iso20022WireError(
      'ERR_INVALID_IBAN',
      `Malformed IBAN structure: "${iban}"`,
      fieldPath,
    );
  }

  const countryCode = compact.slice(0, 2);
  const expectedLength = IBAN_COUNTRY_LENGTHS[countryCode];
  if (expectedLength !== undefined && compact.length !== expectedLength) {
    throw new Iso20022WireError(
      'ERR_INVALID_IBAN',
      `IBAN for ${countryCode} must be ${expectedLength} characters, got ${compact.length}`,
      fieldPath,
    );
  }

  const rearranged = `${compact.slice(4)}${compact.slice(0, 4)}`;
  let numericExpanded = '';
  for (let i = 0; i < rearranged.length; i += 1) {
    const code = rearranged.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      numericExpanded += String(code - 55);
    } else {
      numericExpanded += rearranged.charAt(i);
    }
  }

  if (BigInt(numericExpanded) % 97n !== 1n) {
    throw new Iso20022WireError(
      'ERR_INVALID_IBAN',
      `IBAN failed ISO 7064 MOD-97-10 checksum verification: "${iban}"`,
      fieldPath,
    );
  }

  return {
    compact,
    countryCode,
    checkDigits: compact.slice(2, 4),
    bban: compact.slice(4),
    isSepa: SEPA_COUNTRY_CODES.has(countryCode),
  };
}

export function formatIbanPrint(iban: string, fieldPath?: string): string {
  const { compact } = validateIban(iban, fieldPath);
  return compact.replace(/(.{4})(?=.)/g, '$1 ');
}
