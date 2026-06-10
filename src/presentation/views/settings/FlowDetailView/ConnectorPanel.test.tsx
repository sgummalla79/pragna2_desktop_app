import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Node, Edge } from 'reactflow';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import type { McpConnector } from '@/domain/types/mcp.types';
import type { Tool } from '@/domain/types/tool.types';
import { ConnectorPanel } from './ConnectorPanel';
import { useFlowEditorStore } from './useFlowEditorStore';
import {
  NODE_TYPE_CONNECTOR,
  NODE_TYPE_BOUNDARY,
  NODE_END,
  type ConnectorNodeData,
  type EditorConnector,
  type BoundaryNodeData,
  type FlowMeta,
} from './editorTypes';

// AddConnectorWizard pulls the register flow + extra services; the panel only
// renders it (closed) until "Register a new connector" is clicked. Stub it so
// the test exercises the panel's own logic, not the wizard's.
vi.mock('@/presentation/views/settings/ConnectorsView/AddConnectorWizard', () => ({
  AddConnectorWizard: ({ open }: { open: boolean }) =>
    open ? <div data-testid="register-wizard" /> : null,
}));

const META: FlowMeta = {
  apiName: 'f',
  displayName: 'F',
  description: null,
  slashApiName: null,
  exposedAsSlash: true,
  metadata: {},
};

const connectorNode = (
  id: string,
  connectors: EditorConnector[] = [],
): Node<ConnectorNodeData> => ({
  id,
  type: NODE_TYPE_CONNECTOR,
  position: { x: 0, y: 0 },
  data: { nodeId: id, connectors },
});

const endNode = (): Node<BoundaryNodeData> => ({
  id: NODE_END,
  type: NODE_TYPE_BOUNDARY,
  position: { x: 0, y: 0 },
  data: { boundary: NODE_END },
});

function connector(over: Partial<McpConnector> = {}): McpConnector {
  return {
    id: 'srv-1',
    displayName: 'Linear',
    description: null,
    transport: 'streamable_http',
    config: { url: 'https://linear.example/mcp' },
    authType: 'oauth',
    hasCredentials: false,
    hasOauthTokens: true,
    status: 'active',
    tools: null,
    createdAt: '',
    modifiedAt: '',
    ...over,
  };
}

