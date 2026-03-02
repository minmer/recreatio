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
    seconds: 10,
    triggerMode: 'first_or_single',
    onExpire: 'reveal',
    speedBonusMax: 500,
    speedBonusGrowth: 'exponential'
  },
  scoring: {
    baseCorrect: 1000,
    firstCorrectBonus: 500,
    streakBaseBonus: 1000,
    streakGrowth: 'limited',
    streakLimit: 5
  }
};

export type LivePresetId =
  | 'balanced_duel'
  | 'sprint_race'
  | 'accuracy_focus'
  | 'streak_master'
  | 'marathon_classic'
  | 'async_challenge'
  | 'custom';

export type LivePresetDefinition = {
  id: Exclude<LivePresetId, 'custom'>;
  sessionMode: 'simultaneous' | 'asynchronous';
  hostViewMode: 'panel' | 'question' | 'score';
  participantViewMode: 'question' | 'score' | 'fullscreen';
  rules: LiveRules;
};

const PRESET_DEFINITIONS: LivePresetDefinition[] = [
  {
    id: 'balanced_duel',
    sessionMode: 'simultaneous',
    hostViewMode: 'panel',
    participantViewMode: 'question',
    rules: {
      firstAnswerAction: 'start_timer',
      allAnsweredAction: 'reveal',
      timer: { enabled: true, seconds: 10, triggerMode: 'first_or_single', onExpire: 'reveal', speedBonusMax: 500, speedBonusGrowth: 'exponential' },
      scoring: { baseCorrect: 1000, firstCorrectBonus: 500, streakBaseBonus: 1000, streakGrowth: 'limited', streakLimit: 5 }
    }
  },
  {
    id: 'sprint_race',
    sessionMode: 'simultaneous',
    hostViewMode: 'question',
    participantViewMode: 'fullscreen',
    rules: {
      firstAnswerAction: 'start_timer',
      allAnsweredAction: 'next',
      timer: { enabled: true, seconds: 8, triggerMode: 'first_or_single', onExpire: 'next', speedBonusMax: 700, speedBonusGrowth: 'exponential' },
      scoring: { baseCorrect: 900, firstCorrectBonus: 600, streakBaseBonus: 900, streakGrowth: 'limited', streakLimit: 4 }
    }
  },
  {
    id: 'accuracy_focus',
    sessionMode: 'simultaneous',
    hostViewMode: 'panel',
    participantViewMode: 'question',
    rules: {
      firstAnswerAction: 'none',
      allAnsweredAction: 'reveal',
      timer: { enabled: false, seconds: 20, triggerMode: 'first_or_single', onExpire: 'none', speedBonusMax: 0, speedBonusGrowth: 'linear' },
      scoring: { baseCorrect: 1200, firstCorrectBonus: 200, streakBaseBonus: 800, streakGrowth: 'limited', streakLimit: 6 }
    }
  },
  {
    id: 'streak_master',
    sessionMode: 'simultaneous',
    hostViewMode: 'score',
    participantViewMode: 'question',
    rules: {
      firstAnswerAction: 'start_timer',
      allAnsweredAction: 'reveal',
      timer: { enabled: true, seconds: 12, triggerMode: 'first_or_single', onExpire: 'reveal', speedBonusMax: 300, speedBonusGrowth: 'linear' },
      scoring: { baseCorrect: 800, firstCorrectBonus: 300, streakBaseBonus: 1400, streakGrowth: 'limited', streakLimit: 6 }
    }
  },
  {
    id: 'marathon_classic',
    sessionMode: 'simultaneous',
    hostViewMode: 'panel',
    participantViewMode: 'score',
    rules: {
      firstAnswerAction: 'none',
      allAnsweredAction: 'reveal',
      timer: { enabled: true, seconds: 15, triggerMode: 'first_or_single', onExpire: 'reveal', speedBonusMax: 250, speedBonusGrowth: 'linear' },
      scoring: { baseCorrect: 1100, firstCorrectBonus: 250, streakBaseBonus: 900, streakGrowth: 'limited', streakLimit: 7 }
    }
  },
  {
    id: 'async_challenge',
    sessionMode: 'asynchronous',
    hostViewMode: 'score',
    participantViewMode: 'question',
    rules: {
      firstAnswerAction: 'none',
      allAnsweredAction: 'none',
      timer: { enabled: false, seconds: 10, triggerMode: 'first_or_single', onExpire: 'none', speedBonusMax: 0, speedBonusGrowth: 'linear' },
      scoring: { baseCorrect: 1000, firstCorrectBonus: 0, streakBaseBonus: 1000, streakGrowth: 'limited', streakLimit: 5 }
    }
  }
];

export function getLivePresets(): LivePresetDefinition[] {
  return PRESET_DEFINITIONS;
}

export function getLivePresetById(id: LivePresetId): LivePresetDefinition | null {
  if (id === 'custom') return null;
  return PRESET_DEFINITIONS.find((preset) => preset.id === id) ?? null;
}

function liveRulesEqual(a: LiveRules, b: LiveRules) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function detectLivePreset(
  sessionMode: 'simultaneous' | 'asynchronous',
  hostViewMode: 'panel' | 'question' | 'score',
  participantViewMode: 'question' | 'score' | 'fullscreen',
  rules: LiveRules
): LivePresetId {
  const found = PRESET_DEFINITIONS.find(
    (preset) =>
      preset.sessionMode === sessionMode &&
      preset.hostViewMode === hostViewMode &&
      preset.participantViewMode === participantViewMode &&
      liveRulesEqual(preset.rules, rules)
  );
  return found?.id ?? 'custom';
}

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
      speedBonusMax: clampInt(Number(timerRoot.speedBonusMax ?? DEFAULT_LIVE_RULES.timer.speedBonusMax), 0, 500000),
      speedBonusGrowth: normalizeGrowthMode(timerRoot.speedBonusGrowth)
    },
    scoring: {
      baseCorrect: clampInt(Number(scoringRoot.baseCorrect ?? DEFAULT_LIVE_RULES.scoring.baseCorrect), 0, 500000),
      firstCorrectBonus: clampInt(Number(scoringRoot.firstCorrectBonus ?? DEFAULT_LIVE_RULES.scoring.firstCorrectBonus), 0, 500000),
      streakBaseBonus: clampInt(Number(scoringRoot.streakBaseBonus ?? DEFAULT_LIVE_RULES.scoring.streakBaseBonus), 0, 500000),
      streakGrowth: normalizeGrowthMode(scoringRoot.streakGrowth),
      streakLimit: clampInt(Number(scoringRoot.streakLimit ?? DEFAULT_LIVE_RULES.scoring.streakLimit), 1, 200)
    }
  };
}

export function withLiveRulesSettings(liveRules: LiveRules): Record<string, unknown> {
  return { liveRules };
}
