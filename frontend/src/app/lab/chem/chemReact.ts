/**
 * 2026-10-18 — WAS IN EINEM GEFÄSS REAGIERT (Chemia), aus den Daten:
 *
 *   Metalle      mit Wasser (Na, K, Li, Ca; Mg erst heiss), mit Säure (je nach E°
 *                und Oberfläche), Al und Zn auch mit Lauge, Abscheidung edlerer Metalle
 *                (Fe + Cu²⁺ → Fe²⁺ + Cu) — Na schmilzt zur Kugel und fährt herum, K brennt.
 *   Lösungen     H₂O₂ zerfällt (MnO₂, Kartoffel, I⁻, Fe³⁺ beschleunigen), MnO₄⁻ wird
 *                entfärbt (sauer) oder braun (neutral), Cu löst sich in HNO₃ (NO / NO₂).
 *   Feststoffe   werden nass zu Hydraten (CaO wird heiss, CuSO₄ blau), zersetzen
 *                sich beim Erhitzen (NaHCO₃, CuCO₃, KMnO₄ …), brennen (Mg blendend,
 *                S blau, die Kerze geht aus, wenn der Sauerstoff fehlt).
 *   Gase         NO wird an der Luft braun, NH₃ und HCl werden weisser Rauch.
 *
 * Kein Vorgang kennt seine Wärme: die Bilanz der Bildungsenthalpien
 * (`Vessel.chemical`) gibt sie.
 */

import { AIR, DECOMPOSITIONS, FUELS, HYDRATION, METALS, SPECIES, metalOf, metalOfIon, type GasId } from './chemData';
import { eqDisplace, eqMetalAcid, eqMetalWater } from './chemEq';
import { Lump, type Vessel } from './chemVessel';

const R = 8.314;
const arr = (Ea: number, T: number): number => Math.exp((-Ea / R) * (1 / T - 1 / 298.15));
const name = (id: string): string => SPECIES[id]?.name ?? id;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const STRONG_ANIONS = ['Cl-', 'SO4-2', 'NO3-', 'Br-', 'I-'];

/** Das häufigste Anion einer Säure im Gefäss (für die Gleichung: Mg + 2HCl …). */
function acidAnion(v: Vessel): string | null {
  let best: string | null = null;
  let most = 0;
  for (const a of STRONG_ANIONS) {
    const n = v.aq.get(a) ?? 0;
    if (n > most) { most = n; best = a; }
  }
  return best;
}

/** Wo ein Feststoff im Gefäss liegt (cm über dem Boden) — für die Blasen. */
const spot = (v: Vessel, l: Lump, rate: number) => {
  if (rate > 0) v.fx.spots.push({ x: l.x, y: l.y, rate });
};

/* -- Metalle ------------------------------------------------------------------------------------ */

