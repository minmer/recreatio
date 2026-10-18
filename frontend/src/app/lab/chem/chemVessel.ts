/**
 * 2026-10-18 — EIN GEFÄSS DER CHEMIA: seine Gestalt (Zlewka, Kolba,
 * Probówka …: wie hoch die Flüssigkeit bei wie viel Milliliter steht) und
 * was darin ist — Wasser, Gelöstes (starke Ionen, die Vorräte der schwachen
 * Säuren und Basen, Moleküle, Indikatoren), Feststoffe (Stücke, Pulver,
 * Kristalle, Niederschlag), das Gas darüber, eine Temperatur.
 *
 * <b>Die Wärme kommt aus der Bilanz</b>: `chemical()` ist die Summe der
 * Bildungsenthalpien von allem im Gefäss (mit den Formen aus `chemPh.ts`).
 * Ändert ein Vorgang, was darin ist, ändert sich diese Summe — die
 * Differenz ist Wärme, und sie erwärmt (oder kühlt) Wasser, Glas und Gas
 * zusammen. Eine Reaktion muss ihre Wärme nicht kennen.
 */

import { CX_BY_METAL, NEUTRAL, emptySol, formEnthalpy, speciate, type Sol, type Spec } from './chemPh';
import {
  AIR, GASES, INDICATORS, POOLS, POOL_MEMBER, P_ATM_KPA, R, SPECIES, VESSELS, indicatorOf,
  type GasId, type PoolId, type VesselKind, type VesselType
} from './chemData';

/* -- Feststoffe --------------------------------------------------------------------------------- */

export type LumpForm = 'piece' | 'granules' | 'powder' | 'ribbon' | 'crystals' | 'precipitate' | 'candle';

/** Charakteristische Grösse je Form (cm): daraus die Oberfläche — Pulver reagiert schneller als ein Stück. */
const GRAIN: Readonly<Record<LumpForm, number>> = { piece: 0, granules: 0.15, crystals: 0.05, powder: 0.004, ribbon: 0.01, precipitate: 0.0005, candle: 0 };

let lumpIds = 0;

export class Lump {
  readonly id = ++lumpIds;
  /** Wo es ist: im Gefäss, oder auf dem Löffel über dem Inhalt (brennender Schwefel im Sauerstoff). */
  where: 'in' | 'spoon' = 'in';
  /** Lage quer (−1 … 1) und Höhe über dem Boden (cm) — fällt, schwimmt, rutscht. */
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  /** Niederschlag: wie viel davon noch schwebt (0 … 1). */
  suspended = 0;
  molten = false;
  burning = false;
  /** Was gerade an ihm geschieht (für die Bilder): Wärme (W) und Gas (mol/s). */
  heat = 0;
  gas = 0;
  /** Abgeschiedenes Metall auf ihm (Kupfer auf dem Eisennagel). */
  readonly coat: Record<string, number> = {};
  /** Sekunden im Nassen (die Oxidschicht des Aluminiums löst sich). */
  age = 0;
  readonly seed = Math.random();
  readonly n0: number;
  private readonly a0: number;

  constructor(readonly sp: string, public n: number, readonly form: LumpForm, x = 0, y = 0) {
    this.n0 = Math.max(1e-12, n);
    this.a0 = Lump.areaOf(sp, this.n0, form);
    this.x = x;
    this.y = y;
  }

  static areaOf(sp: string, n: number, form: LumpForm): number {
    const s = SPECIES[sp];
    const vol = (n * (s?.M ?? 100)) / (s?.rho ?? 2);
    if (form === 'piece') return 4.84 * vol ** (2 / 3);
    if (form === 'candle') return 1;
    return (form === 'ribbon' ? 2 : 3) * vol / GRAIN[form];
  }

  /** Oberfläche (cm²): jedes Stück, jedes Korn schrumpft wie eine Kugel (darum endet das Lösen). */
  area(): number {
    if (this.n <= 0) return 0;
    return this.a0 * (this.n / this.n0) ** (2 / 3);
  }

  volume(): number {
    const s = SPECIES[this.sp];
    return (this.n * (s?.M ?? 100)) / (s?.rho ?? 2);
  }

  mass(): number { return this.n * (SPECIES[this.sp]?.M ?? 100); }
}

/* -- Die Gestalt -------------------------------------------------------------------------------- */

