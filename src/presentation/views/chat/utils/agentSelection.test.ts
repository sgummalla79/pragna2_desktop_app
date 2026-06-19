import { describe, it, expect } from 'vitest';
import type { Agent } from '@/domain/types/agent.types';
import { resolveActiveAgentId } from './agentSelection';

function agent(over: Partial<Agent> & Pick<Agent, 'id'>): Agent {
  return {
    apiName: 'a',
    displayName: over.id,
    description: null,
    systemPrompt: '',
    tools: [],
    isDefault: false,
    status: 'active',
    metadata: {},
    createdAt: '2026-01-01T00:00:00Z',
    modifiedAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

describe('resolveActiveAgentId', () => {
  it('returns null when there are no active agents', () => {
    expect(resolveActiveAgentId([], null)).toBeNull();
    expect(resolveActiveAgentId([], 'anything')).toBeNull();
  });

  it('returns the pinned id when it is still active', () => {
    const agents = [agent({ id: '1', isDefault: true }), agent({ id: '2' })];
    expect(resolveActiveAgentId(agents, '2')).toBe('2');
  });

  it('falls back to the default agent when nothing is pinned', () => {
    const agents = [agent({ id: '1' }), agent({ id: '2', isDefault: true })];
    expect(resolveActiveAgentId(agents, null)).toBe('2');
  });

  it('falls back to the default agent when the pinned id is not active', () => {
    const agents = [agent({ id: '1', isDefault: true }), agent({ id: '2' })];
    expect(resolveActiveAgentId(agents, 'archived-x')).toBe('1');
  });

  it('falls back to the first active agent when there is no default', () => {
    const agents = [agent({ id: '1' }), agent({ id: '2' })];
    expect(resolveActiveAgentId(agents, null)).toBe('1');
  });

  it('never returns null while any active agent exists (no "unselected" state)', () => {
    const agents = [agent({ id: 'only' })];
    expect(resolveActiveAgentId(agents, null)).toBe('only');
  });
});
