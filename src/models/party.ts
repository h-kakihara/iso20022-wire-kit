import { parseBic } from '../validators/bic.js';
import { validateLei } from '../validators/lei.js';
import { assertSwiftText, validateReferenceId } from '../validators/swift-charset.js';
import { findChild, requireChildText, type XmlNode } from '../xml/tokenizer.js';
import type { XmlWriter } from '../xml/writer.js';
import {
  readPostalAddress,
  writePostalAddress,
  type PostalAddress,
} from './postal-address.js';

export interface PartyIdentification {
  readonly name: string;
  readonly postalAddress?: PostalAddress | undefined;
  readonly anyBic?: string | undefined;
  readonly lei?: string | undefined;
  readonly proprietaryId?: string | undefined;
}

export function writePartyIdentification(
  writer: XmlWriter,
  tagName: string,
  party: PartyIdentification,
  fieldPath: string,
): void {
  const cleanName = assertSwiftText(party.name, 140, `${fieldPath}.Nm`);
  const cleanBic =
    party.anyBic !== undefined
      ? parseBic(party.anyBic, `${fieldPath}.Id.OrgId.AnyBIC`).raw
      : undefined;
  const cleanLei =
    party.lei !== undefined
      ? validateLei(party.lei, `${fieldPath}.Id.OrgId.LEI`)
      : undefined;
  const cleanPropId =
    party.proprietaryId !== undefined
      ? validateReferenceId(party.proprietaryId, `${fieldPath}.Id.OrgId.Othr.Id`)
      : undefined;

  writer.openTag(tagName);
  writer.leafTag('Nm', cleanName);

  if (party.postalAddress !== undefined) {
    writePostalAddress(writer, 'PstlAdr', party.postalAddress, `${fieldPath}.PstlAdr`);
  }

  if (cleanBic !== undefined || cleanLei !== undefined || cleanPropId !== undefined) {
    writer.openTag('Id').openTag('OrgId');
    if (cleanBic !== undefined) {
      writer.leafTag('AnyBIC', cleanBic);
    }
    if (cleanLei !== undefined) {
      writer.leafTag('LEI', cleanLei);
    }
    if (cleanPropId !== undefined) {
      writer.openTag('Othr').leafTag('Id', cleanPropId).closeTag('Othr');
    }
    writer.closeTag('OrgId').closeTag('Id');
  }

  writer.closeTag(tagName);
}

export function readPartyIdentification(
  node: XmlNode,
  fieldPath: string,
): PartyIdentification {
  const name = assertSwiftText(
    requireChildText(node, 'Nm', `${fieldPath}.Nm`),
    140,
    `${fieldPath}.Nm`,
  );
  const pstlNode = findChild(node, 'PstlAdr');
  const orgIdNode = findChild(findChild(node, 'Id') ?? node, 'OrgId');
  const othrNode = orgIdNode !== undefined ? findChild(orgIdNode, 'Othr') : undefined;

  const rawBic = orgIdNode !== undefined ? findChild(orgIdNode, 'AnyBIC')?.text : undefined;
  const rawLei = orgIdNode !== undefined ? findChild(orgIdNode, 'LEI')?.text : undefined;
  const rawProp = othrNode !== undefined ? findChild(othrNode, 'Id')?.text : undefined;

  return {
    name,
    postalAddress:
      pstlNode !== undefined
        ? readPostalAddress(pstlNode, `${fieldPath}.PstlAdr`)
        : undefined,
    anyBic:
      rawBic !== undefined
        ? parseBic(rawBic, `${fieldPath}.Id.OrgId.AnyBIC`).raw
        : undefined,
    lei:
      rawLei !== undefined
        ? validateLei(rawLei, `${fieldPath}.Id.OrgId.LEI`)
        : undefined,
    proprietaryId:
      rawProp !== undefined
        ? validateReferenceId(rawProp, `${fieldPath}.Id.OrgId.Othr.Id`)
        : undefined,
  };
}
