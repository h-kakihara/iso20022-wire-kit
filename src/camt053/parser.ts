import { Money } from '../currency/money.js';
import { Iso20022WireError } from '../errors/wire-error.js';
import { readAgent, readCashAccount } from '../models/account.js';
import { parseControlSumScaled } from '../models/control-sum.js';
import { validateIsoDateTime } from '../validators/iso-datetime.js';
import { validateReferenceId } from '../validators/swift-charset.js';
import {
  findChild,
  findChildren,
  parseSafeXml,
  requireChildText,
  type XmlNode,
} from '../xml/tokenizer.js';
import { readCashBalance } from './balance.js';
import { readStatementEntry } from './entry.js';
import { validateCreditDebitIndicator } from './signed-balance.js';
import type {
  AccountStatement,
  Camt053Document,
  StatementPagination,
  TransactionsSummary,
} from './types.js';
import { auditStatementBalances } from './validate-camt053.js';

function readSummaryBlock(
  node: XmlNode,
  accountCurrency: string,
  fieldPath: string,
): TransactionsSummary {
  const ttlNode = findChild(node, 'TtlNtries');
  const cdtNode = findChild(node, 'TtlCdtNtries');
  const dbtNode = findChild(node, 'TtlDbtNtries');

  if (ttlNode === undefined || cdtNode === undefined || dbtNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'TxsSummry requires <TtlNtries>, <TtlCdtNtries>, and <TtlDbtNtries>',
      fieldPath,
    );
  }

  const totalEntriesCount = Number(
    requireChildText(ttlNode, 'NbOfNtries', `${fieldPath}.TtlNtries.NbOfNtries`),
  );
  const totalEntriesSum = requireChildText(ttlNode, 'Sum', `${fieldPath}.TtlNtries.Sum`);
  parseControlSumScaled(totalEntriesSum, `${fieldPath}.TtlNtries.Sum`);

  const netNode = findChild(ttlNode, 'TtlNetNtry');
  if (netNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing <TtlNetNtry> inside <TtlNtries>',
      `${fieldPath}.TtlNtries.TtlNetNtry`,
    );
  }
  const netAmtNode = findChild(netNode, 'Amt');
  if (netAmtNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing <Amt> inside <TtlNetNtry>',
      `${fieldPath}.TtlNtries.TtlNetNtry.Amt`,
    );
  }
  const netCurrency = netAmtNode.attributes['Ccy'] ?? accountCurrency;
  const totalNetAmount = Money.fromWireString(
    netAmtNode.text,
    netCurrency,
    `${fieldPath}.TtlNtries.TtlNetNtry.Amt`,
  );
  const totalNetCreditDebitIndicator = validateCreditDebitIndicator(
    requireChildText(
      netNode,
      'CdtDbtInd',
      `${fieldPath}.TtlNtries.TtlNetNtry.CdtDbtInd`,
    ),
    `${fieldPath}.TtlNtries.TtlNetNtry.CdtDbtInd`,
  );

  const totalCreditCount = Number(
    requireChildText(cdtNode, 'NbOfNtries', `${fieldPath}.TtlCdtNtries.NbOfNtries`),
  );
  const totalCreditSum = requireChildText(
    cdtNode,
    'Sum',
    `${fieldPath}.TtlCdtNtries.Sum`,
  );
  parseControlSumScaled(totalCreditSum, `${fieldPath}.TtlCdtNtries.Sum`);

  const totalDebitCount = Number(
    requireChildText(dbtNode, 'NbOfNtries', `${fieldPath}.TtlDbtNtries.NbOfNtries`),
  );
  const totalDebitSum = requireChildText(
    dbtNode,
    'Sum',
    `${fieldPath}.TtlDbtNtries.Sum`,
  );
  parseControlSumScaled(totalDebitSum, `${fieldPath}.TtlDbtNtries.Sum`);

  return {
    totalEntriesCount,
    totalEntriesSum,
    totalNetAmount,
    totalNetCreditDebitIndicator,
    totalCreditCount,
    totalCreditSum,
    totalDebitCount,
    totalDebitSum,
  };
}

