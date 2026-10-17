/**
 * 0108 — EINE ZEICHNUNG MIT BEWEGUNG („Animacja"): Flächen, Linien, Punkte,
 * Texte und Bilder in einem eigenen Koordinatenraum, jedes Teil mit denselben
 * Bewegungen wie alles andere (`motion.ts`: move, size, turn, fade, draw,
 * color, reveal, keys — und die Vorlagen).
 *
 * <b>Warum ein Rahmen und nicht Bausteine:</b> ein bewegtes Bild hat
 * Dutzende Teile (die Mapa wiedzy des Altbestands: dreissig Knoten, vierzig
 * Wege, ein Wanderer) — eine Seite hat höchstens sechzig Bausteine. Und ein
 * Bild soll als Ganzes wachsen und schrumpfen: in seinem Raum (`size`) sind
 * alle Masse Einheiten dieses Raums, gezeichnet wird es als SVG in der Breite,
 * die der Baustein hat.
 *
 * <code>
 *   { "size": [560, 440],
 *     "symbols": [{ "name": "fiszka", "shapes": [ … ] }],          wiederverwendbare Teile
 *     "elements": [
 *       { "type": "rect", "x": 10, "y": 10, "w": 190, "h": 130, "r": 14, "fill": "#0b1826", "stroke": "accent/35", … },
 *       { "type": "use", "use": "fiszka", "x": 280, "y": 180, "shift": 120, "motion": { "name": "keys", … } },
 *       { "type": "group", "x": 0, "y": 0, "children": [ … ], "motion": … } ] }
 * </code>
 *
 * Duldsam wie jeder Leser hier: was nicht passt, fällt weg; nichts wirft.
 */

import { colorValue, glowValue, readMotions, type MotionUse } from './motion';
import type { RawConfig } from './part';

export const SHAPE_TYPES = ['rect', 'circle', 'ellipse', 'line', 'path', 'text', 'image', 'group', 'use'] as const;
export type ShapeType = (typeof SHAPE_TYPES)[number];

export interface Shape {
  readonly type: ShapeType;
  /** rect, image: linke obere Ecke · circle, ellipse, text: Mitte/Anker · line: Anfang · group, use: Verschiebung. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** circle: Halbmesser · rect: Rundung der Ecken. */
  readonly r: number;
  /** line: Ende. */
  readonly x2: number;
  readonly y2: number;
  readonly d: string | null;
  readonly text: string;
  readonly size: number;
  readonly weight: number;
  readonly anchor: 'start' | 'middle' | 'end';
  readonly url: string | null;
  readonly use: string | null;
  /** Farbe (`motion.ts`: colorValue), `none`, oder ein Schein `radial(Farbe, Farbe 70%)`. */
  readonly fill: string | null;
  readonly stroke: string | null;
  readonly width: number;
  readonly cap: 'round' | 'butt' | 'square';
  readonly opacity: number;
  readonly blur: number;
  readonly glow: string | null;
  /** Um welchen Punkt sich das Teil dreht und wächst: `center` (Vorgabe), „25% 75%" (vom Teil), „170 225" (Einheiten). */
  readonly origin: string | null;
  /** group, use: feste Grösse und Drehung (zur Verschiebung dazu). */
  readonly scale: number;
  readonly rotate: number;
  readonly children: readonly Shape[];
  /** group, use: so viele ms später laufen die Bewegungen DARIN (nicht die eigenen). */
  readonly shift: number;
  readonly motion: readonly MotionUse[];
}

export interface Drawing {
  readonly w: number;
  readonly h: number;
  readonly alt: string;
  readonly symbols: ReadonlyMap<string, readonly Shape[]>;
  readonly elements: readonly Shape[];
  /** Höchstens so breit (rem); `null`: so breit wie der Platz. */
  readonly max: number | null;
}

export const EMPTY_DRAWING: Drawing = { w: 100, h: 100, alt: '', symbols: new Map(), elements: [], max: null };

