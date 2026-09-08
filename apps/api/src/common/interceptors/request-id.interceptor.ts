import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

/**
 * Stamps every request with a correlation ID (`request.id`), reused as the
 * `X-Request-Id` response header and echoed inside every ApiResponse
 * envelope (see ResponseEnvelopeInterceptor / HttpExceptionFilter). Pass an
 * incoming `X-Request-Id` through so a caller's own trace ID survives.
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const requestId: string = request.headers['x-request-id'] ?? uuidv4();
    request.id = requestId;
    response.setHeader('X-Request-Id', requestId);

    return next.handle();
  }
}
