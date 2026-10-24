/**
 * LABOR 2D (v2) — DIE PRÜFUNG VOR DEM FÜLLEN (aus engine.ts): eine Flüssigkeit
 * ohne freie Oberfläche hätte kein Druckgesetz (M1) — ein solcher Handgriff
 * wird abgelehnt.
 */

import type { Engine } from './engine';
import type { Op } from './scene';
import { inside } from './shapes';
import { LIQUID } from './units';

/** Prüfen, ob nach dem Füllen jede zusammenhängende Flüssigkeit an Gas oder eine offene Seite grenzt. */
export function surfaceAfterFill(e: Engine, op: Extract<Op, { op: 'fill' }>): boolean {
  const g = e.grid;
  const { nx, ny } = g;
  const liquid = new Uint8Array(g.n);
  /* Grob: eine Zelle ist nach dem Füllen flüssig, wenn ihre Mitte in der Fläche liegt oder sie jetzt flüssig ist. */
  for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) {
    const c = i + j * nx;
    if (g.solid[c] !== 0) continue;
    if (g.kind[c] === LIQUID || inside(op.region, (i + 0.5) * g.dx, (j + 0.5) * g.dx)) liquid[c] = 1;
  }
  const seen = new Uint8Array(g.n);
  const stack: number[] = [];
  for (let s = 0; s < g.n; s += 1) {
    if (liquid[s] === 0 || seen[s] !== 0) continue;
    let free = false;
    stack.push(s);
    seen[s] = 1;
    while (stack.length > 0) {
      const c = stack.pop() as number;
      const i = c % nx;
      const j = (c - i) / nx;
      /* Über Flächen, die kein Körper ganz bedeckt (eine dünne Wand trennt). */
      const gas = e.gas;
      const nbs = [gas.across(c, i, j, 0), gas.across(c, i, j, 1), gas.across(c, i, j, 2), gas.across(c, i, j, 3)];
      if ((i === 0 && g.openL) || (i === nx - 1 && g.openR) || (j === 0 && g.openB) || (j === ny - 1 && g.openT)) free = true;
      for (const nb of nbs) {
        if (nb < 0 || g.solid[nb] !== 0) continue;
        if (liquid[nb] === 0) { free = true; continue; }
        if (seen[nb] === 0) { seen[nb] = 1; stack.push(nb); }
      }
    }
    if (!free) return false;
  }
  return true;
}
