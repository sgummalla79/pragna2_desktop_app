import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

import PragnaLogo from '@/assets/logo.svg?react';
import { APP_NAME } from '@/constants/api';
import { ERRORS } from '@/constants/errors';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/presentation/hooks/auth/useAuth';
import { useAuth0Connections } from '@/presentation/hooks/auth/useAuth0Connections';
import { SocialLoginButton } from '@/presentation/views/auth/SocialLoginButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';

/**
 * Self-contained login card. Brand header + form + social options +
 * register link. Layout, copy and spacing replicate the source app's login;
 * primitives are shadcn (Button/Input) themed by the active tweakcn palette.
 * Every surface reads a semantic token — no inline colours.
 */
export function LoginForm() {
  const { login, loginWithSocial } = useAuth();
  const { data: connections, isLoading: connectionsLoading } = useAuth0Connections();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  const busy = loading || socialLoading !== null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      await login({ email, password });
    } catch {
      setError(ERRORS.AUTH_007.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSocialLogin(connection: string) {
    setError('');
    setSocialLoading(connection);
    try {
      // Opens the system browser; resolves once Auth0 redirects back to the
      // loopback server. On success the auth store flips and the guard
      // redirects to the app — no manual navigation needed here.
      await loginWithSocial(connection);
    } catch {
      setError(ERRORS.AUTH_006.message);
    } finally {
      setSocialLoading(null);
    }
  }

  return (
    <div className="w-full max-w-[380px] flex flex-col gap-[18px] rounded-2xl border border-border bg-popover text-popover-foreground p-9 shadow-2xl">
      {/* Brand — logo + app name */}
      <div className="flex flex-col items-center gap-2.5 pb-2">
        <PragnaLogo className="h-16 w-16" aria-hidden="true" />
        <span className="text-[32px] font-bold leading-none tracking-tight text-foreground">
          {APP_NAME}
        </span>
      </div>

      {/* Error banner — standard shadcn destructive tokens */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive"
        >
          <AlertCircle size={14} className="mt-[1px] flex-shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Email / password form */}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2.5">
        <Input
          type="email"
          autoComplete="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email address"
          aria-required="true"
          disabled={busy}
          className="h-11"
        />

        <PasswordInput
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-label="Password"
          aria-required="true"
          disabled={busy}
          className="h-11"
        />

        <Button
          type="submit"
          size="lg"
          disabled={busy}
          aria-busy={loading}
          className="w-full h-11 mt-1"
        >
          {loading ? (
            <>
              <span
                aria-hidden="true"
                className="inline-block h-3.5 w-3.5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin"
              />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-2.5 text-[12px] text-muted-foreground">
        <span className="flex-1 h-px bg-border" />
        or
        <span className="flex-1 h-px bg-border" />
      </div>

      {/* Social connections */}
      <div className="flex flex-col gap-2">
        {connectionsLoading && (
          <p className="text-center text-[13px] text-muted-foreground py-2">
            Loading sign-in options…
          </p>
        )}

        {!connectionsLoading && connections?.map((conn) => (
          <SocialLoginButton
            key={conn.name}
            connection={conn}
            loading={socialLoading === conn.name}
            disabled={busy}
            onClick={() => handleSocialLogin(conn.name)}
          />
        ))}
      </div>

      {/* Register link */}
      <p className="text-center text-[13px] text-muted-foreground mt-1">
        No account?{' '}
        <Link
          to={ROUTES.REGISTER}
          className="font-medium text-primary no-underline hover:underline"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
