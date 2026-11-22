/**
 * 2026-11-22 (Part B, class) — WAS DIE KLASSE ANTWORTET, rein gerechnet (ohne Netz, ohne React; geprüft in
 * `scripts/app-lesson-check.mjs`).
 *
 * Eine Stunde ist eine Erzählung, die alle zusammen gehen: der Leiter drückt „Dalej", die Klasse stimmt ab. Hier steht,
 * wie aus den einzelnen Stimmen die Verteilung (je Möglichkeit, je getippter Antwort, je benanntem Fehler), die Antwort
 * der Klasse und der Hinweis für den Leiter werden:
 *
 * <code>
 *   eine Möglichkeit / wahr-falsch / mehrere   die häufigste Antwort ist die der Klasse
 *   getippt (Text, Zahl, Lücke, Reihenfolge …)   richtig, wenn die Mehrheit richtig getippt hat
 *   Wahl (Gabelung) und Kapitel                  die meisten Stimmen; bei Gleichstand die erste Möglichkeit
 *   Hinweis (einstellbar)                        ≥ 70 % weiter · 30–70 % Nachbarn + zweite Runde · < 30 % zurück zur Folie
 * </code>
 *
 * Es zählt die LETZTE Stimme jedes Teilnehmers in einer Runde (wer umentscheidet, bevor der Leiter schliesst, zählt so).
 */

import { answerSignals } from '../adaptive';
import type { Card } from '../cardBasics';
import { checkCard } from '../cards';

export interface Vote {
  readonly participant: string;
  readonly given: unknown;
  readonly at: number;
}

/** Ab welchem Anteil richtiger Stimmen der Leiter weitergehen kann, ab welchem er zurück zur Folie sollte. */
export interface Thresholds {
  readonly high: number;
  readonly low: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = { high: 0.7, low: 0.3 };

export type Advice = 'move-on' | 'discuss' | 'back';

/** Die Schwellen gelesen (0–1, low ≤ high); Unlesbares fällt auf 70 % / 30 % zurück. */
export function readThresholds(raw: unknown): Thresholds {
  const o = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {};
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v > 1 ? v / 100 : v)) : d);
  const high = num(o.high, DEFAULT_THRESHOLDS.high);
  const low = Math.min(high, num(o.low, DEFAULT_THRESHOLDS.low));
  return { high, low };
}

/** Der Hinweis zu einem Anteil richtiger Stimmen. */
export function adviceOf(share: number, th: Thresholds = DEFAULT_THRESHOLDS): Advice {
  if (share >= th.high) return 'move-on';
  if (share >= th.low) return 'discuss';
  return 'back';
}

/** Die letzte Stimme je Teilnehmer, in der Reihenfolge der ersten Stimme. */
export function lastVotes(votes: readonly Vote[]): Vote[] {
  const order: string[] = [];
  const last = new Map<string, Vote>();
  for (const v of [...votes].sort((a, b) => a.at - b.at)) {
    if (!last.has(v.participant)) order.push(v.participant);
    last.set(v.participant, v);
  }
  return order.map((p) => last.get(p)!);
}

export interface Bar {
  /** Stabil je Möglichkeit (`o0`, `true`) oder je getippter Antwort (`t:<normalisiert>`). */
  readonly key: string;
  /** Was auf dem Balken steht: die Möglichkeit, die getippte Antwort — oder leer, dann nennt die Oberfläche ihn. */
  readonly label: string;
  readonly count: number;
  readonly correct: boolean;
  /** Der benannte Fehler dieser Möglichkeit (`tags` der Frage), wenn sie falsch ist. */
  readonly tag?: string;
}

export interface Tally {
  /** Wie viele Teilnehmer gestimmt haben (je einer, die letzte Stimme). */
  readonly votes: number;
  readonly correct: number;
  /** correct / votes (0 ohne Stimmen). */
  readonly share: number;
  readonly bars: readonly Bar[];
  /** Die benannten Fehler, die in der Klasse stecken — die häufigsten zuerst. */
  readonly tags: readonly { readonly tag: string; readonly count: number }[];
  /** Die Antwort der Klasse — `null` ohne Stimmen. */
  readonly answer: { readonly given: unknown; readonly correct: boolean } | null;
}

const MAX_TYPED = 6;

