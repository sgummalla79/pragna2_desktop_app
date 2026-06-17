import { describe, it, expect, vi } from 'vitest';
import { McpConnectorService } from './McpConnectorService';
import type { IMcpConnectorRepository } from '@/application/ports/IMcpConnectorRepository';
import type { IMcpOAuthLoopbackFlow } from '@/application/ports/IMcpOAuthLoopbackFlow';

function makeRepo(over: Partial<IMcpConnectorRepository> = {}): IMcpConnectorRepository {
  return {
    list: vi.fn(),
    register: vi.fn(),
    registerClientDelegated: vi.fn(),
    syncTools: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    refreshTools: vi.fn(),
    startOAuth: vi.fn(),
    completeOAuth: vi.fn(),
    ...over,
  } as unknown as IMcpConnectorRepository;
}

describe('McpConnectorService.connectViaLoopback', () => {
  it('authorizes (empty payload) → captures → completes, in order', async () => {
    const startOAuth = vi
      .fn()
      .mockResolvedValue({ authorizationUrl: 'https://auth', requiresManualClient: false });
    const completeOAuth = vi.fn().mockResolvedValue({ connectorId: 'mc1' });
    const capture = vi.fn().mockResolvedValue({ code: 'C', state: 'S' });
    const repo = makeRepo({ startOAuth, completeOAuth });
    const flow: IMcpOAuthLoopbackFlow = { capture };

    const result = await new McpConnectorService(repo, flow).connectViaLoopback('mc1', 8082);

    expect(startOAuth).toHaveBeenCalledWith('mc1', {});
    expect(capture).toHaveBeenCalledWith(8082, 'https://auth');
    expect(completeOAuth).toHaveBeenCalledWith('mc1', { code: 'C', state: 'S' });
    expect(result).toEqual({ status: 'connected', connectorId: 'mc1' });
  });

  it('returns requires_manual_client without capturing or completing', async () => {
    const startOAuth = vi
      .fn()
      .mockResolvedValue({ authorizationUrl: null, requiresManualClient: true });
    const completeOAuth = vi.fn();
    const capture = vi.fn();
    const repo = makeRepo({ startOAuth, completeOAuth });

    const result = await new McpConnectorService(repo, { capture }).connectViaLoopback(
      'mc1',
      8082,
    );

    expect(result).toEqual({ status: 'requires_manual_client' });
    expect(capture).not.toHaveBeenCalled();
    expect(completeOAuth).not.toHaveBeenCalled();
  });

  it('throws when authorize returns no URL and is not manual-client', async () => {
    const startOAuth = vi
      .fn()
      .mockResolvedValue({ authorizationUrl: null, requiresManualClient: false });
    const capture = vi.fn();
    const repo = makeRepo({ startOAuth });

    await expect(
      new McpConnectorService(repo, { capture }).connectViaLoopback('mc1', 8082),
    ).rejects.toThrow();
    expect(capture).not.toHaveBeenCalled();
  });

  it('propagates a capture error without completing', async () => {
    const startOAuth = vi
      .fn()
      .mockResolvedValue({ authorizationUrl: 'https://auth', requiresManualClient: false });
    const completeOAuth = vi.fn();
    const capture = vi.fn().mockRejectedValue(new Error('port in use'));
    const repo = makeRepo({ startOAuth, completeOAuth });

    await expect(
      new McpConnectorService(repo, { capture }).connectViaLoopback('mc1', 8082),
    ).rejects.toThrow('port in use');
    expect(completeOAuth).not.toHaveBeenCalled();
  });
});
