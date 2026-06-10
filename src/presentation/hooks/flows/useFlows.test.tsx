import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import { useFlows, useFlow, useCreateFlow } from './useFlows';

function setup(flowService: Record<string, unknown>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={{ flowService } as unknown as Services}>{children}</ServiceContext.Provider>
    </QueryClientProvider>
  );
  return { wrapper, qc };
}

describe('useFlows', () => {
  it('lists flows', async () => {
    const list = vi.fn().mockResolvedValue([{ id: 'f1' }]);
    const { wrapper } = setup({ list });
    const { result } = renderHook(() => useFlows(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 'f1' }]);
  });
});

describe('useFlow', () => {
  it('is disabled when id is undefined', () => {
    const get = vi.fn();
    const { wrapper } = setup({ get });
    const { result } = renderHook(() => useFlow(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(get).not.toHaveBeenCalled();
  });

  it('fetches a flow by id', async () => {
    const get = vi.fn().mockResolvedValue({ id: 'f1' });
    const { wrapper } = setup({ get });
    const { result } = renderHook(() => useFlow('f1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledWith('f1');
  });
});

describe('useCreateFlow', () => {
  it('creates then invalidates the flows list', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'f1' });
    const { wrapper, qc } = setup({ create });
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateFlow(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ apiName: 'a', displayName: 'A', description: null } as never);
    });
    expect(create).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['flows'] });
  });
});
