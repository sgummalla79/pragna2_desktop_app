import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import { useAuthStore } from '@/presentation/store/authStore';
import { AvatarMenu } from './AvatarMenu';

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigate };
});

const logout = vi.fn();

function wrap() {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <ServiceContext.Provider value={{ authService: { logout } } as unknown as Services}>
        {children}
      </ServiceContext.Provider>
    </MemoryRouter>
  );
}

function seedUser(user: { email: string; name: string | null } | null) {
  useAuthStore.setState({ user, isAuthenticated: user !== null, bootstrapped: true });
}

beforeEach(() => {
  navigate.mockReset();
  logout.mockReset();
  useAuthStore.getState().reset();
});

describe('AvatarMenu', () => {
  it('shows the display name (preferring name over email) and its initial', () => {
    seedUser({ email: 'sam@example.com', name: 'Sam Carter' });
    render(<AvatarMenu />, { wrapper: wrap() });

    expect(screen.getByRole('button', { name: /account menu/i })).toBeInTheDocument();
    expect(screen.getByText('Sam Carter')).toBeInTheDocument();
    expect(screen.getByText('S')).toBeInTheDocument(); // avatar initial
  });

  it('falls back to the email (and its initial) when name is null', () => {
    seedUser({ email: 'zoe@example.com', name: null });
    render(<AvatarMenu />, { wrapper: wrap() });

    expect(screen.getByText('zoe@example.com')).toBeInTheDocument();
    expect(screen.getByText('Z')).toBeInTheDocument();
  });

  it('opens the menu and exposes Settings + Sign out, plus the email label', async () => {
    seedUser({ email: 'sam@example.com', name: 'Sam Carter' });
    render(<AvatarMenu />, { wrapper: wrap() });

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }));

    expect(await screen.findByRole('menuitem', { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument();
    // The email appears twice once open (trigger truncation + menu label); the
    // label is the menu identity row.
    expect(screen.getAllByText('sam@example.com').length).toBeGreaterThan(0);
  });

  it('navigates to settings when Settings is selected', async () => {
    seedUser({ email: 'sam@example.com', name: 'Sam Carter' });
    render(<AvatarMenu />, { wrapper: wrap() });

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /settings/i }));

    expect(navigate).toHaveBeenCalledWith('/settings');
  });

  it('signs out: clears the auth store and redirects to login', async () => {
    seedUser({ email: 'sam@example.com', name: 'Sam Carter' });
    render(<AvatarMenu />, { wrapper: wrap() });

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /sign out/i }));

    expect(logout).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('renders a defensive fallback label when there is no user', () => {
    seedUser(null);
    render(<AvatarMenu />, { wrapper: wrap() });

    expect(screen.getByText('Account')).toBeInTheDocument();
  });
});
