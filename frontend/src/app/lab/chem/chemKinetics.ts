/**
 * 2026-10-18 — REAKTIONEN MIT IHRER GESCHWINDIGKEIT (Chemia). Was schnell ins
 * Gleichgewicht kommt (Säuren, Basen, Komplexe, Löslichkeit), rechnet
 * `chemPh`/`chemAq` als Gleichgewicht. Alles Langsamere steht hier als Zeile
 * mit seinem Geschwindigkeitsgesetz — wie in Programmen für reaktiven
 * Transport (PHREEQC, CrunchFlow): Gleichgewicht für das Schnelle, Kinetik für
 * das Langsame, dazwischen der Transport.
 *
 *   r = k(T) · (V oder A) · Π cᵢ^nᵢ        k(T) = k₂₅ · exp(−Eₐ/R · (1/T − 1/298 K))
 *
 * V: das Wasser (bzw. Gas) der Zelle in Litern, A: die Fläche eines
 * Feststoffs, der die Zelle berührt (Katalysator oder Reaktionspartner), cᵢ in
 * mol/L — auch H⁺ und OH⁻ (aus dem pH) und gelöste Katalysatoren, die nicht
 * verbraucht werden. Jeder Weg ist eine eigene Zeile (H₂O₂ zerfällt von selbst,
 * mit I⁻, an MnO₂, durch die Katalase der Kartoffel — die über 60 °C zerstört
 * wird). Umkehrbare Reaktionen laufen zurück (k_rück = k/K(T), K nach van 't
 * Hoff aus den Bildungsenthalpien), bis Q = K: es bleibt ein Rest.
 *
 * Eine Reaktion geschieht dort, wo alles zusammen ist — in derselben Zelle oder
 * an der Seite des Feststoffs. Je Schritt höchstens bis dahin, wo ein Edukt
 * aufgebraucht ist bzw. Q = K: ξ = ξ_max·(1 − e^(−r·dt/ξ_max)) — für erste
 * Ordnung genau, und nie über das Ziel hinaus, bei jedem Zeitschritt.
 */

import { SPECIES } from './chemData';
import { NC, WATER, aqVolume, concOf, slotOf } from './chemAq';
import { deposit, near4, specAt, type ChemCtx } from './chemCell';
import { CELL, F, GASI, GAS_DHF, GRAIN, Grid, L, NG, SOLI, SOL_M, SOL_RHO, type Form } from './chemGrid';
const R = 8.314;

/** Eine Reaktion mit ihrem Geschwindigkeitsgesetz. */
export interface Kinetic {
  readonly id: string;
  readonly eq: string;
  readonly say: string;
  /** 'aq:X' gelöst, 's:X' der Feststoff an der Seite, 'gas:X', 'water'. */
  readonly use: readonly (readonly [string, number])[];
  readonly make: readonly (readonly [string, number])[];
  /** k bei 25 °C: in Lösung/Gas mol/(L·s)·(mol/L)^−Σn, an einer Fläche mol/(cm²·s)·(mol/L)^−Σn. */
  readonly k: number;
  /** Aktivierungsenergie (kJ/mol). */
  readonly Ea: number;
  /** Ordnungen (gelöste Stoffe, H⁺, OH⁻, Katalysatoren) — ohne: die Koeffizienten der gelösten bzw. gasförmigen Edukte. */
  readonly order?: Readonly<Record<string, number>>;
  /** An der Fläche dieses Feststoffs (Katalysator oder Edukt „s:X”). */
  readonly surface?: string;
  /** Nur in diesem pH-Bereich (der Weg hängt davon ab). */
  readonly pH?: readonly [number, number];
  /** Nur bis zu dieser Temperatur (K) — ein Enzym wird darüber zerstört. */
  readonly maxT?: number;
  /** Umkehrbar: K bei 25 °C (mol/L) — ΔH für van 't Hoff aus den Bildungsenthalpien. */
  readonly K?: number;
  /** Wie viele H⁺ (bzw. OH⁻) je Umsatz verbraucht werden — H⁺ und OH⁻ zählt niemand (der pH folgt aus der Ladung), aber
      ohne Säure geht eine saure Reaktion nicht weiter: je Schritt höchstens so weit, wie freie Säure (Lauge) da ist. */
  readonly acid?: number;
  readonly base?: number;
}

