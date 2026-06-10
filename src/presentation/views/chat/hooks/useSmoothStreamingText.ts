import { useEffect, useRef, useState } from 'react';
import {
  STREAM_REVEAL_BASE_CPS,
  STREAM_REVEAL_MAX_LAG_SECONDS,
} from '@/constants/markdown';

/** Cap per-frame dt so a backgrounded tab (huge gap) doesn't dump the whole
 *  buffer in one jarring jump when the tab regains focus. 50ms ≈ 3 frames. */
const MAX_FRAME_DT_SECONDS = 0.05;

/**
 * Reveal streamed assistant text at a steady, eased cadence — the
 * claude.ai / ChatGPT "smooth typing" feel — instead of dumping each raw
 * SSE delta to the DOM the instant it arrives (which reads as chunky).
 *
 * While ``isStreaming`` is true the returned string is a growing prefix of
 * ``fullText`` advanced on every animation frame at
 * ``max(BASE_CPS, backlog / MAX_LAG_SECONDS)`` chars/sec (see
 * :data:`STREAM_REVEAL_BASE_CPS`). The catch-up term keeps the reveal from
 * lagging behind a bursty stream while still smoothing it. When streaming
 * ends — or for any non-streaming turn (history, user turns, completed
 * replies) — the full text is returned immediately with no animation.
 *
 * Slicing a markdown prefix is safe: Streamdown's ``parseIncompleteMarkdown``
 * already repairs unterminated fences/tables during streaming, so a partial
 * reveal renders cleanly.
 *
 * @param fullText The accumulated text so far (the streaming buffer).
 * @param isStreaming True only while this turn is actively streaming.
 * @returns The portion of ``fullText`` to render this frame.
 */
export function useSmoothStreamingText(
  fullText: string,
  isStreaming: boolean,
): string {
  // Start from 0 when the turn mounts mid-stream so the reply types in from
  // the beginning; non-streaming turns (history, completed, user) start
  // fully shown. Lazy init reads ``isStreaming`` at first render only.
  const [count, setCount] = useState(() => (isStreaming ? 0 : fullText.length));
  // Fractional reveal position (state is the floored, render-facing value).
  const countFloatRef = useRef(count);
  // Latest text read by the rAF loop without restarting it every token.
  const fullTextRef = useRef(fullText);
  fullTextRef.current = fullText;
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  // Non-streaming turns (completed / historical / user) show everything at
  // once. Also the snap-to-full when a stream finishes.
  useEffect(() => {
    if (!isStreaming) {
      countFloatRef.current = fullText.length;
      setCount(fullText.length);
    }
  }, [isStreaming, fullText]);

  // Guard against the buffer shrinking (regen / branch swaps in shorter
  // content) leaving the cursor past the end.
  useEffect(() => {
    if (countFloatRef.current > fullText.length) {
      countFloatRef.current = fullText.length;
      setCount(fullText.length);
    }
  }, [fullText.length]);

  useEffect(() => {
    if (!isStreaming) return undefined;

    const tick = (ts: number) => {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = Math.min(MAX_FRAME_DT_SECONDS, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;

      const target = fullTextRef.current.length;
      const current = countFloatRef.current;
      const backlog = target - current;
      if (backlog > 0) {
        // Steady typing speed, but never trail the buffer by more than
        // MAX_LAG seconds: a big chunk speeds the reveal up just enough to
        // clear within that window, so it animates instead of snapping.
        const rate = Math.max(
          STREAM_REVEAL_BASE_CPS,
          backlog / STREAM_REVEAL_MAX_LAG_SECONDS,
        );
        const next = Math.min(target, current + rate * dt);
        countFloatRef.current = next;
        // setCount with an unchanged floored value is a no-op re-render
        // (React bails), so an idle "caught up" loop stays cheap.
        setCount(Math.floor(next));
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    };
  }, [isStreaming]);

  return fullText.slice(0, count);
}
