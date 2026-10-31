/**
 * COGITA — DIE WIEDERHOLUNG: ein Graph, der Karten auswählt, und ein Lauf, der sie fragt (COGITA.md §6).
 *
 * <b>Die Auswahl ist ein Graph</b> [F15]: Quellen (alle Karten, eine Art, ein Zbiór, eine Liste, ein Eintrag, ein
 * gespeicherter WIDOK) → Schritte (Filtr, Idź po odwołaniu, po strukturze, po kolejności nauki, Filtr wpisów, Filtr
 * znajomości) → Razem → EIN „Sposób pytania". Die Schritte über Einträge sind dieselben wie in einem Widok
 * (`selection.ts`).
 *
 * <b>2026-10-30 — eine Wiederholung ist das einfachste Storyboard</b>: ein Widok mit Zugang zur Kenntnis. Was der
 * Lernende sehen darf, entscheidet ein „Filtr znajomości" (eine Bedingung der einen Logik, `logic.ts`); er wirkt
 * IM LAUF, Karte für Karte: jede Karte trägt ihre Bedingungen (`CardGate`, mit den beim Planen aufgelösten
 * Beziehungen), und beim Füllen des Stapels zählt die Kenntnis von JETZT — wer den Turiner Abschnitt kann, sieht
 * gleich danach die Turiner Jahre. Liegt eine Karte schon im Stapel, bleibt sie, auch wenn etwas wieder wackelt
 * (A.2). Die frühere Sperre „Najpierw podstawy" (`gate`) ist kein eigener Code mehr: ein alter Knoten wird beim Lesen
 * zu „Idź po kolejności nauki" (Grundlagen dazu) + „Filtr znajomości" (was vorher kommt, sitzt) + der Reihenfolge
 * „najpierw ogólne" (`migrateRevision`).
 *
 * <b>Was als Nächstes kommt</b> — eine feste Liste, jede Wahl erklärbar (`whyText`):
 * <code>
 *   Sposób      random (eine Zahl Karten) · once (alle einmal) · levels (Stufen) · temporal (nach der Kenntnis:
 *               was sich verwischt zuerst, dann Neues; was falsch war, bleibt im Stapel)
 *   Kolejność   general (das Allgemeine zuerst — die Ebenen der Kolejność nauki) · text (wie im Quelltext) ·
 *               date (nach dem Datum) · random · given (wie die Auswahl sie gibt) · due (was fällig ist, zuerst)
 *   Wybór       next (streng die nächste) · weighted (zufällig, öfter, was schwächer sitzt und länger wartet)
 * </code>
 *
 * <b>Der Lauf ist eine reine Zustandsmaschine</b>: `start`, dann `answer` je Antwort, jeder Schritt gibt einen neuen
 * Zustand — mit dem Zustand jeder Karte, Schritt für Schritt nachgeführt (`knowness.ts`, `step`). Der Zufall hat
 * einen Samen — derselbe Same, dieselbe Folge —, damit ein Lauf sich nach einem Neuladen fortsetzen lässt und die
 * Prüfung reproduzierbar ist.
 */

import { hashOf, rngOf, type Card } from './cardBasics';
import type { TextRule } from './check';
import { evaluate, paletteOf, type Graph, type GraphEdge, type GraphNode, type NodeKind, type Port } from './graph';
import { gateFor, gateHolds, gauge, gaugeFromMarks, waitsFor, CARD_REF, type CardGate, type Gauge, type RelSource } from './knowing';
import { KNOWN, knownessAt, levelOf, shareOf, snapshotOfState, stateOf, step, type CardState, type Dependency, type Level, type Mark, type Snapshot } from './knowness';
import { readCondition, type Condition } from './logic';
import { cardEntities, cardLevel, prerequisiteGraph, type PrerequisiteGraph } from './prerequisites';
import { fieldsOf, labelOf, valuesOf, type Entity, type Lookup } from './schema';
import { pick, runSteps, STEP_WORDS, type SelectContext, type Step } from './selection';
import { orderByPlace } from './structure';

/* -- Was durch den Auswahlgraphen fliesst ----------------------------------------- */

/** Bedingungen einer Karte: Alternativen (LUB — mehrere Wege), je eine Liste (I). Fehlt eine Karte: keine. */
type Alternatives = readonly (readonly Condition[])[];

export interface CardFlow {
  readonly cards: readonly Card[];
  /** 2026-10-30 — was „Filtr znajomości" den Karten mitgibt; es gilt im Lauf, Karte für Karte. */
  readonly when: ReadonlyMap<string, Alternatives>;
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
  /** 2026-10-27 — die Abhängigkeiten (Ustawienia und Felder „Najpierw trzeba znać"): die Reihenfolge des Lernens. */
  readonly deps?: readonly Dependency[];
  /** 2026-10-30 — die Schritte eines gespeicherten Widoku (Quelle „Widok"). */
  readonly viewSteps?: (id: string) => readonly Step[] | undefined;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const lines = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => str(x).trim()).filter((x) => x !== '') : typeof v === 'string' ? v.split('\n').map((x) => x.trim()).filter((x) => x !== '') : []);

const NO_WHEN: ReadonlyMap<string, Alternatives> = new Map();

const flowsAt = (inputs: Readonly<Record<string, readonly unknown[]>>, port: string): CardFlow[] =>
  (inputs[port] ?? []).filter((v): v is CardFlow => isObject(v) && Array.isArray((v as { cards?: unknown }).cards))
    .map((v) => (v.when instanceof Map ? v : { cards: v.cards, when: NO_WHEN }));

