import { createHash, randomBytes } from 'crypto';

import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';

import { AppException } from '../../../common/exceptions/app.exception';
import { DatabaseService } from '../../../infrastructure/database/database.service';
import { EmailService } from '../../../infrastructure/email/email.service';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';

import { maskEmail, type RequestContext } from './login-otp.service';

const LINK_LIFETIME_MINUTES = 30;

export interface ResetRequestResult {
  /** Always true: the answer is the same whether or not the e-mail belongs to an account. */
  requested: true;
  /** Development servers without a mail server only: the link that would have been e-mailed. */
  devLink?: string;
}

/**
 * A forgotten password cannot be sent back — only its bcrypt hash is stored — so what is e-mailed is a link, good
 * once and for 30 minutes, to choose a new one. The link carries a random token; only its SHA-256 is kept. Asking
 * for a link always answers the same, so it cannot be used to find out which e-mails have an account.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Where the link points: WEB_URL when set; otherwise the web app the request came from, as long as it is one of
   * ours (CORS_ORIGINS) — never an address an outsider could put in the header; otherwise the first of ours.
   */
  private webUrl(origin?: string): string {
    const ours = this.config.get<string>('CORS_ORIGINS', 'http://localhost:3000').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);
    const configured = this.config.get<string>('WEB_URL')?.trim().replace(/\/$/, '');
    if (configured) return configured;
    const from = origin?.trim().replace(/\/$/, '');
    return from && ours.includes(from) ? from : (ours[0] ?? 'http://localhost:3000');
  }

  private get devFallbackAllowed(): boolean {
    return this.config.get('NODE_ENV') !== 'production' && this.config.get('OTP_DEV_FALLBACK', 'true') !== 'false';
  }

  /** "Forgot password" on the sign-in page. */
  async requestByEmail(email: string, context: RequestContext): Promise<ResetRequestResult> {
    const matches = await this.db.client.user.findMany({ where: { email }, select: { id: true, organisationId: true, email: true, firstName: true, status: true } });
    const user = matches.length === 1 && matches[0]!.status === 'ACTIVE' ? matches[0]! : null;
    if (!user) return { requested: true };
    return this.send(user, context);
  }

  /** "Send me a password reset e-mail" on My Profile — for the signed-in user's own address. */
  async requestForUser(userId: string, context: RequestContext): Promise<ResetRequestResult> {
    const user = await this.db.client.user.findUnique({ where: { id: userId }, select: { id: true, organisationId: true, email: true, firstName: true, status: true } });
    if (!user || user.status !== 'ACTIVE') return { requested: true };
    return this.send(user, context);
  }

  private async send(user: { id: string; organisationId: string; email: string; firstName: string }, context: RequestContext): Promise<ResetRequestResult> {
    const token = randomBytes(32).toString('base64url');
    // one live link per user: asking again replaces the previous one
    await this.db.client.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await this.db.client.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(token),
        expiresAt: new Date(Date.now() + LINK_LIFETIME_MINUTES * 60_000),
        requestIp: context.ip?.slice(0, 64),
        userAgent: context.userAgent?.slice(0, 300),
      },
    });
    const link = `${this.webUrl(context.origin)}/reset-password?token=${token}`;

    let delivered = false;
    try {
      const result = await this.email.send({
        to: user.email,
        subject: 'Reset your password',
        text: `Hello ${user.firstName},\n\nUse this link to choose a new password:\n\n${link}\n\nThe link works once and expires in ${LINK_LIFETIME_MINUTES} minutes.\n\nIf you did not ask for it, you can safely ignore this email — your password stays as it is.`,
        html: `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:15px;color:#111;max-width:480px">
<p>Hello ${user.firstName},</p>
<p>Use this link to choose a new password:</p>
<p><a href="${link}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Choose a new password</a></p>
<p>The link works once and expires in ${LINK_LIFETIME_MINUTES} minutes.</p>
<p style="color:#666">If you did not ask for it, you can safely ignore this email — your password stays as it is.</p>
</div>`,
      });
      delivered = result.delivered;
    } catch (error) {
      this.logger.error(`Password reset e-mail could not be sent to ${maskEmail(user.email)}: ${error instanceof Error ? error.message : String(error)}`);
    }
    await this.auditLogs.record({ organisationId: user.organisationId, userId: user.id, action: 'PASSWORD_RESET_REQUESTED', entityType: 'User', entityId: user.id, newValues: { delivered } });

    if (delivered) return { requested: true };
    if (this.devFallbackAllowed) {
      this.logger.warn(`Password reset e-mail not delivered (no working mail server) — development fallback: the link is shown on the page for ${maskEmail(user.email)}.`);
      return { requested: true, devLink: link };
    }
    throw new AppException('RESET_SEND_FAILED', 'Unable to send the e-mail. Please try again.', HttpStatus.SERVICE_UNAVAILABLE);
  }

  /** The link was opened and a new password chosen. */
  async reset(token: string, password: string): Promise<{ success: true }> {
    const invalid = () => new AppException('RESET_LINK_INVALID', 'This link is no longer valid. Please request a new one.', HttpStatus.BAD_REQUEST);
    const request = await this.db.client.passwordReset.findUnique({ where: { tokenHash: this.hash(token) }, include: { user: { select: { id: true, organisationId: true, status: true } } } });
    if (!request || request.usedAt || request.expiresAt.getTime() <= Date.now() || request.user.status !== 'ACTIVE') throw invalid();

    // single use: only the request that marks it used goes on
    const claimed = await this.db.client.passwordReset.updateMany({ where: { id: request.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) throw invalid();

    const passwordHash = await bcrypt.hash(password, Number(this.config.get('PASSWORD_SALT_ROUNDS', 12)));
    await this.db.client.user.update({ where: { id: request.userId }, data: { passwordHash } });
    // a sign-in that was waiting for its code was started with the old password
    await this.db.client.loginChallenge.updateMany({ where: { userId: request.userId, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    await this.auditLogs.record({ organisationId: request.user.organisationId, userId: request.userId, action: 'PASSWORD_RESET', entityType: 'User', entityId: request.userId, newValues: { passwordChanged: true } });
    return { success: true };
  }
}
