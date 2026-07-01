import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Node, Edge } from 'reactflow';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import type { KnowledgeLibrary } from '@/domain/types/knowledge.types';
import { KnowledgePanel } from './KnowledgePanel';
import { useFlowEditorStore } from './useFlowEditorStore';
import {
  NODE_TYPE_KNOWLEDGE,
  NODE_TYPE_BOUNDARY,
  NODE_END,
  type KnowledgeNodeData,
  type EditorLibrary,
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

const knowledgeNode = (
  id: string,
  libraries: EditorLibrary[] = [],
): Node<KnowledgeNodeData> => ({
  id,
  type: NODE_TYPE_KNOWLEDGE,
  position: { x: 0, y: 0 },
  data: { nodeId: id, libraries },
});

const endNode = (): Node<BoundaryNodeData> => ({
  id: NODE_END,
  type: NODE_TYPE_BOUNDARY,
  position: { x: 0, y: 0 },
  data: { boundary: NODE_END },
});

function library(over: Partial<KnowledgeLibrary> = {}): KnowledgeLibrary {
  return {
    id: 'lib-1',
    slug: 'handbook',
    name: 'Company Handbook',
    description: null,
    embeddingModel: 'text-embed',
    embeddingDimensions: 1536,
    status: 'active',
    isSystem: false,
    createdAt: '',
    modifiedAt: '',
    ...over,
  };
}

/** Service the KnowledgePanel reads: knowledgeService.listLibraries. */
function services(libraries: KnowledgeLibrary[] = []) {
  return {
    knowledgeService: { listLibraries: () => Promise.resolve(libraries) },
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

describe('KnowledgePanel', () => {
  it('renders nothing when the selected node is not a knowledge node', () => {
    hydrate([endNode()], NODE_END);
    const { container } = renderWithProviders(<KnowledgePanel />, { services: services() });
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the empty state when the node has no libraries', () => {
    hydrate([knowledgeNode('knowledge_1')], 'knowledge_1');
    renderWithProviders(<KnowledgePanel />, { services: services() });
    expect(screen.getByRole('heading', { name: 'Knowledge' })).toBeInTheDocument();
    expect(screen.getByText('No libraries added yet.')).toBeInTheDocument();
  });

  it('lists attached libraries by display name + slug', () => {
    hydrate(
      [
        knowledgeNode('knowledge_1', [
          { sourceLibraryId: 'lib-1', slug: 'handbook', displayName: 'Company Handbook' },
        ]),
      ],
      'knowledge_1',
    );
    renderWithProviders(<KnowledgePanel />, { services: services() });
    expect(screen.getByText('Company Handbook')).toBeInTheDocument();
    expect(screen.getByText('handbook')).toBeInTheDocument();
  });

  it('removes an attached library via its remove button', async () => {
    hydrate(
      [
        knowledgeNode('knowledge_1', [
          { sourceLibraryId: 'lib-1', slug: 'handbook', displayName: 'Company Handbook' },
        ]),
      ],
      'knowledge_1',
    );
    renderWithProviders(<KnowledgePanel />, { services: services() });

    await userEvent.click(screen.getByRole('button', { name: 'Remove Company Handbook' }));
    const node = useFlowEditorStore.getState().nodes.find((n) => n.id === 'knowledge_1');
    expect((node!.data as KnowledgeNodeData).libraries).toHaveLength(0);
  });

  it('adds an available library from the add dialog (updateLibraries)', async () => {
    hydrate([knowledgeNode('knowledge_1')], 'knowledge_1');
    renderWithProviders(<KnowledgePanel />, { services: services([library()]) });

    await userEvent.click(screen.getByRole('button', { name: /Add a library/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /Company Handbook/ }));

    const node = useFlowEditorStore.getState().nodes.find((n) => n.id === 'knowledge_1');
    expect((node!.data as KnowledgeNodeData).libraries.map((l) => l.sourceLibraryId)).toEqual([
      'lib-1',
    ]);
  });

  it('shows "no libraries to add" when all are already attached', async () => {
    hydrate(
      [
        knowledgeNode('knowledge_1', [
          { sourceLibraryId: 'lib-1', slug: 'handbook', displayName: 'Company Handbook' },
        ]),
      ],
      'knowledge_1',
    );
    renderWithProviders(<KnowledgePanel />, { services: services([library()]) });

    await userEvent.click(screen.getByRole('button', { name: /Add a library/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/No libraries to add/)).toBeInTheDocument();
  });

  it('deletes the knowledge node on confirm', async () => {
    hydrate([knowledgeNode('knowledge_1')], 'knowledge_1');
    renderWithProviders(<KnowledgePanel />, { services: services() });

    await userEvent.click(screen.getByRole('button', { name: /Delete knowledge node/ }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^Delete$/ }));
    expect(
      useFlowEditorStore.getState().nodes.find((n) => n.id === 'knowledge_1'),
    ).toBeUndefined();
  });
});
