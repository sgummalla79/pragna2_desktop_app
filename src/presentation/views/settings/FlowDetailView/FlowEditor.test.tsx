import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import type { Flow } from '@/domain/types/flow.types';
import { FlowEditor } from './FlowEditor';
import { useFlowEditorStore } from './useFlowEditorStore';
import type { YamlError } from '@/domain/types/flowYaml.types';

/**
 * Tier 1 (jsdom) SCOPE for FlowEditor: mount/hydrate from a flow, the
 * dirty/Save toolbar wiring, and the validate→save service round-trip
 * (including the validation-error branch). The real @xyflow/react canvas
 * (`reactflow`) does not lay out in jsdom — drag, edge drawing, node
 * positioning, fitView, and the Controls are DEFERRED to Tier 2 (browser).
 *
 * We mock the `reactflow` React surface (the <ReactFlow> canvas, Background,
 * Controls, ReactFlowProvider, useReactFlow) but keep its PURE graph helpers
 * (addEdge / applyNodeChanges / reconnectEdge …) real, because the Zustand
 * editor store imports them — stubbing those would break hydration.
 */
vi.mock('reactflow', async () => {
  const actual = await vi.importActual<typeof import('reactflow')>('reactflow');
  return {
    ...actual,
    __esModule: true,
    default: () => <div data-testid="rf-canvas" />,
    ReactFlowProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    Background: () => null,
    Controls: () => null,
    useReactFlow: () => ({
      screenToFlowPosition: (p: { x: number; y: number }) => p,
      project: (p: { x: number; y: number }) => p,
    }),
  };
});

// reactflow's CSS import is a no-op under the jsdom test env, but stub it so
// the resolver doesn't choke.
vi.mock('reactflow/dist/style.css', () => ({}));

function makeFlow(over: Partial<Flow> = {}): Flow {
  return {
    id: 'flow-1',
    apiName: 'research',
    displayName: 'Research Flow',
    description: 'A flow.',
    enabled: true,
    slashApiName: null,
    exposedAsSlash: false,
    metadata: {},
    definition: null,
    nodes: [],
    edges: [],
    ...over,
  };
}

interface ValidateResult {
  valid: boolean;
  errors: YamlError[];
}

/** flowService stub: only validateYaml + saveFromYamlById are exercised. */
function services(over: {
  validateYaml?: (def: string) => Promise<ValidateResult>;
  saveFromYamlById?: (id: string, def: string) => Promise<{ flow: Flow; created: boolean }>;
} = {}) {
  return {
    flowService: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      validateYaml:
        over.validateYaml ?? vi.fn(() => Promise.resolve({ valid: true, errors: [] })),
      saveFromYamlById:
        over.saveFromYamlById ??
        vi.fn((_id: string) => Promise.resolve({ flow: makeFlow(), created: false })),
      saveFromYaml: vi.fn(),
      updateSlashExposure: vi.fn(),
    },
  } as never;
}

beforeEach(() => useFlowEditorStore.getState().reset());

describe('FlowEditor (Tier 1: mount + save wiring)', () => {
  it('hydrates a fresh Start/End graph from an empty flow definition', async () => {
    renderWithProviders(<FlowEditor flow={makeFlow({ definition: null })} />, {
      services: services(),
    });

    // The mocked canvas mounted, and the store was seeded (meta from the flow).
    expect(screen.getByTestId('rf-canvas')).toBeInTheDocument();
    await waitFor(() => {
      expect(useFlowEditorStore.getState().meta.apiName).toBe('research');
    });
    // Fresh graph starts clean (not dirty) -> toolbar shows "Saved".
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save/ })).toBeDisabled();
  });

  it('enables Save once the store is dirty', async () => {
    renderWithProviders(<FlowEditor flow={makeFlow()} />, { services: services() });
    await waitFor(() => expect(useFlowEditorStore.getState().meta.apiName).toBe('research'));

    act(() => {
      useFlowEditorStore.getState().addAgentNode({ x: 0, y: 0 });
    });

    await waitFor(() => {
      expect(screen.getByText('Unsaved')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Save/ })).toBeEnabled();
    });
  });

  it('validates then saves and marks the model clean on success', async () => {
    const validateYaml = vi.fn(() => Promise.resolve({ valid: true, errors: [] }));
    const saveFromYamlById = vi.fn((_id: string) =>
      Promise.resolve({ flow: makeFlow({ displayName: 'Research Flow' }), created: false }),
    );
    renderWithProviders(<FlowEditor flow={makeFlow()} />, {
      services: services({ validateYaml, saveFromYamlById }),
    });
    await waitFor(() => expect(useFlowEditorStore.getState().meta.apiName).toBe('research'));

    // Make it dirty so Save is enabled.
    act(() => {
      useFlowEditorStore.getState().addAgentNode({ x: 0, y: 0 });
    });
    await waitFor(() => expect(screen.getByRole('button', { name: /Save/ })).toBeEnabled());

    await userEvent.click(screen.getByRole('button', { name: /Save/ }));

    await waitFor(() => {
      expect(validateYaml).toHaveBeenCalledTimes(1);
      expect(saveFromYamlById).toHaveBeenCalledTimes(1);
    });
    // First arg of saveFromYamlById is the flow id.
    expect(saveFromYamlById.mock.calls[0][0]).toBe('flow-1');
    await screen.findByText('Saved "Research Flow".');
    expect(useFlowEditorStore.getState().dirty).toBe(false);
  });

  it('surfaces validation errors and does NOT call save when invalid', async () => {
    const validateYaml = vi.fn(() =>
      Promise.resolve({
        valid: false,
        errors: [{ path: 'nodes[0]', message: 'missing model' }] as YamlError[],
      }),
    );
    const saveFromYamlById = vi.fn();
    renderWithProviders(<FlowEditor flow={makeFlow()} />, {
      services: services({ validateYaml, saveFromYamlById }),
    });
    await waitFor(() => expect(useFlowEditorStore.getState().meta.apiName).toBe('research'));

    act(() => {
      useFlowEditorStore.getState().addAgentNode({ x: 0, y: 0 });
    });
    await waitFor(() => expect(screen.getByRole('button', { name: /Save/ })).toBeEnabled());

    await userEvent.click(screen.getByRole('button', { name: /Save/ }));

    await waitFor(() => expect(validateYaml).toHaveBeenCalledTimes(1));
    expect(saveFromYamlById).not.toHaveBeenCalled();
    expect(await screen.findByText('1 issue blocking save')).toBeInTheDocument();
    expect(screen.getByText(/missing model/)).toBeInTheDocument();
    // Still dirty — the save was skipped.
    expect(useFlowEditorStore.getState().dirty).toBe(true);
  });
});
