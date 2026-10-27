/**
 * COGITA — DIE WIEDERHOLUNG: ein Graph, der Karten auswählt, und ein Lauf,
 * der sie fragt (COGITA.md §6).
 *
 * <b>Die Auswahl ist ein Graph</b> [F15]: Quellen (alle Karten, eine Art, eine
 * Sammlung, ein Thema samt Unterthemen, eine Liste) → Filter (Vorlage,
 * Richtung, Form, Stand, nur Fällige) → Vereinigung → Sperre durch
 * Voraussetzungen → EINE Strategie. 2026-10-22 (Schritt 9): dazu „Idź po
 * odwołaniu" und „Filtr wpisów" — dieselben Schritte wie ein Widok
 * (`selection.ts`), hier über die Einträge der Karten. Die Strategien sind eine feste Liste mit
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
 * sie, auch wenn eine Grundlage inzwischen wieder wackelt. 2026-10-27: die
 * Voraussetzungen kommen auch aus den Feldern „Najpierw trzeba znać"
 * (`prerequisites.ts`); „sitzt" heisst Kenntnis MAL Richtigkeit der letzten
 * Antwort (`masteryOf` — eine falsche Antwort öffnet nichts); ein Pytanie zählt
 * für das, was es prüft („O czym"); „Najpierw podstawy" holt die Karten
 * fehlender Grundlagen dazu; und NEUE Karten kommen in der Reihenfolge der
 * Ebenen — erst das Allgemeine, dann das Besondere —, auch ohne Sperre.
 *
 * <b>Der Lauf ist eine reine Zustandsmaschine</b>: `start`, dann `answer` je
 * Antwort, jeder Schritt gibt einen neuen Zustand. Der Zufall hat einen Samen
 * — derselbe Same, dieselbe Folge —, damit ein Lauf sich nach einem Neuladen
 * fortsetzen lässt und die Prüfung reproduzierbar ist.
 */

import { rngOf, shuffle, type Card } from './cardBasics';
import { evaluate, paletteOf, type Graph, type NodeKind, type Port } from './graph';
import { dueAt, knownessOf, KNOWN, levelOf, masteryOf, propagate, snapshotOf, type Dependency, type Level, type Mark, type Snapshot } from './knowness';
import { cardEntities, cardLevel, entityMastery, prerequisiteGraph, unmetNeeds, withBasics, type PrerequisiteGraph } from './prerequisites';
import type { TextRule } from './check';
import { pick, STEP_WORDS, type SelectContext, type Step } from './selection';

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
  readonly marks: (key: string) => readonly Mark[];
  readonly now: number;
  /** 2026-10-22 — aus welcher Bibliothek oder Baza wiedzy ein Eintrag kommt (für „Rodzaj … z …"). */
  readonly from?: (entity: string) => string | undefined;
  /** 2026-10-22 (Schritt 9) — die Auswahl, die ein Widok auch benutzt (`selection.ts`); fehlt sie, lassen die Schritte alles durch. */
  readonly select?: SelectContext;
  /** 2026-10-27 — die Abhängigkeiten (Ustawienia und Felder „Najpierw trzeba znać") — „Najpierw podstawy" holt damit Grundlagen dazu. */
  readonly deps?: readonly Dependency[];
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

/** Der Eintrag einer Karte — ein Pytanie ist selbst einer. */
const entityOfCard = (c: Card): string => c.entity ?? c.question;
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

/* 2026-10-23 (Schritt 5) — die Quelle „Temat" gibt es nicht mehr (keine Themen); ein alter Knoten sagt es (`graph.ts`, RETIRED_NODES). */

const BY_LIST: Kind = {
  type: 'source.list', label: 'Lista', group: 'Źródła',
  says: 'Karty wybranych wpisów albo pytań.',
  ports: () => ({ inputs: [], outputs: [port('cards', 'Karty')] }),
  run: ({ config, ctx }) => {
    const ids = new Set(lines(config.ids));
    return out(ctx.cards.filter((c) => ids.has(c.question) || (c.entity !== undefined && ids.has(c.entity))));
  }
};

