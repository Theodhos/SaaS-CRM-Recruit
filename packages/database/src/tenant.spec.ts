import { scopedPrisma, TENANT_SCOPED_MODELS } from './tenant';

/**
 * scopedPrisma() is the defense-in-depth layer behind spec §36/§37's
 * multi-tenancy guarantee: "no user from Organisation A can ever see
 * Organisation B's data", enforced at the database-access layer itself,
 * not just by trusting every call site to remember a `where` clause.
 *
 * These tests don't touch a real database — they call scopedPrisma() with
 * a fake client whose `$extends` just hands back the extension config, so
 * the `$allOperations` interceptor can be exercised directly and asserted
 * on in isolation. See docs/architecture/multi-tenancy.md.
 */
describe('scopedPrisma', () => {
  const ORG_A = 'org_a';

  function extractAllOperations(organisationId: string) {
    const fakeClient = {
      $extends: (config: {
        query: { $allModels: { $allOperations: (...args: unknown[]) => unknown } };
      }) => config,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extended = scopedPrisma(fakeClient as any, organisationId) as unknown as {
      query: { $allModels: { $allOperations: (...args: unknown[]) => unknown } };
    };
    return extended.query.$allModels.$allOperations;
  }

  it('throws for an empty organisationId rather than silently scoping to nothing', () => {
    const fakeClient = { $extends: (config: unknown) => config };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => scopedPrisma(fakeClient as any, '')).toThrow(/non-empty organisationId/);
  });

  it('injects organisationId into `where` on findMany for a tenant-scoped model', async () => {
    const allOperations = extractAllOperations(ORG_A);
    const capturedArgs: unknown[] = [];
    const query = (args: unknown) => {
      capturedArgs.push(args);
      return Promise.resolve([]);
    };

    await allOperations({
      model: 'Candidate',
      operation: 'findMany',
      args: { where: { status: 'ACTIVE' } },
      query,
    });

    expect(capturedArgs[0]).toEqual({ where: { status: 'ACTIVE', organisationId: ORG_A } });
  });

  it("does not let a caller-supplied where.organisationId escape the caller's own tenant", async () => {
    const allOperations = extractAllOperations(ORG_A);
    const capturedArgs: unknown[] = [];
    const query = (args: unknown) => {
      capturedArgs.push(args);
      return Promise.resolve([]);
    };

    // Simulates a compromised/buggy call site that (incorrectly) tries to
    // pass a different organisationId through `where` — scopedPrisma must
    // win, since it spreads its own organisationId last.
    await allOperations({
      model: 'Candidate',
      operation: 'findMany',
      args: { where: { organisationId: 'org_b' } },
      query,
    });

    expect((capturedArgs[0] as { where: { organisationId: string } }).where.organisationId).toBe(
      ORG_A,
    );
  });

  it('stamps organisationId onto `data` on create', async () => {
    const allOperations = extractAllOperations(ORG_A);
    const capturedArgs: unknown[] = [];
    const query = (args: unknown) => {
      capturedArgs.push(args);
      return Promise.resolve({});
    };

    await allOperations({
      model: 'Company',
      operation: 'create',
      args: { data: { name: 'Globex' } },
      query,
    });

    expect(capturedArgs[0]).toEqual({ data: { name: 'Globex', organisationId: ORG_A } });
  });

  it('stamps organisationId onto every row for createMany', async () => {
    const allOperations = extractAllOperations(ORG_A);
    const capturedArgs: unknown[] = [];
    const query = (args: unknown) => {
      capturedArgs.push(args);
      return Promise.resolve({ count: 2 });
    };

    await allOperations({
      model: 'Candidate',
      operation: 'createMany',
      args: { data: [{ firstName: 'A' }, { firstName: 'B' }] },
      query,
    });

    expect(capturedArgs[0]).toEqual({
      data: [
        { firstName: 'A', organisationId: ORG_A },
        { firstName: 'B', organisationId: ORG_A },
      ],
    });
  });

  it('constrains both `where` and `create` on upsert', async () => {
    const allOperations = extractAllOperations(ORG_A);
    const capturedArgs: unknown[] = [];
    const query = (args: unknown) => {
      capturedArgs.push(args);
      return Promise.resolve({});
    };

    await allOperations({
      model: 'Tag',
      operation: 'upsert',
      args: { where: { id: 'tag_1' }, create: { name: 'Senior' }, update: { name: 'Senior+' } },
      query,
    });

    expect(capturedArgs[0]).toEqual({
      where: { id: 'tag_1', organisationId: ORG_A },
      create: { name: 'Senior', organisationId: ORG_A },
      update: { name: 'Senior+' },
    });
  });

  it('passes through untouched for a model that is not tenant-scoped', async () => {
    const allOperations = extractAllOperations(ORG_A);
    const capturedArgs: unknown[] = [];
    const query = (args: unknown) => {
      capturedArgs.push(args);
      return Promise.resolve([]);
    };

    await allOperations({
      model: 'Permission',
      operation: 'findMany',
      args: { where: { module: 'candidates' } },
      query,
    });

    expect(capturedArgs[0]).toEqual({ where: { module: 'candidates' } });
  });

  it('TENANT_SCOPED_MODELS includes every model that carries organisationId in the schema', () => {
    // A representative sample from schema.prisma, not exhaustive — this
    // guards against someone quietly removing a model from the list
    // without also removing its organisationId column.
    expect(TENANT_SCOPED_MODELS).toEqual(
      expect.arrayContaining(['candidate', 'company', 'contact', 'job', 'application']),
    );
  });
});
