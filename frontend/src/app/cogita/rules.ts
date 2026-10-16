/**
 * COGITA — DIE REGELN EINER SITZUNG (COGITA.md §10, [I5, F24]).
 *
 * Aus dem Altbestand (`legacy/pages/cogita/live/liveSessionRules.ts`,
 * `liveScoring.ts` und der Rechnung im alten Dienst), jetzt als Vorlage, die
 * man selbst erklärt: was die erste Antwort auslöst und was „alle haben
 * geantwortet", die Uhren, die Boni für Schnelligkeit und den Ersten, die
 * Abzüge, die Serien. Die Voreinstellungen von damals sind Vorlagen.
 *
 * <b>Gezählt wird beim Gastgeber</b>: der Dienst liest keine Antwort. Der
 * Browser des Gastgebers öffnet die Antworten (Annahme des Bereichs), zählt
 * nach diesen Regeln und gibt die Punkte versiegelt an alle.
 */

export type Growth = 'linear' | 'exponential' | 'limited';
export type FirstAnswerAction = 'none' | 'start_timer' | 'reveal' | 'next';
export type AllAnsweredAction = 'none' | 'reveal' | 'next';
export type ExpireAction = 'none' | 'reveal' | 'next';

export interface LiveRules {
  readonly firstAnswerAction: FirstAnswerAction;
  readonly allAnsweredAction: AllAnsweredAction;
  readonly roundTimer: { readonly enabled: boolean; readonly seconds: number; readonly onExpire: ExpireAction };
  readonly actionTimer: { readonly enabled: boolean; readonly seconds: number; readonly onExpire: ExpireAction };
  readonly nextQuestion: { readonly mode: 'manual' | 'timer'; readonly seconds: number };
  readonly sessionTimer: { readonly enabled: boolean; readonly seconds: number };
  readonly bonusTimer: { readonly enabled: boolean; readonly seconds: number; readonly startMode: 'round_start' | 'first_answer' };
  readonly speedBonus: { readonly enabled: boolean; readonly maxPoints: number; readonly growth: Growth };
  readonly scoring: {
    readonly baseCorrect: number;
    readonly firstBonusMode: 'first_answer' | 'first_correct';
    readonly firstCorrectBonus: number;
    readonly wrongAnswerPenalty: number;
    readonly firstWrongPenaltyMode: 'first_overall_answer' | 'first_wrong';
    readonly firstWrongPenalty: number;
    readonly streakBaseBonus: number;
    readonly streakGrowth: Growth;
    readonly streakLimit: number;
    readonly wrongStreakBasePenalty: number;
    readonly wrongStreakGrowth: Growth;
    readonly wrongStreakLimit: number;
  };
}

export const DEFAULT_RULES: LiveRules = {
  firstAnswerAction: 'start_timer',
  allAnsweredAction: 'reveal',
  roundTimer: { enabled: true, seconds: 60, onExpire: 'reveal' },
  actionTimer: { enabled: true, seconds: 10, onExpire: 'reveal' },
  nextQuestion: { mode: 'manual', seconds: 6 },
  sessionTimer: { enabled: false, seconds: 1800 },
  bonusTimer: { enabled: true, seconds: 10, startMode: 'first_answer' },
  speedBonus: { enabled: true, maxPoints: 500, growth: 'exponential' },
  scoring: {
    baseCorrect: 1000, firstBonusMode: 'first_answer', firstCorrectBonus: 500, wrongAnswerPenalty: 0,
    firstWrongPenaltyMode: 'first_overall_answer', firstWrongPenalty: 0, streakBaseBonus: 1000, streakGrowth: 'limited',
    streakLimit: 5, wrongStreakBasePenalty: 0, wrongStreakGrowth: 'limited', wrongStreakLimit: 5
  }
};

export type SessionMode = 'simultaneous' | 'asynchronous';
export type HostView = 'panel' | 'question' | 'score';
export type ParticipantView = 'question' | 'score' | 'fullscreen';

