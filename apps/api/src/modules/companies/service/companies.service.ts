import { totalPages } from '@crm/utils';
import { Injectable } from '@nestjs/common';

import { ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import type { CreateCompanyDto } from '../dto/create-company.dto';
import type { ListCompaniesQueryDto } from '../dto/list-companies-query.dto';
import type { SaveCompanyPipelineRecordDto } from '../dto/pipeline-record.dto';
import type { UpdateCompanyDto } from '../dto/update-company.dto';
import { CompaniesRepository } from '../repositories/companies.repository';

import { mergePipelineRecord, readPipelineRecord, withStageEntered } from './pipeline-record';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly repository: CompaniesRepository,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async list(organisationId: string, query: ListCompaniesQueryDto) {
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
    const company = await this.repository.findById(organisationId, id);
    if (!company) throw new ResourceNotFoundException('Company', id);
    return company;
  }

  /** Used by ContactsService/JobsService to validate a companyId before writing the foreign key. */
  async assertExists(organisationId: string, id: string): Promise<void> {
    const exists = await this.repository.exists(organisationId, id);
    if (!exists) throw new ResourceNotFoundException('Company', id);
  }

  /**
   * Resolves a free-text employer name (e.g. Candidate.currentCompany, from
   * manual entry or a CV scan) to a Company row — reusing an existing
   * case-insensitive name match, or creating a new PROSPECT one. Used so
   * every "employer mentioned somewhere" ends up as one canonical Company
   * record instead of an untracked string.
   */
  async findOrCreateByName(organisationId: string, userId: string, name: string) {
    const trimmed = name.trim();
    const existing = await this.repository.findByName(organisationId, trimmed);
    if (existing) return existing;
    return this.create(organisationId, userId, { name: trimmed });
  }

  async create(organisationId: string, userId: string, dto: CreateCompanyDto) {
    const company = await this.repository.create(organisationId, userId, dto);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'CREATE_COMPANY',
      entityType: 'Company',
      entityId: company.id,
      newValues: dto,
    });
    return company;
  }

  /** The Pipeline Companies pop-up's Save: History text per stage and/or the pay calculation. */
  async savePipelineRecord(organisationId: string, id: string, dto: SaveCompanyPipelineRecordDto) {
    const existing = await this.getById(organisationId, id);
    const record = mergePipelineRecord(readPipelineRecord(existing.pipelineRecord), dto, new Date());
    const company = await this.repository.setPipelineRecord(organisationId, id, record);
    return { id: company.id, pipelineStage: company.pipelineStage, pipelineRecord: record };
  }

  async update(organisationId: string, userId: string, id: string, dto: UpdateCompanyDto) {
    const existing = await this.getById(organisationId, id);
    let company = await this.repository.update(organisationId, id, dto);
    // moved to another column of Pipeline Companies: the stages keep when (History shows the dates)
    if (dto.pipelineStage && dto.pipelineStage !== existing.pipelineStage) {
      const record = withStageEntered(readPipelineRecord(existing.pipelineRecord), existing.pipelineStage, dto.pipelineStage, existing.createdAt, new Date());
      company = await this.repository.setPipelineRecord(organisationId, id, record);
    }
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'UPDATE_COMPANY',
      entityType: 'Company',
      entityId: id,
      oldValues: existing,
      newValues: dto,
    });
    return company;
  }

  async remove(organisationId: string, userId: string, id: string) {
    await this.assertExists(organisationId, id);
    await this.repository.softDelete(organisationId, id);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'DELETE_COMPANY',
      entityType: 'Company',
      entityId: id,
    });
  }
}
