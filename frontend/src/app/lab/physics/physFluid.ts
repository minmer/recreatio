/**
 * 2026-10-18 — FLÜSSIGKEITEN IN DER FIZYKA 2D: Becken mit Wasser (und mehr
 * als einer Flüssigkeit übereinander), in denen Körper schwimmen, schweben
 * und sinken.
 *
 * <b>Kein Teilchenwasser</b>: eine Flüssigkeit ist eine Menge (Querschnitt
 * in m², bei der Tiefe der Szene ein Volumen), und ihr Spiegel steht dort,
 * wo diese Menge und alles, was in ihr steckt, zusammen Platz finden — legt
 * man einen Klotz hinein, steigt der Spiegel (Verdrängung). Das ist genau,
 * billig und stabil, auch auf dem Telefon:
 *
 * <code>
 *   Spiegel      W·(y − Boden) − eingetauchte Fläche(y) = Menge   (Bisektion; je Schicht)
 *   Auftrieb     ρ·g·A_eingetaucht·Tiefe, am Schwerpunkt des eingetauchten Teils (er dreht ein Brett auf)
 *   Widerstand   bremst in der Flüssigkeit (zäher: stärker)
 *   Druck        p = p₀ + Σ ρ·g·h über dem Punkt
 *   Loch         v = √(2Δp/ρ) (Torricelli) — ein Strahl aus Tropfen, der Spiegel sinkt
 *   Rohr         zwei Becken unten verbunden: es fliesst, bis der Druck am Rohr gleich ist (naczynia połączone)
 * </code>
 *
 * Die Wellen auf dem Spiegel sind nur fürs Auge: eine Reihe gekoppelter
 * Federn, angestossen, wenn etwas durch die Oberfläche fällt.
 */

import { LIQUIDS, P_ATM, jetSpeed, type Liquid } from '../fluid';
import type { Body } from './physBody';

export interface Layer {
  readonly liquid: Liquid;
  /** Wie viel (Querschnitt, m²). */
  amount: number;
  /** Oberkante dieser Schicht (nach `levels`). */
  top: number;
}

export interface Hole {
  readonly side: 'left' | 'right' | 'bottom';
  /** Höhe über dem Boden (Seitenwand) oder Abstand von der linken Wand (Boden). */
  readonly at: number;
  /** Breite der Öffnung (m). */
  readonly size: number;
  open: boolean;
  /** Was gerade herausfliesst (m²/s) und wie schnell (m/s). */
  flow: number;
  speed: number;
}

export class Basin {
  readonly layers: Layer[] = [];
  readonly holes: Hole[] = [];
  readonly waves: Float64Array;
  readonly wavesV: Float64Array;
  /** Die Wände (feste Körper der Welt). */
  readonly walls: Body[] = [];

  constructor(readonly id: string, readonly x0: number, readonly x1: number, readonly y0: number, readonly y1: number, readonly wall: number) {
    const n = Math.max(8, Math.min(72, Math.round((x1 - x0) / 0.05)));
    this.waves = new Float64Array(n);
    this.wavesV = new Float64Array(n);
  }

  get width(): number { return this.x1 - this.x0; }

  /** Der oberste Spiegel (ohne Flüssigkeit: der Boden). */
  surface(): number {
    return this.layers.length === 0 ? this.y0 : this.layers[this.layers.length - 1].top;
  }

  /** Flüssigkeit dazu (eine neue Schicht oder mehr in einer gleichen) — die Schichten liegen nach Dichte. */
  add(liquid: Liquid, amount: number): void {
    if (amount <= 0) return;
    const same = this.layers.find((l) => l.liquid.key === liquid.key);
    if (same !== undefined) same.amount += amount;
    else this.layers.push({ liquid, amount, top: this.y0 });
    this.layers.sort((a, b) => b.liquid.density - a.liquid.density);
  }

  /** Der Druck an einem Punkt (Pa) — über dem Spiegel: Luftdruck. */
  pressure(y: number, g: number): number {
    let p = P_ATM;
    let below = this.y0;
    for (const l of this.layers) {
      const lo = Math.max(below, y);
      if (l.top > lo) p += l.liquid.density * g * (l.top - lo);
      below = l.top;
    }
    /* Von oben gezählt: die Schichten über y addiert — die Reihenfolge der Summe ist gleich. */
    return p;
  }

  /** Welche Flüssigkeit in dieser Höhe steht (`null`: Luft). */
  liquidAt(y: number): Liquid | null {
    let below = this.y0;
    for (const l of this.layers) {
      if (y >= below && y <= l.top) return l.liquid;
      below = l.top;
    }
    return null;
  }

  inside(x: number, y: number): boolean {
    return x > this.x0 && x < this.x1 && y > this.y0 && y < this.y1 + 0.02;
  }
}

