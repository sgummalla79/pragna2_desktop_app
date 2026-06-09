/**
 * Lightweight tag/chip input used for an agent's free-form tool list.
 *
 * Press Enter or comma to commit the current draft; click ✕ on a chip to
 * remove it; Backspace on an empty input removes the last chip. Duplicates and
 * empty strings are silently rejected.
 */

import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Props {
  id?: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Friendly accessible label e.g. "tool". Used in remove buttons. */
  label: string;
}

/** A controlled chip/tag input. */
export function ChipInput({ id, values, onChange, placeholder, label }: Props) {
  const [draft, setDraft] = useState('');

  function commit(raw: string) {
    const next = raw.trim();
    if (!next || values.includes(next)) {
      setDraft('');
      return;
    }
    onChange([...values, next]);
    setDraft('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      // Quick-remove the last chip when the input is empty.
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5">
      {values.map((v) => (
        <Badge key={v} variant="secondary" className="gap-1 pr-1">
          <span className="font-mono">{v}</span>
          <button
            type="button"
            onClick={() => onChange(values.filter((x) => x !== v))}
            aria-label={`Remove ${label} ${v}`}
            className="rounded p-0.5 hover:bg-muted"
          >
            <X size={10} aria-hidden="true" />
          </button>
        </Badge>
      ))}
      <Input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => commit(draft)}
        placeholder={values.length === 0 ? placeholder : undefined}
        className="h-7 min-w-[120px] flex-1 border-0 bg-transparent px-1 py-0 shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
