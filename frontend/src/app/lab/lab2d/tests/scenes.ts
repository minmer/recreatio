/**
 * LABOR 2D (v2) — Szenen der Prüfungen (Vitest, kopflos in Node). Alles in
 * SI ausser den Feldern der Szene selbst (m, °C, kPa, W).
 */

export interface TestScene {
  format: 'recreatio/lab2d';
  version: 1;
  seed: number;
  box: { w: number; h: number; depth: number };
  ambient: { p: number; T: number; rh: number; g: number; air?: { N2: number; O2: number } };
  sides: { left: 'wall' | 'open'; right: 'wall' | 'open'; bottom: 'wall' | 'open'; top: 'wall' | 'open' };
  quality: 'very-high' | 'high' | 'medium';
  ops: Record<string, unknown>[];
}

export function scene(over: Partial<TestScene> & { ops?: Record<string, unknown>[] }): TestScene {
  return {
    format: 'recreatio/lab2d',
    version: 1,
    seed: 1,
    box: { w: 0.2, h: 0.15, depth: 0.01 },
    ambient: { p: 101.325, T: 20, rh: 0.5, g: 9.81 },
    sides: { left: 'wall', right: 'wall', bottom: 'wall', top: 'open' },
    quality: 'high',
    ops: [],
    ...over
  };
}

/** Die Szene des Meilensteins: Zlewka mit Wasser auf der Heizplatte (die Benchmark-Szene jedes Meilensteins). */
export function boilingScene(quality: TestScene['quality'] = 'high', extra: Record<string, unknown>[] = []): TestScene {
  return scene({
    quality,
    ops: [
      { op: 'hotplate', x: 0.1, y: 0, w: 0.12, h: 0.008, material: 'steel', mode: 'power', power: 40, on: true, T: 20 },
      { op: 'beaker', x: 0.1, y: 0.008, w: 0.07, h: 0.08, wall: 0.002, material: 'glass', T: 20 },
      { op: 'fill', region: { rect: [0.067, 0.010, 0.133, 0.06] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 },
      ...extra
    ]
  });
}

/** Mittel und Median einer Liste. */
export const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? 0 : s[Math.floor(s.length / 2)];
};

/** Fehlerfunktion (Abramowitz & Stegun 7.1.26, Fehler < 1,5e-7). */
export function erf(x: number): number {
  const s = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}
