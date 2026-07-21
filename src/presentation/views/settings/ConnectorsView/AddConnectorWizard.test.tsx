import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import type { Services } from '@/presentation/providers/ServiceContext';
import type { DetailsSubmit } from './ConnectorDetailsForm';
import { AddConnectorWizard } from './AddConnectorWizard';

// OAuth launch goes through the opener plugin; mock the Tauri seam.
const openUrl = vi.fn().mockResolvedValue(undefined);
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: (u: string) => openUrl(u) }));

// Stub the details form (its own spec covers the field logic). Expose its props
// so the wizard's submit/back/dirty wiring can be driven from the test.
let lastFormProps: {
  onSubmit: (p: DetailsSubmit) => void;
  onBack?: () => void;
  onCancel: () => void;
  onDirtyChange?: (d: boolean) => void;
  error: string | null;
} | null = null;
vi.mock('./ConnectorDetailsForm', () => ({
  ConnectorDetailsForm: (props: NonNullable<typeof lastFormProps>) => {
    lastFormProps = props;
    return (
      <div data-testid="details-form">
        {props.error && <p>{props.error}</p>}
        <button onClick={() => props.onBack?.()}>form-back</button>
      </div>
    );
  },
}));

// Stub the tool toggle list (covered by ConnectorToolToggleList).
vi.mock('./ConnectorToolToggleList', () => ({
  ConnectorToolToggleList: ({ connectorId }: { connectorId: string }) => (
    <div data-testid="tool-list">{connectorId}</div>
  ),
}));

const STATIC_SUBMIT: DetailsSubmit = {
  displayName: 'Tavily',
  url: 'https://mcp.tavily.com',
  transport: 'streamable_http',
  authType: 'api_key',
  clearCredentials: false,
  credentials: { injections: [{ location: 'header', name: 'k', value: 'v' }] },
};

const OAUTH_SUBMIT: DetailsSubmit = {
  displayName: 'Gmail',
  url: 'https://mcp.gmail.com',
  transport: 'streamable_http',
  authType: 'oauth',
  clearCredentials: true,
};

// Simulates what the form emits when the Salesforce preset pre-checks the box.
const SALESFORCE_SUBMIT: DetailsSubmit = {
  displayName: 'Salesforce CRM',
  url: 'https://mcp.salesforce.com',
  transport: 'streamable_http',
  authType: 'oauth',
  clearCredentials: true,
  oauthConfig: {
    clientId: 'sf_cid',
    loginUrl: 'https://login.salesforce.com',
    callbackPort: 8082,
    omitResourceAtTokenExchange: true,
  },
};

function registeredFrom(submit: DetailsSubmit, toolNames: string[] = []) {
  return {
    id: 'new-1',
    displayName: submit.displayName,
    description: null,
    transport: submit.transport,
    config: { url: submit.url },
    authType: submit.authType,
    hasCredentials: submit.authType !== 'none' && submit.authType !== 'oauth',
    hasOauthTokens: false,
    status: 'active',
    tools: null,
    createdAt: '2024-01-01T00:00:00Z',
    modifiedAt: '2024-01-01T00:00:00Z',
    discoveredToolApiNames: toolNames,
  };
}

interface Fns {
  register?: ReturnType<typeof vi.fn>;
  startOAuth?: ReturnType<typeof vi.fn>;
}
function services(fns: Fns = {}): Partial<Services> {
  return {
    mcpConnectorService: {
      register: fns.register ?? vi.fn(),
      startOAuth:
        fns.startOAuth ??
        vi.fn().mockResolvedValue({ authorizationUrl: null, requiresManualClient: false }),
    },
    toolService: { list: vi.fn().mockResolvedValue([]) },
  } as unknown as Partial<Services>;
}

beforeEach(() => {
  openUrl.mockClear();
  lastFormProps = null;
});

