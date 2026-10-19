/**
 * LABOR 2D (v2) — Einheiten und Naturkonstanten. Die Engine rechnet intern
 * nur in SI; Szenen-JSON und Oberfläche rechnen an ihrem Rand um (°C, kPa, W).
 */

/** Allgemeine Gaskonstante, J/(mol·K) — CODATA 2018 (exakt seit der SI-Reform 2019). */
export const R_GAS = 8.314462618;
/** Normfallbeschleunigung, m/s² — CGPM 1901 (exakt). */
export const G0 = 9.80665;
/** Normdruck (eine Atmosphäre), Pa — exakt. */
export const P_ATM = 101325;
/** 0 °C in K — exakt. */
export const T0 = 273.15;

export const kelvin = (celsius: number): number => celsius + T0;
export const celsius = (kelvinValue: number): number => kelvinValue - T0;

/** Arten einer Zelle (je Schritt aus φ + α_b bestimmt; fest ist fest). */
export const GAS = 0;
export const LIQUID = 1;
export const SOLID = 2;

/** Gasarten auf dem Gitter und in Blasen: feste Plätze, drei für die Chemie (M2) frei. */
export const N2 = 0;
export const O2 = 1;
export const H2O = 2;
export const SPECIES_SLOTS = 6;
/** Wie viele Plätze M1 benutzt (N₂, O₂, H₂O). */
export const GAS_SPECIES = 3;
