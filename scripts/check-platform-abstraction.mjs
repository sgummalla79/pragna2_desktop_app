#!/usr/bin/env node
/**
 * Platform-abstraction gate (CLAUDE.md § Platform Abstraction).
 *
 * Fails if OS- or runtime-detection primitives appear OUTSIDE the single allowed
 * entry point `src/infrastructure/platform/`. These are the exact patterns that
 * caused CF-011: a raw `navigator.userAgent` Windows-sniff and a bare Tauri
 * internals/window dereference leaking into component code, where they crash a
 * plain browser (incl. the Windows-UA e2e device). All such checks must go
 * through a platform predicate (`isWindowsPlatform`, `isTauriRuntime`,
 * `usesWindowsChrome`) so there is one place to read, change, and test.
 *
 * Cross-platform (pure Node, no shell) so it runs identically on the Windows and
 * macOS CI runners. Zero runtime deps — walks the tree itself.
 *
 * Run: `node scripts/check-platform-abstraction.mjs` (wired as `pnpm lint:platform`).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

/** The ONLY directory permitted to reference OS/runtime detection primitives. */
const PLATFORM_DIR = path.join(SRC, 'infrastructure', 'platform');

/**
 * Forbidden patterns and where they may legitimately live. Each `allow` entry is
 * a path prefix (relative to repo root, POSIX separators) that is exempt.
 */
const RULES = [
  {
    pattern: /navigator\.(userAgent|platform)\b/,
    message: 'raw OS sniff — use a platform predicate (isWindowsPlatform/usesWindowsChrome)',
    allow: ['src/infrastructure/platform/'],
  },
  {
    pattern: /__TAURI_INTERNALS__/,
    message: 'raw Tauri-runtime probe — use isTauriRuntime() from the platform layer',
    allow: ['src/infrastructure/platform/'],
  },
];

/** Recursively collect .ts/.tsx source files, skipping tests and declarations. */
function collectSourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue;
    if (/\.(test|spec)\.(ts|tsx)$/.test(entry) || entry.endsWith('.d.ts')) continue;
    out.push(full);
  }
  return out;
}

/** Repo-root-relative POSIX path for matching `allow` prefixes + readable output. */
function relPosix(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

const violations = [];
for (const file of collectSourceFiles(SRC)) {
  const rel = relPosix(file);
  const lines = readFileSync(file, 'utf8').split('\n');
  for (const rule of RULES) {
    if (rule.allow.some((prefix) => rel.startsWith(prefix))) continue;
    lines.forEach((line, i) => {
      if (rule.pattern.test(line)) {
        violations.push({ rel, line: i + 1, text: line.trim(), message: rule.message });
      }
    });
  }
}

if (violations.length > 0) {
  console.error('\n✖ Platform-abstraction gate FAILED — OS/runtime detection found outside the platform layer:\n');
  for (const v of violations) {
    console.error(`  ${v.rel}:${v.line}  ${v.message}`);
    console.error(`      ${v.text}`);
  }
  console.error(
    `\nMove the check into ${relPosix(PLATFORM_DIR)}/ and import a predicate instead.` +
      ' See docs/CODE_FIXES.md CF-011 and CLAUDE.md § Platform Abstraction.\n',
  );
  process.exit(1);
}

console.log('✔ Platform-abstraction gate passed — no OS/runtime detection outside the platform layer.');