/** Wie viele Teile eine Zeichnung höchstens hat (mit den Teilen der Vorlagen) — und wie tief sie geschachtelt ist. */
export const DRAWING_LIMITS = { shapes: 2500, depth: 8, symbols: 40 } as const;

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};

const num = (value: unknown, fallback: number, min = -100000, max = 100000): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

const PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9 .,\-+eE]{1,20000}$/;

/** Ein Pfad: nur die Buchstaben und Zahlen eines SVG-Pfads. */
export const safePath = (value: unknown): string | null =>
  typeof value === 'string' && PATH.test(value.trim()) ? value.trim() : null;

/** Ein Bild: eine Adresse hier (`/…`), im Netz (`https://…`) oder ein Bild der Seite (`page-image:…`). */
export const safeUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  return /^(https?:\/\/|\/(?!\/)|page-image:)[^\s"'<>\\]{1,400}$/i.test(url) ? url : null;
};

/** Eine Füllung: eine Farbe, oder ein Schein `radial(innen, aussen 70%)`. */
export function fillValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = /^radial\((.+)\)$/.exec(value.trim());
  if (m === null) return colorValue(value);
  return radialOf(value.trim()) === null ? null : value.trim();
}

/** `radial(innen, aussen 70%)` → die zwei Farben und wo die äussere erreicht ist. */
export function radialOf(value: string): { inner: string; outer: string; stop: number } | null {
  const m = /^radial\(\s*(.+?)\s*,\s*([^,]+?)(?:\s+(\d{1,3})%)?\s*\)$/.exec(value);
  if (m === null) return null;
  const inner = colorValue(m[1]);
  const outer = colorValue(m[2]);
  if (inner === null || outer === null) return null;
  return { inner, outer, stop: m[3] === undefined ? 100 : Math.min(100, Number(m[3])) };
}

const ORIGIN = /^(center|-?[\d.]+%?\s+-?[\d.]+%?)$/;

function readShape(value: unknown, depth: number, budget: { left: number }): Shape | null {
  if (budget.left <= 0 || depth > DRAWING_LIMITS.depth) return null;
  const one = record(value);
  const type = typeof one.type === 'string' ? one.type as ShapeType : 'rect';
  if (!SHAPE_TYPES.includes(type)) return null;
  budget.left -= 1;
  const children = type === 'group' && Array.isArray(one.children)
    ? one.children.map((c) => readShape(c, depth + 1, budget)).filter((c): c is Shape => c !== null)
    : [];
  const anchor = one.anchor === 'start' || one.anchor === 'end' ? one.anchor : 'middle';
  const cap = one.cap === 'butt' || one.cap === 'square' ? one.cap : 'round';
  return {
    type,
    x: num(one.x, 0), y: num(one.y, 0), w: num(one.w, 0, 0), h: num(one.h, 0, 0), r: num(one.r, 0, 0),
    x2: num(one.x2, 0), y2: num(one.y2, 0),
    d: type === 'path' ? safePath(one.d) : null,
    text: type === 'text' && typeof one.text === 'string' ? one.text.slice(0, 200) : '',
    size: num(one.size, 16, 1, 1000), weight: Math.round(num(one.weight, 400, 100, 900)), anchor,
    url: type === 'image' ? safeUrl(one.url) : null,
    use: type === 'use' && typeof one.use === 'string' ? one.use.trim().slice(0, 40) : null,
    fill: fillValue(one.fill), stroke: colorValue(one.stroke), width: num(one.width, 1, 0, 1000), cap,
    opacity: num(one.opacity, 1, 0, 1), blur: num(one.blur, 0, 0, 200), glow: glowValue(one.glow),
    origin: typeof one.origin === 'string' && ORIGIN.test(one.origin.trim()) ? one.origin.trim() : null,
    scale: num(one.scale, 1, 0.001, 1000), rotate: num(one.rotate, 0, -3600, 3600),
    children,
    shift: Math.round(num(one.shift, 0, -600000, 600000)),
    motion: readMotions(one.motion)
  };
}

