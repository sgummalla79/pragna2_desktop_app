import { describe, it, expect } from 'vitest';
import {
  mapAgent,
  mapDefaultAgentTemplate,
  type ApiAgentResponse,
  type ApiDefaultAgentTemplateResponse,
} from './mapAgent';

const RAW: ApiAgentResponse = {
  id: 'a1',
  api_name: 'researcher',
  display_name: 'Researcher',
  description: null,
  system_prompt: 'You research.',
  tools: ['web_search'],
  is_default: true,
  status: 'active',
  metadata: { k: 1 },
  created_at: '2026-01-01T00:00:00Z',
  modified_at: '2026-01-02T00:00:00Z',
};

describe('mapAgent', () => {
  it('maps snake_case → camelCase', () => {
    expect(mapAgent(RAW)).toEqual({
      id: 'a1',
      apiName: 'researcher',
      displayName: 'Researcher',
      description: null,
      systemPrompt: 'You research.',
      tools: ['web_search'],
      isDefault: true,
      status: 'active',
      metadata: { k: 1 },
      createdAt: '2026-01-01T00:00:00Z',
      modifiedAt: '2026-01-02T00:00:00Z',
    });
  });

  it('defaults tools/metadata when absent', () => {
    const out = mapAgent({ ...RAW, tools: undefined, metadata: undefined } as unknown as ApiAgentResponse);
    expect(out.tools).toEqual([]);
    expect(out.metadata).toEqual({});
  });
});

describe('mapDefaultAgentTemplate', () => {
  it('maps the template payload', () => {
    const raw: ApiDefaultAgentTemplateResponse = {
      api_name: 'default',
      display_name: 'Default',
      description: 'd',
      system_prompt: 'p',
      tools: ['t'],
    };
    expect(mapDefaultAgentTemplate(raw)).toEqual({
      apiName: 'default',
      displayName: 'Default',
      description: 'd',
      systemPrompt: 'p',
      tools: ['t'],
    });
  });

  it('defaults tools when absent', () => {
    const out = mapDefaultAgentTemplate({
      api_name: 'd',
      display_name: 'D',
      description: '',
      system_prompt: '',
    } as unknown as ApiDefaultAgentTemplateResponse);
    expect(out.tools).toEqual([]);
  });
});
