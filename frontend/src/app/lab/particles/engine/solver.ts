/**
 * PARTIKEL-LABOR — DER LÖSER IN KERNEN: jede Phase eines Teilschritts als
 * Kern über einen Bereich von Partikeln. Jede Partikel schreibt nur ihre
 * eigenen Felder und liest die ihrer Nachbarn aus der vorigen Phase (Jacobi):
 * das Ergebnis ist dasselbe, ob ein Faden alles rechnet oder acht je ein Stück
 * (`runner.ts`, `helper.worker.ts`), und in welcher Reihenfolge.
 *
 * Mechanik (ARCHITECTURE.md §6.2): Position Based Fluids (Macklin & Müller
 * 2013) in der Teilchenzahl-Form (Solenthaler & Pajarola 2008), nach Masse
 * gewichtet (Macklin et al. 2014) — der Auftrieb folgt aus Schwere und
 * Inkompressibilität, ohne eine Zeile „steig auf“:
 *
 * <code>
 *   C_i  = A_i·Σ_j W_ij + Σ_b V_b·W_ib − 1           (j beweglich, b fest oder ruhende Luft)
 *   λ_i  = min(0, −C_i / (w_i·|∇_i C_i|² + Σ_j w_j·|A_i ∇W_ij|² + ε))
 *   Δx_i = ω·w_i·[Σ_j (λ_i A_i + λ_j A_j)·∇W_ij + 2·λ_i·Σ_b V_b ∇W_ib]
 *   p_i  = p_Umgebung − ω·Σλ_i / (κ·A_i·D·dt²)          (κ: kernels.ts, pressureScale)
 * </code>
 *
 * Drei Entscheidungen, jede gemessen (SIMPLIFICATIONS.md #6, #7):
 *
 * - Kleine Schritte: acht Teilschritte mit je einer Iteration statt eines
 *   Schritts mit vier. Der Dichtefehler einer Säule wächst mit
 *   g·H·dt²/(s²·Iterationen) — mit kleinen Schritten fällt er quadratisch.
 * - Der Kern der Dichte ist spiky, und sein eigener Gradient trägt die
 *   Korrektur: nur dann sind die Korrekturen konservativ (mit poly6-Dichte
 *   und spiky-Gradient kocht eine ruhende Kiste nach einem Anstoss), und
 *   anders als poly6 hat spiky am Ursprung einen Gradienten (keine Paare).
 * - ω = 0,5: Jacobi summiert die Korrekturen aller Bedingungen einer
 *   Partikel und schiesst sonst über.
 *
 * Eine feste Partikel hat keine eigene Bedingung; damit sie so hart drückt
 * wie eine Partikel des Fluids mit demselben Druck, zählt ihr Beitrag doppelt
 * (Druckspiegelung, wie bei Band et al. 2018) — sonst drückt eine Säule die
 * unterste Reihe durch die Wand.
 *
 * In jedem Teilschritt, in der Schleife der Korrektur und mit den
 * Geschwindigkeiten vom Anfang des Teilschritts: die XSPH-Viskosität (sie hält
 * die Unruhe der Iterationen klein), die Kohäsion zwischen gleichen
 * Flüssigkeiten und die Adhäsion an festen Stoffen (Akinci et al. 2013). Einmal
 * je Schritt aufgebracht, stossen Kohäsion und Adhäsion an den Randlinien
 * (Wasser, Glas, Luft) eine Schwingung an — je Teilschritt nicht.
 */

import { MAX_NBR } from './grid';
import type { Grid } from './grid';
import type { Attached } from './mem';
import { SPECIES, SPECIES_COUNT } from './species';
import type { Store } from './store';
import { LIQUID } from './units';

/* -- Die Felder -------------------------------------------------------------------------------------------- */

