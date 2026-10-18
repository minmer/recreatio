/**
 * 2026-10-18 — WAS FLIESST, FÄLLT UND STEIGT (Chemia): Flüssigkeiten,
 * Körner und Pulver, Niederschlag, Blasen.
 *
 * <b>Flüssigkeit als Mengen je Zelle</b>: jede Zelle fasst so viel, wie Platz
 * ist; was darüber hinausgeht, fliesst — erst nach unten, dann zur Seite,
 * bis die Spiegel gleich stehen. Geneigtes Glas läuft so über den Rand, der
 * Strahl fällt in das Glas darunter. Eine Schmelze (Zinn) ist schwerer als
 * Wasser und sinkt durch sie hindurch. Wasser mischt sich, wo es aufgewühlt
 * ist (Giessen, Rühren, Blasen), und es strömt, wo es unten wärmer oder
 * leichter ist als oben — darum wird ein Becherglas über der Flamme überall
 * warm, und darum bleibt Salzlösung unter Wasser liegen.
 *
 * <b>Körner und Pulver</b> fallen in Luft schnell, in Wasser langsam, rutschen
 * seitlich ab; Niederschlag schwebt als Wolke und setzt sich über Sekunden.
 *
 * <b>Blasen</b> sind Teilchen mit Gas: sie steigen, lösen unterwegs, was sich
 * löst (CO₂ in Kalkwasser, NH₃, HCl), Dampfblasen fallen in kühlerem Wasser
 * zusammen, und an der Oberfläche gibt jede ihr Gas der Luft.
 */

import { AQ_DHF, AQI, ETHANOL, NC, WATER, aqDensity, aqVolume, diffusivity } from './chemAq';
import { CELL, F, GASI, GAS_DHF, Grid, L, NG, SOL_RHO, SOL_RHOL } from './chemGrid';
import { holdsGas, type Air } from './chemAir';

/* -- Flüssigkeit -------------------------------------------------------------------------------------- */

/** Kann diese Zelle Flüssigkeit dieser Art aufnehmen? */
const takes = (g: Grid, j: number, kind: number, sp: number): boolean => {
  if (g.wall(j)) return false;
  const l = g.lq[j];
  if (l === L.none) return true;
  if (l !== kind) return false;
  return kind !== L.melt || g.msp[j] === sp;
};

const density = (g: Grid, i: number): number => (g.lq[i] === L.aq ? aqDensity(g.comp, i * NC, g.T[i]) : g.lq[i] === L.melt && g.msp[i] >= 0 ? SOL_RHOL[g.msp[i]] : 0);

/** Einen Teil `f` der Flüssigkeit von a nach b (mit dem Niederschlag, der in ihr schwebt). */
export function moveLiquid(g: Grid, a: number, b: number, f: number): void {
  if (g.lq[a] === L.aq) {
    if (g.sform[a] === F.precip && (g.sp[b] < 0 || g.sp[b] === g.sp[a])) g.moveSolid(a, b, g.sn[a] * Math.min(1, f) * 0.9);
    g.moveAq(a, b, f);
  } else if (g.lq[a] === L.melt) g.moveMelt(a, b, f);
}

/** Zwei Zellen tauschen ihre ganze Flüssigkeit (eine Schmelze sinkt unter Wasser). */
function swapLiquids(g: Grid, a: number, b: number): void {
  const s = g.n;
  g.clear(s);
  g.D[s] = g.D[a];
  g.T[s] = g.T[a];
  moveLiquid(g, a, s, 1);
  moveLiquid(g, b, a, 1);
  moveLiquid(g, s, b, 1);
  g.clear(s);
}

/**
 * EIN DURCHGANG DES FLIESSENS (von unten nach oben — was fällt, fällt eine
 * Zeile je Durchgang): nach unten, so viel Platz ist; schwerere Flüssigkeit
 * tauscht mit leichterer darunter; zur Seite, bis die Füllung gleich ist;
 * zu volle Zellen geben nach oben ab.
 */
