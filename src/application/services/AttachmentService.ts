import type { IAttachmentRepository } from '@/application/ports/IAttachmentRepository';
import type { Attachment } from '@/domain/types/attachment.types';

/**
 * Application-layer facade over {@link IAttachmentRepository}. Thin delegations;
 * exists so views acquire the dependency through `useServices()`.
 */
export class AttachmentService {
  constructor(private readonly attachmentRepository: IAttachmentRepository) {}

  upload(conversationId: string, file: File): Promise<Attachment> {
    return this.attachmentRepository.upload(conversationId, file);
  }

  fetchContent(attachmentId: string): Promise<Blob> {
    return this.attachmentRepository.fetchContent(attachmentId);
  }
}