describe('AddConnectorWizard', () => {
  it('renders nothing visible when closed', () => {
    renderWithProviders(
      <AddConnectorWizard open={false} onOpenChange={vi.fn()} />,
      { services: services() },
    );
    expect(screen.queryByText('Add a connector')).not.toBeInTheDocument();
  });

  it('opens on the gallery step with presets, custom tile, and search filter', async () => {
    renderWithProviders(<AddConnectorWizard open onOpenChange={vi.fn()} />, {
      services: services(),
    });

    expect(await screen.findByText('Add a connector')).toBeInTheDocument();
    expect(screen.getByTestId('connector-preset-tavily')).toBeInTheDocument();
    expect(screen.getByTestId('connector-preset-custom')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Search servers'), 'tavily');
    expect(screen.getByTestId('connector-preset-tavily')).toBeInTheDocument();
    expect(screen.queryByTestId('connector-preset-stripe')).not.toBeInTheDocument();
  });

  it('shows the no-match hint when the search filters everything out', async () => {
    renderWithProviders(<AddConnectorWizard open onOpenChange={vi.fn()} />, {
      services: services(),
    });
    await screen.findByText('Add a connector');

    await userEvent.type(screen.getByLabelText('Search servers'), 'zzzznope');
    expect(screen.getByText(/No matching servers/)).toBeInTheDocument();
  });

  it('advances to the details step when a preset is picked (preset title shown)', async () => {
    renderWithProviders(<AddConnectorWizard open onOpenChange={vi.fn()} />, {
      services: services(),
    });
    await screen.findByText('Add a connector');

    await userEvent.click(screen.getByTestId('connector-preset-tavily'));
    expect(await screen.findByText('Connect to Tavily')).toBeInTheDocument();
    expect(screen.getByTestId('details-form')).toBeInTheDocument();
  });

  it('advances to the custom details step (Custom server title)', async () => {
    renderWithProviders(<AddConnectorWizard open onOpenChange={vi.fn()} />, {
      services: services(),
    });
    await screen.findByText('Add a connector');

    await userEvent.click(screen.getByTestId('connector-preset-custom'));
    expect(await screen.findByText('Custom server')).toBeInTheDocument();
  });

  it('goes back to the gallery from the details step', async () => {
    renderWithProviders(<AddConnectorWizard open onOpenChange={vi.fn()} />, {
      services: services(),
    });
    await screen.findByText('Add a connector');
    await userEvent.click(screen.getByTestId('connector-preset-tavily'));
    await screen.findByTestId('details-form');

    await userEvent.click(screen.getByText('form-back'));
    expect(await screen.findByText('Add a connector')).toBeInTheDocument();
  });

  it('registers a static-auth connector and shows the tools step', async () => {
    const register = vi
      .fn()
      .mockResolvedValue(registeredFrom(STATIC_SUBMIT, ['search', 'extract']));
    const onRegistered = vi.fn();
    renderWithProviders(
      <AddConnectorWizard open onOpenChange={vi.fn()} onRegistered={onRegistered} />,
      { services: services({ register }) },
    );
    await screen.findByText('Add a connector');
    await userEvent.click(screen.getByTestId('connector-preset-tavily'));
    await screen.findByTestId('details-form');

    lastFormProps!.onSubmit(STATIC_SUBMIT);

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith({
        displayName: 'Tavily',
        description: undefined,
        transport: 'streamable_http',
        config: { url: 'https://mcp.tavily.com' },
        authType: 'api_key',
        credentials: STATIC_SUBMIT.credentials,
      }),
    );
    // Tools step: discovered-count copy + the toggle list for the new connector.
    expect(await screen.findByText(/Discovered/)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByTestId('tool-list')).toHaveTextContent('new-1');
    expect(onRegistered).toHaveBeenCalledTimes(1);
  });

  it('shows the OAuth connect CTA on the tools step for an oauth connector', async () => {
    const register = vi.fn().mockResolvedValue(registeredFrom(OAUTH_SUBMIT));
    const startOAuth = vi.fn().mockResolvedValue({
      authorizationUrl: 'https://auth.example.com/go',
      requiresManualClient: false,
    });
    renderWithProviders(<AddConnectorWizard open onOpenChange={vi.fn()} />, {
      services: services({ register, startOAuth }),
    });
    await screen.findByText('Add a connector');
    await userEvent.click(screen.getByTestId('connector-preset-gmail'));
    await screen.findByTestId('details-form');

    lastFormProps!.onSubmit(OAUTH_SUBMIT);

    await screen.findByText(/Connect it with OAuth/);
    await userEvent.click(screen.getByRole('button', { name: 'Connect with OAuth' }));

    await waitFor(() => expect(startOAuth).toHaveBeenCalledWith('new-1', {}));
    await waitFor(() =>
      expect(openUrl).toHaveBeenCalledWith('https://auth.example.com/go'),
    );
    expect(
      screen.getByText('Complete the connection in your browser, then Refresh.'),
    ).toBeInTheDocument();
  });

  it('surfaces the manual-client message when OAuth needs client credentials', async () => {
    const register = vi.fn().mockResolvedValue(registeredFrom(OAUTH_SUBMIT));
    const startOAuth = vi
      .fn()
      .mockResolvedValue({ authorizationUrl: null, requiresManualClient: true });
    renderWithProviders(<AddConnectorWizard open onOpenChange={vi.fn()} />, {
      services: services({ register, startOAuth }),
    });
    await screen.findByText('Add a connector');
    await userEvent.click(screen.getByTestId('connector-preset-gmail'));
    await screen.findByTestId('details-form');
    lastFormProps!.onSubmit(OAUTH_SUBMIT);
    await screen.findByText(/Connect it with OAuth/);

    await userEvent.click(screen.getByRole('button', { name: 'Connect with OAuth' }));

    expect(
      await screen.findByText(/This server needs OAuth client credentials/),
    ).toBeInTheDocument();
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('forwards omitResourceAtTokenExchange from the form oauthConfig to the register call', async () => {
    const register = vi
      .fn()
      .mockResolvedValue(registeredFrom(SALESFORCE_SUBMIT));
    renderWithProviders(
      <AddConnectorWizard open onOpenChange={vi.fn()} />,
      { services: services({ register }) },
    );
    await screen.findByText('Add a connector');
    await userEvent.click(screen.getByTestId('connector-preset-salesforce'));
    await screen.findByTestId('details-form');

    lastFormProps!.onSubmit(SALESFORCE_SUBMIT);

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            oauth: expect.objectContaining({ omitResourceAtTokenExchange: true }),
          }),
        }),
      ),
    );
  });

  it('surfaces a registration error from the details form (stays on details)', async () => {
    const register = vi.fn().mockRejectedValue({
      response: { data: { detail: 'URL unreachable' } },
    });
    renderWithProviders(<AddConnectorWizard open onOpenChange={vi.fn()} />, {
      services: services({ register }),
    });
    await screen.findByText('Add a connector');
    await userEvent.click(screen.getByTestId('connector-preset-tavily'));
    await screen.findByTestId('details-form');

    lastFormProps!.onSubmit(STATIC_SUBMIT);

    expect(await screen.findByText('URL unreachable')).toBeInTheDocument();
    expect(screen.queryByText(/Discovered/)).not.toBeInTheDocument();
  });

  it('arms the dirty guard only when on details with unsaved edits', async () => {
    renderWithProviders(<AddConnectorWizard open onOpenChange={vi.fn()} />, {
      services: services(),
    });
    await screen.findByText('Add a connector');
    await userEvent.click(screen.getByTestId('connector-preset-tavily'));
    await screen.findByTestId('details-form');

    // The wizard passes onDirtyChange down; the form reports edits through it.
    // Mark dirty, then Escape should be blocked (guard armed).
    act(() => lastFormProps!.onDirtyChange?.(true));
    await userEvent.keyboard('{Escape}');
    // Still on the details step — the guard consumed the Escape.
    expect(screen.getByTestId('details-form')).toBeInTheDocument();
  });
});