export function flowLiquids(g: Grid, flip: boolean): boolean {
  const { w, h } = g;
  let moved = false;
  for (let r = 0; r < h; r += 1) {
    for (let k = 0; k < w; k += 1) {
      const c = flip ? w - 1 - k : k;
      const i = r * w + c;
      const kind = g.lq[i];
      if (kind === L.none) continue;
      let lv = g.liqVol(i);
      if (lv <= 1e-9) { g.clearLiquid(i); continue; }
      const sp = g.msp[i];
      /* nach unten */
      if (r > 0) {
        const b = i - w;
        if (takes(g, b, kind, sp)) {
          const space = g.room(b) - g.liqVol(b);
          if (space > 1e-7) {
            const m = Math.min(lv, space);
            /* Was in eine Flüssigkeit fällt (Strahl, Tropfen), wirbelt sie auf. */
            if (g.lq[b] === kind && kind === L.aq) g.turb[b] = Math.max(g.turb[b], Math.min(0.5, (m / g.vol(b)) * 3));
            moveLiquid(g, i, b, m / lv);
            moved = true;
            lv -= m;
            if (lv <= 1e-9 || g.lq[i] === L.none) continue;
          }
        } else if (!g.wall(b) && g.lq[b] !== L.none && g.lq[b] !== kind && density(g, i) > density(g, b) * 1.02) {
          swapLiquids(g, i, b);
          moved = true;
          continue;
        }
      }
      /* zu voll: nach oben */
      const room = g.room(i);
      if (lv > room * 1.0005 + 1e-7) {
        const up = i + w;
        if (up < g.n && takes(g, up, kind, sp)) { moveLiquid(g, i, up, (lv - room) / lv); moved = true; lv = room; }
      }
      /* zur Seite: die Füllung angleichen (eine Schmelze fliesst etwas träger — und hält zusammen: ein
         Tropfen geschmolzenes Natrium bleibt eine Kugel, erst eine Lache breitet sich aus) */
      if (lv < 0.004) continue;
      const fill = lv / Math.max(1e-9, room);
      if (kind === L.melt && fill < 0.55) continue;
      const rate = kind === L.melt ? 0.25 : 0.4;
      for (let side = 0; side < 2; side += 1) {
        const s = (side === 0) !== flip ? i - 1 : i + 1;
        if ((s % w) !== c + (s > i ? 1 : -1) || s < 0 || s >= g.n) continue;
        if (!takes(g, s, kind, sp)) continue;
        const rs = g.room(s);
        if (rs <= 1e-7) continue;
        const fs = g.liqVol(s) / rs;
        if (fill <= fs + 0.004) continue;
        const m = Math.min(lv * 0.5, (fill - fs) * Math.min(room, rs) * rate);
        if (m < 1e-6) continue;
        moveLiquid(g, i, s, m / lv);
        moved = true;
        lv -= m;
        if (g.lq[i] === L.none) break;
      }
    }
  }
  return moved;
}

/* -- Wasser mischt sich ------------------------------------------------------------------------------- */

