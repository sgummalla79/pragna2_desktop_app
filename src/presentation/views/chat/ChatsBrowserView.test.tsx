import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import ChatsBrowserView from './ChatsBrowserView';

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigate };
});

function setup(conversations: Array<{ id: string; title: string | null; createdAt: string }>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const list = vi.fn().mockResolvedValue(conversations);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={{ conversationService: { list } } as unknown as Services}>
        <MemoryRouter>{children}</MemoryRouter>
      </ServiceContext.Provider>
    </QueryClientProvider>
  );
  return { wrapper };
}

const recent = () => new Date(Date.now() - 3_600_000).toISOString(); // 1 hour ago

describe('ChatsBrowserView', () => {
  it('lists conversations with a relative timestamp', async () => {
    const { wrapper } = setup([
      { id: '1', title: 'Trip planning', createdAt: recent() },
      { id: '2', title: 'Tax questions', createdAt: recent() },
    ]);
    render(<ChatsBrowserView />, { wrapper });

    expect(await screen.findByText('Trip planning')).toBeInTheDocument();
    expect(screen.getByText('Tax questions')).toBeInTheDocument();
    expect(screen.getAllByText('1 hour ago').length).toBe(2);
  });

  it('filters by title via the search box (case-insensitive)', async () => {
    const { wrapper } = setup([
      { id: '1', title: 'Trip planning', createdAt: recent() },
      { id: '2', title: 'Tax questions', createdAt: recent() },
    ]);
    render(<ChatsBrowserView />, { wrapper });
    await screen.findByText('Trip planning');

    await userEvent.type(screen.getByLabelText('Search chats'), 'tax');

    expect(screen.queryByText('Trip planning')).not.toBeInTheDocument();
    expect(screen.getByText('Tax questions')).toBeInTheDocument();
  });

  it('shows a no-match empty state for a non-matching query', async () => {
    const { wrapper } = setup([{ id: '1', title: 'Trip planning', createdAt: recent() }]);
    render(<ChatsBrowserView />, { wrapper });
    await screen.findByText('Trip planning');

    await userEvent.type(screen.getByLabelText('Search chats'), 'zzz');
    expect(screen.getByText(/No chats match "zzz"/)).toBeInTheDocument();
  });

  it('renders the empty state when there are no conversations', async () => {
    const { wrapper } = setup([]);
    render(<ChatsBrowserView />, { wrapper });
    expect(await screen.findByText(/No conversations yet/)).toBeInTheDocument();
  });

  it('falls back to "Untitled chat" for a null title', async () => {
    const { wrapper } = setup([{ id: '1', title: null, createdAt: recent() }]);
    render(<ChatsBrowserView />, { wrapper });
    expect(await screen.findByText('Untitled chat')).toBeInTheDocument();
  });

  it('navigates to the chat landing on New chat', async () => {
    const { wrapper } = setup([{ id: '1', title: 'A', createdAt: recent() }]);
    render(<ChatsBrowserView />, { wrapper });
    await screen.findByText('A');

    await userEvent.click(screen.getByRole('button', { name: /new chat/i }));
    expect(navigate).toHaveBeenCalledWith('/chat');
  });
});
