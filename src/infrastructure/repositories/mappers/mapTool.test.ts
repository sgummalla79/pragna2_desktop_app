import { describe, it, expect } from 'vitest';
import { mapTool, type ApiToolResponse } from './mapTool';

describe('mapTool', () => {
  it('maps snake_case → camelCase', () => {
    const raw: ApiToolResponse = {
      id: 't1',
      user_id: 'u1',
      mcp_connector_id: 'mc1',
      api_name: 'web_search',
      display_name: 'Web Search',
      description: 'Search the web',
      tool_type: 'mcp',
      handler_family: null,
      system_managed: false,
      auto_bind_to_default_agent: true,
      enabled: true,
      created_at: 'c',
      modified_at: 'm',
    };
    expect(mapTool(raw)).toEqual({
      id: 't1',
      userId: 'u1',
      mcpConnectorId: 'mc1',
      apiName: 'web_search',
      displayName: 'Web Search',
      description: 'Search the web',
      toolType: 'mcp',
      handlerFamily: null,
      systemManaged: false,
      autoBindToDefaultAgent: true,
      enabled: true,
      createdAt: 'c',
      modifiedAt: 'm',
    });
  });

  it('preserves null user_id / mcp_connector_id (system tools)', () => {
    const out = mapTool({
      id: 't2',
      user_id: null,
      mcp_connector_id: null,
      api_name: 'set_route',
      display_name: 'Set Route',
      description: '',
      tool_type: 'builtin',
      handler_family: 'routing',
      system_managed: true,
      auto_bind_to_default_agent: false,
      enabled: true,
      created_at: 'c',
      modified_at: 'm',
    });
    expect(out.userId).toBeNull();
    expect(out.mcpConnectorId).toBeNull();
    expect(out.systemManaged).toBe(true);
  });
});
