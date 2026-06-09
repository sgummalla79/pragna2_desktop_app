import { LOG_LEVEL } from '@/constants/api';
import { getCorrelationId } from './correlationStore';
import type { LogLevel, LogRecord, LogSink } from './logTypes';
import { ConsoleSink } from './sinks/consoleSink';
import { isPragnaError } from '@/domain/errors/PragnaError';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const IS_PROD = import.meta.env.PROD;
const configuredLevel = (LOG_LEVEL as LogLevel) ?? 'info';
const effectiveLevel: LogLevel = IS_PROD ? 'warn' : configuredLevel;

const sinks: LogSink[] = [new ConsoleSink()];

function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[effectiveLevel]) return;

  const record: LogRecord = {
    level,
    message,
    correlationId: getCorrelationId(),
    timestamp: new Date().toISOString(),
    context,
  };

  for (const sink of sinks) {
    sink.emit(record);
  }
}

/** Extracts a loggable context object from any thrown value. */
function errorContext(err: unknown): Record<string, unknown> | undefined {
  if (isPragnaError(err)) return { errorCode: err.code };
  if (err instanceof Error) return { errorMessage: err.message };
  return undefined;
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit('debug', message, context),
  info:  (message: string, context?: Record<string, unknown>) => emit('info',  message, context),
  warn:  (message: string, context?: Record<string, unknown>) => emit('warn',  message, context),
  error: (message: string, context?: Record<string, unknown>) => emit('error', message, context),

  /** Log a caught error. Automatically promotes severity and attaches error code when available. */
  fromError(message: string, err: unknown, extra?: Record<string, unknown>): void {
    const level: LogLevel = isPragnaError(err) ? (err.severity as LogLevel) : 'error';
    emit(level, message, { ...errorContext(err), ...extra });
  },
};
