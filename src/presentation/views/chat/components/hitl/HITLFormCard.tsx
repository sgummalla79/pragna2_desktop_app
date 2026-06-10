import { useMemo, useState, type FormEvent } from 'react';
import { MessageSquareWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { AskUserSchema } from '@/domain/types/episode.types';
import { FormField } from './FormField';
import {
  coerceForSubmit,
  initialFormValues,
  isFormValid,
  validateField,
  validateForm,
  type FieldErrors,
} from './validators';

export interface HITLFormCardProps {
  /** The `ask_user` schema persisted on the open episode. Drives every field. */
  schema: AskUserSchema;
  /**
   * Submit the form. Receives the coerced `form` map and the free `text`
   * (empty unless `schema.allow_text_input`). The parent dispatches the resume.
   */
  onSubmit: (form: Record<string, unknown>, text: string) => void;
  /** True while the resume is in flight — inputs + submit are disabled. */
  submitting?: boolean;
  /** Error from the resume run, rendered as a banner. */
  errorMessage?: string | null;
}

/**
 * Inline form rendered when an `ask_user` interrupt has paused the conversation.
 *
 * Self-contained + fully controlled internally: it seeds its values from the
 * schema (`initialFormValues`), validates per-field as the user types (errors
 * show only after a field is touched), and on submit hands the coerced values +
 * optional free text to the parent. The parent remounts it per pause (keyed by
 * episode id), so a fresh interrupt resets the form.
 */
export function HITLFormCard({
  schema,
  onSubmit,
  submitting = false,
  errorMessage,
}: HITLFormCardProps) {
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    initialFormValues(schema),
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [text, setText] = useState('');

  const errors = useMemo<FieldErrors>(
    () => validateForm(schema, values),
    [schema, values],
  );
  const canSubmit = isFormValid(errors) && !submitting;
  const submitLabel = schema.submit_label?.trim() || 'Submit';

  const setFieldValue = (name: string, next: unknown) => {
    setValues((prev) => ({ ...prev, [name]: next }));
    setTouched((prev) => (prev[name] ? prev : { ...prev, [name]: true }));
  };

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    // Mark every field touched so any latent error becomes visible.
    setTouched(Object.fromEntries(schema.fields.map((f) => [f.name, true])));
    if (!canSubmit) return;
    onSubmit(
      coerceForSubmit(schema, values),
      schema.allow_text_input ? text.trim() : '',
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="my-2 rounded-lg border-2 border-primary/30 bg-accent/40 p-4 text-[13px]"
    >
      <div className="flex items-center gap-2">
        <MessageSquareWarning size={16} className="text-primary" aria-hidden />
        <span className="font-semibold text-foreground">
          The agent needs your input
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {schema.fields.map((field) => (
          <FormField
            key={field.name}
            field={field}
            value={values[field.name]}
            onChange={(next) => setFieldValue(field.name, next)}
            error={touched[field.name] ? validateField(field, values[field.name]) : null}
            disabled={submitting}
          />
        ))}

        {schema.allow_text_input && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hitl-freetext" className="text-[13px] font-medium">
              Additional message
            </Label>
            <Textarea
              id="hitl-freetext"
              rows={2}
              value={text}
              disabled={submitting}
              placeholder="Optional message…"
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        )}
      </div>

      {errorMessage && (
        <p className="mt-3 text-[12px] text-destructive" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="mt-4 flex items-center justify-end">
        <Button type="submit" disabled={!canSubmit}>
          {submitting ? 'Submitting…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
