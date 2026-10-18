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
 * <b>2026-10-17 — zum Anfassen</b> (`liveModel.ts`): Werte, die man einstellt,
 * Rechnungen, eine Simulation, Bedienung und Regeln; an den Teilen Ausdrücke
 * (`"x": "=x0 + v*t"`), Ziehen, Antippen, Wiederholen, Zeigen; neue Teile
 * `arrow`, `poly`, `plot`, `trace`, `frame`. Eine Zeichnung, die nichts davon
 * nutzt, bleibt genau, wie sie war (`DrawingView`); eine, die es nutzt,
 * zeichnet `LiveDrawing` — erst geladen, wenn eine Seite sie zeigt.
 *
 * Duldsam wie jeder Leser hier: was nicht passt, fällt weg; nichts wirft.
 */

import { colorValue, glowValue, readMotions, type MotionUse } from './motion';
import {
  bindOf, exprOf, LIVE_LIMITS, NAME, numOf, readAxes, readDrag, readLive, readTap, readWorld,
  type Axes, type DragSpec, type Live, type Num, type TapSpec
} from './liveModel';
import type { RawConfig } from '../part';

export const SHAPE_TYPES = ['rect', 'circle', 'ellipse', 'line', 'path', 'text', 'image', 'group', 'use', 'arrow', 'poly', 'plot', 'trace', 'frame', 'world'] as const;
export type ShapeType = (typeof SHAPE_TYPES)[number];

/** 2026-10-17 — die Teile, die nur das Bild zum Anfassen kennt. */
export const LIVE_TYPES: ReadonlySet<ShapeType> = new Set(['arrow', 'poly', 'plot', 'trace', 'frame', 'world']);

/** Was an einem Teil ein Ausdruck sein darf (`"=…"`). */
export const BINDABLE = ['x', 'y', 'w', 'h', 'r', 'x2', 'y2', 'rotate', 'scale', 'opacity', 'width', 'size', 'fill', 'stroke'] as const;
export type Bindable = (typeof BINDABLE)[number] | 'text';

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

  /* -- 2026-10-17: zum Anfassen (`liveModel.ts`) -------------------------------------- */

  /** Werte, die gerechnet werden: Name des Werts → Ausdruck. Der Text: ein Text mit `{…}` darin. `null`: keine. */
  readonly bind: Readonly<Partial<Record<Bindable, string>>> | null;
  /** Wann das Teil zu sehen ist (ein Ausdruck) — `null`: immer. */
  readonly show: string | null;
  readonly drag: DragSpec | null;
  readonly tap: TapSpec | null;
  /** So oft nebeneinander — in jedem ist `i` (0, 1, …) und `n` (wie viele). */
  readonly repeat: number;
  /** Für Ziehen und Antippen: wie der Griff heisst (Bildschirmleser). */
  readonly label: string;
  /** arrow: wie gross die Spitze ist (Einheiten der Zeichnung). */
  readonly head: number;
  /** poly: die Punkte (Zahlen oder Ausdrücke) — `closed`: eine Fläche. */
  readonly points: readonly (readonly [Num, Num])[];
  readonly closed: boolean;
  /** plot: y = fn(u) — oder ein Weg (fx(u), fy(u)); u läuft von `from` bis `to` in `samples` Punkten. trace: die Spur von (fx, fy). */
  readonly fn: string | null;
  readonly fx: string | null;
  readonly fy: string | null;
  readonly var: string;
  readonly from: Num;
  readonly to: Num;
  readonly samples: number;
  /** trace: wie viele Punkte sie behält und wie oft (s der Simulation) sie einen nimmt. */
  readonly keep: number;
  readonly every: number;
  /** frame: welcher Ausschnitt der Welt [x0, y0, x1, y1] im Rechteck x, y, w, h steht (y nach oben). */
  readonly view: readonly [Num, Num, Num, Num] | null;
  readonly axes: Axes | null;
  readonly clip: boolean;
  /** 2026-10-18 — frame: man darf hineinzoomen und den Ausschnitt verschieben (`view` ist dann, was „Dopasuj" zeigt). */
  readonly camera: boolean;
}

export interface Drawing {
  readonly w: number;
  readonly h: number;
  readonly alt: string;
  readonly symbols: ReadonlyMap<string, readonly Shape[]>;
  readonly elements: readonly Shape[];
  /** Höchstens so breit (rem); `null`: so breit wie der Platz. */
  readonly max: number | null;
  /** 2026-10-17 — Werte, Rechnungen, Simulation, Bedienung, Regeln — `null`: ein Bild, das nur läuft. */
  readonly live: Live | null;
}

