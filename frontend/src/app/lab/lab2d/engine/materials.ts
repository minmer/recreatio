/**
 * LABOR 2D (v2) — DIE STOFFE ALS FUNKTIONEN: Zugriff auf materials.json (jede
 * Zahl dort mit Quelle) und die Stoffwerte, die die Engine braucht.
 *
 * <b>Die Enthalpie-Schliessung</b> (ARCHITECTURE.md §4): jede Enthalpie wird
 * überall mit denselben Funktionen ausgewertet —
 *   h_l(T) = ∫ c_p,l dT ab 0 °C (Tabelle, stückweise linear integriert),
 *   h_v(T) = h_l(100 °C) + h_lv(100 °C) + ∫ c_p,v dT ab 100 °C (ideales Gas),
 *   Gase h_k(T) = c_p,k (T − 0 °C), Feststoffe h_s(T) = c_s (T − 0 °C).
 * Die Verdampfungswärme bei jeder Temperatur ist h_v(T) − h_l(T) (Kirchhoff),
 * verankert am Wert bei 100 °C. Jeder Übergang zwischen Speichern trägt die
 * Masse mit der Enthalpie des Speichers, den sie verlässt — die Bilanzen
 * schliessen bis auf Rundung.
 */

import raw from './materials.json';
import { H2O, N2, O2, P_ATM, SPECIES_SLOTS, T0 } from './units';

type Lang3 = { readonly pl: string; readonly de: string; readonly en: string };
/** Ein Wert mit Quelle. */
interface V { readonly v: number; readonly src: string }
interface Thermo { readonly dHf: V; readonly S: V }

/**
 * Eine weitere Flüssigkeit (M2a): Stoffgesetze als benannte Modelle, jede Zahl
 * mit Quelle — Dichte und c_p linear in T, Wärmeleitfähigkeit linear, Zähigkeit
 * nach Vogel, Oberflächenspannung konstant; `range` der Messbereich.
 */
interface LiquidEntry {
  readonly id: string; readonly name: Lang3;
  readonly liquid: {
    readonly name: Lang3;
    readonly rho: { readonly linear: readonly number[] }; readonly cp: { readonly linear: readonly number[] };
    readonly k: { readonly linear: readonly number[] }; readonly mu: { readonly vogel: readonly number[] };
    readonly sigma: V; readonly range: { readonly lo: number; readonly hi: number }; readonly color: string;
  };
}

/** Die Gestalt von materials.json (die Stoffe mit allem, was die Engine liest; H₂O, N₂, O₂ zuerst, dann weitere Flüssigkeiten). */
export interface MaterialsFile {
  readonly sources: Readonly<Record<string, string>>;
  readonly ambient: { readonly p: V; readonly T: V; readonly rh: V; readonly air: { readonly N2: V; readonly O2: V }; readonly hExt: V };
  readonly species: readonly [
    {
      readonly id: string; readonly name: Lang3; readonly molarMass: V;
      readonly liquid: {
        readonly name: Lang3; readonly kell: { readonly c: readonly number[] }; readonly cp: { readonly table: readonly (readonly number[])[] };
        readonly k: { readonly poly: readonly number[] }; readonly mu: { readonly vogel: readonly number[] }; readonly color: string;
      };
      readonly vapour: { readonly name: Lang3; readonly cp: { readonly linear: readonly number[] }; readonly k: V; readonly mu: V };
      readonly saturation: {
        readonly if97: { readonly n: readonly number[] }; readonly Tc: V; readonly rhoc: V;
        readonly vapourDensity: { readonly c: readonly number[] }; readonly liquidDensity: { readonly b: readonly number[] }; readonly hlv100: V;
      };
      readonly surfaceTension: { readonly B: number; readonly b: number; readonly mu: number };
      /** Schmelzen (M2b für den Gefrierpunkt von Lösungen, M3b für Eis): Schmelzpunkt, Schmelzenthalpie, Eis. */
      readonly fusion: { readonly T: V; readonly h: V; readonly cpIce: V; readonly rhoIce: V };
      readonly thermo: { readonly liquid: Thermo; readonly gas: Thermo };
    },
    GasEntry,
    GasEntry,
    ...LiquidEntry[]
  ];
  /** Gelöste Stoffe (M2b): Kochsalz in Wasser. */
  readonly solutes: readonly SoluteEntry[];
  readonly vapourInAir: { readonly D0: V; readonly T0: V; readonly exponent: V };
  readonly solids: readonly {
    readonly id: string; readonly name: Lang3; readonly rho: V; readonly cp: V; readonly k: V; readonly contactAngle: V;
    readonly cavities: { readonly scale: V; readonly rmax: V }; readonly color: string;
  }[];
}

