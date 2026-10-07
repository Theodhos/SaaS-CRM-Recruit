import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';

import { HttpStatus, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppException } from '../../../common/exceptions/app.exception';
import { EmailService } from '../../../infrastructure/email/email.service';
import { SupabaseAuthService } from '../../../infrastructure/supabase/supabase-auth.service';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import { LoginChallengesRepository, type ChallengeUser, type StoredChallenge } from '../repositories/login-challenges.repository';

export interface RequestContext {
  ip?: string;
  userAgent?: string;
  /** The Origin header: which of our web apps the request came from. */
  origin?: string;
}

/** What the browser is told about a pending challenge — never the code, never an id. */
export interface ChallengeView {
  /** The registered address, masked: "t***@gmail.com". */
  emailHint: string;
  codeLength: number;
  /** Seconds until the code that was just sent stops working. */
  expiresInSeconds: number;
  /** Seconds until another code may be requested. */
  resendInSeconds: number;
  /**
   * Development only, and only when the e-mail could not leave this machine (no mail server): the code itself, so
   * a developer can still sign in. Never present in production (see `devFallbackAllowed`).
   */
  devCode?: string;
}

/** The challenge as a whole: long enough for a resend or two, short enough that an abandoned login dies. */
const CHALLENGE_LIFETIME_MINUTES = 15;
/** Stored in place of a code hash when Supabase Auth holds the code (OTP_DELIVERY=supabase). */
const HELD_BY_SUPABASE = 'supabase';
/** Supabase Auth sends one e-mail per address per minute at most. */
const SUPABASE_MIN_SECONDS_BETWEEN_CODES = 60;

const INVALID = () => new AppException('OTP_INVALID', 'Invalid verification code.', HttpStatus.UNAUTHORIZED);
const EXPIRED = () => new AppException('OTP_EXPIRED', 'This verification code has expired. Please request a new code.', HttpStatus.UNAUTHORIZED);
const LOCKED = () => new AppException('OTP_LOCKED', 'Too many attempts. Please request a new verification code.', HttpStatus.TOO_MANY_REQUESTS);
const NO_CHALLENGE = () => new AppException('OTP_SESSION_ENDED', 'Your sign-in has expired. Please sign in again.', HttpStatus.UNAUTHORIZED);
const COOLDOWN = () => new AppException('OTP_RESEND_COOLDOWN', 'Please wait before requesting another code.', HttpStatus.TOO_MANY_REQUESTS);
const SEND_FAILED = () => new AppException('OTP_SEND_FAILED', 'Unable to send the verification code. Please try again.', HttpStatus.SERVICE_UNAVAILABLE);

export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

/**
 * The second step of every login. After the password is confirmed (AuthService.verifyCredentials) a challenge is
 * opened: a code of OTP_LENGTH (6) digits from the OS random source is e-mailed to the registered address, and only its HMAC is
 * kept. The browser holds an opaque random token (httpOnly cookie) that names the challenge; only its SHA-256 is
 * kept. The session is issued by AuthService once `verify` returns the user — never before.
 *
 * Codes rotate: each one lives OTP_EXPIRATION_SECONDS (20) and the verification page asks for the next one as soon
 * as it runs out, so there is always a fresh code and an intercepted one is useless moments later.
 *
 * Limits enforced here, on the server: a code takes OTP_MAX_ATTEMPTS (5) wrong tries and is then dead; the next
 * code needs OTP_RESEND_COOLDOWN_SECONDS (20) since the last one and replaces it; a challenge sends at most
 * OTP_MAX_CODES (15) codes and ends after 15 minutes; opening a new challenge cancels the user's others.
 *
 * Who sends the code — OTP_DELIVERY:
 *   smtp (default)  the code is made here and e-mailed through EmailService;
 *   supabase        Supabase Auth makes it, e-mails it and checks it (SupabaseAuthService). Every limit above still
 *                   applies here; Supabase adds its own: one e-mail per address per minute.
 */
@Injectable()
export class LoginOtpService {
  private readonly logger = new Logger(LoginOtpService.name);

  constructor(
    private readonly challenges: LoginChallengesRepository,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly auditLogs: AuditLogsService,
    @Optional() private readonly supabase?: SupabaseAuthService,
  ) {}

  private get viaSupabase(): boolean {
    return this.config.get('OTP_DELIVERY', 'smtp') === 'supabase' && Boolean(this.supabase?.isConfigured());
  }

  private get expirationSeconds(): number {
    return Number(this.config.get('OTP_EXPIRATION_SECONDS', 20)) || 20;
  }

  private get maxCodes(): number {
    return Number(this.config.get('OTP_MAX_CODES', 15)) || 15;
  }

  /**
   * Digits in a code: OTP_LENGTH, 6 to 10. When Supabase sends the codes this has to be the length set in the
   * Supabase dashboard (Authentication -> Providers -> Email -> Email OTP Length).
   */
  private get codeLength(): number {
    const configured = Math.trunc(Number(this.config.get('OTP_LENGTH', 6))) || 6;
    return Math.min(10, Math.max(6, configured));
  }

