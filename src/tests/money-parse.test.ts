import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Iso20022WireError, Money, parseWireAmount } from '../index.js';

describe('Wire decimal parser and immutable Money value object', () => {
  it('parses decimal wire strings into exact bigint minor units', () => {
    assert.equal(parseWireAmount('1500', 'EUR'), 150000n);
    assert.equal(parseWireAmount('1500.5', 'EUR'), 150050n);
    assert.equal(parseWireAmount('0.01', 'USD'), 1n);
    assert.equal(parseWireAmount('25000', 'JPY'), 25000n);
    assert.equal(parseWireAmount('42.125', 'KWD'), 42125n);
  });

  it('rejects sub-cent scale overflow, scientific notation, and negatives', () => {
    assert.throws(
      () => parseWireAmount('10.999', 'USD'),
      (err: unknown) =>
        err instanceof Iso20022WireError && err.code === 'ERR_SCALE_OVERFLOW',
    );
    assert.throws(
      () => parseWireAmount('100.5', 'JPY'),
      (err: unknown) =>
        err instanceof Iso20022WireError && err.code === 'ERR_SCALE_OVERFLOW',
    );
    assert.throws(
      () => parseWireAmount('1e5', 'EUR'),
      (err: unknown) =>
        err instanceof Iso20022WireError && err.code === 'ERR_SCHEMA_VIOLATION',
    );
    assert.throws(
      () => parseWireAmount('-50.00', 'EUR'),
      (err: unknown) =>
        err instanceof Iso20022WireError && err.code === 'ERR_NEGATIVE_AMOUNT',
    );
  });

  it('enforces homogeneous currency addition and positive settlement bounds', () => {
    const a = Money.fromWireString('19.99', 'EUR');
    const b = Money.fromMinor(1n, 'EUR');
    const sum = a.add(b);
    assert.equal(sum.toWireString(), '20.00');
    assert.equal(sum.minorUnits, 2000n);

    assert.throws(
      () => a.add(Money.fromMinor(100n, 'USD')),
      (err: unknown) =>
        err instanceof Iso20022WireError && err.code === 'ERR_INVALID_CURRENCY',
    );

    assert.throws(
      () => Money.fromMinor(0n, 'EUR').assertPositive(),
      (err: unknown) =>
        err instanceof Iso20022WireError &&
        err.code === 'ERR_ZERO_AMOUNT_FORBIDDEN',
    );
  });
});