/**
 * Ein gelöster Stoff (M2b, solution.ts): osmotischer Koeffizient nach Pitzer
 * (Parameter mit Temperaturform), Dielektrizitätszahl des Wassers für die
 * Debye–Hückel-Steigung, Dichte und c_p der Lösung nach Laliberté,
 * Löslichkeit, Lösungsenthalpie und der Kristall.
 */
export interface SoluteEntry {
  readonly id: string; readonly name: Lang3; readonly short: Lang3; readonly solvent: string;
  readonly molarMass: V; readonly ions: V;
  readonly pitzer: { readonly b0: { readonly a: readonly number[] }; readonly b1: { readonly a: readonly number[] }; readonly c: { readonly a: readonly number[] }; readonly b: V; readonly alpha: V };
  /** Die Parameter unter `below` (K): ein Satz, der bis −60 °C gilt (für den Gefrierpunkt). */
  readonly pitzerCold: { readonly below: V; readonly b0: { readonly a: readonly number[] }; readonly b1: { readonly a: readonly number[] }; readonly c: { readonly a: readonly number[] } };
  readonly dielectric: { readonly c: readonly number[] };
  readonly density: { readonly laliberte: readonly number[] };
  readonly cp: { readonly laliberte: readonly number[]; readonly range: { readonly lo: number; readonly hi: number } };
  readonly solubility: { readonly table: readonly (readonly number[])[] };
  readonly dHsol: V;
  /** Diffusionskoeffizient des gelösten Salzes in Wasser bei 25 °C (m²/s). */
  readonly diffusivity: V;
  /** Eutektikum von Eis und Hydrohalit (K, Massenanteil): stärkere Lösungen erstarren dort ganz. */
  readonly eutectic: { readonly T: V; readonly w: V };
  readonly solid: { readonly rho: V; readonly cp: V; readonly color: string };
}

interface GasEntry {
  readonly id: string; readonly name: Lang3; readonly molarMass: V;
  readonly gas: { readonly cp: V; readonly k: { readonly power: readonly number[] }; readonly mu: { readonly sutherland: readonly number[] } };
  readonly thermo: { readonly gas: Thermo };
}

export const data = raw as unknown as MaterialsFile;
const water = data.species[0];
const nitrogen = data.species[1];
const oxygen = data.species[2];

/* -- Gase: Molmassen und Wärmekapazitäten je Platz ------------------------------------------------ */

/** Molmasse je Gasplatz (kg/mol); freie Plätze 0 (kommen in M1 nicht vor). */
export const MOLAR = new Float64Array(SPECIES_SLOTS);
MOLAR[N2] = nitrogen.molarMass.v;
MOLAR[O2] = oxygen.molarMass.v;
MOLAR[H2O] = water.molarMass.v;

/** Namen der Gasplätze (Anzeige). */
export const GAS_NAMES: readonly Lang3[] = [nitrogen.name, oxygen.name, water.vapour.name];
export const GAS_FORMULA: readonly string[] = ['N₂', 'O₂', 'H₂O'];

const CP_N2 = nitrogen.gas.cp.v;
const CP_O2 = oxygen.gas.cp.v;
const [CPV0, CPV1, CPV_T] = water.vapour.cp.linear;

