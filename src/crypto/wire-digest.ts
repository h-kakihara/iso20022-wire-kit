import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { canonicalizeIsoXml } from './canonical-xml.js';

const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/i;

export function computeWireSha256(xml: string): string {
  const canonical = canonicalizeIsoXml(xml);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function verifyWireSha256(xml: string, expectedHexDigest: string): boolean {
  const trimmed = expectedHexDigest.trim();
  if (!SHA256_HEX_REGEX.test(trimmed)) {
    return false;
  }
  const actualBuf = Buffer.from(computeWireSha256(xml), 'hex');
  const expectedBuf = Buffer.from(trimmed.toLowerCase(), 'hex');
  if (actualBuf.length !== expectedBuf.length) {
    return false;
  }
  return timingSafeEqual(actualBuf, expectedBuf);
}

export function computeWireHmacSha256(
  xml: string,
  secretKey: string | Uint8Array,
): string {
  const canonical = canonicalizeIsoXml(xml);
  return createHmac('sha256', secretKey).update(canonical, 'utf8').digest('hex');
}

export function verifyWireHmacSha256(
  xml: string,
  secretKey: string | Uint8Array,
  expectedHexMac: string,
): boolean {
  const trimmed = expectedHexMac.trim();
  if (!SHA256_HEX_REGEX.test(trimmed)) {
    return false;
  }
  const actualBuf = Buffer.from(computeWireHmacSha256(xml, secretKey), 'hex');
  const expectedBuf = Buffer.from(trimmed.toLowerCase(), 'hex');
  if (actualBuf.length !== expectedBuf.length) {
    return false;
  }
  return timingSafeEqual(actualBuf, expectedBuf);
}
