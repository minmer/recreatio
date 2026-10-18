/**
 * 2026-10-18 — FEUER (Chemia): es gibt keine Flamme als Ding — es brennt,
 * wo Brennstoff, Sauerstoff und genug Wärme in einer Zelle zusammenkommen.
 *
 *   Gase      Methan aus dem Brenner, Wasserstoff, Etanoldampf: über ihrer
 *             Zündtemperatur verbrennen sie in der Zelle; die Wärme heizt die
 *             Nachbarn über die Zündtemperatur — so wandert die Flamme, und
 *             sie geht aus, wo das Gemisch zu mager ist (unter ~4 % Wasserstoff
 *             reicht die Wärme nicht). Fehlt Sauerstoff, wird Kohlenstoff Russ —
 *             glühender Russ ist die gelbe Flamme, kalter steigt als Rauch.
 *             Brenner mit offener Luft: Methan und Luft gemischt — blau.
 *   Feststoffe  brennen an ihren Seiten zur Luft: Magnesium blendend, Schwefel blau,
 *             Holz, Holzkohle glüht; unter 16 % Sauerstoff geht die Kerze aus.
 *   Kerze     der Docht verbrennt geschmolzenes Paraffin, solange Luft da ist.
 *   Gase untereinander  NO wird an der Luft braun, NH₃ und HCl werden weisser Rauch.
 *   Farbe     Salze in der Flamme färben sie (Natrium gelb, Kupfer grün …).
 */

import { FUELS, GAS_FUELS, SPECIES, saltOf, type Fuel } from './chemData';
import { CELL, F, FIRE, GASI, GAS_DHF, G_O2, Grid, L, NG, SOLI, SOL_DHF, type Form } from './chemGrid';
import type { ChemCtx } from './chemCell';

const name = (id: string): string => SPECIES[id]?.name ?? id;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Was die Flamme färbt (in dieser Reihe — `glowSp` ist die Nummer). */
export const FLAME_IONS: readonly string[] = ['Na+', 'K+', 'Li+', 'Ca+2', 'Sr+2', 'Ba+2', 'Cu+2'];
/** Wie stark jedes färbt (Natrium übertönt alles). */
const FLAME_POWER: readonly number[] = [6, 0.6, 1.5, 1, 1.5, 1, 1];

const G_CO2 = GASI.CO2;
const G_H2O = GASI['H2O(g)'];

interface GasFuelIdx { readonly gi: number; readonly ignite: number; readonly o2: number; readonly make: readonly (readonly [number, number])[]; readonly soot: number; readonly eq: string; readonly id: string }
const GF: readonly GasFuelIdx[] = GAS_FUELS.map((f) => ({ gi: GASI[f.id], ignite: f.ignite, o2: f.o2, make: f.make.map(([g, k]) => [GASI[g], k] as const), soot: f.soot, eq: f.eq, id: f.id }));

/** Was die Flamme in diesem Schritt tat (für Meldungen und den Knall). */
export interface FireNews {
  /** mol Wasserstoff, der verbrannte — viel auf einmal ist ein Knall. */
  h2: number;
  /** Zelle des stärksten Wasserstoffbrandes. */
  h2At: number;
}

/** Wie viel Wärme (J) frei würde, wenn in einer Zelle aller Brennstoff mit dem Sauerstoff dort verbrennte. */
function potential(g: Grid, i: number): number {
  const o = i * NG;
  let o2 = g.gas[o + G_O2];
  let q = 0;
  for (const f of GF) {
    const fuel = g.gas[o + f.gi];
    if (fuel <= 0 || o2 <= 0) continue;
    const xi = Math.min(fuel, o2 / f.o2);
    let dh = -GAS_DHF[f.gi];
    for (const [gi, m] of f.make) dh += m * GAS_DHF[gi];
    q -= xi * dh;
    o2 -= xi * f.o2;
  }
  return q;
}

