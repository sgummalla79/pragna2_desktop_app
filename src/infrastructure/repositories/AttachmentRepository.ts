import type { AxiosInstance } from 'axios';
import type { IAttachmentRepository } from '@/application/ports/IAttachmentRepository';
import type { Attachment } from '@/domain/types/attachment.types';
import { mapAttachment, type ApiAttachmentResponse } from './mappers/mapAttachment';

/**
 * Axios-backed chat attachment repository.
 *
 * Upload posts multipart `FormData` — the desktop's native-HTTP adapter strips
 * the default JSON Content-Type for FormData bodies so the transport generates
 * the multipart boundary itself (same pattern as Knowledge uploads); do NOT set
 * Content-Type. Content fetch uses `responseType: 'blob'` (the adapter returns
 * raw bytes) through the shared client so the auth interceptor attaches Bearer.
 */
export class AttachmentRepository implements IAttachmentRepository {
  constructor(private readonly http: AxiosInstance) {}

  async upload(conversationId: string, file: File): Promise<Attachment> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await this.http.post<ApiAttachmentResponse>(
      `/conversations/${conversationId}/attachments`,
      form,
    );
    return mapAttachment(data);
  }

  async fetchContent(attachmentId: string): Promise<Blob> {
    const { data } = await this.http.get<Blob>(
      `/attachments/${attachmentId}/content`,
      { responseType: 'blob' },
    );
    return data;
  }
}
