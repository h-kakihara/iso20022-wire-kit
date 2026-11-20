import { Iso20022WireError } from '../errors/wire-error.js';
import { assertSwiftText } from '../validators/swift-charset.js';
import { findChild, requireChildText, type XmlNode } from '../xml/tokenizer.js';
import type { XmlWriter } from '../xml/writer.js';

export interface PostalAddress {
  readonly streetName?: string | undefined;
  readonly buildingNumber?: string | undefined;
  readonly postCode?: string | undefined;
  readonly townName: string;
  readonly countrySubDivision?: string | undefined;
  readonly country: string;
}

const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;

export function validatePostalAddress(
  address: PostalAddress,
  fieldPath: string,
): PostalAddress {
  const country = address.country.trim().toUpperCase();
  if (!COUNTRY_CODE_REGEX.test(country)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Invalid ISO 3166-1 alpha-2 country code: "${address.country}"`,
      `${fieldPath}.Ctry`,
    );
  }

  return {
    streetName:
      address.streetName !== undefined
        ? assertSwiftText(address.streetName, 70, `${fieldPath}.StrtNm`)
        : undefined,
    buildingNumber:
      address.buildingNumber !== undefined
        ? assertSwiftText(address.buildingNumber, 16, `${fieldPath}.BldgNb`)
        : undefined,
    postCode:
      address.postCode !== undefined
        ? assertSwiftText(address.postCode, 16, `${fieldPath}.PstCd`)
        : undefined,
    townName: assertSwiftText(address.townName, 35, `${fieldPath}.TwnNm`),
    countrySubDivision:
      address.countrySubDivision !== undefined
        ? assertSwiftText(address.countrySubDivision, 35, `${fieldPath}.CtrySubDvsn`)
        : undefined,
    country,
  };
}

export function writePostalAddress(
  writer: XmlWriter,
  tagName: string,
  address: PostalAddress,
  fieldPath: string,
): void {
  const checked = validatePostalAddress(address, fieldPath);
  writer.openTag(tagName);
  if (checked.streetName !== undefined) {
    writer.leafTag('StrtNm', checked.streetName);
  }
  if (checked.buildingNumber !== undefined) {
    writer.leafTag('BldgNb', checked.buildingNumber);
  }
  if (checked.postCode !== undefined) {
    writer.leafTag('PstCd', checked.postCode);
  }
  writer.leafTag('TwnNm', checked.townName);
  if (checked.countrySubDivision !== undefined) {
    writer.leafTag('CtrySubDvsn', checked.countrySubDivision);
  }
  writer.leafTag('Ctry', checked.country);
  writer.closeTag(tagName);
}

export function readPostalAddress(node: XmlNode, fieldPath: string): PostalAddress {
  return validatePostalAddress(
    {
      streetName: findChild(node, 'StrtNm')?.text,
      buildingNumber: findChild(node, 'BldgNb')?.text,
      postCode: findChild(node, 'PstCd')?.text,
      townName: requireChildText(node, 'TwnNm', `${fieldPath}.TwnNm`),
      countrySubDivision: findChild(node, 'CtrySubDvsn')?.text,
      country: requireChildText(node, 'Ctry', `${fieldPath}.Ctry`),
    },
    fieldPath,
  );
}