/** Zwei Zellen Wasser tauschen Teile (fi von i, fj von j) — Gelöstes, Formenwärme, Wärme, schwebender Niederschlag. */
function swapAq(g: Grid, i: number, j: number, fi: number, fj: number): void {
  const oi = i * NC;
  const oj = j * NC;
  const ci = fi * (g.comp[oi] * 75.3 + g.comp[oi + ETHANOL] * 112);
  const cj = fj * (g.comp[oj] * 75.3 + g.comp[oj + ETHANOL] * 112);
  const Ci = g.cap(i);
  const Cj = g.cap(j);
  const Ti = g.T[i];
  const Tj = g.T[j];
  let change = 0;
  for (let k = 0; k < NC; k += 1) {
    const a = g.comp[oi + k] * fi;
    const b = g.comp[oj + k] * fj;
    if (a === b) continue;
    g.comp[oi + k] += b - a;
    g.comp[oj + k] += a - b;
    if (k !== WATER) change += Math.abs(a - b);
  }
  const ha = g.hf[i] * fi;
  const hb = g.hf[j] * fj;
  g.hf[i] += hb - ha;
  g.hf[j] += ha - hb;
  if (change > 0) {
    g.touch(i, change / Math.max(1e-9, g.comp[oi] * 0.02));
    g.touch(j, change / Math.max(1e-9, g.comp[oj] * 0.02));
  }
  /* Schwebender Niederschlag mischt sich mit. */
  if (g.sform[i] === F.precip && (g.sp[j] < 0 || (g.sp[j] === g.sp[i] && g.sform[j] === F.precip))) g.moveSolid(i, j, g.sn[i] * fi * 0.5);
  else if (g.sform[j] === F.precip && g.sp[i] < 0) g.moveSolid(j, i, g.sn[j] * fj * 0.5);
  /* Die neue Temperatur als gewichtetes Mittel (was blieb, was kam) — stabil, auch wenn fast alles ging. */
  g.T[i] = blend(Math.max(0, Ci - ci), Ti, cj, Tj);
  g.T[j] = blend(Math.max(0, Cj - cj), Tj, ci, Ti);
}

/** Mittel zweier Temperaturen nach Wärmekapazität (ohne beides: die erste). */
export const blend = (wa: number, ta: number, wb: number, tb: number): number => (wa + wb > 1e-15 ? (wa * ta + wb * tb) / (wa + wb) : ta);

/** Wie verschieden zwei Zellen Wasser sind (0: gleich). */
function differ(g: Grid, i: number, j: number): number {
  const oi = i * NC;
  const oj = j * NC;
  const wi = Math.max(1e-12, g.comp[oi]);
  const wj = Math.max(1e-12, g.comp[oj]);
  let d = 0;
  for (let k = 1; k < NC; k += 1) {
    const a = g.comp[oi + k] / wi;
    const b = g.comp[oj + k] / wj;
    if (a !== b) d += Math.abs(a - b) / (Math.abs(a) + Math.abs(b) + 1e-9);
  }
  return d;
}

/**
 * WASSER MISCHT SICH — durch Strömung, Rühren und (langsam) Diffusion.
 *
 * <b>Strömung</b>: leichteres Wasser (wärmer, weniger Gelöstes) steigt als
 * ganzes Paket auf, schwereres sinkt — so schnell, wie die Auftriebsge-
 * schwindigkeit √(2·g·h·Δρ/ρ) es trägt (bei ein paar Grad Unterschied etwa
 * 1 cm/s); je Durchgang höchstens eine Zelle, die Zahl der Durchgänge folgt
 * dem Zeitschritt (so strömt es bei langen Schritten nicht schneller). Schräg
 * gleitet ein schwerer Streifen an leichterem Wasser vorbei; schwere Lösung,
 * die aufliegt (am Boden, auf dichterer Lösung), fliesst seitwärts weiter —
 * die farbige Schicht um einen Kristall am Boden breitet sich so aus.
 *
 * <b>Rühren</b> (Stab, Magnetrührer, Giessen, Blasen) wühlt auf: dort tauschen
 * Nachbarzellen viel (bis 40 % je Schritt). <b>Diffusion</b> ist echt langsam:
 * D ≈ 1,5·10⁻⁵ cm²/s bei 25 °C, mit T/η(T) (Stokes-Einstein) — in ruhigem
 * Wasser kommt ein Farbstoff in zehn Minuten etwa einen Millimeter weit, in
 * heissem Wasser dreimal so schnell. `mol`: die Zeit, über die die Diffusion
 * in diesem Schritt gerechnet wird (sie wird gesammelt, weil sie so klein ist).
 */
