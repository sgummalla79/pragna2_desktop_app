/**
 * Scenario 21 — create_pdf_long ASYNC document episode + regression guards.
 *
 * The default chat agent has the auto-bound `create_pdf_long` tool. A request
 * for a large, multi-section document makes the LLM route to it — but the tool
 * does NOT generate inline: it CAPTURES the request and acks instantly, the chat
 * turn closes, and a SEPARATE background document episode then plans sections,
 * writes them, renders ONE PDF, and POSTS IT BACK as a later assistant message +
 * DocumentCard.
 *
 * This scenario pins:
 *   1. The document EVENTUALLY appears as a posted-back assistant card.
 *   2. The orchestrator's raw plan JSON does NOT leak into the chat.
 *   3. The create_pdf tool-call badge does NOT show (document tools render as a
 *      DocumentCard — see constants/documentTools + ChatMessage suppression).
 *
 * Real-LLM-required: exercises live Anthropic calls. The seeded test model
 * carries a dummy key (runtime LLM calls 401), so without
 * `E2E_ANTHROPIC_API_KEY` the spec self-skips with a clear message.
 *
 * Desktop adaptations vs the web app: seed-token `page` fixture (no login);
 * composer matched by placeholder; turns carry `data-role`; tool badges carry
 * `data-testid="tool-call-badge"`; "open" routes through the full-screen
 * `AttachmentViewer` (`role="dialog"`) rather than a `pdf-canvas` pane.
 */
import { type Page } from '@playwright/test';

import { test, expect } from '../fixtures';
import { type ApiMessage } from '../helpers/network';

const HAS_REAL_KEY = Boolean(process.env.E2E_ANTHROPIC_API_KEY);

// A long document on a low OTPM tier is minutes of paced worker calls. We assert
// completion + attachment, never a tight wall-clock deadline.
const DOC_CARD_TIMEOUT_MS = 360_000;

/** Captures every GET /messages payload so we can cross-check BE truth. */
function captureMessages(page: Page): ApiMessage[][] {
  const payloads: ApiMessage[][] = [];
  page.on('response', async (r) => {
    if (
      /\/api\/conversations\/[^/]+\/messages(\?|$)/.test(r.url()) &&
      r.request().method() === 'GET' &&
      r.status() === 200
    ) {
      try {
        payloads.push((await r.json()) as ApiMessage[]);
      } catch {
        /* body not JSON / already consumed — ignore */
      }
    }
  });
  return payloads;
}

/**
 * Drive one document-generation prompt end-to-end through the ASYNC model:
 * instant ack → background document episode → posted-back PDF card. Assert the
 * document arrives, and neither the raw plan JSON nor the tool-call badge leaked
 * into the transcript.
 */
