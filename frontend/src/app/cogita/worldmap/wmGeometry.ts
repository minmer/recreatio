/**
 * 2026-11-09 — DIE GESTALT DER WELT, einmal je Fassung der Welt (spec §5): Lage (`wmLayout.ts`) und Gleise (`wmTracks.ts`).
 * Ein Block steht als EINE Scheibe in der Lage; seine Teile stehen darauf dicht gepackt. Ein Abschnitt zu einem Teil fährt
 * zum Rand der Scheibe; zwischen zwei Teilen desselben Blocks liegt er gerade auf der Scheibe.
 * Rein — der Worker (`wmGeometry.worker.ts`) und die Prüfungen rechnen damit; nichts davon kennt React oder Texte.
 */

import { HOME_R, hash01, JUNCTION_R, layout, packParts, R } from './wmLayout';
import { routeTracks, type Obstacle, type Track } from './wmTracks';
import { isJunction, type Lines, type World } from './wmTypes';

export const HOME_ID = '~home';
/** Steigt, wenn sich die Rechnung ändert (gespeicherte Lagen und Gleise einer anderen Fassung gelten nicht). */
export const GEOMETRY_PARAMS = 'wm1';

export interface GeometryInput {
  readonly places: readonly { readonly id: string; readonly color?: string; readonly block?: string }[];
  readonly blocks: readonly { readonly id: string; readonly parts: readonly string[] }[];
  /** Abschnitte (von, nach): Orte oder das Haus; gleiche Enden zählen nicht. */
  readonly sections: readonly (readonly [string, string])[];
  /** Step 3 §2.1 — die Linie je Abschnitt (gleiche Reihenfolge): wie viele Linien ein Gleis trägt (die Breite des Bündels). */
  readonly sectionLines?: readonly string[];
  /** Voraussetzungen zwischen Orten (Grundlage → Aufbau). */
  readonly prereqs: readonly (readonly [string, string])[];
  /** Gespeicherte Lage der Knoten (Orte, Blöcke, Haus). */
  readonly previous?: Readonly<Record<string, readonly [number, number]>>;
  readonly mode?: 'stable' | 'full';
  /** 2026-11-10 — je Gabelung: Schritte vor ihr (vom Turm) und die mittlere Länge ihrer Zweige (Schritte) — ihre Lage auf dem Weg. */
  readonly junctionSteps?: Readonly<Record<string, readonly [number, number]>>;
}

/** Wie weit eine Gabelung auf dem Weg vom Ausgang zum nächsten Ziel liegt (Anteil des freien Stücks zwischen den Rändern). */
export const FORK_MIN = 0.1;
export const FORK_MAX = 0.45;
/** Der Anteil: mehr Folien vor der Gabelung (gegenüber der Länge ihrer Zweige) — weiter vom Ausgang, in den Grenzen. */
export const forkShare = (before: number, after: number): number => (before + after <= 0 ? FORK_MIN : Math.max(FORK_MIN, Math.min(FORK_MAX, before / (before + after))));

export interface Geometry {
  readonly version: string;
  /** Mittelpunkte: Knoten (Orte, Blöcke, Haus) und die Teile der Blöcke. */
  readonly positions: Readonly<Record<string, readonly [number, number]>>;
  /** Der volle Radius je Knoten und Teil. */
  readonly radii: Readonly<Record<string, number>>;
  /** Welcher Knoten einen Ort trägt (ein Teil: sein Block). */
  readonly nodeOf: Readonly<Record<string, string>>;
  readonly tracks: readonly Track[];
  /** Abschnitte zwischen Teilen desselben Blocks (gerade, auf der Scheibe). */
  readonly inner: readonly (readonly [string, string])[];
  readonly noRoute: readonly (readonly [string, string])[];
  /** Die Lage der Knoten (für das gespeicherte Dokument `worldmap`). */
  readonly nodes: Readonly<Record<string, readonly [number, number]>>;
  /** Neu gesetzte Knoten (gegenüber der gespeicherten Lage). */
  readonly placed: readonly string[];
  readonly stats: { readonly layoutMs: number; readonly tracksMs: number; readonly smoothed: number; readonly cornered: number; readonly iterations: number };
}

