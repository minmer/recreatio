/**
 * LABOR 2D (v2) — DER INSPEKTOR: was an einem Punkt zu sehen ist (Zelle,
 * nächstes Teilchen, nächste Blase), aus dem Zustand der Engine gelesen.
 * Mit Salz (M2b) dazu Massenanteil, Molalität, Siede- und Gefrierpunkt der
 * Lösung in der Zelle und die Kruste eines Feststoffs.
 */

import type { Engine, ProbeInfo } from './engine';
import { pSat, tSat } from './if97';
import { LIQUIDS, MOLAR, rhoLiq, SOLIDS } from './materials';
import { boilingPoint, freezingPoint, M_S, rhoSol } from './solution';
import { GAS_SPECIES, H2O, LIQUID, SOLID } from './units';

/** Je Zelle aus den Teilchen, deren Wärmegewicht in sie fällt: Masse je Flüssigkeit, gelöstes Salz und das Wasser dazu. */
function gatherCell(e: Engine, c: number): { m: Float64Array; all: number; salt: number; water: number } {
  const { particles: P, liquid: L, grid: g } = e;
  const m = new Float64Array(LIQUIDS.length);
  let all = 0;
  let salt = 0;
  let water = 0;
  for (let p = 0; p < P.count; p += 1) {
    for (let k = 0; k < 9; k += 1) {
      const w = L.wt[9 * p + k];
      if (w === 0) continue;
      const i = L.bi[p] + (k % 3);
      const j = L.bj[p] + ((k / 3) | 0);
      if (i < 0 || j < 0 || i >= g.nx || j >= g.ny || i + j * g.nx !== c) continue;
      m[P.mat[p]] += w * P.mass[p];
      all += w * P.mass[p];
      const s = P.smass[2 * p];
      if (s > 0) { salt += w * s; water += w * (P.mass[p] - s); }
      else if (P.mat[p] === 0) water += w * P.mass[p];
    }
  }
  return { m, all, salt, water };
}

/** Die Flüssigkeiten einer Zelle mit ihrem Massenanteil. */
export function liquidsAt(e: Engine, c: number): { id: string; share: number }[] {
  const { m, all } = gatherCell(e, c);
  if (all <= 0) return [];
  const out: { id: string; share: number }[] = [];
  for (let l = 0; l < LIQUIDS.length; l += 1) if (m[l] > 0) out.push({ id: LIQUIDS[l].id, share: m[l] / all });
  return out;
}

