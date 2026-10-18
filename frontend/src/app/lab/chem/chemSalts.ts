/**
 * 2026-10-18 — LÖSEN, FÄLLEN, KRISTALLISIEREN (Chemia): EINE Regel für alle
 * Salze, Hydroxide, Carbonate und Oxide — das Ionenprodukt Q gegen Ksp.
 *
 *   Q > Ksp  → es fällt aus (fein: Niederschlag; gut löslich: Kristalle), bis Q = Ksp
 *   Q < Ksp  → was davon daliegt, löst sich — so schnell, wie seine Oberfläche erlaubt
 *
 * <b>Mit dem pH verbunden</b>: fällt Cu(OH)₂, verschwinden OH⁻ und der pH sinkt;
 * löst sich CaCO₃ in Säure, wird aus CO₃²⁻ CO₂. Darum wird die Menge x, die
 * sich löst (oder ausfällt), so gesucht, dass NACH dem Gleichgewicht Q = Ksp
 * gilt — eine Halbierung über x, in jedem Schritt das ganze Gleichgewicht.
 * Daraus folgt ohne eigene Zeile: Kalkwasser wird milchig von CO₂ und wieder
 * klar von zu viel, Zn(OH)₂ löst sich in Lauge und in Säure, AgCl in Ammoniak,
 * AgI nicht, PbI₂ löst sich heiss und fällt kalt als goldener Regen.
 *
 * <b>Temperatur</b>: Ksp nach van 't Hoff mit der Lösungsenthalpie aus den
 * Bildungsenthalpien — KNO₃ löst sich heiss viel besser, Ca(OH)₂ schlechter.
 */

import { COMPLEXES, POOL_MEMBER, SALTS, SPECIES, saltOf, type PoolId, type Salt } from './chemData';
import { eqAcidAttack, eqComplex, eqPrecip, fml } from './chemEq';
import { CX_BY_METAL, copySol, speciate } from './chemPh';
import { colorWordOf, type Lump, type Vessel } from './chemVessel';

const R = 8.314;
const dH = (id: string): number => (SPECIES[id]?.dHf ?? Number.NaN) * 1000;
const M = (id: string): number => SPECIES[id]?.M ?? 100;

type Role = { readonly kind: 'strong' } | { readonly kind: 'cx' } | { readonly kind: 'oh' } | { readonly kind: 'pool'; readonly pool: PoolId; readonly form: number };

const roleOf = (id: string): Role => {
  if (id === 'OH-') return { kind: 'oh' };
  const m = POOL_MEMBER[id];
  if (m !== undefined) return { kind: 'pool', pool: m[0], form: m[1] };
  return CX_BY_METAL.has(id) ? { kind: 'cx' } : { kind: 'strong' };
};

/** Gut löslich (bildet Kristalle, keinen Niederschlag). */
export const crystalline = (s: Salt): boolean => s.sol !== undefined && s.sol >= 1;
const basic = (s: Salt): boolean => s.anion === 'OH-' || s.anion === 'CO3-2' || s.anion === 'HCO3-';

const kspCache = new Map<string, number>();

/** Das Löslichkeitsprodukt bei T (K). */
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
  const hydrate = basic(b) ? 0 : b.w;
  const h = b.nc * dH(b.cation) + b.na * dH(b.anion) + hydrate * dH('H2O') - dH(b.solid);
  const k = Number.isFinite(h) ? k0 * Math.exp((-h / R) * (1 / T - 1 / T0)) : k0;
  if (kspCache.size > 6000) kspCache.clear();
  kspCache.set(key, k);
  return k;
}

/** Gesamtmenge (mol) eines Ions im Gefäss (beim Vorrats-Mitglied: der ganze Vorrat). */
function total(v: Vessel, id: string): number {
  const m = POOL_MEMBER[id];
  return v.aq.get(m === undefined ? id : m[0]) ?? 0;
}

/** Q jetzt (mit dem Gleichgewicht von vorhin). */
function qNow(v: Vessel, s: Salt): number {
  return v.conc(s.cation) ** s.nc * v.conc(s.anion) ** s.na;
}

/**
 * Wie viel (mol) dieses Salzes sich lösen müsste (+) oder ausfallen (−),
 * damit nach dem Gleichgewicht Q = Ksp gilt — höchstens `up` gelöst.
 */
