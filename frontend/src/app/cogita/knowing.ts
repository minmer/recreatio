/**
 * COGITA — WAS DER LERNENDE KANN, für Widoki und Powtórki (2026-10-30, COGITA.md §6).
 *
 * <b>Die Kenntnis gehört dem Eintrag; eine Karte ist ein Zeugnis.</b> Jede Karte sagt (aus ihrer Vorlage im Schema,
 * `Template.tests`), welche Einträge sie prüft und wie stark. Die Kenntnis eines Eintrags ist der gewogene Durchschnitt
 * der Kenntnis seiner BEANTWORTETEN Karten (eine nie gefragte Karte ist kein Zeugnis); dazu kommt, was auf ihm aufbaut
 * (A.3, `propagate` — die Richtung erklärt das Schema, gerechnet wird hier). Die Kenntnis jeder einzelnen Karte bleibt
 * daneben sichtbar und brauchbar.
 *
 * <b>Beziehungen</b> — wessen Kenntnis eine Bedingung prüft, gesehen von dem, was gerade geprüft wird (ein Eintrag in
 * einem Widok, eine Karte in einer Powtórka):
 * <code>
 *   self      der Eintrag selbst (bei einer Karte: ihr Eintrag)
 *   cards     seine Karten (bei einer Karte: sie selbst)
 *   before    was vorher zu können ist (Kolejność nauki, die nächsten mit Karten; bei einer Karte auch die Teile eines Zitats)
 *   up        worunter er in der Struktur liegt
 *   <pole>    worauf sein Verweisfeld zeigt (der Okres eines Fakts)
 * </code>
 * Die Bedingung selbst ist die der einen Logik (`logic.ts`, `rel`, `each`) — keine zweite Regelsprache.
 *
 * <b>In einer Powtórka</b> trägt jede Karte ihre Bedingungen samt den beim Planen aufgelösten Beziehungen (`CardGate`):
 * im Lauf — auch ohne Netz — braucht es dann nur noch die Kenntnis.
 */

import type { Card, CardTest } from './cardBasics';
import { knownessAt, propagate, stateOf, type CardState, type Dependency, type Mark } from './knowness';
import { holds, type Condition, type Facts } from './logic';
import { cardEntities, nearestNeeds, prerequisiteGraph, type PrerequisiteGraph } from './prerequisites';
import { fieldsOf, valuesOf, type Entity, type Lookup } from './schema';
import { parentsOf } from './structure';

/** Was eine Karte prüft, und wie stark — ohne Erklärung ihr Eintrag (und bei einem Pytanie „O czym") mit 1. */
export const cardTests = (card: Pick<Card, 'entity' | 'question' | 'about' | 'tests'>): readonly CardTest[] =>
  card.tests ?? cardEntities(card).map((id) => ({ id, weight: 1 }));

/** Eine KARTE in Bedingungen und Beziehungen — ohne dieses Zeichen ist eine Kennung ein Eintrag. */
export const CARD_REF = '#';

/* -- Die Messung ------------------------------------------------------------------------------------------- */

export interface Gauge {
  readonly now: number;
  /** Je beantwortete Karte ihr Zustand (`knowness.ts`). */
  readonly states: ReadonlyMap<string, CardState>;
  /** Je Eintrag nur aus seinen Karten (gewogen; nur beantwortete zählen). */
  readonly own: ReadonlyMap<string, number>;
  /** Je Eintrag mit dem, was auf ihm aufbaut (A.3). */
  readonly totals: ReadonlyMap<string, number>;
  /** Die Karten, die einen Eintrag prüfen, mit ihrem Gewicht. */
  readonly testing: ReadonlyMap<string, readonly { readonly key: string; readonly weight: number }[]>;
  /** Einträge, über die eine Karte ist (ihr Eintrag, „O czym") — nur sie lassen warten. */
  readonly askable: ReadonlySet<string>;
  readonly graph: PrerequisiteGraph;
}

/**
 * DIE KENNTNIS ALLER KARTEN UND EINTRÄGE zu `now` — `state` gibt den Zustand einer Karte (aus ihren Antworten oder,
 * in einem Lauf, Schritt für Schritt nachgeführt).
 */
