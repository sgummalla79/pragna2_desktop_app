/** Helpers for asserting "what the BE sent" — by intercepting the FE's own
 *  API responses with Playwright. Capturing the real responses the FE
 *  received (rather than a separate API call) proves the BE→FE contract end
 *  to end. */
import type { Page, Response } from '@playwright/test';

export interface ApiAttachment {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
}

export interface ApiMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  attachments: ApiAttachment[];
}

/** Wait for (and parse) the FE's GET /messages response for a conversation. */
export async function waitForMessages(
  page: Page,
  conversationId: string,
  timeout = 15_000,
): Promise<ApiMessage[]> {
  const resp = await page.waitForResponse(
    (r) =>
      r.url().includes(`/api/conversations/${conversationId}/messages`) &&
      r.request().method() === 'GET' &&
      r.status() === 200,
    { timeout },
  );
  return (await resp.json()) as ApiMessage[];
}

/** Wait for the FE's GET /attachments/{id}/content response (the byte fetch
 *  the canvas reader makes). Returns the raw Response for header/status/body
 *  assertions. */
export function waitForAttachmentContent(
  page: Page,
  attachmentId: string,
  timeout = 15_000,
): Promise<Response> {
  return page.waitForResponse(
    (r) => r.url().includes(`/api/attachments/${attachmentId}/content`),
    { timeout },
  );
}

/** The attachments on the (single) assistant turn of a /messages payload. */
export function assistantAttachments(messages: ApiMessage[]): ApiAttachment[] {
  return messages.find((m) => m.role === 'assistant')?.attachments ?? [];
}
