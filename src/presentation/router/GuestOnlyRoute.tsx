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
  // Chat is the post-login landing; Settings is reachable from the chat sidebar.
  if (isAuthenticated) return <Navigate to={ROUTES.CHAT} replace />;
  return <>{children}</>;
}