/** Vereinigt, ohne doppelte Karten: eine Karte, die auf einem Weg ohne Bedingung kommt, hat keine; sonst gilt jeder ihrer Wege. */
function merge(flows: readonly CardFlow[]): CardFlow {
  const seen = new Set<string>();
  const cards: Card[] = [];
  const when = new Map<string, (readonly Condition[])[]>();
  const free = new Set<string>();
  for (const flow of flows) {
    for (const card of flow.cards) {
      if (!seen.has(card.key)) { seen.add(card.key); cards.push(card); }
      const alts = flow.when.get(card.key);
      if (alts === undefined) free.add(card.key);
      else when.set(card.key, [...(when.get(card.key) ?? []), ...alts]);
    }
  }
  for (const key of free) when.delete(key);
  return { cards, when };
}

const port = (id: string, label: string, many = false, type = 'cards'): Port => ({ id, label, type, many });

/** Der Eintrag einer Karte — ein Pytanie ist selbst einer. */
const entityOfCard = (c: Card): string => c.entity ?? c.question;
type Kind = NodeKind<RevisionContext>;
const out = (cards: readonly Card[]) => ({ cards: { cards, when: NO_WHEN } satisfies CardFlow });

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

/** Die Kenntnis beim Planen (für Schritte eines Widoku, die sie schon vorher brauchen) — einmal je Kontext gerechnet. */
const planned = new WeakMap<RevisionContext, Gauge>();
const knowingAt = (ctx: RevisionContext): Gauge => {
  let g = planned.get(ctx);
  if (g === undefined) { g = gaugeFromMarks(ctx.cards, ctx.marks, ctx.deps ?? [], ctx.now); planned.set(ctx, g); }
  return g;
};

/**
 * 2026-10-30 — EIN WIDOK ALS QUELLE: die Karten der Einträge, die er zeigt — er entscheidet, was in Frage kommt, die
 * Powtórka wählt daraus. Seine „Filtry znajomości" am Ende gelten im Lauf, Karte für Karte (wie ein Knoten „Filtr
 * znajomości"); einer weiter vorn wählt mit der Kenntnis von jetzt.
 */
const BY_VIEW: Kind = {
  type: 'source.view', label: 'Widok', group: 'Źródła',
  says: 'Karty wpisów, które pokazuje zapisany sposób wyświetlania (widok) — on decyduje, co wchodzi w grę, powtórka wybiera z tego. Jego filtry znajomości na końcu sprawdzają się w trakcie powtórki, przy każdej karcie.',
  ports: () => ({ inputs: [], outputs: [port('cards', 'Karty')] }),
  run: ({ config, ctx }) => {
    const steps = ctx.viewSteps?.(str(config.view));
    if (steps === undefined) throw new Error('Nie ma takiego widoku.');
    if (ctx.select === undefined) return out([]);
    let cut = steps.length;
    while (cut > 0 && steps[cut - 1].type === 'filter.when') cut -= 1;
    const { ids } = runSteps({ ...ctx.select, knowing: knowingAt(ctx) }, steps.slice(0, cut));
    const set = new Set(ids);
    const cards = ctx.cards.filter((c) => set.has(entityOfCard(c)));
    const conditions = steps.slice(cut).map((s) => readCondition(s.config.when)).filter((c): c is Condition => c !== null);
    if (conditions.length === 0) return out(cards);
    return { cards: { cards, when: new Map(cards.map((c) => [c.key, [conditions]])) } satisfies CardFlow };
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
        const state = stateOf(marks);
        if (state !== null && state.at + state.interval > ctx.now) return false;
      }
      return true;
    });
    return { cards: { cards, when: flow.when } satisfies CardFlow };
  }
};

/**
 * EIN SCHRITT DER AUSWAHL über die Einträge der Karten (2026-10-22, Schritt 9): „Filtr wpisów" behält die Karten,
 * deren Eintrag die Regel erfüllt; „Idź po…" nimmt die Karten der erreichten Einträge (aus allen Karten) — mit
 * „Zostaw też wyjściowe" (`keep`) dazu die, von denen er ausging (mit ihren Bedingungen). „Idź po kolejności nauki"
 * geht von allem aus, was eine Karte prüft (ein Pytanie auch von „O czym"), und nimmt jede Karte über das Erreichte.
 */
