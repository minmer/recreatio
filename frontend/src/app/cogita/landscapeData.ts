/**
 * 2026-11-03 — WAS DER KRAJOBRAZ AUS DER BAZA BRAUCHT (im Hauptfaden gesammelt, gerechnet im Worker, `landscape.ts`):
 * die Einträge des Widoku und alles, was in der Reihenfolge des Lernens steht; die Kanten roh (mit Kreisen); wer
 * Karten hat; die Werte der Gruppierung des Widoku mit ihrem Baum (die Struktur einer Achse: Tagi unter Tagami,
 * Kapitel über `teil`) — und der Stand des Betrachters (Kenntnis je Eintrag, schwache beantwortete Karten).
 */

import type { Card } from './cardBasics';
import { cardKnowness, chainNeeds, itemKnowness, type Gauge } from './knowing';
import type { Dependency } from './knowness';
import type { LsInput, LsState, LsValue } from './landscape';
import type { PrerequisiteGraph } from './prerequisites';
import { fieldsOf, labelOf, type Entity } from './schema';
import { axisMembersOf, axisValues, groupsOf, type Axis, type Grouping, type SelectContext } from './selection';
import { parentsOf } from './structure';

export interface LandscapeSource {
  readonly select: SelectContext;
  /** Alle Abhängigkeiten der Baza (`CogitaLibrary.dependencies()`) — roh, auch die einen Kreis schliessen. */
  readonly deps: readonly Dependency[];
  readonly label: (entity: Entity) => string;
}

/** DIE EINGÄNGE EINES KRAJOBRAZ (ohne Stand): sie ändern sich nur mit der Baza und dem Widok. */
export function landscapeInput(src: LandscapeSource, list: readonly Entity[], grouping: Grouping | null, gauge: Pick<Gauge, 'askable'>): LsInput {
  const ids: string[] = [];
  const index = new Map<string, number>();
  const add = (id: string): number => {
    let i = index.get(id);
    if (i === undefined) { i = ids.length; ids.push(id); index.set(id, i); }
    return i;
  };
  for (const e of list) add(e.id);
  const prereq = src.deps.filter((d) => d.kind === 'prerequisite' && d.parent !== d.child);
  for (const d of prereq) {
    if (src.select.entity(d.parent) !== undefined) add(d.parent);
    if (src.select.entity(d.child) !== undefined) add(d.child);
  }
  const needs: number[][] = ids.map(() => []);
  for (const d of prereq) {
    const p = index.get(d.parent);
    const c = index.get(d.child);
    if (p === undefined || c === undefined || needs[c].includes(p)) continue;
    needs[c].push(p);
  }
  const labels = ids.map((id) => { const e = src.select.entity(id); return e === undefined ? id : src.label(e); });
  const learnable = ids.map((id) => gauge.askable.has(id));
  const inViewSet = new Set(list.map((e) => e.id));
  const inView = ids.map((id) => inViewSet.has(id));
  const { values, memberOf, sorted } = directionValues(src.select, list, grouping, ids, index);
  /* Ohne Werte kommen die Bereiche aus dem Baum (`treeAreas`): worunter jeder in der Struktur liegt. */
  const up = values.length > 0 ? undefined : structureUp(src.select, ids, index);
  return { ids, labels, needs, learnable, inView, values, memberOf, sorted, ...(up === undefined ? {} : { up }) };
}

/** Je Knoten, worunter er in der Struktur liegt (Felder mit `structure`) — nur innerhalb der Knoten. */
function structureUp(select: SelectContext, ids: readonly string[], index: ReadonlyMap<string, number>): number[][] | undefined {
  const source = { entity: select.entity, look: select.look, pointing: select.pointing };
  let any = false;
  const up = ids.map((id) => {
    const list = parentsOf(id, source).map((p) => index.get(p)).filter((x): x is number => x !== undefined && x !== index.get(id));
    if (list.length > 0) any = true;
    return list;
  });
  return any ? up : undefined;
}

/**
 * 2026-11-03 — DIE ACHSE IM KRAJOBRAZ: ein `through` über ein Strukturfeld nach oben (`wymaga`, `teil`) geht ohne
 * `depth` über ALLE Stufen — der nächste Eintrag mit Wert je Weg, ein eigener Wert gewinnt (`axisMembersOf`). Anderswo
 * bleibt `through` ohne `depth` ein Schritt.
 */
export function landscapeAxis(select: SelectContext, axis: Axis, list: readonly Entity[]): Axis {
  if (axis.through === undefined || axis.through === '*' || axis.depth !== undefined) return axis;
  const up = list.some((e) => fieldsOf(e, select.look).some((f) => f.key === axis.through && f.type === 'ref' && f.structure === 'up'));
  return up ? { ...axis, depth: 'all' } : axis;
}

