/**
 * COGITA — WIE GUT ETWAS SITZT (COGITA.md §6).
 *
 * <b>2026-10-30: ein Schritt je Antwort.</b> Jede Karte behält nur wenige Werte (`CardState`): wann sie zuletzt
 * beantwortet wurde, wie lange es davor WIRKLICH her war, den Abstand, den sie jetzt hat, und den besten Abstand vor
 * ihrem letzten Fehler. Die nächste Antwort rechnet nur aus diesen Werten und sich selbst (`step`) — nie aus der
 * ganzen Geschichte. Die Antworten bleiben trotzdem alle gespeichert (`learn.ts`): ändert sich eine Regel, spielt
 * `stateOf` jeden Zustand aus ihnen neu ab (dasselbe Ergebnis wie Schritt für Schritt).
 *
 * <code>
 *   richtig                     der wirklich vergangene Abstand × 3 (GROWTH); eine frühe Antwort kürzt nie
 *   teilweise richtig           ein Drittel davon (PARTIAL), mindestens ein Tag, wenn Tage vergangen waren
 *   falsch                      zurück auf fünf Minuten (MIN_INTERVAL) — die Karte kommt nie sofort wieder
 *   richtig gleich nach Fehler  0,4 × der beste Abstand vor dem Fehler (RELEARN) — Gelerntes ist nicht weg
 * </code>
 *
 * Immer zählt die WIRKLICH vergangene Zeit: eine späte richtige Antwort zählt mehr. Richtig heisst ab 0,9
 * (`CORRECT_FROM`), falsch unter 0,25 (`WRONG_BELOW`), dazwischen teilweise.
 *
 * <b>Die Kenntnis einer Karte</b>: die Richtigkeit der letzten Antwort × √(10 / (1 + 9 · t / Abstand)) — gleich nach
 * einer richtigen 3,16, am fälligen Termin genau 1 (die Grenze „sitzt", `KNOWN`), danach IMMER LANGSAMER (2026-11-01,
 * der Eigentümer: „nicht linear, sondern begrenzt"): 10 % erst nach 111 Abständen, nie 0; nach einer falschen 0. Ein
 * langer Abstand (viele gute Antworten in grossen Abständen) lässt sie langsam fallen. Vorher 10^(½(1 − t/Abstand)):
 * dieselben Punkte bei 0 und beim Termin, danach aber ein Absturz — eine Karte, einmal richtig, stand nach einem Tag bei
 * 10^−47.
 *
 * <b>Die Kenntnis eines Eintrags</b> setzt sich aus seinen Karten zusammen (`knowing.ts`, gewogen, wie stark jede ihn
 * prüft); was auf ihm aufbaut, gibt etwas dazu (A.3, `propagate`). <b>Gerechnet wird im Browser</b> [E7] — der Dienst
 * kann die Antworten nicht lesen.
 */

import { texts } from '../core/i18n';

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/* -- Die Regeln, benannt und leicht zu stellen ---------------------------------------------------------- */

/** Falsch: zurück auf fünf Minuten — nie gleich wieder. */
export const MIN_INTERVAL = 5 * MINUTE;
/** Richtig: der wirklich vergangene Abstand mal drei. */
export const GROWTH = 3;
/** Teilweise richtig: ein Drittel des vergangenen Abstands … */
export const PARTIAL = 1 / 3;
/** … mindestens ein Tag, wenn Tage vergangen waren. */
export const PARTIAL_FLOOR = DAY;
/** Richtig gleich nach einem Fehler: 0,4 × der beste Abstand vor dem Fehler. */
export const RELEARN = 0.4;
/**
 * 2026-11-05 (Durchsicht) — HÖCHSTENS TAUSEND JAHRE: extreme „Zaawansowane“-Werte (100 Jahre × 1 000 000) schoben den
 * Termin über das Ende des Datumsbereichs (`toISOString` warf, „Invalid Date“). Mit allen Vorgaben nie erreicht.
 */
