import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { EmailService } from '../../../infrastructure/email/email.service';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import type { UpdateOrganisationDto } from '../dto';
import { OrganisationsRepository } from '../repositories/organisations.repository';

export interface PayDefaults {
  currency: string;
  hoursPerDay: number;
  daysPerMonth: number;
  /** Null = no standard fee: it is typed per person. */
  feePercent: number | null;
  paymentTermDays: number;
}

const PAY_DEFAULTS: PayDefaults = { currency: 'USD', hoursPerDay: 8, daysPerMonth: 21, feePercent: null, paymentTermDays: 30 };

function payDefaultsFrom(settings: unknown): PayDefaults {
  const saved = (settings && typeof settings === 'object' ? (settings as { payDefaults?: Partial<PayDefaults> }).payDefaults : undefined) ?? {};
  return {
    currency: typeof saved.currency === 'string' ? saved.currency : PAY_DEFAULTS.currency,
    hoursPerDay: typeof saved.hoursPerDay === 'number' ? saved.hoursPerDay : PAY_DEFAULTS.hoursPerDay,
    daysPerMonth: typeof saved.daysPerMonth === 'number' ? saved.daysPerMonth : PAY_DEFAULTS.daysPerMonth,
    feePercent: typeof saved.feePercent === 'number' ? saved.feePercent : PAY_DEFAULTS.feePercent,
    paymentTermDays: typeof saved.paymentTermDays === 'number' ? saved.paymentTermDays : PAY_DEFAULTS.paymentTermDays,
  };
}

/**
 * The organisation's own settings: its name, and the values the pay calculation and the fees start from (currency,
 * hours per day, days per month, fee %, days to pay). Kept in `Organisation.settings`.
 */
@Injectable()
export class OrganisationsService {
  constructor(
    private readonly repository: OrganisationsRepository,
    private readonly auditLogs: AuditLogsService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  private present(organisation: { id: string; name: string; slug: string; logoUrl: string | null; status: string; settings: unknown; createdAt: Date }) {
    const { settings, ...rest } = organisation;
    return { ...rest, payDefaults: payDefaultsFrom(settings) };
  }

  async current(organisationId: string) {
    const organisation = await this.repository.findById(organisationId);
    if (!organisation) throw new ResourceNotFoundException('Organisation', organisationId);
    return this.present(organisation);
  }

  async update(organisationId: string, userId: string, dto: UpdateOrganisationDto) {
    const existing = await this.repository.findById(organisationId);
    if (!existing) throw new ResourceNotFoundException('Organisation', organisationId);
    const settings = existing.settings && typeof existing.settings === 'object' && !Array.isArray(existing.settings) ? (existing.settings as Record<string, unknown>) : {};
    const payDefaults = dto.payDefaults
      ? { ...payDefaultsFrom(settings), ...dto.payDefaults, ...(dto.payDefaults.currency ? { currency: dto.payDefaults.currency.toUpperCase() } : {}) }
      : undefined;

    const organisation = await this.repository.update(organisationId, {
      ...(dto.name ? { name: dto.name.trim() } : {}),
      ...(payDefaults ? { settings: { ...settings, payDefaults } } : {}),
    });
    await this.auditLogs.record({ organisationId, userId, action: 'UPDATE_ORGANISATION', entityType: 'Organisation', entityId: organisationId, newValues: dto });
    return this.present(organisation);
  }

  /** What the platform is connected to — names only, never a key or a password. Read from the server's configuration. */
  integrations() {
    const has = (...keys: string[]) => keys.every((key) => Boolean(this.config.get<string>(key)));
    const storage = this.config.get<string>('STORAGE_PROVIDER', 's3');
    const smtpHost = this.config.get<string>('SMTP_HOST') ?? '';
    // a test mailbox on this machine (MailHog, Mailpit…) catches the e-mails: nothing reaches a real address
    const smtpIsLocal = /^(localhost|127.0.0.1|mailhog|mailpit)$/i.test(smtpHost);
    const emailReady = this.email.isConfigured() && !smtpIsLocal;
    const otpBySupabase = this.config.get('OTP_DELIVERY', 'smtp') === 'supabase' && has('SUPABASE_URL', 'SUPABASE_ANON_KEY');
    return [
      {
        key: 'email',
        name: 'E-mail (SMTP)',
        connected: emailReady,
        detail: emailReady
          ? `Sends through ${smtpHost}`
          : smtpIsLocal
            ? `Points at a test mailbox on this machine (${smtpHost}): interview invitations and password reset links do not reach real addresses.`
            : 'Not set up: interview invitations and password reset links are not delivered.',
        needs: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'],
      },
      {
        key: 'loginCode',
        name: 'Login verification code',
        connected: otpBySupabase || emailReady,
        detail: otpBySupabase ? 'Sent and checked by Supabase Auth.' : emailReady ? 'Sent by e-mail (SMTP).' : 'No way to send it yet.',
        needs: ['OTP_DELIVERY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'],
      },
      {
        key: 'zoom',
        name: 'Zoom',
        connected: has('ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'),
        detail: has('ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET') ? 'Interview meetings are created automatically.' : 'Not connected: meetings cannot be created from the pipeline yet.',
        needs: ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'],
      },
      {
        key: 'telephony',
        name: 'Calls (Twilio)',
        connected: has('TWILIO_ACCOUNT_SID', 'TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET', 'TWILIO_TWIML_APP_SID', 'TWILIO_CALLER_ID'),
        detail: has('TWILIO_ACCOUNT_SID', 'TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET', 'TWILIO_TWIML_APP_SID', 'TWILIO_CALLER_ID')
          ? 'Calls are made from the browser.'
          : 'Not connected: Call opens the phone app instead.',
        needs: ['TWILIO_ACCOUNT_SID', 'TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET', 'TWILIO_TWIML_APP_SID', 'TWILIO_CALLER_ID'],
      },
      {
        key: 'storage',
        name: 'File storage',
        connected: storage !== 'local',
        detail: storage === 'local' ? 'Files are kept on this server’s disk — fine for one machine, not for production.' : `Files are kept in ${storage.toUpperCase()} storage (${this.config.get<string>('STORAGE_BUCKET') ?? 'bucket'}).`,
        needs: ['STORAGE_PROVIDER', 'STORAGE_ENDPOINT', 'STORAGE_BUCKET', 'STORAGE_ACCESS_KEY_ID', 'STORAGE_SECRET_ACCESS_KEY'],
      },
    ];
  }
}
