import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Node, Edge } from 'reactflow';
import { EdgePanel } from './EdgePanel';
import { useFlowEditorStore } from './useFlowEditorStore';
import {
  NODE_TYPE_AGENT,
  NODE_TYPE_BOUNDARY,
  NODE_END,
  EDGE_TYPE_CONDITION,
  type AgentNodeData,
  type BoundaryNodeData,
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

const agentNode = (id: string, over: Partial<AgentNodeData> = {}): Node<AgentNodeData> => ({
  id,
  type: NODE_TYPE_AGENT,
  position: { x: 0, y: 0 },
  data: {
    nodeId: id,
    agent: { apiName: id, displayName: id, description: null, userModel: '', systemPrompt: '', tools: [], emits: [] },
    outputs: ['notes'],
    inputs: ['item'],
    ...over,
  },
});

const endNode = (): Node<BoundaryNodeData> => ({
  id: NODE_END,
  type: NODE_TYPE_BOUNDARY,
  position: { x: 0, y: 0 },
  data: { boundary: NODE_END },
});

const edge = (source: string, target: string): Edge<ConditionEdgeData> => ({
  id: 'e1',
  source,
  target,
  type: EDGE_TYPE_CONDITION,
  data: { condition: 'default' },
});

function hydrate(nodes: Node[], edges: Edge[]) {
  useFlowEditorStore.getState().reset();
  useFlowEditorStore.getState().hydrate({ meta: META, nodes: nodes as never, edges: edges as never });
  useFlowEditorStore.getState().selectEdge('e1');
}

beforeEach(() => useFlowEditorStore.getState().reset());

describe('EdgePanel — dynamic fan-out (TD-021)', () => {
  it('offers the "Send per item" toggle for an agent → agent edge', () => {
    hydrate([agentNode('a'), agentNode('b'), endNode()], [edge('a', 'b')]);
    render(<EdgePanel />);
    const toggle = screen.getByLabelText(/Toggle dynamic fan-out/);
    expect(toggle).toBeEnabled();
  });

  it('reveals the items/item slot dropdowns + writes dispatch fields when toggled on', async () => {
    hydrate([agentNode('a'), agentNode('b'), endNode()], [edge('a', 'b')]);
    render(<EdgePanel />);
    await userEvent.click(screen.getByLabelText(/Toggle dynamic fan-out/));

    expect(screen.getByText('Items slot (source list)')).toBeInTheDocument();
    expect(screen.getByText('Item slot (per-instance payload)')).toBeInTheDocument();

    const data = useFlowEditorStore.getState().edges[0].data as ConditionEdgeData;
    expect(data.dispatchMode).toBe('per_item');
    expect(data.itemsSlot).toBe('notes'); // first of [outputs..., user_query]
    expect(data.itemSlot).toBe('item'); // first of target inputs
  });

  it('blocks dispatch (toggle disabled + reason) when the target is __end__', () => {
    hydrate([agentNode('a'), endNode()], [edge('a', NODE_END)]);
    render(<EdgePanel />);
    expect(screen.getByLabelText(/Toggle dynamic fan-out/)).toBeDisabled();
    expect(screen.getByText(/cannot be __end__/)).toBeInTheDocument();
  });

  it('blocks dispatch when the source already branches via emits', () => {
    hydrate(
      [agentNode('a', { agent: { apiName: 'a', displayName: 'a', description: null, userModel: '', systemPrompt: '', tools: [], emits: ['passed'] } }), agentNode('b'), endNode()],
      [edge('a', 'b')],
    );
    render(<EdgePanel />);
    expect(screen.getByLabelText(/Toggle dynamic fan-out/)).toBeDisabled();
    expect(screen.getByText(/already branches via emits/)).toBeInTheDocument();
  });
});
