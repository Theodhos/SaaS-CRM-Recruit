// The service only needs `client.organisation.findUnique` and `forTenant(...)`; avoid instantiating the real Prisma client.
jest.mock('../../../infrastructure/database/database.service', () => ({ DatabaseService: class DatabaseService {} }));

import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { DatabaseService } from '../../../infrastructure/database/database.service';
import type { CandidateIntakeService } from '../../applications/service/candidate-intake.service';
import type { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import type { WebsiteApplicationDto } from '../dto/website-application.dto';

import { PublicApplicationsService } from './public-applications.service';

const ORG = { id: 'org_acme', status: 'ACTIVE' };
const JOB = { id: 'cjob0000000000000000000001', title: 'Senior Engineer', ownerId: 'user_recruiter' };

function setup(overrides: { org?: unknown; job?: unknown; existing?: unknown } = {}) {
  const tenant = {
    job: { findFirst: jest.fn().mockResolvedValue('job' in overrides ? overrides.job : JOB) },
    candidate: {
      findFirst: jest.fn().mockResolvedValue('existing' in overrides ? overrides.existing : null),
      create: jest.fn().mockResolvedValue({ id: 'cand_new', firstName: 'Ana', lastName: 'Kelmendi' }),
      update: jest.fn().mockResolvedValue({}),
    },
    company: { create: jest.fn() },
  };
  const db = {
    client: { organisation: { findUnique: jest.fn().mockResolvedValue('org' in overrides ? overrides.org : ORG) } },
    forTenant: jest.fn(() => tenant),
  } as unknown as DatabaseService & { forTenant: jest.Mock; client: { organisation: { findUnique: jest.Mock } } };
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditLogsService & { record: jest.Mock };
  const intake = { admit: jest.fn().mockResolvedValue({ applicationId: 'app_new', stage: 'New' }) } as unknown as CandidateIntakeService & { admit: jest.Mock };
  return { service: new PublicApplicationsService(db, audit, intake), db, tenant, audit, intake };
}

const dto = (extra: Partial<WebsiteApplicationDto> = {}): WebsiteApplicationDto => ({
  organisation: 'acme-recruiting',
  firstName: 'Ana',
  lastName: 'Kelmendi',
  email: 'Ana.Kelmendi@Example.com',
  ...extra,
});

describe('PublicApplicationsService', () => {
  it('creates a candidate in Candidates with source "Website", scoped to the organisation looked up from the slug', async () => {
    const { service, db, tenant } = setup();

    await expect(service.submit(dto({ phone: '+355 69 123', jobTitle: 'Engineer' }))).resolves.toEqual({ received: true });

    expect(db.client.organisation.findUnique).toHaveBeenCalledWith({ where: { slug: 'acme-recruiting' }, select: { id: true, status: true } });
    expect(db.forTenant).toHaveBeenCalledWith('org_acme'); // every query after the lookup is tenant-scoped
    expect(tenant.candidate.create).toHaveBeenCalledTimes(1);
    expect(tenant.candidate.create.mock.calls[0][0].data).toMatchObject({
      organisationId: 'org_acme',
      firstName: 'Ana',
      lastName: 'Kelmendi',
      email: 'ana.kelmendi@example.com', // normalised
      phone: '+355 69 123',
      jobTitle: 'Engineer',
      source: 'Website',
      status: 'ACTIVE',
    });
  });

  it('a chosen job must be OPEN and belong to the organisation: the applicant is linked to it and handed to intake (pipeline + notifications)', async () => {
    const { service, tenant, intake } = setup();

    await service.submit(dto({ jobId: JOB.id }));

    expect(tenant.job.findFirst).toHaveBeenCalledWith({
      where: { id: JOB.id, deletedAt: null, status: 'OPEN' },
      select: { id: true, title: true, ownerId: true },
    });
    expect(tenant.candidate.create.mock.calls[0][0].data).toMatchObject({ interestedJobId: JOB.id, ownerId: 'user_recruiter' });
    expect(intake.admit).toHaveBeenCalledWith({
      organisationId: 'org_acme',
      userId: null,
      candidate: { id: 'cand_new', firstName: 'Ana', lastName: 'Kelmendi', ownerId: 'user_recruiter', interestedJobId: JOB.id },
      via: 'WEBSITE',
    });
  });

  it('an application WITHOUT a chosen job still lands in Candidates (no owner, no job) and the team is still told', async () => {
    const { service, tenant, intake } = setup();

    await service.submit(dto());

    const data = tenant.candidate.create.mock.calls[0][0].data;
    expect(data.interestedJobId).toBeUndefined();
    expect(data.ownerId).toBeUndefined();
    expect(tenant.job.findFirst).not.toHaveBeenCalled();
    expect(intake.admit).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null, via: 'WEBSITE', candidate: expect.objectContaining({ id: 'cand_new', ownerId: null, interestedJobId: null }) }),
    );
  });

  it('rejects a job that is closed, deleted or belongs to another organisation (400) and creates nothing', async () => {
    const { service, tenant } = setup({ job: null });

    await expect(service.submit(dto({ jobId: JOB.id }))).rejects.toBeInstanceOf(BadRequestException);
    expect(tenant.candidate.create).not.toHaveBeenCalled();
  });

  it('unknown or suspended organisation -> 404, nothing is queried for it', async () => {
    const unknown = setup({ org: null });
    await expect(unknown.service.submit(dto())).rejects.toBeInstanceOf(NotFoundException);
    expect(unknown.db.forTenant).not.toHaveBeenCalled();

    const suspended = setup({ org: { id: 'org_x', status: 'SUSPENDED' } });
    await expect(suspended.service.submit(dto())).rejects.toBeInstanceOf(NotFoundException);
    expect(suspended.tenant.candidate.create).not.toHaveBeenCalled();
  });

  it('never duplicates an e-mail already on file — same answer to the visitor, so the form cannot reveal who is in the database', async () => {
    const { service, tenant, audit, intake } = setup({ existing: { id: 'cand_existing', interestedJobId: null } });

    await expect(service.submit(dto())).resolves.toEqual({ received: true });

    expect(tenant.candidate.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
    expect(intake.admit).not.toHaveBeenCalled();
    expect(tenant.candidate.findFirst.mock.calls[0][0].where.email).toEqual({ equals: 'ana.kelmendi@example.com', mode: 'insensitive' });
  });

  it('a returning applicant who picks a job gets it attached (never overwriting one already chosen) and goes onto that pipeline', async () => {
    const existing = { id: 'cand_existing', firstName: 'Ana', lastName: 'Kelmendi', ownerId: null, interestedJobId: null };
    const attach = setup({ existing });
    await attach.service.submit(dto({ jobId: JOB.id }));
    expect(attach.tenant.candidate.update).toHaveBeenCalledWith({ where: { id: 'cand_existing' }, data: { interestedJobId: JOB.id } });
    expect(attach.intake.admit).toHaveBeenCalledWith({
      organisationId: 'org_acme',
      userId: null,
      candidate: { ...existing, interestedJobId: JOB.id },
      via: 'WEBSITE',
      returning: true,
    });

    const keep = setup({ existing: { ...existing, interestedJobId: 'cother0000000000000000001' } });
    await keep.service.submit(dto({ jobId: JOB.id }));
    expect(keep.tenant.candidate.update).not.toHaveBeenCalled();
    expect(keep.intake.admit).toHaveBeenCalledWith(expect.objectContaining({ returning: true, candidate: expect.objectContaining({ interestedJobId: JOB.id }) }));
  });

  it('a filled honeypot is a bot: accepted silently, and nothing is read or written', async () => {
    const { service, db, tenant } = setup();

    await expect(service.submit(dto({ website: 'http://spam.example' }))).resolves.toEqual({ received: true });

    expect(db.client.organisation.findUnique).not.toHaveBeenCalled();
    expect(tenant.candidate.create).not.toHaveBeenCalled();
  });

  it('creates nothing from untrusted text besides the candidate (no company is auto-created from "currentCompany")', async () => {
    const { service, tenant } = setup();

    await service.submit(dto({ currentCompany: 'Totally Real Company Ltd' }));

    expect(tenant.company.create).not.toHaveBeenCalled();
    expect(tenant.candidate.create.mock.calls[0][0].data.currentCompany).toBe('Totally Real Company Ltd');
  });

  it('writes an audit entry without duplicating the applicant\'s personal data', async () => {
    const { service, audit } = setup();

    await service.submit(dto({ jobId: JOB.id }));

    expect(audit.record).toHaveBeenCalledWith({
      organisationId: 'org_acme',
      userId: null,
      action: 'WEBSITE_APPLICATION',
      entityType: 'Candidate',
      entityId: 'cand_new',
      newValues: { source: 'Website', jobId: JOB.id },
    });
  });
});
