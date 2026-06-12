import { describe, it, expect } from 'vitest';
import { CREDENTIAL_FIELDS, serializeCredentials } from './providers';

describe('CREDENTIAL_FIELDS.gateway', () => {
  it('captures a non-secret base URL and a secret auth token', () => {
    const fields = CREDENTIAL_FIELDS.gateway;
    const keys = fields.map((f) => f.key);
    expect(keys).toEqual(['baseUrl', 'authToken']);

    const baseUrl = fields.find((f) => f.key === 'baseUrl')!;
    const authToken = fields.find((f) => f.key === 'authToken')!;
    expect(baseUrl.secret).toBe(false);
    expect(authToken.secret).toBe(true);
  });
});

describe('serializeCredentials', () => {
  it('JSON-encodes the gateway credential as { baseUrl, authToken }', () => {
    const out = serializeCredentials('gateway', {
      baseUrl: 'https://gw.example.com',
      authToken: 'tok-123',
    });
    expect(JSON.parse(out)).toEqual({
      baseUrl: 'https://gw.example.com',
      authToken: 'tok-123',
    });
  });

  it('defaults missing gateway fields to empty strings', () => {
    expect(JSON.parse(serializeCredentials('gateway', {}))).toEqual({
      baseUrl: '',
      authToken: '',
    });
  });

  it('still returns the raw key for api_key providers', () => {
    expect(serializeCredentials('api_key', { apiKey: 'sk-test' })).toBe('sk-test');
  });
});
