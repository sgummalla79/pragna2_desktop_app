import { describe, it, expect } from 'vitest';
import {
  mapAgentTemplate,
  mapActivatedAgentTemplate,
  type ApiAgentTemplateResponse,
  type ApiActivateAgentTemplateResponse,
} from './mapAgentTemplate';

const RAW_TEMPLATE: ApiAgentTemplateResponse = {
  key: 'nexus-kit-help',
  api_name: 'nexus-kit-help',
  display_name: 'Nexus Kit Help & Setup Assistant',
  description: 'Helps you set up Nexus Kit.',
  system_prompt: 'You help with setup.',
  tools: ['create_stdio_mcp_connector'],
  activatable: true,
};

const RAW_ACTIVATED: ApiActivateAgentTemplateResponse = {
  id: 'a9',
  api_name: 'nexus-kit-help',
  display_name: 'Nexus Kit Help & Setup Assistant',
  description: 'Helps you set up Nexus Kit.',
  system_prompt: 'You help with setup.',
  tools: ['create_stdio_mcp_connector'],
  is_default: false,
  status: 'active',
  metadata: {},
  created_at: '2026-01-01T00:00:00Z',
  modified_at: '2026-01-01T00:00:00Z',
  created: true,
  knowledge_seeded: false,
  knowledge_note: 'No embedding key configured; running from built-in overview.',
};

describe('mapAgentTemplate', () => {
  it('maps snake_case → camelCase', () => {
    expect(mapAgentTemplate(RAW_TEMPLATE)).toEqual({
      key: 'nexus-kit-help',
      apiName: 'nexus-kit-help',
      displayName: 'Nexus Kit Help & Setup Assistant',
      description: 'Helps you set up Nexus Kit.',
      systemPrompt: 'You help with setup.',
      tools: ['create_stdio_mcp_connector'],
      activatable: true,
    });
  });

  it('defaults tools when absent', () => {
    const out = mapAgentTemplate({
      ...RAW_TEMPLATE,
      tools: undefined,
    } as unknown as ApiAgentTemplateResponse);
    expect(out.tools).toEqual([]);
  });
});

describe('mapActivatedAgentTemplate', () => {
  it('maps the embedded agent via mapAgent plus activation metadata', () => {
    const out = mapActivatedAgentTemplate(RAW_ACTIVATED);
    expect(out.agent).toMatchObject({
      id: 'a9',
      apiName: 'nexus-kit-help',
      isDefault: false,
      status: 'active',
    });
    expect(out.created).toBe(true);
    expect(out.knowledgeSeeded).toBe(false);
    expect(out.knowledgeNote).toBe(
      'No embedding key configured; running from built-in overview.',
    );
  });

  it('carries a null knowledge note when knowledge was seeded', () => {
    const out = mapActivatedAgentTemplate({
      ...RAW_ACTIVATED,
      created: false,
      knowledge_seeded: true,
      knowledge_note: null,
    });
    expect(out.created).toBe(false);
    expect(out.knowledgeSeeded).toBe(true);
    expect(out.knowledgeNote).toBeNull();
  });
});