export const EMPTY_DRAWING: Drawing = { w: 100, h: 100, alt: '', symbols: new Map(), elements: [], max: null, live: null };

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

/** Der Text eines Teils, der rechnet: `"=…"` wird `{…}`, ein Text mit `{…}` bleibt, wie er ist — sonst `null`. */
function textBind(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const b = bindOf(value);
  if (b !== null) return `{${b}}`;
  return /\{[^{}]+\}/.test(value) ? value.slice(0, 400) : null;
}

const pointsOf = (value: unknown): (readonly [Num, Num])[] =>
  (Array.isArray(value) ? value : []).slice(0, LIVE_LIMITS.samples).flatMap((p): (readonly [Num, Num])[] =>
    (Array.isArray(p) && p.length === 2 ? [[numOf(p[0], 0), numOf(p[1], 0)] as const] : []));

function viewOf(value: unknown): readonly [Num, Num, Num, Num] | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const [a, b, c, d] = value.map((v, i) => numOf(v, i < 2 ? 0 : 10));
  return [a, b, c, d];
}

function readShape(value: unknown, depth: number, budget: { left: number }): Shape | null {
  if (budget.left <= 0 || depth > DRAWING_LIMITS.depth) return null;
  const one = record(value);
  const type = typeof one.type === 'string' ? one.type as ShapeType : 'rect';
  if (!SHAPE_TYPES.includes(type)) return null;
  budget.left -= 1;
  const children = (type === 'group' || type === 'frame') && Array.isArray(one.children)
    ? one.children.map((c) => readShape(c, depth + 1, budget)).filter((c): c is Shape => c !== null)
    : [];
  const anchor = one.anchor === 'start' || one.anchor === 'end' ? one.anchor : 'middle';
  const cap = one.cap === 'butt' || one.cap === 'square' ? one.cap : 'round';

  /* 2026-10-17 — Werte, die gerechnet werden. */
  const bind: Partial<Record<Bindable, string>> = {};
  for (const key of BINDABLE) {
    const b = bindOf(one[key]);
    if (b !== null) bind[key] = b;
  }
  const textLive = type === 'text' ? textBind(one.text) : null;
  if (textLive !== null) bind.text = textLive;
  const repeat = Math.round(num(one.repeat, 1, 1, LIVE_LIMITS.repeat));
  /* Eine Wiederholung zählt so oft, wie sie gezeichnet wird. */
  budget.left -= repeat - 1;

  return {
    type,
    x: num(one.x, 0), y: num(one.y, 0), w: num(one.w, 0, 0), h: num(one.h, 0, 0), r: num(one.r, 0, 0),
    x2: num(one.x2, 0), y2: num(one.y2, 0),
    d: type === 'path' ? safePath(one.d) : null,
    text: type === 'text' && typeof one.text === 'string' && textLive === null ? one.text.slice(0, 200) : '',
    size: num(one.size, 16, 1, 1000), weight: Math.round(num(one.weight, 400, 100, 900)), anchor,
    url: type === 'image' ? safeUrl(one.url) : null,
    use: type === 'use' && typeof one.use === 'string' ? one.use.trim().slice(0, 40) : null,
    fill: fillValue(one.fill), stroke: colorValue(one.stroke), width: num(one.width, 1, 0, 1000), cap,
    opacity: num(one.opacity, 1, 0, 1), blur: num(one.blur, 0, 0, 200), glow: glowValue(one.glow),
    origin: typeof one.origin === 'string' && ORIGIN.test(one.origin.trim()) ? one.origin.trim() : null,
    scale: num(one.scale, 1, 0.001, 1000), rotate: num(one.rotate, 0, -3600, 3600),
    children,
    shift: Math.round(num(one.shift, 0, -600000, 600000)),
    motion: readMotions(one.motion),
    bind: Object.keys(bind).length === 0 ? null : bind,
    show: exprOf(one.show),
    drag: readDrag(one.drag),
    tap: readTap(one.tap),
    repeat,
    label: typeof one.label === 'string' ? one.label.trim().slice(0, LIVE_LIMITS.label) : '',
    head: num(one.head, 8, 0, 200),
    points: type === 'poly' ? pointsOf(one.points) : [],
    closed: one.closed === true,
    fn: type === 'plot' ? exprOf(one.fn) : null,
    fx: type === 'plot' || type === 'trace' ? exprOf(one.fx) : null,
    fy: type === 'plot' || type === 'trace' ? exprOf(one.fy) : null,
    /* Der Lauf einer Kurve ist ein Name nur in ihr — auch `x` oder `i` (er verdeckt dort einen gleichnamigen Wert). */
    var: typeof one.var === 'string' && NAME.test(one.var.trim()) && one.var.trim().length <= LIVE_LIMITS.name ? one.var.trim() : 'u',
    from: numOf(one.from, 0),
    to: numOf(one.to, 1),
    samples: Math.round(num(one.samples, 60, 2, LIVE_LIMITS.samples)),
    keep: Math.round(num(one.keep, 400, 2, LIVE_LIMITS.trace)),
    every: num(one.every, 0.03, 0.002, 10),
    view: type === 'frame' ? viewOf(one.view) ?? [0, 0, 10, 10] : null,
    axes: type === 'frame' ? readAxes(one.axes) : null,
    clip: one.clip === true,
    camera: type === 'frame' && one.camera === true
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

/** Die Schlüssel der Tafel, die das Bild zum Anfassen macht (2026-10-17) — jeder ein JSON. */
export const LIVE_KEYS = ['vars', 'let', 'sim', 'controls', 'rules', 'panel', 'world', 'predict'] as const;

/** Eine Zeichnung aus der gespeicherten Tafel des Bausteins (`size`, `symbols`, `elements` als JSON). */
export function readDrawing(raw: RawConfig): Drawing {
  /* Ein einzelnes Teil ohne Klammern (so auch eine Liste aus EINER Zeile) ist eine Liste aus einem. */
  const list = (value: unknown): unknown => (typeof value === 'object' && value !== null && !Array.isArray(value) ? [value] : value);
  return drawingOf({
    size: parse(raw.size), symbols: list(parse(raw.symbols)), elements: list(parse(raw.elements)), alt: raw.alt, max: parse(raw.max),
    vars: list(parse(raw.vars)), let: list(parse(raw.let)), sim: parse(raw.sim), controls: list(parse(raw.controls)), rules: list(parse(raw.rules)),
    panel: raw.panel, world: parse(raw.world), predict: parse(raw.predict)
  });
}

/** Was eine Zeichnung ausmacht, als Text — ändert er sich, wird sie neu aufgebaut. */
export const drawingIdentity = (raw: RawConfig): string =>
  ['size', 'symbols', 'elements', 'alt', 'max', ...LIVE_KEYS].map((key) => raw[key] ?? '').join('\u0001');

/** Eine Zeichnung aus einem Objekt — `size` [Breite, Höhe], `symbols` [{ name, shapes }], `elements`; zum Anfassen `vars`, `let`, `sim`, `controls`, `rules`. */
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
    symbols, elements, max,
    /* 2026-10-18 — die Teile einer Art zählen zum selben Budget wie die übrigen. */
    live: readLive({ vars: one.vars, let: one.let, sim: one.sim, controls: one.controls, rules: one.rules, panel: one.panel, predict: one.predict },
      readWorld(one.world, (list) => (Array.isArray(list) ? list : []).map((c) => readShape(c, 1, budget)).filter((c): c is Shape => c !== null)))
  };
}

