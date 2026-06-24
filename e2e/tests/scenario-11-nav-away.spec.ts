/**
 * Scenario 11 — Navigate away mid-response, come back.
 *
 * Exercises the Background-Run Execution architecture: once a chat turn is
 * submitted the BE keeps generating even if the client navigates away. When the
 * user comes back the response is complete (variant B) or re-streams live.
 *
 * This spec exercises variant B — wait long enough that the run completes on the
 * BE while the FE is on a different chat, then come back and verify the persisted
 * message landed.
 *
 * Real-LLM-required + LIVE-STREAMING: this can only be verified against a live
 * streaming run (there is no in-flight run to navigate away from on a seeded
 * conversation), so it is skip-guarded on `E2E_ANTHROPIC_API_KEY`. The seeded
 * test model carries a dummy key, so without a real key the spec self-skips.
 *
 * Desktop adaptations vs the web app: auth via the seed-token `page` fixture (no
 * login); composer matched by placeholder; turns carry `data-role`; the
 * "New chat" sidebar button is matched by its text; and the auto-title is
 * asserted via the session header `<h1>` (the desktop sidebar rows are buttons,
 * not a `navigation` landmark of links).
 */
import { test, expect } from '../fixtures';
import { disableAllFlows } from '../helpers/db';

const HAS_REAL_KEY = Boolean(process.env.E2E_LLM_API_KEY ?? process.env.E2E_ANTHROPIC_API_KEY ?? process.env.E2E_OPENAI_API_KEY ?? process.env.E2E_GOOGLE_API_KEY);
const LONG_PROMPT = `Write a 4-paragraph essay on the history of the printing press, covering its origins, Gutenberg's contribution, the social impact in Europe, and a comparison to digital publishing today.`;

test.describe('Scenario 11 — Navigate away mid-response', () => {
  test.describe.configure({ timeout: 180_000 });

  test.skip(
    !HAS_REAL_KEY,
    'requires a real LLM key (E2E_LLM_API_KEY or E2E_<PROVIDER>_API_KEY) — live streaming run needed (no in-flight run on a seeded conversation)',
  );

  test.beforeEach(() => {
    // Isolation: un-expose leftover slash flows so the agent answers the prompt
    // directly instead of proposing a flow (see helpers/db.ts disableAllFlows).
    disableAllFlows();
  });

  test('submit → navigate to new chat → come back → see persisted reply', async ({
    page,
  }) => {
    await page.goto('/chat', { waitUntil: 'networkidle' });

    const composer = page.getByPlaceholder(/ask .*anything|message the assistant|reply/i);
    await composer.click();
    await composer.fill(LONG_PROMPT);
    await page.keyboard.press('Enter');

    // Streaming started (Stop visible).
    await expect(
      page.getByRole('button', { name: /stop generating/i }),
    ).toBeVisible({ timeout: 30_000 });

    // The chat URL flips to /chat/{conversationId} once the row is created.
    await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}/, { timeout: 10_000 });
    const originalUrl = page.url();

    // Navigate away — click the sidebar's "New chat" button. Use .first(): the
    // sidebar's conversation list shows untitled chats as "New chat" too, so the
    // name is ambiguous once the DB has history; the real button is first in DOM.
    await page.getByRole('button', { name: /new chat/i }).first().click();
    await expect(page).toHaveURL(/\/chat$/, { timeout: 5_000 });
    // Sanity: the new chat landing has no assistant bubble yet.
    expect(await page.locator('[data-role="assistant"]').count()).toBe(0);

    // Let the BE finish the original run in the background.
    await page.waitForTimeout(45_000);

    // Navigate back to the original chat — the response is now persisted.
    await page.goto(originalUrl, { waitUntil: 'networkidle' });

    await expect(
      page.locator('[data-role="assistant"]').last(),
    ).toBeVisible({ timeout: 10_000 });
    const replyText =
      (await page.locator('[data-role="assistant"]').last().textContent()) ?? '';
    expect(replyText).toMatch(/Gutenberg/i);
    expect(replyText.length).toBeGreaterThan(500);

    // The conversation got a real auto-title (NOT "New chat"), shown in the
    // session header <h1> (ChatSessionView).
    const headerTitle = (await page.getByTestId('conversation-title').textContent()) ?? '';
    expect(headerTitle.trim()).not.toMatch(/^new chat$/i);
    expect(headerTitle.trim().length).toBeGreaterThan(3);
  });
});
