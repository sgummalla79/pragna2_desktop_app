import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAgents } from '@/presentation/hooks/agents/useAgents';

interface AgentPickerProps {
  /** Active agent id pinned on the conversation, or `null` (→ default agent). */
  agentId: string | null;
  /** Parent owns persistence (PATCH conversation `agent_id`). */
  onAgentChange: (agentId: string) => void;
  /** Disable while a run is in flight (the BE 409s on a mid-episode switch). */
  disabled?: boolean;
}

/**
 * Inline chat-composer agent picker, built on the shadcn `Select`.
 *
 * Lists the user's **active** standalone agents (archived/inactive are excluded —
 * the BE rejects switching to them); the conversation's active agent shows in the
 * trigger. Renders nothing while loading or when the user has no active agents
 * (the chat gate already requires a default agent to exist). When the pinned id
 * isn't resolvable (legacy `null`, or an agent since archived), it soft-defaults
 * the label to the user's default agent — then the first active one — so the
 * trigger is never blank. Sits next to the attach-file control in the composer;
 * switching changes who answers the NEXT turn over the same transcript (#147).
 */
export function AgentPicker({ agentId, onAgentChange, disabled }: AgentPickerProps) {
  const { data: agents, isLoading } = useAgents();

  const activeAgents = (agents ?? []).filter((a) => a.status === 'active');
  if (isLoading || activeAgents.length === 0) return null;

  const resolvedId =
    (agentId && activeAgents.find((a) => a.id === agentId)?.id) ??
    activeAgents.find((a) => a.isDefault)?.id ??
    activeAgents[0].id;

  return (
    <Select value={resolvedId} onValueChange={onAgentChange} disabled={disabled}>
      <SelectTrigger
        size="sm"
        aria-label="Switch agent"
        // Borderless pill that blends into the composer — same overrides as
        // ModelPicker (the shadcn base adds a border + dark-mode fill).
        className="rounded-full border-transparent bg-transparent text-[12px] font-medium text-muted-foreground hover:bg-accent dark:bg-transparent dark:hover:bg-accent"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {activeAgents.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
