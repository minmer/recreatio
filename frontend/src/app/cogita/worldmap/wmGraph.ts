/**
 * 2026-11-09 — DIE WELT LESEN UND REINIGEN (spec §5.1): Orte, ihre Karten, die Voraussetzungen zwischen Orten, Blöcke mit
 * Teilen, Kreise (Tarjan) und baumelnde Verweise.
 * <code>
 *   Orte          die Arten, worüber Fragen sind („about"), ohne Einheiten, Folien und Fragen (Entscheidung 1) — und nur
 *                 Einträge mit Karten; der Widok darf die Arten nennen (`placeKinds`)
 *   Voraussetzung Verweise mit "prerequisite" (beide Richtungen) und die Kanten der Ustawienia; ein Eintrag ohne Karten
 *                 steht für das, was vor IHM kommt; `needs` der Fragen zählt nicht (Entscheidung 6)
 *   Block         nur über `"part": "up"` (oder `down` am Block) — nie zugleich mit "prerequisite" (Entscheidung 3)
 *   Kreis         eine starke Komponente mit mehr als einem Ort: eine Gruppe für Höhe und Reihenfolge, gemeldet
 *   baumelnd      ein Verweis auf nichts: übergangen, gemeldet
 * </code>
 * Rein; geprüft in `scripts/app-wm-model-check.mjs`.
 */

import type { Flow } from '../flow';
import type { Block, Place, WmCardInput, WmEntry, WmIssue, World, WorldInput } from './wmTypes';

const SHOW_STEPS = new Set(['show', 'scene']);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter((x) => x !== '') : str(v) === '' ? [] : [str(v)]);

/** Was ein Schritt zeigt (die Kennungen): eine Folie („show" → `of`), eine Szene (`about`). */
export function shownEntries(node: { readonly type: string; readonly config: Readonly<Record<string, unknown>> }): string[] {
  if (node.type === 'show') return strings(node.config.of);
  if (node.type === 'scene') return strings(node.config.about);
  return [];
}

/** Codepunkt-Vergleich: dieselbe Reihenfolge auf jedem Gerät (die Lage hängt davon ab). */
export const byCode = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Die Arten der Orte, abgeleitet (Entscheidung 1). */
function derivePlaceKinds(input: WorldInput, entries: ReadonlyMap<string, WmEntry>, questionKinds: ReadonlySet<string>, units: ReadonlySet<string>): { places: Set<string>; units: Set<string> } {
  const unitKinds = new Set<string>();
  for (const u of units) { const e = entries.get(u); if (e !== undefined && e.kinds[0] !== undefined) unitKinds.add(e.kinds[0]); }
  const candidates = new Map<string, number>();
  for (const c of input.cards) {
    for (const a of c.about) {
      const e = entries.get(a);
      const k = e?.kinds[0];
      if (e === undefined || k === undefined || units.has(e.id) || questionKinds.has(k) || unitKinds.has(k)) continue;
      candidates.set(k, (candidates.get(k) ?? 0) + 1);
    }
  }
  /* Eine Art, deren gezeigte Einträge auf einen Ort einer ANDEREN Art zeigen, ist eine Folie (Bosko: „Slajd" → `o_czym`). */
  const slides = new Set<string>();
  for (const f of input.flows) {
    for (const n of f.graph.nodes) {
      if (!SHOW_STEPS.has(n.type)) continue;
      for (const id of shownEntries(n)) {
        const e = entries.get(id);
        const k = e?.kinds[0];
        if (e === undefined || k === undefined || !candidates.has(k)) continue;
        if (e.refs.some((r) => { const t = entries.get(r.to)?.kinds[0]; return t !== undefined && t !== k && candidates.has(t); })) slides.add(k);
      }
    }
  }
  const places = new Set([...candidates.keys()].filter((k) => !slides.has(k)));
  return { places: places.size > 0 ? places : new Set(candidates.keys()), units: unitKinds };
}