/**
 * Ein gespeicherter Schlüssel als JSON. Eine ältere Fassung der Seite kannte
 * `size`/`symbols`/`elements` nicht und schrieb eine Liste als Zeilen (ein
 * Wert je Zeile, `part.ts` storedOf 'lines') — auch die liest sich hier.
 */
const parse = (text: string | undefined): unknown => {
  if (text === undefined || text.trim() === '') return undefined;
  try { return JSON.parse(text) as unknown; } catch { /* vielleicht Zeilen */ }
  try { return text.split('\n').filter((line) => line.trim() !== '').map((line) => JSON.parse(line) as unknown); } catch { return undefined; }
};

/** Eine Zeichnung aus der gespeicherten Tafel des Bausteins (`size`, `symbols`, `elements` als JSON). */
export function readDrawing(raw: RawConfig): Drawing {
  /* Ein einzelnes Teil ohne Klammern (so auch eine Liste aus EINER Zeile) ist eine Liste aus einem. */
  const list = (value: unknown): unknown => (typeof value === 'object' && value !== null && !Array.isArray(value) ? [value] : value);
  return drawingOf({ size: parse(raw.size), symbols: list(parse(raw.symbols)), elements: list(parse(raw.elements)), alt: raw.alt, max: parse(raw.max) });
}

/** Eine Zeichnung aus einem Objekt — `size` [Breite, Höhe], `symbols` [{ name, shapes }], `elements`. */
export function drawingOf(value: unknown): Drawing {
  const one = record(value);
  const size = Array.isArray(one.size) ? one.size : [];
  const budget = { left: DRAWING_LIMITS.shapes };
  const symbols = new Map<string, Shape[]>();
  for (const raw of (Array.isArray(one.symbols) ? one.symbols : []).slice(0, DRAWING_LIMITS.symbols)) {
    const s = record(raw);
    const name = typeof s.name === 'string' ? s.name.trim().slice(0, 40) : '';
    if (name === '' || symbols.has(name)) continue;
    symbols.set(name, (Array.isArray(s.shapes) ? s.shapes : []).map((c) => readShape(c, 1, budget)).filter((c): c is Shape => c !== null));
  }
  const elements = (Array.isArray(one.elements) ? one.elements : []).map((c) => readShape(c, 0, budget)).filter((c): c is Shape => c !== null);
  const max = typeof one.max === 'number' && Number.isFinite(one.max) ? Math.min(200, Math.max(2, one.max)) : null;
  return {
    w: num(size[0], 100, 1, 100000), h: num(size[1], 100, 1, 100000),
    alt: typeof one.alt === 'string' ? one.alt.trim().slice(0, 200) : '',
    symbols, elements, max
  };
}

/** Wie viele Teile eine Zeichnung beim Zeichnen hat (Vorlagen so oft, wie sie benutzt werden). */
export function shapeCount(drawing: Drawing): number {
  const count = (list: readonly Shape[], depth: number): number => list.reduce((n, s) => {
    if (depth > DRAWING_LIMITS.depth) return n;
    if (s.type === 'use') return n + 1 + count(drawing.symbols.get(s.use ?? '') ?? [], depth + 1);
    return n + 1 + count(s.children, depth + 1);
  }, 0);
  return count(drawing.elements, 0);
}

/** Wie viele Bewegungen eine Zeichnung trägt. */
export function motionCount(drawing: Drawing): number {
  const count = (list: readonly Shape[], depth: number): number => list.reduce((n, s) => {
    if (depth > DRAWING_LIMITS.depth) return n;
    const inner = s.type === 'use' ? drawing.symbols.get(s.use ?? '') ?? [] : s.children;
    return n + s.motion.length + count(inner, depth + 1);
  }, 0);
  return count(drawing.elements, 0);
}
