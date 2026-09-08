import type { ApiSuccessResponse } from '@crm/types';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { map, type Observable } from 'rxjs';

/**
 * Wraps every successful controller return value in the shared
 * ApiSuccessResponse envelope so `success`/`data`/`requestId` are
 * consistent across all endpoints. Mirrored on the error path by
 * HttpExceptionFilter, which produces ApiErrorResponse. See
 * docs/api/conventions.md.
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiSuccessResponse<unknown>> {
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        requestId: request.id,
      })),
    );
  }
}
