/**
 * 2026-10-18 — DIE WÄRME WANDERT (Chemia): von Zelle zu Zelle, so schnell,
 * wie die Stoffe leiten — Kupfer ist ein Stab voller Wärme, ehe Glas am
 * anderen Ende warm wird; Wasser leitet schlecht, aber es strömt
 * (`chemFlow.ts`); heisses Gas steigt (`chemAir.ts`).
 *
 * <b>Leitung</b>: über jede Seite zweier Zellen fliesst Wärme nach ihrem
 * Unterschied, der Fläche (4 mm × Tiefe) und dem harmonischen Mittel der
 * Leitfähigkeiten. Jedes Paar wird genau ausgeglichen, wie es in der Zeit
 * dt täte (exponentiell) — stabil bei jedem Schritt, auch wenn eine winzige
 * Gaszelle an dickem Glas hängt; die Richtung des Durchgangs wechselt.
 *
 * <b>Phasen</b>: was über seinen Schmelzpunkt kommt, schmilzt — mit der
 * Wärme, die es dafür braucht, darum bleibt die Temperatur stehen, bis alles
 * flüssig ist (Zinn bei 232 °C); Schmelze erstarrt beim Abkühlen; Eis schmilzt
 * (mit Salz unter 0 °C), Wasser gefriert; Wasser verdunstet an seiner
 * Oberfläche, kocht, wenn sein Dampfdruck den Druck erreicht, Dampf wird in
 * kühler Luft zu Nebel und schlägt sich an kaltem Glas nieder.
 */

import { ETHANOL, NC, WATER, molality, waterShare } from './chemAq';
import { CELL, F, GASI, GAS_DHF, G_H2O, Grid, L, NG, SOL_LF, SOL_TM, S_ICE } from './chemGrid';

const R = 8.314;
const SIGMA = 5.67e-12;
const G_ETOH = GASI['EtOH(g)'];
const H_FUS_ICE = 6010;

/** Dampfdruck des Wassers (kPa) bei T (K) — Antoine. */
function antoine(T: number): number {
  const c = T - 273.15;
  const [a, b, d] = c <= 100 ? [8.07131, 1730.63, 233.426] : [8.14019, 1810.94, 244.485];
  return 10 ** (a - b / (d + Math.max(-60, c))) * 0.133322;
}

/* Als Tafel (0,1 K) — er wird in jedem Schritt für viele Zellen gebraucht. */
const PV0 = 200;
const PV_STEP = 0.1;
const PV: Float64Array = Float64Array.from({ length: 6001 }, (_, k) => antoine(PV0 + k * PV_STEP));

/** Dampfdruck des Wassers (kPa) bei T (K). */
export function pvap(T: number): number {
  const x = (T - PV0) / PV_STEP;
  if (!(x >= 0) || x >= PV.length - 1) return antoine(T);
  const k = Math.floor(x);
  return PV[k] + (PV[k + 1] - PV[k]) * (x - k);
}

/** Dampfdruck des Etanols (kPa). */
export function pvapEthanol(T: number): number {
  const c = T - 273.15;
  return 10 ** (8.20417 - 1642.89 / (230.3 + Math.max(-60, c))) * 0.133322;
}

