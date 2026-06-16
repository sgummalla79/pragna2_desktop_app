/**
 * Centralized e2e timeouts — single source of truth (no inline magic numbers).
 *
 * The values are split deliberately so generous bounds DON'T MASK app problems
 * (see pragna2-tracker TD-027 measurement, 2026-06-11):
 *
 *   • APP-CONTROLLED phases stay TIGHT. Measured at single-digit ms, so these
 *     bounds keep large margin yet still TRIP if the app regresses to seconds —
 *     they are the real regression guards. Do NOT loosen them to "fix" flakes.
 *
 *   • MODEL-CONTROLLED waits are generous. That latency is EXTERNAL (the LLM
 *     generating tokens — measured ~1.3 s for a one-sentence reply, ~14 s for a
 *     four-paragraph essay, and minutes for create_pdf_long). A generous bound
 *     here cannot hide an app bug because the app's own overhead is ~ms.
 *
 * NOTE: e2e timeouts are CORRECTNESS guards ("does it eventually work"), not
 * performance guards. True latency-regression / scaling detection belongs to a
 * dedicated phase-timing or load test (pragna2-tracker TD-029), not to these numbers.
 */
export const TIMEOUTS = {
  // ── App-controlled (TIGHT) ──────────────────────────────────────────────
  /** Optimistic UI commit — the user bubble appears (FE, measured ~ms). */
  UI_COMMIT: 5_000,
  /** Run accepted — the Stop button appears (FE+BE, measured ~15 ms). */
  RUN_ACCEPT: 20_000,
  /** A route change / navigation settles (FE router). */
  NAV: 15_000,
  /** A reply RENDERS after the model stream has ended (FE settle, measured
   *  2–5 ms). Tight on purpose: this is the app-render regression guard. */
  FE_SETTLE: 10_000,

  // ── Model-controlled (GENEROUS — external LLM time, can't mask app bugs) ──
  /** A normal chat reply finishes streaming (model generation; ~1.3–14 s
   *  measured + headroom for provider latency spikes). */
  CHAT_REPLY: 90_000,
  /** A multi-turn / multi-agent flow run finishes (several model turns). */
  FLOW_RUN: 180_000,
  /** An async long document finishes (create_pdf_long fan-out — minutes). */
  LONG_DOC: 360_000,
} as const;
