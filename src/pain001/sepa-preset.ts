import { Money } from '../currency/money.js';
import type { PartyIdentification } from '../models/party.js';
import type { CategoryPurposeCode } from '../models/payment-type.js';
import { buildPain001Xml } from './builder.js';

export interface SepaTransferLeg {
  readonly endToEndId: string;
  readonly uetr?: string | undefined;
  readonly amountCents: bigint;
  readonly creditorName: string;
  readonly creditorIban: string;
  readonly creditorBic?: string | undefined;
  readonly remittanceUnstructured?: string | undefined;
  readonly creditorReferenceScor?: string | undefined;
}

export interface SepaCreditTransferBatchInput {
  readonly messageId: string;
  readonly creationDateTime: string;
  readonly paymentInformationId: string;
  readonly requestedExecutionDate: string;
  readonly debtor: PartyIdentification;
  readonly debtorIban: string;
  readonly debtorBic: string;
  readonly batchBooking?: boolean | undefined;
  readonly categoryPurpose?: CategoryPurposeCode | undefined;
  readonly transfers: readonly SepaTransferLeg[];
}

export function buildSepaPain001Xml(input: SepaCreditTransferBatchInput): string {
  return buildPain001Xml({
    messageId: input.messageId,
    creationDateTime: input.creationDateTime,
    initiatingParty: input.debtor,
    paymentInstructions: [
      {
        paymentInformationId: input.paymentInformationId,
        paymentMethod: 'TRF',
        batchBooking: input.batchBooking ?? true,
        paymentTypeInfo: {
          instructionPriority: 'NORM',
          serviceLevel: 'SEPA',
          categoryPurpose: input.categoryPurpose,
        },
        requestedExecutionDate: input.requestedExecutionDate,
        debtor: input.debtor,
        debtorAccount: {
          iban: input.debtorIban,
          currency: 'EUR',
        },
        debtorAgent: {
          bic: input.debtorBic,
        },
        chargeBearer: 'SLEV',
        transactions: input.transfers.map((leg) => ({
          endToEndId: leg.endToEndId,
          uetr: leg.uetr,
          amount: Money.fromMinor(leg.amountCents, 'EUR'),
          chargeBearer: 'SLEV',
          creditorAgent:
            leg.creditorBic !== undefined ? { bic: leg.creditorBic } : undefined,
          creditor: { name: leg.creditorName },
          creditorAccount: { iban: leg.creditorIban, currency: 'EUR' },
          remittanceInfo:
            leg.remittanceUnstructured !== undefined ||
            leg.creditorReferenceScor !== undefined
              ? {
                  unstructured: leg.remittanceUnstructured,
                  creditorReference: leg.creditorReferenceScor,
                }
              : undefined,
        })),
      },
    ],
  });
}
