/**
 * PARTIKEL-LABOR — Einheiten und Naturkonstanten (SI). Die Engine rechnet
 * intern nur in SI; Szenen-JSON und Oberfläche rechnen an ihrem Rand um
 * (°C, kPa, Watt).
 */

/** Allgemeine Gaskonstante, J/(mol·K) (CODATA 2018). */
export const R_GAS = 8.314462618;
/** Normfallbeschleunigung, m/s². */
export const G0 = 9.80665;
/** Normdruck, Pa. */
export const P_ATM = 101325;
/** 0 °C in K. */
export const T0 = 273.15;
/** 1 mmHg in Pa. */
export const MMHG = 133.322368;

/** Die drei Phasen einer Partikel — ein Feld, kein eigener Objekttyp. */
export const SOLID = 0;
export const LIQUID = 1;
export const GAS = 2;
export type PhaseId = 0 | 1 | 2;

export const kelvin = (celsius: number): number => celsius + T0;
export const celsius = (kelvinValue: number): number => kelvinValue - T0;
