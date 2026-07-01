import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import type { Services } from '@/presentation/providers/ServiceContext';
import { EmbeddingKeySection } from './EmbeddingKeySection';

/**
 * Tier 1 tests for the Embeddings — Voyage card (moved from the Configuration
 * page to the Knowledge page, alongside the libraries it powers).
 *
 * Covers the embedding-key status badge + expand/save flow
 * (`embeddingKeyService`), the knowledge / retrieval sub-form revealed inside
 * the same accordion (`knowledgeSettingsService`), and the instructions sheet.
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

/** EmbeddingKeySection reads `embeddingKeyService` (status/set/clear) and
 *  `knowledgeSettingsService` (get/update, inside the expanded sub-form). */
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

describe('EmbeddingKeySection', () => {
  it('renders the Embeddings — Voyage card with the instructions button', async () => {
    renderWithProviders(<EmbeddingKeySection />, { services: services() });

    expect(screen.getByText('Embeddings — Voyage')).toBeInTheDocument();
    // Status resolves to "Not configured" for an absent key.
    expect(await screen.findByText('Not configured')).toBeInTheDocument();
    // Instructions button is visible without expanding.
    expect(screen.getByTestId('voyage-instructions-btn')).toBeInTheDocument();
  });

  it('reveals the Knowledge & retrieval sub-form when the card is expanded', async () => {
    renderWithProviders(<EmbeddingKeySection />, { services: services() });
    await screen.findByText('Not configured');

    // The knowledge fields live inside the Embeddings — Voyage accordion, so
    // they appear only once that card is expanded.
    await userEvent.click(screen.getByTestId('embedding-key-toggle'));
    expect(await screen.findByText('Knowledge & retrieval')).toBeInTheDocument();
  });

  it('shows the Configured badge when a key is already set', async () => {
    renderWithProviders(<EmbeddingKeySection />, {
      services: services({ getStatus: vi.fn().mockResolvedValue({ hasVoyageKey: true }) }),
    });
    expect(await screen.findByText('Configured')).toBeInTheDocument();
  });

  it('expands the card and saves a trimmed key via setKey', async () => {
    const setKey = vi.fn().mockResolvedValue({ hasVoyageKey: true });
    renderWithProviders(<EmbeddingKeySection />, { services: services({ setKey }) });
    await screen.findByText('Not configured');

    await userEvent.click(screen.getByTestId('embedding-key-toggle'));
    const input = screen.getByLabelText('Voyage API key');
    await userEvent.type(input, '  pa-secret  ');
    await userEvent.click(screen.getByRole('button', { name: 'Save key' }));

    await waitFor(() => expect(setKey).toHaveBeenCalledWith('pa-secret'));
  });

  it('keeps Save disabled while the key input is empty', async () => {
    renderWithProviders(<EmbeddingKeySection />, { services: services() });
    await screen.findByText('Not configured');
    await userEvent.click(screen.getByTestId('embedding-key-toggle'));

    expect(screen.getByRole('button', { name: 'Save key' })).toBeDisabled();
  });

  it('opens the voyage instructions sheet on Instructions click', async () => {
    renderWithProviders(<EmbeddingKeySection />, { services: services() });
    await screen.findByText('Not configured');

    await userEvent.click(screen.getByTestId('voyage-instructions-btn'));
    expect(await screen.findByText('Get a free Voyage API key')).toBeInTheDocument();
  });
});