/**
 * GASE VERBRENNEN: in jeder Zelle über ihrer Zündtemperatur — und dort, wohin
 * die Flamme wandert: neben einer Zelle, die eben brannte, zündet ein Gemisch,
 * das sich selbst heiss genug brennen könnte (zu mager oder zu fett: nicht —
 * daraus folgen die Zündgrenzen). Fast vollständig in einem Schritt, begrenzt
 * durch das, was fehlt; was ohne Sauerstoff übrig bleibt, wartet auf Luft.
 * Heisser Brennstoff ganz ohne Sauerstoff zerfällt zu Russ und Wasserstoff
 * (der Kern der gelben Flamme); glühender Russ verbrennt, wo wieder Luft ist.
 * Wasserstoff mit Luft: die Flamme läuft mit gut 2 m/s — in einem Schritt durch
 * das ganze zündfähige Gemisch (der Knall).
 */
export function burnGases(c: ChemCtx, news: FireNews): void {
  const g = c.g;
  const { n, w } = g;
  const was = BURN_PREV.length === n ? BURN_PREV : (BURN_PREV = new Float32Array(n));
  was.set(g.burn.subarray(0, n));
  const front: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const o = i * NG;
    let fuelAny = false;
    for (const f of GF) if (g.gas[o + f.gi] > 1e-14) { fuelAny = true; break; }
    if (!fuelAny && g.smoke[i] <= 1e-9) { if (g.burn[i] > 0) g.burn[i] = g.burn[i] * 0.5 < 1e-3 ? 0 : g.burn[i] * 0.5; continue; }
    /* Brennt ein Nachbar, und könnte sich dieses Gemisch selbst heiss genug brennen? */
    let spread = false;
    if (fuelAny && g.gas[o + G_O2] > 1e-14) {
      const c0 = i % w;
      const near = (c0 > 0 && was[i - 1] > 0.05) || (c0 < w - 1 && was[i + 1] > 0.05) || (i >= w && was[i - w] > 0.05) || (i + w < n && was[i + w] > 0.05) || was[i] > 0.05;
      if (near) spread = catches(g, i);
    }
    const h2 = news.h2;
    burnCell(c, i, spread, news);
    if (news.h2 > h2) front.push(i);
  }
  /* Die Wasserstoffflamme läuft weiter, so weit sie in diesem Schritt kommt (2,5 m/s). */
  if (front.length === 0) return;
  const reach = Math.max(1, Math.round((250 * c.dt) / CELL));
  const depth = new Map<number, number>();
  for (const i of front) depth.set(i, 0);
  for (let q = 0; q < front.length; q += 1) {
    const i = front[q];
    const d = depth.get(i) ?? reach;
    if (d >= reach) continue;
    const c0 = i % w;
    for (const j of [c0 > 0 ? i - 1 : -1, c0 < w - 1 ? i + 1 : -1, i - w, i + w]) {
      if (j < 0 || j >= n || depth.has(j) || g.wall(j)) continue;
      const o = j * NG;
      if (g.gas[o + GASI.H2] <= 1e-14 || g.gas[o + G_O2] <= 1e-14 || g.gas[o + GASI.CH4] > 0 || !catches(g, j)) continue;
      const h2 = news.h2;
      burnCell(c, j, true, news);
      if (news.h2 > h2) { depth.set(j, d + 1); front.push(j); }
    }
  }
}

/** Zündet das Gemisch neben einer Flamme? Es müsste sich selbst über 1300 K brennen können — Wasserstoff schon über 950 K (er diffundiert schnell zur Flamme). */
function catches(g: Grid, i: number): boolean {
  const o = i * NG;
  const lean = g.gas[o + GASI.H2] > 0.03 * g.gasTotal(i) && g.gas[o + GASI.CH4] <= 0;
  return g.T[i] + potential(g, i) / g.cap(i) > (lean ? 950 : 1300);
}

