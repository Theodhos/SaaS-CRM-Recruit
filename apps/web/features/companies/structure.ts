/**
 * Where a person sits in a client's structure, judged from their title: the CEO / founders first, then the rest of
 * the C-level, directors, heads, HR & talent, managers, everyone else. Used to draw the company's organisation.
 */
const RANKS: { test: RegExp; rank: number; group: string }[] = [
  { test: /\b(ceo|chief executive|founder|co-?founder|owner|president|managing director|general manager|drejtor i p[eë]rgjithsh[eë]m|administrator)\b/i, rank: 1, group: 'Leadership' },
  { test: /\b(coo|cfo|cto|cmo|cio|chro|cpo|cso|chief)\b/i, rank: 2, group: 'Leadership' },
  { test: /\b(vp|vice president|director|drejtor)\b/i, rank: 3, group: 'Directors' },
  { test: /\bhead\b/i, rank: 4, group: 'Heads of department' },
  { test: /\b(hr|human resources|people|talent|recruit\w*|burime njer[eë]zore)\b/i, rank: 5, group: 'HR & talent' },
  { test: /\b(manager|lead|supervisor|menaxher|p[eë]rgjegj[eë]s)\b/i, rank: 6, group: 'Managers' },
];

export function rankTitle(title: string | null | undefined): { rank: number; group: string } {
  if (!title) return { rank: 9, group: 'Team' };
  for (const r of RANKS) if (r.test.test(title)) return { rank: r.rank, group: r.group };
  return { rank: 8, group: 'Team' };
}

export const STRUCTURE_GROUPS = ['Leadership', 'Directors', 'Heads of department', 'HR & talent', 'Managers', 'Team'] as const;