/** Die Werte der Richtung: eine Achse mit ihrem Baum (Struktur der Werte) — sonst die Gruppen des Widoku, flach. */
function directionValues(select: SelectContext, list: readonly Entity[], grouping: Grouping | null, ids: readonly string[], index: ReadonlyMap<string, number>): { values: LsValue[]; memberOf: number[][]; sorted: boolean } {
  const memberOf: number[][] = ids.map(() => []);
  if (grouping === null) return { values: [], memberOf, sorted: false };
  if (grouping.by === 'axis') {
    const axis = landscapeAxis(select, grouping, list);
    const ordered = axisValues(select, axis).map((x) => x.value);
    const at = new Map(ordered.map((e, i) => [e.id, i] as const));
    const set = new Set(at.keys());
    const source = { entity: select.entity, look: select.look, pointing: select.pointing };
    const values: LsValue[] = ordered.map((e, i) => {
      const up = parentsOf(e.id, source).filter((p) => set.has(p)).sort((a, b) => (at.get(a) ?? 0) - (at.get(b) ?? 0))[0];
      return { id: e.id, label: labelOf(e, select.look), parent: up === undefined ? -1 : at.get(up)!, rank: i };
    });
    const membersOf = axisMembersOf(select, axis, set);
    for (const e of list) {
      const v = index.get(e.id);
      if (v === undefined) continue;
      memberOf[v] = membersOf(e).map((id) => at.get(id)).filter((x): x is number => x !== undefined);
    }
    /* Die Reihenfolge des Autors (`sort`) gilt links → rechts; ohne sie ordnet das Gemeinsame. */
    return { values, memberOf, sorted: axis.sort !== undefined };
  }
  const groups = groupsOf(select, list.map((e) => e.id), grouping).filter((g) => g.key !== '');
  const values: LsValue[] = groups.map((g, i) => ({ id: g.key, label: g.label, parent: -1, rank: i }));
  groups.forEach((g, i) => { for (const id of g.ids) { const v = index.get(id); if (v !== undefined && !memberOf[v].includes(i)) memberOf[v].push(i); } });
  /* Die Ebenen haben ihre Reihenfolge (Poziom 1, 2, …). */
  return { values, memberOf, sorted: grouping.by === 'level' };
}

/**
 * 2026-11-04 (Prompt 15, 4b) — DER RING EINES THEMAS: das Mittel der Kenntnis seiner Karten, jede höchstens 1 (dasselbe Mass,
 * nach dem eine Karte „gekonnt" ist): 90, 90, 90, 100, 100, 100 % → 95 %. Ohne Karten: 0.
 */
export function ringShare(knowness: readonly number[]): number {
  if (knowness.length === 0) return 0;
  let sum = 0;
  for (const k of knowness) sum += Math.max(0, Math.min(1, Number.isFinite(k) ? k : 0));
  return sum / knowness.length;
}

/**
 * DER STAND DES BETRACHTERS: Kenntnis je Eintrag (mit dem, was darauf aufbaut), schwache beantwortete Karten — und
 * 2026-11-03 (C) je Eintrag, wie viele seiner Karten sitzen, von wie vielen (der Ring des Fortschritts einer Einheit).
 */
export function landscapeState(input: Pick<LsInput, 'ids'>, gauge: Gauge, lowered?: ReadonlySet<string>, reviewable?: ReadonlySet<string>): LsState {
  const n = input.ids.length;
  const knowness = new Float64Array(n);
  const weak = new Uint8Array(n);
  const cardsKnown = new Uint16Array(n);
  const cardsTotal = new Uint16Array(n);
  const cardsMean = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const id = input.ids[i];
    knowness[i] = itemKnowness(gauge, id);
    /* 2026-11-03 (G) — eine Einheit, deren Erzählung zu Ende ist: gelernt (das Feld sinkt ins Tal). */
    if (lowered?.has(id) === true) knowness[i] = Math.max(knowness[i], 1);
    const testing = gauge.testing.get(id) ?? [];
    cardsTotal[i] = Math.min(65535, testing.length);
    cardsMean[i] = ringShare(testing.map((t) => (gauge.states.has(t.key) ? cardKnowness(gauge, t.key) : 0)));
    for (const t of testing) {
      const known = gauge.states.has(t.key) ? cardKnowness(gauge, t.key) : 0;
      if (known >= 1) cardsKnown[i] = Math.min(65535, cardsKnown[i] + 1);
      /* 2026-11-05 (Durchsicht) — nur Karten, die man hier wiederholen kann (eine Antwort einer Seite sperrt nichts). */
      if (gauge.states.has(t.key) && known < 1 && (reviewable === undefined || reviewable.has(t.key))) weak[i] = 1;
    }
  }
  return { knowness, weak, cardsKnown, cardsTotal, cardsMean };
}

/** Was vor einem Eintrag noch zu wiederholen ist (die Sperre): je Eintrag der Kette seine schwachen, schon gefragten Karten. */
export function lockCards(gauge: Gauge, graph: PrerequisiteGraph, id: string, cards: readonly Card[]): { readonly entry: string; readonly cards: readonly Card[] }[] {
  const byKey = new Map(cards.map((c) => [c.key, c] as const));
  const out: { entry: string; cards: Card[] }[] = [];
  const seen = new Set<string>();
  for (const e of chainNeeds([id], graph)) {
    const weak: Card[] = [];
    for (const t of gauge.testing.get(e) ?? []) {
      if (seen.has(t.key) || !gauge.states.has(t.key) || cardKnowness(gauge, t.key) >= 1) continue;
      const card = byKey.get(t.key);
      if (card === undefined) continue;
      seen.add(t.key);
      weak.push(card);
    }
    if (weak.length > 0) out.push({ entry: e, cards: weak });
  }
  return out;
}
