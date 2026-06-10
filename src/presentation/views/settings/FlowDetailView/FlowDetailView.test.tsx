import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import type { Flow } from '@/domain/types/flow.types';
import FlowDetailView from './FlowDetailView';

// FlowDetailView mounts <FlowEditor flow={flow} />, which renders the real
// ReactFlow canvas — painful in jsdom and out of scope here (FlowEditor has
// its own test). Stub it so we test only the page chrome: header, status
// pills, loading/error branches, and that the loaded flow is fed in.
vi.mock('./FlowEditor', () => ({
  FlowEditor: ({ flow }: { flow: Flow }) => (
    <div data-testid="flow-editor-stub">{flow.displayName}</div>
  ),
}));

function makeFlow(over: Partial<Flow> = {}): Flow {
  return {
    id: 'flow-1',
    apiName: 'research',
    displayName: 'Research Flow',
    description: null,
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

function flowService(get: (id: string) => Promise<Flow>) {
  return {
    flowService: {
      list: vi.fn(),
      get,
      create: vi.fn(),
      delete: vi.fn(),
      validateYaml: vi.fn(),
      saveFromYamlById: vi.fn(),
      saveFromYaml: vi.fn(),
      updateSlashExposure: vi.fn(),
    },
  } as never;
}

/** Render FlowDetailView under a route so `useParams().flowId` resolves. */
function renderAt(flowId: string, services: ReturnType<typeof flowService>) {
  return renderWithProviders(
    <Routes>
      <Route path="/settings/flows/:flowId" element={<FlowDetailView />} />
    </Routes>,
    { services, initialEntries: [`/settings/flows/${flowId}`] },
  );
}

describe('FlowDetailView', () => {
  it('shows the loading state while the flow query is pending', () => {
    renderAt('flow-1', flowService(() => new Promise<Flow>(() => {})));
    expect(screen.getByText('Loading flow…')).toBeInTheDocument();
  });

  it('renders the header + feeds the loaded flow into the editor', async () => {
    const flow = makeFlow();
    renderAt('flow-1', flowService(() => Promise.resolve(flow)));

    expect(await screen.findByRole('heading', { name: 'Research Flow' })).toBeInTheDocument();
    // api_name pill.
    expect(screen.getByText('research')).toBeInTheDocument();
    // Editor stub received the loaded flow.
    expect(screen.getByTestId('flow-editor-stub')).toHaveTextContent('Research Flow');
  });

  it('renders the slash pill only when exposed with a slash name', async () => {
    const flow = makeFlow({ exposedAsSlash: true, slashApiName: 'do-research' });
    renderAt('flow-1', flowService(() => Promise.resolve(flow)));
    expect(await screen.findByText('/do-research')).toBeInTheDocument();
  });

  it('hides the slash pill when not exposed', async () => {
    const flow = makeFlow({ exposedAsSlash: false, slashApiName: 'do-research' });
    renderAt('flow-1', flowService(() => Promise.resolve(flow)));
    await screen.findByRole('heading', { name: 'Research Flow' });
    expect(screen.queryByText('/do-research')).not.toBeInTheDocument();
  });

  it('renders the error state with a Back link when the flow fails to load', async () => {
    renderAt('flow-1', flowService(() => Promise.reject(new Error('nope'))));
    expect(await screen.findByText('This flow could not be loaded.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Flows/ })).toBeInTheDocument();
  });
});
