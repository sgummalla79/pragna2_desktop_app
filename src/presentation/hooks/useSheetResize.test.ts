import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useSheetResize } from './useSheetResize';

/**
 * The hook maps a right-anchored sheet's left-edge drag to a width and clamps it
 * to `[minWidth, viewport − 2·edgeInset]`. Tests drive the document-level pointer
 * listeners directly (the handle only flips `resizing` on; the math lives in the
 * window move handler).
 */
const DEFAULT = 720;
const MIN = 420;
const INSET = 10;

function setViewport(px: number) {
  Object.defineProperty(window, 'innerWidth', { value: px, configurable: true });
}

describe('useSheetResize', () => {
  beforeEach(() => setViewport(1400));
  afterEach(() => setViewport(1024));

  it('returns the default width before any drag', () => {
    const { result } = renderHook(() => useSheetResize(DEFAULT, MIN, INSET));
    expect(result.current.width).toBe(DEFAULT);
    expect(result.current.resizing).toBe(false);
  });

  it('clamps the default down to the viewport cap on a narrow window', () => {
    setViewport(600); // cap = 600 − 20 = 580 < 720
    const { result } = renderHook(() => useSheetResize(DEFAULT, MIN, INSET));
    expect(result.current.width).toBe(580);
  });

  it('widens to (viewportRight − inset − clientX) while dragging', () => {
    const { result } = renderHook(() => useSheetResize(DEFAULT, MIN, INSET));
    act(() => {
      result.current.startResize({ button: 0, preventDefault() {} } as never);
    });
    expect(result.current.resizing).toBe(true);
    act(() => {
      // clientX 500 → width = 1400 − 10 − 500 = 890
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 500 }));
    });
    expect(result.current.width).toBe(890);
    act(() => window.dispatchEvent(new PointerEvent('pointerup')));
    expect(result.current.resizing).toBe(false);
  });

  it('never narrows below minWidth', () => {
    const { result } = renderHook(() => useSheetResize(DEFAULT, MIN, INSET));
    act(() => {
      result.current.startResize({ button: 0, preventDefault() {} } as never);
    });
    act(() => {
      // clientX far right → desired tiny, clamped up to MIN (420)
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 1390 }));
    });
    expect(result.current.width).toBe(MIN);
  });

  it('ignores non-primary buttons', () => {
    const { result } = renderHook(() => useSheetResize(DEFAULT, MIN, INSET));
    act(() => {
      result.current.startResize({ button: 2, preventDefault() {} } as never);
    });
    expect(result.current.resizing).toBe(false);
  });
});
