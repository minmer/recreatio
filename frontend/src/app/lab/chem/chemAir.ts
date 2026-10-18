/**
 * 2026-10-18 — DIE LUFT IM LABOR (Chemia): Gas strömt, wohin der Druck es
 * schiebt, steigt, wenn es leichter ist, sinkt, wenn es schwerer ist, und
 * mischt sich — langsam von selbst, schnell, wo es aufgewühlt ist.
 *
 * <b>Druck, sofort ausgeglichen</b>: alle Zellen, die Gas fassen, zerfallen in
 * Räume (verbundene Zellen). Ein Raum, der an den Rand der Welt reicht, hat
 * den Druck des Zimmers; ein geschlossener (Kolben mit Stopfen, Słój über der
 * Kerze) seinen eigenen — aus allem Gas darin. Eine Breitensuche vom Rand
 * (bzw. von einer Zelle des Raums) gibt jeder Zelle einen Nachbarn näher zum
 * Ausgang; von der fernsten Zelle an schiebt jede, was sie zu viel hat, zu
 * ihm hinüber (oder holt, was ihr fehlt): Gas aus einer Reaktion drückt die
 * Luft hinaus, heisses Gas dehnt sich, abkühlendes saugt Luft nach — in einem
 * Schritt, ohne Druckwellen. Am Rand geht es ins Zimmer, und Zimmerluft kommt
 * herein.
 *
 * <b>Auftrieb</b>: ist eine Zelle leichter als die über ihr (heiss, Wasserstoff),
 * tauschen beide einen Teil — die Durchgänge laufen abwechselnd von unten
 * und von oben, so steigt eine Flammenfahne in einem Schritt weit, und CO₂
 * fliesst aus einem geneigten Becherglas wie eine unsichtbare Flüssigkeit
 * hinunter und breitet sich auf dem Tisch aus.
 */

import { AIR_X, CELL, GAS_M, Grid, L, NG } from './chemGrid';
import type { Bodies } from './chemFlow';

const R = 8.314;

export interface Region {
  readonly open: boolean;
  /** kPa */
  P: number;
  /** Bereich in `order`. */
  readonly start: number;
  readonly end: number;
  /** cm³ Gas und mol. */
  V: number;
  n: number;
}

export interface AirHooks {
  /** Gas, das unter Flüssigkeit eingeschlossen ist, wird eine Blase (alles Gas der Zelle). */
  readonly trapped: (i: number) => void;
  /** Gas aus einem geschlossenen Raum perlt in eine Flüssigkeit (mol aus Zelle i in die Flüssigkeitszelle j). */
  readonly bubbleOut: (i: number, j: number, n: number) => void;
}

/** Was die Luft zwischen den Schritten behält. */
export class Air {
  readonly region: Int32Array;
  readonly parent: Int32Array;
  /** Wie viele Zellen bis zum Ausgang (bzw. zur ersten Zelle eines geschlossenen Raums). */
  readonly dist: Int32Array;
  readonly order: Int32Array;
  readonly rho: Float64Array;
  /** Gasraum je Zelle (cm³) — einmal je Schritt bestimmt (das Gas bewegt sich, die Flüssigkeit nicht). */
  readonly gv: Float64Array;
  /** Fasst die Zelle Gas (1) — aus `gv`. */
  readonly holds: Uint8Array;
  /** Welche Zelle in diesem Durchgang schon getauscht hat (Stempel). */
  readonly moved: Uint32Array;
  /** Liegt das Gas auf (auf Wand, Flüssigkeit oder dichterem Gas, das selbst aufliegt) bzw. stösst es oben an. */
  readonly ground: Uint8Array;
  readonly roof: Uint8Array;
  /** Wo es in den weiteren Durchgängen etwas zu tun gibt (nach dem ersten, vollen Durchgang) — und ob eine Zelle schon darin steht. */
  readonly act: Int32Array;
  readonly listed: Uint32Array;
  listStamp = 1;
  stamp = 1;
  regions: Region[] = [];
  count = 0;

