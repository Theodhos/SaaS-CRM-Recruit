/**
 * The exact record an agency keeps at each pipeline stage. Matched to a stage by its name (the default pipeline:
 * New → Screening → Interview → Client interview → Offer → Placed / Rejected); a renamed or custom stage gets the
 * generic form. Values are saved per application per stage in ApplicationStageNote.fields (see StageNotesDialog).
 */
export type StageFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'rating';

export interface StageField {
  key: string;
  label: string;
  type: StageFieldType;
  options?: readonly string[];
  placeholder?: string;
  /** Unit shown after a number ($/h, years, days…). */
  suffix?: string;
  /** Take the full row. */
  wide?: boolean;
}

export interface StageForm {
  title: string;
  intro: string;
  fields: readonly StageField[];
}

export type StageFieldValue = string | number | boolean | null;
export type StageFieldValues = Record<string, StageFieldValue>;

const RESULT_PASS_FAIL = ['Pass', 'Fail', 'On hold'] as const;

export const STAGE_FORMS: Record<string, StageForm> = {
  new: {
    title: 'Application received',
    intro: 'How the candidate reached us and whether the file is complete.',
    fields: [
      { key: 'source', label: 'Source', type: 'select', options: ['Website', 'Added manually', 'Referral', 'LinkedIn', 'Job board', 'Other'] },
      { key: 'cvReceived', label: 'CV received', type: 'checkbox' },
      { key: 'contactedOn', label: 'First contact', type: 'date' },
      { key: 'firstImpression', label: 'First impression', type: 'rating' },
      { key: 'nextStep', label: 'Next step', type: 'text', placeholder: 'e.g. phone screening on Monday', wide: true },
    ],
  },
  screening: {
    title: 'Screening',
    intro: 'CV review and phone screening — the facts that decide whether to interview.',
    fields: [
      { key: 'screenedOn', label: 'Screened on', type: 'date' },
      { key: 'availableFrom', label: 'Available from', type: 'date' },
      { key: 'experienceYears', label: 'Relevant experience', type: 'number', suffix: 'years' },
      { key: 'expectedRate', label: 'Expected pay', type: 'number', suffix: '/ hour' },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'relocation', label: 'Willing to relocate', type: 'select', options: ['Yes', 'No', 'Maybe'] },
      { key: 'languages', label: 'Languages', type: 'text', placeholder: 'Albanian, English…' },
      { key: 'documents', label: 'Documents in order', type: 'select', options: ['Complete', 'Missing some', 'Not checked'] },
      { key: 'result', label: 'Screening result', type: 'select', options: RESULT_PASS_FAIL },
    ],
  },
  interview: {
    title: 'Interview with the agency',
    intro: 'Your own interview (Zoom or in person): ratings and the decision to present them to the client.',
    fields: [
      { key: 'interviewOn', label: 'Interview date', type: 'date' },
      { key: 'format', label: 'Format', type: 'select', options: ['Zoom', 'Phone', 'In person'] },
      { key: 'interviewer', label: 'Interviewer', type: 'text' },
      { key: 'technical', label: 'Skills / technical', type: 'rating' },
      { key: 'communication', label: 'Communication', type: 'rating' },
      { key: 'motivation', label: 'Motivation', type: 'rating' },
      { key: 'strengths', label: 'Strengths', type: 'textarea', wide: true },
      { key: 'concerns', label: 'Concerns', type: 'textarea', wide: true },
      { key: 'result', label: 'Result', type: 'select', options: ['Present to client', 'Second interview', 'Not suitable'] },
    ],
  },
  'client interview': {
    title: 'Interview with the client',
    intro: 'The employer meets the candidate — record who, when and what the client said.',
    fields: [
      { key: 'client', label: 'Client / company', type: 'text' },
      { key: 'clientContact', label: 'Client contact', type: 'text', placeholder: 'Name of the hiring manager' },
      { key: 'interviewOn', label: 'Interview date', type: 'date' },
      { key: 'format', label: 'Format', type: 'select', options: ['Zoom', 'Phone', 'On site'] },
      { key: 'clientFeedback', label: 'Client feedback', type: 'textarea', wide: true },
      { key: 'result', label: 'Client decision', type: 'select', options: ['Wants to hire', 'Another round', 'Declined', 'Waiting'] },
    ],
  },
  offer: {
    title: 'Offer',
    intro: 'Terms agreed with the client and the candidate — the pay calculation below is part of this record.',
    fields: [
      { key: 'offeredOn', label: 'Offer made on', type: 'date' },
      { key: 'startDate', label: 'Proposed start date', type: 'date' },
      { key: 'contractType', label: 'Contract', type: 'select', options: ['Permanent', 'Temporary'] },
      { key: 'hoursPerWeek', label: 'Hours per week', type: 'number', suffix: 'h' },
      { key: 'offerStatus', label: 'Offer status', type: 'select', options: ['Sent', 'Negotiating', 'Accepted', 'Declined'] },
      { key: 'conditions', label: 'Conditions / benefits', type: 'textarea', wide: true },
    ],
  },
  placed: {
    title: 'Placed — hired',
    intro: 'The candidate was approved and starts work. This is also what Active Employees shows.',
    fields: [
      { key: 'startDate', label: 'Start date', type: 'date' },
      { key: 'contractType', label: 'Contract', type: 'select', options: ['Permanent', 'Temporary'] },
      { key: 'contractSigned', label: 'Contract signed', type: 'checkbox' },
      { key: 'probationEnds', label: 'Probation ends', type: 'date' },
      { key: 'guaranteeDays', label: 'Guarantee period', type: 'number', suffix: 'days' },
      { key: 'invoiceStatus', label: 'Agency invoice', type: 'select', options: ['Not invoiced', 'Invoiced', 'Paid'] },
    ],
  },
  rejected: {
    title: 'Rejected — not selected',
    intro: 'Why it ended, so the candidate can be reconsidered for the right opening later.',
    fields: [
      { key: 'rejectedBy', label: 'Decided by', type: 'select', options: ['Agency', 'Client', 'Candidate withdrew'] },
      { key: 'reason', label: 'Main reason', type: 'select', options: ['Skills', 'Experience', 'Pay expectations', 'Availability', 'Location', 'Culture fit', 'No response', 'Position filled', 'Other'] },
      { key: 'reconsiderLater', label: 'Reconsider for other jobs', type: 'checkbox' },
      { key: 'feedback', label: 'Feedback given to the candidate', type: 'textarea', wide: true },
    ],
  },
};

