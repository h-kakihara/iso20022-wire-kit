import { Iso20022WireError } from '../errors/wire-error.js';
import { assertSwiftText } from '../validators/swift-charset.js';
import { findChild, requireChildText, type XmlNode } from '../xml/tokenizer.js';
import type { XmlWriter } from '../xml/writer.js';

export interface BankTransactionCode {
  readonly domainCode?: string | undefined;
  readonly familyCode?: string | undefined;
  readonly subFamilyCode?: string | undefined;
  readonly proprietaryCode?: string | undefined;
  readonly proprietaryIssuer?: string | undefined;
}

const FOUR_CHAR_CODE_REGEX = /^[A-Z0-9]{4}$/;

export function validateBankTxCode(
  code: BankTransactionCode,
  fieldPath: string,
): BankTransactionCode {
  const hasDomain =
    code.domainCode !== undefined ||
    code.familyCode !== undefined ||
    code.subFamilyCode !== undefined;
  const hasProprietary = code.proprietaryCode !== undefined;

  if (!hasDomain && !hasProprietary) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'BankTransactionCode must include an ISO domain triplet or a proprietary code',
      fieldPath,
    );
  }

  let domainCode: string | undefined;
  let familyCode: string | undefined;
  let subFamilyCode: string | undefined;

  if (hasDomain) {
    if (
      code.domainCode === undefined ||
      code.familyCode === undefined ||
      code.subFamilyCode === undefined
    ) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        'ISO BankTransactionCode domain classification requires domainCode, familyCode, and subFamilyCode',
        `${fieldPath}.Domn`,
      );
    }
    domainCode = code.domainCode.trim().toUpperCase();
    familyCode = code.familyCode.trim().toUpperCase();
    subFamilyCode = code.subFamilyCode.trim().toUpperCase();

    if (
      !FOUR_CHAR_CODE_REGEX.test(domainCode) ||
      !FOUR_CHAR_CODE_REGEX.test(familyCode) ||
      !FOUR_CHAR_CODE_REGEX.test(subFamilyCode)
    ) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        `Invalid 4-character ISO BankTransactionCode triplet: ${domainCode}-${familyCode}-${subFamilyCode}`,
        `${fieldPath}.Domn`,
      );
    }
  }

  return {
    domainCode,
    familyCode,
    subFamilyCode,
    proprietaryCode:
      code.proprietaryCode !== undefined
        ? assertSwiftText(code.proprietaryCode, 35, `${fieldPath}.Prtry.Cd`)
        : undefined,
    proprietaryIssuer:
      code.proprietaryIssuer !== undefined
        ? assertSwiftText(code.proprietaryIssuer, 35, `${fieldPath}.Prtry.Issr`)
        : undefined,
  };
}

export function writeBankTxCode(
  writer: XmlWriter,
  code: BankTransactionCode,
  fieldPath: string,
): void {
  const checked = validateBankTxCode(code, fieldPath);
  writer.openTag('BkTxCd');
  if (
    checked.domainCode !== undefined &&
    checked.familyCode !== undefined &&
    checked.subFamilyCode !== undefined
  ) {
    writer
      .openTag('Domn')
      .leafTag('Cd', checked.domainCode)
      .openTag('Fmly')
      .leafTag('Cd', checked.familyCode)
      .leafTag('SubFmlyCd', checked.subFamilyCode)
      .closeTag('Fmly')
      .closeTag('Domn');
  }
  if (checked.proprietaryCode !== undefined) {
    writer.openTag('Prtry');
    writer.leafTag('Cd', checked.proprietaryCode);
    if (checked.proprietaryIssuer !== undefined) {
      writer.leafTag('Issr', checked.proprietaryIssuer);
    }
    writer.closeTag('Prtry');
  }
  writer.closeTag('BkTxCd');
}

export function readBankTxCode(node: XmlNode, fieldPath: string): BankTransactionCode {
  const domnNode = findChild(node, 'Domn');
  const fmlyNode = domnNode !== undefined ? findChild(domnNode, 'Fmly') : undefined;
  const prtryNode = findChild(node, 'Prtry');

  return validateBankTxCode(
    {
      domainCode:
        domnNode !== undefined
          ? requireChildText(domnNode, 'Cd', `${fieldPath}.Domn.Cd`)
          : undefined,
      familyCode:
        fmlyNode !== undefined
          ? requireChildText(fmlyNode, 'Cd', `${fieldPath}.Domn.Fmly.Cd`)
          : undefined,
      subFamilyCode:
        fmlyNode !== undefined
          ? requireChildText(fmlyNode, 'SubFmlyCd', `${fieldPath}.Domn.Fmly.SubFmlyCd`)
          : undefined,
      proprietaryCode:
        prtryNode !== undefined
          ? requireChildText(prtryNode, 'Cd', `${fieldPath}.Prtry.Cd`)
          : undefined,
      proprietaryIssuer:
        prtryNode !== undefined ? findChild(prtryNode, 'Issr')?.text : undefined,
    },
    fieldPath,
  );
}
