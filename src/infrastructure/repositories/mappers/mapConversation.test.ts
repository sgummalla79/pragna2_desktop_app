import { describe, it, expect } from 'vitest';
import {
  mapConversation,
  mapMessage,
  mapConversationUsage,
  type ApiConversationResponse,
  type ApiMessageResponse,
  type ApiConversationUsageResponse,
} from './mapConversation';

const CONV: ApiConversationResponse = {
  id: 'c1',
  flow_id: null,
  thread_id: 't1',
  user_model_id: 'm1',
  title: 'Hi',
  thinking_enabled: true,
  pinned: true,
  pinned_at: '2026-01-02T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
};

describe('mapConversation', () => {
  it('maps snake_case → camelCase', () => {
    expect(mapConversation(CONV)).toEqual({
      id: 'c1',
      flowId: null,
      threadId: 't1',
      userModelId: 'm1',
      title: 'Hi',
      thinkingEnabled: true,
      pinned: true,
      pinnedAt: '2026-01-02T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
    });
  });

  it('defaults thinking/pinned/pinnedAt when absent', () => {
    const raw = { ...CONV, thinking_enabled: undefined, pinned: undefined, pinned_at: undefined } as unknown as ApiConversationResponse;
    const out = mapConversation(raw);
    expect(out.thinkingEnabled).toBe(false);
    expect(out.pinned).toBe(false);
    expect(out.pinnedAt).toBeNull();
  });
});

describe('mapMessage', () => {
  const base: ApiMessageResponse = {
    id: 'msg1',
    role: 'assistant',
    content: 'hello',
    tool_calls: null,
    user_model_id: 'm1',
    message_index: 3,
    created_at: '2026-01-01T00:00:00Z',
    modified_at: '2026-01-01T00:01:00Z',
    finish_reason: 'stop',
  };

  it('maps fields and coalesces optional reasoning/attachments', () => {
    const out = mapMessage(base);
    expect(out).toMatchObject({
      id: 'msg1',
      role: 'assistant',
      content: 'hello',
      toolCalls: null,
      userModelId: 'm1',
      messageIndex: 3,
      finishReason: 'stop',
      reasoning: null,
      attachments: [],
    });
  });

  it('maps reasoning_content → reasoning and finish_reason null → null', () => {
    const out = mapMessage({ ...base, reasoning_content: 'thinking…', finish_reason: null });
    expect(out.reasoning).toBe('thinking…');
    expect(out.finishReason).toBeNull();
  });

  it('maps the attachments array when present', () => {
    const out = mapMessage({
      ...base,
      attachments: [
        {
          id: 'a1',
          conversation_id: 'c1',
          message_id: 'msg1',
          filename: 'f.png',
          content_type: 'image/png',
          size_bytes: 10,
          uploaded_at: '2026-01-01T00:00:00Z',
          expired: false,
        },
      ],
    });
    expect(out.attachments).toHaveLength(1);
    expect(out.attachments[0]).toMatchObject({ id: 'a1', filename: 'f.png', contentType: 'image/png' });
  });
});

describe('mapConversationUsage', () => {
  it('maps totals + records, keeping cost as a string', () => {
    const raw: ApiConversationUsageResponse = {
      conversation_id: 'c1',
      records: [
        {
          id: 'u1',
          user_model_id: 'm1',
          node_id: 'chat',
          input_tokens: 100,
          output_tokens: 50,
          cost_usd: '0.001050',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      total_input_tokens: 100,
      total_output_tokens: 50,
      total_cost_usd: '0.001050',
    };
    const out = mapConversationUsage(raw);
    expect(out.conversationId).toBe('c1');
    expect(out.totalInputTokens).toBe(100);
    expect(out.totalOutputTokens).toBe(50);
    expect(out.totalCostUsd).toBe('0.001050');
    expect(typeof out.totalCostUsd).toBe('string');
    expect(out.records[0]).toEqual({
      id: 'u1',
      userModelId: 'm1',
      nodeId: 'chat',
      inputTokens: 100,
      outputTokens: 50,
      costUsd: '0.001050',
      createdAt: '2026-01-01T00:00:00Z',
    });
  });

  it('handles an empty records array (zero-state)', () => {
    const out = mapConversationUsage({
      conversation_id: 'c1',
      records: [],
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cost_usd: '0',
    });
    expect(out.records).toEqual([]);
    expect(out.totalCostUsd).toBe('0');
  });
});
