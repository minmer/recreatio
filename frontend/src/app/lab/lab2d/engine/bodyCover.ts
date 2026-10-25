/**
 * LABOR 2D (v2) — KÖRPER UND GITTER (seit 2026-10-23; ersetzt das Schreiben
 * der Voxel aus M3a): die Rechtecke eines Körpers liegen genau, zwischen den
 * Zellmitten und schräg; das Gitter sieht sie mit Anteilen.
 *
 * - <b>Gewichte</b>: jede innere Zelle eines Körpers (body.ts) liegt mit
 *   einem Anteil ihrer Fläche in jeder Gitterzelle, die sie schneidet (genau:
 *   ein gedrehtes Viereck gegen ein Quadrat, geom.ts). Mit diesen Gewichten
 *   bekommt die Gitterzelle ihren festen Anteil fs, die Wärmekapazität und
 *   Energie der Körperteile (capB, Es), Film und Kruste — und gibt am Ende des
 *   Schritts zurück, was Wärmeleitung, Tau und Salz dort geändert haben: die
 *   Energie nach Wärmekapazität, Film und Kruste nach Anteil (collect). Nichts
 *   geht verloren; die inneren Zellen sind zwischen den Schritten der Zustand.
 * - <b>Feste und gemischte Zellen</b>: eine Zelle, die zu mindestens CLOSED
 *   bedeckt ist (CLOSED_FREE bei einem freien Körper) oder die ein Rechteck in zwei Teile schneidet (eine dünne Wand
 *   quer durch die Zelle), ist fest (grid.solid, owner); jede andere ist eine
 *   Fluidzelle mit dem Volumen V (1 − fs) — darin können Wasser, Gas und ein
 *   Stück Körper zugleich liegen.
 * - <b>Seitenflächen</b>: der offene Anteil jeder Fläche (grid.au, av) und die
 *   Geschwindigkeit ihres bedeckten Teils (usol, vsol) — die Projektionen
 *   rechnen damit wie Batty, Bertails & Bridson (2007): Fluss α u + (1 − α) u_Körper.
 * - <b>Werden Zellen fest</b>, geht ihr Gas zu den Fluidnachbarn; <b>werden
 *   sie frei</b>, holen sie Gas von ihnen oder werden Flüssigkeit.
 * - <b>Teilchen und Blasen</b> bleiben genau aus den Rechtecken: wer auf
 *   seinem Weg in eines gerät (auch quer durch eine dünne Wand), geht zurück
 *   vor die Seite, durch die er kam; seine Geschwindigkeit in den Körper hinein
 *   (relativ zu ihm) fällt weg.
 */

import { Body2D } from './body';
import type { Bubbles } from './bubbles';
import { collectBodies, CollectWork } from './coverCollect';
import type { Gas } from './gas';
import { clipSegment, quadInBox, splitsCell } from './geom';
import type { Grid } from './grid';
import type { Heat } from './heat';
import type { Particles } from './particles';
import { GAS, LIQUID, SOLID } from './units';

/** Ab diesem bedeckten Anteil ist eine Zelle eines angehefteten Körpers fest (ihr Rest an Fluid zählt nicht). */
export const CLOSED = 0.99;
/**
 * Dasselbe für einen freien Körper (seit 2026-10-25; vorher auch 0,99): neben einem Körper, der sich Schritt für Schritt
 * bewegt (ein schmelzender Eiswürfel sinkt nach), blieben Splitter mit 1–10 % offenem Raum, die sich in jedem Schritt
 * änderten — ihr Gas hatte fast keine Wärmekapazität und musste durch Seitenflächen mit 4 % Öffnung, die
 * Gasgeschwindigkeit dort stieg auf 9 m/s, Zellen liefen leer, und schliesslich explodierte das Gas. Angeheftete Körper
 * behalten 0,99: ihre Splitter stehen still, und die Stefan-Front (Test 41) läuft durch die Zellen wie zuvor.
 */
export const CLOSED_FREE = 0.9;
/**
 * Ein Spalt zwischen einem Körper und etwas anderem Festem (dem Boden, einer
 * Wand, einem anderen Körper), dünner als eine halbe Zelle, ist nicht
 * aufgelöst — die Teilchen liegen eine halbe Zelle auseinander: eine Zelle,
 * die ein Körper zu mindestens SQUEEZE bedeckt und die an Festes grenzt, ist
 * fest (das Wasser darin geht hinaus wie aus jeder Zelle, die fest wird).
 */
export const SQUEEZE = 0.5;
/** Abstand, mit dem hinausgeschobene Punkte vor einer Seite liegen (Anteil der Zellkante). */
const MARGIN = 0.02;

export interface CoverWorld {
  readonly grid: Grid;
  readonly gas: Gas;
  readonly heat: Heat;
  readonly particles: Particles;
  readonly bubbles: Bubbles;
}

