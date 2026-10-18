/**
 * 2026-10-18 — DER pH UND WAS IN EINER LÖSUNG WIRKLICH SCHWIMMT (Chemia):
 * aus dem, was gezählt wird (starke Ionen, die Summen der schwachen Säuren
 * und Basen, die Metalle, die Komplexe bilden), folgt alles andere — EIN
 * Gleichgewicht für jede Lösung, keine Reaktion einzeln hingeschrieben.
 *
 * <b>Die Ladung entscheidet</b>: H⁺ und OH⁻ zählt niemand. Gibt man NaOH ins
 * Wasser, kommt Na⁺ dazu; die Lösung muss neutral bleiben, also gibt es
 * jetzt mehr OH⁻ als H⁺. Gesucht wird der pH, bei dem
 *
 *   [H⁺] − [OH⁻] + Σ z·c (starke Ionen) + Σ Ladung der Vorräte + Σ Ladung der Hydroxo-Komplexe = 0.
 *
 * Die Funktion fällt mit dem pH — eine Halbierung findet ihn sicher (auch
 * für Puffer, Ammoniak, Carbonate, und wenn Cu²⁺ mit Ammoniak tiefblau wird).
 *
 * <b>Temperatur</b>: Kw und die Ka folgen aus denselben Bildungsenthalpien
 * wie die Wärme (van 't Hoff) — heisses Wasser hat einen pH unter 7, und
 * das stimmt.
 */

import { COMPLEXES, POOLS, SPECIES, type Complex, type PoolId } from './chemData';

const R = 8.314;
const T25 = 298.15;
const dH = (id: string): number => (SPECIES[id]?.dHf ?? 0) * 1000;
const DH_W = dH('H2O');
const DH_OH = dH('OH-');

/* -- Konstanten bei einer Temperatur ------------------------------------------------------------ */

export interface Consts {
  readonly Kw: number;
  /** Ka je Stufe eines Vorrats. */
  readonly Ka: Readonly<Record<PoolId, readonly number[]>>;
}

const vantHoff = (k25: number, h: number, T: number): number => k25 * Math.exp((-h / R) * (1 / T - 1 / T25));

const STEP_H: Readonly<Record<PoolId, readonly number[]>> = Object.fromEntries(POOLS.map((p) => [p.id, p.pKa.map((_, i) =>
  dH(p.forms[i + 1]) - dH(p.forms[i]) - (p.water[i + 1] - p.water[i]) * DH_W)])) as Record<PoolId, number[]>;

const constCache = new Map<number, Consts>();

export function consts(T: number): Consts {
  const key = Math.round(T * 10);
  let c = constCache.get(key);
  if (c === undefined) {
    const t = key / 10;
    c = {
      Kw: vantHoff(1.0e-14, DH_OH - DH_W, t),
      Ka: Object.fromEntries(POOLS.map((p) => [p.id, p.pKa.map((pk, i) => vantHoff(10 ** -pk, STEP_H[p.id][i], t))])) as Record<PoolId, number[]>
    };
    if (constCache.size > 4000) constCache.clear();
    constCache.set(key, c);
  }
  return c;
}

/* -- Was gezählt wird --------------------------------------------------------------------------- */

/** Ein Metall, das Komplexe bildet (Cu²⁺ mit NH₃, Zn²⁺ mit OH⁻ …) — `c`: gesamt (mol/L). */
export interface CxMetal {
  readonly ion: string;
  readonly z: number;
  c: number;
  readonly list: readonly Complex[];
}

/** Die Lösung, wie das Gleichgewicht sie braucht (mol/L). */
export interface Sol {
  /** Liter Lösung. */
  V: number;
  /** Σ z·c der starken Ionen (Komplexbildner mit ihrer freien Ladung, SCN⁻ mit −1). */
  sid: number;
  pool: Record<PoolId, number>;
  metals: CxMetal[];
  /** SCN⁻ gesamt. */
  scn: number;
}

/** Welche Metalle Komplexe bilden (und mit welchem Liganden). */
export const CX_BY_METAL: ReadonlyMap<string, readonly Complex[]> = (() => {
  const m = new Map<string, Complex[]>();
  for (const c of COMPLEXES) m.set(c.metal, [...(m.get(c.metal) ?? []), c]);
  return m;
})();

export const emptySol = (): Sol => ({ V: 0, sid: 0, pool: { C: 0, Ac: 0, N: 0, S: 0 }, metals: [], scn: 0 });

