import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import { ERRORS } from '@/constants/errors';
import type { Services } from '@/presentation/providers/ServiceContext';
import type { LlmProviderWithRegistrations } from '@/domain/types/provider.types';
import ProvidersView from './ProvidersView';

/**
 * Tier 1 component-integration tests for the Providers settings page.
 *
 * Covers the four list/empty/loading/error branches plus the connected tile
 * affordance and the enable/disable toggle wiring. The provider modal opens on
 * tile click; its internals are exercised by their own (deferred) specs — here
 * we only assert ProvidersView's own branching and the toggle service call.
 */

/** Build a provider catalogue row, connected or not, for the listWithRegistrations mock. */
function provider(
  overrides: Partial<LlmProviderWithRegistrations> = {},
): LlmProviderWithRegistrations {
  return {
    id: 'llm-1',
    name: 'anthropic',
    displayName: 'Anthropic',
    credentialKind: 'api_key',
    enabled: true,
    userProviders: [],
    ...overrides,
  };
}

/** A connected user-provider sub-row (enabled state configurable). */
function connectedRow(id: string, enabled: boolean) {
  return {
    id,
    llmProviderId: 'llm-1',
    providerName: 'anthropic',
    enabled,
    metadata: {},
    models: [],
  };
}

/** ProvidersView reads only `llmProviderService` (list) and `providerService` (mutations). */
function services(
  listWithRegistrations: () => Promise<LlmProviderWithRegistrations[]>,
  providerOverrides: Record<string, unknown> = {},
): Partial<Services> {
  return {
    llmProviderService: { listWithRegistrations } as never,
    providerService: {
      register: vi.fn(),
      refreshModels: vi.fn(),
      delete: vi.fn(),
      toggle: vi.fn().mockResolvedValue(undefined),
      ...providerOverrides,
    } as never,
  };
}

describe('ProvidersView', () => {
  it('shows the loading state while the catalogue query is pending', () => {
    // A never-resolving query keeps isLoading true.
    renderWithProviders(<ProvidersView />, {
      services: services(() => new Promise(() => {})),
    });
    expect(screen.getByText('Loading providers…')).toBeInTheDocument();
  });

  it('shows the catalogue-load error when the query rejects', async () => {
    renderWithProviders(<ProvidersView />, {
      services: services(() => Promise.reject(new Error('boom'))),
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(ERRORS.PRV_005.message);
  });

  it('renders the empty state when the catalogue is empty', async () => {
    renderWithProviders(<ProvidersView />, {
      services: services(() => Promise.resolve([])),
    });
    expect(await screen.findByText('No providers available')).toBeInTheDocument();
  });

  it('renders a tile per provider with its connected/not-connected badge', async () => {
    renderWithProviders(<ProvidersView />, {
      services: services(() =>
        Promise.resolve([
          provider({ id: 'a', displayName: 'Anthropic', userProviders: [] }),
          provider({
            id: 'b',
            name: 'openai',
            displayName: 'OpenAI',
            userProviders: [connectedRow('up-b', true)],
          }),
        ]),
      ),
    });

    expect(await screen.findByText('Anthropic')).toBeInTheDocument();
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('Not connected')).toBeInTheDocument();
    expect(screen.getByText('Connected ✓')).toBeInTheDocument();
  });

  it('shows the enable/disable pill only on a connected tile', async () => {
    renderWithProviders(<ProvidersView />, {
      services: services(() =>
        Promise.resolve([
          provider({ id: 'a', userProviders: [] }),
          provider({
            id: 'b',
            name: 'openai',
            displayName: 'OpenAI',
            userProviders: [connectedRow('up-b', true)],
          }),
        ]),
      ),
    });
    await screen.findByText('Anthropic');

    // Enabled connected provider exposes a "Disable provider" pill; the
    // not-connected one exposes none.
    expect(screen.getByRole('button', { name: 'Disable provider' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enable provider' })).not.toBeInTheDocument();
  });

  it('toggling a connected provider calls providerService.toggle with the flipped state', async () => {
    const toggle = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<ProvidersView />, {
      services: services(
        () =>
          Promise.resolve([
            provider({
              id: 'b',
              name: 'openai',
              displayName: 'OpenAI',
              userProviders: [connectedRow('up-b', true)],
            }),
          ]),
        { toggle },
      ),
    });
    await screen.findByText('OpenAI');

    await userEvent.click(screen.getByRole('button', { name: 'Disable provider' }));
    expect(toggle).toHaveBeenCalledWith('up-b', false);
  });

  it('renders a count badge for a multi-instance provider and lists its registrations with an add-another form', async () => {
    const gateway = provider({
      id: 'gw',
      name: 'gateway',
      displayName: 'LLM Gateway',
      credentialKind: 'gateway',
      allowsMultipleRegistrations: true,
      userProviders: [
        { ...connectedRow('up-prod', true), label: 'prod', providerName: 'gateway' },
        { ...connectedRow('up-staging', true), label: 'staging', providerName: 'gateway' },
      ],
    } as never);

    renderWithProviders(<ProvidersView />, {
      services: services(() => Promise.resolve([gateway])),
    });
    await screen.findByText('LLM Gateway');

    // Tile shows the connection count instead of a single "Connected" badge.
    expect(screen.getByText('2 connected')).toBeInTheDocument();
    // No single-instance enable/disable pill on a multi-instance tile.
    expect(screen.queryByRole('button', { name: /able provider/ })).not.toBeInTheDocument();

    // Open the modal → master-detail list view.
    await userEvent.click(screen.getByText('LLM Gateway'));

    // Both registrations are listed by label, plus the add-another form.
    expect(await screen.findByText('prod')).toBeInTheDocument();
    expect(screen.getByText('staging')).toBeInTheDocument();
    expect(screen.getByText('Add another connection')).toBeInTheDocument();
    // The connect form shows the label field + the gateway credential fields.
    expect(screen.getByLabelText('Label')).toBeInTheDocument();
    expect(screen.getByLabelText('Gateway URL')).toBeInTheDocument();
    expect(screen.getByLabelText('Auth Token')).toBeInTheDocument();
  });
});
