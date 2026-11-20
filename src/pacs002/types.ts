import type { FinancialInstitutionAgent } from '../models/account.js';
import type {
  StatusReasonCode,
  TransactionGroupStatusCode,
  TransactionIndividualStatusCode,
} from './reason-codes.js';

export const PACS002_NAMESPACE =
  'urn:iso:std:iso:20022:tech:xsd:pacs.002.001.10' as const;

export interface StatusReasonInformation {
  readonly reasonCode?: StatusReasonCode | undefined;
  readonly proprietaryReason?: string | undefined;
  readonly additionalInformation?: string | undefined;
}

export interface OriginalGroupInformation {
  readonly originalMessageId: string;
  readonly originalMessageNameId: string;
  readonly originalCreationDateTime?: string | undefined;
  readonly groupStatus?: TransactionGroupStatusCode | undefined;
  readonly statusReasons?: readonly StatusReasonInformation[] | undefined;
}

export interface TransactionStatusEntry {
  readonly statusId?: string | undefined;
  readonly originalInstructionId?: string | undefined;
  readonly originalEndToEndId: string;
  readonly originalTransactionId?: string | undefined;
  readonly originalUetr?: string | undefined;
  readonly transactionStatus: TransactionIndividualStatusCode;
  readonly acceptanceDateTime?: string | undefined;
  readonly clearingSystemReference?: string | undefined;
  readonly statusReasons?: readonly StatusReasonInformation[] | undefined;
}

export interface Pacs002GroupHeader {
  readonly messageId: string;
  readonly creationDateTime: string;
  readonly instructingAgent?: FinancialInstitutionAgent | undefined;
  readonly instructedAgent?: FinancialInstitutionAgent | undefined;
}

export interface Pacs002BuildInput {
  readonly messageId: string;
  readonly creationDateTime: string;
  readonly instructingAgent?: FinancialInstitutionAgent | undefined;
  readonly instructedAgent?: FinancialInstitutionAgent | undefined;
  readonly originalGroupInfo: OriginalGroupInformation;
  readonly transactionStatuses?: readonly TransactionStatusEntry[] | undefined;
}

export interface Pacs002Document {
  readonly header: Pacs002GroupHeader;
  readonly originalGroupInfo: OriginalGroupInformation;
  readonly transactionStatuses: readonly TransactionStatusEntry[];
}
