/**
 * Application service for the per-user knowledge / retrieval settings (RAG Rung 2).
 *
 * Thin pass-through over `IKnowledgeSettingsRepository`.
 */

import type { IKnowledgeSettingsRepository } from '@/application/ports/IKnowledgeSettingsRepository';
import type {
  KnowledgeSettings,
  KnowledgeSettingsUpdate,
} from '@/domain/types/knowledgeSettings.types';

export class KnowledgeSettingsService {
  constructor(private readonly repo: IKnowledgeSettingsRepository) {}

  get(): Promise<KnowledgeSettings> {
    return this.repo.get();
  }

  update(patch: KnowledgeSettingsUpdate): Promise<KnowledgeSettings> {
    return this.repo.update(patch);
  }
}
