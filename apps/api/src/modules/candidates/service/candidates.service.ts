import { totalPages } from '@crm/utils';
import { Injectable, Logger } from '@nestjs/common';

import { ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import { CompaniesService } from '../../companies/service/companies.service';
import { NotificationsService } from '../../notifications/service/notifications.service';
import type { CreateCandidateDto } from '../dto/create-candidate.dto';
import type { ListCandidatesQueryDto } from '../dto/list-candidates-query.dto';
import type { UpdateCandidateDto } from '../dto/update-candidate.dto';
import { CandidatesRepository } from '../repositories/candidates.repository';

// The whole point of the unassigned/"raw lead" pool is deciding who to work
// on next — this pool is realistically small (tens to low hundreds), so
// ranking it in memory rather than adding a raw-SQL computed ORDER BY is
// the simpler correct choice. Comfortably above any real org's count.
const UNASSIGNED_POOL_CAP = 1000;

type PotentialSignals = {
  jobTitle: string | null;
  currentCompany: string | null;
  email: string | null;
  phone: string | null;
  location?: string | null;
  interestedJob?: { title: string; location: string | null } | null;
};

/**
 * "Potential" is entirely derived from what's actually on file — never a
 * black-box prediction. Weighted toward recorded work experience per the
 * brief: having a stated title + current employer says the most about
 * whether this is a placeable candidate; being reachable (email/phone)
 * matters, but less. When the candidate has a specific `interestedJob` (set
 * while still unassigned — see Candidate.interestedJobId), a job-fit bonus
 * is added on top so people competing for the SAME opening rank against
 * each other by fit, not just profile completeness. Capped at 100 either way.
 */
function completenessScore(candidate: PotentialSignals): number {
  let score = 0;
  if (candidate.jobTitle) score += 40;
  if (candidate.currentCompany) score += 30;
  if (candidate.email) score += 15;
  if (candidate.phone) score += 15;
  return score;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function titlesOverlap(candidateTitle: string, jobTitle: string): boolean {
  const a = normalize(candidateTitle);
  const b = normalize(jobTitle);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

function jobFitBonus(candidate: PotentialSignals): number {
  const job = candidate.interestedJob;
  if (!job) return 0;
  let bonus = 0;
  if (candidate.jobTitle && titlesOverlap(candidate.jobTitle, job.title)) bonus += 20;
  if (candidate.location && job.location && normalize(candidate.location) === normalize(job.location)) {
    bonus += 10;
  }
  return bonus;
}

function potentialScore(candidate: PotentialSignals): number {
  return Math.min(100, completenessScore(candidate) + jobFitBonus(candidate));
}

function potentialLabel(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

function withPotential<T extends PotentialSignals>(candidate: T): T & { potentialScore: number; potentialLabel: string } {
  const score = potentialScore(candidate);
  return { ...candidate, potentialScore: score, potentialLabel: potentialLabel(score) };
}

const LIVE_APPLICATION_STATUSES = new Set(['ACTIVE', 'ON_HOLD', 'PLACED']);

/** The slice of an application the repository loads per candidate (CandidatesRepository APPLICATION_SUMMARY). */
type ApplicationSummary = {
  status: string;
  jobId: string;
  pipelineId: string;
  updatedAt: Date;
  job: { title: string };
  pipelineStage: { name: string; type: string; order: number };
};

/** What the Candidates table shows as "where are they now": the stage of their live (else latest) application. */
export type CurrentApplication = { pipelineId: string; jobId: string; jobTitle: string; stage: string; stageType: string };

/**
 * Where an applicant stands, from their applications: none yet -> PENDING (awaiting a decision), any in progress or
 * placed -> ACTIVE, only rejected/withdrawn -> REJECTED — plus the pipeline stage that status comes from. The raw
 * application rows are not part of the response.
 */
function withReviewStatus<T extends { applications?: ApplicationSummary[] }>(
  candidate: T,
): Omit<T, 'applications'> & { reviewStatus: 'PENDING' | 'ACTIVE' | 'REJECTED'; currentApplication: CurrentApplication | null } {
  const { applications = [], ...rest } = candidate;
  const live = applications.filter((a) => LIVE_APPLICATION_STATUSES.has(a.status));
  const reviewStatus = applications.length === 0 ? 'PENDING' : live.length > 0 ? 'ACTIVE' : 'REJECTED';
  const latest = [...(live.length > 0 ? live : applications)].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  const currentApplication = latest
    ? { pipelineId: latest.pipelineId, jobId: latest.jobId, jobTitle: latest.job.title, stage: latest.pipelineStage.name, stageType: latest.pipelineStage.type }
    : null;
  return { ...rest, reviewStatus, currentApplication };
}

const TITLE_STOP_WORDS = new Set(['the', 'and', 'for', 'of', 'senior', 'junior', 'sr', 'jr', 'ii', 'iii', 'lead', 'assistant', 'associate', 'head', 'staff', 'team']);

/** Significant words of a job title — what "the same kind of job" is judged on. */
function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9ëç\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !TITLE_STOP_WORDS.has(w)),
  );
}

/** Same title, or at least one significant word in common ("Store Team Lead" ~ "Store Manager"). */
function similarTitles(a: string, b: string): boolean {
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) return true;
  const ta = titleTokens(a);
  for (const w of titleTokens(b)) if (ta.has(w)) return true;
  return false;
}

