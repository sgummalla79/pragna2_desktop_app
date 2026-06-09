import type { AxiosInstance } from 'axios';
import { getCorrelationId } from '@/infrastructure/logging/correlationStore';

const CORRELATION_HEADER = 'X-Correlation-ID';

export function applyCorrelationInterceptor(client: AxiosInstance): void {
  client.interceptors.request.use((config) => {
    config.headers.set(CORRELATION_HEADER, getCorrelationId());
    return config;
  });
}
