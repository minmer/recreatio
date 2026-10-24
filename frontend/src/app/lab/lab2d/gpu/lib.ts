/**
 * LABOR 2D (v2) — DIE GEMEINSAME WGSL-BIBLIOTHEK des beschleunigten Wegs:
 * Konstanten und Stoffwerte aus materials.json (dieselben Quellen und Formeln
 * wie engine/materials.ts und engine/if97.ts, hier in f32), die Strukturen
 * der GPU-Speicher und kleine Helfer. Jeder Kern bekommt diesen Text vor seinen
 * eigenen (kernel.ts).
 *
 * Auf der GPU rechnet alles in f32 (WGSL kennt kein f64): die Stoffwerte bis
 * etwa 1e-6 relativ — IF97 Region 4 gibt T_sat damit auf etwa 1e-5 K.
 */

import { ALPHA_RATE } from '../engine/bubbleState';
import { data, H_EXT } from '../engine/materials';
import { G0, P_ATM, R_GAS, T0 } from '../engine/units';
import { REG_STRIDE, SLOTS_WGSL } from './slots';

/** Eine Zahl als WGSL-f32-Literal. */
export function f(x: number): string {
  if (!Number.isFinite(x)) throw new Error(`not a finite constant: ${x}`);
  const s = Math.abs(x) >= 1e-4 && Math.abs(x) < 1e7 ? String(x) : x.toExponential(9);
  return /[.eE]/.test(s) ? s : `${s}.0`;
}

const fa = (xs: readonly number[]): string => xs.map(f).join(', ');

const water = data.species[0];
const nitrogen = data.species[1];
const oxygen = data.species[2];
const CP_TABLE = water.liquid.cp.table;
const CP_T = CP_TABLE.map((r) => r[0]);
const CP_V = CP_TABLE.map((r) => r[1]);
const CP_H: number[] = [CP_V[0] * (CP_T[0] - T0)];
for (let k = 1; k < CP_TABLE.length; k += 1) CP_H.push(CP_H[k - 1] + 0.5 * (CP_V[k] + CP_V[k - 1]) * (CP_T[k] - CP_T[k - 1]));
const [CPV0, CPV1, CPV_T] = water.vapour.cp.linear;
const T100 = T0 + 100;
const hL100 = (() => {
  let k = 0;
  while (k < CP_T.length - 2 && T100 >= CP_T[k + 1]) k += 1;
  const d = T100 - CP_T[k];
  const s = (CP_V[k + 1] - CP_V[k]) / (CP_T[k + 1] - CP_T[k]);
  return CP_H[k] + CP_V[k] * d + 0.5 * s * d * d;
})();
const HV100 = hL100 + water.saturation.hlv100.v;
const solids = data.solids;

/** Sonderwert „keine Zelle“, „kein Gebiet“, „keine Blase“. */
export const NONE = 0xffffffff;

/**
 * Die einheitlichen Parameter (uniform) — die Reihenfolge muss zu
 * `writeParams` in state.ts passen (44 Wörter). n0: Zellen des Lösers mit
 * Geisterrand ((nx + 2)(ny + 2)); theta: Kontaktwinkel des Prüfstands (≤ 0:
 * der des Werkstoffs).
 */
export const PARAMS_WGSL = `
struct Params {
  nx: u32, ny: u32, n: u32, nu: u32,
  nv: u32, nf: u32, pcap: u32, bcap: u32,
  nsites: u32, nreg: u32, nheat: u32, n0: u32,
  dx: f32, depth: f32, vcell: f32, aface: f32,
  invdx: f32, boxw: f32, boxh: f32, dtmax: f32,
  gy: f32, pref: f32, pamb: f32, rhoamb: f32,
  tamb: f32, hext: f32, tol: f32, liquidPower: f32,
  ambN2: f32, ambO2: f32, ambH2O: f32, ambH: f32,
  yN2: f32, yO2: f32, yH2O: f32, tsatAmb: f32,
  openL: u32, openR: u32, openB: u32, openT: u32,
  sealed: u32, harness: u32, theta: f32, pad0: u32,
}`;
export const PARAMS_WORDS = 44;