/** c_p der Gasart k bei T (J/(kg·K)): N₂, O₂ konstant (Incropera A.4, 300 K), Dampf linear (JANAF). */
export function cpGas(k: number, T: number): number {
  if (k === H2O) return CPV0 + CPV1 * (T - CPV_T);
  return k === N2 ? CP_N2 : k === O2 ? CP_O2 : 0;
}

/* -- Flüssiges Wasser ---------------------------------------------------------------------------- */

const KELL = water.liquid.kell.c;
const CP_TABLE = water.liquid.cp.table;
const CP_T = new Float64Array(CP_TABLE.map((r) => r[0]));
const CP_V = new Float64Array(CP_TABLE.map((r) => r[1]));
/** h_l an den Stützstellen (J/kg, ab 0 °C) — die Integrale der stückweise linearen c_p. */
const CP_H = new Float64Array(CP_TABLE.length);
CP_H[0] = CP_V[0] * (CP_T[0] - T0);
for (let k = 1; k < CP_TABLE.length; k += 1) CP_H[k] = CP_H[k - 1] + 0.5 * (CP_V[k] + CP_V[k - 1]) * (CP_T[k] - CP_T[k - 1]);
const CP_LAST = CP_TABLE.length - 1;

/** Der Abschnitt der c_p-Tabelle, in dem T liegt (−1: darunter, CP_LAST: darüber). */
function cpSegment(T: number): number {
  if (T < CP_T[0]) return -1;
  if (T >= CP_T[CP_LAST]) return CP_LAST;
  let k = Math.min(CP_LAST - 1, Math.max(0, Math.floor((T - T0) / 10)));
  while (k > 0 && T < CP_T[k]) k -= 1;
  while (k < CP_LAST - 1 && T >= CP_T[k + 1]) k += 1;
  return k;
}

/** c_p des flüssigen Wassers (J/(kg·K)) — NIST (IAPWS-95, gesättigt), stückweise linear; ausserhalb der Tabelle konstant. */
export function cpL(T: number): number {
  const k = cpSegment(T);
  if (k < 0) return CP_V[0];
  if (k === CP_LAST) return CP_V[CP_LAST];
  return CP_V[k] + ((CP_V[k + 1] - CP_V[k]) * (T - CP_T[k])) / (CP_T[k + 1] - CP_T[k]);
}

/** Spezifische Enthalpie des flüssigen Wassers (J/kg, 0 bei 0 °C): das genaue Integral von cpL. */
export function hL(T: number): number {
  const k = cpSegment(T);
  if (k < 0) return CP_H[0] + CP_V[0] * (T - CP_T[0]);
  if (k === CP_LAST) return CP_H[CP_LAST] + CP_V[CP_LAST] * (T - CP_T[CP_LAST]);
  const d = T - CP_T[k];
  const s = (CP_V[k + 1] - CP_V[k]) / (CP_T[k + 1] - CP_T[k]);
  return CP_H[k] + CP_V[k] * d + 0.5 * s * d * d;
}

/** Die Umkehrung von hL: T (K) aus der spezifischen Enthalpie (J/kg) — genau (quadratisch je Abschnitt). */
export function tFromHL(h: number): number {
  if (h < CP_H[0]) return CP_T[0] + (h - CP_H[0]) / CP_V[0];
  if (h >= CP_H[CP_LAST]) return CP_T[CP_LAST] + (h - CP_H[CP_LAST]) / CP_V[CP_LAST];
  let k = Math.min(CP_LAST - 1, Math.max(0, Math.floor(h / 41900)));
  while (k > 0 && h < CP_H[k]) k -= 1;
  while (k < CP_LAST - 1 && h >= CP_H[k + 1]) k += 1;
  const s = (CP_V[k + 1] - CP_V[k]) / (CP_T[k + 1] - CP_T[k]);
  const e = h - CP_H[k];
  const b = CP_V[k];
  /* d = (−b + √(b² + 2 s e))/s, in der auslöschungsfreien Form. */
  return CP_T[k] + (2 * e) / (b + Math.sqrt(Math.max(0, b * b + 2 * s * e)));
}