export const MAX_INTERVAL = 1000 * 365 * DAY;
/** Ab dieser Richtigkeit ist eine Antwort richtig … */
export const CORRECT_FROM = 0.9;
/** … unter dieser falsch; dazwischen teilweise. */
export const WRONG_BELOW = 0.25;

/**
 * 2026-11-04 (Prompt 15) — DIE ABSTÄNDE SIND EINSTELLBAR (`spacing.ts`: der Lernende, der Bereich, die Vorgabe), der
 * Algorithmus bleibt derselbe. Zwei Werte:
 * <code>
 *   first    der erste Abstand nach einer richtigen Antwort (auch nach falsch, dann richtig) — Vorgabe 15 Minuten
 *            (MIN_INTERVAL × GROWTH, wie bisher)
 *   growth   um wie viel jeder weitere Abstand nach einer richtigen Antwort wächst — Vorgabe 3 (GROWTH)
 * </code>
 * Mit der Vorgabe ist jeder Abstand genau wie vorher (`app-spacing-check.mjs` vergleicht mit der alten Funktion).
 */
export interface Spacing {
  /** Millisekunden. */
  readonly first: number;
  readonly growth: number;
}

export const DEFAULT_SPACING: Spacing = { first: MIN_INTERVAL * GROWTH, growth: GROWTH };

/** Ab hier sitzt es: am fälligen Termin einer richtigen Antwort steht die Kenntnis genau auf 1. */
export const KNOWN = 1;

/**
 * 2026-11-01 — DARUNTER IST ES NICHT (MEHR) GEWUSST: nie beantwortet, zuletzt falsch oder vergessen (eine richtige
 * Antwort, deren Abstand 111-mal verstrichen ist). Der Termin einer Wiederholung sagt NICHT „unbekannt", sondern „jetzt
 * wiederholen": dann steht die Kenntnis knapp unter 1 — im Band „do powtórki", nicht „nieznane".
 */
export const FORGOTTEN = 0.1;

/** Eine Antwort, wie die Kenntnis sie braucht: wann, und wie richtig. */
export interface Mark {
  /** Millisekunden seit 1970. */
  readonly at: number;
  /** 0–1, die Teilrichtigkeit eingeschlossen [D6]. */
  readonly correctness: number;
}

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

export type Grade = 'correct' | 'partly' | 'wrong';

export const gradeOf = (correctness: number): Grade => {
  const q = clamp01(correctness);
  return q >= CORRECT_FROM - 1e-9 ? 'correct' : q < WRONG_BELOW ? 'wrong' : 'partly';
};

/** Was eine Karte behält — alles in Millisekunden. */
export interface CardState {
  /** Wann zuletzt beantwortet. */
  readonly at: number;
  /** Der Abstand ab `at`, nach dem sie wieder dran ist. */
  readonly interval: number;
  /** Wie lange es vor der letzten Antwort wirklich her war (0 bei der ersten). */
  readonly elapsed: number;
  /** Der beste Abstand vor dem letzten Fehler (0: noch keiner). */
  readonly best: number;
  /** Wie richtig die letzte Antwort war (0–1). */
  readonly q: number;
  /** Seit dem letzten Fehler noch keine richtige Antwort. */
  readonly lapsed: boolean;
  readonly answers: number;
}