export interface Preset {
  readonly id: string;
  readonly label: string;
  readonly says: string;
  readonly mode: SessionMode;
  readonly hostView: HostView;
  readonly participantView: ParticipantView;
  readonly rules: LiveRules;
}

const r = (patch: Omit<Partial<LiveRules>, 'scoring'> & { scoring?: Partial<LiveRules['scoring']> }): LiveRules => ({
  ...DEFAULT_RULES, ...patch, scoring: { ...DEFAULT_RULES.scoring, ...(patch.scoring ?? {}) }
});

/** Die Voreinstellungen des Altbestands — als Vorlagen [F24]. */
export const PRESETS: readonly Preset[] = [
  {
    id: 'balanced_duel', label: 'Wyrównany pojedynek', says: 'Minuta na pytanie; po pierwszej odpowiedzi 10 s dla reszty; bonus za szybkość i serię.',
    mode: 'simultaneous', hostView: 'panel', participantView: 'question', rules: DEFAULT_RULES
  },
  {
    id: 'first_strike', label: 'Kto pierwszy', says: 'Liczy się pierwsza odpowiedź — po niej od razu dalej; za błąd odejmuje.',
    mode: 'simultaneous', hostView: 'question', participantView: 'fullscreen',
    rules: r({
      firstAnswerAction: 'next', allAnsweredAction: 'none',
      roundTimer: { enabled: false, seconds: 20, onExpire: 'none' }, actionTimer: { enabled: false, seconds: 10, onExpire: 'none' },
      nextQuestion: { mode: 'manual', seconds: 5 }, bonusTimer: { enabled: false, seconds: 10, startMode: 'first_answer' },
      speedBonus: { enabled: false, maxPoints: 0, growth: 'linear' },
      scoring: { baseCorrect: 1500, firstCorrectBonus: 0, wrongAnswerPenalty: 1000, firstWrongPenalty: 500, streakBaseBonus: 0, streakGrowth: 'linear', wrongStreakBasePenalty: 250, wrongStreakLimit: 4 }
    })
  },
  {
    id: 'sprint_race', label: 'Sprint', says: '12 s na pytanie, potem od razu następne; duży bonus za szybkość.',
    mode: 'simultaneous', hostView: 'question', participantView: 'fullscreen',
    rules: r({
      firstAnswerAction: 'start_timer', allAnsweredAction: 'next',
      roundTimer: { enabled: true, seconds: 12, onExpire: 'next' }, actionTimer: { enabled: true, seconds: 8, onExpire: 'next' },
      nextQuestion: { mode: 'manual', seconds: 4 }, bonusTimer: { enabled: true, seconds: 8, startMode: 'first_answer' },
      speedBonus: { enabled: true, maxPoints: 700, growth: 'exponential' },
      scoring: { baseCorrect: 900, firstCorrectBonus: 600, streakBaseBonus: 900, streakLimit: 4, wrongStreakLimit: 4 }
    })
  },
  {
    id: 'accuracy_focus', label: 'Dokładność', says: 'Bez pośpiechu: 35 s, bez bonusu za szybkość; liczy się trafność i seria.',
    mode: 'simultaneous', hostView: 'panel', participantView: 'question',
    rules: r({
      firstAnswerAction: 'none', allAnsweredAction: 'reveal',
      roundTimer: { enabled: true, seconds: 35, onExpire: 'reveal' }, actionTimer: { enabled: false, seconds: 20, onExpire: 'none' },
      nextQuestion: { mode: 'manual', seconds: 8 }, bonusTimer: { enabled: false, seconds: 20, startMode: 'round_start' },
      speedBonus: { enabled: false, maxPoints: 0, growth: 'linear' },
      scoring: { baseCorrect: 1200, firstBonusMode: 'first_correct', firstCorrectBonus: 200, streakBaseBonus: 800, streakLimit: 6, wrongStreakLimit: 6 }
    })
  },
  {
    id: 'streak_master', label: 'Mistrz serii', says: 'Krótkie rundy; najwięcej daje seria dobrych odpowiedzi.',
    mode: 'simultaneous', hostView: 'score', participantView: 'question',
    rules: r({
      roundTimer: { enabled: true, seconds: 14, onExpire: 'reveal' }, actionTimer: { enabled: true, seconds: 12, onExpire: 'reveal' },
      nextQuestion: { mode: 'manual', seconds: 5 }, bonusTimer: { enabled: true, seconds: 12, startMode: 'first_answer' },
      speedBonus: { enabled: true, maxPoints: 300, growth: 'linear' },
      scoring: { baseCorrect: 800, firstCorrectBonus: 300, streakBaseBonus: 1400, streakLimit: 6, wrongStreakLimit: 6 }
    })
  },
  {
    id: 'marathon_classic', label: 'Maraton', says: 'Pytanie za pytaniem, samo przechodzi dalej po 5 s.',
    mode: 'simultaneous', hostView: 'panel', participantView: 'score',
    rules: r({
      firstAnswerAction: 'none', allAnsweredAction: 'reveal',
      roundTimer: { enabled: true, seconds: 20, onExpire: 'reveal' }, actionTimer: { enabled: false, seconds: 15, onExpire: 'reveal' },
      nextQuestion: { mode: 'timer', seconds: 5 }, bonusTimer: { enabled: true, seconds: 15, startMode: 'round_start' },
      speedBonus: { enabled: true, maxPoints: 250, growth: 'linear' },
      scoring: { baseCorrect: 1100, firstCorrectBonus: 250, streakBaseBonus: 900, streakLimit: 7, wrongStreakLimit: 7 }
    })
  },
  {
    id: 'async_challenge', label: 'Wyzwanie we własnym tempie', says: 'Każdy odpowiada, kiedy chce, do końca czasu sesji (30 min).',
    mode: 'asynchronous', hostView: 'score', participantView: 'question',
    rules: r({
      firstAnswerAction: 'none', allAnsweredAction: 'none',
      roundTimer: { enabled: false, seconds: 30, onExpire: 'none' }, actionTimer: { enabled: false, seconds: 10, onExpire: 'none' },
      nextQuestion: { mode: 'timer', seconds: 6 }, sessionTimer: { enabled: true, seconds: 1800 },
      bonusTimer: { enabled: false, seconds: 10, startMode: 'round_start' }, speedBonus: { enabled: false, maxPoints: 0, growth: 'linear' },
      scoring: { firstCorrectBonus: 0 }
    })
  }
];