/** Ein Rohr unten zwischen zwei Becken (Höhe in der Welt). */
export interface Pipe {
  readonly a: Basin;
  readonly b: Basin;
  readonly y: number;
  readonly size: number;
  open: boolean;
  flow: number;
}

/** Ein Tropfen eines Strahls (oder eines Spritzers). */
export interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  amount: number;
  liquid: Liquid;
  life: number;
}

/* -- Eingetauchte Flächen --------------------------------------------------------------------- */

const CIRCLE_N = 24;
/* Feste Puffer (eine Rechnung zur Zeit): die Ecken eines Kreises, und zwei Felder für die Schnitte. */
const circX = new Float64Array(CIRCLE_N);
const circY = new Float64Array(CIRCLE_N);
const bufAX = new Float64Array(64);
const bufAY = new Float64Array(64);
const bufBX = new Float64Array(64);
const bufBY = new Float64Array(64);

/** Die Ecken eines Körpers in der Welt (ein Kreis als 24-Eck). */
function outline(b: Body): { xs: Float64Array; ys: Float64Array; n: number } {
  if (b.shape.kind === 'poly') return { xs: b.wx, ys: b.wy, n: b.shape.n };
  const r = b.shape.r;
  for (let i = 0; i < CIRCLE_N; i += 1) {
    const t = (i / CIRCLE_N) * Math.PI * 2;
    circX[i] = b.x + r * Math.cos(t);
    circY[i] = b.y + r * Math.sin(t);
  }
  return { xs: circX, ys: circY, n: CIRCLE_N };
}

/** Ein Vieleck an einer Halbebene abschneiden: behalten, wo s·(Achse) ≤ c (Achse 0: x, 1: y). */
function clipHalf(xs: Float64Array, ys: Float64Array, n: number, axis: 0 | 1, s: number, c: number, ox: Float64Array, oy: Float64Array): number {
  let m = 0;
  for (let i = 0; i < n; i += 1) {
    const ax = xs[i]; const ay = ys[i];
    const bx = xs[(i + 1) % n]; const by = ys[(i + 1) % n];
    const da = s * (axis === 0 ? ax : ay) - c;
    const db = s * (axis === 0 ? bx : by) - c;
    if (da <= 0 && m < 63) { ox[m] = ax; oy[m] = ay; m += 1; }
    if ((da <= 0) !== (db <= 0) && m < 63) {
      const t = da / (da - db);
      ox[m] = ax + (bx - ax) * t;
      oy[m] = ay + (by - ay) * t;
      m += 1;
    }
  }
  return m;
}

/** Fläche und Moment (Σ A·x, Σ A·y) eines Körpers im Becken unter der Höhe `level` (zwischen den Wänden). */
function area3(b: Body, basin: Basin, level: number): { area: number; mx: number; my: number } {
  const o = outline(b);
  let n = clipHalf(o.xs, o.ys, o.n, 1, 1, level, bufAX, bufAY);
  if (n < 3) return { area: 0, mx: 0, my: 0 };
  n = clipHalf(bufAX, bufAY, n, 0, -1, -basin.x0, bufBX, bufBY);
  if (n < 3) return { area: 0, mx: 0, my: 0 };
  n = clipHalf(bufBX, bufBY, n, 0, 1, basin.x1, bufAX, bufAY);
  if (n < 3) return { area: 0, mx: 0, my: 0 };
  /* Und nur über dem Boden des Beckens (der Boden der Welt darunter verdrängt nichts). */
  n = clipHalf(bufAX, bufAY, n, 1, -1, -basin.y0, bufBX, bufBY);
  if (n < 3) return { area: 0, mx: 0, my: 0 };
  for (let i = 0; i < n; i += 1) { bufAX[i] = bufBX[i]; bufAY[i] = bufBY[i]; }
  let area = 0; let mx = 0; let my = 0;
  for (let i = 0; i < n; i += 1) {
    const x1 = bufAX[i]; const y1 = bufAY[i];
    const x2 = bufAX[(i + 1) % n]; const y2 = bufAY[(i + 1) % n];
    const c = x1 * y2 - x2 * y1;
    area += c / 2;
    mx += (x1 + x2) * c / 6;
    my += (y1 + y2) * c / 6;
  }
  return area < 1e-12 ? { area: 0, mx: 0, my: 0 } : { area, mx, my };
}

/* -- Ein Schritt der Flüssigkeiten ------------------------------------------------------------- */

