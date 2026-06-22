/**
 * Platform-aware "save these bytes to a file" capability.
 *
 * Why this lives in the platform layer: the obvious browser approach — wrapping
 * the bytes in an object URL and clicking a synthetic `<a download>` anchor — is
 * a **silent no-op in macOS WKWebView** (Tauri's webview), which does not honour
 * the HTML5 `download` attribute on blob anchors. So in the Tauri runtime we must
 * route the save through the native dialog + filesystem plugins instead. Gating
 * on {@link isTauriRuntime} (not the OS) keeps the plain-browser fallback — dev
 * server and the e2e suite, which can report any OS — on the blob-anchor path.
 *
 * `@tauri-apps/plugin-dialog`'s `save()` returns the user-chosen path and, per
 * Tauri v2, auto-scopes it for the fs plugin, so `writeFile()` may write that
 * exact path without a preconfigured `fs` scope.
 */
import { isTauriRuntime } from './runtime';
import { downloadBlob } from '@/lib/download';

/** Outcome of a save attempt. */
export interface SaveOutcome {
  /** `true` when bytes were written (or a browser download was triggered);
   *  `false` only when the user cancelled the native Save dialog. */
  saved: boolean;
  /** Absolute path written, when saved through the native dialog. */
  path?: string;
}

/**
 * Derive a native save-dialog file filter from a filename's extension, so the
 * dialog defaults to the right type without hardcoding any specific format. A
 * filename with no extension yields no filter (the dialog allows any type).
 */
function filtersForFilename(filename: string): { name: string; extensions: string[] }[] {
  const dot = filename.lastIndexOf('.');
  if (dot < 0 || dot === filename.length - 1) return [];
  const ext = filename.slice(dot + 1).toLowerCase();
  return [{ name: ext.toUpperCase(), extensions: [ext] }];
}

/**
 * Save a blob to disk, choosing the transport by runtime.
 *
 * - Tauri runtime: shows a native "Save As" dialog (`@tauri-apps/plugin-dialog`)
 *   and writes the chosen path (`@tauri-apps/plugin-fs`). Returns
 *   `{ saved: false }` if the user cancels the dialog.
 * - Plain browser (dev / e2e): triggers a standard blob-anchor download and
 *   returns `{ saved: true }` (the browser owns the rest of the flow).
 *
 * @param blob - The file bytes to save.
 * @param filename - Suggested filename (used as the dialog default and the
 *   browser download name).
 * @throws Re-throws any underlying dialog/write/transport error so the caller
 *   can surface a failure to the user (this never swallows errors).
 */
export async function saveBytes(blob: Blob, filename: string): Promise<SaveOutcome> {
  if (!isTauriRuntime()) {
    downloadBlob(blob, filename);
    return { saved: true };
  }

  const [{ save }, { writeFile }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
  ]);

  const path = await save({ defaultPath: filename, filters: filtersForFilename(filename) });
  if (!path) return { saved: false };

  const bytes = new Uint8Array(await blob.arrayBuffer());
  await writeFile(path, bytes);
  return { saved: true, path };
}
