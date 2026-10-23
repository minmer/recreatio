/**
 * LABOR 2D (v2) — GEGENSTÄNDE UND IHRE EINSTELLUNGEN (seit 2026-10-23). Ein
 * Gegenstand ist ein Handgriff, der einen Körper anlegt („body“, „beaker“,
 * „hotplate“), mit einem Namen (`id`); seine Einstellungen stehen an ihm. Die
 * Oberfläche ändert sie hier: der Gegenstand ändert sich an seiner Stelle in
 * der Szene, es kommt kein Handgriff hinzu.
 *
 * - „pinned“ und die Heizung wirken sofort, auch während es läuft: ein
 *   gelöster Gegenstand fällt, ein angehefteter steht still.
 * - Werkstoff, Temperatur, Drehung, Grösse und Deckel ändern den Aufbau: am
 *   Anfang (t = 0) entsteht die Szene mit dem geänderten Gegenstand neu — so,
 *   wie sie beim Laden entstünde; später lehnt die Engine ab (erst „Od nowa“).
 */

import type { Engine } from './engine';
import { solidIndex, SOLIDS } from './materials';
import { isObjectOp, type HeaterMode, type ObjectOp, type Op } from './scene';
import { bounds } from './shapes';

/** Was sich an einem Gegenstand einstellen lässt (SI: K, m, Grad). */
export interface ObjectPatch {
  readonly pinned?: boolean;
  readonly T?: number;
  readonly material?: string;
  readonly angle?: number;
  readonly w?: number;
  readonly h?: number;
  readonly lid?: boolean;
  readonly mode?: HeaterMode;
  readonly power?: number;
  readonly target?: number;
  readonly on?: boolean;
}

/** Ein Gegenstand, wie ihn die Oberfläche zeigt: Name, Art, Umriss (je Rechteck vier Ecken x, y in der Welt), mittlere Temperatur (K), Masse (kg), Zustand. */
export interface ObjectView {
  readonly id: string;
  readonly kind: ObjectOp['op'];
  readonly outline: readonly number[];
  readonly T: number;
  readonly mass: number;
  readonly state: 'pinned' | 'asleep' | 'moving' | 'gone';
}

/** Einstellungen, die sofort wirken; alle anderen bauen am Anfang neu auf. */
const LIVE: ReadonlySet<string> = new Set(['pinned', 'mode', 'power', 'target', 'on']);

/** Der Schlüssel des Gegenstands (die Nummer des Handgriffs, der ihn anlegte); −1: keiner. */
export function objectKey(e: Engine, id: string): number {
  const ops = e.scene.ops;
  for (let k = 0; k < ops.length; k += 1) {
    const op = ops[k];
    if (isObjectOp(op) && op.id === id) return k;
  }
  return -1;
}

/** Der Gegenstand mit den neuen Einstellungen (Grösse um die Mitte eines Klotzes, bei Zlewka und Platte um die Mitte der Unterkante). */
function patched(op: ObjectOp, p: ObjectPatch): ObjectOp {
  const T = p.T ?? op.T;
  const pinned = p.pinned ?? op.pinned;
  const angle = Math.max(-180, Math.min(180, p.angle ?? op.angle));
  const material = p.material !== undefined && solidIndex(p.material) >= 0 ? p.material : op.material;
  const size = (v: number | undefined, old: number, lo: number, hi: number): number => (v === undefined || !Number.isFinite(v) ? old : Math.max(lo, Math.min(hi, v)));
  switch (op.op) {
    case 'body': {
      const [x0, y0, x1, y1] = bounds(op.region);
      if (p.w === undefined && p.h === undefined) return { ...op, T, pinned, angle, material };
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const w = size(p.w, x1 - x0, 0.002, 0.5);
      const h = size(p.h, y1 - y0, 0.002, 0.5);
      return { ...op, region: { rect: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2] }, T, pinned, angle, material };
    }
    case 'beaker':
      return { ...op, T, pinned, angle, material, w: size(p.w, op.w, 0.01, 1), h: size(p.h, op.h, 0.01, 1), lid: p.lid ?? op.lid };
    case 'hotplate':
      return {
        ...op, T, pinned, angle, material, w: size(p.w, op.w, 0.005, 1), h: size(p.h, op.h, 0.002, 0.1),
        mode: p.mode ?? op.mode, power: Math.max(0, p.power ?? op.power), target: p.target ?? op.target, on: p.on ?? op.on
      };
  }
}

/**
 * Einstellungen eines Gegenstands ändern. Liefert, ob die Szene neu aufgebaut wurde, und eine Warnung (oder null;
 * beginnt sie mit „refused“, geschah nichts).
 */
export function editObject(e: Engine, id: string, patch: ObjectPatch): { rebuilt: boolean; warning: string | null } {
  const key = objectKey(e, id);
  if (key < 0) return { rebuilt: false, warning: `object: no "${id}"` };
  const op = e.scene.ops[key] as ObjectOp;
  const next = patched(op, patch);
  const ops: Op[] = [...e.scene.ops];
  ops[key] = next;
  const structural = Object.entries(patch).some(([k, v]) => v !== undefined && !LIVE.has(k));
  if (structural) {
    if (e.time > 0) return { rebuilt: false, warning: 'refused: this setting changes the set-up — change it at the start' };
    e.load({ ...e.scene, ops, quality: e.currentQuality });
    return { rebuilt: true, warning: null };
  }
  e.scene = { ...e.scene, ops };
  for (const b of e.bodies.list) {
    if (b.gone || b.key !== key) continue;
    if (patch.pinned !== undefined) e.bodies.pin(b, patch.pinned);
    if (next.op === 'hotplate' && b.heater >= 0) e.setHeater(b.heater, next.mode, next.power, next.target, next.on);
  }
  return { rebuilt: false, warning: null };
}

/** Der Gegenstand für die Oberfläche (null: kein solcher Name). */
export function objectView(e: Engine, id: string): ObjectView | null {
  const key = objectKey(e, id);
  if (key < 0) return null;
  const op = e.scene.ops[key] as ObjectOp;
  const outline: number[] = [];
  let mass = 0;
  let CT = 0;
  let C = 0;
  let state: ObjectView['state'] = 'gone';
  for (const b of e.bodies.list) {
    if (b.gone || b.key !== key) continue;
    const cs = Math.cos(b.a);
    const sn = Math.sin(b.a);
    for (let r = 0; r < b.nr; r += 1) {
      const [x0, y0, x1, y1] = b.bounds(r);
      for (const [lx, ly] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) outline.push(b.x + cs * lx - sn * ly, b.y + sn * lx + cs * ly);
    }
    mass += b.m;
    const c = b.m * SOLIDS[b.mat].cp;
    CT += c * b.meanT();
    C += c;
    const s = b.pinned ? 'pinned' : b.asleep ? 'asleep' : 'moving';
    if (state === 'gone' || s === 'moving') state = s;
  }
  return { id, kind: op.op, outline, T: C > 0 ? CT / C : op.T, mass, state };
}

