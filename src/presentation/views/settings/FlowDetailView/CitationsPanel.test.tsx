import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Node, Edge } from 'reactflow';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import { CitationsPanel } from './CitationsPanel';
import { useFlowEditorStore } from './useFlowEditorStore';
import {
  NODE_TYPE_CITATIONS,
  NODE_TYPE_BOUNDARY,
  NODE_END,
  CITATIONS_DEFAULT_SOURCES_SLOT,
  CITATIONS_DEFAULT_DRAFT_SLOT,
  CITATIONS_DEFAULT_OUTPUT_SLOT,
  type CitationsNodeData,
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

const citationsNode = (
  id: string,
  data: Partial<CitationsNodeData> = {},
): Node<CitationsNodeData> => ({
  id,
  type: NODE_TYPE_CITATIONS,
  position: { x: 0, y: 0 },
  data: { nodeId: id, ...data },
});

const endNode = (): Node<BoundaryNodeData> => ({
  id: NODE_END,
  type: NODE_TYPE_BOUNDARY,
  position: { x: 0, y: 0 },
  data: { boundary: NODE_END },
});

function hydrate(nodes: Node[], selectId: string) {
  useFlowEditorStore.getState().reset();
  useFlowEditorStore
    .getState()
    .hydrate({ meta: META, nodes: nodes as never, edges: [] as Edge[] as never });
  useFlowEditorStore.getState().selectNode(selectId);
}

const dataOf = (id: string) =>
  useFlowEditorStore.getState().nodes.find((n) => n.id === id)!.data as CitationsNodeData;

beforeEach(() => useFlowEditorStore.getState().reset());

describe('CitationsPanel', () => {
  it('renders nothing when the selected node is not a citations node', () => {
    hydrate([endNode()], NODE_END);
    const { container } = renderWithProviders(<CitationsPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the three slot inputs with the BE defaults as placeholders (blank when unset)', () => {
    hydrate([citationsNode('citations_1')], 'citations_1');
    renderWithProviders(<CitationsPanel />);

    expect(screen.getByRole('heading', { name: 'Citations' })).toBeInTheDocument();
    const sources = screen.getByLabelText('Sources slot') as HTMLInputElement;
    const draft = screen.getByLabelText('Draft slot') as HTMLInputElement;
    const output = screen.getByLabelText('Output slot') as HTMLInputElement;
    expect(sources.value).toBe('');
    expect(sources.placeholder).toBe(CITATIONS_DEFAULT_SOURCES_SLOT);
    expect(draft.placeholder).toBe(CITATIONS_DEFAULT_DRAFT_SLOT);
    expect(output.placeholder).toBe(CITATIONS_DEFAULT_OUTPUT_SLOT);
  });

  it('reflects overridden slot values from the node data', () => {
    hydrate([citationsNode('citations_1', { sourcesSlot: 'srcs', outputSlot: 'report' })], 'citations_1');
    renderWithProviders(<CitationsPanel />);
    expect((screen.getByLabelText('Sources slot') as HTMLInputElement).value).toBe('srcs');
    expect((screen.getByLabelText('Output slot') as HTMLInputElement).value).toBe('report');
  });

  it('writes a typed slot override to the store', async () => {
    hydrate([citationsNode('citations_1')], 'citations_1');
    renderWithProviders(<CitationsPanel />);

    await userEvent.type(screen.getByLabelText('Sources slot'), 'srcs');
    expect(dataOf('citations_1').sourcesSlot).toBe('srcs');
  });

  it('clears a slot back to undefined when emptied (so the BE default applies)', async () => {
    hydrate([citationsNode('citations_1', { sourcesSlot: 'x' })], 'citations_1');
    renderWithProviders(<CitationsPanel />);

    await userEvent.clear(screen.getByLabelText('Sources slot'));
    expect(dataOf('citations_1').sourcesSlot).toBeUndefined();
  });

  it('deletes the citations node on confirm', async () => {
    hydrate([citationsNode('citations_1')], 'citations_1');
    renderWithProviders(<CitationsPanel />);

    await userEvent.click(screen.getByRole('button', { name: /Delete citations node/ }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^Delete$/ }));
    expect(
      useFlowEditorStore.getState().nodes.find((n) => n.id === 'citations_1'),
    ).toBeUndefined();
  });
});
