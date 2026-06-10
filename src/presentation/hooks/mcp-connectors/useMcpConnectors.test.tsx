import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import { useMcpConnectors, useRegisterMcpConnector } from './useMcpConnectors';

function setup(mcpConnectorService: Record<string, unknown>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={{ mcpConnectorService } as unknown as Services}>
        {children}
      </ServiceContext.Provider>
    </QueryClientProvider>
  );
  return { wrapper, qc };
}

describe('useMcpConnectors', () => {
  it('lists connectors', async () => {
    const list = vi.fn().mockResolvedValue([{ id: 'mc1' }]);
    const { wrapper } = setup({ list });
    const { result } = renderHook(() => useMcpConnectors(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 'mc1' }]);
  });
});

describe('useRegisterMcpConnector', () => {
  it('registers then invalidates connectors + tools caches', async () => {
    const register = vi.fn().mockResolvedValue({ id: 'mc1', discoveredToolApiNames: [] });
    const { wrapper, qc } = setup({ register });
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useRegisterMcpConnector(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ displayName: 'X', transport: 'http', config: {}, authType: 'none' } as never);
    });
    expect(register).toHaveBeenCalled();
    const keys = invalidate.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual(['mcp-connectors']);
    expect(keys).toContainEqual(['tools']);
  });
});