/**
 * DIE LANGSAMEN REAKTIONEN. Konstanten nach Lehrbuchwerten, wo es sie gibt
 * (H₂O₂ mit I⁻: k ≈ 0,012 L/(mol·s), Eₐ ≈ 56 kJ/mol; Tiosiarczan mit Säure: das
 * „verschwindende Kreuz” nach ~45 s bei 20 °C), sonst so, dass der Versuch im
 * Klassenzimmer so schnell geht wie in Wirklichkeit.
 */
export const KINETICS: readonly Kinetic[] = [
  {
    id: 'h2o2', eq: '2H₂O₂ → 2H₂O + O₂↑', say: 'Nadtlenek wodoru rozkłada się — wydziela się tlen.',
    use: [['aq:H2O2', 2]], make: [['water', 2], ['gas:O2', 1]], k: 1e-8, Ea: 75, order: { H2O2: 1 }
  },
  {
    id: 'h2o2-i', eq: '2H₂O₂ → 2H₂O + O₂↑ (katalizator: I⁻)', say: 'Nadtlenek wodoru rozkłada się — jony jodkowe przyspieszają reakcję, wydziela się tlen.',
    use: [['aq:H2O2', 2]], make: [['water', 2], ['gas:O2', 1]], k: 0.012, Ea: 56, order: { H2O2: 1, 'I-': 1 }
  },
  {
    id: 'h2o2-fe', eq: '2H₂O₂ → 2H₂O + O₂↑ (katalizator: Fe³⁺)', say: 'Nadtlenek wodoru rozkłada się — jony żelaza(III) przyspieszają reakcję.',
    use: [['aq:H2O2', 2]], make: [['water', 2], ['gas:O2', 1]], k: 0.05, Ea: 50, order: { H2O2: 1, 'Fe+3': 1 }
  },
  {
    id: 'h2o2-mno2', eq: '2H₂O₂ → 2H₂O + O₂↑ (katalizator: MnO₂)', say: 'Nadtlenek wodoru rozkłada się na powierzchni tlenku manganu(IV) — wydziela się tlen.',
    use: [['aq:H2O2', 2]], make: [['water', 2], ['gas:O2', 1]], k: 5e-6, Ea: 58, order: { H2O2: 1 }, surface: 'MnO2'
  },
  {
    id: 'h2o2-katalaza', eq: '2H₂O₂ → 2H₂O + O₂↑ (enzym: katalaza)', say: 'Katalaza z ziemniaka rozkłada nadtlenek wodoru — wydziela się tlen.',
    use: [['aq:H2O2', 2]], make: [['water', 2], ['gas:O2', 1]], k: 3e-5, Ea: 20, order: { H2O2: 1 }, surface: 'potato', maxT: 333
  },
  {
    id: 'mno4-fe', eq: 'MnO₄⁻ + 5Fe²⁺ + 8H⁺ → Mn²⁺ + 5Fe³⁺ + 4H₂O', say: 'Fioletowy roztwór odbarwia się — jony żelaza(II) redukują manganian(VII).',
    use: [['aq:MnO4-', 1], ['aq:Fe+2', 5]], make: [['aq:Mn+2', 1], ['aq:Fe+3', 5], ['water', 4]], k: 400, Ea: 40, order: { 'MnO4-': 1, 'Fe+2': 1 }, pH: [-3, 4], acid: 8
  },
  {
    id: 'mno4-h2o2', eq: '2MnO₄⁻ + 5H₂O₂ + 6H⁺ → 2Mn²⁺ + 5O₂↑ + 8H₂O', say: 'Fioletowy roztwór odbarwia się, wydziela się tlen.',
    use: [['aq:MnO4-', 2], ['aq:H2O2', 5]], make: [['aq:Mn+2', 2], ['gas:O2', 5], ['water', 8]], k: 60, Ea: 45, order: { 'MnO4-': 1, H2O2: 1 }, pH: [-3, 4], acid: 6
  },
  {
    id: 'mno4-h2o2-n', eq: '2MnO₄⁻ + 3H₂O₂ → 2MnO₂↓ + 3O₂↑ + 2OH⁻ + 2H₂O', say: 'Wytrąca się brunatny osad tlenku manganu(IV), wydziela się tlen.',
    use: [['aq:MnO4-', 2], ['aq:H2O2', 3]], make: [['s:MnO2', 2], ['gas:O2', 3], ['water', 4]], k: 20, Ea: 45, order: { 'MnO4-': 1, H2O2: 1 }, pH: [4, 16]
  },
  {
    id: 'cu-hno3-conc', eq: 'Cu + 4HNO₃ → Cu(NO₃)₂ + 2NO₂↑ + 2H₂O', say: 'Miedź roztwarza się w stężonym kwasie azotowym — wydziela się brunatny gaz (NO₂), roztwór zielenieje.',
    use: [['s:Cu', 1], ['aq:NO3-', 2]], make: [['aq:Cu+2', 1], ['gas:NO2', 2], ['water', 2]], k: 1.5e-6, Ea: 30, order: { 'H+': 1, 'NO3-': 1 }, surface: 'Cu', pH: [-3, -0.78], acid: 4
  },
  {
    id: 'cu-hno3', eq: '3Cu + 8HNO₃ → 3Cu(NO₃)₂ + 2NO↑ + 4H₂O', say: 'Miedź roztwarza się w kwasie azotowym — wydziela się bezbarwny gaz (NO), który brunatnieje w powietrzu.',
    use: [['s:Cu', 3], ['aq:NO3-', 2]], make: [['aq:Cu+2', 3], ['gas:NO', 2], ['water', 4]], k: 4e-7, Ea: 40, order: { 'H+': 1, 'NO3-': 1 }, surface: 'Cu', pH: [-0.78, 0.3], acid: 8
  },
  {
    /* Das „verschwindende Kreuz”: erste Ordnung im Tiosiarczan, solange es sauer ist; die Zeit bis zur Trübung halbiert sich etwa alle 10 K. */
    id: 'tiosiarczan', eq: 'S₂O₃²⁻ + 2H⁺ → S↓ + SO₂ + H₂O', say: 'Roztwór mętnieje — wydziela się koloidalna siarka.',
    use: [['aq:S2O3-2', 1]], make: [['s:S', 1], ['aq:SO2(aq)', 1], ['water', 1]], k: 2.6e-4, Ea: 45, order: { 'S2O3-2': 1 }, pH: [-3, 3], acid: 2
  },
  {
    /* Chromian ⇄ dichromian: in kwaśnym roztworze żółty chromian przechodzi w pomarańczowy dichromian, w zasadowym odwrotnie. */
    id: 'chromian', eq: '2CrO₄²⁻ + 2H⁺ → Cr₂O₇²⁻ + H₂O', say: 'Żółty roztwór chromianu staje się pomarańczowy — powstaje dichromian.',
    use: [['aq:CrO4-2', 2]], make: [['aq:Cr2O7-2', 1], ['water', 1]], k: 50, Ea: 40, order: { 'CrO4-2': 1 }, pH: [-3, 5], acid: 2
  },
  {
    id: 'dichromian', eq: 'Cr₂O₇²⁻ + 2OH⁻ → 2CrO₄²⁻ + H₂O', say: 'Pomarańczowy dichromian w zasadzie przechodzi w żółty chromian.',
    use: [['aq:Cr2O7-2', 1]], make: [['aq:CrO4-2', 2], ['water', 1]], k: 50, Ea: 40, order: { 'Cr2O7-2': 1 }, pH: [8, 16], base: 2
  },
  {
    /* Umkehrbar im Gas: 2NO₂ ⇄ N₂O₄ — warm brauner (mehr NO₂), kalt blasser (ΔH = +57 kJ/mol für den Zerfall). */
    id: 'n2o4', eq: 'N₂O₄ ⇄ 2NO₂', say: 'Brunatny tlenek azotu(IV) i bezbarwny tetratlenek diazotu dochodzą do równowagi.',
    use: [['gas:N2O4', 1]], make: [['gas:NO2', 2]], k: 1e5, Ea: 55, order: { N2O4: 1 }, K: 4.6e-3
  }
];

