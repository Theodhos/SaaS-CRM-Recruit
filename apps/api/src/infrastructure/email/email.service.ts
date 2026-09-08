import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

/**
 * Thin, swappable wrapper around the configured EMAIL_PROVIDER (SMTP/SES/
 * SendGrid — see .env.example). apps/api enqueues outbound email through
 * apps/worker's email processor rather than calling this synchronously from
 * a request handler; this service is the shared primitive both use.
 *
 * Skeleton only: transport wiring (nodemailer, @aws-sdk/client-sesv2, etc.)
 * lands with the emails module implementation in Phase 2.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  async send(input: SendEmailInput): Promise<void> {
    const provider = this.config.get<string>('EMAIL_PROVIDER', 'smtp');
    this.logger.debug(
      `[stub] send via ${provider} -> ${[input.to].flat().join(', ')}: ${input.subject}`,
    );
    throw new Error(
      'EmailService.send() is not implemented yet — see apps/worker email processor (Phase 2).',
    );
  }
}