/** 2026-10-22 (Schritt 11) — eine Powtórka aus einem Eintrag: die Karten dessen, worauf er verweist (ein Kazanie: Cytaty, Komentarze, Słowa). */
const BY_FROM: Kind = {
  type: 'source.from', label: STEP_WORDS['source.from'].label, group: 'Źródła',
  says: `${STEP_WORDS['source.from'].says} Daje karty tych wpisów.`,
  ports: () => ({ inputs: [], outputs: [port('cards', 'Karty')] }),
  run: ({ config, ctx }) => {
    if (ctx.select === undefined) return out([]);
    const ids = pick(ctx.select, { type: 'source.from', config }, null);
    return out(ctx.cards.filter((c) => ids.has(entityOfCard(c))));
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

/**
 * 2026-10-22 (Schritt 9) — EIN SCHRITT DER AUSWAHL über die Einträge der
 * Karten: „Idź po odwołaniu" nimmt die Karten der erreichten Einträge (aus
 * allen Karten), „Filtr wpisów" behält die Karten, deren Eintrag die Regel
 * erfüllt.
 */
function throughEntities(ctx: RevisionContext, flow: CardFlow, step: Step): CardFlow {
  if (ctx.select === undefined) return flow;
  const kept = pick(ctx.select, step, new Set(flow.cards.map(entityOfCard)));
  const from = step.type === 'follow' || step.type === 'structure' ? ctx.cards : flow.cards;
  return { cards: from.filter((c) => kept.has(entityOfCard(c))), gate: flow.gate };
}

const FOLLOW: Kind = {
  type: 'follow', label: STEP_WORDS.follow.label, group: 'Zawężenie',
  says: `${STEP_WORDS.follow.says} Daje karty tamtych wpisów.`,
  ports: () => ({ inputs: [port('cards', 'Karty', true)], outputs: [port('cards', 'Karty')] }),
  run: ({ config, inputs, ctx }) => ({ cards: throughEntities(ctx, merge(flowsAt(inputs, 'cards')), { type: 'follow', config }) })
};

/* 2026-10-25 (Wywód) — dieselbe Struktur wie in „Wpisy": die Karten der Schritte unter (oder über) diesen Einträgen. */
const STRUCTURE: Kind = {
  type: 'structure', label: STEP_WORDS.structure.label, group: 'Zawężenie',
  says: `${STEP_WORDS.structure.says} Daje karty tamtych wpisów.`,
  ports: () => ({ inputs: [port('cards', 'Karty', true)], outputs: [port('cards', 'Karty')] }),
  run: ({ config, inputs, ctx }) => ({ cards: throughEntities(ctx, merge(flowsAt(inputs, 'cards')), { type: 'structure', config }) })
};

const FILTER_RULE: Kind = {
  type: 'filter.rule', label: 'Filtr wpisów', group: 'Zawężenie',
  says: `${STEP_WORDS['filter.rule'].says} Zostają karty tych wpisów.`,
  ports: () => ({ inputs: [port('cards', 'Karty', true)], outputs: [port('cards', 'Karty')] }),
  run: ({ config, inputs, ctx }) => ({ cards: throughEntities(ctx, merge(flowsAt(inputs, 'cards')), { type: 'filter.rule', config }) })
};

const UNION: Kind = {
  type: 'union', label: 'Razem', group: 'Zawężenie',
  says: 'Łączy kilka źródeł w jeden stos, bez powtórzeń.',
  ports: () => ({ inputs: [port('cards', 'Karty', true)], outputs: [port('cards', 'Karty')] }),
  run: ({ inputs }) => ({ cards: merge(flowsAt(inputs, 'cards')) })
};

const GATE: Kind = {
  type: 'gate', label: 'Najpierw podstawy', group: 'Zawężenie',
  says: 'Karta trafia na stos dopiero wtedy, gdy to, co trzeba znać wcześniej („Najpierw trzeba znać” w rodzajach i pytaniach, zależności w Ustawieniach), jest już opanowane (od wybranego progu). Brakujące podstawy dobiera z całej bazy (chyba że „pull”: false).',
  ports: () => ({ inputs: [port('cards', 'Karty', true)], outputs: [port('cards', 'Karty')] }),
  run: ({ config, inputs, ctx }) => {
    const flow = merge(flowsAt(inputs, 'cards'));
    /* 2026-10-27 — die Karten fehlender Grundlagen dazu: wer Orbitale lernt, beginnt beim Atom. */
    const cards = config.pull === false || ctx.deps === undefined ? flow.cards : withBasics(flow.cards, ctx.cards, prerequisiteGraph(ctx.deps));
    return { cards: { cards, gate: Math.max(0, num(config.threshold, KNOWN)) } satisfies CardFlow };
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

export const REVISION_PALETTE = paletteOf<RevisionContext>('revision', [ALL, BY_KIND, BY_COLLECTION, BY_LIST, BY_FROM, FILTER, FOLLOW, STRUCTURE, FILTER_RULE, UNION, GATE, STRATEGY]);

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

export interface Gauge {
  /** Je Karte, wie sicher sie sitzt (`masteryOf`). */
  readonly perCard: Map<string, number>;
  /** Je Eintrag: nur seine Karten (und die Pytania über ihn). */
  readonly own: Map<string, number>;
  /** Je Eintrag: seine Karten (und die Pytania über ihn), dazu was auf ihm aufbaut (A.3). */
  readonly totals: Map<string, number>;
  /** Einträge, die eine Karte prüft — nur sie können sperren (`prerequisites.ts`). */
  readonly askable: ReadonlySet<string>;
}

/**
 * WIE SICHER ES SITZT, je Karte und je Eintrag — für die Sperre und die Ścieżka. 2026-10-27:
 * Kenntnis mal Richtigkeit der letzten Antwort; ein Pytanie zählt auch für „O czym".
 */
export function gauge(all: readonly Card[], marks: (key: string) => readonly Mark[], deps: readonly Dependency[], now: number): Gauge {
  const perCard = new Map<string, number>();
  for (const card of all) perCard.set(card.key, masteryOf(marks(card.key), now));
  const own = entityMastery(all, (card) => perCard.get(card.key) ?? 0);
  return { perCard, own, totals: propagate(own, deps), askable: new Set(own.keys()) };
}

/** Was vor einer Karte noch nicht sitzt — die Teile eines Zitats und die Grundlagen ihrer Einträge. */
export function closedBy(card: Card, g: Gauge, graph: PrerequisiteGraph, threshold: number): string[] {
  const parts = card.requires.filter((key) => (g.perCard.get(key) ?? 0) < threshold);
  const needs = unmetNeeds(cardEntities(card), (id) => g.totals.get(id) ?? 0, graph, threshold, (id) => g.askable.has(id));
  return [...parts, ...needs];
}

interface Internal extends Session {
  readonly all: readonly Card[];
  readonly fallback: (key: string) => readonly Mark[];
  readonly deps: readonly Dependency[];
  /** 2026-10-27 — die Voraussetzungen als Graph: Sperre und Reihenfolge der neuen Karten. */
  readonly graph: PrerequisiteGraph;
}

const rngAt = (seed: string, step: number) => rngOf(`${seed}#${step}`);

const marksIn = (s: Pick<Internal, 'marks' | 'fallback'>) => (key: string): readonly Mark[] => s.marks.get(key) ?? s.fallback(key);

function eligible(s: Pick<Internal, 'plan' | 'all' | 'marks' | 'fallback' | 'deps' | 'graph'>, now: number): Card[] {
  const unique = s.plan.cards.filter((c, i, all) => all.findIndex((o) => o.key === c.key) === i);
  if (s.plan.gate === null) return unique;
  const g = gauge(s.all, marksIn(s), s.deps, now);
  return unique.filter((c) => closedBy(c, g, s.graph, s.plan.gate!).length === 0);
}

/** 2026-10-27 — erst das Allgemeine: nach der Ebene, sonst wie gegeben (ohne Graph ändert sich nichts). */
const byLevel = (keys: readonly string[], s: Pick<Internal, 'all' | 'plan' | 'graph'>): string[] => {
  if (s.graph.edges.length === 0) return [...keys];
  const level = (key: string) => { const c = s.all.find((x) => x.key === key) ?? s.plan.cards.find((x) => x.key === key); return c === undefined ? 0 : cardLevel(c, s.graph); };
  return keys.map((key) => ({ key, l: level(key) })).sort((a, b) => a.l - b.l).map((x) => x.key);
};

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
  for (const one of [...weak.map((w) => w.key), ...byLevel(shuffle(fresh, rng), s)]) {
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
    .map((c) => ({ key: c.key, level: levels.get(c.key) ?? 1, asked: asked.has(c.key) ? 1 : 0, tie: rng(), basic: cardLevel(c, s.graph) }))
    .sort((a, b) => a.level - b.level || a.asked - b.asked || a.basic - b.basic || a.tie - b.tie);
  for (const one of ranked) {
    if (out.length >= s.plan.stackSize) break;
    out.push(one.key);
  }
  return out;
}

/**
 * Die nächste Karte aus dem Stapel — nicht dieselbe wie eben, wenn es eine andere gibt. 2026-10-27:
 * hat die Baza eine Reihenfolge des Lernens, zuerst eine der niedrigsten Ebene (das Allgemeine vor
 * dem Besonderen, auch im Stapel); sonst wie bisher irgendeine.
 */
function pickFrom(active: readonly string[], previous: string | null, rng: () => number, level?: (key: string) => number): string | null {
  if (active.length === 0) return null;
  const others = active.filter((k) => k !== previous);
  let from = others.length > 0 ? others : active;
  if (level !== undefined) {
    const low = Math.min(...from.map(level));
    from = from.filter((k) => level(k) === low);
  }
  return from[Math.floor(rng() * from.length)];
}

/** Die Ebene einer Karte im Stapel — nur, wenn es eine Reihenfolge gibt. */
const levelIn = (s: Pick<Internal, 'all' | 'plan' | 'graph'>): ((key: string) => number) | undefined => {
  if (s.graph.edges.length === 0) return undefined;
  const at = new Map<string, number>();
  for (const c of [...s.plan.cards, ...s.all]) if (!at.has(c.key)) at.set(c.key, cardLevel(c, s.graph));
  return (key) => at.get(key) ?? 0;
};

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
    deps: input.deps,
    graph: prerequisiteGraph(input.deps)
  };
  const rng = rngAt(input.seed, 0);

  if (input.plan.mode === 'random' || input.plan.mode === 'once') {
    let cards = eligible(base, input.now);
    if (input.plan.order === 'random') cards = shuffle(cards, rng);
    /* 2026-10-27 — mit „Najpierw podstawy": auch eine feste Folge beginnt beim Allgemeinen. */
    if (input.plan.gate !== null && input.plan.order !== 'given') {
      const order = byLevel(cards.map((c) => c.key), base);
      cards = order.map((key) => cards.find((c) => c.key === key)!);
    }
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
  return seal({ ...base, active, current: pickFrom(active, null, rng, levelIn(base)) });
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
    return { session: seal({ ...next, levels, wrongSinceCorrect: wrong, active, current: pickFrom(active, key, rng, levelIn(next)) }), snapshot };
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
  return { session: seal({ ...next, active, current: pickFrom(active, key, rng, levelIn(next)) }), snapshot };
}

/**
 * 2026-10-27 — WAS NOCH AUF GRUNDLAGEN WARTET: Karten des Plans, die nicht gefragt wurden, weil vor
 * ihnen etwas noch nicht sitzt — und was das ist (das Häufigste zuerst). Für das Ende eines Laufs.
 */
export function heldBack(session: Session, now: number): { readonly cards: number; readonly needs: readonly string[] } {
  const s = session as Internal;
  if (s.plan.gate === null || s.graph === undefined) return { cards: 0, needs: [] };
  const g = gauge(s.all, marksIn(s), s.deps, now);
  const count = new Map<string, number>();
  let cards = 0;
  for (const card of s.plan.cards) {
    if (s.asked.has(card.key)) continue;
    const by = closedBy(card, g, s.graph, s.plan.gate);
    if (by.length === 0) continue;
    cards += 1;
    for (const id of by) count.set(id, (count.get(id) ?? 0) + 1);
  }
  return { cards, needs: [...count].sort((a, b) => b[1] - a[1]).map(([id]) => id) };
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
