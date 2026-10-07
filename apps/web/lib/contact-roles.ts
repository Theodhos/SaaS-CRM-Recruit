/**
 * Groups the people at a company by what they do, so the company page reads like an org chart: leadership first
 * (CEO, founders, owners, C-level, directors), then HR / talent, then everyone else. `jobTitle` is free text, so this
 * is a readability heuristic over the title — it never changes or hides a contact.
 */
export type ContactGroup = 'leadership' | 'hr' | 'other';

const LEADERSHIP =
  /\b(ceo|chief executive|founder|co[- ]?founder|cofounder|owner|president|managing director|general manager|director|md|cto|cfo|coo|cmo|cio|chief|partner|principal)\b/i;
const HR = /\b(hr|human resources|talent|recruit\w*|people (and|&) culture|people operations|people partner|hiring)\b/i;

export function contactGroup(jobTitle: string | null | undefined): ContactGroup {
  if (!jobTitle) return 'other';
  if (LEADERSHIP.test(jobTitle) && !HR.test(jobTitle)) return 'leadership';
  if (HR.test(jobTitle)) return 'hr';
  return 'other';
}

export const CONTACT_GROUP_LABEL: Record<ContactGroup, string> = {
  leadership: 'Leadership',
  hr: 'HR & talent',
  other: 'Other contacts',
};

export const CONTACT_GROUP_ORDER: ContactGroup[] = ['leadership', 'hr', 'other'];

export function groupContacts<T extends { jobTitle: string | null; firstName: string; lastName: string }>(
  contacts: T[],
): { group: ContactGroup; label: string; contacts: T[] }[] {
  const byName = (a: T, b: T) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
  return CONTACT_GROUP_ORDER.map((group) => ({
    group,
    label: CONTACT_GROUP_LABEL[group],
    contacts: contacts.filter((c) => contactGroup(c.jobTitle) === group).sort(byName),
  })).filter((g) => g.contacts.length > 0);
}
