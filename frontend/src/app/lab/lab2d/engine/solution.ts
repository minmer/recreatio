/**
 * LABOR 2D (v2) — LÖSUNGEN (M2b, SANDBOX.md §5): Kochsalz in Wasser.
 *
 * Ein Wasserteilchen trägt sein gelöstes Salz im ersten Stoffplatz
 * (Particles.spc = NACL, smass = s); seine Masse m ist Wasser plus Salz, sein
 * h die spezifische Enthalpie der Lösung, w = s/m der Massenanteil. Reines
 * Wasser (s = 0) geht überall den Weg von M1 (dieselben Zahlen).
 *
 * <b>Eine Grösse für alle kolligativen Eigenschaften</b>: die Aktivität des
 * Wassers a_w = exp(−ν m φ M_w) aus dem osmotischen Koeffizienten nach Pitzer
 * (1:1-Elektrolyt; Parameter und ihre Temperaturform aus PHREEQC pitzer.dat,
 * unter 0 °C der Satz von Spencer, Møller & Weare 1990 aus frezchem.dat;
 * A_φ aus der Dielektrizitätszahl nach Malmberg & Maryott und der Dichte nach
 * Kell):
 *   φ = 1 − A_φ √m/(1 + b√m) + m (β⁰ + β¹ e^{−α√m}) + m² C^φ.
 * Daraus — und aus nichts sonst —
 *   - der Dampfdruck über der Lösung p_v = a_w p_sat(T) (Verdunsten, Blasen),
 *   - der Siedepunkt: a_w(T_b) p_sat(T_b) = p,
 *   - der Gefrierpunkt: ln a_w(T_f) = (M_w/R) ∫_{T_m}^{T_f} Δh_m(T)/T² dT mit
 *     Δh_m(T) = Δh_m + Δc_p (T − T_m) (Eis nach IAPWS R10-06).
 *
 * <b>Stoffwerte der Lösung</b> nach Laliberté (2009): Dichte
 * 1/ρ = (1 − w)/ρ_w + w/ρ_app(T, w); Wärmekapazität c_p = (1 − w) c_p,w +
 * w c_app(T, w) mit c_app = a₁ e^{a₂t + a₃e^{0,01t} + a₄w} + a₅ w^{a₆}
 * (kJ/(kg·K), t in °C). Die Enthalpie ist ihr genaues Integral:
 *   h(T, w) = (1 − w) h_w(T) + w q_s + A(w) I(T) + B(w) (T − T₀),
 *   A = 1000 a₁ w e^{a₄w}, B = 1000 a₅ w^{a₆+1}, I(T) = ∫_{T₀}^{T} e^{a₂t + a₃e^{0,01t}} dT,
 * q_s die Enthalpie des gelösten Salzes bei 0 °C über dem Kristall bei 0 °C
 * (aus der Lösungsenthalpie bei 25 °C, NBS, und demselben c_app). Wasser, das
 * verdampft oder kondensiert, trägt die partielle spezifische Enthalpie
 * h̄_w = h − w ∂h/∂w (die übrige Lösung behält ihre Temperatur);
 * auskristallisierendes Salz geht mit h_Kristall in die Kruste, die
 * Kristallisationswärme bleibt in der Flüssigkeit.
 */

import { tSat } from './if97';
import { cpL, data, hL, muL, rhoL, tFromHL } from './materials';
import { E_CHARGE, EPS0, K_B, N_A, R_GAS, T0 } from './units';

type Lang3 = { readonly pl: string; readonly de: string; readonly en: string };

const S = data.solutes[0];
const W = data.species[0];

/** Molmassen von Wasser und Kochsalz (kg/mol). */
export const M_W = W.molarMass.v;
export const M_S = S.molarMass.v;
/** Ionen je Formeleinheit (Na⁺, Cl⁻). */
const NU = S.ions.v;

/** Kennung des Kochsalzes im Stoffplatz der Teilchen (0: kein gelöster Stoff). */
export const NACL = 1;

export interface SoluteInfo {
  readonly id: string;
  readonly name: Lang3;
  readonly short: Lang3;
  /** Farbe des Kristalls (Kruste). */
  readonly color: string;
}