const typedKey = (given: unknown): string => {
  if (typeof given === 'string') return given.trim().toLowerCase().replace(/\s+/g, ' ');
  try { return JSON.stringify(given) ?? ''; } catch { return String(given); }
};
const typedLabel = (given: unknown): string => {
  if (typeof given === 'string') return given.trim();
  if (Array.isArray(given)) return given.map((x) => (Array.isArray(x) ? x.join('→') : String(x))).join(' · ');
  if (given === null || given === undefined) return '';
  return typeof given === 'object' ? JSON.stringify(given) : String(given);
};

/** Wie oft dieselbe Antwort kam — die häufigste zuerst, bei Gleichstand die zuerst gegebene. */
function groups(votes: readonly Vote[], key: (g: unknown) => string): { key: string; given: unknown; count: number }[] {
  const out = new Map<string, { key: string; given: unknown; count: number }>();
  for (const v of votes) {
    const k = key(v.given);
    const had = out.get(k);
    if (had === undefined) out.set(k, { key: k, given: v.given, count: 1 });
    else out.set(k, { ...had, count: had.count + 1 });
  }
  return [...out.values()].sort((a, b) => b.count - a.count);
}

/**
 * DIE VERTEILUNG EINER FRAGE: je Möglichkeit (one, many, truefalse) ein Balken in ihrer Reihenfolge, sonst die getippten
 * Antworten (die häufigsten sechs); dazu die Fehler-Tags und die Antwort der Klasse. `data`: die Daten der Frage (ihre
 * `tags`) — ohne sie keine benannten Fehler.
 */
export function tallyQuestion(card: Card, votes: readonly Vote[], data: Readonly<Record<string, unknown>> | null = null): Tally {
  const counted = lastVotes(votes);
  const a = card.answer;
  const outcomes = counted.map((v) => ({ v, outcome: checkCard(card, v.given) }));
  const correct = outcomes.filter((o) => o.outcome.correct).length;
  const tagCount = new Map<string, number>();
  for (const { v, outcome } of outcomes) {
    for (const tag of answerSignals(card, data, v.given, outcome).tags) tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
  }
  const tags = [...tagCount.entries()].map(([tag, count]) => ({ tag, count })).sort((x, y) => y.count - x.count || x.tag.localeCompare(y.tag));
  const optionTag = (given: unknown): string | undefined => {
    const outcome = checkCard(card, given);
    if (outcome.correct) return undefined;
    return answerSignals(card, data, given, outcome).tags[0];
  };

  let bars: Bar[];
  if (a.form === 'one') {
    bars = a.options.map((label, i) => ({ key: `o${i}`, label, count: counted.filter((v) => v.given === i).length, correct: a.correct === i, ...withTag(optionTag(i)) }));
  } else if (a.form === 'truefalse') {
    bars = [true, false].map((value) => ({ key: String(value), label: '', count: counted.filter((v) => v.given === value).length, correct: a.value === value }));
  } else if (a.form === 'many') {
    bars = a.options.map((label, i) => ({
      key: `o${i}`, label, count: counted.filter((v) => Array.isArray(v.given) && v.given.includes(i)).length, correct: a.correct.includes(i),
      ...withTag(a.correct.includes(i) ? undefined : optionTag([i]))
    }));
  } else {
    const all = groups(counted, typedKey);
    bars = all.slice(0, MAX_TYPED).map((g) => ({ key: `t:${g.key}`, label: typedLabel(g.given), count: g.count, correct: checkCard(card, g.given).correct, ...withTag(optionTag(g.given)) }));
    const rest = all.slice(MAX_TYPED).reduce((n, g) => n + g.count, 0);
    if (rest > 0) bars.push({ key: 'rest', label: '', count: rest, correct: false });
  }

  return { votes: counted.length, correct, share: counted.length === 0 ? 0 : correct / counted.length, bars, tags, answer: classAnswer(card, counted) };
}

const withTag = (tag: string | undefined): { tag?: string } => (tag === undefined || tag === '' ? {} : { tag });

/**
 * DIE ANTWORT DER KLASSE: bei Möglichkeiten die häufigste (genau gleich gewählte) Antwort; getippt richtig, wenn die
 * Mehrheit richtig getippt hat — dann die häufigste richtige, sonst die häufigste falsche (der Fehler, der in der Klasse
 * steckt). Mit ihr geht der Schritt weiter (ihr Fehler-Tag wählt `wrong:<tag>`, wie bei einem Lernenden).
 */
