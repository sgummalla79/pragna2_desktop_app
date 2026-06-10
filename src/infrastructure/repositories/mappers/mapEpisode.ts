/**
 * Boundary mapper for HITL episodes (snake_case API ↔ camelCase domain).
 * Source: the conversation-episodes endpoints under `/api/conversations/*`.
 */

import type {
  EpisodeListPage,
  EpisodeSnapshot,
  EpisodeStatus,
} from '@/domain/types/episode.types';

/** Raw shape of a single episode row (`EpisodeResponse`). */
export interface ApiEpisodeResponse {
  id: string;
  conversation_id: string;
  flow_id: string | null;
  thread_id: string;
  status: EpisodeStatus;
  seed_summary: string | null;
  seed_user_input: string | null;
  interrupt_value: Record<string, unknown> | null;
  created_at: string;
  modified_at: string;
  ended_at: string | null;
}

/** Raw envelope of the list endpoint (`EpisodeListResponse`). */
export interface ApiEpisodeListResponse {
  episodes: ApiEpisodeResponse[];
  limit: number;
  offset: number;
}

/** Maps a raw API episode to the domain {@link EpisodeSnapshot}. */
export function mapEpisode(raw: ApiEpisodeResponse): EpisodeSnapshot {
  return {
    id: raw.id,
    conversationId: raw.conversation_id,
    flowId: raw.flow_id,
    threadId: raw.thread_id,
    status: raw.status,
    seedSummary: raw.seed_summary,
    seedUserInput: raw.seed_user_input,
    interruptValue: raw.interrupt_value,
    createdAt: raw.created_at,
    modifiedAt: raw.modified_at,
    endedAt: raw.ended_at,
  };
}

/** Maps a raw list page to the domain {@link EpisodeListPage}. */
export function mapEpisodeListPage(raw: ApiEpisodeListResponse): EpisodeListPage {
  return {
    episodes: (raw.episodes ?? []).map(mapEpisode),
    limit: raw.limit,
    offset: raw.offset,
  };
}
