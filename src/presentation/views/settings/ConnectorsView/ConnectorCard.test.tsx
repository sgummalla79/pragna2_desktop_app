import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import type { Services } from '@/presentation/providers/ServiceContext';
import type { McpConnector } from '@/domain/types/mcp.types';
import { ConnectorCard } from './ConnectorCard';

// OAuth launch goes through the opener plugin; mock the Tauri seam.
const openUrl = vi.fn().mockResolvedValue(undefined);
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: (u: string) => openUrl(u) }));

// The edit modal nests another form/dialog; it's covered by ConnectorDetailsForm
// + EditConnectorModal flows. Stub it to keep this spec on the card's actions.
vi.mock('./EditConnectorModal', () => ({
  EditConnectorModal: ({ open }: { open: boolean }) => (
    <div data-testid="edit-modal">{open ? 'open' : 'closed'}</div>
  ),
}));

function makeConnector(over: Partial<McpConnector> = {}): McpConnector {
  return {
    id: 'c1',
    displayName: 'My Server',
    description: null,
    transport: 'http',
    config: { url: 'https://x' },
    authType: 'none',
    hasCredentials: false,
    hasOauthTokens: false,
    status: 'active',
    tools: { total: 5, enabled: 2 },
    createdAt: '2024-01-01T00:00:00Z',
    modifiedAt: '2024-01-01T00:00:00Z',
    ...over,
  };
}

interface ServiceFns {
  update?: ReturnType<typeof vi.fn>;
  archive?: ReturnType<typeof vi.fn>;
  refreshTools?: ReturnType<typeof vi.fn>;
  startOAuth?: ReturnType<typeof vi.fn>;
  toolList?: ReturnType<typeof vi.fn>;
}

function services(fns: ServiceFns = {}): Partial<Services> {
  return {
    mcpConnectorService: {
      update: fns.update ?? vi.fn().mockResolvedValue(makeConnector()),
      archive: fns.archive ?? vi.fn().mockResolvedValue(undefined),
      refreshTools:
        fns.refreshTools ??
        vi.fn().mockResolvedValue({ added: 0, unchanged: 0, archived: 0 }),
      startOAuth:
        fns.startOAuth ??
        vi.fn().mockResolvedValue({
          authorizationUrl: null,
          requiresManualClient: false,
        }),
    },
    toolService: { list: fns.toolList ?? vi.fn().mockResolvedValue([]) },
  } as unknown as Partial<Services>;
}

beforeEach(() => {
  openUrl.mockClear();
});

