import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import { ERRORS } from '@/constants/errors';
import { useAuthStore } from '@/presentation/store/authStore';
import type { Services } from '@/presentation/providers/ServiceContext';
import LoginView from './LoginView';

/**
 * Tier 1 tests for the Login page.
 *
 * LoginView is a centring shell around LoginForm; all logic lives in the form,
 * which we exercise through LoginView so the composition is covered too. We
 * assert field rendering, the required-fields guard, the happy-path login call,
 * and the invalid-credentials message. `useAuth().login` writes the real
 * authStore on success — reset per test. Social connections are stubbed empty.
 */

function services(overrides: Record<string, unknown> = {}): Partial<Services> {
  return {
    authService: {
      login: vi.fn().mockResolvedValue({
        user: { id: 'u1', email: 'a@b.com' },
        tokens: { accessToken: 'tok' },
      }),
      fetchSocialConnections: vi.fn().mockResolvedValue([]),
      ...overrides,
    } as never,
  };
}

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    bootstrapped: false,
  });
});

describe('LoginView', () => {
  it('renders the email + password fields and the sign-in button', () => {
    renderWithProviders(<LoginView />, { services: services() });

    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('validates that email and password are required', async () => {
    const login = vi.fn();
    renderWithProviders(<LoginView />, { services: services({ login }) });

    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email and password are required.',
    );
    expect(login).not.toHaveBeenCalled();
  });

  it('calls authService.login with the entered credentials on submit', async () => {
    const login = vi.fn().mockResolvedValue({
      user: { id: 'u1', email: 'a@b.com' },
      tokens: { accessToken: 'tok' },
    });
    renderWithProviders(<LoginView />, { services: services({ login }) });

    await userEvent.type(screen.getByLabelText('Email address'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'password123' }),
    );
  });

  it('shows the invalid-credentials message when login rejects', async () => {
    const login = vi.fn().mockRejectedValue(new Error('bad creds'));
    renderWithProviders(<LoginView />, { services: services({ login }) });

    await userEvent.type(screen.getByLabelText('Email address'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(ERRORS.AUTH_007.message);
  });
});
