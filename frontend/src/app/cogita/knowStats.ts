/**
 * 2026-10-31 — STATYSTYKI ZNAJOMOŚCI: was die Diagramme zeigen (`KnowCharts.tsx` — Nauka → Postępy, das Ende einer
 * Powtórka, die Lehrerin für jeden Uczący się und für alle). Alles aus den Antworten, im Browser; gespeichert wird
 * nichts davon. Die Kenntnis ist die der Karte (`knowness.ts`): gleich nach einer richtigen Antwort √10, am fälligen
 * Termin 1, danach weniger.
 * <code>
 *   bands      wo jede Karte steht: jeszcze nie · słabo (< 0,5) · zanika (0,5–1: fällig) · umiem (1–2) · pewnie (≥ 2)
 *   days       je Tag des Zeitraums: Antworten, davon richtig, und wie viele Karten am Ende des Tages saßen
 *   forecast   je Tag ab heute: wie viele Karten fällig werden (Überfälliges zählt für heute)
 *   topics     je Thema („O czym", sonst der Eintrag der Karte): Karten, beantwortet, sitzen, mittlere Kenntnis
 *   forms      je Rodzaj pytania: Antworten und mittlere Richtigkeit
 *   hardest    die Karten mit der schlechtesten Richtigkeit
 *   streak     Tage hintereinander mit Antworten, bis heute (oder gestern — heute kann noch kommen)
 * </code>
 */

import type { Card } from './cardBasics';
import { gradeOf, knownessAt, KNOWN, shareOf, step, type CardState } from './knowness';
import type { AnswerRecord } from './learn';

export type Band = 'unseen' | 'weak' | 'fading' | 'known' | 'solid';
export const BANDS: readonly Band[] = ['unseen', 'weak', 'fading', 'known', 'solid'];
export const BAND_LABEL: Readonly<Record<Band, string>> = { unseen: 'jeszcze nie', weak: 'słabo', fading: 'zanika', known: 'umiem', solid: 'pewnie' };
export const BAND_SAYS: Readonly<Record<Band, string>> = {
  unseen: 'nigdy nie pytana',
  weak: 'ostatnio źle albo dawno zapomniana',
  fading: 'już do powtórki — znajomość spada',
  known: 'umiem, przed terminem powtórki',
  solid: 'świeżo utrwalona'
};

/** Wo eine Kenntnis steht (ohne Antwort: `unseen`). */
export function bandAt(state: CardState | null, now: number): Band {
  if (state === null) return 'unseen';
  const k = knownessAt(state, now);
  return k < 0.5 ? 'weak' : k < KNOWN ? 'fading' : k < 2 ? 'known' : 'solid';
}

export interface DayStat {
  /** Beginn des Tages (Ortszeit), ms. */
  readonly day: number;
  readonly answers: number;
  /** Davon richtig (≥ 0,9). */
  readonly right: number;
  /** Am Ende des Tages: wie viele Karten saßen (Kenntnis ≥ 1) und die mittlere Kenntnis aller Karten (0–1). */
  readonly known: number;
  readonly share: number;
}

export interface GroupStat {
  readonly id: string;
  readonly cards: number;
  readonly answered: number;
  readonly known: number;
  /** Mittlere Kenntnis der Karten (0–1; unbeantwortete zählen 0). */
  readonly share: number;
  readonly answers: number;
  /** Mittlere Richtigkeit der Antworten (0–1) — `null`: keine. */
  readonly accuracy: number | null;
}

export interface HardCard {
  readonly card: Card;
  readonly answers: number;
  readonly wrong: number;
  readonly accuracy: number;
  readonly share: number;
}

export interface KnowStats {
  readonly cards: number;
  readonly bands: Readonly<Record<Band, number>>;
  readonly known: number;
  /** Mittlere Kenntnis aller Karten jetzt (0–1). */
  readonly share: number;
  readonly answers: number;
  readonly accuracy: number | null;
  readonly msTotal: number;
  readonly activeDays: number;
  readonly streak: number;
  readonly lastAt: number | null;
  readonly days: readonly DayStat[];
  readonly forecast: readonly { readonly day: number; readonly due: number }[];
  /** Nie gefragte Karten — sie kommen als neue, nicht als fällige. */
  readonly fresh: number;
  readonly topics: readonly GroupStat[];
  readonly forms: readonly GroupStat[];
  readonly hardest: readonly HardCard[];
}

const DAY = 86_400_000;