export class Shape {
  /** Halbe Breite und Höhe des Inneren (cm). */
  readonly R: number;
  readonly H: number;
  /** Volumen bis zum Rand (mL). */
  readonly full: number;
  private readonly hs: number[] = [];
  private readonly vs: number[] = [];

  constructor(readonly type: VesselType, readonly size: number) {
    const p = type.profile;
    const r = (u: number) => {
      for (let i = 1; i < p.length; i += 1) {
        if (u <= p[i][0]) {
          const t = (u - p[i - 1][0]) / Math.max(1e-9, p[i][0] - p[i - 1][0]);
          return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t;
        }
      }
      return p[p.length - 1][1];
    };
    this.rel = r;
    let I = 0;
    const N = 120;
    for (let i = 0; i < N; i += 1) I += r((i + 0.5) / N) ** 2 / N;
    const full = type.kind === 'syringe' ? size : size * (type.kind === 'burette' ? 1.1 : 1.22);
    this.R = (full / (2 * Math.PI * type.aspect * I)) ** (1 / 3);
    this.H = 2 * this.R * type.aspect;
    this.full = full;
    let v = 0;
    this.hs.push(0);
    this.vs.push(0);
    for (let i = 0; i < N; i += 1) {
      v += Math.PI * (this.R * r((i + 0.5) / N)) ** 2 * (this.H / N);
      this.hs.push(((i + 1) / N) * this.H);
      this.vs.push(v);
    }
  }

  /** Halbe Breite (0 … 1) bei einem Anteil der Höhe. */
  readonly rel: (u: number) => number;

  halfWidth(h: number): number { return this.R * this.rel(Math.min(1, Math.max(0, h / this.H))); }

  /** Wie hoch (cm) ein Volumen (mL) steht. */
  levelOf(ml: number): number {
    if (ml <= 0) return 0;
    const vs = this.vs;
    if (ml >= vs[vs.length - 1]) return this.H;
    let lo = 0;
    let hi = vs.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (vs[m] < ml) lo = m; else hi = m; }
    const t = (ml - vs[lo]) / Math.max(1e-12, vs[hi] - vs[lo]);
    return this.hs[lo] + (this.hs[hi] - this.hs[lo]) * t;
  }

  /** Volumen (mL) bis zu einer Höhe. */
  volumeAt(h: number): number {
    if (h <= 0) return 0;
    if (h >= this.H) return this.full;
    const i = Math.min(this.hs.length - 2, Math.floor((h / this.H) * (this.hs.length - 1)));
    const t = (h - this.hs[i]) / Math.max(1e-12, this.hs[i + 1] - this.hs[i]);
    return this.vs[i] + (this.vs[i + 1] - this.vs[i]) * t;
  }
}

/* -- Was ein Gefäss zeigt (für die Bilder) ------------------------------------------------------------ */

export interface Fx {
  /** Blasen an einer Stelle (Lage quer, Höhe in cm, mol/s, Gas). */
  spots: { x: number; y: number; rate: number }[];
  /** Blasen überall in der Flüssigkeit (Entgasen, Kochen) — mol/s. */
  bulk: number;
  boil: number;
  steam: number;
  /** Was gerade ausfällt (Feststoff → mol) — Flocken. */
  precip: Map<string, number>;
  /** Eingegossenes: Schlieren in seiner Farbe. */
  swirl: { color: string; amount: number }[];
  smoke: number;
  smokeColor: string;
  sparks: number;
  /** Ein Knall (Wasserstoff), ein Korken. */
  pop: number;
  cork: boolean;
  /** Flüssigkeit läuft über; etwas fällt hinein (Spritzer). */
  spill: number;
  splash: number;
}

export const emptyFx = (): Fx => ({ spots: [], bulk: 0, boil: 0, steam: 0, precip: new Map(), swirl: [], smoke: 0, smokeColor: '#f4f4f4', sparks: 0, pop: 0, cork: false, spill: 0, splash: 0 });

/** Ein Teil des Inhalts auf dem Weg in ein anderes Gefäss (Giessen, Tropfen aus der Bürette). */
export interface Portion {
  readonly water: number;
  readonly aq: ReadonlyMap<string, number>;
  readonly lumps: readonly Lump[];
  /** Chemische Enthalpie (J), Wärmekapazität (J/K), Temperatur, Volumen und Farbe. */
  readonly h: number;
  readonly c: number;
  readonly T: number;
  readonly ml: number;
  readonly color: string;
}

