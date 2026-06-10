import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppearanceView from './AppearanceView';
import { useThemeStore } from '@/presentation/store/themeStore';
import { DARK_CLASS } from '@/constants/theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove(DARK_CLASS);
  // Deterministic OS preference (light) for `system`.
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  useThemeStore.setState({ mode: 'system' });
});

describe('AppearanceView', () => {
  it('renders the three theme options as radios', () => {
    render(<AppearanceView />);
    expect(screen.getByRole('radio', { name: 'Light' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'System' })).toBeInTheDocument();
  });

  it('marks the current store mode as checked', () => {
    useThemeStore.setState({ mode: 'system' });
    render(<AppearanceView />);
    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Light' })).not.toBeChecked();
  });

  it('selecting Dark updates the store and applies the .dark class', async () => {
    render(<AppearanceView />);
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));

    expect(useThemeStore.getState().mode).toBe('dark');
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(true);
  });

  it('selecting Light removes the .dark class', async () => {
    useThemeStore.getState().setMode('dark');
    render(<AppearanceView />);
    await userEvent.click(screen.getByRole('radio', { name: 'Light' }));

    expect(useThemeStore.getState().mode).toBe('light');
    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(false);
  });
});
