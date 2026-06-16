import { describe, it, expect } from 'vitest';
import { extractErrorMessage } from './extractErrorMessage';

describe('extractErrorMessage', () => {
  // CF-014 regression: Tauri invoke() rejects with a plain string, not an Error.
  it('CF-014: returns the string directly when e is a plain string (Tauri Rust error)', () => {
    expect(extractErrorMessage('failed to start MCP server: No such file or directory'))
      .toBe('failed to start MCP server: No such file or directory');
  });

  it('CF-014: trims whitespace from a plain string', () => {
    expect(extractErrorMessage('  keychain error: access denied  '))
      .toBe('keychain error: access denied');
  });

  it('returns Error.message when e is an Error instance', () => {
    expect(extractErrorMessage(new Error('something went wrong')))
      .toBe('something went wrong');
  });

  it('returns fallback for an empty string', () => {
    expect(extractErrorMessage('')).toBe('An unexpected error occurred.');
  });

  it('returns fallback for a whitespace-only string', () => {
    expect(extractErrorMessage('   ')).toBe('An unexpected error occurred.');
  });

  it('returns fallback for null', () => {
    expect(extractErrorMessage(null)).toBe('An unexpected error occurred.');
  });

  it('returns fallback for undefined', () => {
    expect(extractErrorMessage(undefined)).toBe('An unexpected error occurred.');
  });

  it('returns fallback for a plain object', () => {
    expect(extractErrorMessage({ code: 500 })).toBe('An unexpected error occurred.');
  });

  it('uses the caller-supplied fallback when provided', () => {
    expect(extractErrorMessage(null, 'Failed to save local servers.'))
      .toBe('Failed to save local servers.');
  });
});
