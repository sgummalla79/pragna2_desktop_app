/**
 * "Knowledge" section of the agent editor (edit mode only) — RAG Rung 2.
 *
 * **References** knowledge libraries (defined at Settings → Knowledge) on this
 * agent so it gains the `list_knowledge` / `read_knowledge` / `search_knowledge`
 * tools over them. Attaching/detaching is a binding only — the library itself
 * lives at the root and can be shared by other agents/flows. Bindings key on the
 * agent id (which exists only after create), so this renders only when editing
 * an existing agent, and changes apply immediately.
 */

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { EntityIcon } from '@/presentation/components/icons/EntityIcon';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useKnowledgeLibraries } from '@/presentation/hooks/knowledge/useKnowledgeLibraries';
import {
  useAgentKnowledge,
  useAttachAgentKnowledge,
  useDetachAgentKnowledge,
} from '@/presentation/hooks/agents/useAgentKnowledge';

interface Props {
  agentId: string;
}

/** Reads `err.response.data.detail` if present, else the supplied fallback. */
function messageFrom(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: string } } })?.response
    ?.data?.detail;
  if (detail) return String(detail);
  return err instanceof Error ? err.message : fallback;
}

/** Lists + manages the agent's library bindings; changes apply immediately. */
export function AgentKnowledgeSection({ agentId }: Props) {
  const { data: bindings = [] } = useAgentKnowledge(agentId);
  const { data: libraries = [] } = useKnowledgeLibraries();
  const attach = useAttachAgentKnowledge(agentId);
  const detach = useDetachAgentKnowledge(agentId);
  const [error, setError] = useState<string | null>(null);

  // Active libraries not already attached — the attach picker's options.
  const attachable = useMemo(() => {
    const chosen = new Set(bindings.map((b) => b.libraryId));
    return libraries.filter((l) => !chosen.has(l.id));
  }, [libraries, bindings]);

  async function handleAttach(libraryId: string) {
    setError(null);
    try {
      await attach.mutateAsync({ libraryId });
    } catch (err) {
      setError(messageFrom(err, 'Failed to attach library.'));
    }
  }

  async function handleDetach(bindingId: string) {
    setError(null);
    try {
      await detach.mutateAsync(bindingId);
    } catch (err) {
      setError(messageFrom(err, 'Failed to detach library.'));
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <EntityIcon entity="knowledge" size="sm" />
        <Label className="text-sm font-semibold">Knowledge</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Reference libraries from Settings → Knowledge. Changes apply immediately.
      </p>

      {bindings.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {bindings.map((b) => (
            <li
              key={b.id}
              className="inline-flex items-center gap-1 rounded-full bg-muted py-1 pl-2.5 pr-1 text-xs font-medium text-foreground"
            >
              <span className="max-w-[150px] truncate" title={b.librarySlug}>
                {b.libraryName}
              </span>
              <button
                type="button"
                onClick={() => handleDetach(b.id)}
                aria-label={`Remove ${b.libraryName}`}
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <X size={11} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {attachable.length > 0 ? (
        <Select value="" onValueChange={(v) => v && handleAttach(v)}>
          <SelectTrigger data-testid="agent-knowledge-attach" className="mt-1">
            <SelectValue placeholder="Attach a library…" />
          </SelectTrigger>
          <SelectContent>
            {attachable.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : bindings.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No libraries to attach. Create one under Settings → Knowledge.
        </p>
      ) : null}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