export interface Views {
  readonly x: Float64Array; readonly y: Float64Array;
  readonly px: Float64Array; readonly py: Float64Array;
  readonly qx: Float64Array; readonly qy: Float64Array;
  readonly ox: Float64Array; readonly oy: Float64Array;
  readonly vx: Float64Array; readonly vy: Float64Array;
  readonly phase: Uint8Array; readonly fixed: Uint8Array; readonly alive: Uint8Array; readonly dom: Uint8Array; readonly edge: Uint8Array;
  readonly area: Float64Array; readonly wInv: Float64Array; readonly lambda: Float64Array; readonly lamSum: Float64Array;
  readonly dens: Float64Array; readonly p: Float64Array; readonly pres: Float64Array;
  readonly dvx: Float64Array; readonly dvy: Float64Array; readonly vgx: Float64Array; readonly vgy: Float64Array; readonly vgw: Float64Array;
  readonly nbr: Uint16Array;
  readonly cellOf: Int32Array; readonly sorted: Int32Array; readonly moving: Int32Array; readonly cellStart: Int32Array; readonly nbrList: Int32Array;
  readonly pgx: Float32Array; readonly pgy: Float32Array; readonly pw: Float32Array;
  readonly nbrCount: Uint8Array; readonly cellAir: Uint8Array; readonly siteFree: Uint8Array;
}

export function viewsOf(st: Store, g: Grid): Views {
  return {
    x: st.x, y: st.y, px: st.px, py: st.py, qx: st.qx, qy: st.qy, ox: st.ox, oy: st.oy, vx: st.vx, vy: st.vy,
    phase: st.phase, fixed: st.fixed, alive: st.alive, dom: st.dom, edge: st.edge,
    area: st.area, wInv: st.wInv, lambda: st.lambda, lamSum: st.lamSum, dens: st.dens, p: st.p, pres: st.pres,
    dvx: st.dvx, dvy: st.dvy, vgx: st.vgx, vgy: st.vgy, vgw: st.vgw, nbr: st.nbr,
    cellOf: g.cellOf, sorted: g.sorted, moving: g.moving, cellStart: g.cellStart, nbrList: g.nbrList, pgx: g.pgx, pgy: g.pgy, pw: g.pw,
    nbrCount: g.nbrCount, cellAir: g.cellAir, siteFree: g.siteFree
  };
}

/** Dieselben Sichten in einem Helfer (aus den Blöcken des Rechners). */
export function attachedViews(a: Attached): Views {
  return {
    x: a.f64('x'), y: a.f64('y'), px: a.f64('px'), py: a.f64('py'), qx: a.f64('qx'), qy: a.f64('qy'),
    ox: a.f64('ox'), oy: a.f64('oy'), vx: a.f64('vx'), vy: a.f64('vy'),
    phase: a.u8('phase'), fixed: a.u8('fixed'), alive: a.u8('alive'), dom: a.u8('dom'), edge: a.u8('edge'),
    area: a.f64('area'), wInv: a.f64('wInv'), lambda: a.f64('lambda'), lamSum: a.f64('lamSum'), dens: a.f64('dens'), p: a.f64('p'), pres: a.f64('pres'),
    dvx: a.f64('dvx'), dvy: a.f64('dvy'), vgx: a.f64('vgx'), vgy: a.f64('vgy'), vgw: a.f64('vgw'), nbr: a.u16('nbr'),
    cellOf: a.i32('cellOf'), sorted: a.i32('sorted'), moving: a.i32('moving'), cellStart: a.i32('cellStart'), nbrList: a.i32('nbrList'), pgx: a.f32('pgx'), pgy: a.f32('pgy'), pw: a.f32('pw'),
    nbrCount: a.u8('nbrCount'), cellAir: a.u8('cellAir'), siteFree: a.u8('siteFree')
  };
}

/* -- Die Zahlen eines Schritts (ein Float64Array, gemeinsam mit den Helfern) ---------------------------------- */