/** Wie viele Teile eine Zeichnung beim Zeichnen hat (Vorlagen so oft, wie sie benutzt werden, Wiederholungen so oft, wie sie stehen). */
export function shapeCount(drawing: Drawing): number {
  const count = (list: readonly Shape[], depth: number): number => list.reduce((n, s) => {
    if (depth > DRAWING_LIMITS.depth) return n;
    if (s.type === 'use') return n + s.repeat * (1 + count(drawing.symbols.get(s.use ?? '') ?? [], depth + 1));
    return n + s.repeat * (1 + count(s.children, depth + 1));
  }, 0);
  return count(drawing.elements, 0);
}

/** Ist das Teil eines zum Anfassen (rechnet es, lässt es sich ziehen, ist es eines der neuen)? */
export const isLiveShape = (s: Shape): boolean =>
  LIVE_TYPES.has(s.type) || s.bind !== null || s.show !== null || s.drag !== null || s.tap !== null || s.repeat > 1;

/**
 * BRAUCHT DIE ZEICHNUNG DAS BILD ZUM ANFASSEN (`LiveDrawing`)? Ja, sobald sie
 * Werte, Rechnungen, eine Simulation, Bedienung oder Regeln hat — oder ein
 * Teil rechnet, sich ziehen lässt oder eines der neuen ist.
 */
export function needsLive(drawing: Drawing): boolean {
  if (drawing.live !== null) return true;
  const any = (list: readonly Shape[], depth: number): boolean =>
    depth <= DRAWING_LIMITS.depth && list.some((s) => isLiveShape(s) || any(s.children, depth + 1));
  return any(drawing.elements, 0) || [...drawing.symbols.values()].some((shapes) => any(shapes, 1));
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
