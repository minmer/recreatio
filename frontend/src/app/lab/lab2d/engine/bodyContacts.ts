/**
 * LABOR 2D (v2) — BERÜHRUNGEN DER KÖRPER (M3a, SANDBOX.md §6): mit dem Löser
 * der Fizyka 2D (lab/physics/physCollide.ts: Trennachsen mit geschnittenen
 * Berührflächen, zwei Punkte zugleich gelöst, warm gestartet, Coulombsche
 * Reibung) — er hält dort Türme stehen.
 *
 * Jeder Körper besteht aus konvexen Teilen (body.ts: Rechtecke aus den Voxeln,
 * eine Scheibe als Kreis); ein Teil ist ein „Collider“, dessen Lage und
 * Geschwindigkeit die seines Körpers sind (über Zugriffe) — Stösse auf zwei
 * Teile eines Körpers bewegen denselben Körper. Fest sind: die geschlossenen
 * Seiten der Kiste, feste Bauten aus „solid“ (Zellen zu Rechtecken
 * zusammengefasst), angeheftete und schlafende Körper.
 *
 * Masse in den Stössen: die eigene (was die Flüssigkeit beim Aufschlagen tut, kommt im nächsten Schritt als Kraft, bodies.ts).
 * Erlaubtes Eindringen 0,1 Δx und spekulativer Spalt Δx statt der Meter der
 * Fizyka 2D. Die Berührungen werden je Schritt neu gefunden und nach Schlüssel
 * geordnet gelöst; was zum Warmstart bleibt (Merkmal, Stösse und Rückprall
 * je Punkt), steht in Feldern — ein Schlüsselbild nimmt es mit, und der Lauf
 * geht danach Bit für Bit gleich weiter.
 */

import { collide, Contact, prestep, solve, warm, type Collider } from '../../physics/physCollide';
import type { PolyShape, Shape } from '../../physics/physShapes';
import type { Body2D } from './body';
import type { Grid } from './grid';
import { SOLIDS } from './materials';

const ITERATIONS = 10;
/** Die Seiten der Kiste als Stoff (Modellparameter). */
const WALL = { friction: 0.5, bounce: 0.1 } as const;
/** Bewegt sich ein wacher Körper an einem schlafenden schneller als das (m/s), weckt er ihn. */
const WAKE_SPEED = 0.01;

/** Ein Rechteck als konvexes Vieleck (gegen den Uhrzeigersinn, Normalen nach aussen). */
function boxShape(x0: number, y0: number, x1: number, y1: number): PolyShape {
  const xs = new Float64Array([x0, x1, x1, x0]);
  const ys = new Float64Array([y0, y0, y1, y1]);
  const nx = new Float64Array([0, 1, 0, -1]);
  const ny = new Float64Array([-1, 0, 1, 0]);
  let radius = 0;
  for (let i = 0; i < 4; i += 1) radius = Math.max(radius, Math.hypot(xs[i], ys[i]));
  return { kind: 'poly', xs, ys, nx, ny, n: 4, radius };
}

/** Ein Teil: Lage und Geschwindigkeit sind die seines Körpers (ohne Körper: fest im Raum). */
class Part implements Collider {
  readonly wx: Float64Array;
  readonly wy: Float64Array;
  readonly wnx: Float64Array;
  readonly wny: Float64Array;
  minX = 0;
  minY = 0;
  maxX = 0;
  maxY = 0;
  invM = 0;
  invI = 0;

  constructor(readonly id: number, readonly body: Body2D | null, public shape: Shape, readonly material: { readonly friction: number; readonly bounce: number }) {
    const n = shape.kind === 'poly' ? shape.n : 0;
    this.wx = new Float64Array(n);
    this.wy = new Float64Array(n);
    this.wnx = new Float64Array(n);
    this.wny = new Float64Array(n);
  }