/** Dichte des flüssigen Wassers bei 1 atm (kg/m³) — Kell (1975), Gl. 16, gültig 0–150 °C (mit dem Maximum bei 3,98 °C). */
export function rhoL(T: number): number {
  const t = T - T0;
  return (KELL[0] + t * (KELL[1] + t * (KELL[2] + t * (KELL[3] + t * (KELL[4] + t * KELL[5]))))) / (1 + KELL[6] * t);
}

/** dρ_l/dT (kg/(m³·K)) — die Ableitung der Kell-Formel. */
export function dRhoLdT(T: number): number {
  const t = T - T0;
  const num = KELL[0] + t * (KELL[1] + t * (KELL[2] + t * (KELL[3] + t * (KELL[4] + t * KELL[5]))));
  const dnum = KELL[1] + t * (2 * KELL[2] + t * (3 * KELL[3] + t * (4 * KELL[4] + t * 5 * KELL[5])));
  const den = 1 + KELL[6] * t;
  return (dnum * den - num * KELL[6]) / (den * den);
}

const KL = water.liquid.k.poly;
/** Wärmeleitfähigkeit des flüssigen Wassers (W/(m·K)) — IAPWS R15-11, gesättigt, quadratisch in °C (0–150 °C). */
export function kL(T: number): number {
  const t = Math.min(150, Math.max(0, T - T0));
  return KL[0] + t * (KL[1] + t * KL[2]);
}

const [VA, VB, VC] = water.liquid.mu.vogel;
/** Dynamische Viskosität des flüssigen Wassers (Pa·s) — Vogel-Gleichung (Werte in materials.json). */
export function muL(T: number): number {
  return VA * Math.pow(10, VB / (Math.max(T, VC + 60) - VC));
}

const ST = water.surfaceTension;
const TC = water.saturation.Tc.v;
/** Oberflächenspannung Wasser–Dampf/Luft (N/m) — IAPWS R1-76(2014). */
export function sigma(T: number): number {
  const tau = Math.max(0, 1 - T / TC);
  return ST.B * Math.pow(tau, ST.mu) * (1 + ST.b * tau);
}

/* -- Wasserdampf und Phasenwechsel --------------------------------------------------------------- */

/** h_lv bei 100 °C (J/kg) — NIST (IAPWS-95). Anker der Schliessung. */
export const HLV100 = water.saturation.hlv100.v;
const T100 = T0 + 100;
const HV100 = hL(T100) + HLV100;
const KV = water.vapour.k.v;
const MUV = water.vapour.mu.v;

/** Spezifische Enthalpie des Wasserdampfs (J/kg, gleicher Nullpunkt wie hL): ideales Gas, verankert bei 100 °C. */
export function hV(T: number): number {
  const a = T - CPV_T;
  const b = T100 - CPV_T;
  return HV100 + CPV0 * (T - T100) + 0.5 * CPV1 * (a * a - b * b);
}

/** Die Umkehrung von hV (Newton; c_p,v ändert sich kaum). */
export function tFromHV(h: number): number {
  let T = T100 + (h - HV100) / CPV0;
  for (let k = 0; k < 3; k += 1) T -= (hV(T) - h) / cpGas(H2O, T);
  return T;
}

/** Verdampfungswärme h_v(T) − h_l(T) (J/kg) — Kirchhoff aus der Schliessung. */
export function hLV(T: number): number {
  return hV(T) - hL(T);
}

/** Spezifische Enthalpie der Gasart k (J/kg, Nullpunkt wie hL). */
export function hGas(k: number, T: number): number {
  if (k === H2O) return hV(T);
  return cpGas(k, T) * (T - T0);
}

const KN = nitrogen.gas.k.power;
const KO = oxygen.gas.k.power;
const MN = nitrogen.gas.mu.sutherland;
const MO = oxygen.gas.mu.sutherland;
const DV = data.vapourInAir;
const sutherland = (s: readonly number[], T: number): number => s[0] * Math.pow(T / s[1], 1.5) * ((s[1] + s[2]) / (T + s[2]));

