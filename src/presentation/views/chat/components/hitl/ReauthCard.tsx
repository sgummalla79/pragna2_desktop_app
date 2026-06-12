import { useState } from 'react';

import { openUrl } from '@tauri-apps/plugin-opener';
import { KeyRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ReauthAction, ReauthEnvelope } from '@/domain/types/mcpDelegation.types';
import { logger } from '@/infrastructure/logging/logger';
import { useStartConnectorOAuth } from '@/presentation/hooks/mcp-connectors/useMcpConnectors';

export interface ReauthCardProps {
  /** The connector_reauth envelope persisted on the open episode. */
  envelope: ReauthEnvelope;
  /** Resume the paused run with the user's choice. */
  onResume: (action: ReauthAction) => void;
  /** True while a resume is streaming — buttons disabled. */
  submitting?: boolean;
}

/**
 * Inline card rendered when a remote-OAuth MCP connector's token was revoked
 * mid-run (#2). Two choices:
 *
 * - **Re-authenticate** — kicks the connector's existing OAuth flow
 *   (`useStartConnectorOAuth` → open the authorization URL in the system
 *   browser), then — once the user has completed it — resumes with
 *   ``action='retry'`` so the tool call re-runs with the fresh token.
 * - **Continue without it** — resumes with ``action='continue'``; the call is
 *   skipped and the agent reports the gap.
 *
 * Mirrors {@link HITLFormCard}'s placement + styling; the parent remounts it per
 * pause (keyed by episode id).
 */
export function ReauthCard({ envelope, onResume, submitting = false }: ReauthCardProps) {
  const startOAuth = useStartConnectorOAuth();
  const [reconnected, setReconnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReconnect = async () => {
    setError(null);
    try {
      const result = await startOAuth.mutateAsync({
        id: envelope.connector_id,
        payload: {},
      });
      if (result.authorizationUrl) {
        await openUrl(result.authorizationUrl);
        setReconnected(true);
      } else {
        // Manual-client connectors can't be reconnected from this card — point
        // the user at Settings → Connectors.
        setError(
          'This connector needs manual setup — reconnect it in Settings → Connectors, then choose Retry.',
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start re-authentication.');
      logger.fromError(
        'REAUTH_001:start',
        e instanceof Error ? e : new Error(String(e)),
      );
    }
  };

  const busy = submitting || startOAuth.isPending;

  return (
    <div className="my-2 rounded-lg border-2 border-primary/30 bg-accent/40 p-4 text-[13px]">
      <div className="flex items-center gap-2">
        <KeyRound size={16} className="text-primary" aria-hidden />
        <span className="font-semibold text-foreground">
          {envelope.display_name} needs to be reconnected
        </span>
      </div>

      <p className="mt-2 text-muted-foreground">
        The agent tried to use <strong>{envelope.display_name}</strong>, but its
        connection has expired. Re-authenticate to continue, or skip this step.
      </p>

      {reconnected && (
        <p className="mt-2 text-[12px] text-muted-foreground">
          Finish the sign-in in your browser, then choose <strong>Retry</strong>.
        </p>
      )}
      {error && (
        <p className="mt-2 text-[12px] text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => onResume('continue')}
        >
          Continue without it
        </Button>
        {reconnected ? (
          <Button
            type="button"
            disabled={busy}
            onClick={() => onResume('retry')}
          >
            Retry
          </Button>
        ) : (
          <Button type="button" disabled={busy} onClick={() => void handleReconnect()}>
            {startOAuth.isPending ? 'Opening…' : 'Re-authenticate'}
          </Button>
        )}
      </div>
    </div>
  );
}
