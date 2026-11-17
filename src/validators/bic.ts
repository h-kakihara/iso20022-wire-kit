import { Iso20022WireError } from '../errors/wire-error.js';

export interface ParsedBic {
  readonly raw: string;
  readonly bic8: string;
  readonly bic11: string;
  readonly institutionCode: string;
  readonly countryCode: string;
  readonly locationCode: string;
  readonly branchCode: string;
  readonly isTestBic: boolean;
}

const BIC_REGEX = /^[A-Z]{4}[A-Z]{2}[A-Z2-9][A-NP-Z0-9]([A-Z0-9]{3})?$/;

export function parseBic(bic: string, fieldPath?: string): ParsedBic {
  const normalized = bic.trim().toUpperCase();
  if (!BIC_REGEX.test(normalized)) {
    throw new Iso20022WireError(
      'ERR_INVALID_BIC',
      `Invalid ISO 9362 BIC8/BIC11 identifier: "${bic}"`,
      fieldPath,
    );
  }

  const institutionCode = normalized.slice(0, 4);
  const countryCode = normalized.slice(4, 6);
  const locationCode = normalized.slice(6, 8);
  const branchCode = normalized.length === 11 ? normalized.slice(8, 11) : 'XXX';
  const bic8 = normalized.slice(0, 8);

  return {
    raw: normalized,
    bic8,
    bic11: `${bic8}${branchCode}`,
    institutionCode,
    countryCode,
    locationCode,
    branchCode,
    isTestBic: locationCode.charAt(1) === '0',
  };
}
