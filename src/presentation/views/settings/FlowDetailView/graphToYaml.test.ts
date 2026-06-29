import { describe, it, expect } from 'vitest';
import type { Node, Edge } from 'reactflow';
import { graphToYaml } from './graphToYaml';
import { buildEditorGraph } from './buildEditorGraph';
import {
  NODE_START,
  NODE_END,
  NODE_TYPE_AGENT,
  NODE_TYPE_BOUNDARY,
  NODE_TYPE_CITATIONS,
  EDGE_TYPE_CONDITION,
  type AgentNodeData,
  type BoundaryNodeData,
  type CitationsNodeData,
  type ConditionEdgeData,
  type FlowMeta,
} from './editorTypes';

const META: FlowMeta = {
  apiName: 'research',
  displayName: 'Research',
  description: 'desc',
  slashApiName: 'research',
  exposedAsSlash: true,
  metadata: {},
};

function agentNode(): Node<AgentNodeData> {
  return {
    id: 'agent_1',
    type: NODE_TYPE_AGENT,
    position: { x: 100, y: 100 },
    data: {
      nodeId: 'intake',
      agent: {
        apiName: 'intake',
        displayName: 'Intake',
        description: null,
        userModel: 'claude-opus',
        systemPrompt: 'Gather requirements.',
        tools: ['web_search'],
        emits: [],
      },
      inputs: ['user_query'],
      outputs: ['notes'],
    },
  };
}

function boundary(id: string): Node<BoundaryNodeData> {
  return {
    id,
    type: NODE_TYPE_BOUNDARY,
    position: { x: 0, y: 0 },
    data: { boundary: id === NODE_START ? NODE_START : NODE_END },
  };
}

function edge(id: string, source: string, target: string, data: ConditionEdgeData): Edge<ConditionEdgeData> {
  return { id, source, target, type: EDGE_TYPE_CONDITION, data };
}

