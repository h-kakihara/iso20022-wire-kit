import { Iso20022WireError } from '../errors/wire-error.js';
import { validateIsoDateTime } from '../validators/iso-datetime.js';
import { assertSwiftText, validateReferenceId } from '../validators/swift-charset.js';
import {
  validateGroupStatus,
  validateStatusReasonCode,
  validateTxStatus,
} from './reason-codes.js';
import type { Pacs002BuildInput, StatusReasonInformation } from './types.js';

const MSG_NAME_ID_REGEX = /^[a-z]{4}\.\d{3}\.\d{3}\.\d{2}$/;
const UETR_UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function validateReasonsList(
  reasons: readonly StatusReasonInformation[] | undefined,
  isRejected: boolean,
  fieldPath: string,
): void {
  if (isRejected && (reasons === undefined || reasons.length === 0)) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Rejected (RJCT) ISO 20022 status reports require at least one StatusReasonInformation block',
      `${fieldPath}.StsRsnInf`,
    );
  }

  if (reasons === undefined) {
    return;
  }

  for (const [idx, rsn] of reasons.entries()) {
    const rsnPath = `${fieldPath}.StsRsnInf[${idx}]`;
    const hasIsoCode = rsn.reasonCode !== undefined;
    const hasProp =
      rsn.proprietaryReason !== undefined && rsn.proprietaryReason.trim().length > 0;

    if (hasIsoCode === hasProp) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        'StatusReasonInformation must specify exactly one of reasonCode or proprietaryReason',
        `${rsnPath}.Rsn`,
      );
    }

    if (rsn.reasonCode !== undefined) {
      validateStatusReasonCode(rsn.reasonCode, `${rsnPath}.Rsn.Cd`);
    }
    if (rsn.proprietaryReason !== undefined) {
      assertSwiftText(rsn.proprietaryReason, 35, `${rsnPath}.Rsn.Prtry`);
    }
    if (rsn.additionalInformation !== undefined) {
      assertSwiftText(rsn.additionalInformation, 105, `${rsnPath}.AddtlInf`);
    }
  }
}

export function validatePacs002Input(input: Pacs002BuildInput): void {
  validateReferenceId(input.messageId, 'GrpHdr.MsgId');
  validateIsoDateTime(input.creationDateTime, 'GrpHdr.CreDtTm');

  const grp = input.originalGroupInfo;
  validateReferenceId(grp.originalMessageId, 'OrgnlGrpInfAndSts.OrgnlMsgId');

  if (!MSG_NAME_ID_REGEX.test(grp.originalMessageNameId.trim())) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Invalid OrgnlMsgNmId format (expected e.g. pacs.008.001.08): "${grp.originalMessageNameId}"`,
      'OrgnlGrpInfAndSts.OrgnlMsgNmId',
    );
  }

  if (grp.originalCreationDateTime !== undefined) {
    validateIsoDateTime(
      grp.originalCreationDateTime,
      'OrgnlGrpInfAndSts.OrgnlCreDtTm',
    );
  }

  if (grp.groupStatus !== undefined) {
    validateGroupStatus(grp.groupStatus, 'OrgnlGrpInfAndSts.GrpSts');
  }

  validateReasonsList(
    grp.statusReasons,
    grp.groupStatus === 'RJCT',
    'OrgnlGrpInfAndSts',
  );

  const txList = input.transactionStatuses ?? [];
  if (grp.groupStatus === undefined && txList.length === 0) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'pacs.002 report must provide either a GroupStatus or at least one TransactionStatusEntry',
      'FIToFIPmtStsRpt',
    );
  }

  for (const [idx, tx] of txList.entries()) {
    const txPath = `TxInfAndSts[${idx}]`;
    if (tx.statusId !== undefined) {
      validateReferenceId(tx.statusId, `${txPath}.StsId`);
    }
    if (tx.originalInstructionId !== undefined) {
      validateReferenceId(tx.originalInstructionId, `${txPath}.OrgnlInstrId`);
    }
    validateReferenceId(tx.originalEndToEndId, `${txPath}.OrgnlEndToEndId`);
    if (tx.originalTransactionId !== undefined) {
      validateReferenceId(tx.originalTransactionId, `${txPath}.OrgnlTxId`);
    }
    if (tx.originalUetr !== undefined && !UETR_UUID_V4_REGEX.test(tx.originalUetr)) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        `Invalid UUIDv4 OrgnlUETR in pacs.002 status entry: "${tx.originalUetr}"`,
        `${txPath}.OrgnlUETR`,
      );
    }

    validateTxStatus(tx.transactionStatus, `${txPath}.TxSts`);

    if (tx.acceptanceDateTime !== undefined) {
      validateIsoDateTime(tx.acceptanceDateTime, `${txPath}.AccptncDtTm`);
    }
    if (tx.clearingSystemReference !== undefined) {
      validateReferenceId(tx.clearingSystemReference, `${txPath}.ClrSysRef`);
    }

    validateReasonsList(
      tx.statusReasons,
      tx.transactionStatus === 'RJCT',
      txPath,
    );
  }
}
