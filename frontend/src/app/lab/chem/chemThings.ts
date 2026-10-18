/**
 * 2026-10-18 — DIE DINGE AUF DEM TISCH (Chemia): Glas (Becherglas, Kolben,
 * Probówka, Tiegel, Schale, Słój, Zylinder, Bürette, Wanne), Brenner,
 * Heizplatte, Dreifuss mit Drahtnetz, Stativ mit Ring, Kerze, Thermometer,
 * Stäbe (Glas, Kupfer, Holz …), Stücke eines Stoffes, Holzspan, Draht der
 * Flammenprobe, Löffel, Stopfen, Glasplatte.
 *
 * <b>Ein Ding ist eine Form, gemalt ins Gitter</b>: jede Zelle, deren Mitte
 * im Inneren eines Glases liegt, gehört zu seinem Inneren (mit der Tiefe
 * seines Querschnitts), der Ring um das Innere ist Wand — eine Zelle dick und
 * so, dass keine Flüssigkeit über Eck hinausfindet. Der Inhalt liegt in den
 * Zellen; wird das Ding bewegt, nimmt es seine Zellen mit (Wasser bleibt im
 * Glas), wird es geneigt, dreht sich der Inhalt mit — und fliesst dann von
 * selbst über den Rand.
 */

import { SPECIES, VESSELS, type VesselKind } from './chemData';
import { CELL, CellBuf, F, Grid, L, MATI, NG, SOLI, SOL_M, SOL_RHO } from './chemGrid';

export type ContainerKind = Exclude<VesselKind, 'syringe'> | 'trough';
export type ThingKind = ContainerKind
  | 'burner' | 'hotplate' | 'tripod' | 'stand' | 'candle' | 'thermometer' | 'rod' | 'piece'
  | 'splint' | 'loop' | 'spoon' | 'stopper' | 'plate';

export const CONTAINERS: readonly ContainerKind[] = ['beaker', 'flask', 'roundflask', 'tube', 'cylinder', 'dish', 'crucible', 'jar', 'burette', 'trough'];
export const isContainer = (k: ThingKind): k is ContainerKind => (CONTAINERS as readonly string[]).includes(k);

export const THING_NAME: Readonly<Record<ThingKind, string>> = {
  beaker: 'zlewka', flask: 'kolba stożkowa', roundflask: 'kolba okrągłodenna', tube: 'probówka', cylinder: 'cylinder miarowy',
  dish: 'parownica', crucible: 'tygiel', jar: 'słój', burette: 'biureta', trough: 'wanna', burner: 'palnik', hotplate: 'płyta grzejna',
  tripod: 'trójnóg z siatką', stand: 'statyw z pierścieniem', candle: 'świeca', thermometer: 'termometr', rod: 'pręt', piece: 'kawałek',
  splint: 'łuczywo', loop: 'drucik do prób płomieniowych', spoon: 'łyżeczka do spalań', stopper: 'korek', plate: 'płytka szklana'
};

/* -- Die Gestalt eines Glases --------------------------------------------------------------------- */

/** Das Innere eines Glases: halbe Breite R, Höhe H (cm), Querschnitt von unten nach oben, Wand t. */
export class Profile {
  readonly R: number;
  readonly H: number;
  readonly t = CELL * 1.05;
  readonly full: number;
  private readonly p: readonly (readonly [number, number])[];
  readonly depth: number | null;

  constructor(kind: ContainerKind, size: number) {
    const type = kind === 'trough' ? null : VESSELS[kind];
    this.p = type?.profile ?? [[0, 1], [1, 1]];
    const aspect = type?.aspect ?? 0.45;
    if (kind === 'trough') {
      /* Eine rechteckige Wanne, 10 cm tief: Breite 2R, Höhe 0,9 R. */
      this.depth = 10;
      this.R = Math.sqrt(size / (1.8 * this.depth));
      this.H = 0.9 * this.R;
      this.full = 2 * this.R * this.H * this.depth;
      return;
    }
    this.depth = null;
    let I = 0;
    const N = 120;
    for (let i = 0; i < N; i += 1) I += this.rel((i + 0.5) / N) ** 2 / N;
    this.full = size * (kind === 'burette' ? 1.1 : 1.22);
    this.R = Math.max(CELL * 1.6, (this.full / (2 * Math.PI * aspect * I)) ** (1 / 3));
    this.H = 2 * this.R * aspect;
  }