  constructor(readonly n: number) {
    this.region = new Int32Array(n).fill(-1);
    this.parent = new Int32Array(n).fill(-1);
    this.dist = new Int32Array(n);
    this.order = new Int32Array(n);
    this.rho = new Float64Array(n);
    this.gv = new Float64Array(n);
    this.holds = new Uint8Array(n);
    this.moved = new Uint32Array(n);
    this.ground = new Uint8Array(n);
    this.roof = new Uint8Array(n);
    this.act = new Int32Array(n);
    this.listed = new Uint32Array(n);
  }

  /** Eine neue Liste der Zellen, bei denen es weitergeht. */
  nextList(): number {
    this.listStamp = this.listStamp >= 0xfffffff0 ? 1 : this.listStamp + 1;
    if (this.listStamp === 1) this.listed.fill(0);
    return this.listStamp;
  }

  /** Ein neuer Durchgang: kein Paket hat sich darin schon bewegt. */
  nextPass(): number {
    this.stamp = this.stamp >= 0xfffffff0 ? 1 : this.stamp + 1;
    if (this.stamp === 1) this.moved.fill(0);
    return this.stamp;
  }

  /** Die Gasräume neu bestimmen (vor dem Schritt der Luft). */
  measure(g: Grid): void {
    for (let i = 0; i < g.n; i += 1) {
      if (g.wall(i)) { this.gv[i] = 0; this.holds[i] = 0; continue; }
      const v = g.gasVol(i);
      this.gv[i] = v;
      this.holds[i] = v > g.vol(i) * 0.02 ? 1 : 0;
    }
  }

  /** Der Druck des Raums, zu dem eine Zelle gehört (kPa) — oder −1. */
  pressureOf(i: number): number {
    const r = this.region[i];
    return r < 0 ? -1 : this.regions[r]?.P ?? -1;
  }
}

/** Fasst diese Zelle Gas (mindestens 2 % frei, keine Wand)? */
export const holdsGas = (g: Grid, i: number): boolean => !g.wall(i) && g.gasVol(i) > g.vol(i) * 0.02;

/* -- Räume --------------------------------------------------------------------------------------- */

function regionsOf(g: Grid, air: Air, roomP: number): void {
  const { n, w, h } = g;
  const { region, parent, order, holds, gv, dist } = air;
  region.fill(-1);
  parent.fill(-1);
  let head = 0;
  let tail = 0;
  const regions: Region[] = [];
  /* Der offene Raum: alles, was von oben erreichbar ist — das Zimmer darüber ist gross; Gas, das sich
     ausdehnt, geht nach oben und um Hindernisse herum (die Seiten sind Luft des Zimmers, aber kein Ausgang). */
  const seed = (i: number) => { if (region[i] < 0 && holds[i] === 1) { region[i] = 0; dist[i] = 0; order[tail++] = i; } };
  for (let c = 0; c < w; c += 1) seed((h - 1) * w + c);
  if (tail === 0) for (let r = 0; r < h; r += 1) { seed(r * w); seed(r * w + w - 1); }
  const grow = (id: number) => {
    while (head < tail) {
      const i = order[head++];
      const c = i % w;
      if (c > 0) visit(i - 1, i, id);
      if (c < w - 1) visit(i + 1, i, id);
      if (i >= w) visit(i - w, i, id);
      if (i + w < n) visit(i + w, i, id);
    }
  };
  const visit = (j: number, from: number, id: number) => {
    if (region[j] >= 0 || holds[j] !== 1) return;
    region[j] = id;
    parent[j] = from;
    dist[j] = dist[from] + 1;
    order[tail++] = j;
  };
  const opened = tail > 0;
  grow(0);
  if (opened) regions.push({ open: true, P: roomP, start: 0, end: tail, V: 0, n: 0 });
  /* Geschlossene Räume: jeder von einer seiner Zellen aus. */
  for (let i = 0; i < n; i += 1) {
    if (region[i] >= 0 || holds[i] !== 1) continue;
    const id = regions.length;
    const start = tail;
    region[i] = id;
    dist[i] = 0;
    order[tail++] = i;
    grow(id);
    regions.push({ open: false, P: roomP, start, end: tail, V: 0, n: 0 });
  }
  air.regions = regions;
  air.count = tail;
  /* Druck der geschlossenen Räume aus allem Gas darin. */
  for (const r of regions) {
    let V = 0;
    let nn = 0;
    let vt = 0;
    for (let k = r.start; k < r.end; k += 1) {
      const i = order[k];
      const v = gv[i];
      V += v;
      nn += g.gasTotal(i);
      vt += v / g.T[i];
    }
    r.V = V;
    r.n = nn;
    if (!r.open) r.P = vt > 0 ? (1000 * R * nn) / vt : roomP;
  }
}

