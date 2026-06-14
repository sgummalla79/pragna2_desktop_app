import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import type { Services } from '@/presentation/providers/ServiceContext';
import ConfigurationView from './ConfigurationView';

/**
 * Tier 1 tests for the Configuration page.
 *
 * ConfigurationView itself just composes the section cards, so the meaningful
 * coverage is the sections' own logic: the embedding-key status badge +
 * expand/save flow (`embeddingKeyService`), the knowledge / retrieval sub-form
 * revealed inside that same "Embeddings — Voyage" card
 * (`knowledgeSettingsService`), and the per-browser chat-action toggles
 * (localStorage via useChatPreferences). All render through the real
 * ConfigurationView so the composition is exercised too.
 */

/** A fully-resolved knowledge-settings object for the section's initial query. */
const KNOWLEDGE_SETTINGS = {
  embeddingProvider: 'voyage',
  embeddingDimensions: 1024,
  embeddingModel: 'voyage-3-large',
  chunkMaxTokens: 512,
  chunkOverlapTokens: 64,
  rerankEnabled: true,
  rerankModel: 'rerank-2.5',
  searchDenseK: 50,
  searchSparseK: 50,
  rrfK: 60,
  rerankCandidates: 30,
  searchTopK: 8,
  cagMaxSourceTokens: 180000,
};

/** ConfigurationView reads `embeddingKeyService` (status/set/clear) and
 *  `knowledgeSettingsService` (get/update). The chat actions section uses only
 *  localStorage. */
function services(overrides: Record<string, unknown> = {}): Partial<Services> {
  return {
    embeddingKeyService: {
      getStatus: vi.fn().mockResolvedValue({ hasVoyageKey: false }),
      setKey: vi.fn().mockResolvedValue({ hasVoyageKey: true }),
      clearKey: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    } as never,
    knowledgeSettingsService: {
      get: vi.fn().mockResolvedValue(KNOWLEDGE_SETTINGS),
      update: vi.fn().mockResolvedValue(KNOWLEDGE_SETTINGS),
    } as never,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('ConfigurationView', () => {
  it('renders the page heading and both section cards', async () => {
    renderWithProviders(<ConfigurationView />, { services: services() });

    expect(screen.getByRole('heading', { name: 'Configuration', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Embeddings — Voyage')).toBeInTheDocument();
    expect(screen.getByText('Chat actions')).toBeInTheDocument();
    // Status resolves to "Not configured" for an absent key.
    expect(await screen.findByText('Not configured')).toBeInTheDocument();
  });

  it('reveals the Knowledge & retrieval sub-form inside the Embeddings card', async () => {
    renderWithProviders(<ConfigurationView />, { services: services() });
    await screen.findByText('Not configured');

    // The knowledge fields live inside the Embeddings — Voyage accordion, so
    // they appear only once that card is expanded.
    await userEvent.click(screen.getByTestId('embedding-key-toggle'));
    expect(await screen.findByText('Knowledge & retrieval')).toBeInTheDocument();
  });

  it('shows the Configured badge when a key is already set', async () => {
    renderWithProviders(<ConfigurationView />, {
      services: services({ getStatus: vi.fn().mockResolvedValue({ hasVoyageKey: true }) }),
    });
    expect(await screen.findByText('Configured')).toBeInTheDocument();
  });

  it('expands the embedding-key card and saves a trimmed key via setKey', async () => {
    const setKey = vi.fn().mockResolvedValue({ hasVoyageKey: true });
    renderWithProviders(<ConfigurationView />, { services: services({ setKey }) });
    await screen.findByText('Not configured');

    await userEvent.click(screen.getByTestId('embedding-key-toggle'));
    const input = screen.getByLabelText('Voyage API key');
    await userEvent.type(input, '  pa-secret  ');
    await userEvent.click(screen.getByRole('button', { name: 'Save key' }));

    await waitFor(() => expect(setKey).toHaveBeenCalledWith('pa-secret'));
  });

  it('keeps Save disabled while the key input is empty', async () => {
    renderWithProviders(<ConfigurationView />, { services: services() });
    await screen.findByText('Not configured');
    await userEvent.click(screen.getByTestId('embedding-key-toggle'));

    expect(screen.getByRole('button', { name: 'Save key' })).toBeDisabled();
  });

  it('renders both chat-action toggles checked by default', () => {
    renderWithProviders(<ConfigurationView />, { services: services() });

    const regen = screen.getByRole('checkbox', {
      name: /Regenerate with a different model/,
    });
    const branch = screen.getByRole('checkbox', { name: /Branch from a user message/ });
    expect(regen).toBeChecked();
    expect(branch).toBeChecked();
  });

  it('persists a chat-action toggle to localStorage when unchecked', async () => {
    renderWithProviders(<ConfigurationView />, { services: services() });

    const branch = screen.getByRole('checkbox', { name: /Branch from a user message/ });
    await userEvent.click(branch);

    expect(branch).not.toBeChecked();
    const stored = JSON.parse(localStorage.getItem('pragna:chat-prefs') ?? '{}');
    expect(stored.branchEnabled).toBe(false);
  });
});
