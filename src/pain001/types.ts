import type { Money } from '../currency/money.js';
import type { CashAccount, FinancialInstitutionAgent } from '../models/account.js';
import type { GroupHeader } from '../models/group-header.js';
import type { PartyIdentification } from '../models/party.js';
import type {
  ChargeBearerCode,
  PaymentTypeInformation,
} from '../models/payment-type.js';
import type { RemittanceInformation } from '../models/remittance.js';

export const PAIN001_NAMESPACE =
  'urn:iso:std:iso:20022:tech:xsd:pain.001.001.09' as const;

export interface Pain001CreditTransferTx {
  readonly instructionId?: string | undefined;
  readonly endToEndId: string;
  readonly uetr?: string | undefined;
  readonly amount: Money;
  readonly chargeBearer?: ChargeBearerCode | undefined;
  readonly creditorAgent?: FinancialInstitutionAgent | undefined;
  readonly creditor: PartyIdentification;
  readonly creditorAccount: CashAccount;
  readonly purposeCode?: string | undefined;
  readonly remittanceInfo?: RemittanceInformation | undefined;
}

export interface Pain001PaymentInstruction {
  readonly paymentInformationId: string;
  readonly paymentMethod?: 'TRF' | 'TRA' | undefined;
  readonly batchBooking?: boolean | undefined;
  readonly paymentTypeInfo?: PaymentTypeInformation | undefined;
  readonly requestedExecutionDate: string;
  readonly debtor: PartyIdentification;
  readonly debtorAccount: CashAccount;
  readonly debtorAgent: FinancialInstitutionAgent;
  readonly chargeBearer?: ChargeBearerCode | undefined;
  readonly transactions: readonly Pain001CreditTransferTx[];
}

export interface Pain001BuildInput {
  readonly messageId: string;
  readonly creationDateTime: string;
  readonly initiatingParty: PartyIdentification;
  readonly paymentInstructions: readonly Pain001PaymentInstruction[];
}

export interface Pain001Document {
  readonly header: GroupHeader;
  readonly paymentInstructions: readonly Pain001PaymentInstruction[];
}
