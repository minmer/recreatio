/**
 * 2026-10-27 — DIE REIHENFOLGE DES LERNENS: was man zuerst können muss (COGITA.md §6).
 *
 * <b>Entschieden: erklärt im Schema, gerechnet im Code.</b> Der Besitzer erklärt in SEINEN
 * Rodzajen ein Verweisfeld als „Najpierw trzeba znać" (`FieldDef.prerequisite`): `up` — was es
 * nennt, kommt vorher (Orbital → Elektron, Atom); `down` — was es nennt, baut auf diesem auf. Das
 * eingebaute Pytanie hat ein solches Feld („Najpierw trzeba znać", `needs`) und erbt über „O czym"
 * die Voraussetzungen dessen, was es prüft. Die Kanten der Ustawienia (Zależności) gelten daneben.
 * Die MASCHINE macht daraus EINEN Graphen und tut überall dasselbe damit:
 * <code>
 *   Ebenen        Poziom 1 = Grundlagen (nichts davor); jede Ebene einen Schritt weiter
 *   Sperre        eine Karte kommt erst, wenn sitzt, was vor ihren Einträgen kommt
 *   Grundlagen    „Najpierw podstawy" holt die Karten fehlender Grundlagen dazu (`withBasics`)
 *   neue Karten   in der Reihenfolge der Ebenen, auch ohne Sperre (`cardLevel`)
 *   Kenntnis      wer das Spätere kann, hebt das Frühere (A.3, `propagate`)
 *   Ścieżka       die Ebenen mit dem, was sitzt und was wartet (Nauka, `LearningPath.tsx`)
 *   Kreise        eine Kante, die einen Kreis schlösse, fällt weg und steht in „Do zrobienia"
 * </code>
 * Nur ein eigener Graph, kein eigenes Speichern: alles ist aus den Einträgen gerechnet.
 *
 * <b>Ein Eintrag ohne Karten sperrt nicht</b> (ein „Dział", der nur ordnet): an seiner Stelle zählt,
 * was vor IHM kommt — sonst wartete alles dahinter für immer. Und <b>eine Karte wartet nie auf
 * etwas, das sie selbst prüft</b> (ein Pytanie über Atom UND Orbital wartet nicht auf Atom).
 */

import type { Card } from './cardBasics';
import { acyclic, average, type Dependency } from './knowness';
import { fieldsOf, valuesOf, type Entity, type FieldDef, type Lookup } from './schema';

/** Wie viel von der Kenntnis des Späteren an das Frühere geht (A.3) — wie bei einer neuen Kante in den Ustawienia. */
export const PREREQUISITE_IMPACT = 0.5;

/** Die Felder der Reihenfolge eines Eintrags — streng nach der Erklärung im Rodzaj, nie nach dem Schlüssel. */
export const prerequisiteFields = (entity: Entity, look: Pick<Lookup, 'kind'>): FieldDef[] =>
  fieldsOf(entity, look).filter((f) => f.type === 'ref' && (f.prerequisite === 'up' || f.prerequisite === 'down'));

const targets = (entity: Entity, field: FieldDef): string[] =>
  valuesOf(entity, field).map((v) => v.value).filter((v): v is string => typeof v === 'string' && v !== '' && v !== entity.id);

/** Die Kanten aus den Feldern: `parent` kommt zuerst, `child` baut darauf auf. */
export function fieldDependencies(entities: Iterable<Entity>, look: Pick<Lookup, 'kind'>): Dependency[] {
  const out = new Map<string, Dependency>();
  for (const entity of entities) {
    for (const field of prerequisiteFields(entity, look)) {
      for (const target of targets(entity, field)) {
        const [parent, child] = field.prerequisite === 'up' ? [target, entity.id] : [entity.id, target];
        out.set(`${parent}>${child}`, { parent, child, kind: 'prerequisite', impact: PREREQUISITE_IMPACT });
      }
    }
  }
  return [...out.values()];
}