export const P_DT = 0;
export const P_H = 1;
export const P_H2 = 2;
export const P_KS = 3;
export const P_KD = 4;
export const P_W0 = 5;
export const P_GX = 6;
export const P_GY = 7;
export const P_EPS = 8;
export const P_S = 9;
export const P_A0 = 10;
export const P_X0 = 11;
export const P_Y0 = 12;
export const P_GNX = 13;
export const P_GNY = 14;
export const P_SNX = 15;
export const P_VMAX = 16;
export const P_DEPTH = 17;
export const P_PAMB = 18;
export const P_PALPHA = 19;
export const P_FIRST = 20;
export const P_N = 21;
export const P_TOP = 22;
export const P_SRC = 23;
export const P_FIN = 24;
export const P_XSPH_L = 25;
export const P_XSPH_G = 26;
export const P_XSPH_W = 27;
export const P_OMEGA = 28;
export const P_NEXT = 29;
/** 1/κ: der Druck aus den Multiplikatoren, auf den wahren gebracht (kernels.ts, `pressureScale`). */
export const P_PSCALE = 30;
/** 1: die Korrektur rechnet auch die XSPH-Glättung (erste Iteration eines Teilschritts). */
export const P_SMOOTH = 31;
export const PARAMS = 40;

/* -- Die Aufgaben ------------------------------------------------------------------------------------------- */

export const JOB_PREDICT = 1;
export const JOB_SEARCH = 2;
export const JOB_LAMBDA = 3;
export const JOB_DELTA = 4;
export const JOB_ENDSUB = 5;

/** Wie viele Einheiten eine Aufgabe teilt: Plätze des Speichers (Vorhersage) oder bewegliche Partikeln (`moving`, P_N). */
export const jobLength = (job: number, P: Float64Array): number => (job === JOB_PREDICT ? P[P_TOP] : P[P_N]);

export function runJob(job: number, V: Views, P: Float64Array, from: number, to: number): void {
  switch (job) {
    case JOB_PREDICT: predict(V, P, from, to); break;
    case JOB_SEARCH: search(V, P, from, to); break;
    case JOB_LAMBDA: lambda(V, P, from, to); break;
    case JOB_DELTA: delta(V, P, from, to); break;
    case JOB_ENDSUB: endSub(V, P, from, to); break;
    default: break;
  }
}

/* -- Stoffzahlen der Kräfte (aus der Datenbank, in jedem Faden gleich berechnet) ------------------------------ */

/** Form des Kohäsionskerns (Akinci et al. 2013), ohne Normierung (m⁶); kurz abstossend, dann anziehend. */
export function cohesionShape(r: number, h: number): number {
  if (r >= h || r <= 0) return 0;
  const a = (h - r) * (h - r) * (h - r) * r * r * r;
  return 2 * r > h ? a : 2 * a - (h * h * h * h * h * h) / 64;
}

/** Form des Adhäsionskerns (Akinci et al. 2013), ohne Normierung; nur zwischen h/2 und h. */
export function adhesionShape(r: number, h: number): number {
  if (r >= h || 2 * r <= h) return 0;
  return Math.pow(Math.max(0, (-4 * r * r) / h + 6 * r - 2 * h), 0.25);
}

/** ∫₀ʰ f(r)·r³ dr (Simpson) — aus ihm folgen die Beiwerte aus Oberflächenspannung und Randwinkel. */
export function moment3(f: (r: number, h: number) => number, h: number): number {
  const n = 2000;
  const d = h / n;
  let sum = 0;
  for (let k = 0; k <= n; k += 1) {
    const r = k * d;
    const w = k === 0 || k === n ? 1 : k % 2 === 1 ? 4 : 2;
    sum += w * f(r, h) * r * r * r;
  }
  return (sum * d) / 3;
}

/** Oberflächenspannung je Stoff (N/m, 0: keine) und Randwinkel je Werkstoff (rad, −1: keiner). */
export const SIGMA = Float64Array.from(SPECIES, (s) => s.surfaceTension?.v ?? 0);
export const CONTACT = Float64Array.from(SPECIES, (s) => (s.surface !== undefined ? (s.surface.contactAngle.v * Math.PI) / 180 : -1));