/* -- Vorbereitet: Ordnungen als Plätze, wo nötig ------------------------------------------------- */

interface Term { readonly id: string; readonly slot: number; readonly gi: number; readonly n: number }
interface Prepared {
  readonly r: Kinetic;
  readonly gas: boolean;
  /** Gelöste bzw. gasförmige Edukte (verbraucht), mit Koeffizient. */
  readonly inputs: readonly { readonly what: string; readonly slot: number; readonly gi: number; readonly s: number; readonly nu: number }[];
  readonly outputs: readonly { readonly what: string; readonly slot: number; readonly gi: number; readonly s: number; readonly nu: number }[];
  /** Was in der Zelle sein muss, damit es überhaupt geht. */
  readonly need: readonly number[];
  readonly terms: readonly Term[];
  readonly surf: number;
  readonly dH: number;
}

const part = (what: string, nu: number) => {
  const [kind, id] = what === 'water' ? ['water', 'H2O'] : what.split(':');
  return { what, slot: kind === 'aq' ? slotOf(id) : kind === 'water' ? WATER : -1, gi: kind === 'gas' ? GASI[id] ?? -1 : -1, s: kind === 's' ? SOLI[id] ?? -1 : -1, nu };
};

/** Bildungsenthalpie (J/mol) eines Teils — für ΔH der Reaktion (van 't Hoff). */
const dHf = (what: string): number => {
  if (what === 'water') return (SPECIES.H2O?.dHf ?? 0) * 1000;
  const id = what.slice(what.indexOf(':') + 1);
  return (SPECIES[id]?.dHf ?? 0) * 1000;
};