export class BodyCover {
  private readonly w: CoverWorld;
  /** Je Zelle die Werte der Körperteile beim letzten Abgleich (für collect) und Σ Gewichte. */
  readonly esSync: Float64Array;
  readonly filmSync: Float64Array;
  readonly crustSync: Float64Array;
  readonly wsum: Float64Array;
  /** Arbeitsfelder für collect (coverCollect.ts). */
  private readonly work: CollectWork;
  /* Arbeitsspeicher. */
  private readonly best: Float64Array;
  private readonly acc: Float64Array;
  private readonly split: Uint8Array;
  private readonly was: Uint8Array;
  private readonly now: Uint8Array;
  private readonly stamp: Int32Array;
  private readonly fstamp: Int32Array;
  private tag = 0;
  private ftag = 0;
  private readonly seen: Int32Array;
  private readonly queue: Int32Array;
  private seenTag = 0;
  private list = new Int32Array(256);
  private listN = 0;
  private readonly box = new Float64Array(4);
  private readonly l0 = new Float64Array(2);
  private readonly l1 = new Float64Array(2);
  private readonly wp = new Float64Array(2);
  private readonly seg = new Float64Array(2);
  private readonly cb = new Float64Array(4);
  /** Je Körper: Fläche und Wärmekapazität jeder inneren Zelle, die festen (durchschnittenen) Zellen, die Umgrenzung in der Welt. */
  private areaK: Float64Array[] = [];
  private capK: Float64Array[] = [];
  private splits: Int32Array[] = [];
  private boxes = new Float64Array(64);
  /** Die Normale der zuletzt durchstossenen Seite (Welt), nach hit/moveOut. */
  nx = 0;
  ny = 0;
  /** Je Seitenfläche (u-Flächen, dann v-Flächen): Nummer + 1 des Körpers, der sie am meisten bedeckt (0: keiner). */
  readonly faceOwner: Int16Array;
  /** Ging eine Fläche ganz zu oder wieder auf (die Gebiete hängen anders zusammen)? */
  topologyChanged = false;

  constructor(w: CoverWorld) {
    this.w = w;
    const n = w.grid.n;
    this.faceOwner = new Int16Array(w.grid.nu + w.grid.nv);
    this.esSync = new Float64Array(n);
    this.filmSync = new Float64Array(n);
    this.crustSync = new Float64Array(n);
    this.wsum = new Float64Array(n);
    this.work = new CollectWork(n);
    this.best = new Float64Array(n);
    this.acc = new Float64Array(n);
    this.split = new Uint8Array(n);
    this.was = new Uint8Array(n);
    this.now = new Uint8Array(n);
    this.stamp = new Int32Array(n);
    this.fstamp = new Int32Array(w.grid.nu + w.grid.nv);
    this.seen = new Int32Array(n);
    this.queue = new Int32Array(n);
  }

  /* -- Gewichte ----------------------------------------------------------------------------------- */

  /** Die Umgrenzung des Körpers in der Welt beim letzten weigh (x0, y0, x1, y1). */
  boxOf(b: Body2D): Float64Array {
    return this.boxes.subarray(4 * b.index, 4 * b.index + 4);
  }