export function shift(v: Vessel, s: Salt, ksp: number, up: number): number {
  const V = v.liters();
  if (V <= 1e-6) return 0;
  const base = v.sol();
  const cr = roleOf(s.cation);
  const ar = roleOf(s.anion);
  const zc = SPECIES[s.cation]?.charge ?? 1;
  const za = SPECIES[s.anion]?.charge ?? -1;
  const c0 = total(v, s.cation) / V;
  const a0 = ar.kind === 'oh' ? 0 : total(v, s.anion) / V;
  const lnK = Math.log(ksp);
  const usePh = cr.kind !== 'strong' || ar.kind !== 'strong';
  let guess = v.spec.pH;

  const f = (x: number): number => {
    const dc = (s.nc * x) / V;
    const da = (s.na * x) / V;
    const cT = c0 + dc;
    const aT = a0 + da;
    if (cT <= 0 || (ar.kind !== 'oh' && aT <= 0)) return -Infinity;
    if (!usePh) return s.nc * Math.log(cT) + s.na * Math.log(aT) - lnK;
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
    const sp = speciate(sol, v.T, guess);
    guess = sp.pH;
    const cf = cr.kind === 'pool' ? cT * sp.alpha[cr.pool][cr.form] : cr.kind === 'cx' ? cT * (sp.free[s.cation] ?? 1) : cT;
    const af = ar.kind === 'oh' ? sp.oh : ar.kind === 'pool' ? aT * sp.alpha[ar.pool][ar.form] : aT;
    if (cf <= 0 || af <= 0) return -Infinity;
    return s.nc * Math.log(cf) + s.na * Math.log(af) - lnK;
  };

  const f0 = f(0);
  if (Math.abs(f0) < 1e-7) return 0;
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
  const span = hi - lo;
  for (let i = 0; i < 56 && hi - lo > span * 1e-13; i += 1) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

/** Die Menge eines Salzes ins Gelöste (+) oder heraus (−) — mit Wasser und Vorräten. */
function moveIons(v: Vessel, s: Salt, x: number): void {
  const pc = POOL_MEMBER[s.cation];
  v.addAq(pc === undefined ? s.cation : pc[0], s.nc * x);
  if (s.anion !== 'OH-') {
    const pa = POOL_MEMBER[s.anion];
    v.addAq(pa === undefined ? s.anion : pa[0], s.na * x);
  }
  v.water = Math.max(0, v.water + s.w * x);
}

const name = (id: string): string => SPECIES[id]?.name ?? id;

/**
 * EIN SCHRITT DER SALZE in einem Gefäss: was übersättigt ist, fällt aus (in
 * Bruchteilen einer Sekunde), was daliegt und sich lösen kann, löst sich —
 * so schnell, wie seine Oberfläche es erlaubt (Kreide schneller als Marmor).
 */
export function saltStep(v: Vessel, dt: number, t: number): void {
  if (!v.wet()) return;
  const V = v.liters();
  const stirred = 1 + (v.stir > 0 ? 3 : 0) + Math.min(2, v.fx.boil * 40);
  for (const s of SALTS) {
    const lumps = v.lumps.filter((l) => l.sp === s.solid && l.where === 'in' && l.n > 0);
    const solid = lumps.reduce((a, l) => a + l.n, 0);
    const cat = total(v, s.cation);
    const an = s.anion === 'OH-' ? 1 : total(v, s.anion);
    if (solid <= 0 && (cat <= 0 || an <= 0)) continue;
    const ksp = kspOf(s, v.T);
    const q = cat > 0 && an > 0 ? qNow(v, s) : 0;
    const grown = crystalline(s) && lumps.length === 0 ? 1.25 : 1.0001;
    if (solid <= 0 && q <= ksp * grown) continue;
    if (solid > 0 && q >= ksp * 0.9999 && q <= ksp * grown) continue;

    /* Wie schnell sich das Daliegende lösen kann (mol in diesem Schritt). */
    let up = 0;
    const areas = lumps.map((l) => l.area());
    /* Säure greift Hydroxide und Carbonate an, Liganden (NH₃, OH⁻) holen das Metall heraus. */
    const assist = 1 - (v.spec.free[s.cation] ?? 1);
    const k = crystalline(s) ? 4e-5 : 2.5e-5 * ((basic(s) ? 0.02 + v.spec.h : 0.04) + assist);
    for (const a of areas) up += a * k * stirred * dt;
    up = Math.min(up, solid);

    let x = shift(v, s, ksp, up);
    /* Ein Oxid löst sich nur (in Säure) — aus der Lösung fällt sein Hydroxid. */
    if (x < 0 && s.like !== undefined) continue;
    if (x < 0) x = Math.abs(x) < 1e-10 ? x : x * (1 - Math.exp(-dt / 0.25));
    if (Math.abs(x) < 1e-14) continue;
    moveIons(v, s, x);

    if (x > 0) {
      const massBefore = solid * (SPECIES[s.solid]?.M ?? 100);
      const sum = areas.reduce((a, b) => a + b, 0) || 1;
      let left = x;
      lumps.forEach((l, i) => {
        const take = Math.min(l.n, (x * areas[i]) / sum);
        l.n -= take;
        left -= take;
      });
      for (const l of lumps) if (left > 0 && l.n > 0) { const take = Math.min(l.n, left); l.n -= take; left -= take; }
      /* Gemeldet wird nur, was zu sehen war (Spuren aus der Luft — ZnCO₃ in Lauge — nicht). */
      if (massBefore > 1e-4 || v.seen.has(`precip:${s.solid}`) || v.seen.has(`cryst:${s.solid}`)) reportDissolve(v, s, lumps, x, t);
    } else {
      const form = crystalline(s) ? 'crystals' : 'precipitate';
      const into: Lump = v.addLump(s.solid, -x, form);
      if (form === 'precipitate') into.suspended = Math.min(1, (into.suspended * (into.n + x) - x) / into.n);
      else { into.y = 0; into.vy = 0; }
      v.fx.precip.set(s.solid, (v.fx.precip.get(s.solid) ?? 0) - x);
      /* Gemeldet wird, was man sieht (mehr als ein Zehntel Milligramm). */
      if (into.mass() > 1e-4) {
        const color = colorWordOf(SPECIES[s.solid]?.color ?? '#ffffff');
        if (form === 'precipitate') v.say(`precip:${s.solid}`, `Wytrąca się ${color} osad — ${name(s.solid)}.`, t, eqPrecip(s));
        else v.say(`cryst:${s.solid}`, `Wydzielają się kryształy — ${name(s.solid)} (roztwór nasycony).`, t);
        v.forget(`gone:${s.solid}`);
      }
    }
    v.respeciate();
    void V;
  }
  v.prune();
}

/**
 * Eine Lösung aus der Flasche ist klar: was in ihr übersättigt wäre (CuSO₄ hydrolysiert
 * ein wenig, Spuren von Cu(OH)₂), ist längst abfiltriert — es bleibt die Lösung mit ihrem pH.
 */
export function clarify(v: Vessel): void {
  if (!v.wet()) return;
  for (let pass = 0; pass < 2; pass += 1) {
    for (const s of SALTS) {
      if (s.like !== undefined) continue;
      const cat = total(v, s.cation);
      const an = s.anion === 'OH-' ? 1 : total(v, s.anion);
      if (cat <= 0 || an <= 0) continue;
      const ksp = kspOf(s, v.T);
      if (qNow(v, s) <= ksp) continue;
      const x = shift(v, s, ksp, 0);
      if (x < 0) { moveIons(v, s, x); v.respeciate(); }
    }
  }
}

/** Was beim Lösen zu sagen ist: ein Niederschlag löst sich als Komplex oder in Säure, Kristalle sind fort. */
function reportDissolve(v: Vessel, s: Salt, lumps: readonly Lump[], x: number, t: number): void {
  const left = lumps.reduce((a, l) => a + l.n, 0);
  const precip = lumps.some((l) => l.form === 'precipitate');
  if (basic(s) && v.spec.h > 1e-4 && !crystalline(s)) {
    v.say(`attack:${s.solid}`, `${cap(name(s.solid))} roztwarza się w kwasie${s.anion === 'CO3-2' ? ' — wydziela się gaz' : ''}.`, t, eqAcidAttack(s) ?? undefined);
  }
  if (precip && !crystalline(s)) {
    for (const c of COMPLEXES) {
      if (c.metal !== s.cation) continue;
      if ((v.spec.cx[c.id] ?? 0) < 0.5) continue;
      v.say(`cx:${s.solid}`, `Osad roztwarza się (${name(s.solid)}) — powstaje ${name(c.id)}.`, t, eqComplex(s, c.id, c.ligand, c.n));
    }
  }
  if (left <= 1e-10 && x > 0) {
    v.say(`gone:${s.solid}`, crystalline(s) ? `Wszystko się rozpuściło (${name(s.solid)}).` : `Osad zniknął (${name(s.solid)}).`, t);
    v.forget(`precip:${s.solid}`);
    v.forget(`cryst:${s.solid}`);
  }
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Wie viel eines Salzes sich bei T in 100 g Wasser löst (g) — für die Anzeige und die Prüfungen. */
export function solubility(s: Salt, T: number): number {
  const ksp = kspOf(s, T);
  const m = (ksp / (s.nc ** s.nc * s.na ** s.na)) ** (1 / (s.nc + s.na));
  return (m * (s.nc * M(s.cation) + s.na * M(s.anion))) / 10;
}

export { fml };