const PREPARED: readonly Prepared[] = KINETICS.map((r) => {
  const inputs = r.use.map(([w, nu]) => part(w, nu));
  const outputs = r.make.map(([w, nu]) => part(w, nu));
  const gas = inputs.every((x) => x.gi >= 0);
  const order = r.order ?? Object.fromEntries(r.use.filter(([w]) => w.startsWith('aq:') || w.startsWith('gas:')).map(([w, nu]) => [w.slice(w.indexOf(':') + 1), nu]));
  const terms = Object.entries(order).map(([id, n]) => ({ id, slot: id === 'H+' || id === 'OH-' || gas ? -1 : slotOf(id), gi: gas ? GASI[id] ?? -1 : -1, n }));
  const need = [...inputs.filter((x) => x.slot >= 0 && x.what !== 'water').map((x) => x.slot), ...terms.filter((t) => t.slot >= 0).map((t) => t.slot)];
  const dH = outputs.reduce((a, x) => a + x.nu * dHf(x.what), 0) - inputs.reduce((a, x) => a + x.nu * dHf(x.what), 0);
  return { r, gas, inputs, outputs, need: [...new Set(need)], terms, surf: r.surface !== undefined ? SOLI[r.surface] ?? -1 : -1, dH };
});

const AQ_P = PREPARED.filter((p) => !p.gas);
const GAS_P = PREPARED.filter((p) => p.gas);

const arr = (EaKJ: number, T: number): number => Math.exp(((-EaKJ * 1000) / R) * (1 / T - 1 / 298.15));
const SOL_NAMES: readonly string[] = Object.keys(SOLI).sort((a, b) => SOLI[a] - SOLI[b]);

