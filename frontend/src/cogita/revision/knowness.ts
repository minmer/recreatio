import type { RevisionOutcomePayload } from './outcomes';

export type KnownessSummary = {
  score: number;
  total: number;
  correct: number;
  lastReviewedUtc?: string | null;
};

export const computeKnowness = (outcomes: RevisionOutcomePayload[]): KnownessSummary => {
  if (!outcomes.length) {
    return { score: 0, total: 0, correct: 0, lastReviewedUtc: null };
  }
  const total = outcomes.length;
  const correct = outcomes.filter((entry) => entry.correct).length;
  const lastReviewedUtc = outcomes.reduce((latest, entry) => {
    if (!latest) return entry.createdUtc;
    return latest > entry.createdUtc ? latest : entry.createdUtc;
  }, '' as string);
  const last = lastReviewedUtc ? new Date(lastReviewedUtc) : null;
  const daysSince = last ? (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24) : 0;
  const recencyWeight = Math.exp(-daysSince / 30.0);
  const accuracy = total === 0 ? 0 : correct / total;
  const score = Math.round(accuracy * 100 * recencyWeight * 100) / 100;
  return { score, total, correct, lastReviewedUtc };
};
