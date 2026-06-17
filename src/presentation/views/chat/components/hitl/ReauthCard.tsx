import { useState } from 'react';

import { openUrl } from '@tauri-apps/plugin-opener';
import { KeyRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ReauthAction, ReauthEnvelope } from '@/domain/types/mcpDelegation.types';
import { isDownstreamServiceReauth } from '@/domain/types/mcpDelegation.types';
import { logger } from '@/infrastructure/logging/logger';
import { mcpStdio } from '@/infrastructure/platform';
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
 * Inline card rendered when an MCP connector needs re-authentication mid-run.
 * Boundary-aware (#122/#124) — two re-auth flows behind one card:
 *
 * - **boundary=connector** (remote OAuth we hold): **Re-authenticate** kicks the
 *   connector's OAuth flow (`useStartConnectorOAuth` → open the authorization URL
 *   in the system browser).
 * - **boundary=downstream_service** (an aggregator's per-provider token, e.g. GUS
 *   in an mcp-adaptor — #124): **Re-authenticate** runs the adaptor's OWN flow
 *   (`mcpStdio.reauth(connector_id, service)` → `<binary> auth --provider
 *   <service>`), or opens `authorization_url` when the envelope carries one.
 *
 * In both cases, once the user has completed the flow the card resumes with
 * ``action='retry'`` (the BE re-runs / re-delegates the call with the fresh
 * token); **Continue without it** resumes ``action='continue'`` so the step
 * degrades and the run proceeds.
 *
 * Mirrors {@link HITLFormCard}'s placement + styling; the parent remounts it per
 * pause (keyed by episode id).
 */
export function ReauthCard({ envelope, onResume, submitting = false }: ReauthCardProps) {
  const startOAuth = useStartConnectorOAuth();
  const [reconnected, setReconnected] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downstream = isDownstreamServiceReauth(envelope);
  // The downstream provider name (e.g. `gus`), when the BE could name it. Falls
  // back to the connector label when it came from the text-signal fallback.
  const serviceLabel = envelope.service ?? null;

  /** Drive an aggregator's per-service re-auth: open a server-provided URL when
   *  present, else run the adaptor's local `auth --provider <service>` flow. */
  const reconnectDownstream = async () => {
    if (envelope.authorization_url) {
      await openUrl(envelope.authorization_url);
    } else {
      await mcpStdio.reauth(envelope.connector_id, serviceLabel);
    }
    setReconnected(true);
  };

  /** Drive a remote connector's OAuth flow (boundary=connector). */
  const reconnectConnector = async () => {
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
  };

  const handleReconnect = async () => {
    setError(null);
    setRunning(true);
    try {
      if (downstream) {
        await reconnectDownstream();
      } else {
        await reconnectConnector();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start re-authentication.');
      logger.fromError(
        'REAUTH_001:start',
        e instanceof Error ? e : new Error(String(e)),
      );
    } finally {
      setRunning(false);
    }
  };

  const busy = submitting || running || startOAuth.isPending;

  return (
    <div className="my-2 rounded-lg border-2 border-primary/30 bg-accent/40 p-4 text-[13px]">
      <div className="flex items-center gap-2">
        <KeyRound size={16} className="text-primary" aria-hidden />
        <span className="font-semibold text-foreground">
          {downstream && serviceLabel
            ? `${serviceLabel} needs to be reconnected`
            : `${envelope.display_name} needs to be reconnected`}
        </span>
      </div>

      <p className="mt-2 text-muted-foreground">
        {downstream && serviceLabel ? (
          <>
            The agent tried to use the <strong>{serviceLabel}</strong> service via{' '}
            <strong>{envelope.display_name}</strong>, but its sign-in has expired.
            Re-authenticate to continue, or skip this step.
          </>
        ) : (
          <>
            The agent tried to use <strong>{envelope.display_name}</strong>, but its
            connection has expired. Re-authenticate to continue, or skip this step.
          </>
        )}
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
            {busy ? 'Opening…' : 'Re-authenticate'}
          </Button>
        )}
      </div>
    </div>
  );
}
