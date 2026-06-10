/**
 * Real-browser regression guard for the ```sketchon inline diagram renderer.
 *
 * WHY THIS EXISTS: the FE unit + jsdom component tests pass even when the app
 * white-screens in a real browser — jsdom has `process`, the browser doesn't,
 * and satori (bundled by @sgummalla-works/sketchon) reads `process.env.*`. This
 * spec is the ONLY tier that catches that class of failure: it loads a seeded
 * conversation whose assistant turn contains a ```sketchon block in real
 * Chromium and asserts the diagram renders with NO "process is not defined".
 *
 * Deterministic + offline: seeds the assistant message directly in the throwaway
 * DB (no LLM, so no API key needed), then drives both light/dark modes.
 *
 * Desktop adaptations vs the web app: auth comes from the seed-token `page`
 * fixture (no login form); the desktop's dark-mode signal is the `.dark` class on
 * the root element (`@custom-variant dark` in index.css + `readThemeMode()` in
 * SketchonDiagram.tsx), so we flip that class to drive the theme — the web app
 * flips `<html data-theme>`. The legibility-geometry assertion (a web-app-only
 * helper) is omitted; the diagram-renders + no-page-error + theme-colour guards
 * are the load-bearing ones for the satori/process crash this spec exists for.
 */
import { randomUUID } from 'node:crypto';

import { test, expect } from '../fixtures';
import { psql } from '../helpers/db';
import { TEST_USER } from '../helpers/env';

// A flow (elk) diagram with edge LABELS — the primary diagram (theme assertions
// read the first one).
const FLOW_SPEC = JSON.stringify({
  id: 'e2e-flow',
  kind: 'flow',
  title: 'Pipeline',
  nodes: [
    { id: 'start', label: 'Start', emphasis: 'muted' },
    { id: 'proc', label: 'Process', emphasis: 'primary' },
    { id: 'done', label: 'Done', emphasis: 'success' },
  ],
  edges: [
    { from: 'start', to: 'proc', label: 'begin' },
    { from: 'proc', to: 'done', label: 'ok' },
  ],
});

// A denser sequence — 3 actors + 4 labelled messages + lifelines. Pure SVG (no
// elk web-worker, no Satori font fetch) while still evaluating the satori module
// whose load triggered the original crash.
const SEQUENCE_SPEC = JSON.stringify({
  id: 'e2e-seq',
  kind: 'sequence',
  title: 'Checkout',
  nodes: [
    { id: 'u', label: 'User' },
    { id: 'web', label: 'Web App' },
    { id: 'api', label: 'API' },
  ],
  edges: [
    { from: 'u', to: 'web', label: 'click buy' },
    { from: 'web', to: 'api', label: 'POST /order' },
    { from: 'api', to: 'web', label: '201 created', style: 'dashed', semantic: 'return' },
    { from: 'web', to: 'u', label: 'confirmation', style: 'dashed', semantic: 'return' },
  ],
});

/** Seed a conversation owned by the test user, with an assistant turn that
 *  embeds two ```sketchon blocks. Returns the conversation id to navigate to. */
function seedSketchonConversation(): string {
  const convId = randomUUID();
  const threadId = `sketchon-e2e-${convId}`;
  const assistant = [
    'Here is the pipeline:',
    '',
    '```sketchon',
    FLOW_SPEC,
    '```',
    '',
    'And the login sequence:',
    '',
    '```sketchon',
    SEQUENCE_SPEC,
    '```',
  ].join('\n');
  // SQL literal escaping: double any single quotes (the JSON uses only doubles).
  const esc = (s: string): string => s.replace(/'/g, "''");

  psql(`
    INSERT INTO conversations (id, user_id, thread_id, title, thinking_enabled, pinned, created_at, modified_at)
    VALUES ('${convId}', (SELECT id FROM users WHERE email='${TEST_USER.email}'),
            '${threadId}', 'Sketchon e2e', false, false, now(), now());
    INSERT INTO messages (id, conversation_id, role, content, message_index, created_at, modified_at)
    VALUES (gen_random_uuid(), '${convId}', 'user', 'Show me the login sequence.', 0, now(), now()),
           (gen_random_uuid(), '${convId}', 'assistant', '${esc(assistant)}', 1, now(), now());
  `);

  return convId;
}

test.describe('Sketchon — inline diagram in a real browser', () => {
  test('a ```sketchon assistant message renders an SVG with no page errors', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') pageErrors.push(m.text());
    });

    const convId = seedSketchonConversation();
    await page.goto(`/chat/${convId}`, { waitUntil: 'networkidle' });

    // The diagram renders inline in the assistant bubble. If the satori/process
    // white-screen recurred, the route would crash and this never appears.
    await expect(page.locator('.sketchon-diagram svg').first()).toBeVisible({ timeout: 15_000 });

    // Explicit guard with a readable failure dump: the original crash logged
    // "process is not defined" — that exact class must not return.
    const processErrors = pageErrors.filter((e) => /process is not defined/i.test(e));
    expect(processErrors, `unexpected page errors:\n${pageErrors.join('\n') || '(none)'}`).toHaveLength(0);

    // ── Dark/light theme ──────────────────────────────────────────────────
    // Drive BOTH modes explicitly. The desktop theme system toggles the `.dark`
    // class on the root element; SketchonDiagram observes it and re-renders.
    // Invariants per mode: the background is ALWAYS transparent (inherits the
    // page surface), and connectors flip mono near-black ↔ white.
    const svgHtml = () => page.$eval('.sketchon-diagram svg', (el) => el.outerHTML);
    const setMode = async (mode: 'light' | 'dark') => {
      await page.evaluate((m) => {
        document.documentElement.classList.toggle('dark', m === 'dark');
      }, mode);
    };

    // Light: connectors near-black (#1e293b).
    await setMode('light');
    await expect
      .poll(() => svgHtml().then((h) => h.includes('#1e293b')).catch(() => false), { timeout: 10_000 })
      .toBe(true);
    expect(await svgHtml(), 'background must be transparent').toContain('fill="transparent"');

    // Dark: connectors white (#e2e8f0).
    await setMode('dark');
    await expect
      .poll(() => svgHtml().then((h) => h.includes('#e2e8f0')).catch(() => false), { timeout: 10_000 })
      .toBe(true);
    expect(await svgHtml(), 'background must be transparent').toContain('fill="transparent"');

    // Still no "process is not defined" after the re-themes.
    const processErrorsAfter = pageErrors.filter((e) => /process is not defined/i.test(e));
    expect(processErrorsAfter, `errors after theme toggle:\n${pageErrors.join('\n') || '(none)'}`).toHaveLength(0);
  });
});
