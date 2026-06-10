/**
 * Scenario 13 — Multi-tab consistency.
 *
 * Two tabs on the same chat should both eventually reflect the same DB state.
 * There's no real-time push between tabs today (ChatGPT and Claude.ai also
 * don't) — Tab B catches up only on navigation or manual refresh.
 *
 * Tab A submits a prompt, Tab B opens the same conversation URL while Tab A is
 * still streaming, Tab A's stream completes, Tab B refreshes, then both tabs see
 * the same assistant reply.
 *
 * Real-LLM-required + LIVE-STREAMING: needs a live streaming run in Tab A, so it
 * is skip-guarded on `E2E_ANTHROPIC_API_KEY`. The seeded test model carries a
 * dummy key, so without a real key the spec self-skips.
 *
 * Desktop adaptations vs the web app: this test uses `browser`, not the
 * seed-token `page` fixture, so it injects the seed tokens into BOTH tabs via
 * `addInitScript` (same mechanism the fixture uses — see fixtures.ts) before any
 * page script runs; there's no login form to drive. Composer matched by
 * placeholder; turns carry `data-role`; run-complete is the Stop button
 * reverting to Send; the auto-title is read from the session header `<h1>`.
 */
import { type Page } from '@playwright/test';

import { test, expect } from '../fixtures';
import { TOKEN_KEYS } from '../helpers/env';
import { readTokens } from '../helpers/tokens';

const HAS_REAL_KEY = Boolean(process.env.E2E_ANTHROPIC_API_KEY);
const PROMPT = `Explain the photoelectric effect in 3 paragraphs covering Einstein's 1905 paper, the role of photons, and one modern application.`;

/** Inject the seed token pair into a freshly-created tab so `bootstrap()`
 *  restores the session with no login UI — the same mechanism fixtures.ts uses
 *  for the default `page`, applied here to a `context.newPage()` tab. */
async function authenticate(tab: Page): Promise<void> {
  const { accessToken, idToken } = readTokens();
  await tab.addInitScript(
    ([atKey, idtKey, at, idt]) => {
      sessionStorage.setItem(atKey, at);
      sessionStorage.setItem(idtKey, idt);
    },
    [TOKEN_KEYS.accessToken, TOKEN_KEYS.idToken, accessToken, idToken] as const,
  );
}

test.describe('Scenario 13 — Multi-tab consistency', () => {
  test.describe.configure({ timeout: 180_000 });

  test.skip(
    !HAS_REAL_KEY,
    'requires E2E_ANTHROPIC_API_KEY — live streaming run needed in Tab A',
  );

  test('Tab A submits + completes, Tab B refreshes and sees the same reply', async ({
    browser,
  }) => {
    // Two pages sharing one context — matches a real "open in new tab".
    const context = await browser.newContext();
    const tabA = await context.newPage();
    const tabB = await context.newPage();
    await authenticate(tabA);
    await authenticate(tabB);
    try {
      await tabA.goto('/chat', { waitUntil: 'networkidle' });

      // Tab A submits the long prompt.
      const composerA = tabA.getByPlaceholder(/ask anything|message the assistant|reply/i);
      await composerA.click();
      await composerA.fill(PROMPT);
      await tabA.keyboard.press('Enter');

      // The URL flips to /chat/{conversationId} as soon as the row is created.
      await expect(tabA).toHaveURL(/\/chat\/[0-9a-f-]{36}/, { timeout: 15_000 });
      const conversationUrl = tabA.url();

      // Tab B opens the SAME conversation while Tab A is still streaming.
      await tabB.goto(conversationUrl, { waitUntil: 'domcontentloaded' });
      await expect(tabB.locator('[data-role="user"]').last()).toContainText(
        /photoelectric|Einstein/i,
        { timeout: 10_000 },
      );

      // Tab A's stream finishes — Stop reverts to Send (run-complete signal).
      await expect(
        tabA.getByRole('button', { name: /stop generating/i }),
      ).toHaveCount(0, { timeout: 120_000 });

      const replyA =
        (await tabA.locator('[data-role="assistant"]').last().textContent()) ?? '';
      expect(replyA).toMatch(/photoelectric|photon|Einstein/i);
      expect(replyA.length).toBeGreaterThan(400);

      // Tab B manually refreshes to pick up the new messages.
      await tabB.reload({ waitUntil: 'domcontentloaded' });

      const replyB =
        (await tabB.locator('[data-role="assistant"]').last().textContent()) ?? '';
      expect(replyB.length).toBeGreaterThan(400);
      expect(replyB).toMatch(/photoelectric|photon|Einstein/i);

      // Both tabs persist the SAME reply body. The only tolerated difference is
      // a trailing ModelBadge ("by <model>") that renders on a warm model cache
      // but is omitted on a cache miss — always a strict suffix.
      const a = replyA.trim();
      const b = replyB.trim();
      const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
      expect(longer.startsWith(shorter)).toBe(true);
      const remainder = longer.slice(shorter.length).trim();
      expect(remainder === '' || /^by\s+.+/.test(remainder)).toBe(true);

      // Both tabs resolved the same non-placeholder auto-title (session <h1>).
      const titleA = (await tabA.locator('header h1').first().textContent()) ?? '';
      const titleB = (await tabB.locator('header h1').first().textContent()) ?? '';
      expect(titleA.trim()).toBe(titleB.trim());
      expect(titleA.trim().toLowerCase()).not.toBe('new chat');
    } finally {
      await context.close();
    }
  });
});
