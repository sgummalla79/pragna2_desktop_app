import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AskUserSchema } from '@/domain/types/episode.types';
import { HITLFormCard } from './HITLFormCard';

/**
 * HITLFormCard renders the dynamic `ask_user` form, validates per touched
 * field, and on submit hands the parent the coerced values + free text. These
 * tests use text/number/checkbox/textarea fields (no Radix `select`, which can
 * loop in jsdom — that field type is exercised by FormField's own coverage).
 */

const submitLabel = 'Send';

describe('HITLFormCard', () => {
  it('renders the prompt header and a field per schema entry', () => {
    const schema: AskUserSchema = {
      fields: [
        { name: 'city', label: 'City', type: 'text', required: true },
        { name: 'count', label: 'Count', type: 'number' },
      ],
      submit_label: submitLabel,
    };
    render(<HITLFormCard schema={schema} onSubmit={vi.fn()} />);

    expect(screen.getByText('The agent needs your input')).toBeInTheDocument();
    expect(screen.getByLabelText(/City/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Count/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: submitLabel })).toBeInTheDocument();
  });

  it('falls back to "Submit" when no submit_label is provided', () => {
    const schema: AskUserSchema = {
      fields: [{ name: 'city', label: 'City', type: 'text' }],
    };
    render(<HITLFormCard schema={schema} onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
  });

  it('disables submit and surfaces a required error after a failed submit attempt', async () => {
    const onSubmit = vi.fn();
    const schema: AskUserSchema = {
      fields: [{ name: 'city', label: 'City', type: 'text', required: true }],
    };
    render(<HITLFormCard schema={schema} onSubmit={onSubmit} />);

    const form = screen.getByText('The agent needs your input').closest('form')!;
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();

    // The button is disabled; submit the form directly to exercise handleSubmit's
    // touch-all path. The required guard blocks onSubmit and surfaces the error.
    fireEvent.submit(form);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('City is required.')).toBeInTheDocument();
  });

  it('submits the form map and empty text when allow_text_input is unset', async () => {
    const onSubmit = vi.fn();
    const schema: AskUserSchema = {
      fields: [{ name: 'city', label: 'City', type: 'text', required: true }],
      submit_label: submitLabel,
    };
    render(<HITLFormCard schema={schema} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/City/), 'Paris');
    await userEvent.click(screen.getByRole('button', { name: submitLabel }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ city: 'Paris' }, '');
  });

  it('coerces a numeric field to a number on submit', async () => {
    const onSubmit = vi.fn();
    const schema: AskUserSchema = {
      fields: [{ name: 'count', label: 'Count', type: 'number', required: true }],
      submit_label: submitLabel,
    };
    render(<HITLFormCard schema={schema} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/Count/), '42');
    await userEvent.click(screen.getByRole('button', { name: submitLabel }));

    expect(onSubmit).toHaveBeenCalledWith({ count: 42 }, '');
  });

  it('passes trimmed free text when allow_text_input is true', async () => {
    const onSubmit = vi.fn();
    const schema: AskUserSchema = {
      fields: [{ name: 'agree', label: 'I agree', type: 'checkbox', required: true }],
      allow_text_input: true,
      submit_label: submitLabel,
    };
    render(<HITLFormCard schema={schema} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.type(screen.getByLabelText('Additional message'), '  hello  ');
    await userEvent.click(screen.getByRole('button', { name: submitLabel }));

    expect(onSubmit).toHaveBeenCalledWith({ agree: true }, 'hello');
  });

  it('renders the resume error banner and disables inputs while submitting', () => {
    const schema: AskUserSchema = {
      fields: [{ name: 'city', label: 'City', type: 'text' }],
      submit_label: submitLabel,
    };
    render(
      <HITLFormCard
        schema={schema}
        onSubmit={vi.fn()}
        submitting
        errorMessage="Resume failed"
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Resume failed');
    expect(screen.getByLabelText(/City/)).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
  });
});
