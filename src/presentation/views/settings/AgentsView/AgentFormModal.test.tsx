import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import { ERRORS } from '@/constants/errors';
import type { Services } from '@/presentation/providers/ServiceContext';
import { AgentFormModal } from './AgentFormModal';

// The header is a full-screen overlay anchored to the window's top-left, so it
// must clear the macOS overlay traffic lights via `useOverlayTitleBarInset`.
// Mock the hook so the macOS-overlay vs. not branches are both asserted without
// touching platform internals. Default to undefined (off macOS-overlay) so the
// other tests render exactly as before.
const overlayInset = vi.fn<[], React.CSSProperties | undefined>(() => undefined);
vi.mock('@/presentation/hooks/useOverlayTitleBarInset', () => ({
  useOverlayTitleBarInset: () => overlayInset(),
}));

beforeEach(() => {
  overlayInset.mockReturnValue(undefined);
});

/**
 * Tier 1 tests for AgentFormModal — scoped to the two pieces of own logic:
 *   1. the HTTP-status → catalog-message mapping on save (create) failures, and
 *   2. the dirty guard (Escape is consumed while the form has unsaved edits).
 *
 * Exercised in CREATE mode only: edit mode mounts the connector/knowledge
 * sub-sections (their own services + a radix Select that can hang in jsdom),
 * and the create path runs the identical `toErrorMessage` mapping, so create
 * mode covers the mapping with far less surface. Edit-mode rendering and the
 * Select interaction are deferred to Tier 2.
 */

/** Build an AxiosError carrying a given status and optional backend detail. */
function axiosError(status: number, detail?: string): AxiosError {
  const err = new AxiosError('request failed', 'ERR_BAD_RESPONSE');
  err.response = {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: detail ? { detail } : {},
  };
  return err;
}

/** AgentFormModal create path reads only `agentService.create`. */
function services(create: ReturnType<typeof vi.fn>): Partial<Services> {
  return { agentService: { create } as never };
}

/** Fill the required fields so the form's create branch runs (valid handle). */
async function fillRequired() {
  await userEvent.type(screen.getByLabelText('Handle'), 'my-bot');
  await userEvent.type(screen.getByLabelText('Display name'), 'My Bot');
}

describe('AgentFormModal — create', () => {
  it('rejects an invalid handle locally before calling the service', async () => {
    const create = vi.fn();
    renderWithProviders(
      <AgentFormModal open onClose={() => {}} />,
      { services: services(create) },
    );

    await userEvent.type(screen.getByLabelText('Handle'), 'Bad_Handle');
    await userEvent.type(screen.getByLabelText('Display name'), 'X');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(create).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(ERRORS.AGT_007.message);
  });

  it('passes the entered fields (and forceDefault) to agentService.create', async () => {
    const create = vi.fn().mockResolvedValue({});
    const onClose = vi.fn();
    renderWithProviders(
      <AgentFormModal open onClose={onClose} forceDefault />,
      { services: services(create) },
    );

    await fillRequired();
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith({
      apiName: 'my-bot',
      displayName: 'My Bot',
      description: null,
      systemPrompt: '',
      tools: [],
      isDefault: true,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('maps a 409 to the duplicate-name message', async () => {
    const create = vi.fn().mockRejectedValue(axiosError(409));
    renderWithProviders(<AgentFormModal open onClose={vi.fn()} />, {
      services: services(create),
    });
    await fillRequired();
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(ERRORS.AGT_002.message);
  });

  it('maps a 422 to the invalid-name message', async () => {
    const create = vi.fn().mockRejectedValue(axiosError(422));
    renderWithProviders(<AgentFormModal open onClose={vi.fn()} />, {
      services: services(create),
    });
    await fillRequired();
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(ERRORS.AGT_007.message);
  });

  it('maps a 400 to the default-cannot-be-archived message', async () => {
    const create = vi.fn().mockRejectedValue(axiosError(400));
    renderWithProviders(<AgentFormModal open onClose={vi.fn()} />, {
      services: services(create),
    });
    await fillRequired();
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(ERRORS.AGT_006.message);
  });

  it('prefers the backend detail string over the catalog message', async () => {
    const create = vi.fn().mockRejectedValue(axiosError(409, 'handle reserved'));
    renderWithProviders(<AgentFormModal open onClose={vi.fn()} />, {
      services: services(create),
    });
    await fillRequired();
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('handle reserved');
  });

  it('falls back to the generic save error for a non-axios failure', async () => {
    const create = vi.fn().mockRejectedValue(new Error('network down'));
    renderWithProviders(<AgentFormModal open onClose={vi.fn()} />, {
      services: services(create),
    });
    await fillRequired();
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(ERRORS.AGT_003.message);
  });

  it('keeps the dialog open on Escape while the form is dirty', async () => {
    const onClose = vi.fn();
    renderWithProviders(<AgentFormModal open onClose={onClose} />, {
      services: services(vi.fn()),
    });

    // Pristine form: nothing typed yet. Make it dirty by typing a handle.
    await userEvent.type(screen.getByLabelText('Handle'), 'x');
    await userEvent.keyboard('{Escape}');

    // The dirty guard consumes Escape, so onClose is never invoked and the
    // title stays mounted.
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'New agent' })).toBeInTheDocument();
  });

  it('closes via the labelled Cancel button regardless of dirty state', async () => {
    const onClose = vi.fn();
    renderWithProviders(<AgentFormModal open onClose={onClose} />, {
      services: services(vi.fn()),
    });
    await userEvent.type(screen.getByLabelText('Handle'), 'x'); // dirty
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('insets the header to clear the traffic lights on macOS-overlay chrome', () => {
    overlayInset.mockReturnValue({ paddingLeft: 84 });
    renderWithProviders(<AgentFormModal open onClose={vi.fn()} />, {
      services: services(vi.fn()),
    });
    const header = screen.getByRole('heading', { name: 'New agent' }).parentElement;
    expect(header).toHaveStyle({ paddingLeft: '84px' });
  });

  it('leaves the header un-inset off macOS-overlay chrome (browser / Windows)', () => {
    overlayInset.mockReturnValue(undefined);
    renderWithProviders(<AgentFormModal open onClose={vi.fn()} />, {
      services: services(vi.fn()),
    });
    const header = screen.getByRole('heading', { name: 'New agent' }).parentElement;
    // No inline override: the header keeps only its Tailwind `px-4` padding.
    expect(header?.style.paddingLeft).toBe('');
  });
});
