/**
 * PARTIKEL-LABOR — DIE STOFFDATENBANK (`species.json`): jede Zahl trägt ihre
 * Quelle. Hier wird sie typisiert und für die Schleifen der Engine in flache
 * Tabellen gelegt (je Stoff und Phase), damit kein Schritt ein Objekt anfasst.
 *
 * Bezugspunkt der Enthalpie: H = 0 bei 0 °C in der Bezugsphase des Stoffes
 * (Wasser flüssig, Gase gasförmig, Werkstoffe fest). Wasserdampf hängt nur von
 * T ab (ideales Gas), so folgt die Verdampfungswärme bei einer anderen
 * Siedetemperatur aus dem Kirchhoffschen Satz.
 */

import data from './species.json';
import { GAS, LIQUID, MMHG, R_GAS, SOLID, T0, type PhaseId } from './units';

export interface Num { readonly v: number; readonly src: string }
export interface Names { readonly pl: string; readonly de: string; readonly en: string }

interface PhaseData {
  readonly name: Names;
  readonly density?: Num | { readonly kell: readonly number[]; readonly src: string };
  readonly cp: Num;
  readonly k: Num | { readonly poly: readonly number[]; readonly src: string };
  readonly viscosity?: Num;
  readonly diffusion?: Num;
  readonly color: string;
}

interface Antoine { readonly A: number; readonly B: number; readonly C: number; readonly from: number; readonly to: number; readonly src: string }

export interface SpeciesData {
  readonly id: string;
  readonly formula: string;
  readonly kind: 'substance' | 'material';
  readonly name: Names;
  readonly molarMass?: Num;
  readonly phases: { readonly solid?: PhaseData; readonly liquid?: PhaseData; readonly gas?: PhaseData };
  readonly melt?: { readonly T: Num; readonly L: Num };
  readonly boil?: { readonly T: Num; readonly L: Num; readonly antoine: readonly Antoine[] };
  readonly nucleation?: { readonly site: Num; readonly bulk: Num };
  readonly surfaceTension?: Num;
  readonly surface?: { readonly sites: Num; readonly contactAngle: Num };
  readonly thermo?: Readonly<Record<string, { readonly dHf: Num; readonly S: Num }>>;
}

interface SpeciesFile {
  readonly format: string;
  readonly version: number;
  readonly sources: Readonly<Record<string, string>>;
  readonly gasMap: { readonly lo: Num; readonly hi: Num; readonly min: Num; readonly max: Num };
  readonly air: Readonly<Record<string, Num>>;
  readonly species: readonly SpeciesData[];
}

const FILE = data as unknown as SpeciesFile;

export const SOURCES: Readonly<Record<string, string>> = FILE.sources;
export const SPECIES: readonly SpeciesData[] = FILE.species;
export const SPECIES_COUNT = SPECIES.length;

const INDEX = new Map(SPECIES.map((s, i) => [s.id, i]));
/** Der Platz eines Stoffes in den Tabellen (−1: unbekannt). */
export const spIndex = (id: string): number => INDEX.get(id) ?? -1;

const PHASE_KEYS = ['solid', 'liquid', 'gas'] as const;
const phaseOf = (s: SpeciesData, p: PhaseId): PhaseData | undefined => s.phases[PHASE_KEYS[p]];

/* -- Flache Tabellen (je Stoff, je Stoff × Phase) ---------------------------------------------------- */

