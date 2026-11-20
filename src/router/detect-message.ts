import { parseCamt053Xml } from '../camt053/parser.js';
import type { Camt053Document } from '../camt053/types.js';
import { Iso20022WireError } from '../errors/wire-error.js';
import { parsePacs002Xml } from '../pacs002/parser.js';
import type { Pacs002Document } from '../pacs002/types.js';
import {
  parseAppHdrXml,
  type BusinessApplicationHeader,
} from '../pacs008/bah-header.js';
import { parsePacs008Xml } from '../pacs008/parser.js';
import type { Pacs008Document } from '../pacs008/types.js';
import { parsePain001Xml } from '../pain001/parser.js';
import type { Pain001Document } from '../pain001/types.js';
import { parseSafeXml } from '../xml/tokenizer.js';

export type Iso20022MessageKind =
  | 'pain.001'
  | 'pacs.008'
  | 'camt.053'
  | 'pacs.002'
  | 'head.001';

export type ParsedIso20022Envelope =
  | { readonly kind: 'pain.001'; readonly document: Pain001Document }
  | { readonly kind: 'pacs.008'; readonly document: Pacs008Document }
  | { readonly kind: 'camt.053'; readonly document: Camt053Document }
  | { readonly kind: 'pacs.002'; readonly document: Pacs002Document }
  | { readonly kind: 'head.001'; readonly header: BusinessApplicationHeader };

export function detectIso20022MessageType(xml: string): Iso20022MessageKind {
  const root = parseSafeXml(xml);

  if (root.name === 'AppHdr') {
    return 'head.001';
  }

  if (root.name !== 'Document') {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Unrecognized ISO 20022 root element <${root.name}>`,
      root.name,
    );
  }

  const firstChild = root.children[0];
  if (firstChild === undefined) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Empty ISO 20022 <Document> envelope',
      'Document',
    );
  }

  switch (firstChild.name) {
    case 'CstmrCdtTrfInitn':
      return 'pain.001';
    case 'FIToFICstmrCdtTrf':
      return 'pacs.008';
    case 'BkToCstmrStmt':
      return 'camt.053';
    case 'FIToFIPmtStsRpt':
      return 'pacs.002';
    default:
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        `Unsupported ISO 20022 message body <${firstChild.name}>`,
        `Document.${firstChild.name}`,
      );
  }
}

export function parseAnyIso20022Xml(xml: string): ParsedIso20022Envelope {
  const kind = detectIso20022MessageType(xml);
  switch (kind) {
    case 'pain.001':
      return { kind, document: parsePain001Xml(xml) };
    case 'pacs.008':
      return { kind, document: parsePacs008Xml(xml) };
    case 'camt.053':
      return { kind, document: parseCamt053Xml(xml) };
    case 'pacs.002':
      return { kind, document: parsePacs002Xml(xml) };
    case 'head.001':
      return { kind, header: parseAppHdrXml(xml) };
  }
}
