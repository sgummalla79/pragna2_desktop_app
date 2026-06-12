import type { AxiosInstance } from 'axios';
import type { ILlmProviderRepository } from '@/application/ports/IProviderRepository';
import type {
  LlmProvider,
  LlmProviderWithRegistrations,
  UserProviderWithModels,
  CredentialKind,
} from '@/domain/types/provider.types';
import { mapModel } from './mappers/mapModel';
import type { ApiModelResponse } from './mappers/mapModel';

/** Backend R3.5+ wire shape — `api_name` replaces `name`. Domain type
 *  still exposes `.name`; we source it from the new field in the mapper. */
interface ApiLlmProviderResponse {
  id: string;
  api_name: string;
  display_name: string;
  credential_kind: string;
  enabled: boolean;
  allows_multiple_registrations: boolean;
}

/** Embedded model shape — identical to ApiModelResponse but `archived` is omitted (excluded server-side). */
type ApiEmbeddedModelResponse = Omit<ApiModelResponse, 'archived'>;

interface ApiUserProviderEmbedded {
  id: string;
  llm_provider_id: string;
  provider_api_name: string;
  enabled: boolean;
  label: string | null;
  metadata: Record<string, unknown>;
  models: ApiEmbeddedModelResponse[];
}

interface ApiLlmProviderWithRegistrationsResponse extends ApiLlmProviderResponse {
  current_user_providers: ApiUserProviderEmbedded[];
}

function mapLlmProvider(raw: ApiLlmProviderResponse): LlmProvider {
  return {
    id:                          raw.id,
    name:                        raw.api_name,
    displayName:                 raw.display_name,
    credentialKind:              raw.credential_kind as CredentialKind,
    enabled:                     raw.enabled,
    allowsMultipleRegistrations: raw.allows_multiple_registrations ?? false,
  };
}

function mapEmbeddedUserProvider(raw: ApiUserProviderEmbedded): UserProviderWithModels {
  return {
    id:            raw.id,
    llmProviderId: raw.llm_provider_id,
    providerName:  raw.provider_api_name,
    enabled:       raw.enabled,
    label:         raw.label ?? null,
    metadata:      raw.metadata ?? {},
    // Embedded models have no `archived` field — server excludes archived rows.
    models: raw.models.map((m) => mapModel({ ...m, archived: false })),
  };
}

function mapLlmProviderWithRegistrations(
  raw: ApiLlmProviderWithRegistrationsResponse
): LlmProviderWithRegistrations {
  return {
    ...mapLlmProvider(raw),
    userProviders: raw.current_user_providers.map(mapEmbeddedUserProvider),
  };
}

/** Reads the global llm_providers catalogue from GET /api/llm-providers. */
export class LlmProviderRepository implements ILlmProviderRepository {
  constructor(private readonly http: AxiosInstance) {}

  async listAll(): Promise<LlmProvider[]> {
    const { data } = await this.http.get<ApiLlmProviderResponse[]>('/llm-providers');
    return data.map(mapLlmProvider);
  }

  /**
   * Returns all providers with the current user's registrations and models embedded.
   * Single network call — replaces separate calls to the catalogue, user_providers, and user_models.
   */
  async listWithRegistrations(): Promise<LlmProviderWithRegistrations[]> {
    const { data } = await this.http.get<ApiLlmProviderWithRegistrationsResponse[]>(
      '/llm-providers/with-registrations'
    );
    return data.map(mapLlmProviderWithRegistrations);
  }
}