/** Eine Zelle brennt: die Gase mit ihrem Sauerstoff (fast ganz in einem Schritt), Russ ohne Sauerstoff, glühender Russ an der Luft. */
function burnCell(c: ChemCtx, i: number, spread: boolean, news: FireNews): void {
  const g = c.g;
  const k = 1 - Math.exp(-40 * c.dt);
  const T = g.T[i];
  const o = i * NG;
  let o2 = g.gas[o + G_O2];
  let heat = 0;
  let look: number = FIRE.gas;
  for (const f of GF) {
    const fuel = g.gas[o + f.gi];
    if (fuel <= 1e-14) continue;
    if (T < f.ignite && !spread) continue;
    look = f.id === 'H2' ? FIRE.hydrogen : f.id === 'EtOH(g)' ? FIRE.ethanol : FIRE.gas;
    if (o2 > 1e-14) {
      const xi = Math.min(fuel, o2 / f.o2) * k;
      if (xi <= 1e-15) continue;
      const before = g.q[i];
      g.addGas(i, f.gi, -xi);
      g.addGas(i, G_O2, -xi * f.o2);
      for (const [gi, m] of f.make) g.addGas(i, gi, xi * m);
      heat += g.q[i] - before;
      o2 -= xi * f.o2;
      if (f.id === 'H2') { news.h2 += xi; if (news.h2At < 0) news.h2At = i; }
    } else if (f.soot > 0 && T > 1150) {
      /* ohne Sauerstoff, heiss: CH₄ → C + 2H₂ (Russ leuchtet gelb). */
      const xi = fuel * (1 - Math.exp(-3 * c.dt));
      const before = g.q[i];
      g.addGas(i, f.gi, -xi);
      g.addGas(i, GASI.H2, 2 * xi);
      g.smoke[i] += xi * 12 * f.soot;
      heat += g.q[i] - before;
    }
  }
  /* Glühender Russ verbrennt (die Spitze der gelben Flamme wird klar). */
  const s = g.smoke[i];
  if (s > 1e-9 && T > 950 && o2 > 1e-12) {
    const mol = Math.min(s / 12, o2) * (1 - Math.exp(-6 * c.dt * ((T - 900) / 500)));
    if (mol > 0) {
      const before = g.q[i];
      g.smoke[i] -= mol * 12;
      g.addGas(i, G_O2, -mol);
      g.addGas(i, G_CO2, mol);
      heat += g.q[i] - before;
    }
  }
  if (heat > 0) {
    g.burn[i] = Math.max(g.burn[i] * 0.5, heat / c.dt);
    g.turb[i] = Math.max(g.turb[i], 0.3);
    g.fire[i] = g.smoke[i] > 1e-7 ? FIRE.yellow : look;
  } else g.burn[i] = g.burn[i] * 0.5 < 1e-3 ? 0 : g.burn[i] * 0.5;
}

let BURN_PREV = new Float32Array(0);

/* -- Feststoffe ------------------------------------------------------------------------------------------ */

const FUEL_OF: ReadonlyMap<number, Fuel> = new Map(FUELS.filter((f) => SOLI[f.id] !== undefined).map((f) => [SOLI[f.id], f]));

