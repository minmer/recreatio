/**
 * 2026-10-18 — DAS WASSER EINER ZELLE (Chemia): was in einer Zelle des
 * Labors gelöst ist — als Zahlen in einer festen Reihe (`AQ`: Wasser, die
 * starken Ionen, die Vorräte der schwachen Säuren und Basen, Moleküle,
 * Indikatoren), mol je Zelle, in EINEM Feld für alle Zellen der Welt.
 *
 * Fliesst Wasser von Zelle zu Zelle, wandern diese Zahlen mit; trifft
 * Silbernitrat auf Kochsalz, ist die Lösung GENAU DORT übersättigt, wo sie
 * sich mischen — dort fällt AgCl aus, als Wolke im Strahl.
 *
 * <b>Die Wärme</b>: jede Zahl trägt ihre Bildungsenthalpie (`AQ_DHF`, linear —
 * sie wandert mit der Menge und ändert sich nur, wenn eine Reaktion Mengen
 * ändert). Nur was die Formen des Gleichgewichts beitragen (H⁺/OH⁻, HCO₃⁻
 * gegen CO₂, NH₄⁺ gegen NH₃, Komplexe), ist nicht linear: `formHeat` gibt es
 * je Zelle — mischen sich Säure und Lauge, ändert es sich, und das ist die
 * Wärme der Neutralisation.
 */

import {
  COMPLEXES, DISSOLVES, INDICATORS, POOLS, POOL_MEMBER, SALTS, SPECIES, indicatorOf, saltOf,
  type Complex, type PoolId, type Reagent, type Salt
} from './chemData';
import { CX_BY_METAL, copySol, emptySol, formEnthalpy, speciate, type Sol, type Spec } from './chemPh';

const R = 8.314;
const dH = (id: string): number => (SPECIES[id]?.dHf ?? 0) * 1000;
const M = (id: string): number => SPECIES[id]?.M ?? 100;

/* -- Die Reihe der Zahlen ------------------------------------------------------------------------- */

const COMPLEX_IDS = new Set(COMPLEXES.map((c) => c.id));
const IONS: readonly string[] = Object.values(SPECIES)
  .filter((s) => s.phase === 'aq' && s.charge !== undefined && s.id !== 'H+' && s.id !== 'OH-' && POOL_MEMBER[s.id] === undefined && !COMPLEX_IDS.has(s.id))
  .map((s) => s.id);
const MOLECULES = ['H2O2', 'sugar', 'soap', 'ethanol'];

/** Was eine Zelle Wasser enthalten kann, in dieser Reihe (mol; Indikatoren in Tropfen). */
export const AQ: readonly string[] = ['H2O', ...IONS, 'C', 'Ac', 'N', 'S', ...MOLECULES, ...INDICATORS.map((i) => `ind:${i.id}`)];
export const NC = AQ.length;
export const AQI: Readonly<Record<string, number>> = Object.fromEntries(AQ.map((id, i) => [id, i]));
export const WATER = 0;
export const ETHANOL = AQI.ethanol;
const PI: Readonly<Record<PoolId, number>> = { C: AQI.C, Ac: AQI.Ac, N: AQI.N, S: AQI.S };
const IND0 = AQI[`ind:${INDICATORS[0].id}`];

/** cm³ je mol Wasser und Etanol (das Gelöste nimmt keinen Platz ein). */
export const ML_WATER = 18.07;
export const ML_ETHANOL = 58.4;

/** Die Bildungsenthalpie, die eine Zahl mitträgt (J/mol) — ein Vorrat in seiner neutralen Form. */
export const AQ_DHF: Float64Array = (() => {
  const out = new Float64Array(NC);
  AQ.forEach((id, i) => {
    const pool = POOLS.find((p) => p.id === id);
    out[i] = id.startsWith('ind:') ? 0 : pool !== undefined ? dH(pool.forms[pool.neutral]) : dH(id);
  });
  return out;
})();

/** Molare Masse je Zahl (g/mol; ein Vorrat wie seine erste Form). */
export const AQ_M: Float64Array = (() => {
  const out = new Float64Array(NC);
  AQ.forEach((id, i) => {
    const pool = POOLS.find((p) => p.id === id);
    out[i] = id.startsWith('ind:') ? 0 : pool !== undefined ? M(pool.forms[pool.neutral]) : M(id);
  });
  return out;
})();