/** Tarjan, ohne Rekursion: die starken Komponenten (in umgekehrter topologischer Reihenfolge). */
export function stronglyConnected(nodes: readonly string[], next: (id: string) => readonly string[]): string[][] {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const out: string[][] = [];
  let counter = 0;
  for (const root of nodes) {
    if (index.has(root)) continue;
    const work: { id: string; kids: readonly string[]; i: number }[] = [{ id: root, kids: next(root), i: 0 }];
    index.set(root, counter); low.set(root, counter); counter += 1; stack.push(root); onStack.add(root);
    while (work.length > 0) {
      const top = work[work.length - 1];
      if (top.i < top.kids.length) {
        const w = top.kids[top.i];
        top.i += 1;
        if (!index.has(w)) {
          index.set(w, counter); low.set(w, counter); counter += 1; stack.push(w); onStack.add(w);
          work.push({ id: w, kids: next(w), i: 0 });
        } else if (onStack.has(w)) low.set(top.id, Math.min(low.get(top.id)!, index.get(w)!));
        continue;
      }
      work.pop();
      if (work.length > 0) { const parent = work[work.length - 1].id; low.set(parent, Math.min(low.get(parent)!, low.get(top.id)!)); }
      if (low.get(top.id) === index.get(top.id)) {
        const comp: string[] = [];
        for (;;) { const w = stack.pop()!; onStack.delete(w); comp.push(w); if (w === top.id) break; }
        out.push(comp);
      }
    }
  }
  return out;
}

/** Die Orte, die ein Ablauf als Einheit hat. */
const unitsOf = (flows: readonly Flow[]): Set<string> => new Set(flows.map((f) => f.unit).filter((u): u is string => u !== undefined && u !== ''));

