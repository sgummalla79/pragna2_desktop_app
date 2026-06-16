/**
 * Domain types for chat conversations and their persisted messages.
 *
 * Frontend shapes for `/api/conversations/*`. The backend serialises in
 * snake_case; mappers in `infrastructure/repositories/mappers/mapConversation.ts`
 * translate at the boundary. UI code only sees the camelCase shapes here.
 *
 * Message attachments are mapped (pragna2-tracker TD-012); per-conversation usage/cost is
 * mapped (pragna2-tracker TD-016).
 */

import type { Attachment } from '@/domain/types/attachment.types';

/** A message turn's author. `tool`/`system` turns are rendered minimally. */
export type MessageRole = 'user' | 'assistant' | 'tool' | 'system';

/** Normalised terminal stop signal for an assistant turn (BE migration 0022). */
export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'other';

/** One conversation the user owns (`GET /api/conversations`). */
export interface Conversation {
  id: string;
  /** Set when the conversation is bound to a flow; `null` for default-agent chats. */
  flowId: string | null;
  /** Client-supplied UUID = primary key AND LangGraph checkpoint thread_id. */
  threadId: string;
  /** Model the next chat turn will use. `null` for legacy rows; mutable via PATCH. */
  userModelId: string | null;
  /** Auto-generated or user-set title; `null` until auto-title lands. */
  title: string | null;
  /** Per-conversation Anthropic extended-thinking toggle. */
  thinkingEnabled: boolean;
  /** Per-user "pin to sidebar top" flag. */
  pinned: boolean;
  /** ISO-8601 UTC timestamp of the last pin event, or `null` when not pinned. */
  pinnedAt: string | null;
  createdAt: string;
}

/** One tool invocation surfaced under an assistant turn. */
export interface PersistedToolCall {
  id: string;
  name: string;
  args?: Record<string, unknown>;
  result?: string;
}

/**
 * A persisted message turn (`GET /api/conversations/{id}/messages`).
 *
 * The chat surface (`useChatSession`) translates these into the in-memory
 * `ChatMessage` shape it renders on hydration.
 */
export interface PersistedMessage {
  id: string;
  role: MessageRole;
  content: string;
  /** Assistant-only tool invocations; `null` for other roles. */
  toolCalls: PersistedToolCall[] | null;
  /** Assistant-only: the `user_model` that produced this content (BE 0010). */
  userModelId: string | null;
  messageIndex: number;
  createdAt: string;
  modifiedAt: string;
  /** Assistant-only terminal stop signal; `null` for other roles / legacy rows. */
  finishReason: FinishReason | null;
  /** Assistant-only extended-thinking trace (BE 0026); `null` otherwise. */
  reasoning: string | null;
  /** Files attached to this turn (user uploads / assistant-generated docs). */
  attachments: Attachment[];
}

/** Body for `POST /api/conversations` (eager-create before the first turn). */
export interface CreateConversationPayload {
  /** Client-supplied UUID, reused as the `/chat/{id}` route and thread_id. */
  threadId: string;
  /** Model the first turn will use. */
  userModelId?: string | null;
  /** Apply the first-turn extended-thinking choice at create time. */
  thinkingEnabled?: boolean;
}

/** Partial-update body for `PATCH /api/conversations/{id}`. */
export interface UpdateConversationPayload {
  title?: string;
  userModelId?: string;
  thinkingEnabled?: boolean;
  pinned?: boolean;
}

/**
 * One LLM-call usage record under a conversation (a row of the aggregate from
 * `GET /api/conversations/{id}/usage`).
 *
 * `costUsd` is kept as a **string** — the backend serialises the `Decimal` as a
 * string to preserve precision (e.g. `"0.001050"`); parse to a number only at
 * the display boundary (`formatUsd`).
 */
export interface UsageRecord {
  id: string;
  /** The `user_model` that produced this call. */
  userModelId: string;
  /** Flow node or skill that triggered the LLM call (e.g. `"chat"`). */
  nodeId: string;
  inputTokens: number;
  outputTokens: number;
  /** USD cost of this call, as a precision-preserving string. */
  costUsd: string;
  /** ISO-8601 UTC timestamp of the call. */
  createdAt: string;
}

/**
 * Aggregated token usage + cost for a conversation
 * (`GET /api/conversations/{id}/usage`). `records` is the per-call breakdown;
 * the totals are server-summed. `totalCostUsd` is a string (see {@link UsageRecord}).
 */
export interface ConversationUsage {
  conversationId: string;
  records: UsageRecord[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: string;
}