function throughEntities(ctx: RevisionContext, flow: CardFlow, step: Step): CardFlow {
  if (ctx.select === undefined) return flow;
  if (step.type === 'filter.rule') {
    const kept = pick(ctx.select, step, new Set(flow.cards.map(entityOfCard)));
    return { cards: flow.cards.filter((c) => kept.has(entityOfCard(c))), when: flow.when };
  }
  const learning = step.type === 'learning';
  const input = new Set(learning ? flow.cards.flatMap(cardEntities) : flow.cards.map(entityOfCard));
  const reached = pick(ctx.select, { type: step.type, config: { ...step.config, keep: false } }, input);
  const fresh = ctx.cards.filter((c) => (learning ? cardEntities(c).some((id) => reached.has(id)) : reached.has(entityOfCard(c))));
  return step.config.keep === true ? merge([flow, { cards: fresh, when: NO_WHEN }]) : { cards: fresh, when: NO_WHEN };
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

/* 2026-10-30 — die Grundlagen dazu: was vorher zu können ist (die frühere Hälfte „holt Grundlagen" von „Najpierw podstawy"). */
const LEARNING: Kind = {
  type: 'learning', label: STEP_WORDS.learning.label, group: 'Zawężenie',
  says: `${STEP_WORDS.learning.says} Daje karty tamtych wpisów; „Zostaw też wyjściowe” dokłada je do kart, od których wyszedł (np. powtórka o orbitalach zaczyna się od atomu).`,
  ports: () => ({ inputs: [port('cards', 'Karty', true)], outputs: [port('cards', 'Karty')] }),
  run: ({ config, inputs, ctx }) => ({ cards: throughEntities(ctx, merge(flowsAt(inputs, 'cards')), { type: 'learning', config }) })
};

const FILTER_RULE: Kind = {
  type: 'filter.rule', label: 'Filtr wpisów', group: 'Zawężenie',
  says: `${STEP_WORDS['filter.rule'].says} Zostają karty tych wpisów.`,
  ports: () => ({ inputs: [port('cards', 'Karty', true)], outputs: [port('cards', 'Karty')] }),
  run: ({ config, inputs, ctx }) => ({ cards: throughEntities(ctx, merge(flowsAt(inputs, 'cards')), { type: 'filter.rule', config }) })
};

/** 2026-10-30 — DIE BEDINGUNG geht mit den Karten zum „Sposób pytania" und gilt im Lauf (die Kenntnis von jetzt). */
const FILTER_WHEN: Kind = {
  type: 'filter.when', label: STEP_WORDS['filter.when'].label, group: 'Zawężenie',
  says: `${STEP_WORDS['filter.when'].says} W powtórce sprawdza się w trakcie, przy każdej karcie: co wcześniej czekało, wchodzi, gdy warunek zacznie obowiązywać; karta już w stosie zostaje.`,
  ports: () => ({ inputs: [port('cards', 'Karty', true)], outputs: [port('cards', 'Karty')] }),
  run: ({ config, inputs }) => {
    const flow = merge(flowsAt(inputs, 'cards'));
    const condition = readCondition(config.when);
    if (condition === null) return { cards: flow };
    const when = new Map<string, Alternatives>();
    for (const card of flow.cards) when.set(card.key, (flow.when.get(card.key) ?? [[]]).map((all) => [...all, condition]));
    return { cards: { cards: flow.cards, when } satisfies CardFlow };
  }
};

const UNION: Kind = {
  type: 'union', label: 'Razem', group: 'Zawężenie',
  says: 'Łączy kilka źródeł w jeden stos, bez powtórzeń.',
  ports: () => ({ inputs: [port('cards', 'Karty', true)], outputs: [port('cards', 'Karty')] }),
  run: ({ inputs }) => ({ cards: merge(flowsAt(inputs, 'cards')) })
};

export const MODES = ['random', 'once', 'levels', 'temporal'] as const;
export type Mode = (typeof MODES)[number];

export const MODE_LABEL: Record<Mode, string> = {
  random: 'Losowo, określona liczba',
  once: 'Cały stos, każda raz',
  levels: 'Poziomy',
  temporal: 'Według tego, co umiem'
};

/** 2026-10-30 — w jakiej kolejności: stała lista, każda do wyjaśnienia uczącemu się. */
export const ORDERS = ['general', 'text', 'date', 'random', 'given', 'due'] as const;
export type Order = (typeof ORDERS)[number];

export const ORDER_LABEL: Record<Order, string> = {
  general: 'najpierw ogólne, potem szczegóły',
  text: 'jak w tekście źródła',
  date: 'według daty',
  random: 'losowo',
  given: 'jak przychodzą',
  due: 'najpierw zaległe'
};

/** 2026-10-30 — którą kartę ze stosu: ściśle następną albo losowo, częściej słabsze i dłużej czekające. */
export const PICKS = ['next', 'weighted'] as const;
export type PickMode = (typeof PICKS)[number];

export const PICK_LABEL: Record<PickMode, string> = {
  next: 'ściśle następna',
  weighted: 'losowo, częściej słabiej znane i dłużej czekające'
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
  /** 2026-10-30 — kolejność (w stosie: kolejność nowych kart). */
  readonly order: Order;
  /** 2026-10-30 — wybór ze stosu. */
  readonly pick: PickMode;
  /** 2026-10-30 — warunki kart (z „Filtra znajomości") z rozwiązanymi relacjami — liczą się także bez internetu. */
  readonly when?: Readonly<Record<string, CardGate>>;
  /** 2026-10-30 — miejsce karty dla „jak w tekście” i „według daty” (liczone przy planowaniu). */
  readonly rank?: Readonly<Record<string, number>>;
  /** Co powtórka zmienia w surowości szablonu [D5]. */
  readonly rule?: Partial<TextRule>;
}

/** Die Einstellung eines „Sposób pytania" — ohne Kolejność: im Stapel das Allgemeine zuerst, sonst zufällig (wie bisher). */
export function readPlan(cards: readonly Card[], config: Readonly<Record<string, unknown>>, extra: { readonly when?: Readonly<Record<string, CardGate>>; readonly rank?: Readonly<Record<string, number>> } = {}): Plan {
  const mode = (MODES as readonly string[]).includes(str(config.mode)) ? (str(config.mode) as Mode) : 'temporal';
  const order: Order = (ORDERS as readonly string[]).includes(str(config.order)) ? (str(config.order) as Order) : mode === 'levels' || mode === 'temporal' ? 'general' : 'random';
  const pickMode: PickMode = config.pick === 'next' ? 'next' : 'weighted';
  const rule = isObject(config.rule) ? (config.rule as Partial<TextRule>) : undefined;
  const when = extra.when ?? (isObject(config.when) ? (config.when as Record<string, CardGate>) : undefined);
  const rank = extra.rank ?? (isObject(config.rank) ? (config.rank as Record<string, number>) : undefined);
  return {
    cards,
    mode,
    count: Math.max(1, Math.round(num(config.count, 20))),
    stackSize: Math.max(1, Math.round(num(config.stackSize, 20))),
    levels: Math.max(1, Math.min(20, Math.round(num(config.levels, 5)))),
    minCorrectness: Math.max(0, Math.min(1, num(config.minCorrectness, 1))),
    order,
    pick: pickMode,
    ...(when === undefined || Object.keys(when).length === 0 ? {} : { when }),
    ...(rank === undefined ? {} : { rank }),
    ...(rule !== undefined ? { rule } : {})
  };
}

const NO_LOOK: Lookup = { kind: () => undefined, entity: () => undefined };

/** Woraus die Beziehungen beim Planen kommen: die Einträge, die Reihenfolge des Lernens, welche Einträge Karten haben. */
function relSourceFor(ctx: RevisionContext): RelSource {
  const askable = new Set(ctx.cards.flatMap(cardEntities));
  return {
    entity: ctx.select?.entity ?? (() => undefined),
    look: ctx.select?.look ?? NO_LOOK,
    ...(ctx.select === undefined ? {} : { pointing: ctx.select.pointing }),
    graph: prerequisiteGraph(ctx.deps ?? []),
    askable: (id) => askable.has(id),
    cardsOf: (id) => ctx.cards.filter((c) => cardEntities(c).includes(id)).map((c) => c.key)
  };
}

/** Ein Datum als Zahl (Jahre, Monate, Tage) — vor Chr. negativ. */
function yearsOf(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v !== 'string') return null;
  const m = /^\s*(-?\d{1,6})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(v);
  if (m === null) return null;
  return Number(m[1]) + (m[2] === undefined ? 0 : (Number(m[2]) - 1) / 12) + (m[3] === undefined ? 0 : (Number(m[3]) - 1) / 372);
}