/* -- Kerne --------------------------------------------------------------------------------------------------- */

/** Die Zelle eines Punktes (am Rand festgehalten), wie `Grid.cellIndex`. */
function cellAt(x: number, y: number, x0: number, y0: number, inv: number, gnx: number, gny: number): number {
  let cx = Math.floor((x - x0) * inv);
  let cy = Math.floor((y - y0) * inv);
  if (cx < 0) cx = 0; else if (cx >= gnx) cx = gnx - 1;
  if (cy < 0) cy = 0; else if (cy >= gny) cy = gny - 1;
  return cy * gnx + cx;
}

/** Schwere → Geschwindigkeit, Orte vorhersagen (feste Partikeln bleiben, in beiden Puffern), und die Zelle jeder Partikel. Nur im ersten Teilschritt eines Schritts; die weiteren sagt `endSub` vorher. */
function predict(V: Views, P: Float64Array, from: number, to: number): void {
  const dt = P[P_DT];
  const gx = P[P_GX] * dt;
  const gy = P[P_GY] * dt;
  const first = P[P_FIRST] === 1;
  const x0 = P[P_X0];
  const y0 = P[P_Y0];
  const inv = 1 / (2 * P[P_S]);
  const gnx = P[P_GNX];
  const gny = P[P_GNY];
  const { x, y, px, py, qx, qy, ox, oy, vx, vy, alive, fixed, cellOf } = V;
  for (let i = from; i < to; i += 1) {
    if (alive[i] === 0) continue;
    if (first) { ox[i] = x[i]; oy[i] = y[i]; }
    if (fixed[i] === 1) {
      px[i] = x[i]; py[i] = y[i]; qx[i] = x[i]; qy[i] = y[i];
    } else {
      vx[i] += gx;
      vy[i] += gy;
      px[i] = x[i] + vx[i] * dt;
      py[i] = y[i] + vy[i] * dt;
    }
    cellOf[i] = cellAt(px[i], py[i], x0, y0, inv, gnx, gny);
  }
}

/**
 * Nachbarn suchen und zugleich die erste Iteration: je Nachbar im Radius h der
 * Gradient ∇W_ij (gemerkt für `delta`, das ihn nur noch gewichtet), die
 * Dichte, ihr Gradient, der Nenner und λ.
 */