export const SOLUTES: readonly SoluteInfo[] = data.solutes.map((s) => ({ id: s.id, name: s.name, short: s.short, color: s.solid.color }));

/** Index eines gelösten Stoffs (−1: unbekannt); im Stoffplatz der Teilchen steht Index + 1. */
export function soluteIndex(id: string): number {
  return SOLUTES.findIndex((s) => s.id === id);
}

/* -- Zusammensetzung -------------------------------------------------------------------------------- */

/** Molalität (mol je kg Wasser) zum Massenanteil w = m_Salz/(m_Wasser + m_Salz). */
export function molality(w: number): number {
  return w > 0 ? w / ((1 - w) * M_S) : 0;
}

/** Massenanteil zur Molalität m. */
export function massFraction(m: number): number {
  return m > 0 ? (m * M_S) / (1 + m * M_S) : 0;
}

/* -- Aktivität des Wassers (Pitzer) ----------------------------------------------------------------- */

const TR = 298.15;
const PZ = S.pitzer;
const B0 = PZ.b0.a;
const B1 = PZ.b1.a;
const CPHI = PZ.c.a;
const PB = PZ.b.v;
const ALPHA = PZ.alpha.v;
/* Unter 0 °C der Satz von Spencer, Møller & Weare (1990), der bis −60 °C gilt: die Parameter von pitzer.dat sind dort extrapoliert. */
const COLD = S.pitzerCold;
const T_COLD = COLD.below.v;

/** Die Temperaturform von PHREEQC: P = a₀ + a₁(1/T − 1/T_R) + a₂ ln(T/T_R) + a₃(T − T_R) + a₄(T² − T_R²) + a₅(1/T² − 1/T_R²). */
function pitzerT(a: readonly number[], T: number): number {
  return a[0] + a[1] * (1 / T - 1 / TR) + a[2] * Math.log(T / TR) + a[3] * (T - TR) + a[4] * (T * T - TR * TR) + a[5] * (1 / (T * T) - 1 / (TR * TR));
}

const EPS = S.dielectric.c;

/** Dielektrizitätszahl des Wassers — Malmberg & Maryott (1956), t in °C (0–100 °C gemessen). */
export function dielectric(T: number): number {
  const t = T - T0;
  return EPS[0] + t * (EPS[1] + t * (EPS[2] + t * EPS[3]));
}

/** Debye–Hückel-Steigung des osmotischen Koeffizienten A_φ = ⅓ (2π N_A ρ_w)^½ (e²/(4π ε₀ ε k T))^{3/2} ((kg/mol)^½). */
export function aPhi(T: number): number {
  const lb = (E_CHARGE * E_CHARGE) / (4 * Math.PI * EPS0 * dielectric(T) * K_B * T);
  return (Math.sqrt(2 * Math.PI * N_A * rhoL(T)) * lb * Math.sqrt(lb)) / 3;
}

/** Osmotischer Koeffizient φ bei T (K) und Molalität m (mol/kg). */
export function osmotic(T: number, m: number): number {
  if (!(m > 0)) return 1;
  const sm = Math.sqrt(m);
  const cold = T < T_COLD;
  const b0 = pitzerT(cold ? COLD.b0.a : B0, T);
  const b1 = pitzerT(cold ? COLD.b1.a : B1, T);
  const c = pitzerT(cold ? COLD.c.a : CPHI, T);
  return 1 - (aPhi(T) * sm) / (1 + PB * sm) + m * (b0 + b1 * Math.exp(-ALPHA * sm)) + m * m * c;
}

/** Aktivität des Wassers a_w = exp(−ν m φ M_w) — genau (für Tafel, Gefrierpunkt und Tests). */
export function waterActivity(T: number, m: number): number {
  return m > 0 ? Math.exp(-NU * m * osmotic(T, m) * M_W) : 1;
}

/*
 * Tafel für die Schleife (je flüssiger Zelle und Schritt gefragt): a_w von
 * 240 bis 460 K in Schritten von 1 K und von 0 bis 9 mol/kg in Schritten von
 * 0,05 mol/kg, bilinear gelesen (Abweichung unter 1e-6, im Siedepunkt unter
 * 1e-4 K); erst beim ersten Salz angelegt.
 */
