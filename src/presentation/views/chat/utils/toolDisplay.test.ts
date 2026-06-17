import { describe, it, expect } from 'vitest';
import {
  toolDisplayLabel,
  toolArgSummary,
  humanizeArgKey,
  formatToolArgValue,
  toolArgEntries,
} from './toolDisplay';

describe('toolDisplayLabel', () => {
  it('humanizes an MCP tool name and collapses the duplicate connector word', () => {
    expect(toolDisplayLabel('mcp_tavily_tavily_search')).toBe('Tavily Search');
  });

  it('humanizes a plain MCP tool without duplicates', () => {
    expect(toolDisplayLabel('mcp_github_create_issue')).toBe('Github Create Issue');
  });

  it('uses a curated label when one exists', () => {
    expect(toolDisplayLabel('ask_user')).toBe('Asking for input');
  });

  it('humanizes a non-MCP tool name', () => {
    expect(toolDisplayLabel('summarize_document')).toBe('Summarize Document');
  });

  it('falls back to the raw name when there are no usable words', () => {
    expect(toolDisplayLabel('___')).toBe('___');
  });
});

describe('toolArgSummary', () => {
  it('returns the first non-empty string argument', () => {
    expect(
      toolArgSummary({ query: 'current trends in AI 2024', max_results: 5 }),
    ).toBe('current trends in AI 2024');
  });

  it('collapses whitespace', () => {
    expect(toolArgSummary({ q: '  a   b  ' })).toBe('a b');
  });

  it('ellipsises a long value', () => {
    const long = 'x'.repeat(100);
    const out = toolArgSummary({ q: long });
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThan(long.length);
  });

  it('skips non-string and empty values', () => {
    expect(toolArgSummary({ n: 5, ok: true, q: '   ' })).toBe('');
  });

  it('returns empty string when args are undefined', () => {
    expect(toolArgSummary(undefined)).toBe('');
  });
});

describe('humanizeArgKey', () => {
  it('turns snake_case into a sentence-cased label', () => {
    expect(humanizeArgKey('time_range')).toBe('Time range');
    expect(humanizeArgKey('max_results')).toBe('Max results');
  });
});

describe('formatToolArgValue', () => {
  it('shows primitives directly', () => {
    expect(formatToolArgValue('hello')).toBe('hello');
    expect(formatToolArgValue(5)).toBe('5');
    expect(formatToolArgValue(true)).toBe('true');
  });

  it('summarizes arrays and objects by count — never raw JSON', () => {
    expect(formatToolArgValue([1, 2, 3])).toBe('3 items');
    expect(formatToolArgValue(['x'])).toBe('1 item');
    expect(formatToolArgValue({ a: 1, b: 2 })).toBe('2 fields');
    expect(formatToolArgValue({ a: 1 })).toBe('1 field');
  });

  it('renders null/undefined as an em dash', () => {
    expect(formatToolArgValue(null)).toBe('—');
    expect(formatToolArgValue(undefined)).toBe('—');
  });
});

describe('toolArgEntries', () => {
  it('builds humanized, readable entries (no raw JSON)', () => {
    const entries = toolArgEntries({
      query: 'AI trends',
      time_range: 'month',
      max_results: 5,
      include_domains: ['a.com', 'b.com'],
    });
    expect(entries).toEqual([
      { key: 'Query', value: 'AI trends' },
      { key: 'Time range', value: 'month' },
      { key: 'Max results', value: '5' },
      { key: 'Include domains', value: '2 items' },
    ]);
  });

  it('returns an empty list when args are undefined', () => {
    expect(toolArgEntries(undefined)).toEqual([]);
  });
});