export const copySol = (s: Sol): Sol => ({ V: s.V, sid: s.sid, pool: { ...s.pool }, metals: s.metals.map((m) => ({ ...m })), scn: s.scn });

/* -- Das Ergebnis -------------------------------------------------------------------------------- */

export interface Spec {
  readonly pH: number;
  readonly h: number;
  readonly oh: number;
  /** Anteile der Formen jedes Vorrats (beim Ammoniak: NH₄⁺ und alles NH₃, frei und gebunden). */
  readonly alpha: Readonly<Record<PoolId, readonly number[]>>;
  /** Freies NH₃ und freies SCN⁻ (mol/L). */
  readonly nh3: number;
  readonly scnFree: number;
  /** Anteil frei bzw. je Komplex, je Metall. */
  readonly free: Readonly<Record<string, number>>;
  readonly cx: Readonly<Record<string, number>>;
}

export const NEUTRAL: Spec = { pH: 7, h: 1e-7, oh: 1e-7, alpha: { C: [1, 0, 0], Ac: [1, 0], N: [1, 0], S: [1, 0, 0] }, nh3: 0, scnFree: 0, free: {}, cx: {} };

/* -- Das Gleichgewicht ----------------------------------------------------------------------- */

/** Anteile einer mehrprotonigen Säure bei [H⁺] = h. */
function fractions(Ka: readonly number[], h: number): number[] {
  const w = [1];
  for (let i = 0; i < Ka.length; i += 1) w.push(w[i] * Ka[i] / h);
  const s = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / s);
}

/** Wie viel eines Liganden die Metalle binden, wenn L frei ist — und ihre Anteile. */
function bound(metals: readonly CxMetal[], ligand: Complex['ligand'], L: number): number {
  let b = 0;
  for (const m of metals) {
    let sum = 1;
    let nsum = 0;
    for (const c of m.list) {
      if (c.ligand !== ligand) continue;
      const t = 10 ** c.logB * L ** c.n;
      sum += t;
      nsum += c.n * t;
    }
    b += (m.c * nsum) / sum;
  }
  return b;
}

/** Freier Ligand aus seiner Bilanz: total = frei·(1 + h/Ka) + gebunden(frei) — halbiert im Logarithmus. */
function freeLigand(total: number, metals: readonly CxMetal[], ligand: Complex['ligand'], extra: number): number {
  if (total <= 0) return 0;
  let lo = -30;
  let hi = Math.log10(total / extra);
  for (let i = 0; i < 44; i += 1) {
    const mid = (lo + hi) / 2;
    const L = 10 ** mid;
    if (L * extra + bound(metals, ligand, L) > total) hi = mid; else lo = mid;
  }
  return 10 ** ((lo + hi) / 2);
}

const hasLigand = (metals: readonly CxMetal[], ligand: Complex['ligand']) => metals.some((m) => m.c > 0 && m.list.some((c) => c.ligand === ligand));

/** Die Ladungsbilanz bei [H⁺] = h (fällt mit dem pH). */
function charge(sol: Sol, h: number, K: Consts, scnFree: number): number {
  const oh = K.Kw / h;
  let q = h - oh + sol.sid;
  for (const p of POOLS) {
    const c = sol.pool[p.id];
    if (c <= 0) continue;
    if (p.id === 'N') {
      const ka = K.Ka.N[0];
      if (hasLigand(sol.metals, 'NH3')) {
        const L = freeLigand(c, sol.metals, 'NH3', 1 + h / ka);
        q += (L * h) / ka;
      } else q += (c * h) / (h + ka);
      continue;
    }
    const a = fractions(K.Ka[p.id], h);
    for (let i = 1; i < a.length; i += 1) q += c * a[i] * p.charges[i];
  }
  for (const m of sol.metals) {
    if (m.c <= 0) continue;
    let sum = 1;
    let zq = 0;
    for (const c of m.list) {
      if (c.ligand === 'OH-') {
        const t = 10 ** c.logB * oh ** c.n;
        sum += t;
        zq += t * -c.n;
      } else if (c.ligand === 'SCN-') sum += 10 ** c.logB * scnFree ** c.n;
      else sum += 0;
    }
    if (zq !== 0) q += (m.c * zq) / sum;
  }
  return q;
}

