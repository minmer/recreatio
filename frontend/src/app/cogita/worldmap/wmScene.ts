/**
 * 2026-11-09 — WAS DIE WELTKARTE ZEICHNET (spec §4), fertig gerechnet für den Zeichner (`WorldPillars.tsx`): Säulen mit Farbe,
 * Sättigung, Höhe, Stufen und Punkt; Blöcke als Scheiben; das Haus; je Abschnitt eine Spur auf seinem Gleis — parallel zu
 * den anderen Linien desselben Gleises, immer in derselben Reihenfolge, 5 Einheiten auseinander. Eine Spur endet am VOLLEN
 * Rand (dort endet das Gleis); das gerade Stück bis zum gezeichneten Rand setzt der Zeichner (die Breite der Säulen ändert
 * nichts hier, §4.7). Rein.
 */

import type { LockSymbol } from './wmConditions';
import type { Rgb } from './wmColors';
import type { LineColour } from './wmColors';
import type { Geometry } from './wmGeometry';
import { HOME_ID } from './wmGeometry';
import type { WorldState } from './wmState';
import { laneOffset, offsetPoints } from './wmTracks';
import type { Lines, World } from './wmTypes';

export interface ScenePlace {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  /** Der volle Radius. */
  readonly r: number;
  readonly block?: string;
  /** Die Farbe des Themas (ungemischt). */
  readonly color: Rgb;
  readonly sat: 'never' | 'partly' | 'full';
  /** Was bis hierher fehlt (Karten) — die Höhe. */
  readonly missing: number;
  readonly total: number;
  readonly conquered: boolean;
  readonly levels: number;
  readonly level: number;
  readonly dot: 'green' | 'yellow' | 'orange' | null;
  readonly station: boolean;
}

export type LaneState = 'travelled' | 'open' | 'locked';

export interface SceneLane {
  readonly section: string;
  readonly line: string;
  readonly branch: string;
  /** Die Orte an beiden Enden (oder das Haus). */
  readonly fromId: string;
  readonly toId: string;
  /** Punkte in Weltkoordinaten, von `from` nach `to`, schon versetzt. */
  readonly points: readonly number[];
  /** Die Mitten der Säulen an beiden Enden (für das gerade Stück bis zum gezeichneten Rand). */
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  /** Die vollen Radien der Säulen an beiden Enden (0: das Haus). */
  readonly fromR: number;
  readonly toR: number;
  readonly fromHome: boolean;
  readonly color: Rgb;
  readonly deep: boolean;
  readonly state: LaneState;
  readonly symbol: LockSymbol | null;
}

