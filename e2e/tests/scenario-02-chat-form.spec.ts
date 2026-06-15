/**
 * Scenario 2 — Chat that opens a form (the "ask user" tool).
 *
 * Tests that the default chat agent can call the universal `ask_user` tool to
 * pause the run, render a form pop-up (the HITLFormCard) above the composer, and
 * resume with the submitted values reflected in the next assistant turn.
 *
 * Real-LLM-required (`E2E_ANTHROPIC_API_KEY`). The seeded test model carries a
 * dummy key, so without a real key the spec self-skips. The LLM has discretion
 * about WHETHER to call `ask_user`; the prompt is explicit, and the test retries
 * once with an even more explicit follow-up before failing.
 *
 * Desktop adaptations vs the web app: auth via the seed-token `page` fixture (no
 * login); composer matched by placeholder; turns carry `data-role`. The
 * HITLFormCard header ("The agent needs your input"), the native field inputs,
 * and the `button[type="submit"]` all match the web app 1:1 (verified against
 * HITLFormCard.tsx + FormField.tsx).
 */
import { type Page } from '@playwright/test';

import { test, expect } from '../fixtures';

const HAS_REAL_KEY = Boolean(process.env.E2E_LLM_API_KEY ?? process.env.E2E_ANTHROPIC_API_KEY ?? process.env.E2E_OPENAI_API_KEY ?? process.env.E2E_GOOGLE_API_KEY);

const PROMPT = `I want to book a meeting room. Please use ask_user to collect the room name, the meeting date, and how many people will attend, then confirm the details back to me.`;

/** Submit the composer text. */
async function sendComposer(page: Page, text: string) {
  const composer = page.getByPlaceholder(/ask .*anything|message the assistant|reply/i);
  await composer.click();
  await composer.fill(text);
  await page.keyboard.press('Enter');
}

/** Find every visible text-ish input inside the open HITL form. */
async function formInputs(page: Page) {
  return page
    .locator(
      'form input[type="text"], form input[type="number"], form input[type="date"], form textarea',
    )
    .all();
}

test.describe('Scenario 2 — Chat with ask_user form', () => {
  test.skip(
    !HAS_REAL_KEY,
    'requires a real LLM key (E2E_LLM_API_KEY or E2E_<PROVIDER>_API_KEY) (the seeded test model carries a dummy key → live LLM 401)',
  );

  test.beforeEach(async ({ page }) => {
    await page.goto('/chat', { waitUntil: 'networkidle' });
  });

  test('LLM calls ask_user → form appears → submit → confirmation reply', async ({ page }) => {
    // The full flow is up to four LLM turns each up to 30s, plus a 60s settle.
    test.setTimeout(180_000);

    await sendComposer(page, PROMPT);

    // ── User bubble lands ──
    await expect(page.locator('[data-role="user"]').last()).toContainText(
      /book a meeting room/i,
      { timeout: 5_000 },
    );

    // ── A form pops up. The HITLFormCard renders "The agent needs your input"
    //    as its header — a reliable signal independent of the LLM's field names. ──
    const formHeader = page.getByText(/agent needs your input/i);
    try {
      await expect(formHeader).toBeVisible({ timeout: 30_000 });
    } catch {
      // Retry once with a maximally explicit follow-up if the LLM skipped it.
      await sendComposer(
        page,
        'You MUST call the ask_user tool before answering. Use it now to collect: room_name, meeting_date, attendees.',
      );
      await expect(formHeader).toBeVisible({ timeout: 30_000 });
    }

    // ── At least 2 input fields are present (3 expected). ──
    const inputs = await formInputs(page);
    expect(inputs.length).toBeGreaterThanOrEqual(2);

    // ── Fill every input with a reasonable value for its type. ──
    for (const input of inputs) {
      const type = (await input.getAttribute('type')) ?? 'text';
      if (type === 'number') {
        await input.fill('5');
      } else if (type === 'date') {
        await input.fill('2026-06-15');
      } else {
        await input.fill('Oak Room');
      }
    }

    // ── Submit (label is LLM-chosen; [type="submit"] is invariant). ──
    await page.locator('form button[type="submit"]').click();

    // ── Form disappears (resume kicks in) ──
    await expect(formHeader).toHaveCount(0, { timeout: 15_000 });

    // ── A follow-up assistant bubble streams in confirming the values. ──
    const lastAssistant = page.locator('[data-role="assistant"]').last();
    await expect(lastAssistant).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole('button', { name: /stop generating/i }),
    ).toHaveCount(0, { timeout: 60_000 });
    const replyText = (await lastAssistant.textContent()) ?? '';
    expect(replyText.length).toBeGreaterThan(5);
    // Any one of the values we entered must echo back.
    expect(replyText).toMatch(/Oak Room|2026-06-15|June 15|5\b/i);
  });
});
