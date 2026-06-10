/**
 * Trigger a browser "save as" download for an in-memory blob.
 *
 * Wraps the bytes in a temporary object URL, clicks a synthetic anchor, then
 * revokes the URL so the blob doesn't leak. Used for attachment / generated
 * document downloads where the content endpoint is Bearer-only (so a bare
 * `<a href>` to the API URL would 401 — we already hold the fetched bytes).
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
