import { describe, it, expect } from 'vitest';
import { mapAgentConnector, type ApiAgentConnectorResponse } from './mapAgentConnector';

describe('mapAgentConnector', () => {
  it('maps the binding row, preserving null selected_tools', () => {
    const raw: ApiAgentConnectorResponse = {
      id: 'b1',
      mcp_connector_id: 'mc1',
      selected_tools: null,
      created_at: '2026-01-01T00:00:00Z',
      modified_at: '2026-01-02T00:00:00Z',
    };
    expect(mapAgentConnector(raw)).toEqual({
      id: 'b1',
      mcpConnectorId: 'mc1',
      selectedTools: null,
      createdAt: '2026-01-01T00:00:00Z',
      modifiedAt: '2026-01-02T00:00:00Z',
    });
  });

  it('preserves a tool subset array', () => {
    const out = mapAgentConnector({
      id: 'b1',
      mcp_connector_id: 'mc1',
      selected_tools: ['x', 'y'],
      created_at: '',
      modified_at: '',
    });
    expect(out.selectedTools).toEqual(['x', 'y']);
  });
});
