/**
 * A candidate can apply to several jobs, and then sits on the board once per job. To tell those cards apart each of
 * the candidate's jobs gets a colour of its own, in the order they applied, shown as a solid chip with the job's name
 * and "Job 2 of 3" next to it. The card itself is left alone — its fill and border are the stage's, like every other
 * card — and a candidate with a single card has no chip: a chip always means "this person has more than one
 * application". With the board filtered to one candidate, a summary above it lists their jobs in the same colours.
 * Class names are written out in full — Tailwind only ships the classes it can read in the source.
 */
const JOB_CHIPS = [
  'bg-indigo-600 text-white',
  'bg-pink-600 text-white',
  'bg-cyan-600 text-white',
  'bg-lime-400 text-slate-950',
  'bg-fuchsia-600 text-white',
  'bg-yellow-400 text-slate-950',
] as const;

export interface JobMark {
  /** 1-based place of this application among the candidate's applications on the board, oldest first. */
  position: number;
  total: number;
  /** The job's name on the card. */
  chip: string;
}

/** By application id — only for candidates who have more than one card among `applications`. */
export function jobMarks(applications: { id: string; appliedAt: string; candidate: { id: string } }[]): Map<string, JobMark> {
  const byCandidate = new Map<string, typeof applications>();
  for (const application of applications) {
    byCandidate.set(application.candidate.id, [...(byCandidate.get(application.candidate.id) ?? []), application]);
  }
  const marks = new Map<string, JobMark>();
  for (const cards of byCandidate.values()) {
    if (cards.length < 2) continue;
    [...cards]
      .sort((a, b) => a.appliedAt.localeCompare(b.appliedAt) || a.id.localeCompare(b.id))
      .forEach((card, index) => {
        marks.set(card.id, { position: index + 1, total: cards.length, chip: JOB_CHIPS[index % JOB_CHIPS.length]! });
      });
  }
  return marks;
}
