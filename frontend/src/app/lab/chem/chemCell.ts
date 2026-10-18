/**
 * 2026-10-18 — DIE CHEMIE IN JEDER ZELLE (Chemia): dieselben Regeln wie im
 * Heft, aber dort, wo die Stoffe sich treffen.
 *
 *   Gleichgewicht  jede Zelle Wasser hat ihren pH (`chemPh.ts`) — neu bestimmt, wenn
 *                  sich ihr Inhalt geändert hat (je Schritt höchstens so viele, wie
 *                  die Zeit erlaubt); ändert sich die Formenwärme, ist das Wärme
 *   Salze          Q > Ksp: es fällt aus (Wolke im Strahl), Q < Ksp: was daliegt, löst sich
 *                  — so schnell, wie seine Oberfläche zum Wasser erlaubt
 *   Metalle        an jeder Seite, die nass ist: mit Wasser, Säure, Lauge (Wasserstoff
 *                  perlt dort), edlere Metalle scheiden sich als Belag ab
 *   Lösungen       H₂O₂ zerfällt (MnO₂ daneben, Kartoffel, I⁻, Fe³⁺), MnO₄⁻ wird entfärbt,
 *                  Kupfer löst sich in Salpetersäure
 *   Hydrate        CaO wird mit Wasser heiss (Ca(OH)₂), weisses CuSO₄ blau
 *   Gase           an der Oberfläche lösen sich CO₂, NH₃, SO₂, HCl oder entweichen;
 *                  übersättigtes CO₂ bildet Blasen (Marmor in Säure, Sprudel)
 */

import { DECOMPOSITIONS, HENRY, HYDRATION, METALS, POOLS, SALTS, SPECIES, type Metal, type PoolId, type Salt } from './chemData';
import {
  AQI, NC, WATER, aqLook, aqVolume, basicSalt, colorWordOf, concOf, crystalline, diffusivity, formHeat, kspOf, moveSalt, qAfter, qOf, saltShift,
  saltsPresent, simpleSalt, specOf
} from './chemAq';
import { eqAcidAttack, eqDisplace, eqMetalAcid, eqMetalWater, eqPrecip } from './chemEq';
import { CELL, F, GASI, GAS_DHF, GRAIN, G_H2, Grid, L, NG, SOLI, SOL_M, SOL_RHO, S_ICE, type Form } from './chemGrid';
import { NEUTRAL, type Spec } from './chemPh';
import type { Bubbles } from './chemFlow';

const R = 8.314;
const arr = (Ea: number, T: number): number => Math.exp((-Ea / R) * (1 / T - 1 / 298.15));
/** Die Schicht gesättigter Lösung an einem Kristall (cm): in ruhigem Wasser etwa 0,2 mm, kräftig gerührt fünfmal dünner. */
const film = (turb: number): number => 0.02 / (1 + 6 * turb);
const name = (id: string): string => SPECIES[id]?.name ?? id;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export interface ChemCtx {
  readonly g: Grid;
  readonly bubbles: Bubbles;
  readonly dt: number;
  /** Eine Beobachtung an einer Zelle (die Welt sucht das Glas dazu). */
  readonly say: (key: string, text: string, i: number, eq?: string) => void;
  /** Druck über einer Flüssigkeitszelle (kPa). */
  readonly pAt: (i: number) => number;
}

/** Was die Chemie zwischen den Schritten behält. */
export class ChemState {
  cursor = 0;
  /** Gleichgewichte je Schritt (mehr kostet Zeit). */
  budget = 260;
  /** Salze mit pH-Kopplung je Schritt. */
  shifts = 24;
  /** Dasselbe für das Lösen (eigenes Budget: ein Niederschlag, der in vielen Zellen nachgerechnet wird, darf das Lösen nicht aushungern). */
  dissolves = 24;
  /** Wo das Ausfallen im nächsten Schritt anfängt. */
  precipCursor = 0;
  /** Wo das Lösen im nächsten Schritt anfängt (reihum, damit das Budget nicht immer dieselben Zellen bekommen). */
  saltCursor = 0;
  readonly fresh: Uint8Array;
  private readonly lookBuf = new Float32Array(4);

  constructor(n: number) { this.fresh = new Uint8Array(n); }

  look(): Float32Array { return this.lookBuf; }
}

