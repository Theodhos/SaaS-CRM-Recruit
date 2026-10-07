import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  /** Where the recipient's reply should go (e.g. the instructor who sent an interview invitation). */
  replyTo?: string;
}

export interface SendEmailResult {
  /** False when no transport is configured — the message was only logged, nothing left the platform. */
  delivered: boolean;
  provider: 'smtp' | 'log';
  messageId: string | null;
}

/**
 * Thin wrapper around the configured EMAIL_PROVIDER (see .env.example). `smtp` sends through nodemailer using
 * SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / SMTP_FROM; `log` (or an unset SMTP_HOST) only logs the message,
 * so a development box without a mail server never blocks a feature — callers get `delivered: false` and can tell
 * the user. Transport errors (unreachable host, refused login) are thrown for the caller to report.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  /** True when outbound mail can actually leave the platform. */
  isConfigured(): boolean {
    return this.config.get<string>('EMAIL_PROVIDER', 'smtp') !== 'log' && Boolean(this.config.get<string>('SMTP_HOST'));
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const to = [input.to].flat();
    if (!this.isConfigured()) {
      this.logger.log(`[not delivered: e-mail transport not configured] -> ${to.join(', ')}: ${input.subject}`);
      return { delivered: false, provider: 'log', messageId: null };
    }

    const info = await this.transport().sendMail({
      from: this.config.get<string>('SMTP_FROM') ?? this.config.get<string>('SMTP_USER'),
      to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      replyTo: input.replyTo,
    });
    this.logger.log(`Sent "${input.subject}" to ${to.join(', ')} (${info.messageId})`);
    return { delivered: true, provider: 'smtp', messageId: info.messageId ?? null };
  }

  private transport(): Transporter {
    if (this.transporter) return this.transporter;
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER');
    this.transporter = createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port,
      secure: port === 465,
      auth: user ? { user, pass: this.config.get<string>('SMTP_PASSWORD') } : undefined,
      // fail fast when the mail server is down instead of holding the request for minutes
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
    return this.transporter;
  }
}
