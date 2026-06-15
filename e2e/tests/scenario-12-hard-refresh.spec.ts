/**
 * Scenario 12 — Hard refresh during streaming.
 *
 * Same architecture as Scenario 11 but with a more aggressive interruption — a
 * browser reload that discards the FE state entirely. The BE can't tell whether
 * the client crashed or closed the tab; in either case the background run should
 * continue and persist on completion.
 *
 * Real-LLM-required + LIVE-STREAMING: only verifiable against a live streaming
 * run (a seeded conversation has no in-flight run to reload mid-stream), so it is
 * skip-guarded on `E2E_ANTHROPIC_API_KEY`. The seeded test model carries a dummy
 * key, so without a real key the spec self-skips.
 *
 * Desktop adaptations vs the web app: auth via the seed-token `page` fixture (no
 * login); composer matched by placeholder; turns carry `data-role`.
 */
import { test, expect } from '../fixtures';

const HAS_REAL_KEY = Boolean(process.env.E2E_LLM_API_KEY ?? process.env.E2E_ANTHROPIC_API_KEY ?? process.env.E2E_OPENAI_API_KEY ?? process.env.E2E_GOOGLE_API_KEY);
const PROMPT = `Explain the concept of quantum entanglement in 3 paragraphs covering its discovery, its experimental verification (e.g. Bell tests), and its modern applications in quantum computing.`;

test.describe('Scenario 12 — Hard refresh during streaming', () => {
  test.describe.configure({ timeout: 180_000 });

  test.skip(
    !HAS_REAL_KEY,
    'requires a real LLM key (E2E_LLM_API_KEY or E2E_<PROVIDER>_API_KEY) — live streaming run needed (no in-flight run on a seeded conversation)',
  );

  test('submit → reload mid-stream → return to chat → persisted reply is there', async ({
    page,
  }) => {
    await page.goto('/chat', { waitUntil: 'networkidle' });

    const composer = page.getByPlaceholder(/ask .*anything|message the assistant|reply/i);
    await composer.click();
    await composer.fill(PROMPT);
    await page.keyboard.press('Enter');

    // Streaming started.
    await expect(
      page.getByRole('button', { name: /stop generating/i }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}/, { timeout: 10_000 });
    const originalUrl = page.url();

    // Hard reload — fully discards FE state. The BE run keeps going.
    // 'domcontentloaded' (not 'networkidle') is the right signal: the SSE stream
    // keeps the network busy, so 'networkidle' would never fire.
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Wait until the run completes on the BE.
    await page.waitForTimeout(45_000);

    // Navigate to the original chat (or force a cache-invalidating round-trip).
    if (page.url() !== originalUrl) {
      await page.goto(originalUrl, { waitUntil: 'networkidle' });
    } else {
      await page.goto('/chat', { waitUntil: 'networkidle' });
      await page.goto(originalUrl, { waitUntil: 'networkidle' });
    }

    await expect(
      page.locator('[data-role="assistant"]').last(),
    ).toBeVisible({ timeout: 10_000 });
    const replyText =
      (await page.locator('[data-role="assistant"]').last().textContent()) ?? '';
    expect(replyText).toMatch(/entangle|Bell|quantum/i);
    expect(replyText.length).toBeGreaterThan(400);
  });
});
