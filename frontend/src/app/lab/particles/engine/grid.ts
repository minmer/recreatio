/**
 * PARTIKEL-LABOR — DAS NACHBARGITTER: gleichmässige Zellen der Grösse h, nur
 * um Nachbarn schnell zu finden. Jeder Teilschritt baut es neu mit einem
 * Zählsortieren (Präfixsummen) und legt die Liste der lebenden Partikeln
 * nach Zellen geordnet ab (`sorted`) — über sie laufen alle Schleifen.
 * Gesucht wird nur in den 3×3 Zellen um eine Partikel; die Nachbarlisten
 * (feste Plätze je Partikel) entstehen einmal je Teilschritt und dienen allen
 * Löser-Iterationen. Nach dem ersten Bau wird nichts mehr angelegt.
 */

import type { Store } from './store';

/** Höchstens so viele Nachbarn je Partikel (2D, h = 2s: üblich 12–20). */
export const MAX_NBR = 48;

export class Grid {
  readonly cell: number;
  readonly nx: number;
  readonly ny: number;
  readonly x0: number;
  readonly y0: number;
  /** Erste Partikel jeder Zelle in `sorted` (Länge nx·ny + 1). */
  readonly cellStart: Int32Array;
  private readonly cursor: Int32Array;
  /** Zelle je Partikel (Index des Speichers). */
  readonly cellOf: Int32Array;
  /** Lebende Partikeln nach Zellen geordnet; gültig sind die ersten `n`. */
  readonly sorted: Int32Array;
  /** Der Platz jeder Partikel in `sorted` (Reihenfolge von unten nach oben, Zeile für Zeile). */
  readonly rank: Int32Array;
  n = 0;
  /** Nachbarn je Partikel: `nbrCount[i]` Einträge ab `i·MAX_NBR` in `nbrList`. */
  readonly nbrCount: Uint8Array;
  readonly nbrList: Int32Array;
  /** Wie oft eine Liste voll war (Diagnose). */
  overflow = 0;

  constructor(cap: number, x0: number, y0: number, w: number, h: number, cell: number) {
    this.cell = cell;
    this.x0 = x0;
    this.y0 = y0;
    this.nx = Math.max(1, Math.ceil(w / cell));
    this.ny = Math.max(1, Math.ceil(h / cell));
    const cells = this.nx * this.ny;
    this.cellStart = new Int32Array(cells + 1);
    this.cursor = new Int32Array(cells);
    this.cellOf = new Int32Array(cap);
    this.sorted = new Int32Array(cap);
    this.rank = new Int32Array(cap);
    this.nbrCount = new Uint8Array(cap);
    this.nbrList = new Int32Array(cap * MAX_NBR);
  }

  /** Die Zelle eines Punktes (am Rand festgehalten — wer hinausfliegt, landet in der Randzelle). */
  cellIndex(x: number, y: number): number {
    let cx = Math.floor((x - this.x0) / this.cell);
    let cy = Math.floor((y - this.y0) / this.cell);
    if (cx < 0) cx = 0; else if (cx >= this.nx) cx = this.nx - 1;
    if (cy < 0) cy = 0; else if (cy >= this.ny) cy = this.ny - 1;
    return cy * this.nx + cx;
  }

  /** Neu einordnen (nach den vorhergesagten Orten `px, py` oder den Orten `x, y`). */
  build(st: Store, predicted: boolean): void {
    const xs = predicted ? st.px : st.x;
    const ys = predicted ? st.py : st.y;
    const cells = this.nx * this.ny;
    const start = this.cellStart;
    start.fill(0);
    const top = st.highWater;
    for (let i = 0; i < top; i += 1) {
      if (st.alive[i] === 0) continue;
      const c = this.cellIndex(xs[i], ys[i]);
      this.cellOf[i] = c;
      start[c + 1] += 1;
    }
    for (let c = 0; c < cells; c += 1) start[c + 1] += start[c];
    const cur = this.cursor;
    for (let c = 0; c < cells; c += 1) cur[c] = start[c];
    const sorted = this.sorted;
    for (let i = 0; i < top; i += 1) {
      if (st.alive[i] === 0) continue;
      sorted[cur[this.cellOf[i]]++] = i;
    }
    /* In jeder Zelle von unten nach oben (Einfügen — wenige je Zelle): so läuft `sorted` Zeile für Zeile aufwärts. */
    for (let c = 0; c < cells; c += 1) {
      const a = start[c];
      const b = start[c + 1];
      for (let k = a + 1; k < b; k += 1) {
        const i = sorted[k];
        const y = ys[i];
        let m = k - 1;
        while (m >= a && ys[sorted[m]] > y) { sorted[m + 1] = sorted[m]; m -= 1; }
        sorted[m + 1] = i;
      }
    }
    this.n = start[cells];
    for (let k = 0; k < this.n; k += 1) this.rank[sorted[k]] = k;
  }

  /** Die Nachbarlisten aller lebenden Partikeln im Radius `radius` (nach `build`, dieselben Orte). */
  neighbours(st: Store, radius: number, predicted: boolean): void {
    const xs = predicted ? st.px : st.x;
    const ys = predicted ? st.py : st.y;
    const r2 = radius * radius;
    const { nx, ny, cellStart, sorted, nbrList, nbrCount } = this;
    this.overflow = 0;
    for (let s = 0; s < this.n; s += 1) {
      const i = sorted[s];
      const xi = xs[i];
      const yi = ys[i];
      const c = this.cellOf[i];
      const cx = c % nx;
      const cy = (c - cx) / nx;
      const base = i * MAX_NBR;
      let count = 0;
      const ya = cy > 0 ? cy - 1 : 0;
      const yb = cy < ny - 1 ? cy + 1 : ny - 1;
      const xa = cx > 0 ? cx - 1 : 0;
      const xb = cx < nx - 1 ? cx + 1 : nx - 1;
      for (let gy = ya; gy <= yb; gy += 1) {
        for (let gx = xa; gx <= xb; gx += 1) {
          const g = gy * nx + gx;
          const end = cellStart[g + 1];
          for (let k = cellStart[g]; k < end; k += 1) {
            const j = sorted[k];
            if (j === i) continue;
            const dx = xi - xs[j];
            const dy = yi - ys[j];
            if (dx * dx + dy * dy >= r2) continue;
            if (count < MAX_NBR) nbrList[base + count++] = j;
            else this.overflow += 1;
          }
        }
      }
      nbrCount[i] = count;
      st.nbr[i] = count;
    }
  }
}
