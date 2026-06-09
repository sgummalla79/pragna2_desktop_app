import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServiceProvider } from '@/presentation/providers/ServiceProvider';
import { AppRoutes } from '@/presentation/router/AppRoutes';
import { useBootstrap } from '@/presentation/hooks/auth/useBootstrap';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function BootstrapGate() {
  useBootstrap();
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ServiceProvider>
          <BootstrapGate />
          {/* Each route owns its own layout; this wrapper just guarantees a
              min viewport height so short pages don't collapse. */}
          <main className="min-h-screen">
            <AppRoutes />
          </main>
        </ServiceProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
