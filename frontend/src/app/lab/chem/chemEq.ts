/**
 * 2026-10-18 — GLEICHUNGEN DER CHEMIA, aus den Daten gebaut: Metall und
 * Wasser, Metall und Säure (jede Säure: aus den Ladungen von Kation und
 * Anion wird das Salz und das Verhältnis), Abscheidung (Fe + Cu²⁺ → Fe²⁺ +
 * Cu), Fällung (Ag⁺ + Cl⁻ → AgCl↓). Ausgeschrieben wie im Heft: kleine
 * Ziffern unten, Ladungen oben, Pfeile für Gas und Niederschlag.
 */

import { SPECIES, type Metal, type Salt } from './chemData';

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

/** Die Formel eines Stoffes, wie man sie schreibt. */
export const fml = (id: string): string => SPECIES[id]?.formula ?? id;

/** Eine Zahl tiefgestellt (H₂, Al₂(SO₄)₃). */
export const sub = (n: number): string => (n === 1 ? '' : String(n).split('').map((d) => SUB[Number(d)] ?? d).join(''));

/** Ein Vorfaktor („2Na”), 1 bleibt weg. */
const k = (n: number, s: string): string => `${n === 1 ? '' : n}${s}`;

/** Das Ion ohne Ladung (für Salzformeln): „SO₄²⁻” → „SO₄”. */
const bare = (id: string): string => fml(id).replace(/[⁺⁻⁰¹²³⁴⁵⁶⁷⁸⁹]/g, '');

/** Mehratomiges Ion: in Klammern, wenn mehr als eines (Al₂(SO₄)₃, Ca(OH)₂). */
const group = (id: string, n: number): string => {
  const b = bare(id);
  const many = (b.match(/[A-Z]/g)?.length ?? 0) > 1 || /[₀-₉]/.test(b);
  return n === 1 ? b : many ? `(${b})${sub(n)}` : `${b}${sub(n)}`;
};

/** Die Formel eines Salzes aus Kation und Anion (MgCl₂, Al₂(SO₄)₃, Fe(NO₃)₂). */
export function saltFormula(cation: string, anion: string): string {
  const p = SPECIES[cation]?.charge ?? 1;
  const q = -(SPECIES[anion]?.charge ?? -1);
  const g = gcd(p, q);
  return `${group(cation, q / g)}${group(anion, p / g)}`;
}

/** Die Säure zu einem Anion (HCl, H₂SO₄, HNO₃). */
const acidOf = (anion: string): string => {
  const q = -(SPECIES[anion]?.charge ?? -1);
  return `H${sub(q)}${bare(anion)}`;
};

/** Metall und Wasser: 2Na + 2H₂O → 2NaOH + H₂↑. */
export function eqMetalWater(m: Metal): string {
  const base = m.n === 1 ? `${m.id}OH` : `${m.id}(OH)${sub(m.n)}`;
  const f = m.n % 2 === 1 ? 2 : 1;
  return `${k(f, m.id)} + ${k(f * m.n, 'H₂O')} → ${k(f, base)} + ${k((f * m.n) / 2, 'H₂')}↑`;
}

/** Metall und Säure (mit dem Anion, das im Gefäss ist): Mg + 2HCl → MgCl₂ + H₂↑ — dazu die Jonengleichung. */
export function eqMetalAcid(m: Metal, anion: string | null): { molecular: string | null; ionic: string } {
  const f = m.n % 2 === 1 ? 2 : 1;
  const ionic = `${k(f, m.id)} + ${k(f * m.n, 'H⁺')} → ${k(f, fml(m.ion))} + ${k((f * m.n) / 2, 'H₂')}↑`;
  if (anion === null) return { molecular: null, ionic };
  const p = m.n;
  const q = -(SPECIES[anion]?.charge ?? -1);
  const g = gcd(p, q);
  const a = q / g;
  const b = p / g;
  let metals = a;
  let acids = b;
  let salts = 1;
  let h2 = (b * q) / 2;
  if (!Number.isInteger(h2)) { metals *= 2; acids *= 2; salts *= 2; h2 *= 2; }
  return { molecular: `${k(metals, m.id)} + ${k(acids, acidOf(anion))} → ${k(salts, saltFormula(m.ion, anion))} + ${k(h2, 'H₂')}↑`, ionic };
}

/** Abscheidung: Fe + Cu²⁺ → Fe²⁺ + Cu (die Ladungen gleichen sich aus). */
export function eqDisplace(m: Metal, ion: string, metal: string): string {
  const p = m.n;
  const q = SPECIES[ion]?.charge ?? 1;
  const l = (p * q) / gcd(p, q);
  return `${k(l / p, m.id)} + ${k(l / q, fml(ion))} → ${k(l / p, fml(m.ion))} + ${k(l / q, metal)}`;
}

/** Fällung, Jonengleichung: Ag⁺ + Cl⁻ → AgCl↓, Cu²⁺ + 2OH⁻ → Cu(OH)₂↓. */
export function eqPrecip(s: Salt): string {
  return `${k(s.nc, fml(s.cation))} + ${k(s.na, fml(s.anion))} → ${fml(s.solid)}↓`;
}

/** Ein Niederschlag löst sich als Komplex: Cu(OH)₂ + 4NH₃ → [Cu(NH₃)₄]²⁺ + 2OH⁻, Zn(OH)₂ + 2OH⁻ → [Zn(OH)₄]²⁻. */
export function eqComplex(s: Salt, cx: string, ligand: string, n: number): string {
  if (ligand === 'OH-') return `${fml(s.solid)} + ${k(n - s.na, 'OH⁻')} → ${fml(cx)}`;
  return `${fml(s.solid)} + ${k(n * s.nc, ligand === 'NH3' ? 'NH₃' : fml(ligand))} → ${k(s.nc, fml(cx))} + ${k(s.na, fml(s.anion))}`;
}

/** Ein schwer lösliches Salz löst sich in Säure: CaCO₃ + 2H⁺ → Ca²⁺ + H₂O + CO₂↑. */
export function eqAcidAttack(s: Salt): string | null {
  const z = SPECIES[s.cation]?.charge ?? 1;
  const total = z * s.nc;
  const cat = `${k(s.nc, fml(s.cation))}`;
  if (s.anion === 'CO3-2') return `${fml(s.solid)} + ${k(total, 'H⁺')} → ${cat} + H₂O + CO₂↑`;
  if (s.anion === 'OH-') {
    const water = s.solid.endsWith('O') && !s.solid.includes('(') ? total / 2 : total;
    return `${fml(s.solid)} + ${k(total, 'H⁺')} → ${cat} + ${k(water, 'H₂O')}`;
  }
  return null;
}