// The "Temporary staffing" scheme: a phone screening instead of the full screening, then a paid trial day.
STAGE_FORMS['phone screening'] = {
  title: 'Phone screening',
  intro: 'A short call to confirm availability, pay and the basics before a trial day.',
  fields: [
    { key: 'screenedOn', label: 'Called on', type: 'date' },
    { key: 'availableFrom', label: 'Available from', type: 'date' },
    { key: 'expectedRate', label: 'Expected pay', type: 'number', suffix: '/ hour' },
    { key: 'hasTransport', label: 'Own transport', type: 'checkbox' },
    { key: 'shiftPreference', label: 'Shifts', type: 'select', options: ['Day', 'Night', 'Any'] },
    { key: 'result', label: 'Result', type: 'select', options: RESULT_PASS_FAIL },
  ],
};
STAGE_FORMS['trial day'] = {
  title: 'Trial day',
  intro: 'One paid day at the client — the client’s verdict decides the placement.',
  fields: [
    { key: 'trialOn', label: 'Trial day', type: 'date' },
    { key: 'client', label: 'Client / site', type: 'text' },
    { key: 'hoursWorked', label: 'Hours worked', type: 'number', suffix: 'h' },
    { key: 'punctuality', label: 'Punctuality', type: 'rating' },
    { key: 'performance', label: 'Performance', type: 'rating' },
    { key: 'clientFeedback', label: 'Client feedback', type: 'textarea', wide: true },
    { key: 'result', label: 'Client decision', type: 'select', options: ['Hire', 'Another trial day', 'Not hired'] },
  ],
};

export const GENERIC_STAGE_FORM: StageForm = {
  title: 'Stage record',
  intro: 'What was decided at this stage.',
  fields: [
    { key: 'outcome', label: 'Outcome', type: 'select', options: ['In progress', 'Passed', 'Failed'] },
    { key: 'nextStep', label: 'Next step', type: 'text' },
  ],
};

export function stageForm(stage: { name: string; type: string }): StageForm {
  const byName = STAGE_FORMS[stage.name.trim().toLowerCase()];
  if (byName) return byName;
  if (stage.type === 'PLACED') return STAGE_FORMS.placed!;
  if (stage.type === 'REJECTED') return STAGE_FORMS.rejected!;
  return GENERIC_STAGE_FORM;
}

/** How many of the form's fields carry a value — the "•" on the stage tab. */
export function filledCount(form: StageForm, values: StageFieldValues | undefined): number {
  if (!values) return 0;
  return form.fields.filter((f) => {
    const v = values[f.key];
    return v !== undefined && v !== null && v !== '' && v !== false;
  }).length;
}
