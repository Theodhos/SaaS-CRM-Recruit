import type { ConfigService } from '@nestjs/config';

import type { EmailService, SendEmailInput } from '../../../infrastructure/email/email.service';
import type { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import type {
  ChallengeChanges,
  ChallengeUser,
  LoginChallengesRepository,
  NewChallenge,
  StoredChallenge,
} from '../repositories/login-challenges.repository';

import { LoginOtpService, maskEmail } from './login-otp.service';

const USER: ChallengeUser = {
  id: 'user_1',
  organisationId: 'org_1',
  firstName: 'Theo',
  lastName: 'Test',
  email: 'theodhos@example.com',
  avatarUrl: null,
  status: 'ACTIVE',
  allowedSections: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  role: { id: 'role_1', name: 'Instructor', rolePermissions: [] },
};

type Row = Omit<StoredChallenge, 'user'> & { tokenHash: string };

/** The repository's contract, in memory. */
class FakeChallenges {
  rows: Row[] = [];
  user: ChallengeUser = { ...USER };

  private withUser = (row: Row): StoredChallenge => ({ ...row, user: this.user });

  async create(data: NewChallenge): Promise<StoredChallenge> {
    const row: Row = {
      id: `challenge_${this.rows.length + 1}`,
      userId: data.userId,
      tokenHash: data.tokenHash,
      codeHash: data.codeHash,
      status: 'PENDING',
      expiresAt: data.expiresAt,
      closesAt: data.closesAt,
      attempts: 0,
      maxAttempts: data.maxAttempts,
      sendCount: 1,
      lastSentAt: new Date(),
    };
    this.rows.push(row);
    return this.withUser(row);
  }

  async findByTokenHash(tokenHash: string): Promise<StoredChallenge | null> {
    const row = this.rows.find((r) => r.tokenHash === tokenHash);
    return row ? this.withUser(row) : null;
  }

  async update(id: string, data: ChallengeChanges): Promise<StoredChallenge> {
    const row = this.rows.find((r) => r.id === id)!;
    Object.assign(row, data);
    return this.withUser(row);
  }

  async countAttempt(id: string, maxAttempts: number): Promise<boolean> {
    const row = this.rows.find((r) => r.id === id)!;
    if (row.status !== 'PENDING' || row.attempts >= maxAttempts) return false;
    row.attempts += 1;
    return true;
  }

  async claim(id: string): Promise<boolean> {
    const row = this.rows.find((r) => r.id === id)!;
    if (row.status !== 'PENDING') return false;
    row.status = 'VERIFIED';
    return true;
  }

  async cancelPendingForUser(userId: string): Promise<void> {
    for (const row of this.rows) if (row.userId === userId && row.status === 'PENDING') row.status = 'CANCELLED';
  }
}

function setup(options: { env?: Record<string, string>; email?: 'delivers' | 'unconfigured' | 'throws' } = {}) {
  const challenges = new FakeChallenges();
  const sent: SendEmailInput[] = [];
  const mode = options.email ?? 'delivers';
  const email = {
    send: jest.fn(async (input: SendEmailInput) => {
      if (mode === 'throws') throw new Error('connect ECONNREFUSED 127.0.0.1:1025 smtp-password-should-not-leak');
      sent.push(input);
      return { delivered: mode === 'delivers', provider: mode === 'delivers' ? 'smtp' : 'log', messageId: mode === 'delivers' ? 'm1' : null };
    }),
  };
  const env: Record<string, string> = { NODE_ENV: 'production', JWT_ACCESS_SECRET: 'test-secret', ...options.env };
  const config = { get: (key: string, fallback?: unknown) => env[key] ?? fallback };
  const audit = { record: jest.fn(async () => undefined) };
  const service = new LoginOtpService(
    challenges as unknown as LoginChallengesRepository,
    email as unknown as EmailService,
    config as unknown as ConfigService,
    audit as unknown as AuditLogsService,
  );
  /** The code as the user reads it in the e-mail. */
  const lastCode = () => /\b(\d{6})\b/.exec(sent[sent.length - 1]!.text ?? '')![1]!;
  const wrong = (code: string) => (code === '000000' ? '000001' : '000000');
  return { service, challenges, sent, email, audit, lastCode, wrong };
}

const codeOf = (error: unknown) => (error as { code?: string }).code;

describe('LoginOtpService', () => {
  afterEach(() => jest.useRealTimers());

  it('e-mails a 6-digit code to the registered address and stores neither the code nor the token', async () => {
    const { service, challenges, sent, lastCode } = setup();
    const { token, view } = await service.start(USER, { ip: '10.0.0.1', userAgent: 'jest' });

    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(USER.email);
    expect(sent[0]!.subject).toBe('Your verification code');
    expect(lastCode()).toMatch(/^\d{6}$/);
    expect(view).toEqual({ emailHint: 't***@example.com', codeLength: 6, expiresInSeconds: 20, resendInSeconds: 20 });
    expect(view).not.toHaveProperty('devCode');

    const stored = JSON.stringify(challenges.rows);
    expect(stored).not.toContain(lastCode());
    expect(stored).not.toContain(token);
    expect(challenges.rows[0]!.codeHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates different codes', async () => {
    const { service, lastCode } = setup();
    const codes = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      await service.start(USER, {});
      codes.add(lastCode());
    }
    expect(codes.size).toBeGreaterThan(35);
  });

  it('accepts the right code once, and never again', async () => {
    const { service, lastCode, challenges } = setup();
    const { token } = await service.start(USER, {});
    const code = lastCode();

    await expect(service.verify(token, code)).resolves.toMatchObject({ id: USER.id });
    expect(challenges.rows[0]!.status).toBe('VERIFIED');
    await expect(service.verify(token, code)).rejects.toMatchObject({ code: 'OTP_SESSION_ENDED' });
  });

  it('rejects a wrong code with the generic message and counts the try', async () => {
    const { service, lastCode, wrong, challenges } = setup();
    const { token } = await service.start(USER, {});

    const error = await service.verify(token, wrong(lastCode())).catch((e) => e);
    expect(codeOf(error)).toBe('OTP_INVALID');
    expect(error.message).toBe('Invalid verification code.');
    expect(challenges.rows[0]!.attempts).toBe(1);
    // the right code still works afterwards
    await expect(service.verify(token, lastCode())).resolves.toMatchObject({ id: USER.id });
  });

  it('locks the code after the maximum number of wrong tries — the right code no longer works', async () => {
    const { service, lastCode, wrong } = setup();
    const { token } = await service.start(USER, {});
    const code = lastCode();

    for (let i = 0; i < 4; i += 1) await expect(service.verify(token, wrong(code))).rejects.toMatchObject({ code: 'OTP_INVALID' });
    await expect(service.verify(token, wrong(code))).rejects.toMatchObject({ code: 'OTP_LOCKED' });
    await expect(service.verify(token, code)).rejects.toMatchObject({ code: 'OTP_LOCKED' });
  });

  it('rejects an expired code', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-29T10:00:00Z') });
    const { service, lastCode } = setup();
    const { token } = await service.start(USER, {});
    const code = lastCode();

    jest.setSystemTime(new Date('2026-09-29T10:00:21Z'));
    const error = await service.verify(token, code).catch((e) => e);
    expect(codeOf(error)).toBe('OTP_EXPIRED');
    expect(error.message).toBe('This verification code has expired. Please request a new code.');
  });

  it('refuses another code before the cooldown has passed', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-29T10:00:00Z') });
    const { service, sent } = setup();
    const { token } = await service.start(USER, {});

    jest.setSystemTime(new Date('2026-09-29T10:00:10Z'));
    await expect(service.resend(token)).rejects.toMatchObject({ code: 'OTP_RESEND_COOLDOWN' });
    expect(sent).toHaveLength(1);
  });

  it('a new code replaces the old one', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-29T10:00:00Z') });
    const { service, lastCode, sent } = setup();
    const { token } = await service.start(USER, {});
    const first = lastCode();

    jest.setSystemTime(new Date('2026-09-29T10:00:21Z'));
    const view = await service.resend(token);
    const second = lastCode();
    expect(sent).toHaveLength(2);
    expect(view.expiresInSeconds).toBe(20);

    if (first !== second) await expect(service.verify(token, first)).rejects.toMatchObject({ code: 'OTP_INVALID' });
    await expect(service.verify(token, second)).resolves.toMatchObject({ id: USER.id });
  });

  it('cannot be guessed at forever: a sign-in sends a limited number of codes, then ends', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-29T10:00:00Z') });
    const { service, sent } = setup({ env: { OTP_MAX_CODES: '3' } });
    const { token } = await service.start(USER, {});
    let now = Date.parse('2026-09-29T10:00:00Z');

    for (let i = 0; i < 2; i += 1) {
      now += 21_000;
      jest.setSystemTime(now);
      await service.resend(token);
    }
    expect(sent).toHaveLength(3);
    now += 21_000;
    jest.setSystemTime(now);
    await expect(service.resend(token)).rejects.toMatchObject({ code: 'OTP_SESSION_ENDED' });
    expect(sent).toHaveLength(3);
  });

  it('ends the challenge after 15 minutes whatever else happened', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-29T10:00:00Z') });
    const { service } = setup();
    const { token } = await service.start(USER, {});

    jest.setSystemTime(new Date('2026-09-29T10:15:01Z'));
    await expect(service.describe(token)).rejects.toMatchObject({ code: 'OTP_SESSION_ENDED' });
    await expect(service.resend(token)).rejects.toMatchObject({ code: 'OTP_SESSION_ENDED' });
  });

  it('a new sign-in cancels the previous challenge of that user', async () => {
    const { service, lastCode } = setup();
    const first = await service.start(USER, {});
    const firstCode = lastCode();
    const second = await service.start(USER, {});

    await expect(service.verify(first.token, firstCode)).rejects.toMatchObject({ code: 'OTP_SESSION_ENDED' });
    await expect(service.verify(second.token, lastCode())).resolves.toMatchObject({ id: USER.id });
  });

  it('knows nothing without the challenge token, or with a made-up one', async () => {
    const { service } = setup();
    await service.start(USER, {});
    await expect(service.verify(undefined, '123456')).rejects.toMatchObject({ code: 'OTP_SESSION_ENDED' });
    await expect(service.verify('made-up-token', '123456')).rejects.toMatchObject({ code: 'OTP_SESSION_ENDED' });
  });

  it('gives no session to an account that was deactivated in the meantime', async () => {
    const { service, lastCode, challenges } = setup();
    const { token } = await service.start(USER, {});
    challenges.user.status = 'DEACTIVATED';
    await expect(service.verify(token, lastCode())).rejects.toMatchObject({ code: 'OTP_SESSION_ENDED' });
  });

  it('cancel ends the pending challenge (logout, back to sign in)', async () => {
    const { service, lastCode } = setup();
    const { token } = await service.start(USER, {});
    await service.cancel(token);
    await expect(service.verify(token, lastCode())).rejects.toMatchObject({ code: 'OTP_SESSION_ENDED' });
  });

  describe('when the e-mail cannot be sent', () => {
    it('production: fails with the generic sentence, opens nothing, leaks nothing of the provider', async () => {
      const { service, challenges } = setup({ email: 'throws' });
      const error = await service.start(USER, {}).catch((e) => e);

      expect(codeOf(error)).toBe('OTP_SEND_FAILED');
      expect(error.message).toBe('Unable to send the verification code. Please try again.');
      expect(JSON.stringify(error)).not.toContain('ECONNREFUSED');
      expect(challenges.rows[0]!.status).toBe('CANCELLED');
    });

    it('production: an unconfigured mail transport is a failure too — the code is never handed to the browser', async () => {
      const { service } = setup({ email: 'unconfigured' });
      await expect(service.start(USER, {})).rejects.toMatchObject({ code: 'OTP_SEND_FAILED' });
    });

    it('development: the code is returned for the verification page, so a box without a mail server can sign in', async () => {
      const { service } = setup({ email: 'throws', env: { NODE_ENV: 'development' } });
      const { token, view } = await service.start(USER, {});
      expect(view.devCode).toMatch(/^\d{6}$/);
      await expect(service.verify(token, view.devCode!)).resolves.toMatchObject({ id: USER.id });
    });

    it('development with OTP_DEV_FALLBACK=false behaves like production', async () => {
      const { service } = setup({ email: 'throws', env: { NODE_ENV: 'development', OTP_DEV_FALLBACK: 'false' } });
      await expect(service.start(USER, {})).rejects.toMatchObject({ code: 'OTP_SEND_FAILED' });
    });

    it('a delivered e-mail never comes with the code in the response, in development either', async () => {
      const { service } = setup({ email: 'delivers', env: { NODE_ENV: 'development' } });
      const { view } = await service.start(USER, {});
      expect(view).not.toHaveProperty('devCode');
    });
  });

  it('writes the events to the audit log, never the code or the token', async () => {
    const { service, audit, lastCode, wrong } = setup();
    const { token } = await service.start(USER, {});
    const code = lastCode();
    await service.verify(token, wrong(code)).catch(() => undefined);
    await service.verify(token, code);

    const actions = audit.record.mock.calls.map((call) => (call as unknown as [{ action: string }])[0].action);
    expect(actions).toEqual(['LOGIN_OTP_SENT', 'LOGIN_OTP_FAILED', 'LOGIN_OTP_VERIFIED']);
    const logged = JSON.stringify(audit.record.mock.calls);
    expect(logged).not.toContain(code);
    expect(logged).not.toContain(token);
  });

  it('masks the e-mail address', () => {
    expect(maskEmail('theodhos@example.com')).toBe('t***@example.com');
    expect(maskEmail('a@b.co')).toBe('a***@b.co');
  });
});