export const near4 = (g: Grid, i: number): number[] => {
  const out: number[] = [];
  const c = i % g.w;
  if (c > 0) out.push(i - 1);
  if (c < g.w - 1) out.push(i + 1);
  if (i >= g.w) out.push(i - g.w);
  if (i + g.w < g.n) out.push(i + g.w);
  return out;
};

/** Wie verschieden zwei Zellen Wasser sind (0: gleich). */
function differ(g: Grid, i: number, j: number): number {
  const oi = i * NC;
  const oj = j * NC;
  const wi = Math.max(1e-12, g.comp[oi]);
  const wj = Math.max(1e-12, g.comp[oj]);
  let d = 0;
  for (let k = 1; k < NC; k += 1) {
    const a = g.comp[oi + k] / wi;
    const b = g.comp[oj + k] / wj;
    if (a !== b) d += Math.abs(a - b) / (Math.abs(a) + Math.abs(b) + 1e-12);
  }
  return d;
}

/* -- Gleichgewicht ------------------------------------------------------------------------------------- */

function setSpec(g: Grid, st: ChemState, i: number, spec: Spec): void {
  const o = i * NC;
  const hf = formHeat(g.comp, o, spec);
  g.q[i] += g.hf[i] - hf;
  g.hf[i] = hf;
  g.spec[i] = spec;
  g.specT[i] = g.T[i];
  g.chg[i] = 0;
  const b = st.look();
  aqLook(g.comp, o, spec, b);
  g.look.set(b, i * 4);
  st.fresh[i] = 1;
}

/** Wasser, das sich geändert hat, bekommt sein Gleichgewicht (gleiche Nachbarn teilen es). */
export function speciateCells(c: ChemCtx, st: ChemState): void {
  const g = c.g;
  const { n, w } = g;
  st.fresh.fill(0);
  let budget = st.budget;
  const start = st.cursor % Math.max(1, n);
  for (let k = 0; k < n; k += 1) {
    const i = start + k < n ? start + k : start + k - n;
    if (g.lq[i] !== L.aq) continue;
    const o = i * NC;
    const sp = g.spec[i];
    if (aqVolume(g.comp, o) < 2e-4) { if (sp === null) { g.spec[i] = NEUTRAL; g.specT[i] = g.T[i]; aqLook(g.comp, o, NEUTRAL, st.look()); g.look.set(st.look(), i * 4); } continue; }
    if (sp !== null && g.chg[i] <= 0.004 && Math.abs(g.T[i] - g.specT[i]) <= 1.5) continue;
    let done = false;
    for (const j of [i - 1, i - w, i + 1, i + w]) {
      if (j < 0 || j >= n || st.fresh[j] !== 1 || g.lq[j] !== L.aq) continue;
      const sj = g.spec[j];
      if (sj === null || Math.abs(g.T[i] - g.T[j]) > 1 || differ(g, i, j) > 2e-5) continue;
      setSpec(g, st, i, sj);
      done = true;
      break;
    }
    if (done) continue;
    if (budget <= 0) {
      if (sp === null) { g.spec[i] = NEUTRAL; g.specT[i] = -1e9; }
      st.cursor = i;
      return;
    }
    budget -= 1;
    setSpec(g, st, i, specOf(g.comp, o, g.T[i], sp?.pH ?? null));
  }
}

/* -- Berührungen: wo ein Feststoff Wasser hat ------------------------------------------------------------- */

interface Contact { readonly j: number; readonly A: number }

/** Wo ein Feststoff (oder eine Schmelze) einer Zelle Wasser berührt, und mit welcher Fläche (cm²). */
function contacts(g: Grid, i: number, amountVol: number): Contact[] {
  const out: Contact[] = [];
  const f = g.sform[i];
  if (g.lq[i] === L.aq) {
    const grain = GRAIN[f] ?? 0;
    const A = grain > 0 ? (3 * amountVol) / grain : 4.84 * amountVol ** (2 / 3);
    out.push({ j: i, A });
  }
  for (const j of near4(g, i)) if (g.lq[j] === L.aq) out.push({ j, A: CELL * Math.min(g.D[i], g.D[j]) });
  return out;
}

export const specAt = (g: Grid, j: number): Spec => g.spec[j] ?? NEUTRAL;

/**
 * Salz auf Eis: wo ein lösliches Salz (oder Zucker) Eis berührt, ist das Eis an der Berührung immer ein wenig nass — in
 * diesem Film löst sich das Salz, die Sole taut das Eis weiter. Hier nur der erste Film (die Schmelzwärme nimmt er dem
 * Eis); das Weitere rechnen Lösen und Schmelzen von selbst: die Sole senkt den Gefrierpunkt der Nachbarn, das Eis taut
 * mit der eigenen Wärme, die Mischung wird kalt. Unter dem eutektischen Punkt (NaCl: −21 °C) bleibt alles fest.
 */
