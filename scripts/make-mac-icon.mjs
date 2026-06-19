// Regenerate the macOS `icon.icns` as a native "squircle" — rounded corners +
// padding baked into the PNG — from a FULL-BLEED SQUARE source icon.
//
// Why: `tauri icon <src>` turns one source into every platform's icons. macOS
// app icons are NOT auto-rounded by the OS; they ship pre-shaped as a rounded
// rectangle with ~10% padding. A full-bleed square source therefore renders as
// a hard square tile in the Dock/Finder — not the native look (tracker #151).
//
// Windows is deliberately UNTOUCHED: macOS reads `icon.icns`, Windows reads
// `icon.ico` + `Square*Logo.png` (full-bleed square — correct for Windows tiles
// and taskbar). This script ONLY overwrites `icon.icns`, so the Windows output
// generated from the square source by `tauri icon` is byte-for-byte unchanged.
//
// Cross-platform: `sharp` ships prebuilt binaries for win/mac/linux, and the
// macOS `.icns` is only consumed by macOS builds — regenerating it on a Windows
// build machine is harmless (Windows ignores it).

import { mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { runPnpm } from './run-pnpm.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Apple macOS (Big Sur+) app-icon grid, expressed against a 1024 canvas:
//  - the rounded-rectangle body is 824×824, centred (≈100px padding each side);
//  - the corner radius is ≈22.37% of the body (the macOS superellipse, closely
//    approximated by a plain rounded rect — visually indistinguishable at icon
//    sizes). Kept as named constants per the no-hardcoding rule.
const CANVAS_PX = 1024;
const BODY_PX = 824;
const PAD_PX = Math.round((CANVAS_PX - BODY_PX) / 2);
const CORNER_RADIUS_PX = Math.round(BODY_PX * 0.2237);

/**
 * Build a macOS squircle 1024×1024 PNG (transparent padding + rounded body)
 * from a full-bleed square source image.
 * @param {string} squareSrcAbs absolute path to the square source PNG.
 * @returns {Promise<Buffer>} PNG buffer of the squircle icon.
 */
async function squirclePng(squareSrcAbs) {
  // Alpha mask: an opaque rounded rect; `dest-in` keeps the body only where the
  // mask is opaque, clearing the corners to transparent.
  const mask = Buffer.from(
    `<svg width="${BODY_PX}" height="${BODY_PX}">` +
      `<rect width="${BODY_PX}" height="${BODY_PX}" rx="${CORNER_RADIUS_PX}" ry="${CORNER_RADIUS_PX}"/>` +
      `</svg>`,
  );
  const body = await sharp(squareSrcAbs)
    .resize(BODY_PX, BODY_PX, { fit: 'cover' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: CANVAS_PX,
      height: CANVAS_PX,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: body, left: PAD_PX, top: PAD_PX }])
    .png()
    .toBuffer();
}

/**
 * Regenerate ONLY `<iconsDir>/icon.icns` as a macOS squircle from a square
 * source. All other files in `iconsDir` (icon.ico, Square*Logo.png, the PNGs)
 * are left exactly as the prior `tauri icon` run produced them.
 * @param {string} squareSrc source path (relative to repo root or absolute).
 * @param {string} iconsDir target icons dir (relative to repo root or absolute).
 */
export async function makeMacIcns(squareSrc, iconsDir) {
  const src = resolve(root, squareSrc);
  const outDir = resolve(root, iconsDir);
  const tmp = mkdtempSync(resolve(tmpdir(), 'mac-icns-'));
  try {
    const squirclePath = resolve(tmp, 'squircle.png');
    await sharp(await squirclePng(src)).toFile(squirclePath);
    // `tauri icon` writes a full icon set into `tmp`; we copy ONLY the .icns.
    runPnpm(['exec', 'tauri', 'icon', squirclePath, '--output', tmp], root);
    copyFileSync(resolve(tmp, 'icon.icns'), resolve(outDir, 'icon.icns'));
    console.log(`[make-mac-icon] squircle icon.icns → ${iconsDir}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// CLI: node scripts/make-mac-icon.mjs <squareSrc> <iconsDir>
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [src, dir] = process.argv.slice(2);
  if (!src || !dir) {
    console.error('usage: node scripts/make-mac-icon.mjs <squareSrc> <iconsDir>');
    process.exit(2);
  }
  await makeMacIcns(src, dir);
}
