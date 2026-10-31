/**
 * 2026-10-27 — WIE GUT ETWAS SITZT, AUF DREI WEISEN GERECHNET (Nauka → Postępy, für sich und für die
 * Uczący się eines Kurses). Alles aus den Antworten, im Browser; gespeichert wird nichts davon.
 * <code>
 *   last       die letzte Antwort war richtig — so zählt ein einfacher Test, ohne Zeit
 *   memory     der Zustand der Karte (\`knowness.ts\`, 2026-10-30): Abstände machen es dauerhaft — heute und
 *              morgen richtig hält kürzer als heute und in einer Woche (richtig: der vergangene Abstand × 3) —,
 *              und es verblasst: gleich nach der Antwort sicher, am fälligen Termin gerade noch, danach immer
 *              weniger; nach einer falschen gar nicht. Sitzt: Kenntnis jetzt ≥ 1.
 *   hierarchy  wie memory — und wer das Besondere kann, kann auch das Allgemeine (A.3, \`propagate\`):
 *              eine Karte gilt auch, wenn ihre Einträge (gewogen aus ihren Karten, \`knowing.ts\`) über das,
 *              was auf ihnen aufbaut, sitzen.
 * </code>
 * Je Karte dazu: wie oft, wie oft richtig, wie lange (die Zeit je Antwort steht in jeder Antwort, \`ms\`),
 * die Trwałość, die Kenntnis jetzt und in einer Woche (das Vergessen, vorausgerechnet).
 */

import type { Card } from './cardBasics';
import { gaugeFromMarks } from './knowing';
import { dueAt, knownessOf, KNOWN, stability, type Dependency, type Mark } from './knowness';
import type { AnswerRecord, Progress } from './learn';
import { cardEntities } from './prerequisites';

export type Model = 'last' | 'memory' | 'hierarchy';

export const MODELS: readonly { readonly id: Model; readonly label: string; readonly says: string }[] = [
  { id: 'memory', label: 'Pamięć: odstępy i zapominanie', says: 'Umie, gdy ostatnia odpowiedź była dobra i jeszcze nie zdążył zapomnieć. Dobra odpowiedź po tygodniu przerwy utrwala bardziej niż następnego dnia; z czasem znajomość spada.' },
  { id: 'hierarchy', label: 'Z hierarchią', says: 'Jak „Pamięć” — a do tego kto umie rzeczy szczegółowe, umie też ogólne, na których one stoją (kolejność nauki: „Najpierw trzeba znać”).' },
  { id: 'last', label: 'Ostatnia odpowiedź', says: 'Umie, gdy ostatnia odpowiedź była dobra — bez względu na to, kiedy to było.' }
];

const HOUR = 3_600_000;
const WEEK = 7 * 24 * HOUR;

export interface CardStat {
  readonly card: Card;
  readonly answers: number;
  /** Dobre (pełna poprawność). */
  readonly right: number;
  /** Średnia poprawność 0–1 (null: bez odpowiedzi). */
  readonly share: number | null;
  /** Czas wszystkich odpowiedzi i średni (ms). */
  readonly msTotal: number;
  readonly msAvg: number | null;
  readonly lastAt: number | null;
  /** Poprawność ostatniej odpowiedzi. */
  readonly last: number | null;
  /** Kenntnis jetzt (die Formel), in einer Woche — und wie lange es hält (Stunden). */
  readonly now: number;
  readonly inWeek: number;
  readonly holdsHours: number | null;
  readonly due: number | null;
  /** Sitzt nach dem gewählten Weg. */
  readonly known: boolean;
  readonly seen: boolean;
}

export interface StatSummary {
  readonly cards: number;
  readonly known: number;
  readonly learning: number;
  readonly unseen: number;
  readonly answers: number;
  readonly msTotal: number;
  readonly msPerAnswer: number | null;
  readonly lastAt: number | null;
}

