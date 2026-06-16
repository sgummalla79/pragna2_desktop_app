/**
 * Boundary mappers for conversations + messages (snake_case API ↔ camelCase
 * domain). Message `attachments` are mapped via {@link mapAttachment} (pragna2-tracker TD-012).
 */

import type {
  Conversation,
  ConversationUsage,
  FinishReason,
  MessageRole,
  PersistedMessage,
  PersistedToolCall,
  UsageRecord,
} from '@/domain/types/conversation.types';
import { mapAttachment, type ApiAttachmentResponse } from './mapAttachment';

/** Raw shape returned by the conversation endpoints. */
export interface ApiConversationResponse {
  id: string;
  flow_id: string | null;
  thread_id: string;
  user_model_id: string | null;
  title: string | null;
  thinking_enabled: boolean;
  pinned: boolean;
  pinned_at: string | null;
  created_at: string;
}

/** Raw shape returned by the messages endpoint. */
export interface ApiMessageResponse {
  id: string;
  role: MessageRole;
  content: string;
  tool_calls: PersistedToolCall[] | null;
  user_model_id: string | null;
  message_index: number;
  created_at: string;
  modified_at: string;
  /** BE migration 0022 — `null` for non-assistant / legacy rows. */
  finish_reason: FinishReason | null;
  /** BE migration 0026 — assistant-only thinking trace; optional for old BEs. */
  reasoning_content?: string | null;
  /** Files attached to this turn; absent on older BEs → treated as empty. */
  attachments?: ApiAttachmentResponse[] | null;
}

/** Maps a raw API conversation to the domain `Conversation`. */
export function mapConversation(raw: ApiConversationResponse): Conversation {
  return {
    id: raw.id,
    flowId: raw.flow_id,
    threadId: raw.thread_id,
    userModelId: raw.user_model_id,
    title: raw.title,
    thinkingEnabled: raw.thinking_enabled ?? false,
    pinned: raw.pinned ?? false,
    pinnedAt: raw.pinned_at ?? null,
    createdAt: raw.created_at,
  };
}

/** Raw shape of one usage record (`…/usage` → `records[]`). */
export interface ApiUsageRecordResponse {
  id: string;
  user_model_id: string;
  node_id: string;
  input_tokens: number;
  output_tokens: number;
  /** `Decimal` serialised as a string to preserve precision. */
  cost_usd: string;
  created_at: string;
}

/** Raw shape returned by `GET /api/conversations/{id}/usage`. */
export interface ApiConversationUsageResponse {
  conversation_id: string;
  records: ApiUsageRecordResponse[];
  total_input_tokens: number;
  total_output_tokens: number;
  /** `Decimal` serialised as a string. */
  total_cost_usd: string;
}

/** Maps a raw usage record to the domain `UsageRecord`. */
function mapUsageRecord(raw: ApiUsageRecordResponse): UsageRecord {
  return {
    id: raw.id,
    userModelId: raw.user_model_id,
    nodeId: raw.node_id,
    inputTokens: raw.input_tokens,
    outputTokens: raw.output_tokens,
    costUsd: raw.cost_usd,
    createdAt: raw.created_at,
  };
}

/** Maps the raw usage aggregate to the domain `ConversationUsage`. */
export function mapConversationUsage(
  raw: ApiConversationUsageResponse,
): ConversationUsage {
  return {
    conversationId: raw.conversation_id,
    records: raw.records.map(mapUsageRecord),
    totalInputTokens: raw.total_input_tokens,
    totalOutputTokens: raw.total_output_tokens,
    totalCostUsd: raw.total_cost_usd,
  };
}

/** Maps a raw API message to the domain `PersistedMessage`. */
export function mapMessage(raw: ApiMessageResponse): PersistedMessage {
  return {
    id: raw.id,
    role: raw.role,
    content: raw.content,
    toolCalls: raw.tool_calls,
    userModelId: raw.user_model_id,
    messageIndex: raw.message_index,
    createdAt: raw.created_at,
    modifiedAt: raw.modified_at,
    // `?? null` keeps the type exhaustive when older deployments omit the field.
    finishReason: raw.finish_reason ?? null,
    reasoning: raw.reasoning_content ?? null,
    attachments: (raw.attachments ?? []).map(mapAttachment),
  };
}
