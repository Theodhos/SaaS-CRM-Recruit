/**
 * Where a click on a notification lands — the exact place it is about, not just the page that holds it:
 *
 *   a candidate was placed           -> their page, at the Employment card
 *   a new candidate arrived          -> their page, at the Pipeline journey
 *   a candidate's data is incomplete -> their page, with the Edit form already open
 *   a calendar event / reminder      -> the calendar, on that event (the link already says which)
 *
 * The API stores a plain link with each notification (`/candidates/<id>`…); the precise spot is worked out here from
 * its type, so notifications sent before this existed land in the right place too.
 */
export function notificationTarget(notification: { type: string; link?: string | null }): string | null {
  const link = notification.link;
  if (!link) return null;
  if (/^\/candidates\/[^/?#]+$/.test(link)) {
    if (notification.type === 'CANDIDATE_DATA_INCOMPLETE') return `${link}?edit=1`;
    if (notification.type === 'CANDIDATE_PLACED') return `${link}#employment`;
    if (notification.type === 'NEW_CANDIDATE') return `${link}#journey`;
  }
  // tasks have no page of their own: what is due shows on the calendar
  if (link.startsWith('/tasks')) return '/calendar';
  return link;
}

/** The candidate a notification points at, if it points at one — so their page's data can be fetched ahead of the click. */
export function notificationCandidateId(notification: { link?: string | null }): string | null {
  return /^\/candidates\/([^/?#]+)/.exec(notification.link ?? '')?.[1] ?? null;
}
