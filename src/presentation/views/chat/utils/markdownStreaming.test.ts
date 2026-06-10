import { describe, it, expect } from 'vitest';
import { normalizeMathDelimiters } from './markdownStreaming';

describe('normalizeMathDelimiters', () => {
  it('returns empty / unchanged input untouched', () => {
    expect(normalizeMathDelimiters('')).toBe('');
    expect(normalizeMathDelimiters('plain text, no math')).toBe('plain text, no math');
  });

  it('converts inline \\( .. \\) → $ .. $', () => {
    expect(normalizeMathDelimiters('a \\(x+1\\) b')).toBe('a $x+1$ b');
  });

  it('converts display \\[ .. \\] → $$ .. $$', () => {
    expect(normalizeMathDelimiters('\\[E=mc^2\\]')).toBe('$$E=mc^2$$');
  });

  it('handles multiple spans in one string', () => {
    expect(normalizeMathDelimiters('\\(a\\) and \\(b\\)')).toBe('$a$ and $b$');
  });

  it('does NOT rewrite delimiters inside an inline code span', () => {
    expect(normalizeMathDelimiters('`\\(x\\)`')).toBe('`\\(x\\)`');
  });

  it('does NOT rewrite delimiters inside a fenced code block', () => {
    const input = '```\n\\[y\\]\n```';
    expect(normalizeMathDelimiters(input)).toBe(input);
  });

  it('rewrites math outside code while preserving code spans verbatim', () => {
    const input = 'use \\(a\\) but not `\\(b\\)`';
    expect(normalizeMathDelimiters(input)).toBe('use $a$ but not `\\(b\\)`');
  });
});