export function mixLiquids(g: Grid, dt: number, rand: () => number = Math.random, mol = 0): void {
  const { n, w } = g;
  const s = scratchOf(g);
  const { rho, moved, ground } = s;
  for (let i = 0; i < n; i += 1) rho[i] = g.lq[i] === L.aq && aqVolume(g.comp, i * NC) > 1e-9 ? aqDensity(g.comp, i * NC, g.T[i]) : 0;
  const VB = Math.sqrt(2 * 981 * CELL) * (dt / CELL);
  const passes = Math.min(4, Math.max(1, Math.ceil(VB)));
  const pb = VB / passes;
  let stamp = s.stamp;
  const full = (i: number, j: number): boolean => {
    const vi = aqVolume(g.comp, i * NC);
    const vj = aqVolume(g.comp, j * NC);
    if (vi <= 1e-9 || vj <= 1e-9) return false;
    const v = Math.min(vi, vj);
    swapAq(g, i, j, v / vi, v / vj);
    rho[i] = aqDensity(g.comp, i * NC, g.T[i]);
    rho[j] = aqDensity(g.comp, j * NC, g.T[j]);
    moved[i] = stamp;
    moved[j] = stamp;
    return true;
  };
  /* i unten, j oben (gerade oder schräg): ist unten leichter, tauschen sie. */
  const vertical = (i: number, j: number, f: number): void => {
    if (rho[i] <= 0 || rho[j] <= 0 || moved[i] === stamp || moved[j] === stamp) return;
    const ri = rho[i];
    const rj = rho[j];
    if (ri >= rj * (1 - 2e-6)) return;
    const p = f * pb * Math.sqrt((rj - ri) / rj);
    if (p < 1 && rand() >= p) return;
    if (!full(i, j)) return;
    const tb = Math.min(0.12, p * 0.15);
    if (g.turb[i] < tb) g.turb[i] = tb;
    if (g.turb[j] < tb) g.turb[j] = tb;
  };
  for (let k = 0; k < passes; k += 1) {
    stamp = s.stamp = s.stamp >= 0xfffffff0 ? 1 : s.stamp + 1;
    if (stamp === 1) moved.fill(0);
    for (let i = 0; i < n - w; i += 1) {
      if (rho[i] <= 0) continue;
      const c = i % w;
      vertical(i, i + w, 1);
      if (c > 0) vertical(i, i + w - 1, 0.5);
      if (c < w - 1) vertical(i, i + w + 1, 0.5);
    }
  }
  /* Schwere Lösung, die aufliegt, fliesst seitwärts (von unten nach oben bestimmt: worauf sie liegt, liegt selbst auf). */
  for (let i = 0; i < n; i += 1) {
    const b = i - w;
    ground[i] = rho[i] > 0 && (b < 0 || g.wall(b) || (g.sp[b] >= 0 && rho[b] <= 0) || (rho[b] > 0 && rho[b] >= rho[i] * (1 - 1e-6) && ground[b] === 1)) ? 1 : 0;
  }
  for (let k = 0; k < passes; k += 1) {
    stamp = s.stamp = s.stamp >= 0xfffffff0 ? 1 : s.stamp + 1;
    if (stamp === 1) moved.fill(0);
    const flip = rand() < 0.5;
    for (let q = 0; q < n; q += 1) {
      const i = flip ? n - 1 - q : q;
      if (rho[i] <= 0 || i % w === w - 1) continue;
      const j = i + 1;
      if (rho[j] <= 0 || moved[i] === stamp || moved[j] === stamp) continue;
      const heavy = rho[i] > rho[j] ? i : j;
      const light = heavy === i ? j : i;
      if (ground[heavy] !== 1 || rho[heavy] < rho[light] * (1 + 2e-5)) continue;
      const p = 0.7 * pb * Math.sqrt((rho[heavy] - rho[light]) / rho[heavy]);
      if (p < 1 && rand() >= p) continue;
      full(i, j);
    }
  }
  /* Rühren und Diffusion. */
  const pair = (i: number, j: number): void => {
    if (g.lq[i] !== L.aq || g.lq[j] !== L.aq) return;
    const tb = (g.turb[i] + g.turb[j]) * 0.5;
    let e = (4 * tb * dt) / (CELL * CELL);
    if (mol > 0) e += (diffusivity((g.T[i] + g.T[j]) / 2) * mol) / (CELL * CELL);
    if (e < 1e-9) return;
    if (e > 0.4) e = 0.4;
    if (tb < 0.01 && Math.abs(g.T[i] - g.T[j]) < 0.005 && differ(g, i, j) < 1e-9) return;
    const vi = aqVolume(g.comp, i * NC);
    const vj = aqVolume(g.comp, j * NC);
    if (vi <= 1e-9 || vj <= 1e-9) return;
    const v = e * Math.min(vi, vj);
    swapAq(g, i, j, v / vi, v / vj);
  };
  for (let i = 0; i < n; i += 1) {
    if (g.lq[i] !== L.aq) continue;
    if ((i % w) < w - 1) pair(i, i + 1);
    if (i + w < n) pair(i, i + w);
  }
  /* Aufgewühltes beruhigt sich (in Wasser in ein, zwei Sekunden, im Gas schneller). */
  const kl = Math.exp(-dt / 1.6);
  const kg = Math.exp(-dt / 0.6);
  for (let i = 0; i < n; i += 1) if (g.turb[i] > 0) g.turb[i] = g.turb[i] * (g.lq[i] === L.aq ? kl : kg) < 1e-4 ? 0 : g.turb[i] * (g.lq[i] === L.aq ? kl : kg);
}

