import { writeAgent } from '../models/account.js';
import { XmlWriter } from '../xml/writer.js';
import {
  PACS002_NAMESPACE,
  type Pacs002BuildInput,
  type StatusReasonInformation,
} from './types.js';
import { validatePacs002Input } from './validate-pacs002.js';

function writeStatusReasonBlocks(
  writer: XmlWriter,
  reasons: readonly StatusReasonInformation[] | undefined,
): void {
  if (reasons === undefined) {
    return;
  }
  for (const rsn of reasons) {
    writer.openTag('StsRsnInf');
    writer.openTag('Rsn');
    if (rsn.reasonCode !== undefined) {
      writer.leafTag('Cd', rsn.reasonCode.trim().toUpperCase());
    } else if (rsn.proprietaryReason !== undefined) {
      writer.leafTag('Prtry', rsn.proprietaryReason.trim());
    }
    writer.closeTag('Rsn');
    if (rsn.additionalInformation !== undefined) {
      writer.leafTag('AddtlInf', rsn.additionalInformation.trim());
    }
    writer.closeTag('StsRsnInf');
  }
}

export function buildPacs002Xml(input: Pacs002BuildInput): string {
  validatePacs002Input(input);

  const writer = new XmlWriter();
  writer.openTag('Document', { xmlns: PACS002_NAMESPACE });
  writer.openTag('FIToFIPmtStsRpt');

  writer.openTag('GrpHdr');
  writer.leafTag('MsgId', input.messageId.trim());
  writer.leafTag('CreDtTm', input.creationDateTime.trim());
  if (input.instructingAgent !== undefined) {
    writeAgent(writer, 'InstgAgt', input.instructingAgent, 'GrpHdr.InstgAgt');
  }
  if (input.instructedAgent !== undefined) {
    writeAgent(writer, 'InstdAgt', input.instructedAgent, 'GrpHdr.InstdAgt');
  }
  writer.closeTag('GrpHdr');

  const grp = input.originalGroupInfo;
  writer.openTag('OrgnlGrpInfAndSts');
  writer.leafTag('OrgnlMsgId', grp.originalMessageId.trim());
  writer.leafTag('OrgnlMsgNmId', grp.originalMessageNameId.trim());
  if (grp.originalCreationDateTime !== undefined) {
    writer.leafTag('OrgnlCreDtTm', grp.originalCreationDateTime.trim());
  }
  if (grp.groupStatus !== undefined) {
    writer.leafTag('GrpSts', grp.groupStatus);
  }
  writeStatusReasonBlocks(writer, grp.statusReasons);
  writer.closeTag('OrgnlGrpInfAndSts');

  for (const tx of input.transactionStatuses ?? []) {
    writer.openTag('TxInfAndSts');
    if (tx.statusId !== undefined) {
      writer.leafTag('StsId', tx.statusId.trim());
    }
    if (tx.originalInstructionId !== undefined) {
      writer.leafTag('OrgnlInstrId', tx.originalInstructionId.trim());
    }
    writer.leafTag('OrgnlEndToEndId', tx.originalEndToEndId.trim());
    if (tx.originalTransactionId !== undefined) {
      writer.leafTag('OrgnlTxId', tx.originalTransactionId.trim());
    }
    if (tx.originalUetr !== undefined) {
      writer.leafTag('OrgnlUETR', tx.originalUetr.trim());
    }
    writer.leafTag('TxSts', tx.transactionStatus);
    writeStatusReasonBlocks(writer, tx.statusReasons);
    if (tx.acceptanceDateTime !== undefined) {
      writer.leafTag('AccptncDtTm', tx.acceptanceDateTime.trim());
    }
    if (tx.clearingSystemReference !== undefined) {
      writer.leafTag('ClrSysRef', tx.clearingSystemReference.trim());
    }
    writer.closeTag('TxInfAndSts');
  }

  writer.closeTag('FIToFIPmtStsRpt');
  writer.closeTag('Document');
  return writer.toXmlString();
}
