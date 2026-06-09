/**
 * Boundary mapper for slash-exposed flows (snake_case API ↔ camelCase domain).
 * Source: the chat discovery endpoint `GET /api/pragna/flows`.
 */

import type { PragnaSlashFlow } from '@/domain/types/pragnaSlashFlow.types';

/** Raw item shape inside the `{ flows: [...] }` discovery response. */
export interface ApiPragnaSlashFlowResponse {
  slash_api_name: string;
  display_name: string;
  description: string;
}

/** Envelope returned by `GET /api/pragna/flows`. */
export interface ApiPragnaSlashFlowsListResponse {
  flows: ApiPragnaSlashFlowResponse[];
}

/** Maps a raw slash-flow item to the domain {@link PragnaSlashFlow}. */
export function mapPragnaSlashFlow(raw: ApiPragnaSlashFlowResponse): PragnaSlashFlow {
  return {
    slashApiName: raw.slash_api_name,
    displayName: raw.display_name,
    description: raw.description ?? '',
  };
}