export function metalStep(v: Vessel, dt: number, t: number): void {
  if (!v.wet()) return;
  const h = v.spec.h;
  const oh = v.spec.oh;
  for (const l of [...v.lumps]) {
    if (l.where !== 'in' || l.n <= 0) continue;
    const m = metalOf(l.sp);
    if (m === undefined) continue;
    const A = l.area();
    const T = v.T;
    if (m.oxide !== undefined && (h > 0.01 || oh > 0.01)) l.age += dt;
    const oxide = m.oxide === undefined ? 1 : Math.min(1, 0.02 + (l.age / m.oxide) ** 2);
    const rw = m.kw * A * arr((m.Ew ?? 50) * 1000, T);
    const ra = m.ka * A * h * arr(40e3, T);
    const rb = (m.kb ?? 0) * A * oh * arr(40e3, T);
    const r = (rw + ra + rb) * oxide;
    const e = Math.min(l.n, r * dt);
    l.heat = 0;
    l.gas = 0;
    if (e > 0) {
      l.n -= e;
      v.addAq(m.ion, e);
      const h2 = (e * m.n) / 2;
      /* Heiss genug (Potas): der Wasserstoff brennt gleich mit — mit dem Sauerstoff über dem Wasser. */
      const dH = -(((SPECIES[m.ion]?.dHf ?? 0) + m.n * ((SPECIES['OH-']?.dHf ?? 0) - (SPECIES.H2O?.dHf ?? 0))) * 1000);
      l.heat = (e / dt) * dH;
      const hot = T + l.heat / (0.5 * Math.max(0.05, A));
      const mp = SPECIES[l.sp]?.mp;
      l.molten = mp !== undefined && hot > mp && l.y > 0.1;
      const o2 = v.gas.get('O2') ?? 0;
      if (hot > 650 && rw > ra && o2 > h2 / 2) {
        v.addGas('O2', -h2 / 2);
        v.addGas('H2O(g)', h2);
        l.burning = true;
        v.say(`flame:${m.id}`, `${cap(name(m.id))} zapala się — wodór spala się ${SPECIES[m.ion]?.flame === '#b07cf0' ? 'fioletowym' : 'żółtym'} płomieniem.`, t, '2H₂ + O₂ → 2H₂O');
      } else {
        v.addGas('H2', h2);
        l.burning = false;
      }
      l.gas = h2 / dt;
      spot(v, l, h2 / dt);
      if (l.gas < 2e-7) { /* zu wenig, um es zu sehen */ } else if (rw >= ra + rb) {
        v.say(`water:${m.id}`, `${cap(name(m.id))} reaguje z wodą — wydziela się gaz (wodór)${(SPECIES[l.sp]?.rho ?? 2) < v.density() ? ', metal pływa po powierzchni' : ''}.`, t, eqMetalWater(m));
        if (l.molten) v.say(`melt:${m.id}`, `${cap(name(m.id))} topi się w srebrzystą kulkę — reakcja wydziela dużo ciepła.`, t);
      } else if (ra >= rb) {
        const eq = eqMetalAcid(m, acidAnion(v));
        v.say(`acid:${m.id}`, `${cap(name(m.id))} roztwarza się w kwasie — wydziela się gaz (wodór).`, t, eq.molecular === null ? eq.ionic : `${eq.molecular};  ${eq.ionic}`);
      } else {
        v.say(`base:${m.id}`, `${cap(name(m.id))} roztwarza się w zasadzie — wydziela się wodór.`, t, m.id === 'Al' ? '2Al + 2OH⁻ + 6H₂O → 2[Al(OH)₄]⁻ + 3H₂↑' : 'Zn + 2OH⁻ + 2H₂O → [Zn(OH)₄]²⁻ + H₂↑');
      }
    }
    /* Abscheidung: ein edleres Metall aus seinen Ionen auf diesem. */
    if (m.kw === 0 && l.n > 0) {
      for (const n of METALS) {
        if (n.E <= m.E + 0.05) continue;
        const c = v.conc(n.ion);
        if (c <= 1e-7) continue;
        const q = SPECIES[n.ion]?.charge ?? 1;
        const rd = 2e-6 * A * c * arr(30e3, T) * (1 - Math.exp(-(n.E - m.E) / 0.15)) * oxide;
        const have = v.aq.get(n.ion) ?? 0;
        const d = Math.min(l.n, rd * dt, (have * q) / m.n);
        if (d <= 0) continue;
        l.n -= d;
        v.addAq(m.ion, d);
        v.addAq(n.ion, (-d * m.n) / q);
        l.coat[n.id] = (l.coat[n.id] ?? 0) + (d * m.n) / q;
        v.say(`displace:${m.id}:${n.id}`, `Na ${name(m.id) === 'żelazo' ? 'żelazie' : 'metalu'} osadza się ${name(n.id)}${n.id === 'Cu' ? ' (czerwonobrunatny nalot)' : n.id === 'Ag' ? ' (srebrzyste kryształki)' : ''}.`, t, eqDisplace(m, n.ion, n.id));
      }
    }
    /* Ganz aufgelöst — das Abgeschiedene bleibt als Pulver liegen. */
    if (l.n <= 1e-12) {
      for (const [metal, amount] of Object.entries(l.coat)) if (amount > 0) v.addLump(metal, amount, 'powder').y = 0;
      v.say(`gone:${l.sp}`, `Cały metal przereagował (${name(l.sp)}).`, t);
    }
  }
}

