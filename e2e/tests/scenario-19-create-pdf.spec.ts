/**
 * Scenario 19 — create_pdf document tool + attachment viewer.
 *
 * The default chat agent has the auto-bound `create_pdf_short` tool; asking for
 * a PDF makes the LLM call it, the BE renders the PDF and attaches it to the
 * assistant message, and the FE renders a DocumentCard after the post-run
 * `/messages` refetch. Clicking the card opens the attachment viewer (an
 * authed-blob `<iframe>`) with a Download affordance.
 *
 * Real-LLM-required: this spec exercises a live Anthropic call. The seeded test
 * model carries a dummy key (runtime LLM calls 401), so without
 * `E2E_ANTHROPIC_API_KEY` the spec self-skips with a clear message — that is
 * expected and correct. The deterministic, no-LLM cross-check lives in
 * scenario-20 (seeded render path).
 *
 * Desktop adaptations vs the web app: auth comes from the seed-token `page`
 * fixture (no login form); the composer is a textarea matched by its placeholder
 * (no `aria-label="Chat input"`); message turns carry `data-role`; and "open"
 * routes through the full-screen `AttachmentViewer` (`role="dialog"`,
 * `aria-label={filename}`) rather than a `pdf-canvas` split pane.
 */
import { test, expect } from '../fixtures';
import { assistantAttachments, type ApiMessage } from '../helpers/network';
import { disableAllFlows } from '../helpers/db';

const HAS_REAL_KEY = Boolean(process.env.E2E_LLM_API_KEY ?? process.env.E2E_ANTHROPIC_API_KEY ?? process.env.E2E_OPENAI_API_KEY ?? process.env.E2E_GOOGLE_API_KEY);

test.describe('Scenario 19 — create_pdf document tool', () => {
  test.skip(
    !HAS_REAL_KEY,
    'requires a real LLM key (E2E_LLM_API_KEY or E2E_<PROVIDER>_API_KEY) (the seeded test model carries a dummy key → live LLM 401)',
  );

  test.beforeEach(async ({ page }) => {
    // Isolation: un-expose leftover slash flows so the agent calls create_pdf
    // instead of proposing a flow (see helpers/db.ts disableAllFlows).
    disableAllFlows();
    await page.goto('/chat', { waitUntil: 'networkidle' });
  });

  // FIXME: depends on the live model *choosing* to call create_pdf_short for the
  // prompt — that tool-choice is non-deterministic (the tool IS bound to the
  // default agent via the BE's resolve_auto_bind_tools, and the render+card+viewer
  // path is covered DETERMINISTICALLY by scenario-20 which seeds the PDF turn).
  // Marked fixme so the suite isn't flaky on the model's choice; un-fixme if the
  // agent is made to reliably emit create_pdf for this prompt.
  test('ask for a PDF → document card → viewer + download', async ({ page }) => {
    test.setTimeout(180_000);

    // Collect every /messages payload the FE receives so we can cross-check
    // "what BE sent" against "what FE rendered" in the live path.
    const messagesPayloads: ApiMessage[][] = [];
    page.on('response', async (r) => {
      if (
        /\/api\/conversations\/[^/]+\/messages(\?|$)/.test(r.url()) &&
        r.request().method() === 'GET' &&
        r.status() === 200
      ) {
        try {
          messagesPayloads.push((await r.json()) as ApiMessage[]);
        } catch {
          /* body not JSON / already consumed — ignore */
        }
      }
    });

    const composer = page.getByPlaceholder(/ask .*anything|message the assistant/i);
    await composer.click();
    await composer.fill(
      'Create a PDF document titled "Quick Note" that summarizes these three ' +
        'points as a bulleted list: clean architecture, registries, and the ' +
        'tools table. Use the create_pdf tool.',
    );
    await page.keyboard.press('Enter');

    // User bubble commits immediately.
    await expect(page.locator('[data-role="user"]').last()).toContainText(/PDF/i, {
      timeout: 5_000,
    });

    // Run streams then settles: Stop appears, then reverts to Send.
    const stop = page.getByRole('button', { name: /stop generating/i });
    await expect(stop).toBeVisible({ timeout: 30_000 });
    await expect(stop).toBeHidden({ timeout: 90_000 });

    // The document card appears on the assistant turn once the post-run
    // /messages refetch lands the linked PDF attachment. Generous timeout: the
    // live LLM tool call + BE PDF render can take a while under load.
    const card = page.getByTestId('document-card').first();
    await expect(card).toBeVisible({ timeout: 60_000 });
    await expect(card).toContainText(/Document · PDF/i);

    // Clicking opens the attachment viewer with the inline PDF + Download.
    await card.click();
    const viewer = page.getByRole('dialog');
    await expect(viewer).toBeVisible({ timeout: 10_000 });
    // The PDF renders to a pdf.js <canvas> (CF-036: a blob `<iframe>` is blank in
    // the macOS WKWebView, so AttachmentViewer switched to PdfCanvasViewer).
    await expect(viewer.locator('canvas').first()).toBeVisible({ timeout: 15_000 });
    await expect(
      viewer.getByRole('button', { name: /download/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // ── what BE sent ── the latest /messages payload the FE received must
    // carry the generated PDF on the assistant turn (the live regression for
    // the card-after-reload reconciliation bug).
    const latest = messagesPayloads.at(-1);
    expect(latest, 'FE should have fetched /messages post-run').toBeTruthy();
    const atts = assistantAttachments(latest!);
    expect(atts.length).toBeGreaterThanOrEqual(1);
    expect(atts[0].content_type).toBe('application/pdf');
  });
});
