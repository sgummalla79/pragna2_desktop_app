import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Node, Edge } from 'reactflow';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import type { Model } from '@/domain/types/model.types';
import type { Tool } from '@/domain/types/tool.types';
import { NodePanel } from './NodePanel';
import { useFlowEditorStore } from './useFlowEditorStore';
import {
  NODE_TYPE_AGENT,
  NODE_TYPE_BOUNDARY,
  NODE_END,
  type AgentNodeData,
  type BoundaryNodeData,
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
    agent: {
      apiName: id,
      displayName: '',
      description: null,
      userModel: '',
      systemPrompt: '',
      tools: [],
      emits: [],
    },
    ...over,
  },
});

const endNode = (): Node<BoundaryNodeData> => ({
  id: NODE_END,
  type: NODE_TYPE_BOUNDARY,
  position: { x: 0, y: 0 },
  data: { boundary: NODE_END },
});

function model(over: Partial<Model> = {}): Model {
  return {
    id: 'm1',
    userProviderId: 'p1',
    modelName: 'claude-x',
    displayName: 'Claude X',
    costPerInputToken: '0',
    costPerOutputToken: '0',
    enabled: true,
    availableForChat: true,
    availableForFlows: true,
    archived: false,
    metadata: {},
    supportsVision: false,
    supportsPdf: false,
    ...over,
  };
}

function tool(over: Partial<Tool> = {}): Tool {
  return {
    id: 't1',
    userId: 'u1',
    mcpConnectorId: 'c1',
    apiName: 'mcp.do_thing',
    displayName: 'Do Thing',
    description: '',
    toolType: 'mcp',
    handlerFamily: null,
    systemManaged: false,
    autoBindToDefaultAgent: false,
    enabled: true,
    createdAt: '',
    modifiedAt: '',
    ...over,
  };
}

/** Services the NodePanel reads: modelService.list + toolService.list. */
function services(models: Model[] = [], tools: Tool[] = []) {
  return {
    modelService: { list: () => Promise.resolve(models) },
    toolService: { list: () => Promise.resolve(tools) },
  } as never;
}

function hydrate(nodes: Node[], selectId: string) {
  useFlowEditorStore.getState().reset();
  useFlowEditorStore
    .getState()
    .hydrate({ meta: META, nodes: nodes as never, edges: [] as Edge[] as never });
  useFlowEditorStore.getState().selectNode(selectId);
}

beforeEach(() => useFlowEditorStore.getState().reset());

describe('NodePanel', () => {
  it('renders nothing when the selected node is not an agent node', () => {
    hydrate([endNode()], NODE_END);
    const { container } = renderWithProviders(<NodePanel />, { services: services() });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the agent fields for the selected agent node', async () => {
    hydrate(
      [agentNode('researcher', { agent: { apiName: 'researcher', displayName: 'Researcher', description: 'desc', userModel: '', systemPrompt: 'be careful', tools: [], emits: [] } })],
      'researcher',
    );
    renderWithProviders(<NodePanel />, { services: services([model()]) });

    expect(screen.getByRole('heading', { name: 'Agent' })).toBeInTheDocument();
    expect((screen.getByLabelText('Agent') as HTMLInputElement).value).toBe('researcher');
    expect((screen.getByLabelText('Display name') as HTMLInputElement).value).toBe('Researcher');
    expect((screen.getByLabelText('Description (optional)') as HTMLInputElement).value).toBe('desc');
    expect((screen.getByLabelText('System prompt') as HTMLTextAreaElement).value).toBe('be careful');
  });

  it('writes display-name edits to the store via updateAgent', async () => {
    hydrate([agentNode('researcher')], 'researcher');
    renderWithProviders(<NodePanel />, { services: services([model()]) });

    await userEvent.type(screen.getByLabelText('Display name'), 'Hi');
    const node = useFlowEditorStore.getState().nodes.find((n) => n.id === 'researcher');
    expect((node!.data as AgentNodeData).agent.displayName).toBe('Hi');
  });

  it('commits a node_id rename on blur', async () => {
    hydrate([agentNode('researcher'), agentNode('writer')], 'researcher');
    renderWithProviders(<NodePanel />, { services: services([model()]) });

    const idInput = screen.getByLabelText('Agent');
    await userEvent.clear(idInput);
    await userEvent.type(idInput, 'analyst');
    await userEvent.tab();

    const ids = useFlowEditorStore.getState().nodes.map((n) => n.id);
    expect(ids).toContain('analyst');
    expect(ids).not.toContain('researcher');
  });

  it('rejects a duplicate node_id and surfaces an alert (no rename)', async () => {
    hydrate([agentNode('researcher'), agentNode('writer')], 'researcher');
    renderWithProviders(<NodePanel />, { services: services([model()]) });

    const idInput = screen.getByLabelText('Agent');
    await userEvent.clear(idInput);
    await userEvent.type(idInput, 'writer');
    await userEvent.tab();

    expect(screen.getByRole('alert')).toHaveTextContent(/Ids must be unique/);
    const ids = useFlowEditorStore.getState().nodes.map((n) => n.id);
    expect(ids).toContain('researcher');
  });

  it('presents the chat model as optional with an inherit-conversation-model hint', () => {
    // pragna2-tracker #185 / BE #184: the per-node model is optional; a blank
    // model inherits the conversation's selected model at run time.
    hydrate([agentNode('researcher')], 'researcher'); // userModel: '' (blank)
    renderWithProviders(<NodePanel />, { services: services([model()]) });

    expect(screen.getByText('Model (optional)')).toBeInTheDocument();
    expect(
      screen.getByText(/whatever model the conversation has selected/i),
    ).toBeInTheDocument();
  });

  it('shows the "no flow-eligible models" hint when none qualify', () => {
    hydrate([agentNode('researcher')], 'researcher');
    // Model exists but not available for flows -> filtered out.
    renderWithProviders(<NodePanel />, {
      services: services([model({ availableForFlows: false })]),
    });
    expect(screen.getByText(/No models enabled for Flows/)).toBeInTheDocument();
  });

  it('opens the delete-confirm dialog and deletes the node on confirm', async () => {
    hydrate([agentNode('researcher')], 'researcher');
    renderWithProviders(<NodePanel />, { services: services([model()]) });

    await userEvent.click(screen.getByRole('button', { name: /Delete agent/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete this agent?')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: /^Delete$/ }));
    expect(
      useFlowEditorStore.getState().nodes.find((n) => n.id === 'researcher'),
    ).toBeUndefined();
  });

  it('clears the selection when the close button is clicked', async () => {
    hydrate([agentNode('researcher')], 'researcher');
    renderWithProviders(<NodePanel />, { services: services([model()]) });

    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(useFlowEditorStore.getState().selectedNodeId).toBeNull();
  });
});