  get x(): number { return this.body !== null ? this.body.x : 0; }
  set x(v: number) { if (this.body !== null) this.body.x = v; }
  get y(): number { return this.body !== null ? this.body.y : 0; }
  set y(v: number) { if (this.body !== null) this.body.y = v; }
  get vx(): number { return this.body !== null ? this.body.vx : 0; }
  set vx(v: number) { if (this.body !== null && this.invM > 0) this.body.vx = v; }
  get vy(): number { return this.body !== null ? this.body.vy : 0; }
  set vy(v: number) { if (this.body !== null && this.invM > 0) this.body.vy = v; }
  get w(): number { return this.body !== null ? this.body.w : 0; }
  set w(v: number) { if (this.body !== null && this.invI > 0) this.body.w = v; }

  /** Ecken und Umgrenzung in der Welt (ein festes Teil ohne Körper liegt schon in der Welt). */
  update(): void {
    const s = this.shape;
    const b = this.body;
    const x = b !== null ? b.x : 0;
    const y = b !== null ? b.y : 0;
    if (s.kind === 'circle') {
      this.minX = x - s.r; this.maxX = x + s.r; this.minY = y - s.r; this.maxY = y + s.r;
      return;
    }
    const c = b !== null ? Math.cos(b.a) : 1;
    const sn = b !== null ? Math.sin(b.a) : 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < s.n; i += 1) {
      const px = x + c * s.xs[i] - sn * s.ys[i];
      const py = y + sn * s.xs[i] + c * s.ys[i];
      this.wx[i] = px;
      this.wy[i] = py;
      this.wnx[i] = c * s.nx[i] - sn * s.ny[i];
      this.wny[i] = sn * s.nx[i] + c * s.ny[i];
      if (px < minX) minX = px; if (px > maxX) maxX = px;
      if (py < minY) minY = py; if (py > maxY) maxY = py;
    }
    this.minX = minX; this.minY = minY; this.maxX = maxX; this.maxY = maxY;
  }
}

export class BodyContacts {
  /** Die Teile (Arbeitsspeicher: aus den Körpern und dem Bau gebaut). */
  private parts: Part[] = [];
  private byBody: Part[][] = [];
  private builtFor = -1;
  /** Warmstart je Berührung, nach Schlüssel geordnet: Schlüssel; je Berührung Anzahl und je Punkt (zwei) Merkmal, Normal- und Reibungsstoss, Rückprall. */
  warmKey = new Float64Array(0);
  warmData = new Float64Array(0);
  warmCount = 0;
  /** Welche Körper in diesem Schritt etwas berührten (für das Einschlafen). */
  touching = new Uint8Array(0);
  /** Körper, die ein wacher Körper eben angestossen hat (zu wecken). */
  readonly toWake: number[] = [];
  private readonly cache = new Map<number, Contact>();
  private readonly live: Contact[] = [];
  private readonly liveKey: number[] = [];

  constructor(private readonly grid: () => Grid) {}

  /** Teile neu bauen (nach einer Änderung der Körper oder des Baus). */
  invalidate(): void { this.builtFor = -1; }

  /**
   * Die Teile eines Körpers an seine neuen Rechtecke (Schmelzen, Anfrieren:
   * gleiche Zahl) — an Ort und Stelle, die Berührungen behalten ihren
   * Warmstart; hat sich die Zahl geändert, alles neu.
   */
  reshape(b: Body2D): void {
    if (this.builtFor < 0) return;
    const own = this.byBody[b.index];
    if (own === undefined || own.length !== b.nr) { this.invalidate(); return; }
    for (let r = 0; r < b.nr; r += 1) {
      const [x0, y0, x1, y1] = b.bounds(r);
      own[r].shape = boxShape(x0, y0, x1, y1);
      own[r].update();
    }
  }