/** Puffer je Gitter (Dichten, Stempel der Durchgänge, „liegt auf”). */
const SCRATCH = new WeakMap<Grid, { rho: Float64Array; moved: Uint32Array; ground: Uint8Array; stamp: number }>();
function scratchOf(g: Grid): { rho: Float64Array; moved: Uint32Array; ground: Uint8Array; stamp: number } {
  let s = SCRATCH.get(g);
  if (s === undefined) { s = { rho: new Float64Array(g.n), moved: new Uint32Array(g.n), ground: new Uint8Array(g.n), stamp: 1 }; SCRATCH.set(g, s); }
  return s;
}

/* -- Körner, Pulver, Niederschlag ------------------------------------------------------------------- */

/** Wie schnell ein Feststoff in Wasser sinkt (cm/s), je Form. */
const SINK: readonly number[] = [0, 0, 0, 6, 3, 0.8, 0.07, 0];

/** Körner und Pulver fallen (Luft: jeden Schritt, Wasser: nach ihrer Sinkgeschwindigkeit), rutschen seitlich ab; Aufgewühltes hebt feinen Niederschlag. */
export function fallSolids(g: Grid, dt: number, rand: () => number): boolean {
  const { w, h } = g;
  let moved = false;
  for (let r = 1; r < h; r += 1) {
    for (let c = 0; c < w; c += 1) {
      const i = r * w + c;
      const f = g.sform[i];
      if (f < F.granules || f > F.precip || g.sp[i] < 0) continue;
      const wet = g.lq[i] === L.aq || g.lq[i - w] === L.aq;
      if (wet) {
        /* Aufgewühltes hebt Feines leicht, Kristalle und Körner erst bei kräftigem Rühren (sie schweben dann — die ganze Oberfläche löst sich). */
        const lift = f >= F.powder ? 0.08 : f === F.crystals ? 0.3 : 0.5;
        if (g.turb[i] > lift && rand() < (g.turb[i] - lift) * (f >= F.powder ? 0.6 : 0.5)) { if (stepSolid(g, i, i + w)) moved = true; continue; }
        if (rand() > (SINK[f] * dt) / CELL) continue;
        /* Leichter als Wasser (Eis): steigt, solange über ihm Flüssigkeit ist — oben schwimmt es. */
        if (SOL_RHO[g.sp[i]] < 1) { if (g.lq[i] === L.aq && i + w < g.n && g.lq[i + w] === L.aq && stepSolid(g, i, i + w)) moved = true; continue; }
      }
      if (stepSolid(g, i, i - w)) { moved = true; continue; }
      if (f === F.precip) continue;
      const side = rand() < 0.5 ? -1 : 1;
      for (const s of [side, -side]) {
        if (c + s < 0 || c + s >= w) continue;
        if (g.wall(i + s)) continue;
        if (stepSolid(g, i, i - w + s)) { moved = true; break; }
      }
    }
  }
  return moved;
}

