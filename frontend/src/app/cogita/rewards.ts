/**
 * 2026-11-02 — NAGRODY: PUNKTE, SERIEN, TAGESZIEL, STUFEN, ABZEICHEN (COGITA.md §12 „Nagrody”, IMPLEMENTATION-LOG C16).
 *
 * <b>Eine Regel ist ein Dokument der Baza</b> (Art `reward`, „Nagrody"): wie viele Punkte eine gute, eine halbe, eine
 * falsche Antwort bringt, eine neue Karte, eine utrwalona Karte (deren nächste Wiederholung erst nach `known.days` Tagen
 * kommt), eine schnelle Antwort, N gute hintereinander, das Tagesziel, jeder Tag der Serie; was das Tagesziel zählt
 * (Karten, Antworten, Punkte, Minuten); was einen Tag der Serie macht (das Ziel oder irgendeine Antwort) und wie viele
 * freie Tage sie verzeiht; die Stufen (ab wie vielen Punkten) und die Abzeichen (ein Mass ab einer Zahl). Eine Baza hat
 * beliebig viele; welche gilt, wählt jeder Ort selbst (ein Baustein auf der Seite, die Nauka über die Ustawienia).
 *
 * <b>Nichts davon wird gespeichert.</b> Alles ist eine reine Funktion der Antworten des Lernenden (`rewardState`):
 * dieselben Antworten und dieselbe Regel geben überall dieselben Punkte — auf der Seite, in der Nauka, ohne Netz, für
 * die Lehrerin aus den Antworten ihrer Klasse. Wer die Regel ändert, ändert die Punkte aller rückwirkend.
 *
 * <b>Ereignisse haben feste Kennungen</b> (aus der Antwort, dem Tag, der Karte): kommt eine neue Antwort, zeigt die
 * Oberfläche genau die Ereignisse, deren Kennung sie noch nicht kannte (`freshEvents`) — „+10", „Seria: 5. dzień".
 *
 * Mitgezählte Paare einer langen Liste (`lead`: die Antwort, mit der sie kamen) zählen für Karten, utrwalone Karten und
 * das Tagesziel in Karten — Punkte für die Antwort selbst, „nowa karta" und Serien gibt es nur einmal je Antwort.
 *
 * <b>2026-11-05 (Prompt 17) — Arten und Masse der Karte.</b> Jedes Abzeichen hat eine Art (`kind`, sonst aus dem Mass:
 * `badgeKindOf`) — danach ordnet die Seite „Odznaki i poziomy" (`BadgesPage.tsx`). Drei Masse kommen nicht aus den
 * Antworten allein, sondern aus dem Krajobraz (`regions` ganz gekonnte Gebiete der obersten Ebene, `map` Prozent der
 * gekonnten Themen, `clean` Tage hintereinander ohne Überfälliges — `cleanDays`): `rewardState` nimmt sie als `extra`.
 * Ein solches Abzeichen kommt, wenn das Mass die Schwelle hat; WANN es kam, merkt sich die Anwendung in den Werten des
 * Lernenden (`~award.<id>`, `withAwards`, `Learner.keepAwards`) und gibt es als `awarded` zurück — so steht es zu seiner
 * Zeit in den Ereignissen, auch bei der Lehrerin, die die Karte ihrer Klasse nicht misst.
 */

import { DEFAULT_SPACING, gradeOf, step, type CardState, type Spacing } from './knowness';
import { dayAdd, dayStart } from './lessons';

/* -- Die Regel ------------------------------------------------------------------------------------------------------ */

export const POINT_KINDS = ['correct', 'partial', 'wrong', 'first', 'known', 'fast', 'combo', 'goal', 'streak'] as const;
export type PointKind = (typeof POINT_KINDS)[number];

export const POINT_LABEL: Readonly<Record<PointKind, string>> = {
  correct: 'dobra odpowiedź',
  partial: 'częściowo dobra',
  wrong: 'za próbę (zła odpowiedź)',
  first: 'nowa karta',
  known: 'utrwalona karta',
  fast: 'szybka dobra odpowiedź',
  combo: 'dobre odpowiedzi z rzędu',
  goal: 'cel dnia osiągnięty',
  streak: 'kolejny dzień serii (razy dzień serii)'
};

export const GOAL_UNITS = ['cards', 'answers', 'points', 'minutes'] as const;
export type GoalUnit = (typeof GOAL_UNITS)[number];
export const GOAL_UNIT_LABEL: Readonly<Record<GoalUnit, string>> = { cards: 'różnych kart', answers: 'odpowiedzi', points: 'punktów', minutes: 'minut nauki' };

export const REWARD_MEASURES = ['points', 'streak', 'best', 'known', 'cards', 'answers', 'correct', 'days', 'combo', 'goals', 'level', 'regions', 'map', 'clean'] as const;
export type RewardMeasure = (typeof REWARD_MEASURES)[number];
export const MEASURE_LABEL: Readonly<Record<RewardMeasure, string>> = {
  points: 'punkty', streak: 'dni serii', best: 'najdłuższa seria (dni)', known: 'utrwalone karty', cards: 'różne karty',
  answers: 'odpowiedzi', correct: 'dobre odpowiedzi', days: 'dni nauki', combo: 'dobre z rzędu (najwięcej)', goals: 'dni z celem', level: 'poziom',
  regions: 'zdobyte obszary mapy', map: 'poznana mapa (%)', clean: 'dni z rzędu bez zaległości'
};

/**
 * 2026-11-05 (Prompt 17) — DIE MASSE DER KARTE: nicht aus den Antworten allein, sondern vom Krajobraz gemessen (er kennt die
 * Karte; `mapMeasures.ts` merkt sich die letzten in diesem Browser) — ganz gekonnte Gebiete der obersten Ebene, Prozent
 * (0–100) der gekonnten Themen, Tage hintereinander ohne Überfälliges (`cleanDays`).
 */