describe('ConnectorCard', () => {
  it('renders identity, transport/auth badges and the tool count summary', () => {
    renderWithProviders(
      <ConnectorCard
        connector={makeConnector({ transport: 'http', authType: 'none' })}
      />,
      { services: services() },
    );

    expect(screen.getByText('My Server')).toBeInTheDocument();
    expect(screen.getByText('http')).toBeInTheDocument();
    expect(screen.getByText('none')).toBeInTheDocument();
    // tools.enabled / tools.total
    expect(screen.getByText('2 / 5 tools enabled')).toBeInTheDocument();
  });

  it('toggles status to inactive via the active pill', async () => {
    const update = vi.fn().mockResolvedValue(makeConnector());
    renderWithProviders(<ConnectorCard connector={makeConnector({ status: 'active' })} />, {
      services: services({ update }),
    });

    await userEvent.click(
      screen.getByRole('button', { name: /Connector active — click to deactivate/ }),
    );

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('c1', { status: 'inactive' }),
    );
  });

  it('toggles status to active when currently inactive', async () => {
    const update = vi.fn().mockResolvedValue(makeConnector());
    renderWithProviders(
      <ConnectorCard connector={makeConnector({ status: 'inactive' })} />,
      { services: services({ update }) },
    );

    await userEvent.click(
      screen.getByRole('button', { name: /Connector inactive — click to activate/ }),
    );

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('c1', { status: 'active' }),
    );
  });

  it('refreshes tools and shows the diff summary', async () => {
    const refreshTools = vi
      .fn()
      .mockResolvedValue({ added: 3, unchanged: 4, archived: 1 });
    renderWithProviders(<ConnectorCard connector={makeConnector()} />, {
      services: services({ refreshTools }),
    });

    await userEvent.click(screen.getByRole('button', { name: 'Refresh tools' }));

    await waitFor(() => expect(refreshTools).toHaveBeenCalledWith('c1'));
    // Summary renders inside the (auto?) — it only renders when expanded; expand first.
    await userEvent.click(screen.getByRole('button', { name: 'My Server' }));
    expect(
      screen.getByText('Refreshed: 3 added, 4 unchanged, 1 archived.'),
    ).toBeInTheDocument();
  });

  it('archives the connector after confirming', async () => {
    const archive = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<ConnectorCard connector={makeConnector()} />, {
      services: services({ archive }),
    });

    await userEvent.click(screen.getByRole('button', { name: 'Delete My Server' }));
    // ConfirmButton opens an alertdialog; click its destructive Delete.
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(archive).toHaveBeenCalledWith('c1'));
  });

  it('opens the edit modal via the edit button', async () => {
    renderWithProviders(<ConnectorCard connector={makeConnector()} />, {
      services: services(),
    });

    expect(screen.getByTestId('edit-modal')).toHaveTextContent('closed');
    await userEvent.click(screen.getByRole('button', { name: 'Edit My Server' }));
    expect(screen.getByTestId('edit-modal')).toHaveTextContent('open');
  });

  it('shows the OAuth connected/not-connected badge only for oauth connectors', () => {
    const { rerender } = renderWithProviders(
      <ConnectorCard
        connector={makeConnector({ authType: 'oauth', hasOauthTokens: false })}
      />,
      { services: services() },
    );
    expect(screen.getByText('not connected')).toBeInTheDocument();

    rerender(
      <ConnectorCard
        connector={makeConnector({ authType: 'oauth', hasOauthTokens: true })}
      />,
    );
    expect(screen.getByText('connected')).toBeInTheDocument();
  });

  it('starts OAuth and opens the authorization URL in the system browser', async () => {
    const startOAuth = vi.fn().mockResolvedValue({
      authorizationUrl: 'https://auth.example.com/authorize',
      requiresManualClient: false,
    });
    renderWithProviders(
      <ConnectorCard connector={makeConnector({ authType: 'oauth' })} />,
      { services: services({ startOAuth }) },
    );

    // Expand the body to reveal the OAuth connect section.
    await userEvent.click(screen.getByRole('button', { name: 'My Server' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Connect with OAuth' }),
    );

    await waitFor(() =>
      expect(startOAuth).toHaveBeenCalledWith('c1', {}),
    );
    await waitFor(() =>
      expect(openUrl).toHaveBeenCalledWith('https://auth.example.com/authorize'),
    );
    expect(
      screen.getByText('Complete the connection in your browser, then Refresh.'),
    ).toBeInTheDocument();
  });

  it('reveals the manual-client form when the AS requires a client id', async () => {
    const startOAuth = vi
      .fn()
      .mockResolvedValueOnce({ authorizationUrl: null, requiresManualClient: true })
      .mockResolvedValueOnce({
        authorizationUrl: 'https://auth.example.com/authorize',
        requiresManualClient: false,
      });
    renderWithProviders(
      <ConnectorCard connector={makeConnector({ authType: 'oauth' })} />,
      { services: services({ startOAuth }) },
    );

    await userEvent.click(screen.getByRole('button', { name: 'My Server' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Connect with OAuth' }),
    );

    const clientId = await screen.findByLabelText('Client ID');
    await userEvent.type(clientId, 'abc123');
    await userEvent.click(
      screen.getByRole('button', { name: 'Connect with these credentials' }),
    );

    await waitFor(() =>
      expect(startOAuth).toHaveBeenLastCalledWith('c1', {
        clientId: 'abc123',
        clientSecret: undefined,
      }),
    );
    expect(openUrl).toHaveBeenCalledWith('https://auth.example.com/authorize');
  });

  it('shows an error when the status toggle update fails', async () => {
    const update = vi.fn().mockRejectedValue(new Error('nope'));
    renderWithProviders(<ConnectorCard connector={makeConnector()} />, {
      services: services({ update }),
    });

    await userEvent.click(
      screen.getByRole('button', { name: /Connector active/ }),
    );

    // Error only renders inside the expanded body.
    await userEvent.click(screen.getByRole('button', { name: 'My Server' }));
    expect(
      await screen.findByText('Failed to update the connector.'),
    ).toBeInTheDocument();
  });
});
