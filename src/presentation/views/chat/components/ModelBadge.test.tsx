import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import { ModelBadge } from './ModelBadge';

function wrap(models: unknown[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const modelService = { list: vi.fn().mockResolvedValue(models) };
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={{ modelService } as unknown as Services}>{children}</ServiceContext.Provider>
    </QueryClientProvider>
  );
}

const MODELS = [{ id: 'm1', displayName: 'Sonnet 4.6', enabled: true, availableForChat: true, archived: false }];

describe('ModelBadge', () => {
  it('renders "by <displayName>" once the model resolves', async () => {
    render(<ModelBadge userModelId="m1" />, { wrapper: wrap(MODELS) });
    await waitFor(() => expect(screen.getByText('by Sonnet 4.6')).toBeInTheDocument());
  });

  it('renders nothing for a null id', () => {
    const { container } = render(<ModelBadge userModelId={null} />, { wrapper: wrap(MODELS) });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the id does not resolve', async () => {
    const { container } = render(<ModelBadge userModelId="missing" />, { wrapper: wrap(MODELS) });
    // Give the query a tick; the badge should stay empty.
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
