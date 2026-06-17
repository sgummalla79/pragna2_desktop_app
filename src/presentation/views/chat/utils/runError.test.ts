import { describe, it, expect } from 'vitest';
import { classifyRunErrorEvent } from './runError';

const FALLBACK = 'The assistant run failed. Please try again.';

describe('classifyRunErrorEvent', () => {
  it('treats code "abort" as a silent abort', () => {
    const r = classifyRunErrorEvent({ code: 'abort', message: 'Request aborted' }, FALLBACK);
    expect(r.aborted).toBe(true);
  });

  it('treats an abort/cancel message as a silent abort even without the code', () => {
    expect(classifyRunErrorEvent({ message: 'Request aborted' }, FALLBACK).aborted).toBe(true);
    expect(classifyRunErrorEvent({ message: 'stream cancelled' }, FALLBACK).aborted).toBe(true);
  });

  it('classifies a genuine failure as not aborted and surfaces its message', () => {
    const r = classifyRunErrorEvent({ message: 'Something went wrong. Please try again.' }, FALLBACK);
    expect(r.aborted).toBe(false);
    expect(r.message).toBe('Something went wrong. Please try again.');
  });

  it('falls back to the provided message when the event has none', () => {
    const r = classifyRunErrorEvent({}, FALLBACK);
    expect(r.aborted).toBe(false);
    expect(r.message).toBe(FALLBACK);
  });

  it('falls back when the message is an empty string', () => {
    const r = classifyRunErrorEvent({ message: '' }, FALLBACK);
    expect(r.message).toBe(FALLBACK);
  });

  it('does not treat an unrelated error message as an abort', () => {
    const r = classifyRunErrorEvent({ message: 'Model rate limit reached' }, FALLBACK);
    expect(r.aborted).toBe(false);
  });
});
