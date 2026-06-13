import type { AxiosInstance } from 'axios';

/** The API's public version/compatibility card (GET /api/version). */
export interface VersionCard {
  service: string;
  version: string;
  compat: string;
  min_client_compat: string;
  db_schema_revision: string | null;
}

/**
 * Fetch the API's version/compatibility card. The axios baseURL already
 * includes the `/api` prefix, so the resource path is `/version`.
 */
export async function fetchVersionCard(client: AxiosInstance): Promise<VersionCard> {
  const { data } = await client.get<VersionCard>('/version');
  return data;
}
