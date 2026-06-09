import { useMemo, type ReactNode } from 'react';
import { axiosClient } from '@/infrastructure/http/axiosClient';
import { applyAuthInterceptor } from '@/infrastructure/http/authInterceptor';
import { applyCorrelationInterceptor } from '@/infrastructure/http/correlationInterceptor';
import { Auth0Repository } from '@/infrastructure/auth0/Auth0Repository';
import { TauriLoopbackAuthFlow } from '@/infrastructure/auth0/tauriLoopbackAuthFlow';
import { AuthService } from '@/application/services/AuthService';
import { useAuthStore } from '@/presentation/store/authStore';
import { ServiceContext } from './ServiceContext';

applyCorrelationInterceptor(axiosClient);

interface ServiceProviderProps {
  children: ReactNode;
}

/**
 * Constructs the application services once and provides them via context.
 * Wires the Auth0 strategy (email/password ROPG + social redirect) onto the
 * shared axios client. On a 401 the auth interceptor resets the auth store.
 */
export function ServiceProvider({ children }: ServiceProviderProps) {
  const reset = useAuthStore((s) => s.reset);

  const services = useMemo(() => {
    applyAuthInterceptor(axiosClient, reset);

    const authFlow = new TauriLoopbackAuthFlow();
    const authRepo = new Auth0Repository(axiosClient, authFlow);

    return {
      authService: new AuthService(authRepo),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <ServiceContext.Provider value={services}>{children}</ServiceContext.Provider>;
}