export const EXTRA_MEASURES = ['regions', 'map', 'clean'] as const;
export type ExtraMeasure = (typeof EXTRA_MEASURES)[number];
export type ExtraMeasures = Partial<Record<ExtraMeasure, number>>;
export const isExtraMeasure = (m: string): m is ExtraMeasure => (EXTRA_MEASURES as readonly string[]).includes(m);

export const BADGE_ICONS = ['star', 'flame', 'target', 'book', 'bolt', 'crown', 'medal', 'leaf', 'check', 'rocket'] as const;
export type BadgeIcon = (typeof BADGE_ICONS)[number];

/** 2026-11-05 (Prompt 17) — wofür ein Abzeichen steht; die Seite „Odznaki i poziomy" ordnet in dieser Folge. */
export const BADGE_KINDS = ['start', 'consistency', 'accuracy', 'volume', 'goals', 'exploration'] as const;
export type BadgeKind = (typeof BADGE_KINDS)[number];

export interface RewardLevel {
  /** Ab wie vielen Punkten. */
  readonly at: number;
  readonly name: string;
}

export interface RewardBadge {
  readonly id: string;
  readonly name: string;
  readonly says?: string;
  readonly icon: BadgeIcon;
  readonly measure: RewardMeasure;
  readonly atLeast: number;
  /** Punkte dazu, wenn es kommt (meist 0). */
  readonly points: number;
  /** 2026-11-05 (Prompt 17) — die Art; ohne sie folgt sie aus dem Mass (`badgeKindOf`). */
  readonly kind?: BadgeKind;
}

/**
 * 2026-11-05 (Prompt 17) — DIE ART EINES ABZEICHENS: die genannte, sonst aus dem Mass — kleine Schwellen der Anzahl (bis 10
 * Antworten, die erste utrwalona oder erste Karte) sind der Anfang, grössere die Menge.
 */
export function badgeKindOf(b: Pick<RewardBadge, 'measure' | 'atLeast' | 'kind'>): BadgeKind {
  if (b.kind !== undefined && (BADGE_KINDS as readonly string[]).includes(b.kind)) return b.kind;
  switch (b.measure) {
    case 'answers': return b.atLeast <= 10 ? 'start' : 'volume';
    case 'known': case 'cards': return b.atLeast <= 1 ? 'start' : 'volume';
    case 'points': return 'volume';
    case 'streak': case 'best': case 'days': return 'consistency';
    case 'correct': case 'combo': return 'accuracy';
    case 'goals': case 'level': return 'goals';
    case 'regions': case 'map': case 'clean': return 'exploration';
  }
}

export interface RewardRules {
  readonly name: string;
  readonly points: Readonly<Record<PointKind, number>>;
  /** Eine Karte ist utrwalona, sobald ihre nächste Wiederholung mindestens so viele Tage weg ist. */
  readonly known: { readonly days: number };
  /** „Szybka": eine gute Antwort in höchstens so vielen Sekunden. */
  readonly fast: { readonly seconds: number };
  /** Alle N guten Antworten hintereinander (in einer Sitzung, Pausen bis 30 min) ein Bonus. */
  readonly combo: { readonly every: number };
  readonly goal: { readonly amount: number; readonly unit: GoalUnit };
  /** Was einen Tag der Serie macht, wie viele Tage ohne Nauka sie verzeiht, bis zu welchem Tag ihr Bonus wächst. */
  readonly streak: { readonly counts: 'goal' | 'any'; readonly grace: number; readonly max: number };
  /** Aufsteigend nach `at`; leer: keine Stufen. */
  readonly levels: readonly RewardLevel[];
  readonly badges: readonly RewardBadge[];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};
const int = (v: unknown, fallback: number, min: number, max: number): number => Math.round(num(v, fallback, min, max));

/** Eine Kennung aus einem Namen: klein, ohne Zeichen. */
export const slugOf = (text: string): string =>
  text.toLocaleLowerCase('pl-PL').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

const DEFAULT_LEVELS: readonly RewardLevel[] = [
  { at: 0, name: 'Początkujący' }, { at: 100, name: 'Uczeń' }, { at: 300, name: 'Odkrywca' }, { at: 700, name: 'Znawca' },
  { at: 1500, name: 'Mistrz' }, { at: 3000, name: 'Mędrzec' }, { at: 6000, name: 'Erudyta' }, { at: 12000, name: 'Legenda' }
];

/* Die Folge der Schlüssel wie in `readRewards` — die eingebaute Regel liest sich unverändert zurück. */
const b = (id: string, name: string, icon: BadgeIcon, measure: RewardMeasure, atLeast: number, kind: BadgeKind, says?: string): RewardBadge =>
  ({ id, name, icon, measure, atLeast, points: 0, ...(says === undefined ? {} : { says }), kind });