/** Wo die Spiegel stehen — je Schicht, mit allem, was eintaucht (Verdrängung). */
export function levels(basin: Basin, bodies: readonly Body[]): void {
  const near = bodies.filter((b) => !basin.walls.includes(b) && b.maxX > basin.x0 && b.minX < basin.x1 && b.minY < basin.y1 + 2 && b.maxY > basin.y0);
  const W = basin.width;
  const wet = (y: number): number => {
    let a = W * (y - basin.y0);
    for (const b of near) if (b.minY < y) a -= area3(b, basin, y).area;
    return a;
  };
  let total = 0;
  let lo = basin.y0;
  for (const l of basin.layers) {
    total += l.amount;
    let a = lo;
    let b = basin.y0 + (total + near.reduce((s, x) => s + (x.maxX - x.minX) * (x.maxY - x.minY), 0)) / W + 0.01;
    for (let k = 0; k < 28; k += 1) {
      const mid = (a + b) / 2;
      if (wet(mid) < total) a = mid; else b = mid;
    }
    l.top = (a + b) / 2;
    lo = l.top;
  }
}

/** Auftrieb und Widerstand für jeden Körper im Becken. */
export function buoyancy(basin: Basin, bodies: readonly Body[], g: number): void {
  if (basin.layers.length === 0) return;
  for (const b of bodies) {
    if (b.fixed || basin.walls.includes(b) || b.maxX < basin.x0 || b.minX > basin.x1 || b.minY > basin.surface()) continue;
    let below = { area: 0, mx: 0, my: 0 };
    let lift = 0;
    let wetArea = 0;
    let thick = 0;
    for (const l of basin.layers) {
      const upTo = b.minY < l.top ? area3(b, basin, l.top) : below;
      const area = upTo.area - below.area;
      if (area > 1e-9) {
        const cx = (upTo.mx - below.mx) / area;
        const cy = (upTo.my - below.my) / area;
        const f = l.liquid.density * g * area * b.depth;
        b.force(0, f, cx, cy);
        lift += f;
        wetArea += area;
        thick += area * l.liquid.density * l.liquid.thick;
      }
      below = upTo;
    }
    b.wet = wetArea;
    b.lift = lift;
    if (wetArea > 1e-9) {
      /* Widerstand: zäher bremst stärker, schneller auch (Reibung in der Flüssigkeit). */
      const rhoT = thick / wetArea;
      const speed = Math.hypot(b.vx, b.vy);
      const c = rhoT * wetArea * b.depth * (1.6 + 0.9 * speed);
      const cx = below.area > 0 ? below.mx / below.area : b.x;
      const cy = below.area > 0 ? below.my / below.area : b.y;
      b.force(-c * b.vx, -c * b.vy, cx, cy);
      b.tq -= rhoT * wetArea * b.depth * 0.6 * b.w * Math.max(0.05, wetArea);
    }
  }
}

/** Was aus den Löchern fliesst, und durch die Rohre — mit den Tropfen der Strahlen. */
export function flows(basin: Basin, g: number, h: number, drops: Drop[], maxDrops: number): void {
  for (const hole of basin.holes) {
    hole.flow = 0;
    hole.speed = 0;
    if (!hole.open || basin.layers.length === 0) continue;
    const y = hole.side === 'bottom' ? basin.y0 : basin.y0 + hole.at;
    const liquid = basin.liquidAt(y + 1e-4);
    if (liquid === null) continue;
    const layer = basin.layers.find((l) => l.liquid === liquid);
    if (layer === undefined || layer.amount <= 0) continue;
    const v = jetSpeed(basin.pressure(y, g) - P_ATM, liquid.density);
    if (v <= 0.01) continue;
    const q = 0.62 * hole.size * v;
    const out = Math.min(layer.amount, q * h);
    layer.amount -= out;
    hole.flow = out / h;
    hole.speed = v;
    if (drops.length < maxDrops) {
      const side = hole.side === 'left' ? -1 : 1;
      const x = hole.side === 'bottom' ? basin.x0 + hole.at : side < 0 ? basin.x0 - basin.wall : basin.x1 + basin.wall;
      const yy = hole.side === 'bottom' ? basin.y0 - basin.wall : y;
      drops.push({
        x, y: yy + (Math.random() - 0.5) * hole.size * 0.6,
        vx: hole.side === 'bottom' ? (Math.random() - 0.5) * 0.05 : side * v * (0.97 + Math.random() * 0.06),
        vy: hole.side === 'bottom' ? -v : (Math.random() - 0.5) * 0.04,
        amount: out, liquid, life: 6
      });
    }
  }
  if (basin.layers.length > 0 && basin.layers[basin.layers.length - 1].amount <= 1e-9) basin.layers.pop();
}