export interface Scene {
  readonly places: readonly ScenePlace[];
  readonly byId: ReadonlyMap<string, ScenePlace>;
  readonly blocks: readonly { readonly id: string; readonly label: string; readonly x: number; readonly y: number; readonly r: number }[];
  readonly home: { readonly x: number; readonly y: number; readonly r: number } | null;
  readonly tracks: readonly { readonly key: string; readonly points: readonly number[]; readonly lanes: number }[];
  readonly lanes: readonly SceneLane[];
  /** Mitte und Halbmesser der ganzen Welt. */
  readonly extent: { readonly cx: number; readonly cy: number; readonly radius: number };
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** §4.3 — ein Name erscheint erst nah: wenn der gezeichnete Radius grösser ist als 24 + 0,32 · Höhe (Bildpunkte). */
export const showsName = (radiusPx: number, heightPx: number): boolean => radiusPx > 24 + 0.32 * heightPx;

export function sceneOf(world: World, lines: Lines, state: WorldState, g: Geometry, opts: { readonly placeColour: (place: string) => Rgb; readonly lineColour: ReadonlyMap<string, LineColour>; readonly fallback: Rgb }): Scene {
  const places: ScenePlace[] = [];
  for (const id of world.order) {
    const p = world.places.get(id)!;
    const pos = g.positions[id];
    if (pos === undefined) continue;
    const st = state.places.get(id);
    places.push({
      id, label: p.label, x: pos[0], y: pos[1], r: g.radii[id] ?? 28, ...(p.block === undefined ? {} : { block: p.block }),
      color: opts.placeColour(id), sat: st?.saturation ?? 'never', missing: st?.height ?? p.cards.length, total: p.cards.length,
      conquered: st?.conquered === true, levels: state.settings.levels, level: st?.level ?? 0, dot: st?.dot ?? null,
      station: lines.stations.has(id)
    });
  }
  const byId = new Map(places.map((p) => [p.id, p] as const));
  const blocks = [...world.blocks.values()].filter((b) => g.positions[b.id] !== undefined).map((b) => ({ id: b.id, label: b.label, x: g.positions[b.id][0], y: g.positions[b.id][1], r: g.radii[b.id] }));
  const home = g.positions[HOME_ID] === undefined ? null : { x: g.positions[HOME_ID][0], y: g.positions[HOME_ID][1], r: g.radii[HOME_ID] };

  /* Die Gleise und welche Linien auf ihnen fahren (in fester Reihenfolge: grosse vor Vertiefungen, dann nach Kennung). */
  const trackOf = new Map(g.tracks.map((t) => [pairKey(t.a, t.b), t] as const));
  const nodeOf = (id: string) => g.nodeOf[id] ?? id;
  const linesOn = new Map<string, Set<string>>();
  for (const s of lines.sections.values()) {
    if (s.from === s.to) continue;
    const k = pairKey(nodeOf(s.from), nodeOf(s.to));
    const set = linesOn.get(k) ?? new Set<string>();
    set.add(s.line);
    linesOn.set(k, set);
  }
  const order = (a: string, b: string) => {
    const da = opts.lineColour.get(a)?.deep === true ? 1 : 0, db = opts.lineColour.get(b)?.deep === true ? 1 : 0;
    return da - db || (a < b ? -1 : a > b ? 1 : 0);
  };
  const lanesOf = new Map<string, string[]>();
  for (const [k, set] of linesOn) lanesOf.set(k, [...set].sort(order));

  const centre = (id: string): readonly [number, number] => g.positions[id] ?? [0, 0];
  const lanes: SceneLane[] = [];
  for (const s of lines.sections.values()) {
    if (s.from === s.to) continue;
    const a = nodeOf(s.from), b = nodeOf(s.to);
    const st = state.sections.get(s.id);
    const colour = opts.lineColour.get(s.line);
    const laneState: LaneState = st?.travelled === true ? 'travelled' : st?.ticket.met === true ? 'open' : 'locked';
    let points: number[];
    if (a === b) {
      /* Zwischen zwei Teilen desselben Blocks: gerade über die Scheibe. */
      const [fx, fy] = centre(s.from), [tx, ty] = centre(s.to);
      points = [fx, fy, tx, ty];
    } else {
      const k = pairKey(a, b);
      const t = trackOf.get(k);
      if (t === undefined) continue;
      const list = lanesOf.get(k) ?? [s.line];
      const off = laneOffset(Math.max(0, list.indexOf(s.line)), list.length);
      const shifted = off === 0 ? [...t.points] : offsetPoints(t.points, off);
      /* Die Spur in der Richtung des Abschnitts. */
      if (t.a === a) points = shifted;
      else { points = []; for (let i = shifted.length - 2; i >= 0; i -= 2) points.push(shifted[i], shifted[i + 1]); }
    }
    lanes.push({
      section: s.id, line: s.line, branch: s.branch, fromId: s.from, toId: s.to, points, from: centre(s.from), to: centre(s.to), fromHome: s.from === HOME_ID,
      fromR: s.from === HOME_ID ? 0 : g.radii[s.from] ?? 28, toR: g.radii[s.to] ?? 28,
      color: colour?.color ?? opts.fallback, deep: colour?.deep === true, state: laneState, symbol: laneState === 'locked' ? st?.ticket.symbol ?? 'knowledge' : null
    });
  }
  const tracks = g.tracks.map((t) => ({ key: pairKey(t.a, t.b), points: t.points, lanes: lanesOf.get(pairKey(t.a, t.b))?.length ?? 1 }));

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const id of Object.keys(g.positions)) { const [x, y] = g.positions[id]; const r = g.radii[id] ?? 28; x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); }
  /* Mitte und der weiteste Rand von ihr aus (enger als die halbe Diagonale: die Welt füllt das Bild). */
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let radius = 60;
  for (const id of Object.keys(g.positions)) { const [x, y] = g.positions[id]; radius = Math.max(radius, Math.hypot(x - cx, y - cy) + (g.radii[id] ?? 28)); }
  const extent = Number.isFinite(x0) ? { cx, cy, radius } : { cx: 0, cy: 0, radius: 200 };
  return { places, byId, blocks, home, tracks, lanes, extent };
}
