import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/presentation/store/authStore';
import { useServices } from '@/presentation/providers/ServiceContext';

export function useBootstrap(): void {
  const setUser = useAuthStore((s) => s.setUser);
  const setBootstrapped = useAuthStore((s) => s.setBootstrapped);
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const { authService } = useServices();

  // One-shot guard: StrictMode double-invokes this effect in dev before
  // `bootstrapped` flips, so the plain `if (bootstrapped) return` below can't
  // stop a second concurrent run. The ref blocks it at the source (AuthService
  // is also single-flight as a second line of defence).
  const started = useRef(false);

  useEffect(() => {
    if (bootstrapped || started.current) return;
    started.current = true;

    authService
      .bootstrap()
      .then((result) => {
        if (result) {
          setAccessToken(result.accessToken);
          setUser(result.user);
        }
      })
      .finally(() => {
        setBootstrapped(true);
      });
  }, [bootstrapped, authService, setUser, setBootstrapped, setAccessToken]);
}