  /** Halbe Breite (0 … 1) bei einem Anteil der Höhe. */
  rel(u: number): number {
    const p = this.p;
    if (u <= p[0][0]) return p[0][1];
    for (let i = 1; i < p.length; i += 1) {
      if (u <= p[i][0]) {
        const k = (u - p[i - 1][0]) / Math.max(1e-9, p[i][0] - p[i - 1][0]);
        return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k;
      }
    }
    return p[p.length - 1][1];
  }

  /** Halbe innere Breite (cm) auf einer Höhe über dem Boden des Dings (0: dort ist kein Inneres). */
  half(yl: number): number {
    if (yl < this.t || yl > this.t + this.H) return 0;
    return this.R * this.rel((yl - this.t) / this.H);
  }

  /** Tiefe des Querschnitts (cm) auf einer Höhe — rund: π/4 der Breite. */
  depthAt(yl: number): number {
    if (this.depth !== null) return this.depth;
    return Math.max(CELL * 0.6, (Math.PI / 2) * this.half(Math.min(this.t + this.H, Math.max(this.t, yl))));
  }

  get top(): number { return this.t + this.H; }
  get width(): number { let m = 0; for (const [, r] of this.p) m = Math.max(m, r); return 2 * (this.R * m + this.t); }
}

/* -- Ein Ding ------------------------------------------------------------------------------------- */

export interface Thing {
  /** Die Nummer im Gitter (`own`). */
  readonly num: number;
  id: string;
  readonly kind: ThingKind;
  /** cm³ (Glas), cm (Stab, Thermometer), g (Stück). */
  size: number;
  /** Mitte unten (cm) und Neigung (rad, gegen den Uhrzeigersinn). */
  x: number;
  y: number;
  angle: number;
  label: string;
  hidden: boolean;
  /** Die Zellen, die es gerade einnimmt. */
  cells: number[];
  readonly prof: Profile | null;
  /** Stoff (Stück, Stab aus Metall) oder Werkstoff (Stab aus Glas, Holz, Stahl). */
  of: string;
  /** Brenner (Gas), Heizplatte: an; Holzspan, Kerze: brennt. */
  on: boolean;
  /** Brenner: die Flamme sitzt auf dem Rohr (angezündet). */
  lit: boolean;
  /** Brenner: Luft (0 — zu, leuchtende Flamme; 1 — offen, blaue Flamme); Gas (0 … 1). Heizplatte: Leistung (W). */
  air: number;
  flow: number;
  /** Heizplatte: der Magnetrührer läuft (rührt, was auf ihr steht). */
  stir: boolean;
  /** Ein Werkzeug in der Hand: es bleibt, wo man es lässt. */
  held: boolean;
  /** Was am Draht hängt (Kation) und wie viel (mol). */
  sample: string | null;
  sampleN: number;
  /** Stopfen, Platte: auf welchem Glas. */
  onto: string | null;
  /** Dreifuss, Stativ: Höhe des Rings (cm). */
  height: number;
  /** Was ein Fühler zuletzt mass (Thermometer: °C). */
  readout: number;
}

let nums = 0;

export function makeThing(kind: ThingKind, id: string, more: Partial<Thing> = {}): Thing {
  nums = nums >= 60000 ? 1 : nums + 1;
  const size = more.size ?? defaultSize(kind);
  return {
    num: nums, id, kind, size, x: 0, y: 0, angle: 0, label: '', hidden: false, cells: [],
    prof: isContainer(kind) ? new Profile(kind, size) : null,
    of: kind === 'rod' ? 'glass' : kind === 'splint' ? 'wood' : kind === 'candle' ? 'wax' : 'Cu',
    on: kind === 'splint', lit: false, air: kind === 'hotplate' ? 300 : 1, flow: kind === 'burette' ? 0.5 : 0.6, stir: false,
    held: kind === 'splint' || kind === 'loop' || kind === 'spoon' || kind === 'burette' || kind === 'thermometer',
    sample: null, sampleN: 0, onto: null, height: kind === 'stand' ? 22 : 17, readout: Number.NaN,
    ...more
  };
}

function defaultSize(kind: ThingKind): number {
  if (isContainer(kind)) { if (kind === 'trough') return 3000; const s = VESSELS[kind].sizes; return s[Math.min(1, s.length - 1)]; }
  return kind === 'thermometer' ? 24 : kind === 'rod' ? 20 : kind === 'piece' ? 5 : kind === 'splint' ? 16 : kind === 'loop' ? 16 : kind === 'spoon' ? 20 : kind === 'candle' ? 6 : 1;
}

/* -- Woraus ein Ding besteht (in seinen eigenen Koordinaten: Mitte unten, y nach oben) ----------------- */

