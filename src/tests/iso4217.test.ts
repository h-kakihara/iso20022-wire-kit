import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  Iso20022WireError,
  formatMinorUnits,
  resolveCurrency,
} from '../index.js';

describe('ISO 4217 currency registry and minor-unit formatting', () => {
  it('resolves 0, 2, 3, and 4 decimal settlement currencies accurately', () => {
    assert.equal(resolveCurrency('jpy').minorUnits, 0);
    assert.equal(resolveCurrency('EUR').minorUnits, 2);
    assert.equal(resolveCurrency('kwd').minorUnits, 3);
    assert.equal(resolveCurrency('CLF').minorUnits, 4);
  });

  it('formats bigint minor units without floating-point rounding drift', () => {
    assert.equal(formatMinorUnits(0n, 'EUR'), '0.00');
    assert.equal(formatMinorUnits(5n, 'USD'), '0.05');
    assert.equal(formatMinorUnits(123456789n, 'EUR'), '1234567.89');
    assert.equal(formatMinorUnits(50000n, 'JPY'), '50000');
    assert.equal(formatMinorUnits(1250n, 'KWD'), '1.250');
    assert.equal(formatMinorUnits(99n, 'CLF'), '0.0099');
  });

  it('rejects unknown ISO 4217 codes and negative minor amounts', () => {
    assert.throws(
      () => resolveCurrency('BTC', 'Amt.Ccy'),
      (err: unknown) =>
        err instanceof Iso20022WireError && err.code === 'ERR_INVALID_CURRENCY',
    );

    assert.throws(
      () => formatMinorUnits(-1n, 'USD', 'Amt'),
      (err: unknown) =>
        err instanceof Iso20022WireError && err.code === 'ERR_NEGATIVE_AMOUNT',
    );
  });
});
