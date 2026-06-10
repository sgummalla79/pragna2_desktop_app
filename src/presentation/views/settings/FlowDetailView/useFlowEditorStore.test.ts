import { describe, it, expect, beforeEach } from 'vitest';
import type { Node, Edge } from 'reactflow';
import { useFlowEditorStore } from './useFlowEditorStore';
import {
  NODE_TYPE_AGENT,
  EDGE_TYPE_CONDITION,
  type AgentNodeData,
  type ConditionEdgeData,
  type FlowMeta,
} from './editorTypes';

const META: FlowMeta = {
  apiName: 'f',
  displayName: 'F',
  description: null,
  slashApiName: null,
  exposedAsSlash: true,
  metadata: {},
};

const agent = (): Node<AgentNodeData> => ({
  id: 'agent_1',
  type: NODE_TYPE_AGENT,
  position: { x: 0, y: 0 },
  data: {
    nodeId: 'intake',
    agent: {
      apiName: 'intake',
      displayName: 'Intake',
      description: null,
      userModel: '',
      systemPrompt: '',
      tools: [],
      emits: [],
    },
  },
});

const edge = (data: ConditionEdgeData): Edge<ConditionEdgeData> => ({
  id: 'e1',
  source: 'agent_1',
  target: '__end__',
  type: EDGE_TYPE_CONDITION,
  data,
});

const store = () => useFlowEditorStore.getState();

beforeEach(() => {
  store().reset();
  store().hydrate({ meta: META, nodes: [agent()], edges: [edge({ condition: 'default' })] });
});

describe('useFlowEditorStore', () => {
  it('hydrate loads the model and resets dirty', () => {
    expect(store().nodes).toHaveLength(1);
    expect(store().dirty).toBe(false);
  });

  it('updateAgent patches the inline agent + marks dirty', () => {
    store().updateAgent('agent_1', { userModel: 'claude', systemPrompt: 'go' });
    const data = store().nodes[0].data as AgentNodeData;
    expect(data.agent.userModel).toBe('claude');
    expect(data.agent.systemPrompt).toBe('go');
    expect(store().dirty).toBe(true);
  });

  it('updateNode patches context slots', () => {
    store().updateNode('agent_1', { inputs: ['a'], outputs: ['b'] });
    const data = store().nodes[0].data as AgentNodeData;
    expect(data.inputs).toEqual(['a']);
    expect(data.outputs).toEqual(['b']);
  });

  it('updateEdgeData merges + strips undefined keys (all-or-none clear)', () => {
    store().updateEdgeData('e1', { dispatchMode: 'per_item', itemsSlot: 'notes', itemSlot: 'item' });
    let d = store().edges[0].data as ConditionEdgeData;
    expect(d).toMatchObject({ dispatchMode: 'per_item', itemsSlot: 'notes', itemSlot: 'item' });

    // Clear all three → keys removed entirely, condition retained.
    store().updateEdgeData('e1', { dispatchMode: undefined, itemsSlot: undefined, itemSlot: undefined });
    d = store().edges[0].data as ConditionEdgeData;
    expect(d.dispatchMode).toBeUndefined();
    expect('itemsSlot' in d).toBe(false);
    expect(d.condition).toBe('default');
  });

  it('setEdgeCondition updates the routing condition', () => {
    store().setEdgeCondition('e1', 'passed');
    expect((store().edges[0].data as ConditionEdgeData).condition).toBe('passed');
  });

  it('selectNode / selectEdge are mutually exclusive', () => {
    store().selectNode('agent_1');
    expect(store().selectedNodeId).toBe('agent_1');
    expect(store().selectedEdgeId).toBeNull();
    store().selectEdge('e1');
    expect(store().selectedEdgeId).toBe('e1');
    expect(store().selectedNodeId).toBeNull();
  });

  it('deleteEdge removes the edge', () => {
    store().deleteEdge('e1');
    expect(store().edges).toHaveLength(0);
  });

  it('deleteNode removes the node and its connected edges', () => {
    store().deleteNode('agent_1');
    expect(store().nodes.find((n) => n.id === 'agent_1')).toBeUndefined();
    expect(store().edges).toHaveLength(0);
  });
});