/** EIN SCHRITT: der neue Zustand aus dem alten und der neuen Antwort — sonst nichts. `sp` (2026-11-04, Prompt 15): die Abstände. */
export function step(state: CardState | null, mark: Mark, sp: Spacing = DEFAULT_SPACING): CardState {
  const q = clamp01(mark.correctness);
  const grade = gradeOf(q);
  if (state === null) {
    return { at: mark.at, interval: grade === 'correct' ? Math.min(MAX_INTERVAL, sp.first) : MIN_INTERVAL, elapsed: 0, best: 0, q, lapsed: grade === 'wrong', answers: 1 };
  }
  const elapsed = Math.max(0, mark.at - state.at);
  const answers = state.answers + 1;
  if (grade === 'wrong') {
    /* Der beste Abstand vor DIESEM Fehler: der, den sie hatte — war sie noch beim Wiederlernen, bleibt der frühere. */
    return { at: mark.at, interval: MIN_INTERVAL, elapsed, best: state.lapsed ? state.best : state.interval, q, lapsed: true, answers };
  }
  if (grade === 'partly') {
    const interval = Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, elapsed * PARTIAL, elapsed >= PARTIAL_FLOOR ? PARTIAL_FLOOR : 0));
    return { at: mark.at, interval, elapsed, best: state.best, q, lapsed: state.lapsed, answers };
  }
  const grown = Math.max(MIN_INTERVAL, elapsed * sp.growth);
  /*
   * 2026-11-04 (Prompt 15) — richtig nach einem Fehler: mindestens der erste Abstand — anteilig, wenn früher als nach fünf
   * Minuten (dem Abstand nach einem Fehler) geantwortet wurde. Mit der Vorgabe ist das nie mehr als `grown`
   * (15 Min. × t / 5 Min. = 3 · t), also genau wie vorher.
   */
  /* 2026-11-05 (Durchsicht) — `min(first, first · t / 5 Min.)`: mit der Vorgabe bitgenau die alte Zahl (vorher 1 ulp darüber). */
  const relearned = Math.max(grown, RELEARN * state.best, Math.min(sp.first, (sp.first * elapsed) / MIN_INTERVAL));
  const interval = Math.min(MAX_INTERVAL, state.lapsed ? relearned : Math.max(grown, state.interval));
  return { at: mark.at, interval, elapsed, best: state.best, q, lapsed: false, answers };
}

/** Den Zustand aus den gespeicherten Antworten neu abspielen — dasselbe wie Schritt für Schritt. */
export function stateOf(marks: readonly Mark[], sp: Spacing = DEFAULT_SPACING): CardState | null {
  let state: CardState | null = null;
  for (const m of marks.filter((x) => Number.isFinite(x.at)).slice().sort((a, b) => a.at - b.at)) state = step(state, m, sp);
  return state;
}

/** Die Kenntnis eines Zustands zum Zeitpunkt `now` — 0 ohne Antwort und gleich nach einer falschen. */
export function knownessAt(state: CardState | null, now: number): number {
  if (state === null) return 0;
  const t = Math.max(0, now - state.at);
  return state.q * Math.sqrt(10 / (1 + (9 * t) / Math.max(1, state.interval)));
}

/** Die Kenntnis zum Zeitpunkt `now` — 0, solange nie geantwortet wurde. */
export const knownessOf = (marks: readonly Mark[], now: number, sp: Spacing = DEFAULT_SPACING): number => knownessAt(stateOf(marks, sp), now);

/** Wann die Karte wieder dran ist; `null`: noch nie gefragt (also gleich). */
export function dueAt(marks: readonly Mark[], sp: Spacing = DEFAULT_SPACING): number | null {
  const state = stateOf(marks, sp);
  return state === null ? null : state.at + state.interval;
}

/** Der Abstand in Stunden — wie lange es nach der letzten Antwort hält (für „Postępy"). */
export function stability(marks: readonly Mark[], sp: Spacing = DEFAULT_SPACING): number {
  const state = stateOf(marks, sp);
  return (state === null ? MIN_INTERVAL : state.interval) / HOUR;
}

/**
 * 2026-11-01 — DIE DREI BÄNDER (fest, für jede Art von Wissen gleich):
 * <code>
 *   unseen    „nieznane"      nie gefragt, zuletzt falsch oder vergessen (unter FORGOTTEN)
 *   learning  „do powtórki"   FORGOTTEN bis unter 1 — gewusst, jetzt (oder bald) zu wiederholen
 *   known     „znane"         ab 1 — gewusst, noch nicht an der Reihe
 * </code>
 * Die Namen der Werte bleiben (gespeichert in Filtern „Tylko stany"); ihre Bedeutung sind die Bänder.
 */
export type Level = 'unseen' | 'learning' | 'known';

export const LEVEL_LABEL: Record<Level, string> = texts({ unseen: 'cogitaLearnLogic.level.unseen', learning: 'cogitaLearnLogic.level.learning', known: 'cogitaLearnLogic.level.known' });

