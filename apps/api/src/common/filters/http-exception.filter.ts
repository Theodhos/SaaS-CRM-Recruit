import type { ApiErrorResponse } from '@crm/types';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';

import { AppException } from '../exceptions/app.exception';

/**
 * Single place that turns any thrown error into the shared ApiErrorResponse
 * envelope (see docs/api/conventions.md). Unrecognized errors are logged at
 * error level and returned as a generic 500 — never leak internals
 * (stack traces, raw error messages) to the client in production.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const code = exception instanceof AppException ? exception.code : this.defaultCodeFor(status);
    // class-validator (ValidationPipe) puts the real reasons in `response.message[]`; surface them instead of the generic
    // "Bad Request Exception" so a form can tell the user which field is wrong.
    const validationMessages =
      exception instanceof HttpException && typeof exception.getResponse() === 'object'
        ? (exception.getResponse() as { message?: unknown }).message
        : undefined;
    const message =
      Array.isArray(validationMessages) && validationMessages.length > 0
        ? validationMessages.join('; ')
        : exception instanceof HttpException
          ? exception.message
          : 'Internal server error';
    const details =
      exception instanceof AppException
        ? exception.details
        : Array.isArray(validationMessages)
          ? { validation: validationMessages }
          : undefined;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        exception instanceof Error ? exception.stack : exception,
        undefined,
        'ExceptionFilter',
      );
    }

    const body: ApiErrorResponse = {
      success: false,
      error: { code, message, details },
      requestId: request.id,
    };

    response.status(status).json(body);
  }

  private defaultCodeFor(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}