/** Die Regel, wenn nichts anderes gewählt ist — „Punkty, seria i poziomy". */
export const DEFAULT_REWARDS: RewardRules = {
  name: 'Punkty, seria i poziomy',
  points: { correct: 10, partial: 5, wrong: 1, first: 5, known: 20, fast: 0, combo: 15, goal: 50, streak: 5 },
  known: { days: 1 },
  fast: { seconds: 8 },
  combo: { every: 5 },
  goal: { amount: 20, unit: 'cards' },
  streak: { counts: 'goal', grace: 0, max: 10 },
  levels: DEFAULT_LEVELS,
  badges: [
    b('pierwszy-krok', 'Pierwszy krok', 'star', 'answers', 1, 'start', 'Pierwsza odpowiedź.'),
    b('dziesiec-dobrych', 'Dziesiątka', 'check', 'correct', 10, 'accuracy', '10 dobrych odpowiedzi.'),
    b('celny', 'Celny', 'bolt', 'combo', 10, 'accuracy', '10 dobrych odpowiedzi z rzędu.'),
    b('pierwsza-utrwalona', 'Pierwsza utrwalona', 'leaf', 'known', 1, 'start', 'Karta, którą pamiętasz co najmniej dzień.'),
    b('piecdziesiat-utrwalonych', 'Pięćdziesiąt', 'book', 'known', 50, 'volume', '50 utrwalonych kart.'),
    b('trzy-dni', 'Trzy dni z rzędu', 'flame', 'streak', 3, 'consistency'),
    b('tydzien', 'Tydzień z rzędu', 'flame', 'streak', 7, 'consistency'),
    b('miesiac', 'Miesiąc z rzędu', 'crown', 'streak', 30, 'consistency'),
    b('cel-piec', 'Pięć celów', 'target', 'goals', 5, 'goals', 'Cel dnia osiągnięty pięć razy.'),
    b('tysiac', 'Tysiąc punktów', 'medal', 'points', 1000, 'volume'),
    /* 2026-11-05 (Prompt 17) — vier für die Karte: sie zählen, sobald der Krajobraz die Masse kennt (`extra`). */
    b('pierwszy-obszar', 'Pierwszy obszar zdobyty', 'rocket', 'regions', 1, 'exploration', 'Obszar mapy, który umiesz w całości.'),
    b('pol-mapy', 'Pół mapy', 'target', 'map', 50, 'exploration', 'Umiesz połowę tematów mapy.'),
    b('cala-mapa', 'Cała mapa', 'crown', 'map', 100, 'exploration', 'Umiesz wszystkie tematy mapy.'),
    b('czysty-tydzien', 'Tydzień bez zaległości', 'check', 'clean', 7, 'exploration', 'Siedem dni z rzędu bez kart po terminie powtórki.')
  ]
};

export interface RewardPreset {
  readonly id: string;
  readonly label: string;
  readonly says: string;
  readonly rules: RewardRules;
}

/** Gotowe początki — każdy da się potem zmienić liczbami. */
export const REWARD_PRESETS: readonly RewardPreset[] = [
  { id: 'classic', label: 'Punkty, seria i poziomy', says: 'Punkty za każdą odpowiedź i nowe karty, bonus za utrwalone, za serię dobrych odpowiedzi, za cel dnia i za każdy dzień serii; poziomy i odznaki.', rules: DEFAULT_REWARDS },
  {
    id: 'streak', label: 'Tylko seria dni', says: 'Bez punktów za odpowiedzi: liczy się cel dnia (10 kart) i dni z rzędu, jeden dzień przerwy nie przerywa serii.',
    rules: {
      ...DEFAULT_REWARDS, name: 'Seria dni',
      points: { correct: 0, partial: 0, wrong: 0, first: 0, known: 0, fast: 0, combo: 0, goal: 10, streak: 10 },
      goal: { amount: 10, unit: 'cards' }, streak: { counts: 'goal', grace: 1, max: 30 }, levels: [],
      badges: DEFAULT_REWARDS.badges.filter((x) => x.measure === 'streak' || x.measure === 'goals')
    }
  },
  {
    id: 'effort', label: 'Za wysiłek', says: 'Każda odpowiedź daje tyle samo — dobra czy zła; cel to 10 minut nauki dziennie.',
    rules: {
      ...DEFAULT_REWARDS, name: 'Za wysiłek',
      points: { correct: 10, partial: 10, wrong: 10, first: 0, known: 30, fast: 0, combo: 0, goal: 50, streak: 5 },
      goal: { amount: 10, unit: 'minutes' }, streak: { counts: 'any', grace: 0, max: 10 }
    }
  },
  {
    id: 'mastery', label: 'Za opanowanie', says: 'Punkty przede wszystkim za utrwalone karty (pamiętane co najmniej 2 dni); cel to 15 kart dziennie.',
    rules: {
      ...DEFAULT_REWARDS, name: 'Za opanowanie',
      points: { correct: 2, partial: 1, wrong: 0, first: 5, known: 50, fast: 0, combo: 0, goal: 30, streak: 5 },
      known: { days: 2 }, goal: { amount: 15, unit: 'cards' }
    }
  },
  {
    id: 'sprint', label: 'Szybkość i trafność', says: 'Bonus za odpowiedź w 6 sekund i za każde 3 dobre z rzędu; cel to 200 punktów dziennie.',
    rules: {
      ...DEFAULT_REWARDS, name: 'Szybkość i trafność',
      points: { correct: 10, partial: 3, wrong: 0, first: 0, known: 10, fast: 5, combo: 10, goal: 50, streak: 5 },
      fast: { seconds: 6 }, combo: { every: 3 }, goal: { amount: 200, unit: 'points' }
    }
  }
];

