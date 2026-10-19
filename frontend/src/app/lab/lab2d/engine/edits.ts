/**
 * LABOR 2D (v2) — DIE HANDGRIFFE: was eine Szene oder ein Werkzeug in die Welt
 * malt. Eine Zlewka ist eine Form aus Glaszellen, eine Heizplatte eine Form
 * aus Stahlzellen mit Rolle 1 — keine Sonderfälle in der Engine.
 *
 * Was ein Handgriff an Masse und Energie hinzufügt oder wegnimmt, wird als
 * „Eingriff“ gebucht (budget.edits): die Bilanzen schliessen auch über
 * Werkzeuge hinweg.
 */

import type { Bubbles } from './bubbles';
import type { Gas } from './gas';
import type { Grid } from './grid';
import type { Heat } from './heat';
import type { Liquid } from './liquid';
import { hL, rhoL, solidIndex, SOLIDS } from './materials';
import type { Particles } from './particles';
import type { Op } from './scene';
import { bounds, inside, type Region } from './shapes';
import { GAS_SPECIES, H2O, N2, O2, SOLID, SPECIES_SLOTS, T0 } from './units';

/** Was ein Handgriff bucht: Wasser- und Gasmasse und Energie, die von aussen kamen (negativ: weggenommen). */
export interface EditLedger {
  water: number;
  air: number;
  energy: number;
}

export interface World {
  readonly grid: Grid;
  readonly particles: Particles;
  readonly bubbles: Bubbles;
  readonly gas: Gas;
  readonly heat: Heat;
  readonly liquid: Liquid;
  /** Umgebungsluft als Massenanteile (mit Feuchte) und ihre Temperatur. */
  readonly ambientY: Float64Array;
  readonly ambientT: number;
  readonly ledger: EditLedger;
  /** Nach einer Änderung der Feststoffe: feste Daten, Gebiete, Kavitäten neu. */
  solidsChanged(): void;
}

/** Zellen, deren Mitte in der Fläche liegt (Rückgabe über den Rückruf). */
function eachCell(g: Grid, region: Region, fn: (c: number, i: number, j: number) => void): void {
  const [x0, y0, x1, y1] = bounds(region);
  const i0 = Math.max(0, Math.floor(x0 / g.dx));
  const i1 = Math.min(g.nx - 1, Math.ceil(x1 / g.dx));
  const j0 = Math.max(0, Math.floor(y0 / g.dx));
  const j1 = Math.min(g.ny - 1, Math.ceil(y1 / g.dx));
  for (let j = j0; j <= j1; j += 1) for (let i = i0; i <= i1; i += 1) {
    if (inside(region, (i + 0.5) * g.dx, (j + 0.5) * g.dx)) fn(i + j * g.nx, i, j);
  }
}

/** Gas einer Zelle entfernen (gebucht). */
function dropGas(w: World, c: number): void {
  const g = w.grid;
  const n = g.n;
  w.ledger.water -= g.mg[H2O * n + c] + g.mfog[c];
  w.ledger.air -= g.mg[N2 * n + c] + g.mg[O2 * n + c];
  w.ledger.energy -= g.Hg[c];
  for (let k = 0; k < SPECIES_SLOTS; k += 1) g.mg[k * n + c] = 0;
  g.mfog[c] = 0;
  g.Hg[c] = 0;
}

/** Eine Zelle mit Gas der Zusammensetzung Y bei T füllen (gebucht; vorher vorhandenes Gas wird ersetzt). */
function putGas(w: World, c: number, T: number, Y: Float64Array): void {
  const g = w.grid;
  const n = g.n;
  dropGas(w, c);
  w.gas.fillCell(c, T, Y, Math.max(1e-3, 1 - g.phi[c] - g.alpha[c]));
  w.ledger.water += g.mg[H2O * n + c];
  w.ledger.air += g.mg[N2 * n + c] + g.mg[O2 * n + c];
  w.ledger.energy += g.Hg[c];
}

