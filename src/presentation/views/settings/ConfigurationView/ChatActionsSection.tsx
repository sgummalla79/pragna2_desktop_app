/**
 * Chat actions section of the Configuration page.
 *
 * Per-browser toggles that hide advanced affordances on the chat message hover
 * row. Persisted in localStorage (not synced) — see {@link useChatPreferences}.
 * Each toggle defaults to ON; hiding an action only removes its affordance, the
 * underlying backend primitive stays available.
 *
 * Rendered as a collapsible accordion — collapsed by default to keep the page
 * compact; expand to reveal the toggles.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, GitBranch, MessageSquare, RefreshCw } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { useChatPreferences } from '@/presentation/hooks/preferences/useChatPreferences';

/** Collapsible card of per-browser chat-action visibility toggles. */
export function ChatActionsSection() {
  const { prefs, setPref } = useChatPreferences();
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="rounded-lg border border-border" data-testid="chat-actions-card">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left md:px-6"
        aria-expanded={expanded}
        aria-controls="chat-actions-body"
        data-testid="chat-actions-toggle"
      >
        {expanded ? (
          <ChevronDown size={16} aria-hidden="true" className="shrink-0" />
        ) : (
          <ChevronRight size={16} aria-hidden="true" className="shrink-0" />
        )}
        <MessageSquare
          size={15}
          aria-hidden="true"
          className="shrink-0 text-muted-foreground"
        />
        <span className="min-w-0 flex-1 text-sm font-semibold">Chat actions</span>
      </button>

      {expanded && (
        <div
          id="chat-actions-body"
          className="flex flex-col gap-4 border-t border-border p-4 md:p-6"
        >
          <p className="text-xs text-muted-foreground">
            Hide advanced affordances on the chat message hover row. Saved to
            this device only.
          </p>

          <div className="flex flex-col gap-3">
            <ToggleRow
              icon={<RefreshCw size={14} aria-hidden="true" />}
              label="Regenerate with a different model"
              description="Adds a dropdown chevron next to Regenerate so you can re-run a turn against a different chat-eligible model without changing the conversation's preference."
              checked={prefs.regenWithModelEnabled}
              onChange={(v) => setPref('regenWithModelEnabled', v)}
            />
            <ToggleRow
              icon={<GitBranch size={14} aria-hidden="true" />}
              label="Branch from a user message"
              description="Adds a Branch action on user-turn hover. Forks the conversation at that turn into a new conversation, leaving the original untouched."
              checked={prefs.branchEnabled}
              onChange={(v) => setPref('branchEnabled', v)}
            />
          </div>
        </div>
      )}
    </section>
  );
}

interface ToggleRowProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

/** Minimal accessible checkbox row (native input — keyboard-friendly). */
function ToggleRow({ icon, label, description, checked, onChange }: ToggleRowProps) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 cursor-pointer rounded border-border accent-primary"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <Label className="cursor-pointer font-medium">{label}</Label>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </label>
  );
}
