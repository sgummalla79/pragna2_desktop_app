import { useMemo } from 'react';
import { useAgents } from '@/presentation/hooks/agents/useAgents';

interface Props {
  /** The agent id stamped on the assistant message (BE #145).
   *  `null` / `undefined` renders nothing. */
  agentId: string | null | undefined;
}

/**
 * Quiet "Sales Agent" persona attribution under an assistant turn — so a
 * conversation whose active agent was switched mid-chat stays readable on reload
 * (each turn shows which agent produced it).
 *
 * Looks the agent up in the already-warm `useAgents` cache (the picker shares
 * it), so this adds zero round-trips. When the id doesn't resolve (agent later
 * archived, historical NULL id, cache miss), renders nothing — better empty than
 * wrong. Styling matches {@link ModelBadge}: muted metadata, not content.
 */
export function AgentBadge({ agentId }: Props) {
  const { data: agents } = useAgents();

  const displayName = useMemo(() => {
    if (!agentId || !agents) return null;
    return agents.find((a) => a.id === agentId)?.displayName ?? null;
  }, [agents, agentId]);

  if (!displayName) return null;

  return (
    <span data-testid="agent-badge" className="text-[11px] text-muted-foreground select-none">
      {displayName}
    </span>
  );
}
