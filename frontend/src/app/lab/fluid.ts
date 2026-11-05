/**
 * 2026-10-18 — CIŚNIENIE W CIECZY: was die Fizyka über Flüssigkeiten
 * weiss. Die Dichte macht den Druck in der Tiefe
 * (p = p₀ + ρ·g·h, Stevin), den Auftrieb (Archimedes: so viel, wie die
 * verdrängte Flüssigkeit wiegt) und den Strahl aus einem Loch (Torricelli:
 * v = √(2·g·h)); ein U-Rohr misst so einen Gasdruck (Manometer).
 */

import { t } from '../core/i18n';

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

/** Eine Flüssigkeit; ihr Name kommt beim Lesen aus lab.json (`lab.liquid.<key>`). */
function liquid(key: string, density: number, color: string, thick: number): Liquid {
  return { key, get name() { return t(`lab.liquid.${key}`); }, density, color, thick };
}

export const LIQUIDS: Readonly<Record<string, Liquid>> = {
  water: liquid('water', 1000, 'rgba(64, 150, 220, 0.55)', 1),
  saltwater: liquid('saltwater', 1100, 'rgba(52, 128, 196, 0.6)', 1.1),
  sea: liquid('sea', 1025, 'rgba(40, 140, 170, 0.6)', 1.05),
  oil: liquid('oil', 900, 'rgba(222, 186, 60, 0.6)', 6),
  alcohol: liquid('alcohol', 790, 'rgba(200, 225, 240, 0.4)', 1.2),
  glycerin: liquid('glycerin', 1260, 'rgba(220, 230, 235, 0.55)', 40),
  honey: liquid('honey', 1420, 'rgba(214, 140, 30, 0.75)', 120),
  mercury: liquid('mercury', 13534, 'rgba(170, 176, 184, 0.95)', 1.5),
  milk: liquid('milk', 1030, 'rgba(245, 243, 235, 0.92)', 2)
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
