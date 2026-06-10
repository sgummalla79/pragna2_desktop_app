import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AskUserField } from '@/domain/types/episode.types';

/**
 * Polymorphic renderer for ONE field of an `ask_user` schema. The LLM picks
 * `field.type` per turn; this component picks the matching input. Eight types
 * render natively; `file` is unsupported in the desktop app (no attachment
 * upload yet — see docs/TODO.md TD-012) and renders a disabled hint. An unknown
 * type degrades to a text input so a mistyped schema never blanks the form.
 */
export interface FormFieldProps {
  field: AskUserField;
  value: unknown;
  onChange: (next: unknown) => void;
  /** Inline error under the field (from `validateField`); `null` hides it. */
  error?: string | null;
  disabled?: boolean;
}

export function FormField({ field, value, onChange, error, disabled }: FormFieldProps) {
  const id = `hitl-field-${field.name}`;
  const requiredMark = field.required ? (
    <span className="ml-0.5 text-destructive">*</span>
  ) : null;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Checkbox renders its label inline (below); others get a label above. */}
      {field.type !== 'checkbox' && (
        <Label htmlFor={id} className="text-[13px] font-medium">
          {field.label}
          {requiredMark}
        </Label>
      )}

      {renderInput({ field, value, onChange, disabled, id })}

      {field.helper_text && !error && (
        <p className="text-[12px] text-muted-foreground">{field.helper_text}</p>
      )}
      {error && (
        <p className="text-[12px] text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface RenderInputProps {
  field: AskUserField;
  value: unknown;
  onChange: (next: unknown) => void;
  disabled?: boolean;
  id: string;
}

function renderInput({ field, value, onChange, disabled, id }: RenderInputProps) {
  const common = { id, disabled };

  switch (field.type) {
    case 'text':
      return (
        <Input
          {...common}
          type="text"
          value={String(value ?? '')}
          placeholder={field.placeholder}
          maxLength={field.max}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'textarea':
      return (
        <Textarea
          {...common}
          value={String(value ?? '')}
          placeholder={field.placeholder}
          maxLength={field.max}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'number':
      return (
        <Input
          {...common}
          type="number"
          value={value === undefined || value === null ? '' : String(value)}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'select': {
      const str = value == null ? '' : String(value);
      return (
        <Select value={str || undefined} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger id={id}>
            <SelectValue placeholder={field.placeholder ?? '— select one —'} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    case 'multiselect': {
      // No multi-select primitive in the kit — a stacked checkbox list.
      const selected = new Set(
        Array.isArray(value) ? (value as unknown[]).map(String) : [],
      );
      return (
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-background p-2">
          {(field.options ?? []).map((opt) => {
            const checked = selected.has(opt);
            return (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-2 text-[13px]"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(opt);
                    else next.delete(opt);
                    onChange(Array.from(next));
                  }}
                />
                {opt}
              </label>
            );
          })}
        </div>
      );
    }

    case 'checkbox':
      return (
        <label className="flex cursor-pointer items-center gap-2 text-[13px]">
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>
            {field.label}
            {field.required ? <span className="ml-0.5 text-destructive">*</span> : null}
          </span>
        </label>
      );

    case 'date':
      return (
        <Input
          {...common}
          type="date"
          value={typeof value === 'string' ? value : ''}
          min={field.min !== undefined ? String(field.min) : undefined}
          max={field.max !== undefined ? String(field.max) : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'daterange': {
      const range =
        typeof value === 'object' && value !== null
          ? (value as { start?: string; end?: string })
          : { start: '', end: '' };
      const start = range.start ?? '';
      const end = range.end ?? '';
      return (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            disabled={disabled}
            type="date"
            value={start}
            onChange={(e) => onChange({ start: e.target.value, end })}
            aria-label={`${field.label} (start)`}
          />
          <span className="text-[12px] text-muted-foreground">to</span>
          <Input
            disabled={disabled}
            type="date"
            value={end}
            min={start || undefined}
            onChange={(e) => onChange({ start, end: e.target.value })}
            aria-label={`${field.label} (end)`}
          />
        </div>
      );
    }

    case 'file':
      // Desktop has no attachment upload yet (TD-012). Surface a hint rather
      // than a broken picker; a required file field will block submit, which is
      // the correct (if blunt) signal until uploads land.
      return (
        <p className="text-[12px] text-muted-foreground">
          File upload isn't supported in the desktop app yet.
        </p>
      );

    default:
      // Unknown future type → render as text so the form still works.
      return (
        <Input
          {...common}
          type="text"
          value={String(value ?? '')}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