/* -- Ausgleichen ------------------------------------------------------------------------------------ */

function equalize(g: Grid, air: Air, roomT: number): void {
  const { order, parent, gv, dist, region } = air;
  const { w, n } = g;
  const down = [0, 0, 0, 0];
  for (const r of air.regions) {
    for (let k = r.end - 1; k >= r.start; k -= 1) {
      const i = order[k];
      const target = (r.P * gv[i]) / (R * g.T[i]) / 1000;
      const have = g.gasTotal(i);
      const e = have - target;
      if (Math.abs(e) <= target * 3e-5 + 1e-15) continue;
      const p = parent[i];
      if (p >= 0) {
        /* Zu allen Nachbarn, die näher am Ausgang sind — gleich verteilt (so strömt es um ein Glas zu beiden Seiten). */
        let m = 0;
        const d = dist[i] - 1;
        const c = i % w;
        const id = region[i];
        if (c > 0 && region[i - 1] === id && dist[i - 1] === d) down[m++] = i - 1;
        if (c < w - 1 && region[i + 1] === id && dist[i + 1] === d) down[m++] = i + 1;
        if (i >= w && region[i - w] === id && dist[i - w] === d) down[m++] = i - w;
        if (i + w < n && region[i + w] === id && dist[i + w] === d) down[m++] = i + w;
        if (m === 0) down[m++] = p;
        const part = Math.abs(e) / m;
        for (let q = 0; q < m; q += 1) { if (e > 0) g.moveGas(i, down[q], part); else g.moveGas(down[q], i, part); }
        continue;
      }
      if (!r.open) continue;
      if (e > 0) vent(g, i, e / have);
      else admit(g, i, -e, roomT);
    }
  }
}

/** Ein Teil des Gases einer Randzelle geht ins Zimmer. */
function vent(g: Grid, i: number, f: number): void {
  const o = i * NG;
  for (let k = 0; k < NG; k += 1) g.gas[o + k] *= 1 - f;
  g.smoke[i] *= 1 - f;
  g.mist[i] *= 1 - f;
  g.fume[i] *= 1 - f;
  g.glow[i] *= 1 - f;
}

/** Zimmerluft kommt herein. */
function admit(g: Grid, i: number, n: number, roomT: number): void {
  g.mixHeat(i, n * 29.1, roomT);
  const o = i * NG;
  for (let k = 0; k < NG; k += 1) g.gas[o + k] += n * AIR_X[k];
}

/* -- Tauschen ------------------------------------------------------------------------------------ */

/** Zwei Zellen tauschen Teile ihres Gases (fi von i, fj von j) — mit Wärme und allem, was darin schwebt. */
/** Nur Gas in der Zelle (keine Wand, keine Flüssigkeit, kein Feststoff)? */
const pure = (g: Grid, i: number): boolean => g.mat[i] === 0 && g.lq[i] === 0 && g.sp[i] < 0;

