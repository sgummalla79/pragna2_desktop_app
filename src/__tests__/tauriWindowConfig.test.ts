import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * Guard against the Tauri platform-config "array-replace" footgun.
 *
 * Tauri 2 merges `tauri.<platform>.conf.json` into `tauri.conf.json` using JSON
 * Merge Patch (RFC 7386): objects deep-merge, but ARRAYS ARE REPLACED WHOLESALE.
 * `app.windows` is an array, so each platform file's `windows[0]` REPLACES the
 * base window entirely on that platform — any key not physically present in the
 * platform file silently reverts to a Tauri default.
 *
 * That is what broke macOS once before (commit 5fbbebe moved
 * `titleBarStyle`/`hiddenTitle` out of the macOS file into the shared base; on
 * macOS the array-replace dropped them and the native title bar reappeared with
 * the default "Tauri App" title). See docs/CODE_FIXES.md.
 *
 * Fix + invariant enforced here: every platform's `windows[0]` is SELF-CONTAINED.
 * These tests fail loudly the moment the shared window keys drift between files,
 * or the platform-critical chrome keys go missing — so the regression can never
 * silently return.
 */

/** Resolve a config file under `src-tauri/`, anchored at the repo root (the cwd
 *  Vitest runs from). */
function configPath(file: string): string {
  return resolve(process.cwd(), 'src-tauri', file);
}

/** Read a Tauri config JSON file and return its first window definition. */
function readWindow(file: string): Record<string, unknown> {
  const json = JSON.parse(readFileSync(configPath(file), 'utf-8'));
  const windows = json?.app?.windows;
  expect(Array.isArray(windows), `${file}: app.windows must be an array`).toBe(true);
  expect(windows.length, `${file}: app.windows must define one window`).toBeGreaterThan(0);
  return windows[0] as Record<string, unknown>;
}

/** Window keys that MUST be identical across base + every platform file, because
 *  the array-replace means a value present only in the base never reaches a
 *  platform that overrides `windows`. Keep this list in sync with the configs. */
const SHARED_WINDOW_KEYS = ['title', 'width', 'height', 'minWidth', 'minHeight'] as const;

describe('Tauri window config — platform self-containment', () => {
  const base = readWindow('tauri.conf.json');
  const macos = readWindow('tauri.macos.conf.json');
  const windows = readWindow('tauri.windows.conf.json');

  it.each(SHARED_WINDOW_KEYS)(
    'macOS window repeats the base "%s" (array-replace drops base-only keys)',
    (key) => {
      expect(base[key], `base is missing "${key}"`).toBeDefined();
      expect(macos[key]).toEqual(base[key]);
    },
  );

  it.each(SHARED_WINDOW_KEYS)(
    'Windows window repeats the base "%s" (array-replace drops base-only keys)',
    (key) => {
      expect(base[key], `base is missing "${key}"`).toBeDefined();
      expect(windows[key]).toEqual(base[key]);
    },
  );

  it('macOS keeps the overlay title bar (the exact key the regression dropped)', () => {
    expect(macos.titleBarStyle).toBe('Overlay');
    expect(macos.hiddenTitle).toBe(true);
  });

  it('Windows keeps native decorations off for its custom title bar', () => {
    expect(windows.decorations).toBe(false);
  });
});