  /** Gewichte, durchschnittene Zellen und Umgrenzung des Körpers an seiner jetzigen Lage (b.x, b.y, b.a). */
  weigh(b: Body2D): void {
    const g = this.w.grid;
    const { nx, ny, dx } = g;
    if (this.boxes.length < 4 * (b.index + 1)) { const nb = new Float64Array(8 * (b.index + 1)); nb.set(this.boxes); this.boxes = nb; }
    const box = this.boxOf(b);
    if (b.gone || b.ncell === 0) { b.nw = 0; this.splits[b.index] = new Int32Array(0); box[0] = 1; box[1] = 1; box[2] = 0; box[3] = 0; return; }
    b.worldBox(b.x, b.y, b.a, box);
    /* Fläche und Wärmekapazität je innere Zelle. */
    let A = this.areaK[b.index];
    let C = this.capK[b.index];
    if (A === undefined || A.length !== b.ncell) { A = new Float64Array(b.ncell); C = new Float64Array(b.ncell); this.areaK[b.index] = A; this.capK[b.index] = C; }
    for (let k = 0; k < b.ncell; k += 1) { A[k] = b.cellVolume(k) / b.depth; C[k] = b.cellCap(k); }
    const c = Math.cos(b.a);
    const s = Math.sin(b.a);
    let n = 0;
    const cb = this.cb;
    const splitCells: number[] = [];
    for (let k = 0; k < b.ncell; k += 1) {
      b.cellBox(k, cb);
      const lx0 = cb[0], ly0 = cb[1], lx1 = cb[2], ly1 = cb[3];
      const x0 = b.x + c * lx0 - s * ly0, y0 = b.y + s * lx0 + c * ly0;
      const x1 = b.x + c * lx1 - s * ly0, y1 = b.y + s * lx1 + c * ly0;
      const x2 = b.x + c * lx1 - s * ly1, y2 = b.y + s * lx1 + c * ly1;
      const x3 = b.x + c * lx0 - s * ly1, y3 = b.y + s * lx0 + c * ly1;
      const i0 = Math.max(0, Math.floor(Math.min(x0, x1, x2, x3) / dx));
      const i1 = Math.min(nx - 1, Math.floor(Math.max(x0, x1, x2, x3) / dx));
      const j0 = Math.max(0, Math.floor(Math.min(y0, y1, y2, y3) / dx));
      const j1 = Math.min(ny - 1, Math.floor(Math.max(y0, y1, y2, y3) / dx));
      for (let j = j0; j <= j1; j += 1) {
        for (let i = i0; i <= i1; i += 1) {
          const cell = i + j * nx;
          /* Ein fester Bau aus „solid“ nimmt keinen Körper auf (die Berührung hält ihn draussen bis auf das erlaubte Eindringen). */
          if (g.solid[cell] !== 0 && g.owner[cell] === 0) continue;
          const area = quadInBox(x0, y0, x1, y1, x2, y2, x3, y3, i * dx, j * dx, (i + 1) * dx, (j + 1) * dx);
          if (area <= 1e-12 * A[k]) continue;
          if (n >= b.wk.length) this.growWeights(b, 2 * n + 64);
          b.wk[n] = k;
          b.wc[n] = cell;
          b.ww[n] = area / A[k];
          n += 1;
        }
      }
    }
    b.nw = n;
    /* Durchschnittene Zellen: je Rechteck jede Zelle seiner Umgrenzung. */
    for (let r = 0; r < b.nr; r += 1) {
      const rx0 = b.xs[r][0], ry0 = b.ys[r][0], rx1 = b.xs[r][b.ni[r]], ry1 = b.ys[r][b.nj[r]];
      let mx0 = Infinity, my0 = Infinity, mx1 = -Infinity, my1 = -Infinity;
      for (let q = 0; q < 4; q += 1) {
        const lx = q === 0 || q === 3 ? rx0 : rx1;
        const ly = q < 2 ? ry0 : ry1;
        const wx = b.x + c * lx - s * ly;
        const wy = b.y + s * lx + c * ly;
        mx0 = Math.min(mx0, wx); mx1 = Math.max(mx1, wx); my0 = Math.min(my0, wy); my1 = Math.max(my1, wy);
      }
      const i0 = Math.max(0, Math.floor(mx0 / dx));
      const i1 = Math.min(nx - 1, Math.floor(mx1 / dx));
      const j0 = Math.max(0, Math.floor(my0 / dx));
      const j1 = Math.min(ny - 1, Math.floor(my1 / dx));
      for (let j = j0; j <= j1; j += 1) {
        for (let i = i0; i <= i1; i += 1) {
          if (splitsCell(b.x, b.y, b.a, rx0, ry0, rx1, ry1, i * dx, j * dx, (i + 1) * dx, (j + 1) * dx)) splitCells.push(i + j * nx);
        }
      }
    }
    this.splits[b.index] = Int32Array.from(splitCells);
  }

  private growWeights(b: Body2D, size: number): void {
    const wk = new Int32Array(size);
    const wc = new Int32Array(size);
    const ww = new Float64Array(size);
    wk.set(b.wk.subarray(0, Math.min(b.wk.length, size)));
    wc.set(b.wc.subarray(0, Math.min(b.wc.length, size)));
    ww.set(b.ww.subarray(0, Math.min(b.ww.length, size)));
    b.wk = wk;
    b.wc = wc;
    b.ww = ww;
  }

  /* -- Abgleich mit dem Gitter -------------------------------------------------------------------- */

  /** Die Zellen eines Körpers (aus seinen Gewichten und durchschnittenen Zellen) zur Liste der neu zu bauenden Zellen. */
  addCells(b: Body2D): void {
    for (let e = 0; e < b.nw; e += 1) this.push(b.wc[e]);
    const sp = this.splits[b.index];
    if (sp !== undefined) for (let q = 0; q < sp.length; q += 1) this.push(sp[q]);
  }

  /** Alle Zellen zur Liste (nach einem Werkzeug oder beim Aufbau). */
  addAll(): void {
    const n = this.w.grid.n;
    for (let c = 0; c < n; c += 1) this.push(c);
  }

  private push(c: number): void {
    if (this.stamp[c] === this.tag + 1) return;
    this.stamp[c] = this.tag + 1;
    if (this.listN >= this.list.length) { const l = new Int32Array(2 * this.list.length); l.set(this.list); this.list = l; }
    this.list[this.listN++] = c;
  }

  /** Ist die Liste leer? */
  get pending(): boolean { return this.listN > 0; }