export function classAnswer(card: Card, votes: readonly Vote[]): { readonly given: unknown; readonly correct: boolean } | null {
  const counted = lastVotes(votes);
  if (counted.length === 0) return null;
  const choice = card.answer.form === 'one' || card.answer.form === 'truefalse' || card.answer.form === 'many';
  const key = (g: unknown) => (Array.isArray(g) ? JSON.stringify([...g].sort()) : typedKey(g));
  const all = groups(counted, key);
  if (choice) {
    const top = all[0]!;
    return { given: top.given, correct: checkCard(card, top.given).correct };
  }
  const right = all.filter((g) => checkCard(card, g.given).correct);
  const rightVotes = right.reduce((n, g) => n + g.count, 0);
  const majority = rightVotes * 2 > counted.length;
  const pick = majority ? right[0] : all.find((g) => !checkCard(card, g.given).correct) ?? all[0];
  return { given: pick!.given, correct: majority };
}

export interface PollTally {
  readonly votes: number;
  readonly counts: readonly number[];
  /** Die Möglichkeit mit den meisten Stimmen (bei Gleichstand die erste) — `null` ohne Stimmen. */
  readonly winner: number | null;
  /** Alle Möglichkeiten nach Stimmen (bei Gleichstand in ihrer Reihenfolge) — die Reihenfolge der Themen. */
  readonly order: readonly number[];
}

/** Eine Abstimmung über einen Weg (Gabelung) oder die Reihenfolge der Themen (Kapitel). */
export function tallyPoll(options: number, votes: readonly Vote[], open: readonly number[] = []): PollTally {
  const counted = lastVotes(votes).filter((v) => typeof v.given === 'number' && Number.isInteger(v.given) && (v.given as number) >= 0 && (v.given as number) < options);
  const counts = Array.from({ length: options }, (_, i) => counted.filter((v) => v.given === i).length);
  const allowed = (i: number) => open.length === 0 || open.includes(i);
  const order = counts.map((n, i) => ({ n, i })).filter((x) => allowed(x.i)).sort((a, b) => b.n - a.n || a.i - b.i).map((x) => x.i);
  return { votes: counted.length, counts, winner: counted.length === 0 ? null : order[0] ?? null, order };
}

/* -- Zadania (B7): ein Ziel, eine Klasse, eine Frist — erledigt aus dem Fortschritt gerechnet ----------------------- */

export type AssignKind = 'tower' | 'trail' | 'review';

export interface AssignTarget {
  readonly kind: AssignKind;
  /** Turm (Ort der Karte), Erzählung (Ablauf) oder der Turm, dessen Karten wiederholt werden. */
  readonly id: string;
}

export interface AssignFacts {
  /** Der Turm ist erobert. */
  readonly conquered: (tower: string) => boolean;
  /** Die Erzählung ist zu Ende gegangen. */
  readonly flowDone: (flow: string) => boolean;
  /** So viele Karten des Turms sind jetzt fällig. */
  readonly due: (tower: string) => number;
  /** Seit diesem Zeitpunkt wurde eine Karte des Turms beantwortet. */
  readonly answeredSince: (tower: string, at: number) => boolean;
}

export type AssignState = 'done' | 'open' | 'late';

/**
 * ERLEDIGT? Nie gespeichert — immer aus dem Fortschritt: Turm erobert, Erzählung zu Ende, Wiederholung = seit der Aufgabe
 * gelernt und nichts mehr fällig. Offen nach der Frist: `late` (sie bleibt stehen, bis sie erledigt ist).
 */
export function assignmentState(target: AssignTarget, facts: AssignFacts, given: { readonly at: number; readonly until: number | null }, now: number): AssignState {
  const done = target.kind === 'tower' ? facts.conquered(target.id)
    : target.kind === 'trail' ? facts.flowDone(target.id)
    : facts.due(target.id) === 0 && facts.answeredSince(target.id, given.at);
  if (done) return 'done';
  return given.until !== null && now > given.until ? 'late' : 'open';
}

/** Offene zuerst (die nächste Frist oben), dann verspätete, dann erledigte. */
export function sortAssignments<T extends { readonly state: AssignState; readonly until: number | null }>(list: readonly T[]): T[] {
  const rank = (s: AssignState) => (s === 'late' ? 0 : s === 'open' ? 1 : 2);
  return [...list].sort((a, b) => rank(a.state) - rank(b.state) || (a.until ?? Infinity) - (b.until ?? Infinity));
}

