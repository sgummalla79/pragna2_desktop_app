/**
 * Shared test renderer for component-integration tests.
 *
 * Mounts a real component inside the three providers every view needs — a
 * retry-disabled TanStack Query client, the {@link ServiceContext} DI container
 * (with caller-supplied mock services), and a {@link MemoryRouter} — so view
 * tests stop repeating the same inline wrapper. Supply only the services the
 * view under test actually reads via {@link useServices}; the rest stay absent
 * (a view that touches an unmocked service throws, which is the signal you
 * forgot to mock it).
 *
 * Router navigation: this provides the router context only. To assert
 * navigation, mock `useNavigate` at the module level in the spec (vi.mock),
 * exactly as the existing view tests do — that can't be injected here because
 * vi.mock is hoisted per-file.
 */
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Partial service mocks merged onto the empty container — supply only what
   *  the view reads. Cast through `unknown` because a `Partial` isn't a
   *  structurally-complete {@link Services}; that's intentional. */
  services?: Partial<Services>;
  /** Initial history entries for the {@link MemoryRouter} (default `['/']`). */
  initialEntries?: string[];
  /** Reuse a client across a rerender; defaults to a fresh retry-off client. */
  queryClient?: QueryClient;
}

/** A TanStack Query client tuned for tests: no retries (failures surface
 *  immediately) and no mutation retries (deterministic error assertions). */
export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

/**
 * Render `ui` wrapped in the standard provider stack. Returns the usual
 * Testing-Library result plus the `queryClient` so a spec can prime or inspect
 * the cache.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderResult & { queryClient: QueryClient } {
  const {
    services = {},
    initialEntries = ['/'],
    queryClient = makeTestQueryClient(),
    ...renderOptions
  } = options;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ServiceContext.Provider value={services as unknown as Services}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </ServiceContext.Provider>
    </QueryClientProvider>
  );

  return { ...render(ui, { wrapper, ...renderOptions }), queryClient };
}
