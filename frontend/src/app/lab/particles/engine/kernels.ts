/**
 * PARTIKEL-LABOR — SPH-Kerne in 2D (Müller, Charypar & Gross 2003, auf die
 * Ebene normiert): poly6 für die Dichte, der Gradient von „spiky” für Kräfte,
 * Korrekturen und die Wärmeleitung.
 *
 *   poly6     W(r) = 4/(π h⁸) · (h² − r²)³          ∫ W dA = 1 über die Kreisscheibe
 *   spiky     W(r) = 10/(π h⁵) · (h − r)³           ∇W = −30/(π h⁵) · (h − r)² · r̂
 */

export class Kernels {
  readonly h: number;
  readonly h2: number;
  private readonly k6: number;
  private readonly ks: number;
  readonly w0: number;

  constructor(h: number) {
    this.h = h;
    this.h2 = h * h;
    this.k6 = 4 / (Math.PI * h ** 8);
    this.ks = 30 / (Math.PI * h ** 5);
    this.w0 = this.poly6(0);
  }

  /** poly6 aus dem Quadrat des Abstandes (1/m²). */
  poly6(r2: number): number {
    if (r2 >= this.h2) return 0;
    const d = this.h2 - r2;
    return this.k6 * d * d * d;
  }

  /** Der Faktor f des spiky-Gradienten: ∇W = f · (dx, dy) (1/m⁴). */
  spikyGrad(r: number): number {
    if (r >= this.h || r < 1e-12) return 0;
    const d = this.h - r;
    return (-this.ks * d * d) / r;
  }
}

/** Die Summe von poly6 über ein Quadratgitter der Weite s (die Ruhedichte in Teilchen je m²). */
export function latticeSum(k: Kernels, s: number): number {
  const n = Math.ceil(k.h / s) + 1;
  let sum = 0;
  for (let a = -n; a <= n; a += 1) for (let b = -n; b <= n; b += 1) sum += k.poly6((a * s) ** 2 + (b * s) ** 2);
  return sum;
}
