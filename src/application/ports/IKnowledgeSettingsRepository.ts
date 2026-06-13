/**
 * Port for the per-user knowledge / retrieval settings (RAG ladder Rung 2).
 *
 * Backs the `/api/auth/me/knowledge-settings` singleton.
 */

import type {
  KnowledgeSettings,
  KnowledgeSettingsUpdate,
} from '@/domain/types/knowledgeSettings.types';

export interface IKnowledgeSettingsRepository {
  /** The user's resolved settings. Maps to `GET /api/auth/me/knowledge-settings`. */
  get(): Promise<KnowledgeSettings>;

  /** Partial-merge an update. Maps to `PATCH /api/auth/me/knowledge-settings`.
   *  Returns the resolved settings after the merge. */
  update(patch: KnowledgeSettingsUpdate): Promise<KnowledgeSettings>;
}
