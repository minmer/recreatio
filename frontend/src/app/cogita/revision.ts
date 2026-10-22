/**
 * COGITA — DIE WIEDERHOLUNG: ein Graph, der Karten auswählt, und ein Lauf,
 * der sie fragt (COGITA.md §6).
 *
 * <b>Die Auswahl ist ein Graph</b> [F15]: Quellen (alle Karten, eine Art, eine
 * Sammlung, ein Thema samt Unterthemen, eine Liste) → Filter (Vorlage,
 * Richtung, Form, Stand, nur Fällige) → Vereinigung → Sperre durch
 * Voraussetzungen → EINE Strategie. Die Strategien sind eine feste Liste mit
 * Parametern [E6], dieselben wie im Altbestand (`features/revision/registry.ts`):
 *
 * <code>
 *   random     eine feste Zahl Karten, jede einmal
 *   once       der ganze Stapel, jede einmal
 *   levels     Stufen: richtig hebt (bis zur höchsten), falsch setzt auf 1 zurück;
 *              ein Stapel fester Grösse, gefüllt von den niedrigsten Stufen
 *   temporal   nach der Kenntnis: was unter 1 liegt, kommt in den Stapel (das
 *              Schwächste zuerst), dann das noch nie Gefragte; was richtig
 *              beantwortet ist, verlässt ihn, was falsch war, bleibt
 * </code>
 *
 * <b>Voraussetzungen sperren beim Füllen</b> (COGITA.md A.2): eine Karte kommt
 * erst in den Stapel, wenn ihre Grundlagen sitzen. Liegt sie schon darin, bleibt
 * sie, auch wenn eine Grundlage inzwischen wieder wackelt.
 *
 * <b>Der Lauf ist eine reine Zustandsmaschine</b>: `start`, dann `answer` je
 * Antwort, jeder Schritt gibt einen neuen Zustand. Der Zufall hat einen Samen
 * — derselbe Same, dieselbe Folge —, damit ein Lauf sich nach einem Neuladen
 * fortsetzen lässt und die Prüfung reproduzierbar ist.
 */

import { rngOf, shuffle, type Card } from './cardBasics';
import { evaluate, paletteOf, type Graph, type NodeKind, type Port } from './graph';
import { average, blockedBy, dueAt, knownessOf, KNOWN, levelOf, propagate, snapshotOf, type Dependency, type Level, type Mark, type Snapshot } from './knowness';
import type { TextRule } from './check';

/* -- Was durch den Auswahlgraphen fliesst ----------------------------------------- */

export interface CardFlow {
  readonly cards: readonly Card[];
  /** Ab welcher Kenntnis Voraussetzungen als erfüllt gelten — `null`: keine Sperre. */
  readonly gate: number | null;
}

export interface RevisionContext {
  /** Alle Karten der Bibliothek. */
  readonly cards: readonly Card[];
  /** Die Arten eines Eintrags. */
  readonly kindsOf: (entity: string) => readonly string[];
  /** Die Einträge einer Sammlung (gespeicherter Filter oder Liste). */
  readonly collection: (id: string) => ReadonlySet<string> | undefined;
  /** Die Einträge eines Themas und seiner Unterthemen, bis zur Tiefe. */
  readonly topic: (id: string, depth: number) => ReadonlySet<string>;
  readonly marks: (key: string) => readonly Mark[];
  readonly now: number;
  /** 2026-10-22 — aus welcher Bibliothek oder Baza wiedzy ein Eintrag kommt (für „Rodzaj … z …"). */
  readonly from?: (entity: string) => string | undefined;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const lines = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => str(x).trim()).filter((x) => x !== '') : typeof v === 'string' ? v.split('\n').map((x) => x.trim()).filter((x) => x !== '') : []);

const flowsAt = (inputs: Readonly<Record<string, readonly unknown[]>>, port: string): CardFlow[] =>
  (inputs[port] ?? []).filter((v): v is CardFlow => isObject(v) && Array.isArray((v as { cards?: unknown }).cards));

