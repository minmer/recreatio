/**
 * 2026-10-18 — CIŚNIENIE W CIECZY: was die Fizyka über Flüssigkeiten
 * weiss. Die Dichte macht den Druck in der Tiefe
 * (p = p₀ + ρ·g·h, Stevin), den Auftrieb (Archimedes: so viel, wie die
 * verdrängte Flüssigkeit wiegt) und den Strahl aus einem Loch (Torricelli:
 * v = √(2·g·h)); ein U-Rohr misst so einen Gasdruck (Manometer).
 */

export interface Liquid {
  readonly key: string;
  readonly name: string;
  /** kg/m³ */
  readonly density: number;
  /** Farbe der Flüssigkeit (mit Deckkraft). */
  readonly color: string;
  /** Wie zäh sie ist (bremst Körper in ihr; Wasser 1). */
  readonly thick: number;
}

export const LIQUIDS: Readonly<Record<string, Liquid>> = {
  water: { key: 'water', name: 'woda', density: 1000, color: 'rgba(64, 150, 220, 0.55)', thick: 1 },
  saltwater: { key: 'saltwater', name: 'woda słona', density: 1100, color: 'rgba(52, 128, 196, 0.6)', thick: 1.1 },
  sea: { key: 'sea', name: 'woda morska', density: 1025, color: 'rgba(40, 140, 170, 0.6)', thick: 1.05 },
  oil: { key: 'oil', name: 'olej', density: 900, color: 'rgba(222, 186, 60, 0.6)', thick: 6 },
  alcohol: { key: 'alcohol', name: 'alkohol', density: 790, color: 'rgba(200, 225, 240, 0.4)', thick: 1.2 },
  glycerin: { key: 'glycerin', name: 'gliceryna', density: 1260, color: 'rgba(220, 230, 235, 0.55)', thick: 40 },
  honey: { key: 'honey', name: 'miód', density: 1420, color: 'rgba(214, 140, 30, 0.75)', thick: 120 },
  mercury: { key: 'mercury', name: 'rtęć', density: 13534, color: 'rgba(170, 176, 184, 0.95)', thick: 1.5 },
  milk: { key: 'milk', name: 'mleko', density: 1030, color: 'rgba(245, 243, 235, 0.92)', thick: 2 }
};

/** Normaler Luftdruck (Pa). */
export const P_ATM = 101325;

/** Druck in einer Tiefe (Pa) unter einer Säule aus Schichten `[Dichte, Dicke]` — von oben nach unten. */
export function pressureUnder(layers: readonly (readonly [number, number])[], g: number, surface = P_ATM): number {
  return layers.reduce((p, [rho, h]) => p + rho * g * Math.max(0, h), surface);
}

/** Wie schnell eine Flüssigkeit aus einem Loch schiesst, über dem der Überdruck `dp` (Pa) steht (Torricelli, Bernoulli). */
export function jetSpeed(dp: number, rho: number): number {
  return dp <= 0 || rho <= 0 ? 0 : Math.sqrt((2 * dp) / rho);
}

/** Der Höhenunterschied in einem U-Rohr-Manometer (m) bei einem Überdruck `dp` (Pa). */
export function manometerHead(dp: number, rho: number, g: number): number {
  return rho <= 0 || g <= 0 ? 0 : dp / (rho * g);
}

/** Pascal als Kilopascal — „101,3 kPa”. */
export function kPa(p: number): string {
  return `${(p / 1000).toFixed(p < 10000 ? 2 : 1).replace('.', ',')} kPa`;
}