function search(V: Views, P: Float64Array, from: number, to: number): void {
  const h = P[P_H];
  const h2 = P[P_H2];
  const ks = P[P_KS];
  const kd = P[P_KD];
  const w0 = P[P_W0];
  const eps = P[P_EPS];
  const A0 = P[P_A0];
  const gnx = P[P_GNX];
  const gny = P[P_GNY];
  const { px, py, fixed, cellOf, cellStart, sorted, moving, nbrList, pgx, pgy, pw, nbrCount, nbr, edge, cellAir, area, wInv, lambda: lam, lamSum, dens, vgx, vgy, vgw } = V;
  for (let s = from; s < to; s += 1) {
    const i = moving[s];
    const xi = px[i];
    const yi = py[i];
    const Ai = area[i];
    const c = cellOf[i];
    const cx = c % gnx;
    const cy = (c - cx) / gnx;
    const base = i * MAX_NBR;
    let count = 0;
    let touches = 0;
    let sum = Ai * w0;
    let gxs = 0;
    let gys = 0;
    let den = 0;
    const ya = cy > 0 ? cy - 1 : 0;
    const yb = cy < gny - 1 ? cy + 1 : gny - 1;
    const xa = cx > 0 ? cx - 1 : 0;
    const xb = cx < gnx - 1 ? cx + 1 : gnx - 1;
    for (let gy = ya; gy <= yb; gy += 1) {
      for (let gx = xa; gx <= xb; gx += 1) {
        const g = gy * gnx + gx;
        if (cellAir[g] === 1) touches = 1;
        const end = cellStart[g + 1];
        for (let k = cellStart[g]; k < end; k += 1) {
          const j = sorted[k];
          if (j === i) continue;
          const rx = xi - px[j];
          const ry = yi - py[j];
          const r2 = rx * rx + ry * ry;
          if (r2 >= h2 || count >= MAX_NBR) continue;
          const r = Math.sqrt(r2);
          const e = h - r;
          const w = kd * e * e * e;
          const f = r > 1e-12 ? (-ks * e * e) / r : 0;
          const gxp = f * rx;
          const gyp = f * ry;
          nbrList[base + count] = j;
          pgx[base + count] = gxp;
          pgy[base + count] = gyp;
          pw[base + count] = w;
          count += 1;
          if (fixed[j] === 1) {
            const Vb = area[j];
            sum += Vb * w;
            gxs += Vb * gxp;
            gys += Vb * gyp;
          } else {
            sum += Ai * w;
            gxs += Ai * gxp;
            gys += Ai * gyp;
            den += wInv[j] * Ai * Ai * (gxp * gxp + gyp * gyp);
          }
        }
      }
    }
    nbrCount[i] = count;
    nbr[i] = count;
    edge[i] = touches;
    let vx = 0;
    let vy = 0;
    let vw = 0;
    if (touches === 1) {
      /* Ruhende Umgebungsluft der Nachbarzellen: ihre freien Plätze zählen wie feste Partikeln der Fläche A0. */
      virtualSums(V, P, xi, yi);
      vw = VS[0];
      sum += A0 * vw;
      vx = VS[1];
      vy = VS[2];
      gxs += A0 * vx;
      gys += A0 * vy;
    }
    vgx[i] = vx;
    vgy[i] = vy;
    vgw[i] = vw;
    dens[i] = sum;
    const wi = wInv[i];
    const l = Math.min(0, -(sum - 1) / (wi * (gxs * gxs + gys * gys) + den + eps * wi));
    lam[i] = l;
    lamSum[i] = l;
  }
}

/** Weitere Iterationen (nur mit mehr als einer je Teilschritt): λ neu aus dem Puffer P_SRC, mit den Nachbarn der Suche. */
function lambda(V: Views, P: Float64Array, from: number, to: number): void {
  const h = P[P_H];
  const h2 = P[P_H2];
  const ks = P[P_KS];
  const kd = P[P_KD];
  const w0 = P[P_W0];
  const eps = P[P_EPS];
  const A0 = P[P_A0];
  const src = P[P_SRC];
  const X = src === 0 ? V.px : V.qx;
  const Y = src === 0 ? V.py : V.qy;
  const { fixed, moving, nbrList, pgx, pgy, nbrCount, area, wInv, lambda: lam, lamSum, dens, edge, vgx, vgy } = V;
  for (let s = from; s < to; s += 1) {
    const i = moving[s];
    const Ai = area[i];
    const xi = X[i];
    const yi = Y[i];
    let sum = Ai * w0;
    let gxs = 0;
    let gys = 0;
    let den = 0;
    const base = i * MAX_NBR;
    const cnt = nbrCount[i];
    for (let q = 0; q < cnt; q += 1) {
      const j = nbrList[base + q];
      const rx = xi - X[j];
      const ry = yi - Y[j];
      const r2 = rx * rx + ry * ry;
      let gxp = 0;
      let gyp = 0;
      if (r2 < h2) {
        const r = Math.sqrt(r2);
        const e = h - r;
        const f = r > 1e-12 ? (-ks * e * e) / r : 0;
        gxp = f * rx;
        gyp = f * ry;
        const w = kd * e * e * e;
        if (fixed[j] === 1) {
          sum += area[j] * w;
          gxs += area[j] * gxp;
          gys += area[j] * gyp;
        } else {
          sum += Ai * w;
          gxs += Ai * gxp;
          gys += Ai * gyp;
          den += wInv[j] * Ai * Ai * (gxp * gxp + gyp * gyp);
        }
      }
      pgx[base + q] = gxp;
      pgy[base + q] = gyp;
    }
    if (edge[i] === 1) {
      virtualSums(V, P, xi, yi);
      sum += A0 * VS[0];
      vgx[i] = VS[1];
      vgy[i] = VS[2];
      gxs += A0 * VS[1];
      gys += A0 * VS[2];
    }
    dens[i] = sum;
    const wi = wInv[i];
    const l = Math.min(0, -(sum - 1) / (wi * (gxs * gxs + gys * gys) + den + eps * wi));
    lam[i] = l;
    lamSum[i] += l;
  }
}