  /** Die Umgrenzung der ausstehenden Zellen (i0, j0, i1, j1). */
  pendingBox(): [number, number, number, number] {
    const nx = this.w.grid.nx;
    let i0 = Infinity, j0 = Infinity, i1 = -Infinity, j1 = -Infinity;
    for (let q = 0; q < this.listN; q += 1) {
      const c = this.list[q];
      const i = c % nx;
      const j = (c - i) / nx;
      if (i < i0) i0 = i;
      if (i > i1) i1 = i;
      if (j < j0) j0 = j;
      if (j > j1) j1 = j;
    }
    return [i0, j0, i1, j1];
  }

  /**
   * Die Zellen der Liste aus allen Körpern neu: fester Anteil, Wärmekapazität,
   * Energie, Film und Kruste der Körperteile, Besitzer, fest oder frei (mit dem
   * Gas, das dabei wandert), dann die Seitenflächen dieser Zellen. Liefert die
   * Zahl der Zellen, die fest ↔ frei gewechselt haben; leert die Liste.
   */
  rebuild(bodies: readonly Body2D[]): number {
    const g = this.w.grid;
    const { nx, ny, dx } = g;
    const tag = ++this.tag;
    const list = this.list;
    const N = this.listN;
    this.listN = 0;
    if (N === 0) return 0;
    const invA = 1 / (dx * dx);
    let ci0 = nx, ci1 = -1, cj0 = ny, cj1 = -1;
    for (let q = 0; q < N; q += 1) {
      const c = list[q];
      const i = c % nx;
      const j = (c - i) / nx;
      if (i < ci0) ci0 = i;
      if (i > ci1) ci1 = i;
      if (j < cj0) cj0 = j;
      if (j > cj1) cj1 = j;
      const painted = g.solid[c] !== 0 && g.owner[c] === 0;
      this.was[c] = g.solid[c] !== 0 && g.owner[c] !== 0 ? 1 : 0;
      g.fs[c] = 0;
      g.capB[c] = 0;
      this.wsum[c] = 0;
      this.best[c] = 0;
      this.split[c] = 0;
      g.matB[c] = 0;
      if (!painted) { g.Es[c] = 0; g.film[c] = 0; g.crust[c] = 0; g.owner[c] = 0; }
    }
    const bx0 = ci0 * dx, by0 = cj0 * dx, bx1 = (ci1 + 1) * dx, by1 = (cj1 + 1) * dx;
    for (const b of bodies) {
      if (b.gone || b.nw === 0) continue;
      const box = this.boxOf(b);
      if (box[0] > bx1 || box[2] < bx0 || box[1] > by1 || box[3] < by0) continue;
      const A = this.areaK[b.index];
      const C = this.capK[b.index];
      const acc = this.acc;
      for (let e = 0; e < b.nw; e += 1) {
        const c = b.wc[e];
        if (this.stamp[c] !== tag) continue;
        const k = b.wk[e];
        const wgt = b.ww[e];
        const a = wgt * A[k] * invA;
        g.fs[c] += a;
        acc[c] += a;
        g.capB[c] += wgt * C[k];
        g.Es[c] += wgt * b.E[k];
        g.film[c] += wgt * b.film[k];
        g.crust[c] += wgt * b.crust[k];
        this.wsum[c] += wgt;
      }
      /* Der Körper mit dem grössten Anteil besitzt die Zelle. */
      for (let e = 0; e < b.nw; e += 1) {
        const c = b.wc[e];
        if (this.stamp[c] !== tag || acc[c] === 0) continue;
        if (acc[c] > this.best[c]) { this.best[c] = acc[c]; g.owner[c] = b.index + 1; g.matB[c] = b.mat + 1; }
        acc[c] = 0;
      }
      const sp = this.splits[b.index];
      for (let q = 0; q < sp.length; q += 1) if (this.stamp[sp[q]] === tag) this.split[sp[q]] = 1;
    }
    /* Die Seitenflächen dieser Zellen: offener Anteil und Geschwindigkeit des bedeckten Teils. */
    const ftag = ++this.ftag;
    for (let q = 0; q < N; q += 1) {
      const c = list[q];
      const i = c % nx;
      const j = (c - i) / nx;
      this.face(bodies, i, j, true, ftag);
      this.face(bodies, i + 1, j, true, ftag);
      this.face(bodies, i, j, false, ftag);
      this.face(bodies, i, j + 1, false, ftag);
    }
    /* Fest oder frei: erst wissen, was alles fest wird (dorthin darf kein Gas), dann wechseln — über die neuen Flächen (eine dünne Wand lässt kein Gas durch). */
    for (let q = 0; q < N; q += 1) {
      const c = list[q];
      if (g.fs[c] > 1) g.fs[c] = 1;
      const painted = g.solid[c] !== 0 && g.owner[c] === 0 && this.was[c] === 0;
      this.now[c] = !painted && g.owner[c] !== 0 && (g.fs[c] >= (bodies[g.owner[c] - 1]?.free ? CLOSED_FREE : CLOSED) || this.split[c] !== 0) ? 1 : 0;
    }
    /* Unaufgelöste Spalte: zu mindestens SQUEEZE bedeckt und neben Festem, das nicht derselbe Körper ist. */
    for (let q = 0; q < N; q += 1) {
      const c = list[q];
      if (this.now[c] !== 0 || g.owner[c] === 0 || g.fs[c] < SQUEEZE || (g.solid[c] !== 0 && this.was[c] === 0)) continue;
      if (this.besideOther(c)) this.now[c] = 1;
    }
    let flips = 0;
    for (let q = 0; q < N; q += 1) {
      const c = list[q];
      if (this.now[c] === 1) {
        if (this.was[c] === 0) { flips += 1; this.gasOut(c); }
        const b = bodies[g.owner[c] - 1];
        g.solid[c] = b.mat + 1;
        g.kind[c] = SOLID;
        g.role[c] = 0;
        g.heater[c] = -1;
      } else if (this.was[c] === 1) {
        flips += 1;
        g.solid[c] = 0;
        g.role[c] = 0;
        g.heater[c] = -1;
        this.vacate(c);
      }
    }
    /* Abgleich und Temperaturen der Körperteile. */
    const heat = this.w.heat;
    for (let q = 0; q < N; q += 1) {
      const c = list[q];
      this.esSync[c] = g.Es[c];
      this.filmSync[c] = g.film[c];
      this.crustSync[c] = g.crust[c];
      if (g.capB[c] > 0) heat.deriveSolid(c);
    }
    return flips;
  }