  private get maxAttempts(): number {
    return Number(this.config.get('OTP_MAX_ATTEMPTS', 5)) || 5;
  }

  private get resendCooldownSeconds(): number {
    const configured = Number(this.config.get('OTP_RESEND_COOLDOWN_SECONDS', 20)) || 20;
    return this.viaSupabase ? Math.max(configured, SUPABASE_MIN_SECONDS_BETWEEN_CODES) : configured;
  }

  /** Showing the code on screen is a development affordance only, and can be switched off there too. */
  private get devFallbackAllowed(): boolean {
    return this.config.get('NODE_ENV') !== 'production' && this.config.get('OTP_DEV_FALLBACK', 'true') !== 'false';
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Keyed, and bound to the challenge: a hash from one challenge says nothing about another. */
  private hashCode(challengeId: string, code: string): string {
    const secret = this.config.get<string>('OTP_SECRET') ?? this.config.get<string>('JWT_ACCESS_SECRET') ?? '';
    return createHmac('sha256', secret).update(`${challengeId}:${code}`).digest('hex');
  }

  private newCode(): string {
    return String(randomInt(0, 10 ** this.codeLength)).padStart(this.codeLength, '0');
  }

  private view(user: ChallengeUser, challenge: { expiresAt: Date; lastSentAt: Date }, devCode?: string): ChallengeView {
    const now = Date.now();
    return {
      emailHint: maskEmail(user.email),
      codeLength: this.codeLength,
      expiresInSeconds: Math.max(0, Math.ceil((challenge.expiresAt.getTime() - now) / 1000)),
      resendInSeconds: Math.max(0, Math.ceil((challenge.lastSentAt.getTime() + this.resendCooldownSeconds * 1000 - now) / 1000)),
      ...(devCode ? { devCode } : {}),
    };
  }

  private async record(user: ChallengeUser, action: string, details?: Record<string, unknown>): Promise<void> {
    // never the code, never a token
    await this.auditLogs.record({ organisationId: user.organisationId, userId: user.id, action, entityType: 'User', entityId: user.id, newValues: details });
  }

  /**
   * E-mails the code. Returns the code back only when it could not be delivered AND this is a development box
   * allowed to show it; throws OTP_SEND_FAILED otherwise — the user is never told a code was sent when it was not.
   */
  private async deliver(user: ChallengeUser, code: string): Promise<string | undefined> {
    if (this.viaSupabase) {
      if (await this.supabase!.sendCode(user.email)) return undefined;
      const fallback = this.devFallbackAllowed ? await this.supabase!.generateCode(user.email) : null;
      if (!fallback) throw SEND_FAILED();
      this.logger.warn(`Supabase did not e-mail the code — development fallback: the code is shown on the verification page for ${maskEmail(user.email)}.`);
      return fallback;
    }

    const seconds = this.expirationSeconds;
    const lifetime = seconds >= 120 ? `${Math.round(seconds / 60)} minutes` : `${seconds} seconds`;
    let delivered = false;
    try {
      const result = await this.email.send({
        to: user.email,
        subject: 'Your verification code',
        text: `Your verification code is:\n\n${code}\n\nThis code expires in ${lifetime}.\n\nIf you did not attempt to sign in, you can safely ignore this email.`,
        html: `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:15px;color:#111;max-width:480px">
<p>Your verification code is:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:16px 0">${code}</p>
<p>This code expires in ${lifetime}.</p>
<p style="color:#666">If you did not attempt to sign in, you can safely ignore this email.</p>
</div>`,
      });
      delivered = result.delivered;
    } catch (error) {
      // the provider's message stays in the server log; the browser gets the generic sentence
      this.logger.error(`Verification e-mail could not be sent to ${maskEmail(user.email)}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (delivered) return undefined;
    if (this.devFallbackAllowed) {
      this.logger.warn(`Verification e-mail not delivered (no working mail server) — development fallback: the code is shown on the verification page for ${maskEmail(user.email)}.`);
      return code;
    }
    throw SEND_FAILED();
  }

  /** Password confirmed: open the challenge and send the first code. Returns the token for the browser's cookie. */
  async start(user: ChallengeUser, context: RequestContext): Promise<{ token: string; view: ChallengeView }> {
    await this.challenges.cancelPendingForUser(user.id);

    const token = randomBytes(32).toString('base64url');
    const code = this.newCode();
    const now = Date.now();
    const challenge = await this.challenges.create({
      userId: user.id,
      tokenHash: this.hashToken(token),
      // the id is not known before the row exists: a placeholder, replaced right below
      codeHash: '',
      expiresAt: new Date(now + this.expirationSeconds * 1000),
      closesAt: new Date(now + CHALLENGE_LIFETIME_MINUTES * 60_000),
      maxAttempts: this.maxAttempts,
      requestIp: context.ip?.slice(0, 64),
      userAgent: context.userAgent?.slice(0, 300),
    });
    await this.challenges.update(challenge.id, { codeHash: this.viaSupabase ? HELD_BY_SUPABASE : this.hashCode(challenge.id, code) });

    let devCode: string | undefined;
    try {
      devCode = await this.deliver(user, code);
    } catch (error) {
      await this.challenges.update(challenge.id, { status: 'CANCELLED' });
      await this.record(user, 'LOGIN_OTP_SEND_FAILED');
      throw error;
    }
    await this.record(user, 'LOGIN_OTP_SENT', { delivered: !devCode });
    return { token, view: this.view(user, challenge, devCode) };
  }

  /** The challenge named by the browser's token, if it is still open. */
  private async open(token: string | undefined): Promise<StoredChallenge> {
    if (!token) throw NO_CHALLENGE();
    const challenge = await this.challenges.findByTokenHash(this.hashToken(token));
    if (!challenge || challenge.status !== 'PENDING') throw NO_CHALLENGE();
    if (challenge.closesAt.getTime() <= Date.now()) {
      await this.challenges.update(challenge.id, { status: 'EXPIRED' });
      throw NO_CHALLENGE();
    }
    if (challenge.user.status !== 'ACTIVE') throw NO_CHALLENGE();
    return challenge;
  }

  /** What the verification page shows when it is opened or reloaded. */
  async describe(token: string | undefined): Promise<ChallengeView> {
    const challenge = await this.open(token);
    return this.view(challenge.user, challenge);
  }

  /** Confirms the code. Returns the user the session is to be issued for. */
  async verify(token: string | undefined, code: string): Promise<ChallengeUser> {
    const challenge = await this.open(token);
    const user = challenge.user;

    if (challenge.attempts >= challenge.maxAttempts) {
      await this.record(user, 'LOGIN_OTP_LOCKED');
      throw LOCKED();
    }
    if (challenge.expiresAt.getTime() <= Date.now()) {
      await this.record(user, 'LOGIN_OTP_EXPIRED');
      throw EXPIRED();
    }

    // Count the try first, atomically: parallel guesses cannot all slip under the limit.
    const counted = await this.challenges.countAttempt(challenge.id, challenge.maxAttempts);
    if (!counted) {
      await this.record(user, 'LOGIN_OTP_LOCKED');
      throw LOCKED();
    }

    let matches: boolean;
    if (challenge.codeHash === HELD_BY_SUPABASE) {
      matches = Boolean(await this.supabase?.verifyCode(user.email, code));
    } else {
      const expected = Buffer.from(challenge.codeHash, 'hex');
      const given = Buffer.from(this.hashCode(challenge.id, code), 'hex');
      matches = expected.length === given.length && expected.length > 0 && timingSafeEqual(expected, given);
    }
    if (!matches) {
      await this.record(user, 'LOGIN_OTP_FAILED', { attempt: challenge.attempts + 1 });
      throw challenge.attempts + 1 >= challenge.maxAttempts ? LOCKED() : INVALID();
    }

    // Single use: only the request that flips PENDING -> VERIFIED gets the session.
    const claimed = await this.challenges.claim(challenge.id);
    if (!claimed) throw NO_CHALLENGE();
    await this.challenges.cancelPendingForUser(user.id);
    await this.record(user, 'LOGIN_OTP_VERIFIED');
    return user;
  }

  /** A new code replaces the current one. The attempt count of the challenge's codes starts again with it. */
  async resend(token: string | undefined): Promise<ChallengeView> {
    const challenge = await this.open(token);
    const user = challenge.user;

    const waitMs = challenge.lastSentAt.getTime() + this.resendCooldownSeconds * 1000 - Date.now();
    if (waitMs > 0) throw COOLDOWN();
    if (challenge.sendCount >= this.maxCodes) {
      await this.challenges.update(challenge.id, { status: 'CANCELLED' });
      await this.record(user, 'LOGIN_OTP_RESEND_LIMIT');
      throw NO_CHALLENGE();
    }

    const code = this.newCode();
    const now = new Date();
    const updated = await this.challenges.update(challenge.id, {
      codeHash: this.viaSupabase ? HELD_BY_SUPABASE : this.hashCode(challenge.id, code),
      expiresAt: new Date(now.getTime() + this.expirationSeconds * 1000),
      lastSentAt: now,
      sendCount: challenge.sendCount + 1,
      attempts: 0,
    });
    const devCode = await this.deliver(user, code);
    await this.record(user, 'LOGIN_OTP_RESENT', { delivered: !devCode, codesSent: updated.sendCount });
    return this.view(user, updated, devCode);
  }

  /** Logout, or "back to sign in": whatever was pending for this browser is over. */
  async cancel(token: string | undefined): Promise<void> {
    if (!token) return;
    const challenge = await this.challenges.findByTokenHash(this.hashToken(token));
    if (challenge?.status === 'PENDING') await this.challenges.update(challenge.id, { status: 'CANCELLED' });
  }
}
