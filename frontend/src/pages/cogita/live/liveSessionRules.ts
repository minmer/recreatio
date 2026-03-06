export type BonusGrowthMode = 'linear' | 'exponential' | 'limited';
export type FirstAnswerAction = 'none' | 'start_timer' | 'reveal' | 'next';
export type AllAnsweredAction = 'none' | 'reveal' | 'next';
export type TimerExpireAction = 'none' | 'reveal' | 'next';
export type NextQuestionMode = 'manual' | 'timer';

export type LiveRules = {
  firstAnswerAction: FirstAnswerAction;
  allAnsweredAction: AllAnsweredAction;
  roundTimer: {
    enabled: boolean;
    seconds: number;
    onExpire: TimerExpireAction;
  };
  actionTimer: {
    enabled: boolean;
    seconds: number;
    onExpire: TimerExpireAction;
  };
  nextQuestion: {
    mode: NextQuestionMode;
    seconds: number;
  };
  bonusTimer: {
    enabled: boolean;
    seconds: number;
    startMode: 'round_start' | 'first_answer';
  };
  speedBonus: {
    enabled: boolean;
    maxPoints: number;
    growth: BonusGrowthMode;
  };
  scoring: {
    baseCorrect: number;
    firstCorrectBonus: number;
    wrongAnswerPenalty: number;
    firstWrongPenalty: number;
    streakBaseBonus: number;
    streakGrowth: BonusGrowthMode;
    streakLimit: number;
  };
};

export const DEFAULT_LIVE_RULES: LiveRules = {
  firstAnswerAction: 'start_timer',
  allAnsweredAction: 'reveal',
  roundTimer: {
    enabled: true,
    seconds: 60,
    onExpire: 'reveal'
  },
  actionTimer: {
    enabled: true,
    seconds: 10,
    onExpire: 'reveal'
  },
  nextQuestion: {
    mode: 'manual',
    seconds: 6
  },
  bonusTimer: {
    enabled: true,
    seconds: 10,
    startMode: 'first_answer'
  },
  speedBonus: {
    enabled: true,
    maxPoints: 500,
    growth: 'exponential'
  },
  scoring: {
    baseCorrect: 1000,
    firstCorrectBonus: 500,
    wrongAnswerPenalty: 0,
    firstWrongPenalty: 0,
    streakBaseBonus: 1000,
    streakGrowth: 'limited',
    streakLimit: 5
  }
};