/*
 * Tafeln von 150 bis 1150 K in Schritten von 1 K, aus den zitierten Gesetzen
 * berechnet und linear gelesen (Fehler unter 1e-5 relativ): die Engine fragt
 * diese Werte je Zelle und Schritt, Math.pow dort kostete ein Fünftel der Zeit.
 */
const TAB_LO = 150;
const TAB_N = 1001;
const table = (fn: (T: number) => number): Float64Array => {
  const t = new Float64Array(TAB_N);
  for (let i = 0; i < TAB_N; i += 1) t[i] = fn(TAB_LO + i);
  return t;
};
const look = (t: Float64Array, T: number): number => {
  let x = T - TAB_LO;
  if (!(x > 0)) x = 0;
  else if (x > TAB_N - 1.001) x = TAB_N - 1.001;
  const i = x | 0;
  return t[i] + (x - i) * (t[i + 1] - t[i]);
};
const K_N2 = table((T) => KN[0] * Math.pow(T / KN[1], KN[2]));
const K_O2 = table((T) => KO[0] * Math.pow(T / KO[1], KO[2]));
const MU_N2 = table((T) => sutherland(MN, T));
const MU_O2 = table((T) => sutherland(MO, T));
const D_V = table((T) => DV.D0.v * Math.pow(T / DV.T0.v, DV.exponent.v));

/** Wärmeleitfähigkeit der Gasart k (W/(m·K)): N₂, O₂ als Potenzgesetz (Incropera A.4), Dampf konstant (NIST, 100 °C). */
export function kGas(k: number, T: number): number {
  if (k === N2) return look(K_N2, T);
  if (k === O2) return look(K_O2, T);
  return k === H2O ? KV : 0;
}

/** Dynamische Viskosität der Gasart k (Pa·s): Sutherland (White, Tab. 1-2), Dampf konstant (NIST, 100 °C). */
export function muGas(k: number, T: number): number {
  if (k === N2) return look(MU_N2, T);
  if (k === O2) return look(MU_O2, T);
  return k === H2O ? MUV : 0;
}

/** Wärmeleitfähigkeit eines Gasgemischs (massengewichtet; SIMPLIFICATIONS.md #12). */
export function kMix(mN2: number, mO2: number, mV: number, T: number): number {
  const m = mN2 + mO2 + mV;
  return m > 0 ? (mN2 * look(K_N2, T) + mO2 * look(K_O2, T) + mV * KV) / m : look(K_N2, T);
}

/** Zähigkeit eines Gasgemischs (massengewichtet). */
export function muMix(mN2: number, mO2: number, mV: number, T: number): number {
  const m = mN2 + mO2 + mV;
  return m > 0 ? (mN2 * look(MU_N2, T) + mO2 * look(MU_O2, T) + mV * MUV) / m : look(MU_N2, T);
}

/** Diffusionskoeffizient von Wasserdampf in Luft (m²/s) — Massman (1998): D₀ (p₀/p)(T/T₀)^1,81. */
export function diffVapour(T: number, p: number): number {
  return look(D_V, T) * (P_ATM / p);
}

/**
 * Die Temperatur eines Gases ohne Nebel aus seiner Enthalpie H (J):
 * H = (m_N₂ c_N₂ + m_O₂ c_O₂)(T − 0 °C) + m_v h_v(T) ist quadratisch in T
 * (c_p des Dampfs linear) und wird geschlossen gelöst.
 */
export function gasTemperature(mN2: number, mO2: number, mV: number, H: number): number {
  const A = mN2 * CP_N2 + mO2 * CP_O2;
  const b100 = T100 - CPV_T;
  const a = 0.5 * mV * CPV1;
  const b = A + mV * CPV0;
  if (b <= 0) return T0;
  const c = A * (CPV_T - T0) + mV * (HV100 + CPV0 * (CPV_T - T100) - 0.5 * CPV1 * b100 * b100) - H;
  const disc = b * b - 4 * a * c;
  return CPV_T + (-2 * c) / (b + Math.sqrt(disc > 0 ? disc : 0));
}