export const presetOf = (id: string): Preset | undefined => PRESETS.find((p) => p.id === id);

/* -- Duldsam lesen ---------------------------------------------------------------------- */

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
};
const growthOf = (v: unknown): Growth => (v === 'exponential' || v === 'limited' ? v : 'linear');
const flag = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const pickOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

export function readRules(raw: unknown): LiveRules {
  const d = isObject(raw) ? raw : {};
  const part = (key: string) => (isObject(d[key]) ? (d[key] as Record<string, unknown>) : {});
  const round = part('roundTimer');
  const action = part('actionTimer');
  const next = part('nextQuestion');
  const session = part('sessionTimer');
  const bonus = part('bonusTimer');
  const speed = part('speedBonus');
  const s = part('scoring');
  const D = DEFAULT_RULES;
  const firstAnswerAction = pickOf(d.firstAnswerAction, ['none', 'start_timer', 'reveal', 'next'] as const, D.firstAnswerAction);
  const speedOn = flag(speed.enabled, D.speedBonus.enabled);
  return {
    firstAnswerAction,
    allAnsweredAction: pickOf(d.allAnsweredAction, ['none', 'reveal', 'next'] as const, D.allAnsweredAction),
    roundTimer: { enabled: flag(round.enabled, D.roundTimer.enabled), seconds: clampInt(round.seconds, 3, 600, D.roundTimer.seconds), onExpire: pickOf(round.onExpire, ['none', 'reveal', 'next'] as const, D.roundTimer.onExpire) },
    actionTimer: {
      enabled: firstAnswerAction === 'start_timer' && flag(action.enabled, D.actionTimer.enabled),
      seconds: clampInt(action.seconds, 3, 600, D.actionTimer.seconds),
      onExpire: pickOf(action.onExpire, ['none', 'reveal', 'next'] as const, D.actionTimer.onExpire)
    },
    nextQuestion: { mode: next.mode === 'timer' ? 'timer' : 'manual', seconds: clampInt(next.seconds, 1, 120, D.nextQuestion.seconds) },
    sessionTimer: { enabled: flag(session.enabled, D.sessionTimer.enabled), seconds: clampInt(session.seconds, 10, 86_400, D.sessionTimer.seconds) },
    bonusTimer: { enabled: speedOn && flag(bonus.enabled, D.bonusTimer.enabled), seconds: clampInt(bonus.seconds, 1, 600, D.bonusTimer.seconds), startMode: bonus.startMode === 'round_start' ? 'round_start' : 'first_answer' },
    speedBonus: { enabled: speedOn, maxPoints: clampInt(speed.maxPoints, 0, 500_000, D.speedBonus.maxPoints), growth: growthOf(speed.growth ?? D.speedBonus.growth) },
    scoring: {
      baseCorrect: clampInt(s.baseCorrect, 0, 500_000, D.scoring.baseCorrect),
      firstBonusMode: s.firstBonusMode === 'first_correct' ? 'first_correct' : 'first_answer',
      firstCorrectBonus: clampInt(s.firstCorrectBonus, 0, 500_000, D.scoring.firstCorrectBonus),
      wrongAnswerPenalty: clampInt(s.wrongAnswerPenalty, 0, 500_000, D.scoring.wrongAnswerPenalty),
      firstWrongPenaltyMode: s.firstWrongPenaltyMode === 'first_wrong' ? 'first_wrong' : 'first_overall_answer',
      firstWrongPenalty: clampInt(s.firstWrongPenalty, 0, 500_000, D.scoring.firstWrongPenalty),
      streakBaseBonus: clampInt(s.streakBaseBonus, 0, 500_000, D.scoring.streakBaseBonus),
      streakGrowth: growthOf(s.streakGrowth ?? D.scoring.streakGrowth),
      streakLimit: clampInt(s.streakLimit, 1, 200, D.scoring.streakLimit),
      wrongStreakBasePenalty: clampInt(s.wrongStreakBasePenalty, 0, 500_000, D.scoring.wrongStreakBasePenalty),
      wrongStreakGrowth: growthOf(s.wrongStreakGrowth ?? D.scoring.wrongStreakGrowth),
      wrongStreakLimit: clampInt(s.wrongStreakLimit, 1, 200, D.scoring.wrongStreakLimit)
    }
  };
}

