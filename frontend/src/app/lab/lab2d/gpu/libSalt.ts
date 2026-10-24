/**
 * LABOR 2D (v2) — KOCHSALZ AUF DER GPU (M2b auf dem beschleunigten Weg): die
 * Gesetze von engine/solution.ts in WGSL — dieselben Quellen und Formeln, in
 * f32. Ein Kern bekommt diesen Text, wenn er eine dieser Funktionen ruft
 * (kernel.ts).
 *
 * - Aktivität des Wassers genau nach Pitzer (statt der Tafel der CPU): die
 *   Temperaturform von PHREEQC mit x = T − T_R geschrieben (1/T − 1/T_R =
 *   −x/(T T_R) usw.), damit sich in f32 nichts weghebt — β⁰ auf etwa 1e-6,
 *   der Siedepunkt auf etwa 1e-4 K.
 * - E(T) = e^{a₂t + a₃e^{0,01t}} der Wärmekapazität nach Laliberté als
 *   Tschebyschow-Reihe mit 14 Gliedern über den Messbereich (Abweichung
 *   1e-6; die CPU liest eine Tafel alle 0,5 K, Abweichung 1e-4), I(T) ihr
 *   genaues Integral — h und c_p passen so genau zueinander; ausserhalb des
 *   Bereichs wie die CPU mit dem Randwert.
 * - q_s aus demselben I(T) (so gilt Δ_solH(25 °C) auch hier genau).
 */

import { data, muL } from '../engine/materials';
import { CP_CRYSTAL, M_S, M_W } from '../engine/solution';
import { E_CHARGE, EPS0, K_B, N_A, T0 } from '../engine/units';
import { f } from './lib';

const S = data.solutes[0];
const TR = 298.15;
const fa = (xs: readonly number[]): string => xs.map(f).join(', ');

/* -- E(T) als Tschebyschow-Reihe in x ∈ [−1, 1] und ihr Integral ------------------------------------------ */

const NCH = 14;
const E_LO = S.cp.range.lo;
const E_HI = S.cp.range.hi;
const [A1, A2, A3, A4, A5, A6] = S.cp.laliberte;
const eExact = (T: number): number => Math.exp(A2 * (T - T0) + A3 * Math.exp(0.01 * (T - T0)));
const HALF = 0.5 * (E_HI - E_LO);
/* Koeffizienten aus den Tschebyschow-Gauss-Knoten (a₀ schon halbiert). */
const ACH = new Array<number>(NCH).fill(0);
{
  const M = 64;
  for (let k = 0; k < M; k += 1) {
    const th = (Math.PI * (k + 0.5)) / M;
    const v = eExact(0.5 * (E_HI + E_LO) + HALF * Math.cos(th));
    for (let j = 0; j < NCH; j += 1) ACH[j] += ((2 / M) * v) * Math.cos(j * th);
  }
  ACH[0] /= 2;
}
/* ∫ Σ a_j T_j dx = Σ C_k T_k: C₁ = a₀ − a₂/2, C_k = (a_{k−1} − a_{k+1})/(2k). */
const aAt = (j: number): number => (j < NCH ? ACH[j] : 0);
const ICH = new Array<number>(NCH + 1).fill(0);
ICH[1] = ACH[0] - aAt(2) / 2;
for (let k = 2; k <= NCH; k += 1) ICH[k] = (aAt(k - 1) - aAt(k + 1)) / (2 * k);
const series = (c: readonly number[], x: number): number => {
  let b1 = 0;
  let b2 = 0;
  for (let j = c.length - 1; j >= 1; j -= 1) { const t = 2 * x * b1 - b2 + c[j]; b2 = b1; b1 = t; }
  return x * b1 - b2 + c[0];
};
const E_LOV = series(ACH, -1);
const E_HIV = series(ACH, 1);
const F_M1 = series(ICH, -1);
/** I(T) = ∫_{T₀}^{T} E dT mit der Reihe (unter dem Bereich der Randwert, wie die CPU). */
const intE = (T: number): number => {
  if (T <= E_LO) return E_LOV * (T - T0);
  const I0 = E_LOV * (E_LO - T0);
  if (T >= E_HI) return I0 + HALF * (series(ICH, 1) - F_M1) + E_HIV * (T - E_HI);
  return I0 + HALF * (series(ICH, (2 * T - E_LO - E_HI) / (E_HI - E_LO)) - F_M1);
};
const I_LO = E_LOV * (E_LO - T0);
const I_HIV = intE(E_HI);
const QS = S.dHsol.v / M_S + CP_CRYSTAL * (TR - T0) - 1000 * A1 * intE(TR);