export interface Part {
  readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number;
  /** Werkstoff (Wand) oder Stoff (ein Stück) — eines von beiden. */
  readonly mat?: number;
  readonly sp?: number;
  /** Tiefe dieser Zellen (cm). */
  readonly D: number;
}

const rect = (x0: number, x1: number, y0: number, y1: number, what: { mat?: number; sp?: number }, D: number): Part => ({ x0, x1, y0, y1, D, ...what });
const matOrSp = (of: string): { mat?: number; sp?: number } => (MATI[of] !== undefined && SOLI[of] === undefined ? { mat: MATI[of] } : SOLI[of] !== undefined ? { sp: SOLI[of] } : { mat: MATI.glass });

/** Ein Stück: wie gross es ist (Seite eines Würfels, cm), wie viele Zellen breit und hoch. */
export function pieceShape(sp: string, grams: number): { cols: number; rows: number; D: number } {
  const v = grams / (SPECIES[sp]?.rho ?? 2);
  if (sp === 'Fe') return { cols: 1, rows: Math.max(2, Math.round(Math.min(6, v * 2.2) / CELL)), D: 0.4 };
  const a = Math.cbrt(v);
  const n = Math.max(1, Math.round(a / CELL));
  return { cols: n, rows: n, D: Math.max(0.15, Math.min(a, v / (n * n * CELL * CELL))) };
}

export function partsOf(t: Thing): Part[] {
  const brass = { mat: MATI.brass };
  const steel = { mat: MATI.steel };
  const glass = { mat: MATI.glass };
  switch (t.kind) {
    case 'burner': return [rect(-3, 3, 0, 1.2, brass, 6), rect(-0.6, 0.6, 1.2, 12, brass, 1.2)];
    /* Die Heizplatte: ein Gehäuse und darauf die 4 mm dicke Platte, in die der Strom heizt. */
    case 'hotplate': return [rect(-6, 6, 0, 2.4 - CELL, { mat: MATI.casing }, 10), rect(-6, 6, 2.4 - CELL, 2.4, steel, 10)];
    case 'tripod': {
      const R = 5;
      const H = t.height;
      const leg = { mat: MATI.rod };
      return [rect(-R - 0.2, -R + 0.2, 0, H - CELL, leg, 3), rect(R - 0.2, R + 0.2, 0, H - CELL, leg, 3),
        rect(-R - 0.2, -R + 0.4, H - CELL, H, steel, 3), rect(R - 0.4, R + 0.2, H - CELL, H, steel, 3), rect(-R + 0.4, R - 0.4, H - CELL, H, { mat: MATI.gauze }, 3)];
    }
    case 'stand': {
      const H = t.height;
      return [rect(-10, -1, 0, 0.8, steel, 8), rect(-6.2, -5.8, 0.8, 46, { mat: MATI.rod }, 3), rect(-5.8, -4, H - CELL, H, { mat: MATI.rod }, 3),
        rect(-4, -3.4, H - CELL, H, steel, 3), rect(3.4, 4, H - CELL, H, steel, 3), rect(-3.4, 3.4, H - CELL, H, { mat: MATI.gauze }, 3)];
    }
    case 'candle': { const h = Math.min(15, Math.max(2, t.size)); return [rect(-1, 1, 0, h, { sp: SOLI.wax }, 2), rect(-0.2, 0.2, h, h + CELL, { mat: MATI.wick }, 0.3)]; }
    case 'thermometer': return [rect(-0.2, 0.2, 0, t.size, glass, 0.8)];
    case 'rod': return [rect(-0.2, 0.2, 0, t.size, matOrSp(t.of), 0.6)];
    /* Ein glimmender Span hat eine verkohlte Spitze (Holzkohle glüht nur — in Sauerstoff flammt sie auf). */
    case 'splint': return t.of === 'C'
      ? [rect(-0.2, 0.2, 0, CELL, { sp: SOLI.C }, 0.5), rect(-0.2, 0.2, CELL, t.size, { sp: SOLI.wood }, 0.5)]
      : [rect(-0.2, 0.2, 0, t.size, { sp: SOLI.wood }, 0.5)];
    case 'loop': return [rect(-0.2, 0.2, 0, t.size, { mat: MATI.nichrome }, 0.4)];
    case 'spoon': return [rect(-0.6, 0.6, 0, CELL, steel, 1.2), rect(-0.2, 0.2, CELL * 2, t.size, steel, 0.4)];
    case 'piece': {
      const s = pieceShape(t.of, t.size);
      return [rect(-(s.cols * CELL) / 2, (s.cols * CELL) / 2, 0, s.rows * CELL, { sp: SOLI[t.of] ?? SOLI.Cu }, s.D)];
    }
    case 'stopper': return [rect(-t.size / 2 - CELL, t.size / 2 + CELL, 0, 1.2, { mat: MATI.rubber }, Math.max(1, t.size * 0.8))];
    case 'plate': return [rect(-t.size / 2, t.size / 2, 0, CELL, glass, t.size * 0.8)];
    default: return [];
  }
}

