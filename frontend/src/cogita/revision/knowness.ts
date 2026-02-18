import type { RevisionOutcomePayload } from './outcomes';
import { fromBase64 } from '../../lib/crypto';

export type KnownessSummary = {
  score: number;
  total: number;
  correct: number;
  lastReviewedUtc?: string | null;
};

export type TemporalEntry = {
  correctness: number;
  createdUtc: string;
};

export type TemporalKnownessSummary = {
  knowness: number;
  avgCorrectness: number;
  lastReviewedUtc?: string | null;
};

export const computeKnowness = (outcomes: RevisionOutcomePayload[]): KnownessSummary => {
  if (!outcomes.length) {
    return { score: 0, total: 0, correct: 0, lastReviewedUtc: null };
  }
  const total = outcomes.length;
  const correct = outcomes.filter((entry) => entry.correct).length;
  const temporal = computeTemporalKnowness(buildTemporalEntries(outcomes));
  const score = Math.round(Math.max(0, Math.min(100, temporal.knowness * 100)) * 100) / 100;
  return { score, total, correct, lastReviewedUtc: temporal.lastReviewedUtc ?? null };
};

const toOutcomeCorrectness = (entry: RevisionOutcomePayload) => {
  if (entry.maskBase64) {
    try {
      const bytes = fromBase64(entry.maskBase64);
      if (!bytes.length) return entry.correct ? 1 : 0;
      const sum = bytes.reduce((acc, value) => acc + value, 0);
      return Math.max(0, Math.min(1, sum / bytes.length / 255));
    } catch {
      return entry.correct ? 1 : 0;
    }
  }
  return entry.correct ? 1 : 0;
};

export const buildTemporalEntries = (outcomes: RevisionOutcomePayload[]): TemporalEntry[] => {
  return outcomes.map((entry) => ({
    correctness: toOutcomeCorrectness(entry),
    createdUtc: entry.createdUtc
  }));
};

export const computeTemporalKnowness = (entries: TemporalEntry[], nowMs = Date.now()): TemporalKnownessSummary => {
  if (!entries.length) {
    return { knowness: 0, avgCorrectness: 0, lastReviewedUtc: null };
  }
  const sorted = entries.slice().sort((a, b) => a.createdUtc.localeCompare(b.createdUtc));
  const recent = sorted.slice(-5);
  const avgCorrectness = recent.reduce((acc, entry) => acc + entry.correctness, 0) / recent.length;
  const tauMinutes = 5;
  const scale = 2;
  const correctBonus = 0.15;
  let timeScore = 0;
  let bonus = 0;
  for (let i = 0; i < recent.length; i += 1) {
    const start = new Date(recent[i].createdUtc).getTime();
    const end = i === recent.length - 1 ? nowMs : new Date(recent[i + 1].createdUtc).getTime();
    const deltaMinutes = Math.max(0, (end - start) / (1000 * 60));
    const timeFactor = 1 - Math.exp(-deltaMinutes / tauMinutes);
    timeScore += timeFactor;
    if (recent[i].correctness > 0.5) {
      bonus += correctBonus;
    }
  }
  let knowness = avgCorrectness * timeScore * scale + bonus;
  const lastReviewedUtc = recent[recent.length - 1]?.createdUtc ?? null;
  const minutesSinceLast = lastReviewedUtc
    ? Math.max(0, (nowMs - new Date(lastReviewedUtc).getTime()) / (1000 * 60))
    : 0;
  const decayTauMinutes = 60;
  const decay = 1 / (1 + Math.log1p(minutesSinceLast / decayTauMinutes));
  knowness *= decay;
  const shortBoostTauMinutes = 2;
  const shortBoostAmount = 5.44;
  if (recent.length === 1 && recent[0].correctness > 0.5) {
    knowness += shortBoostAmount * Math.exp(-minutesSinceLast / shortBoostTauMinutes);
  }
  return { knowness, avgCorrectness, lastReviewedUtc };
};
