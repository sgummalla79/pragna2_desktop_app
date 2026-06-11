/**
 * Scenario 1 — Plain chat (no special features).
 *
 * Tests that the default chat agent receives a user message, streams a response,
 * and the conversation surface settles cleanly when the run completes.
 *
 * Real-LLM-required: this spec exercises a live Anthropic call. The seeded test
 * model carries a dummy key, so the runtime LLM call returns 401; without
 * `E2E_ANTHROPIC_API_KEY` we skip the spec with a clear message so the suite
 * doesn't fail confusingly. With a real key it runs as-is.
 *
 * Desktop adaptations vs the web app: auth comes from the seed-token `page`
 * fixture (no login form); the composer is a textarea matched by its placeholder
 * ("Ask anything…" on the landing — there is no `aria-label="Chat input"`); and
 * turns carry `data-role`. The run-complete signal is the Stop button reverting
 * to Send (the desktop ThinkingStrip is hidden when idle, with no "Ready"
 * label).
 */
import { test, expect } from '../fixtures';
import { psql } from '../helpers/db';
import { TIMEOUTS } from '../helpers/timeouts';

const HAS_REAL_KEY = Boolean(process.env.E2E_ANTHROPIC_API_KEY);

test.describe('Scenario 1 — Plain chat', () => {
  test.skip(
    !HAS_REAL_KEY,
    'requires E2E_ANTHROPIC_API_KEY (the seeded test model carries a dummy key → live LLM 401)',
  );

  test.beforeEach(async ({ page }) => {
    // Data isolation: the flow specs leave slash-exposed flows behind in the
    // shared serial DB, and the default agent will PROPOSE one ("Suggested
    // flow: …") instead of answering a plain question. Un-expose them so this
    // plain-chat turn gets a direct reply. Slash specs re-expose their own flow.
    psql('UPDATE flows SET exposed_as_slash = false WHERE exposed_as_slash = true;');
    // /chat lands on the chat landing view (centred composer).
    await page.goto('/chat', { waitUntil: 'networkidle' });
  });

  test('user message + assistant reply round-trip', async ({ page }) => {
    // The landing composer's placeholder is "Ask anything…" (ChatLandingView);
    // after navigation to the session it becomes "Reply…". Match either.
    const composer = page.getByPlaceholder(/ask anything|message the assistant|reply/i);
    await composer.click();
    await composer.fill('In one sentence, what is the capital of France?');
    await page.keyboard.press('Enter');

    // ── User bubble appears immediately (FE optimistically commits) ──
    await expect(page.locator('[data-role="user"]').last()).toContainText(
      /capital of France/i,
      { timeout: TIMEOUTS.UI_COMMIT },
    );

    // ── The Stop button replaces Send while the run streams ──
    // (aria-label="Stop generating" per ChatInput.tsx). Earliest deterministic
    // signal that the BE accepted the turn (app-controlled → tight).
    await expect(
      page.getByRole('button', { name: /stop generating/i }),
    ).toBeVisible({ timeout: TIMEOUTS.RUN_ACCEPT });

    // ── A streaming assistant bubble appears ──
    const assistantBubble = page.locator('[data-role="assistant"]').last();
    await expect(assistantBubble).toBeVisible({ timeout: TIMEOUTS.FE_SETTLE });

    // ── Wait for streaming to finish (Stop reverts to Send) — model time ──
    await expect(
      page.getByRole('button', { name: /stop generating/i }),
    ).toHaveCount(0, { timeout: TIMEOUTS.CHAT_REPLY });

    // ── Shape assertions on the final reply ──
    // We do NOT assert exact content. We DO assert the reply has material text
    // and mentions Paris (the right answer to this factual prompt).
    const finalText = (await assistantBubble.textContent()) ?? '';
    expect(finalText.length).toBeGreaterThan(5);
    expect(finalText).toMatch(/Paris/i);
  });
});
