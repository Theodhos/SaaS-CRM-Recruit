/**
 * "Completed" is where a card goes when Active Employees' Completed button closes the contract: the last stage of
 * the pipeline, after Rejected. It is an ordinary stage found by its name (like New / Screening / Interview / Offer),
 * created the first time it is needed in a pipeline that does not have it yet. The board can hide its column, and a
 * card in it can be removed from the pipeline by hand — the person stays on Completed Contract and in Candidates.
 */
export const COMPLETED_STAGE_NAME = 'Completed';

export function isCompletedStage(stage: { name: string; type: string }): boolean {
  return stage.type === 'STANDARD' && stage.name.trim().toLowerCase() === 'completed';
}
