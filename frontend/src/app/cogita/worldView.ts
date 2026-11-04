/**
 * 2026-11-04 (Prompt 13, C1/C4/C6) — WIE DIE EINE LANDSCHAFT AUF DEN SCHIRM KOMMT (rein gerechnet, ohne React): die Kamera
 * des Lernenden (Mitte, Zoom, Drehung in 60°-Schritten, Neigung von der Seite bis von oben — nie von selbst geändert), EINE
 * feste Stufenhöhe für alle Felder, und welche Namen bei welchem Zoom stehen (nie zwei übereinander, je Gebiet höchstens
 * einer). Geprüft in `scripts/app-worldmap-check.mjs`.
 */

import { HEX_CORNER } from './levelMap';

/** Die Höhe eines Schrittes (Bodeneinheiten): eine für alle Felder, bei jedem Zoom und jeder Neigung. */
export const STEP = 0.1;
/** Die flachste Neigung (fast von der Seite) und von oben. */
export const FORE_MIN = 0.25;
export const FORE_MAX = 1;
/** Wie die Karte zuerst gesehen wird. */
export const FORE_START = 0.62;

export interface WorldCam {
  /** Bildpunkte je Bodeneinheit. */
  readonly s: number;
  /** Die Mitte (Boden, ungedreht). */
  readonly cx: number;
  readonly cy: number;
  /** Drehung in Grad (in Schritten von 60°, im Übergang dazwischen). */
  readonly rot: number;
  /** Neigung: wie stark die Tiefe des Bodens gestaucht ist (1 — von oben). */
  readonly fore: number;
}

/** Die Projektion einer Kamera: Boden (x, y) und Höhe (in Schritten) → Schirm. */
export interface Projection {
  readonly ca: number;
  readonly sa: number;
  readonly fore: number;
  /** Wie viel einer Höhe zu sehen ist (von oben: nichts). */
  readonly lift: number;
  readonly s: number;
  readonly ox: number;
  readonly oy: number;
  readonly cx: number;
  readonly cy: number;
  /** Die sechs Ecken einer Kachel, gedreht und geneigt (Bildpunkte, von der Mitte). */
  readonly corners: readonly (readonly [number, number])[];
}

