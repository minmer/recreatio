/**
 * 2026-11-04 (Prompt 13, C1/C4/C6) — WIE DIE EINE LANDSCHAFT AUF DEN SCHIRM KOMMT (rein gerechnet, ohne React): die Kamera
 * des Lernenden (Mitte, Zoom, Drehung in 60°-Schritten, Neigung von der Seite bis von oben — nie von selbst geändert), EINE
 * feste Stufenhöhe für alle Felder, und welche Namen bei welchem Zoom stehen (nie zwei übereinander, je Gebiet höchstens
 * einer). Geprüft in `scripts/app-worldmap-check.mjs`.
 */

import { HEX_CORNER } from './levelMap';

/** Die Höhe eines Schrittes (Bodeneinheiten) in einer tiefen Baza — eine für alle Felder, bei jedem Zoom und jeder Neigung. */
export const STEP = 0.1;

/**
 * 2026-11-04 (Prompt 14, 6) — DIE STUFE NACH DER BAZA: `levels` ist die längste Kette der Baza (vom Tal bis zum höchsten
 * Thema). Eine flache Baza (wenige Stufen) bekäme sonst kaum sichtbare Unterschiede: je weniger Stufen, desto höher jede —
 * so ist das höchste Feld etwa 1,8 Bodeneinheiten hoch, höchstens 0,6 je Stufe. Ab 18 Stufen bleibt es bei `STEP` (eine
 * tiefe Baza sieht aus wie bisher). Für alle Felder einer Baza dieselbe.
 */
export function stepFor(levels: number): number {
  const n = Math.max(1, Math.round(levels));
  return Math.max(STEP, Math.min(0.6, 1.8 / n));
}
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
  /** Die Höhe eines Schrittes dieser Baza (`stepFor`). */
  readonly step: number;
  readonly s: number;
  readonly ox: number;
  readonly oy: number;
  readonly cx: number;
  readonly cy: number;
  /** Die sechs Ecken einer Kachel, gedreht und geneigt (Bildpunkte, von der Mitte). */
  readonly corners: readonly (readonly [number, number])[];
}

export function projection(cam: WorldCam, width: number, height: number, step = STEP): Projection {
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
  return { ca, sa, fore, lift, step, s: cam.s, ox: width / 2, oy: height / 2, cx: cam.cx, cy: cam.cy, corners };
}

