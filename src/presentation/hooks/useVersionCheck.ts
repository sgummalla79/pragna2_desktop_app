import { useEffect } from 'react';
import { axiosClient } from '@/infrastructure/http/axiosClient';
import { fetchVersionCard } from '@/infrastructure/http/versionApi';
import { CLIENT_VERSION, REQUIRED_API_COMPAT } from '@/constants/version';
import { compareCompat, parseCompat } from '@/infrastructure/versioning/compat';
import { useVersionStore, type CompatStatus } from '@/presentation/store/versionStore';

/**
 * Run the client→API version handshake once on launch: fetch /api/version,
 * decide compatibility on the MAJOR.MINOR key, and record the result so
 * VersionBanner can surface a non-blocking warning.
 *
 * Never blocks the UI: a fetch failure is recorded as 'unreachable' (shows
 * nothing). Decisions:
 *  - server compat < REQUIRED_API_COMPAT  → 'server_outdated' (update server)
 *  - client compat < card.min_client_compat → 'client_outdated' (update app)
 *  - otherwise 'ok'
 */
export function useVersionCheck(): void {
  const setResult = useVersionStore((s) => s.setResult);

  useEffect(() => {
    let cancelled = false;

    fetchVersionCard(axiosClient)
      .then((card) => {
        if (cancelled) return;
        const client = parseCompat(CLIENT_VERSION);
        const required = parseCompat(REQUIRED_API_COMPAT);
        const server = parseCompat(card.compat);
        const minClient = parseCompat(card.min_client_compat);

        let status: CompatStatus = 'ok';
        if (compareCompat(server, required) < 0) status = 'server_outdated';
        else if (compareCompat(client, minClient) < 0) status = 'client_outdated';

        setResult(status, card.version, card.compat);
      })
      .catch(() => {
        if (!cancelled) setResult('unreachable', null, null);
      });

    return () => {
      cancelled = true;
    };
  }, [setResult]);
}
