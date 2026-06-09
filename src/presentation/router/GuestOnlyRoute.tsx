import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/presentation/store/authStore';
import { ROUTES } from '@/constants/routes';
import type { ReactNode } from 'react';

interface GuestOnlyRouteProps {
  children: ReactNode;
}

export function GuestOnlyRoute({ children }: GuestOnlyRouteProps) {
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!bootstrapped) return null;
  // Settings is the current post-login landing (chat becomes the landing later).
  if (isAuthenticated) return <Navigate to={ROUTES.SETTINGS} replace />;
  return <>{children}</>;
}
