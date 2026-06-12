import { describe, it, expect } from 'vitest';
import {
  mapMcpConnector,
  mapRegisteredMcpConnector,
  toApiClientDelegatedPayload,
  toApiCreatePayload,
  toApiSyncToolsPayload,
  toApiUpdatePayload,
  type ApiMcpConnectorResponse,
  type ApiRegisteredMcpConnectorResponse,
} from './mapMcpConnector';

const RAW: ApiMcpConnectorResponse = {
  id: 'mc1',
  display_name: 'GitHub',
  description: null,
  transport: 'http',
  config: { url: 'https://x' },
  auth_type: 'bearer',
  has_credentials: true,
  status: 'active',
  tools: { total: 5, enabled: 3 },
  created_at: 'c',
  modified_at: 'm',
};

describe('mapMcpConnector', () => {
  it('maps snake_case → camelCase incl. tool counts', () => {
    expect(mapMcpConnector(RAW)).toEqual({
      id: 'mc1',
      displayName: 'GitHub',
      description: null,
      transport: 'http',
      config: { url: 'https://x' },
      authType: 'bearer',
      hasCredentials: true,
      hasOauthTokens: false,
      status: 'active',
      tools: { total: 5, enabled: 3 },
      createdAt: 'c',
      modifiedAt: 'm',
    });
  });

  it('maps null tool counts to null and defaults config/oauth', () => {
    const out = mapMcpConnector({ ...RAW, tools: null, config: undefined as unknown as Record<string, unknown>, has_oauth_tokens: true });
    expect(out.tools).toBeNull();
    expect(out.config).toEqual({});
    expect(out.hasOauthTokens).toBe(true);
  });
});

describe('mapRegisteredMcpConnector', () => {
  it('adds discoveredToolApiNames', () => {
    const raw: ApiRegisteredMcpConnectorResponse = { ...RAW, discovered_tool_api_names: ['a', 'b'] };
    const out = mapRegisteredMcpConnector(raw);
    expect(out.discoveredToolApiNames).toEqual(['a', 'b']);
    expect(out.displayName).toBe('GitHub');
  });

  it('defaults discovered names to [] when absent', () => {
    const out = mapRegisteredMcpConnector({ ...RAW } as ApiRegisteredMcpConnectorResponse);
    expect(out.discoveredToolApiNames).toEqual([]);
  });
});

describe('toApiCreatePayload', () => {
  it('maps required fields and omits unset optionals', () => {
    expect(
      toApiCreatePayload({ displayName: 'X', transport: 'http', config: { url: 'u' }, authType: 'none' }),
    ).toEqual({ display_name: 'X', transport: 'http', config: { url: 'u' }, auth_type: 'none' });
  });

  it('includes description + credentials when set', () => {
    const body = toApiCreatePayload({
      displayName: 'X',
      transport: 'http',
      config: {},
      authType: 'bearer',
      description: 'd',
      credentials: { token: 't' },
    });
    expect(body).toMatchObject({ description: 'd', credentials: { token: 't' } });
  });
});

describe('toApiUpdatePayload', () => {
  it('sends only the keys the caller set', () => {
    expect(toApiUpdatePayload({ displayName: 'New' })).toEqual({ display_name: 'New' });
    expect(toApiUpdatePayload({})).toEqual({});
  });

  it('maps clearCredentials → clear_credentials', () => {
    expect(toApiUpdatePayload({ clearCredentials: true })).toEqual({ clear_credentials: true });
  });
});

describe('toApiClientDelegatedPayload (Phase F)', () => {
  it('maps to the snake_case stdio shape (no url/credentials)', () => {
    const body = toApiClientDelegatedPayload({
      displayName: 'Local Tools',
      description: 'my local server',
      tools: [{ name: 'read', description: 'Read', inputSchema: { type: 'object' } }],
    });
    expect(body.display_name).toBe('Local Tools');
    expect(body.transport).toBe('stdio');
    expect(body.description).toBe('my local server');
    expect(body.url).toBeUndefined();
    expect((body.tools as Array<Record<string, unknown>>)[0]).toEqual({
      name: 'read',
      description: 'Read',
      input_schema: { type: 'object' },
    });
  });

  it('omits description when absent', () => {
    const body = toApiClientDelegatedPayload({ displayName: 'X', tools: [] });
    expect('description' in body).toBe(false);
  });
});

describe('toApiSyncToolsPayload (Phase F)', () => {
  it('maps tool schemas to snake_case input_schema', () => {
    const body = toApiSyncToolsPayload([{ name: 'write', description: '', inputSchema: {} }]);
    const tools = body.tools as Array<Record<string, unknown>>;
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('write');
    expect(tools[0].input_schema).toEqual({});
  });
});