export function gauge(cards: readonly Card[], state: (key: string) => CardState | null, deps: readonly Dependency[], now: number, graph: PrerequisiteGraph = prerequisiteGraph(deps)): Gauge {
  const states = new Map<string, CardState>();
  const sums = new Map<string, { wk: number; w: number }>();
  const testing = new Map<string, { key: string; weight: number }[]>();
  const askable = new Set<string>();
  const seen = new Set<string>();
  for (const card of cards) {
    if (seen.has(card.key)) continue;
    seen.add(card.key);
    for (const id of cardEntities(card)) askable.add(id);
    const tests = cardTests(card).filter((t) => t.weight > 0);
    for (const t of tests) {
      const list = testing.get(t.id);
      if (list === undefined) testing.set(t.id, [{ key: card.key, weight: t.weight }]); else list.push({ key: card.key, weight: t.weight });
    }
    const st = state(card.key);
    if (st === null) continue;
    states.set(card.key, st);
    const k = knownessAt(st, now);
    for (const t of tests) {
      const sum = sums.get(t.id) ?? { wk: 0, w: 0 };
      sum.wk += t.weight * k;
      sum.w += t.weight;
      sums.set(t.id, sum);
    }
  }
  const own = new Map([...sums].map(([id, s]) => [id, s.w > 0 ? s.wk / s.w : 0]));
  return { now, states, own, totals: propagate(own, deps), testing, askable, graph };
}

/** Dasselbe aus den gespeicherten Antworten je Karte. */
export const gaugeFromMarks = (cards: readonly Card[], marks: (key: string) => readonly Mark[], deps: readonly Dependency[], now: number): Gauge =>
  gauge(cards, (key) => stateOf(marks(key)), deps, now);

/** Ohne Karten und Antworten — wer nichts gelernt hat. */
export const EMPTY_GAUGE: Gauge = { now: 0, states: new Map(), own: new Map(), totals: new Map(), testing: new Map(), askable: new Set(), graph: prerequisiteGraph([]) };

export const cardKnowness = (g: Gauge, key: string): number => knownessAt(g.states.get(key) ?? null, g.now);
export const itemKnowness = (g: Gauge, id: string): number => g.totals.get(id) ?? 0;
export const ownKnowness = (g: Gauge, id: string): number => g.own.get(id) ?? 0;

/** Wann eine Karte wieder dran ist — `null`: nie gefragt. */
export function cardDue(g: Gauge, key: string): number | null {
  const s = g.states.get(key);
  return s === undefined ? null : s.at + s.interval;
}

/** Wann ein Eintrag wieder dran ist: die früheste seiner beantworteten Karten — `null`: keine. */
export function itemDue(g: Gauge, id: string): number | null {
  let out: number | null = null;
  for (const { key } of g.testing.get(id) ?? []) {
    const due = cardDue(g, key);
    if (due !== null && (out === null || due < out)) out = due;
  }
  return out;
}

/** Wie gut etwas sitzt, für eine Bedingung: `#schlüssel` eine Karte, sonst ein Eintrag (oder, aus alten Abläufen, eine Karte). */
export function knownessIn(g: Gauge, id: string): number {
  if (id.startsWith(CARD_REF)) return cardKnowness(g, id.slice(CARD_REF.length));
  if (g.totals.has(id) || g.testing.has(id)) return itemKnowness(g, id);
  return cardKnowness(g, id);
}

/* -- Beziehungen ------------------------------------------------------------------------------------------- */

/** Was eine Beziehung braucht: die Einträge, ihre Struktur, die Reihenfolge des Lernens — und welche Karten es gibt. */
export interface RelSource {
  readonly entity: (id: string) => Entity | undefined;
  readonly look: Lookup;
  /** Wer auf einen Eintrag zeigt (für `up` über `down`-Felder). */
  readonly pointing?: (id: string) => ReadonlySet<string>;
  readonly graph: PrerequisiteGraph;
  /** Hat dieser Eintrag Karten über sich? Ein Eintrag ohne steht für das, was vor IHM kommt. */
  readonly askable: (id: string) => boolean;
  /** Die Karten eines Eintrags (Schlüssel). */
  readonly cardsOf: (id: string) => readonly string[];
}

/** Aus einer Messung (und der Baza) die Quelle der Beziehungen. */
export const relSourceOf = (g: Gauge, base: Pick<RelSource, 'entity' | 'look' | 'pointing'>, graph?: PrerequisiteGraph): RelSource => ({
  ...base,
  graph: graph ?? g.graph,
  /* Ohne Karten (noch nichts gerechnet) gilt jeder Eintrag als prüfbar: wer nichts weiss, dem fehlt das Vorherige. */
  askable: g.testing.size === 0 ? () => true : (id) => g.askable.has(id),
  cardsOf: (id) => (g.testing.get(id) ?? []).map((t) => t.key)
});

const refTargets = (entity: Entity | undefined, look: Lookup, key: string): string[] => {
  if (entity === undefined) return [];
  const field = fieldsOf(entity, look).find((f) => f.key === key && f.type === 'ref');
  if (field === undefined) return [];
  return valuesOf(entity, field).map((v) => v.value).filter((v): v is string => typeof v === 'string' && v !== '' && v !== entity.id);
};

