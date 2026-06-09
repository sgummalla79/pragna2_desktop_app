import type { ILlmProviderRepository } from '@/application/ports/IProviderRepository';
import type { LlmProvider, LlmProviderWithRegistrations } from '@/domain/types/provider.types';

/** Exposes the global LLM provider catalogue from GET /api/llm-providers. */
export class LlmProviderService {
  constructor(private readonly llmProviderRepository: ILlmProviderRepository) {}

  /** Returns all providers supported by the platform. */
  listAll(): Promise<LlmProvider[]> {
    return this.llmProviderRepository.listAll();
  }

  /**
   * Returns all providers with the current user's registrations embedded.
   * Single network call — replaces separate listAll() + ProviderService.list() calls.
   */
  listWithRegistrations(): Promise<LlmProviderWithRegistrations[]> {
    return this.llmProviderRepository.listWithRegistrations();
  }
}
