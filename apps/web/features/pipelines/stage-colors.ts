/**
 * Every stage of a pipeline has a colour of its own, the same everywhere it appears: the column on the board, the
 * edge of the cards in it, the stage's status badge, the stage chip in the pop-up and the button that moves a card
 * into it. Moving a card to another column therefore changes its colour — the move is visible without reading
 * anything — and a button always has the colour of where it leads.
 *
 *   New blue · Screening violet · Interview orange · Offer teal · hired green · Rejected red · Completed slate
 *
 * Outcomes inside a stage keep their own meaning on top of that (see stageStatus): green = good, amber = waiting,
 * red = stopped. The class names are written out in full — Tailwind only ships the classes it can read in the source.
 */
export type StageTone = 'blue' | 'violet' | 'orange' | 'teal' | 'green' | 'red' | 'amber' | 'slate';

export type ToneBadge = 'default' | 'violet' | 'orange' | 'teal' | 'success' | 'destructive' | 'warning' | 'slate';

export interface ToneClasses {
  /** Badge variant of @crm/ui. */
  badge: ToneBadge;
  /** Solid fill: the bar on top of a column, the dot next to a name. */
  solid: string;
  /** Column header background, and the fill of the cards in the column. */
  soft: string;
  /** Column border. */
  border: string;
  /** Left edge of a card. */
  edge: string;
  /** The count chip in a column header. */
  chip: string;
  /** A button that moves a card into the stage, or sets the status this colour stands for. */
  button: string;
}

export const TONES: Record<StageTone, ToneClasses> = {
  blue: { badge: 'default', solid: 'bg-blue-600', soft: 'bg-blue-50', border: 'border-blue-200', edge: 'border-l-blue-600', chip: 'bg-blue-600 text-white', button: 'bg-blue-600 text-white hover:bg-blue-700' },
  violet: { badge: 'violet', solid: 'bg-violet-600', soft: 'bg-violet-50', border: 'border-violet-200', edge: 'border-l-violet-600', chip: 'bg-violet-600 text-white', button: 'bg-violet-600 text-white hover:bg-violet-700' },
  orange: { badge: 'orange', solid: 'bg-orange-600', soft: 'bg-orange-50', border: 'border-orange-200', edge: 'border-l-orange-600', chip: 'bg-orange-700 text-white', button: 'bg-orange-600 text-white hover:bg-orange-700' },
  teal: { badge: 'teal', solid: 'bg-teal-600', soft: 'bg-teal-50', border: 'border-teal-200', edge: 'border-l-teal-600', chip: 'bg-teal-700 text-white', button: 'bg-teal-600 text-white hover:bg-teal-700' },
  green: { badge: 'success', solid: 'bg-emerald-600', soft: 'bg-emerald-50', border: 'border-emerald-200', edge: 'border-l-emerald-600', chip: 'bg-emerald-700 text-white', button: 'bg-emerald-600 text-white hover:bg-emerald-700' },
  red: { badge: 'destructive', solid: 'bg-red-600', soft: 'bg-red-50', border: 'border-red-200', edge: 'border-l-red-600', chip: 'bg-red-600 text-white', button: 'bg-red-600 text-white hover:bg-red-700' },
  amber: { badge: 'warning', solid: 'bg-amber-400', soft: 'bg-amber-50', border: 'border-amber-200', edge: 'border-l-amber-400', chip: 'bg-amber-400 text-slate-950', button: 'bg-amber-400 text-slate-950 hover:bg-amber-500' },
  slate: { badge: 'slate', solid: 'bg-slate-500', soft: 'bg-slate-50', border: 'border-slate-200', edge: 'border-l-slate-500', chip: 'bg-slate-600 text-white', button: 'bg-slate-600 text-white hover:bg-slate-700' },
};

const BY_NAME: Record<string, StageTone> = {
  new: 'blue',
  screening: 'violet',
  'phone screening': 'violet',
  interview: 'orange',
  'trial day': 'orange',
  'client interview': 'amber',
  offer: 'teal',
  completed: 'slate',
};

/** For stages the scheme does not know by name: by their place in the pipeline, so neighbours still differ. */
const BY_ORDER: StageTone[] = ['blue', 'violet', 'orange', 'teal', 'amber', 'slate'];

export function stageTone(stage: { name: string; type: string; order?: number }): StageTone {
  if (stage.type === 'PLACED') return 'green';
  if (stage.type === 'REJECTED') return 'red';
  return BY_NAME[stage.name.trim().toLowerCase()] ?? BY_ORDER[((stage.order ?? 1) - 1) % BY_ORDER.length]!;
}

export const stageColors = (stage: { name: string; type: string; order?: number }): ToneClasses => TONES[stageTone(stage)];

/** Pipeline Companies: the four fixed stages. */
export const COMPANY_STAGE_TONE: Record<'NEW' | 'IN_CONVERSATION' | 'WIN' | 'LOST', StageTone> = {
  NEW: 'blue',
  IN_CONVERSATION: 'orange',
  WIN: 'green',
  LOST: 'red',
};