/** Das früheste Datum eines Eintrags: aus seinen Feldern „data" und „zakres dat". */
function dateOf(entity: Entity | undefined, look: Lookup): number | null {
  if (entity === undefined) return null;
  let best: number | null = null;
  const take = (n: number | null) => { if (n !== null && (best === null || n < best)) best = n; };
  for (const f of fieldsOf(entity, look)) {
    if (f.type !== 'date' && f.type !== 'range') continue;
    for (const v of valuesOf(entity, f)) {
      if (f.type === 'date') { take(yearsOf(v.value)); continue; }
      const segments = isObject(v.value) && Array.isArray(v.value.segments) ? v.value.segments : [];
      for (const s of segments) if (isObject(s)) take(yearsOf(s.from));
    }
  }
  return best;
}

/** Der Platz jeder Karte für „jak w tekście" (die Stelle im Werk) und „według daty". */
function ranksFor(cards: readonly Card[], order: 'text' | 'date', ctx: RevisionContext): Record<string, number> {
  const look = ctx.select?.look ?? NO_LOOK;
  const entity = ctx.select?.entity ?? (() => undefined);
  const ids = [...new Set(cards.map(entityOfCard))];
  const at = new Map<string, number>();
  if (order === 'text') {
    orderByPlace(ids.map((id) => ({ id })), { entity, look }, { label: (e) => labelOf(e, look) }).forEach((id, i) => at.set(id, i));
  } else {
    const dated = ids.map((id, i) => ({ id, d: dateOf(entity(id), look), i }));
    dated.sort((a, b) => (a.d === null ? 1 : 0) - (b.d === null ? 1 : 0) || (a.d ?? 0) - (b.d ?? 0) || a.i - b.i).forEach((x, i) => at.set(x.id, i));
  }
  const out: Record<string, number> = {};
  for (const c of cards) out[c.key] = at.get(entityOfCard(c)) ?? Number.MAX_SAFE_INTEGER;
  return out;
}

const STRATEGY: Kind = {
  type: 'strategy', label: 'Sposób pytania', group: 'Sposób',
  says: 'Jak pytać: losowo określoną liczbę, cały stos raz, poziomami albo według tego, co już umiem — w jakiej kolejności (najpierw ogólne, jak w tekście, według daty, losowo, jak przychodzą, najpierw zaległe) i jak wybierać ze stosu (ściśle następną albo losowo, częściej słabsze).',
  ports: () => ({ inputs: [port('cards', 'Karty', true)], outputs: [port('plan', 'Plan', false, 'plan')] }),
  run: ({ config, inputs, ctx }) => {
    const flow = merge(flowsAt(inputs, 'cards'));
    /* Bedingungen und Ränge kommen aus dem Graphen, nie aus der Einstellung des Knotens. */
    const own = { ...config, when: undefined, rank: undefined };
    const base = readPlan(flow.cards, own);
    let when: Record<string, CardGate> | undefined;
    if (flow.when.size > 0) {
      const src = relSourceFor(ctx);
      when = {};
      for (const card of flow.cards) {
        const alts = flow.when.get(card.key);
        if (alts !== undefined) when[card.key] = gateFor(card, alts, src);
      }
    }
    const rank = base.order === 'text' || base.order === 'date' ? ranksFor(flow.cards, base.order, ctx) : undefined;
    return { plan: readPlan(flow.cards, own, { ...(when === undefined ? {} : { when }), ...(rank === undefined ? {} : { rank }) }) };
  }
};

export const REVISION_PALETTE = paletteOf<RevisionContext>('revision', [ALL, BY_KIND, BY_COLLECTION, BY_LIST, BY_FROM, BY_VIEW, FILTER, FOLLOW, STRUCTURE, LEARNING, FILTER_RULE, FILTER_WHEN, UNION, STRATEGY]);

