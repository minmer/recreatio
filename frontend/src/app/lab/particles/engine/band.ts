/**
 * PARTIKEL-LABOR — LUFT NUR, WO SIE ZÄHLT (ARCHITECTURE.md §6.5, nach Müller
 * et al. 2005): Luftpartikeln gibt es in einem Saum um alles, was nicht
 * ruhende Umgebungsluft ist — Flüssigkeiten, Dampf, warme oder bewegte Luft,
 * Gemaltes, Aparatura. Der Rest der Kiste ist Umgebungsluft ohne Partikeln:
 * ihre freien Plätze zählen im Löser wie ruhende Luft (`solver.ts`), sie hat
 * die Temperatur, den Druck und die Zusammensetzung der Umgebung.
 *
 * Der Saum wandert mit: jede Zelle im Abstand `RADIUS` (Zellen) einer
 * „aktiven“ Partikel gehört dazu; wird eine Zelle Saum, bekommt sie Luft auf
 * ihre freien Plätze, ist sie `HOLD` Durchgänge lang fern von allem, geht ihre
 * Luft in die Umgebung zurück. Masse und Enthalpie, die so hin und her gehen,
 * bucht die Engine (`airIn`, `airOut`).
 */

import type { Grid } from './grid';

/** Abstand des Saums von einer aktiven Partikel (Zellen der Grösse h = 2s). */
export const RADIUS = 3;
/** So viele Durchgänge (Teilschritte) bleibt eine verlassene Zelle Saum, bevor ihre Luft zurückgeht. */
export const HOLD = 48;

export interface BandHost {
  readonly grid: Grid;
  /** Gehört die Partikel zu dem, was den Saum aufspannt? */
  isActive(i: number): boolean;
  /** Ist die Partikel ruhende Luft des Saums (die zurück in die Umgebung darf)? */
  isPlainAir(i: number): boolean;
  /** Luft der Umgebung auf einen Platz des Gitters setzen (−1: kein Platz frei). */
  spawnAir(site: number): number;
  /** Eine Luftpartikel in die Umgebung zurückgeben. */
  returnAir(i: number): void;
  /** Ist der Platz frei (keine Partikel näher als 0,6 s)? */
  siteVacant(site: number): boolean;
}

export class Band {
  private readonly act: Uint8Array;
  private readonly wide: Uint8Array;
  private readonly hold: Uint8Array;
  private readonly cells: number;

  constructor(cells: number) {
    this.cells = cells;
    this.act = new Uint8Array(cells);
    this.wide = new Uint8Array(cells);
    this.hold = new Uint8Array(cells);
  }

  /** Alles Umgebungsluft (eine neue Szene). */
  reset(grid: Grid): void {
    grid.cellAir.fill(1);
    this.hold.fill(0);
  }

  /** Ohne Saum: die Kiste voll Luftpartikeln; Umgebung ohne Partikeln ist nur der Raum hinter offenen Seiten (`room`: 1 je Zelle). */
  none(grid: Grid, room: Uint8Array): void {
    grid.cellAir.set(room);
  }

  /** Den Saum neu ziehen (nach dem Einordnen der Partikeln, mit ihren jetzigen Orten). */
  update(host: BandHost): void {
    const g = host.grid;
    const { nx, ny, cellOf, sorted, cellAir } = g;
    const act = this.act;
    act.fill(0);
    /* Verirrte ruhende Luft in Zellen der Umgebung geht zurück; aktive Partikeln markieren ihre Zelle. */
    for (let k = 0; k < g.n; k += 1) {
      const i = sorted[k];
      const c = cellOf[i];
      if (host.isActive(i)) act[c] = 1;
      else if (cellAir[c] === 1 && host.isPlainAir(i)) host.returnAir(i);
    }
    this.dilate(nx, ny);
    const wide = this.wide;
    for (let c = 0; c < this.cells; c += 1) {
      if (wide[c] === 1) {
        this.hold[c] = HOLD;
        if (cellAir[c] === 1) { cellAir[c] = 0; this.fill(host, c); }
      } else if (cellAir[c] === 0) {
        if (this.hold[c] > 0) this.hold[c] -= 1;
        if (this.hold[c] === 0) { this.drain(host, c); cellAir[c] = 1; }
      }
    }
  }

  /** `act` um RADIUS Zellen geweitet (erst waagrecht, dann senkrecht) nach `wide`. */
  private dilate(nx: number, ny: number): void {
    const act = this.act;
    const wide = this.wide;
    for (let cy = 0; cy < ny; cy += 1) {
      const row = cy * nx;
      for (let cx = 0; cx < nx; cx += 1) {
        let v = 0;
        const a = Math.max(0, cx - RADIUS);
        const b = Math.min(nx - 1, cx + RADIUS);
        for (let q = a; q <= b && v === 0; q += 1) v = act[row + q];
        wide[row + cx] = v;
      }
    }
    act.set(wide);
    for (let cx = 0; cx < nx; cx += 1) {
      for (let cy = 0; cy < ny; cy += 1) {
        let v = 0;
        const a = Math.max(0, cy - RADIUS);
        const b = Math.min(ny - 1, cy + RADIUS);
        for (let q = a; q <= b && v === 0; q += 1) v = act[q * nx + cx];
        wide[cy * nx + cx] = v;
      }
    }
  }

  /** Eine Zelle wird Saum: Luft auf ihre freien Plätze. */
  private fill(host: BandHost, c: number): void {
    const g = host.grid;
    const cx = c % g.nx;
    const cy = (c - cx) / g.nx;
    for (let b = 2 * cy; b < 2 * cy + 2; b += 1) {
      for (let a = 2 * cx; a < 2 * cx + 2; a += 1) {
        const site = b * g.siteNx + a;
        if (g.siteFree[site] === 1 && host.siteVacant(site)) host.spawnAir(site);
      }
    }
  }

  /** Eine Zelle wird Umgebung: ihre ruhende Luft geht zurück. */
  private drain(host: BandHost, c: number): void {
    const g = host.grid;
    const end = g.cellStart[c + 1];
    for (let k = g.cellStart[c]; k < end; k += 1) {
      const i = g.sorted[k];
      if (host.isPlainAir(i)) host.returnAir(i);
    }
  }
}
