import { useState, type ReactNode } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  GitBranch,
  Pencil,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/** A model the user can regenerate against. */
export interface ModelOption {
  id: string;
  displayName: string;
}

interface AssistantActions {
  role: 'assistant';
  /** Assistant text, for the copy action. */
  content: string;
  onRegenerate: () => void;
  /** When set + `availableModels` non-empty, a "regenerate with…" dropdown shows. */
  onRegenerateWithModel?: (modelId: string) => void;
  availableModels?: ModelOption[];
}

interface UserActions {
  role: 'user';
  onEdit: () => void;
  onBranch: () => void;
  /** Gate the Branch button (chat preference); default shown. */
  showBranch?: boolean;
}

type Props = (AssistantActions | UserActions) & {
  /** Force the row visible (e.g. while editing); otherwise reveals on hover. */
  alwaysVisible?: boolean;
};

/**
 * Per-message action row. Assistant turns: Regenerate (+ optional
 * regenerate-with-model dropdown) and Copy. User turns: Edit and (optionally)
 * Branch. Hidden until the parent `.group` is hovered/focused unless
 * `alwaysVisible`. Purely presentational — all behavior is in the handlers.
 */
export function MessageActions(props: Props) {
  const { alwaysVisible = false } = props;
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const copy = async () => {
    if (props.role !== 'assistant') return;
    try {
      await navigator.clipboard.writeText(props.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — silently ignore (non-critical).
    }
  };

  return (
    <div
      className={cn(
        'relative flex items-center gap-1 transition-opacity duration-150',
        alwaysVisible
          ? 'opacity-100'
          : 'opacity-0 focus-within:opacity-100 group-hover:opacity-100',
      )}
    >
      {props.role === 'assistant' ? (
        <>
          <ActionButton label="Regenerate" onClick={props.onRegenerate}>
            <RefreshCw size={13} aria-hidden />
          </ActionButton>

          {props.onRegenerateWithModel &&
            props.availableModels &&
            props.availableModels.length > 0 && (
              <div className="relative">
                <ActionButton
                  label="Regenerate with…"
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  <ChevronDown size={13} aria-hidden />
                </ActionButton>
                {menuOpen && (
                  <ul
                    role="listbox"
                    aria-label="Regenerate with model"
                    className="absolute left-0 top-full z-30 mt-1 max-h-64 w-56 list-none overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg"
                  >
                    <li className="px-2 py-1 text-[11px] text-muted-foreground">
                      Regenerate with…
                    </li>
                    {props.availableModels.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={false}
                          onClick={() => {
                            setMenuOpen(false);
                            props.onRegenerateWithModel?.(m.id);
                          }}
                          className="w-full truncate rounded px-2 py-1 text-left text-[13px] text-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          {m.displayName}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

          <ActionButton label={copied ? 'Copied' : 'Copy'} onClick={copy}>
            {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
          </ActionButton>
        </>
      ) : (
        <>
          <ActionButton label="Edit" onClick={props.onEdit}>
            <Pencil size={13} aria-hidden />
          </ActionButton>
          {(props.showBranch ?? true) && (
            <ActionButton label="Branch" onClick={props.onBranch}>
              <GitBranch size={13} aria-hidden />
            </ActionButton>
          )}
        </>
      )}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md',
        'text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
      )}
    >
      {children}
    </button>
  );
}