const AW_TLO = 240;
const AW_NT = 221;
const AW_DM = 0.05;
const AW_NM = 181;
let awTab: Float64Array | null = null;

function awTable(): Float64Array {
  if (awTab !== null) return awTab;
  const t = new Float64Array(AW_NT * AW_NM);
  for (let i = 0; i < AW_NT; i += 1) for (let k = 0; k < AW_NM; k += 1) t[i * AW_NM + k] = waterActivity(AW_TLO + i, k * AW_DM);
  awTab = t;
  return t;
}

/** a_w aus der Tafel (über 9 mol/kg genau). */
export function waterActivityFast(T: number, m: number): number {
  if (!(m > 0)) return 1;
  const y = m / AW_DM;
  if (y >= AW_NM - 1) return waterActivity(T, m);
  const tab = awTable();
  let x = T - AW_TLO;
  if (!(x > 0)) x = 0;
  else if (x > AW_NT - 1.000001) x = AW_NT - 1.000001;
  const i = x | 0;
  const k = y | 0;
  const fx = x - i;
  const fy = y - k;
  const o = i * AW_NM + k;
  const a = tab[o] + fy * (tab[o + 1] - tab[o]);
  const b = tab[o + AW_NM] + fy * (tab[o + AW_NM + 1] - tab[o + AW_NM]);
  return a + fx * (b - a);
}

/** Siedepunkt der Lösung beim Druck p (K): a_w(T_b) p_sat(T_b) = p, als Festpunkt T ← T_sat(p/a_w(T)) (a_w hängt kaum von T ab). */
export function boilingPoint(p: number, m: number): number {
  let T = tSat(p);
  if (!(m > 0)) return T;
  for (let it = 0; it < 8; it += 1) {
    const Tn = tSat(p / waterActivityFast(T, m));
    const d = Tn - T;
    T = Tn;
    if (Math.abs(d) < 1e-8) break;
  }
  return T;
}

/* -- Gefrierpunkt (Eis nach IAPWS R10-06) ------------------------------------------------------------ */

const FUS = W.fusion;
/** Schmelzpunkt des Eises bei Normaldruck (K), Schmelzenthalpie (J/kg), c_p und Dichte des Eises. */
export const T_MELT = FUS.T.v;
export const H_MELT = FUS.h.v;
export const CP_ICE = FUS.cpIce.v;
export const RHO_ICE = FUS.rhoIce.v;

/** ln a_w des Wassers im Gleichgewicht mit Eis bei T: (M_w/R)[(Δh − Δc_p T_m)(1/T_m − 1/T) + Δc_p ln(T/T_m)]. */
function iceLnA(T: number): number {
  const dcp = cpL(T_MELT) - CP_ICE;
  return (M_W / R_GAS) * ((H_MELT - dcp * T_MELT) * (1 / T_MELT - 1 / T) + dcp * Math.log(T / T_MELT));
}

/** Eutektikum von Eis und Hydrohalit (NaCl·2H₂O): Temperatur (K) und Massenanteil — Bodnar (1993). */
export const T_EUTECTIC = S.eutectic.T.v;
export const W_EUTECTIC = S.eutectic.w.v;

/**
 * Gefrierpunkt der Lösung der Molalität m (K): ln a_w(T_f, m) = ln a_Eis(T_f)
 * (Newton). Stärkere Lösungen als das Eutektikum scheiden beim Abkühlen erst
 * Hydrohalit ab (nicht modelliert) und erstarren am Eutektikum ganz: dann
 * dessen Temperatur.
 */
export function freezingPoint(m: number): number {
  if (!(m > 0)) return T_MELT;
  if (massFraction(m) >= W_EUTECTIC) return T_EUTECTIC;
  const g = (T: number): number => Math.log(waterActivity(T, m)) - iceLnA(T);
  let T = T_MELT + (Math.log(waterActivity(T_MELT, m)) * R_GAS * T_MELT * T_MELT) / (M_W * H_MELT);
  for (let it = 0; it < 30; it += 1) {
    const f = g(T);
    const d = (g(T + 1e-3) - g(T - 1e-3)) / 2e-3;
    const dT = f / d;
    T -= dT;
    if (!Number.isFinite(T)) return T_MELT;
    if (Math.abs(dT) < 1e-9) break;
  }
  return T;
}

