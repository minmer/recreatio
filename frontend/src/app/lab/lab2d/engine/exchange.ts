/**
 * LABOR 2D (v2) — AUSTAUSCH UNTER DEN TEILCHEN (M2b): Teilchen derselben
 * Zelle tauschen Wärme und gelöstes Salz, wie Wasser es tut — so schnell, wie
 * die molekulare Diffusion es über die Zelle erlaubt; Salz wandert dazu durch
 * Diffusion von Zelle zu Zelle.
 *
 * Die Wärmeleitung auf dem Gitter verbindet die Zellen über ihre Mittelwerte;
 * was innerhalb einer Zelle zwischen ihren Teilchen ungleich ist (ein heisses
 * neben einem kalten, Sole neben Süsswasser — die Strömung bringt sie
 * zusammen), glich bis dahin nichts aus. Jetzt nähert sich jedes Teilchen dem
 * Mittel seiner Zelle (das IEM-Modell, „interaction by exchange with the
 * mean“, der Lagrangeschen PDF-Verfahren):
 *
 *   φ_p ← φ_p + f (φ̄ − φ_p),  f = 1 − exp(−Δt/τ),  τ = Δx²/(π² κ),
 *
 * τ die Abklingzeit der langsamsten Struktur, die in eine Zelle passt (eine
 * halbe Welle über sie): in ruhender Flüssigkeit gleicht sich nichts in der
 * Zelle schneller aus. Für Wärme ist κ = α = k/(ρ c_p) der Flüssigkeiten der
 * Zelle (Wasser bei 20 °C: τ = 2,8 s bei 2 mm, 0,7 s bei 1 mm), für Salz der
 * Diffusionskoeffizient D (Nernst–Hartley, nach Stokes–Einstein mit der
 * Temperatur: 4,8 min bei 2 mm und 20 °C, 1,1 min bei 100 °C) — Salz
 * diffundiert hundertmal langsamer als Wärme. Salz gleicht sich je kg Wasser
 * an (das Wasser bleibt, wo es ist; nur das Salz wandert).
 *
 * Strömt die Flüssigkeit, mischt sie schneller: die Dehnung λ der Strömung
 * (der grösste Eigenwert des Verzerrungstensors der Zelle) zieht jede
 * Struktur in der Zelle zu Streifen aus, die exponentiell dünner werden,
 * s(t) = Δx e^(−λt) — und über einen dünnen Streifen diffundiert es schnell
 * (Rühren und Mischen: Ranz 1979; Villermaux 2019). Ausgeglichen ist, wenn die
 * Zeit bis jetzt so lang ist wie die Diffusion über den Streifen,
 * t = τ e^(−2λt): t = W(2λτ)/(2λ) mit der Lambertschen W-Funktion. In ruhender
 * Flüssigkeit (λ → 0) ist das τ, bei kräftigem Rühren etwa ln(2λτ)/(2λ):
 * Salz in einer Zelle, deren Wasser mit λ = 1/s strömt, ist in 2,4 s gemischt
 * statt in 4,8 min. Dehnungen unter STIR_FLOOR (das Rauschen einer ruhenden
 * Flüssigkeit, Test 1: Strömungen unter 0,01 mm/s) zählen nicht. Die Wärme
 * bleibt beim Gleichgewicht der ruhenden Zelle (2,8 s): schneller geteilt,
 * trüge sie die Wärme einer heissen Wand über die überlappenden Wärmegewichte
 * der Teilchen (heat.ts) in die Nachbarzellen — das Wasser vor Siedesteinen
 * bliebe zu kalt, und das Glas siedete zuerst (Test 12).
 *
 * Zwischen den Zellen leitet das Gitter die Wärme (heat.ts); für das Salz
 * gilt hier das Ficksche Gesetz, explizit: über jede Fläche zweier
 * Nachbarzellen fliesst D Δt/Δx² · min(W_i, W_j) · (b_i − b_j), b = Salz je kg
 * Wasser, W das Wasser der Zelle (eine halb gefüllte Zelle hat eine halbe
 * Fläche). D Δt/Δx² ist um 10⁻⁵: stabil mit grossem Abstand.
 *
 * Getauscht wird in den Zellen der Flüssigkeit und in den Gaszellen, die an
 * eine grenzen (die Oberfläche); Tropfen allein in der Luft tauschen nichts.
 * Der Austausch in einer Zelle ändert ihre Energie und ihr Salz nicht; Salz
 * wechselt mit seiner partiellen Enthalpie h̄_s: in der Zelle geben die
 * Spender ihre eigene ab und die Empfänger bekommen das Mittel des
 * Abgegebenen, zwischen den Zellen trägt es h̄_s der abgebenden Zelle — die
 * Energie schliesst genau.
 */

