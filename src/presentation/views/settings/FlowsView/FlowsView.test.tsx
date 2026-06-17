import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import { ERRORS } from '@/constants/errors';
import type { Flow } from '@/domain/types/flow.types';
import FlowsView from './FlowsView';

// FlowsView itself reads only `useFlows` (flowService.list). Its FlowCard
// children additionally use the slash/delete mutations, but those aren't
// invoked at render — we only need flowService for the list query.

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

/** A flowService stub exposing only what FlowsView + its cards read. */
function flowService(list: () => Promise<Flow[]>) {
  return {
    flowService: {
      list,
      get: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      validateYaml: vi.fn(),
      saveFromYamlById: vi.fn(),
      saveFromYaml: vi.fn(),
      updateFlow: vi.fn(),
      updateSlashExposure: vi.fn(),
    },
  } as never;
}

describe('FlowsView', () => {
  it('renders the header + description', async () => {
    renderWithProviders(<FlowsView />, { services: flowService(() => Promise.resolve([])) });
    expect(screen.getByRole('heading', { name: /Agent Flows/ })).toBeInTheDocument();
    expect(await screen.findByText(/No flows yet/)).toBeInTheDocument();
  });

  it('shows the empty state when there are no flows', async () => {
    renderWithProviders(<FlowsView />, { services: flowService(() => Promise.resolve([])) });
    expect(
      await screen.findByText('No flows yet. Create your first flow to get started.'),
    ).toBeInTheDocument();
  });

  it('renders one card per flow once loaded', async () => {
    const flows = [
      makeFlow({ id: 'a', displayName: 'Alpha', apiName: 'alpha' }),
      makeFlow({ id: 'b', displayName: 'Beta', apiName: 'beta' }),
    ];
    renderWithProviders(<FlowsView />, { services: flowService(() => Promise.resolve(flows)) });
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.queryByText(/No flows yet/)).not.toBeInTheDocument();
  });

  it('toggles a flow enabled/disabled from the card without opening the editor', async () => {
    const updateFlow = vi.fn(() => Promise.resolve(makeFlow({ enabled: false })));
    const services = {
      flowService: {
        list: () => Promise.resolve([makeFlow({ enabled: true })]),
        get: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
        validateYaml: vi.fn(),
        saveFromYamlById: vi.fn(),
        saveFromYaml: vi.fn(),
        updateFlow,
        updateSlashExposure: vi.fn(),
      },
    } as never;
    renderWithProviders(<FlowsView />, { services });
    await userEvent.click(await screen.findByRole('button', { name: 'Enabled' }));
    await waitFor(() =>
      expect(updateFlow).toHaveBeenCalledWith('flow-1', { enabled: false }),
    );
  });

  it('renders the FLW_001 error message when the list query fails', async () => {
    renderWithProviders(<FlowsView />, {
      services: flowService(() => Promise.reject(new Error('boom'))),
    });
    expect(await screen.findByText(ERRORS.FLW_001.message)).toBeInTheDocument();
  });
});