/** Siedepunkt (K) bei p (kPa) und Wasseranteil x (Raoult). */
export function boilingPoint(x: number, p: number): number {
  let lo = 250;
  let hi = 700;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (x * pvap(mid) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/* -- Leitung --------------------------------------------------------------------------------------- */

export interface HeatScratch { readonly C: Float64Array; readonly K: Float64Array; readonly stamp: Uint32Array; step: number }

export const heatScratch = (n: number): HeatScratch => ({ C: new Float64Array(n), K: new Float64Array(n), stamp: new Uint32Array(n), step: 0 });

/** Die frei gewordene Wärme in Temperatur, dann ein Durchgang der Leitung über alle Seiten. */
export function conduct(g: Grid, dt: number, flip: boolean, s: HeatScratch): void {
  const { n, w } = g;
  const C = s.C;
  const K = s.K;
  const T = g.T;
  const D = g.D;
  /* Wärmekapazität und Leitfähigkeit nur, wo es einen Unterschied gibt (ruhige Luft kostet nichts). */
  s.step = (s.step + 1) >>> 0;
  const now = s.step;
  const stamp = s.stamp;
  const know = (i: number): void => { if (stamp[i] !== now) { stamp[i] = now; C[i] = g.cap(i); K[i] = g.cond(i); } };
  for (let i = 0; i < n; i += 1) {
    const q = g.q[i];
    /* Nie unter die halbe absolute Temperatur in einem Schritt (eine fast leere Zelle mit viel Verdunstungskälte). */
    if (q !== 0) { know(i); T[i] = Math.max(T[i] * 0.5, T[i] + q / C[i]); g.q[i] = 0; }
  }
  const edge = (i: number, j: number): void => {
    const dT = T[i] - T[j];
    if (dT < 1e-6 && dT > -1e-6) return;
    know(i);
    know(j);
    const ki = K[i];
    const kj = K[j];
    const G = ((2 * ki * kj) / (ki + kj)) * (D[i] < D[j] ? D[i] : D[j]);
    const inv = 1 / C[i] + 1 / C[j];
    const x = G * dt * inv;
    const Q = (dT * (x > 30 ? 1 : 1 - Math.exp(-x))) / inv;
    T[i] -= Q / C[i];
    T[j] += Q / C[j];
  };
  const h = g.h;
  if (!flip) {
    for (let r = 0; r < h; r += 1) {
      const row = r * w;
      for (let c = 0; c < w; c += 1) {
        const i = row + c;
        if (c < w - 1) edge(i, i + 1);
        if (r < h - 1) edge(i, i + w);
      }
    }
  } else {
    for (let r = h - 1; r >= 0; r -= 1) {
      const row = r * w;
      for (let c = w - 1; c >= 0; c -= 1) {
        const i = row + c;
        if (c > 0) edge(i, i - 1);
        if (r > 0) edge(i, i - w);
      }
    }
  }
}

/** Glühendes strahlt: Wände, Feststoffe, Schmelzen und Russ über 600 K geben Wärme ans Zimmer ab. */
export function radiate(g: Grid, dt: number, roomT: number): void {
  const { n, w } = g;
  const T4 = roomT ** 4;
  for (let i = 0; i < n; i += 1) {
    const T = g.T[i];
    if (T < 600) continue;
    const solid = g.mat[i] !== 0 || g.sp[i] >= 0 || g.lq[i] === L.melt;
    const soot = g.smoke[i] > 1e-7;
    if (!solid && !soot) continue;
    let faces = 0;
    if (solid) {
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (j < 0 || j >= n) continue;
        if (g.mat[j] === 0 && g.sp[j] < 0 && g.lq[j] !== L.melt && g.lq[j] !== L.aq) faces += 1;
      }
    }
    const eps = solid ? (g.mat[i] !== 0 ? 0.8 : 0.45) : Math.min(0.15, g.smoke[i] / (g.vol(i) * 2e-5));
    const area = solid ? faces * CELL * g.D[i] : CELL * CELL;
    if (area <= 0 || eps <= 0) continue;
    const C = g.cap(i);
    const dE = Math.min(eps * SIGMA * (T ** 4 - T4) * area * dt, C * (T - roomT) * (solid ? 0.5 : 0.15));
    g.T[i] -= dE / C;
  }
}

/* -- Phasen ---------------------------------------------------------------------------------------- */

export interface PhaseHooks {
  /** Der Druck über der Flüssigkeit einer Zelle (kPa). */
  readonly pAt: (i: number) => number;
  /** Dampf entsteht unter Wasser: eine Blase (die Wärme ist schon gebucht). */
  readonly bubble: (i: number, gas: number, n: number) => void;
  readonly say: (key: string, text: string, i: number) => void;
}

const near = (g: Grid, i: number): number[] => {
  const out: number[] = [];
  const c = i % g.w;
  if (c > 0) out.push(i - 1);
  if (c < g.w - 1) out.push(i + 1);
  if (i >= g.w) out.push(i - g.w);
  if (i + g.w < g.n) out.push(i + g.w);
  return out;
};

/** Gefrierpunkt des Wassers neben einer Zelle (mit dem Gelösten der Nachbarn: Eis mit Salz) — ein Hauch Tau zählt nicht
    (in einem Mikrogramm Wasser machte schon eine Spur CO₂ eine „Sole“). */
function freezeAt(g: Grid, i: number): number {
  const wet = (j: number): boolean => g.lq[j] === L.aq && g.comp[j * NC + WATER] > 1e-6;
  let m = wet(i) ? molality(g.comp, i * NC) : 0;
  for (const j of near(g, i)) if (wet(j)) m = Math.max(m, molality(g.comp, j * NC));
  return 273.15 - 1.86 * Math.min(12, m);
}

export function phases(g: Grid, dt: number, h: PhaseHooks): void {
  const { n, w } = g;
  for (let i = 0; i < n; i += 1) {
    const s = g.sp[i];
    /* Schmelzen: Eis zu Wasser, Metalle, Paraffin und Schwefel zu ihrer Schmelze. */
    if (s >= 0) {
      if (s === S_ICE) {
        const Tf = freezeAt(g, i);
        if (g.T[i] > Tf + 1e-3 && g.lq[i] !== L.melt) {
          const dn = Math.min(g.sn[i], (g.cap(i) * (g.T[i] - Tf)) / H_FUS_ICE);
          const form = g.sform[i] as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
          g.addSolid(i, s, -dn, form);
          g.addAq(i, WATER, dn);
          g.applyQ(i);
          if (Tf < 272) h.say('ice-salt', 'Lód topi się w roztworze soli — temperatura spada poniżej 0 °C.', i);
        }
      } else if (SOL_TM[s] > 0 && g.T[i] > SOL_TM[s] + 1e-3 && g.lq[i] !== L.aq && (g.msp[i] < 0 || g.msp[i] === s)) {
        const dn = Math.min(g.sn[i], (g.cap(i) * (g.T[i] - SOL_TM[s])) / SOL_LF[s]);
        g.addSolid(i, s, -dn, F.piece);
        g.addMelt(i, s, dn);
        g.applyQ(i);
        h.say(`melt:${s}`, '', i);
      }
    }
    const l = g.lq[i];
    /* Erstarren der Schmelze. */
    if (l === L.melt) {
      const m = g.msp[i];
      const Tm = SOL_TM[m];
      if (Tm > 0 && g.T[i] < Tm - 1e-3 && (g.sp[i] < 0 || g.sp[i] === m)) {
        const dn = Math.min(g.mn[i], (g.cap(i) * (Tm - g.T[i])) / SOL_LF[m]);
        g.addMelt(i, m, -dn);
        g.addSolid(i, m, dn, F.cast);
        g.applyQ(i);
        h.say(`freeze:${m}`, '', i);
      }
      continue;
    }
    if (l !== L.aq) {
      /* Nebel nur, wo der Dampf nahe der Sättigung ist (oder schon Nebel da ist). */
      if (g.mist[i] > 0 || (g.gas[i * NG + G_H2O] > 0 && g.T[i] < 373.5 && (g.gas[i * NG + G_H2O] / Math.max(1e-30, g.gasTotal(i))) * 101.3 > 0.85 * pvap(g.T[i]))) mistStep(g, i, dt);
      continue;
    }
    const o = i * NC;
    const water = g.comp[o + WATER];
    /* Gefrieren. */
    if (g.T[i] < 273.5) {
      const Tf = freezeAt(g, i);
      if (g.T[i] < Tf - 0.05 && (g.sp[i] < 0 || g.sp[i] === S_ICE) && water > 1e-9) {
        const dn = Math.min(water * 0.98, (g.cap(i) * (Tf - g.T[i])) / H_FUS_ICE);
        g.addAq(i, WATER, -dn);
        g.addSolid(i, S_ICE, dn, F.cast);
        g.applyQ(i);
        h.say('freeze:water', '', i);
      }
    }
    /* Kochen: der Dampfdruck erreicht den Druck — der Überschuss an Wärme verdampft Wasser. */
    if (g.T[i] > 365 && water > 1e-9) {
      const x = waterShare(g.comp, o);
      const Tb = boilingPoint(x, h.pAt(i));
      if (g.T[i] > Tb) {
        const dn = Math.min(water, (g.cap(i) * (g.T[i] - Tb)) / 44000);
        g.addAq(i, WATER, -dn);
        if (g.gasVol(i) > g.vol(i) * 0.05) g.addGas(i, G_H2O, dn);
        else { g.q[i] -= dn * GAS_DHF[G_H2O]; h.bubble(i, G_H2O, dn); }
        g.applyQ(i);
        g.turb[i] = Math.max(g.turb[i], 0.5);
        h.say('boil', `Ciecz wrze w temperaturze ${(Tb - 273.15).toFixed(1).replace('.', ',')} °C.`, i);
      }
    }
    /* Verdunsten an der Oberfläche (oder Tau, wenn das Gas darüber feuchter ist). */
    const own = g.gasVol(i) > g.vol(i) * 0.05;
    const j = own ? i : i + w < n && g.lq[i + w] === L.none && g.gasVol(i + w) > g.vol(i + w) * 0.05 ? i + w : -1;
    if (j < 0) continue;
    const nTot = g.gasTotal(j);
    const P = nTot > 0 ? g.pressure(j) : 101.3;
    const A = CELL * Math.min(g.D[i], g.D[j]);
    const km = 0.8 * (1 + 5 * g.turb[j]);
    const evap = (gas: number, peq: number, comp: number): void => {
      const have = g.gas[j * NG + gas];
      const p = nTot > 0 ? (P * have) / nTot : 0;
      let dn = ((km * A * (peq - p)) / (R * g.T[i]) / 1000) * dt;
      /* Höchstens 5 K Verdunstungskälte (bzw. Tauwärme) je Schritt — ein Tröpfchen am Rand hat kaum Wärme. */
      const most = (g.cap(i) * 5) / 44000;
      if (dn > 0) dn = Math.min(dn, g.comp[o + comp] * 0.5, most);
      else dn = Math.max(dn, -have * 0.5, -most);
      if (dn === 0 || !Number.isFinite(dn)) return;
      g.addAq(i, comp, -dn);
      g.addGas(j, gas, dn, i);
    };
    evap(G_H2O, waterShare(g.comp, o) * pvap(g.T[i]), WATER);
    const eth = g.comp[o + ETHANOL];
    if (eth > 1e-9) evap(G_ETOH, (eth / (eth + water)) * pvapEthanol(g.T[i]), ETHANOL);
  }
  condenseOnWalls(g, dt);
}

/** Dampf in kühlem Gas wird Nebel (die weisse Wolke über kochendem Wasser) — Nebel in trockenem Gas verdunstet. */
function mistStep(g: Grid, i: number, dt: number): void {
  const V = g.gasVol(i);
  if (V <= 1e-6) return;
  const vap = g.gas[i * NG + G_H2O];
  if (vap <= 0 && g.mist[i] <= 0) return;
  const T = g.T[i];
  const sat = (pvap(T) * V) / (R * T) / 1000;
  /* Die Wärme des Übergangs verschiebt die Sättigung mit (Clausius-Clapeyron): eine Gaszelle hat kaum Wärmekapazität, also kondensiert nur so viel, dass sie danach gerade gesättigt ist. */
  const Lh = GAS_DHF[G_H2O] + 285.8e3;
  const k = 1 + (sat * (Lh / (R * T * T) - 1 / T) * Lh) / Math.max(1e-12, g.cap(i));
  let dn = 0;
  if (vap > sat * 1.01) dn = ((vap - sat) / k) * 0.6;
  else if (g.mist[i] > 0 && vap < sat) dn = -Math.min(g.mist[i], ((sat - vap) / k) * Math.min(1, dt * 6));
  if (dn === 0 || !Number.isFinite(dn)) return;
  g.gas[i * NG + G_H2O] -= dn;
  g.mist[i] += dn;
  g.q[i] += dn * Lh;
  g.applyQ(i);
}

/** An kaltem Glas schlägt sich Dampf nieder: Tropfen in der Gaszelle an der Wand — sie laufen hinunter. */
function condenseOnWalls(g: Grid, dt: number): void {
  const { n, w } = g;
  /* Nur wo Dampf dichter ist als über der kältesten Wand, kann er sich irgendwo niederschlagen. */
  let cold = Infinity;
  for (let i = 0; i < n; i += 1) if ((g.mat[i] !== 0 || g.sp[i] >= 0) && g.T[i] < cold && g.cy(i) >= 0) cold = g.T[i];
  if (!Number.isFinite(cold)) return;
  const pLow = pvap(cold);
  for (let i = 0; i < n; i += 1) {
    const vap = g.gas[i * NG + G_H2O];
    if (vap <= 1e-9 || g.lq[i] === L.melt) continue;
    const V = g.gasVol(i);
    if (V <= 1e-6) continue;
    const pw = (vap * R * g.T[i]) / V * 1000;
    if (pw <= pLow) continue;
    const c = i % w;
    for (let d = 0; d < 4; d += 1) {
      const k = d === 0 ? (c > 0 ? i - 1 : -1) : d === 1 ? (c < w - 1 ? i + 1 : -1) : d === 2 ? i - w : i + w;
      if (k < 0 || k >= n || (g.mat[k] === 0 && g.sp[k] < 0) || g.T[k] > g.T[i]) continue;
      const ps = pvap(g.T[k]);
      if (pw <= ps) continue;
      const A = CELL * Math.min(g.D[i], g.D[k]);
      const dn = Math.min(vap * 0.3, ((0.6 * A * (pw - ps)) / (R * g.T[i]) / 1000) * dt);
      if (dn <= 0) continue;
      g.addGas(i, G_H2O, -dn, k);
      g.addAq(i, WATER, dn, k);
      break;
    }
  }
}