interface IonInfo { readonly id: string; readonly i: number; readonly z: number; readonly cx: readonly Complex[] | undefined }
const ION_INFO: readonly IonInfo[] = IONS.map((id) => ({ id, i: AQI[id], z: SPECIES[id]?.charge ?? 0, cx: CX_BY_METAL.get(id) }));
const CX_IONS = ION_INFO.filter((x) => x.cx !== undefined);
const SCN = AQI['SCN-'];
/** Was als eigenes Teilchen zählt (Raoult, Gefrierpunkt): alles ausser Wasser, Seife und Indikatoren. */
const PARTICLES: readonly number[] = AQ.map((id, i) => (id === 'H2O' || id === 'soap' || id.startsWith('ind:') ? -1 : i)).filter((i) => i >= 0);

/* -- Mengen einer Zelle --------------------------------------------------------------------------- */

/** Volumen (cm³) des Wassers einer Zelle (`o`: Anfang ihrer Zahlen, Zelle · NC). */
export const aqVolume = (c: Float64Array, o: number): number => c[o] * ML_WATER + c[o + ETHANOL] * ML_ETHANOL;
const liters = (c: Float64Array, o: number): number => aqVolume(c, o) / 1000;

/** Dichte des Wassers bei T (K) — kühles Wasser sinkt, warmes steigt. */
export function waterRho(T: number): number {
  const t = Math.min(100, Math.max(0, T - 273.15));
  return 1 - ((t - 3.98) ** 2 * (t + 283)) / (503570 * (t + 67.26));
}

/** Zähigkeit des Wassers (Pa·s) bei T (K) — nach Vogel: 2,414·10⁻⁵ · 10^(247,8 K/(T − 140 K)); 20 °C: 1,00 mPa·s, 80 °C: 0,355 mPa·s. */
export const waterViscosity = (T: number): number => 2.414e-5 * 10 ** (247.8 / (Math.max(250, T) - 140));
const ETA25 = waterViscosity(298.15);
/** Diffusionskoeffizient in Wasser (cm²/s) bei T — Stokes-Einstein: D ∝ T/η (bei 80 °C gut dreimal so gross wie bei 20 °C). */
export const diffusivity = (T: number, D25 = 1.5e-5): number => D25 * (T / 298.15) * (ETA25 / waterViscosity(T));

/** Dichte der Lösung (g/cm³) — Salzlösung sinkt unter Wasser, warme Lösung steigt. */
export function aqDensity(c: Float64Array, o: number, T: number): number {
  const V = aqVolume(c, o);
  if (V <= 1e-9) return 1;
  let m = 0;
  for (let k = 0; k < IND0; k += 1) m += c[o + k] * (k === WATER ? 18.015 : AQ_M[k]);
  return Math.min(2.2, (m / V) * (waterRho(T) / 0.99823));
}

/** Wie viele der Teilchen Wasser sind (Raoult: Salzwasser verdunstet langsamer und kocht später). */
export function waterShare(c: Float64Array, o: number): number {
  const w = c[o];
  let other = 0;
  for (const k of PARTICLES) other += c[o + k];
  return w / Math.max(1e-15, w + other);
}

/** Gelöste Teilchen je kg Wasser — der Gefrierpunkt sinkt (Eis mit Salz). */
export function molality(c: Float64Array, o: number): number {
  let other = 0;
  for (const k of PARTICLES) if (k !== ETHANOL) other += c[o + k];
  return other / Math.max(1e-12, c[o] * 0.018015);
}

/* -- Das Gleichgewicht einer Zelle ---------------------------------------------------------------- */

/** Die Lösung einer Zelle, wie `speciate` sie braucht (mol/L). */
export function solOf(c: Float64Array, o: number): Sol {
  const s = emptySol();
  const V = liters(c, o);
  s.V = V;
  if (V <= 1e-9) return s;
  for (const info of ION_INFO) {
    const n = c[o + info.i];
    if (n <= 0) continue;
    const conc = n / V;
    s.sid += info.z * conc;
    if (info.cx !== undefined) s.metals.push({ ion: info.id, z: info.z, c: conc, list: info.cx });
  }
  if (c[o + SCN] > 0) s.scn = c[o + SCN] / V;
  s.pool.C = Math.max(0, c[o + PI.C]) / V;
  s.pool.Ac = Math.max(0, c[o + PI.Ac]) / V;
  s.pool.N = Math.max(0, c[o + PI.N]) / V;
  s.pool.S = Math.max(0, c[o + PI.S]) / V;
  return s;
}

