/**
 * Scenario 14 — Rapid chat switching (the bug repro that motivated the
 * Background-Run Execution architecture).
 *
 * Before that work, rapid submits with immediate "New chat" clicks produced
 * ghost sidebar entries — visible but with no DB row behind them. The per-user
 * concurrent-runs cap is 3, so we fire exactly 3 in rapid succession and confirm
 * each survives to a persisted reply.
 *
 * Real-LLM-required + LIVE-STREAMING: needs live background runs, so it is
 * skip-guarded on `E2E_ANTHROPIC_API_KEY`. The seeded test model carries a dummy
 * key, so without a real key the spec self-skips.
 *
 * KNOWN FAILURE (ported from the web app, tracked as issue #1 there): rapid
 * submit-then-abandon can drop a background run's assistant reply (user turn
 * persists, no assistant message; DB-confirmed, no BE error). Marked `fixme`
 * (NOT masked with timeout bumps, which would hide the real lost-reply bug) —
 * remove once the background-run persistence race is fixed.
 *
 * Desktop adaptations vs the web app: auth via the seed-token `page` fixture (no
 * login); composer matched by placeholder; turns carry `data-role`; the
 * "New chat" sidebar button is matched by its text.
 */
import { test, expect } from '../fixtures';

const HAS_REAL_KEY = Boolean(process.env.E2E_LLM_API_KEY ?? process.env.E2E_ANTHROPIC_API_KEY ?? process.env.E2E_OPENAI_API_KEY ?? process.env.E2E_GOOGLE_API_KEY);

const RAPID_PROMPTS = [
  'In one sentence, what is the largest planet in our solar system?',
  'In one sentence, what is the chemical formula for water?',
  'In one sentence, who painted the Mona Lisa?',
];

test.describe('Scenario 14 — Rapid chat switching', () => {
  test.describe.configure({ timeout: 240_000 });

  test.skip(
    !HAS_REAL_KEY,
    'requires a real LLM key (E2E_LLM_API_KEY or E2E_<PROVIDER>_API_KEY) — live background runs needed',
  );

  test.fixme('3 rapid submits + new-chat clicks all persist replies', async ({
    page,
  }) => {
    await page.goto('/chat', { waitUntil: 'networkidle' });

    const conversationUrls: string[] = [];

    for (const prompt of RAPID_PROMPTS) {
      const composer = page.getByPlaceholder(/ask .*anything|message the assistant|reply/i);
      // The composer briefly disables between rapid submits while the new-chat
      // route remounts and the prior run's eager-create flush completes.
      await expect(composer).toBeEnabled({ timeout: 15_000 });
      await composer.click();
      await composer.fill(prompt);
      await page.keyboard.press('Enter');

      // The chat URL flips once the conversation row is created.
      await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}/, { timeout: 15_000 });
      conversationUrls.push(page.url());

      // Immediately fire off to a new chat — the "abandon mid-flight" interaction.
      await page.getByRole('button', { name: /new chat/i }).click();
      await expect(page).toHaveURL(/\/chat$/, { timeout: 5_000 });
    }

    expect(conversationUrls).toHaveLength(3);

    // Wait for all 3 background runs to finish.
    await page.waitForTimeout(75_000);

    // Visit each conversation and confirm both messages persisted.
    for (let i = 0; i < conversationUrls.length; i++) {
      await page.goto(conversationUrls[i], { waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-role="user"]').last()).toContainText(
        RAPID_PROMPTS[i].slice(0, 30),
        { timeout: 10_000 },
      );
      await expect(async () => {
        const replyText =
          (await page.locator('[data-role="assistant"]').last().textContent()) ?? '';
        expect(replyText.length).toBeGreaterThan(3);
      }).toPass({ timeout: 30_000, intervals: [1000, 2000, 3000] });
    }
  });
});
