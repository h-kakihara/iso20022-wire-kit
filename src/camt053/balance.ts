import { Money } from '../currency/money.js';
import { Iso20022WireError } from '../errors/wire-error.js';
import {
  validateIsoDate,
  validateIsoDateTime,
} from '../validators/iso-datetime.js';
import { findChild, requireChildText, type XmlNode } from '../xml/tokenizer.js';
import type { XmlWriter } from '../xml/writer.js';
import {
  validateCreditDebitIndicator,
  type CreditDebitIndicator,
} from './signed-balance.js';

export type BalanceTypeCode = 'OPBD' | 'CLBD' | 'CLAV' | 'PRCD' | 'ITBD' | 'FWAV';

export interface CashBalance {
  readonly type: BalanceTypeCode;
  readonly amount: Money;
  readonly creditDebitIndicator: CreditDebitIndicator;
  readonly date: string;
}

const BALANCE_TYPE_CODES: ReadonlySet<string> = new Set([
  'OPBD',
  'CLBD',
  'CLAV',
  'PRCD',
  'ITBD',
  'FWAV',
]);

export function writeDateOrDateTimeChoice(
  writer: XmlWriter,
  wrapperTag: string,
  value: string,
  fieldPath: string,
): void {
  const trimmed = value.trim();
  writer.openTag(wrapperTag);
  if (trimmed.includes('T')) {
    writer.leafTag('DtTm', validateIsoDateTime(trimmed, `${fieldPath}.DtTm`));
  } else {
    writer.leafTag('Dt', validateIsoDate(trimmed, `${fieldPath}.Dt`));
  }
  writer.closeTag(wrapperTag);
}

export function readDateOrDateTimeChoice(node: XmlNode, fieldPath: string): string {
  const dtTmText = findChild(node, 'DtTm')?.text;
  if (dtTmText !== undefined) {
    return validateIsoDateTime(dtTmText, `${fieldPath}.DtTm`);
  }
  const dtText = findChild(node, 'Dt')?.text;
  if (dtText !== undefined) {
    return validateIsoDate(dtText, `${fieldPath}.Dt`);
  }
  throw new Iso20022WireError(
    'ERR_SCHEMA_VIOLATION',
    `Missing <Dt> or <DtTm> inside <${node.name}>`,
    fieldPath,
  );
}

export function writeCashBalance(
  writer: XmlWriter,
  balance: CashBalance,
  fieldPath: string,
): void {
  const typeUpper = balance.type.trim().toUpperCase();
  if (!BALANCE_TYPE_CODES.has(typeUpper)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Unsupported camt.053 BalanceTypeCode "${balance.type}"`,
      `${fieldPath}.Tp.CdOrPrtry.Cd`,
    );
  }
  const indicator = validateCreditDebitIndicator(
    balance.creditDebitIndicator,
    `${fieldPath}.CdtDbtInd`,
  );

  writer.openTag('Bal');
  writer
    .openTag('Tp')
    .openTag('CdOrPrtry')
    .leafTag('Cd', typeUpper)
    .closeTag('CdOrPrtry')
    .closeTag('Tp');
  writer.leafTag('Amt', balance.amount.toWireString(), {
    Ccy: balance.amount.currency,
  });
  writer.leafTag('CdtDbtInd', indicator);
  writeDateOrDateTimeChoice(writer, 'Dt', balance.date, `${fieldPath}.Dt`);
  writer.closeTag('Bal');
}

export function readCashBalance(node: XmlNode, fieldPath: string): CashBalance {
  const tpNode = findChild(node, 'Tp');
  const cdOrPrtryNode = tpNode !== undefined ? findChild(tpNode, 'CdOrPrtry') : undefined;
  if (cdOrPrtryNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory <Tp><CdOrPrtry> in CashBalance',
      `${fieldPath}.Tp`,
    );
  }
  const rawCode = requireChildText(
    cdOrPrtryNode,
    'Cd',
    `${fieldPath}.Tp.CdOrPrtry.Cd`,
  ).toUpperCase();
  if (!BALANCE_TYPE_CODES.has(rawCode)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Unsupported camt.053 BalanceTypeCode "${rawCode}"`,
      `${fieldPath}.Tp.CdOrPrtry.Cd`,
    );
  }

  const amtNode = findChild(node, 'Amt');
  if (amtNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory <Amt> in CashBalance',
      `${fieldPath}.Amt`,
    );
  }
  const ccy = amtNode.attributes['Ccy'];
  if (ccy === undefined) {
    throw new Iso20022WireError(
      'ERR_INVALID_CURRENCY',
      'Missing mandatory Ccy attribute on balance <Amt>',
      `${fieldPath}.Amt`,
    );
  }
  const amount = Money.fromWireString(amtNode.text, ccy, `${fieldPath}.Amt`);
  const creditDebitIndicator = validateCreditDebitIndicator(
    requireChildText(node, 'CdtDbtInd', `${fieldPath}.CdtDbtInd`),
    `${fieldPath}.CdtDbtInd`,
  );

  const dtNode = findChild(node, 'Dt');
  if (dtNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory <Dt> in CashBalance',
      `${fieldPath}.Dt`,
    );
  }

  return {
    type: rawCode as BalanceTypeCode,
    amount,
    creditDebitIndicator,
    date: readDateOrDateTimeChoice(dtNode, `${fieldPath}.Dt`),
  };
}