function wetByIce(g: Grid, i: number, dt: number): void {
  if (g.lq[i] === L.aq && aqVolume(g.comp, i * NC) > 0.05 * g.room(i)) return;
  for (const j of near4(g, i)) {
    if (g.sp[j] !== S_ICE || g.T[j] < 252) continue;
    const dn = Math.min(g.sn[j] * 0.5, 2e-5 * CELL * Math.min(g.D[i], g.D[j]) * dt);
    if (!(dn > 1e-12)) continue;
    g.addSolid(j, S_ICE, -dn, g.sform[j] as Form, j);
    g.addAq(i, WATER, dn, j);
    g.applyQ(j);
  }
}

/* -- Salze ----------------------------------------------------------------------------------------------- */

const SALT_OF_SOLID: ReadonlyMap<number, Salt> = new Map(SALTS.filter((s) => SOLI[s.solid] !== undefined).map((s) => [SOLI[s.solid], s]));

/** Einen neuen Feststoff ablegen: in der Zelle, sonst in einer nassen Nachbarzelle ohne anderen Feststoff. */
export function deposit(g: Grid, i: number, s: number, dn: number, form: Form, at: number): number {
  if (g.sp[i] < 0 || g.sp[i] === s) { g.addSolid(i, s, dn, form, at); return i; }
  for (const j of [i + g.w, i - 1, i + 1, i - g.w]) {
    if (j < 0 || j >= g.n || g.wall(j) || g.lq[j] !== L.aq) continue;
    if (g.sp[j] < 0 || g.sp[j] === s) { g.addSolid(j, s, dn, form, at); return j; }
  }
  return -1;
}