/** Eine Beobachtung („Wydziela się gaz”, „Wytrąca się osad”) — mit Gleichung, wenn bekannt. */
export interface ChemEvent {
  readonly key: string;
  readonly vessel: string;
  readonly text: string;
  readonly eq?: string;
  readonly t: number;
}

/* -- Das Gefäss --------------------------------------------------------------------------------- */

const CP_WATER = 75.3;
const CP_GAS = 29.1;
const CP_SOLID = 0.8;
const CP_GLASS = 0.84;
const ML_WATER = 18.015;
const ML_ETHANOL = 58.4;

export class Vessel {
  readonly type: VesselType;
  readonly shape: Shape;
  /** Mitte und Boden auf dem Tisch (cm), Neigung beim Ausgiessen (rad). */
  x: number;
  y = 0;
  angle = 0;
  label: string;
  /** Inhalt geheim (Aufgabe: „Welche Lösung ist das?”). */
  hidden = false;

  /** Wasser (mol) — gezählt in den Formen der Tabelle (OH⁻ und H⁺ folgen aus der Ladung). */
  water = 0;
  readonly aq = new Map<string, number>();
  lumps: Lump[] = [];
  readonly gas = new Map<GasId, number>();
  T: number;
  closed = false;
  /** Ein Manometer (U-Rohr mit Wasser) am Stopfen. */
  gauge = false;
  /** Schaum (cm³) — Seife und Gas. */
  foam = 0;
  /** Gerührt (Sekunden, die noch bleiben); Wasser spritzt hinein (Springbrunnen, Sekunden). */
  stir = 0;
  spray = 0;
  /** Die Oberfläche brennt (Etanol). */
  burning = false;
  /** Bürette: offen und wie schnell (mL/s), über welchem Gefäss — und wie viel schon abgelassen ist. */
  drip = 0;
  dripped = 0;
  over: string | null = null;

  spec: Spec = NEUTRAL;
  /** Die chemische Enthalpie nach dem letzten Schritt (J) — und was seitdem herein- oder hinausging. */
  hOld = 0;
  hFlow = 0;
  qIn = 0;
  fx: Fx = emptyFx();
  readonly events: ChemEvent[] = [];
  readonly seen = new Set<string>();
  /** Wie die Lösung aussah, als zuletzt eine Farbe gemeldet wurde. */
  lastHue: string | null = null;
  /** Ab welcher Temperatur zuletzt „wird warm/kalt” gemeldet wurde. */
  tMark: number;

  constructor(readonly id: string, kind: VesselKind, readonly size: number, x: number, T: number, label = '') {
    this.type = VESSELS[kind];
    this.shape = new Shape(this.type, size);
    this.x = x;
    this.T = T;
    this.tMark = T;
    this.label = label;
    this.fillAir(this.gasMl(), T, P_ATM_KPA);
  }

  get kind(): VesselKind { return this.type.kind; }

  /* -- Mengen ------------------------------------------------------------------------------------ */

  liquidMl(): number { return this.water * ML_WATER + (this.aq.get('ethanol') ?? 0) * ML_ETHANOL; }
  liters(): number { return this.liquidMl() / 1000; }
  wet(): boolean { return this.water > 0.002; }

  /** Feststoffe im Gefäss (nicht auf dem Löffel), mL. */
  solidsMl(): number {
    let v = 0;
    for (const l of this.lumps) if (l.where === 'in' && l.form !== 'candle') v += l.volume() * (l.form === 'precipitate' ? 3 : 1);
    return v;
  }

  gasMl(): number {
    if (this.kind === 'syringe') return this.syringeMl;
    return Math.max(0.5, this.shape.full - this.liquidMl() - this.solidsMl());
  }

  /** Strzykawka gazowa: das Volumen hinter dem Kolben (mL). */
  syringeMl = 0.5;

  /** Höhe des Spiegels über dem Boden (cm) — mit dem, was darin liegt. */
  level(): number { return this.shape.levelOf(this.liquidMl() + this.solidsMl() * 0.6); }

  gasTotal(): number {
    let n = 0;
    for (const x of this.gas.values()) n += x;
    return n;
  }

  frac(g: GasId): number {
    const n = this.gasTotal();
    return n > 0 ? (this.gas.get(g) ?? 0) / n : 0;
  }

