export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogRecord {
  level: LogLevel;
  message: string;
  correlationId: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

export interface LogSink {
  emit(record: LogRecord): void;
}
