import { describe, it, expect } from 'vitest';
import { mapFlow, type ApiFlowResponse } from './mapFlow';
import { EDGE_CONDITIONS } from '@/constants/edgeConditions';

const RAW: ApiFlowResponse = {
  id: 'f1',
  api_name: 'research',
  display_name: 'Research',
  description: null,
  enabled: true,
  slash_api_name: 'research',
  exposed_as_slash: true,
  metadata: { positions: {} },
  definition: 'flow: ...',
  nodes: [
    {
      id: 'n1',
      api_name: 'intake',
      display_name: 'Intake',
      description: null,
      node_kind: null,
      user_model_id: 'm1',
      system_prompt: 'do',
      output_schema: null,
      emits: null,
      tools: null,
    },
  ],
  edges: [{ id: 'e1', from_node: 'n1', to_node: '__end__', condition: 'passed' }],
};

describe('mapFlow', () => {
  it('maps the flow envelope', () => {
    const out = mapFlow(RAW);
    expect(out).toMatchObject({
      id: 'f1',
      apiName: 'research',
      displayName: 'Research',
      enabled: true,
      slashApiName: 'research',
      exposedAsSlash: true,
      definition: 'flow: ...',
    });
  });

  it('maps nodes, defaulting nodeKind→null and emits/tools→[]', () => {
    const node = mapFlow(RAW).nodes[0];
    expect(node).toMatchObject({
      id: 'n1',
      apiName: 'intake',
      nodeKind: null,
      userModelId: 'm1',
      emits: [],
      tools: [],
    });
  });

  it('maps edges and preserves the explicit condition', () => {
    expect(mapFlow(RAW).edges[0]).toEqual({
      id: 'e1',
      fromNode: 'n1',
      toNode: '__end__',
      condition: 'passed',
    });
  });

  it('falls back to the default edge condition when null/undefined', () => {
    const out = mapFlow({
      ...RAW,
      edges: [{ id: 'e2', from_node: 'a', to_node: 'b', condition: null as unknown as string }],
    });
    expect(out.edges[0].condition).toBe(EDGE_CONDITIONS.DEFAULT);
  });

  it('defaults nodes/edges/metadata to empty when absent', () => {
    const out = mapFlow({ ...RAW, nodes: undefined, edges: undefined, metadata: undefined } as unknown as ApiFlowResponse);
    expect(out.nodes).toEqual([]);
    expect(out.edges).toEqual([]);
    expect(out.metadata).toEqual({});
  });
});