/**
 * 2026-10-30 — EIN ALTER KNOTEN „Najpierw podstawy" (`gate`) aus den allgemeinen Schritten, die dasselbe tun: „Idź po
 * kolejności nauki" (die Grundlagen dazu, ausser mit `"pull": false`), „Filtr znajomości" (was vorher kommt, sitzt
 * ab dem Schwellenwert) — und im „Sposób pytania" das Allgemeine zuerst (ausser „jak przychodzą"). Beim Lesen, im
 * Editor, beim Import und Export: gespeichert wird die neue Gestalt.
 */
export function migrateRevision(graph: Graph): Graph {
  const gates = graph.nodes.filter((n) => n.type === 'gate');
  if (gates.length === 0) return graph;
  let nodes: GraphNode[] = graph.nodes.filter((n) => n.type !== 'gate');
  let edges: GraphEdge[] = [...graph.edges];
  for (const g of gates) {
    const pull = g.config.pull !== false;
    const whenId = `${g.id}-znajomosc`;
    const learnId = `${g.id}-podstawy`;
    if (pull) nodes = nodes.map((n) => (n.x > g.x ? { ...n, x: n.x + 230 } : n));
    const condition = { type: 'knowness', rel: 'before', op: 'ge', than: Math.max(0, num(g.config.threshold, KNOWN)) };
    nodes.push(...(pull ? [{ id: learnId, type: 'learning', x: g.x, y: g.y, config: { dir: 'before', keep: true } }] : []),
      { id: whenId, type: 'filter.when', x: g.x + (pull ? 230 : 0), y: g.y, config: { when: condition } });
    edges = edges.map((e) => (e.to === g.id ? { ...e, to: pull ? learnId : whenId } : e.from === g.id ? { ...e, from: whenId } : e));
    if (pull) edges.push({ id: `${g.id}-e`, from: learnId, out: 'cards', to: whenId, in: 'cards' });
  }
  nodes = nodes.map((n) => (n.type === 'strategy' && n.config.order !== 'given' ? { ...n, config: { ...n.config, order: 'general' } } : n));
  return { ...graph, nodes, edges };
}