/** Feststoffe brennen an den Seiten, die Gas mit Sauerstoff berühren — Holz, Holzkohle, Schwefel, Magnesium, Stahlwolle. */
export function burnSolids(c: ChemCtx): void {
  const g = c.g;
  const { n, w } = g;
  for (let i = 0; i < n; i += 1) {
    const molten = g.lq[i] === L.melt && FUEL_OF.has(g.msp[i]);
    const sp = molten ? g.msp[i] : g.sp[i];
    if (sp < 0) continue;
    const f = FUEL_OF.get(sp);
    if (f === undefined || f.id === 'wax') continue;
    if (f.fine === true && g.sform[i] !== F.powder && g.sform[i] !== F.granules) continue;
    if (g.T[i] < f.ignite * 0.92) continue;
    if (g.lq[i] === L.aq) continue;
    for (const j of [i + w, i - 1, i + 1, i - w]) {
      if (j < 0 || j >= n || g.wall(j)) continue;
      const nTot = g.gasTotal(j);
      if (nTot <= 0 || g.lq[j] === L.aq) continue;
      const x = g.gas[j * NG + G_O2] / nTot;
      if (x < f.xmin || g.T[i] < f.ignite) continue;
      const amount = molten ? g.mn[i] : g.sn[i];
      if (amount <= 0) break;
      const A = CELL * Math.min(g.D[i], g.D[j]);
      const e = Math.min(amount, f.k * A * (x / 0.21) * c.dt, g.gas[j * NG + G_O2] / f.o2 * 0.9);
      if (e <= 1e-15) continue;
      const before = g.q[i];
      if (molten) g.addMelt(i, sp, -e, i); else g.addSolid(i, sp, -e, g.sform[i] as Form, i);
      g.addGas(j, G_O2, -e * f.o2, i);
      for (const [what, k] of f.make) {
        const [kind, id] = what.split(':');
        if (kind === 'g') { g.addGas(j, GASI[id], e * k, i); continue; }
        /* Ein Oxid: weisser Rauch in der Luft (Magnesium) und Pulver, wo Platz ist. */
        const s = SOLI[id];
        g.q[i] -= e * k * SOL_DHF[s];
        let smoke = e * k;
        if (g.sp[i] < 0 || g.sp[i] === s) { g.sp[i] = s; g.sform[i] = F.powder; g.sn[i] += smoke * 0.4; smoke *= 0.6; }
        g.fume[j] += smoke;
        g.fumeSp[j] = s;
      }
      /* Die Flamme ist im Gas über der Oberfläche (Holzgas, Schwefeldampf): dort der grössere Teil der Wärme — Glut (Kohle) behält sie. */
      const heat = g.q[i] - before;
      const share = f.id === 'C' ? 0.2 : 0.6;
      g.q[i] -= heat * share;
      g.q[j] += heat * share;
      const P = heat / c.dt;
      g.burn[j] = Math.max(g.burn[j], P * (f.light >= 0.9 ? 3 : 1));
      g.burn[i] = Math.max(g.burn[i], P);
      const look = f.id === 'Mg' ? FIRE.white : f.id === 'S' ? FIRE.sulfur : f.id === 'Fe' ? FIRE.sparks : f.id === 'C' ? FIRE.none : FIRE.yellow;
      g.fire[j] = look;
      g.fire[i] = look;
      g.turb[j] = Math.max(g.turb[j], 0.4);
      c.say(`burn:${f.id}${x > 0.4 ? ':o2' : ''}`, burnText(f.id, x), i, f.eq);
    }
  }
}

const burnText = (sp: string, xo: number): string => {
  const more = xo > 0.4 ? ' — w tlenie znacznie jaśniej' : '';
  switch (sp) {
    case 'Mg': return `Magnez spala się oślepiająco jasnym płomieniem, powstaje biały dym i proszek (tlenek magnezu)${more}.`;
    case 'S': return `Siarka spala się niebieskim płomieniem — powstaje gaz o duszącym zapachu (SO₂)${more}.`;
    case 'C': return `Węgiel żarzy się i spala${more}.`;
    case 'Fe': return `Wata stalowa spala się, sypiąc iskrami${more}.`;
    case 'wood': return `Drewno pali się${more}.`;
    default: return `${cap(name(sp))} pali się${more}.`;
  }
};

/* -- Kerze ----------------------------------------------------------------------------------------------- */

const WAX = SOLI.wax;
const WAX_FUEL = FUELS.find((f) => f.id === 'wax');

/**
 * EINE KERZE (Docht in Zelle `wick`): brennt, solange sie heiss ist, Paraffin
 * hat (geschmolzenes zuerst) und über dem Docht genug Sauerstoff ist —
 * Flammengase in die Zellen darüber, die Wärme mit ihnen. `true`: brennt.
 */