export function readWorld(input: WorldInput): World {
  const issues: WmIssue[] = [];
  const entries = new Map<string, WmEntry>();
  for (const e of input.entries) if (!entries.has(e.id)) entries.set(e.id, e);
  const questionKinds = new Set(input.questionKinds ?? ['question']);
  const isQuestion = (id: string) => entries.get(id)?.kinds.some((k) => questionKinds.has(k)) === true;
  const units = unitsOf(input.flows);
  const derived = derivePlaceKinds(input, entries, questionKinds, units);
  const placeKinds = new Set(input.placeKinds !== undefined && input.placeKinds.length > 0 ? input.placeKinds : derived.places);

  /* -- Karten und ihre Orte ------------------------------------------------------------------------------------------------ */
  const cards = new Map<string, WmCardInput>();
  for (const c of input.cards) if (!cards.has(c.key)) cards.set(c.key, c);
  const placeCandidate = (id: string): boolean => {
    const e = entries.get(id);
    return e !== undefined && !units.has(id) && !isQuestion(id) && e.kinds.some((k) => placeKinds.has(k));
  };
  const cardsOfEntry = new Map<string, string[]>();
  const aboutCards = new Map<string, string[]>();
  for (const c of cards.values()) {
    for (const a of new Set(c.about)) {
      const all = aboutCards.get(a) ?? [];
      all.push(c.key);
      aboutCards.set(a, all);
      if (!placeCandidate(a)) continue;
      const list = cardsOfEntry.get(a) ?? [];
      list.push(c.key);
      cardsOfEntry.set(a, list);
    }
  }
  const isPlace = (id: string) => cardsOfEntry.has(id);
  /* Eine Karte über etwas, das es nicht gibt: einmal je fehlendem Eintrag gemeldet. */
  const missingAbout = new Map<string, string>();
  for (const c of cards.values()) for (const a of c.about) if (!entries.has(a) && !a.startsWith('@@') && !missingAbout.has(a)) missingAbout.set(a, c.question);
  for (const [to, q] of missingAbout) issues.push({ code: 'dangling', level: 'warning', ids: [q, to], data: { field: 'about', to } });
  const questionCards = new Map<string, string[]>();
  for (const c of cards.values()) { const l = questionCards.get(c.question) ?? []; l.push(c.key); questionCards.set(c.question, l); }

  /* -- Was ein Eintrag verlangt (roh) ----------------------------------------------------------------------------------- */
  const requires = new Map<string, string[]>();
  const addReq = (child: string, parent: string) => {
    if (child === parent || parent.startsWith('@@')) return;
    const l = requires.get(child) ?? [];
    if (!l.includes(parent)) l.push(parent);
    requires.set(child, l);
  };
  const dangling = new Map<string, { from: string; field: string; to: string }>();
  const partBoth = new Map<string, string>();
  const partUp = new Map<string, string[]>();
  for (const e of entries.values()) {
    for (const r of e.refs) {
      if (r.to.startsWith('@@')) continue;
      const counted = r.prerequisite !== undefined || r.part !== undefined;
      if (counted && !entries.has(r.to)) {
        if (isPlace(e.id) || units.has(e.id) || r.part !== undefined) dangling.set(`${e.id}>${r.field}>${r.to}`, { from: e.id, field: r.field, to: r.to });
        continue;
      }
      if (r.prerequisite === 'up') addReq(e.id, r.to);
      else if (r.prerequisite === 'down') addReq(r.to, e.id);
      if (r.part !== undefined) {
        /* Entscheidung 3: ein Feld trägt nie beides — dann gilt es als Voraussetzung, und die Autoren sehen es. */
        if (r.prerequisite !== undefined) { if (!partBoth.has(r.field)) partBoth.set(r.field, e.id); continue; }
        const [part, block] = r.part === 'up' ? [e.id, r.to] : [r.to, e.id];
        const l = partUp.get(part) ?? [];
        if (!l.includes(block)) l.push(block);
        partUp.set(part, l);
      }
    }
  }
  for (const d of input.dependencies ?? []) {
    if (!entries.has(d.parent) || !entries.has(d.child)) { dangling.set(`${d.child}>~>${d.parent}`, { from: d.child, field: '~', to: entries.has(d.parent) ? d.child : d.parent }); continue; }
    addReq(d.child, d.parent);
  }
  for (const d of dangling.values()) issues.push({ code: 'dangling', level: 'warning', ids: [d.from, d.to], data: { field: d.field, to: d.to } });
  for (const [field, first] of partBoth) issues.push({ code: 'partAndPrerequisite', level: 'warning', ids: [first], data: { field } });

  /* -- Blöcke ----------------------------------------------------------------------------------------------------------- */
  const blockOf = new Map<string, string>();
  for (const [part, blocks] of partUp) {
    if (!isPlace(part)) continue;
    const real = blocks.filter((b) => entries.has(b) && b !== part);
    if (real.length === 0) continue;
    if (real.length > 1) issues.push({ code: 'partOfSeveral', level: 'warning', ids: [part, ...real] });
    blockOf.set(part, real[0]);
  }
  /* Ein Block, der selbst Teil eines Blocks ist: seine Zugehörigkeit fällt weg (keine Schachtelung). */
  for (const b of new Set(blockOf.values())) blockOf.delete(b);
  const blocks = new Map<string, Block>();
  for (const [part, b] of blockOf) {
    const had = blocks.get(b);
    const label = entries.get(b)?.label ?? b;
    if (had === undefined) blocks.set(b, { id: b, label, parts: isPlace(b) ? [b, part] : [part], own: isPlace(b) });
    else blocks.set(b, { ...had, parts: [...had.parts, part] });
  }

  /* -- Voraussetzungen zwischen Orten: der nächste Ort; ein Block ohne Karten heisst „alle seine Teile" ----------------- */
  const placeIds = [...cardsOfEntry.keys()].sort(byCode);
  const nearest = (id: string): string[] => {
    const out: string[] = [];
    const seen = new Set<string>([id]);
    const stack = [...(requires.get(id) ?? [])].reverse();
    while (stack.length > 0) {
      const t = stack.pop()!;
      if (seen.has(t)) continue;
      seen.add(t);
      /* Einen Block verlangen heisst: alle seine Teile (auch wenn er eigene Karten hat). */
      const block = blocks.get(t);
      if (block !== undefined) { for (const p of block.parts) if (p !== id && !out.includes(p)) out.push(p); continue; }
      if (isPlace(t)) { if (!out.includes(t)) out.push(t); continue; }
      if (isQuestion(t)) continue;
      for (const x of [...(requires.get(t) ?? [])].reverse()) stack.push(x);
    }
    return out;
  };
  const rawNeeds = new Map<string, string[]>();
  for (const p of placeIds) rawNeeds.set(p, nearest(p));
  const edges: [string, string][] = [];
  for (const [child, list] of rawNeeds) for (const parent of list) edges.push([parent, child]);

  /* -- Kreise ------------------------------------------------------------------------------------------------------------- */
  const comps = stronglyConnected(placeIds, (id) => rawNeeds.get(id) ?? []);
  const groupOf = new Map<string, number>();
  const groups: string[][] = [];
  for (const comp of comps) {
    if (comp.length < 2) continue;
    const sorted = comp.slice().sort(byCode);
    for (const m of sorted) groupOf.set(m, groups.length);
    groups.push(sorted);
    issues.push({ code: 'cycle', level: 'warning', ids: sorted });
  }
  const needs = new Map<string, string[]>();
  const builds = new Map<string, string[]>();
  for (const p of placeIds) {
    const g = groupOf.get(p);
    const list = (rawNeeds.get(p) ?? []).filter((x) => g === undefined || groupOf.get(x) !== g);
    needs.set(p, list);
    for (const x of list) { const l = builds.get(x) ?? []; l.push(p); builds.set(x, l); }
  }

  /* -- Stufen (eine Gruppe als ein Knoten) und die Hülle als Bitmenge ---------------------------------------------------- */
  const index = new Map(placeIds.map((id, i) => [id, i] as const));
  const words = (placeIds.length + 31) >>> 5;
  const memberSets = (id: string): readonly string[] => { const g = groupOf.get(id); return g === undefined ? [id] : groups[g]; };
  /* Die Komponenten von Tarjan kommen in umgekehrter topologischer Reihenfolge: Grundlagen zuerst. */
  const bits = new Map<string, Uint32Array>();
  const depth = new Map<string, number>();
  for (const comp of comps) {
    const set = new Uint32Array(words);
    let d = 0;
    for (const m of comp) {
      for (const n of needs.get(m) ?? []) {
        const nb = bits.get(n);
        if (nb !== undefined) for (let w = 0; w < words; w += 1) set[w] |= nb[w];
        for (const x of memberSets(n)) { const i = index.get(x)!; set[i >>> 5] |= 1 << (i & 31); }
        d = Math.max(d, (depth.get(n) ?? 0) + 1);
      }
    }
    if (comp.length > 1) for (const m of comp) { const i = index.get(m)!; set[i >>> 5] |= 1 << (i & 31); }
    for (const m of comp) {
      depth.set(m, d);
      if (comp.length > 1) { const own = Uint32Array.from(set); const i = index.get(m)!; own[i >>> 5] &= ~(1 << (i & 31)); bits.set(m, own); }
      else bits.set(m, set);
    }
  }
  const baseMemo = new Map<string, ReadonlySet<string>>();
  const base = (place: string): ReadonlySet<string> => {
    const had = baseMemo.get(place);
    if (had !== undefined) return had;
    const b = bits.get(place);
    const out = new Set<string>();
    if (b !== undefined) for (let w = 0; w < words; w += 1) { let x = b[w]; while (x !== 0) { const t = x & -x; out.add(placeIds[(w << 5) + 31 - Math.clz32(t)]); x ^= t; } }
    baseMemo.set(place, out);
    return out;
  };

  /* -- Karten eines Ortes: was andere Karten des Ortes brauchen, zuerst ----------------------------------------------------- */
  const orderedCards = (place: string): string[] => {
    const list = cardsOfEntry.get(place) ?? [];
    const keys = new Set(list);
    const before = new Map<string, string[]>();
    for (const k of list) {
      const c = cards.get(k)!;
      const pre = (c.needs ?? []).flatMap((n) => questionCards.get(n) ?? (cards.has(n) ? [n] : [])).filter((x) => keys.has(x) && x !== k);
      before.set(k, pre);
    }
    const out: string[] = [];
    const state = new Map<string, number>();
    const visit = (k: string) => {
      if (state.get(k) !== undefined) return;
      state.set(k, 1);
      for (const p of before.get(k) ?? []) visit(p);
      state.set(k, 2);
      out.push(k);
    };
    for (const k of list) visit(k);
    return out;
  };

  const places = new Map<string, Place>();
  for (const id of placeIds) {
    const e = entries.get(id)!;
    const g = groupOf.get(id);
    places.set(id, {
      id, label: e.label, kind: e.kinds.find((k) => placeKinds.has(k)) ?? e.kinds[0] ?? '',
      cards: orderedCards(id),
      ...(blockOf.has(id) ? { block: blockOf.get(id)! } : {}),
      needs: needs.get(id) ?? [], builds: builds.get(id) ?? [],
      ...(g === undefined ? {} : { group: g }),
      depth: depth.get(id) ?? 0
    });
  }
  const order = placeIds.slice().sort((a, b) => (depth.get(a)! - depth.get(b)!) || places.get(a)!.label.localeCompare(places.get(b)!.label, 'pl') || byCode(a, b));
  const cardPlaces = new Map<string, string[]>();
  for (const [place, list] of cardsOfEntry) for (const k of list) { const l = cardPlaces.get(k) ?? []; l.push(place); cardPlaces.set(k, l); }

  return {
    places, order, blocks, cards, cardPlaces, questionCards, aboutCards, groups, entries,
    placeKinds, unitKinds: derived.units,
    requires: (id) => requires.get(id) ?? [],
    base,
    baseBits: (place) => bits.get(place),
    bitOrder: placeIds,
    issues
  };
}

/** Die Kanten zwischen Orten (Grundlage → Aufbau), auch innerhalb einer Gruppe — für die Federn der Lage. */
export function placeEdges(world: World): [string, string][] {
  const out: [string, string][] = [];
  for (const p of world.places.values()) {
    for (const n of p.needs) out.push([n, p.id]);
    if (p.group !== undefined) for (const m of world.groups[p.group]) if (m !== p.id && byCode(m, p.id) < 0) out.push([m, p.id]);
  }
  return out;
}