export function swapGas(g: Grid, i: number, j: number, fi: number, fj: number): void {
  /* Zwei reine Gaszellen tauschen ganz: einfach den Inhalt und die Temperatur. */
  if (fi > 0.999999 && fj > 0.999999 && pure(g, i) && pure(g, j)) {
    const oi = i * NG;
    const oj = j * NG;
    for (let k = 0; k < NG; k += 1) { const a = g.gas[oi + k]; g.gas[oi + k] = g.gas[oj + k]; g.gas[oj + k] = a; }
    let t = g.T[i]; g.T[i] = g.T[j]; g.T[j] = t;
    t = g.smoke[i]; g.smoke[i] = g.smoke[j]; g.smoke[j] = t;
    t = g.mist[i]; g.mist[i] = g.mist[j]; g.mist[j] = t;
    t = g.fume[i]; g.fume[i] = g.fume[j]; g.fume[j] = t;
    t = g.fumeSp[i]; g.fumeSp[i] = g.fumeSp[j]; g.fumeSp[j] = t;
    t = g.glow[i]; g.glow[i] = g.glow[j]; g.glow[j] = t;
    t = g.glowSp[i]; g.glowSp[i] = g.glowSp[j]; g.glowSp[j] = t;
    return;
  }
  const gi = g.gasCap(i);
  const gj = g.gasCap(j);
  const ci = gi * fi;
  const cj = gj * fj;
  const Ci = pure(g, i) ? gi : g.cap(i);
  const Cj = pure(g, j) ? gj : g.cap(j);
  const Ti = g.T[i];
  const Tj = g.T[j];
  const oi = i * NG;
  const oj = j * NG;
  for (let k = 0; k < NG; k += 1) {
    const a = g.gas[oi + k] * fi;
    const b = g.gas[oj + k] * fj;
    g.gas[oi + k] += b - a;
    g.gas[oj + k] += a - b;
  }
  const sw = (arr: Float32Array) => { const a = arr[i] * fi; const b = arr[j] * fj; arr[i] += b - a; arr[j] += a - b; };
  sw(g.smoke); sw(g.mist);
  const fa = g.fume[i] * fi;
  const fb = g.fume[j] * fj;
  if (fa > fb && g.fumeSp[j] < 0) g.fumeSp[j] = g.fumeSp[i];
  if (fb > fa && g.fumeSp[i] < 0) g.fumeSp[i] = g.fumeSp[j];
  g.fume[i] += fb - fa; g.fume[j] += fa - fb;
  const ga = g.glow[i] * fi;
  const gb = g.glow[j] * fj;
  if (ga > gb && g.glowSp[j] < 0) g.glowSp[j] = g.glowSp[i];
  if (gb > ga && g.glowSp[i] < 0) g.glowSp[i] = g.glowSp[j];
  g.glow[i] += gb - ga; g.glow[j] += ga - gb;
  /* Gewichtetes Mittel (was blieb, was kam) — stabil, auch wenn fast alles ging. */
  const wi = Math.max(0, Ci - ci);
  const wj = Math.max(0, Cj - cj);
  g.T[i] = wi + cj > 1e-15 ? (wi * Ti + cj * Tj) / (wi + cj) : Ti;
  g.T[j] = wj + ci > 1e-15 ? (wj * Tj + ci * Ti) / (wj + ci) : Tj;
}

const density = (g: Grid, i: number, V: number): number => {
  if (V <= 1e-9) return 0;
  const o = i * NG;
  let m = g.mist[i] * 18 + g.smoke[i];
  for (let k = 0; k < NG; k += 1) m += g.gas[o + k] * GAS_M[k];
  return m / V;
};

/**
 * AUFTRIEB, AUSBREITEN, MISCHEN: senkrecht tauschen Zellen, wenn unten
 * leichteres Gas liegt; waagerecht breitet sich schweres Gas aus, wo es
 * aufliegt (nicht mitten in der Luft); überall mischt es sich ein wenig
 * (Diffusion), viel, wo es aufgewühlt ist (Flamme, Blasen).
 */
/** Ein aufsteigendes Paket ist grösser als eine Zelle: so viel schneller als √(2·g·Zelle·Δρ/ρ). */
const PLUME = 2.5;
/** Welchen Teil seines Raums ein aufsteigendes Paket je Zelle Weg mit jedem seitlichen Nachbarn tauscht. */
const ENTRAIN = 0.15;