function tool(over: Partial<Tool> = {}): Tool {
  return {
    id: 't1',
    userId: 'u1',
    mcpConnectorId: 'srv-1',
    apiName: 'mcp.create_issue',
    displayName: 'Create Issue',
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

/** Services the ConnectorPanel reads: mcpConnectorService.list + toolService.list. */
function services(connectors: McpConnector[] = [], tools: Tool[] = []) {
  return {
    mcpConnectorService: { list: () => Promise.resolve(connectors) },
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

describe('ConnectorPanel', () => {
  it('renders nothing when the selected node is not a connector node', () => {
    hydrate([endNode()], NODE_END);
    const { container } = renderWithProviders(<ConnectorPanel />, { services: services() });
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the empty state when the node has no connectors', () => {
    hydrate([connectorNode('connectors_1')], 'connectors_1');
    renderWithProviders(<ConnectorPanel />, { services: services() });
    expect(screen.getByRole('heading', { name: 'MCP' })).toBeInTheDocument();
    expect(screen.getByText('No connectors added yet.')).toBeInTheDocument();
  });

  it('lists attached connectors by display name', () => {
    hydrate(
      [
        connectorNode('connectors_1', [
          { sourceServerId: 'srv-1', url: 'https://x', displayName: 'Linear' },
        ]),
      ],
      'connectors_1',
    );
    renderWithProviders(<ConnectorPanel />, { services: services([], [tool()]) });
    expect(screen.getByText('Linear')).toBeInTheDocument();
  });

  it('removes an attached connector via its remove button', async () => {
    hydrate(
      [
        connectorNode('connectors_1', [
          { sourceServerId: 'srv-1', url: 'https://x', displayName: 'Linear' },
        ]),
      ],
      'connectors_1',
    );
    renderWithProviders(<ConnectorPanel />, { services: services() });

    await userEvent.click(screen.getByRole('button', { name: 'Remove Linear' }));
    const node = useFlowEditorStore.getState().nodes.find((n) => n.id === 'connectors_1');
    expect((node!.data as ConnectorNodeData).connectors).toHaveLength(0);
  });

  it('adds an available connector from the add dialog (updateConnectors)', async () => {
    hydrate([connectorNode('connectors_1')], 'connectors_1');
    renderWithProviders(<ConnectorPanel />, {
      services: services([connector()], [tool()]),
    });

    await userEvent.click(screen.getByRole('button', { name: /Add a connector/ }));
    const dialog = await screen.findByRole('dialog');
    // Pick the available connector (the button shows its display name).
    await userEvent.click(within(dialog).getByRole('button', { name: /Linear/ }));

    const node = useFlowEditorStore.getState().nodes.find((n) => n.id === 'connectors_1');
    expect((node!.data as ConnectorNodeData).connectors.map((c) => c.sourceServerId)).toEqual([
      'srv-1',
    ]);
  });

  it('shows "no connectors to add" when all active connectors are already attached', async () => {
    hydrate(
      [
        connectorNode('connectors_1', [
          { sourceServerId: 'srv-1', url: 'https://x', displayName: 'Linear' },
        ]),
      ],
      'connectors_1',
    );
    renderWithProviders(<ConnectorPanel />, { services: services([connector()]) });

    await userEvent.click(screen.getByRole('button', { name: /Add a connector/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/No connectors to add/)).toBeInTheDocument();
  });

  it('hands off to the register wizard from the add dialog', async () => {
    hydrate([connectorNode('connectors_1')], 'connectors_1');
    renderWithProviders(<ConnectorPanel />, { services: services([]) });

    await userEvent.click(screen.getByRole('button', { name: /Add a connector/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: /Register a new connector/ }),
    );
    expect(await screen.findByTestId('register-wizard')).toBeInTheDocument();
  });

  it('expands a connector row to show its enabled tools as a checklist', async () => {
    hydrate(
      [
        connectorNode('connectors_1', [
          { sourceServerId: 'srv-1', url: 'https://x', displayName: 'Linear' },
        ]),
      ],
      'connectors_1',
    );
    renderWithProviders(<ConnectorPanel />, {
      services: services([], [tool(), tool({ id: 't2', apiName: 'mcp.update_issue' })]),
    });

    // The collapsible row toggle is the (collapsed) button labelling the
    // connector — distinct from the "Remove Linear" button.
    const toggle = screen.getByRole('button', { name: /Linear/, expanded: false });
    await userEvent.click(toggle);

    expect(screen.getByText('mcp.create_issue')).toBeInTheDocument();
    expect(screen.getByText('mcp.update_issue')).toBeInTheDocument();
    // Both checked by default ("all tools").
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(2);
    boxes.forEach((b) => expect(b).toBeChecked());
  });

  it('narrows the per-connector tool selection to a strict subset', async () => {
    hydrate(
      [
        connectorNode('connectors_1', [
          { sourceServerId: 'srv-1', url: 'https://x', displayName: 'Linear' },
        ]),
      ],
      'connectors_1',
    );
    renderWithProviders(<ConnectorPanel />, {
      services: services([], [tool(), tool({ id: 't2', apiName: 'mcp.update_issue' })]),
    });

    await userEvent.click(screen.getByRole('button', { name: /Linear/, expanded: false }));
    // Uncheck one -> selection becomes the strict subset of the remaining one.
    const boxes = screen.getAllByRole('checkbox');
    await userEvent.click(boxes[0]);

    const node = useFlowEditorStore.getState().nodes.find((n) => n.id === 'connectors_1');
    const selected = (node!.data as ConnectorNodeData).connectors[0].selectedTools;
    expect(selected).toHaveLength(1);
  });

  it('deletes the connector node on confirm', async () => {
    hydrate([connectorNode('connectors_1')], 'connectors_1');
    renderWithProviders(<ConnectorPanel />, { services: services() });

    await userEvent.click(screen.getByRole('button', { name: /Delete connector node/ }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^Delete$/ }));
    expect(
      useFlowEditorStore.getState().nodes.find((n) => n.id === 'connectors_1'),
    ).toBeUndefined();
  });
});
