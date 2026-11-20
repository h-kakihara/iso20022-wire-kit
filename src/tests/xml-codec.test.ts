import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  Iso20022WireError,
  XmlWriter,
  findChild,
  parseSafeXml,
  requireChildText,
} from '../index.js';

describe('Zero-dependency XmlWriter and namespace-tolerant XML parser', () => {
  it('enforces balanced closing tags during serialization', () => {
    const writer = new XmlWriter();
    writer.openTag('Document', { xmlns: 'urn:test' });
    writer.leafTag('MsgId', 'MSG-01 & <TEST>');

    assert.throws(
      () => writer.closeTag('WrongTag'),
      (err: unknown) =>
        err instanceof Iso20022WireError && err.code === 'ERR_SCHEMA_VIOLATION',
    );
  });

  it('parses namespace-prefixed ISO 20022 elements into local names', () => {
    const prefixedXml = `<?xml version="1.0" encoding="UTF-8"?>
<ns2:Document xmlns:ns2="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09">
  <!-- Bank gateway comment -->
  <ns2:GrpHdr>
    <ns2:MsgId>WIRE-9001</ns2:MsgId>
    <ns2:Amt ns2:Ccy="EUR">125.50</ns2:Amt>
  </ns2:GrpHdr>
</ns2:Document>`;

    const root = parseSafeXml(prefixedXml);
    assert.equal(root.name, 'Document');
    const hdr = findChild(root, 'GrpHdr');
    assert(hdr !== undefined);
    assert.equal(requireChildText(hdr, 'MsgId', 'GrpHdr.MsgId'), 'WIRE-9001');
    const amt = findChild(hdr, 'Amt');
    assert(amt !== undefined);
    assert.equal(amt.attributes['Ccy'], 'EUR');
    assert.equal(amt.text, '125.50');
  });
});
