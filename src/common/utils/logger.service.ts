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

  log(message: any, context?: string) {
    this.printLog('log', message, context);
  }

  error(message: any, trace?: string, context?: string) {
    this.printLog('error', message, context, trace);
  }

  warn(message: any, context?: string) {
    this.printLog('warn', message, context);
  }

  debug(message: any, context?: string) {
    this.printLog('debug', message, context);
  }

  verbose(message: any, context?: string) {
    this.printLog('verbose', message, context);
  }

  private printLog(
    level: LogLevel,
    message: any,
    context?: string,
    trace?: string,
  ) {
    const ctx = context || this.context || 'Application';
    const timestamp = new Date().toISOString();
    const logObject = {
      level: level.toUpperCase(),
      message,
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
} 