import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ServiceProvider } from '@/presentation/providers/ServiceProvider';
import { AppRoutes } from '@/presentation/router/AppRoutes';
import { useBootstrap } from '@/presentation/hooks/auth/useBootstrap';
import { useVersionCheck } from '@/presentation/hooks/useVersionCheck';
import { VersionBanner } from '@/presentation/components/VersionBanner';
import { UpdateRequiredScreen } from '@/presentation/components/UpdateRequiredScreen';
import { AppTitleBar } from '@/components/ui/AppTitleBar';

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
  useVersionCheck();
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ServiceProvider>
          <BootstrapGate />
          {/* Windows (Tauri): custom title bar with drag region + min/max/close;
              macOS / browser-fallback: plain drag strip. See {@link AppTitleBar}. */}
          <AppTitleBar />
          <VersionBanner />
          <UpdateRequiredScreen />
          {/* Each route owns its own layout; this wrapper just guarantees a
              min viewport height so short pages don't collapse. */}
          <main className="min-h-screen">
            <AppRoutes />
          </main>
          <Toaster position="bottom-right" richColors closeButton />
        </ServiceProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