/* -- Reaktionen in der Lösung --------------------------------------------------------------------- */

interface Rxn {
  readonly id: string;
  readonly eq: string;
  readonly say: string;
  /** Was verbraucht und was gebildet wird: "aq:X", "water", "gas:X", "s:X". */
  readonly use: readonly (readonly [string, number])[];
  readonly make: readonly (readonly [string, number])[];
  /** Umsatz (mol/s) — 0: jetzt nicht. */
  readonly rate: (v: Vessel) => number;
  /** Ein fester Reaktionspartner (Cu in HNO₃): wo die Blasen herkommen. */
  readonly at?: string;
}

const areaOf = (v: Vessel, sp: string): number => v.lumps.reduce((a, l) => a + (l.sp === sp && l.where === 'in' ? l.area() : 0), 0);

const RXNS: readonly Rxn[] = [
  {
    id: 'h2o2', eq: '2H₂O₂ → 2H₂O + O₂↑', say: 'Nadtlenek wodoru rozkłada się — wydziela się tlen.',
    use: [['aq:H2O2', 2]], make: [['water', 2], ['gas:O2', 1]],
    rate: (v) => {
      const c = v.conc('H2O2');
      if (c <= 0) return 0;
      const k = 2e-7 + 2.5e-3 * areaOf(v, 'MnO2') + 1.2e-3 * areaOf(v, 'potato') + 0.4 * v.conc('I-') + 0.05 * v.conc('Fe+3');
      return (c * v.liters() * k * arr(58e3, v.T)) / 2;
    }
  },
  {
    id: 'mno4-fe', eq: 'MnO₄⁻ + 5Fe²⁺ + 8H⁺ → Mn²⁺ + 5Fe³⁺ + 4H₂O', say: 'Fioletowy roztwór odbarwia się — jony żelaza(II) redukują manganian(VII).',
    use: [['aq:MnO4-', 1], ['aq:Fe+2', 5]], make: [['aq:Mn+2', 1], ['aq:Fe+3', 5], ['water', 4]],
    rate: (v) => (v.spec.pH < 4 ? 400 * v.conc('MnO4-') * v.conc('Fe+2') * v.liters() : 0)
  },
  {
    id: 'mno4-h2o2', eq: '2MnO₄⁻ + 5H₂O₂ + 6H⁺ → 2Mn²⁺ + 5O₂↑ + 8H₂O', say: 'Fioletowy roztwór odbarwia się, wydziela się tlen.',
    use: [['aq:MnO4-', 2], ['aq:H2O2', 5]], make: [['aq:Mn+2', 2], ['gas:O2', 5], ['water', 8]],
    rate: (v) => (v.spec.pH < 4 ? 60 * v.conc('MnO4-') * v.conc('H2O2') * v.liters() : 0)
  },
  {
    id: 'mno4-h2o2-n', eq: '2MnO₄⁻ + 3H₂O₂ → 2MnO₂↓ + 3O₂↑ + 2OH⁻ + 2H₂O', say: 'Wytrąca się brunatny osad tlenku manganu(IV), wydziela się tlen.',
    use: [['aq:MnO4-', 2], ['aq:H2O2', 3]], make: [['s:MnO2', 2], ['gas:O2', 3], ['water', 4]],
    rate: (v) => (v.spec.pH >= 4 ? 20 * v.conc('MnO4-') * v.conc('H2O2') * v.liters() : 0)
  },
  {
    id: 'cu-hno3-conc', eq: 'Cu + 4HNO₃ → Cu(NO₃)₂ + 2NO₂↑ + 2H₂O', say: 'Miedź roztwarza się w stężonym kwasie azotowym — wydziela się brunatny gaz (NO₂), roztwór zielenieje.',
    use: [['s:Cu', 1], ['aq:NO3-', 2]], make: [['aq:Cu+2', 1], ['gas:NO2', 2], ['water', 2]], at: 'Cu',
    rate: (v) => (v.spec.h > 6 ? 1.5e-6 * areaOf(v, 'Cu') * v.spec.h * v.conc('NO3-') * arr(30e3, v.T) : 0)
  },
  {
    id: 'cu-hno3', eq: '3Cu + 8HNO₃ → 3Cu(NO₃)₂ + 2NO↑ + 4H₂O', say: 'Miedź roztwarza się w kwasie azotowym — wydziela się bezbarwny gaz (NO), który brunatnieje w powietrzu.',
    use: [['s:Cu', 3], ['aq:NO3-', 2]], make: [['aq:Cu+2', 3], ['gas:NO', 2], ['water', 4]], at: 'Cu',
    rate: (v) => (v.spec.h > 0.5 && v.spec.h <= 6 ? 4e-7 * areaOf(v, 'Cu') * v.spec.h * v.conc('NO3-') * arr(40e3, v.T) : 0)
  }
];

