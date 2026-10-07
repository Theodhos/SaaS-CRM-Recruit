-- Link an interview to the calendar entry created for it, so cancelling one removes the other.
ALTER TABLE "interviews" ADD COLUMN "calendarEventId" TEXT;
