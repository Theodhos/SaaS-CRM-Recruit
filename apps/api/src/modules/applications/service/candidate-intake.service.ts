import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { AppException } from '../../../common/exceptions/app.exception';
import { CandidatesService, type CandidateCreatedEvent } from '../../candidates/service/candidates.service';
import { JobsService } from '../../jobs/service/jobs.service';
import { NotificationsService } from '../../notifications/service/notifications.service';
import { UsersService } from '../../users/service/users.service';

import { ApplicationsService } from './applications.service';

type JobSummary = { title: string; ownerId: string | null };

/**
 * Intake of a new candidate. Whoever arrives — through the public website form or typed in by an instructor — goes
 * straight onto the pipeline for the job they want (first stage of the default pipeline, "New") and everyone
 * concerned is told in the platform: the candidate's owner, the job's owner and the admins. From then on the
 * candidate's status in Candidates is read off their pipeline stage.
 *
 * Manual entry reaches this through CandidatesService.onCandidateCreated (CandidatesModule cannot import this
 * module); the website form (PublicApplicationsService) calls `admit` directly.
 */
@Injectable()
export class CandidateIntakeService implements OnModuleInit {
  private readonly logger = new Logger(CandidateIntakeService.name);

  constructor(
    private readonly candidatesService: CandidatesService,
    private readonly applicationsService: ApplicationsService,
    private readonly jobsService: JobsService,
    private readonly usersService: UsersService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.candidatesService.onCandidateCreated((event) => this.admit(event));
  }

  async admit(event: CandidateCreatedEvent): Promise<{ applicationId: string | null; stage: string | null }> {
    const { organisationId, userId, candidate } = event;
    let job: JobSummary | null = null;
    let application: { id: string; pipelineStage: { name: string } } | null = null;

    if (candidate.interestedJobId) {
      try {
        job = await this.jobsService.getById(organisationId, candidate.interestedJobId);
        application = await this.applicationsService.create(organisationId, userId, {
          candidateId: candidate.id,
          jobId: candidate.interestedJobId,
          source: event.via === 'WEBSITE' ? 'CAREER_SITE' : 'OTHER',
          ownerId: candidate.ownerId ?? job.ownerId ?? undefined,
        });
      } catch (error) {
        // Already on that job's pipeline (a returning applicant) is fine. Anything else must not lose the candidate:
        // they stay "Pending" in Candidates and can be put on a pipeline from their profile.
        if (!(error instanceof AppException && error.code === 'DUPLICATE_APPLICATION')) {
          this.logger.warn(`Could not put candidate ${candidate.id} on the pipeline: ${error}`);
        }
      }
    }

    const stage = application?.pipelineStage.name ?? null;
    await this.notifyArrival(event, job, stage);
    return { applicationId: application?.id ?? null, stage };
  }

  private async notifyArrival(event: CandidateCreatedEvent, job: JobSummary | null, stage: string | null): Promise<void> {
    const { organisationId, candidate } = event;
    const recipients = new Set<string>(await this.usersService.adminIds(organisationId));
    if (candidate.ownerId) recipients.add(candidate.ownerId);
    if (job?.ownerId) recipients.add(job.ownerId);

    const name = `${candidate.firstName} ${candidate.lastName}`;
    const how = event.via === 'WEBSITE' ? 'Applied through the website' : 'Added manually';
    const forJob = job ? ` for ${job.title}` : '';
    const where = stage ? ` · now on the pipeline at "${stage}"` : job ? '' : ' · no job chosen yet, so not on a pipeline';
    const data = {
      type: event.returning ? 'CANDIDATE_REAPPLIED' : 'NEW_CANDIDATE',
      title: event.returning ? `Returning applicant: ${name}` : `New candidate: ${name}`,
      message: `${how}${forJob}${where}`,
      link: `/candidates/${candidate.id}`,
    };
    await Promise.all([...recipients].map((userId) => this.notifications.notify(organisationId, userId, data)));
  }
}
