import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';

/**
 * Query key for the chat slash-command discovery list. Shared (intentionally)
 * with the settings flow mutations: toggling slash exposure or saving a flow
 * from YAML invalidates this key, so the composer's popover picks up newly
 * exposed (or renamed) flows without a manual refetch.
 */
export const PRAGNA_FLOWS_KEY = ['pragna', 'flows'] as const;

/**
 * Fetch the flows the user has exposed as `/slash` commands. A short
 * `staleTime` keeps the popover responsive without refetching on every
 * keystroke; mutations on the settings side proactively invalidate the key.
 */
export function usePragnaSlashFlows() {
  const { pragnaFlowService } = useServices();
  return useQuery({
    queryKey: PRAGNA_FLOWS_KEY,
    queryFn: () => pragnaFlowService.listSlashFlows(),
    staleTime: 30_000,
  });
}
