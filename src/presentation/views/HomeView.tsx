import { useNavigate } from 'react-router-dom';
import PragnaLogo from '@/assets/logo.svg?react';
import { APP_NAME } from '@/constants/api';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/presentation/hooks/auth/useAuth';
import { Button } from '@/components/ui/button';

/**
 * Minimal post-login landing. The full chat surface from the source app is not
 * yet ported into the desktop app — this confirms an authenticated session and
 * lets the user sign out, so the login flow is demoable end-to-end.
 */
export default function HomeView() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    navigate(ROUTES.LOGIN, { replace: true });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-8 text-center">
      <PragnaLogo className="h-16 w-16" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          You're signed in to {APP_NAME}
        </h1>
        {user?.email && (
          <p className="text-sm text-muted-foreground">{user.email}</p>
        )}
      </div>
      <Button variant="outline" size="lg" onClick={handleLogout} className="h-11">
        Sign out
      </Button>
    </div>
  );
}
