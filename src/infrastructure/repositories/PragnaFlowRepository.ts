import type { AxiosInstance } from 'axios';
import type { IPragnaFlowRepository } from '@/application/ports/IPragnaFlowRepository';
import type { PragnaSlashFlow } from '@/domain/types/pragnaSlashFlow.types';
import {
  mapPragnaSlashFlow,
  type ApiPragnaSlashFlowsListResponse,
} from './mappers/mapPragnaSlashFlow';

/**
 * Axios-backed reader for the chat slash-command discovery endpoint
 * (`GET /api/pragna/flows`).
 *
 * Call sites are resource-relative; the shared client supplies the `/api`
 * baseURL and (in the desktop app) routes through the Tauri native HTTP adapter.
 * The streaming dispatch itself (`POST /api/pragna/flows/{name}`) does NOT go
 * through this repository — it runs over the {@link TauriHttpAgent} transport in
 * `useChatSession` by mutating the agent URL per-turn.
 */
export class PragnaFlowRepository implements IPragnaFlowRepository {
  constructor(private readonly http: AxiosInstance) {}

  async listSlashFlows(): Promise<PragnaSlashFlow[]> {
    const { data } = await this.http.get<ApiPragnaSlashFlowsListResponse>(
      '/pragna/flows',
    );
    return (data.flows ?? []).map(mapPragnaSlashFlow);
  }
}
