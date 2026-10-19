/**
 * LABOR 2D (v2) — der einzige Zufall der Engine: mulberry32 über einem
 * 32-Bit-Zustand (Tommy Ettinger, gemeinfrei). Der Zustand gehört zur Engine
 * und zur gespeicherten Szene: derselbe Samen, dieselben Befehle — derselbe
 * Lauf. Dazu ein Hash für Zufall, der an einem Ort hängt (die Kavitäten einer
 * Wandfläche): er hängt nicht davon ab, in welcher Reihenfolge Wände entstehen.
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

  /** Exponentialverteilt mit Mittelwert 1. */
  exp(): number {
    return -Math.log(1 - this.next());
  }
}

/** Ein 32-Bit-Hash aus bis zu drei ganzen Zahlen (lowbias32, Chris Wellons, gemeinfrei). */
export function hash3(a: number, b: number, c: number): number {
  let h = (a ^ Math.imul(b, 0x9e3779b1) ^ Math.imul(c, 0x85ebca77)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}
