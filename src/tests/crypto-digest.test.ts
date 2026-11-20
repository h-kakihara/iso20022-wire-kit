import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canonicalizeIsoXml,
  computeWireHmacSha256,
  computeWireSha256,
  verifyWireHmacSha256,
  verifyWireSha256,
} from '../index.js';

describe('Canonical XML SHA-256 and HMAC-SHA256 anti-tamper digests', () => {
  const xmlFormattedA = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:test" id="1">
  <!-- transport comment -->
  <InstdAmt b="2" Ccy="EUR">100.00</InstdAmt>
</Document>`;

  const xmlFormattedB = `<Document id="1" xmlns="urn:iso:test"><InstdAmt Ccy="EUR" b="2">  100.00  </InstdAmt></Document>`;

  it('produces identical SHA-256 digests across attribute order and whitespace', () => {
    assert.equal(canonicalizeIsoXml(xmlFormattedA), canonicalizeIsoXml(xmlFormattedB));
    const digestA = computeWireSha256(xmlFormattedA);
    assert.equal(verifyWireSha256(xmlFormattedB, digestA), true);
  });

  it('verifies HMAC-SHA256 signatures and rejects payload tampering', () => {
    const secret = 'hsm-signing-key-2026-prod';
    const mac = computeWireHmacSha256(xmlFormattedA, secret);

    assert.equal(verifyWireHmacSha256(xmlFormattedB, secret, mac), true);
    assert.equal(
      verifyWireHmacSha256(
        xmlFormattedB.replace('100.00', '100.01'),
        secret,
        mac,
      ),
      false,
    );
    assert.equal(verifyWireHmacSha256(xmlFormattedB, 'wrong-key', mac), false);
    assert.equal(verifyWireSha256(xmlFormattedA, 'not-a-hex-digest'), false);
  });
});
