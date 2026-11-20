import { Iso20022WireError } from '../errors/wire-error.js';
import { findChild, type XmlNode } from '../xml/tokenizer.js';
import type { XmlWriter } from '../xml/writer.js';

export type InstructionPriority = 'NORM' | 'HIGH';
export type ServiceLevelCode = 'SEPA' | 'URGP' | 'NURG' | 'SDVA';
export type ChargeBearerCode = 'DEBT' | 'CRED' | 'SHAR' | 'SLEV';
export type CategoryPurposeCode =
  | 'SALA'
  | 'SUPP'
  | 'TAXS'
  | 'TREA'
  | 'INTC'
  | 'DIVI'
  | 'GOVT';

export interface PaymentTypeInformation {
  readonly instructionPriority?: InstructionPriority | undefined;
  readonly serviceLevel?: ServiceLevelCode | undefined;
  readonly localInstrumentCode?: string | undefined;
  readonly categoryPurpose?: CategoryPurposeCode | undefined;
}

const PRIORITIES: ReadonlySet<string> = new Set(['NORM', 'HIGH']);
const SERVICE_LEVELS: ReadonlySet<string> = new Set(['SEPA', 'URGP', 'NURG', 'SDVA']);
const CHARGE_BEARERS: ReadonlySet<string> = new Set(['DEBT', 'CRED', 'SHAR', 'SLEV']);
const CATEGORY_PURPOSES: ReadonlySet<string> = new Set([
  'SALA',
  'SUPP',
  'TAXS',
  'TREA',
  'INTC',
  'DIVI',
  'GOVT',
]);

export function validateChargeBearer(code: string, fieldPath: string): ChargeBearerCode {
  const upper = code.trim().toUpperCase();
  if (!CHARGE_BEARERS.has(upper)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Unsupported ISO 20022 ChargeBearer code: "${code}"`,
      fieldPath,
    );
  }
  return upper as ChargeBearerCode;
}

export function writePaymentTypeInfo(
  writer: XmlWriter,
  info: PaymentTypeInformation,
  fieldPath: string,
): void {
  if (
    info.instructionPriority === undefined &&
    info.serviceLevel === undefined &&
    info.localInstrumentCode === undefined &&
    info.categoryPurpose === undefined
  ) {
    return;
  }

  writer.openTag('PmtTpInf');
  if (info.instructionPriority !== undefined) {
    if (!PRIORITIES.has(info.instructionPriority)) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        `Invalid InstructionPriority: "${info.instructionPriority}"`,
        `${fieldPath}.InstrPrty`,
      );
    }
    writer.leafTag('InstrPrty', info.instructionPriority);
  }
  if (info.serviceLevel !== undefined) {
    if (!SERVICE_LEVELS.has(info.serviceLevel)) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        `Invalid ServiceLevel code: "${info.serviceLevel}"`,
        `${fieldPath}.SvcLvl.Cd`,
      );
    }
    writer.openTag('SvcLvl').leafTag('Cd', info.serviceLevel).closeTag('SvcLvl');
  }
  if (info.localInstrumentCode !== undefined) {
    writer
      .openTag('LclInstrm')
      .leafTag('Cd', info.localInstrumentCode.trim().toUpperCase())
      .closeTag('LclInstrm');
  }
  if (info.categoryPurpose !== undefined) {
    if (!CATEGORY_PURPOSES.has(info.categoryPurpose)) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        `Invalid CategoryPurpose code: "${info.categoryPurpose}"`,
        `${fieldPath}.CtgyPurp.Cd`,
      );
    }
    writer.openTag('CtgyPurp').leafTag('Cd', info.categoryPurpose).closeTag('CtgyPurp');
  }
  writer.closeTag('PmtTpInf');
}

export function readPaymentTypeInfo(
  node: XmlNode,
  fieldPath: string,
): PaymentTypeInformation {
  const rawPriority = findChild(node, 'InstrPrty')?.text;
  const svcNode = findChild(node, 'SvcLvl');
  const rawService = svcNode !== undefined ? findChild(svcNode, 'Cd')?.text : undefined;
  const lclNode = findChild(node, 'LclInstrm');
  const rawLocal = lclNode !== undefined ? findChild(lclNode, 'Cd')?.text : undefined;
  const ctgyNode = findChild(node, 'CtgyPurp');
  const rawCategory = ctgyNode !== undefined ? findChild(ctgyNode, 'Cd')?.text : undefined;

  if (rawPriority !== undefined && !PRIORITIES.has(rawPriority)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Invalid InstructionPriority: "${rawPriority}"`,
      `${fieldPath}.InstrPrty`,
    );
  }
  if (rawService !== undefined && !SERVICE_LEVELS.has(rawService)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Invalid ServiceLevel code: "${rawService}"`,
      `${fieldPath}.SvcLvl.Cd`,
    );
  }
  if (rawCategory !== undefined && !CATEGORY_PURPOSES.has(rawCategory)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Invalid CategoryPurpose code: "${rawCategory}"`,
      `${fieldPath}.CtgyPurp.Cd`,
    );
  }

  return {
    instructionPriority: rawPriority as InstructionPriority | undefined,
    serviceLevel: rawService as ServiceLevelCode | undefined,
    localInstrumentCode: rawLocal,
    categoryPurpose: rawCategory as CategoryPurposeCode | undefined,
  };
}