/** Teilchen und Blasen in einer Fläche entfernen (gebucht). */
function removeLiquid(w: World, region: Region): void {
  const P = w.particles;
  for (let p = 0; p < P.count; p += 1) {
    if (!inside(region, P.x[p], P.y[p])) continue;
    w.ledger.water -= P.mass[p];
    w.ledger.energy -= P.mass[p] * P.h[p];
    w.liquid.removeParticle(p);
    p -= 1;
  }
  const B = w.bubbles;
  for (let b = 0; b < B.count; b += 1) {
    if (!inside(region, B.x[b], B.y[b])) continue;
    w.ledger.water -= B.m[b * SPECIES_SLOTS + H2O];
    w.ledger.air -= B.m[b * SPECIES_SLOTS + N2] + B.m[b * SPECIES_SLOTS + O2];
    w.ledger.energy -= B.H[b];
    B.remove(b);
    b -= 1;
  }
  w.liquid.weightsDirty = true;
}

/** Zellen fest machen (Werkstoff s, Temperatur T); was darin war, wird entfernt (gebucht). */
function makeSolid(w: World, cells: readonly number[], s: number, T: number, heaterGroup: number): void {
  const g = w.grid;
  const mat = SOLIDS[s];
  for (const c of cells) {
    if (g.solid[c] !== 0) {
      w.ledger.energy -= g.Es[c];
      w.ledger.water -= g.film[c];
    } else {
      dropGas(w, c);
    }
    g.solid[c] = s + 1;
    g.role[c] = heaterGroup >= 0 ? 1 : 0;
    g.heater[c] = heaterGroup;
    g.film[c] = 0;
    g.T[c] = T;
    g.Es[c] = mat.rho * mat.cp * g.vCell * (T - T0);
    g.kind[c] = SOLID;
    w.ledger.energy += g.Es[c];
  }
  /* Teilchen in neuen Feststoffzellen: entfernen. */
  const P = w.particles;
  for (let p = 0; p < P.count; p += 1) {
    const c = g.cellAt(P.x[p], P.y[p]);
    if (c < 0 || g.solid[c] === 0) continue;
    w.ledger.water -= P.mass[p];
    w.ledger.energy -= P.mass[p] * P.h[p];
    w.liquid.removeParticle(p);
    p -= 1;
  }
  w.solidsChanged();
}

/** Feste Zellen wieder zu Gas machen (gefüllt mit Umgebungsluft). */
function clearSolid(w: World, cells: readonly number[]): void {
  const g = w.grid;
  let any = false;
  for (const c of cells) {
    if (g.solid[c] === 0) continue;
    any = true;
    w.ledger.energy -= g.Es[c];
    w.ledger.water -= g.film[c];
    g.solid[c] = 0;
    g.role[c] = 0;
    g.heater[c] = -1;
    g.Es[c] = 0;
    g.film[c] = 0;
    g.kind[c] = 0;
  }
  if (!any) return;
  w.solidsChanged();
  for (const c of cells) if (g.solid[c] === 0 && w.gas.massOf(c) <= 0) putGas(w, c, w.ambientT, w.ambientY);
}

const cellRect = (g: Grid, x0: number, y0: number, x1: number, y1: number): number[] => {
  const out: number[] = [];
  const i0 = Math.max(0, Math.round(x0 / g.dx));
  const i1 = Math.min(g.nx, Math.max(i0 + 1, Math.round(x1 / g.dx)));
  const j0 = Math.max(0, Math.round(y0 / g.dx));
  const j1 = Math.min(g.ny, Math.max(j0 + 1, Math.round(y1 / g.dx)));
  for (let j = j0; j < j1; j += 1) for (let i = i0; i < i1; i += 1) out.push(i + j * g.nx);
  return out;
};