/** Wärmekapazität eines Gases (J/K) bei T, mit Nebel. */
export function gasHeatCapacity(mN2: number, mO2: number, mV: number, mFog: number, T: number): number {
  return mN2 * CP_N2 + mO2 * CP_O2 + mV * (CPV0 + CPV1 * (T - CPV_T)) + (mFog > 0 ? mFog * cpL(T) : 0);
}

/* -- Umgebung ------------------------------------------------------------------------------------ */

/** Trockene Luft (Massenanteile N₂, O₂) — Incropera; Argon ist N₂ zugeschlagen (SIMPLIFICATIONS.md #12). */
export const AIR_N2 = data.ambient.air.N2.v;
export const AIR_O2 = data.ambient.air.O2.v;
export const AMBIENT_T = data.ambient.T.v;
export const AMBIENT_RH = data.ambient.rh.v;
/** Wärmeübergang der Kistenwände an den Raum (W/(m²·K)) — Modellparameter. */
export const H_EXT = data.ambient.hExt.v;

/* -- Feststoffe ---------------------------------------------------------------------------------- */

export interface SolidMaterial {
  readonly id: string;
  readonly name: Lang3;
  readonly rho: number;
  readonly cp: number;
  readonly k: number;
  /** Statischer Kontaktwinkel mit Wasser (Grad). */
  readonly contactAngle: number;
  /** Kavitäten: Dichte relativ zu Stahl nach Lemmert & Chawla und grösster Mündungsradius (m). */
  readonly cavScale: number;
  readonly cavRmax: number;
  readonly color: string;
}

export const SOLIDS: readonly SolidMaterial[] = data.solids.map((s) => ({
  id: s.id,
  name: s.name,
  rho: s.rho.v,
  cp: s.cp.v,
  k: s.k.v,
  contactAngle: s.contactAngle.v,
  cavScale: s.cavities.scale.v,
  cavRmax: s.cavities.rmax.v,
  color: s.color
}));

/** Index eines Feststoffs (−1: unbekannt). Gespeichert wird im Gitter Index + 1 (0 heisst „kein Feststoff“). */
export function solidIndex(id: string): number {
  return SOLIDS.findIndex((s) => s.id === id);
}

/* -- Alle Flüssigkeiten (M2a) -------------------------------------------------------------------------
 *
 * Ein Teilchen trägt den Index seiner Flüssigkeit (`mat`). Wasser ist 0 und
 * behält seine Funktionen oben unverändert (dieselben Zahlen wie in M1); jede
 * weitere Flüssigkeit kommt mit ihren Gesetzen aus materials.json. Nur
 * flüchtige Flüssigkeiten (mit Sättigungslinie: Wasser) verdampfen, bilden
 * Blasen und Nebel.
 */

/** Index des Wassers unter den Flüssigkeiten. */
export const WATER = 0;

export interface LiquidInfo {
  readonly id: string;
  readonly name: Lang3;
  /** Kurzname der Flüssigkeit („woda“, „olej“). */
  readonly short: Lang3;
  readonly color: string;
  /** Verdampft sie (hat sie eine Sättigungslinie)? */
  readonly volatile: boolean;
  /** Gemessener Bereich der Stoffwerte (K). */
  readonly range: readonly [number, number];
}

interface Generic {
  readonly rA: number; readonly rB: number;
  readonly cA: number; readonly cB: number;
  readonly kA: number; readonly kB: number;
  readonly mA: number; readonly mB: number; readonly mC: number;
  readonly sigma: number;
  /** h(T) = cA (T − T0) + ½ cB (T² − T0²); hier der feste Teil cA·T0 + ½ cB·T0². */
  readonly h0: number;
}