/** Ein Wasserteilchen (Feld eines Speicherpuffers; 26 Wörter). */
export const PARTICLE_WGSL = `
struct Particle {
  x: f32, y: f32, vx: f32, vy: f32,
  c00: f32, c01: f32, c10: f32, c11: f32,
  mass: f32, h: f32, T: f32, rho: f32,
  dvp: f32, flags: u32, id: u32, bi: i32,
  bj: i32,
  wt: array<f32, 9>,
}`;
export const PARTICLE_WORDS = 26;

/** Eine Blase (29 Wörter). */
export const BUBBLE_WGSL = `
struct Bubble {
  x: f32, y: f32, z: f32, vx: f32,
  vy: f32, mN: f32, mO: f32, mV: f32,
  H: f32, age: f32, site: i32, r: f32,
  V: f32, pb: f32, pv: f32, Tb: f32,
  dmdt: f32, ux0: f32, uy0: f32, id: u32,
  alive: u32,
  force: array<f32, 8>,
}`;
export const BUBBLE_WORDS = 29;

/** Eine Kavität (8 Wörter). */
export const SITE_WGSL = `
struct Site {
  cell: u32, fluid: u32, dir: u32, bubble: u32,
  r: f32, s: f32, z: f32, pad: f32,
}`;
export const SITE_WORDS = 8;

/** Eine Stufe des Mehrgitters: Grösse, Zellkante in feinsten Zellen (h) und die Anfänge ihrer Felder in den grossen Puffern (mgF: f32, mgU: u32). */
export const LEVEL_WGSL = `
struct Level {
  nx: u32, ny: u32, stride: u32, size: u32,
  ax: u32, ay: u32, dH: u32, dDx: u32,
  dDy: u32, diag: u32, inv: u32, x: u32,
  b: u32, h: u32, gx: u32, gy: u32,
  gDx: u32, gDy: u32, eDx: u32, eDy: u32,
  area: u32, ox: u32, oy: u32, act: u32,
  pIdx: u32, pW: u32, lv: u32, xp: u32,
  pad1: u32, pad2: u32, pad3: u32, pad4: u32,
}
struct LevelPair { F: Level, C: Level }
struct Iter { k: u32, p0: u32, p1: u32, p2: u32 }
struct SolveCfg { tolsq: f32, it: u32, cap: u32, res: u32 }
struct Sub { s: u32, p0: u32, p1: u32, p2: u32 }`;
export const LEVEL_WORDS = 32;

