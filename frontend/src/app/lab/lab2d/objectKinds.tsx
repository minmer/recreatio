/**
 * LABOR 2D (v2) — WAS SICH HINZUFÜGEN LÄSST (Oberfläche, seit 2026-10-23):
 * Gegenstände — Klötze aus einem Werkstoff (die Eiswürfel, Holz, Stein, Glas,
 * Stahl), die Zlewka und die Heizplatte. Ein Klick stellt einen Gegenstand in
 * üblicher Grösse hin, ein gezogenes Rechteck gibt ihm Lage und Grösse. Jeder
 * bekommt einen Namen (`id`), unter dem ihn die Oberfläche wählt; seine
 * Einstellungen (angeheftet, Temperatur …) stellt man danach im Feld
 * „Przedmiot“ ein.
 */

import type { Op } from './engine/scene';
import { SOLIDS } from './engine/materials';
import type { TextKey } from './i18n';

export type ObjectKind = 'ice' | 'wood' | 'stone' | 'glass' | 'steel' | 'beaker' | 'hotplate';

/** Die Gegenstände zum Hinzufügen: Beschriftung, Werkstoff, übliche Grösse (m) und Temperatur (°C). */
export const OBJECT_KINDS: readonly { readonly key: ObjectKind; readonly label: TextKey; readonly material: string; readonly w: number; readonly h: number; readonly T: number }[] = [
  { key: 'ice', label: 'objIce', material: 'ice', w: 0.02, h: 0.02, T: -5 },
  { key: 'wood', label: 'objWood', material: 'wood', w: 0.04, h: 0.02, T: 20 },
  { key: 'stone', label: 'objStone', material: 'stone', w: 0.02, h: 0.02, T: 20 },
  { key: 'glass', label: 'objGlass', material: 'glass', w: 0.02, h: 0.02, T: 20 },
  { key: 'steel', label: 'objSteel', material: 'steel', w: 0.02, h: 0.02, T: 20 },
  { key: 'beaker', label: 'appBeaker', material: 'glass', w: 0.07, h: 0.08, T: 20 },
  { key: 'hotplate', label: 'appHotplate', material: 'steel', w: 0.12, h: 0.008, T: 20 }
];

const T0 = 273.15;
type Rect = [number, number, number, number];

/** So nah (m) über dem Boden oder einer Zlewka/Platte darunter rastet eine neue Zlewka oder Platte darauf ein. */
const SNAP = 0.012;

/** Die Rechtecke der Zlewki und Platten aus dem JSON der Szene, verschoben von den späteren „move“-Handgriffen (mit Namen oder einer Fläche um ihre Mitte). */
export function apparatusRects(ops: readonly Record<string, unknown>[]): Rect[] {
  const rects: Rect[] = [];
  const ids: string[] = [];
  for (const op of ops) {
    if ((op.op === 'beaker' || op.op === 'hotplate') && typeof op.x === 'number' && typeof op.y === 'number' && typeof op.w === 'number' && typeof op.h === 'number') {
      rects.push([op.x - op.w / 2, op.y, op.x + op.w / 2, op.y + op.h]);
      ids.push(typeof op.id === 'string' ? op.id : '');
      continue;
    }
    if (op.op !== 'move' || typeof op.dx !== 'number' || typeof op.dy !== 'number') continue;
    const dx = op.dx;
    const dy = op.dy;
    const shift = (q: Rect): void => { q[0] += dx; q[2] += dx; q[1] += dy; q[3] += dy; };
    if (typeof op.id === 'string') { const k = ids.indexOf(op.id); if (k >= 0) shift(rects[k]); continue; }
    const region = op.region as { rect?: unknown } | undefined;
    const m = Array.isArray(region?.rect) ? (region?.rect as number[]) : null;
    if (m === null || m.length !== 4) continue;
    for (const q of rects) {
      const cx = (q[0] + q[2]) / 2;
      const cy = (q[1] + q[3]) / 2;
      if (cx >= m[0] && cx <= m[2] && cy >= m[1] && cy <= m[3]) shift(q);
    }
  }
  return rects;
}