  /** Druck des Gases (kPa) — offen: der Druck des Zimmers. */
  pressure(room: number): number {
    if (!this.closed && this.kind !== 'syringe') return room;
    return (this.gasTotal() * R * this.T) / (this.gasMl() / 1000);
  }

  /** Dichte der Flüssigkeit (g/cm³). */
  density(): number {
    const ml = this.liquidMl();
    if (ml <= 0) return 1;
    let m = this.water * ML_WATER + (this.aq.get('ethanol') ?? 0) * 46.07;
    for (const [id, n] of this.aq) {
      if (id === 'ethanol' || id.startsWith('ind:')) continue;
      const pool = POOLS.find((p) => p.id === id);
      m += n * (pool !== undefined ? SPECIES[pool.forms[0]]?.M ?? 40 : SPECIES[id]?.M ?? 40);
    }
    return Math.min(2.5, m / ml);
  }

  /** Wärmekapazität (J/K): Wasser, Glas, Feststoffe, Gas. */
  capacity(): number {
    let c = this.water * CP_WATER + (this.aq.get('ethanol') ?? 0) * 112 + 2.5 * this.size ** (2 / 3) * CP_GLASS;
    for (const l of this.lumps) c += l.mass() * CP_SOLID;
    c += this.gasTotal() * CP_GAS;
    return Math.max(1, c);
  }

  /* -- Hinein, hinaus ------------------------------------------------------------------------------ */

  addAq(id: string, n: number): void {
    if (n === 0) return;
    const v = (this.aq.get(id) ?? 0) + n;
    if (v <= 1e-15) this.aq.delete(id); else this.aq.set(id, v);
  }

  addGas(g: GasId, n: number): void {
    if (n === 0) return;
    const v = (this.gas.get(g) ?? 0) + n;
    if (v <= 1e-15) this.gas.delete(g); else this.gas.set(g, v);
  }

  /** Mit Luft füllen (Volumen mL bei T und p). */
  fillAir(ml: number, T: number, p: number): void {
    const n = (p * ml) / 1000 / (R * T);
    for (const g of GASES) {
      const x = AIR[g] ?? 0;
      if (x > 0) this.addGas(g, n * x);
    }
  }

  /** Das Gas auf einen Druck bringen (offen gefüllt, dann verschlossen) — die Zusammensetzung bleibt. */
  equalize(p: number): void {
    const n = this.gasTotal();
    if (n <= 0) { this.fillAir(this.gasMl(), this.T, p); return; }
    const k = (p * (this.gasMl() / 1000)) / (R * this.T) / n;
    for (const [g, x] of [...this.gas]) this.gas.set(g, x * k);
  }

  /** Einen Feststoff dazulegen (er fällt von oben). */
  addLump(sp: string, n: number, form: LumpForm): Lump {
    const same = form === 'precipitate' || form === 'crystals' ? this.lumps.find((l) => l.sp === sp && l.form === form && l.where === 'in') : undefined;
    if (same !== undefined) { same.n += n; return same; }
    const l = new Lump(sp, n, form, (Math.random() * 2 - 1) * 0.55, Math.max(0, this.shape.H - 0.5));
    if (form === 'precipitate') { l.y = 0; l.suspended = 1; }
    if (form === 'candle') { l.x = 0; l.y = 0; }
    this.lumps.push(l);
    return l;
  }

  /** Was leer ist, fällt weg (bleibt der Docht: die Kerze ist aus). */
  prune(): void {
    if (this.lumps.some((l) => l.n <= 1e-12)) this.lumps = this.lumps.filter((l) => l.n > 1e-12);
  }

  /* -- Das Gleichgewicht ----------------------------------------------------------------------------- */

  /** Die Lösung, wie `speciate` sie braucht. */
  sol(): Sol {
    const s = emptySol();
    const V = this.liters();
    s.V = V;
    if (V <= 1e-7) return s;
    for (const [id, n] of this.aq) {
      if (id === 'C' || id === 'Ac' || id === 'N' || id === 'S') { s.pool[id] = n / V; continue; }
      const z = SPECIES[id]?.charge;
      if (z === undefined) continue;
      s.sid += (z * n) / V;
      const cx = CX_BY_METAL.get(id);
      if (cx !== undefined) s.metals.push({ ion: id, z, c: n / V, list: cx });
      if (id === 'SCN-') s.scn = n / V;
    }
    return s;
  }

