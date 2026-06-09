import type { ErrorEntry } from '@/constants/errors';

/**
 * Application error that carries a catalog code.
 * The code appears in every log line, making it grep-able across environments.
 *
 * Usage:
 *   throw new PragnaError(ERRORS.AUTH_003);
 *   throw new PragnaError(ERRORS.AUTH_007, caughtError);
 */
export class PragnaError extends Error {
  readonly code: string;
  readonly severity: string;

  constructor(entry: ErrorEntry, cause?: unknown) {
    super(entry.message);
    this.name = 'PragnaError';
    this.code = entry.code;
    this.severity = entry.severity;
    if (cause !== undefined) this.cause = cause;
  }

  /** Formatted string for log messages: "[AUTH_003] Session refresh failed." */
  toLogString(): string {
    return `[${this.code}] ${this.message}`;
  }
}

/** Type guard — narrows unknown catch values to PragnaError */
export function isPragnaError(err: unknown): err is PragnaError {
  return err instanceof PragnaError;
}