/** Die Reihe ausgerollt (Clenshaw): straight-line WGSL ohne Felder. */
function clenshaw(name: string, c: readonly number[]): string {
  const lines = [`fn ${name}(x: f32) -> f32 {`, '  var b1 = 0.0;', '  var b2 = 0.0;', '  var t = 0.0;'];
  for (let j = c.length - 1; j >= 1; j -= 1) lines.push(`  t = 2.0 * x * b1 - b2 + ${f(c[j])}; b2 = b1; b1 = t;`);
  lines.push(`  return x * b1 - b2 + ${f(c[0])};`, '}');
  return lines.join('\n');
}

/* -- Pitzer ------------------------------------------------------------------------------------------- */

const PZ = S.pitzer;
const COLD = S.pitzerCold;
/** ⅓ (2π N_A)^½ und e²/(4π ε₀ k): A_φ = K_N √ρ_w l_B^{3/2}/3 mit l_B = K_LB/(ε T). */
const K_N = Math.sqrt(2 * Math.PI * N_A);
const K_LB = (E_CHARGE * E_CHARGE) / (4 * Math.PI * EPS0 * K_B);
const SOL = S.solubility.table;
const LD = S.density.laliberte;

export const SALT_WGSL = `
const S_TR: f32 = ${f(TR)};
const S_MS: f32 = ${f(M_S)};
const S_MW: f32 = ${f(M_W)};
const S_NU: f32 = ${f(S.ions.v)};
const PZ_B: f32 = ${f(PZ.b.v)};
const PZ_ALPHA: f32 = ${f(PZ.alpha.v)};
const PZ_COLD: f32 = ${f(COLD.below.v)};
const PZ_B0 = array<f32, 6>(${fa(PZ.b0.a)});
const PZ_B1 = array<f32, 6>(${fa(PZ.b1.a)});
const PZ_C = array<f32, 6>(${fa(PZ.c.a)});
const PZC_B0 = array<f32, 6>(${fa(COLD.b0.a)});
const PZC_B1 = array<f32, 6>(${fa(COLD.b1.a)});
const PZC_C = array<f32, 6>(${fa(COLD.c.a)});
const S_EPS = array<f32, 4>(${fa(S.dielectric.c)});
const S_KN: f32 = ${f(K_N)};
const S_KLB: f32 = ${f(K_LB)};
const SOL_T = array<f32, ${SOL.length}>(${fa(SOL.map((r) => r[0]))});
const SOL_M = array<f32, ${SOL.length}>(${fa(SOL.map((r) => r[1]))});
const LD0: f32 = ${f(LD[0])};
const LD1: f32 = ${f(LD[1])};
const LD2: f32 = ${f(LD[2])};
const LD3: f32 = ${f(LD[3])};
const LD4: f32 = ${f(LD[4])};
const LA1: f32 = ${f(A1)};
const LA4: f32 = ${f(A4)};
const LA5: f32 = ${f(A5)};
const LA6: f32 = ${f(A6)};
const E_LO: f32 = ${f(E_LO)};
const E_HI: f32 = ${f(E_HI)};
const E_LOV: f32 = ${f(E_LOV)};
const E_HIV: f32 = ${f(E_HIV)};
const E_HALF: f32 = ${f(HALF)};
const E_FM1: f32 = ${f(F_M1)};
const E_ILO: f32 = ${f(I_LO)};
const E_IHI: f32 = ${f(I_HIV)};
const S_QS: f32 = ${f(QS)};
const S_DMU: f32 = ${f((S.diffusivity.v * muL(TR)) / TR)};

${clenshaw('eCh', ACH)}
${clenshaw('iCh', ICH)}
/* Die Temperaturform von PHREEQC mit x = T − T_R. */
fn pzT(a: array<f32, 6>, T: f32) -> f32 {
  let x = T - S_TR;
  let s = T + S_TR;
  let iT = 1.0 / (T * S_TR);
  return a[0] - a[1] * x * iT + a[2] * log(T / S_TR) + a[3] * x + a[4] * x * s - a[5] * x * s * iT * iT;
}
fn aPhiS(T: f32) -> f32 {
  let t = T - T0;
  let eps = S_EPS[0] + t * (S_EPS[1] + t * (S_EPS[2] + t * S_EPS[3]));
  let lb = S_KLB / (eps * T);
  return S_KN * sqrt(rhoL(T)) * lb * sqrt(lb) / 3.0;
}
fn osmoticS(T: f32, m: f32) -> f32 {
  if (!(m > 0.0)) { return 1.0; }
  let sm = sqrt(m);
  var b0 = 0.0; var b1 = 0.0; var c = 0.0;
  if (T < PZ_COLD) { b0 = pzT(PZC_B0, T); b1 = pzT(PZC_B1, T); c = pzT(PZC_C, T); }
  else { b0 = pzT(PZ_B0, T); b1 = pzT(PZ_B1, T); c = pzT(PZ_C, T); }
  return 1.0 - aPhiS(T) * sm / (1.0 + PZ_B * sm) + m * (b0 + b1 * exp(-PZ_ALPHA * sm)) + m * m * c;
}
/** Aktivität des Wassers a_w = exp(−ν m φ M_w). */
fn waterAct(T: f32, m: f32) -> f32 {
  if (!(m > 0.0)) { return 1.0; }
  return exp(-S_NU * m * osmoticS(T, m) * S_MW);
}
/** Siedepunkt beim Druck p: a_w(T_b) p_sat(T_b) = p als Festpunkt T ← T_sat(p/a_w(T)). */
fn boilPt(p: f32, m: f32) -> f32 {
  var T = tSat(p);
  if (!(m > 0.0)) { return T; }
  for (var it = 0; it < 6; it++) {
    let Tn = tSat(p / waterAct(T, m));
    let d = Tn - T;
    T = Tn;
    if (abs(d) < 1e-4) { break; }
  }
  return T;
}
/** Molalität und Massenanteil der gesättigten Lösung (Pitzer, Peiper & Busey 1984, linear dazwischen). */
fn satMol(T: f32) -> f32 {
  if (T <= SOL_T[0]) { return SOL_M[0]; }
  for (var k = 1; k < ${SOL.length}; k++) {
    if (T <= SOL_T[k]) { return SOL_M[k - 1] + (SOL_M[k] - SOL_M[k - 1]) * (T - SOL_T[k - 1]) / (SOL_T[k] - SOL_T[k - 1]); }
  }
  return SOL_M[${SOL.length - 1}];
}
fn satFrac(T: f32) -> f32 { let m = satMol(T); return m * S_MS / (1.0 + m * S_MS); }
fn hCrys(T: f32) -> f32 { return CP_CRYSTAL * (T - T0); }
/** Dichte der Lösung (Laliberté 2009). */
fn rhoSol(T: f32, w: f32) -> f32 {
  if (!(w > 0.0)) { return rhoL(T); }
  let t = T - T0;
  let q = t + LD4;
  let app = (LD0 * w + LD1) * exp(1e-6 * q * q) / (w + LD2 + LD3 * t);
  return 1.0 / ((1.0 - w) / rhoL(T) + w / app);
}
fn saltE(T: f32) -> f32 {
  if (T <= E_LO) { return E_LOV; }
  if (T >= E_HI) { return E_HIV; }
  return eCh((2.0 * T - E_LO - E_HI) / (E_HI - E_LO));
}
fn saltI(T: f32) -> f32 {
  if (T <= E_LO) { return E_LOV * (T - T0); }
  if (T >= E_HI) { return E_IHI + E_HIV * (T - E_HI); }
  return E_ILO + E_HALF * (iCh((2.0 * T - E_LO - E_HI) / (E_HI - E_LO)) - E_FM1);
}
fn coefA(w: f32) -> f32 { return 1000.0 * LA1 * w * exp(LA4 * w); }
fn coefB(w: f32) -> f32 { return 1000.0 * LA5 * pow(w, LA6 + 1.0); }
/** Spezifische Enthalpie und c_p der Lösung (reines Wasser: h_l, c_p,l). */
fn hSol(T: f32, w: f32) -> f32 {
  if (!(w > 0.0)) { return hL(T); }
  return (1.0 - w) * hL(T) + w * S_QS + coefA(w) * saltI(T) + coefB(w) * (T - T0);
}
fn cpSol(T: f32, w: f32) -> f32 {
  if (!(w > 0.0)) { return cpL(T); }
  return (1.0 - w) * cpL(T) + coefA(w) * saltE(T) + coefB(w);
}
/** T aus h und w (Newton ab guess; auf 1e-4 K — f32 löst h auf etwa 0,03 J/kg auf). */
fn tFromHSol(h: f32, w: f32, guess: f32) -> f32 {
  if (!(w > 0.0)) { return tFromHL(h); }
  let A = coefA(w);
  let B = coefB(w);
  let base = w * S_QS;
  let ww = 1.0 - w;
  var T = guess;
  if (!(guess > 200.0 && guess < 900.0)) { T = T0 + (h - base) / (4000.0 * ww + 800.0 * w); }
  for (var it = 0; it < 8; it++) {
    let fT = ww * hL(T) + base + A * saltI(T) + B * (T - T0) - h;
    let dT = fT / (ww * cpL(T) + A * saltE(T) + B);
    T -= dT;
    if (abs(dT) < 1e-4) { break; }
  }
  return T;
}
/** Partielle spezifische Enthalpien des gelösten Salzes und des Wassers in der Lösung. */
fn hSaltIn(T: f32, w: f32) -> f32 {
  let e = exp(LA4 * w);
  let ia = 1000.0 * LA1 * e * (w + (1.0 - w) * (1.0 + LA4 * w));
  var ib = 0.0;
  if (w > 0.0) { ib = 1000.0 * LA5 * pow(w, LA6) * (w + (1.0 - w) * (LA6 + 1.0)); }
  return S_QS + ia * saltI(T) + ib * (T - T0);
}
fn hWaterIn(T: f32, w: f32) -> f32 {
  if (!(w > 0.0)) { return hL(T); }
  return hL(T) - 1000.0 * LA1 * LA4 * w * w * exp(LA4 * w) * saltI(T) - 1000.0 * LA5 * LA6 * pow(w, LA6 + 1.0) * (T - T0);
}
/** Diffusionskoeffizient des Salzes (Stokes–Einstein vom Wert bei 25 °C). */
fn saltDiff(T: f32) -> f32 { return S_DMU * T / muL(T); }
/** c_p eines Teilchens (mit Salz: der Lösung). */
fn pCp(mat: u32, T: f32, s: f32, m: f32) -> f32 {
  if (s > 0.0) { return cpSol(T, s / m); }
  return cpLM(mat, T);
}
/** T und ρ eines Teilchens aus seinem h (mit Salz: der Lösung; wie Particles.derive). */
fn pDerive(q: ptr<function, Particle>) {
  let s = (*q).s;
  if (s > 0.0) {
    let w = s / (*q).mass;
    let T = tFromHSol((*q).h, w, (*q).T);
    (*q).T = T;
    (*q).rho = rhoSol(T, w);
    return;
  }
  let mt = matOf((*q).flags);
  let T = tFromHLM(mt, (*q).h);
  (*q).T = T;
  (*q).rho = rhoLM(mt, T);
}
`;

