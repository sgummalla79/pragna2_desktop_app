import axios, { type AxiosInstance } from 'axios';

import type {
  ConversationListParams,
  IConversationRepository,
} from '@/application/ports/IConversationRepository';
import type {
  Conversation,
  ConversationUsage,
  CreateConversationPayload,
  PersistedMessage,
  UpdateConversationPayload,
} from '@/domain/types/conversation.types';
import {
  mapConversation,
  mapConversationUsage,
  mapMessage,
  type ApiConversationResponse,
  type ApiConversationUsageResponse,
  type ApiMessageResponse,
} from './mappers/mapConversation';

/**
 * Axios-backed conversation repository (`/api/conversations/*`).
 *
 * Call sites are resource-relative; the shared client supplies the `/api`
 * baseURL and (in the desktop app) routes through the Tauri native HTTP
 * adapter. snake_case wire format is converted to camelCase by the mappers.
 */
export class ConversationRepository implements IConversationRepository {
  constructor(private readonly http: AxiosInstance) {}

  async list(params?: ConversationListParams): Promise<Conversation[]> {
    const { data } = await this.http.get<ApiConversationResponse[]>('/conversations', {
      params: {
        limit: params?.limit,
        offset: params?.offset,
        pinned: params?.pinned,
      },
    });
    return data.map(mapConversation);
  }

  async get(conversationId: string): Promise<Conversation | null> {
    // The BE returns 404 for both "no such conversation" AND "owned by another
    // user" — by design, to avoid leaking existence. Map 404 → `null` so the
    // caller can render the "New chat" placeholder without throwing.
    try {
      const { data } = await this.http.get<ApiConversationResponse>(
        `/conversations/${conversationId}`,
      );
      return mapConversation(data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async create(payload: CreateConversationPayload): Promise<Conversation> {
    // BE returns 201 on fresh-create and 200 on idempotent retry — both map to
    // the same response shape, so we don't branch on status here.
    const body: Record<string, unknown> = { thread_id: payload.threadId };
    if (payload.userModelId !== undefined) body.user_model_id = payload.userModelId;
    if (payload.thinkingEnabled !== undefined) {
      body.thinking_enabled = payload.thinkingEnabled;
    }
    // Pin the chosen agent at create (BE #153) so the landing picker is a single
    // call; omitted → the BE seeds the user's default agent.
    if (payload.agentId !== undefined) body.agent_id = payload.agentId;
    const { data } = await this.http.post<ApiConversationResponse>(
      '/conversations',
      body,
    );
    return mapConversation(data);
  }

  async getMessages(conversationId: string): Promise<PersistedMessage[]> {
    // Eager creation means the row exists by the time the chat surface mounts.
    // The remaining 404 cases are real races (active-delete refetch, multi-tab
    // delete) where "no conversation → no messages" is the correct zero-state.
    try {
      const { data } = await this.http.get<ApiMessageResponse[]>(
        `/conversations/${conversationId}/messages`,
      );
      return data.map(mapMessage);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  async update(
    conversationId: string,
    payload: UpdateConversationPayload,
  ): Promise<Conversation> {
    const body: Record<string, unknown> = {};
    if (payload.title !== undefined) body.title = payload.title;
    if (payload.userModelId !== undefined) body.user_model_id = payload.userModelId;
    if (payload.thinkingEnabled !== undefined) {
      body.thinking_enabled = payload.thinkingEnabled;
    }
    if (payload.pinned !== undefined) body.pinned = payload.pinned;
    if (payload.agentId !== undefined) body.agent_id = payload.agentId;
    const { data } = await this.http.patch<ApiConversationResponse>(
      `/conversations/${conversationId}`,
      body,
    );
    return mapConversation(data);
  }

  async delete(conversationId: string): Promise<void> {
    await this.http.delete(`/conversations/${conversationId}`);
  }

  async truncateFrom(conversationId: string, messageId: string): Promise<void> {
    await this.http.post(
      `/conversations/${conversationId}/messages/truncate-from`,
      { message_id: messageId },
    );
  }

  async branch(conversationId: string, messageId: string): Promise<Conversation> {
    const { data } = await this.http.post<ApiConversationResponse>(
      `/conversations/${conversationId}/branch`,
      { message_id: messageId },
    );
    return mapConversation(data);
  }

  async getUsage(conversationId: string): Promise<ConversationUsage> {
    // Eager-create means the row exists before the chat surface mounts, so the
    // remaining 404s are races (active-delete refetch, multi-tab / sidebar
    // delete). "No conversation → no usage" is the correct zero-state, so we
    // map 404 → an empty aggregate rather than surfacing an error on a chip.
    try {
      const { data } = await this.http.get<ApiConversationUsageResponse>(
        `/conversations/${conversationId}/usage`,
      );
      return mapConversationUsage(data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return {
          conversationId,
          records: [],
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCostUsd: '0',
        };
      }
      throw error;
    }
  }
}
