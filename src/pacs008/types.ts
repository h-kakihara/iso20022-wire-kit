import type { Money } from '../currency/money.js';
import type { CashAccount, FinancialInstitutionAgent } from '../models/account.js';
import type { PartyIdentification } from '../models/party.js';
import type {
  ChargeBearerCode,
  PaymentTypeInformation,
} from '../models/payment-type.js';
import type { RemittanceInformation } from '../models/remittance.js';
import type { Pacs008GroupHeader } from './group-header.js';
import type { SettlementInstruction } from './settlement-info.js';

export const PACS008_NAMESPACE =
  'urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08' as const;

export interface Pacs008CreditTransferTx {
  readonly instructionId?: string | undefined;
  readonly endToEndId: string;
  readonly transactionId?: string | undefined;
  readonly uetr: string;
  readonly paymentTypeInfo?: PaymentTypeInformation | undefined;
  readonly interbankSettlementAmount: Money;
  readonly interbankSettlementDate?: string | undefined;
  readonly instructedAmount?: Money | undefined;
  readonly exchangeRate?: string | undefined;
  readonly chargeBearer: ChargeBearerCode;
  readonly intermediaryAgent1?: FinancialInstitutionAgent | undefined;
  readonly debtor: PartyIdentification;
  readonly debtorAccount?: CashAccount | undefined;
  readonly debtorAgent: FinancialInstitutionAgent;
  readonly creditorAgent: FinancialInstitutionAgent;
  readonly creditor: PartyIdentification;
  readonly creditorAccount?: CashAccount | undefined;
  readonly remittanceInfo?: RemittanceInformation | undefined;
}

export interface Pacs008BuildInput {
  readonly messageId: string;
  readonly creationDateTime: string;
  readonly interbankSettlementDate: string;
  readonly settlementInfo: SettlementInstruction;
  readonly instructingAgent: FinancialInstitutionAgent;
  readonly instructedAgent: FinancialInstitutionAgent;
  readonly transactions: readonly Pacs008CreditTransferTx[];
}

export interface Pacs008Document {
  readonly header: Pacs008GroupHeader;
  readonly transactions: readonly Pacs008CreditTransferTx[];
}