/** Der Plan einer Wiederholung aus ihrem Graphen — genau ein „Sposób pytania". */
export async function planOf(raw: Graph, ctx: RevisionContext): Promise<{ plan: Plan | null; problems: string[] }> {
  const graph = migrateRevision(raw);
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

/** 2026-10-30 — WARUM DIESE KARTE: was der Lernende darüber lesen kann (`whyText`). */
export interface Why {
  /** queue — die nächste der festen Folge; fresh — neu; weak — sie verwischt (oder war fällig); again — eben falsch. */
  readonly reason: 'queue' | 'fresh' | 'weak' | 'again';
  readonly order: Order;
  readonly pick: PickMode;
  /** Die Ebene der Kolejność nauki (0 = podstawy) — nur bei „najpierw ogólne" in einer Baza mit einer Reihenfolge. */
  readonly level: number | null;
  /** Wie gut die Karte sass, als sie gewählt wurde — `null`: nie gefragt. */
  readonly knowness: number | null;
  readonly due: number | null;
  /** Unter wie vielen sie gewählt wurde. */
  readonly among: number;
}

export interface Session {
  readonly plan: Plan;
  readonly seed: string;
  /** Wie viele Antworten dieser Lauf schon hat. */
  readonly step: number;
  /** Die Folge (`random`, `once`). */
  readonly queue: readonly string[];
  /** Der Stapel (`levels`, `temporal`). */
  readonly active: readonly string[];
  readonly asked: ReadonlySet<string>;
  readonly levels: ReadonlyMap<string, number>;
  readonly wrongSinceCorrect: ReadonlySet<string>;
  /** 2026-10-30 — der Zustand der in diesem Lauf beantworteten Karten, Schritt für Schritt nachgeführt. */
  readonly states: ReadonlyMap<string, CardState>;
  /** Die Karte, die gerade gefragt wird — `null`: fertig. */
  readonly current: string | null;
  /** 2026-10-30 — warum gerade sie. */
  readonly why: Why | null;
}

export interface Start {
  readonly plan: Plan;
  /** Alle Karten — die Kenntnis eines Eintrags rechnet über alle seine Karten, nicht nur die des Plans. */
  readonly all: readonly Card[];
  readonly marks: (key: string) => readonly Mark[];
  readonly deps: readonly Dependency[];
  readonly now: number;
  readonly seed: string;
  /** Stufen aus früheren Läufen (`levels`). */
  readonly levelsBefore?: ReadonlyMap<string, number>;
}

interface Internal extends Session {
  readonly all: readonly Card[];
  readonly fallback: (key: string) => readonly Mark[];
  readonly deps: readonly Dependency[];
  /** Die Reihenfolge des Lernens als Graph: die Ebenen für „najpierw ogólne". */
  readonly graph: PrerequisiteGraph;
  /** Gerechnetes, das sich im Lauf nicht ändert: die Karten des Plans (ohne doppelte), ihre Stelle, Ebene und der Zufall je Karte. */
  readonly fixed: Fixed;
}

interface Fixed {
  readonly unique: readonly Card[];
  readonly byKey: ReadonlyMap<string, Card>;
  readonly index: ReadonlyMap<string, number>;
  readonly level: (key: string) => number;
  readonly tie: (key: string) => number;
  /** Der Zustand aus den gespeicherten Antworten, einmal je Karte abgespielt. */
  readonly stored: Map<string, CardState | null>;
}

const rngAt = (seed: string, step: number) => rngOf(`${seed}#${step}`);

/** Der Zustand einer Karte jetzt: aus diesem Lauf — sonst aus den gespeicherten Antworten. */
function stateIn(s: Internal, key: string): CardState | null {
  const own = s.states.get(key);
  if (own !== undefined) return own;
  if (!s.fixed.stored.has(key)) s.fixed.stored.set(key, stateOf(s.fallback(key)));
  return s.fixed.stored.get(key) ?? null;
}

const gaugeIn = (s: Internal, now: number): Gauge => gauge(s.all, (key) => stateIn(s, key), s.deps, now, s.graph);

/** Was jetzt in Frage kommt: die Karten des Plans, deren Bedingungen gelten. */
function eligible(s: Internal, now: number): Card[] {
  const when = s.plan.when;
  if (when === undefined) return [...s.fixed.unique];
  const g = gaugeIn(s, now);
  return s.fixed.unique.filter((c) => { const gate = when[c.key]; return gate === undefined || gateHolds(gate, g); });
}

const cmp = (a: number, b: number): number => (a === b ? 0 : a < b ? -1 : 1);

/** Der Rang einer Karte in der gewählten Kolejność (kleiner zuerst), mit dem Gleichstand dahinter. */
function rankOf(s: Internal, key: string, now: number): readonly [number, number] {
  const f = s.fixed;
  const index = f.index.get(key) ?? Number.MAX_SAFE_INTEGER;
  switch (s.plan.order) {
    case 'general': return [f.level(key), f.tie(key)];
    case 'text':
    case 'date': return [s.plan.rank?.[key] ?? Number.MAX_SAFE_INTEGER, index];
    case 'due': { const st = stateIn(s, key); return [st === null ? Number.NEGATIVE_INFINITY : st.at + st.interval - now, index]; }
    case 'random': return [f.tie(key), index];
    default: return [index, 0];
  }
}

function ordered(s: Internal, keys: readonly string[], now: number): string[] {
  const ranked = keys.map((key) => ({ key, r: rankOf(s, key, now) }));
  ranked.sort((a, b) => cmp(a.r[0], b.r[0]) || cmp(a.r[1], b.r[1]));
  return ranked.map((x) => x.key);
}

/** Füllt den Stapel nach der Kenntnis: erst was unter 1 liegt (das Schwächste zuerst), dann das nie Gefragte in der Kolejność. */
function fillTemporal(s: Internal, active: readonly string[], now: number): string[] {
  const out = active.slice();
  const taken = new Set(out);
  const weak: { key: string; k: number; r: readonly [number, number] }[] = [];
  const fresh: string[] = [];
  for (const card of eligible(s, now)) {
    if (taken.has(card.key)) continue;
    const st = stateIn(s, card.key);
    if (st === null) { fresh.push(card.key); continue; }
    const k = knownessAt(st, now);
    if (k < KNOWN) weak.push({ key: card.key, k, r: rankOf(s, card.key, now) });
  }
  weak.sort((a, b) => a.k - b.k || cmp(a.r[0], b.r[0]) || cmp(a.r[1], b.r[1]));
  for (const one of [...weak.map((w) => w.key), ...ordered(s, fresh, now)]) {
    if (out.length >= s.plan.stackSize) break;
    out.push(one);
  }
  return out;
}

/**
 * Füllt den Stapel nach Stufen: die niedrigste zuerst, bei gleicher Stufe das noch nicht Gefragte, dann die
 * Kolejność. Was in DIESEM Lauf die höchste Stufe erreicht hat, kommt nicht zurück — so endet ein Lauf.
 */
function fillLevels(s: Internal, active: readonly string[], levels: ReadonlyMap<string, number>, asked: ReadonlySet<string>, now: number): string[] {
  const out = active.slice();
  const taken = new Set(out);
  const pool = eligible(s, now).filter((c) => !taken.has(c.key) && !(asked.has(c.key) && (levels.get(c.key) ?? 1) >= s.plan.levels));
  const ranked = pool
    .map((c) => ({ key: c.key, level: levels.get(c.key) ?? 1, asked: asked.has(c.key) ? 1 : 0, r: rankOf(s, c.key, now) }))
    .sort((a, b) => a.level - b.level || a.asked - b.asked || cmp(a.r[0], b.r[0]) || cmp(a.r[1], b.r[1]));
  for (const one of ranked) {
    if (out.length >= s.plan.stackSize) break;
    out.push(one.key);
  }
  return out;
}

const DAY = 86_400_000;

/** Wie stark eine Karte im Stapel zieht: was schwächer sitzt und länger wartet, öfter; neu wie halb gekonnt. */
function weightOf(s: Internal, key: string, now: number): number {
  const st = stateIn(s, key);
  if (st === null) return 1.5;
  const overdue = Math.max(0, now - (st.at + st.interval)) / DAY;
  return 0.5 + 2 * (1 - shareOf(knownessAt(st, now))) + Math.min(2, overdue);
}

/**
 * Die nächste Karte aus dem Stapel — nicht dieselbe wie eben, wenn es eine andere gibt. Bei „najpierw ogólne" kommen
 * NEUE Karten nur aus der niedrigsten Ebene, auf der im Stapel noch neue liegen; schon gefragte (was falsch war, was
 * sich verwischt) stehen daneben — sonst hielte eine allgemeine Karte, die nicht sitzen will, alles Freigegebene
 * dahinter für immer auf. Dann streng die nächste nach der Kolejność — oder zufällig, gewogen.
 */
function pickFrom(s: Internal, active: readonly string[], previous: string | null, now: number, rng: () => number): { key: string | null; among: number } {
  if (active.length === 0) return { key: null, among: 0 };
  const others = active.filter((k) => k !== previous);
  let from = others.length > 0 ? others : active.slice();
  if (s.plan.order === 'general' && s.graph.edges.length > 0) {
    const fresh = from.filter((k) => stateIn(s, k) === null);
    if (fresh.length > 0) {
      const low = Math.min(...fresh.map(s.fixed.level));
      from = from.filter((k) => stateIn(s, k) !== null || s.fixed.level(k) === low);
    }
  }
  if (s.plan.pick === 'next') return { key: s.plan.order === 'random' ? from[0] : ordered(s, from, now)[0], among: from.length };
  const weights = from.map((k) => weightOf(s, k, now));
  let r = rng() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < from.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return { key: from[i], among: from.length };
  }
  return { key: from[from.length - 1], among: from.length };
}

