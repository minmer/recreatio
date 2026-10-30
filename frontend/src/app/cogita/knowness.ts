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
 * <b>Die Kenntnis einer Karte</b>: die Richtigkeit der letzten Antwort × 10^(0,5 · (1 − t / Abstand)) — gleich nach
 * einer richtigen 3,16, am fälligen Termin genau 1 (die Grenze „sitzt", `KNOWN`), danach weiter gegen 0; nach einer
 * falschen 0. Ein langer Abstand (viele gute Antworten in grossen Abständen) lässt sie langsam fallen.
 *
 * <b>Die Kenntnis eines Eintrags</b> setzt sich aus seinen Karten zusammen (`knowing.ts`, gewogen, wie stark jede ihn
 * prüft); was auf ihm aufbaut, gibt etwas dazu (A.3, `propagate`). <b>Gerechnet wird im Browser</b> [E7] — der Dienst
 * kann die Antworten nicht lesen.
 */

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
/** Ab dieser Richtigkeit ist eine Antwort richtig … */
export const CORRECT_FROM = 0.9;
/** … unter dieser falsch; dazwischen teilweise. */
export const WRONG_BELOW = 0.25;

/** Ab hier sitzt es: am fälligen Termin einer richtigen Antwort steht die Kenntnis genau auf 1. */
export const KNOWN = 1;

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

/** EIN SCHRITT: der neue Zustand aus dem alten und der neuen Antwort — sonst nichts. */
export function step(state: CardState | null, mark: Mark): CardState {
  const q = clamp01(mark.correctness);
  const grade = gradeOf(q);
  if (state === null) {
    return { at: mark.at, interval: grade === 'correct' ? MIN_INTERVAL * GROWTH : MIN_INTERVAL, elapsed: 0, best: 0, q, lapsed: grade === 'wrong', answers: 1 };
  }
  const elapsed = Math.max(0, mark.at - state.at);
  const answers = state.answers + 1;
  if (grade === 'wrong') {
    /* Der beste Abstand vor DIESEM Fehler: der, den sie hatte — war sie noch beim Wiederlernen, bleibt der frühere. */
    return { at: mark.at, interval: MIN_INTERVAL, elapsed, best: state.lapsed ? state.best : state.interval, q, lapsed: true, answers };
  }
  if (grade === 'partly') {
    const interval = Math.max(MIN_INTERVAL, elapsed * PARTIAL, elapsed >= PARTIAL_FLOOR ? PARTIAL_FLOOR : 0);
    return { at: mark.at, interval, elapsed, best: state.best, q, lapsed: state.lapsed, answers };
  }
  const grown = Math.max(MIN_INTERVAL, elapsed * GROWTH);
  const interval = state.lapsed ? Math.max(grown, RELEARN * state.best) : Math.max(grown, state.interval);
  return { at: mark.at, interval, elapsed, best: state.best, q, lapsed: false, answers };
}

/** Den Zustand aus den gespeicherten Antworten neu abspielen — dasselbe wie Schritt für Schritt. */
export function stateOf(marks: readonly Mark[]): CardState | null {
  let state: CardState | null = null;
  for (const m of marks.filter((x) => Number.isFinite(x.at)).slice().sort((a, b) => a.at - b.at)) state = step(state, m);
  return state;
}

/** Die Kenntnis eines Zustands zum Zeitpunkt `now` — 0 ohne Antwort und gleich nach einer falschen. */
export function knownessAt(state: CardState | null, now: number): number {
  if (state === null) return 0;
  const t = Math.max(0, now - state.at);
  return state.q * Math.pow(10, 0.5 * (1 - t / Math.max(1, state.interval)));
}

/** Die Kenntnis zum Zeitpunkt `now` — 0, solange nie geantwortet wurde. */
export const knownessOf = (marks: readonly Mark[], now: number): number => knownessAt(stateOf(marks), now);

/** Wann die Karte wieder dran ist; `null`: noch nie gefragt (also gleich). */
export function dueAt(marks: readonly Mark[]): number | null {
  const state = stateOf(marks);
  return state === null ? null : state.at + state.interval;
}

/** Der Abstand in Stunden — wie lange es nach der letzten Antwort hält (für „Postępy"). */
export function stability(marks: readonly Mark[]): number {
  const state = stateOf(marks);
  return (state === null ? MIN_INTERVAL : state.interval) / HOUR;
}

export type Level = 'unseen' | 'learning' | 'known';

export const LEVEL_LABEL: Record<Level, string> = { unseen: 'jeszcze nie', learning: 'w nauce', known: 'umiem' };

export function levelOf(marks: readonly Mark[], now: number): Level {
  if (marks.length === 0) return 'unseen';
  return knownessOf(marks, now) >= KNOWN ? 'known' : 'learning';
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

export function snapshotOf(question: string, direction: string, marks: readonly Mark[], now: number): Snapshot {
  return snapshotOfState(question, direction, stateOf(marks), now);
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

export const DEPENDENCY_LABEL: Record<DependencyKind, string> = {
  prerequisite: 'Najpierw trzeba znać',
  elaboration: 'Pogłębia',
  context: 'Daje tło'
};

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
 * DIE WEITERGABE (COGITA.md A.3): die Grundlage bekommt zu ihrer eigenen Kenntnis, was die Abhängigen wissen, mal
 * dem Gewicht — `parent += child · impact`. Gerechnet von den Blättern her, damit eine Kette weiterträgt. Wird das
 * Abhängige schlechter, sinkt der Beitrag mit; gespeichert wird nichts davon.
 */
export function propagate(own: ReadonlyMap<string, number>, deps: readonly Dependency[]): Map<string, number> {
  const edges = acyclic(deps);
  const ids = new Set<string>([...own.keys(), ...edges.flatMap((d) => [d.parent, d.child])]);
  const children = new Map<string, Dependency[]>();
  for (const dep of edges) children.set(dep.parent, [...(children.get(dep.parent) ?? []), dep]);
  const total = new Map<string, number>();
  const visit = (id: string): number => {
    const done = total.get(id);
    if (done !== undefined) return done;
    let sum = own.get(id) ?? 0;
    for (const dep of children.get(id) ?? []) sum += visit(dep.child) * Math.max(0, dep.impact);
    total.set(id, sum);
    return sum;
  };
  for (const id of ids) visit(id);
  return total;
}
