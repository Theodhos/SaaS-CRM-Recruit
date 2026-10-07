import type { StageNotesResponse } from '@/services/stage-notes.service';

type Stages = StageNotesResponse['stages'];
type Stage = Stages[number]['stage'];

export interface StageHistory {
  /**
   * The journey, in order: every stage the candidate has entered, with when they (last) did, ending with the stage
   * they are in now. Drawn as the chain of arrows at the top of History.
   */
  path: { stageId: string; name: string; stage: Stage; at: string | null; current: boolean }[];
  /**
   * The stages the candidate has been through before the one they are in that have something written, in the order
   * they entered them — with when that text was last written.
   */
  earlier: { stageId: string; name: string; stage: Stage; text: string; at: string }[];
  /** What is written at the stage they are in now. */
  own: string;
}

/**
 * The title a stage's text goes under in History: the stage's name — except Rejected reached by ending a contract
 * (Active Employees' Terminated button), which reads "Terminated".
 */
export function historyTitle(s: Stages[number]): string {
  return s.stage.type === 'REJECTED' && s.note?.fields?.reason === 'Terminated' ? 'Terminated' : s.stage.name;
}

/** `full` without the text of another stage it opens with — older records copied notes forward from stage to stage. */
function withoutRepeat(full: string, others: string[]): string {
  const repeated = others.filter((text) => text && full.startsWith(text)).sort((a, b) => b.length - a.length)[0];
  return repeated ? full.slice(repeated.length).trim() : full;
}

/**
 * History is the journey so far: the stages the candidate has entered and when (`path`), what was written at each
 * of them (`earlier` — a stage where nothing was written has no text block), and the text of the stage they are in
 * now. Everything is in the order the stages were entered. Each stage stores only its own text.
 */
export function stageHistory(stages: Stages, currentStageId: string): StageHistory {
  const notesOf = (s: Stages[number]) => s.note?.notes?.trim() ?? '';
  const at = (s: Stages[number]) => new Date(s.enteredAt ?? s.note!.createdAt).getTime();
  const passed = stages
    .filter((s) => s.stage.id !== currentStageId && (s.enteredAt || notesOf(s)))
    .sort((a, b) => at(a) - at(b) || a.stage.order - b.stage.order);
  const current = stages.find((s) => s.stage.id === currentStageId);

  const seen: string[] = [];
  const earlier = passed
    .map((s) => {
      const text = withoutRepeat(notesOf(s), seen);
      seen.push(notesOf(s));
      return { stageId: s.stage.id, name: historyTitle(s), stage: s.stage, text, at: s.note?.updatedAt ?? s.enteredAt ?? '' };
    })
    .filter((block) => block.text);

  const step = (s: Stages[number], isCurrent: boolean) => ({
    stageId: s.stage.id,
    name: historyTitle(s),
    stage: s.stage,
    at: s.enteredAt ?? s.note?.createdAt ?? null,
    current: isCurrent,
  });
  return {
    path: [...passed.map((s) => step(s, false)), ...(current ? [step(current, true)] : [])],
    earlier,
    own: current ? withoutRepeat(notesOf(current), seen) : '',
  };
}
