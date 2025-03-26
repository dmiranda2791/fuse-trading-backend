import { Injectable, LoggerService, LogLevel } from '@nestjs/common';

@Injectable()
export class AppLogger implements LoggerService {
  private context?: string;

  constructor(context?: string) {
    this.context = context;
  }

  setContext(context: string) {
    this.context = context;
  }

  log(message: unknown, context?: string) {
    this.printLog('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string) {
    this.printLog('error', message, context, trace);
  }

  warn(message: unknown, context?: string) {
    this.printLog('warn', message, context);
  }

  debug(message: unknown, context?: string) {
    this.printLog('debug', message, context);
  }

  verbose(message: unknown, context?: string) {
    this.printLog('verbose', message, context);
  }

  private printLog(
    level: LogLevel,
    message: unknown,
    context?: string,
    trace?: string,
  ) {
    const ctx = context || this.context || 'Application';
    const timestamp = new Date().toISOString();
    const formattedMessage = this.formatMessage(message);

    const logObject = {
      level: level.toUpperCase(),
      message: formattedMessage,
      context: ctx,
      timestamp,
      trace,
    };

    if (level === 'error') {
      console.error(JSON.stringify(logObject));
      // Here would be the place to integrate with Sentry or other monitoring tools
      // if (process.env.ENABLE_SENTRY === 'true') {
      //   Sentry.captureException(new Error(message), {
      //     extra: { trace, context: ctx },
      //   });
      // }
    } else {
      console.log(JSON.stringify(logObject));
    }
  }

  private formatMessage(message: unknown): string {
    if (message === null) return 'null';
    if (message === undefined) return 'undefined';
    if (typeof message === 'string') return message;
    if (message instanceof Error) return message.message;
    try {
      return JSON.stringify(message);
    } catch {
      // When message can't be stringified, use a safer approach
      return `[object ${Object.prototype.toString.call(message).slice(8, -1)}]`;
    }
  }
}
