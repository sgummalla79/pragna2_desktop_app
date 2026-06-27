/**
 * Standalone agents management page (`/settings/agents`).
 *
 * Lists the user's agents and lets them create / edit / archive and pick
 * which one is the **default** chat agent (the `is_default` row, loaded on
 * sign-in). The default agent can't be archived or deactivated here — chat
 * depends on it; promote another first. When no default exists yet, an
 * onboarding affordance offers a prefilled "create default agent" flow seeded
 * from the BE's default-template.
 */

import { useState } from 'react';
import { Bot, Eye, Plus, Pencil, RotateCw, Trash2, Star } from 'lucide-react';
import { toast } from 'sonner';

import {
  useAgents,
  useArchiveAgent,
  useDefaultAgentTemplate,
  useSetDefaultAgent,
} from '@/presentation/hooks/agents/useAgents';
import { useAgentTemplates } from '@/presentation/hooks/agents/useAgentTemplates';
import { useSyncSystemAgent } from '@/presentation/hooks/agents/useSyncSystemAgent';
import { EntityIcon } from '@/presentation/components/icons/EntityIcon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { ERRORS } from '@/constants/errors';
import { detailOr } from '@/lib/httpError';
import { AgentFormModal } from './AgentFormModal';
import { AgentTemplatesSection } from './AgentTemplatesSection';
import {
  findTemplateForAgent,
  isSystemAgent,
  systemAgentNeedsUpdate,
} from './syncSystemAgent';
import type { Agent } from '@/domain/types/agent.types';