/** Ein Feststoff in die Zelle j (wenn dort Platz ist) — Flüssigkeit, die er verdrängt, steigt in seine alte Zelle. */
function stepSolid(g: Grid, i: number, j: number): boolean {
  if (j < 0 || j >= g.n || g.wall(j)) return false;
  const s = g.sp[i];
  if (g.sp[j] >= 0 && (g.sp[j] !== s || g.sform[j] !== g.sform[i])) return false;
  const space = g.vol(j) * (1 - (g.porous(j) ? 0.15 : 0)) - g.solidVol(j);
  const need = g.solidVol(i);
  if (space <= need * 0.02) return false;
  const k = Math.min(1, space / Math.max(1e-12, need));
  g.moveSolid(i, j, g.sn[i] * k);
  const over = g.liqVol(j) - g.room(j);
  if (over > 1e-7 && g.lq[j] !== L.none && (g.lq[i] === L.none || g.lq[i] === g.lq[j])) moveLiquid(g, j, i, over / g.liqVol(j));
  return true;
}

/* -- Flüssige Körper: wo ihre freie Oberfläche steht ------------------------------------------------------ */

/** Zusammenhängende Flüssigkeit, ihre freie Oberfläche (zum Zimmer hin) und Dichte — für den Druck in ihr. */
export class Bodies {
  readonly body: Int32Array;
  surf: number[] = [];
  rho: number[] = [];
  private readonly queue: Int32Array;

  constructor(readonly g: Grid) {
    this.body = new Int32Array(g.n).fill(-1);
    this.queue = new Int32Array(g.n);
  }

  /** Druck in der Flüssigkeit einer Zelle (kPa) — −1: ohne freie Oberfläche. */
  pressureAt(i: number, roomP: number): number {
    const b = this.body[i];
    if (b < 0) return -1;
    const s = this.surf[b];
    if (!Number.isFinite(s)) return -1;
    return roomP + 0.0981 * this.rho[b] * Math.max(0, s - this.g.cy(i));
  }

  update(air: Air): void {
    const g = this.g;
    const { n, w } = g;
    const body = this.body;
    body.fill(-1);
    this.surf = [];
    this.rho = [];
    const q = this.queue;
    for (let s = 0; s < n; s += 1) {
      if (body[s] >= 0 || g.lq[s] === L.none) continue;
      const id = this.surf.length;
      let head = 0;
      let tail = 0;
      q[tail++] = s;
      body[s] = id;
      let ys = 0;
      let ns = 0;
      let rs = 0;
      while (head < tail) {
        const i = q[head++];
        rs += density(g, i);
        const up = i + w;
        if (up >= n || (air.region[up] >= 0 && air.regions[air.region[up]]?.open === true) || (g.gasVol(i) > g.vol(i) * 0.05 && air.region[i] >= 0 && air.regions[air.region[i]]?.open === true)) {
          ys += g.cy(i) - CELL / 2 + CELL * Math.min(1, g.liqVol(i) / Math.max(1e-9, g.room(i)));
          ns += 1;
        }
        const c = i % w;
        for (let d = 0; d < 4; d += 1) {
          const j = d === 0 ? (c > 0 ? i - 1 : -1) : d === 1 ? (c < w - 1 ? i + 1 : -1) : d === 2 ? i - w : up;
          if (j < 0 || j >= n || body[j] >= 0 || g.lq[j] !== g.lq[i]) continue;
          body[j] = id;
          q[tail++] = j;
        }
      }
      this.surf.push(ns > 0 ? ys / ns : Number.NaN);
      this.rho.push(rs / Math.max(1, tail));
    }
  }
}