/** Die Feststoffe an einer Zelle Wasser: in ihr selbst (alle Körner) und in den Nachbarzellen (die eine Seite). */
function around(g: Grid, i: number): Map<number, { cell: number; A: number }[]> {
  const out = new Map<number, { cell: number; A: number }[]>();
  for (const j of [i, ...near4(g, i)]) {
    const s = g.sp[j];
    if (s < 0) continue;
    const vol = (g.sn[j] * SOL_M[s]) / SOL_RHO[s];
    const A = j === i ? ((GRAIN[g.sform[j]] ?? 0) > 0 ? (3 * vol) / GRAIN[g.sform[j]] : 4.84 * vol ** (2 / 3)) : CELL * Math.min(g.D[i], g.D[j]);
    const list = out.get(s);
    if (list === undefined) out.set(s, [{ cell: j, A }]); else list.push({ cell: j, A });
  }
  return out;
}

/**
 * EIN SCHRITT DER LANGSAMEN REAKTIONEN: in jeder Zelle Wasser die Reaktionen in
 * Lösung und an Flächen, in jeder Zelle Gas die Reaktionen im Gas.
 */
export function kineticCells(c: ChemCtx): void {
  const g = c.g;
  for (let i = 0; i < g.n; i += 1) {
    if (g.lq[i] === L.aq) aqCell(c, i);
    else if (g.lq[i] === L.none && !g.wall(i)) gasCell(c, i);
  }
}

function aqCell(c: ChemCtx, i: number): void {
  const g = c.g;
  const o = i * NC;
  let any = false;
  for (const p of AQ_P) {
    let ok = true;
    for (const k of p.need) if (!(g.comp[o + k] > 0)) { ok = false; break; }
    if (ok) { any = true; break; }
  }
  if (!any) return;
  const V = aqVolume(g.comp, o) / 1000;
  if (V <= 1e-8) return;
  const spec = specAt(g, i);
  const T = g.T[i];
  let touching: Map<number, { cell: number; A: number }[]> | null = null;
  for (const p of AQ_P) {
    let ok = true;
    for (const k of p.need) if (!(g.comp[o + k] > 0)) { ok = false; break; }
    if (!ok) continue;
    const r = p.r;
    if (r.pH !== undefined && (spec.pH < r.pH[0] || spec.pH > r.pH[1])) continue;
    if (r.maxT !== undefined && T > r.maxT) continue;
    let basis = V;
    if (p.surf >= 0) {
      touching ??= around(g, i);
      basis = (touching.get(p.surf) ?? []).reduce((a, x) => a + x.A, 0);
      if (basis <= 0) continue;
    }
    const conc = (t: Term): number => (t.id === 'H+' ? spec.h : t.id === 'OH-' ? spec.oh : concOf(g.comp, o, spec, t.id));
    let rate = r.k * arr(r.Ea, T) * basis;
    for (const t of p.terms) rate *= conc(t) ** t.n;
    if (!(rate > 0)) continue;
    /* Wie weit es höchstens geht: bis ein Edukt aufgebraucht ist. */
    let most = Infinity;
    for (const x of p.inputs) {
      const have = x.what === 'water' ? g.comp[o + WATER] : x.slot >= 0 ? g.comp[o + x.slot] : x.s >= 0 ? (touching ?? (touching = around(g, i))).get(x.s)?.reduce((a, y) => a + g.sn[y.cell], 0) ?? 0 : Infinity;
      most = Math.min(most, have / x.nu);
    }
    if (r.acid !== undefined) most = Math.min(most, (spec.h * V) / r.acid);
    if (r.base !== undefined) most = Math.min(most, (spec.oh * V) / r.base);
    if (!(most > 1e-15)) continue;
    const xi = most * (1 - Math.exp(-(rate * c.dt) / most));
    if (!(xi > 1e-16)) continue;
    apply(c, i, p, xi, touching);
    report(c, i, p, xi);
  }
}