const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Die Fassung: Knoten, Radien, Paare, Voraussetzungen und die gespeicherte Lage — gleich, so auch die Gestalt. */
export function geometryVersion(input: GeometryInput): string {
  const parts: string[] = [GEOMETRY_PARAMS, input.mode ?? 'stable'];
  for (const p of input.places.slice().sort((a, b) => (a.id < b.id ? -1 : 1))) parts.push(`${p.id}:${p.block ?? ''}:${p.color ?? ''}`);
  for (const s of input.sections.map(([a, b]) => key(a, b)).sort()) parts.push(s);
  for (const s of input.prereqs.map(([a, b]) => `${a}>${b}`).sort()) parts.push(s);
  if (input.previous !== undefined) for (const k of Object.keys(input.previous).sort()) { const p = input.previous[k]; parts.push(`${k}@${p[0]},${p[1]}`); }
  if (input.junctionSteps !== undefined) for (const k of Object.keys(input.junctionSteps).sort()) { const w = input.junctionSteps[k]; parts.push(`${k}~${w[0]},${w[1]}`); }
  parts.push('fork-share-2');
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  const text = parts.join('\n');
  for (let i = 0; i < text.length; i += 1) { const c = text.charCodeAt(i); h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0; h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0; }
  return `${GEOMETRY_PARAMS}-${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}-${input.places.length}`;
}