function stir(g: Grid, air: Air, dt: number, up: boolean, rand: () => number): void {
  const { n, w, h } = g;
  const { region, rho, gv } = air;
  const scale = dt / (1 / 30);
  for (let i = 0; i < n; i += 1) rho[i] = region[i] >= 0 ? density(g, i, gv[i]) : 0;
  /* Ein Paket steigt oder sinkt als Ganzes (ein Teiltausch wäre Mischen): es tauscht den Platz mit dem
     Nachbarn — so oft, wie seine Geschwindigkeit √(2·g·L·Δρ/ρ) (L: ein Paket von gut einer Zelle) es in
     dieser Zeit Zellen weit trägt. Je Durchgang höchstens eine Zelle — sonst trüge ein Durchlauf von unten
     nach oben eine Blase in einem Schritt bis an die Decke, und das Gas stiege bei grossen Schritten schneller. */
  const VB = PLUME * Math.sqrt(2 * 981 * CELL) * (dt / CELL);
  const passes = Math.min(4, Math.max(1, Math.ceil(VB)));
  const pb = VB / passes;
  const moved = air.moved;
  let stamp = 0;
  /* Nach dem ersten, vollen Durchgang nur noch, wo etwas aufsteigen oder sinken kann (eine Flamme, ein Gasstrom) —
     ruhige Luft kostet so nur einen Durchlauf. */
  const { act, listed } = air;
  let nAct = 0;
  let listStamp = air.nextList();
  const want = (i: number): void => { if (i >= 0 && i < n && listed[i] !== listStamp) { listed[i] = listStamp; act[nAct] = i; nAct += 1; } };
  const vertical = (i: number, j: number, f: number): void => {
    if (region[i] < 0 || region[i] !== region[j] || moved[i] === stamp || moved[j] === stamp) return;
    const ri = rho[i];
    const rj = rho[j];
    if (ri >= rj * (1 - 1e-4) || rj <= 0) return;
    want(i);
    const p = f * pb * Math.sqrt((rj - ri) / rj);
    if (p < 1 && rand() >= p) return;
    const vi = gv[i];
    const vj = gv[j];
    const v = Math.min(vi, vj);
    swapGas(g, i, j, v / vi, v / vj);
    /* Mitreissen: ein aufsteigendes warmes Paket mischt sich mit der kühleren Luft neben sich — eine Fahne wird breiter,
       kühler und trockener (Luft, die von sinkendem CO₂ verdrängt nach oben geht, mischt nicht: ein Gasstrom bleibt beisammen). */
    const c = j % w;
    for (const k of [c > 0 ? j - 1 : -1, c < w - 1 ? j + 1 : -1]) {
      if (k < 0 || region[k] !== region[j] || gv[k] <= 0 || g.T[j] < g.T[k] + 5) continue;
      const e = ENTRAIN * Math.min(vj, gv[k]);
      swapGas(g, j, k, e / vj, e / gv[k]);
      rho[k] = density(g, k, gv[k]);
    }
    rho[i] = density(g, i, vi);
    rho[j] = density(g, j, vj);
    moved[i] = stamp;
    moved[j] = stamp;
    /* Im nächsten Durchgang weiter: das leichte Paket von oben aus, das schwere von unten. */
    want(j);
    want(i - w);
    want(i - w - 1);
    want(i - w + 1);
  };
  /* Schräg: ein schwerer Streifen gleitet an der leichteren Luft neben sich vorbei nach unten (sonst müsste alle Luft
     unter ihm einzeln durch ihn hindurch steigen, und eine lange Säule CO₂ stünde in der Luft). */
  const pair = (i: number): void => {
    if (i + w >= n || region[i] < 0) return;
    const c = i % w;
    vertical(i, i + w, 1);
    if (c > 0) vertical(i, i + w - 1, 0.5);
    if (c < w - 1) vertical(i, i + w + 1, 0.5);
  };
  for (let k = 0; k < passes; k += 1) {
    stamp = air.nextPass();
    const upward = up === (k % 2 === 0);
    if (k === 0) {
      if (upward) { for (let i = 0; i < n - w; i += 1) pair(i); } else { for (let i = n - w - 1; i >= 0; i -= 1) pair(i); }
      continue;
    }
    const m = nAct;
    const list = act.subarray(0, m);
    list.sort();
    if (upward) { for (let q = 0; q < m; q += 1) pair(list[q]); } else { for (let q = m - 1; q >= 0; q -= 1) pair(list[q]); }
  }
  const DM = 0.15;
  const DT = 25;
  const KL = 4 * scale;
  /* Aufliegen heisst: darunter eine Wand, Flüssigkeit oder dichteres Gas, das selbst aufliegt — eine fallende Wolke
     liegt auf sich selbst, aber nicht auf: sie fällt beisammen und breitet sich erst unten aus. Von unten nach oben
     (bzw. oben nach unten) in einem Durchlauf. */
  const { ground, roof } = air;
  for (let i = 0; i < n; i += 1) {
    const b = i - w;
    ground[i] = region[i] >= 0 && (b < 0 || region[b] < 0 || (rho[b] >= rho[i] * 0.999 && ground[b] === 1)) ? 1 : 0;
  }
  for (let i = n - 1; i >= 0; i -= 1) {
    const a = i + w;
    roof[i] = region[i] >= 0 && (a >= n || region[a] < 0 || (rho[a] <= rho[i] * 1.001 && roof[a] === 1)) ? 1 : 0;
  }
  const floor = (i: number): boolean => ground[i] === 1;
  const ceiling = (i: number): boolean => roof[i] === 1;
  /* Schweres Gas, das aufliegt, fliesst seitwärts weiter (aus der Öffnung eines geneigten Glases, über den Tisch);
     leichtes Gas unter einer Decke ebenso (heisses Gas unter dem Becherglas) — als ganzes Paket. */
  const side = (i: number, j: number): void => {
    if (region[i] < 0 || region[i] !== region[j] || moved[i] === stamp || moved[j] === stamp) return;
    const ri = rho[i];
    const rj = rho[j];
    /* Zwei leere Zellen (eben frei geworden) haben keine Dichte — nichts zu tauschen. */
    if (!(Math.max(ri, rj) > 0) || Math.abs(ri - rj) < Math.max(ri, rj) * 2e-3) return;
    const heavy = ri > rj ? i : j;
    const light = heavy === i ? j : i;
    if (!floor(heavy) && !ceiling(light)) return;
    want(i);
    const p = 0.7 * pb * Math.sqrt(Math.abs(ri - rj) / Math.max(ri, rj));
    if (p < 1 && rand() >= p) return;
    const vi = gv[i];
    const vj = gv[j];
    const v = Math.min(vi, vj);
    swapGas(g, i, j, v / vi, v / vj);
    rho[i] = density(g, i, vi);
    rho[j] = density(g, j, vj);
    moved[i] = stamp;
    moved[j] = stamp;
    want(i - 1);
    want(j);
  };
  const across = (i: number): void => { if (i % w < w - 1 && region[i] >= 0) side(i, i + 1); };
  nAct = 0;
  listStamp = air.nextList();
  for (let pass = 0; pass < passes; pass += 1) {
    stamp = air.nextPass();
    const flipSide = rand() < 0.5;
    if (pass === 0) {
      for (let r = 0; r < h; r += 1) {
        for (let k = 0; k < w - 1; k += 1) across(r * w + (flipSide ? w - 2 - k : k));
      }
      continue;
    }
    const m = nAct;
    const list = act.subarray(0, m);
    list.sort();
    if (flipSide) { for (let q = m - 1; q >= 0; q -= 1) across(list[q]); } else { for (let q = 0; q < m; q += 1) across(list[q]); }
  }
  const mix = (i: number, j: number, lateral: boolean): void => {
    if (region[i] < 0 || region[i] !== region[j]) return;
    const ri = rho[i];
    const rj = rho[j];
    const dT = g.T[i] - g.T[j];
    const tb = (g.turb[i] + g.turb[j]) * 0.5;
    if (!(Math.max(ri, rj) > 0)) return;
    /* Was man nicht sieht, wird nicht gemischt: die Wärme allein gleicht die Leitung aus. */
    if (Math.abs(ri - rj) < (ri + rj) * 5e-4 && tb < 0.02) return;
    void dT;
    let f = ((DM + DT * tb) * dt) / (CELL * CELL);
    if (lateral) {
      const heavy = ri > rj ? i : j;
      if (floor(heavy)) f += (KL * Math.abs(ri - rj)) / Math.max(ri, rj);
    }
    if (f > 0.22) f = 0.22;
    if (f < 1e-5) return;
    const vi = gv[i];
    const vj = gv[j];
    const v = f * Math.min(vi, vj);
    swapGas(g, i, j, v / vi, v / vj);
    rho[i] = density(g, i, vi);
    rho[j] = density(g, j, vj);
  };
  for (let r = 0; r < h; r += 1) {
    for (let c = 0; c < w; c += 1) {
      const i = r * w + c;
      if (region[i] < 0) continue;
      if (c < w - 1) mix(i, i + 1, true);
      if (r < h - 1) mix(i, i + w, false);
    }
  }
}

