import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import { useTools, useToggleTool } from './useTools';

function setup(toolService: Record<string, unknown>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={{ toolService } as unknown as Services}>{children}</ServiceContext.Provider>
    </QueryClientProvider>
  );
  return { wrapper, qc };
}

describe('useTools', () => {
  it('lists tools', async () => {
    const list = vi.fn().mockResolvedValue([{ id: 't1' }]);
    const { wrapper } = setup({ list });
    const { result } = renderHook(() => useTools(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 't1' }]);
  });
});

describe('useToggleTool', () => {
  it('toggles enabled then invalidates tools + connectors caches', async () => {
    const setEnabled = vi.fn().mockResolvedValue({ id: 't1', enabled: true });
    const { wrapper, qc } = setup({ setEnabled });
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useToggleTool(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 't1', payload: { enabled: true } });
    });
    expect(setEnabled).toHaveBeenCalledWith('t1', { enabled: true });
    const keys = invalidate.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual(['tools']);
    expect(keys).toContainEqual(['mcp-connectors']);
  });
});