/** Einen Handgriff ausführen. Liefert eine Warnung (oder null). */
export function applyOp(w: World, op: Op): string | null {
  const g = w.grid;
  switch (op.op) {
    case 'fill': {
      if (op.phase === 'gas') {
        removeLiquid(w, op.region);
        const Y = new Float64Array(SPECIES_SLOTS);
        let sum = 0;
        for (const [k, v] of Object.entries(op.composition)) {
          const idx = k === 'N2' ? N2 : k === 'O2' ? O2 : k === 'H2O' ? H2O : -1;
          if (idx >= 0) { Y[idx] = v; sum += v; }
        }
        if (sum <= 0) Y.set(w.ambientY.subarray(0, SPECIES_SLOTS));
        else for (let k = 0; k < GAS_SPECIES; k += 1) Y[k] /= sum;
        eachCell(g, op.region, (c) => { if (g.solid[c] === 0) putGas(w, c, op.T, Y); });
        return null;
      }
      /* Flüssigkeit: vorhandene Teilchen und Blasen in der Fläche ersetzen, dann 2 × 2 Teilchen je Zelle. */
      removeLiquid(w, op.region);
      const water = op.composition.H2O ?? 0;
      if (water <= 0) return 'fill: only water is a liquid in M1';
      const rho = rhoL(op.T);
      const m = (rho * g.vCell) / 4;
      const h = hL(op.T);
      const P = w.particles;
      let full = false;
      eachCellBox(g, op.region, (i, j) => {
        const c = i + j * g.nx;
        if (g.solid[c] !== 0) return;
        let placed = 0;
        for (let b = 0; b < 2; b += 1) for (let a = 0; a < 2; a += 1) {
          const x = (i + 0.25 + 0.5 * a) * g.dx;
          const y = (j + 0.25 + 0.5 * b) * g.dx;
          if (!inside(op.region, x, y)) continue;
          if (P.add(x, y, m, h, 0) < 0) { full = true; continue; }
          placed += 1;
          w.ledger.water += m;
          w.ledger.energy += m * h;
        }
        /* Ganz gefüllte Zellen: ihre Luft weicht (gebucht). */
        if (placed === 4) dropGas(w, c);
      });
      w.liquid.weightsDirty = true;
      return full ? 'fill: particle capacity reached' : null;
    }
    case 'erase': {
      removeLiquid(w, op.region);
      const cells: number[] = [];
      eachCell(g, op.region, (c) => cells.push(c));
      clearSolid(w, cells);
      return null;
    }
    case 'solid': {
      const s = solidIndex(op.material);
      if (s < 0) return `solid: unknown material ${op.material}`;
      const cells: number[] = [];
      eachCell(g, op.region, (c) => cells.push(c));
      /* Eine Strecke dünner als eine Zelle: wenigstens die Zellen auf ihr. */
      if (cells.length === 0 && 'line' in op.region) {
        const [ax, ay, bx, by] = op.region.line;
        const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / (0.5 * g.dx)) + 1;
        for (let k = 0; k <= steps; k += 1) {
          const c = g.cellAt(ax + ((bx - ax) * k) / steps, ay + ((by - ay) * k) / steps);
          if (c >= 0 && !cells.includes(c)) cells.push(c);
        }
      }
      makeSolid(w, cells, s, op.T, -1);
      return null;
    }
    case 'beaker': {
      const s = solidIndex(op.material);
      if (s < 0) return `beaker: unknown material ${op.material}`;
      const wall = Math.max(g.dx, op.wall);
      const x0 = op.x - op.w / 2;
      const x1 = op.x + op.w / 2;
      const y0 = op.y;
      const y1 = op.y + op.h;
      const cells = [
        ...cellRect(g, x0, y0, x0 + wall, y1),
        ...cellRect(g, x1 - wall, y0, x1, y1),
        ...cellRect(g, x0, y0, x1, y0 + wall),
        ...(op.lid ? cellRect(g, x0, y1 - wall, x1, y1) : [])
      ];
      makeSolid(w, [...new Set(cells)], s, op.T, -1);
      return null;
    }
    case 'hotplate': {
      const s = solidIndex(op.material);
      if (s < 0) return `hotplate: unknown material ${op.material}`;
      const group = w.heat.heaters.length;
      w.heat.heaters.push({ group, mode: op.mode, power: op.power, target: op.target, on: op.on, P: 0, Tmean: op.T, integral: 0, cells: 0 });
      makeSolid(w, cellRect(g, op.x - op.w / 2, op.y, op.x + op.w / 2, op.y + op.h), s, op.T, group);
      return null;
    }
  }
}

/** Alle Zellen im umschliessenden Rechteck einer Fläche (für Teilchen, deren Plätze einzeln geprüft werden). */
function eachCellBox(g: Grid, region: Region, fn: (i: number, j: number) => void): void {
  const [x0, y0, x1, y1] = bounds(region);
  const i0 = Math.max(0, Math.floor(x0 / g.dx));
  const i1 = Math.min(g.nx - 1, Math.floor(x1 / g.dx));
  const j0 = Math.max(0, Math.floor(y0 / g.dx));
  const j1 = Math.min(g.ny - 1, Math.floor(y1 / g.dx));
  for (let j = j0; j <= j1; j += 1) for (let i = i0; i <= i1; i += 1) fn(i, j);
}
