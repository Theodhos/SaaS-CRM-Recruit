import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';
import { CandidateIntakeService } from '../../applications/service/candidate-intake.service';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import type { WebsiteApplicationDto } from '../dto/website-application.dto';

/**
 * Applications that arrive from an agency's public website. They land in **Candidates** automatically — ranked by
 * the same potential score as everyone else — and, when the applicant picked a job, go straight onto that job's
 * pipeline with a notification to the team (CandidateIntakeService).
 *
 * This is a PUBLIC, unauthenticated write, so it is deliberately narrow:
 *  - the organisation comes from a slug looked up server-side; every query then goes through the tenant-scoped client;
 *  - nothing is created from untrusted text beyond the candidate itself (no auto-created companies, no free-form notes);
 *  - a chosen job must be OPEN and belong to that organisation;
 *  - an e-mail already on file is never duplicated (the visitor is told the same thing either way, so the form cannot
 *    be used to discover who is in the database);
 *  - a filled honeypot field is treated as a bot and silently accepted without creating anything;
 *  - the controller rate-limits per client IP.
 */
@Injectable()
export class PublicApplicationsService {
  private readonly logger = new Logger(PublicApplicationsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly auditLogs: AuditLogsService,
    private readonly intake: CandidateIntakeService,
  ) {}

  async submit(dto: WebsiteApplicationDto): Promise<{ received: true }> {
    if (dto.website?.trim()) {
      this.logger.warn('Website application ignored: honeypot field was filled');
      return { received: true };
    }

    const organisation = await this.db.client.organisation.findUnique({
      where: { slug: dto.organisation },
      select: { id: true, status: true },
    });
    if (!organisation || organisation.status === 'SUSPENDED') {
      throw new NotFoundException('Organisation not found');
    }

    const db = this.db.forTenant(organisation.id);

    let job: { id: string; title: string; ownerId: string | null } | null = null;
    if (dto.jobId) {
      job = await db.job.findFirst({
        where: { id: dto.jobId, deletedAt: null, status: 'OPEN' },
        select: { id: true, title: true, ownerId: true },
      });
      if (!job) throw new BadRequestException('This position is no longer open.');
    }

    const email = dto.email.toLowerCase();
    const existing = await db.candidate.findFirst({
      where: { deletedAt: null, email: { equals: email, mode: 'insensitive' } },
      select: { id: true, firstName: true, lastName: true, ownerId: true, interestedJobId: true },
    });

    if (existing) {
      // Same person applying again (or for another role): keep one record, remember the job if none was chosen yet,
      // and put them on that job's pipeline (already there -> nothing changes).
      if (job) {
        if (!existing.interestedJobId) {
          await db.candidate.update({ where: { id: existing.id }, data: { interestedJobId: job.id } });
        }
        await this.intake.admit({
          organisationId: organisation.id,
          userId: null,
          candidate: { ...existing, interestedJobId: job.id },
          via: 'WEBSITE',
          returning: true,
        });
      }
      return { received: true };
    }

    const candidate = await db.candidate.create({
      data: {
        organisationId: organisation.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email,
        phone: dto.phone,
        location: dto.location,
        jobTitle: dto.jobTitle,
        currentCompany: dto.currentCompany,
        source: 'Website',
        status: 'ACTIVE',
        ownerId: job?.ownerId ?? undefined,
        interestedJobId: job?.id,
      },
      select: { id: true, firstName: true, lastName: true },
    });

    await this.auditLogs.record({
      organisationId: organisation.id,
      userId: null,
      action: 'WEBSITE_APPLICATION',
      entityType: 'Candidate',
      entityId: candidate.id,
      newValues: { source: 'Website', jobId: job?.id ?? null },
    });

    // Straight onto the pipeline (when a job was chosen) + "new candidate" notification to the team.
    await this.intake.admit({
      organisationId: organisation.id,
      userId: null,
      candidate: { ...candidate, ownerId: job?.ownerId ?? null, interestedJobId: job?.id ?? null },
      via: 'WEBSITE',
    });

    return { received: true };
  }
}
