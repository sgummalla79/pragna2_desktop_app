import type { LlmProvider, LlmProviderWithRegistrations, RegisterProviderPayload, UserProvider, ProviderWithModels } from '@/domain/types/provider.types';
import type { RefreshModelsResult } from '@/domain/types/model.types';

/** Read-only access to the global llm_providers catalogue (GET /api/llm-providers). */
export interface ILlmProviderRepository {
  /** Returns every enabled provider option the backend supports. */
  listAll(): Promise<LlmProvider[]>;
  /**
   * Returns every provider with the current user's registrations embedded.
   * Replaces separate calls to listAll() + IUserProviderRepository.list().
   */
  listWithRegistrations(): Promise<LlmProviderWithRegistrations[]>;
}

/** CRUD for a user's own registered providers (/api/user-providers). */
export interface IUserProviderRepository {
  list(): Promise<UserProvider[]>;
  register(payload: RegisterProviderPayload): Promise<ProviderWithModels>;
  /**
   * Reconcile this provider's stored model list against what the upstream API
   * currently returns. Returns the diff plus the full active model list.
   */
  refreshModels(providerId: string): Promise<RefreshModelsResult>;
  /** Enables or disables a registered provider via PATCH /api/user-providers/{id}. */
  toggle(id: string, enabled: boolean): Promise<UserProvider>;
  delete(id: string): Promise<void>;
}