export function geometryOf(input: GeometryInput): Geometry {
  const version = geometryVersion(input);
  const blockOf = new Map<string, string>();
  const packs = new Map<string, ReturnType<typeof packParts> & { parts: string[] }>();
  for (const b of input.blocks) {
    const parts = b.parts.slice().sort();
    packs.set(b.id, { ...packParts(parts.length, R), parts });
    for (const p of parts) blockOf.set(p, b.id);
  }
  const nodeOf: Record<string, string> = {};
  for (const p of input.places) nodeOf[p.id] = blockOf.get(p.id) ?? p.id;
  nodeOf[HOME_ID] = HOME_ID;
  const node = (id: string) => nodeOf[id] ?? id;

  /* Knoten: Orte ausserhalb von Blöcken, die Blöcke, das Haus (wenn eine Linie dort beginnt). */
  const usesHome = input.sections.some(([a, b]) => a === HOME_ID || b === HOME_ID);
  const colorOf = new Map(input.places.map((p) => [p.id, p.color] as const));
  const layoutNodes: { id: string; r: number; color?: string; small?: boolean }[] = [];
  for (const p of input.places) if (!blockOf.has(p.id)) layoutNodes.push({ id: p.id, r: R, ...(p.color === undefined ? {} : { color: p.color }) });
  for (const [id, pack] of packs) layoutNodes.push({ id, r: pack.disc, ...(colorOf.get(pack.parts[0]) === undefined ? {} : { color: colorOf.get(pack.parts[0])! }) });
  if (usesHome) layoutNodes.push({ id: HOME_ID, r: HOME_R });
  /* 2026-11-10 — Gabelungen und Tore: kleine Knoten zwischen den Türmen. */
  const junctions = new Set<string>();
  for (const [a, b] of input.sections) for (const x of [a, b]) if (isJunction(x)) junctions.add(x);
  for (const id of [...junctions].sort()) { layoutNodes.push({ id, r: JUNCTION_R, small: true }); nodeOf[id] = id; }

  const trackPairs = new Map<string, [string, string]>();
  const inner = new Map<string, [string, string]>();
  const bundle = new Map<string, Set<string>>();
  input.sections.forEach(([a, b], i) => {
    if (a === b) return;
    const na = node(a), nb = node(b);
    if (na === nb) { inner.set(key(a, b), a < b ? [a, b] : [b, a]); return; }
    trackPairs.set(key(na, nb), na < nb ? [na, nb] : [nb, na]);
    const set = bundle.get(key(na, nb)) ?? new Set<string>();
    set.add(input.sectionLines?.[i] ?? '');
    bundle.set(key(na, nb), set);
  });
  const prereqs: [string, string][] = [];
  for (const [a, b] of input.prereqs) { const na = node(a), nb = node(b); if (na !== nb) prereqs.push([na, nb]); }

  const t0 = Date.now();
  const lay = layout({ nodes: layoutNodes, tracks: [...trackPairs.values()], prereqs, ...(input.previous === undefined ? {} : { previous: input.previous }), mode: input.mode ?? 'stable' });
  const layoutMs = Date.now() - t0;

  const positions: Record<string, readonly [number, number]> = {};
  const radii: Record<string, number> = {};
  const nodes: Record<string, readonly [number, number]> = {};
  for (const n of layoutNodes) {
    const p = lay.positions.get(n.id)!;
    positions[n.id] = p;
    nodes[n.id] = p;
    radii[n.id] = n.r;
  }
  for (const [id, pack] of packs) {
    const c = positions[id];
    /* Die Teile drehen sich mit dem Hash des Blocks (sonst stünden alle Blöcke gleich). */
    const turn = hash01(id) * Math.PI * 2;
    pack.parts.forEach((part, i) => {
      const [ox, oy] = pack.offsets[i];
      const x = ox * Math.cos(turn) - oy * Math.sin(turn), y = ox * Math.sin(turn) + oy * Math.cos(turn);
      positions[part] = [Math.round((c[0] + x) * 10) / 10, Math.round((c[1] + y) * 10) / 10];
      radii[part] = R;
    });
  }

  /*
    2026-11-10 (Eigentümer: „eine Gabelung liegt nah bei dem Ort, dem sie folgt, zwischen ihm und den Orten ihrer Zweige — nicht
    am Rand, nicht hinter dem Ausgangsturm, nicht auf einer anderen Spur") — DIE LAGE EINES KNOTENS nach Regel: auf der Strecke
    vom Ausgang zur Mitte seiner Ziele, ein Stück vom Ausgang entfernt (ein Bruchteil des Abstands zum nächsten Ziel), dann von
    anderen Türmen weggedreht. Ein Knoten nach einem Knoten folgt dessen Lage.
  */
  const into = new Map<string, string>();
  const outs = new Map<string, string[]>();
  for (const [a, b] of input.sections) {
    if (a === b) continue;
    if (junctions.has(b) && !into.has(b)) into.set(b, node(a));
    if (junctions.has(a)) { const l = outs.get(a) ?? []; l.push(node(b)); outs.set(a, l); }
  }
  const placedJ = new Set<string>();
  const order = [...junctions].sort();
  for (let pass = 0; pass < 4 && placedJ.size < order.length; pass += 1) {
    for (const id of order) {
      if (placedJ.has(id)) continue;
      const from = into.get(id);
      if (from !== undefined && junctions.has(from) && !placedJ.has(from) && pass < 3) continue;
      const o = from === undefined ? undefined : positions[from];
      const targets = (outs.get(id) ?? []).map((t) => positions[t]).filter((p): p is readonly [number, number] => p !== undefined);
      if (o === undefined || targets.length === 0) { placedJ.add(id); continue; }
      const cx = targets.reduce((s, p) => s + p[0], 0) / targets.length, cy = targets.reduce((s, p) => s + p[1], 0) / targets.length;
      const outIds = outs.get(id) ?? [];
      let near = Infinity, rNear = R;
      outIds.forEach((t) => { const p = positions[t]; if (p === undefined) return; const d = Math.hypot(p[0] - o[0], p[1] - o[1]); if (d < near) { near = d; rNear = junctions.has(t) ? JUNCTION_R : radii[t] ?? R; } });
      const ro = from === undefined ? R : junctions.has(from) ? JUNCTION_R : radii[from] ?? R;
      /*
        2026-11-10 (Eigentümer: „der Abstand vom Ausgang wächst mit den Folien vor der Gabelung, gemessen an der Länge der Zweige —
        zwischen 10 % und 45 % des Weges zum nächsten Ziel") — gemessen auf dem freien Stück zwischen den Rändern.
      */
      const w = input.junctionSteps?.[id] ?? [0, 1];
      const start = ro + JUNCTION_R + 2, end = Math.max(start, near - rNear - JUNCTION_R - 2);
      const dist = start + forkShare(w[0], w[1]) * (end - start);
      const base = Math.atan2(cy - o[1], cx - o[0]);
      /* Weggedreht (±15°-Schritte), bis kein anderer Turm den Knoten berührt. */
      let best: [number, number] = [o[0] + Math.cos(base) * dist, o[1] + Math.sin(base) * dist];
      for (let k = 0; k < 9; k += 1) {
        const turn = (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 12);
        const x = o[0] + Math.cos(base + turn) * dist, y = o[1] + Math.sin(base + turn) * dist;
        const clear = layoutNodes.every((n) => n.id === id || n.id === from || junctions.has(n.id) || Math.hypot(positions[n.id][0] - x, positions[n.id][1] - y) >= n.r + JUNCTION_R + 0.5 * R);
        if (clear) { best = [x, y]; break; }
      }
      positions[id] = [Math.round(best[0] * 10) / 10, Math.round(best[1] * 10) / 10];
      nodes[id] = positions[id];
      placedJ.add(id);
    }
  }

  const t1 = Date.now();
  const obstacles: Obstacle[] = layoutNodes.map((n) => ({ id: n.id, x: positions[n.id][0], y: positions[n.id][1], r: n.r }));
  const routed = routeTracks(obstacles, [...trackPairs.values()], (a, b) => bundle.get(key(a, b))?.size ?? 1);
  const tracksMs = Date.now() - t1;
  return {
    version, positions, radii, nodeOf, tracks: routed.tracks, inner: [...inner.values()], noRoute: routed.noRoute, nodes, placed: lay.placed,
    stats: { layoutMs, tracksMs, smoothed: routed.smoothed, cornered: routed.cornered, iterations: lay.iterations }
  };
}