/* -- Lage: Welt ↔ Ding --------------------------------------------------------------------------- */

/** Ein Punkt der Welt in den Koordinaten des Dings. */
export function toLocal(t: Thing, x: number, y: number): [number, number] {
  const c = Math.cos(t.angle);
  const s = Math.sin(t.angle);
  const dx = x - t.x;
  const dy = y - t.y;
  return [dx * c + dy * s, -dx * s + dy * c];
}

export function toWorld(t: Thing, xl: number, yl: number): [number, number] {
  const c = Math.cos(t.angle);
  const s = Math.sin(t.angle);
  return [t.x + xl * c - yl * s, t.y + xl * s + yl * c];
}

/** Die Grenzen des Dings in seinen Koordinaten [x0, x1, y0, y1]. */
export function localBox(t: Thing): [number, number, number, number] {
  if (t.prof !== null) { const w = t.prof.width / 2; return [-w, w, 0, t.prof.top]; }
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
  for (const p of partsOf(t)) { x0 = Math.min(x0, p.x0); x1 = Math.max(x1, p.x1); y0 = Math.min(y0, p.y0); y1 = Math.max(y1, p.y1); }
  return Number.isFinite(x0) ? [x0, x1, y0, y1] : [-0.2, 0.2, 0, 0.4];
}