export const specOf = (c: Float64Array, o: number, T: number, guess: number | null): Spec => speciate(solOf(c, o), T, guess);

/** Freie Konzentration (mol/L) eines Ions oder einer Form in einer Zelle. */
export function concOf(c: Float64Array, o: number, spec: Spec, id: string): number {
  const V = liters(c, o);
  if (V <= 1e-9) return 0;
  if (id === 'OH-') return spec.oh;
  if (id === 'H+') return spec.h;
  const m = POOL_MEMBER[id];
  if (m !== undefined) return (Math.max(0, c[o + PI[m[0]]]) / V) * (spec.alpha[m[0]][m[1]] ?? 0);
  const k = AQI[id];
  if (k === undefined) return 0;
  const total = Math.max(0, c[o + k]) / V;
  const f = spec.free[id];
  return f === undefined ? total : total * f;
}

/** Ein Komplex (mol/L) in einer Zelle. */
export function complexOf(c: Float64Array, o: number, spec: Spec, cx: string, metal: string): number {
  const V = liters(c, o);
  const k = AQI[metal];
  return V <= 1e-9 || k === undefined ? 0 : (Math.max(0, c[o + k]) / V) * (spec.cx[cx] ?? 0);
}

const POOL_REF: Readonly<Record<PoolId, number>> = Object.fromEntries(POOLS.map((p) => [p.id, dH(p.forms[p.neutral])])) as Record<PoolId, number>;

/** Was die Formen des Gleichgewichts über die lineare Enthalpie hinaus beitragen (J). */
export function formHeat(c: Float64Array, o: number, spec: Spec): number {
  const V = liters(c, o);
  if (V <= 1e-9) return 0;
  const pools = { C: Math.max(0, c[o + PI.C]), Ac: Math.max(0, c[o + PI.Ac]), N: Math.max(0, c[o + PI.N]), S: Math.max(0, c[o + PI.S]) };
  const metals = new Map<string, number>();
  for (const info of CX_IONS) { const n = c[o + info.i]; if (n > 0) metals.set(info.id, n); }
  let e = formEnthalpy(spec, V, pools, metals);
  for (const p of POOLS) e -= pools[p.id] * POOL_REF[p.id];
  return e;
}

/* -- Wie das Wasser aussieht ---------------------------------------------------------------------- */

