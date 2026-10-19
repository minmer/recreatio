/**
 * PARTIKEL-LABOR — SPH-Kerne in 2D (Müller, Charypar & Gross 2003, auf die
 * Ebene normiert): poly6 und spiky, beide mit ∫ W dA = 1 über die Kreisscheibe.
 * Welcher die Dichte trägt, sagt die Kernwahl (`solver.ts`, P_KMODE).
 *
 *   poly6     W(r) = 4/(π h⁸) · (h² − r²)³          ∇W = −24/(π h⁸) · (h² − r²)² · (x_i − x_j)
 *   spiky     W(r) = 10/(π h⁵) · (h − r)³           ∇W = −30/(π h⁵) · (h − r)² · r̂
 */

/** Die Dichte: 0 und 1 poly6, 2 spiky. */
export type KernelMode = 0 | 1 | 2;

export class Kernels {
  readonly h: number;
  readonly h2: number;
  readonly k6: number;
  readonly ks: number;
  readonly kd: number;
  readonly mode: KernelMode;
  readonly w0: number;

  constructor(h: number, mode: KernelMode = 0) {
    this.h = h;
    this.h2 = h * h;
    this.mode = mode;
    this.k6 = 4 / (Math.PI * h ** 8);
    this.ks = 30 / (Math.PI * h ** 5);
    this.kd = 10 / (Math.PI * h ** 5);
    this.w0 = this.density(0);
  }

  /** poly6 aus dem Quadrat des Abstandes (1/m²). */
  poly6(r2: number): number {
    if (r2 >= this.h2) return 0;
    const d = this.h2 - r2;
    return this.k6 * d * d * d;
  }

  /** Der Kern der Dichte nach der Kernwahl, aus dem Quadrat des Abstandes (1/m²). */
  density(r2: number): number {
    if (r2 >= this.h2) return 0;
    if (this.mode === 2) {
      const e = this.h - Math.sqrt(r2);
      return this.kd * e * e * e;
    }
    return this.poly6(r2);
  }

  /** Der Faktor f des spiky-Gradienten: ∇W = f · (dx, dy) (1/m⁴). */
  spikyGrad(r: number): number {
    if (r >= this.h || r < 1e-12) return 0;
    const d = this.h - r;
    return (-this.ks * d * d) / r;
  }
}

/**
 * Wie stark der diskrete Gradient einen Druck sieht: für ein lineares Druckfeld
 * gibt die Korrektur (mit den Flächen A der Partikeln) die Kraft
 * −D·A²·m·∇p, mit m = ½·Σ_j |f(r_j)|·r_j² über das Gitter (∇W = f·r) — die
 * wahre ist −s²·D·∇p. Der Druck aus den Multiplikatoren ist darum um
 * κ = s²/(A²·m) zu gross (bei spiky und h = 2s: 1,83); `solver.ts` teilt durch κ.
 */
export function pressureScale(k: Kernels, s: number, area: number): number {
  const n = Math.ceil(k.h / s) + 1;
  let m = 0;
  for (let a = -n; a <= n; a += 1) {
    for (let b = -n; b <= n; b += 1) {
      const r = Math.hypot(a * s, b * s);
      if (r === 0 || r >= k.h) continue;
      m += Math.abs(k.spikyGrad(r)) * r * r;
    }
  }
  return (s * s) / (area * area * 0.5 * m);
}

/** Die Summe des Dichtekerns über ein Quadratgitter der Weite s (die Ruhedichte in Teilchen je m²). */
export function latticeSum(k: Kernels, s: number): number {
  const n = Math.ceil(k.h / s) + 1;
  let sum = 0;
  for (let a = -n; a <= n; a += 1) for (let b = -n; b <= n; b += 1) sum += k.density((a * s) ** 2 + (b * s) ** 2);
  return sum;
}
