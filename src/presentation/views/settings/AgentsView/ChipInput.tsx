/**
 * Lightweight tag/chip input used for free-form lists (tools, emit labels,
 * context slots).
 *
 * Press Enter or comma to commit the current draft; click ✕ on a chip to
 * remove it; Backspace on an empty input removes the last chip. Duplicates and
 * empty strings are silently rejected.
 *
 * When `suggestions` is supplied, an autocomplete dropdown of matching, not-yet-
 * selected entries appears as the user types (↑/↓ to move, Enter/Tab to accept,
 * Esc to dismiss); free-form entries are still allowed, and any chip whose value
 * isn't in `suggestions` is flagged (muted + a title) so unknown handles stand out.
 */

import { useMemo, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

/** Max autocomplete rows shown at once. */
const MAX_SUGGESTIONS = 8;

interface Props {
  id?: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Friendly accessible label e.g. "tool". Used in remove buttons. */
  label: string;
  /**
   * Optional autocomplete source (e.g. enabled tool `api_name`s). When set, a
   * suggestion dropdown is shown and chips outside this set are flagged. Omit
   * for plain free-form chip entry.
   */
  suggestions?: string[];
  /** When true, hides the text input and remove buttons (view-only). */
  disabled?: boolean;
}

/** A controlled chip/tag input with optional autocomplete. */
export function ChipInput({ id, values, onChange, placeholder, label, suggestions, disabled = false }: Props) {
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const known = useMemo(() => new Set(suggestions ?? []), [suggestions]);

  const filtered = useMemo(() => {
    if (!suggestions || suggestions.length === 0) return [];
    const q = draft.trim().toLowerCase();
    return suggestions
      .filter((s) => !values.includes(s) && (q === '' || s.toLowerCase().includes(q)))
      .slice(0, MAX_SUGGESTIONS);
  }, [suggestions, values, draft]);

  const dropdownOpen = open && filtered.length > 0;

  function commit(raw: string) {
    const next = raw.trim();
    if (!next || values.includes(next)) {
      setDraft('');
      return;
    }
    onChange([...values, next]);
    setDraft('');
    setHighlight(0);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (dropdownOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        commit(filtered[highlight] ?? draft);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
    }
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      // Quick-remove the last chip when the input is empty.
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className="relative flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5">
      {values.map((v) => {
        const unknown = suggestions !== undefined && !known.has(v);
        return (
          <Badge
            key={v}
            variant="secondary"
            className={cn('gap-1', !disabled && 'pr-1', unknown && 'border border-amber-500/50')}
            title={unknown ? `${v} isn't in your tools inventory` : undefined}
          >
            <span className="font-mono">{v}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                aria-label={`Remove ${label} ${v}`}
                className="rounded p-0.5 hover:bg-muted"
              >
                <X size={10} aria-hidden="true" />
              </button>
            )}
          </Badge>
        );
      })}
      {!disabled && (
        <Input
          id={id}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Delay so a suggestion mousedown can land before blur closes it.
            commit(draft);
            setOpen(false);
          }}
          placeholder={values.length === 0 ? placeholder : undefined}
          className="h-7 min-w-[120px] flex-1 border-0 bg-transparent px-1 py-0 shadow-none focus-visible:ring-0"
          role={suggestions ? 'combobox' : undefined}
          aria-expanded={suggestions ? dropdownOpen : undefined}
          aria-autocomplete={suggestions ? 'list' : undefined}
        />
      )}

      {dropdownOpen && (
        <ul
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 list-none overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg"
        >
          {filtered.map((s, idx) => (
            <li
              key={s}
              role="option"
              aria-selected={idx === highlight}
              // mousedown (not click) so it fires before the input's blur.
              onMouseDown={(e) => {
                e.preventDefault();
                commit(s);
              }}
              onMouseEnter={() => setHighlight(idx)}
              className={cn(
                'cursor-pointer rounded px-2 py-1 font-mono text-[12.5px]',
                idx === highlight ? 'bg-accent text-accent-foreground' : 'text-foreground',
              )}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