/** Eine Farbe (#rgb, #rrggbb, rgba(…)) als [r, g, b, a]. */
export function rgba(c: string): [number, number, number, number] {
  if (c.startsWith('#')) {
    const h = c.length === 4 ? c.slice(1).split('').map((x) => x + x).join('') : c.slice(1, 7);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (m === null) return [128, 128, 128, 1];
  const p = m[1].split(',').map((x) => Number(x.trim()));
  return [p[0] ?? 128, p[1] ?? 128, p[2] ?? 128, p[3] ?? 1];
}

/** Die Farbe eines Indikators bei einem pH (zwischen den Stützstellen gemischt). */
export function indicatorColor(stops: readonly (readonly [number, string])[], pH: number): string {
  if (pH <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i += 1) {
    if (pH <= stops[i][0]) {
      const t = (pH - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      const a = rgba(stops[i - 1][1]);
      const b = rgba(stops[i][1]);
      const m = a.map((x, k) => x + (b[k] - x) * t);
      return `rgba(${Math.round(m[0])},${Math.round(m[1])},${Math.round(m[2])},${m[3].toFixed(3)})`;
    }
  }
  return stops[stops.length - 1][1];
}

interface Tinted { readonly i: number; readonly rgb: readonly number[]; readonly tint: number; readonly id: string }
const TINTED: readonly Tinted[] = IONS.flatMap((id) => {
  const s = SPECIES[id];
  return s?.aqColor !== undefined && s.tint !== undefined ? [{ i: AQI[id], rgb: rgba(s.aqColor), tint: s.tint, id }] : [];
});
const TINTED_CX = COMPLEXES.flatMap((c) => {
  const s = SPECIES[c.id];
  return s?.aqColor !== undefined && s.tint !== undefined ? [{ cx: c.id, metal: c.metal, rgb: rgba(s.aqColor), tint: s.tint }] : [];
});

/**
 * Die Farbe des Wassers einer Zelle (r, g, b 0…255, Deckkraft 0…1) nach
 * `out`: farbige Ionen und Komplexe je nach ihrer Konzentration,
 * Indikatoren nach dem pH. Ohne alles: Wasser, blass und durchsichtig.
 */
export function aqLook(c: Float64Array, o: number, spec: Spec, out: Float32Array): void {
  out[0] = 170; out[1] = 208; out[2] = 238; out[3] = 0.16;
  const V = aqVolume(c, o);
  if (V <= 1e-6) return;
  let od = 0;
  let rr = 0;
  let gg = 0;
  let bb = 0;
  const add = (rgb: readonly number[], w: number) => {
    if (!(w > 0)) return;
    const k = w * (rgb[3] ?? 1);
    od += k; rr += rgb[0] * k; gg += rgb[1] * k; bb += rgb[2] * k;
  };
  for (const t of TINTED) if (c[o + t.i] > 0) add(t.rgb, concOf(c, o, spec, t.id) * t.tint);
  for (const t of TINTED_CX) if (c[o + AQI[t.metal]] > 0) add(t.rgb, complexOf(c, o, spec, t.cx, t.metal) * t.tint);
  for (let k = IND0; k < NC; k += 1) {
    const drops = c[o + k];
    if (drops <= 0) continue;
    const ind = indicatorOf(AQ[k].slice(4));
    if (ind !== undefined) add(rgba(indicatorColor(ind.stops, spec.pH)), (drops / V) * 60);
  }
  if (od > 0) {
    const k = 1 - Math.exp(-od * 1.6);
    out[0] = out[0] * (1 - k) + (rr / od) * k;
    out[1] = out[1] * (1 - k) + (gg / od) * k;
    out[2] = out[2] * (1 - k) + (bb / od) * k;
    out[3] = Math.min(0.94, out[3] + k * 0.78);
  }
}

/** Ein Wort für eine Farbe (für die Beobachtungen). */
export function colorWord(r: number, g: number, b: number, a: number): string {
  if (a < 0.3) return 'bezbarwny';
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 510;
  const d = max - min;
  if (d < 28) return l > 0.75 ? 'biały' : l < 0.25 ? 'czarny' : 'szary';
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (l < 0.33 && (h < 50 || h > 330)) return 'brunatny';
  if (h < 15 || h >= 345) return 'czerwony';
  if (h < 40) return l < 0.45 ? 'brunatny' : 'pomarańczowy';
  if (h < 65) return 'żółty';
  if (h < 160) return 'zielony';
  if (h < 200) return 'niebieskozielony';
  if (h < 250) return 'niebieski';
  if (h < 290) return 'fioletowy';
  return 'różowy';
}

export const colorWordOf = (c: string): string => { const [r, g, b] = rgba(c); return colorWord(r, g, b, 1); };

/* -- Salze: Ksp und wie weit es sich löst oder ausfällt --------------------------------------------- */

/** Gut löslich (bildet Kristalle, keinen Niederschlag). */
export const crystalline = (s: Salt): boolean => s.sol !== undefined && s.sol >= 1;
export const basicSalt = (s: Salt): boolean => s.anion === 'OH-' || s.anion === 'CO3-2' || s.anion === 'HCO3-';

const kspCache = new Map<string, number>();

/** Das Löslichkeitsprodukt bei T (K) — nach van 't Hoff mit der Lösungsenthalpie aus den Bildungsenthalpien. */
export function kspOf(s: Salt, T: number): number {
  const key = `${s.solid}@${Math.round(T * 4)}`;
  const hit = kspCache.get(key);
  if (hit !== undefined) return hit;
  const b = s.like !== undefined ? saltOf(s.like) ?? s : s;
  let k0: number;
  let T0: number;
  if (b.ksp !== undefined) { k0 = b.ksp; T0 = 298.15; } else {
    const m = ((b.sol ?? 0) * 10) / (b.nc * M(b.cation) + b.na * M(b.anion));
    k0 = (b.nc * m) ** b.nc * (b.na * m) ** b.na;
    T0 = 293.15;
  }
  const hydrate = basicSalt(b) ? 0 : b.w;
  const h = b.nc * (SPECIES[b.cation]?.dHf ?? Number.NaN) * 1000 + b.na * (SPECIES[b.anion]?.dHf ?? Number.NaN) * 1000 + hydrate * dH('H2O') - (SPECIES[b.solid]?.dHf ?? Number.NaN) * 1000;
  const k = Number.isFinite(h) ? k0 * Math.exp((-h / R) * (1 / T - 1 / T0)) : k0;
  if (kspCache.size > 6000) kspCache.clear();
  kspCache.set(key, k);
  return k;
}

/** Wie viel eines Salzes sich bei T in 100 g Wasser löst (g). */
export function solubility(s: Salt, T: number): number {
  const ksp = kspOf(s, T);
  const m = (ksp / (s.nc ** s.nc * s.na ** s.na)) ** (1 / (s.nc + s.na));
  return (m * (s.nc * M(s.cation) + s.na * M(s.anion))) / 10;
}

type Role = { readonly kind: 'strong' } | { readonly kind: 'cx' } | { readonly kind: 'oh' } | { readonly kind: 'pool'; readonly pool: PoolId; readonly form: number };

const roleOf = (id: string): Role => {
  if (id === 'OH-') return { kind: 'oh' };
  const m = POOL_MEMBER[id];
  if (m !== undefined) return { kind: 'pool', pool: m[0], form: m[1] };
  return CX_BY_METAL.has(id) ? { kind: 'cx' } : { kind: 'strong' };
};

/** Wo ein Ion des Salzes gezählt wird (die Zahl in `AQ`; −1: OH⁻, das niemand zählt). */
const SLOTS = new Map<string, number>();
export const slotOf = (id: string): number => {
  const hit = SLOTS.get(id);
  if (hit !== undefined) return hit;
  const m = POOL_MEMBER[id];
  const k = id === 'OH-' ? -1 : m !== undefined ? PI[m[0]] : AQI[id] ?? -1;
  SLOTS.set(id, k);
  return k;
};

/** Ein Ion des Salzes, wie viel davon in der Zelle ist (mol; beim Vorrat: der ganze Vorrat). */
export const totalOf = (c: Float64Array, o: number, id: string): number => {
  const k = slotOf(id);
  return k < 0 ? 0 : Math.max(0, c[o + k]);
};

/** Q jetzt (mit dem Gleichgewicht von vorhin). */
export const qOf = (c: Float64Array, o: number, spec: Spec, s: Salt): number => concOf(c, o, spec, s.cation) ** s.nc * concOf(c, o, spec, s.anion) ** s.na;

/** Q, wenn sich noch x mol lösten — mit den Anteilen des jetzigen Gleichgewichts (eine Abschätzung, gut weit unter der Sättigung). */
export function qAfter(c: Float64Array, o: number, spec: Spec, s: Salt, x: number): number {
  const V = liters(c, o);
  if (V <= 1e-9) return Infinity;
  const free = (id: string, add: number): number => {
    if (id === 'OH-') return spec.oh;
    const tot = totalOf(c, o, id);
    const f = tot > 1e-15 ? Math.min(1, concOf(c, o, spec, id) / (tot / V)) : 1;
    return (f * (tot + add)) / V;
  };
  return free(s.cation, s.nc * x) ** s.nc * free(s.anion, s.na * x) ** s.na;
}

/**
 * Wie viel (mol) dieses Salzes sich in einer Zelle lösen müsste (+) oder
 * ausfallen (−), damit danach Q = Ksp gilt — höchstens `up` gelöst. Starke
 * Ionen (AgCl, BaSO₄, PbI₂) rechnen ohne pH; wo der pH mitspielt
 * (Hydroxide, Carbonate, Komplexe), jedes Mal das ganze Gleichgewicht.
 */
export function saltShift(c: Float64Array, o: number, T: number, spec: Spec, s: Salt, ksp: number, up: number, simple = false): number {
  const V = liters(c, o);
  if (V <= 1e-9) return 0;
  const cr = roleOf(s.cation);
  const ar = roleOf(s.anion);
  const zc = SPECIES[s.cation]?.charge ?? 1;
  const za = SPECIES[s.anion]?.charge ?? -1;
  const c0 = totalOf(c, o, s.cation) / V;
  const a0 = ar.kind === 'oh' ? 0 : totalOf(c, o, s.anion) / V;
  const lnK = Math.log(ksp);
  const usePh = !simple && (cr.kind !== 'strong' || ar.kind !== 'strong');
  const base = usePh ? solOf(c, o) : null;
  let guess = spec.pH;

  const f = (x: number): number => {
    const dc = (s.nc * x) / V;
    const da = (s.na * x) / V;
    const cT = c0 + dc;
    const aT = a0 + da;
    if (cT <= 0 || (ar.kind !== 'oh' && aT <= 0)) return -Infinity;
    if (base === null) return s.nc * Math.log(cT) + s.na * Math.log(aT) - lnK;
    const sol = copySol(base);
    if (cr.kind === 'pool') sol.pool[cr.pool] += dc; else {
      sol.sid += zc * dc;
      if (cr.kind === 'cx') {
        const m = sol.metals.find((x2) => x2.ion === s.cation);
        if (m !== undefined) m.c += dc; else sol.metals.push({ ion: s.cation, z: zc, c: dc, list: CX_BY_METAL.get(s.cation) ?? [] });
      }
    }
    if (ar.kind === 'pool') sol.pool[ar.pool] += da;
    else if (ar.kind !== 'oh') { sol.sid += za * da; if (s.anion === 'SCN-') sol.scn += da; }
    const sp = speciate(sol, T, guess);
    guess = sp.pH;
    const cf = cr.kind === 'pool' ? cT * sp.alpha[cr.pool][cr.form] : cr.kind === 'cx' ? cT * (sp.free[s.cation] ?? 1) : cT;
    const af = ar.kind === 'oh' ? sp.oh : ar.kind === 'pool' ? aT * sp.alpha[ar.pool][ar.form] : aT;
    if (cf <= 0 || af <= 0) return -Infinity;
    return s.nc * Math.log(cf) + s.na * Math.log(af) - lnK;
  };

  const f0 = f(0);
  if (Math.abs(f0) < 1e-6) return 0;
  let lo: number;
  let hi: number;
  if (f0 > 0) {
    lo = -Math.min((c0 * V) / s.nc, ar.kind === 'oh' ? Infinity : (a0 * V) / s.na) * (1 - 1e-12);
    hi = 0;
  } else {
    if (up <= 0) return 0;
    if (f(up) <= 0) return up;
    lo = 0;
    hi = up;
  }
  /* f steigt mit x: falsche Position (Illinois) — mit dem pH gekoppelt kostet jeder Wert ein Gleichgewicht, Halbieren bräuchte dreissig. */
  const span = hi - lo;
  let flo = f0 > 0 ? -Infinity : f0;
  let fhi = f0 > 0 ? f0 : f(hi);
  let side = 0;
  for (let i = 0; i < 60 && hi - lo > span * 1e-10; i += 1) {
    let mid = (lo + hi) / 2;
    if (Number.isFinite(flo) && Number.isFinite(fhi) && fhi > flo) {
      const m = (lo * fhi - hi * flo) / (fhi - flo);
      if (m > lo && m < hi) mid = m;
    }
    const fm = f(mid);
    if (Math.abs(fm) < 1e-7) return mid;
    if (fm > 0) { hi = mid; fhi = fm; if (side === 1) flo *= 0.5; side = 1; }
    else { lo = mid; flo = fm; if (side === -1) fhi *= 0.5; side = -1; }
  }
  return (lo + hi) / 2;
}

/**
 * Die Ionen eines Salzes in die Zelle (+, es löst sich) oder heraus (−, es
 * fällt) — mit dem Kristall- bzw. Hydroxidwasser. Gibt die Änderung der
 * linearen Enthalpie des Wassers zurück (J).
 */
export function moveSalt(c: Float64Array, o: number, s: Salt, x: number): number {
  let dh = 0;
  const kc = slotOf(s.cation);
  if (kc >= 0) { c[o + kc] = Math.max(0, c[o + kc] + s.nc * x); dh += s.nc * x * AQ_DHF[kc]; }
  const ka = slotOf(s.anion);
  if (ka >= 0) { c[o + ka] = Math.max(0, c[o + ka] + s.na * x); dh += s.na * x * AQ_DHF[ka]; }
  c[o] = Math.max(0, c[o] + s.w * x);
  dh += s.w * x * AQ_DHF[WATER];
  return dh;
}

/**
 * Darf ein Salz ohne das Gleichgewicht gerechnet werden? Ja, wenn beide Ionen
 * stark sind — oder das Kation Komplexe bilden könnte, aber kein Ligand da
 * ist (AgCl ohne Ammoniak, Zn²⁺ in saurer Lösung).
 */
export function simpleSalt(c: Float64Array, o: number, spec: Spec, s: Salt): boolean {
  const cr = roleOf(s.cation);
  const ar = roleOf(s.anion);
  if (ar.kind !== 'strong') return false;
  if (cr.kind === 'strong') return true;
  if (cr.kind !== 'cx') return false;
  for (const x of CX_BY_METAL.get(s.cation) ?? []) {
    if (x.ligand === 'NH3' && c[o + PI.N] > 1e-12) return false;
    if (x.ligand === 'SCN-' && c[o + SCN] > 1e-12) return false;
    if (x.ligand === 'OH-' && spec.pH > 7.5) return false;
  }
  return true;
}

/** Die Salze, die in einer Zelle ausfallen könnten (Kation und Anion sind da) — die Kandidaten. */
export function saltsPresent(c: Float64Array, o: number): Salt[] {
  const out: Salt[] = [];
  for (const s of SALTS) {
    if (s.like !== undefined) continue;
    if (totalOf(c, o, s.cation) <= 0) continue;
    if (s.anion !== 'OH-' && totalOf(c, o, s.anion) <= 0) continue;
    out.push(s);
  }
  return out;
}

/* -- Was in der Flasche ist ----------------------------------------------------------------------- */

/** Ein Reagenz aus der Flasche: je cm³ Zahlen, Gleichgewicht und Formenwärme. */
export interface Bottle {
  readonly comp: Float64Array;
  readonly spec: Spec;
  readonly hf: number;
}

const bottles = new Map<string, Bottle>();

/**
 * Eine Flüssigkeit aus dem Regal, je cm³ (Lösungen, Wasser, Etanol,
 * Indikatoren: 1 cm³ = 20 Tropfen) — klar: was in ihr übersättigt wäre, ist
 * längst abfiltriert (CuSO₄ hydrolysiert ein wenig), es bleibt die Lösung.
 */
export function bottleOf(r: Reagent): Bottle | null {
  const hit = bottles.get(r.id);
  if (hit !== undefined) return hit;
  const ml = 100;
  const c = new Float64Array(NC);
  if (r.form === 'indicator') {
    c[WATER] = ml / 18.015;
    const k = AQI[`ind:${r.id}`];
    if (k !== undefined) c[k] = ml * 20;
  } else if (r.solute === 'H2O') c[WATER] = (ml * 0.998) / 18.015;
  else if (r.solute === 'ethanol' && r.form === 'liquid') c[ETHANOL] = (ml * 0.789) / 46.07;
  else if (r.form === 'solution') {
    const conc = r.conc ?? 0;
    const n = (conc * ml) / 1000;
    const parts = r.solute === undefined ? [] : DISSOLVES[r.solute] ?? [];
    const soluteMass = n * parts.reduce((a, [id, k]) => a + (id === 'water' ? 18.015 : AQ_M[AQI[id] ?? 0] || M(id)) * k, 0);
    c[WATER] = Math.max(0, ml * (1 + 0.03 * conc) - soluteMass) / 18.015;
    const put = (id: string, x: number) => { if (id === 'water') c[WATER] += x; else if (AQI[id] !== undefined) c[AQI[id]] += x; };
    for (const [id, k] of parts) put(id, n * k);
    for (const [solute, conc2] of r.also ?? []) for (const [id, k] of DISSOLVES[solute] ?? []) put(id, ((conc2 * ml) / 1000) * k);
  } else return null;
  const T = 298.15;
  let spec = specOf(c, 0, T, null);
  for (let pass = 0; pass < 2; pass += 1) {
    for (const s of saltsPresent(c, 0)) {
      const ksp = kspOf(s, T);
      if (qOf(c, 0, spec, s) <= ksp) continue;
      const x = saltShift(c, 0, T, spec, s, ksp, 0);
      if (x < 0) { moveSalt(c, 0, s, x); spec = specOf(c, 0, T, spec.pH); }
    }
  }
  /* Je cm³ der Flasche genau so viel Gelöstes, wie draufsteht: das Wasser wird so angepasst, dass das Volumen stimmt. */
  c[WATER] = Math.max(0, c[WATER] - (aqVolume(c, 0) - ml) / ML_WATER);
  const hf = formHeat(c, 0, spec);
  const per = new Float64Array(NC);
  for (let k = 0; k < NC; k += 1) per[k] = c[k] / ml;
  const b: Bottle = { comp: per, spec, hf: hf / ml };
  bottles.set(r.id, b);
  return b;
}
