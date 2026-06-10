import { describe, it, expect } from 'vitest';
import { slugify } from './slugify';

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('OAuth Flow')).toBe('oauth-flow');
    expect(slugify('My Cool Agent')).toBe('my-cool-agent');
  });

  it('collapses runs of non-alphanumerics to a single hyphen', () => {
    expect(slugify('a   b___c!!!d')).toBe('a-b-c-d');
    expect(slugify('foo.bar.baz')).toBe('foo-bar-baz');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  hello  ')).toBe('hello');
    expect(slugify('!!!edge!!!')).toBe('edge');
  });

  it('preserves digits', () => {
    expect(slugify('Model v2.5')).toBe('model-v2-5');
  });

  it('returns empty string for all-symbol / empty input', () => {
    expect(slugify('')).toBe('');
    expect(slugify('---')).toBe('');
    expect(slugify('!!!')).toBe('');
  });
});