/* -- Blasen ------------------------------------------------------------------------------------------- */

export interface Bubble {
  x: number;
  y: number;
  readonly n: Float64Array;
  T: number;
  /** Wo sie entstand (für die Bilder: aufsteigende Ketten). */
  age: number;
}

/** Was sich aus einer Blase in Wasser löst, und wie schnell (je Sekunde). */
const DISSOLVE: readonly (readonly [number, number, number])[] = [
  [GASI['HCl(g)'], AQI['Cl-'], 25],
  [GASI.NH3, AQI.N, 18],
  [GASI.SO2, AQI.S, 4],
  [GASI.CO2, AQI.C, 0.45]
];
const G_H2O = GASI['H2O(g)'];

export class Bubbles {
  readonly list: Bubble[] = [];
  private readonly pool: Float64Array[] = [];

  constructor(readonly g: Grid, readonly rand: () => number = Math.random, readonly max = 700) {}

  private take(): Float64Array { return this.pool.pop() ?? new Float64Array(NG); }

  /** Gas entsteht in einer Zelle: mit Platz in der Zelle direkt ins Gas, sonst eine Blase. (Die Enthalpie ist schon gebucht.) */
  out(i: number, gas: number, dn: number): void {
    const g = this.g;
    if (!(dn > 0)) return;
    if (holdsGas(g, i) && g.lq[i] === L.none) { g.gas[i * NG + gas] += dn; return; }
    const x = g.cx(i) + (this.rand() - 0.5) * CELL * 0.8;
    const y = g.cy(i) + (this.rand() - 0.5) * CELL * 0.6;
    for (let k = this.list.length - 1; k >= Math.max(0, this.list.length - 24); k -= 1) {
      const b = this.list[k];
      if (b.age < 0.12 && Math.abs(b.x - x) < CELL && Math.abs(b.y - y) < CELL && total(b) < 4e-5) { b.n[gas] += dn; return; }
    }
    if (this.list.length >= this.max) {
      const b = this.list[Math.floor(this.rand() * this.list.length)];
      b.n[gas] += dn;
      return;
    }
    const n = this.take();
    n.fill(0);
    n[gas] = dn;
    this.list.push({ x, y, n, T: g.T[i], age: 0 });
  }

  /** Alles Gas einer Zelle wird eine Blase (eingeschlossen von Flüssigkeit). */
  trap(i: number): void {
    const g = this.g;
    const o = i * NG;
    const n = this.take();
    let any = 0;
    for (let k = 0; k < NG; k += 1) { n[k] = g.gas[o + k]; any += n[k]; g.gas[o + k] = 0; }
    if (any <= 0) { this.pool.push(n); return; }
    this.list.push({ x: g.cx(i), y: g.cy(i), n, T: g.T[i], age: 0 });
  }

  /** Gas aus einem geschlossenen Raum perlt in die Flüssigkeit (Zelle i Gas, j Flüssigkeit). */
  from(i: number, j: number, dn: number): void {
    const g = this.g;
    const tot = g.gasTotal(i);
    if (tot <= 0) return;
    const f = Math.min(1, dn / tot);
    const n = this.take();
    for (let k = 0; k < NG; k += 1) { n[k] = g.gas[i * NG + k] * f; g.gas[i * NG + k] -= n[k]; }
    this.list.push({ x: g.cx(j), y: g.cy(j), n, T: g.T[i], age: 0 });
  }

