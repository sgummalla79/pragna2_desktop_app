import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import type { Services } from '@/presentation/providers/ServiceContext';
import type { McpConnector } from '@/domain/types/mcp.types';
import LocalServersView from './LocalServersView';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/infrastructure/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infrastructure/platform')>();
  return {
    ...actual,
    mcpStdio: {
      discover: vi.fn().mockResolvedValue([]),
      saveConfig: vi.fn().mockResolvedValue(undefined),
      clearConfig: vi.fn().mockResolvedValue(undefined),
      saveEditorConfig: vi.fn().mockResolvedValue(undefined),
      loadEditorConfig: vi.fn().mockResolvedValue(null),
      auth: vi.fn().mockResolvedValue(undefined),
      call: vi.fn().mockResolvedValue(''),
    },
    isTauriRuntime: vi.fn().mockReturnValue(true),
    usesWindowsChrome: vi.fn().mockReturnValue(false),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GENERIC_ERROR = 'MCP protocol error: connection closed';
const AUTH_ERROR = 'authentication required: failed to retrieve session: secret not found';

/** Minimal valid config JSON with one mcp-adaptor server. */
const VALID_CONFIG = JSON.stringify({
  mcpServers: {
    sumangummalla: {
      command: '/path/to/mcp-adaptor',
      args: ['serve', '--profile', 'sumangummalla'],
      env: {},
    },
  },
}, null, 2);

/** A registered connector returned by useMcpConnectors. */
const EXISTING_CONNECTOR: McpConnector = {
  id: 'conn-1',
  displayName: 'sumangummalla',
  description: null,
  transport: 'stdio',
  config: {},
  authType: 'none',
  hasCredentials: false,
  hasOauthTokens: false,
  status: 'active',
  tools: { total: 3, enabled: 3 },
  createdAt: '2026-01-01T00:00:00Z',
  modifiedAt: '2026-01-01T00:00:00Z',
};

function services(overrides: Partial<Services> = {}): Partial<Services> {
  return {
    mcpConnectorService: {
      list: vi.fn().mockResolvedValue([]),
      registerClientDelegated: vi.fn().mockResolvedValue({ id: 'conn-1' }),
      syncTools: vi.fn().mockResolvedValue(undefined),
      archive: vi.fn().mockResolvedValue(undefined),
    } as never,
    ...overrides,
  };
}

async function renderAndOpenEditor(svc = services()) {
  const user = userEvent.setup();
  renderWithProviders(<LocalServersView />, { services: svc });
  const editBtn = await screen.findByRole('button', { name: /^config$/i });
  await user.click(editBtn);
  // The editor opens on the Tree tab by default; switch to Edit so the raw
  // JSON textarea is available for the assertions that follow.
  await user.click(screen.getByRole('button', { name: /^edit$/i }));
  return user;
}

// ---------------------------------------------------------------------------
// Tests — Sheet editor
// ---------------------------------------------------------------------------

describe('LocalServersView — Sheet editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('shows the error message when save fails', async () => {
    const { mcpStdio } = await import('@/infrastructure/platform');
    vi.mocked(mcpStdio.discover).mockRejectedValueOnce(GENERIC_ERROR);

    const user = await renderAndOpenEditor();
    fireEvent.change(
      screen.getByRole('textbox', { name: /local mcp servers config/i }),
      { target: { value: VALID_CONFIG } },
    );
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() =>
      expect(screen.getByText(GENERIC_ERROR)).toBeInTheDocument(),
    );
  });

  it('shows Authenticate button in the Sheet when save fails and a command is available', async () => {
    const { mcpStdio } = await import('@/infrastructure/platform');
    vi.mocked(mcpStdio.discover).mockRejectedValueOnce(AUTH_ERROR);

    const user = await renderAndOpenEditor();
    fireEvent.change(
      screen.getByRole('textbox', { name: /local mcp servers config/i }),
      { target: { value: VALID_CONFIG } },
    );
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /authenticate with mcp gateway/i })).toBeInTheDocument(),
    );
  });

  it('auto-retries save after Authenticate succeeds (consent shown once, discover called twice)', async () => {
    const { mcpStdio } = await import('@/infrastructure/platform');
    vi.mocked(mcpStdio.discover)
      .mockRejectedValueOnce(AUTH_ERROR)   // first attempt
      .mockResolvedValueOnce([]);           // retry after auth
    vi.mocked(mcpStdio.auth).mockResolvedValue(undefined);

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const user = await renderAndOpenEditor();
    fireEvent.change(
      screen.getByRole('textbox', { name: /local mcp servers config/i }),
      { target: { value: VALID_CONFIG } },
    );
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    const authBtn = await screen.findByRole('button', { name: /authenticate with mcp gateway/i });
    await user.click(authBtn);

    await waitFor(() => expect(mcpStdio.discover).toHaveBeenCalledTimes(2));
    // consent dialog only once — the auto-retry skips it
    expect(confirmSpy).toHaveBeenCalledTimes(1);
  });

  it('disables Authenticate button while Sheet auth is in-flight', async () => {
    const { mcpStdio } = await import('@/infrastructure/platform');
    vi.mocked(mcpStdio.discover).mockRejectedValueOnce(AUTH_ERROR);
    vi.mocked(mcpStdio.auth).mockReturnValue(new Promise<void>(() => {}));

    const user = await renderAndOpenEditor();
    fireEvent.change(
      screen.getByRole('textbox', { name: /local mcp servers config/i }),
      { target: { value: VALID_CONFIG } },
    );
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    const authBtn = await screen.findByRole('button', { name: /authenticate with mcp gateway/i });
    await user.click(authBtn);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /authenticate with mcp gateway/i })).toBeDisabled(),
    );
  });

  it('shows auth error in Sheet when Authenticate subprocess fails', async () => {
    const { mcpStdio } = await import('@/infrastructure/platform');
    vi.mocked(mcpStdio.discover).mockRejectedValueOnce(AUTH_ERROR);
    vi.mocked(mcpStdio.auth).mockRejectedValueOnce('auth exited with 1');

    const user = await renderAndOpenEditor();
    fireEvent.change(
      screen.getByRole('textbox', { name: /local mcp servers config/i }),
      { target: { value: VALID_CONFIG } },
    );
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    const authBtn = await screen.findByRole('button', { name: /authenticate with mcp gateway/i });
    await user.click(authBtn);

    await waitFor(() =>
      expect(screen.getByText('auth exited with 1')).toBeInTheDocument(),
    );
  });

  it('disables Save when formatError is set', async () => {
    const user = await renderAndOpenEditor();
    const textarea = screen.getByRole('textbox', { name: /local mcp servers config/i });
    fireEvent.change(textarea, { target: { value: '{"bad":' } });
    fireEvent.blur(textarea);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled(),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests — per-card Authenticate button
// ---------------------------------------------------------------------------

describe('LocalServersView — per-card Authenticate button (FEAT-001)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const mod = await import('@/presentation/hooks/mcp-connectors/useMcpConnectors');
    vi.spyOn(mod, 'useMcpConnectors').mockReturnValue(
      { data: [EXISTING_CONNECTOR], isLoading: false } as never,
    );
  });

  it('shows Authenticate button for a server whose command is in editorText', async () => {
    const { mcpStdio } = await import('@/infrastructure/platform');
    vi.mocked(mcpStdio.loadEditorConfig).mockResolvedValue(VALID_CONFIG);

    renderWithProviders(<LocalServersView />, { services: services() });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /authenticate sumangummalla/i })).toBeInTheDocument(),
    );
  });

  it('calls mcpStdio.auth with the correct command on click', async () => {
    const { mcpStdio } = await import('@/infrastructure/platform');
    vi.mocked(mcpStdio.loadEditorConfig).mockResolvedValue(VALID_CONFIG);
    vi.mocked(mcpStdio.auth).mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderWithProviders(<LocalServersView />, { services: services() });

    const authBtn = await screen.findByRole('button', { name: /authenticate sumangummalla/i });
    await user.click(authBtn);

    await waitFor(() =>
      expect(mcpStdio.auth).toHaveBeenCalledWith('/path/to/mcp-adaptor'),
    );
  });

  it('shows success status below the card after auth succeeds', async () => {
    const { mcpStdio } = await import('@/infrastructure/platform');
    vi.mocked(mcpStdio.loadEditorConfig).mockResolvedValue(VALID_CONFIG);
    vi.mocked(mcpStdio.auth).mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderWithProviders(<LocalServersView />, { services: services() });

    const authBtn = await screen.findByRole('button', { name: /authenticate sumangummalla/i });
    await user.click(authBtn);

    await waitFor(() =>
      expect(screen.getByText(/authenticated successfully/i)).toBeInTheDocument(),
    );
  });

  it('shows error status below the card when auth fails', async () => {
    const { mcpStdio } = await import('@/infrastructure/platform');
    vi.mocked(mcpStdio.loadEditorConfig).mockResolvedValue(VALID_CONFIG);
    vi.mocked(mcpStdio.auth).mockRejectedValueOnce('auth exited with 1');

    const user = userEvent.setup();
    renderWithProviders(<LocalServersView />, { services: services() });

    const authBtn = await screen.findByRole('button', { name: /authenticate sumangummalla/i });
    await user.click(authBtn);

    await waitFor(() =>
      expect(screen.getByText('auth exited with 1')).toBeInTheDocument(),
    );
  });
});
