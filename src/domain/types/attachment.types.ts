/**
 * A file attached to a chat turn.
 *
 * Uploaded ahead of send (`POST /api/conversations/{id}/attachments`), then
 * associated with the turn by passing its `id` in
 * `forwardedProps.attachment_ids`. Persisted messages carry an `attachments`
 * array of these (metadata only — bytes are fetched lazily from
 * `GET /api/attachments/{id}/content`).
 */
export interface Attachment {
  id: string;
  /** `null` when staged before the conversation row exists; set on send. */
  conversationId: string | null;
  /** `null` while staged; set when the user turn it's attached to persists. */
  messageId: string | null;
  filename: string;
  /** MIME type detected at upload (e.g. `image/png`, `application/pdf`). */
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  /** True once retention has removed the bytes — render a placeholder, no fetch. */
  expired: boolean;
}
