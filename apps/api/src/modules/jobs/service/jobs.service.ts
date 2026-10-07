import { totalPages } from '@crm/utils';
import { Injectable } from '@nestjs/common';

import { AppException, ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import { CompaniesService } from '../../companies/service/companies.service';
import type { CreateJobDto } from '../dto/create-job.dto';
import type { ListJobsQueryDto } from '../dto/list-jobs-query.dto';
import type { UpdateJobDto } from '../dto/update-job.dto';
import { JobsRepository } from '../repositories/jobs.repository';

@Injectable()
export class JobsService {
  constructor(
    private readonly repository: JobsRepository,
    private readonly companiesService: CompaniesService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async list(organisationId: string, query: ListJobsQueryDto) {
    const { items, totalItems } = await this.repository.findMany(organisationId, query);
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: totalPages(totalItems, query.pageSize),
    };
  }

  async getById(organisationId: string, id: string) {
    const job = await this.repository.findById(organisationId, id);
    if (!job) throw new ResourceNotFoundException('Job', id);
    return job;
  }

  /** Cheap existence check (no relations loaded) for callers that ignore `getById`'s result; throws exactly what `getById` throws. */
  async assertExists(organisationId: string, id: string): Promise<void> {
    if (!(await this.repository.exists(organisationId, id))) {
      throw new ResourceNotFoundException('Job', id);
    }
  }

  async create(organisationId: string, userId: string, dto: CreateJobDto) {
    this.assertExperienceRange(dto.experienceYearsMin, dto.experienceYearsMax);
    const { companyName, ...jobData } = dto;
    const companyId = await this.resolveCompanyId(organisationId, userId, dto.companyId, companyName);
    const job = await this.repository.create(organisationId, userId, { ...jobData, companyId });
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'CREATE_JOB',
      entityType: 'Job',
      entityId: job.id,
      newValues: dto,
    });
    return job;
  }

  async update(organisationId: string, userId: string, id: string, dto: UpdateJobDto) {
    const existing = await this.getById(organisationId, id);
    // a PATCH may carry only one end of the range — check it against the end already saved
    this.assertExperienceRange(
      dto.experienceYearsMin === undefined ? existing.experienceYearsMin : dto.experienceYearsMin,
      dto.experienceYearsMax === undefined ? existing.experienceYearsMax : dto.experienceYearsMax,
    );
    const { companyName, ...jobData } = dto;
    const companyId =
      dto.companyId || companyName
        ? await this.resolveCompanyId(organisationId, userId, dto.companyId, companyName)
        : undefined;
    const job = await this.repository.update(organisationId, id, { ...jobData, companyId });
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'UPDATE_JOB',
      entityType: 'Job',
      entityId: id,
      oldValues: existing,
      newValues: dto,
    });
    return job;
  }

  async remove(organisationId: string, userId: string, id: string) {
    await this.assertExists(organisationId, id);
    await this.repository.softDelete(organisationId, id);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'DELETE_JOB',
      entityType: 'Job',
      entityId: id,
    });
  }

  private assertExperienceRange(min: number | null | undefined, max: number | null | undefined): void {
    if (typeof min === 'number' && typeof max === 'number' && max < min) {
      throw new AppException(
        'INVALID_EXPERIENCE_RANGE',
        'experienceYearsMax must not be less than experienceYearsMin',
      );
    }
  }

  /**
   * `companyId` (an explicit pick from the Company dropdown) wins when both
   * are given; `companyName` falls back to CompaniesService.findOrCreateByName
   * (same resolution as Candidate.currentCompany — match by name or create a
   * new PROSPECT Company). Neither given is fine: the Job is created/updated
   * with no Company link, to be connected later once that's known.
   */
  private async resolveCompanyId(
    organisationId: string,
    userId: string,
    companyId: string | undefined,
    companyName: string | undefined,
  ): Promise<string | undefined> {
    if (companyId) {
      await this.companiesService.assertExists(organisationId, companyId);
      return companyId;
    }
    if (companyName?.trim()) {
      return (await this.companiesService.findOrCreateByName(organisationId, userId, companyName)).id;
    }
    return undefined;
  }
}
