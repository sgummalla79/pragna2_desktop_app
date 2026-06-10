import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSmoothStreamingText } from './useSmoothStreamingText';

describe('useSmoothStreamingText', () => {
  it('returns the full text immediately for a non-streaming turn', () => {
    const { result } = renderHook(() => useSmoothStreamingText('hello world', false));
    expect(result.current).toBe('hello world');
  });

  it('starts from an empty prefix when mounted mid-stream', () => {
    const { result } = renderHook(() => useSmoothStreamingText('hello world', true));
    expect(result.current).toBe('');
  });

  it('snaps to the full text when streaming ends', () => {
    const { result, rerender } = renderHook(
      ({ text, streaming }: { text: string; streaming: boolean }) =>
        useSmoothStreamingText(text, streaming),
      { initialProps: { text: 'hello world', streaming: true } },
    );
    expect(result.current).toBe('');
    rerender({ text: 'hello world', streaming: false });
    expect(result.current).toBe('hello world');
  });

  it('shows everything at once for a completed historical turn', () => {
    const { result } = renderHook(() => useSmoothStreamingText('archived reply', false));
    expect(result.current).toBe('archived reply');
  });
});
