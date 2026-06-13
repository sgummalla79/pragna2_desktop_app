import { describe, it, expect } from 'vitest';
import {
  parseCompat,
  formatCompat,
  compareCompat,
  isAtLeast,
} from '@/infrastructure/versioning/compat';

describe('version compat helpers', () => {
  it('parseCompat extracts major.minor, ignoring patch/build/junk', () => {
    expect(parseCompat('1.2.5')).toEqual([1, 2]);
    expect(parseCompat('1.2')).toEqual([1, 2]);
    expect(parseCompat('1')).toEqual([1, 0]);
    expect(parseCompat('10.34.7')).toEqual([10, 34]);
    expect(parseCompat('1.2.5-rc1')).toEqual([1, 2]);
    expect(parseCompat('1.4rc2.0')).toEqual([1, 4]);
    expect(parseCompat('')).toEqual([0, 0]);
    expect(parseCompat('garbage')).toEqual([0, 0]);
  });

  it('formatCompat renders the major.minor string', () => {
    expect(formatCompat([1, 2])).toBe('1.2');
    expect(formatCompat(parseCompat('3.7.9'))).toBe('3.7');
  });

  it('compareCompat orders by major then minor; patch ignored', () => {
    expect(compareCompat(parseCompat('1.2.0'), parseCompat('1.1.9'))).toBeGreaterThan(0);
    expect(compareCompat(parseCompat('2.0.0'), parseCompat('1.9.9'))).toBeGreaterThan(0);
    expect(compareCompat(parseCompat('1.0.5'), parseCompat('1.0.0'))).toBe(0);
  });

  it('isAtLeast compares a client compat against a floor', () => {
    expect(isAtLeast(parseCompat('1.0.0'), [1, 0])).toBe(true); // at floor
    expect(isAtLeast(parseCompat('1.2.0'), [1, 0])).toBe(true); // above
    expect(isAtLeast(parseCompat('0.9.9'), [1, 0])).toBe(false); // below
    expect(isAtLeast(parseCompat('1.0.5'), [1, 1])).toBe(false); // same major, lower minor
    expect(isAtLeast(parseCompat('2.0.0'), [1, 5])).toBe(true); // higher major
  });
});