import type { Engine } from './engine';
import type { Grid } from './grid';
import { kLiq, WATER } from './materials';
import { hSaltIn, NACL, saltDiffusivity } from './solution';
import { GAS, LIQUID } from './units';

/** Dehnung der Strömung, ab der sie als Rühren zählt (1/s): darunter liegt das Rauschen einer ruhenden Flüssigkeit. */
export const STIR_FLOOR = 0.02;

/** Die Lambertsche W-Funktion (Hauptzweig) für x ≥ 0: w e^w = x — Halley ab einer Näherung, vier Schritte. */
export function lambertW(x: number): number {
  if (!(x > 1e-8)) return x > 0 ? x : 0;
  const l = Math.log(1 + x);
  let w = x < 1 ? x * (1 - x / (1 + x)) : l * (1 - Math.log(1 + l) / (2 + l));
  for (let k = 0; k < 4; k += 1) {
    const ew = Math.exp(w);
    const f = w * ew - x;
    w -= f / (ew * (w + 1) - ((w + 2) * f) / (2 * w + 2));
  }
  return w;
}

/**
 * Um wie viel schneller sich eine Zelle mischt, deren Strömung mit λ dehnt, als
 * ruhend (τ die Zeit der Diffusion über die Zelle): τ/t mit t = W(2λτ)/(2λ) —
 * also x/W(x) mit x = 2λτ; 1 ohne Dehnung.
 */
export function stirFactor(lambda: number, tau: number): number {
  const x = 2 * Math.max(0, lambda - STIR_FLOOR) * tau;
  return x > 1e-8 ? x / lambertW(x) : 1;
}

/** Die Dehnung λ der Flüssigkeit in Zelle (i, j): der positive Eigenwert des spurfreien Verzerrungstensors aus den Flächengeschwindigkeiten (1/s). */
export function strainAt(g: Grid, i: number, j: number): number {
  const { nx, ny, dx, ul, vl } = g;
  const nu = nx + 1;
  const uc = (a: number, b: number): number => 0.5 * (ul[a + b * nu] + ul[a + 1 + b * nu]);
  const vc = (a: number, b: number): number => 0.5 * (vl[a + b * nx] + vl[a + (b + 1) * nx]);
  const dudx = (ul[i + 1 + j * nu] - ul[i + j * nu]) / dx;
  const dvdy = (vl[i + (j + 1) * nx] - vl[i + j * nx]) / dx;
  const jm = Math.max(0, j - 1);
  const jp = Math.min(ny - 1, j + 1);
  const im = Math.max(0, i - 1);
  const ip = Math.min(nx - 1, i + 1);
  const dudy = jp > jm ? (uc(i, jp) - uc(i, jm)) / ((jp - jm) * dx) : 0;
  const dvdx = ip > im ? (vc(ip, j) - vc(im, j)) / ((ip - im) * dx) : 0;
  return Math.hypot(0.5 * (dudx - dvdy), 0.5 * (dudy + dvdx));
}

export class Exchange {
  private readonly e: Engine;
  /* Je Zelle: Σ m c_p, Σ m c_p T, Σ m c_p α (alle Flüssigkeiten); Σ s und Σ m_w (Wasser ohne Salz) der Wasserteilchen;
     die Anteile f für Wärme und Salz in diesem Schritt (fH = 0: die Zelle tauscht nicht); Salz und Enthalpie, die die
     Spender in der Zelle abgeben; Salz und Enthalpie, die die Zelle von ihren Nachbarn bekommt. */
  readonly cap: Float64Array;
  readonly capT: Float64Array;
  private readonly capA: Float64Array;
  readonly salt: Float64Array;
  readonly water: Float64Array;
  private readonly fH: Float64Array;
  private readonly fS: Float64Array;
  private readonly outS: Float64Array;
  private readonly outH: Float64Array;
  private readonly inS: Float64Array;
  private readonly inH: Float64Array;
  /* Je Teilchen: seine Zelle, c_p, Salzänderung in der Zelle, partielle Enthalpie des abgegebenen Salzes. */
  private cell = new Int32Array(0);
  private cpp = new Float64Array(0);
  private ds = new Float64Array(0);
  private hs = new Float64Array(0);