export function saltCells(c: ChemCtx, st: ChemState): void {
  const g = c.g;
  const n = g.n;
  let shifts = st.shifts;
  /* Ausfallen: wo sich das Wasser geändert hat und Q > Ksp ist — reihum ab der Zelle, die zuletzt kein Budget mehr bekam. */
  const first = st.precipCursor % Math.max(1, n);
  let skipped = -1;
  for (let kk = 0; kk < n; kk += 1) {
    const i = (first + kk) % n;
    if (g.lq[i] !== L.aq || (st.fresh[i] !== 1 && g.chg[i] <= 1e-7)) continue;
    const o = i * NC;
    const spec = g.spec[i];
    if (spec === null) continue;
    for (const s of saltsPresent(g.comp, o)) {
      const ksp = kspOf(s, g.T[i]);
      const q = qOf(g.comp, o, spec, s);
      const solid = SOLI[s.solid];
      const seeded = g.sp[i] === solid;
      /* Ein wenig Übersättigung braucht es (in einer schon besäten Zelle 2 %, neue Kristalle 25 %). */
      if (q <= ksp * (crystalline(s) && !seeded ? 1.25 : seeded ? 1.02 : 1.0001)) continue;
      const easy = simpleSalt(g.comp, o, spec, s);
      if (!easy) { if (shifts <= 0) { if (skipped < 0) skipped = i; continue; } shifts -= 1; }
      let x = saltShift(g.comp, o, g.T[i], spec, s, ksp, 0, easy);
      if (!(x < 0)) continue;
      x *= 1 - Math.exp(-c.dt / 0.15);
      const form = crystalline(s) ? F.crystals : F.precip;
      const at = deposit(g, i, solid, -x, form, i);
      if (at < 0) continue;
      g.q[i] -= moveSalt(g.comp, o, s, x);
      g.touch(i, 1);
      /* Gemeldet wird, was neu entsteht: ein Niederschlag immer (gesehen wird er erst ab 2 mg, `World.say`), Kristalle nur in
         einer neuen Zelle (nicht der gesättigte Saum um ein Salz, das sich gerade löst). */
      if (-x * SOL_M[solid] > 2e-6 && (form === F.precip || !seeded)) {
        const color = colorWordOf(SPECIES[s.solid]?.color ?? '#ffffff');
        if (form === F.precip) c.say(`precip:${s.solid}`, `Wytrąca się ${color} osad — ${name(s.solid)}.`, i, eqPrecip(s));
        else c.say(`cryst:${s.solid}`, `Wydzielają się kryształy — ${name(s.solid)} (roztwór nasycony).`, i);
      }
    }
  }
  st.precipCursor = skipped >= 0 ? skipped : 0;
  /* Lösen: was daliegt, so schnell, wie seine Oberfläche zum Wasser erlaubt — reihum ab der Stelle, an der das Budget zuletzt ausging. */
  shifts = st.dissolves;
  const start = st.saltCursor % Math.max(1, n);
  for (let k = 0; k < n; k += 1) {
    const i = (start + k) % n;
    if (shifts <= 0) { st.saltCursor = i; break; }
    const sp = g.sp[i];
    if (sp < 0) continue;
    const s = SALT_OF_SOLID.get(sp);
    if (s === undefined) continue;
    if (crystalline(s)) wetByIce(g, i, c.dt);
    const vol = (g.sn[i] * SOL_M[sp]) / SOL_RHO[sp];
    for (const { j, A } of contacts(g, i, vol)) {
      if (g.sp[i] !== sp) break;
      const oj = j * NC;
      const spec = specAt(g, j);
      const T = g.T[j];
      const ksp = kspOf(s, T);
      const q = qOf(g.comp, oj, spec, s);
      if (q >= ksp * 0.999) continue;
      let up: number;
      if (crystalline(s)) {
        /* Noyes–Whitney: das Gelöste muss durch die gesättigte Schicht an der Oberfläche diffundieren — D(T)/δ·(cₛ − c).
           Warmes Wasser löst schneller (D wächst mit T/η, cₛ meist auch), Rühren macht δ dünner, fast gesättigt geht es langsam. */
        const cs = (ksp / (s.nc ** s.nc * s.na ** s.na)) ** (1 / (s.nc + s.na)) / 1000;
        const drive = 1 - (q / ksp) ** (1 / (s.nc + s.na));
        up = Math.min(g.sn[i], A * (diffusivity(T) / film(g.turb[j])) * cs * Math.max(0, drive) * c.dt);
      } else {
        /* Schwer lösliche Salze und Säure an ihrer Oberfläche (Kalkstein in Salzsäure): eine Oberflächenreaktion mit Arrhenius. */
        const assist = 1 - (spec.free[s.cation] ?? 1);
        up = Math.min(g.sn[i], A * 2.5e-5 * ((basicSalt(s) ? 0.02 + spec.h : 0.04) + assist) * arr(40e3, T) * (1 + 3 * g.turb[j]) * c.dt);
      }
      if (up < 1e-15) continue;
      /* Nie über die Sättigung hinaus (ein feiner Niederschlag hat eine riesige Oberfläche) — weit darunter genügt die Abschätzung. */
      const easy = simpleSalt(g.comp, oj, spec, s);
      const far = !easy && qAfter(g.comp, oj, spec, s, up) < ksp * 0.3;
      if (!easy && !far) { if (shifts <= 0) continue; shifts -= 1; }
      const x = far ? up : saltShift(g.comp, oj, T, spec, s, ksp, up, easy);
      if (!(x > 0)) continue;
      g.q[j] -= moveSalt(g.comp, oj, s, x);
      g.addSolid(i, sp, -x, g.sform[i] as Form, j);
      g.touch(j, 1);
      if (basicSalt(s) && spec.h > 1e-4 && !crystalline(s)) c.say(`attack:${s.solid}`, `${cap(name(s.solid))} roztwarza się w kwasie${s.anion === 'CO3-2' ? ' — wydziela się gaz' : ''}.`, j, eqAcidAttack(s) ?? undefined);
    }
  }
}

/* -- Moleküle: Zucker ------------------------------------------------------------------------------------ */

/** Feste Stoffe aus Molekülen, die sich lösen: Löslichkeit (g in 100 g Wasser) bei 0, 20 … 100 °C, Diffusion bei 25 °C (cm²/s). */
const MOLECULAR: readonly { readonly solid: string; readonly aq: string; readonly sol: readonly number[]; readonly D: number }[] = [
  { solid: 'sugar(s)', aq: 'sugar', sol: [179, 204, 238, 287, 362, 487], D: 5.2e-6 }
];
const MOL_OF_SOLID: ReadonlyMap<number, (typeof MOLECULAR)[number]> = new Map(MOLECULAR.filter((m) => SOLI[m.solid] !== undefined).map((m) => [SOLI[m.solid], m]));
const solAt = (tab: readonly number[], T: number): number => {
  const x = Math.min(5, Math.max(0, (T - 273.15) / 20));
  const k = Math.min(4, Math.floor(x));
  return tab[k] + (tab[k + 1] - tab[k]) * (x - k);
};

