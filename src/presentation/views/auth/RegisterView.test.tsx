import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import { ERRORS } from '@/constants/errors';
import { useAuthStore } from '@/presentation/store/authStore';
import type { Services } from '@/presentation/providers/ServiceContext';
import RegisterView from './RegisterView';

/**
 * Tier 1 tests for the Register page.
 *
 * Covers field rendering, the local validation guards (required + min length),
 * and the happy path: register then auto-login, asserting the service is called
 * with the right args. `useAuth` writes to the real authStore on success — we
 * reset it per test. Social connections are stubbed empty so that branch stays
 * out of the way (its own rendering is covered by the LoginForm/social specs).
 */

function services(overrides: Record<string, unknown> = {}): Partial<Services> {
  return {
    authService: {
      register: vi.fn().mockResolvedValue(undefined),
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

describe('RegisterView', () => {
  it('renders the name, email and password fields and the submit button', async () => {
    renderWithProviders(<RegisterView />, { services: services() });

    expect(screen.getByLabelText(/Display name/)).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
  });

  it('validates that email and password are required', async () => {
    const register = vi.fn();
    renderWithProviders(<RegisterView />, { services: services({ register }) });

    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email and password are required.',
    );
    expect(register).not.toHaveBeenCalled();
  });

  it('rejects a password shorter than 8 characters', async () => {
    const register = vi.fn();
    renderWithProviders(<RegisterView />, { services: services({ register }) });

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Password must be at least 8 characters.',
    );
    expect(register).not.toHaveBeenCalled();
  });

  it('registers then logs in with the entered credentials on a valid submit', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    const login = vi.fn().mockResolvedValue({
      user: { id: 'u1', email: 'a@b.com' },
      tokens: { accessToken: 'tok' },
    });
    renderWithProviders(<RegisterView />, { services: services({ register, login }) });

    await userEvent.type(screen.getByLabelText(/Display name/), 'Alice');
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith({
        email: 'a@b.com',
        password: 'password123',
        name: 'Alice',
      }),
    );
    expect(login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'password123' });
  });

  it('omits the optional name when left blank', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<RegisterView />, { services: services({ register }) });

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith({
        email: 'a@b.com',
        password: 'password123',
        name: undefined,
      }),
    );
  });

  it('shows the registration-failed message when the service rejects', async () => {
    const register = vi.fn().mockRejectedValue(new Error('exists'));
    renderWithProviders(<RegisterView />, { services: services({ register }) });

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(ERRORS.AUTH_008.message);
  });
});
