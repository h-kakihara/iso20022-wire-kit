import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DecimalSumAccumulator,
  Iso20022WireError,
  Money,
  validateCreditorReferenceRf,
} from '../index.js';

describe('Fixed-scale CtrlSum accumulator and ISO 11649 SCOR references', () => {
  it('accumulates mixed 0, 2, and 3 decimal currencies with zero float drift', () => {
    const acc = new DecimalSumAccumulator();
    acc.addMoney(Money.fromWireString('0.10', 'EUR'));
    acc.addMoney(Money.fromWireString('0.20', 'USD'));
    acc.addMoney(Money.fromWireString('100', 'JPY'));
    acc.addMoney(Money.fromWireString('1.005', 'KWD'));

    assert.equal(acc.transactionCount, 4);
    assert.equal(acc.formatControlSum(), '101.305');
    acc.verifyControlSum('101.3050', 'GrpHdr.CtrlSum');

    assert.throws(
      () => acc.verifyControlSum('101.30', 'GrpHdr.CtrlSum'),
      (err: unknown) =>
        err instanceof Iso20022WireError &&
        err.code === 'ERR_CONTROL_SUM_MISMATCH',
    );
  });

  it('validates ISO 11649 RF structured creditor references', () => {
    assert.equal(
      validateCreditorReferenceRf('rf18 5390 0754 7034'),
      'RF18539007547034',
    );
    assert.equal(
      validateCreditorReferenceRf('RF10INV2026001'),
      'RF10INV2026001',
    );

    assert.throws(
      () => validateCreditorReferenceRf('RF19539007547034'),
      (err: unknown) =>
        err instanceof Iso20022WireError && err.code === 'ERR_SCHEMA_VIOLATION',
    );
  });
});