  constructor(engine: Engine) {
    this.e = engine;
    const n = engine.grid.n;
    this.cap = new Float64Array(n);
    this.capT = new Float64Array(n);
    this.capA = new Float64Array(n);
    this.salt = new Float64Array(n);
    this.water = new Float64Array(n);
    this.fH = new Float64Array(n);
    this.fS = new Float64Array(n);
    this.outS = new Float64Array(n);
    this.outH = new Float64Array(n);
    this.inS = new Float64Array(n);
    this.inH = new Float64Array(n);
  }

  step(dt: number): void {
    const { particles: P, grid: g, liquid: L } = this.e;
    if (P.count === 0) { this.cap.fill(0); this.capT.fill(0); this.salt.fill(0); this.water.fill(0); return; }
    if (this.cell.length < P.cap) {
      this.cell = new Int32Array(P.cap);
      this.cpp = new Float64Array(P.cap);
      this.ds = new Float64Array(P.cap);
      this.hs = new Float64Array(P.cap);
    }
    const { cap, capT, capA, salt, water, fH, fS, cell, cpp } = this;
    cap.fill(0);
    capT.fill(0);
    capA.fill(0);
    salt.fill(0);
    water.fill(0);
    let salty = false;
    for (let p = 0; p < P.count; p += 1) {
      const c = g.cellAt(P.x[p], P.y[p]);
      cell[p] = c;
      if (c < 0) continue;
      const cp = P.cp(p);
      cpp[p] = cp;
      const C = P.mass[p] * cp;
      const T = P.T[p];
      cap[c] += C;
      capT[c] += C * T;
      capA[c] += (C * kLiq(P.mat[p], T)) / (P.rho[p] * cp);
      if (P.mat[p] !== WATER) continue;
      const s = P.smass[2 * p];
      salt[c] += s;
      water[c] += P.mass[p] - s;
      if (s > 0) salty = true;
    }
    /* Die Anteile je Zelle: einmal die Exponentialfunktion, nicht je Teilchen; Rühren beschleunigt das Salz (stirFactor). */
    const { nx, ny, kind } = g;
    const k = (Math.PI * Math.PI * dt) / (g.dx * g.dx);
    for (let c = 0; c < g.n; c += 1) {
      fH[c] = 0;
      fS[c] = 0;
      if (!(cap[c] > 0)) continue;
      const i = c % nx;
      const j = (c - i) / nx;
      if (kind[c] !== LIQUID) {
        if (kind[c] !== GAS) continue;
        const surface = (i > 0 && kind[c - 1] === LIQUID) || (i < nx - 1 && kind[c + 1] === LIQUID)
          || (j > 0 && kind[c - nx] === LIQUID) || (j < ny - 1 && kind[c + nx] === LIQUID);
        if (!surface) continue;
      }
      fH[c] = 1 - Math.exp((-k * capA[c]) / cap[c]);
      if (salty && salt[c] > 0) {
        const D = saltDiffusivity(capT[c] / cap[c]);
        fS[c] = 1 - Math.exp(-k * D * stirFactor(strainAt(g, i, j), dt / (k * D)));
      }
    }
    /* Wärme: jedes Teilchen ein Stück zum Mittel seiner Zelle; Σ m c_p ΔT = 0 je Zelle. */
    for (let p = 0; p < P.count; p += 1) {
      const c = cell[p];
      if (c < 0 || fH[c] === 0) continue;
      const dT = fH[c] * (capT[c] / cap[c] - P.T[p]);
      if (dT === 0) continue;
      const before = P.mass[p] / P.rho[p];
      P.h[p] += cpp[p] * dT;
      P.derive(p);
      L.dVp[p] += P.mass[p] / P.rho[p] - before;
    }
    if (salty) this.saltStep(dt);
  }