export function liquidStep(v: Vessel, dt: number, t: number): void {
  if (!v.wet()) return;
  for (const r of RXNS) {
    const rate = r.rate(v);
    if (!(rate > 0)) continue;
    let e = rate * dt;
    for (const [what, k] of r.use) e = Math.min(e, have(v, what) / k);
    if (e <= 1e-16) continue;
    for (const [what, k] of r.use) put(v, what, -e * k);
    for (const [what, k] of r.make) put(v, what, e * k);
    const gasMade = r.make.filter(([w]) => w.startsWith('gas:')).reduce((a, [, k]) => a + k * e, 0);
    if (gasMade > 0) {
      const at = r.id === 'h2o2' ? v.lumps.find((l) => (l.sp === 'MnO2' || l.sp === 'potato') && l.where === 'in') : r.at === undefined ? undefined : v.lumps.find((l) => l.sp === r.at);
      if (at !== undefined) spot(v, at, gasMade / dt); else v.fx.bulk += gasMade / dt;
      const soap = v.conc('soap');
      if (soap > 0) v.foam += (gasMade * 24400 * Math.min(1, soap * 30)) / 1;
    }
    if (e / dt > 1e-7) v.say(`rxn:${r.id}`, r.say, t, r.eq);
    v.respeciate();
  }
}

function have(v: Vessel, what: string): number {
  if (what === 'water') return v.water;
  const [kind, id] = what.split(':');
  if (kind === 'aq') return v.aq.get(id) ?? 0;
  if (kind === 'gas') return v.gas.get(id as GasId) ?? 0;
  return v.lumps.reduce((a, l) => a + (l.sp === id && l.where === 'in' ? l.n : 0), 0);
}

function put(v: Vessel, what: string, n: number): void {
  if (what === 'water') { v.water = Math.max(0, v.water + n); return; }
  const [kind, id] = what.split(':');
  if (kind === 'aq') { v.addAq(id, n); return; }
  if (kind === 'gas') { v.addGas(id as GasId, n); return; }
  if (n > 0) { const l = v.addLump(id, n, 'precipitate'); l.suspended = Math.min(1, l.suspended + 0.3); return; }
  let left = -n;
  for (const l of v.lumps) {
    if (l.sp !== id || l.where !== 'in' || left <= 0) continue;
    const take = Math.min(l.n, left);
    l.n -= take;
    left -= take;
  }
}

/* -- Feststoffe: Hydrate, Zersetzung, Feuer --------------------------------------------------------- */

export function hydrateStep(v: Vessel, dt: number, t: number): void {
  if (!v.wet()) return;
  for (const l of [...v.lumps]) {
    const h = HYDRATION.find((x) => x.from === l.sp);
    if (h === undefined || l.where !== 'in' || l.n <= 0) continue;
    const e = Math.min(l.n, h.k * l.area() * dt, v.water / h.water);
    if (e <= 0) continue;
    l.n -= e;
    v.water -= e * h.water;
    const made = v.addLump(h.to, e, 'powder');
    made.x = l.x;
    made.y = l.y;
    v.say(`hydrate:${l.sp}`, l.sp === 'CuSO4' ? 'Biały siarczan miedzi(II) z wodą barwi się na niebiesko.' : l.sp === 'CaO' ? 'Wapno palone reaguje z wodą — mieszanina mocno się ogrzewa (gaszenie wapna).' : `${cap(name(l.sp))} reaguje z wodą.`, t, h.eq);
  }
}

