/**
 * Citations report — external-open of References links (pragna2_desktop_app#99 / CF-051).
 *
 * Seeds a deterministic citations-report conversation via the REAL backend
 * persist path (scripts/seed_citations_conversation.py → PersistTurn, NO LLM):
 * synthesis prose with inline [1]/[2] markers + a "## References" section of
 * [title](url) links. Then asserts, through the real app shell + Streamdown
 * renderer:
 *   - clicking a References link is routed to the system browser (openExternal →
 *     window.open in browser-fallback) and does NOT navigate the app webview;
 *   - the inline [1] marker renders as LITERAL text, not a link.
 *
 * Keyless / provider-agnostic — the assistant turn is seeded, not generated.
 *
 * Browser-fallback note: isTauriRuntime() is false here, so openExternal takes
 * the window.open path (not plugin-opener.openUrl). We intercept window.open to
 * capture the hand-off. The native openUrl path is unit-tested + plugin
 * registration/permission is verified in the FE repo (opener.test.ts, lib.rs,
 * capabilities/default.json); the e2e can't run a real Tauri window (TD-028).
 */
import { test, expect } from '../fixtures';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const NASA_URL = 'https://www.nasa.gov/mission/apollo-11/';
const WIKI_URL = 'https://en.wikipedia.org/wiki/Apollo_program';

/** Seed one citations conversation inside the BE container; return its id. */
function seedCitationsConversation(): string {
  const script = path.join(HERE, '..', 'scripts', 'seed_citations_conversation.py');
  const container = process.env.E2E_BE_CONTAINER ?? 'nexus-kit-api';
  const email = process.env.E2E_TEST_EMAIL ?? 'test_user@example.com';
  // Copy the seeder in, then run it with the container's own settings (dummy
  // secrets the seeder loads-but-never-uses, mirroring helpers/seed.ts).
  execFileSync('docker', ['cp', script, `${container}:/app/seed_citations_conversation.py`]);
  const out = execFileSync(
    'docker',
    [
      'exec', '-i', '-w', '/app',
      '-e', `ENCRYPTION_KEY=${'0'.repeat(64)}`,
      '-e', 'JWT_SECRET=e2e-dummy-jwt-secret-value-32chars-min',
      container, 'uv', 'run', 'python', 'seed_citations_conversation.py', email,
    ],
    { encoding: 'utf8' },
  );
  const line = out.trim().split('\n').filter(Boolean).pop() ?? '';
  return JSON.parse(line).conversation_id as string;
}

let conversationId: string;

test.beforeAll(() => {
  conversationId = seedCitationsConversation();
});

test.describe('Citations — external-open References links', () => {
  // Capture window.open calls (the browser-fallback transport of openExternal),
  // installed before any page script runs.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __openedUrls: string[] }).__openedUrls = [];
      const original = window.open.bind(window);
      window.open = ((url?: string | URL, ...rest: unknown[]) => {
        (window as unknown as { __openedUrls: string[] }).__openedUrls.push(String(url));
        // Return null (don't actually open a tab in CI), like a blocked popup.
        void original;
        void rest;
        return null;
      }) as typeof window.open;
    });
  });

  test('a References link opens in the system browser and does NOT navigate the app', async ({
    page,
  }) => {
    await page.goto(`/chat/${conversationId}`, { waitUntil: 'networkidle' });

    const link = page.locator(`a[href="${NASA_URL}"]`);
    await expect(link).toBeVisible({ timeout: 15_000 });

    await link.click();

    // openExternal routed the click to window.open with the exact href...
    const opened = await page.evaluate(
      () => (window as unknown as { __openedUrls: string[] }).__openedUrls,
    );
    expect(opened).toContain(NASA_URL);

    // ...and the app stayed on the conversation route (webview NOT navigated).
    await expect(page).toHaveURL(new RegExp(`/chat/${conversationId}`));
    expect(page.url()).not.toContain('nasa.gov');
  });

  test('inline [n] markers are in-page citation backlinks (Tier 3), not external links', async ({
    page,
  }) => {
    await page.goto(`/chat/${conversationId}`, { waitUntil: 'networkidle' });

    // The inline marker is now an in-page backlink to its References item —
    // rendered with its literal `[1]` text, targeting `#cite-ref-1`.
    const back = page.locator('a[href="#cite-ref-1"]');
    await expect(back).toBeVisible({ timeout: 15_000 });
    await expect(back).toHaveText('[1]');
    // The matching References item carries the anchor id, and its source is
    // still an external link (Tier 1 behaviour preserved alongside the backlink).
    await expect(page.locator('li#cite-ref-1')).toHaveCount(1);
    await expect(page.locator(`li#cite-ref-2 a[href="${WIKI_URL}"]`)).toHaveCount(1);

    // Clicking it scrolls in-page: it must NOT be handed to the system browser,
    // and the app stays on the conversation route.
    await back.click();
    const opened = await page.evaluate(
      () => (window as unknown as { __openedUrls: string[] }).__openedUrls,
    );
    expect(opened).not.toContain('#cite-ref-1');
    await expect(page).toHaveURL(new RegExp(`/chat/${conversationId}`));
  });
});