/** Vereinigt, ohne doppelte Karten; die strengste Sperre gilt. */
function merge(flows: readonly CardFlow[]): CardFlow {
  const seen = new Set<string>();
  const cards: Card[] = [];
  let gate: number | null = null;
  for (const flow of flows) {
    if (flow.gate !== null) gate = Math.max(gate ?? 0, flow.gate);
    for (const card of flow.cards) {
      if (seen.has(card.key)) continue;
      seen.add(card.key);
      cards.push(card);
    }
  }
  return { cards, gate };
}

const port = (id: string, label: string, many = false, type = 'cards'): Port => ({ id, label, type, many });
type Kind = NodeKind<RevisionContext>;
const out = (cards: readonly Card[]) => ({ cards: { cards, gate: null } satisfies CardFlow });

const ALL: Kind = {
  type: 'source.all', label: 'Wszystkie karty', group: 'Źródła',
  says: 'Każda karta tej bazy wiedzy (i baz, z których korzysta).',
  ports: () => ({ inputs: [], outputs: [port('cards', 'Karty')] }),
  run: ({ ctx }) => out(ctx.cards)
};

const BY_KIND: Kind = {
  type: 'source.kind', label: 'Rodzaj', group: 'Źródła',
  says: 'Karty wpisów jednego rodzaju — także z biblioteki, z której korzysta ta baza (np. cytaty); „Skąd" zawęża do jednej biblioteki albo bazy.',
  ports: () => ({ inputs: [], outputs: [port('cards', 'Karty')] }),
  run: ({ config, ctx }) => {
    const from = str(config.from);
    return out(ctx.cards.filter((c) => c.entity !== undefined && ctx.kindsOf(c.entity).includes(str(config.kind))
      && (from === '' || ctx.from?.(c.entity) === from)));
  }
};

const BY_COLLECTION: Kind = {
  type: 'source.collection', label: 'Zbiór', group: 'Źródła',
  says: 'Karty wpisów zapisanego zbioru — filtra albo listy.',
  ports: () => ({ inputs: [], outputs: [port('cards', 'Karty')] }),
  run: ({ config, ctx }) => {
    const members = ctx.collection(str(config.collection));
    if (members === undefined) throw new Error('Nie ma takiego zbioru.');
    return out(ctx.cards.filter((c) => c.entity !== undefined && members.has(c.entity)));
  }
};

const BY_TOPIC: Kind = {
  type: 'source.topic', label: 'Temat', group: 'Źródła',
  says: 'Karty tematu i jego podtematów, do wybranej głębokości.',
  ports: () => ({ inputs: [], outputs: [port('cards', 'Karty')] }),
  run: ({ config, ctx }) => {
    const members = ctx.topic(str(config.topic), Math.max(0, Math.round(num(config.depth, 9))));
    return out(ctx.cards.filter((c) => c.entity !== undefined && members.has(c.entity)));
  }
};

const BY_LIST: Kind = {
  type: 'source.list', label: 'Lista', group: 'Źródła',
  says: 'Karty wybranych wpisów albo pytań.',
  ports: () => ({ inputs: [], outputs: [port('cards', 'Karty')] }),
  run: ({ config, ctx }) => {
    const ids = new Set(lines(config.ids));
    return out(ctx.cards.filter((c) => ids.has(c.question) || (c.entity !== undefined && ids.has(c.entity))));
  }
};

const FILTER: Kind = {
  type: 'filter', label: 'Filtr', group: 'Zawężenie',
  says: 'Zostawia karty z wybranych szablonów, kierunków, form odpowiedzi, stanów (jeszcze nie / w nauce / umiem) albo tylko te, na które przyszła pora.',
  ports: () => ({ inputs: [port('cards', 'Karty', true)], outputs: [port('cards', 'Karty')] }),
  run: ({ config, inputs, ctx }) => {
    const flow = merge(flowsAt(inputs, 'cards'));
    const templates = new Set(lines(config.templates));
    const directions = new Set(lines(config.directions));
    const forms = new Set(lines(config.forms));
    const levels = new Set(lines(config.levels));
    const dueOnly = config.dueOnly === true;
    const cards = flow.cards.filter((c) => {
      if (templates.size > 0 && (c.template === undefined || !templates.has(c.template))) return false;
      if (directions.size > 0 && !directions.has(c.direction)) return false;
      if (forms.size > 0 && !forms.has(c.answer.form)) return false;
      const marks = ctx.marks(c.key);
      if (levels.size > 0 && !levels.has(levelOf(marks, ctx.now))) return false;
      if (dueOnly) {
        const due = dueAt(marks);
        if (due !== null && due > ctx.now) return false;
      }
      return true;
    });
    return { cards: { cards, gate: flow.gate } satisfies CardFlow };
  }
};

