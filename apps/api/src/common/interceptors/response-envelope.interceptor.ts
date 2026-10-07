import type { ApiSuccessResponse } from '@crm/types';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable, StreamableFile } from '@nestjs/common';
import { map, type Observable } from 'rxjs';

/**
 * Wraps every successful controller return value in the shared
 * ApiSuccessResponse envelope so `success`/`data`/`requestId` are
 * consistent across all endpoints. Mirrored on the error path by
 * HttpExceptionFilter, which produces ApiErrorResponse. See
 * docs/api/conventions.md.
 *
 * A `StreamableFile` (see StorageController) is passed through untouched —
 * wrapping it in `{ success, data }` JSON would serialize the internal
 * stream object instead of piping the actual file bytes to the response.
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiSuccessResponse<unknown> | StreamableFile> {
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      map((data) => {
        if (data instanceof StreamableFile) return data;
        return {
          success: true as const,
          data,
          requestId: request.id,
        };
      }),
    );
  }
}