/** Konstanten und Stoffwerte. */
const CONSTANTS = `
const GAS: u32 = 0u;
const LIQUID: u32 = 1u;
const SOLID: u32 = 2u;
const NONE: u32 = 0xffffffffu;
const T0: f32 = ${f(T0)};
const R_GAS: f32 = ${f(R_GAS)};
const P_ATM: f32 = ${f(P_ATM)};
const G0: f32 = ${f(G0)};
const PI: f32 = 3.14159265358979;
const M_N2: f32 = ${f(nitrogen.molarMass.v)};
const M_O2: f32 = ${f(oxygen.molarMass.v)};
const M_H2O: f32 = ${f(water.molarMass.v)};
const CP_N2: f32 = ${f(nitrogen.gas.cp.v)};
const CP_O2: f32 = ${f(oxygen.gas.cp.v)};
const CPV0: f32 = ${f(CPV0)};
const CPV1: f32 = ${f(CPV1)};
const CPV_T: f32 = ${f(CPV_T)};
const T100: f32 = ${f(T100)};
const HV100: f32 = ${f(HV100)};
const NCP: i32 = ${CP_TABLE.length};
const CP_T = array<f32, ${CP_TABLE.length}>(${fa(CP_T)});
const CP_V = array<f32, ${CP_TABLE.length}>(${fa(CP_V)});
const CP_H = array<f32, ${CP_TABLE.length}>(${fa(CP_H)});
const KELL = array<f32, 7>(${fa(water.liquid.kell.c)});
const KL = array<f32, 3>(${fa(water.liquid.k.poly)});
const VA: f32 = ${f(water.liquid.mu.vogel[0])};
const VB: f32 = ${f(water.liquid.mu.vogel[1])};
const VC: f32 = ${f(water.liquid.mu.vogel[2])};
const ST_B: f32 = ${f(water.surfaceTension.B)};
const ST_b: f32 = ${f(water.surfaceTension.b)};
const ST_MU: f32 = ${f(water.surfaceTension.mu)};
const T_CRIT: f32 = ${f(water.saturation.Tc.v)};
const RHO_CRIT: f32 = ${f(water.saturation.rhoc.v)};
const N97 = array<f32, 10>(${fa(water.saturation.if97.n)});
const RVC = array<f32, 6>(${fa(water.saturation.vapourDensity.c)});
const KV: f32 = ${f(water.vapour.k.v)};
const MUV: f32 = ${f(water.vapour.mu.v)};
const KN = array<f32, 3>(${fa(nitrogen.gas.k.power)});
const KO = array<f32, 3>(${fa(oxygen.gas.k.power)});
const MN = array<f32, 3>(${fa(nitrogen.gas.mu.sutherland)});
const MO = array<f32, 3>(${fa(oxygen.gas.mu.sutherland)});
const DV0: f32 = ${f(data.vapourInAir.D0.v)};
const DVT0: f32 = ${f(data.vapourInAir.T0.v)};
const DVE: f32 = ${f(data.vapourInAir.exponent.v)};
const NSOL: u32 = ${solids.length}u;
const S_RHO = array<f32, ${solids.length}>(${fa(solids.map((s) => s.rho.v))});
const S_CP = array<f32, ${solids.length}>(${fa(solids.map((s) => s.cp.v))});
const S_K = array<f32, ${solids.length}>(${fa(solids.map((s) => s.k.v))});
const S_THETA = array<f32, ${solids.length}>(${fa(solids.map((s) => s.contactAngle.v))});
const DRIFT_GAIN: f32 = 0.1;
const DRIFT_DT: f32 = 5e-4;
const RHO_MIN: f32 = 0.05;
const MIN_MASS: f32 = 1e-3;
const FRITZ: f32 = 0.0208;
const C_A: f32 = 0.5;
const AGE_STEP: f32 = 1.0;
const ALPHA_RATE: f32 = ${f(ALPHA_RATE)};
const REG_STRIDE: u32 = ${REG_STRIDE}u;
const EMPTY_FACE: f32 = 1e-9;
const H_EXT0: f32 = ${f(H_EXT)};
`;

