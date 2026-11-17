import { Iso20022WireError } from '../errors/wire-error.js';
import { escapeXmlText } from './escape.js';

export type XmlAttributes = Readonly<Record<string, string | undefined>>;

export class XmlWriter {
  private readonly lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
  private readonly tagStack: string[] = [];

  public openTag(name: string, attrs?: XmlAttributes): this {
    const indent = '  '.repeat(this.tagStack.length);
    this.lines.push(`${indent}<${name}${this.serializeAttrs(attrs)}>`);
    this.tagStack.push(name);
    return this;
  }

  public leafTag(name: string, textValue: string, attrs?: XmlAttributes): this {
    const indent = '  '.repeat(this.tagStack.length);
    const escaped = escapeXmlText(textValue);
    this.lines.push(`${indent}<${name}${this.serializeAttrs(attrs)}>${escaped}</${name}>`);
    return this;
  }

  public closeTag(expectedName: string): this {
    const actual = this.tagStack.pop();
    if (actual !== expectedName) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        `Unbalanced XML tag close: expected </${expectedName}>, found open <${actual ?? 'none'}>`,
      );
    }
    const indent = '  '.repeat(this.tagStack.length);
    this.lines.push(`${indent}</${expectedName}>`);
    return this;
  }

  public toXmlString(): string {
    if (this.tagStack.length > 0) {
      throw new Iso20022WireError(
        'ERR_SCHEMA_VIOLATION',
        `Unclosed XML elements remaining on stack: ${this.tagStack.join(' > ')}`,
      );
    }
    return `${this.lines.join('\n')}\n`;
  }

  private serializeAttrs(attrs?: XmlAttributes): string {
    if (attrs === undefined) {
      return '';
    }
    const segments: string[] = [];
    for (const [key, val] of Object.entries(attrs)) {
      if (val !== undefined) {
        segments.push(` ${key}="${escapeXmlText(val)}"`);
      }
    }
    return segments.join('');
  }
}