/** Die Grenzen in der Welt [x0, y0, x1, y1]. */
export function worldBox(t: Thing): [number, number, number, number] {
  const [a, b, c, d] = localBox(t);
  const pts = [toWorld(t, a, c), toWorld(t, b, c), toWorld(t, a, d), toWorld(t, b, d)];
  return [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
}

/** Liegt ein Punkt der Welt im Inneren eines Glases? */
export function inside(t: Thing, x: number, y: number): boolean {
  if (t.prof === null) return false;
  const [xl, yl] = toLocal(t, x, y);
  return Math.abs(xl) < t.prof.half(yl);
}

/** Die Mitte der Öffnung eines Glases (Welt). */
export function mouthOf(t: Thing): [number, number] {
  if (t.prof === null) { const [, , , y1] = localBox(t); return toWorld(t, 0, y1); }
  return toWorld(t, 0, t.prof.top - CELL * 0.5);
}

/** Wo der Brenner sein Gas ausströmen lässt (Welt). */
export const nozzleOf = (t: Thing): [number, number] => toWorld(t, 0, 12 + CELL * 0.5);
/** Die Spitze eines Holzspans, Drahts, Löffels, Thermometers (Welt). */
export const tipOf = (t: Thing): [number, number] => toWorld(t, 0, t.kind === 'spoon' ? CELL * 1.5 : CELL * 0.5);
/** Der Docht der Kerze (Welt). */
export const wickOf = (t: Thing): [number, number] => toWorld(t, 0, Math.min(15, Math.max(2, t.size)) + CELL * 0.5);

/** Die Höhe der Oberkante (Welt), auf der etwas stehen kann (Dreifuss, Stativ, Heizplatte, Glas). */
export function seatOf(t: Thing): number | null {
  if (t.kind === 'tripod' || t.kind === 'stand') return t.y + t.height;
  if (t.kind === 'hotplate') return t.y + 2.4;
  return null;
}

/* -- Malen ---------------------------------------------------------------------------------------- */

export interface Painted {
  readonly i: number;
  /** 0: Wand oder Stück, 1: Inneres eines Glases. */
  readonly inner: boolean;
  readonly mat: number;
  readonly sp: number;
  readonly D: number;
  /** Anteil der Zelle, den ein Stück füllt. */
  readonly fill: number;
}

/**
 * WELCHE ZELLEN EIN DING EINNÄHME (ohne zu malen) — für ein Glas: alle
 * Zellen, deren Mitte innen liegt (mit der Tiefe ihres Querschnitts), und
 * der Ring aus Wandzellen um sie (8 Nachbarn: Flüssigkeit findet nicht über
 * Eck hinaus), oben offen.
 */
export function cellsOf(g: Grid, t: Thing): Painted[] {
  const [bx0, by0, bx1, by1] = worldBox(t);
  /* Ganz in der Welt oder gar nicht (ein abgeschnittenes Glas wäre oben offen). */
  if (bx0 < g.x0 + CELL || bx1 > g.x0 + (g.w - 1) * CELL || by1 > g.y0 + (g.h - 1) * CELL) return [];
  const c0 = Math.max(0, Math.floor((bx0 - g.x0) / CELL) - 1);
  const c1 = Math.min(g.w - 1, Math.floor((bx1 - g.x0) / CELL) + 1);
  const r0 = Math.max(0, Math.floor((by0 - g.y0) / CELL) - 1);
  const r1 = Math.min(g.h - 1, Math.floor((by1 - g.y0) / CELL) + 1);
  const bw = c1 - c0 + 1;
  const bh = r1 - r0 + 1;
  if (bw <= 0 || bh <= 0) return [];
  const out: Painted[] = [];
  if (t.prof !== null) {
    const p = t.prof;
    const mask = new Uint8Array(bw * bh);
    const yl = new Float32Array(bw * bh);
    for (let r = 0; r < bh; r += 1) {
      for (let c = 0; c < bw; c += 1) {
        const [x, y] = [g.x0 + (c0 + c + 0.5) * CELL, g.y0 + (r0 + r + 0.5) * CELL];
        const [lx, ly] = toLocal(t, x, y);
        yl[r * bw + c] = ly;
        if (Math.abs(lx) < p.half(ly)) mask[r * bw + c] = 1;
      }
    }
    const mat = t.kind === 'crucible' || t.kind === 'dish' ? MATI.porcelain : MATI.glass;
    /* Aufrecht: jede Zeile bekommt genau das Volumen ihrer Scheibe (π r² · 4 mm), auch wenn sie nur wenige Zellen breit ist. */
    const upright = Math.abs(Math.sin(t.angle)) < 1e-6 && Math.cos(t.angle) > 0 && p.depth === null;
    const rowD = new Float32Array(bh);
    if (upright) {
      for (let r = 0; r < bh; r += 1) {
        let count = 0;
        let ly = 0;
        for (let c = 0; c < bw; c += 1) if (mask[r * bw + c] === 1) { count += 1; ly = yl[r * bw + c]; }
        if (count > 0) rowD[r] = Math.max(CELL * 0.3, (Math.PI * p.half(ly) ** 2) / (count * CELL));
      }
    }
    for (let r = 0; r < bh; r += 1) {
      for (let c = 0; c < bw; c += 1) {
        const k = r * bw + c;
        const i = (r0 + r) * g.w + c0 + c;
        if (mask[k] === 1) { out.push({ i, inner: true, mat: 0, sp: -1, D: rowD[r] > 0 ? rowD[r] : p.depthAt(yl[k]), fill: 0 }); continue; }
        if (yl[k] > p.top || yl[k] < -CELL * 0.6) continue;
        let near = 0;
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            const rr = r + dr;
            const cc = c + dc;
            if (rr < 0 || cc < 0 || rr >= bh || cc >= bw || mask[rr * bw + cc] !== 1) continue;
            near = Math.max(near, p.depthAt(yl[rr * bw + cc]));
          }
        }
        if (near > 0) out.push({ i, inner: false, mat, sp: -1, D: near, fill: 1 });
      }
    }
    return out;
  }
  const ps = partsOf(t);
  for (let r = 0; r < bh; r += 1) {
    for (let c = 0; c < bw; c += 1) {
      const [x, y] = [g.x0 + (c0 + c + 0.5) * CELL, g.y0 + (r0 + r + 0.5) * CELL];
      const [lx, ly] = toLocal(t, x, y);
      for (const p of ps) {
        if (lx < p.x0 || lx >= p.x1 || ly < p.y0 || ly >= p.y1) continue;
        out.push({ i: (r0 + r) * g.w + c0 + c, inner: false, mat: p.mat ?? 0, sp: p.sp ?? -1, D: p.D, fill: 1 });
        break;
      }
    }
  }
  /* Ein Stück, das kleiner als eine Zelle ist, nimmt trotzdem eine Zelle ein. */
  if (out.length === 0 && ps.length > 0) {
    const [x, y] = toWorld(t, (ps[0].x0 + ps[0].x1) / 2, (ps[0].y0 + ps[0].y1) / 2);
    const i = g.at(x, y);
    if (i >= 0) out.push({ i, inner: false, mat: ps[0].mat ?? 0, sp: ps[0].sp ?? -1, D: ps[0].D, fill: 1 });
  }
  return out;
}