/** Eine Regel aus dem Dokument — duldsam: was fehlt oder nicht passt, nimmt den Wert der Vorgabe. */
export function readRewards(raw: unknown): RewardRules {
  const d = isObject(raw) ? raw : {};
  const base = DEFAULT_REWARDS;
  const p = isObject(d.points) ? d.points : {};
  const points = Object.fromEntries(POINT_KINDS.map((k) => [k, int(p[k], base.points[k], 0, 10_000)])) as Record<PointKind, number>;
  const known = isObject(d.known) ? d.known : {};
  const fast = isObject(d.fast) ? d.fast : {};
  const combo = isObject(d.combo) ? d.combo : {};
  const goal = isObject(d.goal) ? d.goal : {};
  const streak = isObject(d.streak) ? d.streak : {};
  const unit = (GOAL_UNITS as readonly string[]).includes(str(goal.unit)) ? (str(goal.unit) as GoalUnit) : base.goal.unit;
  const levels = Array.isArray(d.levels)
    ? d.levels.flatMap((l): RewardLevel[] => (isObject(l) && str(l.name) !== '' ? [{ at: int(l.at, 0, 0, 100_000_000), name: str(l.name).slice(0, 60) }] : []))
      .sort((x, y) => x.at - y.at)
      .filter((l, i, all) => i === 0 || l.at !== all[i - 1]!.at)
    : base.levels;
  const used = new Set<string>();
  const badges = Array.isArray(d.badges)
    ? d.badges.flatMap((x): RewardBadge[] => {
      if (!isObject(x)) return [];
      const name = str(x.name).slice(0, 60);
      const measure = str(x.measure);
      if (name === '' || !(REWARD_MEASURES as readonly string[]).includes(measure)) return [];
      let id = slugOf(str(x.id) || name) || 'odznaka';
      while (used.has(id)) id = `${id}-2`;
      used.add(id);
      const says = str(x.says).slice(0, 200);
      /* 2026-11-05 (Prompt 17) — die Art nur, wenn es eine bekannte ist (sonst folgt sie aus dem Mass). */
      const kind = str(x.kind);
      return [{
        id, name, icon: (BADGE_ICONS as readonly string[]).includes(str(x.icon)) ? (str(x.icon) as BadgeIcon) : 'star',
        measure: measure as RewardMeasure, atLeast: int(x.atLeast, 1, 1, 100_000_000), points: int(x.points, 0, 0, 10_000),
        ...(says === '' ? {} : { says }),
        ...((BADGE_KINDS as readonly string[]).includes(kind) ? { kind: kind as BadgeKind } : {})
      }];
    })
    : base.badges;
  return {
    name: str(d.name).slice(0, 80) || base.name,
    points,
    known: { days: num(known.days, base.known.days, 0.01, 365) },
    fast: { seconds: num(fast.seconds, base.fast.seconds, 1, 600) },
    combo: { every: int(combo.every, base.combo.every, 2, 1000) },
    goal: { amount: int(goal.amount, base.goal.amount, 1, 100_000), unit },
    streak: { counts: str(streak.counts) === 'any' ? 'any' : str(streak.counts) === 'goal' ? 'goal' : base.streak.counts, grace: int(streak.grace, base.streak.grace, 0, 6), max: int(streak.max, base.streak.max, 1, 365) },
    levels,
    badges
  };
}

/** Die Regel als Dokument (die Form, die `readRewards` liest und der Import nimmt). */
export function rewardsData(rules: RewardRules): Record<string, unknown> {
  return {
    name: rules.name,
    points: { ...rules.points },
    known: { ...rules.known },
    fast: { ...rules.fast },
    combo: { ...rules.combo },
    goal: { ...rules.goal },
    streak: { ...rules.streak },
    levels: rules.levels.map((l) => ({ ...l })),
    /* Mit `kind`, wenn genannt (2026-11-05, Prompt 17). */
    badges: rules.badges.map((x) => ({ ...x }))
  };
}

/** Ein Satz über die Regel — für Listen und den Editor der Seite. */
export function describeRewards(rules: RewardRules): string {
  const p = rules.points;
  const parts: string[] = [];
  if (p.correct > 0) parts.push(`${p.correct} pkt za dobrą odpowiedź`);
  if (p.known > 0) parts.push(`${p.known} za utrwaloną kartę`);
  parts.push(`cel dnia: ${rules.goal.amount} ${GOAL_UNIT_LABEL[rules.goal.unit]}`);
  parts.push(rules.streak.counts === 'goal' ? 'seria: dni z celem' : 'seria: dni nauki');
  if (rules.levels.length > 0) parts.push(`${rules.levels.length} poziomów`);
  if (rules.badges.length > 0) parts.push(`${rules.badges.length} odznak`);
  return parts.join(' · ');
}

/* -- Welche Regel an einem Ort gilt ---------------------------------------------------------------------------------- */

export interface RewardDoc {
  readonly id: string;
  readonly data: Readonly<Record<string, unknown>>;
}

/**
 * DIE REGEL EINES ORTES: die genannte (ein Baustein, die Ustawienia), sonst die der Ustawienia der Baza, sonst die
 * erste der Baza, sonst die eingebaute. Eine Kennung, die es nicht (mehr) gibt, fällt auf die nächste Stufe.
 */
export function rewardsFor(docs: readonly RewardDoc[], chosen?: string | null, settingsChoice?: string | null): { readonly id: string | null; readonly rules: RewardRules } {
  for (const want of [chosen, settingsChoice]) {
    if (want === undefined || want === null || want === '') continue;
    const doc = docs.find((d) => d.id === want);
    if (doc !== undefined) return { id: doc.id, rules: readRewards(doc.data) };
  }
  const first = docs[0];
  return first === undefined ? { id: null, rules: DEFAULT_REWARDS } : { id: first.id, rules: readRewards(first.data) };
}

/* -- Die Rechnung ---------------------------------------------------------------------------------------------------- */

/** Was die Rechnung von einer Antwort braucht (`AnswerRecord` hat es). */
export interface RewardAnswer {
  readonly id: string;
  readonly key: string;
  readonly at: number;
  readonly correctness: number;
  readonly ms?: number;
  /** Mitgezählt mit dieser Antwort (ein Paar einer langen Liste). */
  readonly lead?: string;
}

export type RewardEventKind = 'answer' | 'first' | 'fast' | 'combo' | 'known' | 'goal' | 'streak' | 'level' | 'badge';

export interface RewardEvent {
  /** Fest: dieselbe Antwort, derselbe Tag, dieselbe Karte geben dieselbe Kennung. */
  readonly id: string;
  readonly kind: RewardEventKind;
  readonly at: number;
  readonly points: number;
  /** Die Punkte insgesamt nach diesem Ereignis. */
  readonly total: number;
  /** Tag der Serie, Stufe (ab 1), Länge der Serie guter Antworten, Teilrichtigkeit (0–1). */
  readonly value?: number;
  readonly badge?: string;
  readonly card?: string;
}

