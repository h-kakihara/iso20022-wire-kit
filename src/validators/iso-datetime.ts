import { Iso20022WireError } from '../errors/wire-error.js';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validateIsoDate(value: string, fieldPath?: string): string {
  const trimmed = value.trim();
  if (!ISO_DATE_REGEX.test(trimmed)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Invalid ISO 20022 calendar date (expected YYYY-MM-DD): "${value}"`,
      fieldPath,
    );
  }

  const year = Number(trimmed.slice(0, 4));
  const month = Number(trimmed.slice(5, 7));
  const day = Number(trimmed.slice(8, 10));

  const monthLengths = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  const maxDay = monthLengths[month - 1];

  if (month < 1 || month > 12 || maxDay === undefined || day < 1 || day > maxDay) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Non-existent calendar date in ISO 20022 field: "${value}"`,
      fieldPath,
    );
  }

  return trimmed;
}

export function validateIsoDateTime(value: string, fieldPath?: string): string {
  const trimmed = value.trim();
  if (!ISO_DATETIME_REGEX.test(trimmed)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Invalid ISO 20022 timestamp (timezone offset or Z required): "${value}"`,
      fieldPath,
    );
  }

  validateIsoDate(trimmed.slice(0, 10), fieldPath);

  const hour = Number(trimmed.slice(11, 13));
  const minute = Number(trimmed.slice(14, 16));
  const second = Number(trimmed.slice(17, 19));

  if (hour > 23 || minute > 59 || second > 59) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Out-of-range clock component in ISO 20022 timestamp: "${value}"`,
      fieldPath,
    );
  }

  if (!trimmed.endsWith('Z')) {
    const offsetChunk = trimmed.slice(-5);
    const offsetHour = Number(offsetChunk.slice(0, 2));
    const offsetMin = Number(offsetChunk.slice(3, 5));
    if (offsetHour > 14 || offsetMin > 59) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        `Invalid UTC timezone offset in ISO 20022 timestamp: "${value}"`,
        fieldPath,
      );
    }
  }

  return trimmed;
}