function gasCell(c: ChemCtx, i: number): void {
  const g = c.g;
  const og = i * NG;
  /* Eine umkehrbare Reaktion geht auch von der anderen Seite los (nur NO₂ in der Kolbe: es bildet sich N₂O₄). */
  const present = (p: Prepared): boolean => p.inputs.every((x) => g.gas[og + x.gi] > 1e-14) || (p.r.K !== undefined && p.outputs.every((x) => x.gi < 0 || g.gas[og + x.gi] > 1e-14));
  let any = false;
  for (const p of GAS_P) if (present(p)) { any = true; break; }
  if (!any) return;
  const V = g.gasVol(i) / 1000;
  if (V <= 1e-9) return;
  const T = g.T[i];
  for (const p of GAS_P) {
    if (!present(p)) continue;
    const r = p.r;
    const kT = r.k * arr(r.Ea, T);
    let rate = kT * V;
    for (const t of p.terms) rate *= (Math.max(0, g.gas[og + t.gi]) / V) ** t.n;
    if (r.K === undefined) {
      if (!(rate > 0)) continue;
      let most = Infinity;
      for (const x of p.inputs) most = Math.min(most, g.gas[og + x.gi] / x.nu);
      if (!(most > 1e-15)) continue;
      const xi = most * (1 - Math.exp(-(rate * c.dt) / most));
      if (xi > 1e-16) { apply(c, i, p, xi, null); report(c, i, p, xi); }
      continue;
    }
    /* Umkehrbar: wohin es geht (Q gegen K), wie weit (bis Q = K) und wie schnell (die Hinreaktion und ihr Gegenstück). */
    const K = r.K * Math.exp((-p.dH / R) * (1 / T - 1 / 298.15));
    const amount = (x: { gi: number }) => Math.max(0, g.gas[og + x.gi]);
    /* Das Ziel mit der eigenen Wärme: eine Gaszelle hat kaum Wärmekapazität — die Reaktion erwärmt (kühlt) sie, und das
       verschiebt K mit; sonst schaukelten sich Wärme und Gleichgewicht von Schritt zu Schritt auf. */
    const C = g.cap(i);
    const target = towardK(g, og, V, p, (xi) => Math.log(r.K as number) - (p.dH / R) * (1 / Math.max(100, T - (p.dH * xi) / C) - 1 / 298.15));
    if (Math.abs(target) <= 1e-16) continue;
    let rb = (kT / K) * V;
    for (const x of p.outputs) if (x.gi >= 0) rb *= (amount(x) / V) ** x.nu;
    const net = Math.abs(rate - rb);
    const xi = target * (1 - Math.exp(-(net * c.dt) / Math.abs(target)));
    if (Math.abs(xi) > 1e-16) { apply(c, i, p, xi, null); if (xi > 0) report(c, i, p, xi); }
  }
}

/** Wie weit eine umkehrbare Gasreaktion in einer Zelle bis Q = K geht (mol; negativ: rückwärts) — Halbieren; `lnK(ξ)`: K darf mit dem Umsatz wandern (Wärme). */
function towardK(g: Grid, og: number, V: number, p: Prepared, lnKof: (xi: number) => number): number {
  const amount = (x: { gi: number }) => Math.max(0, g.gas[og + x.gi]);
  const lnQ = (xi: number): number => {
    let q = 0;
    for (const x of p.outputs) if (x.gi >= 0) q += x.nu * Math.log(Math.max(1e-300, (amount(x) + x.nu * xi) / V));
    for (const x of p.inputs) q -= x.nu * Math.log(Math.max(1e-300, (amount(x) - x.nu * xi) / V));
    return q;
  };
  let hi = Infinity;
  for (const x of p.inputs) hi = Math.min(hi, amount(x) / x.nu);
  let lo = -Infinity;
  for (const x of p.outputs) if (x.gi >= 0) lo = Math.max(lo, -amount(x) / x.nu);
  if (!Number.isFinite(hi) || !Number.isFinite(lo) || hi - lo <= 1e-18) return 0;
  const f = (xi: number): number => lnQ(xi) - lnKof(xi);
  let a = lo + (hi - lo) * 1e-12;
  let b = hi - (hi - lo) * 1e-12;
  if (f(a) > 0 || f(b) < 0) return 0;
  for (let k = 0; k < 60; k += 1) { const m = (a + b) / 2; if (f(m) > 0) b = m; else a = m; }
  return (a + b) / 2;
}

