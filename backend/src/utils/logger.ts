type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: string;
  data?: unknown;
}

class Logger {
  private context?: string;

  constructor(context?: string) {
    this.context = context;
  }

  private formatLog(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const contextStr = this.context ? `[${this.context}]` : '';
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `${timestamp} ${level.toUpperCase()}${contextStr} ${message}${dataStr}`;
  }

  debug(message: string, data?: unknown): void {
    console.log(this.formatLog('debug', message, data));
  }

  info(message: string, data?: unknown): void {
    console.log(this.formatLog('info', message, data));
  }

  warn(message: string, data?: unknown): void {
    console.warn(this.formatLog('warn', message, data));
  }

  error(message: string, error?: Error | unknown, data?: unknown): void {
    const errorData = error instanceof Error ? { message: error.message, stack: error.stack } : error;
    console.error(this.formatLog('error', message, { ...data, error: errorData }));
  }
}

/**
 * Create a logger with context
 */
export function createLogger(context?: string): Logger {
  return new Logger(context);
}

export const logger = new Logger('ProjectFactory');