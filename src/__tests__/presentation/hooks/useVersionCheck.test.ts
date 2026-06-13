import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { VersionCard } from '@/infrastructure/http/versionApi';
import { useVersionStore } from '@/presentation/store/versionStore';

// Mock the network call; the decision logic under test is purely the
// compat comparison, so axiosClient is never exercised here.
vi.mock('@/infrastructure/http/versionApi', () => ({ fetchVersionCard: vi.fn() }));
import { fetchVersionCard } from '@/infrastructure/http/versionApi';
import { useVersionCheck } from '@/presentation/hooks/useVersionCheck';

const mockFetch = vi.mocked(fetchVersionCard);

function card(over: Partial<VersionCard> = {}): VersionCard {
  return {
    service: 'pragna2-api',
    version: '1.0.0',
    compat: '1.0',
    min_client_compat: '1.0',
    db_schema_revision: '0041',
    ...over,
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  useVersionStore.setState({
    status: 'unknown',
    serverVersion: null,
    serverCompat: null,
    dismissed: false,
    blocked: false,
    blockMessage: null,
  });
});

describe('useVersionCheck', () => {
  it('marks ok when client and server are on the same compat line', async () => {
    mockFetch.mockResolvedValue(card());
    renderHook(() => useVersionCheck());
    await waitFor(() => expect(useVersionStore.getState().status).toBe('ok'));
  });

  it('marks client_outdated when the client is below min_client_compat', async () => {
    mockFetch.mockResolvedValue(card({ min_client_compat: '1.1' }));
    renderHook(() => useVersionCheck());
    await waitFor(() => expect(useVersionStore.getState().status).toBe('client_outdated'));
  });

  it('marks server_outdated when the API compat is below what the client requires', async () => {
    mockFetch.mockResolvedValue(card({ compat: '0.9', version: '0.9.3' }));
    renderHook(() => useVersionCheck());
    await waitFor(() => expect(useVersionStore.getState().status).toBe('server_outdated'));
  });

  it('marks unreachable (never blocks) when the version card cannot be fetched', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));
    renderHook(() => useVersionCheck());
    await waitFor(() => expect(useVersionStore.getState().status).toBe('unreachable'));
  });
});
