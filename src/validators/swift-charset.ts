import { Iso20022WireError } from '../errors/wire-error.js';

const SWIFT_FIN_X_REGEX = /^[A-Za-z0-9/\-?:().,'+ ]+$/;

export function assertSwiftText(
  value: string,
  maxLength: number,
  fieldPath?: string,
): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Text length must be between 1 and ${maxLength} characters`,
      fieldPath,
    );
  }
  if (!SWIFT_FIN_X_REGEX.test(trimmed)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Value contains characters outside SWIFT CBPR+ X-character set: "${trimmed}"`,
      fieldPath,
    );
  }
  return trimmed;
}

export function validateReferenceId(id: string, fieldPath?: string): string {
  const trimmed = id.trim();
  if (trimmed.length === 0 || trimmed.length > 35 || !SWIFT_FIN_X_REGEX.test(trimmed)) {
    throw new Iso20022WireError(
      'ERR_INVALID_END_TO_END_ID',
      `Reference identifier must be 1-35 valid SWIFT characters: "${id}"`,
      fieldPath,
    );
  }
  if (trimmed.startsWith('/') || trimmed.endsWith('/') || trimmed.includes('//')) {
    throw new Iso20022WireError(
      'ERR_INVALID_END_TO_END_ID',
      `Reference identifier violates SWIFT network rule T26 slash placement: "${id}"`,
      fieldPath,
    );
  }
  return trimmed;
}
