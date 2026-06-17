import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui/button';
import { useOverlayTitleBarInset } from '@/presentation/hooks/useOverlayTitleBarInset';
import { useFlow } from '@/presentation/hooks/flows/useFlows';
import { FlowEditor } from './FlowEditor';

/**
 * Flow detail (`/settings/flows/:flowId`): a **full-page** editor that fills the
 * whole window — the same treatment as the agent create/edit form
 * ({@link AgentFormModal}). It's a `fixed inset-0` surface so it covers the
 * settings sidebar instead of being cramped beside it; a "Back to Flows" link
 * returns to the list. The header reserves space for the macOS overlay traffic
 * lights via {@link useOverlayTitleBarInset} (CF-019), since it now sits at the
 * window's top-left.
 *
 * The editor ({@link FlowEditor}) owns the meta bar (description, slash, enable/
 * disable, YAML import/export, Save), canvas, palette, and selection panels;
 * this view provides the full-page chrome and feeds it the loaded flow.
 *
 * z-index: `z-[300]` sits ABOVE the settings chrome it must cover — the macOS
 * collapse toggle (`z-[70]`) and the Windows title bar (`z-[200]`) — so neither
 * shows over the full-page editor (matching the agent form), yet BELOW the modal
 * tier (`z-[700]`+) so dialogs the editor itself opens (the connector wizard,
 * confirm dialogs, Select dropdowns) still layer on top.
 */
export default function FlowDetailView() {
  const { flowId } = useParams();
  const { data: flow, isLoading, isError } = useFlow(flowId);
  const headerInset = useOverlayTitleBarInset();

  return (
    <div className="fixed inset-0 z-[300] flex h-screen w-screen flex-col bg-background text-foreground">
      {/* Full-page header — one compact row next to the macOS traffic lights,
          mirroring the agent edit form: [back] [Edit <name>]. Flows are always
          created first (NewFlowDialog) then opened here, so the title is always
          "Edit". The flow identity (icon + name + pills) lives above the
          Description in the FlowMetaBar. */}
      <div
        className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3"
        style={headerInset}
      >
        <Button asChild variant="ghost" size="icon">
          <Link to={ROUTES.SETTINGS_FLOWS} aria-label="Back to Flows" title="Back to Flows">
            <ArrowLeft size={16} aria-hidden="true" />
          </Link>
        </Button>
        {flow && (
          <h1 className="m-0 truncate text-base font-bold text-foreground">
            Edit {flow.displayName}
          </h1>
        )}
      </div>

      {/* Body: loading / error / the interactive editor. */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Loading flow…
        </div>
      ) : isError || !flow ? (
        <div className="flex-1 p-4 md:p-8">
          <p className="text-sm text-destructive">This flow could not be loaded.</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <FlowEditor flow={flow} />
        </div>
      )}
    </div>
  );
}
