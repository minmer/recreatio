/**
 * COGITA — WIE GUT ETWAS SITZT (COGITA.md §6, A.1).
 *
 * <b>Die Formel steht wörtlich da</b> [E1]. Sie rechnet mit zwei Antworten und
 * den Abständen davor:
 *
 * <code>
 *   q1, d1   die vorletzte Antwort: wie richtig (0–1), und wie lange vor ihr die drittletzte war
 *   q2, d2   die letzte Antwort: wie richtig, und wie lange nach der vorletzten
 *   t        wie lange die letzte her ist
 *   alles in Stunden; T0 = fünf Minuten
 *
 *   H = max(T0, T0^(1−q2) · (12 · (d2 + q1·d1))^q2)
 *   Kenntnis = 10^(0,5 · (1 − t/H))
 * </code>
 *
 * Gleich nach einer Antwort steht die Kenntnis bei 10^0,5 ≈ 3,16; nach `H`
 * Stunden bei genau 1 — das ist die Grenze zwischen „sitzt" und „wackelt" und
 * damit der Zeitpunkt, an dem die Karte wieder fällig ist —, und danach sinkt
 * sie weiter gegen 0. Eine falsche letzte Antwort (q2 = 0) setzt H auf fünf
 * Minuten zurück, eine richtige nach einem langen Abstand macht H gross.
 *
 * <b>Gerechnet wird im Browser</b> [E7] — der Dienst kann die Antworten nicht
 * lesen. Gespeichert werden die Antworten und je Karte eine Momentaufnahme mit
 * der Kennung der Frage und der Richtung (COGITA.md §7).
 *
 * <b>Abhängigkeiten</b> [E3, E4]: Voraussetzung, Vertiefung, Zusammenhang, jede
 * Kante mit einem Gewicht. Nur Voraussetzungen sperren; jede Kante gibt etwas
 * von der Kenntnis des Abhängigen an seine Grundlage weiter.
 */

/** Fünf Minuten, in Stunden. */
export const T0 = 5 / 60;

/** Ab hier sitzt es: bei t = H gibt die Formel genau 1. */
export const KNOWN = 1;

const HOUR = 3_600_000;

/** Eine Antwort, wie die Kenntnis sie braucht: wann, und wie richtig. */
export interface Mark {
  /** Millisekunden seit 1970. */
  readonly at: number;
  /** 0–1, die Teilrichtigkeit eingeschlossen [D6]. */
  readonly correctness: number;
}

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

/** Die Formel aus COGITA.md A.1 — unverändert. */
export function knowledge(q1: number, d1: number, q2: number, d2: number, t: number): number {
  const H = Math.max(T0, Math.pow(T0, 1 - q2) * Math.pow(12 * (d2 + q1 * d1), q2));
  return Math.pow(10, 0.5 * (1 - t / H));
}

/** Die Antworten in ihrer Zeitfolge, die letzten drei — mehr braucht die Formel nicht. */
function lastThree(marks: readonly Mark[]): Mark[] {
  return marks
    .filter((m) => Number.isFinite(m.at))
    .slice()
    .sort((a, b) => a.at - b.at)
    .slice(-3);
}

/** Was die Formel aus den letzten drei Antworten nimmt: q1, d1, q2, d2. */
function termsOf(marks: readonly Mark[]): { q1: number; d1: number; q2: number; d2: number; last: Mark } | null {
  const recent = lastThree(marks);
  const c = recent[recent.length - 1];
  if (c === undefined) return null;
  const b = recent[recent.length - 2];
  const a = recent[recent.length - 3];
  return {
    q2: clamp01(c.correctness),
    d2: b === undefined ? 0 : Math.max(0, (c.at - b.at) / HOUR),
    q1: b === undefined ? 0 : clamp01(b.correctness),
    d1: a === undefined || b === undefined ? 0 : Math.max(0, (b.at - a.at) / HOUR),
    last: c
  };
}

