import { describe, it, expect } from 'vitest';
import { serializeCredentials } from '@/constants/providers';

/**
 * The gateway credential serialization decides which backend wire-protocol
 * path is used: an OpenAI-compatible gateway must serialise to the minimal
 * { baseUrl, authToken } blob, while filling the optional Models Endpoint
 * switches it to the Anthropic/Bedrock-shaped path (the backend dispatches on
 * `modelsUrl` being present). These tests pin that contract.
 */
describe('serializeCredentials — gateway', () => {
  it('omits optional fields when blank (OpenAI-compatible path)', () => {
    const json = serializeCredentials('gateway', {
      baseUrl: 'https://gw.example.com',
      authToken: 'tok',
    });
    expect(JSON.parse(json)).toEqual({
      baseUrl: 'https://gw.example.com',
      authToken: 'tok',
    });
  });

  it('omits optional fields that are whitespace-only', () => {
    const json = serializeCredentials('gateway', {
      baseUrl: 'https://gw.example.com',
      authToken: 'tok',
      modelsUrl: '   ',
      awsRegion: '  ',
    });
    expect(JSON.parse(json)).toEqual({
      baseUrl: 'https://gw.example.com',
      authToken: 'tok',
    });
  });

  it('includes modelsUrl + awsRegion when provided (Anthropic/Bedrock path)', () => {
    const json = serializeCredentials('gateway', {
      baseUrl: 'https://gw.example.com/bedrock',
      authToken: 'tok',
      modelsUrl: 'https://gw.example.com/models',
      awsRegion: 'us-east-2',
    });
    expect(JSON.parse(json)).toEqual({
      baseUrl: 'https://gw.example.com/bedrock',
      authToken: 'tok',
      modelsUrl: 'https://gw.example.com/models',
      awsRegion: 'us-east-2',
    });
  });

  it('includes modelsUrl alone (awsRegion falls back server-side)', () => {
    const json = serializeCredentials('gateway', {
      baseUrl: 'https://gw.example.com/bedrock',
      authToken: 'tok',
      modelsUrl: 'https://gw.example.com/models',
    });
    expect(JSON.parse(json)).toEqual({
      baseUrl: 'https://gw.example.com/bedrock',
      authToken: 'tok',
      modelsUrl: 'https://gw.example.com/models',
    });
  });
});

describe('serializeCredentials — gateway SSL/TLS fields', () => {
  it('omits caCert when blank or whitespace-only', () => {
    const json = serializeCredentials('gateway', {
      baseUrl: 'https://gw.example.com',
      authToken: 'tok',
      caCert: '   ',
    });
    const parsed = JSON.parse(json);
    expect(parsed).not.toHaveProperty('caCert');
    expect(parsed).not.toHaveProperty('verifySsl');
  });

  it('includes caCert as a string when provided', () => {
    const pem = '-----BEGIN CERTIFICATE-----\nABCD\n-----END CERTIFICATE-----';
    const json = serializeCredentials('gateway', {
      baseUrl: 'https://gw.example.com',
      authToken: 'tok',
      caCert: pem,
    });
    expect(JSON.parse(json)).toMatchObject({
      baseUrl: 'https://gw.example.com',
      authToken: 'tok',
      caCert: pem,
    });
  });

  it('omits verifySsl when toggle is on (empty string, "true", or absent)', () => {
    for (const v of ['', 'true', undefined as unknown as string]) {
      const json = serializeCredentials('gateway', {
        baseUrl: 'https://gw.example.com',
        authToken: 'tok',
        verifySsl: v,
      });
      expect(JSON.parse(json)).not.toHaveProperty('verifySsl');
    }
  });

  it('serializes verifySsl as boolean false — not string — when toggle is off', () => {
    const json = serializeCredentials('gateway', {
      baseUrl: 'https://gw.example.com',
      authToken: 'tok',
      verifySsl: 'false',
    });
    const parsed = JSON.parse(json);
    expect(parsed.verifySsl).toBe(false);
    expect(typeof parsed.verifySsl).toBe('boolean');
  });

  it('includes both caCert and verifySsl:false when both are set', () => {
    const pem = '-----BEGIN CERTIFICATE-----\nABCD\n-----END CERTIFICATE-----';
    const json = serializeCredentials('gateway', {
      baseUrl: 'https://gw.example.com',
      authToken: 'tok',
      caCert: pem,
      verifySsl: 'false',
    });
    const parsed = JSON.parse(json);
    expect(parsed.caCert).toBe(pem);
    expect(parsed.verifySsl).toBe(false);
  });

  it('regression: no SSL fields → minimal { baseUrl, authToken } blob unchanged', () => {
    const json = serializeCredentials('gateway', {
      baseUrl: 'https://gw.example.com',
      authToken: 'tok',
    });
    expect(JSON.parse(json)).toEqual({
      baseUrl: 'https://gw.example.com',
      authToken: 'tok',
    });
  });
});