/** Ein Punkt am Boden (mit `steps` Schritten Höhe) auf dem Schirm. */
export function toScreen(p: Projection, x: number, y: number, steps = 0): [number, number] {
  const dx = x - p.cx;
  const dy = y - p.cy;
  const rx = dx * p.ca - dy * p.sa;
  const ry = dx * p.sa + dy * p.ca;
  return [p.ox + rx * p.s, p.oy - ry * p.fore * p.s - steps * p.step * p.lift * p.s];
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

/*
 * 2026-11-04 (Prompt 14, 3; geändert vom Nutzer) — WAS IN DEN KACHELN STEHT, für ALLE Kacheln im Bild gleich (je Zoom ein
 * Aussehen):
 * <code>
 *   Namen     ab `NAME_PX` je Kachel nur eine Angabe: ihr Name (bis zu zwei Zeilen, gekürzt mit „…")
 *   tief      ab `DETAIL_PX` (nur noch 2–5 Kacheln im Bild) alles, was es über das Thema zu sagen gibt: ein Ring mit dem
 *             Anteil des Gekonnten, der Name (bis zu drei Zeilen), was noch zu tun ist und die Einzelheiten (`detail`)
 * </code>
 * Jede Zeile so breit, wie der Kreis auf der Oberseite auf ihrer Höhe ist (eine Sehne) — nie gestaucht, nie in eine Spalte
 * gebrochen. Gezeichnet mit der Neigung (die Höhe gestaucht wie die Fläche) und mit der Drehung der Kachel (höchstens ±30°,
 * die Kachel sieht alle 60° gleich aus — so bleibt es lesbar); zu steil: nichts.
 */
export const NAME_PX = 56;
/**
 * Wie viele Kacheln bei diesem Zoom ins Bild passen: die Fläche des Bildes durch die Fläche einer Kachel auf dem Schirm
 * (gestaucht mit der Neigung). Daraus: ab wann die Einzelheiten stehen (höchstens etwa sieben Kacheln im Bild) und der
 * tiefste Zoom (etwa drei).
 */
const sForTiles = (width: number, height: number, fore: number, tiles: number): number => Math.sqrt((width * height) / (((3 * Math.sqrt(3)) / 2) * HEX_CORNER * HEX_CORNER * Math.max(FORE_MIN, fore) * tiles));
export const detailPx = (width: number, height: number, fore = 1): number => 2 * HEX_CORNER * sForTiles(width, height, fore, 7);
export const deepestS = (width: number, height: number, fore = 1): number => Math.max(120, sForTiles(width, height, fore, 4));
/** Steiler als so (Neigung) ist die Oberseite nicht mehr zu lesen: kein Text. */
export const INFO_FORE = 0.5;

export interface InfoLine { readonly text: string; readonly y: number; readonly size: number; readonly bold: boolean }

/**
 * Die Zeilen in einem Kreis vom Halbmesser `r` (Bildpunkte, Mitte 0). `detail` leer: nur der Name (die Ebene der Namen);
 * sonst oben der Ring (`ringY`), der Name, was zu tun ist und die Einzelheiten. `measure`: Breite eines Textes.
 */
export function fitInfo(name: string, todo: string, detail: readonly string[] | null, r: number, measure: (text: string, size: number, bold: boolean) => number): { lines: InfoLine[]; ringY: number; ringR: number; ring: boolean } {
  const deep = detail !== null;
  const size = deep ? Math.max(11, Math.min(30, r * 0.15)) : Math.max(9, Math.min(20, r * 0.27));
  const small = Math.max(8, size * 0.72);
  const chord = (y: number, h: number) => 2 * Math.sqrt(Math.max(0, r * r - (Math.abs(y) + h / 2) ** 2)) * 0.9;
  const cut = (text: string, width: number, s: number, bold: boolean): string => {
    if (measure(text, s, bold) <= width) return text;
    let lo = 0; let hi = text.length;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (measure(`${text.slice(0, m).trimEnd()}…`, s, bold) <= width) lo = m; else hi = m - 1; }
    return lo <= 1 ? '' : `${text.slice(0, lo).trimEnd()}…`;
  };
  /* Der Name an Wortgrenzen auf höchstens `max` Zeilen ab `y0`; die letzte gekürzt. */
  const nameLines = (y0: number, max: number): InfoLine[] => {
    const words = name.split(/\s+/).filter((w) => w !== '');
    const out: InfoLine[] = [];
    let k = 0;
    for (let line = 0; line < max && k < words.length; line += 1) {
      const y = y0 + line * size * 1.15;
      const w = chord(y, size);
      if (line === max - 1) { out.push({ text: cut(words.slice(k).join(' '), w, size, true), y, size, bold: true }); k = words.length; break; }
      let text = '';
      while (k < words.length && measure(text === '' ? words[k] : `${text} ${words[k]}`, size, true) <= w) { text = text === '' ? words[k] : `${text} ${words[k]}`; k += 1; }
      if (text === '') { text = cut(words[k], w, size, true); k += 1; }
      out.push({ text, y, size, bold: true });
    }
    return out;
  };
  if (!deep) {
    /* Nur der Name, in der Mitte der Fläche. */
    const two = measure(name, size, true) > chord(0, size);
    const lines = nameLines(two ? -size * 0.58 : 0, 2);
    return { lines: lines.filter((l) => l.text !== ''), ringY: 0, ringR: 0, ring: false };
  }
  const ringR = size * 0.75;
  const ringY = -r * 0.5;
  const lines = nameLines(-r * 0.2, 3);
  let y = (lines[lines.length - 1]?.y ?? -r * 0.2) + size * 1.25;
  for (const text of [todo, ...detail]) {
    if (text === '' || y > r * 0.78) continue;
    const s = text === todo ? small * 1.08 : small;
    lines.push({ text: cut(text, chord(y, s), s, text === todo), y, size: s, bold: text === todo });
    y += s * 1.3;
  }
  return { lines: lines.filter((l) => l.text !== ''), ringY, ringR, ring: true };
}

/** Der Winkel, um den der Text in einer Kachel gedreht steht: die Drehung der Kamera, auf ±30° gebracht (Grad). */
export const infoAngle = (rot: number): number => { const a = (((-rot % 60) + 60) % 60); return a > 30 ? a - 60 : a; };

/** Wie gross eine Kachel auf dem Schirm ist (Breite, Bildpunkte). */
export const cellPx = (cam: WorldCam): number => 2 * HEX_CORNER * cam.s;
/** Ab wann ein Klick ein Thema wählt (sonst zoomt er in das Gebiet), Zeichen und Namen der Themen erscheinen. */
export const PICK_PX = 44;
export const SIGN_PX = 14;