  /**
   * Salz: in der Zelle jedes Wasserteilchen ein Stück zum Salz je kg Wasser seiner Zelle (so klingt der Unterschied
   * genau mit f ab; Σ Δs = 0 je Zelle), dazu der Fluss von den Nachbarzellen — beides in einem Gang je Teilchen.
   */
  private saltStep(dt: number): void {
    const { particles: P, liquid: L } = this.e;
    const { salt, water, fS, outS, outH, inS, inH, cell, ds, hs } = this;
    outS.fill(0);
    outH.fill(0);
    for (let p = 0; p < P.count; p += 1) {
      ds[p] = 0;
      const c = cell[p];
      if (c < 0 || fS[c] === 0 || P.mat[p] !== WATER) continue;
      const s = P.smass[2 * p];
      const d = fS[c] * ((salt[c] / water[c]) * (P.mass[p] - s) - s);
      ds[p] = d;
      if (d < 0) {
        const h = hSaltIn(P.T[p], s / P.mass[p]);
        hs[p] = h;
        outS[c] -= d;
        outH[c] -= d * h;
      }
    }
    const between = this.saltBetween(dt);
    for (let p = 0; p < P.count; p += 1) {
      const c = cell[p];
      if (c < 0 || P.mat[p] !== WATER) continue;
      let d = ds[p];
      let dH = 0;
      if (d < 0) dH = d * hs[p];
      else if (d > 0) {
        if (outS[c] > 0) dH = (d * outH[c]) / outS[c];
        else d = 0;
      }
      const s = P.smass[2 * p];
      const m0 = P.mass[p];
      if (between && (inS[c] !== 0 || inH[c] !== 0)) {
        /* Gibt die Zelle ab, dann nach dem Salz der Teilchen (keines wird negativ), sonst nach ihrem Wasser. */
        const wgt = inS[c] < 0 ? s / salt[c] : (m0 - s) / water[c];
        d += inS[c] * wgt;
        dH += inH[c] * wgt;
      }
      if (d === 0 && dH === 0) continue;
      const H = m0 * P.h[p] + dH;
      const before = m0 / P.rho[p];
      P.mass[p] = m0 + d;
      P.smass[2 * p] = s + d;
      P.spc[2 * p] = s + d > 0 ? NACL : 0;
      P.h[p] = H / P.mass[p];
      P.derive(p);
      L.dVp[p] += P.mass[p] / P.rho[p] - before;
    }
  }

  /** Fick zwischen Nachbarzellen, die tauschen: Salz und Enthalpie je Zelle in inS, inH; liefert, ob etwas fliesst. */
  private saltBetween(dt: number): boolean {
    const g = this.e.grid;
    const { salt, water, fH, cap, capT, inS, inH } = this;
    const { nx, ny } = g;
    inS.fill(0);
    inH.fill(0);
    const r = dt / (g.dx * g.dx);
    let any = false;
    /* Durch den offenen Anteil der Fläche (alpha: eine dünne Wand eines Körpers lässt nichts durch). */
    const face = (a: number, b: number, alpha: number): void => {
      if (fH[b] === 0 || !(water[b] > 0) || !(alpha > 0)) return;
      const ba = salt[a] / water[a];
      const bb = salt[b] / water[b];
      if (ba === bb) return;
      const from = ba > bb ? a : b;
      const to = ba > bb ? b : a;
      const D = saltDiffusivity(0.5 * (capT[a] / cap[a] + capT[b] / cap[b]));
      const m = (alpha < 1 ? alpha * D : D) * r * Math.min(water[a], water[b]) * Math.abs(ba - bb);
      const h = hSaltIn(capT[from] / cap[from], salt[from] / (salt[from] + water[from]));
      inS[from] -= m;
      inH[from] -= m * h;
      inS[to] += m;
      inH[to] += m * h;
      any = true;
    };
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const c = i + j * nx;
        if (fH[c] === 0 || !(water[c] > 0)) continue;
        if (i + 1 < nx) face(c, c + 1, g.au[i + 1 + j * (nx + 1)]);
        if (j + 1 < ny) face(c, c + nx, g.av[c + nx]);
      }
    }
    return any;
  }
}
