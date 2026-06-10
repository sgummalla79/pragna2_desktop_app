/**
 * Boundary mapper for chat attachments (snake_case API ↔ camelCase domain).
 * Source: `POST /api/conversations/{id}/attachments` + the `attachments` array
 * on message responses.
 */

import type { Attachment } from '@/domain/types/attachment.types';

/** Raw attachment shape (`AttachmentResponse`). */
export interface ApiAttachmentResponse {
  id: string;
  conversation_id: string | null;
  message_id: string | null;
  filename: string;
  content_type: string;
  size_bytes: number;
  uploaded_at: string;
  expired: boolean;
}

/** Maps a raw API attachment to the domain {@link Attachment}. */
export function mapAttachment(raw: ApiAttachmentResponse): Attachment {
  return {
    id: raw.id,
    conversationId: raw.conversation_id,
    messageId: raw.message_id,
    filename: raw.filename,
    contentType: raw.content_type,
    sizeBytes: raw.size_bytes,
    uploadedAt: raw.uploaded_at,
    expired: raw.expired ?? false,
  };
}