const UNION: Kind = {
  type: 'union', label: 'Razem', group: 'Zawężenie',
  says: 'Łączy kilka źródeł w jeden stos, bez powtórzeń.',
  ports: () => ({ inputs: [port('cards', 'Karty', true)], outputs: [port('cards', 'Karty')] }),
  run: ({ inputs }) => ({ cards: merge(flowsAt(inputs, 'cards')) })
};

const GATE: Kind = {
  type: 'gate', label: 'Najpierw podstawy', group: 'Zawężenie',
  says: 'Karta trafia na stos dopiero wtedy, gdy to, co trzeba znać wcześniej, jest już opanowane (od wybranego progu).',
  ports: () => ({ inputs: [port('cards', 'Karty', true)], outputs: [port('cards', 'Karty')] }),
  run: ({ config, inputs }) => {
    const flow = merge(flowsAt(inputs, 'cards'));
    return { cards: { cards: flow.cards, gate: Math.max(0, num(config.threshold, KNOWN)) } satisfies CardFlow };
  }
};

export const MODES = ['random', 'once', 'levels', 'temporal'] as const;
export type Mode = (typeof MODES)[number];

export const MODE_LABEL: Record<Mode, string> = {
  random: 'Losowo, określona liczba',
  once: 'Cały stos, każda raz',
  levels: 'Poziomy',
  temporal: 'Według tego, co umiem'
};

export interface Plan {
  readonly cards: readonly Card[];
  readonly mode: Mode;
  /** `random`: ile kart. */
  readonly count: number;
  /** `levels`, `temporal`: ile kart naraz w stosie. */
  readonly stackSize: number;
  /** `levels`: ile poziomów. */
  readonly levels: number;
  /** Od jakiej poprawności (0–1) odpowiedź liczy się jako dobra dla poziomów. */
  readonly minCorrectness: number;
  readonly gate: number | null;
  /** `random`, `once`: kolejność. */
  readonly order: 'random' | 'given' | 'due';
  /** Co powtórka zmienia w surowości szablonu [D5]. */
  readonly rule?: Partial<TextRule>;
}

export function readPlan(cards: readonly Card[], gate: number | null, config: Readonly<Record<string, unknown>>): Plan {
  const mode = (MODES as readonly string[]).includes(str(config.mode)) ? (str(config.mode) as Mode) : 'temporal';
  const order = config.order === 'given' || config.order === 'due' ? config.order : 'random';
  const rule = isObject(config.rule) ? (config.rule as Partial<TextRule>) : undefined;
  return {
    cards,
    mode,
    count: Math.max(1, Math.round(num(config.count, 20))),
    stackSize: Math.max(1, Math.round(num(config.stackSize, 20))),
    levels: Math.max(1, Math.min(20, Math.round(num(config.levels, 5)))),
    minCorrectness: Math.max(0, Math.min(1, num(config.minCorrectness, 1))),
    gate,
    order,
    ...(rule !== undefined ? { rule } : {})
  };
}

const STRATEGY: Kind = {
  type: 'strategy', label: 'Sposób pytania', group: 'Sposób',
  says: 'Jak pytać: losowo określoną liczbę, cały stos raz, poziomami albo według tego, co już umiem.',
  ports: () => ({ inputs: [port('cards', 'Karty', true)], outputs: [port('plan', 'Plan', false, 'plan')] }),
  run: ({ config, inputs }) => {
    const flow = merge(flowsAt(inputs, 'cards'));
    return { plan: readPlan(flow.cards, flow.gate, config) };
  }
};

export const REVISION_PALETTE = paletteOf<RevisionContext>('revision', [ALL, BY_KIND, BY_COLLECTION, BY_TOPIC, BY_LIST, FILTER, UNION, GATE, STRATEGY]);