export function parseCamt053Xml(xml: string): Camt053Document {
  const root = parseSafeXml(xml);
  if (root.name !== 'Document') {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Expected <Document> root in camt.053 payload, found <${root.name}>`,
      'Document',
    );
  }

  const bodyNode = findChild(root, 'BkToCstmrStmt');
  if (bodyNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory <BkToCstmrStmt> body in camt.053 payload',
      'Document.BkToCstmrStmt',
    );
  }

  const grpHdrNode = findChild(bodyNode, 'GrpHdr');
  if (grpHdrNode === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Missing mandatory <GrpHdr> in camt.053 payload',
      'BkToCstmrStmt.GrpHdr',
    );
  }

  const messageId = validateReferenceId(
    requireChildText(grpHdrNode, 'MsgId', 'GrpHdr.MsgId'),
    'GrpHdr.MsgId',
  );
  const creationDateTime = validateIsoDateTime(
    requireChildText(grpHdrNode, 'CreDtTm', 'GrpHdr.CreDtTm'),
    'GrpHdr.CreDtTm',
  );

  const pgNode = findChild(grpHdrNode, 'MsgPgntn');
  let pagination: StatementPagination | undefined;
  if (pgNode !== undefined) {
    const pageNumber = requireChildText(pgNode, 'PgNb', 'GrpHdr.MsgPgntn.PgNb');
    const lastPgText = requireChildText(
      pgNode,
      'LastPgInd',
      'GrpHdr.MsgPgntn.LastPgInd',
    );
    pagination = {
      pageNumber,
      lastPageIndicator: lastPgText === 'true',
    };
  }

  const stmtNodes = findChildren(bodyNode, 'Stmt');
  if (stmtNodes.length === 0) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'camt.053 payload contains zero <Stmt> elements',
      'BkToCstmrStmt.Stmt',
    );
  }

  const statements: AccountStatement[] = stmtNodes.map((stmtNode, sIdx) => {
    const stmtPath = `Stmt[${sIdx}]`;
    const id = validateReferenceId(
      requireChildText(stmtNode, 'Id', `${stmtPath}.Id`),
      `${stmtPath}.Id`,
    );
    const rawSeq = findChild(stmtNode, 'ElctrncSeqNb')?.text;
    const stmtCreDt = validateIsoDateTime(
      requireChildText(stmtNode, 'CreDtTm', `${stmtPath}.CreDtTm`),
      `${stmtPath}.CreDtTm`,
    );
    const frToNode = findChild(stmtNode, 'FrToDt');
    const fromDateTime =
      frToNode !== undefined
        ? validateIsoDateTime(
            requireChildText(frToNode, 'FrDtTm', `${stmtPath}.FrToDt.FrDtTm`),
            `${stmtPath}.FrToDt.FrDtTm`,
          )
        : undefined;
    const toDateTime =
      frToNode !== undefined
        ? validateIsoDateTime(
            requireChildText(frToNode, 'ToDtTm', `${stmtPath}.FrToDt.ToDtTm`),
            `${stmtPath}.FrToDt.ToDtTm`,
          )
        : undefined;

    const acctNode = findChild(stmtNode, 'Acct');
    if (acctNode === undefined) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        'Missing mandatory <Acct> in camt.053 <Stmt>',
        `${stmtPath}.Acct`,
      );
    }
    const account = readCashAccount(acctNode, `${stmtPath}.Acct`);
    if (account.currency === undefined) {
      throw new Iso20022WireError(
        'ERR_INVALID_CURRENCY',
        'Missing mandatory <Ccy> inside camt.053 <Acct>',
        `${stmtPath}.Acct.Ccy`,
      );
    }

    const acctSvcrOuter = findChild(stmtNode, 'AcctSvcr');
    const svcrNode =
      acctSvcrOuter !== undefined
        ? (findChild(acctSvcrOuter, 'Svcr') ?? acctSvcrOuter)
        : undefined;

    const balances = findChildren(stmtNode, 'Bal').map((balNode, bIdx) =>
      readCashBalance(balNode, `${stmtPath}.Bal[${bIdx}]`),
    );
    const entries = findChildren(stmtNode, 'Ntry').map((ntryNode, eIdx) =>
      readStatementEntry(ntryNode, `${stmtPath}.Ntry[${eIdx}]`),
    );

    const summaryNode = findChild(stmtNode, 'TxsSummry');
    const transactionsSummary =
      summaryNode !== undefined
        ? readSummaryBlock(summaryNode, account.currency, `${stmtPath}.TxsSummry`)
        : undefined;

    const statement: AccountStatement = {
      id,
      electronicSequenceNumber: rawSeq !== undefined ? Number(rawSeq) : undefined,
      creationDateTime: stmtCreDt,
      fromDateTime,
      toDateTime,
      account,
      servicerAgent:
        svcrNode !== undefined
          ? readAgent(svcrNode, `${stmtPath}.AcctSvcr`)
          : undefined,
      balances,
      transactionsSummary,
      entries,
    };

    auditStatementBalances(statement, stmtPath);
    return statement;
  });

  return {
    header: {
      messageId,
      creationDateTime,
      pagination,
    },
    statements,
  };
}
