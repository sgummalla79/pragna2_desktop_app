/**
 * "System agent templates" section of the Agents settings page.
 *
 * Lists the BE-owned system agent templates (e.g. the Nexus Kit Help & Setup
 * Assistant) and lets the user **activate** one — copying it into their own
 * agents. Activation is idempotent on the server; once activated, the template
 * is no longer `activatable` (it shows an "Activated" badge) and the new agent
 * appears in the agents list above (and becomes selectable in chat via the
 * existing agent picker).
 *
 * Data-driven: every template comes from `GET /api/agents/templates`. No
 * template key/name is hard-coded here, so new system templates surface
 * automatically (Open/Closed).
 */

import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import {
  useActivateAgentTemplate,
  useAgentTemplates,
} from '@/presentation/hooks/agents/useAgentTemplates';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ERRORS } from '@/constants/errors';
import { detailOr } from '@/lib/httpError';
import type { ActivatedAgentTemplate } from '@/domain/types/agentTemplate.types';

/** Surfaces activation feedback as a success toast. */
function announceActivation(result: ActivatedAgentTemplate): void {
  const name = result.agent.displayName;
  toast.success(
    result.created ? `${name} activated.` : `${name} is already activated.`,
  );
}

/** Read-only catalog of system agent templates with a one-click Activate. */
export function AgentTemplatesSection() {
  const { data: templates = [], isLoading, isError } = useAgentTemplates();
  const activate = useActivateAgentTemplate();

  async function onActivate(key: string) {
    try {
      const result = await activate.mutateAsync(key);
      announceActivation(result);
    } catch (err) {
      toast.error(detailOr(err, ERRORS.AGT_009.message));
    }
  }

  // Loading / error / empty are all quiet here — this is a supplemental section
  // below the user's own agents, so it never blocks the page.
  if (isLoading) {
    return (
      <p className="mt-8 text-sm text-muted-foreground" aria-live="polite">
        Loading templates…
      </p>
    );
  }
  if (isError) {
    return (
      <p role="alert" className="mt-8 text-sm text-destructive">
        {ERRORS.AGT_008.message}
      </p>
    );
  }
  if (templates.length === 0) return null;

  return (
    <section className="mt-10" aria-labelledby="agent-templates-heading">
      <div className="mb-3">
        <h2
          id="agent-templates-heading"
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <Sparkles size={18} aria-hidden="true" />
          System agent templates
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ready-made assistants you can activate. Once activated, an agent is
          added above and you can switch to it in any chat.
        </p>
      </div>

      <ul className="list-none space-y-3" role="list">
        {templates.map((t) => {
          const isActivating = activate.isPending && activate.variables === t.key;
          return (
            <li key={t.key}>
              <Card>
                <CardContent className="flex items-center py-4">
                  <Sparkles
                    size={18}
                    className="mr-3 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <p className="truncate font-medium">{t.displayName}</p>
                      {!t.activatable && (
                        <Badge variant="secondary">Activated</Badge>
                      )}
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {t.apiName}
                    </p>
                    {t.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {t.description}
                      </p>
                    )}
                  </div>

                  <div className="ml-2 shrink-0">
                    {t.activatable ? (
                      <Button
                        size="sm"
                        onClick={() => onActivate(t.key)}
                        disabled={isActivating}
                        aria-label={`Activate ${t.displayName}`}
                      >
                        {isActivating ? 'Activating…' : 'Activate'}
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
