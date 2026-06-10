import type { Attachment } from '@/domain/types/attachment.types';

/**
 * Port for chat attachments. Upload stages a file against a conversation;
 * `fetchContent` pulls the raw bytes through the authenticated client (a bare
 * `<img>`/`<iframe src>` can't, since the content endpoint requires a Bearer
 * header) for callers to turn into an object URL.
 */
export interface IAttachmentRepository {
  /** Upload a file to a conversation (multipart); returns its metadata. */
  upload(conversationId: string, file: File): Promise<Attachment>;

  /** Fetch an attachment's bytes as a Blob (authenticated). */
  fetchContent(attachmentId: string): Promise<Blob>;
}