/**
 * Die Korrektur je beweglicher Partikel mit den gemerkten Gradienten, aus
 * P_SRC in den anderen Puffer — und in derselben Schleife (erste Iteration)
 * die Änderung der Geschwindigkeit in `dvx, dvy` (angewandt in `endSub`):
 * XSPH, nach Masse gewichtet (2·m_j/(m_i + m_j) = 2·w_i/(w_i + w_j), der Impuls
 * bleibt), Kohäsion und Adhäsion der Flüssigkeiten.
 */
function delta(V: Views, P: Float64Array, from: number, to: number): void {
  const A0 = P[P_A0];
  const omega = P[P_OMEGA];
  const xl = P[P_XSPH_L];
  const xg = P[P_XSPH_G];
  const xw = P[P_XSPH_W];
  const smooth = P[P_SMOOTH] === 1;
  const h = P[P_H];
  const dt = P[P_DT];
  const src = P[P_SRC];
  const X = src === 0 ? V.px : V.qx;
  const Y = src === 0 ? V.py : V.qy;
  const OX = src === 0 ? V.qx : V.px;
  const OY = src === 0 ? V.qy : V.py;
  const { fixed, phase, dom, dens, moving, nbrList, pgx, pgy, pw, nbrCount, area, wInv, lambda: lam, edge, vgx, vgy, vgw, vx, vy, dvx, dvy } = V;
  for (let s = from; s < to; s += 1) {
    const i = moving[s];
    const li = lam[i];
    const la = li * area[i];
    const wi = wInv[i];
    const vxi = vx[i];
    const vyi = vy[i];
    const liquid = phase[i] === LIQUID;
    const di = dom[i];
    const gamma = smooth && liquid ? COH_GAMMA[di] : 0;
    const surface = smooth && liquid;
    const xi = X[i];
    const yi = Y[i];
    let dx = 0;
    let dy = 0;
    let sx = 0;
    let sy = 0;
    let ax = 0;
    let ay = 0;
    const base = i * MAX_NBR;
    const cnt = nbrCount[i];
    for (let q = 0; q < cnt; q += 1) {
      const j = nbrList[base + q];
      if (fixed[j] === 1) {
        const c = 2 * li * area[j];
        dx += c * pgx[base + q];
        dy += c * pgy[base + q];
        const w = xw * A0 * pw[base + q];
        sx -= w * vxi;
        sy -= w * vyi;
        if (surface) {
          /* Haften am Werkstoff (Randwinkel). */
          const beta = ADH_BETA[di * SPECIES_COUNT + dom[j]];
          if (beta > 0) {
            const rx = xi - X[j];
            const ry = yi - Y[j];
            const r = Math.sqrt(rx * rx + ry * ry);
            if (r > 1e-12) {
              const a = (beta * adhesionShape(r, h)) / r;
              ax -= a * rx;
              ay -= a * ry;
            }
          }
        }
      } else {
        const c = la + lam[j] * area[j];
        dx += c * pgx[base + q];
        dy += c * pgy[base + q];
        const wj = wInv[j];
        const pj = phase[j];
        const w = (liquid && pj === LIQUID ? xl : xg) * ((2 * wi) / (wi + wj)) * A0 * pw[base + q];
        sx += w * (vx[j] - vxi);
        sy += w * (vy[j] - vyi);
        if (gamma > 0 && pj === LIQUID && dom[j] === di) {
          /* Kohäsion: K_ij = 2/(ρ_i/ρ0 + ρ_j/ρ0) verstärkt sie, wo Nachbarn fehlen (an der Oberfläche). */
          const rx = xi - X[j];
          const ry = yi - Y[j];
          const r = Math.sqrt(rx * rx + ry * ry);
          if (r > 1e-12) {
            const a = (gamma * (2 / (dens[i] + dens[j])) * (1 / wj) * cohesionShape(r, h)) / r;
            ax -= a * rx;
            ay -= a * ry;
          }
        }
      }
    }
    if (edge[i] === 1) {
      dx += 2 * li * A0 * vgx[i];
      dy += 2 * li * A0 * vgy[i];
      /* Die Umgebungsluft ohne Partikeln ruht: die Glättung zieht zu ihr hin wie zu einer Wand. */
      const w = xg * A0 * vgw[i];
      sx -= w * vxi;
      sy -= w * vyi;
    }
    const k = omega * wi;
    OX[i] = xi + k * dx;
    OY[i] = yi + k * dy;
    if (smooth) { dvx[i] = sx + ax * dt; dvy[i] = sy + ay * dt; }
  }
}

