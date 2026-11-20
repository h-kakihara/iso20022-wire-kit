import { Iso20022WireError } from '../errors/wire-error.js';
import { unescapeXmlText } from './escape.js';
import { inspectXmlSafety } from './security-guard.js';

export interface XmlNode {
  readonly name: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly text: string;
  readonly children: readonly XmlNode[];
}

interface MutableXmlNode {
  name: string;
  attributes: Record<string, string>;
  textParts: string[];
  children: MutableXmlNode[];
}

function isWhitespaceCode(code: number): boolean {
  return code === 32 || code === 9 || code === 10 || code === 13;
}

function isNameStartCode(code: number): boolean {
  return (
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    code === 95
  );
}

function isNameBodyCode(code: number): boolean {
  return (
    isNameStartCode(code) ||
    (code >= 48 && code <= 57) ||
    code === 58 ||
    code === 46 ||
    code === 45
  );
}

function stripNamespace(rawName: string): string {
  const idx = rawName.indexOf(':');
  return idx >= 0 ? rawName.slice(idx + 1) : rawName;
}

function parseAttributesLinear(attrChunk: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const len = attrChunk.length;
  let pos = 0;

  while (pos < len) {
    while (pos < len && isWhitespaceCode(attrChunk.charCodeAt(pos))) {
      pos += 1;
    }
    if (pos >= len) {
      break;
    }

    if (!isNameStartCode(attrChunk.charCodeAt(pos))) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        'Invalid XML attribute name syntax',
      );
    }

    const nameStart = pos;
    pos += 1;
    while (pos < len && isNameBodyCode(attrChunk.charCodeAt(pos))) {
      pos += 1;
    }
    const rawKey = attrChunk.slice(nameStart, pos);

    while (pos < len && isWhitespaceCode(attrChunk.charCodeAt(pos))) {
      pos += 1;
    }
    if (pos >= len || attrChunk.charCodeAt(pos) !== 61) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        `Missing "=" after XML attribute "${rawKey}"`,
      );
    }
    pos += 1;

    while (pos < len && isWhitespaceCode(attrChunk.charCodeAt(pos))) {
      pos += 1;
    }
    const quoteCode = attrChunk.charCodeAt(pos);
    if (pos >= len || (quoteCode !== 34 && quoteCode !== 39)) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        `Missing opening quote for XML attribute "${rawKey}"`,
      );
    }
    const quoteChar = quoteCode === 34 ? '"' : "'";
    pos += 1;

    const valEnd = attrChunk.indexOf(quoteChar, pos);
    if (valEnd === -1) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        `Unterminated value for XML attribute "${rawKey}"`,
      );
    }

    attrs[stripNamespace(rawKey)] = unescapeXmlText(attrChunk.slice(pos, valEnd));
    pos = valEnd + 1;
  }

  return attrs;
}

function findTagEndIndex(xml: string, startIndex: number): number {
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
        'Unexpected < inside XML tag',
      );
    }
  }
  return -1;
}

function freezeNode(node: MutableXmlNode): XmlNode {
  return {
    name: node.name,
    attributes: node.attributes,
    text: unescapeXmlText(node.textParts.join('').trim()),
    children: node.children.map(freezeNode),
  };
}