/** Stoffwerte (wie engine/materials.ts, in f32). */
const MATERIALS = `
fn cpSeg(T: f32) -> i32 {
  if (T < CP_T[0]) { return -1; }
  if (T >= CP_T[NCP - 1]) { return NCP - 1; }
  var k = clamp(i32(floor((T - T0) / 10.0)), 0, NCP - 2);
  loop { if (k > 0 && T < CP_T[k]) { k -= 1; } else { break; } }
  loop { if (k < NCP - 2 && T >= CP_T[k + 1]) { k += 1; } else { break; } }
  return k;
}
fn cpL(T: f32) -> f32 {
  let k = cpSeg(T);
  if (k < 0) { return CP_V[0]; }
  if (k == NCP - 1) { return CP_V[NCP - 1]; }
  return CP_V[k] + (CP_V[k + 1] - CP_V[k]) * (T - CP_T[k]) / (CP_T[k + 1] - CP_T[k]);
}
fn hL(T: f32) -> f32 {
  let k = cpSeg(T);
  if (k < 0) { return CP_H[0] + CP_V[0] * (T - CP_T[0]); }
  if (k == NCP - 1) { return CP_H[NCP - 1] + CP_V[NCP - 1] * (T - CP_T[NCP - 1]); }
  let d = T - CP_T[k];
  let s = (CP_V[k + 1] - CP_V[k]) / (CP_T[k + 1] - CP_T[k]);
  return CP_H[k] + CP_V[k] * d + 0.5 * s * d * d;
}
fn tFromHL(h: f32) -> f32 {
  if (h < CP_H[0]) { return CP_T[0] + (h - CP_H[0]) / CP_V[0]; }
  if (h >= CP_H[NCP - 1]) { return CP_T[NCP - 1] + (h - CP_H[NCP - 1]) / CP_V[NCP - 1]; }
  var k = clamp(i32(floor(h / 41900.0)), 0, NCP - 2);
  loop { if (k > 0 && h < CP_H[k]) { k -= 1; } else { break; } }
  loop { if (k < NCP - 2 && h >= CP_H[k + 1]) { k += 1; } else { break; } }
  let s = (CP_V[k + 1] - CP_V[k]) / (CP_T[k + 1] - CP_T[k]);
  let e = h - CP_H[k];
  let b = CP_V[k];
  return CP_T[k] + 2.0 * e / (b + sqrt(max(0.0, b * b + 2.0 * s * e)));
}
fn rhoL(T: f32) -> f32 {
  let t = T - T0;
  return (KELL[0] + t * (KELL[1] + t * (KELL[2] + t * (KELL[3] + t * (KELL[4] + t * KELL[5]))))) / (1.0 + KELL[6] * t);
}
fn kL(T: f32) -> f32 {
  let t = clamp(T - T0, 0.0, 150.0);
  return KL[0] + t * (KL[1] + t * KL[2]);
}
fn muL(T: f32) -> f32 {
  return VA * exp2(VB / (max(T, VC + 60.0) - VC) * 3.321928094887362);
}
fn sigmaW(T: f32) -> f32 {
  let tau = max(0.0, 1.0 - T / T_CRIT);
  return ST_B * pow(tau, ST_MU) * (1.0 + ST_b * tau);
}
fn cpV(T: f32) -> f32 { return CPV0 + CPV1 * (T - CPV_T); }
fn hV(T: f32) -> f32 {
  let a = T - CPV_T;
  let b = T100 - CPV_T;
  return HV100 + CPV0 * (T - T100) + 0.5 * CPV1 * (a * a - b * b);
}
fn hN2(T: f32) -> f32 { return CP_N2 * (T - T0); }
fn hO2(T: f32) -> f32 { return CP_O2 * (T - T0); }
fn gasTemperature(mN: f32, mO: f32, mV: f32, H: f32) -> f32 {
  let A = mN * CP_N2 + mO * CP_O2;
  let b100 = T100 - CPV_T;
  let a = 0.5 * mV * CPV1;
  let b = A + mV * CPV0;
  if (b <= 0.0) { return T0; }
  let c = A * (CPV_T - T0) + mV * (HV100 + CPV0 * (CPV_T - T100) - 0.5 * CPV1 * b100 * b100) - H;
  let disc = b * b - 4.0 * a * c;
  return CPV_T + (-2.0 * c) / (b + sqrt(max(disc, 0.0)));
}
fn gasHeatCapacity(mN: f32, mO: f32, mV: f32, mF: f32, T: f32) -> f32 {
  var c = mN * CP_N2 + mO * CP_O2 + mV * cpV(T);
  if (mF > 0.0) { c += mF * cpL(T); }
  return c;
}
fn gasEnthalpy(mN: f32, mO: f32, mV: f32, mF: f32, T: f32) -> f32 {
  return mN * hN2(T) + mO * hO2(T) + mV * hV(T) + mF * hL(T);
}
fn kN2(T: f32) -> f32 { return KN[0] * pow(max(T, 150.0) / KN[1], KN[2]); }
fn kO2(T: f32) -> f32 { return KO[0] * pow(max(T, 150.0) / KO[1], KO[2]); }
fn sutherland(s0: f32, s1: f32, s2: f32, T: f32) -> f32 {
  let t = max(T, 150.0);
  return s0 * pow(t / s1, 1.5) * ((s1 + s2) / (t + s2));
}
fn kMix(mN: f32, mO: f32, mV: f32, T: f32) -> f32 {
  let m = mN + mO + mV;
  if (m <= 0.0) { return kN2(T); }
  return (mN * kN2(T) + mO * kO2(T) + mV * KV) / m;
}
fn muMix(mN: f32, mO: f32, mV: f32, T: f32) -> f32 {
  let m = mN + mO + mV;
  let a = sutherland(MN[0], MN[1], MN[2], T);
  if (m <= 0.0) { return a; }
  return (mN * a + mO * sutherland(MO[0], MO[1], MO[2], T) + mV * MUV) / m;
}
fn diffVapour(T: f32, p: f32) -> f32 {
  return DV0 * pow(clamp(T, 150.0, 1150.0) / DVT0, DVE) * (P_ATM / p);
}
fn pSat(Tin: f32) -> f32 {
  let t = clamp(Tin, 273.15, T_CRIT);
  let th = t + N97[8] / (t - N97[9]);
  let a = th * th + N97[0] * th + N97[1];
  let b = N97[2] * th * th + N97[3] * th + N97[4];
  let c = N97[5] * th * th + N97[6] * th + N97[7];
  let x = (2.0 * c) / (-b + sqrt(b * b - 4.0 * a * c));
  return x * x * x * x * 1e6;
}
fn tSat(pin: f32) -> f32 {
  let pp = clamp(pin, 611.213, 22.064e6);
  let beta = sqrt(sqrt(pp / 1e6));
  let e = beta * beta + N97[2] * beta + N97[5];
  let ff = N97[0] * beta * beta + N97[3] * beta + N97[6];
  let g = N97[1] * beta * beta + N97[4] * beta + N97[7];
  let d = (2.0 * g) / (-ff - sqrt(ff * ff - 4.0 * e * g));
  let s = N97[9] + d;
  return (s - sqrt(s * s - 4.0 * (N97[8] + N97[9] * d))) / 2.0;
}
fn rhoVapourSat(Tin: f32) -> f32 {
  let t = clamp(Tin, 273.15, T_CRIT);
  let tau = 1.0 - t / T_CRIT;
  let s = pow(max(tau, 1e-12), 1.0 / 6.0);
  let s2 = s * s;
  let s4 = s2 * s2;
  let s8 = s4 * s4;
  let s18 = s8 * s8 * s2;
  let s37 = s18 * s18 * s;
  let s71 = s37 * s18 * s8 * s8;
  return RHO_CRIT * exp(RVC[0] * s2 + RVC[1] * s4 + RVC[2] * s8 + RVC[3] * s18 + RVC[4] * s37 + RVC[5] * s71);
}
fn solidRho(s: u32) -> f32 { return S_RHO[min(s, NSOL) - 1u]; }
fn solidCp(s: u32) -> f32 { return S_CP[min(s, NSOL) - 1u]; }
fn solidK(s: u32) -> f32 { return S_K[min(s, NSOL) - 1u]; }
fn solidTheta(s: u32) -> f32 { return S_THETA[min(s, NSOL) - 1u]; }
`;

