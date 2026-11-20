import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  Iso20022WireError,
  assertSwiftText,
  validateIsoDate,
  validateIsoDateTime,
  validateReferenceId,
} from '../index.js';

describe('SWIFT CBPR+ character set, T26 slash rules, and ISO 8601 dates', () => {
  it('accepts valid SWIFT X-charset references and blocks T26 slash violations', () => {
    assert.equal(validateReferenceId('PAY-2026/INV-0091'), 'PAY-2026/INV-0091');
    assert.equal(assertSwiftText("Kakihara Corp (US) + Co.", 70), "Kakihara Corp (US) + Co.");

    for (const invalidRef of ['/LEADING', 'TRAILING/', 'DOUBLE//SLASH', 'EMOJI🚀']) {
      assert.throws(
        () => validateReferenceId(invalidRef),
        (err: unknown) =>
          err instanceof Iso20022WireError &&
          err.code === 'ERR_INVALID_END_TO_END_ID',
      );
    }
  });

  it('validates leap years and mandatory UTC timezone offsets', () => {
    assert.equal(validateIsoDate('2024-02-29'), '2024-02-29');
    assert.equal(
      validateIsoDateTime('2026-11-20T14:30:00.125Z'),
      '2026-11-20T14:30:00.125Z',
    );
    assert.equal(
      validateIsoDateTime('2026-11-20T09:30:00-05:00'),
      '2026-11-20T09:30:00-05:00',
    );

    assert.throws(
      () => validateIsoDate('2025-02-29'),
      (err: unknown) =>
        err instanceof Iso20022WireError && err.code === 'ERR_SCHEMA_VIOLATION',
    );

    assert.throws(
      () => validateIsoDateTime('2026-11-20T14:30:00'),
      (err: unknown) =>
        err instanceof Iso20022WireError && err.code === 'ERR_SCHEMA_VIOLATION',
    );
  });
});
