import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useOverlayTitleBarInset } from './useOverlayTitleBarInset';
import { TRAFFIC_LIGHT_SAFE_INSET_PX } from '@/constants/windowChrome';

/**
 * The hook's only job is: apply a left inset clearing the macOS overlay traffic
 * lights ONLY when that chrome is present. Both branches are asserted by mocking
 * the platform predicate, so the inset never leaks into browser-fallback / e2e
 * (a Windows-UA browser must get no mac inset — the CF-011 family of bugs).
 */
const usesMacOverlayChrome = vi.fn();
vi.mock('@/infrastructure/platform', () => ({
  usesMacOverlayChrome: () => usesMacOverlayChrome(),
}));

describe('useOverlayTitleBarInset', () => {
  beforeEach(() => {
    usesMacOverlayChrome.mockReset();
  });

  it('returns a left inset clearing the traffic lights on macOS-overlay chrome', () => {
    usesMacOverlayChrome.mockReturnValue(true);
    const { result } = renderHook(() => useOverlayTitleBarInset());
    expect(result.current).toEqual({ paddingLeft: TRAFFIC_LIGHT_SAFE_INSET_PX });
  });

  it('returns undefined off macOS-overlay chrome (Windows / browser-fallback)', () => {
    usesMacOverlayChrome.mockReturnValue(false);
    const { result } = renderHook(() => useOverlayTitleBarInset());
    expect(result.current).toBeUndefined();
  });
});