export interface RewardDay {
  /** Beginn des Tages (Ortszeit). */
  readonly day: number;
  readonly points: number;
  readonly answers: number;
  readonly correct: number;
  readonly cards: number;
  readonly minutes: number;
  /** Das Tagesziel ist erreicht. */
  readonly met: boolean;
  /** Der Tag gehört zur Serie. */
  readonly counted: boolean;
}

export interface RewardLevelNow {
  /** -1: noch unter der ersten Stufe (oder keine Stufen). */
  readonly index: number;
  readonly name: string | null;
  readonly at: number;
  readonly next: RewardLevel | null;
  /** Wie weit zur nächsten (0–1); ohne nächste 1. */
  readonly share: number;
}

export interface RewardState {
  readonly rules: RewardRules;
  readonly total: number;
  /** In zeitlicher Folge. */
  readonly events: readonly RewardEvent[];
  readonly days: ReadonlyMap<number, RewardDay>;
  readonly today: RewardDay;
  /** Wie weit heute zum Ziel — in der Einheit der Regel. */
  readonly goalNow: number;
  /** Die Serie, die noch lebt (heute schon gezählt, oder noch zu retten). */
  readonly streak: number;
  readonly streakToday: boolean;
  /** Es gibt eine Serie, und heute zählt noch nicht: lernen, um sie zu halten. */
  readonly atRisk: boolean;
  readonly best: number;
  /** Gute Antworten hintereinander jetzt (in der laufenden Sitzung). */
  readonly combo: number;
  readonly level: RewardLevelNow;
  /**
   * Jedes Abzeichen der Regel: wann es kam (`null`: noch nicht), der Wert seines Masses jetzt — und (2026-11-05, Prompt 17)
   * ob das Mass bekannt ist (`false`: ein Mass der Karte, das hier niemand gemessen hat; der Wert ist dann 0).
   */
  readonly badges: readonly { readonly badge: RewardBadge; readonly at: number | null; readonly value: number; readonly measured: boolean }[];
  readonly measures: Readonly<Record<RewardMeasure, number>>;
}

/** Was `rewardState` ausser den Antworten nimmt. */
export interface RewardOptions {
  /** Nur Karten dieses Ortes zählen (eine Powtórka). */
  readonly keys?: ReadonlySet<string>;
  /** Zusammengeführte Einträge zählen als einer. */
  readonly rename?: (key: string) => string;
  /** 2026-11-05 (Prompt 17) — die Masse der Karte, soweit bekannt (`mapMeasures.ts`); was fehlt, ist nicht gemessen. */
  readonly extra?: ExtraMeasures;
  /** 2026-11-05 (Prompt 17) — wann ein Abzeichen eines Masses der Karte zuerst kam (`awardsOf` der Werte des Lernenden). */
  readonly awarded?: Readonly<Record<string, number>>;
}

const MINUTE = 60_000;
const DAY = 86_400_000;
/** Länger als das ohne Antwort: eine neue Sitzung — die Serie guter Antworten beginnt neu. */
export const SITTING_GAP = 30 * MINUTE;
/** Mehr zählt eine Antwort nicht als Lernzeit (wer weg war, hat nicht gelernt). */
const MS_CAP = 5 * MINUTE;

const emptyDay = (day: number): RewardDay => ({ day, points: 0, answers: 0, correct: 0, cards: 0, minutes: 0, met: false, counted: false });

/** Wie viele Kalendertage zwischen zwei Tagesanfängen (über Zeitumstellungen hinweg). */
const daysBetween = (from: number, to: number): number => Math.round((to - from) / DAY);

/** Die Stufe zu einer Punktzahl. */
export function levelAt(levels: readonly RewardLevel[], total: number): RewardLevelNow {
  let index = -1;
  for (let i = 0; i < levels.length; i += 1) if (levels[i]!.at <= total) index = i;
  const now = index < 0 ? null : levels[index]!;
  const next = levels[index + 1] ?? null;
  const from = now?.at ?? 0;
  const share = next === null ? 1 : Math.max(0, Math.min(1, (total - from) / Math.max(1, next.at - from)));
  return { index, name: now?.name ?? null, at: from, next, share };
}

/**
 * DIE NAGRODY EINES LERNENDEN — aus seinen Antworten und einer Regel, zum Zeitpunkt `now`. `keys`: nur Karten dieses
 * Ortes zählen (eine Powtórka); `rename`: zusammengeführte Einträge zählen als einer. 2026-11-05 (Prompt 17): `extra`
 * die Masse der Karte, `awarded` die gemerkten Daten ihrer Abzeichen — ohne beide genau wie vorher.
 */