/** Die Ränder der Welt sind das Zimmer: dort wird das Gas langsam wieder Zimmerluft. */
function freshen(g: Grid, air: Air, dt: number, roomT: number, roomP: number): void {
  const { w, h } = g;
  if (air.regions[0]?.open !== true) return;
  /* Oben ist die Welt offen (das Zimmer ist hoch): was oben ankommt, zieht ab — sonst sammelte sich die heisse Luft
     einer Flamme unter dem Rand des Bildes wie unter einer Decke. An den Seiten mischt sich das Zimmer schnell herein. */
  let k = 1;
  const edge = (i: number) => {
    if (air.region[i] !== 0) return;
    const V = air.gv[i];
    const nEq = (roomP * V) / (R * roomT) / 1000;
    const o = i * NG;
    for (let s = 0; s < NG; s += 1) g.gas[o + s] += (nEq * AIR_X[s] - g.gas[o + s]) * k;
    g.T[i] += (roomT - g.T[i]) * k;
    g.smoke[i] *= 1 - k;
    g.mist[i] *= 1 - k;
    g.fume[i] *= 1 - k;
    g.glow[i] *= 1 - k;
  };
  for (let c = 0; c < w; c += 1) edge((h - 1) * w + c);
  k = Math.min(1, dt * 12);
  for (let r = 0; r < h - 1; r += 1) { edge(r * w); edge(r * w + w - 1); }
  /* Die Welt ist eine Scheibe von ein paar Zentimetern Tiefe in einem grossen Zimmer: eine warme Fahne im Freien
     saugt auch von vorn und hinten Zimmerluft an (Mitreissen, α ≈ 0,1 ihrer Geschwindigkeit) — so kühlt die Luft über
     einer Flamme in wenigen Zentimetern ab, statt als heisse Säule bis an den Rand zu steigen. Nicht, wo es brennt
     (die Flamme selbst), und nicht im Inneren eines Glases (dort sind vorn und hinten Wände). */
  for (let i = w; i < g.n - w; i += 1) {
    if (air.region[i] !== 0 || g.own[i] !== 0 || g.burn[i] > 0.05) continue;
    const dT = g.T[i] - roomT;
    if (dT < 2) continue;
    const v = PLUME * Math.sqrt(2 * 981 * CELL * (dT / g.T[i]));
    k = Math.min(0.5, ((0.2 * v) / Math.max(1, g.D[i])) * dt);
    edge(i);
  }
}

