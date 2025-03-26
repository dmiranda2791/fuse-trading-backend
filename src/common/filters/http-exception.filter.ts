import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponse {
  statusCode: number;
  errorCode: string;
  message: string;
  timestamp: string;
  path: string;
  details?: Record<string, any>;
}

interface ExceptionResponseType {
  errorCode?: string;
  message?: string;
  details?: Record<string, any>;
  [key: string]: any;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as ExceptionResponseType;

    // Build standardized error response
    const errorResponse: ErrorResponse = {
      statusCode: status,
      errorCode: exceptionResponse.errorCode || `SYS_${status}`,
      message: exceptionResponse.message || 'Internal server error',
      timestamp: new Date().toISOString(),
      path: request.url,
      details: exceptionResponse.details,
    };

    // Log the error
    this.logger.error(
      `${status} | ${request.method} ${request.url} | ${JSON.stringify(errorResponse)}`,
      exception.stack,
    );

    response.status(status).json(errorResponse);
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Build standardized error response
    const errorResponse: ErrorResponse = {
      statusCode: status,
      errorCode: 'SYS_500',
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Log the error with stack trace
    const errorMessage =
      exception instanceof Error ? exception.message : String(exception);
    const errorStack = exception instanceof Error ? exception.stack : undefined;

    this.logger.error(`Unhandled Exception: ${errorMessage}`, errorStack);

    response.status(status).json(errorResponse);
  }
}