export function decomposeStep(v: Vessel, dt: number, t: number): void {
  for (const l of [...v.lumps]) {
    const d = DECOMPOSITIONS.find((x) => x.from === l.sp);
    if (d === undefined || l.where !== 'in' || l.n <= 0) continue;
    if (v.wet() && d.wet !== true) continue;
    if (v.T < d.T - 30) continue;
    const s = 1 / (1 + Math.exp(-(v.T - d.T) / 8));
    if (s < 1e-4) continue;
    const e = Math.min(l.n, l.n * 0.12 * s * dt + 1e-9 * s);
    l.n -= e;
    for (const [what, k] of d.make) {
      if (what === 'water') { if (v.wet()) v.water += e * k; else v.addGas('H2O(g)', e * k); continue; }
      const [kind, id] = what.split(':');
      if (kind === 'g') { v.addGas(id as GasId, e * k); if (v.wet()) v.fx.bulk += (e * k) / dt; continue; }
      const made = v.addLump(id, e * k, l.form === 'precipitate' ? 'precipitate' : 'powder');
      if (made.form !== 'precipitate') { made.x = l.x; made.y = l.y; }
    }
    if (e / dt > 1e-7) v.say(`decomp:${l.sp}`, `${cap(name(l.sp))} rozkłada się podczas ogrzewania.`, t, d.eq);
  }
}

/** Ein Feststoff fängt Feuer, wenn die Flamme heiss genug ist (Streichholz ~900 K, Brenner ~1300 K). */
export function igniteLump(l: Lump, source: number): boolean {
  const f = FUELS.find((x) => x.id === l.sp);
  if (f === undefined || l.n <= 0) return false;
  if (f.fine === true && l.form !== 'powder') return false;
  if (source < f.ignite) return false;
  l.burning = true;
  return true;
}

export function fireStep(v: Vessel, dt: number, t: number): void {
  /* Ein offener Tiegel, eine Schale: das Feuer brennt in der Luft des Zimmers (nur die Produkte bleiben kurz im Gefäss). */
  const open = !v.closed && (v.kind === 'crucible' || v.kind === 'dish');
  const xo = open ? Math.max(v.frac('O2'), AIR.O2 ?? 0.207) : v.frac('O2');
  for (const l of [...v.lumps]) {
    const f = FUELS.find((x) => x.id === l.sp);
    if (f === undefined || l.n <= 0) continue;
    /* Im heissen, trockenen Tiegel entzündet es sich von selbst. */
    if (!l.burning && !v.wet() && v.T > f.ignite && xo > f.xmin) {
      l.burning = true;
      v.say(`ignite:${l.sp}`, `${cap(name(l.sp))} zapala się.`, t);
    }
    if (!l.burning) continue;
    if ((v.wet() && l.where === 'in' && l.y < v.level() - 0.05) || xo < f.xmin) {
      l.burning = false;
      v.say(`out:${l.id}`, xo < f.xmin ? 'Płomień gaśnie — zabrakło tlenu.' : 'Płomień gaśnie w wodzie.', t);
      continue;
    }
    const o2 = open ? Infinity : v.gas.get('O2') ?? 0;
    /* Was brennt, brennt an seiner Oberfläche: ein Häufchen Pulver wie ein Stück (nur Wolle und Band sind ganz offen). */
    const surface = f.fine === true || l.form === 'ribbon' ? l.area() : Lump.areaOf(l.sp, l.n, 'piece');
    const rate = (f.id === 'wax' ? f.k : f.k * surface) * (xo / 0.21);
    const e = Math.min(l.n, rate * dt, o2 / f.o2);
    if (e <= 0) continue;
    l.n -= e;
    if (open) v.exchange('O2', e * f.o2);
    v.addGas('O2', -e * f.o2);
    for (const [what, k] of f.make) {
      const [kind, id] = what.split(':');
      if (kind === 'g') v.addGas(id as GasId, e * k);
      else { const made = v.addLump(id, e * k, 'powder'); made.x = l.x; made.y = l.y; made.where = l.where; }
    }
    l.heat = (e / dt) * 4e5;
    if (f.smoke !== null) { v.fx.smoke += e / dt; v.fx.smokeColor = f.smoke; }
    if (f.id === 'Fe') v.fx.sparks += e / dt;
    v.say(`burn:${l.sp}`, burnText(l.sp, xo), t, f.eq);
  }
  /* Etanol auf dem Wasser oder in der Schale brennt an der Oberfläche. */
  const eth = v.aq.get('ethanol') ?? 0;
  if (v.burning && eth > 0) {
    const share = eth / (eth + v.water);
    const f = FUELS.find((x) => x.id === 'ethanol');
    if (f === undefined || share < 0.2 || xo < f.xmin) {
      v.burning = false;
      v.say('out:ethanol', 'Płomień gaśnie.', t);
    } else {
      const r = v.shape.halfWidth(v.level());
      const e = Math.min(eth, f.k * Math.PI * r * r * (xo / 0.21) * dt, (v.gas.get('O2') ?? 0) / f.o2);
      v.addAq('ethanol', -e);
      v.addGas('O2', -e * f.o2);
      v.addGas('CO2', e * 2);
      v.addGas('H2O(g)', e * 3);
      v.say('burn:ethanol', 'Etanol pali się niebieskawym płomieniem.', t, f.eq);
    }
  } else if (v.burning) v.burning = false;
}