describe('graphToYaml ⇄ buildEditorGraph round-trip', () => {
  it('preserves flow meta + the inline agent definition + context slots', () => {
    const nodes = [boundary(NODE_START), agentNode(), boundary(NODE_END)];
    const edges = [
      edge('e1', NODE_START, 'agent_1', { condition: 'default' }),
      edge('e2', 'agent_1', NODE_END, { condition: 'default' }),
    ];

    const yamlText = graphToYaml(META, nodes, edges);
    expect(yamlText).toContain('research');

    const back = buildEditorGraph(yamlText);
    expect(back.meta).toMatchObject({
      apiName: 'research',
      displayName: 'Research',
      slashApiName: 'research',
      exposedAsSlash: true,
    });

    const agent = back.nodes.find((n) => n.type === NODE_TYPE_AGENT);
    expect(agent).toBeDefined();
    const data = agent!.data as AgentNodeData;
    expect(data.agent).toMatchObject({
      apiName: 'intake',
      userModel: 'claude-opus',
      systemPrompt: 'Gather requirements.',
      tools: ['web_search'],
    });
    expect(data.inputs).toEqual(['user_query']);
    expect(data.outputs).toEqual(['notes']);
  });

  it('omits user_model when the agent has no model (inherits the conversation model)', () => {
    // pragna2-tracker #185 / BE #184: the per-node model is optional. A blank
    // model must serialize as ABSENT (not user_model: ""), so the backend
    // treats it as "use the conversation's selected model at run time".
    const node = agentNode();
    (node.data as AgentNodeData).agent.userModel = '';
    const nodes = [boundary(NODE_START), node, boundary(NODE_END)];
    const edges = [
      edge('e1', NODE_START, 'agent_1', { condition: 'default' }),
      edge('e2', 'agent_1', NODE_END, { condition: 'default' }),
    ];

    const yamlText = graphToYaml(META, nodes, edges);
    expect(yamlText).not.toContain('user_model');

    // Round-trips back to a blank model (buildEditorGraph defaults absent → '').
    const back = buildEditorGraph(yamlText);
    const agent = back.nodes.find((n) => n.type === NODE_TYPE_AGENT)!;
    expect((agent.data as AgentNodeData).agent.userModel).toBe('');
  });

  it('round-trips a dynamic-dispatch (per_item) edge between two agents', () => {
    const a1 = agentNode();
    const a2: Node<AgentNodeData> = {
      ...agentNode(),
      id: 'agent_2',
      data: {
        ...agentNode().data,
        nodeId: 'worker',
        agent: { ...agentNode().data.agent, apiName: 'worker' },
        inputs: ['item'],
      },
    };
    const nodes = [boundary(NODE_START), a1, a2, boundary(NODE_END)];
    const edges = [
      edge('s', NODE_START, 'agent_1', { condition: 'default' }),
      edge('d', 'agent_1', 'agent_2', {
        condition: 'default',
        dispatchMode: 'per_item',
        itemsSlot: 'notes',
        itemSlot: 'item',
      }),
      edge('e', 'agent_2', NODE_END, { condition: 'default' }),
    ];

    const yamlText = graphToYaml(META, nodes, edges);
    // graphToYaml emits all three dispatch keys together (all-or-none).
    expect(yamlText).toContain('dispatch_mode');
    expect(yamlText).toContain('items_slot');
    expect(yamlText).toContain('item_slot');
    expect(yamlText).toContain('notes');
    // (Parsing dispatch back onto edge data is buildEditorGraph's concern;
    // the EdgePanel + store tests cover the live read/write of these fields.)
  });

  it('produces no agent/edge graph from blank YAML without throwing', () => {
    const g = buildEditorGraph('');
    expect(g.nodes.filter((n) => n.type === NODE_TYPE_AGENT)).toEqual([]);
    expect(g.edges).toEqual([]);
  });

  it('round-trips a citations node WITH overridden slot fields', () => {
    const cite: Node<CitationsNodeData> = {
      id: 'cite',
      type: NODE_TYPE_CITATIONS,
      position: { x: 300, y: 100 },
      data: { nodeId: 'cite', sourcesSlot: 'srcs', draftSlot: 'prose', outputSlot: 'report' },
    };
    const nodes = [boundary(NODE_START), cite, boundary(NODE_END)];
    const edges = [
      edge('e1', NODE_START, 'cite', { condition: 'default' }),
      edge('e2', 'cite', NODE_END, { condition: 'default' }),
    ];

    const yamlText = graphToYaml(META, nodes, edges);
    expect(yamlText).toContain('node_kind: citations');
    expect(yamlText).toContain('sources_slot: srcs');
    expect(yamlText).toContain('draft_slot: prose');
    expect(yamlText).toContain('output_slot: report');

    const back = buildEditorGraph(yamlText);
    const node = back.nodes.find((n) => n.type === NODE_TYPE_CITATIONS);
    expect(node).toBeDefined();
    expect(node!.data as CitationsNodeData).toMatchObject({
      nodeId: 'cite',
      sourcesSlot: 'srcs',
      draftSlot: 'prose',
      outputSlot: 'report',
    });
  });

  it('omits blank citations slots so the BE applies its defaults (round-trips to undefined)', () => {
    const cite: Node<CitationsNodeData> = {
      id: 'cite',
      type: NODE_TYPE_CITATIONS,
      position: { x: 300, y: 100 },
      data: { nodeId: 'cite' }, // no slot overrides
    };
    const nodes = [boundary(NODE_START), cite, boundary(NODE_END)];
    const edges = [
      edge('e1', NODE_START, 'cite', { condition: 'default' }),
      edge('e2', 'cite', NODE_END, { condition: 'default' }),
    ];

    const yamlText = graphToYaml(META, nodes, edges);
    expect(yamlText).toContain('node_kind: citations');
    expect(yamlText).not.toContain('sources_slot');
    expect(yamlText).not.toContain('draft_slot');
    expect(yamlText).not.toContain('output_slot');

    const back = buildEditorGraph(yamlText);
    const node = back.nodes.find((n) => n.type === NODE_TYPE_CITATIONS)!;
    const data = node.data as CitationsNodeData;
    expect(data.sourcesSlot).toBeUndefined();
    expect(data.draftSlot).toBeUndefined();
    expect(data.outputSlot).toBeUndefined();
  });
});