export function rewardState(answers: Iterable<RewardAnswer>, rules: RewardRules, now: number, { keys, rename, extra, awarded }: RewardOptions = {}): RewardState {
  const list: RewardAnswer[] = [];
  for (const a of answers) {
    if (!Number.isFinite(a.at) || a.at > now + MINUTE) continue;
    if (keys !== undefined && !keys.has(rename === undefined ? a.key : rename(a.key))) continue;
    list.push(a);
  }
  list.sort((x, y) => x.at - y.at || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));

  const P = rules.points;
  const states = new Map<string, CardState>();
  const seen = new Set<string>();
  const known = new Set<string>();
  const cards = new Set<string>();
  type Day = { day: number; points: number; answers: number; correct: number; cards: Set<string>; ms: number; met: boolean; counted: boolean };
  const days = new Map<number, Day>();
  const events: RewardEvent[] = [];
  let total = 0;
  let answersN = 0;
  let correctN = 0;
  let goals = 0;
  let combo = 0;
  let bestCombo = 0;
  let lastLead = Number.NEGATIVE_INFINITY;
  let lastCounted: number | null = null;
  let streakLen = 0;
  let best = 0;
  let levelIdx = -1;
  const earned = new Map<string, number>();
  /* 2026-11-05 (Prompt 17) — ein Mass der Karte: bekannt nur als endliche Zahl. */
  const extraOf = (m: ExtraMeasure): number | undefined => {
    const v = extra?.[m];
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  };

  const measure = (m: RewardMeasure): number => {
    switch (m) {
      case 'points': return total;
      case 'streak': return streakLen;
      case 'best': return best;
      case 'known': return known.size;
      case 'cards': return cards.size;
      case 'answers': return answersN;
      case 'correct': return correctN;
      case 'days': return days.size;
      case 'combo': return bestCombo;
      case 'goals': return goals;
      case 'level': return levelIdx + 1;
      case 'regions': case 'map': case 'clean': return extraOf(m) ?? 0;
    }
  };

  const emit = (e: Omit<RewardEvent, 'total'>): void => {
    total += e.points;
    events.push({ ...e, total });
  };

  /* Nach jeder Antwort: neue Stufen, neue Abzeichen (ein Abzeichen mit Punkten kann eine Stufe bringen, und so fort). */
  const settle = (at: number): void => {
    for (let guard = 0; guard < 1000; guard += 1) {
      let changed = false;
      while (levelIdx + 1 < rules.levels.length && rules.levels[levelIdx + 1]!.at <= total) {
        levelIdx += 1;
        /* Die erste Stufe ab 0 ist der Anfang, kein Aufstieg. */
        if (rules.levels[levelIdx]!.at > 0) emit({ id: `l:${levelIdx}`, kind: 'level', at, points: 0, value: levelIdx + 1 });
        changed = true;
      }
      for (const badge of rules.badges) {
        /* Die Abzeichen der Karte kommen nicht aus den Antworten (`award` unten). */
        if (isExtraMeasure(badge.measure) || earned.has(badge.id) || measure(badge.measure) < badge.atLeast) continue;
        earned.set(badge.id, at);
        emit({ id: `b:${badge.id}`, kind: 'badge', at, points: badge.points, badge: badge.id });
        changed = true;
      }
      if (!changed) return;
    }
  };

  /*
   * 2026-11-05 (Prompt 17) — DIE ABZEICHEN DER KARTE: erreicht, wenn das Mass die Schwelle hat, oder schon früher gemerkt
   * (`awarded` — das zählt auch ohne Mass: die Lehrerin misst die Karte ihrer Klasse nicht). Sie stehen zu ihrer Zeit
   * (gemerkt, sonst jetzt) zwischen den Ereignissen der Antworten — ihre Punkte gehen in die Summe danach, und was sie
   * bringen (eine Stufe, ein Abzeichen der Punkte), kommt zur selben Zeit.
   */
  const pending: { readonly badge: RewardBadge; readonly at: number }[] = [];
  for (const badge of rules.badges) {
    if (!isExtraMeasure(badge.measure)) continue;
    const kept = awarded?.[badge.id];
    const value = extraOf(badge.measure);
    if (typeof kept === 'number' && Number.isFinite(kept)) pending.push({ badge, at: Math.min(kept, now) });
    else if (value !== undefined && value >= badge.atLeast) pending.push({ badge, at: now });
  }
  /* Stabil: gleiche Zeiten in der Folge der Regel. */
  pending.sort((x, y) => x.at - y.at);
  let nextAward = 0;
  /** Die Abzeichen der Karte vor `before` (dieselbe Zeit wie eine Antwort: nach ihr). */
  const award = (before: number): void => {
    while (nextAward < pending.length && pending[nextAward]!.at < before) {
      const { badge, at } = pending[nextAward]!;
      nextAward += 1;
      earned.set(badge.id, at);
      emit({ id: `b:${badge.id}`, kind: 'badge', at, points: badge.points, badge: badge.id });
      settle(at);
    }
  };

  const unitOf = (d: Day): number => (rules.goal.unit === 'cards' ? d.cards.size : rules.goal.unit === 'answers' ? d.answers : rules.goal.unit === 'points' ? d.points : Math.floor(d.ms / MINUTE));

  award(list[0]?.at ?? now);
  settle(list[0]?.at ?? now);
  for (const a of list) {
    award(a.at);
    const key = rename === undefined ? a.key : rename(a.key);
    const dayAt = dayStart(a.at);
    let d = days.get(dayAt);
    if (d === undefined) { d = { day: dayAt, points: 0, answers: 0, correct: 0, cards: new Set(), ms: 0, met: false, counted: false }; days.set(dayAt, d); }
    const q = Math.max(0, Math.min(1, a.correctness));
    const grade = gradeOf(q);
    d.cards.add(key);
    cards.add(key);
    const state = step(states.get(key) ?? null, { at: a.at, correctness: q });
    states.set(key, state);
    const day = d;
    const earn = (e: Omit<RewardEvent, 'total'>): void => { day.points += e.points; emit(e); };

    if (a.lead === undefined) {
      d.answers += 1;
      answersN += 1;
      if (grade === 'correct') { d.correct += 1; correctN += 1; }
      d.ms += Math.max(0, Math.min(MS_CAP, a.ms ?? 0));
      if (a.at - lastLead > SITTING_GAP) combo = 0;
      lastLead = a.at;
      const pts = Math.round(grade === 'correct' ? P.correct * q : grade === 'partly' ? P.partial * q : P.wrong);
      earn({ id: `a:${a.id}`, kind: 'answer', at: a.at, points: pts, value: q, card: key });
      if (!seen.has(key)) {
        seen.add(key);
        if (P.first > 0) earn({ id: `f:${a.id}`, kind: 'first', at: a.at, points: P.first, card: key });
      }
      if (grade === 'correct') {
        if (P.fast > 0 && a.ms !== undefined && a.ms > 0 && a.ms <= rules.fast.seconds * 1000) earn({ id: `s:${a.id}`, kind: 'fast', at: a.at, points: P.fast, card: key });
        combo += 1;
        bestCombo = Math.max(bestCombo, combo);
        if (P.combo > 0 && combo % rules.combo.every === 0) earn({ id: `c:${a.id}`, kind: 'combo', at: a.at, points: P.combo, value: combo });
      } else {
        combo = 0;
      }
    } else {
      /* Ein Paar, das mit einer Antwort mitkam: es ist nun gesehen — „nowa karta" gibt es dafür nicht mehr. */
      seen.add(key);
    }

    if (!known.has(key) && grade === 'correct' && state.interval >= rules.known.days * DAY) {
      known.add(key);
      earn({ id: `k:${key}`, kind: 'known', at: a.at, points: P.known, card: key });
    }

    if (!d.met && unitOf(d) >= rules.goal.amount) {
      d.met = true;
      goals += 1;
      emit({ id: `g:${dayAt}`, kind: 'goal', at: a.at, points: P.goal, value: rules.goal.amount });
    }

    const qualifies = rules.streak.counts === 'goal' ? d.met : d.answers > 0 || d.cards.size > 0;
    if (qualifies && !d.counted) {
      d.counted = true;
      streakLen = lastCounted !== null && daysBetween(lastCounted, dayAt) <= rules.streak.grace + 1 ? streakLen + 1 : 1;
      lastCounted = dayAt;
      best = Math.max(best, streakLen);
      emit({ id: `d:${dayAt}`, kind: 'streak', at: a.at, points: P.streak * Math.min(streakLen, rules.streak.max), value: streakLen });
    }
    settle(a.at);
  }
  /* Was nach der letzten Antwort kam (meist: jetzt). */
  award(Number.POSITIVE_INFINITY);

  const today = dayStart(now);
  const alive = lastCounted !== null && daysBetween(lastCounted, today) <= rules.streak.grace + 1;
  const streakToday = lastCounted === today;
  const streak = alive ? streakLen : 0;
  const out = new Map<number, RewardDay>();
  for (const [at, d] of days) out.set(at, { day: at, points: d.points, answers: d.answers, correct: d.correct, cards: d.cards.size, minutes: Math.floor(d.ms / MINUTE), met: d.met, counted: d.counted });
  const todayRaw = days.get(today);
  const measures = Object.fromEntries(REWARD_MEASURES.map((m) => [m, m === 'streak' ? streak : measure(m)])) as Record<RewardMeasure, number>;
  return {
    rules, total, events,
    days: out,
    today: out.get(today) ?? emptyDay(today),
    goalNow: todayRaw === undefined ? 0 : unitOf(todayRaw),
    streak, streakToday, atRisk: streak > 0 && !streakToday,
    best,
    combo: now - lastLead > SITTING_GAP ? 0 : combo,
    level: levelAt(rules.levels, total),
    badges: rules.badges.map((badge) => ({
      badge, at: earned.get(badge.id) ?? null, value: measures[badge.measure],
      measured: !isExtraMeasure(badge.measure) || extraOf(badge.measure) !== undefined
    })),
    measures
  };
}