export function burnCandle(c: ChemCtx, wick: number, lit: boolean): boolean {
  const g = c.g;
  const f = WAX_FUEL;
  if (f === undefined || wick < 0) return false;
  const { w, n } = g;
  const above = wick + w;
  if (above + w >= n) return false;
  /* Die Flamme: die drei Zellen über dem Docht. Ihre Luft: die Luft, die sie aus der Umgebung ansaugt
     (ein Ring drei Zellen weiter) — in der Flamme selbst ist immer wenig Sauerstoff. */
  const zone = [above, above - 1, above + 1].filter((j) => !g.wall(j) && g.lq[j] !== L.aq && g.gasTotal(j) > 0);
  if (zone.length === 0) return false;
  let x = 0;
  const c0 = wick % w;
  const ring: number[] = [];
  let ringN = 0;
  let ringO2 = 0;
  for (let dy = -3; dy <= 3; dy += 1) {
    for (let dx = -3; dx <= 3; dx += 1) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== 3 || c0 + dx < 0 || c0 + dx >= w) continue;
      const j = wick + dy * w + dx;
      if (j < 0 || j >= n || g.wall(j) || g.lq[j] !== L.none) continue;
      const t = g.gasTotal(j);
      if (t <= 0) continue;
      x = Math.max(x, g.gas[j * NG + G_O2] / t);
      ring.push(j);
      ringN += t;
      ringO2 += g.gas[j * NG + G_O2];
    }
  }
  /* Aus ist aus: wieder an nur mit einem Streichholz (oder einer Flamme am Docht). */
  if (!lit && g.T[wick] < 950) return false;
  if (x < f.xmin) return false;
  /* Paraffin in der Nähe des Dochts (geschmolzen oder fest). */
  let src = -1;
  for (const j of [wick - g.w, wick - 1, wick + 1, wick - g.w - 1, wick - g.w + 1, wick - 2 * g.w]) {
    if (j < 0) continue;
    if ((g.lq[j] === L.melt && g.msp[j] === WAX && g.mn[j] > 1e-9) || (g.sp[j] === WAX && g.sn[j] > 1e-9)) { src = j; break; }
  }
  if (src < 0) return false;
  const molten = g.lq[src] === L.melt;
  const have = molten ? g.mn[src] : g.sn[src];
  let e = Math.min(have, f.k * Math.min(1.2, x / 0.21) * c.dt);
  /* Die Flamme saugt Luft an: so viel Gas aus dem Ring in die Flamme, wie sie Sauerstoff braucht (mit etwas Überschuss). */
  if (ringO2 > 0) {
    const draw = Math.min((e * f.o2 * 1.3) / (ringO2 / ringN), ringN * 0.3);
    for (const j of ring) {
      const part = (draw * g.gasTotal(j)) / ringN;
      for (let k = 0; k < zone.length; k += 1) g.moveGas(j, zone[k], part / zone.length);
    }
  }
  let o2 = 0;
  for (const j of zone) o2 += g.gas[j * NG + G_O2];
  e = Math.min(e, (o2 / f.o2) * 0.95);
  if (e <= 0) return false;
  const before = g.q[above];
  if (molten) g.addMelt(src, WAX, -e, above); else g.addSolid(src, WAX, -e, F.piece, above);
  for (const j of zone) {
    const share = g.gas[j * NG + G_O2] / o2;
    g.addGas(j, G_O2, -e * f.o2 * share, above);
    g.addGas(j, G_CO2, e * 25 * share, above);
    g.addGas(j, G_H2O, e * 26 * share, above);
  }
  /* Die Wärme in die Flamme (über dem Docht am meisten). */
  const heat = g.q[above] - before;
  if (zone.length > 1) {
    g.q[above] -= heat * 0.5;
    for (const j of zone) if (j !== above) g.q[j] += (heat * 0.5) / (zone.length - 1);
  }
  const P = heat / c.dt;
  g.burn[above] = Math.max(g.burn[above], P);
  for (const j of zone) { g.turb[j] = Math.max(g.turb[j], 0.4); g.fire[j] = FIRE.yellow; g.smoke[j] += e * 25 * 12 * 0.01; }
  /* Der Docht bleibt heiss (die Flamme umhüllt ihn). */
  g.T[wick] = Math.max(g.T[wick], 900);
  return true;
}

