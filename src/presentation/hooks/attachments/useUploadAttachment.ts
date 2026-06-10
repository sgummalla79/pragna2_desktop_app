import { useMutation } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import type { Attachment } from '@/domain/types/attachment.types';

/**
 * Upload a single file to a conversation, returning its {@link Attachment}
 * (the `id` is what the composer passes in `forwardedProps.attachment_ids` on
 * send). No query cache to invalidate — the result is held in composer-local
 * staging state.
 */
export function useUploadAttachment() {
  const { attachmentService } = useServices();
  return useMutation<Attachment, Error, { conversationId: string; file: File }>({
    mutationFn: ({ conversationId, file }) =>
      attachmentService.upload(conversationId, file),
  });
}
