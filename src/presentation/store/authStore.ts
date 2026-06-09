import { create } from 'zustand';
import type { User } from '@/domain/types/auth.types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  bootstrapped: boolean;
  isAuthenticated: boolean;

  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  setBootstrapped: (value: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  bootstrapped: false,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: user !== null }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setBootstrapped: (bootstrapped) => set({ bootstrapped }),
  reset: () => set({ user: null, accessToken: null, bootstrapped: true, isAuthenticated: false }),
}));
