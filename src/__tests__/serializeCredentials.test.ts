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