  /** Grenzt die Zelle an Festes, das nicht ihrem Körper gehört: eine Wandseite der Kiste, einen festen Bau, eine Zelle eines anderen Körpers (fest oder zu mindestens SQUEEZE bedeckt)? */
  private besideOther(c: number): boolean {
    const g = this.w.grid;
    const { nx, ny } = g;
    const i = c % nx;
    const j = (c - i) / nx;
    const own = g.owner[c];
    for (let k = 0; k < 4; k += 1) {
      const ii = i + (k === 0 ? -1 : k === 1 ? 1 : 0);
      const jj = j + (k === 2 ? -1 : k === 3 ? 1 : 0);
      if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) {
        const wall = ii < 0 ? !g.openL : ii >= nx ? !g.openR : jj < 0 ? !g.openB : !g.openT;
        if (wall) return true;
        continue;
      }
      const nb = ii + jj * nx;
      if (g.solid[nb] !== 0 && g.owner[nb] === 0) return true;
      if (g.owner[nb] !== 0 && g.owner[nb] !== own && (g.solid[nb] !== 0 || g.fs[nb] >= SQUEEZE)) return true;
    }
    return false;
  }

  /** Offener Anteil und Geschwindigkeit des bedeckten Teils einer Fläche (u-Fläche bei x = iΔx oder v-Fläche bei y = jΔx). */
  private face(bodies: readonly Body2D[], i: number, j: number, isU: boolean, ftag: number): void {
    const g = this.w.grid;
    const { nx, ny, dx } = g;
    if (isU ? i > nx || j >= ny : i >= nx || j > ny) return;
    const f = isU ? i + j * (nx + 1) : i + j * nx;
    const key = isU ? f : g.nu + f;
    if (this.fstamp[key] === ftag) return;
    this.fstamp[key] = ftag;
    const ax = i * dx;
    const ay = j * dx;
    const ex = isU ? ax : ax + dx;
    const ey = isU ? ay + dx : ay;
    let cover = 0;
    let most = 0;
    let vel = 0;
    let owner = 0;
    const l0 = this.l0;
    const l1 = this.l1;
    for (const b of bodies) {
      if (b.gone || b.nw === 0) continue;
      const box = this.boxOf(b);
      if (box[0] > Math.max(ax, ex) || box[2] < Math.min(ax, ex) || box[1] > Math.max(ay, ey) || box[3] < Math.min(ay, ey)) continue;
      Body2D.toLocal(b.x, b.y, b.a, ax, ay, l0);
      Body2D.toLocal(b.x, b.y, b.a, ex, ey, l1);
      let covB = 0;
      for (let r = 0; r < b.nr; r += 1) {
        const rx0 = b.xs[r][0], ry0 = b.ys[r][0], rx1 = b.xs[r][b.ni[r]], ry1 = b.ys[r][b.nj[r]];
        covB += clipSegment(l0[0], l0[1], l1[0], l1[1], rx0, ry0, rx1, ry1, this.seg);
      }
      if (covB <= 0) continue;
      cover += covB;
      if (covB > most) {
        most = covB;
        owner = b.index + 1;
        const mx = 0.5 * (ax + ex);
        const my = 0.5 * (ay + ey);
        vel = isU ? b.vx - b.w * (my - b.y) : b.vy + b.w * (mx - b.x);
      }
    }
    const open = cover >= 1 - 1e-9 ? 0 : Math.max(0, 1 - cover);
    const before = isU ? g.au[f] : g.av[f];
    if ((before > 0) !== (open > 0)) this.topologyChanged = true;
    this.faceOwner[key] = owner;
    if (isU) { g.au[f] = open; g.usol[f] = cover > 0 ? vel : 0; }
    else { g.av[f] = open; g.vsol[f] = cover > 0 ? vel : 0; }
  }

  /** Was Wärmeleitung, Tau, Kristalle und Blasen an den Körperteilen der Zellen änderten, an die inneren Zellen (coverCollect.ts). */
  collect(bodies: readonly Body2D[]): void {
    collectBodies(this.w.grid, bodies, this, this.capK, this.work);
  }

  /** Der Körper verlässt das Gitter (er ist weg oder wird gleich neu gelegt): seine Gewichte leer; die Zellen baut rebuild neu. */
  release(b: Body2D): void {
    this.addCells(b);
    b.nw = 0;
    this.splits[b.index] = new Int32Array(0);
  }

  /* -- Teilchen und Blasen ------------------------------------------------------------------------ */

  /**
   * Nach einer Bewegung des Körpers von (x0, y0, a0) zur jetzigen Lage: jedes
   * Teilchen und jede Blase, die jetzt in einem seiner Rechtecke liegen, auf
   * ihrem Weg im Rahmen des Körpers zurück vor die Seite, durch die sie kamen.
   */
  pushOut(b: Body2D, x0: number, y0: number, a0: number): void {
    const g = this.w.grid;
    const P = this.w.particles;
    const B = this.w.bubbles;
    const box = this.box;
    b.worldBox(b.x, b.y, b.a, box);
    const m = 2 * g.dx;
    for (let p = 0; p < P.count; p += 1) {
      const px = P.x[p];
      const py = P.y[p];
      if (px < box[0] - m || px > box[2] + m || py < box[1] - m || py > box[3] + m) continue;
      if (this.moveOut(b, px, py, px, py, x0, y0, a0)) {
        P.x[p] = this.wp[0];
        P.y[p] = this.wp[1];
        this.stopInto(b, P.vx, P.vy, p);
      }
    }
    for (let k = 0; k < B.count; k += 1) {
      const px = B.x[k];
      const py = B.y[k];
      if (px < box[0] - m || px > box[2] + m || py < box[1] - m || py > box[3] + m) continue;
      if (this.moveOut(b, px, py, px, py, x0, y0, a0)) {
        B.x[k] = this.wp[0];
        B.y[k] = this.wp[1];
        B.site[k] = -1;
        this.stopInto(b, B.vx, B.vy, k);
      }
    }
  }

  /**
   * Für den Weg eines Teilchens (liquidMove.ts) von (x0, y0) nach (x, y) bei
   * stehenden Körpern: geriet es in ein Rechteck (oder quer durch eines), zurück
   * vor die Seite; out: Ort, Normale, Geschwindigkeit des Körpers dort.
   * Liefert 1, wenn es verschoben wurde, sonst 0.
   */
  hit(bodies: readonly Body2D[], x0: number, y0: number, x: number, y: number, out: Float64Array): number {
    const m = 2 * this.w.grid.dx;
    let moved = 0;
    let px = x;
    let py = y;
    for (let pass = 0; pass < 3; pass += 1) {
      let any = false;
      for (const b of bodies) {
        if (b.gone || b.nw === 0) continue;
        const box = this.boxOf(b);
        if (Math.max(px, x0) < box[0] - m || Math.min(px, x0) > box[2] + m || Math.max(py, y0) < box[1] - m || Math.min(py, y0) > box[3] + m) continue;
        if (!this.moveOut(b, px, py, x0, y0, b.x, b.y, b.a)) continue;
        px = this.wp[0];
        py = this.wp[1];
        out[0] = px;
        out[1] = py;
        out[2] = this.nx;
        out[3] = this.ny;
        out[4] = b.vx - b.w * (py - b.y);
        out[5] = b.vy + b.w * (px - b.x);
        moved = 1;
        any = true;
      }
      if (!any) break;
    }
    return moved;
  }

  /**
   * Liegt (x, y) jetzt in einem Rechteck des Körpers (mit dem Rand MARGIN) oder
   * kreuzt der Weg von dort, wo (ox, oy) unter der alten Lage (x0, y0, a0) im
   * Rahmen lag, eines? Dann an den Eintrittspunkt (knapp davor); war er schon
   * vorher drin, zur nächsten Seite. Ergebnis in this.wp (Welt), Normale in nx, ny.
   */
  private moveOut(b: Body2D, x: number, y: number, ox: number, oy: number, x0: number, y0: number, a0: number): boolean {
    const l1 = this.l1;
    const l0 = this.l0;
    Body2D.toLocal(b.x, b.y, b.a, x, y, l1);
    Body2D.toLocal(x0, y0, a0, ox, oy, l0);
    const m = MARGIN * this.w.grid.dx;
    let bestT = Infinity;
    let side = -1;
    let qx = l1[0];
    let qy = l1[1];
    for (let r = 0; r < b.nr; r += 1) {
      const rx0 = b.xs[r][0], ry0 = b.ys[r][0], rx1 = b.xs[r][b.ni[r]], ry1 = b.ys[r][b.nj[r]];
      const ex0 = rx0 - m, ey0 = ry0 - m, ex1 = rx1 + m, ey1 = ry1 + m;
      const inside1 = l1[0] > ex0 && l1[0] < ex1 && l1[1] > ey0 && l1[1] < ey1;
      if (clipSegment(l0[0], l0[1], l1[0], l1[1], ex0, ey0, ex1, ey1, this.seg) <= 0 && !inside1) continue;
      const inside0 = l0[0] > ex0 && l0[0] < ex1 && l0[1] > ey0 && l0[1] < ey1;
      if (!inside0) {
        /* Von aussen hinein (oder hindurch): der Eintrittspunkt. */
        const t = this.seg[0];
        if (t < bestT) {
          bestT = t;
          const hx = l0[0] + t * (l1[0] - l0[0]);
          const hy = l0[1] + t * (l1[1] - l0[1]);
          /* Welche Seite: die, auf deren Linie der Eintritt liegt (die nächste). */
          const s = nearestSide(Math.abs(hx - ex0), Math.abs(hx - ex1), Math.abs(hy - ey0), Math.abs(hy - ey1));
          side = s;
          qx = s === 0 ? ex0 : s === 1 ? ex1 : hx;
          qy = s === 2 ? ey0 : s === 3 ? ey1 : hy;
        }
      } else if (inside1 && bestT === Infinity) {
        /* Schon vorher drin: zur nächsten Seite. */
        const s = nearestSide(l1[0] - ex0, ex1 - l1[0], l1[1] - ey0, ey1 - l1[1]);
        side = s;
        qx = s === 0 ? ex0 : s === 1 ? ex1 : l1[0];
        qy = s === 2 ? ey0 : s === 3 ? ey1 : l1[1];
        bestT = 2;
      }
    }
    if (side < 0) return false;
    const g = this.w.grid;
    const tiny = 1e-4 * g.dx;
    const cs = Math.cos(b.a);
    const sn = Math.sin(b.a);
    const nlx = side === 0 ? -1 : side === 1 ? 1 : 0;
    const nly = side === 2 ? -1 : side === 3 ? 1 : 0;
    const lx = qx + nlx * tiny;
    const ly = qy + nly * tiny;
    this.wp[0] = Math.min(g.w - tiny, Math.max(tiny, b.x + cs * lx - sn * ly));
    this.wp[1] = Math.min(g.h - tiny, Math.max(tiny, b.y + sn * lx + cs * ly));
    this.nx = cs * nlx - sn * nly;
    this.ny = sn * nlx + cs * nly;
    return true;
  }

  /** Die Geschwindigkeit eines verschobenen Punkts: was relativ zum Körper in ihn hinein zeigt, fällt weg. */
  private stopInto(b: Body2D, vx: Float32Array, vy: Float32Array, k: number): void {
    const rx = this.wp[0] - b.x;
    const ry = this.wp[1] - b.y;
    const bvx = b.vx - b.w * ry;
    const bvy = b.vy + b.w * rx;
    const vn = (vx[k] - bvx) * this.nx + (vy[k] - bvy) * this.ny;
    if (vn < 0) { vx[k] -= vn * this.nx; vy[k] -= vn * this.ny; }
  }

  /* -- Gas, wenn Zellen fest oder frei werden ------------------------------------------------------- */

  /**
   * Eine Zelle, die eben fest wird: ihr Gas (Arten, Nebel, Enthalpie) zu den
   * Nachbarn über offene Flächen, die frei bleiben (nach deren Gasvolumen);
   * gibt es keine, zur nächsten freien Zelle über offene Flächen; zuletzt
   * (eingeschlossen) durch alles hindurch zur nächsten freien Fluidzelle.
   */
  private gasOut(c: number): void {
    const g = this.w.grid;
    const gas = this.w.gas;
    if (gas.massOf(c) <= 0 && g.Hg[c] === 0) return;
    const { nx, ny } = g;
    const i = c % nx;
    const j = (c - i) / nx;
    const free = (nb: number): boolean => (this.stamp[nb] === this.tag ? this.now[nb] === 0 : g.solid[nb] === 0) && !(g.solid[nb] !== 0 && g.owner[nb] === 0);
    let wsum = 0;
    let cnt = 0;
    for (let k = 0; k < 4; k += 1) {
      const nb = gas.across(c, i, j, k);
      if (nb < 0 || !free(nb)) continue;
      wsum += gas.vgas[nb] > 0 ? gas.vgas[nb] : g.vCell;
      cnt += 1;
    }
    if (cnt > 0) {
      let left = wsum;
      for (let k = 0; k < 4; k += 1) {
        const nb = gas.across(c, i, j, k);
        if (nb < 0 || !free(nb)) continue;
        const wgt = gas.vgas[nb] > 0 ? gas.vgas[nb] : g.vCell;
        cnt -= 1;
        gas.move(c, nb, cnt === 0 ? 1 : Math.min(1, wgt / left));
        left -= wgt;
      }
      return;
    }
    const seen = this.seen;
    const queue = this.queue;
    /* Über offene Flächen (auch durch Zellen, die gerade fest werden) zur nächsten freien Zelle. */
    let tag = ++this.seenTag;
    let head = 0;
    let tail = 0;
    queue[tail++] = c;
    seen[c] = tag;
    while (head < tail) {
      const q = queue[head++];
      if (q !== c && free(q)) { gas.move(c, q, 1); return; }
      const qi = q % nx;
      const qj = (q - qi) / nx;
      for (let k = 0; k < 4; k += 1) {
        const nb = gas.across(q, qi, qj, k);
        if (nb < 0 || seen[nb] === tag || (g.solid[nb] !== 0 && g.owner[nb] === 0)) continue;
        seen[nb] = tag;
        queue[tail++] = nb;
      }
    }
    /* Eingeschlossen: durch alles hindurch zur nächsten freien Fluidzelle. */
    tag = ++this.seenTag;
    head = 0;
    tail = 0;
    queue[tail++] = c;
    seen[c] = tag;
    while (head < tail) {
      const q = queue[head++];
      if (q !== c && free(q)) { gas.move(c, q, 1); return; }
      const qi = q % nx;
      const qj = (q - qi) / nx;
      for (let d = 0; d < 4; d += 1) {
        const ii = qi + (d === 0 ? -1 : d === 1 ? 1 : 0);
        const jj = qj + (d === 2 ? -1 : d === 3 ? 1 : 0);
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        const nb = ii + jj * nx;
        if (seen[nb] === tag) continue;
        seen[nb] = tag;
        queue[tail++] = nb;
      }
    }
  }

  /** Eine Zelle wird frei: ohne Gas daneben Flüssigkeit, sonst Gas — so viel, wie bei der Dichte der Gasnachbarn in ihren offenen Teil passt, von ihnen geholt (je höchstens ein Viertel). */
  private vacate(c: number): void {
    const g = this.w.grid;
    const gas = this.w.gas;
    const { nx } = g;
    const i = c % nx;
    const j = (c - i) / nx;
    let wsum = 0;
    let rho = 0;
    let T = 0;
    let liquidNear = false;
    for (let k = 0; k < 4; k += 1) {
      const nb = gas.across(c, i, j, k);
      if (nb < 0) continue;
      if (g.kind[nb] === LIQUID) liquidNear = true;
      if (g.kind[nb] !== GAS || gas.massOf(nb) <= 0) continue;
      const wgt = gas.vgas[nb] > 0 ? gas.vgas[nb] : g.vCell;
      wsum += wgt;
      rho += wgt * gas.rho[nb];
      T += wgt * g.T[nb];
    }
    if (wsum <= 0) {
      g.kind[c] = liquidNear ? LIQUID : GAS;
      gas.deriveCell(c);
      return;
    }
    g.kind[c] = GAS;
    g.T[c] = T / wsum;
    const want = (rho / wsum) * Math.max(1e-3, 1 - g.fs[c] - g.phi[c] - g.alpha[c]) * g.vCell;
    for (let k = 0; k < 4; k += 1) {
      const nb = gas.across(c, i, j, k);
      if (nb < 0 || g.kind[nb] !== GAS) continue;
      const mnb = gas.massOf(nb);
      if (mnb <= 0) continue;
      const wgt = (gas.vgas[nb] > 0 ? gas.vgas[nb] : g.vCell) / wsum;
      gas.move(nb, c, Math.min(0.25, (want * wgt) / mnb));
    }
    gas.deriveCell(c);
  }
}

/** Die Seite mit dem kleinsten Abstand (0 links, 1 rechts, 2 unten, 3 oben). */
function nearestSide(d0: number, d1: number, d2: number, d3: number): number {
  let s = 0;
  let d = d0;
  if (d1 < d) { s = 1; d = d1; }
  if (d2 < d) { s = 2; d = d2; }
  if (d3 < d) s = 3;
  return s;
}
