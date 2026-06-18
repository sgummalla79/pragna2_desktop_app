import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import PragnaLogo from '@brand/logo.svg?react';
import { APP_NAME } from '@/constants/api';
import { ROUTES } from '@/constants/routes';
import { ERRORS } from '@/constants/errors';
import { useAuth } from '@/presentation/hooks/auth/useAuth';
import { useAuth0Connections } from '@/presentation/hooks/auth/useAuth0Connections';
import { useServices } from '@/presentation/providers/ServiceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Card, CardContent } from '@/components/ui/card';
import { SocialLoginButton } from './SocialLoginButton';

/** Register page — mirrors the login layout so the two pages feel like a set. */
export default function RegisterView() {
  const { login, loginWithSocial } = useAuth();
  const { authService } = useServices();
  const { data: connections, isLoading: connectionsLoading } = useAuth0Connections();

  const [name, setName] = useState('');
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
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await authService.register({ email, password, name: name || undefined });
      await login({ email, password });
    } catch {
      setError(ERRORS.AUTH_008.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSocialLogin(connection: string) {
    setError('');
    setSocialLoading(connection);
    try {
      await loginWithSocial(connection);
    } catch {
      setError(ERRORS.AUTH_006.message);
    } finally {
      setSocialLoading(null);
    }
  }

  const hasSocial = (connections?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">

      {/* Brand header */}
      <div className="flex flex-col items-center mb-8 select-none">
        <PragnaLogo className="h-16 w-16 text-primary mb-3" aria-hidden="true" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{APP_NAME}</h1>
        <p className="text-sm text-muted-foreground mt-1">Your AI, Your Keys, Your Way</p>
      </div>

      {/* Auth card */}
      <Card className="w-full max-w-md shadow-xl border-border/60">
        <CardContent className="px-8 pt-8 pb-10">

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-foreground">Create your account</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Start building with {APP_NAME} today
            </p>
          </div>

          {/* Social connections */}
          {connectionsLoading && (
            <div className="flex flex-col gap-2 mb-4" aria-hidden="true">
              {[0, 1].map((i) => (
                <div key={i} className="h-11 rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {!connectionsLoading && hasSocial && (
            <div className="flex flex-col gap-2 mb-4">
              {connections!.map((conn) => (
                <SocialLoginButton
                  key={conn.name}
                  connection={conn}
                  loading={socialLoading === conn.name}
                  disabled={busy}
                  onClick={() => handleSocialLogin(conn.name)}
                />
              ))}
            </div>
          )}

          {hasSocial && (
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-3 text-xs text-muted-foreground font-medium uppercase tracking-widest">
                  or register with email
                </span>
              </div>
            </div>
          )}

          {/* Registration form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium">
                Display name <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-required="true"
                disabled={busy}
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-required="true"
                disabled={busy}
                className="h-11"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive"
              >
                <span className="mt-0.5 shrink-0">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full h-11 font-medium mt-2"
              disabled={busy}
              aria-busy={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" aria-hidden="true" />
                  Creating account…
                </span>
              ) : (
                'Create account'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Sign-in link */}
      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          to={ROUTES.LOGIN}
          className="font-medium text-primary hover:underline underline-offset-4 transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
