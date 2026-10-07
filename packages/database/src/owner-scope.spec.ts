import { applyOwnerScope, OWNER_SCOPED_MODELS } from './owner-scope';

const U = 'user_1';

describe('applyOwnerScope', () => {
  it('limits lists, counts and aggregates of candidates / companies / jobs to the user\'s own records', () => {
    for (const model of ['Candidate', 'Company', 'Job']) {
      for (const op of ['findMany', 'count', 'groupBy', 'aggregate', 'findFirst']) {
        expect(applyOwnerScope(model, op, { where: { deletedAt: null } }, U)).toEqual({
          where: { deletedAt: null, AND: [{ ownerId: U }] },
        });
      }
    }
  });

  it('scopes dependent records through their parent', () => {
    expect(applyOwnerScope('Contact', 'findMany', {}, U)).toEqual({ where: { AND: [{ company: { ownerId: U } }] } });
    expect(applyOwnerScope('Application', 'count', {}, U)).toEqual({ where: { AND: [{ candidate: { ownerId: U } }] } });
    expect(applyOwnerScope('Placement', 'findMany', {}, U)).toEqual({ where: { AND: [{ candidate: { ownerId: U } }] } });
    expect(applyOwnerScope('CalendarEvent', 'findMany', {}, U)).toEqual({ where: { AND: [{ userId: U }] } });
    expect((applyOwnerScope('Document', 'findMany', {}, U) as { where: { AND: [{ OR: unknown[] }] } }).where.AND[0].OR).toHaveLength(4);
  });

  it('keeps an existing filter on the same field instead of overwriting it', () => {
    // e.g. the "candidates by owner" chart asks for ownerId != null — both conditions must hold
    expect(applyOwnerScope('Candidate', 'groupBy', { where: { ownerId: { not: null } } }, U)).toEqual({
      where: { ownerId: { not: null }, AND: [{ ownerId: U }] },
    });
    expect(applyOwnerScope('Job', 'findMany', { where: { AND: [{ status: 'OPEN' }] } }, U)).toEqual({
      where: { AND: [{ status: 'OPEN' }, { ownerId: U }] },
    });
  });

  it('protects updates and deletes by id: another user\'s record simply is not found', () => {
    expect(applyOwnerScope('Candidate', 'update', { where: { id: 'c1' }, data: { firstName: 'X' } }, U)).toEqual({
      where: { id: 'c1', AND: [{ ownerId: U }] },
      data: { firstName: 'X' },
    });
    expect(applyOwnerScope('Company', 'delete', { where: { id: 'co1' } }, U)).toEqual({ where: { id: 'co1', AND: [{ ownerId: U }] } });
    expect(applyOwnerScope('Job', 'updateMany', { where: { id: 'j1' } }, U)).toEqual({ where: { id: 'j1', AND: [{ ownerId: U }] } });
  });

  it('makes the acting user the owner of what they create, even if the request names someone else', () => {
    expect(applyOwnerScope('Candidate', 'create', { data: { firstName: 'A', ownerId: 'someone_else' } }, U)).toEqual({
      data: { firstName: 'A', ownerId: U },
    });
    expect(applyOwnerScope('Company', 'createMany', { data: [{ name: 'A' }, { name: 'B', ownerId: 'x' }] }, U)).toEqual({
      data: [{ name: 'A', ownerId: U }, { name: 'B', ownerId: U }],
    });
  });

  it('leaves models that are not owner-scoped untouched (users, pipelines, notifications, ...)', () => {
    for (const model of ['User', 'Pipeline', 'PipelineStage', 'Notification', 'AuditLog', 'Role']) {
      const args = { where: { id: 'x' } };
      expect(applyOwnerScope(model, 'findMany', args, U)).toBe(args);
    }
    expect(OWNER_SCOPED_MODELS).not.toContain('user');
  });
});