  private build(bodies: readonly Body2D[], version: number): void {
    const g = this.grid();
    const parts: Part[] = [];
    const W = g.w;
    const H = g.h;
    if (!g.openL) parts.push(new Part(1, null, boxShape(-1, -1, 0, H + 1), WALL));
    if (!g.openR) parts.push(new Part(2, null, boxShape(W, -1, W + 1, H + 1), WALL));
    if (!g.openB) parts.push(new Part(3, null, boxShape(-1, -1, W + 1, 0), WALL));
    if (!g.openT) parts.push(new Part(4, null, boxShape(-1, H, W + 1, H + 1), WALL));
    /* Fester Bau (Zellen ohne Körper): Läufe je Zeile, gleiche Läufe übereinander zu Rechtecken. */
    const { nx, ny, dx } = g;
    let open = new Map<number, number>();
    let tid = 10;
    for (let j = 0; j <= ny; j += 1) {
      const next = new Map<number, number>();
      if (j < ny) {
        let i = 0;
        while (i < nx) {
          const c = i + j * nx;
          if (g.solid[c] === 0 || g.owner[c] !== 0) { i += 1; continue; }
          const mat = g.solid[c];
          let e = i;
          while (e + 1 < nx && g.solid[e + 1 + j * nx] === mat && g.owner[e + 1 + j * nx] === 0) e += 1;
          const key = (mat << 24) | (i << 12) | e;
          next.set(key, open.has(key) ? (open.get(key) as number) : j);
          i = e + 1;
        }
      }
      for (const [key, start] of open) {
        if (next.get(key) === start) continue;
        const mat = this.solidMaterial(key >>> 24);
        parts.push(new Part(tid++, null, boxShape(((key >> 12) & 0xfff) * dx, start * dx, ((key & 0xfff) + 1) * dx, j * dx), mat));
      }
      open = next;
    }
    /* Die Körper: ein Teil je Rechteck, relativ zum Schwerpunkt. */
    this.byBody = bodies.map(() => []);
    for (const b of bodies) {
      if (b.gone) continue;
      const mat = this.solidMaterial(b.mat + 1);
      for (let r = 0; r < b.nr; r += 1) {
        const [x0, y0, x1, y1] = b.bounds(r);
        const shape: Shape = boxShape(x0, y0, x1, y1);
        const p = new Part(100000 + b.index * 1000 + r, b, shape, mat);
        parts.push(p);
        this.byBody[b.index].push(p);
      }
    }
    for (const p of parts) p.update();
    this.parts = parts;
    this.builtFor = version;
  }

  private solidMaterial(solidPlus1: number): { friction: number; bounce: number } {
    const s = SOLIDS[solidPlus1 - 1];
    return s !== undefined ? { friction: s.friction, bounce: s.bounce } : WALL;
  }