export interface SuggestedJob {
  id: string;
  title: string;
  location: string | null;
  company: { id: string; name: string } | null;
  /** The job they were turned down for (or wanted) that this opening resembles. */
  matchedOn: string;
}

/** Raised after a candidate is created by hand — see `CandidatesService.onCandidateCreated`. */
export interface CandidateCreatedEvent {
  organisationId: string;
  /** Who entered them; null when they came in through the public website form. */
  userId: string | null;
  candidate: { id: string; firstName: string; lastName: string; ownerId: string | null; interestedJobId: string | null };
  via: 'MANUAL' | 'WEBSITE';
  /** Someone already on file applying again (website only). */
  returning?: boolean;
}

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name);
  private readonly createdListeners = new Set<(event: CandidateCreatedEvent) => Promise<unknown>>();

  constructor(
    private readonly repository: CandidatesRepository,
    private readonly companiesService: CompaniesService,
    private readonly notifications: NotificationsService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  /**
   * Runs after every candidate created through this service. This is how CandidateIntakeService (ApplicationsModule,
   * which already depends on this module) puts new arrivals straight onto the pipeline without a circular module
   * dependency. A failing listener is logged and never fails the create itself.
   */
  onCandidateCreated(listener: (event: CandidateCreatedEvent) => Promise<unknown>): void {
    this.createdListeners.add(listener);
  }

  private async emitCreated(event: CandidateCreatedEvent): Promise<void> {
    for (const listener of this.createdListeners) {
      try {
        await listener(event);
      } catch (error) {
        this.logger.warn(`Candidate-created listener failed for ${event.candidate.id}: ${error}`);
      }
    }
  }

  // Fields a resume/CV realistically supplies (see ResumeParserService and
  // CandidateForm's RESUME_FIELDS) — missing ones are worth flagging since
  // they also directly cost this candidate potentialScore points.
  private static readonly EXPECTED_FIELD_LABELS: Record<string, string> = {
    email: 'email',
    phone: 'phone',
    location: 'location',
    jobTitle: 'job title',
    currentCompany: 'current company',
  };

  private async notifyIfIncomplete(
    organisationId: string,
    candidate: {
      id: string;
      firstName: string;
      lastName: string;
      ownerId: string | null;
      email: string | null;
      phone: string | null;
      location: string | null;
      jobTitle: string | null;
      currentCompany: string | null;
    },
  ): Promise<void> {
    if (!candidate.ownerId) return;

    const missing = Object.entries(CandidatesService.EXPECTED_FIELD_LABELS)
      .filter(([field]) => !candidate[field as keyof typeof candidate])
      .map(([, label]) => label);
    if (missing.length === 0) return;

    await this.notifications.notify(organisationId, candidate.ownerId, {
      type: 'CANDIDATE_DATA_INCOMPLETE',
      title: `Missing info for ${candidate.firstName} ${candidate.lastName}`,
      message: `Missing: ${missing.join(', ')} — complete their profile for a more accurate potential score.`,
      link: `/candidates/${candidate.id}`,
    });
  }

  async list(organisationId: string, query: ListCandidatesQueryDto) {
    // The unassigned pool is ranked by potential (highest first) so a
    // recruiter deciding who to promote into a pipeline sees the strongest
    // leads at the top — not just whoever was added most recently.
    if (query.unassigned) {
      // Page only — `totalItems` below is `ranked.length`, so the repository's
      // full-table count (an anti-join over every candidate) would be discarded.
      const pool = await this.repository.findPage(organisationId, {
        ...query,
        page: 1,
        pageSize: UNASSIGNED_POOL_CAP,
      });
      const ranked = pool.map(withReviewStatus).map(withPotential).sort((a, b) => b.potentialScore - a.potentialScore);
      const totalItems = ranked.length;
      const start = (query.page - 1) * query.pageSize;
      return {
        items: ranked.slice(start, start + query.pageSize),
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: totalPages(totalItems, query.pageSize),
      };
    }

    // "Suggested for open jobs": people turned down for a job, for whom a similar OPEN job exists now that they
    // have not applied to. Matched in memory over the rejected pool (small), like the unassigned ranking above.
    if (query.reviewStatus === 'SUGGESTED') {
      const [pool, openJobs] = await Promise.all([
        this.repository.findPage(organisationId, { ...query, page: 1, pageSize: UNASSIGNED_POOL_CAP }),
        this.repository.findOpenJobs(organisationId),
      ]);
      const suggested = pool
        .map((candidate) => {
          const closed = candidate.applications.filter((a) => a.status === 'REJECTED' || a.status === 'WITHDRAWN');
          const wanted = [...new Set([...closed.map((a) => a.job.title), ...(candidate.interestedJob ? [candidate.interestedJob.title] : [])])];
          const applied = new Set(candidate.applications.map((a) => a.jobId));
          const suggestedJobs: SuggestedJob[] = [];
          for (const job of openJobs) {
            if (applied.has(job.id)) continue;
            const matchedOn = wanted.find((title) => similarTitles(title, job.title));
            if (matchedOn) suggestedJobs.push({ id: job.id, title: job.title, location: job.location, company: job.company, matchedOn });
            if (suggestedJobs.length === 3) break;
          }
          return { ...withPotential(withReviewStatus(candidate)), suggestedJobs };
        })
        .filter((c) => c.suggestedJobs.length > 0);
      const totalItems = suggested.length;
      const start = (query.page - 1) * query.pageSize;
      return { items: suggested.slice(start, start + query.pageSize), page: query.page, pageSize: query.pageSize, totalItems, totalPages: totalPages(totalItems, query.pageSize) };
    }

    const { items, totalItems } = await this.repository.findMany(organisationId, query);
    return {
      items: items.map(withReviewStatus).map(withPotential),
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: totalPages(totalItems, query.pageSize),
    };
  }

  async getById(organisationId: string, id: string) {
    const candidate = await this.repository.findById(organisationId, id);
    if (!candidate) throw new ResourceNotFoundException('Candidate', id);
    return withPotential(withReviewStatus(candidate));
  }

  /** Cheap existence check (no relations loaded) for callers that ignore `getById`'s result; throws exactly what `getById` throws. */
  async assertExists(organisationId: string, id: string): Promise<void> {
    if (!(await this.repository.exists(organisationId, id))) {
      throw new ResourceNotFoundException('Candidate', id);
    }
  }

  async create(organisationId: string, userId: string, dto: CreateCandidateDto) {
    const companyId = dto.currentCompany?.trim()
      ? (await this.companiesService.findOrCreateByName(organisationId, userId, dto.currentCompany)).id
      : undefined;
    const candidate = await this.repository.create(organisationId, userId, dto, companyId);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'CREATE_CANDIDATE',
      entityType: 'Candidate',
      entityId: candidate.id,
      newValues: dto,
    });
    await this.notifyIfIncomplete(organisationId, candidate);
    await this.emitCreated({
      organisationId,
      userId,
      candidate: {
        id: candidate.id,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        ownerId: candidate.ownerId,
        interestedJobId: candidate.interestedJobId,
      },
      via: 'MANUAL',
    });
    return candidate;
  }

  async update(organisationId: string, userId: string, id: string, dto: UpdateCandidateDto) {
    const existing = await this.getById(organisationId, id);
    const candidate = await this.repository.update(organisationId, id, dto);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'UPDATE_CANDIDATE',
      entityType: 'Candidate',
      entityId: id,
      oldValues: existing,
      newValues: dto,
    });
    return candidate;
  }

  async remove(organisationId: string, userId: string, id: string) {
    await this.assertExists(organisationId, id);
    await this.repository.softDelete(organisationId, id);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'DELETE_CANDIDATE',
      entityType: 'Candidate',
      entityId: id,
    });
  }
}