/** Das Gleichgewicht einer Lösung — `guess`: der pH von vorhin (schneller). */
export function speciate(sol: Sol, T: number, guess: number | null = null): Spec {
  const K = consts(T);
  const scnFree = sol.scn > 0 ? freeLigand(sol.scn, sol.metals, 'SCN-', 1) : 0;
  const q = (pH: number) => charge(sol, 10 ** -pH, K, scnFree);
  let lo = -2;
  let hi = 16;
  if (guess !== null && Number.isFinite(guess)) {
    const a = Math.max(-2, guess - 1.2);
    const b = Math.min(16, guess + 1.2);
    if (q(a) > 0 && q(b) < 0) { lo = a; hi = b; }
  }
  for (let i = 0; i < 40 && hi - lo > 2e-6; i += 1) {
    const mid = (lo + hi) / 2;
    if (q(mid) > 0) lo = mid; else hi = mid;
  }
  const pH = (lo + hi) / 2;
  const h = 10 ** -pH;
  const oh = K.Kw / h;
  const alpha = {} as Record<PoolId, number[]>;
  let nh3 = 0;
  for (const p of POOLS) {
    if (p.id === 'N') {
      const c = sol.pool.N;
      const ka = K.Ka.N[0];
      if (c > 0 && hasLigand(sol.metals, 'NH3')) {
        nh3 = freeLigand(c, sol.metals, 'NH3', 1 + h / ka);
        const nh4 = (nh3 * h) / ka;
        alpha.N = [nh4 / c, 1 - nh4 / c];
      } else {
        alpha.N = [h / (h + ka), ka / (h + ka)];
        nh3 = c * alpha.N[1];
      }
      continue;
    }
    alpha[p.id] = fractions(K.Ka[p.id], h);
  }
  const free: Record<string, number> = {};
  const cx: Record<string, number> = {};
  for (const m of sol.metals) {
    const terms = m.list.map((c) => 10 ** c.logB * (c.ligand === 'OH-' ? oh : c.ligand === 'NH3' ? nh3 : scnFree) ** c.n);
    const sum = 1 + terms.reduce((a, b) => a + b, 0);
    free[m.ion] = 1 / sum;
    m.list.forEach((c, i) => { cx[c.id] = terms[i] / sum; });
  }
  return { pH, h, oh, alpha, nh3, scnFree, free, cx };
}

/* -- Die Wärme der Formen ------------------------------------------------------------------------ */

/** Je Komplex: wie viel Wärme seine Bildung bringt (J/mol), über die Formen seiner Teile hinaus. */
const CX_H: ReadonlyMap<string, number> = new Map(COMPLEXES.map((c) => {
  const own = SPECIES[c.id]?.dHf;
  const lig = c.ligand === 'NH3' ? dH('NH3(aq)') : dH(c.ligand);
  return [c.id, own === null || own === undefined ? 0 : own * 1000 - dH(c.metal) - c.n * lig];
}));

/**
 * DIE ENTHALPIE DER FORMEN (J): was H⁺, OH⁻, HCO₃⁻, NH₄⁺ … gegenüber den
 * gezählten Formen (Wasser, CO₂, NH₃ …) mitbringen. Ändert ein Gleichgewicht
 * seine Formen — Säure trifft Lauge —, ändert sich diese Zahl, und das ist
 * die Wärme der Neutralisation. `pools`: mol je Vorrat; `metals`: mol je Komplexbildner.
 */
export function formEnthalpy(spec: Spec, V: number, pools: Readonly<Record<PoolId, number>>, metals: ReadonlyMap<string, number>): number {
  let e = spec.oh * V * (DH_OH - DH_W);
  for (const p of POOLS) {
    const n = pools[p.id];
    if (n <= 0) continue;
    const a = spec.alpha[p.id];
    if (p.id === 'N') { e += n * (a[0] * dH('NH4+') + a[1] * dH('NH3(aq)')); continue; }
    for (let i = 0; i < a.length; i += 1) e += n * a[i] * (dH(p.forms[i]) - p.water[i] * DH_W);
  }
  for (const [ion, n] of metals) {
    for (const c of CX_BY_METAL.get(ion) ?? []) {
      const f = spec.cx[c.id] ?? 0;
      if (f <= 0) continue;
      e += n * f * ((CX_H.get(c.id) ?? 0) + (c.ligand === 'OH-' ? c.n * (DH_OH - DH_W) : 0));
    }
  }
  return e;
}

/** Wie sauer: ein Wort für den pH. */
export function phWord(pH: number): string {
  if (pH < 3) return 'silnie kwasowy';
  if (pH < 6.5) return 'kwasowy';
  if (pH <= 7.5) return 'obojętny';
  if (pH <= 11) return 'zasadowy';
  return 'silnie zasadowy';
}
