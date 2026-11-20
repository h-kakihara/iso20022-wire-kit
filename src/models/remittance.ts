import { Iso20022WireError } from '../errors/wire-error.js';
import { assertSwiftText } from '../validators/swift-charset.js';
import { findChild, type XmlNode } from '../xml/tokenizer.js';
import type { XmlWriter } from '../xml/writer.js';

export interface RemittanceInformation {
  readonly unstructured?: string | undefined;
  readonly creditorReference?: string | undefined;
}

export function validateCreditorReferenceRf(ref: string, fieldPath?: string): string {
  const compact = ref.replace(/\s+/g, '').toUpperCase();
  if (!/^RF\d{2}[A-Z0-9]{1,21}$/.test(compact)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Invalid ISO 11649 SCOR creditor reference format: "${ref}"`,
      fieldPath,
    );
  }

  const rearranged = `${compact.slice(4)}${compact.slice(0, 4)}`;
  let numeric = '';
  for (let i = 0; i < rearranged.length; i += 1) {
    const code = rearranged.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      numeric += String(code - 55);
    } else {
      numeric += rearranged.charAt(i);
    }
  }

  if (BigInt(numeric) % 97n !== 1n) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Creditor reference failed ISO 11649 MOD-97-10 checksum: "${ref}"`,
      fieldPath,
    );
  }

  return compact;
}

export function writeRemittanceInfo(
  writer: XmlWriter,
  remittance: RemittanceInformation,
  fieldPath: string,
): void {
  const ustrd =
    remittance.unstructured !== undefined
      ? assertSwiftText(remittance.unstructured, 140, `${fieldPath}.Ustrd`)
      : undefined;
  const scor =
    remittance.creditorReference !== undefined
      ? validateCreditorReferenceRf(
          remittance.creditorReference,
          `${fieldPath}.Strd.CdtrRefInf.Ref`,
        )
      : undefined;

  if (ustrd === undefined && scor === undefined) {
    return;
  }

  writer.openTag('RmtInf');
  if (ustrd !== undefined) {
    writer.leafTag('Ustrd', ustrd);
  }
  if (scor !== undefined) {
    writer
      .openTag('Strd')
      .openTag('CdtrRefInf')
      .openTag('Tp')
      .openTag('CdOrPrtry')
      .leafTag('Cd', 'SCOR')
      .closeTag('CdOrPrtry')
      .closeTag('Tp')
      .leafTag('Ref', scor)
      .closeTag('CdtrRefInf')
      .closeTag('Strd');
  }
  writer.closeTag('RmtInf');
}

export function readRemittanceInfo(node: XmlNode, fieldPath: string): RemittanceInformation {
  const rawUstrd = findChild(node, 'Ustrd')?.text;
  const strdNode = findChild(node, 'Strd');
  const cdtrRefNode = strdNode !== undefined ? findChild(strdNode, 'CdtrRefInf') : undefined;
  const rawRef = cdtrRefNode !== undefined ? findChild(cdtrRefNode, 'Ref')?.text : undefined;

  return {
    unstructured:
      rawUstrd !== undefined
        ? assertSwiftText(rawUstrd, 140, `${fieldPath}.Ustrd`)
        : undefined,
    creditorReference:
      rawRef !== undefined
        ? validateCreditorReferenceRf(rawRef, `${fieldPath}.Strd.CdtrRefInf.Ref`)
        : undefined,
  };
}