/** Zucker löst sich wie ein Salz nach Noyes–Whitney — nur ohne Ionen: bis zur Sättigung, in heissem Wasser viel mehr (487 g in 100 g bei 100 °C). */
export function moleculeCells(c: ChemCtx): void {
  const g = c.g;
  for (let i = 0; i < g.n; i += 1) {
    const sp = g.sp[i];
    if (sp < 0) continue;
    const m = MOL_OF_SOLID.get(sp);
    if (m === undefined) continue;
    const slot = AQI[m.aq];
    wetByIce(g, i, c.dt);
    const vol = (g.sn[i] * SOL_M[sp]) / SOL_RHO[sp];
    for (const { j, A } of contacts(g, i, vol)) {
      if (g.sp[i] !== sp) break;
      const oj = j * NC;
      const water = g.comp[oj + WATER] * 0.018015;
      if (water <= 1e-9) continue;
      const T = g.T[j];
      const cs = (solAt(m.sol, T) * 10) / SOL_M[sp];
      const now = g.comp[oj + slot] / water;
      if (now >= cs) continue;
      const up = Math.min(g.sn[i], A * (diffusivity(T, m.D) / film(g.turb[j])) * (cs / 1000) * (1 - now / cs) * c.dt, (cs - now) * water);
      if (up < 1e-15) continue;
      g.addSolid(i, sp, -up, g.sform[i] as Form, j);
      g.addAq(j, slot, up, j);
      g.touch(j, 1);
    }
  }
}

/* -- Metalle --------------------------------------------------------------------------------------------- */

const METAL_OF: ReadonlyMap<number, Metal> = new Map(METALS.filter((m) => SOLI[m.id] !== undefined).map((m) => [SOLI[m.id], m]));
const STRONG_ANIONS = ['Cl-', 'SO4-2', 'NO3-', 'Br-', 'I-'];

function acidAnion(g: Grid, j: number): string | null {
  let best: string | null = null;
  let most = 0;
  for (const a of STRONG_ANIONS) { const x = g.comp[j * NC + AQI[a]]; if (x > most) { most = x; best = a; } }
  return best;
}

