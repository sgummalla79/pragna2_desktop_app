/**
 * Scenario 20 — create_pdf BE↔FE cross-check (deterministic, no LLM).
 *
 * Seeds a conversation whose assistant turn carries a generated PDF via the
 * REAL backend render+persist path (helpers/seed.ts → seed_pdf_conversation.py),
 * then asserts BOTH sides of the contract:
 *   - what the BE SENT — the intercepted GET /messages + /attachments responses
 *   - what the FE RENDERED — the DocumentCard, the suppressed raw tool badge,
 *     the attachment viewer (authed-blob pdf.js canvas — CF-036),
 *     Download, and reload persistence.
 *
 * No API key needed, so this runs in CI on every change — it catches exactly the
 * class of bug we hit building create_pdf: "BE sent the attachment but the FE
 * didn't render the card."
 *
 * Desktop adaptations vs the web app:
 *   - auth: the seed-token `page` fixture (no login form), so no `login(page)`.
 *   - the desktop opens documents in the full-screen `AttachmentViewer`
 *     (`role="dialog"`, `aria-label={filename}`) rather than a split-view
 *     pane — a pdf.js `<canvas>` reader (CF-036) fed by the same authed-blob
 *     fetch + Download, so the "open / read / download" assertions port
 *     directly; the web app's
 *     side-by-side geometry test is replaced by "viewer opens over the messages,
 *     close restores them" (the desktop's equivalent affordance).
 */
import { test, expect } from '../fixtures';
import {
  assistantAttachments,
  waitForAttachmentContent,
  waitForMessages,
} from '../helpers/network';
import { seedPdfConversation, type SeededPdf } from '../helpers/seed';

let seeded: SeededPdf;

test.beforeAll(() => {
  seeded = seedPdfConversation();
});

test.describe('Scenario 20 — create_pdf BE↔FE cross-check', () => {
  test('BE /messages serves the PDF on the assistant turn (what BE sent)', async ({
    page,
  }) => {
    const messagesPromise = waitForMessages(page, seeded.conversation_id);
    await page.goto(`/chat/${seeded.conversation_id}`, { waitUntil: 'networkidle' });

    const atts = assistantAttachments(await messagesPromise);
    expect(atts).toHaveLength(1);
    expect(atts[0].filename).toBe(seeded.filename);
    expect(atts[0].content_type).toBe('application/pdf');
    expect(atts[0].size_bytes).toBeGreaterThan(800);
  });

  test('FE renders a document card and suppresses the raw tool badge (what FE rendered)', async ({
    page,
  }) => {
    await page.goto(`/chat/${seeded.conversation_id}`, { waitUntil: 'networkidle' });

    const card = page.getByTestId('document-card');
    await expect(card).toBeVisible();
    // The card shows the name WITHOUT the .pdf extension.
    await expect(card).toContainText(seeded.filename.replace(/\.pdf$/i, ''));
    await expect(card).toContainText(/Document · PDF/i);

    // The raw create_pdf tool badge (name / JSON args / "PDF … created" ack)
    // must never surface — the card is the representation.
    await expect(page.getByText('create_pdf', { exact: false })).toHaveCount(0);
  });

  test('clicking the card opens the viewer: authed-blob pdf.js canvas, Download (FE + BE serve)', async ({
    page,
  }) => {
    await page.goto(`/chat/${seeded.conversation_id}`, { waitUntil: 'networkidle' });

    const card = page.getByTestId('document-card');
    await expect(card).toBeVisible();

    // The viewer fetches the bytes through the authed client — capture that
    // response to assert the BE served the PDF correctly.
    const contentPromise = waitForAttachmentContent(page, seeded.attachment_id);
    await card.click();

    // The desktop opens a full-screen viewer (role=dialog, aria-label=filename).
    const viewer = page.getByRole('dialog', { name: seeded.filename });
    await expect(viewer).toBeVisible();

    const contentResp = await contentPromise;
    expect(contentResp.status()).toBe(200);
    expect(contentResp.headers()['content-type']).toContain('application/pdf');

    // Inline reader: the PDF renders to a pdf.js <canvas> (CF-036: a blob
    // `<iframe>` is blank in the macOS WKWebView, so AttachmentViewer switched to
    // PdfCanvasViewer). The blob is still fetched through the authed client
    // (asserted above via waitForAttachmentContent).
    await expect(viewer.locator('canvas').first()).toBeVisible();

    // Download affordance present (saves the authed-blob; a button, not a link).
    await expect(
      viewer.getByRole('button', { name: /download/i }).first(),
    ).toBeVisible();
  });

  test('opening the viewer overlays the chat; closing restores the messages', async ({
    page,
  }) => {
    await page.goto(`/chat/${seeded.conversation_id}`, { waitUntil: 'networkidle' });

    const card = page.getByTestId('document-card');
    await expect(card).toBeVisible();

    await card.click();
    const viewer = page.getByRole('dialog', { name: seeded.filename });
    await expect(viewer).toBeVisible();

    // Closing removes the viewer; the card (and messages) remain.
    await viewer.getByRole('button', { name: /^close$/i }).click();
    await expect(viewer).toBeHidden();
    await expect(card).toBeVisible();
  });

  test('the card persists across a reload (post-turn artifact, not streaming-only)', async ({
    page,
  }) => {
    await page.goto(`/chat/${seeded.conversation_id}`, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('document-card')).toBeVisible();

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByTestId('document-card')).toBeVisible();
  });
});
