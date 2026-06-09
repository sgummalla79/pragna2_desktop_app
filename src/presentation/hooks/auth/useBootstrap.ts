import { useEffect } from 'react';
import { useAuthStore } from '@/presentation/store/authStore';
import { useServices } from '@/presentation/providers/ServiceContext';

export function useBootstrap(): void {
  const setUser = useAuthStore((s) => s.setUser);
  const setBootstrapped = useAuthStore((s) => s.setBootstrapped);
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const { authService } = useServices();

  useEffect(() => {
    if (bootstrapped) return;

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