export function projection(cam: WorldCam, width: number, height: number): Projection {
  const a = (cam.rot * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const fore = Math.max(FORE_MIN, Math.min(FORE_MAX, cam.fore));
  const lift = Math.sqrt(Math.max(0, 1 - fore * fore));
  const corners = [0, 60, 120, 180, 240, 300].map((d) => {
    const x = Math.cos((d * Math.PI) / 180) * HEX_CORNER;
    const y = Math.sin((d * Math.PI) / 180) * HEX_CORNER;
    const rx = x * ca - y * sa;
    const ry = x * sa + y * ca;
    return [rx * cam.s, -ry * fore * cam.s] as const;
  });
  return { ca, sa, fore, lift, s: cam.s, ox: width / 2, oy: height / 2, cx: cam.cx, cy: cam.cy, corners };
}

/** Ein Punkt am Boden (mit `steps` Schritten Höhe) auf dem Schirm. */
export function toScreen(p: Projection, x: number, y: number, steps = 0): [number, number] {
  const dx = x - p.cx;
  const dy = y - p.cy;
  const rx = dx * p.ca - dy * p.sa;
  const ry = dx * p.sa + dy * p.ca;
  return [p.ox + rx * p.s, p.oy - ry * p.fore * p.s - steps * STEP * p.lift * p.s];
}

/** Wie tief ein Punkt liegt (grösser: weiter vorn) — die Reihenfolge des Zeichnens. */
export function depthOf(p: Projection, x: number, y: number): number {
  return -(x * p.sa + y * p.ca);
}

/** Ein Punkt des Schirms → der Boden darunter (Höhe 0). */
export function toGround(cam: WorldCam, width: number, height: number, sx: number, sy: number): [number, number] {
  const a = (cam.rot * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const fore = Math.max(FORE_MIN, Math.min(FORE_MAX, cam.fore));
  const rx = (sx - width / 2) / cam.s;
  const ry = -(sy - height / 2) / (fore * cam.s);
  return [cam.cx + rx * ca + ry * sa, cam.cy - rx * sa + ry * ca];
}

/** Die Kamera, die ein Stück Boden (Mitte, Halbmesser) ganz zeigt. */
export function fitCam(cam: WorldCam, width: number, height: number, x: number, y: number, radius: number): WorldCam {
  const fore = Math.max(FORE_MIN, Math.min(FORE_MAX, cam.fore));
  const r = Math.max(0.8, radius);
  const s = Math.max(1, Math.min((width - 24) / (2 * r), (height - 24) / (2 * r * fore + r * 0.35)));
  return { ...cam, s, cx: x, cy: y };
}

/* -- Namen nach dem Zoom -------------------------------------------------------------------------------------- */

export interface LabelCandidate {
  readonly key: string;
  readonly text: string;
  /** Mitte auf dem Schirm. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Wichtiger zuerst (grösser). */
  readonly weight: number;
  /** Wie deutlich (0–1): blendet mit dem Zoom ein und aus. */
  readonly alpha: number;
}

export interface PlacedLabel extends LabelCandidate {
  /** Gezeigt (sonst ausgeblendet — es deckte einen wichtigeren). */
  readonly shown: boolean;
}

/** Nie zwei Namen übereinander: der weniger wichtige fällt weg (er blendet aus); nur im Bild. */
export function placeLabels(list: readonly LabelCandidate[], width: number, height: number): PlacedLabel[] {
  const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const sorted = [...list].sort((a, b) => b.weight - a.weight || (a.key < b.key ? -1 : 1));
  const out: PlacedLabel[] = [];
  for (const l of sorted) {
    const box = { x0: l.x - l.w / 2 - 3, x1: l.x + l.w / 2 + 3, y0: l.y - l.h / 2 - 2, y1: l.y + l.h / 2 + 2 };
    const inView = box.x1 > 0 && box.x0 < width && box.y1 > 0 && box.y0 < height;
    const free = l.alpha > 0.05 && inView && !placed.some((p) => p.x0 < box.x1 && box.x0 < p.x1 && p.y0 < box.y1 && box.y0 < p.y1);
    if (free) placed.push(box);
    out.push({ ...l, shown: free });
  }
  return out;
}

/**
 * WELCHE GEBIETE EINEN NAMEN TRAGEN: ein Gebiet, das auf dem Schirm gross genug ist (sein Durchmesser über `MIN_D`), solange
 * es nicht so gross ist, dass seine Teilgebiete übernehmen (über `MAX_D`) — und nur, wenn das Gebiet darüber schon so gross
 * ist (sonst trägt jenes den Namen). Fern: nur die obersten; näher: die Teilgebiete im Bild; nah: keine (die Themen selbst).
 * `alpha` blendet an den Grenzen weich ein und aus.
 */
export const MIN_D = 64;
export const MAX_D = 820;
export function regionLabelAlpha(diameter: number, parentDiameter: number | null, leaf: boolean): number {
  const up = Math.max(0, Math.min(1, (diameter - MIN_D) / 30));
  const down = Math.max(0, Math.min(1, (MAX_D * (leaf ? 1.6 : 1) - diameter) / 220));
  const parent = parentDiameter === null ? 1 : Math.max(0, Math.min(1, (parentDiameter - MAX_D + 220) / 220));
  return up * down * parent;
}

/** Wie gross eine Kachel auf dem Schirm ist (Breite, Bildpunkte). */
export const cellPx = (cam: WorldCam): number => 2 * HEX_CORNER * cam.s;
/** Ab wann ein Klick ein Thema wählt (sonst zoomt er in das Gebiet), Zeichen und Namen der Themen erscheinen. */
export const PICK_PX = 44;
export const SIGN_PX = 14;
export const NAME_PX = 46;