/* -- Geschlossene Räume und Flüssigkeit ------------------------------------------------------------ */

/**
 * GAS DRÜCKT AUF WASSER: ein geschlossener Raum (Kolben mit Stopfen und
 * Rohr), dessen Druck den der Flüssigkeit an seinem Rand übersteigt (Zimmer
 * plus ρ·g·h bis zur freien Oberfläche), perlt in sie hinein — durch das
 * Rohr in die Kalkwasser. Was er zu viel hat, geht so hinaus.
 */
function bubbleThrough(g: Grid, air: Air, bodies: Bodies, roomP: number, dt: number, hooks: AirHooks): void {
  const { order } = air;
  const w = g.w;
  for (const r of air.regions) {
    if (r.open || r.V <= 0) continue;
    let best = -1;
    let bestP = Infinity;
    for (let k = r.start; k < r.end; k += 1) {
      const i = order[k];
      const b = i - w;
      if (b < 0 || g.lq[b] !== L.aq) continue;
      const p = bodies.pressureAt(b, roomP);
      if (p >= 0 && p < bestP) { bestP = p; best = i; }
    }
    if (best < 0 || r.P <= bestP + 0.02) continue;
    let vt = 0;
    for (let k = r.start; k < r.end; k += 1) { const i = order[k]; vt += air.gv[i] / g.T[i]; }
    const dn = Math.min(((r.P - bestP) * vt) / (1000 * R), r.n * 0.5, 0.004 * dt * 30);
    if (dn > 0) hooks.bubbleOut(best, best - w, dn);
  }
}

