import { Iso20022WireError } from '../errors/wire-error.js';
import { validateIsoDate } from '../validators/iso-datetime.js';
import { validateReferenceId } from '../validators/swift-charset.js';
import type { Pacs008CreditTransferTx } from './types.js';

const UETR_UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const FX_RATE_REGEX = /^(?:0|[1-9]\d*)(?:\.\d{1,10})?$/;

export function validateExchangeRate(rate: string, fieldPath: string): string {
  const trimmed = rate.trim();
  if (!FX_RATE_REGEX.test(trimmed) || /^0(?:\.0+)?$/.test(trimmed)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Invalid or zero ISO 20022 FX ExchangeRate: "${rate}"`,
      fieldPath,
    );
  }
  return trimmed;
}

export function validatePacs008Transactions(
  transactions: readonly Pacs008CreditTransferTx[],
  headerSettlementDate?: string | undefined,
): void {
  if (transactions.length === 0) {
    throw new Iso20022WireError(
      'ERR_TRANSACTION_COUNT_MISMATCH',
      'pacs.008 message must contain at least one interbank CdtTrfTxInf leg',
      'FIToFICstmrCdtTrf.CdtTrfTxInf',
    );
  }

  if (headerSettlementDate !== undefined) {
    validateIsoDate(headerSettlementDate, 'GrpHdr.IntrBkSttlmDt');
  }

  const seenUetrs = new Set<string>();

  for (const [idx, tx] of transactions.entries()) {
    const txPath = `CdtTrfTxInf[${idx}]`;

    if (tx.instructionId !== undefined) {
      validateReferenceId(tx.instructionId, `${txPath}.PmtId.InstrId`);
    }
    validateReferenceId(tx.endToEndId, `${txPath}.PmtId.EndToEndId`);
    if (tx.transactionId !== undefined) {
      validateReferenceId(tx.transactionId, `${txPath}.PmtId.TxId`);
    }

    if (!UETR_UUID_V4_REGEX.test(tx.uetr)) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        `SWIFT CBPR+ pacs.008 mandates lowercase UUIDv4 UETR, got "${tx.uetr}"`,
        `${txPath}.PmtId.UETR`,
      );
    }
    if (seenUetrs.has(tx.uetr)) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        `Duplicate UETR "${tx.uetr}" within pacs.008 batch`,
        `${txPath}.PmtId.UETR`,
      );
    }
    seenUetrs.add(tx.uetr);

    tx.interbankSettlementAmount.assertPositive(`${txPath}.IntrBkSttlmAmt`);

    if (tx.interbankSettlementDate !== undefined) {
      validateIsoDate(tx.interbankSettlementDate, `${txPath}.IntrBkSttlmDt`);
    } else if (headerSettlementDate === undefined) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        'InterbankSettlementDate must be present either on GroupHeader or every CdtTrfTxInf leg',
        `${txPath}.IntrBkSttlmDt`,
      );
    }

    if (tx.instructedAmount !== undefined) {
      tx.instructedAmount.assertPositive(`${txPath}.InstdAmt`);
      const isCrossCurrency =
        tx.instructedAmount.currency !== tx.interbankSettlementAmount.currency;
      if (isCrossCurrency && tx.exchangeRate === undefined) {
        throw new Iso20022WireError(
          'ERR_SCHEMA_VIOLATION',
          `Cross-currency settlement (${tx.instructedAmount.currency} -> ${tx.interbankSettlementAmount.currency}) requires XchgRate`,
          `${txPath}.XchgRate`,
        );
      }
      if (!isCrossCurrency && tx.exchangeRate !== undefined) {
        throw new Iso20022WireError(
          'ERR_SCHEMA_VIOLATION',
          `XchgRate must be omitted when InstdAmt and IntrBkSttlmAmt share currency ${tx.interbankSettlementAmount.currency}`,
          `${txPath}.XchgRate`,
        );
      }
    } else if (tx.exchangeRate !== undefined) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        'XchgRate cannot be specified without an accompanying InstdAmt',
        `${txPath}.XchgRate`,
      );
    }

    if (tx.exchangeRate !== undefined) {
      validateExchangeRate(tx.exchangeRate, `${txPath}.XchgRate`);
    }
  }
}
