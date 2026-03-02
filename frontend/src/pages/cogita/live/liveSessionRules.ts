export type BonusGrowthMode = 'linear' | 'exponential' | 'limited';
export type FirstAnswerAction = 'none' | 'start_timer' | 'reveal';
export type AllAnsweredAction = 'none' | 'reveal' | 'next';
export type TimerExpireAction = 'none' | 'reveal' | 'next';

export type LiveRules = {
  firstAnswerAction: FirstAnswerAction;
  allAnsweredAction: AllAnsweredAction;
  timer: {
    enabled: boolean;
    seconds: number;
    triggerMode: 'first_or_single';
    onExpire: TimerExpireAction;
    speedBonusMax: number;
    speedBonusGrowth: BonusGrowthMode;
  };
  scoring: {
    baseCorrect: number;
    firstCorrectBonus: number;
    streakBaseBonus: number;
    streakGrowth: BonusGrowthMode;
    streakLimit: number;
  };
};

export const DEFAULT_LIVE_RULES: LiveRules = {
  firstAnswerAction: 'start_timer',
  allAnsweredAction: 'reveal',
  timer: {
    enabled: true,
    seconds: 25,
    triggerMode: 'first_or_single',
    onExpire: 'reveal',
    speedBonusMax: 2,
    speedBonusGrowth: 'linear'
  },
  scoring: {
    baseCorrect: 1,
    firstCorrectBonus: 1,
    streakBaseBonus: 1,
    streakGrowth: 'limited',
    streakLimit: 5
  }
};

export function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function normalizeGrowthMode(value: unknown): BonusGrowthMode {
  return value === 'exponential' || value === 'limited' ? value : 'linear';
}

export function parseLiveRules(settings: unknown): LiveRules {
  const root = settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : {};
  const liveRulesRoot =
    root.liveRules && typeof root.liveRules === 'object'
      ? (root.liveRules as Record<string, unknown>)
      : root;

  const timerRoot =
    liveRulesRoot.timer && typeof liveRulesRoot.timer === 'object'
      ? (liveRulesRoot.timer as Record<string, unknown>)
      : {};
  const scoringRoot =
    liveRulesRoot.scoring && typeof liveRulesRoot.scoring === 'object'
      ? (liveRulesRoot.scoring as Record<string, unknown>)
      : {};

  const firstAnswerAction: FirstAnswerAction =
    liveRulesRoot.firstAnswerAction === 'reveal' || liveRulesRoot.firstAnswerAction === 'none'
      ? liveRulesRoot.firstAnswerAction
      : 'start_timer';
  const allAnsweredAction: AllAnsweredAction =
    liveRulesRoot.allAnsweredAction === 'none' || liveRulesRoot.allAnsweredAction === 'next'
      ? liveRulesRoot.allAnsweredAction
      : 'reveal';
  const onExpire: TimerExpireAction =
    timerRoot.onExpire === 'none' || timerRoot.onExpire === 'next'
      ? timerRoot.onExpire
      : 'reveal';

  return {
    firstAnswerAction,
    allAnsweredAction,
    timer: {
      enabled: timerRoot.enabled == null ? DEFAULT_LIVE_RULES.timer.enabled : Boolean(timerRoot.enabled),
      seconds: clampInt(Number(timerRoot.seconds ?? DEFAULT_LIVE_RULES.timer.seconds), 3, 600),
      triggerMode: 'first_or_single',
      onExpire,
      speedBonusMax: clampInt(Number(timerRoot.speedBonusMax ?? DEFAULT_LIVE_RULES.timer.speedBonusMax), 0, 25),
      speedBonusGrowth: normalizeGrowthMode(timerRoot.speedBonusGrowth)
    },
    scoring: {
      baseCorrect: clampInt(Number(scoringRoot.baseCorrect ?? DEFAULT_LIVE_RULES.scoring.baseCorrect), 0, 100),
      firstCorrectBonus: clampInt(Number(scoringRoot.firstCorrectBonus ?? DEFAULT_LIVE_RULES.scoring.firstCorrectBonus), 0, 100),
      streakBaseBonus: clampInt(Number(scoringRoot.streakBaseBonus ?? DEFAULT_LIVE_RULES.scoring.streakBaseBonus), 0, 100),
      streakGrowth: normalizeGrowthMode(scoringRoot.streakGrowth),
      streakLimit: clampInt(Number(scoringRoot.streakLimit ?? DEFAULT_LIVE_RULES.scoring.streakLimit), 1, 200)
    }
  };
}

export function withLiveRulesSettings(liveRules: LiveRules): Record<string, unknown> {
  return { liveRules };
}