/** Der Plan einer Wiederholung aus ihrem Graphen — genau ein „Sposób pytania". */
export async function planOf(graph: Graph, ctx: RevisionContext): Promise<{ plan: Plan | null; problems: string[] }> {
  const strategies = graph.nodes.filter((n) => n.type === 'strategy');
  if (strategies.length !== 1) return { plan: null, problems: [strategies.length === 0 ? 'Powtórka nie ma kroku „Sposób pytania".' : 'Powtórka może mieć tylko jeden „Sposób pytania".'] };
  const result = await evaluate(graph, REVISION_PALETTE, ctx);
  const id = strategies[0].id;
  const error = result.errors.get(id);
  if (error !== undefined) return { plan: null, problems: [...new Set([...result.errors.values()])] };
  const plan = result.outputs.get(id)?.plan as Plan | undefined;
  return plan === undefined ? { plan: null, problems: ['Powtórka nie dała planu.'] } : { plan, problems: [] };
}

/* -- Der Lauf ---------------------------------------------------------------------- */

export interface Session {
  readonly plan: Plan;
  readonly seed: string;
  /** Wie viele Antworten dieser Lauf schon hat. */
  readonly step: number;
  /** Die feste Folge (`random`, `once`). */
  readonly queue: readonly string[];
  /** Der Stapel (`levels`, `temporal`). */
  readonly active: readonly string[];
  readonly asked: ReadonlySet<string>;
  readonly levels: ReadonlyMap<string, number>;
  readonly wrongSinceCorrect: ReadonlySet<string>;
  /** Die Antworten je Karte, die dieses Laufs eingeschlossen. */
  readonly marks: ReadonlyMap<string, readonly Mark[]>;
  /** Die Karte, die gerade gefragt wird — `null`: fertig. */
  readonly current: string | null;
}

export interface Start {
  readonly plan: Plan;
  /** Alle Karten — die Kenntnis einer Grundlage rechnet über alle ihre Karten, nicht nur die des Plans. */
  readonly all: readonly Card[];
  readonly marks: (key: string) => readonly Mark[];
  readonly deps: readonly Dependency[];
  readonly now: number;
  readonly seed: string;
  /** Stufen aus früheren Läufen (`levels`). */
  readonly levelsBefore?: ReadonlyMap<string, number>;
}

function knownessMap(cards: readonly Card[], marks: ReadonlyMap<string, readonly Mark[]>, fallback: (key: string) => readonly Mark[], now: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const card of cards) out.set(card.key, knownessOf(marks.get(card.key) ?? fallback(card.key), now));
  return out;
}

/** Wessen Voraussetzungen noch nicht sitzen — auf Ebene der Einträge, und die Teile eines Zitats. */
function openGate(card: Card, perCard: ReadonlyMap<string, number>, totals: ReadonlyMap<string, number>, deps: readonly Dependency[], threshold: number): boolean {
  if (card.requires.some((key) => (perCard.get(key) ?? 0) < threshold)) return false;
  return card.entity === undefined || blockedBy(card.entity, totals, deps, threshold).length === 0;
}

interface Gauge {
  readonly perCard: Map<string, number>;
  readonly totals: Map<string, number>;
}

function gauge(all: readonly Card[], marks: ReadonlyMap<string, readonly Mark[]>, fallback: (key: string) => readonly Mark[], deps: readonly Dependency[], now: number): Gauge {
  const perCard = knownessMap(all, marks, fallback, now);
  const byEntity = new Map<string, number[]>();
  for (const card of all) {
    if (card.entity === undefined) continue;
    byEntity.set(card.entity, [...(byEntity.get(card.entity) ?? []), perCard.get(card.key) ?? 0]);
  }
  const own = new Map<string, number>();
  for (const [entity, values] of byEntity) own.set(entity, average(values));
  return { perCard, totals: propagate(own, deps) };
}

interface Internal extends Session {
  readonly all: readonly Card[];
  readonly fallback: (key: string) => readonly Mark[];
  readonly deps: readonly Dependency[];
}

const rngAt = (seed: string, step: number) => rngOf(`${seed}#${step}`);