/** Metalle an ihren nassen Seiten: Wasserstoff aus Wasser, Säure und Lauge, Abscheidung edlerer Metalle. */
export function metalCells(c: ChemCtx): void {
  const g = c.g;
  const n = g.n;
  for (let i = 0; i < n; i += 1) {
    const molten = g.lq[i] === L.melt && METAL_OF.has(g.msp[i]);
    const sp = molten ? g.msp[i] : g.sp[i];
    if (sp < 0) continue;
    const m = METAL_OF.get(sp);
    if (m === undefined) continue;
    const amount = () => (molten ? g.mn[i] : g.sp[i] === sp ? g.sn[i] : 0);
    const take = (dn: number, at: number) => { if (molten) g.addMelt(i, sp, -dn, at); else g.addSolid(i, sp, -dn, g.sform[i] as Form, at); };
    const vol = (amount() * SOL_M[sp]) / SOL_RHO[sp];
    for (const { j, A } of contacts(g, i, vol)) {
      const have = amount();
      if (have <= 0) break;
      const spec = specAt(g, j);
      /* An der Grenze ist es so warm wie das Wasser (es kühlt das Metall). */
      const T = g.T[j];
      const rw = m.kw * A * arr((m.Ew ?? 50) * 1000, T);
      const ra = m.ka * A * spec.h * arr(40e3, T);
      const rb = (m.kb ?? 0) * A * spec.oh * arr(40e3, T);
      const e = Math.min(have, (rw + ra + rb) * c.dt);
      if (e > 1e-15) {
        /* Die Wärme halb ins Metall, halb ins Wasser daneben: Natrium schmilzt zur Kugel, das Wasser wird warm — ins Metall aber nur, bis es 900 K hätte (ist es aufgebraucht, nimmt das Wasser alles). */
        const q0 = g.q[j];
        take(e, j);
        g.addAq(j, AQI[m.ion], e, j);
        const h2 = (e * m.n) / 2;
        g.q[j] -= h2 * GAS_DHF[G_H2];
        const half = Math.max(0, Math.min((g.q[j] - q0) * 0.5, g.cap(i) * (900 - g.T[i]) - g.q[i]));
        g.q[j] -= half;
        g.q[i] += half;
        c.bubbles.out(j, G_H2, h2);
        g.fizz[j] += h2 / c.dt;
        if (h2 / c.dt > 2e-7) {
          if (rw >= ra + rb) c.say(`water:${m.id}`, `${cap(name(m.id))} reaguje z wodą — wydziela się gaz (wodór).`, j, eqMetalWater(m));
          else if (ra >= rb) { const eq = eqMetalAcid(m, acidAnion(g, j)); c.say(`acid:${m.id}`, `${cap(name(m.id))} roztwarza się w kwasie — wydziela się gaz (wodór).`, j, eq.molecular === null ? eq.ionic : `${eq.molecular};  ${eq.ionic}`); }
          else c.say(`base:${m.id}`, `${cap(name(m.id))} roztwarza się w zasadzie — wydziela się wodór.`, j, m.id === 'Al' ? '2Al + 2OH⁻ + 6H₂O → 2[Al(OH)₄]⁻ + 3H₂↑' : 'Zn + 2OH⁻ + 2H₂O → [Zn(OH)₄]²⁻ + H₂↑');
        }
      }
      /* Abscheidung: ein edleres Metall aus seinen Ionen, als Belag neben diesem. */
      if (m.kw !== 0 || molten) continue;
      for (const nb of METALS) {
        if (nb.E <= m.E + 0.05) continue;
        const ion = AQI[nb.ion];
        const cion = concOf(g.comp, j * NC, spec, nb.ion);
        if (cion <= 1e-7) continue;
        const q = SPECIES[nb.ion]?.charge ?? 1;
        const rd = 2e-6 * A * cion * arr(30e3, T) * (1 - Math.exp(-(nb.E - m.E) / 0.15));
        const d = Math.min(amount(), rd * c.dt, (g.comp[j * NC + ion] * q) / m.n);
        if (d <= 1e-16) continue;
        const made = (d * m.n) / q;
        const at = deposit(g, j, SOLI[nb.id], made, F.coat, j);
        if (at < 0) continue;
        take(d, j);
        g.addAq(j, AQI[m.ion], d, j);
        g.addAq(j, ion, -made, j);
        c.say(`displace:${m.id}:${nb.id}`, `Na ${m.id === 'Fe' ? 'żelazie' : 'metalu'} osadza się ${name(nb.id)}${nb.id === 'Cu' ? ' (czerwonobrunatny nalot)' : nb.id === 'Ag' ? ' (srebrzyste kryształki)' : ''}.`, j, eqDisplace(m, nb.ion, nb.id));
      }
    }
  }
}

/* Die langsamen Reaktionen in Lösung, an Flächen und im Gas: `chemKinetics.ts`. */

/* -- Hydrate ---------------------------------------------------------------------------------------------- */

export function hydrateCells(c: ChemCtx): void {
  const g = c.g;
  for (let i = 0; i < g.n; i += 1) {
    const sp = g.sp[i];
    if (sp < 0) continue;
    const h = HYDRATION.find((x) => SOLI[x.from] === sp);
    if (h === undefined) continue;
    const vol = (g.sn[i] * SOL_M[sp]) / SOL_RHO[sp];
    for (const { j, A } of contacts(g, i, vol)) {
      if (g.sp[i] !== sp) break;
      const e = Math.min(g.sn[i], h.k * A * c.dt, g.comp[j * NC + WATER] / h.water);
      if (e <= 1e-15) continue;
      const to = SOLI[h.to];
      g.addAq(j, WATER, -e * h.water, i);
      if (e >= g.sn[i] - 1e-15) {
        const form = g.sform[i] as Form;
        g.addSolid(i, sp, -g.sn[i], form, i);
        g.addSolid(i, to, e, form === F.piece ? F.powder : form, i);
      } else {
        g.addSolid(i, sp, -e, g.sform[i] as Form, i);
        if (deposit(g, j, to, e, F.powder, i) < 0) { g.addSolid(i, sp, e, g.sform[i] as Form, i); g.addAq(j, WATER, e * h.water, i); continue; }
      }
      c.say(`hydrate:${h.from}`, h.from === 'CuSO4' ? 'Biały siarczan miedzi(II) z wodą barwi się na niebiesko.' : h.from === 'CaO' ? 'Wapno palone reaguje z wodą — mieszanina mocno się ogrzewa (gaszenie wapna).' : `${cap(name(h.from))} reaguje z wodą.`, i, h.eq);
    }
  }
}

