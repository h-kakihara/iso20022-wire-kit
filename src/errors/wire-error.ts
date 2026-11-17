export type WireErrorCode =
  | 'ERR_INVALID_CURRENCY'
  | 'ERR_NEGATIVE_AMOUNT'
  | 'ERR_ZERO_AMOUNT_FORBIDDEN'
  | 'ERR_SCALE_OVERFLOW'
  | 'ERR_INVALID_BIC'
  | 'ERR_INVALID_IBAN'
  | 'ERR_INVALID_END_TO_END_ID'
  | 'ERR_CONTROL_SUM_MISMATCH'
  | 'ERR_TRANSACTION_COUNT_MISMATCH'
  | 'ERR_XXE_OR_DOCTYPE_DETECTED'
  | 'ERR_XML_DEPTH_EXCEEDED'
  | 'ERR_SCHEMA_VIOLATION';

export class Iso20022WireError extends Error {
  public readonly code: WireErrorCode;
  public readonly fieldPath: string | undefined;

  public constructor(code: WireErrorCode, message: string, fieldPath?: string) {
    super(message);
    this.name = 'Iso20022WireError';
    this.code = code;
    this.fieldPath = fieldPath;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON(): Record<string, string> {
    const serialized: Record<string, string> = {
      name: this.name,
      code: this.code,
      message: this.message,
    };
    if (this.fieldPath !== undefined) {
      serialized['fieldPath'] = this.fieldPath;
    }
    return serialized;
  }
}