function whyOf(s: Internal, key: string | null, among: number, now: number, queue: boolean): Why | null {
  if (key === null) return null;
  const st = stateIn(s, key);
  const reason: Why['reason'] = queue ? 'queue' : s.wrongSinceCorrect.has(key) ? 'again' : st === null ? 'fresh' : 'weak';
  return {
    reason, order: s.plan.order, pick: s.plan.pick,
    level: s.plan.order === 'general' && s.graph.edges.length > 0 ? s.fixed.level(key) : null,
    knowness: st === null ? null : knownessAt(st, now),
    due: st === null ? null : st.at + st.interval,
    among
  };
}

const seal = (s: Internal): Session => s;

export function start(input: Start): Session {
  const graph = prerequisiteGraph(input.deps);
  const unique = input.plan.cards.filter((c, i, all) => all.findIndex((o) => o.key === c.key) === i);
  const byKey = new Map<string, Card>();
  for (const c of [...unique, ...input.all]) if (!byKey.has(c.key)) byKey.set(c.key, c);
  const levelMemo = new Map<string, number>();
  const tieMemo = new Map<string, number>();
  const fixed: Fixed = {
    unique, byKey,
    index: new Map(unique.map((c, i) => [c.key, i])),
    level: (key) => {
      let at = levelMemo.get(key);
      if (at === undefined) { const c = byKey.get(key); at = c === undefined ? 0 : cardLevel(c, graph); levelMemo.set(key, at); }
      return at;
    },
    tie: (key) => {
      let t = tieMemo.get(key);
      if (t === undefined) { t = parseInt(hashOf(`${input.seed}|${key}`), 16) / 4294967296; tieMemo.set(key, t); }
      return t;
    },
    stored: new Map()
  };
  const base: Internal = {
    plan: input.plan, seed: input.seed, step: 0, queue: [], active: [], asked: new Set(),
    levels: new Map(input.levelsBefore ?? []), wrongSinceCorrect: new Set(), states: new Map(), current: null, why: null,
    all: input.all, fallback: input.marks, deps: input.deps, graph, fixed
  };
  const rng = rngAt(input.seed, 0);

  if (input.plan.mode === 'random' || input.plan.mode === 'once') {
    const keys = ordered(base, eligible(base, input.now).map((c) => c.key), input.now);
    const queue = input.plan.mode === 'random' ? keys.slice(0, input.plan.count) : keys;
    const first = queue[0] ?? null;
    return seal({ ...base, queue: queue.slice(1), current: first, why: whyOf(base, first, queue.length, input.now, true) });
  }

  const active = input.plan.mode === 'levels'
    ? fillLevels(base, [], base.levels, base.asked, input.now)
    : fillTemporal(base, [], input.now);
  const next = pickFrom(base, active, null, input.now, rng);
  return seal({ ...base, active, current: next.key, why: whyOf(base, next.key, next.among, input.now, false) });
}

export interface Answered {
  readonly session: Session;
  /** Was für die beantwortete Karte gespeichert wird (COGITA.md §7). */
  readonly snapshot: Snapshot | null;
}

/**
 * EINE ANTWORT auf die aktuelle Karte. `correctness` ist die Teilrichtigkeit der Prüfung (0–1); als „richtig" für die
 * Stufen und den Stapel gilt sie ab `plan.minCorrectness`. Der Zustand der Karte geht EINEN Schritt weiter.
 */
