/**
 * MCP Connectors settings page.
 *
 * Lists the user's registered MCP connectors (one expandable `ConnectorCard`
 * each) + an "Add connector" CTA that opens the {@link AddConnectorWizard}
 * (gallery → details → tool selection). Empty state when none are registered.
 *
 * The `?oauth=success|error` query handling is kept for parity with the web
 * app; on desktop there is no browser redirect back into the app yet, so it
 * simply never fires (harmless). See the connector card's OAuth note.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { ConnectorsIcon } from '@/presentation/components/icons/ConnectorsIcon';
import { EntityIcon } from '@/presentation/components/icons/EntityIcon';
import { Button } from '@/components/ui/button';
import { ERRORS } from '@/constants/errors';
import {
  MCP_CONNECTORS_KEY,
  useMcpConnectors,
} from '@/presentation/hooks/mcp-connectors/useMcpConnectors';
import { ConnectorCard } from './ConnectorCard';
import { AddConnectorWizard } from './AddConnectorWizard';

/** Connectors settings page (default export, mounted by the settings router). */
export default function ConnectorsView() {
  const { data: connectors = [], isLoading, isError } = useMcpConnectors();
  const [wizardOpen, setWizardOpen] = useState(false);

  // OAuth callback return: the BE redirects back here with ?oauth=success|error
  // on the web app. On desktop this never fires (no browser redirect into the
  // app yet) — kept harmless for parity. Show a banner, refetch, then strip the
  // query param so a reload doesn't re-show it.
  const [searchParams, setSearchParams] = useSearchParams();
  const [oauthBanner, setOauthBanner] = useState<'success' | 'error' | null>(
    null,
  );
  const qc = useQueryClient();
  useEffect(() => {
    const outcome = searchParams.get('oauth');
    if (outcome !== 'success' && outcome !== 'error') return;
    setOauthBanner(outcome);
    if (outcome === 'success') {
      qc.invalidateQueries({ queryKey: MCP_CONNECTORS_KEY });
    }
    const next = new URLSearchParams(searchParams);
    next.delete('oauth');
    next.delete('connector');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, qc]);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <EntityIcon entity="connectors" size="lg" />
            Connectors
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Per-user MCP connectors. Opt tools in to use them from your agents.
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)} size="sm" className="shrink-0">
          <Plus size={16} aria-hidden="true" />
          Add connector
        </Button>
      </div>

      {oauthBanner === 'success' && (
        <div
          role="status"
          className="mb-4 rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground"
        >
          Connector connected via OAuth.
        </div>
      )}
      {oauthBanner === 'error' && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          OAuth connection failed or was cancelled. Try connecting again.
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm" aria-live="polite">
          Loading connectors…
        </p>
      ) : isError ? (
        <p role="alert" className="text-sm text-destructive">
          {ERRORS.CON_001.message}
        </p>
      ) : connectors.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ConnectorsIcon
            size={40}
            className="mx-auto mb-3 opacity-30"
            aria-hidden="true"
          />
          <p>
            No connectors yet. Add one to make its tools available to your
            agents.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {connectors.map((c) => (
            <ConnectorCard key={c.id} connector={c} />
          ))}
        </div>
      )}

      <AddConnectorWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}