/** Ist der Platz frei? (Keine Wand eines anderen Dings, kein fremdes Stück, nicht im Tisch.) */
export function fits(g: Grid, cells: readonly Painted[], moving: ReadonlySet<number>): boolean {
  for (const c of cells) {
    const i = c.i;
    if (i < 0 || i >= g.n) return false;
    const o = g.own[i];
    if (o !== 0 && moving.has(o)) continue;
    /* Das Innere eines Glases darf über anderen Dingen stehen (die Kerze unter dem Słój), nur nicht im Tisch. */
    if (c.inner) { if (o === 0 && g.mat[i] !== 0) return false; continue; }
    if (g.mat[i] !== 0) return false;
    if (g.sform[i] === F.piece) return false;
  }
  return true;
}

/** Wer die Zelle hätte, wenn kein bewegtes Ding dort wäre: das innerste Glas, dessen Inneres sie enthält. */
function baseOf(g: Grid, things: readonly Thing[], i: number, moving: ReadonlySet<number>): { own: number; D: number } {
  const x = g.cx(i);
  const y = g.cy(i);
  let best: Thing | null = null;
  for (const t of things) {
    if (t.prof === null || moving.has(t.num) || !inside(t, x, y)) continue;
    if (best === null || (best.prof !== null && t.prof.full < best.prof.full)) best = t;
  }
  if (best === null || best.prof === null) return { own: 0, D: g.depth };
  const [, yl] = toLocal(best, x, y);
  return { own: best.num, D: best.prof.depthAt(yl) };
}

/** Ein Ding malen: Wände, Stücke (mit ihrer Menge, wenn neu), Inneres. */
export function paint(g: Grid, t: Thing, cells: readonly Painted[], fresh: boolean): void {
  /* Inneres über einem anderen Ding (Kerze, Probówka): das Ding behält seine Zellen. */
  const mine = cells.filter((c) => !c.inner || g.own[c.i] === 0 || g.own[c.i] === t.num || isInnerOf(g, c.i));
  t.cells = mine.map((c) => c.i);
  let pieceCells = 0;
  for (const c of mine) if (c.sp >= 0) pieceCells += 1;
  for (const c of mine) {
    const i = c.i;
    g.own[i] = t.num;
    g.D[i] = c.D;
    if (c.inner) { g.mat[i] = 0; continue; }
    /* Eine Wand hat kein Gas (sonst schöbe es die Luft der Zellen, die eine Probówka eben einnahm, in ihr Inneres). */
    if (c.mat !== 0) { g.mat[i] = c.mat; if (g.wall(i)) g.gas.fill(0, i * NG, i * NG + NG); continue; }
    g.mat[i] = 0;
    if (c.sp >= 0) {
      g.sform[i] = F.piece;
      if (fresh || g.sp[i] !== c.sp) {
        g.sp[i] = c.sp;
        const grams = t.kind === 'piece' ? t.size / Math.max(1, pieceCells) : g.vol(i) * SOL_RHO[c.sp] * 0.98;
        g.sn[i] = grams / SOL_M[c.sp];
      }
    }
  }
}

/** Gehört die Zelle nur zum Inneren eines (anderen) Glases — dann darf ein Ding darin sie übernehmen. */
function isInnerOf(g: Grid, i: number): boolean {
  return g.mat[i] === 0 && g.sform[i] !== F.piece;
}

/** Ein Ding aus dem Gitter nehmen: seine Zellen werden wieder Raum (oder das Innere des Glases darunter). */
export function unpaint(g: Grid, things: readonly Thing[], t: Thing, moving: ReadonlySet<number>, roomT: number): void {
  for (const i of t.cells) {
    if (g.own[i] !== t.num) continue;
    const base = baseOf(g, things, i, moving);
    g.clear(i);
    g.own[i] = base.own;
    g.D[i] = base.D;
    g.T[i] = roomT;
  }
  t.cells = [];
}

/* -- Bewegen: das Ding nimmt seinen Inhalt mit ------------------------------------------------------ */

/**
 * Den Inhalt einer Zelle in eine andere (die ihn schon hat oder leer ist) —
 * über die Zelle zum Zwischenspeichern. Was dort nicht hinpasst (ein anderer
 * Feststoff, eine andere Flüssigkeit), sucht sich die nächste freie Zelle.
 */
export function pour(g: Grid, buf: CellBuf, into: number): void {
  const s = g.n;
  g.load(s, buf);
  g.D[s] = g.D[into];
  if (g.lq[s] === L.aq) g.moveAq(s, into, 1);
  else if (g.lq[s] === L.melt) g.moveMelt(s, into, 1);
  if (g.sp[s] >= 0 && g.sform[s] !== F.piece) g.moveSolid(s, into, g.sn[s]);
  g.moveGas(s, into, g.gasTotal(s));
  if (g.lq[s] !== L.none || (g.sp[s] >= 0 && g.sform[s] !== F.piece)) {
    const rest = new CellBuf();
    g.save(s, rest);
    g.clear(s);
    settleNear(g, rest, g.cx(into), g.cy(into));
    return;
  }
  g.clear(s);
}

