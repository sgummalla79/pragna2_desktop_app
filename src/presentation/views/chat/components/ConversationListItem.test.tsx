import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import { ConversationListItem } from './ConversationListItem';
import type { Conversation } from '@/domain/types/conversation.types';

const CONV: Conversation = {
  id: 'c1',
  flowId: null,
  threadId: 't1',
  userModelId: null,
  title: 'Tax planning',
  thinkingEnabled: false,
  pinned: false,
  pinnedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
};

function renderItem(totalCostUsd: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const conversationService = {
    getUsage: vi.fn().mockResolvedValue({
      conversationId: 'c1',
      records: [],
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUsd,
    }),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={{ conversationService } as unknown as Services}>
        <MemoryRouter>{children}</MemoryRouter>
      </ServiceContext.Provider>
    </QueryClientProvider>
  );
  return render(<ConversationListItem conversation={CONV} />, { wrapper });
}

describe('ConversationListItem — cost chip', () => {
  it('renders the conversation title', () => {
    renderItem('0');
    expect(screen.getByText('Tax planning')).toBeInTheDocument();
  });

  it('shows a formatted cost chip when total cost > 0', async () => {
    renderItem('0.0420');
    await waitFor(() => expect(screen.getByText('$0.0420')).toBeInTheDocument());
  });

  it('shows no chip for a zero-cost conversation', async () => {
    renderItem('0');
    // Give the usage query a tick to resolve, then assert no dollar chip.
    await waitFor(() => expect(screen.getByText('Tax planning')).toBeInTheDocument());
    expect(screen.queryByText(/^\$/)).toBeNull();
  });
});