/** Das Band einer Kenntnis — `answered: false` heisst nie gefragt (also nieznane). */
export const levelOfKnowness = (k: number, answered = true): Level => (!answered || !(k >= FORGOTTEN) ? 'unseen' : k < KNOWN ? 'learning' : 'known');

/** Das Band eines Zustands jetzt. */
export const levelOfState = (state: CardState | null, now: number): Level => (state === null ? 'unseen' : levelOfKnowness(knownessAt(state, now)));

export function levelOf(marks: readonly Mark[], now: number, sp: Spacing = DEFAULT_SPACING): Level {
  return levelOfState(marks.length === 0 ? null : stateOf(marks, sp), now);
}

/** Für Balken und Prozente: über 1 ist „sitzt", mehr als 100 % gibt es nicht. */
export const shareOf = (knowness: number): number => clamp01(knowness / KNOWN);

/** Der Durchschnitt — für Balken über mehrere Karten. */
export function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/* -- Momentaufnahme --------------------------------------------------------------- */

/**
 * Was je Karte gespeichert wird (COGITA.md §7): die Kennung der Frage, die Richtung, die Kenntnis im Augenblick der
 * letzten Antwort, wann sie fällig wird — und (v2, 2026-10-30) der Zustand selbst. Die Antworten liegen daneben; aus
 * ihnen lässt sich alles neu rechnen.
 */
export interface Snapshot {
  readonly question: string;
  readonly direction: string;
  readonly knowness: number;
  readonly due: number | null;
  readonly at: number;
  readonly answers: number;
  readonly v?: 2;
  readonly interval?: number;
  readonly elapsed?: number;
  readonly best?: number;
}

export function snapshotOf(question: string, direction: string, marks: readonly Mark[], now: number, sp: Spacing = DEFAULT_SPACING): Snapshot {
  return snapshotOfState(question, direction, stateOf(marks, sp), now);
}

/** Dasselbe aus dem Zustand, wie ein Lauf ihn Schritt für Schritt nachführt. */
export function snapshotOfState(question: string, direction: string, state: CardState | null, now: number): Snapshot {
  return {
    question, direction, knowness: knownessAt(state, now), due: state === null ? null : state.at + state.interval, at: now, answers: state?.answers ?? 0,
    ...(state === null ? {} : { v: 2 as const, interval: state.interval, elapsed: state.elapsed, best: state.best })
  };
}

/* -- Abhängigkeiten ----------------------------------------------------------------- */

export const DEPENDENCY_KINDS = ['prerequisite', 'elaboration', 'context'] as const;
export type DependencyKind = (typeof DEPENDENCY_KINDS)[number];

export const DEPENDENCY_LABEL: Record<DependencyKind, string> = texts({
  prerequisite: 'cogitaLearnLogic.dependency.prerequisite',
  elaboration: 'cogitaLearnLogic.dependency.elaboration',
  context: 'cogitaLearnLogic.dependency.context'
});

/**
 * `parent` ist die Grundlage, `child` baut auf ihr auf. Die Reihenfolge des Lernens kommt nur aus Voraussetzungen
 * (`prerequisites.ts`); weitergegeben wird über jede Kante.
 */
export interface Dependency {
  readonly parent: string;
  readonly child: string;
  readonly kind: DependencyKind;
  /** Wie viel von der Kenntnis des Abhängigen an die Grundlage geht. */
  readonly impact: number;
}

/** Ohne Kreise: eine Kante, die einen schlösse, fällt weg — die frühere gewinnt. */
export function acyclic(deps: readonly Dependency[]): Dependency[] {
  /*
   * 2026-11-03 — DER SCHNELLE WEG: hat der ganze Graph keinen Kreis, schliesst keine Kante einen — jede bleibt (ausser einer
   * Schleife auf sich selbst), genau wie unten. Geprüft in O(V+E) (Kahn); unten sucht jede Kante einen Weg zurück, bei
   * 50 000 Kanten viel zu langsam für jede Antwort (`gauge` ruft `propagate` jedes Mal).
   */
  if (withoutCircle(deps)) return deps.filter((d) => d.parent !== d.child);
  const kept: Dependency[] = [];
  const next = new Map<string, string[]>();
  const reaches = (from: string, to: string): boolean => {
    const seen = new Set<string>();
    const stack = [from];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (id === to) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(next.get(id) ?? []));
    }
    return false;
  };
  for (const dep of deps) {
    if (dep.parent === dep.child || reaches(dep.child, dep.parent)) continue;
    kept.push(dep);
    next.set(dep.parent, [...(next.get(dep.parent) ?? []), dep.child]);
  }
  return kept;
}

