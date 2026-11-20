import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Iso20022WireError, parseBic, validateLei } from '../index.js';

describe('ISO 9362 BIC and ISO 17442 LEI institutional validators', () => {
  it('parses BIC8 and BIC11 identifiers and flags test BICs', () => {
    const live = parseBic('deutdeff');
    assert.equal(live.bic8, 'DEUTDEFF');
    assert.equal(live.bic11, 'DEUTDEFFXXX');
    assert.equal(live.countryCode, 'DE');
    assert.equal(live.isTestBic, false);

    const branch = parseBic('CHASUS33ARP');
    assert.equal(branch.branchCode, 'ARP');
    assert.equal(branch.bic11, 'CHASUS33ARP');

    const sandbox = parseBic('DEUTDEF0XXX');
    assert.equal(sandbox.isTestBic, true);
  });

  it('rejects malformed BIC lengths and forbidden location characters', () => {
    assert.throws(
      () => parseBic('DEUTDE1F'),
      (err: unknown) =>
        err instanceof Iso20022WireError && err.code === 'ERR_INVALID_BIC',
    );
    assert.throws(
      () => parseBic('DEUTDEFO'),
      (err: unknown) =>
        err instanceof Iso20022WireError && err.code === 'ERR_INVALID_BIC',
    );
  });

  it('verifies 20-character LEI MOD-97-10 check digits', () => {
    assert.equal(
      validateLei('5493001kjtiigc8y1r12'),
      '5493001KJTIIGC8Y1R12',
    );

    assert.throws(
      () => validateLei('5493001KJTIIGC8Y1R13'),
      (err: unknown) =>
        err instanceof Iso20022WireError && err.code === 'ERR_SCHEMA_VIOLATION',
    );
  });
});