/* -- Löslichkeit ------------------------------------------------------------------------------------ */

const SOL = S.solubility.table;

/** Molalität der gesättigten Lösung bei T (mol/kg) — Pitzer, Peiper & Busey (1984), Tab. 5, linear dazwischen; ausserhalb 0–150 °C der Randwert. */
export function satMolality(T: number): number {
  if (T <= SOL[0][0]) return SOL[0][1];
  for (let k = 1; k < SOL.length; k += 1) {
    if (T <= SOL[k][0]) {
      const [t0, m0] = SOL[k - 1];
      const [t1, m1] = SOL[k];
      return m0 + ((m1 - m0) * (T - t0)) / (t1 - t0);
    }
  }
  return SOL[SOL.length - 1][1];
}

/** Massenanteil der gesättigten Lösung bei T. */
export function satFraction(T: number): number {
  return massFraction(satMolality(T));
}

/* -- Kristall --------------------------------------------------------------------------------------- */

/** Dichte (kg/m³) und c_p (J/(kg·K)) des Kristalls (Steinsalz). */
export const RHO_CRYSTAL = S.solid.rho.v;
export const CP_CRYSTAL = S.solid.cp.v;

/** Spezifische Enthalpie des Kristalls (J/kg, 0 bei 0 °C, wie die Feststoffe). */
export function hCrystal(T: number): number {
  return CP_CRYSTAL * (T - T0);
}

/* -- Dichte und Enthalpie der Lösung (Laliberté) ------------------------------------------------------ */

const LD = S.density.laliberte;

/** Scheinbare Dichte des gelösten Salzes (kg/m³) — Laliberté (2009). */
function rhoApp(T: number, w: number): number {
  const t = T - T0;
  const q = t + LD[4];
  return ((LD[0] * w + LD[1]) * Math.exp(1e-6 * q * q)) / (w + LD[2] + LD[3] * t);
}

/** Dichte der Lösung (kg/m³): 1/ρ = (1 − w)/ρ_w(T) + w/ρ_app(T, w), ρ_w nach Kell. */
export function rhoSol(T: number, w: number): number {
  if (!(w > 0)) return rhoL(T);
  return 1 / ((1 - w) / rhoL(T) + w / rhoApp(T, w));
}

const LC = S.cp.laliberte;
const A1 = LC[0];
const A2 = LC[1];
const A3 = LC[2];
const A4 = LC[3];
const A5 = LC[4];
const A6 = LC[5];
/*
 * E(T) = e^{a₂t + a₃e^{0,01t}} auf Stützstellen alle 0,5 K im Messbereich
 * (1,5–120 °C), stückweise linear (Abweichung unter 1e-4), ausserhalb der
 * Randwert (die Doppelexponentialfunktion wüchse sonst ohne Mass); I(T) ist
 * ihr genaues Integral ab 0 °C — c_p und h passen so genau zueinander.
 */
const E_LO = S.cp.range.lo;
const E_HI = S.cp.range.hi;
const E_STEP = 0.5;
const E_N = Math.round((E_HI - E_LO) / E_STEP) + 1;
const E_V = new Float64Array(E_N);
const E_I = new Float64Array(E_N);
for (let k = 0; k < E_N; k += 1) {
  const t = E_LO + k * E_STEP - T0;
  E_V[k] = Math.exp(A2 * t + A3 * Math.exp(0.01 * t));
}
E_I[0] = E_V[0] * (E_LO - T0);
for (let k = 1; k < E_N; k += 1) E_I[k] = E_I[k - 1] + 0.5 * (E_V[k - 1] + E_V[k]) * E_STEP;

function eAt(T: number): number {
  if (T <= E_LO) return E_V[0];
  if (T >= E_HI) return E_V[E_N - 1];
  const x = (T - E_LO) / E_STEP;
  const k = Math.min(E_N - 2, x | 0);
  return E_V[k] + (x - k) * (E_V[k + 1] - E_V[k]);
}

