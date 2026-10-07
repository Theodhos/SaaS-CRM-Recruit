import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppException } from '../../common/exceptions/app.exception';

export interface CreateZoomMeetingInput {
  topic: string;
  startTime: Date;
  durationMinutes: number;
  timezone?: string;
  agenda?: string;
}

export interface ZoomMeeting {
  meetingId: string;
  /** For the participant (the candidate). */
  joinUrl: string;
  /** For the host — carries the host key, never sent to the candidate. */
  startUrl: string;
  password: string | null;
}

/**
 * Zoom meetings through a Server-to-Server OAuth app (ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET, scope
 * `meeting:write:admin` or `meeting:write`). Meetings are created under the app owner's Zoom user (`users/me`).
 * Unconfigured is a normal state: `isConfigured()` is false and callers fall back to a pasted meeting link.
 */
@Injectable()
export class ZoomService {
  private readonly logger = new Logger(ZoomService.name);
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('ZOOM_ACCOUNT_ID') && this.config.get<string>('ZOOM_CLIENT_ID') && this.config.get<string>('ZOOM_CLIENT_SECRET'),
    );
  }

  async createMeeting(input: CreateZoomMeetingInput): Promise<ZoomMeeting> {
    const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: { authorization: `Bearer ${await this.accessToken()}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        topic: input.topic.slice(0, 200),
        type: 2, // scheduled meeting
        start_time: input.startTime.toISOString(),
        duration: input.durationMinutes,
        timezone: input.timezone,
        agenda: input.agenda?.slice(0, 2000),
        settings: { join_before_host: false, waiting_room: true, approval_type: 2, mute_upon_entry: true },
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.warn(`Zoom meeting creation failed (${response.status}): ${body.slice(0, 300)}`);
      throw new AppException('ZOOM_ERROR', `Zoom could not create the meeting (HTTP ${response.status})`, HttpStatus.BAD_GATEWAY);
    }
    const meeting = (await response.json()) as { id: number | string; join_url: string; start_url: string; password?: string };
    return { meetingId: String(meeting.id), joinUrl: meeting.join_url, startUrl: meeting.start_url, password: meeting.password ?? null };
  }

  /** Account-credentials token, cached until a minute before it expires. */
  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value;
    const accountId = this.config.get<string>('ZOOM_ACCOUNT_ID');
    const basic = Buffer.from(`${this.config.get<string>('ZOOM_CLIENT_ID')}:${this.config.get<string>('ZOOM_CLIENT_SECRET')}`).toString('base64');
    const response = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId ?? '')}`, {
      method: 'POST',
      headers: { authorization: `Basic ${basic}` },
    });
    if (!response.ok) {
      this.logger.warn(`Zoom OAuth token request failed (${response.status})`);
      throw new AppException('ZOOM_AUTH_ERROR', 'Zoom rejected the platform credentials — check ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET', HttpStatus.BAD_GATEWAY);
    }
    const json = (await response.json()) as { access_token: string; expires_in: number };
    this.token = { value: json.access_token, expiresAt: Date.now() + (json.expires_in - 60) * 1000 };
    return this.token.value;
  }
}