/* -- 2026-11-05 (Prompt 17): Tage ohne Überfälliges, die Daten der Abzeichen der Karte, die Rahmen der Stufen ---------- */

/** So viele Tage zählt `cleanDays` höchstens zurück. */
export const CLEAN_DAYS_MAX = 60;

/**
 * TAGE HINTEREINANDER OHNE ÜBERFÄLLIGES, bis heute: an jedem war am Ende des Tages (heute: jetzt) keine beantwortete Karte
 * überfällig (ihr Termin `at + interval` aus `step` mit diesen Abständen lag nicht davor). Die Reihe endet am ersten Tag
 * mit einer überfälligen Karte und vor der allerersten Antwort; höchstens `CLEAN_DAYS_MAX` Tage. Je Karte einmal ihre
 * Zustände, dann rückwärts durch die Tage: O(Antworten + Karten × Tage).
 */
export function cleanDays(cards: readonly { key: string }[], marksOf: (key: string) => readonly { at: number; correctness: number }[], now: number, spacing: Spacing = DEFAULT_SPACING): number {
  const today = dayStart(now);
  /* Das Ende jedes Tages, heute zuerst: heute jetzt, gestern der Anfang von heute, vorgestern der Anfang von gestern … */
  const ends: number[] = [now];
  for (let i = 0; i < CLEAN_DAYS_MAX - 1; i += 1) ends.push(dayAdd(today, -i));
  const overdue = new Array<boolean>(ends.length).fill(false);
  let first = Number.POSITIVE_INFINITY;
  for (const card of cards) {
    const marks = marksOf(card.key).filter((m) => Number.isFinite(m.at) && m.at <= now).sort((x, y) => x.at - y.at);
    if (marks.length === 0) continue;
    first = Math.min(first, marks[0]!.at);
    const states: CardState[] = [];
    let state: CardState | null = null;
    for (const m of marks) { state = step(state, m, spacing); states.push(state); }
    let j = states.length - 1;
    for (let d = 0; d < ends.length; d += 1) {
      const end = ends[d]!;
      /* Was am Ende des Tages galt: die Antworten davor (heute: alle bis jetzt). */
      if (d > 0) while (j >= 0 && marks[j]!.at >= end) j -= 1;
      /* Vor ihrer ersten Antwort ist eine Karte nie überfällig — an keinem früheren Tag. */
      if (j < 0) break;
      const s = states[j]!;
      if (s.at + s.interval < end) overdue[d] = true;
    }
  }
  if (first === Number.POSITIVE_INFINITY) return 0;
  let n = 0;
  for (let d = 0; d < ends.length; d += 1) {
    /* Ein Tag, der vor der ersten Antwort endete, zählt nicht mehr (heute zählt immer, wenn nichts überfällig ist). */
    if (overdue[d] || (d > 0 && ends[d]! <= first)) break;
    n += 1;
  }
  return n;
}