export function answer(session: Session, correctness: number, at: number): Answered {
  const s = session as Internal;
  const key = s.current;
  if (key === null) return { session, snapshot: null };
  const card = s.fixed.byKey.get(key);
  const q = Math.max(0, Math.min(1, correctness));
  const state = step(stateIn(s, key), { at, correctness: q });
  const states = new Map(s.states);
  states.set(key, state);
  const asked = new Set(s.asked);
  asked.add(key);
  const stepNo = s.step + 1;
  const rng = rngAt(s.seed, stepNo);
  const snapshot = card === undefined ? null : snapshotOfState(card.question, card.direction, state, at);
  const good = q >= s.plan.minCorrectness - 1e-9;
  const wrong = new Set(s.wrongSinceCorrect);
  if (good) wrong.delete(key); else wrong.add(key);
  const next: Internal = { ...s, step: stepNo, states, asked, wrongSinceCorrect: wrong };

  if (s.plan.mode === 'random') {
    const first = s.queue[0] ?? null;
    return { session: seal({ ...next, current: first, queue: s.queue.slice(1), why: whyOf(next, first, s.queue.length, at, true) }), snapshot };
  }
  if (s.plan.mode === 'once') {
    /* Was inzwischen in Frage kommt (eine Bedingung gilt jetzt), reiht sich nach der Kolejność ein. */
    const queued = new Set(s.queue);
    const fresh = s.plan.when === undefined ? [] : eligible(next, at).map((c) => c.key).filter((k) => !asked.has(k) && !queued.has(k));
    const queue = fresh.length === 0 ? s.queue : ordered(next, [...s.queue, ...fresh], at);
    const first = queue[0] ?? null;
    return { session: seal({ ...next, current: first, queue: queue.slice(1), why: whyOf(next, first, queue.length, at, true) }), snapshot };
  }

  if (s.plan.mode === 'levels') {
    const levels = new Map(s.levels);
    const level = levels.get(key) ?? 1;
    levels.set(key, good ? (s.wrongSinceCorrect.has(key) ? 1 : Math.min(level + 1, s.plan.levels)) : 1);
    const kept = good ? s.active.filter((k) => k !== key) : s.active.slice();
    const done: Internal = { ...next, levels };
    const active = good ? fillLevels(done, kept, levels, asked, at) : kept;
    const chosen = pickFrom(done, active, key, at, rng);
    return { session: seal({ ...done, active, current: chosen.key, why: whyOf(done, chosen.key, chosen.among, at, false) }), snapshot };
  }

  /*
   * Nach dem Lauf entscheidet die Antwort selbst: was falsch war, bleibt im Stapel und kommt wieder; was richtig war,
   * geht und kommt zurück, wenn seine Kenntnis unter 1 gefallen ist. Neu Freigegebenes füllt den Platz.
   */
  const kept = good ? s.active.filter((k) => k !== key) : s.active.slice();
  const active = fillTemporal(next, kept, at);
  const chosen = pickFrom(next, active, key, at, rng);
  return { session: seal({ ...next, active, current: chosen.key, why: whyOf(next, chosen.key, chosen.among, at, false) }), snapshot };
}

/** Eine Dauer, kurz: „5 min", „3 h", „2 dni". */
function span(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} dni`;
}

const ORDER_WHY: Record<Order, string> = {
  general: 'najpierw ogólne, potem szczegóły',
  text: 'w kolejności tekstu źródła',
  date: 'według daty',
  random: 'w losowej kolejności',
  given: 'w kolejności wyboru powtórki',
  due: 'najpierw te, na które przyszła pora'
};

/**
 * 2026-10-31 — WARUM DIESE KARTE, kurz und menschlich (unter der Karte): „Nowa karta · poziom 2". Die ganze Erklärung —
 * nach welcher Ordnung, unter wie vielen, wie lange überfällig — gibt `whyDetail` (als Hinweis daneben).
 */
export function whyText(why: Why, _now: number): string {
  const level = why.level === null ? '' : ` · poziom ${why.level + 1}${why.level === 0 ? ' (podstawy)' : ''}`;
  switch (why.reason) {
    case 'queue': return `Kolejna karta${level}`;
    case 'fresh': return `Nowa karta${level}`;
    case 'again': return 'Wraca — przed chwilą była źle';
    default: return `Wraca — zaciera się (znajomość ${Math.round(shareOf(why.knowness ?? 0) * 100)} %)`;
  }
}

/** 2026-10-30 — WARUM DIESE KARTE, ganz: die Ordnung, die Ebene, unter wie vielen, wie lange überfällig. */
export function whyDetail(why: Why, now: number): string {
  const level = why.level === null ? '' : ` (poziom ${why.level + 1}${why.level === 0 ? ' — podstawy' : ''})`;
  const pickText = why.reason === 'queue' || why.among <= 1 ? ''
    : why.pick === 'weighted' ? ` Wybrana losowo spośród ${why.among} w stosie — częściej to, co słabiej znasz i co dłużej czeka.`
    : ` Następna spośród ${why.among} w stosie.`;
  switch (why.reason) {
    case 'queue': return `Kolejna karta — ${ORDER_WHY[why.order]}${level}.`;
    case 'fresh': return `Nowa karta — ${ORDER_WHY[why.order]}${level}.${pickText}`;
    case 'again': return `Wraca, bo przed chwilą była źle — aż odpowiesz dobrze.${pickText}`;
    default: {
      const k = why.knowness ?? 0;
      const late = why.due !== null && why.due <= now ? `; pora minęła ${span(now - why.due)} temu` : '';
      return `Wraca, bo się zaciera: znajomość ${Math.round(shareOf(k) * 100)} %${late}.${pickText}`;
    }
  }
}

/**
 * 2026-10-30 — WAS NOCH WARTET: Karten des Plans, die nicht gefragt wurden, weil ihre Bedingung (noch) nicht gilt —
 * die Einträge, die zuerst sitzen müssen (das Häufigste zuerst), und die übrigen Bedingungen. Für das Ende eines Laufs.
 */
export function waiting(session: Session, now: number): { readonly cards: number; readonly needs: readonly string[]; readonly conditions: readonly Condition[] } {
  const s = session as Internal;
  const when = s.plan.when;
  if (when === undefined) return { cards: 0, needs: [], conditions: [] };
  const g = gaugeIn(s, now);
  const count = new Map<string, number>();
  const conditions = new Map<string, Condition>();
  const shown = new Set([...s.active, ...s.queue, ...(s.current === null ? [] : [s.current])]);
  let cards = 0;
  for (const card of s.fixed.unique) {
    const gate = when[card.key];
    if (gate === undefined || s.asked.has(card.key) || shown.has(card.key) || gateHolds(gate, g)) continue;
    cards += 1;
    const by = waitsFor(gate, g);
    for (const id of by.ids) if (!id.startsWith(CARD_REF)) count.set(id, (count.get(id) ?? 0) + 1);
    for (const c of by.conditions) conditions.set(JSON.stringify(c), c);
  }
  return { cards, needs: [...count].sort((a, b) => b[1] - a[1]).map(([id]) => id), conditions: [...conditions.values()] };
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