/** Agents settings page — list, onboarding, and create/edit entry points. */
export default function AgentsView() {
  const { data: agents = [], isLoading, isError } = useAgents();
  const setDefault = useSetDefaultAgent();
  const archiveAgent = useArchiveAgent();
  const syncSystemAgent = useSyncSystemAgent();
  // System-agent instances are frozen at activation; the templates list carries
  // the current values used to detect staleness and drive "Update to latest".
  const { data: templates = [] } = useAgentTemplates();

  const hasDefault = agents.some((a) => a.isDefault);
  // Prefill the create-default form from the BE starter template. Only
  // fetched when the user has no default yet (the onboarding path).
  const { data: template } = useDefaultAgentTemplate(!hasDefault);

  const [createOpen, setCreateOpen] = useState(false);
  const [createAsDefault, setCreateAsDefault] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [viewing, setViewing] = useState<Agent | null>(null);

  function openCreate(asDefault: boolean) {
    setCreateAsDefault(asDefault);
    setCreateOpen(true);
  }

  /** Re-syncs a system agent to the latest version of its source template. */
  async function onUpdateToLatest(agentId: string, templateKey: string) {
    try {
      const updated = await syncSystemAgent.mutateAsync({ agentId, templateKey });
      toast.success(`${updated.displayName} updated to the latest version.`);
    } catch (err) {
      toast.error(detailOr(err, ERRORS.AGT_010.message));
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2.5 text-2xl font-bold">
            <EntityIcon entity="agents" size="lg" />
            Agents
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your chat agents. One is your default — it loads when you start a chat.
          </p>
        </div>
        <Button size="sm" onClick={() => openCreate(false)}>
          <Plus size={16} aria-hidden="true" />
          New agent
        </Button>
      </div>

      {/* No default yet → highlight the onboarding action (chat is gated). */}
      {!isLoading && !hasDefault && (
        <div
          role="alert"
          className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-5 py-3.5 text-sm text-destructive"
        >
          <span>
            You don't have a default agent yet, so chat is disabled. Create one
            to start chatting.
          </span>
          <Button size="sm" onClick={() => openCreate(true)}>
            Create default agent
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Loading agents…
        </p>
      ) : isError ? (
        <p role="alert" className="text-sm text-destructive">
          {ERRORS.AGT_001.message}
        </p>
      ) : agents.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Bot size={40} className="mx-auto mb-3 opacity-30" aria-hidden="true" />
          <p>No agents yet. Create your default agent to start chatting.</p>
        </div>
      ) : (
        <ul className="list-none space-y-3" role="list">
          {agents.map((a) => {
            const systemAgent = isSystemAgent(a);
            // For a system agent, find its source template and whether the
            // frozen instance is stale relative to it (drives "Update to latest").
            const sourceTemplate = systemAgent
              ? findTemplateForAgent(a, templates)
              : undefined;
            const canUpdate =
              sourceTemplate !== undefined &&
              systemAgentNeedsUpdate(a, sourceTemplate);
            const isUpdating =
              syncSystemAgent.isPending &&
              syncSystemAgent.variables?.agentId === a.id;
            return (
            <li key={a.id}>
              <Card>
                <CardContent className="flex items-center py-4">
                  <EntityIcon entity="agents" size="sm" className="mr-3" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <p className="truncate font-medium">{a.displayName}</p>
                      {a.isDefault && (
                        <Badge variant="default" className="gap-1">
                          <Star size={11} aria-hidden="true" />
                          Default
                        </Badge>
                      )}
                      {systemAgent && (
                        <Badge variant="outline">System</Badge>
                      )}
                      {a.status !== 'active' && (
                        <Badge variant="secondary">{a.status}</Badge>
                      )}
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {a.apiName}
                    </p>
                    {a.description && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {a.description}
                      </p>
                    )}
                  </div>

                  <div className="ml-2 flex items-center gap-1">
                    {!a.isDefault && !systemAgent && a.status === 'active' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDefault.mutate(a.id)}
                        disabled={setDefault.isPending}
                        aria-label={`Set ${a.displayName} as default`}
                      >
                        <Star size={15} aria-hidden="true" />
                        Set default
                      </Button>
                    )}
                    {/* System agents are frozen at activation; offer a re-sync
                        to the latest template only when it has actually moved on. */}
                    {canUpdate && sourceTemplate && (
                      <ConfirmButton
                        size="sm"
                        variant="ghost"
                        disabled={isUpdating}
                        confirmTitle="Update to the latest version?"
                        confirmDescription="This replaces the agent's name, description, instructions, and tools with the latest published version. Any local differences will be overwritten."
                        confirmLabel="Update"
                        onConfirm={() => onUpdateToLatest(a.id, sourceTemplate.key)}
                        aria-label={`Update ${a.displayName} to the latest version`}
                      >
                        <RotateCw size={15} aria-hidden="true" />
                        {isUpdating ? 'Updating…' : 'Update to latest'}
                      </ConfirmButton>
                    )}
                    {systemAgent ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewing(a)}
                        aria-label={`View ${a.displayName}`}
                        title="View agent"
                      >
                        <Eye size={16} aria-hidden="true" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditing(a)}
                        aria-label={`Edit ${a.displayName}`}
                        title="Edit agent"
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </Button>
                    )}
                    {/* The default agent and system agents can't be archived. */}
                    {!a.isDefault && !systemAgent && (
                      <ConfirmButton
                        size="icon"
                        variant="ghost"
                        confirmTitle="Archive this agent?"
                        confirmDescription="It will be hidden and its name freed for reuse. This can't be undone from here."
                        confirmLabel="Archive"
                        onConfirm={() => archiveAgent.mutateAsync(a.id)}
                        aria-label={`Archive ${a.displayName}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </ConfirmButton>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
            );
          })}
        </ul>
      )}

      {/* BE-owned system templates the user can activate into their agents. */}
      <AgentTemplatesSection />

      {createOpen && (
        <AgentFormModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          prefill={createAsDefault ? (template ?? null) : null}
          forceDefault={createAsDefault}
        />
      )}
      {editing && (
        <AgentFormModal
          open={Boolean(editing)}
          onClose={() => setEditing(null)}
          editing={editing}
        />
      )}
      {viewing && (
        <AgentFormModal
          open={Boolean(viewing)}
          onClose={() => setViewing(null)}
          editing={viewing}
          readOnly
        />
      )}
    </div>
  );
}