/* SALT_WGSL in Stücke zerlegt: die Konstanten und je Funktion ihr Text (mit dem Kommentar davor) und die Funktionen, die sie ruft. */
const CONSTS: string[] = [];
const FNS = new Map<string, string>();
{
  let comment: string[] = [];
  const lines = SALT_WGSL.split('\n');
  for (let k = 0; k < lines.length; k += 1) {
    const line = lines[k];
    if (line.startsWith('const ')) { CONSTS.push(line); comment = []; continue; }
    if (line.startsWith('/*')) { comment = [line]; continue; }
    const m = /^fn (\w+)\(/.exec(line);
    if (m === null) { if (line.trim() === '') comment = []; continue; }
    const body = [...comment, line];
    /* Einzeiler enden auf ihrer eigenen Zeile. */
    if (!line.trimEnd().endsWith('}')) while (k + 1 < lines.length && lines[k] !== '}') { k += 1; body.push(lines[k]); }
    FNS.set(m[1], body.join('\n'));
    comment = [];
  }
}
const callRe = (name: string): RegExp => new RegExp(`\\b${name}\\s*\\(`);
const DEPS = new Map<string, string[]>([...FNS.entries()].map(([name, code]) => [name, [...FNS.keys()].filter((o) => o !== name && callRe(o).test(code))]));

/** Was ein Kern vom Kochsalz braucht: die Konstanten und die gerufenen Funktionen mit allem, was sie rufen. */
export function saltFor(code: string): string {
  const need = new Set<string>();
  const add = (name: string): void => { if (need.has(name)) return; need.add(name); for (const d of DEPS.get(name) ?? []) add(d); };
  for (const name of FNS.keys()) if (callRe(name).test(code)) add(name);
  if (need.size === 0) return '';
  return [...CONSTS, ...[...FNS.keys()].filter((n) => need.has(n)).map((n) => FNS.get(n) as string)].join('\n');
}
