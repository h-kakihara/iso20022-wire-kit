import { Iso20022WireError } from '../errors/wire-error.js';
import { writeAgent, writeCashAccount } from '../models/account.js';
import { validateIsoDateTime } from '../validators/iso-datetime.js';
import { validateReferenceId } from '../validators/swift-charset.js';
import { XmlWriter } from '../xml/writer.js';
import { writeCashBalance } from './balance.js';
import { writeStatementEntry } from './entry.js';
import { CAMT053_NAMESPACE, type Camt053BuildInput } from './types.js';
import { auditStatementBalances } from './validate-camt053.js';

export function buildCamt053Xml(input: Camt053BuildInput): string {
  const msgId = validateReferenceId(input.messageId, 'GrpHdr.MsgId');
  const creDtTm = validateIsoDateTime(input.creationDateTime, 'GrpHdr.CreDtTm');

  if (input.statements.length === 0) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'camt.053 document must contain at least one <Stmt>',
      'BkToCstmrStmt.Stmt',
    );
  }

  const writer = new XmlWriter();
  writer.openTag('Document', { xmlns: CAMT053_NAMESPACE });
  writer.openTag('BkToCstmrStmt');

  writer.openTag('GrpHdr');
  writer.leafTag('MsgId', msgId);
  writer.leafTag('CreDtTm', creDtTm);
  if (input.pagination !== undefined) {
    if (!/^[1-9]\d{0,4}$/.test(input.pagination.pageNumber.trim())) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        `Invalid pagination PgNb "${input.pagination.pageNumber}"`,
        'GrpHdr.MsgPgntn.PgNb',
      );
    }
    writer
      .openTag('MsgPgntn')
      .leafTag('PgNb', input.pagination.pageNumber.trim())
      .leafTag('LastPgInd', input.pagination.lastPageIndicator ? 'true' : 'false')
      .closeTag('MsgPgntn');
  }
  writer.closeTag('GrpHdr');

  for (const [sIdx, stmt] of input.statements.entries()) {
    const stmtPath = `Stmt[${sIdx}]`;
    const stmtId = validateReferenceId(stmt.id, `${stmtPath}.Id`);
    const stmtCreDt = validateIsoDateTime(
      stmt.creationDateTime,
      `${stmtPath}.CreDtTm`,
    );
    const summary = auditStatementBalances(stmt, stmtPath);

    writer.openTag('Stmt');
    writer.leafTag('Id', stmtId);
    if (stmt.electronicSequenceNumber !== undefined) {
      if (
        !Number.isInteger(stmt.electronicSequenceNumber) ||
        stmt.electronicSequenceNumber < 1
      ) {
        throw new Iso20022WireError(
          'ERR_SCHEMA_VIOLATION',
          `ElctrncSeqNb must be a positive integer, got ${stmt.electronicSequenceNumber}`,
          `${stmtPath}.ElctrncSeqNb`,
        );
      }
      writer.leafTag('ElctrncSeqNb', String(stmt.electronicSequenceNumber));
    }
    writer.leafTag('CreDtTm', stmtCreDt);

    if (stmt.fromDateTime !== undefined && stmt.toDateTime !== undefined) {
      writer
        .openTag('FrToDt')
        .leafTag(
          'FrDtTm',
          validateIsoDateTime(stmt.fromDateTime, `${stmtPath}.FrToDt.FrDtTm`),
        )
        .leafTag(
          'ToDtTm',
          validateIsoDateTime(stmt.toDateTime, `${stmtPath}.FrToDt.ToDtTm`),
        )
        .closeTag('FrToDt');
    }

    writeCashAccount(writer, 'Acct', stmt.account, `${stmtPath}.Acct`);
    if (stmt.servicerAgent !== undefined) {
      writer.openTag('AcctSvcr');
      writeAgent(writer, 'Svcr', stmt.servicerAgent, `${stmtPath}.AcctSvcr`);
      writer.closeTag('AcctSvcr');
    }

    for (const [bIdx, bal] of stmt.balances.entries()) {
      writeCashBalance(writer, bal, `${stmtPath}.Bal[${bIdx}]`);
    }

    if (summary.totalEntriesCount > 0) {
      writer.openTag('TxsSummry');
      writer
        .openTag('TtlNtries')
        .leafTag('NbOfNtries', String(summary.totalEntriesCount))
        .leafTag('Sum', summary.totalEntriesSum)
        .openTag('TtlNetNtry')
        .leafTag('Amt', summary.totalNetAmount.toWireString())
        .leafTag('CdtDbtInd', summary.totalNetCreditDebitIndicator)
        .closeTag('TtlNetNtry')
        .closeTag('TtlNtries');
      writer
        .openTag('TtlCdtNtries')
        .leafTag('NbOfNtries', String(summary.totalCreditCount))
        .leafTag('Sum', summary.totalCreditSum)
        .closeTag('TtlCdtNtries');
      writer
        .openTag('TtlDbtNtries')
        .leafTag('NbOfNtries', String(summary.totalDebitCount))
        .leafTag('Sum', summary.totalDebitSum)
        .closeTag('TtlDbtNtries');
      writer.closeTag('TxsSummry');
    }

    for (const [eIdx, entry] of stmt.entries.entries()) {
      writeStatementEntry(writer, entry, `${stmtPath}.Ntry[${eIdx}]`);
    }

    writer.closeTag('Stmt');
  }

  writer.closeTag('BkToCstmrStmt');
  writer.closeTag('Document');
  return writer.toXmlString();
}