/** Unter diesem Zeichen stehen in den Werten des Lernenden die Daten der Abzeichen der Karte (`~`: Werte der Anwendung). */
export const AWARD_PREFIX = '~award.';

/** Die gemerkten Daten: Abzeichen → wann es zuerst kam. */
export function awardsOf(values: Readonly<Record<string, number>> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (values === undefined) return out;
  for (const [k, v] of Object.entries(values)) {
    if (k.length > AWARD_PREFIX.length && k.startsWith(AWARD_PREFIX) && typeof v === 'number' && Number.isFinite(v)) out[k.slice(AWARD_PREFIX.length)] = v;
  }
  return out;
}

/** Die Werte mit diesen Daten dazu — ein schon gemerktes Abzeichen behält das früheste Datum. */
export function withAwards(values: Readonly<Record<string, number>>, add: Readonly<Record<string, number>>): Record<string, number> {
  const next: Record<string, number> = { ...values };
  for (const [id, at] of Object.entries(add)) {
    if (id === '' || typeof at !== 'number' || !Number.isFinite(at)) continue;
    const key = `${AWARD_PREFIX}${id}`;
    const had = next[key];
    if (had === undefined || !Number.isFinite(had) || at < had) next[key] = at;
  }
  return next;
}

/**
 * WAS DIE ANWENDUNG MERKEN SOLL: die Abzeichen der Karte, deren Mass jetzt die Schwelle hat und die noch kein Datum haben —
 * mit dem Datum `at` (wann gemessen). Für `Learner.keepAwards`, gleich nachdem der Krajobraz misst.
 */
export function freshAwards(rules: RewardRules, extra: ExtraMeasures | undefined, awarded: Readonly<Record<string, number>> | undefined, at: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (extra === undefined) return out;
  for (const badge of rules.badges) {
    if (!isExtraMeasure(badge.measure) || awarded?.[badge.id] !== undefined) continue;
    const v = extra[badge.measure];
    if (typeof v === 'number' && Number.isFinite(v) && v >= badge.atLeast) out[badge.id] = at;
  }
  return out;
}

/** Der Rahmen einer Stufe: 0 schlicht, 1 Bronze, 2 Silber, 3 Gold, 4 Diamant. */
export type LevelFrame = 0 | 1 | 2 | 3 | 4;

/**
 * DIE RAHMEN DER STUFEN, je Rang: die erste schlicht, die oberste (ab drei Stufen) Diamant, dazwischen gleich verteilt
 * Bronze, Silber, Gold — bei den acht eingebauten 0 1 1 2 2 3 3 4.
 */
export function levelFrame(index: number, count: number): LevelFrame {
  if (index <= 0 || count < 2) return 0;
  if (index >= count - 1 && count >= 3) return 4;
  return Math.max(1, Math.min(3, 1 + Math.floor(((index - 1) * 3) / Math.max(1, count - 2)))) as LevelFrame;
}

/* -- Für die Anzeige ------------------------------------------------------------------------------------------------- */

/** Die letzten `n` Tage bis heute, der älteste zuerst — Tage ohne Nauka mit Nullen. */
export function lastDays(state: RewardState, now: number, n: number): RewardDay[] {
  const today = dayStart(now);
  const out: RewardDay[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const day = dayAdd(today, -i);
    out.push(state.days.get(day) ?? emptyDay(day));
  }
  return out;
}

/** Die Punkte von heute, Ereignis für Ereignis zusammengezählt (für die Linie „dziś"). */
export function todayLine(state: RewardState, now: number): { readonly at: number; readonly total: number; readonly points: number }[] {
  const from = dayStart(now);
  let sum = 0;
  const out: { at: number; total: number; points: number }[] = [];
  for (const e of state.events) {
    if (e.at < from || e.points === 0) continue;
    sum += e.points;
    const last = out[out.length - 1];
    /* Was zu einer Antwort gehört (dieselbe Zeit), ist ein Punkt der Linie. */
    if (last !== undefined && last.at === e.at) out[out.length - 1] = { at: e.at, total: sum, points: last.points + e.points };
    else out.push({ at: e.at, total: sum, points: e.points });
  }
  return out;
}

/** Die Ereignisse, deren Kennung noch nicht bekannt war — das, was die Oberfläche jetzt zeigt. */
export function freshEvents(known: ReadonlySet<string>, state: RewardState): RewardEvent[] {
  return state.events.filter((e) => !known.has(e.id));
}

/** Was ein Ereignis in Worten ist (ohne Punkte). */
export function eventText(e: RewardEvent, rules: RewardRules): string {
  switch (e.kind) {
    case 'answer': return (e.value ?? 0) >= 0.9 ? 'dobra odpowiedź' : (e.value ?? 0) >= 0.25 ? 'częściowo dobra' : 'za próbę';
    case 'first': return 'nowa karta';
    case 'fast': return 'szybko!';
    case 'combo': return `${e.value ?? rules.combo.every} dobrych z rzędu`;
    case 'known': return 'utrwalona karta';
    case 'goal': return 'cel dnia osiągnięty';
    case 'streak': return e.value === 1 ? 'pierwszy dzień serii' : `seria: ${e.value ?? 0}. dzień z rzędu`;
    case 'level': return `nowy poziom: ${rules.levels[(e.value ?? 1) - 1]?.name ?? e.value ?? ''}`;
    case 'badge': return `odznaka: ${rules.badges.find((x) => x.id === e.badge)?.name ?? e.badge ?? ''}`;
  }
}
