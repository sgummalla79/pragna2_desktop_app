import { describe, it, expect } from 'vitest';
import { readMcpOAuthConfig } from './mcp.types';

describe('readMcpOAuthConfig', () => {
  const valid = {
    oauth: { clientId: 'abc', loginUrl: 'https://login.example', callbackPort: 8082 },
  };

  it('parses a fully-specified block', () => {
    expect(readMcpOAuthConfig(valid)).toEqual({
      clientId: 'abc',
      loginUrl: 'https://login.example',
      callbackPort: 8082,
    });
  });

  it('returns null when there is no oauth block', () => {
    expect(readMcpOAuthConfig({ url: 'u' })).toBeNull();
    expect(readMcpOAuthConfig({ oauth: null })).toBeNull();
    expect(readMcpOAuthConfig({ oauth: 'nope' })).toBeNull();
  });

  it('returns null when any field is missing or blank', () => {
    expect(readMcpOAuthConfig({ oauth: { loginUrl: 'x', callbackPort: 1 } })).toBeNull();
    expect(
      readMcpOAuthConfig({ oauth: { clientId: '  ', loginUrl: 'x', callbackPort: 1 } }),
    ).toBeNull();
    expect(
      readMcpOAuthConfig({ oauth: { clientId: 'a', loginUrl: '', callbackPort: 1 } }),
    ).toBeNull();
  });

  it('returns null for an out-of-range or non-integer callbackPort', () => {
    const base = { clientId: 'a', loginUrl: 'x' };
    expect(readMcpOAuthConfig({ oauth: { ...base, callbackPort: 0 } })).toBeNull();
    expect(readMcpOAuthConfig({ oauth: { ...base, callbackPort: 65536 } })).toBeNull();
    expect(readMcpOAuthConfig({ oauth: { ...base, callbackPort: 80.5 } })).toBeNull();
    expect(readMcpOAuthConfig({ oauth: { ...base, callbackPort: '8082' } })).toBeNull();
  });

  it('accepts boundary ports', () => {
    const base = { clientId: 'a', loginUrl: 'x' };
    expect(readMcpOAuthConfig({ oauth: { ...base, callbackPort: 1 } })?.callbackPort).toBe(1);
    expect(
      readMcpOAuthConfig({ oauth: { ...base, callbackPort: 65535 } })?.callbackPort,
    ).toBe(65535);
  });

  it('passes through omitResourceAtTokenExchange=true when set', () => {
    const config = {
      oauth: { clientId: 'abc', loginUrl: 'https://login.example', callbackPort: 8082, omitResourceAtTokenExchange: true },
    };
    expect(readMcpOAuthConfig(config)?.omitResourceAtTokenExchange).toBe(true);
  });

  it('omits omitResourceAtTokenExchange when false or absent', () => {
    const base = { clientId: 'abc', loginUrl: 'https://login.example', callbackPort: 8082 };
    expect(readMcpOAuthConfig({ oauth: base })?.omitResourceAtTokenExchange).toBeUndefined();
    expect(readMcpOAuthConfig({ oauth: { ...base, omitResourceAtTokenExchange: false } })?.omitResourceAtTokenExchange).toBeUndefined();
  });
});
