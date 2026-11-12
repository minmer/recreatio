/**
 * 2026-11-09 — DIE KAMERA DER WELTKARTE, rein (aus `WorldPillars.tsx`, damit sie prüfbar ist): die Abbildung Boden → Schirm,
 * das Einpassen der ganzen Welt (Step 3 §2.8: nach der gedrehten und geneigten Gestalt, nicht nach einem Kreis — auf dem
 * Telefon bleibt das Bild nicht halb leer), die Grenze des Hineinzoomens und der Ort, zu dem hin gezoomt wird (§2.7).
 */

import type { WorldCam } from '../worldView';

/** Neigung als Stauchung des Bodens: sin(42°) bis sin(88°) — 2026-11-12 (Eigentümer): nicht flacher, damit die Bögen der Abhängigkeiten zu sehen bleiben. */
export const FORE_LOW = Math.sin((42 * Math.PI) / 180);
export const FORE_HIGH = Math.sin((88 * Math.PI) / 180);

/** Die Abbildung: Boden (x, y, Höhe z) → Schirm. */
export interface View { readonly ca: number; readonly sa: number; readonly fore: number; readonly lift: number; readonly s: number; readonly ox: number; readonly oy: number; readonly cx: number; readonly cy: number }

export const viewOf = (c: WorldCam, w: number, h: number): View => {
  const a = (c.rot * Math.PI) / 180;
  const fore = Math.max(FORE_LOW, Math.min(FORE_HIGH, c.fore));
  return { ca: Math.cos(a), sa: Math.sin(a), fore, lift: Math.sqrt(Math.max(0, 1 - fore * fore)), s: c.s, ox: w / 2, oy: h / 2, cx: c.cx, cy: c.cy };
};
export const toScr = (v: View, x: number, y: number, z = 0): [number, number] => {
  const dx = x - v.cx, dy = y - v.cy;
  return [v.ox + (dx * v.ca - dy * v.sa) * v.s, v.oy - (dx * v.sa + dy * v.ca) * v.fore * v.s - z * v.lift * v.s];
};
export const toGrd = (v: View, sx: number, sy: number): [number, number] => {
  const rx = (sx - v.ox) / v.s, ry = -(sy - v.oy) / (v.fore * v.s);
  return [v.cx + rx * v.ca + ry * v.sa, v.cy - rx * v.sa + ry * v.ca];
};
export const depth = (v: View, x: number, y: number) => -(x * v.sa + y * v.ca);

export interface Disk { readonly x: number; readonly y: number; readonly r: number }

/** Wie gross die Welt gedreht und geneigt bei Zoom 1 auf dem Schirm ist (mit Platz für die Säulen nach oben). */
export function projectedBox(disks: readonly Disk[], rot: number, fore: number, up = 60): { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number } {
  const v = viewOf({ s: 1, cx: 0, cy: 0, rot, fore }, 0, 0);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const d of disks) {
    const [x, y] = toScr(v, d.x, d.y, 0);
    x0 = Math.min(x0, x - d.r); x1 = Math.max(x1, x + d.r);
    y0 = Math.min(y0, y - d.r * v.fore - up * v.lift); y1 = Math.max(y1, y + d.r * v.fore);
  }
  if (!Number.isFinite(x0)) return { x0: -100, y0: -100, x1: 100, y1: 100 };
  return { x0, y0, x1, y1 };
}

/** Die ganze Welt ins Bild: nach ihrer gedrehten, geneigten Gestalt eingepasst und mittig. */
export function fitView(disks: readonly Disk[], w: number, h: number, rot: number, fore: number, pad = 12): WorldCam {
  const b = projectedBox(disks, rot, fore);
  const s = Math.max(0.01, Math.min((w - 2 * pad) / Math.max(1, b.x1 - b.x0), (h - 2 * pad) / Math.max(1, b.y1 - b.y0)));
  /* Der Mittelpunkt der Schachtel (bei Zoom 1, um 0/0) zurück auf den Boden. */
  const v = viewOf({ s: 1, cx: 0, cy: 0, rot, fore }, 0, 0);
  const [cx, cy] = toGrd(v, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
  return { s, cx, cy, rot, fore };
}

/** Wie hoch das Bild auf einem schmalen Schirm sein soll, damit die ganze Welt es füllt (Bildpunkte). */
export function stageHeightFor(disks: readonly Disk[], width: number, rot: number, fore: number, min: number, max: number): number {
  const b = projectedBox(disks, rot, fore);
  const h = (width - 24) * ((b.y1 - b.y0) / Math.max(1, b.x1 - b.x0)) + 24;
  return Math.round(Math.max(min, Math.min(max, h)));
}

/** §2.7 — höchstens so nah, dass eine Säule (ihr gezeichneter Durchmesser) ein Drittel des Bildes ist. */
export function maxZoom(disks: readonly Disk[], pillarWidth: number, w: number, h: number): number {
  let r = 28;
  for (const d of disks) r = Math.max(r, d.r);
  return Math.max(0.05, Math.min(w, h) / (3 * 2 * r * pillarWidth));
}

/** §2.7 — wohin hineingezoomt wird: der nächste Ort beim Zeiger (bis `reach` Bildpunkte), sonst der Zeiger selbst. */
export function zoomAnchor(v: View, disks: readonly Disk[], sx: number, sy: number, reach = 240): readonly [number, number] {
  let best: readonly [number, number] = [sx, sy];
  let bd = reach;
  for (const d of disks) {
    const [x, y] = toScr(v, d.x, d.y, 0);
    const dist = Math.hypot(x - sx, y - sy);
    if (dist < bd) { bd = dist; best = [x, y]; }
  }
  return best;
}