/** Die Antworten einer Karte (für die Zeit) — dieselben, aus denen \`marks\` rechnet. */
export function answersOf(progress: Progress, key: string, fingerprint?: string, rename?: (key: string) => string): AnswerRecord[] {
  const out: AnswerRecord[] = [];
  for (const one of progress.answers.values()) {
    if ((rename === undefined ? one.key : rename(one.key)) !== key) continue;
    if (fingerprint !== undefined && one.fingerprint !== '' && one.fingerprint !== fingerprint) continue;
    out.push(one);
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * 2026-10-31 — ALLE ANTWORTEN EINMAL NACH KARTE GEORDNET: dasselbe wie `answersOf`, aber für viele Karten (Statystyki,
 * die Lehrerin über alle Uczący się) — sonst ginge jede Karte noch einmal alle Antworten durch.
 */
export function answerIndex(progress: Progress, rename?: (key: string) => string): (card: { readonly key: string; readonly fingerprint?: string }) => AnswerRecord[] {
  const by = new Map<string, AnswerRecord[]>();
  for (const one of progress.answers.values()) {
    const key = rename === undefined ? one.key : rename(one.key);
    const list = by.get(key);
    if (list === undefined) by.set(key, [one]); else list.push(one);
  }
  for (const list of by.values()) list.sort((a, b) => a.at - b.at);
  return (card) => (by.get(card.key) ?? []).filter((one) => card.fingerprint === undefined || one.fingerprint === '' || one.fingerprint === card.fingerprint);
}

/**
 * DIE ZAHLEN JE KARTE nach einem Weg. \`all\`: alle Karten der Baza — die Hierarchie rechnet über sie (wer das
 * Besondere aus einem anderen Teil kann), gezeigt werden nur \`cards\`.
 */
export function cardStats(cards: readonly Card[], all: readonly Card[], answers: (card: Card) => readonly AnswerRecord[], model: Model, deps: readonly Dependency[], now: number): CardStat[] {
  const marksOf = (card: Card): Mark[] => answers(card).map((a) => ({ at: a.at, correctness: a.correctness }));
  let totals: ReadonlyMap<string, number> = new Map();
  if (model === 'hierarchy') {
    const byKey = new Map(all.map((c) => [c.key, c]));
    totals = gaugeFromMarks(all, (key) => { const c = byKey.get(key); return c === undefined ? [] : marksOf(c); }, deps, now).totals;
  }
  return cards.map((card): CardStat => {
    const list = answers(card);
    const marks = list.map((a) => ({ at: a.at, correctness: a.correctness }));
    const timed = list.filter((a) => typeof a.ms === 'number' && a.ms > 0);
    const msTotal = timed.reduce((sum, a) => sum + (a.ms ?? 0), 0);
    const last = marks.length === 0 ? null : marks[marks.length - 1].correctness;
    const k = knownessOf(marks, now);
    const known = model === 'last' ? last !== null && last >= 0.999
      : model === 'memory' ? k >= KNOWN
      : k >= KNOWN || cardEntities(card).some((id) => (totals.get(id) ?? 0) >= KNOWN);
    return {
      card,
      answers: marks.length,
      right: marks.filter((m) => m.correctness >= 0.999).length,
      share: marks.length === 0 ? null : marks.reduce((sum, m) => sum + m.correctness, 0) / marks.length,
      msTotal,
      msAvg: timed.length === 0 ? null : msTotal / timed.length,
      lastAt: marks.length === 0 ? null : marks[marks.length - 1].at,
      last,
      now: k,
      inWeek: knownessOf(marks, now + WEEK),
      holdsHours: marks.length === 0 ? null : stability(marks),
      due: dueAt(marks),
      known,
      seen: marks.length > 0
    };
  });
}

export function summarize(stats: readonly CardStat[]): StatSummary {
  const answers = stats.reduce((sum, s) => sum + s.answers, 0);
  const timedAnswers = stats.reduce((sum, s) => sum + (s.msAvg === null ? 0 : Math.round(s.msTotal / s.msAvg)), 0);
  const msTotal = stats.reduce((sum, s) => sum + s.msTotal, 0);
  const lastAt = stats.reduce<number | null>((max, s) => (s.lastAt !== null && (max === null || s.lastAt > max) ? s.lastAt : max), null);
  const known = stats.filter((s) => s.known).length;
  const unseen = stats.filter((s) => !s.seen).length;
  return { cards: stats.length, known, learning: stats.length - known - unseen, unseen, answers, msTotal, msPerAnswer: timedAnswers === 0 ? null : msTotal / timedAnswers, lastAt };
}

/** „3 min", „1 h 20 min", „2 dni" — jak długo. */
export function spanText(ms: number): string {
  if (ms < 59_500) return `${Math.max(1, Math.round(ms / 1000))} s`;
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h${min % 60 === 0 ? '' : ` ${min % 60} min`}`;
  return `${Math.round(h / 24)} dni`;
}

/** Wie lange es hält (Trwałość, Stunden) — in Worten. */
export const holdsText = (hours: number | null): string => (hours === null ? '—' : spanText(hours * HOUR));