const others = data.species.slice(3) as readonly LiquidEntry[];
const GEN: readonly (Generic | null)[] = [null, ...others.map((s): Generic => {
  const l = s.liquid;
  const [cA, cB] = l.cp.linear;
  return {
    rA: l.rho.linear[0], rB: l.rho.linear[1],
    cA, cB,
    kA: l.k.linear[0], kB: l.k.linear[1],
    mA: l.mu.vogel[0], mB: l.mu.vogel[1], mC: l.mu.vogel[2],
    sigma: l.sigma.v,
    h0: cA * T0 + 0.5 * cB * T0 * T0
  };
})];

/** Die Flüssigkeiten der Datenbank: Wasser zuerst, dann die weiteren in der Reihenfolge von materials.json. */
export const LIQUIDS: readonly LiquidInfo[] = [
  { id: water.id, name: water.name, short: water.liquid.name, color: water.liquid.color, volatile: true, range: [T0, T0 + 150] },
  ...others.map((s): LiquidInfo => ({ id: s.id, name: s.name, short: s.liquid.name, color: s.liquid.color, volatile: false, range: [s.liquid.range.lo, s.liquid.range.hi] }))
];

/** Index einer Flüssigkeit (−1: unbekannt). */
export function liquidIndex(id: string): number {
  return LIQUIDS.findIndex((l) => l.id === id);
}

const gen = (m: number): Generic => GEN[m] ?? (GEN[1] as Generic);

/** c_p der Flüssigkeit m bei T (J/(kg·K)). */
export function cpLiq(m: number, T: number): number {
  if (m === WATER) return cpL(T);
  const q = gen(m);
  return q.cA + q.cB * T;
}

/** Spezifische Enthalpie der Flüssigkeit m (J/kg, 0 bei 0 °C): das genaue Integral ihrer c_p. */
export function hLiq(m: number, T: number): number {
  if (m === WATER) return hL(T);
  const q = gen(m);
  return q.cA * T + 0.5 * q.cB * T * T - q.h0;
}

/** T (K) der Flüssigkeit m aus ihrer spezifischen Enthalpie — genau (quadratisch, auslöschungsfrei). */
export function tFromHLiq(m: number, h: number): number {
  if (m === WATER) return tFromHL(h);
  const q = gen(m);
  /* ½ cB T² + cA T − c = 0 mit c = h + h0. */
  const c = h + q.h0;
  if (q.cB === 0) return c / q.cA;
  return (2 * c) / (q.cA + Math.sqrt(Math.max(0, q.cA * q.cA + 2 * q.cB * c)));
}

/** Dichte der Flüssigkeit m bei T (kg/m³). */
export function rhoLiq(m: number, T: number): number {
  if (m === WATER) return rhoL(T);
  const q = gen(m);
  return q.rA + q.rB * T;
}

/** Wärmeleitfähigkeit der Flüssigkeit m (W/(m·K)). */
export function kLiq(m: number, T: number): number {
  if (m === WATER) return kL(T);
  const q = gen(m);
  return q.kA + q.kB * T;
}

/** Dynamische Viskosität der Flüssigkeit m (Pa·s) — Vogel (Wasser: IAPWS-Fit, weitere: Fits an ihre Messungen). */
export function muLiq(m: number, T: number): number {
  if (m === WATER) return muL(T);
  const q = gen(m);
  return q.mA * Math.pow(10, q.mB / (Math.max(T, q.mC + 60) - q.mC));
}

/** Oberflächenspannung der Flüssigkeit m gegen Gas (N/m). */
export function sigmaLiq(m: number, T: number): number {
  if (m === WATER) return sigma(T);
  return gen(m).sigma;
}

/** Die Quellen der Datenbank (Schlüssel → Zitat), für die Tafel „O modelu”. */
export const SOURCES: Readonly<Record<string, string>> = data.sources;

/** Standardbildungsenthalpie und -entropie (für M2 gespeichert, in M1 ungenutzt). */
export const THERMO = {
  H2O: water.thermo,
  N2: nitrogen.thermo,
  O2: oxygen.thermo
} as const;
