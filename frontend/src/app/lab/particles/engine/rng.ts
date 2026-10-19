/**
 * PARTIKEL-LABOR — der einzige Zufall der Engine: mulberry32 über einem
 * 32-Bit-Zustand. Der Zustand gehört zur Engine (und zur gespeicherten Szene):
 * derselbe Samen, dieselben Befehle — derselbe Lauf.
 */

export class Rng {
  state: number;

  constructor(seed: number) {
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  /** Gleichverteilt in [0, 1). */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Gleichverteilt in [a, b). */
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
}
