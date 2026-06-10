import { describe, it, expect } from 'vitest';
import { mapAttachment, type ApiAttachmentResponse } from './mapAttachment';

const RAW: ApiAttachmentResponse = {
  id: 'a1',
  conversation_id: 'c1',
  message_id: 'm1',
  filename: 'doc.pdf',
  content_type: 'application/pdf',
  size_bytes: 2048,
  uploaded_at: '2026-01-01T00:00:00Z',
  expired: true,
};

describe('mapAttachment', () => {
  it('maps snake_case → camelCase', () => {
    expect(mapAttachment(RAW)).toEqual({
      id: 'a1',
      conversationId: 'c1',
      messageId: 'm1',
      filename: 'doc.pdf',
      contentType: 'application/pdf',
      sizeBytes: 2048,
      uploadedAt: '2026-01-01T00:00:00Z',
      expired: true,
    });
  });

  it('defaults expired to false and preserves null ids', () => {
    const out = mapAttachment({
      ...RAW,
      conversation_id: null,
      message_id: null,
      expired: undefined as unknown as boolean,
    });
    expect(out.expired).toBe(false);
    expect(out.conversationId).toBeNull();
    expect(out.messageId).toBeNull();
  });
});