  /**
   * Ein Schritt der Berührungen: wache Körper gegen alles andere (feste Teile,
   * angeheftete und schlafende Körper sind unendlich schwer), gelöst mit den
   * eigenen Massen; danach in warmKey/warmData, was der nächste Schritt (oder
   * ein Schlüsselbild) zum Warmstart braucht.
   */
  step(dt: number, bodies: readonly Body2D[], version: number, slop: number, spec: number): void {
    if (this.builtFor !== version) { this.build(bodies, version); this.cache.clear(); }
    if (this.touching.length < bodies.length) this.touching = new Uint8Array(bodies.length + 8);
    this.touching.fill(0);
    this.toWake.length = 0;
    /* Massen der Teile und ihre Lage in der Welt. */
    for (const p of this.parts) {
      const b = p.body;
      if (b === null) continue;
      const dyn = b.awake;
      p.invM = dyn ? 1 / b.m : 0;
      p.invI = dyn ? 1 / b.I : 0;
      p.update();
    }
    for (const c of this.cache.values()) c.touched = false;
    /* Paare: ein Teil eines wachen Körpers gegen jedes Teil eines anderen (Umgrenzungen mit dem spekulativen Spalt). */
    const live = this.live;
    const liveKey = this.liveKey;
    live.length = 0;
    liveKey.length = 0;
    const parts = this.parts;
    for (let i = 0; i < parts.length; i += 1) {
      const a = parts[i];
      for (let j = i + 1; j < parts.length; j += 1) {
        const b = parts[j];
        const da = a.invM > 0;
        const db = b.invM > 0;
        if (!da && !db) continue;
        if (a.body !== null && a.body === b.body) continue;
        if (b.minX > a.maxX + spec || b.maxX < a.minX - spec || b.minY > a.maxY + spec || b.maxY < a.minY - spec) continue;
        const key = a.id * 1e6 + b.id;
        let c = this.cache.get(key);
        if (c === undefined) {
          c = new Contact(a, b);
          c.slop = slop;
          c.spec = spec;
          this.restore(c, key);
          this.cache.set(key, c);
        }
        c.touched = true;
        if (collide(c) > 0) { live.push(c); liveKey.push(key); }
        else { c.count = 0; }
      }
    }
    /* Nach Schlüssel geordnet lösen: dieselbe Reihenfolge wie nach einem Schlüsselbild. */
    const order = liveKey.map((_k, q) => q).sort((p, q) => liveKey[p] - liveKey[q]);
    for (const q of order) prestep(live[q], dt);
    for (const q of order) warm(live[q]);
    for (let it = 0; it < ITERATIONS; it += 1) for (const q of order) solve(live[q]);
    /* Wer berührt wen; wer wird geweckt. */
    for (const q of order) {
      const c = live[q];
      const A = (c.a as Part).body;
      const B = (c.b as Part).body;
      if (A !== null) this.touching[A.index] = 1;
      if (B !== null) this.touching[B.index] = 1;
      if (A !== null && B !== null && A.asleep !== B.asleep && !A.pinned && !B.pinned) {
        const mover = A.asleep ? B : A;
        const sleeper = A.asleep ? A : B;
        if (mover.speed() > WAKE_SPEED) this.toWake.push(sleeper.index);
      }
    }
    /* Was nicht mehr berührt, fällt aus dem Speicher; der Rest in die Felder des Warmstarts. */
    for (const [key, c] of this.cache) if (!c.touched || c.count === 0) this.cache.delete(key);
    this.save(order.map((q) => liveKey[q]), order.map((q) => live[q]));
  }

  /** Steht dieser Körper auf etwas (hat er in diesem Schritt etwas berührt)? */
  touches(b: Body2D): boolean {
    return this.touching[b.index] === 1;
  }

  private save(keys: number[], contacts: Contact[]): void {
    const n = keys.length;
    if (this.warmKey.length < n) { this.warmKey = new Float64Array(2 * n + 8); this.warmData = new Float64Array(9 * (2 * n + 8)); }
    for (let k = 0; k < n; k += 1) {
      const c = contacts[k];
      this.warmKey[k] = keys[k];
      const o = 9 * k;
      this.warmData[o] = c.count;
      for (let i = 0; i < 2; i += 1) {
        const p = c.points[i];
        this.warmData[o + 1 + 4 * i] = p.id;
        this.warmData[o + 2 + 4 * i] = p.jn;
        this.warmData[o + 3 + 4 * i] = p.jt;
        this.warmData[o + 4 + 4 * i] = p.kicked ? 1 : 0;
      }
    }
    this.warmCount = n;
  }

  /** Eine neu angelegte Berührung mit dem Warmstart aus den Feldern (nach einem Schlüsselbild, oder sie berührte im letzten Schritt). */
  private restore(c: Contact, key: number): void {
    let lo = 0;
    let hi = this.warmCount - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const k = this.warmKey[mid];
      if (k === key) {
        const o = 9 * mid;
        c.count = this.warmData[o];
        for (let i = 0; i < 2; i += 1) {
          const p = c.points[i];
          p.id = this.warmData[o + 1 + 4 * i];
          p.jn = this.warmData[o + 2 + 4 * i];
          p.jt = this.warmData[o + 3 + 4 * i];
          p.kicked = this.warmData[o + 4 + 4 * i] === 1;
        }
        return;
      }
      if (k < key) lo = mid + 1; else hi = mid - 1;
    }
  }
}