export function probe(e: Engine, x: number, y: number): ProbeInfo | null {
  const g = e.grid;
  const c = g.cellAt(x, y);
  if (c < 0) return null;
  const n = g.n;
  const kind = g.kind[c] === SOLID ? 'solid' : g.kind[c] === LIQUID ? 'liquid' : 'gas';
  const p = e.pressureAt(c);
  let mol = 0;
  const xs = [0, 0, 0];
  for (let k = 0; k < GAS_SPECIES; k += 1) { xs[k] = g.mg[k * n + c] / MOLAR[k]; mol += xs[k]; }
  for (let k = 0; k < GAS_SPECIES; k += 1) xs[k] = mol > 0 ? xs[k] / mol : 0;
  const T = kind === 'liquid' && g.Cl[c] > 0 ? g.Tl[c] : g.T[c];
  const pv = kind === 'gas' ? xs[H2O] * p : 0;
  const i = Math.floor(x / g.dx);
  const j = Math.floor(y / g.dx);
  const u = kind === 'liquid' ? 0.5 * (g.ul[i + j * (g.nx + 1)] + g.ul[i + 1 + j * (g.nx + 1)]) : 0.5 * (g.ug[i + j * (g.nx + 1)] + g.ug[i + 1 + j * (g.nx + 1)]);
  const v = kind === 'liquid' ? 0.5 * (g.vl[i + j * g.nx] + g.vl[i + (j + 1) * g.nx]) : 0.5 * (g.vg[i + j * g.nx] + g.vg[i + (j + 1) * g.nx]);
  const P = e.particles;
  let best = -1;
  let bd = (1.5 * g.dx) ** 2;
  for (let q = 0; q < P.count; q += 1) {
    const d = (P.x[q] - x) ** 2 + (P.y[q] - y) ** 2;
    if (d < bd) { bd = d; best = q; }
  }
  /* Die nächste Blase im Umkreis von drei Zellen (oder ihrem Radius): Blasen sind klein und bewegen sich — ein Tipp daneben trifft sie trotzdem. */
  const B = e.bubbles;
  let bb = -1;
  let bbd = Infinity;
  for (let b = 0; b < B.count; b += 1) {
    const d = Math.hypot(B.x[b] - x, B.y[b] - y);
    if (d <= Math.max(B.r[b], 3 * g.dx) && d < bbd) { bb = b; bbd = d; }
  }
  const cell = gatherCell(e, c);
  const liquids: { id: string; share: number }[] = [];
  if (cell.all > 0) for (let l = 0; l < LIQUIDS.length; l += 1) if (cell.m[l] > 0) liquids.push({ id: LIQUIDS[l].id, share: cell.m[l] / cell.all });
  /* Lösung: Massenanteil des Salzes im Wasser der Zelle, Molalität, Siedepunkt beim Druck dort, Gefrierpunkt. */
  let salt: ProbeInfo['cell']['salt'] = null;
  if (kind === 'liquid' && cell.salt > 0 && cell.water > 0) {
    const molality = cell.salt / (cell.water * M_S);
    salt = { w: cell.salt / (cell.salt + cell.water), molality, Tb: boilingPoint(p, molality), Tf: freezingPoint(molality) };
  }
  const rho = kind === 'gas' ? e.gas.rho[c]
    : kind === 'liquid' ? (salt !== null && !e.phase.mixed ? rhoSol(T, salt.w) : e.phase.mixed ? rhoLiq(e.phase.host[c], T) : e.liquid.rhoRef)
      : g.solid[c] !== 0 ? SOLIDS[g.solid[c] - 1].rho : 0;
  return {
    x, y,
    cell: {
      kind,
      material: g.solid[c] !== 0 ? SOLIDS[g.solid[c] - 1].id : null,
      T,
      p,
      Tsat: tSat(p),
      x: xs,
      rh: kind === 'gas' ? pv / pSat(g.T[c]) : 0,
      fog: kind === 'gas' ? g.mfog[c] / Math.max(1e-12, e.gas.vgas[c]) : 0,
      rho,
      phi: g.phi[c],
      u, v,
      heater: g.role[c] === 1,
      film: g.film[c],
      crust: g.crust[c],
      liquids,
      salt
    },
    particle: best < 0 ? null : { id: P.id[best], T: P.T[best], vx: P.vx[best], vy: P.vy[best], mass: P.mass[best], rho: P.rho[best], dist: Math.sqrt(bd), liquid: LIQUIDS[P.mat[best]]?.id ?? LIQUIDS[0].id, salt: P.saltFraction(best) },
    bubble: bb < 0 ? null : e.bubbleModel.describe(bb),
    body: bodyInfo(e, x, y)
  };
}

/** Der Körper an (x, y) für den Inspektor (M3a): Werkstoff (der häufigste), Masse, mittlere Temperatur seiner Voxel, Bewegung. */
function bodyInfo(e: Engine, x: number, y: number): ProbeInfo['body'] {
  const b = e.bodies.bodyAt(x, y);
  if (b === null) return null;
  const count = new Map<number, number>();
  let C = 0;
  let E = 0;
  for (let k = 0; k < b.nv; k += 1) {
    count.set(b.mat[k], (count.get(b.mat[k]) ?? 0) + 1);
    const s = SOLIDS[b.mat[k]];
    const c = s.rho * s.cp * e.grid.vCell;
    C += c;
    E += b.E[k];
  }
  let mat = b.mat[0];
  let most = -1;
  for (const [m, c] of count) if (c > most) { most = c; mat = m; }
  /* Schläft oder steht er angeheftet, sind seine Zellen der Zustand (ihre Energie seit dem letzten Abgleich zählt mit). */
  let dE = 0;
  for (let q = 0; q < b.nc; q += 1) if (e.grid.owner[b.cells[q]] === b.index + 1) dE += e.grid.Es[b.cells[q]] - b.E0[q];
  return {
    index: b.index,
    material: SOLIDS[mat].id,
    mass: b.m,
    T: C > 0 ? 273.15 + (E + dE) / C : 0,
    vx: b.vx,
    vy: b.vy,
    angle: b.a,
    w: b.w,
    state: b.pinned ? 'pinned' : b.asleep ? 'asleep' : 'moving'
  };
}

