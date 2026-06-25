import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import { ERRORS } from '@/constants/errors';
import type { Services } from '@/presentation/providers/ServiceContext';
import type { Agent } from '@/domain/types/agent.types';
import AgentsView from './AgentsView';

/**
 * Tier 1 tests for the Agents settings page.
 *
 * Focus: the loading / error / empty / list branches, the onboarding banner
 * gating (shown only when no default agent exists), and the per-row actions
 * (set-default, the default-agent archive suppression). The create/edit modal
 * (AgentFormModal) is covered by its own spec; here we only confirm it opens.
 */

/** Build an Agent row with sensible defaults. */
function agent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'a1',
    apiName: 'my-assistant',
    displayName: 'My Assistant',
    description: null,
    systemPrompt: 'You are helpful.',
    tools: [],
    isDefault: false,
    status: 'active',
    metadata: {},
    createdAt: '2024-01-01T00:00:00Z',
    modifiedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * AgentsView reads `agentService` (list, getDefaultTemplate, setDefault,
 * archive) plus `agentTemplateService` for the embedded system-templates
 * section (stubbed empty here so it renders nothing — it has its own spec).
 */
function services(
  list: () => Promise<Agent[]>,
  overrides: Record<string, unknown> = {},
): Partial<Services> {
  return {
    agentService: {
      list,
      getDefaultTemplate: vi.fn().mockResolvedValue({
        apiName: 'default-assistant',
        displayName: 'Default Assistant',
        description: 'Starter',
        systemPrompt: 'You are the default.',
        tools: [],
      }),
      setDefault: vi.fn().mockResolvedValue(agent({ isDefault: true })),
      archive: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    } as never,
    agentTemplateService: {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn(),
      activate: vi.fn(),
    } as never,
  };
}

describe('AgentsView', () => {
  it('shows the loading state while the agents query is pending', () => {
    renderWithProviders(<AgentsView />, {
      services: services(() => new Promise(() => {})),
    });
    expect(screen.getByText('Loading agents…')).toBeInTheDocument();
  });

  it('shows the load error when the agents query rejects', async () => {
    renderWithProviders(<AgentsView />, {
      services: services(() => Promise.reject(new Error('boom'))),
    });
    // Both the onboarding banner and the error use role=alert; assert by text.
    expect(await screen.findByText(ERRORS.AGT_001.message)).toBeInTheDocument();
  });

  it('renders the empty state when the user has no agents', async () => {
    renderWithProviders(<AgentsView />, {
      services: services(() => Promise.resolve([])),
    });
    expect(
      await screen.findByText('No agents yet. Create your default agent to start chatting.'),
    ).toBeInTheDocument();
  });

  it('shows the onboarding banner when no agent is the default', async () => {
    renderWithProviders(<AgentsView />, {
      services: services(() => Promise.resolve([agent({ isDefault: false })])),
    });
    expect(
      await screen.findByText(/You don't have a default agent yet/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create default agent' }),
    ).toBeInTheDocument();
  });

  it('hides the onboarding banner once a default agent exists', async () => {
    renderWithProviders(<AgentsView />, {
      services: services(() => Promise.resolve([agent({ isDefault: true })])),
    });
    await screen.findByText('My Assistant');
    expect(screen.queryByText(/You don't have a default agent yet/)).not.toBeInTheDocument();
  });

  it('lists agents with their handle and the Default badge on the default row', async () => {
    renderWithProviders(<AgentsView />, {
      services: services(() =>
        Promise.resolve([
          agent({ id: 'a1', displayName: 'Helper', apiName: 'helper', isDefault: true }),
          agent({ id: 'a2', displayName: 'Coder', apiName: 'coder' }),
        ]),
      ),
    });

    expect(await screen.findByText('Helper')).toBeInTheDocument();
    expect(screen.getByText('Coder')).toBeInTheDocument();
    expect(screen.getByText('helper')).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('offers Set default only on non-default active agents and calls setDefault on click', async () => {
    const setDefault = vi.fn().mockResolvedValue(agent({ isDefault: true }));
    renderWithProviders(<AgentsView />, {
      services: services(
        () =>
          Promise.resolve([
            agent({ id: 'a1', displayName: 'Helper', isDefault: true }),
            agent({ id: 'a2', displayName: 'Coder', isDefault: false }),
          ]),
        { setDefault },
      ),
    });
    await screen.findByText('Coder');

    // Default row has no "Set ... as default" button.
    expect(
      screen.queryByRole('button', { name: 'Set Helper as default' }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Set Coder as default' }));
    expect(setDefault).toHaveBeenCalledWith('a2');
  });

  it('does not render an archive button for the default agent', async () => {
    renderWithProviders(<AgentsView />, {
      services: services(() =>
        Promise.resolve([agent({ id: 'a1', displayName: 'Helper', isDefault: true })]),
      ),
    });
    await screen.findByText('Helper');
    expect(
      screen.queryByRole('button', { name: 'Archive Helper' }),
    ).not.toBeInTheDocument();
  });

  it('opens the create modal via New agent', async () => {
    renderWithProviders(<AgentsView />, {
      services: services(() => Promise.resolve([agent({ isDefault: true })])),
    });
    await screen.findByText('My Assistant');

    await userEvent.click(screen.getByRole('button', { name: /new agent/i }));
    // The create form titles itself "New agent".
    expect(
      screen.getByRole('heading', { name: 'New agent' }),
    ).toBeInTheDocument();
  });

  it('shows the edit affordance per agent row', async () => {
    renderWithProviders(<AgentsView />, {
      services: services(() =>
        Promise.resolve([agent({ id: 'a1', displayName: 'Helper', isDefault: true })]),
      ),
    });
    const card = (await screen.findByText('Helper')).closest('li')!;
    expect(
      within(card).getByRole('button', { name: 'Edit Helper' }),
    ).toBeInTheDocument();
  });
});
