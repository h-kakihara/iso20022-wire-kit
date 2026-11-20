import { resolveCurrency } from '../currency/iso4217.js';
import { Iso20022WireError } from '../errors/wire-error.js';
import { parseBic } from '../validators/bic.js';
import { validateIban } from '../validators/iban.js';
import { validateLei } from '../validators/lei.js';
import { assertSwiftText } from '../validators/swift-charset.js';
import { findChild, requireChildText, type XmlNode } from '../xml/tokenizer.js';
import type { XmlWriter } from '../xml/writer.js';

export interface CashAccount {
  readonly iban?: string | undefined;
  readonly otherId?: string | undefined;
  readonly currency?: string | undefined;
  readonly name?: string | undefined;
}

export interface FinancialInstitutionAgent {
  readonly bic: string;
  readonly lei?: string | undefined;
  readonly name?: string | undefined;
}

export function validateCashAccount(account: CashAccount, fieldPath: string): CashAccount {
  const hasIban = account.iban !== undefined && account.iban.trim().length > 0;
  const hasOther = account.otherId !== undefined && account.otherId.trim().length > 0;

  if (hasIban === hasOther) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'CashAccount must specify exactly one of IBAN or proprietary otherId',
      `${fieldPath}.Id`,
    );
  }

  return {
    iban: hasIban && account.iban !== undefined
      ? validateIban(account.iban, `${fieldPath}.Id.IBAN`).compact
      : undefined,
    otherId: hasOther && account.otherId !== undefined
      ? assertSwiftText(account.otherId, 34, `${fieldPath}.Id.Othr.Id`)
      : undefined,
    currency:
      account.currency !== undefined
        ? resolveCurrency(account.currency, `${fieldPath}.Ccy`).code
        : undefined,
    name:
      account.name !== undefined
        ? assertSwiftText(account.name, 70, `${fieldPath}.Nm`)
        : undefined,
  };
}

export function writeCashAccount(
  writer: XmlWriter,
  tagName: string,
  account: CashAccount,
  fieldPath: string,
): void {
  const checked = validateCashAccount(account, fieldPath);
  writer.openTag(tagName).openTag('Id');
  if (checked.iban !== undefined) {
    writer.leafTag('IBAN', checked.iban);
  } else if (checked.otherId !== undefined) {
    writer.openTag('Othr').leafTag('Id', checked.otherId).closeTag('Othr');
  }
  writer.closeTag('Id');
  if (checked.currency !== undefined) {
    writer.leafTag('Ccy', checked.currency);
  }
  if (checked.name !== undefined) {
    writer.leafTag('Nm', checked.name);
  }
  writer.closeTag(tagName);
}

export function readCashAccount(node: XmlNode, fieldPath: string): CashAccount {
  const idNode = findChild(node, 'Id');
  if (idNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory <Id> inside CashAccount element',
      `${fieldPath}.Id`,
    );
  }
  const ibanText = findChild(idNode, 'IBAN')?.text;
  const othrNode = findChild(idNode, 'Othr');
  const otherIdText = othrNode !== undefined ? findChild(othrNode, 'Id')?.text : undefined;

  return validateCashAccount(
    {
      iban: ibanText,
      otherId: otherIdText,
      currency: findChild(node, 'Ccy')?.text,
      name: findChild(node, 'Nm')?.text,
    },
    fieldPath,
  );
}

export function writeAgent(
  writer: XmlWriter,
  tagName: string,
  agent: FinancialInstitutionAgent,
  fieldPath: string,
): void {
  const bic = parseBic(agent.bic, `${fieldPath}.FinInstnId.BICFI`).raw;
  const lei =
    agent.lei !== undefined
      ? validateLei(agent.lei, `${fieldPath}.FinInstnId.LEI`)
      : undefined;
  const name =
    agent.name !== undefined
      ? assertSwiftText(agent.name, 140, `${fieldPath}.FinInstnId.Nm`)
      : undefined;

  writer.openTag(tagName).openTag('FinInstnId');
  writer.leafTag('BICFI', bic);
  if (lei !== undefined) {
    writer.leafTag('LEI', lei);
  }
  if (name !== undefined) {
    writer.leafTag('Nm', name);
  }
  writer.closeTag('FinInstnId').closeTag(tagName);
}

export function readAgent(node: XmlNode, fieldPath: string): FinancialInstitutionAgent {
  const finNode = findChild(node, 'FinInstnId');
  if (finNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory <FinInstnId> inside Agent element',
      `${fieldPath}.FinInstnId`,
    );
  }
  const bic = parseBic(
    requireChildText(finNode, 'BICFI', `${fieldPath}.FinInstnId.BICFI`),
    `${fieldPath}.FinInstnId.BICFI`,
  ).raw;
  const rawLei = findChild(finNode, 'LEI')?.text;
  const rawName = findChild(finNode, 'Nm')?.text;

  return {
    bic,
    lei: rawLei !== undefined ? validateLei(rawLei, `${fieldPath}.FinInstnId.LEI`) : undefined,
    name:
      rawName !== undefined
        ? assertSwiftText(rawName, 140, `${fieldPath}.FinInstnId.Nm`)
        : undefined,
  };
}