/** Kleine Helfer: Gewichte des quadratischen B-Splines und Indizes. */
const HELPERS = `
/** Basis i0 und Gewichte des quadratischen B-Splines für s (in Zellen, Knoten bei ganzen Zahlen). */
fn bsplineBase(s: f32) -> i32 { return i32(floor(s - 0.5)); }
fn bsplineW(s: f32, i0: i32) -> vec3<f32> {
  let fx = s - f32(i0);
  let a = 1.5 - fx;
  let c = fx - 0.5;
  return vec3<f32>(0.5 * a * a, 0.75 - (fx - 1.0) * (fx - 1.0), 0.5 * c * c);
}
/** Ein einzelnes B-Spline-Gewicht für den Abstand d (in Zellen). */
fn bspline1(d: f32) -> f32 {
  let a = abs(d);
  if (a < 0.5) { return 0.75 - a * a; }
  if (a < 1.5) { let b = 1.5 - a; return 0.5 * b * b; }
  return 0.0;
}
fn sq(x: f32) -> f32 { return x * x; }
`;

/** Die ganze Bibliothek (vor jedem Kern). */
export const LIB = [PARAMS_WGSL, PARTICLE_WGSL, BUBBLE_WGSL, SITE_WGSL, LEVEL_WGSL, CONSTANTS, SLOTS_WGSL, MATERIALS, HELPERS].join('\n');