export type LivePresetId =
  | 'balanced_duel'
  | 'first_strike'
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
      roundTimer: { enabled: true, seconds: 60, onExpire: 'reveal' },
      actionTimer: { enabled: true, seconds: 10, onExpire: 'reveal' },
      nextQuestion: { mode: 'manual', seconds: 6 },
      bonusTimer: { enabled: true, seconds: 10, startMode: 'first_answer' },
      speedBonus: { enabled: true, maxPoints: 500, growth: 'exponential' },
      scoring: { baseCorrect: 1000, firstCorrectBonus: 500, wrongAnswerPenalty: 0, firstWrongPenalty: 0, streakBaseBonus: 1000, streakGrowth: 'limited', streakLimit: 5 }
    }
  },
  {
    id: 'first_strike',
    sessionMode: 'simultaneous',
    hostViewMode: 'question',
    participantViewMode: 'fullscreen',
    rules: {
      firstAnswerAction: 'next',
      allAnsweredAction: 'none',
      roundTimer: { enabled: false, seconds: 20, onExpire: 'none' },
      actionTimer: { enabled: false, seconds: 10, onExpire: 'none' },
      nextQuestion: { mode: 'manual', seconds: 5 },
      bonusTimer: { enabled: false, seconds: 10, startMode: 'first_answer' },
      speedBonus: { enabled: false, maxPoints: 0, growth: 'linear' },
      scoring: { baseCorrect: 1500, firstCorrectBonus: 0, wrongAnswerPenalty: 1000, firstWrongPenalty: 500, streakBaseBonus: 0, streakGrowth: 'linear', streakLimit: 5 }
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
      roundTimer: { enabled: true, seconds: 12, onExpire: 'next' },
      actionTimer: { enabled: true, seconds: 8, onExpire: 'next' },
      nextQuestion: { mode: 'manual', seconds: 4 },
      bonusTimer: { enabled: true, seconds: 8, startMode: 'first_answer' },
      speedBonus: { enabled: true, maxPoints: 700, growth: 'exponential' },
      scoring: { baseCorrect: 900, firstCorrectBonus: 600, wrongAnswerPenalty: 0, firstWrongPenalty: 0, streakBaseBonus: 900, streakGrowth: 'limited', streakLimit: 4 }
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
      roundTimer: { enabled: true, seconds: 35, onExpire: 'reveal' },
      actionTimer: { enabled: false, seconds: 20, onExpire: 'none' },
      nextQuestion: { mode: 'manual', seconds: 8 },
      bonusTimer: { enabled: false, seconds: 20, startMode: 'round_start' },
      speedBonus: { enabled: false, maxPoints: 0, growth: 'linear' },
      scoring: { baseCorrect: 1200, firstCorrectBonus: 200, wrongAnswerPenalty: 0, firstWrongPenalty: 0, streakBaseBonus: 800, streakGrowth: 'limited', streakLimit: 6 }
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
      roundTimer: { enabled: true, seconds: 14, onExpire: 'reveal' },
      actionTimer: { enabled: true, seconds: 12, onExpire: 'reveal' },
      nextQuestion: { mode: 'manual', seconds: 5 },
      bonusTimer: { enabled: true, seconds: 12, startMode: 'first_answer' },
      speedBonus: { enabled: true, maxPoints: 300, growth: 'linear' },
      scoring: { baseCorrect: 800, firstCorrectBonus: 300, wrongAnswerPenalty: 0, firstWrongPenalty: 0, streakBaseBonus: 1400, streakGrowth: 'limited', streakLimit: 6 }
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
      roundTimer: { enabled: true, seconds: 20, onExpire: 'reveal' },
      actionTimer: { enabled: false, seconds: 15, onExpire: 'reveal' },
      nextQuestion: { mode: 'timer', seconds: 5 },
      bonusTimer: { enabled: true, seconds: 15, startMode: 'round_start' },
      speedBonus: { enabled: true, maxPoints: 250, growth: 'linear' },
      scoring: { baseCorrect: 1100, firstCorrectBonus: 250, wrongAnswerPenalty: 0, firstWrongPenalty: 0, streakBaseBonus: 900, streakGrowth: 'limited', streakLimit: 7 }
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
      roundTimer: { enabled: false, seconds: 30, onExpire: 'none' },
      actionTimer: { enabled: false, seconds: 10, onExpire: 'none' },
      nextQuestion: { mode: 'timer', seconds: 6 },
      bonusTimer: { enabled: false, seconds: 10, startMode: 'round_start' },
      speedBonus: { enabled: false, maxPoints: 0, growth: 'linear' },
      scoring: { baseCorrect: 1000, firstCorrectBonus: 0, wrongAnswerPenalty: 0, firstWrongPenalty: 0, streakBaseBonus: 1000, streakGrowth: 'limited', streakLimit: 5 }
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
      : {};

  const actionTimerRoot =
    liveRulesRoot.actionTimer && typeof liveRulesRoot.actionTimer === 'object'
      ? (liveRulesRoot.actionTimer as Record<string, unknown>)
      : {};
  const roundTimerRoot =
    liveRulesRoot.roundTimer && typeof liveRulesRoot.roundTimer === 'object'
      ? (liveRulesRoot.roundTimer as Record<string, unknown>)
      : {};
  const bonusTimerRoot =
    liveRulesRoot.bonusTimer && typeof liveRulesRoot.bonusTimer === 'object'
      ? (liveRulesRoot.bonusTimer as Record<string, unknown>)
      : {};
  const nextQuestionRoot =
    liveRulesRoot.nextQuestion && typeof liveRulesRoot.nextQuestion === 'object'
      ? (liveRulesRoot.nextQuestion as Record<string, unknown>)
      : {};
  const speedBonusRoot =
    liveRulesRoot.speedBonus && typeof liveRulesRoot.speedBonus === 'object'
      ? (liveRulesRoot.speedBonus as Record<string, unknown>)
      : {};
  const scoringRoot =
    liveRulesRoot.scoring && typeof liveRulesRoot.scoring === 'object'
      ? (liveRulesRoot.scoring as Record<string, unknown>)
      : {};

  const firstAnswerAction: FirstAnswerAction =
    liveRulesRoot.firstAnswerAction === 'reveal' || liveRulesRoot.firstAnswerAction === 'none' || liveRulesRoot.firstAnswerAction === 'next'
      ? liveRulesRoot.firstAnswerAction
      : 'start_timer';
  const allAnsweredAction: AllAnsweredAction =
    liveRulesRoot.allAnsweredAction === 'none' || liveRulesRoot.allAnsweredAction === 'next'
      ? liveRulesRoot.allAnsweredAction
      : 'reveal';
  const onExpire: TimerExpireAction =
    actionTimerRoot.onExpire === 'none' || actionTimerRoot.onExpire === 'next'
      ? actionTimerRoot.onExpire
      : 'reveal';
  const roundOnExpire: TimerExpireAction =
    roundTimerRoot.onExpire === 'none' || roundTimerRoot.onExpire === 'next'
      ? roundTimerRoot.onExpire
      : 'reveal';
  const parsedSpeedEnabled = speedBonusRoot.enabled == null ? DEFAULT_LIVE_RULES.speedBonus.enabled : Boolean(speedBonusRoot.enabled);
  const nextQuestionMode: NextQuestionMode =
    nextQuestionRoot.mode === 'timer' ? 'timer' : 'manual';

  return {
    firstAnswerAction,
    allAnsweredAction,
    roundTimer: {
      enabled: roundTimerRoot.enabled == null ? DEFAULT_LIVE_RULES.roundTimer.enabled : Boolean(roundTimerRoot.enabled),
      seconds: clampInt(Number(roundTimerRoot.seconds ?? DEFAULT_LIVE_RULES.roundTimer.seconds), 3, 600),
      onExpire: roundOnExpire === 'none' ? 'reveal' : roundOnExpire
    },
    actionTimer: {
      enabled:
        firstAnswerAction === 'start_timer'
          ? actionTimerRoot.enabled == null
            ? DEFAULT_LIVE_RULES.actionTimer.enabled
            : Boolean(actionTimerRoot.enabled)
          : false,
      seconds: clampInt(Number(actionTimerRoot.seconds ?? DEFAULT_LIVE_RULES.actionTimer.seconds), 3, 600),
      onExpire: onExpire === 'none' ? 'reveal' : onExpire,
    },
    nextQuestion: {
      mode: nextQuestionMode,
      seconds: clampInt(Number(nextQuestionRoot.seconds ?? DEFAULT_LIVE_RULES.nextQuestion.seconds), 1, 120)
    },
    bonusTimer: {
      enabled: parsedSpeedEnabled && (bonusTimerRoot.enabled == null ? DEFAULT_LIVE_RULES.bonusTimer.enabled : Boolean(bonusTimerRoot.enabled)),
      seconds: clampInt(Number(bonusTimerRoot.seconds ?? DEFAULT_LIVE_RULES.bonusTimer.seconds), 1, 600),
      startMode: bonusTimerRoot.startMode === 'round_start' ? 'round_start' : 'first_answer'
    },
    speedBonus: {
      enabled: parsedSpeedEnabled,
      maxPoints: clampInt(Number(speedBonusRoot.maxPoints ?? DEFAULT_LIVE_RULES.speedBonus.maxPoints), 0, 500000),
      growth: normalizeGrowthMode(speedBonusRoot.growth)
    },
    scoring: {
      baseCorrect: clampInt(Number(scoringRoot.baseCorrect ?? DEFAULT_LIVE_RULES.scoring.baseCorrect), 0, 500000),
      firstCorrectBonus: clampInt(Number(scoringRoot.firstCorrectBonus ?? DEFAULT_LIVE_RULES.scoring.firstCorrectBonus), 0, 500000),
      wrongAnswerPenalty: clampInt(Number(scoringRoot.wrongAnswerPenalty ?? DEFAULT_LIVE_RULES.scoring.wrongAnswerPenalty), 0, 500000),
      firstWrongPenalty: clampInt(Number(scoringRoot.firstWrongPenalty ?? DEFAULT_LIVE_RULES.scoring.firstWrongPenalty), 0, 500000),
      streakBaseBonus: clampInt(Number(scoringRoot.streakBaseBonus ?? DEFAULT_LIVE_RULES.scoring.streakBaseBonus), 0, 500000),
      streakGrowth: normalizeGrowthMode(scoringRoot.streakGrowth),
      streakLimit: clampInt(Number(scoringRoot.streakLimit ?? DEFAULT_LIVE_RULES.scoring.streakLimit), 1, 200)
    }
  };
}

export function withLiveRulesSettings(liveRules: LiveRules): Record<string, unknown> {
  return { liveRules };
}