/** Molmasse in kg/mol (0 bei Werkstoffen ohne Formel). */
export const MOLAR = Float64Array.from(SPECIES, (s) => s.molarMass?.v ?? 0);
/** Ob der Stoff diese Phase hat (Stoff·3 + Phase). */
export const HAS_PHASE = Uint8Array.from({ length: SPECIES_COUNT * 3 }, (_, k) => (phaseOf(SPECIES[Math.floor(k / 3)], (k % 3) as PhaseId) ? 1 : 0));
/** Wärmekapazität c_p in J/(kg·K) (Stoff·3 + Phase). */
export const CP = Float64Array.from({ length: SPECIES_COUNT * 3 }, (_, k) => phaseOf(SPECIES[Math.floor(k / 3)], (k % 3) as PhaseId)?.cp.v ?? 0);
/** Die Bezugsphase: die, in der H bei 0 °C null ist. */
export const REF_PHASE = Uint8Array.from(SPECIES, (s) => (s.kind === 'material' ? SOLID : s.phases.liquid ? LIQUID : s.phases.gas ? GAS : SOLID));
/** Schmelz- und Siedetemperatur (K, 0: keine) und die latenten Wärmen (J/kg). */
export const T_MELT = Float64Array.from(SPECIES, (s) => s.melt?.T.v ?? 0);
export const L_MELT = Float64Array.from(SPECIES, (s) => s.melt?.L.v ?? 0);
export const T_BOIL = Float64Array.from(SPECIES, (s) => s.boil?.T.v ?? 0);
export const L_BOIL = Float64Array.from(SPECIES, (s) => s.boil?.L.v ?? 0);

/**
 * Der Versatz der Enthalpie je Phase: h(T) = OFFSET + c_p·(T − 0 °C). Für Wasser:
 * Eis −L_f, flüssig 0, Dampf c_l·(T_b − 0 °C) + L_b − c_g·(T_b − 0 °C).
 */
export const H_OFFSET = Float64Array.from({ length: SPECIES_COUNT * 3 }, (_, k) => {
  const sp = Math.floor(k / 3);
  const p = (k % 3) as PhaseId;
  const ref = REF_PHASE[sp];
  if (p === ref) return 0;
  if (ref === LIQUID && p === SOLID) return -L_MELT[sp];
  if (ref === LIQUID && p === GAS) {
    const tb = T_BOIL[sp] - T0;
    return CP[sp * 3 + LIQUID] * tb + L_BOIL[sp] - CP[sp * 3 + GAS] * tb;
  }
  return 0;
});

/** Spezifische Enthalpie eines reinen Stoffes in einer Phase bei T (J/kg). */
export const enthalpy = (sp: number, phase: PhaseId, T: number): number => H_OFFSET[sp * 3 + phase] + CP[sp * 3 + phase] * (T - T0);

/** Dichte eines Feststoffes (kg/m³). */
export function solidDensity(sp: number): number {
  const d = phaseOf(SPECIES[sp], SOLID)?.density;
  return d !== undefined && 'v' in d ? d.v : 1000;
}

/** Dichte einer Flüssigkeit bei T (kg/m³) — Wasser nach Kell (1975), 0–150 °C. */
export function liquidDensity(sp: number, T: number): number {
  const d = phaseOf(SPECIES[sp], LIQUID)?.density;
  if (d === undefined) return 1000;
  if ('v' in d) return d.v;
  const c = d.kell;
  const t = Math.min(150, Math.max(0, T - T0));
  return (c[0] + t * (c[1] + t * (c[2] + t * (c[3] + t * (c[4] + t * c[5]))))) / (1 + c[6] * t);
}

/** Wärmeleitfähigkeit (W/(m·K)) eines Stoffes in einer Phase bei T. */
export function conductivity(sp: number, phase: PhaseId, T: number): number {
  const k = phaseOf(SPECIES[sp], phase)?.k;
  if (k === undefined) return 0;
  if ('v' in k) return k.v;
  const t = T - T0;
  let out = 0;
  for (let i = k.poly.length - 1; i >= 0; i -= 1) out = out * t + k.poly[i];
  return out;
}

/* -- Sättigung (Antoine) ---------------------------------------------------------------------------------- */

/** Ein Satz Antoine-Koeffizienten (der erste für ≤ 100 °C, der zweite darüber), weich übergeblendet zwischen 100 und 110 °C. */
const antoineOf = (sp: number): readonly Antoine[] => SPECIES[sp].boil?.antoine ?? [];

/** Sättigungsdampfdruck in Pa bei T (K). */
export function psat(sp: number, T: number): number {
  const sets = antoineOf(sp);
  if (sets.length === 0) return 0;
  const t = T - T0;
  const log = (a: Antoine) => a.A - a.B / (a.C + t);
  let l = log(sets[0]);
  if (sets.length > 1 && t > 100) {
    const w = Math.min(1, (t - 100) / 10);
    l = (1 - w) * l + w * log(sets[1]);
  }
  return 10 ** l * MMHG;
}