/** Was in einer Zelle ist (ohne Wand und Gestalt) — hat sie Flüssigkeit oder einen Feststoff? */
const hasStuff = (g: Grid, i: number): boolean => g.lq[i] !== L.none || (g.sp[i] >= 0 && g.sform[i] !== F.piece);

/**
 * DINGE VERSCHIEBEN UND DREHEN: `moving` (ein Glas mit allem, was darin
 * steht) um (dx, dy) und um `turn` (rad) um den Punkt `pivot`. Der Inhalt
 * geht mit — beim Drehen in die nächste Zelle des Inneren; was am neuen
 * Platz lag (Wasser, in das eine Probówka taucht), weicht nach oben aus.
 * `false`: der Platz ist nicht frei, alles bleibt, wie es war.
 */
export function relocate(g: Grid, things: readonly Thing[], moving: readonly Thing[], dx: number, dy: number, turn: number, pivot: readonly [number, number], roomT: number): boolean {
  const set = new Set(moving.map((t) => t.num));
  const before = moving.map((t) => ({ t, x: t.x, y: t.y, a: t.angle }));
  /* Der Inhalt jeder Zelle der bewegten Dinge — mit seinem Ort in der Welt. */
  const saved: { t: Thing; x: number; y: number; inner: boolean; buf: CellBuf }[] = [];
  for (const t of moving) {
    for (const i of t.cells) {
      if (g.own[i] !== t.num) continue;
      const buf = new CellBuf();
      g.save(i, buf);
      saved.push({ t, x: g.cx(i), y: g.cy(i), inner: g.mat[i] === 0 && g.sform[i] !== F.piece, buf });
    }
  }
  for (const t of moving) unpaint(g, things, t, set, roomT);
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const place = (x: number, y: number): [number, number] => {
    const rx = x - pivot[0];
    const ry = y - pivot[1];
    return [pivot[0] + rx * c - ry * s + dx, pivot[1] + rx * s + ry * c + dy];
  };
  for (const t of moving) { [t.x, t.y] = place(t.x, t.y); t.angle += turn; }
  const plans = moving.map((t) => ({ t, cells: cellsOf(g, t) }));
  if (!plans.every((p) => p.cells.length > 0 && fits(g, p.cells, set))) {
    for (const b of before) { b.t.x = b.x; b.t.y = b.y; b.t.angle = b.a; }
    for (const b of before) paint(g, b.t, cellsOf(g, b.t), false);
    for (const sv of saved) { const i = g.at(sv.x, sv.y); if (i >= 0) g.load(i, sv.buf); }
    return false;
  }
  /* Was am neuen Platz lag, weicht aus. */
  const displaced: { i: number; buf: CellBuf }[] = [];
  for (const p of plans) displaced.push(...displace(g, p.cells, true));
  for (const p of plans) {
    for (const cell of p.cells) {
      const i = cell.i;
      g.gas.fill(0, i * NG, i * NG + NG);
      g.smoke[i] = 0; g.mist[i] = 0; g.fume[i] = 0; g.glow[i] = 0;
      g.T[i] = roomT;
    }
    paint(g, p.t, p.cells, false);
  }
  /* Der Inhalt an seinen neuen Platz: Wände nehmen nur ihre Temperatur mit, Stücke ihre Menge, das Innere alles. */
  for (const sv of saved) {
    const [nx, ny] = place(sv.x, sv.y);
    let i = g.at(nx, ny);
    if (i < 0) continue;
    if (sv.inner) {
      if (!(g.own[i] === sv.t.num && g.mat[i] === 0 && g.sform[i] !== F.piece)) i = nearestInner(g, sv.t, nx, ny);
      if (i < 0) continue;
      sv.buf.f[1] = 0; sv.buf.f[2] = sv.t.num;
      pour(g, sv.buf, i);
      if (g.lq[i] === L.aq && g.spec[i] === null) g.spec[i] = sv.buf.spec;
    } else if (g.own[i] === sv.t.num) {
      if (g.sform[i] === F.piece && sv.buf.f[3] === g.sp[i]) g.sn[i] = sv.buf.f[4];
      g.T[i] = sv.buf.f[9];
    }
  }
  for (const d of displaced) settleNear(g, d.buf, g.cx(d.i), g.cy(d.i), set);
  /* Verkleinerte Stücke (geschmolzen, gelöst) behalten ihre Menge: Zellen ohne Stoff gehören nicht mehr dazu. */
  for (const t of moving) if (t.kind === 'piece' || t.kind === 'candle' || t.kind === 'splint') prunePiece(g, things, t, roomT);
  return true;
}