/* -- Zählen ---------------------------------------------------------------------------------- */

/** Wie ein Bonus mit dem Anteil wächst — wie im alten Dienst. */
export function grow(mode: Growth, ratio: number): number {
  const x = Math.max(0, Math.min(1, ratio));
  return mode === 'exponential' ? x * x : mode === 'limited' ? Math.min(1, x * 1.6) : x;
}

/** Was eine Serie bringt: ab der zweiten richtigen Antwort, voll nach `limit` weiteren. */
export function streakValue(base: number, count: number, limit: number, mode: Growth): number {
  const max = Math.max(0, Math.round(base));
  const extra = Math.max(0, Math.round(count) - 1);
  if (max === 0 || extra === 0) return 0;
  return Math.max(0, Math.min(500_000, Math.round(max * grow(mode, Math.min(1, extra / Math.max(1, limit))))));
}

export interface RoundAnswer {
  readonly participant: string;
  /** Wann (ms) — die Reihenfolge entscheidet „wer zuerst". */
  readonly at: number;
  readonly correctness: number;
}

export interface Points {
  readonly total: number;
  readonly base: number;
  readonly first: number;
  readonly speed: number;
  readonly streak: number;
  readonly wrong: number;
  readonly firstWrong: number;
  readonly wrongStreak: number;
  readonly correct: boolean;
}

