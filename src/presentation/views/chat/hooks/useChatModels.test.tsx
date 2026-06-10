import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import { useChatModels } from './useChatModels';

const model = (over: Record<string, unknown>) => ({
  id: 'm',
  enabled: true,
  availableForChat: true,
  archived: false,
  ...over,
});

function setup(models: unknown[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const modelService = { list: vi.fn().mockResolvedValue(models) };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={{ modelService } as unknown as Services}>{children}</ServiceContext.Provider>
    </QueryClientProvider>
  );
  return { wrapper };
}

describe('useChatModels', () => {
  it('keeps only enabled, chat-eligible, non-archived models', async () => {
    const { wrapper } = setup([
      model({ id: 'ok' }),
      model({ id: 'disabled', enabled: false }),
      model({ id: 'no-chat', availableForChat: false }),
      model({ id: 'archived', archived: true }),
    ]);
    const { result } = renderHook(() => useChatModels(), { wrapper });
    await waitFor(() => expect(result.current.chatModels.length).toBeGreaterThan(0));
    expect(result.current.chatModels.map((m) => m.id)).toEqual(['ok']);
  });
});