/** Siedetemperatur in K beim Druck p (Pa). */
export function tsat(sp: number, p: number): number {
  const sets = antoineOf(sp);
  if (sets.length === 0 || !(p > 0)) return 0;
  const lp = Math.log10(p / MMHG);
  const temp = (a: Antoine) => a.B / (a.A - lp) - a.C;
  let t = temp(sets[0]);
  if (sets.length > 1 && t > 100) {
    const w = Math.min(1, (t - 100) / 10);
    t = (1 - w) * t + w * temp(sets[1]);
  }
  return t + T0;
}

/* -- Gase ----------------------------------------------------------------------------------------------------- */

/** Dichte eines idealen Gases (kg/m³) der Molmasse M (kg/mol) bei T, p. */
export const gasDensity = (M: number, T: number, p: number): number => (p * M) / (R_GAS * T);

const MAP = FILE.gasMap;
const LN_LO = Math.log(MAP.lo.v);
const LN_SPAN = Math.log(MAP.hi.v) - LN_LO;

/**
 * Die Dichte, mit der der Löser ein Gas bewegt: die echte (ideales Gas beim
 * Umgebungsdruck) logarithmisch in 20–80 kg/m³ abgebildet — monoton, die
 * Reihenfolge der Gase bleibt (H₂ < Dampf < Luft < CO₂). SIMPLIFICATIONS.md #3.
 */
export function mappedGasDensity(rhoReal: number): number {
  const f = (Math.log(Math.max(1e-9, rhoReal)) - LN_LO) / LN_SPAN;
  return MAP.min.v + (MAP.max.v - MAP.min.v) * Math.min(1, Math.max(0, f));
}

/** Trockene Luft nach Masse (N₂ + O₂, normiert). */
export const AIR: readonly { readonly sp: number; readonly w: number }[] = Object.entries(FILE.air).map(([id, n]) => ({ sp: spIndex(id), w: n.v }));

/** Die Unterkühlung bzw. Überhitzung, ab der eine Flüssigkeit verdampft: an Keimstellen klein, im Inneren gross (K). */
export const NUC_SITE = Float64Array.from(SPECIES, (s) => s.nucleation?.site.v ?? 0);
export const NUC_BULK = Float64Array.from(SPECIES, (s) => s.nucleation?.bulk.v ?? 0);
/** Keimstellendichte einer festen Oberfläche (0–1). */
export const SITE_DENSITY = Float64Array.from(SPECIES, (s) => s.surface?.sites.v ?? 0);

/** Der Name eines Stoffes in einer Phase (für Inspektor und Palette). */
export function phaseName(sp: number, phase: PhaseId, lang: keyof Names = 'pl'): string {
  const s = SPECIES[sp];
  return phaseOf(s, phase)?.name[lang] ?? s.name[lang];
}

/** Die Farbe eines Stoffes in einer Phase (#rrggbb). */
export const phaseColor = (sp: number, phase: PhaseId): string => phaseOf(SPECIES[sp], phase)?.color ?? '#888888';

/** Für die Prüfung: jede Zahl der Datenbank hat eine bekannte Quelle — die Pfade ohne. */
export function unsourced(): string[] {
  const out: string[] = [];
  const walk = (node: unknown, path: string): void => {
    if (Array.isArray(node)) { node.forEach((x, i) => walk(x, `${path}[${i}]`)); return; }
    if (node === null || typeof node !== 'object') return;
    const o = node as Record<string, unknown>;
    const hasNumbers = Object.entries(o).some(([k, v]) => k !== 'from' && k !== 'to' && (typeof v === 'number' || (Array.isArray(v) && v.every((x) => typeof x === 'number'))));
    if (hasNumbers && (typeof o.src !== 'string' || SOURCES[o.src] === undefined)) out.push(path);
    for (const [k, v] of Object.entries(o)) if (typeof v === 'object') walk(v, `${path}.${k}`);
  };
  walk(FILE.species, 'species');
  walk(FILE.gasMap, 'gasMap');
  walk(FILE.air, 'air');
  return out;
}