/* -- Gase an der Oberfläche und im Wasser --------------------------------------------------------------------- */

const POOL_GAS = POOLS.filter((p) => p.gas !== null && HENRY[p.gas] !== undefined).map((p) => ({ p, gi: GASI[p.gas as string], slot: AQI[p.id] }));
const dHf = (id: string): number => (SPECIES[id]?.dHf ?? 0) * 1000;
const khOf = (p: (typeof POOLS)[number], T: number): number => {
  const henry = p.gas === null ? undefined : HENRY[p.gas];
  if (henry === undefined || p.gas === null) return 0;
  return henry.k * Math.exp((-(dHf(p.forms[p.neutral]) - dHf(p.gas)) / R) * (1 / T - 1 / 298.15));
};

/** Henry an jeder Oberfläche; übersättigtes CO₂ (SO₂, NH₃) perlt im Inneren (an Feststoffen schneller). */
export function gasCells(c: ChemCtx): void {
  const g = c.g;
  const { n, w } = g;
  for (let i = 0; i < n; i += 1) {
    if (g.lq[i] !== L.aq) continue;
    const o = i * NC;
    const spec = specAt(g, i);
    const V = aqVolume(g.comp, o) / 1000;
    if (V <= 1e-8) continue;
    const own = g.gasVol(i) > g.vol(i) * 0.05;
    const j = own ? i : i + w < n && g.lq[i + w] === L.none && !g.wall(i + w) && g.gasVol(i + w) > g.vol(i + w) * 0.05 ? i + w : -1;
    const stir = 1 + 3 * g.turb[i];
    if (j >= 0) {
      const nTot = g.gasTotal(j);
      const A = CELL * Math.min(g.D[i], g.D[j]);
      const Vg = Math.max(1e-6, g.gasVol(j));
      const P = nTot > 0 ? g.pressure(j) / 101.325 : 1;
      for (const { p, gi, slot } of POOL_GAS) {
        const KH = khOf(p, g.T[i]);
        const ng = g.gas[j * NG + gi];
        const pool = g.comp[o + slot];
        const cn = (pool / V) * (spec.alpha[p.id as PoolId][p.neutral] ?? 0);
        if (ng <= 0 && cn <= 0) continue;
        const ceq = nTot > 0 ? (KH * P * ng) / nTot : 0;
        let flux = (0.004 * stir * A * (ceq - cn)) / 1000;
        if (flux > 0) flux = Math.min(flux, (ng * (1 - Math.exp((-0.5 * A * stir * c.dt) / Vg))) / c.dt);
        let dn = flux * c.dt;
        if (dn < 0) dn = Math.max(dn, -cn * V * 0.8);
        if (Math.abs(dn) < 1e-17) continue;
        g.addAq(i, slot, dn, i);
        g.addGas(j, gi, -dn, i);
      }
      for (const gas of ['HCl(g)', 'NO2'] as const) {
        const gi = GASI[gas];
        const ng = g.gas[j * NG + gi];
        if (ng <= 1e-15) continue;
        const dn = ng * (1 - Math.exp((-0.5 * A * stir * c.dt) / Vg));
        g.addGas(j, gi, -dn, i);
        if (gas === 'HCl(g)') g.addAq(i, AQI['Cl-'], dn, i); else {
          g.addAq(i, AQI['NO3-'], (2 * dn) / 3, i);
          g.addGas(j, GASI.NO, dn / 3, i);
          g.addAq(i, WATER, -dn / 3, i);
        }
      }
      continue;
    }
    /* Im Inneren: übersättigtes Gas bildet Blasen. */
    const Pin = c.pAt(i) / 101.325;
    let inside = 0;
    const parts: { slot: number; gi: number; cn: number; KH: number; id: string }[] = [];
    for (const { p, gi, slot } of POOL_GAS) {
      const pool = g.comp[o + slot];
      if (pool <= 0) continue;
      const KH = khOf(p, g.T[i]);
      const cn = (pool / V) * (spec.alpha[p.id as PoolId][p.neutral] ?? 0);
      inside += cn / KH;
      parts.push({ slot, gi, cn, KH, id: p.gas ?? '' });
    }
    if (inside < Pin * 1.05) continue;
    const sites = g.sp[i] >= 0 || near4(g, i).some((k) => g.sp[k] >= 0 || g.mat[k] !== 0) ? 2 : 1;
    const nucleate = Math.min(1, (inside / Pin - 1.05) / 0.3);
    for (const x of parts) {
      const ceq = x.KH * Pin * (x.cn / (inside * x.KH));
      if (x.cn <= ceq) continue;
      const dn = Math.min(0.35 * V * (x.cn - ceq) * sites * stir * nucleate * c.dt, x.cn * V * 0.5);
      if (dn <= 1e-16) continue;
      g.addAq(i, x.slot, -dn, i);
      g.q[i] -= dn * GAS_DHF[x.gi];
      c.bubbles.out(i, x.gi, dn);
      g.fizz[i] += dn / c.dt;
      if (dn / c.dt > 2e-7) c.say(`gas:${x.id}`, x.id === 'CO2' ? 'Wydziela się gaz — pęcherzyki tlenku węgla(IV).' : x.id === 'NH3' ? 'Wydziela się amoniak — gaz o ostrym zapachu.' : 'Wydziela się tlenek siarki(IV).', i);
    }
  }
}

