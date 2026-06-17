import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import { useFlowEditorStore } from './useFlowEditorStore';
import { FlowYamlActions } from './FlowYamlActions';

// Deterministic (de)serialisers — the import/export LOGIC is under test, not
// the YAML round-trip (covered by graphToYaml / buildEditorGraph tests).
const buildEditorGraph = vi.fn();
const graphToYaml = vi.fn(() => 'GENERATED: yaml');
vi.mock('./buildEditorGraph', () => ({ buildEditorGraph: (s: string) => buildEditorGraph(s) }));
vi.mock('./graphToYaml', () => ({ graphToYaml: () => graphToYaml() }));

const FAKE_GRAPH = {
  meta: {
    apiName: 'imported',
    displayName: 'Imported',
    description: 'desc',
    slashApiName: null,
    exposedAsSlash: false,
    metadata: {},
  },
  nodes: [],
  edges: [],
};

beforeEach(() => {
  useFlowEditorStore.getState().reset();
  buildEditorGraph.mockReset().mockReturnValue(FAKE_GRAPH);
  graphToYaml.mockClear();
});
afterEach(() => vi.restoreAllMocks());

describe('FlowYamlActions — export', () => {
  it('downloads the serialised canvas as <api_name>.yaml', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const realCreate = document.createElement.bind(document);
    let anchor: HTMLAnchorElement | null = null;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === 'a') anchor = el as HTMLAnchorElement;
      return el;
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderWithProviders(<FlowYamlActions apiName="research" />);
    await userEvent.click(screen.getByRole('button', { name: /Export/ }));

    expect(graphToYaml).toHaveBeenCalled();
    expect(anchor!.download).toBe('research.yaml');
  });

  it('falls back to the brand filename when api_name is empty', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const realCreate = document.createElement.bind(document);
    let anchor: HTMLAnchorElement | null = null;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === 'a') anchor = el as HTMLAnchorElement;
      return el;
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderWithProviders(<FlowYamlActions apiName="" />);
    await userEvent.click(screen.getByRole('button', { name: /Export/ }));
    expect(anchor!.download).toBe('agentic-flow.yaml');
  });
});

describe('FlowYamlActions — import', () => {
  it('replaces the canvas and marks dirty on a clean parse', async () => {
    renderWithProviders(<FlowYamlActions apiName="research" />);
    await userEvent.click(screen.getByRole('button', { name: /Import/ }));
    await userEvent.type(screen.getByLabelText('YAML document'), 'api_name: imported');
    await userEvent.click(screen.getByRole('button', { name: 'Replace canvas' }));

    await waitFor(() =>
      expect(useFlowEditorStore.getState().meta.apiName).toBe('imported'),
    );
    expect(useFlowEditorStore.getState().dirty).toBe(true);
  });

  it('shows an error and leaves the canvas untouched on a malformed document', async () => {
    buildEditorGraph.mockImplementation(() => {
      throw new Error('bad yaml');
    });
    renderWithProviders(<FlowYamlActions apiName="research" />);
    await userEvent.click(screen.getByRole('button', { name: /Import/ }));
    await userEvent.type(screen.getByLabelText('YAML document'), 'totally-malformed');
    await userEvent.click(screen.getByRole('button', { name: 'Replace canvas' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    // Canvas not replaced.
    expect(useFlowEditorStore.getState().meta.apiName).not.toBe('imported');
  });
});
