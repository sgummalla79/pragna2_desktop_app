export type CredentialKind = 'api_key' | 'aws_credentials' | 'gcp_credentials';

/** One row from the global llm_providers catalogue (GET /api/llm-providers). */
export interface LlmProvider {
  /** UUID of the llm_providers lookup row — used as FK when registering. */
  id: string;
  /** Machine key used by the factory (e.g. 'anthropic'). */
  name: string;
  /** Human-readable label (e.g. 'Anthropic'). */
  displayName: string;
  /** Shape of the credential the user must supply. */
  credentialKind: CredentialKind;
  /** When false, this provider is hidden from users. */
  enabled: boolean;
}

/** A user_providers row — one provider registered by the logged-in user. */
export interface UserProvider {
  /** UUID of the user_providers record. */
  id: string;
  /** FK to llm_providers.id. */
  llmProviderId: string;
  /** Denormalised machine name (e.g. 'anthropic'). */
  providerName: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
}

/**
 * A UserProvider with its models already embedded.
 * Used inside LlmProviderWithRegistrations — models come from the combined
 * GET /api/llm-providers/with-registrations response (archived rows excluded).
 */
export interface UserProviderWithModels extends UserProvider {
  models: import('./model.types').Model[];
}

/**
 * An LlmProvider with the current user's registrations and models already embedded.
 * Returned by GET /api/llm-providers/with-registrations.
 * Empty userProviders array means the user has not connected this provider.
 */
export interface LlmProviderWithRegistrations extends LlmProvider {
  userProviders: UserProviderWithModels[];
}

/** Payload for POST /api/user-providers. */
export interface RegisterProviderPayload {
  /** FK to llm_providers.id — from GET /api/llm-providers. */
  llmProviderId: string;
  /**
   * Plaintext credential.
   * - api_key → raw key string
   * - aws_credentials → JSON-encoded { accessKeyId, secretAccessKey, region }
   * - gcp_credentials → service-account JSON blob verbatim
   */
  apiKey: string;
}

/** Response from POST /api/user-providers — provider + auto-discovered models. */
export interface ProviderWithModels {
  provider: UserProvider;
  models: import('./model.types').Model[];
}
