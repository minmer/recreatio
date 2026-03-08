import { clampInt, type LiveRules } from './liveSessionRules';

export type LiveBreakdownRowKey = 'base' | 'first' | 'speed' | 'streak' | 'wrong' | 'first-wrong';

export type LiveBreakdownRow = {
  key: LiveBreakdownRowKey;
  label: string;
  points: number;
  reason: string;
};

export type LiveRoundBreakdown = {
  total: number;
  rows: LiveBreakdownRow[];
  bonusTotal: number;
  penaltyTotal: number;
};

export type LiveBreakdownLabels = {
  factorBaseLabel: string;
  factorFirstLabel: string;
  factorSpeedLabel: string;
  factorStreakLabel: string;
  factorWrongLabel: string;
  factorFirstWrongLabel: string;
  roundReasonBase: string;
  roundReasonFirst: string;
  roundReasonSpeed: string;
  roundReasonStreak: string;
  roundReasonWrong: string;
  roundReasonFirstWrong: string;
};

const growthRatio = (mode: string, ratio: number) => {
  const clamped = Math.max(0, Math.min(1, ratio));
  if (mode === 'exponential') return clamped * clamped;
  if (mode === 'limited') return Math.min(1, clamped * 1.6);
  return clamped;
};

const computeStreakBonus = (base: number, streak: number, limit: number, growth: string) => {
  const maxBonus = Math.max(0, base);
  const extraCount = Math.max(0, streak - 1);
  if (maxBonus === 0 || extraCount === 0) return 0;
  const fullAfter = Math.max(1, limit);
  const progress = Math.max(0, Math.min(1, extraCount / fullAfter));
  return clampInt(growthRatio(growth, progress) * maxBonus, 0, 500000);
};

const readScorePart = (source: unknown, keys: string[]) => {
  if (!source || typeof source !== 'object') return Number.NaN;
  const obj = source as Record<string, unknown>;
  for (const key of keys) {
    const value = Number(obj[key]);
    if (Number.isFinite(value)) return value;
  }
  return Number.NaN;
};

export function computeLiveRoundBreakdown(options: {
  scoring: unknown;
  fallbackTotal?: number | null;
  fallbackIsCorrect?: boolean | null;
  labels: LiveBreakdownLabels;
  rules: LiveRules;
  formatTemplate: (template: string, values: Record<string, string | number>) => string;
}): LiveRoundBreakdown | null {
  const { scoring, fallbackTotal, fallbackIsCorrect, labels, rules, formatTemplate } = options;
  if (!scoring && (fallbackTotal === null || typeof fallbackTotal === 'undefined')) return null;

  const source = (scoring && typeof scoring === 'object' ? scoring : {}) as Record<string, unknown>;
  const factors = new Set((Array.isArray(source.factors) ? source.factors : []).map(String));
  const total = Math.round(Number(source.points ?? fallbackTotal ?? 0));
  const answerDurationSeconds = Math.max(0, Math.round(Number(source.answerDurationSeconds ?? 0)));
  const isCorrect =
    typeof source.isCorrect === 'boolean'
      ? source.isCorrect
      : typeof fallbackIsCorrect === 'boolean'
        ? fallbackIsCorrect
        : !(factors.has('wrong') || factors.has('first-wrong')) && total >= 0;

  const reasonFor = (key: LiveBreakdownRowKey) => {
    if (key === 'base') return labels.roundReasonBase;
    if (key === 'first') return labels.roundReasonFirst;
    if (key === 'speed') return formatTemplate(labels.roundReasonSpeed, { seconds: answerDurationSeconds });
    if (key === 'streak') {
      const streakCount = Math.max(0, Math.round(Number(source.streak ?? 0)));
      return formatTemplate(labels.roundReasonStreak, { count: streakCount });
    }
    if (key === 'wrong') return labels.roundReasonWrong;
    return labels.roundReasonFirstWrong;
  };

  const serverBase = readScorePart(source, ['basePoints', 'base']);
  const serverFirst = readScorePart(source, ['firstBonusPoints', 'firstPoints']);
  const serverSpeed = readScorePart(source, ['speedBonusPoints', 'speedPoints', 'timeBonusPoints']);
  const serverStreak = readScorePart(source, ['streakBonusPoints', 'streakPoints']);

  let basePoints =
    Number.isFinite(serverBase)
      ? Math.round(serverBase)
      : (isCorrect ? Math.round(rules.scoring.baseCorrect) : 0);
  let firstPoints =
    Number.isFinite(serverFirst)
      ? Math.round(serverFirst)
      : (factors.has('first') ? Math.round(rules.scoring.firstCorrectBonus) : 0);
  let speedPoints =
    Number.isFinite(serverSpeed)
      ? Math.round(serverSpeed)
      : 0;
  let streakPoints =
    Number.isFinite(serverStreak)
      ? Math.round(serverStreak)
      : (factors.has('streak')
        ? computeStreakBonus(
            rules.scoring.streakBaseBonus,
            Math.max(0, Math.round(Number(source.streak ?? 0))),
            rules.scoring.streakLimit,
            rules.scoring.streakGrowth
          )
        : 0);
  let wrongPoints = factors.has('wrong') ? -Math.round(rules.scoring.wrongAnswerPenalty) : 0;
  let firstWrongPoints = factors.has('first-wrong') ? -Math.round(rules.scoring.firstWrongPenalty) : 0;

  if (isCorrect && total > 0 && basePoints >= total && total > Math.round(rules.scoring.baseCorrect)) {
    const allBonusesUnknown =
      !Number.isFinite(serverFirst) &&
      !Number.isFinite(serverSpeed) &&
      !Number.isFinite(serverStreak);
    const allBonusesZero = firstPoints === 0 && speedPoints === 0 && streakPoints === 0;
    if (allBonusesUnknown || allBonusesZero) {
      basePoints = Math.round(rules.scoring.baseCorrect);
    }
  }

  if (isCorrect) {
    const known = basePoints + firstPoints + speedPoints + streakPoints;
    const remainder = total - known;
    if (remainder !== 0) {
      basePoints += remainder;
    }
  } else if (total < 0 && wrongPoints === 0 && firstWrongPoints === 0) {
    wrongPoints = total;
  } else {
    const known = basePoints + firstPoints + speedPoints + streakPoints + wrongPoints + firstWrongPoints;
    if (known !== total) {
      wrongPoints += total - known;
    }
  }

  const rows: LiveBreakdownRow[] = [
    { key: 'base', label: labels.factorBaseLabel, points: basePoints, reason: reasonFor('base') },
    { key: 'first', label: labels.factorFirstLabel, points: firstPoints, reason: reasonFor('first') },
    { key: 'speed', label: labels.factorSpeedLabel, points: speedPoints, reason: reasonFor('speed') },
    { key: 'streak', label: labels.factorStreakLabel, points: streakPoints, reason: reasonFor('streak') },
    { key: 'wrong', label: labels.factorWrongLabel, points: wrongPoints, reason: reasonFor('wrong') },
    { key: 'first-wrong', label: labels.factorFirstWrongLabel, points: firstWrongPoints, reason: reasonFor('first-wrong') }
  ].filter((row) => row.points !== 0);

  const bonusTotal = rows
    .filter((row) => row.key === 'first' || row.key === 'speed' || row.key === 'streak')
    .reduce((sum, row) => sum + Math.max(0, row.points), 0);
  const penaltyTotal = rows
    .filter((row) => row.key === 'wrong' || row.key === 'first-wrong')
    .reduce((sum, row) => sum + Math.abs(Math.min(0, row.points)), 0);

  return { total, rows, bonusTotal, penaltyTotal };
}

