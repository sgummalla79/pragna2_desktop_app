import type { Model } from '@/domain/types/model.types';

/** Raw shape returned by any endpoint that yields ModelResponse objects.
 *
 * Backend R3.5+ renamed `model_name` → `api_name` on user_models. The
 * domain type still exposes `modelName` (callers expect it); we source
 * it from the new wire field.
 */
export interface ApiModelResponse {
  id: string;
  user_provider_id: string;
  api_name: string;
  display_name: string;
  cost_per_input_token: string;
  cost_per_output_token: string;
  enabled: boolean;
  available_for_chat: boolean;
  available_for_flows: boolean;
  archived: boolean;
  metadata: Record<string, unknown>;
  /** R5. Default `false` for backwards-compat with older response shapes. */
  supports_vision?: boolean;
  supports_pdf?: boolean;
}

/** Maps a raw API ModelResponse to the domain Model type. */
export function mapModel(raw: ApiModelResponse): Model {
  return {
    id:                 raw.id,
    userProviderId:     raw.user_provider_id,
    modelName:          raw.api_name,
    displayName:        raw.display_name,
    costPerInputToken:  raw.cost_per_input_token,
    costPerOutputToken: raw.cost_per_output_token,
    enabled:            raw.enabled,
    availableForChat:   raw.available_for_chat,
    availableForFlows:  raw.available_for_flows,
    archived:           raw.archived,
    metadata:           raw.metadata ?? {},
    supportsVision:     raw.supports_vision ?? false,
    supportsPdf:        raw.supports_pdf ?? false,
  };
}
