import { describe, it, expect } from 'vitest';
import {
  nextEndInstanceId,
  isEndInstanceId,
  portHandleFor,
  blankAgent,
  newFlowGraph,
  NODE_START,
  NODE_END,
  PORT_HANDLE_PREFIX,
} from './editorTypes';

describe('nextEndInstanceId', () => {
  it('returns the bare __end__ when none exist', () => {
    expect(nextEndInstanceId(new Set())).toBe(NODE_END);
  });
  it('suffixes ::2, ::3 as instances accumulate', () => {
    expect(nextEndInstanceId(new Set([NODE_END]))).toBe(`${NODE_END}::2`);
    expect(nextEndInstanceId(new Set([NODE_END, `${NODE_END}::2`]))).toBe(`${NODE_END}::3`);
  });
});

describe('isEndInstanceId', () => {
  it('matches __end__ and any ::n suffix, not other ids', () => {
    expect(isEndInstanceId(NODE_END)).toBe(true);
    expect(isEndInstanceId(`${NODE_END}::4`)).toBe(true);
    expect(isEndInstanceId(NODE_START)).toBe(false);
    expect(isEndInstanceId('agent1')).toBe(false);
  });
});

describe('portHandleFor', () => {
  it('prefixes the emit label', () => {
    expect(portHandleFor('passed')).toBe(`${PORT_HANDLE_PREFIX}passed`);
  });
});

describe('blankAgent', () => {
  it('produces an empty agent carrying the given api_name', () => {
    expect(blankAgent('intake')).toEqual({
      apiName: 'intake',
      displayName: '',
      description: null,
      userModel: '',
      systemPrompt: '',
      tools: [],
      emits: [],
    });
  });
});

describe('newFlowGraph', () => {
  it('seeds empty meta + a single Start boundary node, no edges', () => {
    const g = newFlowGraph();
    expect(g.meta).toMatchObject({ apiName: '', exposedAsSlash: true });
    expect(g.edges).toEqual([]);
    expect(g.nodes).toHaveLength(1);
    expect(g.nodes[0].id).toBe(NODE_START);
  });
});
