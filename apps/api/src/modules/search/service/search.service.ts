import { Injectable } from '@nestjs/common';

import { SearchRepository } from '../repositories/search.repository';

@Injectable()
export class SearchService {
  constructor(private readonly repository: SearchRepository) {}

  async search(organisationId: string, q: string) {
    const { candidates, contacts, companies, jobs } = await this.repository.search(organisationId, q);

    return {
      candidates: candidates.map((c) => ({
        id: c.id,
        label: `${c.firstName} ${c.lastName}`,
        subtitle: c.jobTitle,
        href: `/candidates/${c.id}`,
      })),
      contacts: contacts.map((c) => ({
        id: c.id,
        label: `${c.firstName} ${c.lastName}`,
        subtitle: c.company?.name ?? null,
        href: `/companies/${c.companyId}`,
      })),
      companies: companies.map((c) => ({
        id: c.id,
        label: c.name,
        subtitle: c.industry,
        href: `/companies/${c.id}`,
      })),
      jobs: jobs.map((j) => ({
        id: j.id,
        label: j.title,
        subtitle: j.company?.name ?? null,
        href: `/jobs/${j.id}`,
      })),
    };
  }
}