/* -- Die Ereignisse einer Stunde -------------------------------------------------------------------------------- */

/** Wer die Verteilung sieht: nur der Leiter, die Klasse nach dem Schliessen (Standard), oder die Klasse schon live. */
export type ShowVotes = 'never' | 'after' | 'live';

export const readShowVotes = (v: unknown): ShowVotes => (v === 'never' || v === 'live' ? v : 'after');

/** Eine Erzählung der Stunde: ihr Ablauf und, wenn nicht am Anfang, wo sie beginnt (ein Schritt, an einer Wahl ihr Ausgang). */
export interface LessonFlowPart {
  readonly flow: string;
  readonly start?: { readonly step: string; readonly exit?: string };
}

/**
 * 2026-11-22 (I11) — FRAGEN NACHEINANDER: „Pfad und Turm" — die Klasse beantwortet die Fragen eines Turms gemeinsam (Abstimmung,
 * Verteilung, Antwort der Klasse), oder den Abschluss eines Weges zu einer Frage. `questions`: Schlüssel der Karten.
 */
export interface LessonQuestionsPart {
  readonly questions: readonly string[];
  readonly tower?: string;
  readonly path?: string;
}

export type LessonPart = LessonFlowPart | LessonQuestionsPart;

export const isFlowPart = (part: LessonPart | undefined): part is LessonFlowPart => part !== undefined && 'flow' in part;

export interface LessonConfig {
  readonly title: string;
  readonly parts: readonly LessonPart[];
  readonly showVotes: ShowVotes;
  readonly thresholds: Thresholds;
  /** 2026-11-22 (I11) — der Plan, aus dem die Stunde entstand (`lessonPlan.ts` liest ihn); reist ungelesen mit. */
  readonly plan?: unknown;
}

/** Höchstens so viele Fragen in einem Teil „Fragen nacheinander". */
const QUESTIONS_MAX = 40;

/** Die Einstellung einer Stunde gelesen (aus dem versiegelten `config`). */
export function readLessonConfig(raw: unknown): LessonConfig | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const parts = (Array.isArray(o.parts) ? o.parts : []).flatMap((p): LessonPart[] => {
    if (typeof p !== 'object' || p === null) return [];
    const x = p as Record<string, unknown>;
    if (Array.isArray(x.questions)) {
      const questions = x.questions.filter((q): q is string => typeof q === 'string' && q !== '').slice(0, QUESTIONS_MAX);
      if (questions.length === 0) return [];
      return [{ questions, ...(typeof x.tower === 'string' && x.tower !== '' ? { tower: x.tower } : {}), ...(typeof x.path === 'string' && x.path !== '' ? { path: x.path } : {}) }];
    }
    if (typeof x.flow !== 'string' || x.flow === '') return [];
    const s = typeof x.start === 'object' && x.start !== null ? x.start as Record<string, unknown> : null;
    const start = s !== null && typeof s.step === 'string' && s.step !== '' ? { step: s.step, ...(typeof s.exit === 'string' && s.exit !== '' ? { exit: s.exit } : {}) } : undefined;
    return [{ flow: x.flow, ...(start === undefined ? {} : { start }) }];
  });
  if (parts.length === 0) return null;
  return {
    title: typeof o.title === 'string' ? o.title : '', parts, showVotes: readShowVotes(o.showVotes), thresholds: readThresholds(o.thresholds),
    ...(typeof o.plan === 'object' && o.plan !== null ? { plan: o.plan } : {})
  };
}

/** Die Einstellung einer Zadanie gelesen. */
export interface AssignConfig {
  readonly title: string;
  readonly target: AssignTarget;
  /** Der Name des Ziels, wie der Leiter ihn sah (die Karte nennt es neu, wenn sie es kennt). */
  readonly name: string;
  readonly at: number;
}

export function readAssignConfig(raw: unknown): AssignConfig | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const t = typeof o.target === 'object' && o.target !== null ? o.target as Record<string, unknown> : null;
  const kind = t?.kind === 'tower' || t?.kind === 'trail' || t?.kind === 'review' ? t.kind : null;
  if (kind === null || typeof t?.id !== 'string' || t.id === '') return null;
  return {
    title: typeof o.title === 'string' ? o.title : '',
    target: { kind, id: t.id },
    name: typeof o.name === 'string' ? o.name : '',
    at: typeof o.at === 'number' && Number.isFinite(o.at) ? o.at : 0
  };
}
