import { describe, it, expect } from 'vitest';
import { relativeTime } from './relativeTime';

const NOW = new Date('2026-06-10T12:00:00.000Z').getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

describe('relativeTime', () => {
  it('clamps sub-minute (and future) diffs to "1 minute ago"', () => {
    expect(relativeTime(ago(5_000), NOW)).toBe('1 minute ago');
    expect(relativeTime(ago(-10_000), NOW)).toBe('1 minute ago'); // clock skew → future
  });

  it('renders minutes with correct pluralisation', () => {
    expect(relativeTime(ago(MIN), NOW)).toBe('1 minute ago');
    expect(relativeTime(ago(10 * MIN), NOW)).toBe('10 minutes ago');
  });

  it('renders hours with correct pluralisation', () => {
    expect(relativeTime(ago(HOUR), NOW)).toBe('1 hour ago');
    expect(relativeTime(ago(5 * HOUR), NOW)).toBe('5 hours ago');
  });

  it('renders "yesterday" then "N days ago"', () => {
    expect(relativeTime(ago(DAY), NOW)).toBe('yesterday');
    expect(relativeTime(ago(5 * DAY), NOW)).toBe('5 days ago');
    expect(relativeTime(ago(29 * DAY), NOW)).toBe('29 days ago');
  });

  it('switches to an absolute date past the 30-day cutoff', () => {
    const result = relativeTime(ago(40 * DAY), NOW);
    expect(result).not.toMatch(/ago|yesterday/);
    // toLocaleDateString output varies by env; assert it carries the year.
    expect(result).toMatch(/2026/);
  });
});