  /** Das Gleichgewicht neu bestimmen (nach jeder Änderung des Gelösten). */
  respeciate(): void {
    if (this.liters() <= 2e-6) return;
    this.spec = speciate(this.sol(), this.T, this.spec.pH);
  }

  /** Freie Konzentration (mol/L) eines Ions oder einer Form — wie sie Ksp und Farbe brauchen. */
  conc(id: string): number {
    const V = this.liters();
    if (V <= 1e-7) return 0;
    if (id === 'OH-') return this.spec.oh;
    if (id === 'H+') return this.spec.h;
    const member = POOL_MEMBER[id];
    if (member !== undefined) return ((this.aq.get(member[0]) ?? 0) / V) * (this.spec.alpha[member[0]][member[1]] ?? 0);
    const total = (this.aq.get(id) ?? 0) / V;
    const f = this.spec.free[id];
    return f === undefined ? total : total * f;
  }

  /** Ein Komplex (mol/L). */
  complex(id: string, metal: string): number {
    const V = this.liters();
    return V <= 1e-7 ? 0 : ((this.aq.get(metal) ?? 0) / V) * (this.spec.cx[id] ?? 0);
  }

  /** Die chemische Enthalpie der Lösung (J): Wasser, Gelöstes, ihre Formen. */
  solutionEnthalpy(): number {
    let h = this.water * dHf('H2O');
    const pools: Record<PoolId, number> = { C: 0, Ac: 0, N: 0, S: 0 };
    const metals = new Map<string, number>();
    for (const [id, n] of this.aq) {
      if (id === 'C' || id === 'Ac' || id === 'N' || id === 'S') { pools[id] = n; continue; }
      if (id.startsWith('ind:')) continue;
      h += n * dHf(id);
      if (CX_BY_METAL.has(id)) metals.set(id, n);
    }
    return h + formEnthalpy(this.spec, this.liters(), pools, metals);
  }

  /** Die chemische Enthalpie von allem im Gefäss (J). */
  chemical(): number {
    let h = this.solutionEnthalpy();
    for (const l of this.lumps) h += l.n * dHf(l.sp);
    for (const [g, n] of this.gas) h += n * dHf(g);
    return h;
  }

  /** Gas kommt von aussen herein (+) oder geht hinaus (−) — mit seiner Enthalpie. */
  exchange(g: GasId, n: number): void {
    const d = Math.max(n, -(this.gas.get(g) ?? 0));
    if (d === 0) return;
    this.addGas(g, d);
    this.hFlow += d * dHf(g);
  }

  /** Einen Teil der Flüssigkeit herausnehmen (mit dem Schwebenden; `lumps`: auch was schwimmt oder klein ist). */
  take(f: number, lumps: boolean): Portion {
    const k = Math.min(1, Math.max(0, f));
    const look = this.look();
    const cloudy = look.turbid > 0.3;
    const color = `rgba(${Math.round(cloudy ? look.tr : look.r)},${Math.round(cloudy ? look.tg : look.g)},${Math.round(cloudy ? look.tb : look.b)},${Math.max(look.a, look.turbid).toFixed(2)})`;
    let h = this.solutionEnthalpy() * k;
    const ml = this.liquidMl() * k;
    const water = this.water * k;
    this.water -= water;
    const aq = new Map<string, number>();
    for (const [id, n] of [...this.aq]) {
      aq.set(id, n * k);
      this.addAq(id, -n * k);
    }
    const moved: Lump[] = [];
    const level = this.level();
    for (const l of this.lumps) {
      if (l.where !== 'in' || l.n <= 0) continue;
      if (l.form === 'precipitate') {
        const m = l.n * l.suspended * k;
        if (m <= 0) continue;
        const rest = l.n - m;
        l.suspended = rest > 0 ? (l.n * l.suspended - m) / rest : 0;
        l.n = rest;
        const p = new Lump(l.sp, m, 'precipitate');
        p.suspended = 1;
        moved.push(p);
      } else if (lumps && (k > 0.97 || l.y >= level - 0.3 || l.form === 'powder')) {
        const m = k > 0.97 ? l.n : l.n * k;
        l.n -= m;
        moved.push(new Lump(l.sp, m, l.form));
      }
    }
    for (const l of moved) h += l.n * dHf(l.sp);
    this.prune();
    const c = water * CP_WATER + moved.reduce((a, l) => a + l.mass() * CP_SOLID, 0) + (aq.get('ethanol') ?? 0) * 112;
    this.hFlow -= h;
    return { water, aq, lumps: moved, h, c, T: this.T, ml, color };
  }

