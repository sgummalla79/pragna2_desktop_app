/**
 * Constants for chat attachments. The accept list mirrors the backend's
 * `KNOWLEDGE_INGESTIBLE`/attachment MIME allow-list, and the size cap mirrors
 * the backend's per-file limit — both are client-side hints/pre-checks; the
 * backend remains the authoritative gate (413/415). Externalised here per the
 * no-hardcoding rule (the API does not expose these to the client).
 */

/** MIME types + extensions accepted by the composer's file picker. */
export const ATTACHMENT_ACCEPT = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.md',
  '.csv',
  '.docx',
  '.xlsx',
].join(',');

/** Client-side upload size cap (mirrors the backend's 10 MB per-file limit). */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/** True when a MIME type is a previewable image. */
export function isImageType(contentType: string): boolean {
  return contentType.startsWith('image/');
}

/** True when a MIME type is a PDF. */
export function isPdfType(contentType: string): boolean {
  return contentType === 'application/pdf';
}
