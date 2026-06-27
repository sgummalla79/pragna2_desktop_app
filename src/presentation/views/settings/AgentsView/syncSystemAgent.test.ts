import { describe, it, expect } from 'vitest';
import type { Agent } from '@/domain/types/agent.types';
import type { AgentTemplate } from '@/domain/types/agentTemplate.types';
import {
  SYSTEM_AGENT_METADATA_KEY,
  SYSTEM_AGENT_ROLE_HELP_SETUP,
} from './constants';
import {
  buildSyncPayload,
  findTemplateForAgent,
  isSystemAgent,
  systemAgentNeedsUpdate,
} from './syncSystemAgent';

/** A system-agent instance (carries the help/setup sentinel) with overrides. */
function agent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'a1',
    apiName: 'nexus-kit-help',
    displayName: 'Nexus Kit Help & Setup Assistant',
    description: 'Helps you set up Nexus Kit.',
    systemPrompt: 'You are the help assistant.',
    tools: ['search', 'docs'],
    isDefault: false,
    status: 'active',
    metadata: { [SYSTEM_AGENT_METADATA_KEY]: SYSTEM_AGENT_ROLE_HELP_SETUP },
    createdAt: '2024-01-01T00:00:00Z',
    modifiedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

/** A template matching the instance above unless overridden. */
function template(overrides: Partial<AgentTemplate> = {}): AgentTemplate {
  return {
    key: 'nexus-kit-help',
    apiName: 'nexus-kit-help',
    displayName: 'Nexus Kit Help & Setup Assistant',
    description: 'Helps you set up Nexus Kit.',
    systemPrompt: 'You are the help assistant.',
    tools: ['search', 'docs'],
    activatable: true,
    activated: true,
    ...overrides,
  };
}

describe('isSystemAgent', () => {
  it('is true when the help/setup sentinel is present in metadata', () => {
    expect(isSystemAgent(agent())).toBe(true);
  });

  it('is false for a normal user agent (no sentinel)', () => {
    expect(isSystemAgent(agent({ metadata: {} }))).toBe(false);
  });

  it('is false when the sentinel value differs', () => {
    expect(
      isSystemAgent(agent({ metadata: { [SYSTEM_AGENT_METADATA_KEY]: 'other' } })),
    ).toBe(false);
  });
});

describe('findTemplateForAgent', () => {
  it('matches the template whose apiName equals the agent apiName', () => {
    const match = template();
    const other = template({ key: 'other', apiName: 'other-template' });
    expect(findTemplateForAgent(agent(), [other, match])).toBe(match);
  });

  it('returns undefined when no template matches (e.g. removed on the BE)', () => {
    expect(findTemplateForAgent(agent(), [template({ apiName: 'gone' })])).toBeUndefined();
  });
});

describe('systemAgentNeedsUpdate', () => {
  it('is false when the instance already matches the template', () => {
    expect(systemAgentNeedsUpdate(agent(), template())).toBe(false);
  });

  it('treats a tools reorder as no change (order-insensitive)', () => {
    expect(
      systemAgentNeedsUpdate(agent({ tools: ['docs', 'search'] }), template()),
    ).toBe(false);
  });

  it('normalises a null instance description against an empty template string', () => {
    expect(
      systemAgentNeedsUpdate(agent({ description: null }), template({ description: '' })),
    ).toBe(false);
  });

  it('detects a changed system prompt', () => {
    expect(
      systemAgentNeedsUpdate(agent(), template({ systemPrompt: 'New prompt.' })),
    ).toBe(true);
  });

  it('detects a changed display name', () => {
    expect(
      systemAgentNeedsUpdate(agent(), template({ displayName: 'Renamed' })),
    ).toBe(true);
  });

  it('detects an added tool', () => {
    expect(
      systemAgentNeedsUpdate(agent(), template({ tools: ['search', 'docs', 'web'] })),
    ).toBe(true);
  });

  it('detects a changed description', () => {
    expect(
      systemAgentNeedsUpdate(agent(), template({ description: 'Different.' })),
    ).toBe(true);
  });
});

describe('buildSyncPayload', () => {
  it('carries only the template-owned fields (no apiName/status/metadata)', () => {
    const payload = buildSyncPayload(
      template({
        displayName: 'Latest',
        description: 'Latest desc',
        systemPrompt: 'Latest prompt',
        tools: ['a', 'b'],
      }),
    );
    expect(payload).toEqual({
      displayName: 'Latest',
      description: 'Latest desc',
      systemPrompt: 'Latest prompt',
      tools: ['a', 'b'],
    });
  });
});
