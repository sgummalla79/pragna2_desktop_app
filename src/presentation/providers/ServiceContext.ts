import { createContext, useContext } from 'react';
import type { AuthService } from '@/application/services/AuthService';

/**
 * Dependency-injection container for application services.
 *
 * Trimmed to `authService` for the login feature. As more features are ported
 * into the desktop app, add their services here (open/closed) — call sites read
 * only the services they need via {@link useServices}.
 */
export interface Services {
  authService: AuthService;
}

export const ServiceContext = createContext<Services | null>(null);

export function useServices(): Services {
  const ctx = useContext(ServiceContext);
  if (!ctx) throw new Error('useServices must be used inside ServiceProvider');
  return ctx;
}
