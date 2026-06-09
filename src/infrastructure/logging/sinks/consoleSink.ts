import type { LogRecord, LogSink } from '../logTypes';

const LEVEL_STYLES: Record<string, string> = {
  debug: 'color: #94a3b8',
  info: 'color: #60a5fa',
  warn: 'color: #fbbf24',
  error: 'color: #f87171',
};

export class ConsoleSink implements LogSink {
  emit(record: LogRecord): void {
    const style = LEVEL_STYLES[record.level] ?? '';
    const prefix = `[${record.timestamp}] [${record.level.toUpperCase()}] [${record.correlationId.slice(0, 8)}]`;
    const args: unknown[] = [
      `%c${prefix}%c ${record.message}`,
      style,
      '',
    ];
    if (record.context && Object.keys(record.context).length > 0) {
      args.push(record.context);
    }

    switch (record.level) {
      case 'error':
        console.error(...args);
        break;
      case 'warn':
        console.warn(...args);
        break;
      default:
        console.log(...args);
    }
  }
}
