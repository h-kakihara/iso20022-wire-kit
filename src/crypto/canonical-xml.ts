import { escapeXmlText } from '../xml/escape.js';
import { parseSafeXml, type XmlNode } from '../xml/tokenizer.js';

function renderCanonicalNode(node: XmlNode): string {
  const sortedKeys = Object.keys(node.attributes).sort();
  let attrSegment = '';
  for (const key of sortedKeys) {
    const val = node.attributes[key];
    if (val !== undefined) {
      attrSegment += ` ${key}="${escapeXmlText(val)}"`;
    }
  }

  let innerContent = '';
  if (node.children.length > 0) {
    for (const child of node.children) {
      innerContent += renderCanonicalNode(child);
    }
  } else if (node.text.length > 0) {
    innerContent = escapeXmlText(node.text);
  }

  return `<${node.name}${attrSegment}>${innerContent}</${node.name}>`;
}

export function canonicalizeIsoXml(xml: string): string {
  const root = parseSafeXml(xml);
  return renderCanonicalNode(root);
}
