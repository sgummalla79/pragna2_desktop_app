/**
 * Client-side validators for the HITL ask_user form.
 *
 * Mirrors the backend's `resume_episode` form guard but produces friendly
 * per-field messages so the user is kept out of round-trip-and-422 territory.
 * The server remains the source of truth. Field/schema types come from the
 * domain layer ({@link @/domain/types/episode.types}); this module only adds the
 * value/validation helpers.
 */

import type { AskUserField, AskUserSchema } from '@/domain/types/episode.types';

/** ISO-8601 `YYYY-MM-DD` shape used by the backend validator. */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** `field.name → string | null`. `null` means "valid". */
export type FieldErrors = Record<string, string | null>;

/**
 * Build the initial form values from a schema. `default_value` is honoured where
 * present; otherwise a type-appropriate empty value keeps React inputs
 * controlled from the first render.
 */
export function initialFormValues(schema: AskUserSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of schema.fields) {
    if (field.default_value !== undefined) {
      out[field.name] = field.default_value;
      continue;
    }
    switch (field.type) {
      case 'multiselect':
        out[field.name] = [];
        break;
      case 'checkbox':
        out[field.name] = false;
        break;
      case 'number':
        out[field.name] = '';
        break;
      case 'daterange':
        out[field.name] = { start: '', end: '' };
        break;
      case 'file':
      case 'date':
      // text / textarea / select fall through to the empty-string default.
      default:
        out[field.name] = '';
    }
  }
  return out;
}

/**
 * Validate one field's value against its declared rules. Returns `null` on pass,
 * or a human-readable error string.
 */
export function validateField(field: AskUserField, value: unknown): string | null {
  // daterange counts as "missing" when EITHER half is empty.
  const isDateRangeIncomplete =
    field.type === 'daterange' &&
    (typeof value !== 'object' ||
      value === null ||
      !(value as { start?: string }).start ||
      !(value as { end?: string }).end);

  const isMissing =
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0) ||
    isDateRangeIncomplete;

  if (field.required && isMissing) {
    return `${field.label} is required.`;
  }
  if (isMissing) return null; // non-required + empty → pass.

  switch (field.type) {
    case 'text':
    case 'textarea': {
      const str = String(value);
      if (field.min !== undefined && str.length < field.min) {
        return `${field.label} must be at least ${field.min} characters.`;
      }
      if (field.max !== undefined && str.length > field.max) {
        return `${field.label} must be at most ${field.max} characters.`;
      }
      if (field.type === 'text' && field.pattern) {
        try {
          if (!new RegExp(field.pattern).test(str)) {
            return `${field.label} doesn't match the required format.`;
          }
        } catch {
          // An invalid pattern from the LLM is a server-side problem; don't block.
        }
      }
      return null;
    }
    case 'number': {
      const num = Number(value);
      if (Number.isNaN(num)) return `${field.label} must be a number.`;
      if (field.min !== undefined && num < field.min) {
        return `${field.label} must be at least ${field.min}.`;
      }
      if (field.max !== undefined && num > field.max) {
        return `${field.label} must be at most ${field.max}.`;
      }
      return null;
    }
    case 'select': {
      const options = field.options ?? [];
      if (options.length > 0 && !options.includes(String(value))) {
        return `${field.label}: pick one of the listed options.`;
      }
      return null;
    }
    case 'multiselect': {
      if (!Array.isArray(value)) return `${field.label}: invalid selection.`;
      const options = field.options ?? [];
      if (options.length > 0) {
        const bad = value.filter((v) => !options.includes(String(v)));
        if (bad.length > 0) return `${field.label}: ${bad.join(', ')} not in options.`;
      }
      return null;
    }
    case 'checkbox':
      // `required` already checked above (treats false as missing).
      return null;
    case 'file': {
      // Value is the attachment_id once uploaded. Desktop has no attachment
      // upload yet (see pragna2-tracker TD-012); the field renders disabled, so
      // this guard just keeps the type honest.
      if (typeof value !== 'string') return `${field.label}: file not yet uploaded.`;
      return null;
    }
    case 'date': {
      if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) {
        return `${field.label}: pick a valid date.`;
      }
      return null;
    }
    case 'daterange': {
      const range = value as { start: string; end: string };
      if (!ISO_DATE_PATTERN.test(range.start) || !ISO_DATE_PATTERN.test(range.end)) {
        return `${field.label}: pick valid start and end dates.`;
      }
      if (range.end < range.start) {
        return `${field.label}: end date must be on or after start.`;
      }
      return null;
    }
    default:
      return null;
  }
}

/** Validate every field in the schema. Returns the field-error map. */
export function validateForm(
  schema: AskUserSchema,
  values: Record<string, unknown>,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of schema.fields) {
    errors[field.name] = validateField(field, values[field.name]);
  }
  return errors;
}

/** True iff every entry in {@link validateForm}'s output is `null`. */
export function isFormValid(errors: FieldErrors): boolean {
  return Object.values(errors).every((e) => e === null);
}

/**
 * Convert raw inputs to the wire shape the backend expects. Numbers come out of
 * the UI as strings; coerce them. Everything else passes through.
 */
export function coerceForSubmit(
  schema: AskUserSchema,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of schema.fields) {
    const raw = values[field.name];
    if (field.type === 'number' && raw !== '' && raw !== undefined && raw !== null) {
      const num = Number(raw);
      out[field.name] = Number.isNaN(num) ? raw : num;
    } else {
      out[field.name] = raw;
    }
  }
  return out;
}
