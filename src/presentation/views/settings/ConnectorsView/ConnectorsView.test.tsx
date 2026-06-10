import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import type { Services } from '@/presentation/providers/ServiceContext';
import { ERRORS } from '@/constants/errors';
import ConnectorsView from './ConnectorsView';

// Stub the heavy children so this spec isolates ConnectorsView's own branches
// (loading / error / empty / list + the OAuth banner). The card + wizard are
// covered by their own specs.
vi.mock('./ConnectorCard', () => ({
  ConnectorCard: ({ connector }: { connector: { displayName: string } }) => (
    <div data-testid="connector-card">{connector.displayName}</div>
  ),
}));
vi.mock('./AddConnectorWizard', () => ({
  AddConnectorWizard: ({ open }: { open: boolean }) => (
    <div data-testid="add-wizard">{open ? 'open' : 'closed'}</div>
  ),
}));

function makeConnector(over: Partial<{ id: string; displayName: string }> = {}) {
  return {
    id: over.id ?? 'c1',
    displayName: over.displayName ?? 'My Server',
    description: null,
    transport: 'http',
    config: { url: 'https://x' },
    authType: 'none',
    hasCredentials: false,
    hasOauthTokens: false,
    status: 'active',
    tools: { total: 0, enabled: 0 },
    createdAt: '2024-01-01T00:00:00Z',
    modifiedAt: '2024-01-01T00:00:00Z',
  };
}

function servicesWith(list: ReturnType<typeof vi.fn>): Partial<Services> {
  return { mcpConnectorService: { list } } as unknown as Partial<Services>;
}

describe('ConnectorsView', () => {
  it('shows the loading state while connectors are fetching', () => {
    // A never-resolving list keeps the query in its loading state.
    const list = vi.fn().mockReturnValue(new Promise(() => {}));
    renderWithProviders(<ConnectorsView />, { services: servicesWith(list) });

    expect(screen.getByText('Loading connectors…')).toBeInTheDocument();
  });

  it('renders the error message when the list query fails', async () => {
    const list = vi.fn().mockRejectedValue(new Error('boom'));
    renderWithProviders(<ConnectorsView />, { services: servicesWith(list) });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      ERRORS.CON_001.message,
    );
  });

  it('renders the empty state when there are no connectors', async () => {
    const list = vi.fn().mockResolvedValue([]);
    renderWithProviders(<ConnectorsView />, { services: servicesWith(list) });

    expect(await screen.findByText(/No connectors yet/)).toBeInTheDocument();
  });

  it('renders a card per connector when the list is non-empty', async () => {
    const list = vi
      .fn()
      .mockResolvedValue([
        makeConnector({ id: 'a', displayName: 'Alpha' }),
        makeConnector({ id: 'b', displayName: 'Beta' }),
      ]);
    renderWithProviders(<ConnectorsView />, { services: servicesWith(list) });

    await screen.findByText('Alpha');
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getAllByTestId('connector-card')).toHaveLength(2);
  });

  it('opens the wizard when "Add connector" is clicked', async () => {
    const list = vi.fn().mockResolvedValue([]);
    renderWithProviders(<ConnectorsView />, { services: servicesWith(list) });
    await screen.findByText(/No connectors yet/);

    expect(screen.getByTestId('add-wizard')).toHaveTextContent('closed');
    await userEvent.click(screen.getByRole('button', { name: /add connector/i }));
    expect(screen.getByTestId('add-wizard')).toHaveTextContent('open');
  });

  it('shows the OAuth success banner when ?oauth=success and strips the param', async () => {
    const list = vi.fn().mockResolvedValue([]);
    renderWithProviders(<ConnectorsView />, {
      services: servicesWith(list),
      initialEntries: ['/settings/connectors?oauth=success'],
    });

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Connector connected via OAuth.',
    );
  });

  it('shows the OAuth error banner when ?oauth=error', async () => {
    const list = vi.fn().mockResolvedValue([]);
    renderWithProviders(<ConnectorsView />, {
      services: servicesWith(list),
      initialEntries: ['/settings/connectors?oauth=error'],
    });

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        /OAuth connection failed/,
      ),
    );
  });

  it('shows no banner when the oauth param is absent', async () => {
    const list = vi.fn().mockResolvedValue([]);
    renderWithProviders(<ConnectorsView />, { services: servicesWith(list) });
    await screen.findByText(/No connectors yet/);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