const parents = (src: RelSource, id: string): string[] =>
  parentsOf(id, { entity: src.entity, look: src.look, pointing: src.pointing ?? (() => new Set<string>()) });

/** Was eine Beziehung für einen EINTRAG bedeutet (Widoki). */
export function itemRelated(src: RelSource, id: string, rel: string): string[] {
  switch (rel) {
    case 'self': return [id];
    case 'cards': return src.cardsOf(id).map((key) => `${CARD_REF}${key}`);
    case 'before': return nearestNeeds([id], src.graph, src.askable);
    case 'up': return parents(src, id);
    default: return refTargets(src.entity(id), src.look, rel);
  }
}

/** Was eine Beziehung für eine KARTE bedeutet (Powtórki): von ihrem Eintrag aus; `before` auch die Teile eines Zitats. */
export function cardRelated(src: RelSource, card: Card, rel: string): string[] {
  const main = card.entity ?? card.question;
  switch (rel) {
    case 'self': return [main];
    case 'cards': return [`${CARD_REF}${card.key}`];
    case 'before': return [...card.requires.map((key) => `${CARD_REF}${key}`), ...nearestNeeds(cardEntities(card), src.graph, src.askable)];
    case 'up': return parents(src, main);
    default: return refTargets(src.entity(main), src.look, rel);
  }
}

/** Welche Beziehungen eine Bedingung braucht. */
export function relsOf(c: Condition | null | undefined, out = new Set<string>()): Set<string> {
  if (c === null || c === undefined) return out;
  if (c.rel !== undefined) out.add(c.rel);
  for (const item of c.items ?? []) relsOf(item, out);
  return out;
}

/** Was eine Bedingung über den Lernenden weiss — mit den Beziehungen dessen, was geprüft wird. */
export function factsOf(g: Gauge, related: (rel: string) => readonly string[]): Facts {
  return {
    values: {},
    knowness: (id) => knownessIn(g, id),
    answered: (id) => {
      const st = g.states.get(id.startsWith(CARD_REF) ? id.slice(CARD_REF.length) : id);
      return st === undefined ? null : st.q;
    },
    visited: new Set(),
    now: new Date(g.now),
    related
  };
}

/** Gilt die Bedingung für diesen Eintrag? */
export const itemHolds = (c: Condition, g: Gauge, src: RelSource, id: string): boolean => holds(c, factsOf(g, (rel) => itemRelated(src, id, rel)));

/* -- Bedingungen je Karte (Powtórki) ------------------------------------------------------------------------- */

/**
 * DIE BEDINGUNGEN EINER KARTE: Alternativen (LUB, aus mehreren Wegen im Graphen), je eine Liste (I) — und was ihre
 * Beziehungen für diese Karte bedeuten, beim Planen aufgelöst.
 */
export interface CardGate {
  readonly any: readonly (readonly Condition[])[];
  readonly related: Readonly<Record<string, readonly string[]>>;
}

export function gateFor(card: Card, any: readonly (readonly Condition[])[], src: RelSource): CardGate {
  const rels = new Set<string>();
  for (const all of any) for (const c of all) relsOf(c, rels);
  const related: Record<string, readonly string[]> = {};
  for (const rel of rels) related[rel] = cardRelated(src, card, rel);
  return { any, related };
}

export function gateHolds(gate: CardGate, g: Gauge): boolean {
  const facts = factsOf(g, (rel) => gate.related[rel] ?? []);
  return gate.any.some((all) => all.every((c) => holds(c, facts)));
}

/**
 * WORAUF EINE KARTE WARTET: die Einträge (und Karten) einer Beziehung, die die Bedingung noch nicht erfüllen, und die
 * übrigen Bedingungen, die nicht gelten — aus der Alternative, der am wenigsten fehlt.
 */
export function waitsFor(gate: CardGate, g: Gauge): { readonly ids: readonly string[]; readonly conditions: readonly Condition[] } {
  const facts = factsOf(g, (rel) => gate.related[rel] ?? []);
  let best: { ids: string[]; conditions: Condition[] } | null = null;
  for (const all of gate.any) {
    const ids: string[] = [];
    const conditions: Condition[] = [];
    for (const c of all) {
      if (holds(c, facts)) continue;
      if (c.type === 'knowness' && c.rel !== undefined) {
        const one = { ...c, rel: undefined, each: undefined };
        const failing = (gate.related[c.rel] ?? []).filter((id) => !holds({ ...one, of: id }, facts));
        if (failing.length > 0) { ids.push(...failing); continue; }
      }
      conditions.push(c);
    }
    if (best === null || ids.length + conditions.length < best.ids.length + best.conditions.length) best = { ids, conditions };
  }
  return best ?? { ids: [], conditions: [] };
}
