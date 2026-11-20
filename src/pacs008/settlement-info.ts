import { Iso20022WireError } from '../errors/wire-error.js';
import {
  readCashAccount,
  writeCashAccount,
  type CashAccount,
} from '../models/account.js';
import { findChild, requireChildText, type XmlNode } from '../xml/tokenizer.js';
import type { XmlWriter } from '../xml/writer.js';

export type SettlementMethodCode = 'INDA' | 'INGA' | 'COVE' | 'CLRG';

export interface SettlementInstruction {
  readonly settlementMethod: SettlementMethodCode;
  readonly settlementAccount?: CashAccount | undefined;
  readonly clearingSystemCode?: string | undefined;
}

const SETTLEMENT_METHODS: ReadonlySet<string> = new Set(['INDA', 'INGA', 'COVE', 'CLRG']);
const CLEARING_SYSTEM_REGEX = /^[A-Z0-9]{1,5}$/;

export function validateSettlementInstruction(
  info: SettlementInstruction,
  fieldPath: string,
): SettlementInstruction {
  const method = info.settlementMethod.trim().toUpperCase();
  if (!SETTLEMENT_METHODS.has(method)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Unsupported interbank SettlementMethod "${info.settlementMethod}"`,
      `${fieldPath}.SttlmMtd`,
    );
  }

  const cleanClearing =
    info.clearingSystemCode !== undefined
      ? info.clearingSystemCode.trim().toUpperCase()
      : undefined;

  if (method === 'CLRG') {
    if (cleanClearing === undefined || !CLEARING_SYSTEM_REGEX.test(cleanClearing)) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        'SettlementMethod CLRG requires a 1-5 character ISO clearingSystemCode (e.g. TGT, FED, STEP2)',
        `${fieldPath}.ClrSys.Cd`,
      );
    }
    if (info.settlementAccount !== undefined) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        'SettlementAccount cannot be combined with clearing system settlement (CLRG)',
        `${fieldPath}.SttlmAcct`,
      );
    }
  } else if (cleanClearing !== undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `ClearingSystemCode is only permitted when SettlementMethod is CLRG, got "${method}"`,
      `${fieldPath}.ClrSys.Cd`,
    );
  }

  return {
    settlementMethod: method as SettlementMethodCode,
    settlementAccount: info.settlementAccount,
    clearingSystemCode: cleanClearing,
  };
}

export function writeSettlementInstruction(
  writer: XmlWriter,
  info: SettlementInstruction,
  fieldPath = 'GrpHdr.SttlmInf',
): void {
  const checked = validateSettlementInstruction(info, fieldPath);
  writer.openTag('SttlmInf');
  writer.leafTag('SttlmMtd', checked.settlementMethod);
  if (checked.settlementAccount !== undefined) {
    writeCashAccount(
      writer,
      'SttlmAcct',
      checked.settlementAccount,
      `${fieldPath}.SttlmAcct`,
    );
  }
  if (checked.clearingSystemCode !== undefined) {
    writer
      .openTag('ClrSys')
      .leafTag('Cd', checked.clearingSystemCode)
      .closeTag('ClrSys');
  }
  writer.closeTag('SttlmInf');
}

export function readSettlementInstruction(
  node: XmlNode,
  fieldPath = 'GrpHdr.SttlmInf',
): SettlementInstruction {
  const rawMethod = requireChildText(node, 'SttlmMtd', `${fieldPath}.SttlmMtd`);
  const acctNode = findChild(node, 'SttlmAcct');
  const clrNode = findChild(node, 'ClrSys');
  const rawClrCode = clrNode !== undefined ? findChild(clrNode, 'Cd')?.text : undefined;

  return validateSettlementInstruction(
    {
      settlementMethod: rawMethod as SettlementMethodCode,
      settlementAccount:
        acctNode !== undefined
          ? readCashAccount(acctNode, `${fieldPath}.SttlmAcct`)
          : undefined,
      clearingSystemCode: rawClrCode,
    },
    fieldPath,
  );
}
