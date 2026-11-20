import { Iso20022WireError } from '../errors/wire-error.js';
import { validateIban } from '../validators/iban.js';
import { validateIsoDate, validateIsoDateTime } from '../validators/iso-datetime.js';
import { validateReferenceId } from '../validators/swift-charset.js';
import type { Pain001BuildInput, Pain001PaymentInstruction } from './types.js';

const UETR_UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function enforceSepaInstructionRules(
  pmt: Pain001PaymentInstruction,
  batchPath: string,
): void {
  if (pmt.debtorAccount.iban === undefined) {
    throw new Iso20022WireError(
      'ERR_INVALID_IBAN',
      'SEPA credit transfers require an IBAN for DebtorAccount',
      `${batchPath}.DbtrAcct`,
    );
  }
  const debtorIban = validateIban(pmt.debtorAccount.iban, `${batchPath}.DbtrAcct.Id.IBAN`);
  if (!debtorIban.isSepa) {
    throw new Iso20022WireError(
      'ERR_INVALID_IBAN',
      `Debtor IBAN country "${debtorIban.countryCode}" is outside the SEPA zone`,
      `${batchPath}.DbtrAcct.Id.IBAN`,
    );
  }

  if (pmt.chargeBearer !== undefined && pmt.chargeBearer !== 'SLEV') {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `SEPA credit transfers mandate ChargeBearer "SLEV", received "${pmt.chargeBearer}"`,
      `${batchPath}.ChrgBr`,
    );
  }

  for (let t = 0; t < pmt.transactions.length; t += 1) {
    const tx = pmt.transactions[t];
    if (tx === undefined) {
      continue;
    }
    const txPath = `${batchPath}.CdtTrfTxInf[${t}]`;
    if (tx.amount.currency !== 'EUR') {
      throw new Iso20022WireError(
        'ERR_INVALID_CURRENCY',
        `SEPA credit transfers must settle in EUR, received "${tx.amount.currency}"`,
        `${txPath}.Amt.InstdAmt`,
      );
    }
    if (tx.chargeBearer !== undefined && tx.chargeBearer !== 'SLEV') {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        `SEPA transaction ChargeBearer must be "SLEV", received "${tx.chargeBearer}"`,
        `${txPath}.ChrgBr`,
      );
    }
    if (tx.creditorAccount.iban === undefined) {
      throw new Iso20022WireError(
        'ERR_INVALID_IBAN',
        'SEPA credit transfers require an IBAN for CreditorAccount',
        `${txPath}.CdtrAcct`,
      );
    }
    const creditorIban = validateIban(
      tx.creditorAccount.iban,
      `${txPath}.CdtrAcct.Id.IBAN`,
    );
    if (!creditorIban.isSepa) {
      throw new Iso20022WireError(
        'ERR_INVALID_IBAN',
        `Creditor IBAN country "${creditorIban.countryCode}" is outside the SEPA zone`,
        `${txPath}.CdtrAcct.Id.IBAN`,
      );
    }
  }
}

export function validatePain001Input(input: Pain001BuildInput): void {
  validateReferenceId(input.messageId, 'GrpHdr.MsgId');
  validateIsoDateTime(input.creationDateTime, 'GrpHdr.CreDtTm');

  if (input.paymentInstructions.length === 0) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'pain.001 message must contain at least one PaymentInstruction (PmtInf)',
      'CstmrCdtTrfInitn.PmtInf',
    );
  }

  const seenPmtIds = new Set<string>();

  for (let i = 0; i < input.paymentInstructions.length; i += 1) {
    const pmt = input.paymentInstructions[i];
    if (pmt === undefined) {
      continue;
    }
    const batchPath = `PmtInf[${i}]`;
    const pmtId = validateReferenceId(pmt.paymentInformationId, `${batchPath}.PmtInfId`);
    if (seenPmtIds.has(pmtId)) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        `Duplicate PmtInfId "${pmtId}" within pain.001 document`,
        `${batchPath}.PmtInfId`,
      );
    }
    seenPmtIds.add(pmtId);

    validateIsoDate(pmt.requestedExecutionDate, `${batchPath}.ReqdExctnDt.Dt`);

    if (pmt.transactions.length === 0) {
      throw new Iso20022WireError(
        'ERR_TRANSACTION_COUNT_MISMATCH',
        `PaymentInstruction "${pmtId}" must contain at least one transaction`,
        `${batchPath}.CdtTrfTxInf`,
      );
    }

    for (let t = 0; t < pmt.transactions.length; t += 1) {
      const tx = pmt.transactions[t];
      if (tx === undefined) {
        continue;
      }
      const txPath = `${batchPath}.CdtTrfTxInf[${t}]`;
      validateReferenceId(tx.endToEndId, `${txPath}.PmtId.EndToEndId`);
      if (tx.instructionId !== undefined) {
        validateReferenceId(tx.instructionId, `${txPath}.PmtId.InstrId`);
      }
      if (tx.uetr !== undefined && !UETR_UUID_V4_REGEX.test(tx.uetr)) {
        throw new Iso20022WireError(
          'ERR_SCHEMA_VIOLATION',
          `SWIFT GPI UETR must be a lowercase RFC 4122 UUIDv4: "${tx.uetr}"`,
          `${txPath}.PmtId.UETR`,
        );
      }
      tx.amount.assertPositive(`${txPath}.Amt.InstdAmt`);
    }

    if (pmt.paymentTypeInfo?.serviceLevel === 'SEPA') {
      enforceSepaInstructionRules(pmt, batchPath);
    }
  }
}
