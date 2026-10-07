import { HttpStatus, Injectable, Logger } from '@nestjs/common';

import { AppException, ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { EmailService } from '../../../infrastructure/email/email.service';
import { ZoomService } from '../../../infrastructure/zoom/zoom.service';
import { ApplicationsService } from '../../applications/service/applications.service';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import { CalendarService } from '../../calendar/service/calendar.service';
import { UsersService } from '../../users/service/users.service';
import type { ScheduleInterviewDto } from '../dto';
import { InterviewsRepository } from '../repositories/interviews.repository';

type InterviewWithContext = NonNullable<Awaited<ReturnType<InterviewsRepository['findById']>>>;

export interface InviteDelivery {
  sent: boolean;
  to: string | null;
  /** Why it was not sent (no e-mail on file, transport not configured, or the transport's error). */
  error: string | null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

function formatSlot(at: Date, timezone: string | null): string {
  try {
    return `${new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: timezone ?? 'UTC' }).format(at)} (${timezone ?? 'UTC'})`;
  } catch {
    return `${at.toUTCString()} (UTC)`;
  }
}

/**
 * Interviews scheduled from a pipeline card ("Stage notes & pay" dialog): a Zoom meeting is created for the slot
 * through the Zoom API (the pipeline never sends a link of its own; `meetingUrl` stays for other API callers) —
 * the invitation is e-mailed to the candidate's address, and the slot lands on the instructor's calendar.
 */
@Injectable()
export class InterviewsService {
  private readonly logger = new Logger(InterviewsService.name);

  constructor(
    private readonly repository: InterviewsRepository,
    private readonly applicationsService: ApplicationsService,
    private readonly calendarService: CalendarService,
    private readonly usersService: UsersService,
    private readonly auditLogs: AuditLogsService,
    private readonly zoom: ZoomService,
    private readonly email: EmailService,
  ) {}

  /** What the UI can offer: create Zoom links automatically? deliver e-mail? */
  capabilities() {
    return { zoomConfigured: this.zoom.isConfigured(), emailConfigured: this.email.isConfigured() };
  }

  list(organisationId: string, filter: { applicationId?: string; candidateId?: string; jobId?: string }) {
    if (!filter.applicationId && !filter.candidateId && !filter.jobId) {
      throw new AppException('FILTER_REQUIRED', 'Pass applicationId, candidateId or jobId', HttpStatus.BAD_REQUEST);
    }
    return this.repository.findMany(organisationId, filter);
  }

  async schedule(organisationId: string, userId: string, dto: ScheduleInterviewDto) {
    const application = await this.applicationsService.getById(organisationId, dto.applicationId);
    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new AppException('INVALID_DATE', 'scheduledAt is not a valid date', HttpStatus.BAD_REQUEST);
    }
    const candidateName = `${application.candidate.firstName} ${application.candidate.lastName}`;
    const topic = `Interview: ${candidateName} — ${application.job.title}`;

    let meetingUrl = dto.meetingUrl?.trim() || null;
    let hostUrl: string | null = null;
    let provider: 'zoom' | 'manual' = 'manual';
    if (!meetingUrl) {
      if (!this.zoom.isConfigured()) {
        throw new AppException(
          'MEETING_LINK_REQUIRED',
          'Zoom is not connected on this platform yet — add ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET to the API environment so the meeting is created automatically.',
          HttpStatus.BAD_REQUEST,
        );
      }
      const meeting = await this.zoom.createMeeting({
        topic,
        startTime: scheduledAt,
        durationMinutes: dto.durationMinutes,
        timezone: dto.timezone,
        agenda: dto.notes,
      });
      meetingUrl = meeting.joinUrl;
      hostUrl = meeting.startUrl;
      provider = 'zoom';
    }

    let interview = await this.repository.create(organisationId, {
      applicationId: application.id,
      interviewerId: userId,
      scheduledAt,
      duration: dto.durationMinutes,
      timezone: dto.timezone ?? null,
      meetingUrl,
      provider,
      hostUrl,
      notes: dto.notes?.trim() || null,
    });

    // On the instructor's calendar too (Communication → Calendar). Never fails the scheduling.
    try {
      const event = await this.calendarService.create(organisationId, userId, {
        title: topic,
        type: 'INTERVIEW',
        startAt: scheduledAt.toISOString(),
        endAt: new Date(scheduledAt.getTime() + dto.durationMinutes * 60_000).toISOString(),
        location: 'Zoom',
        meetingUrl,
        candidateId: application.candidateId,
        jobId: application.jobId,
        companyId: application.job.company?.id ?? undefined,
        applicationId: application.id,
      });
      interview = await this.repository.setCalendarEvent(organisationId, interview.id, event.id);
    } catch (error) {
      this.logger.warn(`Interview ${interview.id} scheduled but its calendar event could not be created: ${error}`);
    }

    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'SCHEDULE_INTERVIEW',
      entityType: 'Interview',
      entityId: interview.id,
      newValues: { applicationId: application.id, scheduledAt: scheduledAt.toISOString(), durationMinutes: dto.durationMinutes, provider },
    });

    const withContext = await this.repository.findById(organisationId, interview.id);
    if (!withContext) throw new ResourceNotFoundException('Interview', interview.id);
    const email = dto.sendInvite ? await this.deliverInvite(organisationId, withContext) : { sent: false, to: application.candidate.email, error: null };
    return { interview: email.sent ? await this.repository.markInviteSent(organisationId, interview.id, email.to!) : interview, email };
  }

  /** Cancels the interview: the row and its calendar entry go; the candidate is not e-mailed automatically. */
  async remove(organisationId: string, userId: string, id: string) {
    const interview = await this.repository.findById(organisationId, id);
    if (!interview) throw new ResourceNotFoundException('Interview', id);
    if (interview.calendarEventId) {
      await this.calendarService.remove(organisationId, interview.calendarEventId).catch((error) => {
        this.logger.warn(`Calendar event ${interview.calendarEventId} of interview ${id} could not be removed: ${error}`);
      });
    }
    await this.repository.delete(organisationId, id);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'CANCEL_INTERVIEW',
      entityType: 'Interview',
      entityId: id,
      oldValues: { applicationId: interview.applicationId, scheduledAt: interview.scheduledAt.toISOString() },
    });
  }

  /** (Re)sends the invitation — e.g. after the e-mail server was fixed, or the candidate's address was added. */
  async sendInvite(organisationId: string, id: string) {
    const interview = await this.repository.findById(organisationId, id);
    if (!interview) throw new ResourceNotFoundException('Interview', id);
    const email = await this.deliverInvite(organisationId, interview);
    return { interview: email.sent ? await this.repository.markInviteSent(organisationId, id, email.to!) : interview, email };
  }

  private async deliverInvite(organisationId: string, interview: InterviewWithContext): Promise<InviteDelivery> {
    const candidate = interview.application.candidate;
    const to = candidate.email?.trim() || null;
    if (!to) return { sent: false, to: null, error: 'The candidate has no e-mail address on file.' };
    if (!interview.meetingUrl) return { sent: false, to, error: 'The interview has no meeting link.' };

    const host = interview.interviewerId ? await this.usersService.getById(organisationId, interview.interviewerId).catch(() => null) : null;
    const hostName = host ? `${host.firstName} ${host.lastName}` : 'Our team';
    const job = interview.application.job;
    const when = formatSlot(interview.scheduledAt, interview.timezone);
    const company = job.company ? ` at ${job.company.name}` : '';
    const subject = `Interview invitation: ${job.title}${company}`;
    const lines = [
      `Hello ${candidate.firstName},`,
      '',
      `${hostName} would like to meet you on Zoom about the ${job.title} position${company}.`,
      '',
      `When: ${when}`,
      `Duration: ${interview.duration} minutes`,
      `Join Zoom meeting: ${interview.meetingUrl}`,
      ...(interview.notes ? ['', interview.notes] : []),
      '',
      'If this time does not work for you, simply reply to this e-mail.',
    ];
    const html = `<p>${lines
      .map((line) => escapeHtml(line).replace(escapeHtml(interview.meetingUrl!), `<a href="${escapeHtml(interview.meetingUrl!)}">${escapeHtml(interview.meetingUrl!)}</a>`))
      .join('<br/>')}</p>`;

    try {
      const result = await this.email.send({ to, subject, text: lines.join('\n'), html, replyTo: host?.email ?? undefined });
      if (!result.delivered) {
        return { sent: false, to, error: 'E-mail sending is not configured on this platform (SMTP_HOST) — share the link with the candidate yourself.' };
      }
      return { sent: true, to, error: null };
    } catch (error) {
      this.logger.warn(`Invitation for interview ${interview.id} could not be sent to ${to}: ${error}`);
      return { sent: false, to, error: `The e-mail could not be sent: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
}