/* -- Gase untereinander, Flammenfarbe -------------------------------------------------------------------- */

const G_NO = GASI.NO;
const G_NO2 = GASI.NO2;
const G_NH3 = GASI.NH3;
const G_HCL = GASI['HCl(g)'];
const S_NH4CL = SOLI.NH4Cl;

export function gasReactions(c: ChemCtx): void {
  const g = c.g;
  for (let i = 0; i < g.n; i += 1) {
    const o = i * NG;
    const no = g.gas[o + G_NO];
    if (no > 1e-12) {
      const o2 = g.gas[o + G_O2];
      const tot = g.gasTotal(i);
      const e = Math.min(no, o2 * 2, no * (1 - Math.exp(-c.dt * 7.5 * (o2 / Math.max(1e-12, tot)))));
      if (e > 0) {
        g.addGas(i, G_NO, -e);
        g.addGas(i, G_O2, -e / 2);
        g.addGas(i, G_NO2, e);
        if (g.gas[o + G_NO2] / tot > 0.01) c.say('gas:NO2', 'Bezbarwny tlenek azotu(II) reaguje z tlenem z powietrza — gaz brunatnieje.', i, '2NO + O₂ → 2NO₂');
      }
    }
    const nh3 = g.gas[o + G_NH3];
    const hcl = g.gas[o + G_HCL];
    if (nh3 > 1e-12 && hcl > 1e-12 && g.T[i] < 600) {
      const e = Math.min(nh3, hcl) * (1 - Math.exp(-c.dt * 8));
      g.addGas(i, G_NH3, -e);
      g.addGas(i, G_HCL, -e);
      g.q[i] -= e * SOL_DHF[S_NH4CL];
      g.fume[i] += e;
      g.fumeSp[i] = S_NH4CL;
      if (e > 1e-8) c.say('smoke:NH4Cl', 'Powstaje biały dym — drobne kryształki chlorku amonu.', i, 'NH₃ + HCl → NH₄Cl');
    }
  }
}

/** Salze, die eine heisse Flamme berührt, färben sie: Kationen gehen als leuchtende Teilchen ins Gas. */
export function flameColors(c: ChemCtx): void {
  const g = c.g;
  const { n, w } = g;
  for (let i = 0; i < n; i += 1) {
    const sp = g.sp[i];
    if (sp < 0) continue;
    const s = saltOf(SOL_NAMES[sp]);
    if (s === undefined) continue;
    const k = FLAME_IONS.indexOf(s.cation);
    if (k < 0) continue;
    for (const j of [i + w, i - 1, i + 1]) {
      if (j < 0 || j >= n || g.T[j] < 1000 || g.gasTotal(j) <= 0) continue;
      emit(g, j, k, Math.min(g.sn[i] * 0.02, 2e-7 * c.dt * 30));
    }
  }
}

/** Leuchtende Ionen in eine Gaszelle (die Probe am Draht, Salz in der Flamme). */
export function emit(g: Grid, j: number, ion: number, n: number): void {
  if (!(n > 0)) return;
  const w = n * FLAME_POWER[ion];
  if (g.glowSp[j] < 0 || g.glow[j] < w) g.glowSp[j] = ion;
  g.glow[j] += w;
}

const SOL_NAMES: readonly string[] = Object.keys(SOLI).sort((a, b) => SOLI[a] - SOLI[b]);

/** Ein Streichholz an einem Punkt: kleine Zellen ringsum (Gas, Docht, Span, Pulver) werden kurz glühend heiss. */
export function ignite(g: Grid, x: number, y: number): void {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const i = g.at(x + dx * CELL, y + dy * CELL);
      if (i < 0 || g.lq[i] === L.aq) continue;
      const C = g.cap(i);
      if (C < 0.6) g.T[i] = Math.max(g.T[i], 1250);
      else g.T[i] += 6 / C;
    }
  }
}

export { GAS_DHF };
