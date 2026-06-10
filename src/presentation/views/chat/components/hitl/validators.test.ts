import { describe, it, expect } from 'vitest';
import {
  initialFormValues,
  validateField,
  validateForm,
  isFormValid,
  coerceForSubmit,
} from './validators';
import type { AskUserField, AskUserSchema } from '@/domain/types/episode.types';

const field = (f: Partial<AskUserField> & { name: string; type: AskUserField['type'] }): AskUserField =>
  ({ label: f.name, ...f }) as AskUserField;

const schema = (fields: AskUserField[]): AskUserSchema => ({ fields }) as AskUserSchema;

describe('initialFormValues', () => {
  it('seeds type-appropriate empties + honours default_value', () => {
    const s = schema([
      field({ name: 'a', type: 'text' }),
      field({ name: 'b', type: 'multiselect' }),
      field({ name: 'c', type: 'checkbox' }),
      field({ name: 'd', type: 'daterange' }),
      field({ name: 'e', type: 'number' }),
      field({ name: 'f', type: 'text', default_value: 'seed' }),
    ]);
    expect(initialFormValues(s)).toEqual({
      a: '',
      b: [],
      c: false,
      d: { start: '', end: '' },
      e: '',
      f: 'seed',
    });
  });
});

describe('validateField', () => {
  it('flags a required empty field, passes a non-required empty', () => {
    expect(validateField(field({ name: 'n', type: 'text', required: true }), '')).toMatch(/required/);
    expect(validateField(field({ name: 'n', type: 'text' }), '')).toBeNull();
  });

  it('enforces text min/max + pattern', () => {
    expect(validateField(field({ name: 'n', type: 'text', min: 3 }), 'ab')).toMatch(/at least 3/);
    expect(validateField(field({ name: 'n', type: 'text', max: 2 }), 'abc')).toMatch(/at most 2/);
    expect(validateField(field({ name: 'n', type: 'text', pattern: '^[a-z]+$' }), 'AB')).toMatch(/format/);
    expect(validateField(field({ name: 'n', type: 'text', pattern: '^[a-z]+$' }), 'ab')).toBeNull();
  });

  it('validates numbers + min/max', () => {
    expect(validateField(field({ name: 'n', type: 'number' }), 'x')).toMatch(/must be a number/);
    expect(validateField(field({ name: 'n', type: 'number', min: 5 }), '3')).toMatch(/at least 5/);
    expect(validateField(field({ name: 'n', type: 'number', max: 5 }), '9')).toMatch(/at most 5/);
    expect(validateField(field({ name: 'n', type: 'number' }), '4')).toBeNull();
  });

  it('checks select / multiselect membership', () => {
    expect(validateField(field({ name: 'n', type: 'select', options: ['a', 'b'] }), 'c')).toMatch(/listed options/);
    expect(validateField(field({ name: 'n', type: 'multiselect', options: ['a', 'b'] }), ['a', 'z'])).toMatch(/not in options/);
    expect(validateField(field({ name: 'n', type: 'multiselect', options: ['a', 'b'] }), ['a'])).toBeNull();
  });

  it('validates date + daterange (ISO + order)', () => {
    expect(validateField(field({ name: 'n', type: 'date' }), '2026/01/01')).toMatch(/valid date/);
    expect(validateField(field({ name: 'n', type: 'date' }), '2026-01-01')).toBeNull();
    expect(
      validateField(field({ name: 'n', type: 'daterange' }), { start: '2026-01-05', end: '2026-01-01' }),
    ).toMatch(/on or after start/);
    expect(
      validateField(field({ name: 'n', type: 'daterange' }), { start: '2026-01-01', end: '2026-01-05' }),
    ).toBeNull();
  });

  it('treats a half-filled daterange as missing (required)', () => {
    expect(
      validateField(field({ name: 'n', type: 'daterange', required: true }), { start: '2026-01-01', end: '' }),
    ).toMatch(/required/);
  });
});

describe('validateForm + isFormValid', () => {
  it('returns a per-field map and an overall validity', () => {
    const s = schema([field({ name: 'a', type: 'text', required: true }), field({ name: 'b', type: 'text' })]);
    const errors = validateForm(s, { a: '', b: 'ok' });
    expect(errors.a).toMatch(/required/);
    expect(errors.b).toBeNull();
    expect(isFormValid(errors)).toBe(false);
    expect(isFormValid(validateForm(s, { a: 'x', b: 'ok' }))).toBe(true);
  });
});

describe('coerceForSubmit', () => {
  it('coerces number fields, passes everything else through', () => {
    const s = schema([field({ name: 'n', type: 'number' }), field({ name: 't', type: 'text' })]);
    expect(coerceForSubmit(s, { n: '42', t: 'hi' })).toEqual({ n: 42, t: 'hi' });
  });

  it('leaves an empty number as-is (not coerced to 0)', () => {
    const s = schema([field({ name: 'n', type: 'number' })]);
    expect(coerceForSubmit(s, { n: '' })).toEqual({ n: '' });
  });
});