export function pipeFlow(pipe: Pipe, g: number, h: number): void {
  pipe.flow = 0;
  if (!pipe.open) return;
  const pa = pipe.a.pressure(pipe.y, g) - P_ATM;
  const pb = pipe.b.pressure(pipe.y, g) - P_ATM;
  if (Math.abs(pa - pb) < 1e-3) return;
  const [from, to, dp] = pa > pb ? [pipe.a, pipe.b, pa - pb] : [pipe.b, pipe.a, pb - pa];
  const liquid = from.liquidAt(pipe.y + 1e-4);
  if (liquid === null) return;
  const layer = from.layers.find((l) => l.liquid === liquid);
  if (layer === undefined) return;
  const v = jetSpeed(dp, liquid.density);
  /* Nicht über das Gleichgewicht hinaus: höchstens die Hälfte dessen, was die Drücke angleicht. */
  const equal = (dp / (liquid.density * g)) * (from.width * to.width) / (from.width + to.width);
  const move = Math.min(layer.amount, 0.62 * pipe.size * v * h, equal * 0.5);
  if (move <= 0) return;
  layer.amount -= move;
  to.add(liquid, move);
  pipe.flow = (pa > pb ? 1 : -1) * move / h;
  if (layer.amount <= 1e-9) from.layers.splice(from.layers.indexOf(layer), 1);
}

/** Die Tropfen fliegen (Wurfparabel) — ins nächste Becken, auf den Boden, an eine Wand. */
export function moveDrops(drops: Drop[], basins: readonly Basin[], solids: readonly Body[], g: number, h: number, floor: number): void {
  let w = 0;
  for (let i = 0; i < drops.length; i += 1) {
    const d = drops[i];
    d.vy -= g * h;
    d.x += d.vx * h;
    d.y += d.vy * h;
    d.life -= h;
    let gone = d.life <= 0 || d.y < floor - 0.5;
    if (!gone) {
      for (const b of basins) {
        if (b.inside(d.x, d.y) && d.y <= Math.max(b.surface(), b.y0 + 0.002)) {
          b.add(d.liquid, d.amount);
          const col = Math.floor(((d.x - b.x0) / b.width) * b.waves.length);
          if (col >= 0 && col < b.waves.length) b.wavesV[col] -= Math.min(0.3, Math.abs(d.vy) * 0.05);
          gone = true;
          break;
        }
      }
    }
    if (!gone && d.y <= floor) gone = true;
    if (!gone) {
      for (const s of solids) {
        if (d.x > s.minX && d.x < s.maxX && d.y > s.minY && d.y < s.maxY && s.contains(d.x, d.y)) { gone = true; break; }
      }
    }
    if (!gone) drops[w++] = d;
  }
  drops.length = w;
}

/** Die Wellen: gekoppelte Federn, gedämpft — angestossen von allem, was durch die Oberfläche geht. */
export function waves(basin: Basin, bodies: readonly Body[], h: number): void {
  const n = basin.waves.length;
  const top = basin.surface();
  const dx = basin.width / n;
  for (const b of bodies) {
    if (b.fixed || b.maxX < basin.x0 || b.minX > basin.x1 || b.minY > top + 0.05 || b.maxY < top - 0.05) continue;
    const i0 = Math.max(0, Math.floor((b.minX - basin.x0) / dx));
    const i1 = Math.min(n - 1, Math.floor((b.maxX - basin.x0) / dx));
    for (let i = i0; i <= i1; i += 1) basin.wavesV[i] += b.vy * 0.04 * h * 60;
  }
  const c2 = 2.2;
  for (let i = 0; i < n; i += 1) {
    const l = basin.waves[i > 0 ? i - 1 : i];
    const r = basin.waves[i < n - 1 ? i + 1 : i];
    basin.wavesV[i] += (c2 * (l + r - 2 * basin.waves[i]) / (dx * dx) * 0.002 - 3.2 * basin.wavesV[i] - 22 * basin.waves[i]) * h;
  }
  for (let i = 0; i < n; i += 1) {
    basin.waves[i] += basin.wavesV[i] * h;
    basin.waves[i] = Math.max(-0.08, Math.min(0.08, basin.waves[i]));
  }
}

/** Bewegt sich in den Becken noch etwas (Wellen, Strahlen, Rohre)? */
export function restless(basins: readonly Basin[], pipes: readonly Pipe[], drops: readonly Drop[]): boolean {
  if (drops.length > 0) return true;
  if (pipes.some((p) => Math.abs(p.flow) > 1e-6)) return true;
  for (const b of basins) {
    if (b.holes.some((x) => x.flow > 1e-6)) return true;
    for (let i = 0; i < b.waves.length; i += 1) if (Math.abs(b.wavesV[i]) > 0.002 || Math.abs(b.waves[i]) > 0.002) return true;
  }
  return false;
}

export const liquidOf = (key: unknown): Liquid => (typeof key === 'string' && LIQUIDS[key] !== undefined ? LIQUIDS[key] : LIQUIDS.water);

