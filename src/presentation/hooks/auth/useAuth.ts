import { useAuthStore } from '@/presentation/store/authStore';
import { useServices } from '@/presentation/providers/ServiceContext';
import { tokenStorage } from '@/infrastructure/storage/tokenStorage';
import type { LoginPayload } from '@/domain/types/auth.types';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const setUser = useAuthStore((s) => s.setUser);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const reset = useAuthStore((s) => s.reset);

  const { authService } = useServices();

  async function login(payload: LoginPayload): Promise<void> {
    const { user: loggedInUser, tokens } = await authService.login(payload);
    setAccessToken(tokens.accessToken);
    setUser(loggedInUser);
  }

  async function loginWithSocial(connection: string): Promise<void> {
    const { user: loggedInUser, tokens } = await authService.loginWithSocial(connection);
    setAccessToken(tokens.accessToken);
    setUser(loggedInUser);
  }

  function logout(): void {
    authService.logout();
    tokenStorage.clearAll();
    reset();
  }

  return { user, isAuthenticated, bootstrapped, login, loginWithSocial, logout };
}