/** Der Name, den ein neuer Gegenstand dieser Art bekommt: „Art-Nummer“, die die Szene noch nicht hat. */
function freshName(ops: readonly Record<string, unknown>[], kind: string): string {
  const used = new Set(ops.map((op) => (typeof op.id === 'string' ? op.id : '')));
  let n = 1;
  while (used.has(`${kind}-${n}`)) n += 1;
  return `${kind}-${n}`;
}

/**
 * Der Handgriff, der einen Gegenstand anlegt: ein Klick bei `a` (b ≈ a) stellt ihn in üblicher Grösse hin — einen Klotz
 * mit der Mitte dort, eine Zlewka oder Platte mit der Mitte ihrer Unterkante dort (dicht über dem Boden oder einem
 * Gerät darunter steht sie darauf); ein gezogenes Rechteck a–b gibt Lage und Grösse.
 */
export function newObjectOp(kind: ObjectKind, a: readonly [number, number], b: readonly [number, number], dragged: boolean, ops: readonly Record<string, unknown>[]): Op {
  const spec = OBJECT_KINDS.find((k) => k.key === kind) ?? OBJECT_KINDS[0];
  const T = T0 + spec.T;
  const x0 = Math.min(a[0], b[0]);
  const x1 = Math.max(a[0], b[0]);
  const y0 = Math.max(0, Math.min(a[1], b[1]));
  const y1 = Math.max(a[1], b[1]);
  if (kind === 'beaker' || kind === 'hotplate') {
    let x = a[0];
    let y = Math.max(0, a[1]);
    let w = spec.w;
    let h = spec.h;
    if (dragged) {
      x = (x0 + x1) / 2;
      y = y0;
      w = Math.max(kind === 'beaker' ? 0.02 : 0.02, x1 - x0);
      h = Math.max(kind === 'beaker' ? 0.02 : 0.002, y1 - y0);
    } else {
      let base = 0;
      for (const r of apparatusRects(ops)) if (r[2] > x - w / 2 && r[0] < x + w / 2 && r[3] <= y + SNAP && r[3] > base) base = r[3];
      if (y - base < SNAP) y = base;
    }
    const id = freshName(ops, kind);
    return kind === 'beaker'
      ? { op: 'beaker', id, x, y, w, h, wall: 0.002, material: spec.material, T, lid: false, pinned: true, angle: 0 }
      : { op: 'hotplate', id, x, y, w, h, material: spec.material, T, mode: 'power', power: 40, target: T0 + 150, on: true, pinned: true, angle: 0 };
  }
  const rect: Rect = dragged
    ? [x0, y0, x1, y1]
    : [a[0] - spec.w / 2, Math.max(0, a[1] - spec.h / 2), a[0] + spec.w / 2, Math.max(0, a[1] - spec.h / 2) + spec.h];
  return { op: 'body', id: freshName(ops, 'body'), region: { rect }, material: spec.material, T, pinned: false, angle: 0 };
}

/** Die Farbe eines Werkstoffs (für die Muster in der Palette). */
export const solidColor = (id: string): string => SOLIDS.find((s) => s.id === id)?.color ?? '#888888';

/** Ein Muster für die Palette: ein Klotz in seiner Farbe, die Zlewka, die Platte. */
export function KindIcon({ kind }: { kind: ObjectKind }) {
  if (kind === 'beaker') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v17h12V3" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M7 12h10v7H7z" fill="#3d8fd8" opacity="0.6" /></svg>;
  if (kind === 'hotplate') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="14" width="20" height="6" rx="1" fill="#7d858e" /><path d="M6 17h12" stroke="#e8823a" strokeWidth="2" /></svg>;
  const spec = OBJECT_KINDS.find((k) => k.key === kind) ?? OBJECT_KINDS[0];
  const wide = spec.w > spec.h;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x={wide ? 3 : 6} y={wide ? 8 : 6} width={wide ? 18 : 12} height={wide ? 9 : 12} rx="1.5" fill={solidColor(spec.material)} stroke="currentColor" strokeOpacity="0.4" /></svg>;
}