/* -- Der Graph ----------------------------------------------------------------------------------- */

export interface PrerequisiteGraph {
  /** Die Voraussetzungen ohne Kreise. */
  readonly edges: readonly Dependency[];
  /** Was einen Kreis schlösse — fällt weg (die frühere Kante gewinnt), steht in „Do zrobienia". */
  readonly circles: readonly Dependency[];
  /** Was direkt vor einem Eintrag kommt. */
  readonly needs: ReadonlyMap<string, readonly string[]>;
  /** Was direkt auf ihm aufbaut. */
  readonly builds: ReadonlyMap<string, readonly string[]>;
  /** Die Ebene: 0 — nichts davor; sonst eins mehr als die höchste davor. Nur, wer in einer Kante steht. */
  readonly level: ReadonlyMap<string, number>;
}

export const EMPTY_GRAPH: PrerequisiteGraph = { edges: [], circles: [], needs: new Map(), builds: new Map(), level: new Map() };

/** Wie eine Ebene heisst — in der Ścieżka, in einem Widok, im Eintrag. */
export const levelLabel = (level: number): string => `Poziom ${level + 1}${level === 0 ? ' — podstawy' : ''}`;

const push = (map: Map<string, string[]>, key: string, value: string) => {
  const list = map.get(key);
  if (list === undefined) map.set(key, [value]); else if (!list.includes(value)) list.push(value);
};

/** Aus allen Abhängigkeiten die Voraussetzungen als Graph — mit Ebenen, ohne Kreise. */
export function prerequisiteGraph(deps: readonly Dependency[]): PrerequisiteGraph {
  const only = deps.filter((d) => d.kind === 'prerequisite' && d.parent !== d.child);
  if (only.length === 0) return EMPTY_GRAPH;
  const edges = acyclic(only);
  const kept = new Set(edges);
  const circles = only.filter((d) => !kept.has(d));
  const needs = new Map<string, string[]>();
  const builds = new Map<string, string[]>();
  for (const e of edges) { push(needs, e.child, e.parent); push(builds, e.parent, e.child); }
  /* Die Ebenen ohne Rekursion (eine lange Kette sprengt sonst den Stapel): von den Wurzeln her, Kante für Kante. */
  const level = new Map<string, number>();
  const waiting = new Map<string, number>();
  for (const [child, parents] of needs) waiting.set(child, parents.length);
  const queue = [...new Set(edges.flatMap((e) => [e.parent, e.child]))].filter((id) => !waiting.has(id));
  for (const id of queue) level.set(id, 0);
  for (let i = 0; i < queue.length; i += 1) {
    const id = queue[i];
    const at = level.get(id) ?? 0;
    for (const child of builds.get(id) ?? []) {
      level.set(child, Math.max(level.get(child) ?? 0, at + 1));
      const left = (waiting.get(child) ?? 1) - 1;
      waiting.set(child, left);
      if (left === 0) queue.push(child);
    }
  }
  return { edges, circles, needs, builds, level };
}

/** Alles, was vor einem Eintrag kommt — bis zu den Grundlagen. */
export function allNeeds(id: string, graph: PrerequisiteGraph): Set<string> {
  const out = new Set<string>();
  const stack = [...(graph.needs.get(id) ?? [])];
  while (stack.length > 0) {
    const p = stack.pop()!;
    if (out.has(p)) continue;
    out.add(p);
    stack.push(...(graph.needs.get(p) ?? []));
  }
  return out;
}

/** Alles, was (über Ebenen) auf einem Eintrag aufbaut. */
export function allBuilds(id: string, graph: PrerequisiteGraph): Set<string> {
  const out = new Set<string>();
  const stack = [...(graph.builds.get(id) ?? [])];
  while (stack.length > 0) {
    const c = stack.pop()!;
    if (out.has(c)) continue;
    out.add(c);
    stack.push(...(graph.builds.get(c) ?? []));
  }
  return out;
}

