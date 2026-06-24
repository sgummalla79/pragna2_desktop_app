import type { AxiosInstance } from 'axios';
import { CHAT_API_PATH } from '@/constants/api';
import type { IPragnaFlowRepository } from '@/application/ports/IPragnaFlowRepository';
import type { PragnaSlashFlow } from '@/domain/types/pragnaSlashFlow.types';
import {
  mapPragnaSlashFlow,
  type ApiPragnaSlashFlowsListResponse,
} from './mappers/mapPragnaSlashFlow';

/**
 * Axios-backed reader for the chat slash-command discovery endpoint
 * (`GET {CHAT_API_PATH}/flows`, e.g. `/api/pragna/flows` or
 * `/api/nexus-kit/flows`).
 *
 * Call sites are resource-relative; the shared client supplies the `/api`
 * baseURL and (in the desktop app) routes through the Tauri native HTTP adapter.
 * The chat route prefix is brand-specific, so it is sourced from `CHAT_API_PATH`
 * (derived from the same `VITE_CHAT_API_BASE_URL` config that drives the
 * streaming dispatch) rather than hardcoded. The streaming dispatch itself
 * (`POST {CHAT_API_BASE_URL}/flows/{name}`) does NOT go through this repository —
 * it runs over the {@link TauriHttpAgent} transport in `useChatSession` by
 * mutating the agent URL per-turn.
 */
export class PragnaFlowRepository implements IPragnaFlowRepository {
  constructor(private readonly http: AxiosInstance) {}

  async listSlashFlows(): Promise<PragnaSlashFlow[]> {
    const { data } = await this.http.get<ApiPragnaSlashFlowsListResponse>(
      `${CHAT_API_PATH}/flows`,
    );
    return (data.flows ?? []).map(mapPragnaSlashFlow);
  }
}
