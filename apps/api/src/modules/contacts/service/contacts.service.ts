import { totalPages } from '@crm/utils';
import { Injectable } from '@nestjs/common';

import { ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import { CompaniesService } from '../../companies/service/companies.service';
import type { CreateContactDto } from '../dto/create-contact.dto';
import type { ListContactsQueryDto } from '../dto/list-contacts-query.dto';
import type { UpdateContactDto } from '../dto/update-contact.dto';
import { ContactsRepository } from '../repositories/contacts.repository';

@Injectable()
export class ContactsService {
  constructor(
    private readonly repository: ContactsRepository,
    private readonly companiesService: CompaniesService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async list(organisationId: string, query: ListContactsQueryDto) {
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
    const contact = await this.repository.findById(organisationId, id);
    if (!contact) throw new ResourceNotFoundException('Contact', id);
    return contact;
  }

  /** Cheap existence check (no relations loaded) for callers that ignore `getById`'s result; throws exactly what `getById` throws. */
  async assertExists(organisationId: string, id: string): Promise<void> {
    if (!(await this.repository.exists(organisationId, id))) {
      throw new ResourceNotFoundException('Contact', id);
    }
  }

  async create(organisationId: string, userId: string, dto: CreateContactDto) {
    await this.companiesService.assertExists(organisationId, dto.companyId);
    const contact = await this.repository.create(organisationId, userId, dto);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'CREATE_CONTACT',
      entityType: 'Contact',
      entityId: contact.id,
      newValues: dto,
    });
    return contact;
  }

  async update(organisationId: string, userId: string, id: string, dto: UpdateContactDto) {
    const existing = await this.getById(organisationId, id);
    if (dto.companyId) {
      await this.companiesService.assertExists(organisationId, dto.companyId);
    }
    const contact = await this.repository.update(organisationId, id, dto);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'UPDATE_CONTACT',
      entityType: 'Contact',
      entityId: id,
      oldValues: existing,
      newValues: dto,
    });
    return contact;
  }

  async remove(organisationId: string, userId: string, id: string) {
    await this.assertExists(organisationId, id);
    await this.repository.softDelete(organisationId, id);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'DELETE_CONTACT',
      entityType: 'Contact',
      entityId: id,
    });
  }
}
