import { JwtAuthGuard, PermissionsGuard } from '@crm/auth';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AppController } from './app.controller';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RolesGuard } from './common/guards/roles.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import configuration from './config/configuration';
import { DatabaseModule } from './infrastructure/database/database.module';
import { EmailModule } from './infrastructure/email/email.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { StorageModule } from './infrastructure/storage/storage.module';
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
import { RenewalsModule } from './modules/renewals/renewals.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RetainersModule } from './modules/retainers/retainers.module';
import { RolesModule } from './modules/roles/roles.module';
import { TagsModule } from './modules/tags/tags.module';
import { TalentPoolsModule } from './modules/talent-pools/talent-pools.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { TeamsModule } from './modules/teams/teams.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        autoLogging: true,
        redact: ['req.headers.authorization'],
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.RATE_LIMIT_TTL_SECONDS ?? 60) * 1000,
        limit: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 120),
      },
    ]),

    // Infrastructure (global modules)
    DatabaseModule,
    RedisModule,
    StorageModule,
    EmailModule,
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
    ReportsModule,
    AnalyticsModule,
    AuditLogsModule,
    IntegrationsModule,
  ],
  controllers: [AppController],
  providers: [
    // Order matters: authenticate -> resolve tenant -> authorize.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
