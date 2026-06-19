// Build-time white-label: generate the Tauri-side brand artifacts.
//
// The FRONTEND brand (name, logo, agent icon, theme) is resolved by Vite reading
// the git-ignored `branding/` overlay directly (see branding-aliases.mjs +
// vite.config.ts). This script covers the parts Vite cannot: the native app
// packaging — the bundle `productName`/`identifier` and the OS icon set — which
// Tauri reads from its own config, not the webview bundle.
//
// It is a NO-OP when no `branding/` overlay is present, so the default packaged
// build stays byte-for-byte stock Pragna. When an overlay exists it emits a
// git-ignored `branding/tauri.brand.conf.json` that the tauri wrapper merges via
// `tauri <cmd> --config` (see scripts/tauri-with-brand.mjs).
//
// Only deep-merge-safe fields are overridden (top-level scalars + `bundle.icon`).
// The per-window `title` is deliberately NOT set here: Tauri replaces the whole
// `windows` array on merge (which would wipe the platform titleBarStyle /
// decorations), and both platforms hide the native title bar anyway — the
// visible app label comes from `productName` (dock/taskbar) and the branded
// document `<title>` (set by vite.config's transformIndexHtml).

import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readBrandConfig } from '../branding-aliases.mjs';
import { runPnpm } from './run-pnpm.mjs';
import { makeMacIcns } from './make-mac-icon.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Default icon set from src-tauri/tauri.conf.json, redirected to the generated
// brand icon dir. `tauri icon` emits exactly these filenames.
const ICON_FILES = ['32x32.png', '128x128.png', '128x128@2x.png', 'icon.icns', 'icon.ico'];
const BRAND_ICON_DIR = 'icons-brand'; // under src-tauri/, git-ignored

/** Run the local Tauri CLI via pnpm — cross-platform (see scripts/run-pnpm.mjs). */
function runTauri(args) {
  runPnpm(['exec', 'tauri', ...args], root);
}

/**
 * Generate the Tauri brand config (and icons) from the `branding/` overlay.
 * @returns {string|null} absolute path to the generated config, or null (no-op).
 */
export async function applyBranding() {
  const brand = readBrandConfig(root); // {} when no overlay; throws on bad JSON
  const iconSource = resolve(root, 'branding', 'icon.png');
  const hasIcon = existsSync(iconSource);
  const hasName = typeof brand.name === 'string' && brand.name.trim() !== '';
  const hasIdentifier = typeof brand.identifier === 'string' && brand.identifier.trim() !== '';

  if (!hasName && !hasIdentifier && !hasIcon) {
    console.log('[apply-branding] no branding/ overlay → stock Pragna packaging');
    return null;
  }

  /** @type {Record<string, unknown>} */
  const conf = {};
  if (hasName) conf.productName = brand.name.trim();
  if (hasIdentifier) conf.identifier = brand.identifier.trim();

  if (hasIcon) {
    const outDir = resolve(root, 'src-tauri', BRAND_ICON_DIR);
    mkdirSync(outDir, { recursive: true });
    console.log(`[apply-branding] generating OS icons from branding/icon.png → src-tauri/${BRAND_ICON_DIR}`);
    runTauri(['icon', iconSource, '--output', outDir]);
    // Re-shape ONLY the macOS icon.icns into a native squircle (rounded +
    // padded) from the same square source. Windows (.ico / Square*Logo.png)
    // keeps the full-bleed square `tauri icon` just produced (tracker #151).
    await makeMacIcns(iconSource, `src-tauri/${BRAND_ICON_DIR}`);
    conf.bundle = { icon: ICON_FILES.map((f) => `${BRAND_ICON_DIR}/${f}`) };
  }

  const confPath = resolve(root, 'branding', 'tauri.brand.conf.json');
  writeFileSync(confPath, JSON.stringify(conf, null, 2) + '\n');
  console.log(`[apply-branding] wrote ${confPath.replace(root + '/', '')}`);
  return confPath;
}

// When invoked directly (`node scripts/apply-branding.mjs`), run the generation.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await applyBranding();
}