/**
 * DIE WEITERGABE (COGITA.md A.3): wer das Spätere kann, kann das Frühere wenigstens zum Teil — die Grundlage steht
 * mindestens auf dem, was ein Abhängiger weiss, mal dem Gewicht. 2026-11-01 — BEGRENZT: das Beste von ihr selbst und
 * ihren Abhängigen (`max`), nicht ihre Summe. Vorher zählten vier halb gekonnte Abhängige zusammen als „sitzt" (eine
 * nie gefragte Grundlage öffnete, was auf ihr aufbaut), und wer auf zwei Wegen erreichbar war, zählte doppelt.
 * Gerechnet von den Blättern her, damit eine Kette weiterträgt; gespeichert wird nichts davon.
 */
export function propagate(own: ReadonlyMap<string, number>, deps: readonly Dependency[]): Map<string, number> {
  const edges = acyclic(deps);
  const ids = new Set<string>([...own.keys(), ...edges.flatMap((d) => [d.parent, d.child])]);
  const children = new Map<string, Dependency[]>();
  for (const dep of edges) { const list = children.get(dep.parent); if (list === undefined) children.set(dep.parent, [dep]); else list.push(dep); }
  /*
   * 2026-11-03 — von den Blättern her OHNE Rekursion (eine Kette von 10 000 Einträgen sprengte sonst den Stapel): jeder
   * Eintrag erst, wenn alles, was auf ihm aufbaut, fertig ist — dasselbe Ergebnis wie der rekursive Weg.
   */
  const waiting = new Map<string, number>();
  for (const id of ids) waiting.set(id, (children.get(id) ?? []).length);
  const parents = new Map<string, string[]>();
  for (const dep of edges) { const list = parents.get(dep.child); if (list === undefined) parents.set(dep.child, [dep.parent]); else list.push(dep.parent); }
  const ready = [...ids].filter((id) => waiting.get(id) === 0);
  const total = new Map<string, number>();
  for (let i = 0; i < ready.length; i += 1) {
    const id = ready[i];
    let best = own.get(id) ?? 0;
    for (const dep of children.get(id) ?? []) best = Math.max(best, (total.get(dep.child) ?? 0) * Math.max(0, Math.min(1, dep.impact)));
    total.set(id, best);
    for (const p of parents.get(id) ?? []) {
      const left = (waiting.get(p) ?? 1) - 1;
      waiting.set(p, left);
      if (left === 0) ready.push(p);
    }
  }
  return total;
}

/** Hat der Graph keinen Kreis (Schleifen auf sich selbst zählen nicht)? Kahn, O(V+E). */
function withoutCircle(deps: readonly Dependency[]): boolean {
  const indeg = new Map<string, number>();
  const next = new Map<string, string[]>();
  for (const d of deps) {
    if (d.parent === d.child) continue;
    if (!indeg.has(d.parent)) indeg.set(d.parent, 0);
    indeg.set(d.child, (indeg.get(d.child) ?? 0) + 1);
    const list = next.get(d.parent);
    if (list === undefined) next.set(d.parent, [d.child]); else list.push(d.child);
  }
  const queue = [...indeg].filter(([, n]) => n === 0).map(([id]) => id);
  let done = 0;
  for (let i = 0; i < queue.length; i += 1) {
    done += 1;
    for (const c of next.get(queue[i]) ?? []) {
      const left = (indeg.get(c) ?? 1) - 1;
      indeg.set(c, left);
      if (left === 0) queue.push(c);
    }
  }
  return done === indeg.size;
}
