import { EntityIcon } from '@/presentation/components/icons/EntityIcon';
import { FlowsIcon } from '@/presentation/components/icons/FlowsIcon';
import { ERRORS } from '@/constants/errors';
import { useFlows } from '@/presentation/hooks/flows/useFlows';
import { FlowCard } from './FlowCard';
import { NewFlowDialog } from './NewFlowDialog';

/**
 * Agent Flows list (`/settings/flows`). A header + a responsive grid of flow
 * cards, with a "New flow" dialog. Each card opens the read-only detail view
 * (canvas + YAML authoring).
 */
export default function FlowsView() {
  const { data: flows, isLoading, isError } = useFlows();

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold">
            <EntityIcon entity="flows" size="lg" />
            Agent Flows
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Multi-agent pipelines you author as YAML and can expose as <code>/slash</code>{' '}
            commands in chat.
          </p>
        </div>
        <NewFlowDialog />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading flows…</p>}
      {isError && <p className="text-sm text-destructive">{ERRORS.FLW_001.message}</p>}

      {!isLoading && !isError && (flows?.length ?? 0) === 0 && (
        <div className="py-16 text-center text-muted-foreground">
          <FlowsIcon size={40} className="mx-auto mb-3 opacity-30" />
          <p>No flows yet. Create your first flow to get started.</p>
        </div>
      )}

      {flows && flows.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {flows.map((flow) => (
            <FlowCard key={flow.id} flow={flow} />
          ))}
        </div>
      )}
    </div>
  );
}