function eligible(s: Pick<Internal, 'plan' | 'all' | 'marks' | 'fallback' | 'deps'>, now: number): Card[] {
  const unique = s.plan.cards.filter((c, i, all) => all.findIndex((o) => o.key === c.key) === i);
  if (s.plan.gate === null) return unique;
  const g = gauge(s.all, s.marks, s.fallback, s.deps, now);
  return unique.filter((c) => openGate(c, g.perCard, g.totals, s.deps, s.plan.gate!));
}

/** Füllt den Stapel nach der Kenntnis: erst was unter 1 liegt (das Schwächste zuerst), dann das nie Gefragte. */
function fillTemporal(s: Internal, active: readonly string[], now: number, rng: () => number): string[] {
  const out = active.slice();
  const taken = new Set(out);
  const pool = eligible(s, now).filter((c) => !taken.has(c.key));
  const weak: { key: string; k: number; tie: number }[] = [];
  const fresh: string[] = [];
  for (const card of pool) {
    const marks = s.marks.get(card.key) ?? s.fallback(card.key);
    if (marks.length === 0) { fresh.push(card.key); continue; }
    const k = knownessOf(marks, now);
    if (k < KNOWN) weak.push({ key: card.key, k, tie: rng() });
  }
  weak.sort((a, b) => a.k - b.k || a.tie - b.tie);
  for (const one of [...weak.map((w) => w.key), ...shuffle(fresh, rng)]) {
    if (out.length >= s.plan.stackSize) break;
    out.push(one);
  }
  return out;
}

/**
 * Füllt den Stapel nach Stufen: die niedrigste zuerst, und bei gleicher Stufe
 * das noch nicht Gefragte. Was in DIESEM Lauf die höchste Stufe erreicht hat,
 * kommt nicht zurück — so endet ein Lauf, wenn alles oben ist (der Altbestand
 * lief ohne Ende weiter).
 */
function fillLevels(s: Internal, active: readonly string[], levels: ReadonlyMap<string, number>, asked: ReadonlySet<string>, now: number, rng: () => number): string[] {
  const out = active.slice();
  const taken = new Set(out);
  const pool = eligible(s, now).filter((c) => !taken.has(c.key) && !(asked.has(c.key) && (levels.get(c.key) ?? 1) >= s.plan.levels));
  const ranked = pool
    .map((c) => ({ key: c.key, level: levels.get(c.key) ?? 1, asked: asked.has(c.key) ? 1 : 0, tie: rng() }))
    .sort((a, b) => a.level - b.level || a.asked - b.asked || a.tie - b.tie);
  for (const one of ranked) {
    if (out.length >= s.plan.stackSize) break;
    out.push(one.key);
  }
  return out;
}

/** Die nächste Karte aus dem Stapel — nicht dieselbe wie eben, wenn es eine andere gibt. */
function pickFrom(active: readonly string[], previous: string | null, rng: () => number): string | null {
  if (active.length === 0) return null;
  const others = active.filter((k) => k !== previous);
  const from = others.length > 0 ? others : active;
  return from[Math.floor(rng() * from.length)];
}

const seal = (s: Internal): Session => s;

export function start(input: Start): Session {
  const base: Internal = {
    plan: input.plan,
    seed: input.seed,
    step: 0,
    queue: [],
    active: [],
    asked: new Set(),
    levels: new Map(input.levelsBefore ?? []),
    wrongSinceCorrect: new Set(),
    marks: new Map(),
    current: null,
    all: input.all,
    fallback: input.marks,
    deps: input.deps
  };
  const rng = rngAt(input.seed, 0);

  if (input.plan.mode === 'random' || input.plan.mode === 'once') {
    let cards = eligible(base, input.now);
    if (input.plan.order === 'random') cards = shuffle(cards, rng);
    else if (input.plan.order === 'due') {
      const dueOf = (c: Card) => dueAt(input.marks(c.key)) ?? Number.NEGATIVE_INFINITY;
      cards = cards.slice().sort((a, b) => dueOf(a) - dueOf(b));
    }
    const queue = (input.plan.mode === 'random' ? cards.slice(0, input.plan.count) : cards).map((c) => c.key);
    return seal({ ...base, queue: queue.slice(1), current: queue[0] ?? null });
  }

  const active = input.plan.mode === 'levels'
    ? fillLevels(base, [], base.levels, base.asked, input.now, rng)
    : fillTemporal(base, [], input.now, rng);
  return seal({ ...base, active, current: pickFrom(active, null, rng) });
}

