import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';
import { tap, type Observable } from 'rxjs';

/**
 * Structured request/response timing log. Complements nestjs-pino's HTTP
 * access log with an application-level line that includes the resolved
 * organisationId once TenantGuard has run, useful for tracing slow
 * tenant-specific queries in production.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logger.log(
          `${request.method} ${request.url} ${Date.now() - start}ms requestId=${request.id} org=${request.user?.organisationId ?? 'n/a'}`,
        );
      }),
    );
  }
}