/* -- Karten im Graphen ------------------------------------------------------------------------------ */

/** Was eine Karte prüft: ihr Eintrag (ein Pytanie ist selbst einer) und, bei einem Pytanie, „O czym". */
export const cardEntities = (card: Pick<Card, 'entity' | 'question' | 'about'>): string[] =>
  [...new Set([card.entity ?? card.question, ...(card.about ?? [])])];

/** Die Karten, die einen Eintrag prüfen — seine eigenen und die Pytania über ihn. */
export const cardsAbout = <C extends Pick<Card, 'entity' | 'question' | 'about'>>(cards: readonly C[], id: string): C[] =>
  cards.filter((c) => cardEntities(c).includes(id));

/** Auf welcher Ebene eine Karte steht: die höchste ihrer Einträge (eine neue Karte kommt danach an die Reihe). */
export function cardLevel(card: Pick<Card, 'entity' | 'question' | 'about'>, graph: PrerequisiteGraph): number {
  let at = 0;
  for (const id of cardEntities(card)) at = Math.max(at, graph.level.get(id) ?? 0);
  return at;
}

/** Wie gut jeder Eintrag sitzt: der Durchschnitt der Karten, die ihn prüfen [E2] (`mastery` je Karte). */
export function entityMastery<C extends Pick<Card, 'entity' | 'question' | 'about' | 'key'>>(cards: readonly C[], mastery: (card: C) => number): Map<string, number> {
  const by = new Map<string, number[]>();
  for (const card of cards) {
    const m = mastery(card);
    for (const id of cardEntities(card)) {
      const list = by.get(id);
      if (list === undefined) by.set(id, [m]); else list.push(m);
    }
  }
  return new Map([...by].map(([id, values]) => [id, average(values)]));
}

/**
 * WAS NOCH NICHT SITZT von dem, was vor diesen Einträgen kommt (`ids` — die Einträge einer Karte).
 * Ein Eintrag ohne Karten (`askable` sagt nein) steht für das, was vor IHM kommt; einer der `ids`
 * selbst auch (die Karte prüft ihn gerade). Was sitzt, wird nicht weiter hinauf verfolgt.
 */
export function unmetNeeds(ids: readonly string[], known: (id: string) => number, graph: PrerequisiteGraph, threshold: number, askable: (id: string) => boolean): string[] {
  const own = new Set(ids);
  const out: string[] = [];
  const seen = new Set<string>();
  const stack: string[] = ids.flatMap((id) => graph.needs.get(id) ?? []);
  while (stack.length > 0) {
    const p = stack.pop()!;
    if (seen.has(p)) continue;
    seen.add(p);
    if (own.has(p) || !askable(p)) { stack.push(...(graph.needs.get(p) ?? [])); continue; }
    if (known(p) < threshold && !out.includes(p)) out.push(p);
  }
  return out;
}

/**
 * „NAJPIERW PODSTAWY" HOLT SIE DAZU: zu den Karten die Karten dessen, was vor ihren Einträgen kommt
 * (bis zu den Grundlagen) — eine Powtórka über Orbitale fragt dann zuerst nach dem Atom.
 */
export function withBasics<C extends Pick<Card, 'entity' | 'question' | 'about' | 'key'>>(cards: readonly C[], all: readonly C[], graph: PrerequisiteGraph): C[] {
  if (graph.edges.length === 0) return [...cards];
  const ids = new Set(cards.flatMap(cardEntities));
  const needed = new Set<string>();
  for (const id of ids) for (const p of allNeeds(id, graph)) if (!ids.has(p)) needed.add(p);
  if (needed.size === 0) return [...cards];
  const have = new Set(cards.map((c) => c.key));
  return [...cards, ...all.filter((c) => !have.has(c.key) && cardEntities(c).some((id) => needed.has(id)))];
}
