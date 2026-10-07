import { randomUUID } from 'node:crypto';
import { join } from 'path';

import { JwtAuthGuard, PermissionsGuard } from '@crm/auth';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { LoggerModule } from 'nestjs-pino';

import { AppController } from './app.controller';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RolesGuard } from './common/guards/roles.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import configuration from './config/configuration';
import { HealthService } from './health/health.service';
import { CACHE_REDIS } from './infrastructure/cache/cache-redis.provider';
import { CacheModule } from './infrastructure/cache/cache.module';
import { TenantCacheInvalidationInterceptor } from './infrastructure/cache/tenant-cache-invalidation.interceptor';
import { DatabaseModule } from './infrastructure/database/database.module';
import { EmailModule } from './infrastructure/email/email.module';
import { TelephonyModule } from './infrastructure/telephony/telephony.module';
import { ZoomModule } from './infrastructure/zoom/zoom.module';
import { PhonesModule } from './modules/phones/phones.module';
import { MetricsModule } from './infrastructure/metrics/metrics.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { SchedulerModule } from './infrastructure/scheduler/scheduler.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { RedisThrottlerStorage } from './infrastructure/throttler/redis-throttler.storage';
import { ActivitiesModule } from './modules/activities/activities.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { AuthModule } from './modules/auth/auth.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { CandidatesModule } from './modules/candidates/candidates.module';
import { CommentsModule } from './modules/comments/comments.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { DistributionListsModule } from './modules/distribution-lists/distribution-lists.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { EmailsModule } from './modules/emails/emails.module';
import { FeesModule } from './modules/fees/fees.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { InterviewsModule } from './modules/interviews/interviews.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrganisationsModule } from './modules/organisations/organisations.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { PipelineStagesModule } from './modules/pipeline-stages/pipeline-stages.module';
import { PipelinesModule } from './modules/pipelines/pipelines.module';
import { PlacementsModule } from './modules/placements/placements.module';
import { PublicApplicationsModule } from './modules/public-applications/public-applications.module';
import { RenewalsModule } from './modules/renewals/renewals.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RetainersModule } from './modules/retainers/retainers.module';
import { RolesModule } from './modules/roles/roles.module';
import { SearchModule } from './modules/search/search.module';
import { TagsModule } from './modules/tags/tags.module';
import { TalentPoolsModule } from './modules/talent-pools/talent-pools.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { TeamsModule } from './modules/teams/teams.module';
import { TelemetryModule } from './modules/telemetry/telemetry.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    // envFilePath is explicit (not cwd-relative) because process.cwd() differs
    // between `pnpm --filter @crm/api dev` (apps/api) and other invocations —
    // the documented workflow is a single `.env` at the repo root (see
    // README's "cp .env.example .env"). Missing in Docker is fine: env vars
    // there come from the container environment directly (docker-compose's
    // `env_file: .env`), and dotenv silently no-ops on a missing file.
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: join(__dirname, '../../../.env'),
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        // Probe and scrape traffic (every few seconds, from every replica) is noise, not signal.
        autoLogging: { ignore: (req) => /^\/(health|metrics)(\/|$)/.test(req.url ?? '') },
        // Never log credentials: the session and refresh tokens travel as httpOnly COOKIES (and are set by
        // Set-Cookie on login), not only in the Authorization header.
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-api-key"]',
            'res.headers["set-cookie"]',
          ],
          censor: '[REDACTED]',
        },
        // One correlation id per request, minted before any guard runs (so even a 401/429 carries it), honouring an
        // id set by the edge; it is echoed as X-Request-Id and in the response envelope.
        genReqId: (req, res) => {
          const incoming = req.headers['x-request-id'];
          const id = typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 128 ? incoming : randomUUID();
          res.setHeader('X-Request-Id', id);
          return id;
        },
      },
    }),
    // Rate limiting. By default counters live in this process's memory (unchanged behaviour). With
    // THROTTLER_STORAGE=redis they live in Redis so the limit holds across ALL replicas; if Redis is
    // unreachable each instance falls back to counting locally.
    ThrottlerModule.forRootAsync({
      inject: [CACHE_REDIS],
      useFactory: (redis: Redis | null) => ({
        throttlers: [
          {
            ttl: Number(process.env.RATE_LIMIT_TTL_SECONDS ?? 60) * 1000,
            limit: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 120),
          },
        ],
        ...(process.env.THROTTLER_STORAGE === 'redis' ? { storage: new RedisThrottlerStorage(redis) } : {}),
      }),
    }),
    // Backs the @Cron() jobs that poll for time-based conditions no request
    // ever triggers directly — e.g. CalendarRemindersService's "starting
    // soon" sweep. In-process (no worker needed). With several API replicas set SCHEDULER_LOCK=redis so each
    // sweep runs on one replica per tick (see SchedulerLockService).
    ScheduleModule.forRoot(),

    // Infrastructure (global modules)
    DatabaseModule,
    MetricsModule,
    CacheModule,
    SchedulerModule,
    RedisModule,
    StorageModule,
    EmailModule,
    ZoomModule,
    TelephonyModule,
    PhonesModule,
    QueueModule,

    // Identity, tenancy & RBAC
    AuthModule,
    OrganisationsModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    TeamsModule,

    // CRM core
    CandidatesModule,
    CompaniesModule,
    ContactsModule,

    // ATS / recruitment pipeline
    JobsModule,
    ApplicationsModule,
    PipelinesModule,
    PipelineStagesModule,

    // Activity, productivity & scheduling
    ActivitiesModule,
    TasksModule,
    CalendarModule,
    InterviewsModule,

    // Communication & content
    EmailsModule,
    DocumentsModule,
    CommentsModule,

    // Revenue
    PlacementsModule,
    FeesModule,
    RetainersModule,
    RenewalsModule,

    // Organisation & sourcing utilities
    TagsModule,
    TalentPoolsModule,
    DistributionListsModule,

    // Platform services
    NotificationsModule,
    SearchModule,
    TelemetryModule,
    PublicApplicationsModule,
    ReportsModule,
    AnalyticsModule,
    AuditLogsModule,
    IntegrationsModule,
  ],
  controllers: [AppController],
  providers: [
    HealthService,
    // Order matters: authenticate -> resolve tenant -> authorize.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    // Orphans a tenant's cached aggregates after any write (no-op unless CACHE_ENABLED=true).
    { provide: APP_INTERCEPTOR, useClass: TenantCacheInvalidationInterceptor },
  ],
})
export class AppModule {}