/** H in Stunden — wie lange es nach der letzten Antwort sitzt. */
export function stability(marks: readonly Mark[]): number {
  const terms = termsOf(marks);
  if (terms === null) return T0;
  return Math.max(T0, Math.pow(T0, 1 - terms.q2) * Math.pow(12 * (terms.d2 + terms.q1 * terms.d1), terms.q2));
}

/** Die Kenntnis zum Zeitpunkt `now` — 0, solange nie geantwortet wurde. */
export function knownessOf(marks: readonly Mark[], now: number): number {
  const terms = termsOf(marks);
  if (terms === null) return 0;
  const t = Math.max(0, (now - terms.last.at) / HOUR);
  return knowledge(terms.q1, terms.d1, terms.q2, terms.d2, t);
}

/** Wann die Kenntnis auf 1 fällt und die Karte wieder dran ist; `null`: noch nie gefragt (also gleich). */
export function dueAt(marks: readonly Mark[]): number | null {
  const terms = termsOf(marks);
  if (terms === null) return null;
  return terms.last.at + stability(marks) * HOUR;
}

export type Level = 'unseen' | 'learning' | 'known';

export const LEVEL_LABEL: Record<Level, string> = { unseen: 'jeszcze nie', learning: 'w nauce', known: 'umiem' };

export function levelOf(marks: readonly Mark[], now: number): Level {
  if (marks.length === 0) return 'unseen';
  return knownessOf(marks, now) >= KNOWN ? 'known' : 'learning';
}

/** Für Balken und Prozente: über 1 ist „sitzt", mehr als 100 % gibt es nicht. */
export const shareOf = (knowness: number): number => clamp01(knowness / KNOWN);

/** Der Durchschnitt — so rechnet ein Eintrag, ein Thema, eine Sammlung aus ihren Karten [E2]. */
export function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/* -- Momentaufnahme --------------------------------------------------------------- */

/**
 * Was je Karte gespeichert wird (COGITA.md §7): die Kennung der Frage, die
 * Richtung, die Kenntnis im Augenblick der letzten Antwort und wann sie fällig
 * wird. Die Antworten selbst liegen daneben; aus ihnen lässt sich alles neu
 * rechnen.
 */
export interface Snapshot {
  readonly question: string;
  readonly direction: string;
  readonly knowness: number;
  readonly due: number | null;
  readonly at: number;
  readonly answers: number;
}

export function snapshotOf(question: string, direction: string, marks: readonly Mark[], now: number): Snapshot {
  return { question, direction, knowness: knownessOf(marks, now), due: dueAt(marks), at: now, answers: marks.length };
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
 * `parent` ist die Grundlage, `child` baut auf ihr auf. Gesperrt wird nur über
 * Voraussetzungen; weitergegeben wird über jede Kante.
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
 * DIE WEITERGABE (COGITA.md A.3): die Grundlage bekommt zu ihrer eigenen
 * Kenntnis, was die Abhängigen wissen, mal dem Gewicht — `parent += child ·
 * impact`. Gerechnet von den Blättern her, damit eine Kette weiterträgt. Wird
 * das Abhängige schlechter, sinkt der Beitrag mit; gespeichert wird nichts davon.
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

/** Welche Voraussetzungen von `id` noch nicht sitzen — leer: offen [E3]. */
export function blockedBy(id: string, totals: ReadonlyMap<string, number>, deps: readonly Dependency[], threshold = KNOWN): string[] {
  return acyclic(deps)
    .filter((d) => d.child === id && d.kind === 'prerequisite' && (totals.get(d.parent) ?? 0) < threshold)
    .map((d) => d.parent);
}

export const gateOpen = (id: string, totals: ReadonlyMap<string, number>, deps: readonly Dependency[], threshold = KNOWN): boolean =>
  blockedBy(id, totals, deps, threshold).length === 0;
