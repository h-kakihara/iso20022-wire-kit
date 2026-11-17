import { Iso20022WireError } from '../errors/wire-error.js';

export interface XmlSecurityLimits {
  readonly maxPayloadBytes?: number;
  readonly maxElementDepth?: number;
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_DEPTH = 32;

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

  if (/<!(?:DOCTYPE|ENTITY)\b/i.test(xml)) {
    throw new Iso20022WireError(
      'ERR_XXE_OR_DOCTYPE_DETECTED',
      'DOCTYPE and ENTITY declarations are strictly forbidden in ISO 20022 payloads',
    );
  }

  let depth = 0;
  const tagRegex = /<\/?([A-Za-z_][\w:.-]*)[^>]*?>/g;
  let match: RegExpExecArray | null = tagRegex.exec(xml);
  while (match !== null) {
    const fullTag = match[0];
    if (!fullTag.startsWith('<?') && !fullTag.startsWith('<!')) {
      if (fullTag.startsWith('</')) {
        depth = Math.max(0, depth - 1);
      } else if (!fullTag.endsWith('/>')) {
        depth += 1;
        if (depth > maxDepth) {
          throw new Iso20022WireError(
            'ERR_XML_DEPTH_EXCEEDED',
            `XML element nesting exceeds maximum permitted depth of ${maxDepth}`,
          );
        }
      }
    }
    match = tagRegex.exec(xml);
  }
}