/** Was in den Zellen liegt, die ein Ding gleich einnimmt (Wasser, Körner): herausnehmen — es weicht danach aus (`settleNear`). */
export function displace(g: Grid, cells: readonly Painted[], all = false): { i: number; buf: CellBuf }[] {
  const out: { i: number; buf: CellBuf }[] = [];
  for (const cell of cells) {
    if ((!all && cell.inner) || !hasStuff(g, cell.i)) continue;
    const buf = new CellBuf();
    g.save(cell.i, buf);
    out.push({ i: cell.i, buf });
    g.clearSolid(cell.i);
    g.clearLiquid(cell.i);
  }
  return out;
}

/** Die nächste Zelle im Inneren eines Glases (zu einem Punkt), −1: keine. */
function nearestInner(g: Grid, t: Thing, x: number, y: number): number {
  let best = -1;
  let bd = Infinity;
  for (const i of t.cells) {
    if (g.own[i] !== t.num || g.mat[i] !== 0 || g.sform[i] === F.piece) continue;
    const d = (g.cx(i) - x) ** 2 + (g.cy(i) - y) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/** Inhalt, der weichen musste, in die nächste freie Zelle darüber (Wasser steigt, wenn etwas eintaucht). */
export function settleNear(g: Grid, buf: CellBuf, x: number, y: number, forbid?: ReadonlySet<number>): void {
  const start = g.at(x, y);
  if (start < 0) return;
  const seen = new Set<number>([start]);
  const queue = [start];
  const liquid = buf.f[6];
  const solid = buf.f[3];
  const allowed = (i: number): boolean => forbid === undefined || !forbid.has(g.own[i]);
  for (let k = 0; k < queue.length && k < 6000; k += 1) {
    const i = queue[k];
    const free = g.mat[i] === 0 && g.sform[i] !== F.piece && (liquid === L.none || g.lq[i] === L.none || g.lq[i] === liquid) && (solid < 0 || g.sp[i] < 0 || g.sp[i] === solid);
    if (free && allowed(i) && g.room(i) > g.liqVol(i) + 1e-6) { pour(g, buf, i); return; }
    /* Was flüssig oder fest ist, sucht zuerst unten und seitlich (in die Zelle, die ein Ding eben verlassen hat). */
    const c = i % g.w;
    for (let d = 0; d < 4; d += 1) {
      const j = d === 0 ? i - g.w : d === 1 ? (c > 0 ? i - 1 : -1) : d === 2 ? (c < g.w - 1 ? i + 1 : -1) : i + g.w;
      if (j < 0 || j >= g.n || seen.has(j) || g.wall(j) || !allowed(j)) continue;
      seen.add(j);
      queue.push(j);
    }
  }
}

/** Ein Stück, das geschmolzen oder gelöst ist, verliert seine leeren Zellen. */
export function prunePiece(g: Grid, things: readonly Thing[], t: Thing, roomT: number): void {
  const keep: number[] = [];
  for (const i of t.cells) {
    if (g.own[i] !== t.num) continue;
    if (g.mat[i] !== 0 || (g.sform[i] === F.piece && g.sn[i] > 1e-12)) { keep.push(i); continue; }
    const base = baseOf(g, things, i, new Set([t.num]));
    g.own[i] = base.own;
    g.D[i] = base.D;
    if (g.sform[i] === F.piece) g.clearSolid(i);
    void roomT;
  }
  t.cells = keep;
}

/** Das Ding unter einem Punkt (das kleinste, dessen Grenzen ihn enthalten). */
export function thingAt(g: Grid, things: readonly Thing[], x: number, y: number): Thing | null {
  const i = g.at(x, y);
  if (i >= 0 && g.own[i] !== 0) {
    const t = things.find((u) => u.num === g.own[i]);
    if (t !== undefined) return t;
  }
  let best: Thing | null = null;
  let area = Infinity;
  for (const t of things) {
    const [x0, y0, x1, y1] = worldBox(t);
    const pad = CELL * 1.5;
    if (x < x0 - pad || x > x1 + pad || y < y0 - pad || y > y1 + pad) continue;
    const a = (x1 - x0) * (y1 - y0);
    if (a < area) { area = a; best = t; }
  }
  return best;
}