const burnText = (sp: string, xo: number): string => {
  const more = xo > 0.4 ? ' — w tlenie znacznie jaśniej' : '';
  switch (sp) {
    case 'Mg': return `Magnez spala się oślepiająco jasnym płomieniem, powstaje biały proszek (tlenek magnezu)${more}.`;
    case 'S': return `Siarka topi się i spala niebieskim płomieniem — powstaje gaz o duszącym zapachu (SO₂)${more}.`;
    case 'C': return `Węgiel żarzy się${more}.`;
    case 'Fe': return `Wata stalowa spala się, sypiąc iskrami${more}.`;
    case 'wax': return `Świeca pali się${more}.`;
    default: return `${cap(name(sp))} pali się${more}.`;
  }
};

/* -- Gase untereinander ------------------------------------------------------------------------- */

export function gasStep(v: Vessel, dt: number, t: number): void {
  const no = v.gas.get('NO') ?? 0;
  const o2 = v.gas.get('O2') ?? 0;
  if (no > 1e-9 && o2 > 1e-9) {
    const e = Math.min(no, o2 * 2, no * (1 - Math.exp(-dt * 1.5 * v.frac('O2') * 5)));
    v.addGas('NO', -e);
    v.addGas('O2', -e / 2);
    v.addGas('NO2', e);
    if (v.frac('NO2') > 0.01) v.say('gas:NO2', 'Bezbarwny tlenek azotu(II) reaguje z tlenem z powietrza — gaz brunatnieje.', t, '2NO + O₂ → 2NO₂');
  }
  const nh3 = v.gas.get('NH3') ?? 0;
  const hcl = v.gas.get('HCl(g)') ?? 0;
  if (nh3 > 1e-9 && hcl > 1e-9 && v.T < 600) {
    const e = Math.min(nh3, hcl) * (1 - Math.exp(-dt * 8));
    v.addGas('NH3', -e);
    v.addGas('HCl(g)', -e);
    const made = v.addLump('NH4Cl', e, 'powder');
    made.y = v.shape.H * 0.7;
    v.fx.smoke += e / dt;
    v.fx.smokeColor = '#f8f8f8';
    v.say('smoke:NH4Cl', 'Powstaje biały dym — drobne kryształki chlorku amonu.', t, 'NH₃ + HCl → NH₄Cl');
  }
}

/** Ein Metall-Ion, das als Metall abgeschieden werden kann (für die Lupe und Farben). */
export const depositOf = (ion: string): string | null => metalOfIon(ion)?.id ?? null;

/** Ein neuer Brocken an einer Stelle (für das Werkzeug „Löffel”). */
export const lumpAt = (sp: string, n: number, x: number, y: number): Lump => new Lump(sp, n, 'powder', x, y);