/** Ende eines Teilschritts: Geschwindigkeit aus den Orten (Puffer P_FIN), Ort übernehmen, Druck; ist noch einer übrig, gleich vorhersagen. */
function endSub(V: Views, P: Float64Array, from: number, to: number): void {
  const dt = P[P_DT];
  const inv = 1 / dt;
  const depth = P[P_DEPTH];
  const pamb = P[P_PAMB];
  const alpha = P[P_PALPHA];
  const omega = P[P_OMEGA];
  const next = P[P_NEXT] === 1;
  const vmax = P[P_VMAX];
  const vmax2 = vmax * vmax;
  const gx = P[P_GX] * dt;
  const gy = P[P_GY] * dt;
  const fin = P[P_FIN];
  const X = fin === 0 ? V.px : V.qx;
  const Y = fin === 0 ? V.py : V.qy;
  const { x, y, px, py, vx, vy, moving, lamSum, area, p, pres, dvx, dvy, cellOf } = V;
  const pk = (omega * P[P_PSCALE]) / (depth * dt * dt);
  const x0 = P[P_X0];
  const y0 = P[P_Y0];
  const cinv = 1 / (2 * P[P_S]);
  const gnx = P[P_GNX];
  const gny = P[P_GNY];
  for (let s = from; s < to; s += 1) {
    const i = moving[s];
    const nx = X[i];
    const ny = Y[i];
    let ux = (nx - x[i]) * inv + dvx[i];
    let uy = (ny - y[i]) * inv + dvy[i];
    const u2 = ux * ux + uy * uy;
    if (u2 > vmax2) { const f = vmax / Math.sqrt(u2); ux *= f; uy *= f; }
    x[i] = nx;
    y[i] = ny;
    const gauge = (-lamSum[i] * pk) / area[i];
    pres[i] = gauge;
    p[i] += alpha * (pamb + gauge - p[i]);
    if (next) {
      ux += gx;
      uy += gy;
      const qx = nx + ux * dt;
      const qy = ny + uy * dt;
      px[i] = qx;
      py[i] = qy;
      cellOf[i] = cellAt(qx, qy, x0, y0, cinv, gnx, gny);
    }
    vx[i] = ux;
    vy[i] = uy;
  }
}

/* -- Ruhende Umgebungsluft (Plätze der Zellen ohne Partikeln) ------------------------------------------------ */

/** Ergebnis von `virtualSums`: Σ W und Σ ∇W (x, y) über die Plätze — je Faden ein Puffer. */
const VS = new Float64Array(3);

