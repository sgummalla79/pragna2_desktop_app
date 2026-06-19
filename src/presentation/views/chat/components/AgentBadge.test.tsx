import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import { AgentBadge } from './AgentBadge';

function wrap(agents: unknown[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const agentService = { list: vi.fn().mockResolvedValue(agents) };
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={{ agentService } as unknown as Services}>{children}</ServiceContext.Provider>
    </QueryClientProvider>
  );
}

const AGENTS = [
  { id: 'a1', displayName: 'Sales Agent', status: 'active', isDefault: true },
];

describe('AgentBadge', () => {
  it('renders the agent display name once it resolves', async () => {
    render(<AgentBadge agentId="a1" />, { wrapper: wrap(AGENTS) });
    await waitFor(() => expect(screen.getByText('Sales Agent')).toBeInTheDocument());
  });

  it('renders nothing for a null id', () => {
    const { container } = render(<AgentBadge agentId={null} />, { wrapper: wrap(AGENTS) });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the id does not resolve (archived / cache miss)', async () => {
    const { container } = render(<AgentBadge agentId="missing" />, { wrapper: wrap(AGENTS) });
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
