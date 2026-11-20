import { Iso20022WireError } from '../errors/wire-error.js';

export interface XmlSecurityLimits {
  readonly maxPayloadBytes?: number;
  readonly maxElementDepth?: number;
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_DEPTH = 32;

function findClosingAngleBracket(xml: string, startIndex: number): number {
  let activeQuote = 0;
  for (let i = startIndex; i < xml.length; i += 1) {
    const code = xml.charCodeAt(i);
    if (activeQuote !== 0) {
      if (code === activeQuote) {
        activeQuote = 0;
      }
    } else if (code === 34 || code === 39) {
      activeQuote = code;
    } else if (code === 62) {
      return i;
    } else if (code === 60) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        'Unescaped < character inside XML tag declaration',
      );
    }
  }
  return -1;
}

export function inspectXmlSafety(xml: string, limits?: XmlSecurityLimits): void {
  const maxBytes = limits?.maxPayloadBytes ?? DEFAULT_MAX_BYTES;
  const maxDepth = limits?.maxElementDepth ?? DEFAULT_MAX_DEPTH;

  if (Buffer.byteLength(xml, 'utf8') > maxBytes) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `XML payload exceeds maximum allowed size of ${maxBytes} bytes`,
    );
  }

  if (xml.includes('\0')) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Null byte detected in financial XML stream',
    );
  }

  let depth = 0;
  let cursor = 0;
  const length = xml.length;

  while (cursor < length) {
    const lt = xml.indexOf('<', cursor);
    if (lt === -1) {
      break;
    }

    if (lt + 1 >= length) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        'Trailing < character at end of XML payload',
      );
    }

    const secondCode = xml.charCodeAt(lt + 1);

    if (secondCode === 33) {
      if (xml.startsWith('<!--', lt)) {
        const commentEnd = xml.indexOf('-->', lt + 4);
        if (commentEnd === -1) {
          throw new Iso20022WireError(
            'ERR_SCHEMA_VIOLATION',
            'Unterminated XML comment block',
          );
        }
        cursor = commentEnd + 3;
        continue;
      }

      throw new Iso20022WireError(
        'ERR_XXE_OR_DOCTYPE_DETECTED',
        'DOCTYPE and ENTITY declarations are strictly forbidden in ISO 20022 payloads',
      );
    }

    if (secondCode === 63) {
      const piEnd = xml.indexOf('?>', lt + 2);
      if (piEnd === -1) {
        throw new Iso20022WireError(
          'ERR_SCHEMA_VIOLATION',
          'Unterminated XML processing instruction',
        );
      }
      cursor = piEnd + 2;
      continue;
    }

    const gt = findClosingAngleBracket(xml, lt + 1);
    if (gt === -1) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        'Unterminated XML element tag',
      );
    }

    if (secondCode === 47) {
      depth = Math.max(0, depth - 1);
    } else if (xml.charCodeAt(gt - 1) !== 47) {
      depth += 1;
      if (depth > maxDepth) {
        throw new Iso20022WireError(
          'ERR_XML_DEPTH_EXCEEDED',
          `XML element nesting exceeds maximum permitted depth of ${maxDepth}`,
        );
      }
    }

    cursor = gt + 1;
  }
}