function virtualSums(V: Views, P: Float64Array, xi: number, yi: number): void {
  const h = P[P_H];
  const h2 = P[P_H2];
  const ks = P[P_KS];
  const kd = P[P_KD];
  const s = P[P_S];
  const x0 = P[P_X0];
  const y0 = P[P_Y0];
  const gnx = P[P_GNX];
  const gny = P[P_GNY];
  const snx = P[P_SNX];
  const cell = 2 * s;
  const { cellAir, siteFree } = V;
  let sw = 0;
  let gx = 0;
  let gy = 0;
  let cx0 = Math.floor((xi - x0) / cell) - 1;
  let cy0 = Math.floor((yi - y0) / cell) - 1;
  let cx1 = cx0 + 2;
  let cy1 = cy0 + 2;
  if (cx0 < 0) cx0 = 0;
  if (cy0 < 0) cy0 = 0;
  if (cx1 > gnx - 1) cx1 = gnx - 1;
  if (cy1 > gny - 1) cy1 = gny - 1;
  for (let cy = cy0; cy <= cy1; cy += 1) {
    for (let cx = cx0; cx <= cx1; cx += 1) {
      if (cellAir[cy * gnx + cx] !== 1) continue;
      for (let b = 2 * cy; b < 2 * cy + 2; b += 1) {
        for (let a = 2 * cx; a < 2 * cx + 2; a += 1) {
          if (siteFree[b * snx + a] !== 1) continue;
          const rx = xi - (x0 + (a + 0.5) * s);
          const ry = yi - (y0 + (b + 0.5) * s);
          const r2 = rx * rx + ry * ry;
          if (r2 >= h2) continue;
          const r = Math.sqrt(r2);
          const e = h - r;
          sw += kd * e * e * e;
          if (r > 1e-12) {
            const f = (-ks * e * e) / r;
            gx += f * rx;
            gy += f * ry;
          }
        }
      }
    }
  }
  VS[0] = sw;
  VS[1] = gx;
  VS[2] = gy;
}

/* -- Beiwerte von Kohäsion und Adhäsion ------------------------------------------------------------------------- */

/** γ je flüssigem Stoff und β·Ψ_b je Paar (Flüssigkeit, Werkstoff) — gesetzt von `setSurfaceModel` (Auflösung, Tiefe, Dichte). */
const COH_GAMMA = new Float64Array(SPECIES_COUNT);
const ADH_BETA = new Float64Array(SPECIES_COUNT * SPECIES_COUNT);

/**
 * Kohäsion aus der Oberflächenspannung: für eine Paarkraft F = γ·m_i·m_j·C(r)
 * ist die Linienspannung einer ebenen Grenze in der Scheibe
 * λ = γ·(ρ·D)²/3·∫C(r)r³dr, also σ = λ/D und γ = 3σ/(ρ²·D·∫C r³ dr) — mal
 * einem Eichfaktor (`cal`), den die Laplace-Prüfung festlegt. Adhäsion:
 * Young–Dupré, W_a/W_c = (1 + cos θ)/2, mit demselben Ansatz für den
 * Adhäsionskern; in der Tabelle steht β schon mal Ψ_b = ρ0·V_b (die „Masse“
 * einer Partikel der Wand, Akinci et al. 2013).
 */
export function setSurfaceModel(h: number, depth: number, rhoOf: (sp: number) => number, wallArea: number, cal: number): void {
  const ic = moment3(cohesionShape, h);
  const ia = moment3(adhesionShape, h);
  COH_GAMMA.fill(0);
  ADH_BETA.fill(0);
  for (let sp = 0; sp < SPECIES_COUNT; sp += 1) {
    const sigma = SIGMA[sp];
    if (!(sigma > 0)) continue;
    const rho = rhoOf(sp);
    const gamma = (cal * 3 * sigma) / (rho * rho * depth * ic);
    COH_GAMMA[sp] = gamma;
    const psi = rho * wallArea * depth;
    for (let m = 0; m < SPECIES_COUNT; m += 1) {
      const theta = CONTACT[m];
      if (theta < 0) continue;
      ADH_BETA[sp * SPECIES_COUNT + m] = ((gamma * ((1 + Math.cos(theta)) / 2) * ic) / ia) * psi;
    }
  }
}