async function runDocPrompt(page: Page, prompt: string): Promise<void> {
  const messagesPayloads = captureMessages(page);

  const composer = page.getByPlaceholder(/ask anything|message the assistant/i);
  await composer.click();
  await composer.fill(prompt);
  await page.keyboard.press('Enter');

  // User bubble commits immediately.
  await expect(page.locator('[data-role="user"]').last()).toBeVisible({
    timeout: 5_000,
  });

  // The chat turn (the ack) produces an assistant reply quickly — the tool just
  // captured the request, it did not generate the doc.
  await expect(page.locator('[data-role="assistant"]').first()).toBeVisible({
    timeout: 60_000,
  });

  // (1) The document EVENTUALLY appears as a posted-back card once the
  // background episode completes + the /messages refetch lands the linked PDF.
  const card = page.getByTestId('document-card').first();
  await expect(card).toBeVisible({ timeout: DOC_CARD_TIMEOUT_MS });
  await expect(card).toContainText(/PDF/i);

  // (2) The orchestrator's structured plan must NOT have streamed into the chat.
  await expect(page.getByText(/"section_plan"/)).toHaveCount(0);
  await expect(page.getByText(/"doc_template"/)).toHaveCount(0);

  // (3) Document tools render as a card, not a raw tool-call badge.
  await expect(page.getByTestId('tool-call-badge')).toHaveCount(0);

  // ── BE truth + async-path discriminator ──
  // The async create_pdf_long model posts the document as a SEPARATE assistant
  // turn AFTER the instant ack — so the final /messages payload has >= 2
  // assistant turns, the PDF is NOT on the first (ack) turn, and it IS on a
  // later posted-back turn.
  const latest = messagesPayloads.at(-1);
  expect(latest, 'FE should have fetched /messages post-run').toBeTruthy();
  const assistantMsgs = latest!.filter((m) => m.role === 'assistant');
  expect(
    assistantMsgs.length,
    'the document must post back as a separate assistant turn after the ack',
  ).toBeGreaterThanOrEqual(2);
  const ackHasPdf = (assistantMsgs[0].attachments ?? []).some(
    (a) => a.content_type === 'application/pdf',
  );
  expect(
    ackHasPdf,
    'the PDF must be on the posted-back turn, not the ack turn (that would be the inline short tool)',
  ).toBe(false);
  const pdfAtts = assistantMsgs
    .flatMap((m) => m.attachments ?? [])
    .filter((a) => a.content_type === 'application/pdf');
  expect(pdfAtts.length).toBeGreaterThanOrEqual(1);

  // Open the viewer to confirm the PDF is viewable.
  await card.click();
  const viewer = page.getByRole('dialog');
  await expect(viewer).toBeVisible({ timeout: 10_000 });
  await expect(viewer.locator('iframe')).toHaveAttribute('src', /^blob:/, {
    timeout: 15_000,
  });
}

test.describe('Scenario 21 — create_pdf_long fan-out + leak guards', () => {
  test.skip(
    !HAS_REAL_KEY,
    'requires E2E_ANTHROPIC_API_KEY (the seeded test model carries a dummy key → live LLM 401)',
  );

  test.beforeEach(async ({ page }) => {
    await page.goto('/chat', { waitUntil: 'networkidle' });
  });

  test('large multi-section architecture doc → card, no hang, no JSON leak', async ({
    page,
  }) => {
    test.setTimeout(600_000);
    await runDocPrompt(
      page,
      'Use the create pdf tool with the architecture_guidance template to ' +
        'generate an exhaustive engineering design document titled ' +
        '"Distributed Order Processing Platform". Be extremely thorough and ' +
        'verbose — aim for 15+ pages. Include these as ## sections with ### ' +
        'subsections: Executive Summary, Goals & Non-Goals, System Context, ' +
        'High-Level Architecture, Component Breakdown (one subsection per ' +
        'service: API Gateway, Order, Inventory, Payments, Notification, ' +
        'Ledger — each with responsibilities, a data-model table, and a ' +
        'Python class snippet), Request Lifecycle, Data Model (SQL CREATE ' +
        'TABLE blocks + a column table), API Contracts (endpoints table + ' +
        'JSON request/response), Event-Driven Flows (Kafka topics table), ' +
        'Failure Modes & Retries (NOTE/WARNING callouts), Scaling Strategy ' +
        '(throughput tables), Security (auth flow + YAML config), ' +
        'Observability (metrics table + PromQL), Deployment (Kubernetes ' +
        'YAML), and Rollout Plan & Open Questions. For every section write ' +
        'several paragraphs, at least one code block, and at least one table.',
    );
  });

  test('technical_requirements TRD → card, no hang, no JSON leak', async ({
    page,
  }) => {
    test.setTimeout(600_000);
    await runDocPrompt(
      page,
      'Use the create_pdf_long tool to generate a comprehensive, multi-section ' +
        'technical_requirements document titled "Notification Service — TRD" ' +
        'covering these five sections: Overview, Architecture, Data Model, API ' +
        'Contracts, and Non-Functional Requirements. This is a substantial ' +
        'long-form document — use the long multi-section generator.',
    );
  });
});
