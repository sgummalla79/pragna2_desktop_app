import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { EntityIcon } from '@/presentation/components/icons/EntityIcon';
import { useFlow } from '@/presentation/hooks/flows/useFlows';
import { FlowEditor } from './FlowEditor';

/**
 * Flow detail (`/settings/flows/:flowId`): a compact header (name + status)
 * over the interactive visual editor. The editor ({@link FlowEditor}) owns the
 * canvas, node palette, selection panels, and Save; this view just provides the
 * page chrome and feeds it the loaded flow.
 */
export default function FlowDetailView() {
  const { flowId } = useParams();
  const { data: flow, isLoading, isError } = useFlow(flowId);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading flow…
      </div>
    );
  }

  if (isError || !flow) {
    return (
      <div className="mx-auto max-w-2xl p-4 md:p-8">
        <Link
          to={ROUTES.SETTINGS_FLOWS}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={15} /> Back to Flows
        </Link>
        <p className="mt-4 text-sm text-destructive">This flow could not be loaded.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Compact header. */}
      <div className="shrink-0 border-b border-border px-4 pt-8 pb-3">
        <Link
          to={ROUTES.SETTINGS_FLOWS}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> Back to Flows
        </Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <EntityIcon entity="flows" />
          <h1 className="text-lg font-semibold text-foreground">{flow.displayName}</h1>
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
            {flow.apiName}
          </span>
          {flow.exposedAsSlash && flow.slashApiName && (
            <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-[11px] text-accent-foreground">
              /{flow.slashApiName}
            </span>
          )}
        </div>
      </div>

      {/* Interactive editor (canvas + palette + panels + save). */}
      <div className="min-h-0 flex-1">
        <FlowEditor flow={flow} />
      </div>
    </div>
  );
}