export interface Answered {
  readonly session: Session;
  /** Was für die beantwortete Karte gespeichert wird (COGITA.md §7). */
  readonly snapshot: Snapshot | null;
}

/**
 * EINE ANTWORT auf die aktuelle Karte. `correctness` ist die Teilrichtigkeit
 * der Prüfung (0–1); als „richtig" für die Stufen gilt sie ab
 * `plan.minCorrectness`.
 */
export function answer(session: Session, correctness: number, at: number): Answered {
  const s = session as Internal;
  const key = s.current;
  if (key === null) return { session, snapshot: null };
  const card = s.all.find((c) => c.key === key) ?? s.plan.cards.find((c) => c.key === key);
  const marks = new Map(s.marks);
  const history = [...(marks.get(key) ?? s.fallback(key)), { at, correctness: Math.max(0, Math.min(1, correctness)) }];
  marks.set(key, history);
  const asked = new Set(s.asked);
  asked.add(key);
  const step = s.step + 1;
  const rng = rngAt(s.seed, step);
  const snapshot = card === undefined ? null : snapshotOf(card.question, card.direction, history, at);
  const next: Internal = { ...s, step, marks, asked };

  if (s.plan.mode === 'random' || s.plan.mode === 'once') {
    return { session: seal({ ...next, current: s.queue[0] ?? null, queue: s.queue.slice(1) }), snapshot };
  }

  if (s.plan.mode === 'levels') {
    const levels = new Map(s.levels);
    const wrong = new Set(s.wrongSinceCorrect);
    const good = correctness >= s.plan.minCorrectness - 1e-9;
    const level = levels.get(key) ?? 1;
    if (good) {
      levels.set(key, wrong.has(key) ? 1 : Math.min(level + 1, s.plan.levels));
      wrong.delete(key);
    } else {
      levels.set(key, 1);
      wrong.add(key);
    }
    const kept = good ? s.active.filter((k) => k !== key) : s.active.slice();
    const active = good ? fillLevels({ ...next, levels, wrongSinceCorrect: wrong }, kept, levels, asked, at, rng) : kept;
    return { session: seal({ ...next, levels, wrongSinceCorrect: wrong, active, current: pickFrom(active, key, rng) }), snapshot };
  }

  /*
   * Gleich nach JEDER Antwort steht die Formel bei 10^0,5 — auch nach einer
   * falschen; die falsche verkürzt nur, wie lange es hält (auf fünf Minuten).
   * Darum entscheidet in diesem Lauf die Antwort selbst: was falsch war, bleibt
   * im Stapel und kommt wieder; was richtig war, geht und kommt zurück, wenn
   * seine Kenntnis unter 1 gefallen ist.
   */
  const good = correctness >= s.plan.minCorrectness - 1e-9;
  const kept = good ? s.active.filter((k) => k !== key) : s.active.slice();
  const active = fillTemporal(next, kept, at, rng);
  return { session: seal({ ...next, active, current: pickFrom(active, key, rng) }), snapshot };
}

/** Wie weit der Lauf ist. `total` gibt es nur bei fester Folge. */
export function progress(session: Session): { readonly answered: number; readonly total: number | null; readonly done: boolean } {
  const fixed = session.plan.mode === 'random' || session.plan.mode === 'once';
  return {
    answered: session.step,
    total: fixed ? session.step + session.queue.length + (session.current === null ? 0 : 1) : null,
    done: session.current === null
  };
}

/** Der Stand jeder Karte des Plans — für die Übersicht vor und nach dem Lauf. */
export function levelsOf(plan: Plan, marks: (key: string) => readonly Mark[], now: number): Record<Level, number> {
  const out: Record<Level, number> = { unseen: 0, learning: 0, known: 0 };
  for (const card of plan.cards) out[levelOf(marks(card.key), now)] += 1;
  return out;
}
