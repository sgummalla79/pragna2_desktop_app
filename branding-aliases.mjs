// Build-time white-label seam, shared by `vite.config.ts`, `vitest.config.ts`,
// and `scripts/apply-branding.mjs` so every build tool reads branding identically.
//
// Brand assets resolve from a git-ignored `branding/` overlay folder when it is
// present, else fall back to the repo's committed defaults in `src/assets/`.
// Dropping `branding/<file>` overrides the asset with ZERO source edits; with no
// overlay the build is byte-for-byte stock Pragna. The in-app marks are SVG so
// they keep `currentColor` theming and the svgr `?react` React-component import.

import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

// Each brandable in-app asset: the `@brand/<specifier>` import, and the
// committed default used when the overlay file is absent.
const BRAND_ASSETS = [
  { specifier: "logo.svg", fallback: "src/assets/logo.svg" },
  // The thinking-indicator (agent) icon defaults to the brand logo so stock
  // (no-overlay) builds are byte-identical to the original Pragna look. Branders
  // opt into a distinct mark (e.g. a brain) via `branding/agent-icon.svg`.
  { specifier: "agent-icon.svg", fallback: "src/assets/logo.svg" },
];

/** Absolute path to the brand overlay file if it exists, else the default. */
const overlayOrDefault = (rootDir, file, fallback) => {
  const overlay = path.resolve(rootDir, "branding", file);
  return existsSync(overlay) ? overlay : path.resolve(rootDir, fallback);
};

/**
 * Vite/Vitest `resolve.alias` entries mapping `@brand/<asset>` to the brand
 * overlay file when present, else the committed default. Regex `find` entries
 * are used so the trailing svgr `?react` query survives the rewrite.
 *
 * @param {string} rootDir absolute repo root (the config file's `__dirname`).
 * @returns {Array<{find: RegExp, replacement: string}>}
 */
export const brandAliases = (rootDir) =>
  BRAND_ASSETS.map(({ specifier, fallback }) => ({
    find: new RegExp(`^@brand/${specifier.replace(/[.]/g, "\\$&")}`),
    replacement: overlayOrDefault(rootDir, specifier, fallback),
  }));

/** Absolute path to the brand config file (may not exist). */
export const brandConfigPath = (rootDir) =>
  path.resolve(rootDir, "branding", "brand.config.json");

/**
 * Parse `branding/brand.config.json` if the overlay exists, else return an empty
 * object so callers can read fields with plain `??`/`||` defaults. Throws on
 * malformed JSON — a broken overlay must fail loudly, never silently ship stock
 * branding when the brander intended an override.
 *
 * @param {string} rootDir absolute repo root.
 * @returns {{ name?: string, identifier?: string, agentIcon?: string, agentAnimation?: string }}
 */
export const readBrandConfig = (rootDir) => {
  const file = brandConfigPath(rootDir);
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf-8"));
  } catch (err) {
    throw new Error(`Invalid branding/brand.config.json: ${err.message}`);
  }
};