/**
 * Gas aus der Flasche ist längst im Gleichgewicht (NO₂ mit N₂O₄): die Mengen
 * gleich so, wie sie bei T sind — ohne Wärme, die ist beim Abfüllen geflossen.
 */
export function settleGas(g: Grid, i: number): void {
  const og = i * NG;
  const V = g.gasVol(i) / 1000;
  if (V <= 1e-9) return;
  for (const p of GAS_P) {
    if (p.r.K === undefined) continue;
    const lnK = Math.log(p.r.K) - (p.dH / R) * (1 / g.T[i] - 1 / 298.15);
    const xi = towardK(g, og, V, p, () => lnK);
    if (Math.abs(xi) <= 1e-18) continue;
    for (const x of p.inputs) g.gas[og + x.gi] = Math.max(0, g.gas[og + x.gi] - xi * x.nu);
    for (const x of p.outputs) if (x.gi >= 0) g.gas[og + x.gi] = Math.max(0, g.gas[og + x.gi] + xi * x.nu);
  }
}

/** Die Mengen ändern sich (mit ihrer Bildungsenthalpie — die Wärme der Reaktion folgt daraus). */
function apply(c: ChemCtx, i: number, p: Prepared, xi: number, touching: Map<number, { cell: number; A: number }[]> | null): void {
  const g = c.g;
  const change = (x: Prepared['inputs'][number], dn: number): void => {
    if (x.what === 'water') { g.addAq(i, WATER, dn); return; }
    if (x.slot >= 0) { g.addAq(i, x.slot, dn); return; }
    if (x.gi >= 0) {
      if (p.gas) { g.addGas(i, x.gi, dn); return; }
      /* Gas aus einer Lösung: Bläschen (die Bildungsenthalpie des Gases ist hier gebucht). */
      if (dn > 0) { g.q[i] -= dn * GAS_DHF[x.gi]; c.bubbles.out(i, x.gi, dn); g.fizz[i] += dn / c.dt; }
      return;
    }
    if (x.s >= 0) {
      if (dn > 0) { deposit(g, i, x.s, dn, F.precip, i); return; }
      let left = -dn;
      for (const y of touching?.get(x.s) ?? []) {
        if (left <= 0) break;
        const d = Math.min(left, g.sn[y.cell]);
        g.addSolid(y.cell, x.s, -d, g.sform[y.cell] as Form, i);
        left -= d;
      }
    }
  };
  for (const x of p.inputs) change(x, -xi * x.nu);
  for (const x of p.outputs) change(x, xi * x.nu);
}

/**
 * Eine Beobachtung, sobald es merklich geht — entsteht ein Feststoff (Schwefel,
 * MnO₂), erst wenn man ihn sieht (dieselbe Schwelle wie bei Niederschlägen).
 */
function report(c: ChemCtx, i: number, p: Prepared, xi: number): void {
  const solid = p.outputs.find((x) => x.s >= 0);
  if (solid !== undefined) { c.say(`precip:${SOL_NAMES[solid.s]}`, p.r.say, i, p.r.eq); return; }
  if (xi / c.dt >= 1e-7) c.say(`rxn:${p.r.id}`, p.r.say, i, p.r.eq);
}

/** Für die Prüfung: k(T) einer Reaktion. */
export const rateConstant = (id: string, T: number): number => { const r = KINETICS.find((x) => x.id === id); return r === undefined ? 0 : r.k * arr(r.Ea, T); };
