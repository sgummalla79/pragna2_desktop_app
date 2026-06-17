import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { EntityIcon } from '@/presentation/components/icons/EntityIcon';
import { ROUTES } from '@/constants/routes';
import { ERRORS } from '@/constants/errors';
import { FLOW_SLASH_NAME_RE } from '@/constants/flows';
import { slugify } from '@/domain/utils/slugify';
import { logger } from '@/infrastructure/logging/logger';
import {
  useDeleteFlow,
  useUpdateFlow,
  useUpdateFlowSlashExposure,
} from '@/presentation/hooks/flows/useFlows';
import type { Flow } from '@/domain/types/flow.types';

interface FlowCardProps {
  flow: Flow;
}

/**
 * One flow in the list: name + api_name, node/edge counts, an enable/disable
 * toggle, a slash-exposure toggle row, Open, and a confirmed Delete. Enable
 * (`PATCH /api/flows/{id}`) and slash exposure
 * (`PATCH /api/flows/{id}/slash-exposure`) both apply immediately from the card
 * — no need to open the editor; the backend requires a non-empty description
 * before a flow can be exposed, so a 4xx surfaces inline.
 */
export function FlowCard({ flow }: FlowCardProps) {
  const navigate = useNavigate();
  const remove = useDeleteFlow();
  const slash = useUpdateFlowSlashExposure();
  const update = useUpdateFlow();

  const [slashName, setSlashName] = useState(flow.slashApiName ?? slugify(flow.apiName));
  const [error, setError] = useState<string | null>(null);

  const open = () => navigate(`${ROUTES.SETTINGS_FLOWS}/${flow.id}`);

  const runSlash = async (payload: Parameters<typeof slash.mutateAsync>[0]['payload']) => {
    setError(null);
    try {
      await slash.mutateAsync({ flowId: flow.id, payload });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setError(ERRORS.FLW_007.message);
        return;
      }
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof detail === 'string' && detail ? detail : ERRORS.FLW_006.message);
      logger.fromError('FLW_006:slash', err);
    }
  };

  const toggleEnabled = async () => {
    setError(null);
    try {
      await update.mutateAsync({ flowId: flow.id, payload: { enabled: !flow.enabled } });
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof detail === 'string' && detail ? detail : ERRORS.FLW_009.message);
      logger.fromError('FLW_009:enabled', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const toggleExposed = () => {
    if (flow.exposedAsSlash) {
      void runSlash({ exposedAsSlash: false });
    } else {
      if (!FLOW_SLASH_NAME_RE.test(slashName)) {
        setError(ERRORS.FLW_008.message);
        return;
      }
      void runSlash({ exposedAsSlash: true, slashApiName: slashName });
    }
  };

  const handleDelete = async () => {
    try {
      await remove.mutateAsync(flow.id);
    } catch (err) {
      logger.fromError('FLW_004:delete', err);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <EntityIcon entity="flows" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground" title={flow.displayName}>
            {flow.displayName}
          </p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">{flow.apiName}</p>
        </div>
        <Button
          variant={flow.enabled ? 'default' : 'outline'}
          size="xs"
          className="min-w-[5rem] shrink-0 justify-center"
          onClick={() => void toggleEnabled()}
          disabled={update.isPending}
          title={flow.enabled ? 'Disable (unload from the runtime)' : 'Enable (load into the runtime)'}
        >
          {flow.enabled ? 'Enabled' : 'Disabled'}
        </Button>
      </div>

      <p className="text-[12px] text-muted-foreground">
        {flow.nodes.length} node{flow.nodes.length === 1 ? '' : 's'} · {flow.edges.length} edge
        {flow.edges.length === 1 ? '' : 's'}
      </p>

      {/* Slash exposure row. */}
      <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-background p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-medium text-foreground">Slash command</span>
          <Button
            variant={flow.exposedAsSlash ? 'default' : 'outline'}
            size="xs"
            onClick={toggleExposed}
            disabled={slash.isPending}
          >
            {flow.exposedAsSlash ? 'Exposed' : 'Expose'}
          </Button>
        </div>
        {flow.exposedAsSlash ? (
          <span className="font-mono text-[12px] text-muted-foreground">/{flow.slashApiName}</span>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] text-muted-foreground">/</span>
            <Input
              value={slashName}
              onChange={(e) => setSlashName(e.target.value)}
              placeholder="my-flow"
              className="h-7 text-[12px]"
              aria-label="Slash command name"
            />
          </div>
        )}
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>

      <div className="flex items-center justify-between">
        <ConfirmButton
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          confirmTitle="Delete flow?"
          confirmDescription={`This permanently deletes "${flow.displayName}". This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
        >
          <Trash2 size={14} /> Delete
        </ConfirmButton>
        <Button variant="outline" size="sm" onClick={open}>
          Open <ArrowRight size={14} />
        </Button>
      </div>
    </div>
  );
}
