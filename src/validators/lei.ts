import { Iso20022WireError } from '../errors/wire-error.js';

const LEI_FORMAT_REGEX = /^[A-Z0-9]{18}\d{2}$/;

export function validateLei(lei: string, fieldPath?: string): string {
  const normalized = lei.trim().toUpperCase();
  if (!LEI_FORMAT_REGEX.test(normalized)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Invalid ISO 17442 Legal Entity Identifier structure: "${lei}"`,
      fieldPath,
    );
  }

  let numericString = '';
  for (let i = 0; i < normalized.length; i += 1) {
    const charCode = normalized.charCodeAt(i);
    if (charCode >= 65 && charCode <= 90) {
      numericString += String(charCode - 55);
    } else {
      numericString += normalized.charAt(i);
    }
  }

  if (BigInt(numericString) % 97n !== 1n) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `LEI failed ISO 17442 MOD-97-10 check digit verification: "${lei}"`,
      fieldPath,
    );
  }

  return normalized;
}
