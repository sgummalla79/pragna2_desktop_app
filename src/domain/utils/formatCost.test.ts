import { describe, it, expect } from 'vitest';
import { formatUsd, formatCostPerMillion } from './formatCost';

describe('formatUsd', () => {
  it('renders $0.00 for zero, NaN, and non-finite input', () => {
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd('0')).toBe('$0.00');
    expect(formatUsd(Number.NaN)).toBe('$0.00');
    expect(formatUsd('not-a-number')).toBe('$0.00');
    expect(formatUsd(Infinity)).toBe('$0.00');
  });

  it('uses 6 decimals for sub-milli-dollar amounts (< 0.001)', () => {
    expect(formatUsd(0.0000123)).toBe('$0.000012');
    expect(formatUsd('0.00000005')).toBe('$0.000000');
  });

  it('uses 4 decimals for sub-dollar amounts in [0.001, 1)', () => {
    expect(formatUsd(0.0042)).toBe('$0.0042');
    expect(formatUsd(0.5)).toBe('$0.5000');
    expect(formatUsd('0.001')).toBe('$0.0010');
  });

  it('uses 2 decimals for amounts >= 1', () => {
    expect(formatUsd(1)).toBe('$1.00');
    expect(formatUsd(1.5)).toBe('$1.50');
    expect(formatUsd('1234.5')).toBe('$1234.50');
  });

  it('accepts both string and number input equivalently', () => {
    expect(formatUsd('0.0042')).toBe(formatUsd(0.0042));
  });
});

describe('formatCostPerMillion', () => {
  it('returns the zero label for zero / invalid input', () => {
    expect(formatCostPerMillion(0)).toBe('$0.00 / 1M tokens');
    expect(formatCostPerMillion('bad')).toBe('$0.00 / 1M tokens');
  });

  it('multiplies a per-token cost by 1M and formats it', () => {
    // 0.000003/token → $3.00 / 1M
    expect(formatCostPerMillion(0.000003)).toBe('$3.00 / 1M tokens');
    expect(formatCostPerMillion('0.0000005')).toBe('$0.5000 / 1M tokens');
  });
});
