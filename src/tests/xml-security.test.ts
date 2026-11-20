import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  Iso20022WireError,
  escapeXmlText,
  inspectXmlSafety,
  unescapeXmlText,
} from '../index.js';

describe('XML XXE firewall, DoS depth guard, and injection escaping', () => {
  it('blocks DOCTYPE and ENTITY declarations against XXE and Billion Laughs', () => {
    const xxePayload = `<?xml version="1.0"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<Document>&xxe;</Document>`;

    assert.throws(
      () => inspectXmlSafety(xxePayload),
      (err: unknown) =>
        err instanceof Iso20022WireError &&
        err.code === 'ERR_XXE_OR_DOCTYPE_DETECTED',
    );
  });

  it('rejects null bytes, oversized payloads, and excessive tag nesting', () => {
    assert.throws(
      () => inspectXmlSafety('<Document>\0</Document>'),
      (err: unknown) =>
        err instanceof Iso20022WireError && err.code === 'ERR_SCHEMA_VIOLATION',
    );

    assert.throws(
      () => inspectXmlSafety('<Document>1234567890</Document>', { maxPayloadBytes: 10 }),
      (err: unknown) =>
        err instanceof Iso20022WireError && err.code === 'ERR_SCHEMA_VIOLATION',
    );

    const deepXml = `${'<a>'.repeat(10)}ok${'</a>'.repeat(10)}`;
    assert.throws(
      () => inspectXmlSafety(deepXml, { maxElementDepth: 5 }),
      (err: unknown) =>
        err instanceof Iso20022WireError && err.code === 'ERR_XML_DEPTH_EXCEEDED',
    );
  });

  it('prevents double-unescaping of nested ampersand sequences', () => {
    const malicious = '&amp;lt;CtrlSum&amp;gt;999999.00&amp;lt;/CtrlSum&amp;gt;';
    const unescaped = unescapeXmlText(malicious);
    assert.equal(unescaped, '&lt;CtrlSum&gt;999999.00&lt;/CtrlSum&gt;');
    assert.equal(escapeXmlText(unescaped), malicious);
  });
});