/* -- Zersetzen beim Erhitzen ------------------------------------------------------------------------------- */

/** Feststoffe zersetzen sich, wenn ihre Zelle heiss genug ist (unter Wasser nur, was das auch nass tut). */
export function decomposeCells(c: ChemCtx): void {
  const g = c.g;
  for (let i = 0; i < g.n; i += 1) {
    const sp = g.sp[i];
    if (sp < 0) continue;
    const d = DECOMPOSITIONS.find((x) => SOLI[x.from] === sp);
    if (d === undefined) continue;
    const T = g.T[i];
    if (T < d.T - 80) continue;
    const wet = g.lq[i] === L.aq;
    if (wet && d.wet !== true) continue;
    /* Arrhenius um die Temperatur, bei der es merklich wird (dort zerfällt in 10 s gut die Hälfte; 30 K darunter etwa zwanzigmal langsamer, darüber schneller). */
    const k = 0.06 * Math.exp((150e3 / R) * (1 / d.T - 1 / T));
    if (k < 1e-6) continue;
    const e = g.sn[i] * (1 - Math.exp(-k * c.dt));
    if (e <= 0) continue;
    const form = g.sform[i] as Form;
    g.addSolid(i, sp, -e, form, i);
    for (const [what, k] of d.make) {
      if (what === 'water') {
        if (wet) g.addAq(i, WATER, e * k, i);
        else { g.q[i] -= e * k * GAS_DHF[GASI['H2O(g)']]; gasNear(c, i, GASI['H2O(g)'], e * k); }
        continue;
      }
      const [kind, id] = what.split(':');
      if (kind === 'g') { const gi = GASI[id]; g.q[i] -= e * k * GAS_DHF[gi]; gasNear(c, i, gi, e * k); continue; }
      const to = SOLI[id];
      if (g.sp[i] < 0 || g.sp[i] === to) g.addSolid(i, to, e * k, form === F.piece ? F.powder : form, i);
      else depositAny(g, i, to, e * k, i);
    }
    if (e / c.dt > 1e-7) c.say(`decomp:${d.from}`, `${cap(name(d.from))} rozkłada się podczas ogrzewania.`, i, d.eq);
  }
}

/** Gas aus einem Feststoff: in seine Zelle (wenn sie Gas fasst) oder die nächste, die es tut — sonst eine Blase. */
export function gasNear(c: ChemCtx, i: number, gi: number, dn: number): void {
  const g = c.g;
  if (g.gasVol(i) > g.vol(i) * 0.05) { g.gas[i * NG + gi] += dn; return; }
  for (const j of [i + g.w, i - 1, i + 1, i - g.w]) {
    if (j < 0 || j >= g.n || g.wall(j)) continue;
    if (g.gasVol(j) > g.vol(j) * 0.05) { g.gas[j * NG + gi] += dn; return; }
  }
  c.bubbles.out(i, gi, dn);
}

/** Ein zweiter Feststoff aus einer Reaktion: in eine freie Nachbarzelle. */
function depositAny(g: Grid, i: number, s: number, dn: number, at: number): void {
  for (const j of [i + g.w, i - 1, i + 1, i - g.w]) {
    if (j < 0 || j >= g.n || g.wall(j)) continue;
    if (g.sp[j] < 0 || g.sp[j] === s) { g.addSolid(j, s, dn, F.powder, at); return; }
  }
}