  /** Steigen, lösen, zusammenfallen, an der Oberfläche platzen. */
  step(dt: number): number {
    const g = this.g;
    let released = 0;
    const keep: Bubble[] = [];
    for (const b of this.list) {
      b.age += dt;
      const i = g.at(b.x, b.y);
      if (i < 0) { this.pool.push(b.n); continue; }
      if (holdsGas(g, i) && g.lq[i] !== L.melt) {
        release(g, i, b);
        released += total(b);
        this.pool.push(b.n);
        continue;
      }
      if (g.lq[i] === L.aq) dissolve(g, i, b, dt);
      const n = total(b);
      if (n <= 1e-13) { this.pool.push(b.n); continue; }
      const r = Math.cbrt((3 * ((n * 8.314 * Math.max(273, b.T)) / 101.325) * 1000) / (4 * Math.PI));
      const v = Math.min(28, 6 + 70 * r);
      /* Steigen — in halben Zellen, nie durch eine Wand (in langen Schritten käme eine Blase sonst quer durch das Glas einer
         Probówka, die im Wasserbad steht); oben, wo Gas ist, hält sie an (im nächsten Schritt gibt sie es ab). */
      let left = Math.min(40, v * dt);
      let side = 0;
      for (let k = 0; k < 400 && left > 1e-9; k += 1) {
        const d = Math.min(left, CELL * 0.5);
        left -= d;
        const up = g.at(b.x, b.y + d);
        if (up < 0 || !g.wall(up)) {
          b.y += d;
          if (up < 0 || (holdsGas(g, up) && g.lq[up] !== L.melt)) break;
          continue;
        }
        /* Unter Glas gefangen: zur Seite, wo es weitergeht (halb so schnell). */
        if (side === 0) side = g.at(b.x + CELL, b.y + CELL) >= 0 && !g.wall(g.at(b.x + CELL, b.y + CELL)) ? 1 : -1;
        const by = g.at(b.x + side * d * 0.5, b.y);
        if (by < 0 || g.wall(by)) break;
        b.x += side * d * 0.5;
      }
      const jx = b.x + (this.rand() - 0.5) * CELL * 0.3;
      const jc = g.at(jx, b.y);
      if (jc >= 0 && !g.wall(jc)) b.x = jx;
      g.turb[i] = Math.max(g.turb[i], Math.min(0.7, 0.12 + n * 2e4));
      keep.push(b);
    }
    this.list.length = 0;
    this.list.push(...keep);
    return released;
  }
}

const total = (b: Bubble): number => { let s = 0; for (let k = 0; k < NG; k += 1) s += b.n[k]; return s; };

/** Die Blase gibt ihr Gas der Zelle (mit ihrer Wärme). */
function release(g: Grid, i: number, b: Bubble): void {
  let c = 0;
  for (let k = 0; k < NG; k += 1) c += b.n[k] * 30;
  g.mixHeat(i, c, b.T);
  for (let k = 0; k < NG; k += 1) g.gas[i * NG + k] += b.n[k];
}

/** Unterwegs: Lösliches geht ins Wasser (mit seiner Lösungswärme), Dampf fällt in kühlerem Wasser zusammen. */
function dissolve(g: Grid, i: number, b: Bubble, dt: number): void {
  const o = i * NC;
  for (const [gas, slot, k] of DISSOLVE) {
    const x = b.n[gas];
    if (x <= 0) continue;
    const dn = x * (1 - Math.exp(-k * dt));
    b.n[gas] -= dn;
    g.addAq(i, slot, dn);
    g.q[i] += dn * GAS_DHF[gas];
  }
  const steam = b.n[G_H2O];
  if (steam > 0 && g.T[i] < 372.5) {
    const dn = steam * (1 - Math.exp(-(372.6 - g.T[i]) * 0.4 * dt));
    b.n[G_H2O] -= dn;
    g.addAq(i, WATER, dn);
    g.q[i] += dn * GAS_DHF[G_H2O];
  }
  b.T = g.T[i];
  void AQ_DHF; void SOL_RHO; void o;
}
