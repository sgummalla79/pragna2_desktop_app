import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAgents } from '@/presentation/hooks/agents/useAgents';
import { resolveActiveAgentId } from '../utils/agentSelection';

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
 * trigger. Renders nothing while loading or when there are **fewer than two**
 * active agents: with zero there is nothing to run, and with exactly one there is
 * nothing to switch *to*, so the control is hidden and that lone agent (the
 * default) is used implicitly. When the pinned id isn't resolvable (legacy `null`,
 * or an agent since archived), it soft-defaults the label to the user's default
 * agent — then the first active one — so the trigger is never blank. Sits next to
 * the attach-file control in the composer; switching changes who answers the NEXT
 * turn over the same transcript (#147).
 */
export function AgentPicker({ agentId, onAgentChange, disabled }: AgentPickerProps) {
  const { data: agents, isLoading } = useAgents();

  const activeAgents = (agents ?? []).filter((a) => a.status === 'active');
  // The same resolution the landing uses to pin the agent at create — kept in one
  // place so the trigger never shows an agent different from the one sent.
  const resolvedId = resolveActiveAgentId(activeAgents, agentId);
  // Hide unless there's a real choice: 0 active → nothing to run, 1 active →
  // nothing to switch to (the lone default agent is used implicitly). `resolvedId`
  // is null only when there are zero active agents (also covered by `< 2`).
  if (isLoading || activeAgents.length < 2 || resolvedId === null) return null;

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
