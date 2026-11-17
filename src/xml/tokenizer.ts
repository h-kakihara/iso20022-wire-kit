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

function stripNamespace(rawName: string): string {
  const idx = rawName.indexOf(':');
  return idx >= 0 ? rawName.slice(idx + 1) : rawName;
}

function parseAttributes(attrChunk: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([A-Za-z_][\w:.-]*)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null = attrRegex.exec(attrChunk);
  while (match !== null) {
    const rawKey = match[1];
    const rawVal = match[2];
    if (rawKey !== undefined && rawVal !== undefined) {
      attrs[stripNamespace(rawKey)] = unescapeXmlText(rawVal);
    }
    match = attrRegex.exec(attrChunk);
  }
  return attrs;
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
  const cleaned = xml
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  const tokenRegex = /<(\/?)([A-Za-z_][\w:.-]*)([^>]*?)(\/?)>|([^<]+)/g;
  const stack: MutableXmlNode[] = [];
  let root: MutableXmlNode | undefined;

  let match: RegExpExecArray | null = tokenRegex.exec(cleaned);
  while (match !== null) {
    const isClosing = match[1] === '/';
    const rawTagName = match[2];
    const attrChunk = match[3] ?? '';
    const isSelfClosing = match[4] === '/';
    const textChunk = match[5];

    if (textChunk !== undefined) {
      const current = stack[stack.length - 1];
      if (current !== undefined) {
        current.textParts.push(textChunk);
      }
    } else if (rawTagName !== undefined) {
      const localName = stripNamespace(rawTagName);
      if (isClosing) {
        const popped = stack.pop();
        if (popped === undefined || popped.name !== localName) {
          throw new Iso20022WireError(
            'ERR_SCHEMA_VIOLATION',
            `Mismatched closing XML tag </${localName}>`,
          );
        }
      } else {
        const node: MutableXmlNode = {
          name: localName,
          attributes: parseAttributes(attrChunk),
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
    }
    match = tokenRegex.exec(cleaned);
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