export function parseSafeXml(xml: string): XmlNode {
  inspectXmlSafety(xml);

  const stack: MutableXmlNode[] = [];
  let root: MutableXmlNode | undefined;
  let cursor = 0;
  const totalLen = xml.length;

  while (cursor < totalLen) {
    const lt = xml.indexOf('<', cursor);
    if (lt === -1) {
      const trailing = xml.slice(cursor);
      const current = stack[stack.length - 1];
      if (current !== undefined) {
        current.textParts.push(trailing);
      } else if (trailing.trim().length > 0) {
        throw new Iso20022WireError(
          'ERR_SCHEMA_VIOLATION',
          'Unexpected trailing characters outside XML root element',
        );
      }
      break;
    }

    if (lt > cursor) {
      const textChunk = xml.slice(cursor, lt);
      const current = stack[stack.length - 1];
      if (current !== undefined) {
        current.textParts.push(textChunk);
      } else if (textChunk.trim().length > 0) {
        throw new Iso20022WireError(
          'ERR_SCHEMA_VIOLATION',
          'Unexpected text outside XML root element',
        );
      }
    }

    if (xml.startsWith('<!--', lt)) {
      const commentEnd = xml.indexOf('-->', lt + 4);
      if (commentEnd === -1) {
        throw new Iso20022WireError(
          'ERR_SCHEMA_VIOLATION',
          'Unterminated XML comment',
        );
      }
      cursor = commentEnd + 3;
      continue;
    }

    if (xml.startsWith('<?', lt)) {
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

    if (xml.startsWith('<!', lt)) {
      throw new Iso20022WireError(
        'ERR_XXE_OR_DOCTYPE_DETECTED',
        'DOCTYPE and ENTITY declarations are strictly forbidden in ISO 20022 payloads',
      );
    }

    const gt = findTagEndIndex(xml, lt + 1);
    if (gt === -1) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        'Unterminated XML element tag',
      );
    }

    const rawInside = xml.slice(lt + 1, gt);
    if (rawInside.startsWith('/')) {
      const closeRaw = rawInside.slice(1).trim();
      if (closeRaw.length === 0) {
        throw new Iso20022WireError(
          'ERR_SCHEMA_VIOLATION',
          'Empty closing XML tag',
        );
      }
      const localClose = stripNamespace(closeRaw);
      const popped = stack.pop();
      if (popped === undefined || popped.name !== localClose) {
        throw new Iso20022WireError(
          'ERR_SCHEMA_VIOLATION',
          `Mismatched closing XML tag </${localClose}>`,
        );
      }
    } else {
      const isSelfClosing = rawInside.endsWith('/');
      const tagBody = isSelfClosing ? rawInside.slice(0, -1) : rawInside;

      if (tagBody.length === 0 || !isNameStartCode(tagBody.charCodeAt(0))) {
        throw new Iso20022WireError(
          'ERR_SCHEMA_VIOLATION',
          'Malformed opening XML element name',
        );
      }

      let nameEnd = 1;
      while (nameEnd < tagBody.length && isNameBodyCode(tagBody.charCodeAt(nameEnd))) {
        nameEnd += 1;
      }

      const rawTagName = tagBody.slice(0, nameEnd);
      const attrChunk = tagBody.slice(nameEnd);
      if (attrChunk.length > 0 && !isWhitespaceCode(attrChunk.charCodeAt(0))) {
        throw new Iso20022WireError(
          'ERR_SCHEMA_VIOLATION',
          `Unexpected character after XML tag name "${rawTagName}"`,
        );
      }

      const node: MutableXmlNode = {
        name: stripNamespace(rawTagName),
        attributes: parseAttributesLinear(attrChunk),
        textParts: [],
        children: [],
      };

      const parent = stack[stack.length - 1];
      if (parent !== undefined) {
        parent.children.push(node);
      } else if (root === undefined) {
        root = node;
      } else {
        throw new Iso20022WireError(
          'ERR_SCHEMA_VIOLATION',
          'Multiple XML root elements are not allowed',
        );
      }

      if (!isSelfClosing) {
        stack.push(node);
      }
    }

    cursor = gt + 1;
  }

  if (root === undefined || stack.length > 0) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      'Incomplete or empty ISO 20022 XML document',
    );
  }

  return freezeNode(root);
}

export function findChild(parent: XmlNode, name: string): XmlNode | undefined {
  return parent.children.find((child) => child.name === name);
}

export function findChildren(parent: XmlNode, name: string): readonly XmlNode[] {
  return parent.children.filter((child) => child.name === name);
}

export function requireChildText(parent: XmlNode, name: string, fieldPath: string): string {
  const child = findChild(parent, name);
  if (child === undefined || child.text.length === 0) {
    throw new Iso20022WireError(
      'ERR_SCHEMA_VIOLATION',
      `Missing mandatory ISO 20022 element <${name}>`,
      fieldPath,
    );
  }
  return child.text;
}
