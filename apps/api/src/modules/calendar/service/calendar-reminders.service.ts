import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { SchedulerLockService } from '../../../infrastructure/scheduler/scheduler-lock.service';
import { NotificationsService } from '../../notifications/service/notifications.service';
import { CalendarRepository } from '../repositories/calendar.repository';

// How far ahead to look for events about to start, and how often to look.
// An event inside this window gets exactly one reminder (see
// CalendarRepository.findDueForReminder's reminderSentAt guard) regardless
// of how many ticks pass before it starts.
const REMINDER_WINDOW_MINUTES = 15;

/**
 * "Starting soon" notifications for calendar events — Zoom/meeting-link
 * events included, since that's the whole point: don't miss a call because
 * nobody was watching the calendar. Runs as an in-process cron (see
 * ScheduleModule.forRoot() in AppModule), not through the worker's queue —
 * apps/worker has no database access wired up yet, so this stays in the API
 * process until/unless that changes.
 */
@Injectable()
export class CalendarRemindersService {
  private readonly logger = new Logger(CalendarRemindersService.name);

  constructor(
    private readonly repository: CalendarRepository,
    private readonly notifications: NotificationsService,
    private readonly lock: SchedulerLockService,
  ) {}

  // With several API replicas only one runs each tick (SCHEDULER_LOCK=redis); by default every instance does,
  // exactly as before. Lock TTL < the 5-minute interval so a crashed holder cannot block the next tick.
  @Cron(CronExpression.EVERY_5_MINUTES)
  async sendDueReminders(): Promise<void> {
    await this.lock.runExclusive('calendar-reminders', 4 * 60_000, () => this.sweepDueReminders());
  }

  private async sweepDueReminders(): Promise<void> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MINUTES * 60_000);

    const dueEvents = await this.repository.findDueForReminder(now, windowEnd);
    if (dueEvents.length === 0) return;

    for (const event of dueEvents) {
      const startTime = event.startAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      await this.notifications.notify(event.organisationId, event.userId, {
        type: 'CALENDAR_EVENT_REMINDER',
        title: `Starting soon: ${event.title}`,
        message: event.meetingUrl
          ? `${startTime} · Join: ${event.meetingUrl}`
          : `${startTime}${event.startAt <= now ? ' — now' : ''}`,
        link: `/calendar?eventId=${event.id}`,
      });
      await this.repository.markReminderSent(event.id);
    }

    this.logger.log(`Sent ${dueEvents.length} calendar reminder(s)`);
  }
}
