import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import { usePragnaSlashFlows } from './usePragnaSlashFlows';

describe('usePragnaSlashFlows', () => {
  it('lists slash flows via pragnaFlowService', async () => {
    const listSlashFlows = vi.fn().mockResolvedValue([{ slashApiName: 'research' }]);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>
        <ServiceContext.Provider value={{ pragnaFlowService: { listSlashFlows } } as unknown as Services}>
          {children}
        </ServiceContext.Provider>
      </QueryClientProvider>
    );
    const { result } = renderHook(() => usePragnaSlashFlows(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ slashApiName: 'research' }]);
  });
});
