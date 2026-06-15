import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Fake the Tauri window API so the "inside Tauri" path is exercisable in jsdom,
// and so we can assert it is NEVER called outside the runtime (the CF-011 guard).
// `vi.hoisted` lets the mock factory (hoisted above imports) reference the spy.
const { getCurrentWindow } = vi.hoisted(() => ({
  getCurrentWindow: vi.fn(() => ({
    isMaximized: vi.fn().mockResolvedValue(false),
    onResized: vi.fn().mockResolvedValue(() => {}),
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
  })),
}));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow }));

import { WindowsTitleBar } from './WindowsTitleBar';

/** Real `isTauriRuntime()` keys off this; set/unset it to flip the runtime. */
function enterTauriRuntime(): void {
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  getCurrentWindow.mockClear();
});

describe('WindowsTitleBar — defensive runtime guard (CF-011)', () => {
  it('renders nothing AND never calls the Tauri window API outside the Tauri runtime', () => {
    const { container } = render(<WindowsTitleBar />);

    // Degrades to nothing instead of crashing the React tree on absent internals.
    expect(container).toBeEmptyDOMElement();
    expect(getCurrentWindow).not.toHaveBeenCalled();
  });

  it('renders the min/max/close window controls inside the Tauri runtime', () => {
    enterTauriRuntime();
    render(<WindowsTitleBar />);

    expect(screen.getByRole('button', { name: 'Minimize' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Maximize|Restore/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(getCurrentWindow).toHaveBeenCalled();
  });
});
