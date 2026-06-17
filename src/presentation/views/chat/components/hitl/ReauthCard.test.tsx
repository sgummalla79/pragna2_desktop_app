import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/__tests__/renderWithProviders';
import {
  MCP_REAUTH_BOUNDARY_CONNECTOR,
  MCP_REAUTH_BOUNDARY_DOWNSTREAM_SERVICE,
  MCP_REAUTH_TRANSPORT_STDIO,
  type ReauthEnvelope,
} from '@/domain/types/mcpDelegation.types';

import { ReauthCard } from './ReauthCard';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const openUrl = vi.fn().mockResolvedValue(undefined);
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: (u: string) => openUrl(u) }));

const reauth = vi.fn().mockResolvedValue(undefined);
vi.mock('@/infrastructure/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infrastructure/platform')>();
  return {
    ...actual,
    mcpStdio: { reauth: (id: string, svc: string | null) => reauth(id, svc) },
    isTauriRuntime: vi.fn().mockReturnValue(true),
  };
});

const startOAuth = vi.fn().mockResolvedValue({ authorizationUrl: 'https://oauth.example/go' });
vi.mock('@/presentation/hooks/mcp-connectors/useMcpConnectors', () => ({
  useStartConnectorOAuth: () => ({ mutateAsync: startOAuth, isPending: false }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const downstreamEnvelope: ReauthEnvelope = {
  connector_id: 'conn-gus',
  display_name: 'GUS (mcp-adaptor)',
  auth_type: 'none',
  reason: 'token_expired',
  boundary: MCP_REAUTH_BOUNDARY_DOWNSTREAM_SERVICE,
  transport: MCP_REAUTH_TRANSPORT_STDIO,
  service: 'gus',
  authorization_url: null,
  resume_actions: ['retry', 'continue'],
};

const connectorEnvelope: ReauthEnvelope = {
  connector_id: 'conn-gmail',
  display_name: 'Gmail',
  auth_type: 'oauth',
  reason: 'revoked',
  boundary: MCP_REAUTH_BOUNDARY_CONNECTOR,
};

beforeEach(() => {
  openUrl.mockClear();
  reauth.mockClear();
  startOAuth.mockClear();
});

describe('ReauthCard — downstream service (#124)', () => {
  it('names the specific service and drives the adaptor re-auth, then resumes retry', async () => {
    const onResume = vi.fn();
    renderWithProviders(
      <ReauthCard envelope={downstreamEnvelope} onResume={onResume} />,
    );

    // The card names the downstream service, not just the connector.
    expect(screen.getByText(/gus needs to be reconnected/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /re-authenticate/i }));

    // Runs the adaptor's own flow for the named provider — NOT connector OAuth.
    await waitFor(() => expect(reauth).toHaveBeenCalledWith('conn-gus', 'gus'));
    expect(startOAuth).not.toHaveBeenCalled();
    expect(openUrl).not.toHaveBeenCalled();

    // After it completes, Retry resumes the run.
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onResume).toHaveBeenCalledWith('retry');
  });

  it('opens authorization_url instead of running the CLI when the envelope carries one', async () => {
    const onResume = vi.fn();
    renderWithProviders(
      <ReauthCard
        envelope={{ ...downstreamEnvelope, authorization_url: 'https://adaptor.example/connect' }}
        onResume={onResume}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /re-authenticate/i }));
    await waitFor(() =>
      expect(openUrl).toHaveBeenCalledWith('https://adaptor.example/connect'),
    );
    expect(reauth).not.toHaveBeenCalled();
  });

  it('"Continue without it" resumes continue', async () => {
    const onResume = vi.fn();
    renderWithProviders(
      <ReauthCard envelope={downstreamEnvelope} onResume={onResume} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /continue without it/i }));
    expect(onResume).toHaveBeenCalledWith('continue');
  });
});

describe('ReauthCard — connector OAuth (boundary=connector, unchanged)', () => {
  it('drives connector OAuth and opens its authorization URL, not the adaptor CLI', async () => {
    const onResume = vi.fn();
    renderWithProviders(
      <ReauthCard envelope={connectorEnvelope} onResume={onResume} />,
    );

    expect(screen.getByText(/gmail needs to be reconnected/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /re-authenticate/i }));
    await waitFor(() =>
      expect(startOAuth).toHaveBeenCalledWith({ id: 'conn-gmail', payload: {} }),
    );
    expect(openUrl).toHaveBeenCalledWith('https://oauth.example/go');
    expect(reauth).not.toHaveBeenCalled();
  });
});