function intE(T: number): number {
  if (T <= E_LO) return E_V[0] * (T - T0);
  if (T >= E_HI) return E_I[E_N - 1] + E_V[E_N - 1] * (T - E_HI);
  const x = (T - E_LO) / E_STEP;
  const k = Math.min(E_N - 2, x | 0);
  const d = (x - k) * E_STEP;
  return E_I[k] + E_V[k] * d + (0.5 * (E_V[k + 1] - E_V[k]) * d * d) / E_STEP;
}

const coefA = (w: number): number => 1000 * A1 * w * Math.exp(A4 * w);
const coefB = (w: number): number => 1000 * A5 * Math.pow(w, A6 + 1);

/**
 * q_s: Enthalpie des gelösten Salzes bei 0 °C (unendlich verdünnt) über dem
 * Kristall bei 0 °C (J/kg Salz) — so, dass bei 25 °C h̄_s − h_Kristall =
 * Δ_solH/M_s gilt (NBS: +3,883 kJ/mol); h̄_s(T, 0) = q_s + 1000 a₁ I(T).
 */
const QS = S.dHsol.v / M_S + hCrystal(TR) - 1000 * A1 * intE(TR);

/** Spezifische Enthalpie der Lösung (J/kg; reines Wasser: h_l). */
export function hSol(T: number, w: number): number {
  if (!(w > 0)) return hL(T);
  return (1 - w) * hL(T) + w * QS + coefA(w) * intE(T) + coefB(w) * (T - T0);
}

/** c_p der Lösung (J/(kg·K)) — die Ableitung von hSol nach T. */
export function cpSol(T: number, w: number): number {
  if (!(w > 0)) return cpL(T);
  return (1 - w) * cpL(T) + coefA(w) * eAt(T) + coefB(w);
}

/** T der Lösung aus h und w (Newton ab guess, etwa der letzten Temperatur des Teilchens). */
export function tFromHSol(h: number, w: number, guess: number): number {
  if (!(w > 0)) return tFromHL(h);
  const A = coefA(w);
  const B = coefB(w);
  const base = w * QS;
  const ww = 1 - w;
  let T = guess > 200 && guess < 900 ? guess : T0 + (h - base) / (4000 * ww + 800 * w);
  /* Auf 1e-8 K genau: weit unter dem, was das Teilchen speichert (T in Float32); der Zustand ist h. */
  for (let it = 0; it < 30; it += 1) {
    const f = ww * hL(T) + base + A * intE(T) + B * (T - T0) - h;
    const dT = f / (ww * cpL(T) + A * eAt(T) + B);
    T -= dT;
    if (Math.abs(dT) < 1e-8) break;
  }
  return T;
}

/** Partielle spezifische Enthalpie des gelösten Salzes h̄_s = h + (1 − w) ∂h/∂w (J/kg) — mit ihr wandert Salz zwischen Lösungen (exchange.ts). */
export function hSaltIn(T: number, w: number): number {
  const e = Math.exp(A4 * w);
  const ia = 1000 * A1 * e * (w + (1 - w) * (1 + A4 * w));
  const ib = w > 0 ? 1000 * A5 * Math.pow(w, A6) * (w + (1 - w) * (A6 + 1)) : 0;
  return QS + ia * intE(T) + ib * (T - T0);
}

const D25 = S.diffusivity.v;
const MU25 = muL(TR);

/** Diffusionskoeffizient des Salzes in Wasser (m²/s): der Wert bei 25 °C, nach Stokes–Einstein D ∝ T/μ_w(T) übertragen. */
export function saltDiffusivity(T: number): number {
  return (D25 * (T / TR) * MU25) / muL(T);
}

/** Partielle spezifische Enthalpie des Wassers in der Lösung h̄_w = h − w ∂h/∂w (J/kg) — mit ihr verlässt Wasser die Lösung oder kommt hinzu. */
export function hWaterIn(T: number, w: number): number {
  if (!(w > 0)) return hL(T);
  return hL(T) - 1000 * A1 * A4 * w * w * Math.exp(A4 * w) * intE(T) - 1000 * A5 * A6 * Math.pow(w, A6 + 1) * (T - T0);
}