  /** Was aus einem anderen Gefäss kommt. */
  give(p: Portion): void {
    this.water += p.water;
    for (const [id, n] of p.aq) this.addAq(id, n);
    for (const l of p.lumps) {
      const into = this.addLump(l.sp, l.n, l.form);
      if (l.form === 'precipitate') into.suspended = Math.min(1, into.suspended + 0.5);
    }
    this.hFlow += p.h;
    this.qIn += p.c * (p.T - this.T);
    if (p.ml > 0) this.fx.swirl.push({ color: p.color, amount: p.ml });
  }

  /** Eine Beobachtung — einmal je Schlüssel (bis `forget`). */
  say(key: string, text: string, t: number, eq?: string): void {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.events.push({ key, vessel: this.id, text, t, ...(eq === undefined ? {} : { eq }) });
  }

  forget(prefix: string): void {
    for (const k of [...this.seen]) if (k.startsWith(prefix)) this.seen.delete(k);
  }

  /* -- Wie die Lösung aussieht ------------------------------------------------------------------------- */

  /** Farbe und Deckkraft der Flüssigkeit, Trübung und ihre Farbe. */
  look(): Look {
    const V = this.liquidMl();
    const out: Look = { r: 170, g: 208, b: 238, a: 0.16, turbid: 0, tr: 245, tg: 245, tb: 242 };
    if (V <= 0.01) return out;
    let od = 0;
    let rr = 0;
    let gg = 0;
    let bb = 0;
    const add = (hex: string, w: number, alpha = 1) => {
      if (w <= 0) return;
      const [r, g, b, a] = rgba(hex);
      const k = w * a * alpha;
      od += k;
      rr += r * k; gg += g * k; bb += b * k;
    };
    for (const id of this.aq.keys()) {
      const s = SPECIES[id];
      if (s?.aqColor !== undefined && s.tint !== undefined) add(s.aqColor, this.conc(id) * s.tint);
      if (id.startsWith('ind:')) {
        const ind = indicatorOf(id.slice(4));
        if (ind !== undefined) add(indicatorColor(ind.stops, this.spec.pH), ((this.aq.get(id) ?? 0) / V) * 60);
      }
    }
    for (const [metal, list] of CX_BY_METAL) {
      if (!this.aq.has(metal)) continue;
      for (const c of list) {
        const s = SPECIES[c.id];
        if (s?.aqColor !== undefined && s.tint !== undefined) add(s.aqColor, this.complex(c.id, metal) * s.tint);
      }
    }
    if (od > 0) {
      const k = 1 - Math.exp(-od * 1.6);
      out.r = out.r * (1 - k) + (rr / od) * k;
      out.g = out.g * (1 - k) + (gg / od) * k;
      out.b = out.b * (1 - k) + (bb / od) * k;
      out.a = Math.min(0.94, out.a + k * 0.78);
    }
    let tv = 0;
    let tr = 0;
    let tg = 0;
    let tb = 0;
    for (const l of this.lumps) {
      if (l.form !== 'precipitate' || l.suspended <= 0 || l.where !== 'in') continue;
      const vol = l.volume() * l.suspended;
      const [r, g, b] = rgba(SPECIES[l.sp]?.color ?? '#f4f4f0');
      tv += vol; tr += r * vol; tg += g * vol; tb += b * vol;
    }
    if (tv > 0) {
      out.turbid = Math.min(0.96, 1 - Math.exp(-(tv / V) * 5000));
      out.tr = tr / tv; out.tg = tg / tv; out.tb = tb / tv;
    }
    return out;
  }
}

export interface Look { r: number; g: number; b: number; a: number; turbid: number; tr: number; tg: number; tb: number }

const dHf = (id: string): number => (SPECIES[id]?.dHf ?? 0) * 1000;

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

/** Ein Wort für eine Farbe als Text (#…). */
export const colorWordOf = (c: string): string => { const [r, g, b] = rgba(c); return colorWord(r, g, b, 1); };

export const INDICATOR_IDS = INDICATORS.map((i) => i.id);
