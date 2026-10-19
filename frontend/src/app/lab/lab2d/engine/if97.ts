/**
 * LABOR 2D (v2) — DIE SÄTTIGUNGSLINIE DES WASSERS.
 *
 * - p_sat(T) und T_sat(p): IAPWS-IF97, Region 4 (IAPWS R7-97(2012), Gl. 30
 *   und 31), gültig von 273,15 K bis zum kritischen Punkt 647,096 K. Die
 *   Prüfwerte der Norm (Tabellen 35 und 36) stehen in tests/m0.test.ts.
 * - ρ'(T), ρ''(T): gesättigte Flüssigkeit und gesättigter Dampf nach IAPWS
 *   SR1-86(1992) (Wagner & Pruss 1993), Gl. 2.3 und 2.5.
 *
 * Die Koeffizienten stehen in materials.json (mit Quelle); hier werden sie
 * nur gelesen. Keine Antoine-Gleichung (Prompt v2: zwei Antoine-Sätze weichen
 * bei 760 mmHg um 0,16 K voneinander ab).
 */

import { data } from './materials';

const sat = data.species[0].saturation;
const n = sat.if97.n;
const N1 = n[0], N2 = n[1], N3 = n[2], N4 = n[3], N5 = n[4], N6 = n[5], N7 = n[6], N8 = n[7], N9 = n[8], N10 = n[9];

/** Kritische Temperatur (K) und Dichte (kg/m³) — IAPWS SR1-86. */
export const T_CRIT = sat.Tc.v;
export const RHO_CRIT = sat.rhoc.v;
/** Gültigkeitsbereich von Region 4 (K): Tripelpunkt-nah bis kritisch. */
export const T_MIN = 273.15;

const C = sat.vapourDensity.c;
const B = sat.liquidDensity.b;

/** Sättigungsdruck (Pa) bei T (K) — IF97 Gl. 30. */
export function pSat(T: number): number {
  const t = T < T_MIN ? T_MIN : T > T_CRIT ? T_CRIT : T;
  const th = t + N9 / (t - N10);
  const a = th * th + N1 * th + N2;
  const b = N3 * th * th + N4 * th + N5;
  const c = N6 * th * th + N7 * th + N8;
  const x = (2 * c) / (-b + Math.sqrt(b * b - 4 * a * c));
  return x * x * x * x * 1e6;
}

/** Sättigungstemperatur (K) bei p (Pa) — IF97 Gl. 31 (gültig ab 611,213 Pa). */
export function tSat(p: number): number {
  const pp = p < 611.213 ? 611.213 : p > 22.064e6 ? 22.064e6 : p;
  const beta = Math.sqrt(Math.sqrt(pp / 1e6));
  const e = beta * beta + N3 * beta + N6;
  const f = N1 * beta * beta + N4 * beta + N7;
  const g = N2 * beta * beta + N5 * beta + N8;
  const d = (2 * g) / (-f - Math.sqrt(f * f - 4 * e * g));
  const s = N10 + d;
  return (s - Math.sqrt(s * s - 4 * (N9 + N10 * d))) / 2;
}

/** dT_sat/dp (K/Pa) bei p, als zentraler Differenzenquotient (für Anzeigen und die Kalibrierung der Kavitäten). */
export function dTsatDp(p: number): number {
  const h = Math.max(1, p * 1e-4);
  return (tSat(p + h) - tSat(p - h)) / (2 * h);
}

/** Dichte des gesättigten Dampfes ρ''(T) (kg/m³) — SR1-86 Gl. 2.5. */
export function rhoVapourSat(T: number): number {
  const t = T < T_MIN ? T_MIN : T > T_CRIT ? T_CRIT : T;
  const tau = 1 - t / T_CRIT;
  const s = Math.pow(tau, 1 / 6);
  const s2 = s * s;
  const s4 = s2 * s2;
  const s8 = s4 * s4;
  const s18 = s8 * s8 * s2;
  const s37 = s18 * s18 * s;
  const s71 = s37 * s18 * s8 * s8;
  return RHO_CRIT * Math.exp(C[0] * s2 + C[1] * s4 + C[2] * s8 + C[3] * s18 + C[4] * s37 + C[5] * s71);
}

/** Dichte der gesättigten Flüssigkeit ρ'(T) (kg/m³) — SR1-86 Gl. 2.3. */
export function rhoLiquidSat(T: number): number {
  const t = T < T_MIN ? T_MIN : T > T_CRIT ? T_CRIT : T;
  const tau = 1 - t / T_CRIT;
  const s = Math.cbrt(tau);
  return RHO_CRIT * (1 + B[0] * s + B[1] * s * s + B[2] * Math.pow(tau, 5 / 3) + B[3] * Math.pow(tau, 16 / 3) + B[4] * Math.pow(tau, 43 / 3) + B[5] * Math.pow(tau, 110 / 3));
}

/*
 * Tafeln für die Schleife (Nebel, Verdunsten, Keimbildung fragen je Zelle und
 * Schritt): p_sat(T) von 250 bis 500 K in Schritten von 0,01 K und ρ''(T)
 * ebenso, linear gelesen — Abweichung von den Formeln unter 1e-7 relativ.
 * Ausserhalb gelten die Formeln selbst.
 */
const TAB_LO = 250;
const TAB_STEP = 0.01;
const TAB_N = 25001;
const P_TAB = new Float64Array(TAB_N);
const RV_TAB = new Float64Array(TAB_N);
for (let i = 0; i < TAB_N; i += 1) {
  P_TAB[i] = pSat(TAB_LO + i * TAB_STEP);
  RV_TAB[i] = rhoVapourSat(TAB_LO + i * TAB_STEP);
}

/** p_sat(T) aus der Tafel (Pa). */
export function pSatFast(T: number): number {
  const x = (T - TAB_LO) / TAB_STEP;
  if (!(x >= 0) || x >= TAB_N - 1) return pSat(T);
  const i = x | 0;
  return P_TAB[i] + (x - i) * (P_TAB[i + 1] - P_TAB[i]);
}

/** ρ''(T) aus der Tafel (kg/m³). */
export function rhoVapourSatFast(T: number): number {
  const x = (T - TAB_LO) / TAB_STEP;
  if (!(x >= 0) || x >= TAB_N - 1) return rhoVapourSat(T);
  const i = x | 0;
  return RV_TAB[i] + (x - i) * (RV_TAB[i + 1] - RV_TAB[i]);
}

/** dp_sat/dT (Pa/K) aus der Tafel. */
export function dPsatDT(T: number): number {
  const x = (T - TAB_LO) / TAB_STEP;
  if (!(x >= 0) || x >= TAB_N - 1) return (pSat(T + 0.01) - pSat(T - 0.01)) / 0.02;
  const i = x | 0;
  return (P_TAB[i + 1] - P_TAB[i]) / TAB_STEP;
}
