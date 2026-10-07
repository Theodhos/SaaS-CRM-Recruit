import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';

const INTERVIEWER_INCLUDE = {
  interviewer: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const;

export interface CreateInterviewData {
  applicationId: string;
  interviewerId: string;
  scheduledAt: Date;
  duration: number;
  timezone: string | null;
  meetingUrl: string;
  provider: 'zoom' | 'manual';
  hostUrl: string | null;
  notes: string | null;
}

/**
 * Tenant-scoped data access for 'interviews'. Always resolve the client via
 * `this.db.forTenant(organisationId)` (packages/database scopedPrisma) —
 * never query the raw PrismaClient for tenant-scoped models. See
 * docs/architecture/multi-tenancy.md. Owner scoping (an instructor only sees
 * interviews of their own candidates) comes from the same client.
 */
@Injectable()
export class InterviewsRepository {
  constructor(private readonly db: DatabaseService) {}

  findMany(organisationId: string, filter: { applicationId?: string; candidateId?: string; jobId?: string }) {
    return this.db.forTenant(organisationId).interview.findMany({
      where: {
        ...(filter.applicationId ? { applicationId: filter.applicationId } : {}),
        ...(filter.candidateId || filter.jobId
          ? { application: { ...(filter.candidateId ? { candidateId: filter.candidateId } : {}), ...(filter.jobId ? { jobId: filter.jobId } : {}) } }
          : {}),
      },
      orderBy: { scheduledAt: 'desc' },
      include: {
        ...INTERVIEWER_INCLUDE,
        application: { select: { id: true, candidate: { select: { id: true, firstName: true, lastName: true } }, job: { select: { id: true, title: true } } } },
      },
    });
  }

  /** The interview with what the invitation needs: the applicant, the job and its company. */
  findById(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).interview.findFirst({
      where: { id },
      include: {
        ...INTERVIEWER_INCLUDE,
        application: {
          select: {
            id: true,
            candidateId: true,
            jobId: true,
            candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
            job: { select: { id: true, title: true, company: { select: { id: true, name: true } } } },
          },
        },
      },
    });
  }

  create(organisationId: string, data: CreateInterviewData) {
    return this.db.forTenant(organisationId).interview.create({
      data: { organisationId, location: 'Zoom', ...data },
      include: INTERVIEWER_INCLUDE,
    });
  }

  markInviteSent(organisationId: string, id: string, to: string) {
    return this.db.forTenant(organisationId).interview.update({
      where: { id },
      data: { inviteSentAt: new Date(), inviteSentTo: to },
      include: INTERVIEWER_INCLUDE,
    });
  }

  setCalendarEvent(organisationId: string, id: string, calendarEventId: string) {
    return this.db.forTenant(organisationId).interview.update({ where: { id }, data: { calendarEventId }, include: INTERVIEWER_INCLUDE });
  }

  delete(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).interview.delete({ where: { id } });
  }
}