/**
 * EINE RUNDE ZÄHLEN. `history`: je Teilnehmer die früheren Runden, die
 * jüngste zuerst (richtig/falsch) — daraus die Serien. `roundStart`: wann die
 * Frage kam; die Uhr des Bonus läuft ab da oder ab der ersten Antwort.
 */
export function scoreRound(rules: LiveRules, answers: readonly RoundAnswer[], roundStart: number, history: (participant: string) => readonly boolean[], correctAt = 0.999): Map<string, Points> {
  const out = new Map<string, Points>();
  const sorted = answers.slice().sort((a, b) => a.at - b.at);
  const firstAt = sorted[0]?.at ?? roundStart;
  let firstSeen = false;
  let firstCorrectSeen = false;
  let firstWrongSeen = false;
  const s = rules.scoring;

  for (const one of sorted) {
    if (out.has(one.participant)) continue;
    const correct = one.correctness >= correctAt;
    const past = history(one.participant);
    const streakBefore = past.findIndex((x) => !x) === -1 ? past.length : past.findIndex((x) => !x);
    const wrongBefore = past.findIndex((x) => x) === -1 ? past.length : past.findIndex((x) => x);
    const isFirst = !firstSeen;
    const isFirstCorrect = correct && !firstCorrectSeen;
    const isFirstWrong = !correct && !firstWrongSeen;
    firstSeen = true;
    if (correct) firstCorrectSeen = true; else firstWrongSeen = true;

    let first = 0;
    if (s.firstCorrectBonus > 0 && ((s.firstBonusMode === 'first_answer' && isFirst && correct) || (s.firstBonusMode === 'first_correct' && isFirstCorrect))) first = s.firstCorrectBonus;

    let base = 0;
    let speed = 0;
    let streak = 0;
    let wrong = 0;
    let firstWrong = 0;
    let wrongStreak = 0;
    if (correct) {
      base = s.baseCorrect;
      if (rules.bonusTimer.enabled && rules.speedBonus.enabled && rules.speedBonus.maxPoints > 0) {
        const start = rules.bonusTimer.startMode === 'first_answer' ? firstAt : roundStart;
        const end = start + Math.max(1, rules.bonusTimer.seconds) * 1000;
        if (one.at <= end) speed = Math.round(rules.speedBonus.maxPoints * grow(rules.speedBonus.growth, (end - one.at) / Math.max(1, end - start)));
      }
      streak = streakValue(s.streakBaseBonus, streakBefore + 1, s.streakLimit, s.streakGrowth);
    } else {
      wrong = s.wrongAnswerPenalty;
      firstWrong = (s.firstWrongPenaltyMode === 'first_overall_answer' && isFirst) || (s.firstWrongPenaltyMode === 'first_wrong' && isFirstWrong) ? s.firstWrongPenalty : 0;
      wrongStreak = streakValue(s.wrongStreakBasePenalty, wrongBefore + 1, s.wrongStreakLimit, s.wrongStreakGrowth);
    }
    const total = Math.max(-500_000, Math.min(500_000, base + first + speed + streak - wrong - firstWrong - wrongStreak));
    out.set(one.participant, { total, base, first, speed, streak, wrong, firstWrong, wrongStreak, correct });
  }
  return out;
}

/* -- Was als Nächstes geschieht -------------------------------------------------------------- */

export type Phase = 'lobby' | 'question' | 'reveal' | 'finished';

/** Was die Regeln jetzt verlangen — der Gastgeber führt es aus. */
export type Move = 'none' | 'reveal' | 'next' | 'start_timer';

