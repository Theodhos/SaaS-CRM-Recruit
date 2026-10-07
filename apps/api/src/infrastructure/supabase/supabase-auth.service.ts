import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * The e-mail one-time code of Supabase Auth, used for the second step of signing in (see LoginOtpService): Supabase
 * generates the code, e-mails it and checks it. The platform's own users, passwords and sessions stay where they
 * are — Supabase Auth is only asked "send this address a code" and "is this the code".
 *
 * Needs SUPABASE_URL and SUPABASE_ANON_KEY. SUPABASE_SERVICE_ROLE_KEY is used for one thing only, on development
 * servers: obtaining a code without an e-mail when the e-mail could not be sent. It never leaves the API.
 *
 * In the Supabase dashboard (Authentication -> Emails) the "Magic Link" and "Confirm signup" templates must show
 * the code — {{ .Token }} — for the e-mail to contain it; out of the box they only contain a link.
 */
@Injectable()
export class SupabaseAuthService {
  private readonly logger = new Logger(SupabaseAuthService.name);

  constructor(private readonly config: ConfigService) {}

  private get url(): string | undefined {
    return this.config.get<string>('SUPABASE_URL')?.replace(/\/$/, '');
  }

  private get anonKey(): string | undefined {
    return this.config.get<string>('SUPABASE_ANON_KEY');
  }

  isConfigured(): boolean {
    return Boolean(this.url && this.anonKey);
  }

  private async post(path: string, key: string, body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> | null }> {
    const response = await fetch(`${this.url}/auth/v1${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: key, authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    return { ok: response.ok, status: response.status, data };
  }

  /** Asks Supabase to e-mail a code to the address. False when it refused (rate limit, address not allowed, …). */
  async sendCode(email: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const result = await this.post('/otp', this.anonKey!, { email, create_user: true });
      if (!result.ok) {
        // Supabase's own words stay in the server log
        this.logger.error(`Supabase did not send the code (${result.status}): ${String(result.data?.msg ?? result.data?.error_description ?? result.data?.message ?? '')}`);
      }
      return result.ok;
    } catch (error) {
      this.logger.error(`Supabase could not be reached: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /** Whether this is the code Supabase sent to the address. A code is accepted once. */
  async verifyCode(email: string, code: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      for (const type of ['email', 'signup'] as const) {
        const result = await this.post('/verify', this.anonKey!, { type, email, token: code });
        if (result.ok) return true;
      }
      return false;
    } catch (error) {
      this.logger.error(`Supabase could not be reached: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /** Development fallback: a code for the address without an e-mail (service role). Null when unavailable. */
  async generateCode(email: string): Promise<string | null> {
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!this.url || !serviceKey) return null;
    try {
      const result = await this.post('/admin/generate_link', serviceKey, { type: 'magiclink', email });
      const code = result.data?.email_otp ?? (result.data?.properties as Record<string, unknown> | undefined)?.email_otp;
      return result.ok && typeof code === 'string' ? code : null;
    } catch {
      return null;
    }
  }
}
