/**
 * PARTIKEL-LABOR — DAS NACHBARGITTER: gleichmässige Zellen der Grösse h, nur
 * um Nachbarn schnell zu finden. Jeder Teilschritt baut es neu mit einem
 * Zählsortieren (Präfixsummen) und legt die Liste der lebenden Partikeln
 * nach Zellen geordnet ab (`sorted`) — über sie laufen alle Schleifen.
 * Gesucht wird nur in den 3×3 Zellen um eine Partikel; die Nachbarlisten
 * (feste Plätze je Partikel, `solver.ts`) entstehen einmal je Teilschritt und
 * dienen allen Löser-Iterationen. Nach dem ersten Bau wird nichts mehr
 * angelegt.
 *
 * Eine Zelle (h = 2s) deckt genau 2 × 2 Plätze des Gitters der Kiste: das
 * Gitter beginnt 6 Plätze vor der Kiste. Zellen ohne Partikeln, die
 * Umgebungsluft sind (`cellAir`), zählen mit ihren freien Plätzen
 * (`siteFree`) wie ruhende Luft (`band.ts`).
 */

import type { Mem } from './mem';
import type { Store } from './store';

/** Höchstens so viele Nachbarn je Partikel (2D, h = 2s: im Gitter 8, gedrückt bis etwa 14). */
export const MAX_NBR = 32;
/** Das Gitter beginnt so viele Plätze vor der Kiste. */
export const MARGIN_SITES = 6;

export class Grid {
  readonly cell: number;
  readonly spacing: number;
  readonly nx: number;
  readonly ny: number;
  readonly x0: number;
  readonly y0: number;
  /** Erste Partikel jeder Zelle in `sorted` (Länge nx·ny + 1). */
  readonly cellStart: Int32Array;
  private readonly cursor: Int32Array;
  /** Zelle je Partikel (Index des Speichers). */
  readonly cellOf: Int32Array;
  /** Lebende Partikeln nach Zellen geordnet (in einer Zelle nach Index); gültig sind die ersten `n`. */
  readonly sorted: Int32Array;
  n = 0;
  /** Nur die beweglichen, in derselben Reihenfolge — über sie laufen die Kerne (gleich viel Arbeit je Stück); gültig die ersten `nMove`. */
  readonly moving: Int32Array;
  nMove = 0;
  /** Nachbarn je Partikel: `nbrCount[i]` Einträge ab `i·MAX_NBR` in `nbrList`, mit dem Gradienten des Kerns zu jedem (`pgx, pgy`, aus der Suche). */
  readonly nbrCount: Uint8Array;
  readonly nbrList: Int32Array;
  readonly pgx: Float32Array;
  readonly pgy: Float32Array;
  /** Der Kern W_ij zu jedem Nachbarn (für die XSPH-Glättung). */
  readonly pw: Float32Array;
  /** 1: die Zelle ist Umgebungsluft ohne Partikeln. */
  readonly cellAir: Uint8Array;
  /** Plätze des Gitters (2·nx × 2·ny): 1, wo Luft sein kann (in der Kiste oder hinter einer offenen Seite) und nichts Festes steht. */
  readonly siteFree: Uint8Array;
  readonly siteNx: number;
  readonly siteNy: number;
  /** Wie oft eine Liste voll war (Diagnose). */
  overflow = 0;

  /** Ein Gitter, das (x0, y0) bis (x0 + w, y0 + h) deckt; `spacing` ist die Weite der Plätze (die Zelle ist 2·spacing). */
  constructor(cap: number, x0: number, y0: number, w: number, h: number, spacing: number, mem: Mem) {
    this.spacing = spacing;
    this.cell = 2 * spacing;
    this.x0 = x0;
    this.y0 = y0;
    this.nx = Math.max(1, Math.ceil(w / this.cell));
    this.ny = Math.max(1, Math.ceil(h / this.cell));
    const cells = this.nx * this.ny;
    this.cellStart = mem.i32('cellStart', cells + 1);
    this.cursor = new Int32Array(cells);
    this.cellOf = mem.i32('cellOf', cap);
    this.sorted = mem.i32('sorted', cap);
    this.moving = mem.i32('moving', cap);
    this.nbrCount = mem.u8('nbrCount', cap);
    this.nbrList = mem.i32('nbrList', cap * MAX_NBR);
    this.pgx = mem.f32('pgx', cap * MAX_NBR);
    this.pgy = mem.f32('pgy', cap * MAX_NBR);
    this.pw = mem.f32('pw', cap * MAX_NBR);
    this.cellAir = mem.u8('cellAir', cells);
    this.siteNx = 2 * this.nx;
    this.siteNy = 2 * this.ny;
    this.siteFree = mem.u8('siteFree', this.siteNx * this.siteNy);
  }

  /** Die Zelle eines Punktes (am Rand festgehalten — wer hinausfliegt, landet in der Randzelle). */
  cellIndex(x: number, y: number): number {
    let cx = Math.floor((x - this.x0) / this.cell);
    let cy = Math.floor((y - this.y0) / this.cell);
    if (cx < 0) cx = 0; else if (cx >= this.nx) cx = this.nx - 1;
    if (cy < 0) cy = 0; else if (cy >= this.ny) cy = this.ny - 1;
    return cy * this.nx + cx;
  }

  /** Der Platz (a, b) des Gitters, auf dem der Platz (i, j) der Kiste liegt — als ein Index (−1: ausserhalb). */
  siteOf(i: number, j: number): number {
    const a = i + MARGIN_SITES;
    const b = j + MARGIN_SITES;
    if (a < 0 || b < 0 || a >= this.siteNx || b >= this.siteNy) return -1;
    return b * this.siteNx + a;
  }

  /** Die Zelle, in der ein Platz des Gitters liegt. */
  cellOfSite(site: number): number {
    const a = site % this.siteNx;
    const b = (site - a) / this.siteNx;
    return (b >> 1) * this.nx + (a >> 1);
  }

  /** Neu einordnen (nach den vorhergesagten Orten `px, py` oder den Orten `x, y`). */
  build(st: Store, predicted: boolean): void {
    const xs = predicted ? st.px : st.x;
    const ys = predicted ? st.py : st.y;
    const top = st.highWater;
    for (let i = 0; i < top; i += 1) if (st.alive[i] === 1) this.cellOf[i] = this.cellIndex(xs[i], ys[i]);
    this.sort(st);
  }

  /** Neu einordnen mit den Zellen, die die Kerne schon ausgerechnet haben (`cellOf`, beim Vorhersagen). */
  sort(st: Store): void {
    const cells = this.nx * this.ny;
    const start = this.cellStart;
    start.fill(0);
    const top = st.highWater;
    for (let i = 0; i < top; i += 1) {
      if (st.alive[i] === 0) continue;
      start[this.cellOf[i] + 1] += 1;
    }
    for (let c = 0; c < cells; c += 1) start[c + 1] += start[c];
    const cur = this.cursor;
    for (let c = 0; c < cells; c += 1) cur[c] = start[c];
    const sorted = this.sorted;
    for (let i = 0; i < top; i += 1) {
      if (st.alive[i] === 0) continue;
      sorted[cur[this.cellOf[i]]++] = i;
    }
    this.n = start[cells];
    let m = 0;
    const fixed = st.fixed;
    const moving = this.moving;
    for (let k = 0; k < this.n; k += 1) {
      const i = sorted[k];
      if (fixed[i] === 0) moving[m++] = i;
    }
    this.nMove = m;
  }
}
