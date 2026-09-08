import bcrypt from 'bcrypt';

import type { PrismaClient } from '../../src/generated/client';

/**
 * Minimal development seed data — enough to exercise every relationship in
 * the schema end to end, nothing more. This is NOT demo data for a sales
 * screenshot; it exists to prove Organisation -> User/Role -> Company ->
 * Contact, Candidate -> Application -> Job -> Pipeline/PipelineStage, and
 * Candidate -> Activity all wire up correctly.
 *
 * Idempotent: if the fixture organisation already exists, this is a no-op.
 */

const DEV_ORG_SLUG = 'acme-recruiting';
const DEV_PASSWORD = 'Password123!'; // dev-only credential, never used outside local seeding

export async function seedDevFixtures(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.organisation.findUnique({ where: { slug: DEV_ORG_SLUG } });
  if (existing) {
    console.log('Dev fixtures already seeded, skipping.');
    return;
  }

  const allPermissions = await prisma.permission.findMany();
  const adminOnlyKeys = new Set(['settings:manage', 'users:manage']);

  const organisation = await prisma.organisation.create({
    data: { name: 'Acme Recruiting', slug: DEV_ORG_SLUG, status: 'ACTIVE' },
  });

  const adminRole = await prisma.role.create({
    data: {
      organisationId: organisation.id,
      name: 'Admin',
      description: 'Full access to all organisation data and settings',
      rolePermissions: {
        create: allPermissions.map((p) => ({ permissionId: p.id })),
      },
    },
  });

  const recruiterRole = await prisma.role.create({
    data: {
      organisationId: organisation.id,
      name: 'Recruiter',
      description: 'Manages candidates, companies, contacts, jobs, and applications',
      rolePermissions: {
        create: allPermissions
          .filter((p) => !adminOnlyKeys.has(p.key))
          .map((p) => ({ permissionId: p.id })),
      },
    },
  });

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);

  const admin = await prisma.user.create({
    data: {
      organisationId: organisation.id,
      roleId: adminRole.id,
      firstName: 'Alex',
      lastName: 'Admin',
      email: 'admin@acme-recruiting.dev',
      passwordHash,
      status: 'ACTIVE',
    },
  });

  const recruiter = await prisma.user.create({
    data: {
      organisationId: organisation.id,
      roleId: recruiterRole.id,
      firstName: 'Rae',
      lastName: 'Recruiter',
      email: 'recruiter@acme-recruiting.dev',
      passwordHash,
      status: 'ACTIVE',
    },
  });

  const company = await prisma.company.create({
    data: {
      organisationId: organisation.id,
      name: 'Globex Corporation',
      industry: 'Manufacturing',
      website: 'https://globex.example.com',
      email: 'hello@globex.example.com',
      phone: '+1-555-0100',
      address: '1 Globex Plaza',
      city: 'Springfield',
      country: 'USA',
      status: 'ACTIVE_CLIENT',
      ownerId: recruiter.id,
    },
  });

  const contact = await prisma.contact.create({
    data: {
      organisationId: organisation.id,
      companyId: company.id,
      firstName: 'Hank',
      lastName: 'Scorpio',
      email: 'hank.scorpio@globex.example.com',
      phone: '+1-555-0101',
      jobTitle: 'VP of Engineering',
      status: 'ACTIVE',
      ownerId: recruiter.id,
    },
  });

  const candidate = await prisma.candidate.create({
    data: {
      organisationId: organisation.id,
      firstName: 'Jamie',
      lastName: 'Rivera',
      email: 'jamie.rivera@example.com',
      phone: '+1-555-0199',
      location: 'Austin, TX',
      jobTitle: 'Senior Backend Engineer',
      currentCompany: 'Initech',
      source: 'REFERRAL',
      status: 'ACTIVE',
      ownerId: recruiter.id,
    },
  });

  const job = await prisma.job.create({
    data: {
      organisationId: organisation.id,
      companyId: company.id,
      title: 'Senior Backend Engineer',
      description: 'Own the core services platform for a fast-growing product team.',
      location: 'Austin, TX',
      employmentType: 'PERMANENT',
      salaryMin: 130000,
      salaryMax: 165000,
      currency: 'USD',
      status: 'OPEN',
      ownerId: recruiter.id,
    },
  });

  const pipeline = await prisma.pipeline.create({
    data: {
      organisationId: organisation.id,
      name: 'Default Recruitment Pipeline',
      description: 'Standard end-to-end pipeline used for most roles',
      stages: {
        create: [
          { name: 'New', order: 1, type: 'STANDARD' },
          { name: 'Shortlisted', order: 2, type: 'STANDARD' },
          { name: 'Sent', order: 3, type: 'STANDARD' },
          { name: 'Interview', order: 4, type: 'STANDARD' },
          { name: 'Offer', order: 5, type: 'STANDARD' },
          { name: 'Placed', order: 6, type: 'PLACED' },
          { name: 'Rejected', order: 7, type: 'REJECTED' },
        ],
      },
    },
    include: { stages: true },
  });

  const newStage = pipeline.stages.find((s) => s.name === 'New')!;

  const application = await prisma.application.create({
    data: {
      organisationId: organisation.id,
      candidateId: candidate.id,
      jobId: job.id,
      pipelineId: pipeline.id,
      pipelineStageId: newStage.id,
      status: 'ACTIVE',
      source: 'REFERRAL',
      ownerId: recruiter.id,
    },
  });

  await prisma.activity.create({
    data: {
      organisationId: organisation.id,
      type: 'CALL',
      subject: 'Introductory call',
      description: 'Discussed the Senior Backend Engineer role and current availability.',
      userId: recruiter.id,
      candidateId: candidate.id,
      applicationId: application.id,
    },
  });

  await prisma.activity.create({
    data: {
      organisationId: organisation.id,
      type: 'MEETING',
      subject: 'Job intake meeting',
      description: 'Confirmed role requirements and interview process with the hiring contact.',
      userId: recruiter.id,
      contactId: contact.id,
      companyId: company.id,
      jobId: job.id,
    },
  });

  console.log('Seeded dev fixtures:');
  console.log(`  Organisation: ${organisation.name} (${organisation.slug})`);
  console.log(`  Admin login:      ${admin.email} / ${DEV_PASSWORD}`);
  console.log(`  Recruiter login:  ${recruiter.email} / ${DEV_PASSWORD}`);
}
