import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import { ERRORS } from '@/constants/errors';
import type { Services } from '@/presentation/providers/ServiceContext';
import type { KnowledgeLibrary } from '@/domain/types/knowledge.types';
import KnowledgeView from './KnowledgeView';

/**
 * Tier 1 tests for the Knowledge settings page.
 *
 * Covers loading / error / empty / list branches and the inline
 * create-library form (toggle, submit-gating, and the service call with
 * trimmed payload). Library cards stay collapsed, so their documents manager
 * never queries — those expanded-card flows are deferred to Tier 2.
 */

/** Build a KnowledgeLibrary row. */
function library(overrides: Partial<KnowledgeLibrary> = {}): KnowledgeLibrary {
  return {
    id: 'lib-1',
    slug: 'docs',
    name: 'Docs',
    description: null,
    embeddingModel: 'voyage-3',
    embeddingDimensions: 1024,
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    modifiedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

/** KnowledgeView reads `knowledgeService` + `embeddingKeyService` (for the
 *  voyage-key gate). Pass `hasVoyageKey` to control gate state in tests. */
function services(
  listLibraries: () => Promise<KnowledgeLibrary[]>,
  overrides: Record<string, unknown> = {},
  hasVoyageKey = true,
): Partial<Services> {
  return {
    knowledgeService: {
      listLibraries,
      createLibrary: vi.fn().mockResolvedValue(library()),
      archiveLibrary: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    } as never,
    embeddingKeyService: {
      getStatus: vi.fn().mockResolvedValue({ hasVoyageKey }),
      setKey: vi.fn(),
      clearKey: vi.fn(),
    } as never,
  };
}

describe('KnowledgeView', () => {
  it('shows the loading state while libraries load', () => {
    renderWithProviders(<KnowledgeView />, {
      services: services(() => new Promise(() => {})),
    });
    expect(screen.getByText('Loading libraries…')).toBeInTheDocument();
  });

  it('shows the load error when the libraries query rejects', async () => {
    renderWithProviders(<KnowledgeView />, {
      services: services(() => Promise.reject(new Error('boom'))),
    });
    expect(await screen.findByText(ERRORS.KNW_001.message)).toBeInTheDocument();
  });

  it('renders the empty state when there are no libraries', async () => {
    renderWithProviders(<KnowledgeView />, {
      services: services(() => Promise.resolve([])),
    });
    expect(await screen.findByText(/No knowledge libraries yet/)).toBeInTheDocument();
  });

  it('lists each library by name and slug', async () => {
    renderWithProviders(<KnowledgeView />, {
      services: services(() =>
        Promise.resolve([
          library({ id: 'a', name: 'Docs', slug: 'docs' }),
          library({ id: 'b', name: 'Wiki', slug: 'wiki' }),
        ]),
      ),
    });
    expect(await screen.findByText('Docs')).toBeInTheDocument();
    expect(screen.getByText('Wiki')).toBeInTheDocument();
    expect(screen.getByText('wiki')).toBeInTheDocument();
  });

  it('toggles the inline create form on New library', async () => {
    renderWithProviders(<KnowledgeView />, {
      services: services(() => Promise.resolve([])),
    });
    await screen.findByText(/No knowledge libraries yet/);

    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /new library/i }));
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Reference ID')).toBeInTheDocument();
  });

  it('keeps Create disabled until both name and reference id are filled', async () => {
    renderWithProviders(<KnowledgeView />, {
      services: services(() => Promise.resolve([])),
    });
    await screen.findByText(/No knowledge libraries yet/);
    await userEvent.click(screen.getByRole('button', { name: /new library/i }));

    const submit = screen.getByRole('button', { name: 'Create library' });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Name'), 'Docs');
    expect(submit).toBeDisabled(); // reference id still empty
    await userEvent.type(screen.getByLabelText('Reference ID'), 'docs');
    expect(submit).toBeEnabled();
  });

  it('submits a trimmed payload to createLibrary', async () => {
    const createLibrary = vi.fn().mockResolvedValue(library());
    renderWithProviders(<KnowledgeView />, {
      services: services(() => Promise.resolve([]), { createLibrary }),
    });
    await screen.findByText(/No knowledge libraries yet/);
    await userEvent.click(screen.getByRole('button', { name: /new library/i }));

    await userEvent.type(screen.getByLabelText('Name'), '  Docs  ');
    await userEvent.type(screen.getByLabelText('Reference ID'), '  docs  ');
    await userEvent.type(screen.getByLabelText(/Description/), 'A corpus');
    await userEvent.click(screen.getByRole('button', { name: 'Create library' }));

    await waitFor(() => expect(createLibrary).toHaveBeenCalledTimes(1));
    expect(createLibrary).toHaveBeenCalledWith({
      slug: 'docs',
      name: 'Docs',
      description: 'A corpus',
    });
  });

  it('surfaces the create error and keeps the form open on failure', async () => {
    const createLibrary = vi.fn().mockRejectedValue(new Error('nope'));
    renderWithProviders(<KnowledgeView />, {
      services: services(() => Promise.resolve([]), { createLibrary }),
    });
    await screen.findByText(/No knowledge libraries yet/);
    await userEvent.click(screen.getByRole('button', { name: /new library/i }));

    await userEvent.type(screen.getByLabelText('Name'), 'Docs');
    await userEvent.type(screen.getByLabelText('Reference ID'), 'docs');
    await userEvent.click(screen.getByRole('button', { name: 'Create library' }));

    expect(await screen.findByText(ERRORS.KNW_002.message)).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('shows the voyage-key banner and disables New library when key is not configured', async () => {
    renderWithProviders(<KnowledgeView />, {
      services: services(() => Promise.resolve([]), {}, false),
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/Voyage API key is required/);
    expect(screen.getByRole('button', { name: /new library/i })).toBeDisabled();
  });

  it('does not show the voyage-key banner when key is configured', async () => {
    renderWithProviders(<KnowledgeView />, {
      services: services(() => Promise.resolve([]), {}, true),
    });
    await screen.findByText(/No knowledge libraries yet/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new library/i })).toBeEnabled();
  });
});