/** Nach der ersten Antwort einer Runde. */
export const onFirstAnswer = (rules: LiveRules): Move => (rules.firstAnswerAction === 'start_timer' ? (rules.actionTimer.enabled ? 'start_timer' : 'none') : rules.firstAnswerAction);

/** Wenn alle geantwortet haben. */
export const onAllAnswered = (rules: LiveRules): Move => rules.allAnsweredAction;

/** Wann die Runde von selbst endet (ms) — die Rundenuhr, oder die nach der ersten Antwort, was früher kommt. */
export function roundDeadline(rules: LiveRules, roundStart: number, firstAnswerAt: number | null): { at: number; move: Move } | null {
  const options: { at: number; move: Move }[] = [];
  if (rules.roundTimer.enabled) options.push({ at: roundStart + rules.roundTimer.seconds * 1000, move: rules.roundTimer.onExpire });
  if (rules.actionTimer.enabled && firstAnswerAt !== null && rules.firstAnswerAction === 'start_timer') options.push({ at: firstAnswerAt + rules.actionTimer.seconds * 1000, move: rules.actionTimer.onExpire });
  const live = options.filter((o) => o.move !== 'none');
  if (live.length === 0) return null;
  return live.reduce((a, b) => (b.at < a.at ? b : a));
}

/** Die Regeln in Sätzen — für den Gastgeber vor dem Start und die Teilnehmer im Warteraum. */
export function describeRules(rules: LiveRules, mode: SessionMode = 'simultaneous'): string[] {
  const action = (m: string) => (m === 'next' ? 'pokaż wynik i przejdź dalej' : m === 'reveal' ? 'pokaż wynik' : m === 'start_timer' ? 'uruchom odliczanie' : 'nic');
  const lines: string[] = [];
  if (mode === 'asynchronous') lines.push('Każdy odpowiada we własnym tempie.');
  if (rules.roundTimer.enabled) lines.push(`Na pytanie jest ${rules.roundTimer.seconds} s — potem: ${action(rules.roundTimer.onExpire)}.`);
  lines.push(`Pierwsza odpowiedź: ${action(rules.firstAnswerAction)}${rules.actionTimer.enabled ? ` (${rules.actionTimer.seconds} s dla pozostałych)` : ''}.`);
  lines.push(`Gdy wszyscy odpowiedzą: ${action(rules.allAnsweredAction)}.`);
  lines.push(`Dobra odpowiedź: ${rules.scoring.baseCorrect} pkt${rules.scoring.firstCorrectBonus > 0 ? `, pierwsza dobra +${rules.scoring.firstCorrectBonus}` : ''}${rules.speedBonus.enabled && rules.bonusTimer.enabled ? `, za szybkość do +${rules.speedBonus.maxPoints}` : ''}${rules.scoring.streakBaseBonus > 0 ? `, seria do +${rules.scoring.streakBaseBonus}` : ''}.`);
  if (rules.scoring.wrongAnswerPenalty > 0 || rules.scoring.firstWrongPenalty > 0 || rules.scoring.wrongStreakBasePenalty > 0) {
    lines.push(`Za błąd: −${rules.scoring.wrongAnswerPenalty}${rules.scoring.firstWrongPenalty > 0 ? `, pierwszy błąd −${rules.scoring.firstWrongPenalty}` : ''}${rules.scoring.wrongStreakBasePenalty > 0 ? `, seria błędów do −${rules.scoring.wrongStreakBasePenalty}` : ''}.`);
  }
  lines.push(rules.nextQuestion.mode === 'timer' ? `Następne pytanie samo po ${rules.nextQuestion.seconds} s.` : 'Następne pytanie — gdy gospodarz kliknie.');
  if (rules.sessionTimer.enabled) lines.push(`Sesja trwa ${Math.round(rules.sessionTimer.seconds / 60)} min.`);
  return lines;
}
