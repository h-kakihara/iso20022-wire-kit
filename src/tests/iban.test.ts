import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  Iso20022WireError,
  formatIbanPrint,
  validateIban,
} from '../index.js';

describe('ISO 13616 IBAN checksum and SEPA reachability validator', () => {
  it('validates SEPA and non-SEPA IBANs with whitespace normalization', () => {
    const de = validateIban('de89 3704 0044 0532 0130 00');
    assert.equal(de.compact, 'DE89370400440532013000');
    assert.equal(de.countryCode, 'DE');
    assert.equal(de.isSepa, true);

    const nl = validateIban('NL91ABNA0417164300');
    assert.equal(nl.isSepa, true);

    const ae = validateIban('AE070331234567890123456');
    assert.equal(ae.countryCode, 'AE');
    assert.equal(ae.isSepa, false);

    assert.equal(
      formatIbanPrint('GB29NWBK60161331926819'),
      'GB29 NWBK 6016 1331 9268 19',
    );
  });

  it('rejects national length mismatches and MOD-97-10 checksum corruption', () => {
    assert.throws(
      () => validateIban('DE893704004405320130'),
      (err: unknown) =>
        err instanceof Iso20022WireError && err.code === 'ERR_INVALID_IBAN',
    );

    assert.throws(
      () => validateIban('DE88370400440532013000'),
      (err: unknown) =>
        err instanceof Iso20022WireError && err.code === 'ERR_INVALID_IBAN',
    );
  });
});