/** Beginn des Tages in Ortszeit — und der Tag `n` Tage weiter (über Zeitumstellungen hinweg richtig). */
export function dayStart(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
export function dayAdd(start: number, n: number): number {
  const d = new Date(start);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

/** Worüber eine Karte ist: ihr erstes Thema („O czym"), sonst ihr Eintrag. */
export const topicOf = (card: Card): string | null => card.about?.[0] ?? card.entity ?? null;

/** Der Zustand nach allen Antworten bis einschliesslich `until`. */
function stateUntil(list: readonly AnswerRecord[], until: number): CardState | null {
  let state: CardState | null = null;
  for (const a of list) {
    if (a.at > until) break;
    state = step(state, { at: a.at, correctness: a.correctness });
  }
  return state;
}

const mean = (xs: readonly number[]): number | null => (xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length);

/**
 * DIE ZAHLEN EINES LERNENDEN über `cards`. `answers(card)`: seine Antworten auf diese Karte (wie `answersOf`).
 * `days`: wie viele Tage bis heute die Tageswerte zeigen; `ahead`: wie viele Tage die Vorschau.
 */
export function knowStats(cards: readonly Card[], answers: (card: Card) => readonly AnswerRecord[], now: number, { days = 30, ahead = 14, hardest = 8 }: { days?: number; ahead?: number; hardest?: number } = {}): KnowStats {
  const today = dayStart(now);
  const starts = Array.from({ length: days }, (_, i) => dayAdd(today, i - days + 1));
  const ends = starts.map((s, i) => (i === starts.length - 1 ? now : dayAdd(s, 1) - 1));
  const bands: Record<Band, number> = { unseen: 0, weak: 0, fading: 0, known: 0, solid: 0 };
  const perDay = starts.map(() => ({ answers: 0, right: 0, known: 0, share: 0 }));
  const forecast = Array.from({ length: ahead }, (_, i) => ({ day: dayAdd(today, i), due: 0 }));
  const activity = new Set<number>();
  const topics = new Map<string, { cards: number; answered: number; known: number; shares: number[]; marks: number[] }>();
  const forms = new Map<string, { cards: number; answered: number; known: number; shares: number[]; marks: number[] }>();
  const hard: HardCard[] = [];
  const all: number[] = [];
  let shares = 0;
  let msTotal = 0;
  let lastAt: number | null = null;
  let fresh = 0;

  for (const card of cards) {
    const list = [...answers(card)].filter((a) => Number.isFinite(a.at)).sort((a, b) => a.at - b.at);
    const state = stateUntil(list, now);
    const band = bandAt(state, now);
    bands[band] += 1;
    const share = state === null ? 0 : shareOf(knownessAt(state, now));
    shares += share;
    const known = state !== null && knownessAt(state, now) >= KNOWN;
    for (const a of list) {
      all.push(a.correctness);
      if (typeof a.ms === 'number' && a.ms > 0) msTotal += a.ms;
      activity.add(dayStart(a.at));
      if (lastAt === null || a.at > lastAt) lastAt = a.at;
    }
    if (state === null) fresh += 1;
    else {
      const due = state.at + state.interval;
      const at = due <= now ? 0 : Math.round((dayStart(due) - today) / DAY);
      if (at < ahead) forecast[Math.max(0, at)]!.due += 1;
    }
    /* Je Tag: die Antworten dieses Tages, und ob die Karte am Ende des Tages saß. */
    let k = 0;
    let st: CardState | null = null;
    for (let d = 0; d < starts.length; d += 1) {
      for (; k < list.length && list[k]!.at <= ends[d]!; k += 1) {
        const a = list[k]!;
        st = step(st, { at: a.at, correctness: a.correctness });
        if (a.at >= starts[d]!) {
          perDay[d]!.answers += 1;
          if (gradeOf(a.correctness) === 'correct') perDay[d]!.right += 1;
        }
      }
      if (st !== null) {
        const kn = knownessAt(st, ends[d]!);
        if (kn >= KNOWN) perDay[d]!.known += 1;
        perDay[d]!.share += shareOf(kn);
      }
    }
    const group = (map: typeof topics, id: string | null) => {
      if (id === null) return;
      const g = map.get(id) ?? { cards: 0, answered: 0, known: 0, shares: [], marks: [] };
      g.cards += 1;
      if (state !== null) g.answered += 1;
      if (known) g.known += 1;
      g.shares.push(share);
      g.marks.push(...list.map((a) => a.correctness));
      map.set(id, g);
    };
    group(topics, topicOf(card));
    group(forms, card.answer.form);
    if (list.length > 0) {
      const accuracy = mean(list.map((a) => a.correctness)) ?? 0;
      hard.push({ card, answers: list.length, wrong: list.filter((a) => gradeOf(a.correctness) === 'wrong').length, accuracy, share });
    }
  }

  const groups = (map: typeof topics): GroupStat[] => [...map.entries()].map(([id, g]) => ({
    id, cards: g.cards, answered: g.answered, known: g.known, share: mean(g.shares) ?? 0, answers: g.marks.length, accuracy: mean(g.marks)
  }));
  /* Tage hintereinander: von heute zurück — ist heute noch nichts, zählt es ab gestern. */
  let streak = 0;
  for (let d = activity.has(today) ? today : dayAdd(today, -1); activity.has(d); d = dayAdd(d, -1)) streak += 1;
  const n = cards.length;
  return {
    cards: n,
    bands,
    known: bands.known + bands.solid,
    share: n === 0 ? 0 : shares / n,
    answers: all.length,
    accuracy: mean(all),
    msTotal,
    activeDays: activity.size,
    streak,
    lastAt,
    days: starts.map((day, i) => ({ day, answers: perDay[i]!.answers, right: perDay[i]!.right, known: perDay[i]!.known, share: n === 0 ? 0 : perDay[i]!.share / n })),
    forecast,
    fresh,
    /* Das Schwächste zuerst; was nie gefragt wurde, hinten. */
    topics: groups(topics).sort((a, b) => Number(a.answered === 0) - Number(b.answered === 0) || a.share - b.share || b.cards - a.cards),
    forms: groups(forms).sort((a, b) => (a.accuracy ?? 2) - (b.accuracy ?? 2)),
    hardest: hard.filter((h) => h.wrong > 0 || h.accuracy < 0.9).sort((a, b) => a.accuracy - b.accuracy || b.wrong - a.wrong).slice(0, hardest)
  };
}

/* -- Für die Lehrerin: alle Uczący się zusammen ----------------------------------------------------------------- */

export interface ClassStats {
  readonly learners: number;
  /** In den letzten 7 Tagen geantwortet. */
  readonly active: number;
  readonly answers: number;
  readonly accuracy: number | null;
  /** Mittlere Kenntnis über alle (0–1). */
  readonly share: number;
  /** Antworten aller je Tag. */
  readonly days: readonly { readonly day: number; readonly answers: number; readonly right: number }[];
  /** Die Themen in der Reihenfolge, das Schwächste (im Mittel) zuerst. */
  readonly topics: readonly string[];
  /** Je Thema die Karten-Kenntnis jedes Uczący się (0–1), `null`: dort nichts beantwortet. */
  readonly grid: ReadonlyMap<string, ReadonlyMap<string, number | null>>;
  /** Fragen, die allen am schwersten fallen. */
  readonly hardest: readonly HardCard[];
}

export function classStats(cards: readonly Card[], learners: readonly { readonly id: string; readonly answers: (card: Card) => readonly AnswerRecord[] }[], now: number, { days = 30, hardest = 10 }: { days?: number; hardest?: number } = {}): { readonly each: ReadonlyMap<string, KnowStats>; readonly all: ClassStats } {
  const each = new Map(learners.map((l) => [l.id, knowStats(cards, l.answers, now, { days, hardest: 0 })]));
  const weekAgo = now - 7 * DAY;
  const list = [...each.values()];
  const topicIds = new Map<string, number[]>();
  const grid = new Map<string, Map<string, number | null>>();
  for (const [id, s] of each) {
    for (const t of s.topics) {
      const row = grid.get(t.id) ?? new Map<string, number | null>();
      row.set(id, t.answered === 0 ? null : t.share);
      grid.set(t.id, row);
      if (t.answered > 0) topicIds.set(t.id, [...(topicIds.get(t.id) ?? []), t.share]);
      else if (!topicIds.has(t.id)) topicIds.set(t.id, []);
    }
  }
  const avgOf = (id: string) => mean(topicIds.get(id) ?? []);
  const topics = [...topicIds.keys()].sort((a, b) => (avgOf(a) ?? 2) - (avgOf(b) ?? 2));
  const byCard = new Map<string, { card: Card; marks: number[]; shares: number[] }>();
  for (const l of learners) {
    for (const card of cards) {
      const answered = l.answers(card);
      if (answered.length === 0) continue;
      const one = byCard.get(card.key) ?? { card, marks: [], shares: [] };
      one.marks.push(...answered.map((a) => a.correctness));
      byCard.set(card.key, one);
    }
  }
  const allMarks = list.flatMap((s) => (s.accuracy === null ? [] : [{ n: s.answers, a: s.accuracy }]));
  const answersTotal = allMarks.reduce((sum, x) => sum + x.n, 0);
  return {
    each,
    all: {
      learners: learners.length,
      active: list.filter((s) => s.lastAt !== null && s.lastAt >= weekAgo).length,
      answers: list.reduce((sum, s) => sum + s.answers, 0),
      accuracy: answersTotal === 0 ? null : allMarks.reduce((sum, x) => sum + x.n * x.a, 0) / answersTotal,
      share: mean(list.map((s) => s.share)) ?? 0,
      days: (list[0]?.days ?? []).map((d, i) => ({ day: d.day, answers: list.reduce((sum, s) => sum + (s.days[i]?.answers ?? 0), 0), right: list.reduce((sum, s) => sum + (s.days[i]?.right ?? 0), 0) })),
      topics,
      grid,
      hardest: [...byCard.values()].map((x) => ({ card: x.card, answers: x.marks.length, wrong: x.marks.filter((m) => gradeOf(m) === 'wrong').length, accuracy: mean(x.marks) ?? 0, share: 0 }))
        .filter((h) => h.wrong > 0 || h.accuracy < 0.9).sort((a, b) => a.accuracy - b.accuracy || b.wrong - a.wrong).slice(0, hardest)
    }
  };
}