/** Der Eingang der Gestalt aus Welt und Linien (im Hauptfaden; der Worker bekommt nur diese Zahlen und Kennungen). */
export function geometryInputOf(world: World, lines: Lines, opts: { readonly previous?: Readonly<Record<string, readonly [number, number]>>; readonly mode?: 'stable' | 'full'; readonly color?: (place: string) => string | undefined } = {}): GeometryInput {
  const places = world.order.map((id) => {
    const p = world.places.get(id)!;
    const color = opts.color?.(id);
    return { id, ...(p.block === undefined ? {} : { block: p.block }), ...(color === undefined ? {} : { color }) };
  });
  const blocks = [...world.blocks.values()].map((b) => ({ id: b.id, parts: b.parts.filter((p) => world.places.has(p)) })).filter((b) => b.parts.length > 0);
  const sections: [string, string][] = [];
  const sectionLines: string[] = [];
  for (const s of lines.sections.values()) if (s.from !== s.to) { sections.push([s.from, s.to]); sectionLines.push(s.line); }
  const prereqs: [string, string][] = [];
  for (const p of world.places.values()) for (const n of p.needs) prereqs.push([n, p.id]);
  const junctionSteps: Record<string, readonly [number, number]> = {};
  for (const j of lines.junctions.values()) {
    const outs = j.out.map((id) => lines.sections.get(id)).filter((s): s is NonNullable<typeof s> => s !== undefined);
    const after = outs.length === 0 ? 0 : outs.reduce((sum, s) => sum + s.steps.length, 0) / outs.length;
    junctionSteps[j.id] = [j.before.slides + j.before.questions, Math.round(after * 10) / 10];
  }
  return {
    places, blocks, sections, sectionLines, prereqs, ...(opts.previous === undefined ? {} : { previous: opts.previous }), ...(opts.mode === undefined ? {} : { mode: opts.mode }),
    ...(Object.keys(junctionSteps).length === 0 ? {} : { junctionSteps })
  };
}

/** Die Hindernisse einer fertigen Gestalt (für die Prüfung `clearance`). */
export const obstaclesOf = (g: Geometry): Obstacle[] =>
  Object.keys(g.nodes).map((id) => ({ id, x: g.positions[id][0], y: g.positions[id][1], r: g.radii[id] }));
