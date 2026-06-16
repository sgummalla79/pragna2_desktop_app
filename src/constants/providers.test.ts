import { describe, it, expect } from 'vitest';
import { CREDENTIAL_FIELDS, serializeCredentials } from './providers';

describe('CREDENTIAL_FIELDS.gateway', () => {
  it('captures a non-secret base URL and a secret auth token', () => {
    const fields = CREDENTIAL_FIELDS.gateway;
    const keys = fields.map((f) => f.key);
    // baseUrl + authToken are required; modelsUrl + awsRegion are optional and
    // only apply to an Anthropic/Bedrock-shaped gateway. verifySsl precedes
    // caCert so the toggle reads as the gate above the CA-cert input it controls.
    expect(keys).toEqual(['baseUrl', 'authToken', 'modelsUrl', 'awsRegion', 'verifySsl', 'caCert']);

    const baseUrl = fields.find((f) => f.key === 'baseUrl')!;
    const authToken = fields.find((f) => f.key === 'authToken')!;
    expect(baseUrl.secret).toBe(false);
    expect(authToken.secret).toBe(true);
    expect(baseUrl.optional).toBeUndefined();
    expect(authToken.optional).toBeUndefined();
  });

  it('marks the Anthropic/Bedrock fields as optional and non-secret', () => {
    const fields = CREDENTIAL_FIELDS.gateway;
    const modelsUrl = fields.find((f) => f.key === 'modelsUrl')!;
    const awsRegion = fields.find((f) => f.key === 'awsRegion')!;
    expect(modelsUrl.optional).toBe(true);
    expect(awsRegion.optional).toBe(true);
    expect(modelsUrl.secret).toBe(false);
    expect(awsRegion.secret).toBe(false);
  });

  it('marks caCert as an optional, non-secret file-upload field', () => {
    const fields = CREDENTIAL_FIELDS.gateway;
    const caCert = fields.find((f) => f.key === 'caCert')!;
    expect(caCert.optional).toBe(true);
    expect(caCert.secret).toBe(false);
    // Rendered as a click-to-select file-upload control with a "Paste"
    // fallback — no longer a bare multiline textarea.
    expect(caCert.type).toBe('file');
    expect(caCert.multiline).toBeUndefined();
    // Enabled only while SSL verification is on (a custom CA has no effect
    // when verification is disabled).
    expect(caCert.enabledWhenToggleOn).toBe('verifySsl');
  });

  it('marks verifySsl as optional toggle field (not secret, not multiline)', () => {
    const fields = CREDENTIAL_FIELDS.gateway;
    const verifySsl = fields.find((f) => f.key === 'verifySsl')!;
    expect(verifySsl.optional).toBe(true);
    expect(verifySsl.secret).toBe(false);
    expect(verifySsl.multiline).toBeUndefined();
    expect(verifySsl.type).toBe('toggle');
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