/**
 * EIN GLAS AUF DEM TISCH IST NICHT DICHT: ein geschlossener Raum, der unten
 * an den Tisch reicht (Słój über der Kerze), gleicht seinen Druck langsam
 * unter dem Rand hindurch mit dem Zimmer aus — durch die Wand neben ihm zur
 * nächsten Zelle des offenen Raums.
 */
function leakRims(g: Grid, air: Air, dt: number, roomT: number): void {
  const { order, region } = air;
  const w = g.w;
  const row = Math.ceil(-g.y0 / CELL);
  for (const r of air.regions) {
    if (r.open || r.V <= 0 || Math.abs(r.P - (air.regions[0]?.P ?? r.P)) < 0.3) continue;
    for (let k = r.start; k < r.end; k += 1) {
      const i = order[k];
      if (Math.floor(i / w) !== row) continue;
      const c = i % w;
      let out = -1;
      for (const d of [-1, 1]) {
        if (c + 2 * d < 0 || c + 2 * d >= w) continue;
        const wl = i + d;
        const o = i + 2 * d;
        if (g.wall(wl) && region[o] === 0) { out = o; break; }
      }
      if (out < 0) continue;
      const P0 = air.regions[0]?.P ?? r.P;
      let vt = 0;
      for (let q = r.start; q < r.end; q += 1) { const x = order[q]; vt += air.gv[x] / g.T[x]; }
      const dn = Math.min(Math.abs(r.P - P0) * vt / (1000 * R), 1e-2 * dt);
      if (r.P > P0) g.moveGas(i, out, dn); else g.moveGas(out, i, dn);
      void roomT;
      break;
    }
  }
}

/* -- Ein Schritt ------------------------------------------------------------------------------------ */

export function airStep(g: Grid, air: Air, bodies: Bodies, dt: number, roomT: number, roomP: number, up: boolean, hooks: AirHooks, rand: () => number = Math.random): void {
  air.measure(g);
  regionsOf(g, air, roomP);
  /* Gas, das keinen Platz mehr hat (die Zelle ist voll Flüssigkeit): nach oben oder als Blase. */
  for (let i = 0; i < g.n; i += 1) {
    if (air.region[i] >= 0) continue;
    if (g.gasTotal(i) <= 0) continue;
    const above = i + g.w;
    if (above < g.n && air.region[above] >= 0) g.moveGas(i, above, g.gasTotal(i));
    else if (g.lq[i] !== L.none) hooks.trapped(i);
    else if (g.wall(i)) g.gas.fill(0, i * NG, i * NG + NG);
  }
  bubbleThrough(g, air, bodies, roomP, dt, hooks);
  leakRims(g, air, dt, roomT);
  equalize(g, air, roomT);
  stir(g, air, dt, up, rand);
  freshen(g, air, dt, roomT, roomP);
}

/** Der Druck über einer Flüssigkeitszelle (kPa): der Raum über ihrer Säule. */
export function pressureAbove(g: Grid, air: Air, i: number, roomP: number): number {
  let j = i;
  for (let k = 0; k < 200 && j < g.n; k += 1) {
    const p = air.pressureOf(j);
    if (p > 0) return p;
    if (g.wall(j)) break;
    j += g.w;
  }
  return roomP;
}
