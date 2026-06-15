import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock the platform predicate so each test drives the branch directly, and stub
// the Tauri-dependent WindowsTitleBar so this test never touches Tauri APIs.
vi.mock('@/infrastructure/platform', () => ({ usesWindowsChrome: vi.fn() }));
vi.mock('./WindowsTitleBar', () => ({
  WindowsTitleBar: () => <div data-testid="windows-title-bar" />,
}));

import { AppTitleBar } from './AppTitleBar';
import { usesWindowsChrome } from '@/infrastructure/platform';

const mockUsesWindowsChrome = vi.mocked(usesWindowsChrome);

describe('AppTitleBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the custom WindowsTitleBar when usesWindowsChrome() is true (Windows + Tauri)', () => {
    mockUsesWindowsChrome.mockReturnValue(true);
    const { container } = render(<AppTitleBar />);

    expect(screen.getByTestId('windows-title-bar')).toBeInTheDocument();
    // The plain macOS/browser drag strip must NOT also render.
    expect(container.querySelector('[data-tauri-drag-region]')).toBeNull();
  });

  it('renders the plain drag strip when usesWindowsChrome() is false (macOS / browser-fallback)', () => {
    mockUsesWindowsChrome.mockReturnValue(false);
    const { container } = render(<AppTitleBar />);

    expect(screen.queryByTestId('windows-title-bar')).toBeNull();
    expect(container.querySelector('[data-tauri-drag-region]')).not.toBeNull();
  });
});
