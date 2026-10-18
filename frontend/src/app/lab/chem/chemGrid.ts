/**
 * 2026-10-18 — DIE WELT DER CHEMIA ALS GITTER: der Labortisch von der Seite,
 * in Zellen von 4 mm. Jede Zelle hat eine Tiefe (frei: die Tiefe der Szene;
 * in einem Glas: π/4 · seine innere Breite auf dieser Höhe — so hat jede
 * Zeile eines Becherglases genau das Volumen der Scheibe, die sie zeigt) und
 * enthält, was dort ist:
 *
 *   Wand        Glas, Stahl, Porzellan, Holz des Tisches, das Drahtnetz (durchlässig)
 *   Feststoff   EIN Stoff mit Menge und Form (Stück, Guss, Körner, Kristalle, Pulver,
 *               Niederschlag, Belag) — ein Stück gehört zu einem Ding und bewegt sich mit ihm
 *   Flüssigkeit Wasser mit Gelöstem (`chemAq.ts`) ODER eine Schmelze (Zinn, Paraffin …)
 *   Gas         13 Gase (mol), dazu Russ, Nebel (Tröpfchen), weisser Rauch, leuchtende Ionen
 *   Wärme       EINE Temperatur je Zelle
 *
 * <b>Zwei Arten, etwas zu ändern</b>: eine Reaktion ändert Mengen — dann bucht
 * sie die Bildungsenthalpien (`q`: frei gewordene Wärme der Zelle; `addAq`,
 * `addGas`, `addSolid`, `addMelt`). Ein Transport verschiebt Mengen zwischen
 * Zellen — die Enthalpie wandert mit, die Temperatur mischt sich nach den
 * Wärmekapazitäten (`moveAq`, `moveGas`, `moveSolid`, `moveMelt`). So entsteht
 * keine Wärme aus dem Nichts, und jede Reaktion bekommt ihre aus der Tabelle.
 */

import { AIR, GASES, SPECIES, THERMAL, thermalOf, type GasId } from './chemData';
import { AQ_DHF, ETHANOL, NC, WATER, aqVolume } from './chemAq';
import type { Spec } from './chemPh';

/** Kantenlänge einer Zelle (cm). */
export const CELL = 0.4;
export const CELL2 = CELL * CELL;
const R = 8.314;

/* -- Gase ------------------------------------------------------------------------------------------ */

export const NG = GASES.length;
export const GASI: Readonly<Record<string, number>> = Object.fromEntries(GASES.map((g, i) => [g, i]));
export const GAS_M: Float64Array = Float64Array.from(GASES, (g) => SPECIES[g]?.M ?? 29);
export const GAS_DHF: Float64Array = Float64Array.from(GASES, (g) => (SPECIES[g]?.dHf ?? 0) * 1000);
/** Wärmekapazität (J/(mol·K)) bei 298 K und wie sie mit der Temperatur steigt. */
const CP: Readonly<Record<GasId, readonly [number, number]>> = {
  N2: [29.1, 1.7e-4], O2: [29.4, 2.0e-4], Ar: [20.8, 0], CO2: [37.1, 4.8e-4], 'H2O(g)': [33.6, 3.3e-4], H2: [28.8, 1.0e-4],
  NH3: [35.1, 4.5e-4], 'HCl(g)': [29.1, 1.5e-4], SO2: [39.9, 3.6e-4], NO: [29.9, 1.8e-4], NO2: [37.2, 3.6e-4], N2O4: [77.3, 4e-4], CH4: [35.7, 9e-4], 'EtOH(g)': [65.6, 8e-4]
};
export const GAS_CP: Float64Array = Float64Array.from(GASES, (g) => CP[g][0]);
const GAS_CPB: Float64Array = Float64Array.from(GASES, (g) => CP[g][0] * CP[g][1]);
export const G_N2 = GASI.N2;
export const G_O2 = GASI.O2;
export const G_H2O = GASI['H2O(g)'];
export const G_CO2 = GASI.CO2;
export const G_H2 = GASI.H2;
export const G_CH4 = GASI.CH4;
/** Luft (Anteile je Gas, in der Reihe von `GASES`). */
export const AIR_X: Float64Array = Float64Array.from(GASES, (g) => AIR[g] ?? 0);

/* -- Feststoffe und Schmelzen ---------------------------------------------------------------------- */

/** Alle Stoffe, die fest sein können (Metalle, Salze, Oxide, Eis, Paraffin, Holz …). */
export const SOL: readonly string[] = Object.values(SPECIES).filter((s) => s.phase === 's').map((s) => s.id);
export const SOLI: Readonly<Record<string, number>> = Object.fromEntries(SOL.map((id, i) => [id, i]));
export const NS = SOL.length;
export const SOL_M: Float64Array = Float64Array.from(SOL, (id) => SPECIES[id]?.M ?? 100);
export const SOL_RHO: Float64Array = Float64Array.from(SOL, (id) => SPECIES[id]?.rho ?? 2);
export const SOL_DHF: Float64Array = Float64Array.from(SOL, (id) => (SPECIES[id]?.dHf ?? 0) * 1000);
/** J/(mol·K) — die spezifische Wärme mal der molaren Masse. */
export const SOL_CM: Float64Array = Float64Array.from(SOL, (id) => thermalOf(id).c * (SPECIES[id]?.M ?? 100));
/** W/(cm·K). */
export const SOL_K: Float64Array = Float64Array.from(SOL, (id) => thermalOf(id).k / 100);
/** Schmelzpunkt (K, 0: schmilzt nicht hier) und Schmelzwärme (J/mol). */
export const SOL_TM: Float64Array = Float64Array.from(SOL, (id) => THERMAL[id]?.Tm ?? 0);
export const SOL_LF: Float64Array = Float64Array.from(SOL, (id) => (THERMAL[id]?.Lf ?? 0) * (SPECIES[id]?.M ?? 100));
export const SOL_RHOL: Float64Array = Float64Array.from(SOL, (id) => THERMAL[id]?.rhoL ?? SPECIES[id]?.rho ?? 2);
export const SOL_KL: Float64Array = Float64Array.from(SOL, (id) => (THERMAL[id]?.kL ?? thermalOf(id).k) / 100);
export const S_ICE = SOLI.ice;

/** Die Form eines Feststoffs in einer Zelle. */
export const F = {
  none: 0,
  /** Teil eines Stücks (Ding): bewegt sich mit ihm. */
  piece: 1,
  /** Erstarrte Schmelze, ein Klumpen am Ort. */
  cast: 2,
  granules: 3,
  crystals: 4,
  powder: 5,
  /** Niederschlag: schwebt, setzt sich langsam. */
  precip: 6,
  /** Belag auf einer Oberfläche (Kupfer auf dem Nagel) — bleibt. */
  coat: 7
} as const;
export type Form = (typeof F)[keyof typeof F];
/** Wie dicht Körner liegen (der Rest ist Platz für Flüssigkeit und Gas). */
const PACK = 0.62;
/** Charakteristische Korngrösse (cm) je Form — daraus die Oberfläche. */
export const GRAIN: readonly number[] = [0, 0, 0, 0.15, 0.05, 0.004, 0.0005, 0.002];

/** Wie eine Flamme aussieht. */
export const FIRE = { none: 0, gas: 1, yellow: 2, sulfur: 3, white: 4, sparks: 5, ethanol: 6, hydrogen: 7 } as const;

/** Was flüssig in einer Zelle ist. */
export const L = { none: 0, aq: 1, melt: 2 } as const;

/* -- Wände ----------------------------------------------------------------------------------------- */

export interface Material {
  readonly id: string;
  readonly name: string;
  /** g/cm³, J/(g·K), W/(m·K). */
  readonly rho: number;
  readonly c: number;
  readonly k: number;
  /** Welcher Teil der Zelle Wand ist (ein dünnes Glas füllt seine Zelle nicht). */
  readonly fill: number;
  /** Leitfähigkeit der ganzen Zelle (W/(m·K)), wo sie anders ist als k · fill: dünnes Glas (1,5 mm in 4 mm) leitet hindurch wie dicker. */
  readonly kCell?: number;
  readonly color: string;
  /** Gas, Flüssigkeit und Pulver gehen hindurch (Drahtnetz) — nur Dinge liegen darauf. */
  readonly porous?: boolean;
}

export const MATERIALS: readonly Material[] = [
  { id: 'none', name: '', rho: 0, c: 0, k: 0, fill: 0, color: 'transparent' },
  { id: 'glass', name: 'szkło', rho: 2.23, c: 0.83, k: 1.14, fill: 0.6, kCell: 3, color: '#bcd8e8' },
  { id: 'steel', name: 'stal', rho: 7.9, c: 0.49, k: 30, fill: 1, color: '#8a9096' },
  { id: 'porcelain', name: 'porcelana', rho: 2.4, c: 1.07, k: 1.5, fill: 0.8, kCell: 3, color: '#f2f0ea' },
  { id: 'wood', name: 'drewno', rho: 0.7, c: 1.7, k: 0.15, fill: 1, color: '#b98a5a' },
  { id: 'gauze', name: 'siatka', rho: 7.9, c: 0.49, k: 30, fill: 0.08, color: '#6a7076', porous: true },
  { id: 'rubber', name: 'korek', rho: 1.1, c: 1.7, k: 0.15, fill: 1, color: '#8a4b2a' },
  { id: 'brass', name: 'mosiądz', rho: 8.5, c: 0.38, k: 110, fill: 1, color: '#c9a64a' },
  { id: 'clay', name: 'glinka', rho: 2.0, c: 0.9, k: 1.0, fill: 0.7, color: '#e8d8c0' },
  { id: 'wick', name: 'knot', rho: 0.5, c: 1.3, k: 0.1, fill: 1, color: '#3a3430' },
  { id: 'nichrome', name: 'drut chromonikielinowy', rho: 8.4, c: 0.45, k: 11, fill: 0.25, color: '#9aa0a8', porous: true },
  /* Ein dünner Stab (Beine des Dreifusses, Stativstange): trägt, hält Glas ab, aber Luft geht vorbei. */
  { id: 'rod', name: 'pręt stalowy', rho: 7.9, c: 0.49, k: 30, fill: 0.12, color: '#7d848b', porous: true },
  /* Das Gehäuse der Heizplatte: Blech um Luft und Isolierung — leicht und schlecht leitend. */
  { id: 'casing', name: 'obudowa', rho: 0.6, c: 1.0, k: 0.1, fill: 1, color: '#d5d8dc' }
];
export const MATI: Readonly<Record<string, number>> = Object.fromEntries(MATERIALS.map((m, i) => [m.id, i]));
const MAT_RC: Float64Array = Float64Array.from(MATERIALS, (m) => m.rho * m.c * m.fill);
const MAT_K: Float64Array = Float64Array.from(MATERIALS, (m) => (m.kCell ?? m.k * m.fill) / 100);
const MAT_FILL: Float64Array = Float64Array.from(MATERIALS, (m) => m.fill);
const MAT_POROUS: Uint8Array = Uint8Array.from(MATERIALS, (m) => (m.porous === true ? 1 : 0));

/* -- Eine Zelle zum Zwischenspeichern (Dinge tragen ihren Inhalt mit) ------------------------------- */

const SLOTS = 16;
export class CellBuf {
  readonly f = new Float64Array(SLOTS + NC + NG);
  spec: Spec | null = null;
}

/* -- Das Gitter ------------------------------------------------------------------------------------ */

export class Grid {
  readonly n: number;
  /** Tiefe (cm) jeder Zelle. */
  readonly D: Float32Array;
  readonly mat: Uint8Array;
  /** Welches Ding die Zelle trägt (Wand, Inneres, Stück) — 0: keines. */
  readonly own: Uint16Array;
  readonly sp: Int16Array;
  readonly sn: Float64Array;
  readonly sform: Uint8Array;
  readonly lq: Uint8Array;
  readonly comp: Float64Array;
  readonly msp: Int16Array;
  readonly mn: Float64Array;
  readonly gas: Float64Array;
  /** Russ (g), Nebel (mol Tröpfchen), weisser Rauch (mol, Stoff `fumeSp`), leuchtende Ionen (mol, Element `glowSp`). */
  readonly smoke: Float32Array;
  readonly mist: Float32Array;
  readonly fume: Float32Array;
  readonly fumeSp: Int16Array;
  readonly glow: Float32Array;
  readonly glowSp: Int8Array;
  readonly T: Float64Array;
  /** Wärme, die in diesem Schritt frei wurde (J) — die Wärme macht daraus Temperatur. */
  readonly q: Float64Array;
  readonly spec: (Spec | null)[];
  /** Formenwärme des Wassers beim letzten Gleichgewicht (J) — wandert mit dem Wasser. */
  readonly hf: Float64Array;
  /** Wie viel sich am Wasser geändert hat, seit das Gleichgewicht bestimmt wurde. */
  readonly chg: Float32Array;
  readonly specT: Float32Array;
  /** Farbe des Wassers (r, g, b, a) beim letzten Gleichgewicht. */
  readonly look: Float32Array;
  /** Wie aufgewühlt (0 … 1): Rühren, Giessen, Blasen, Flammen. */
  readonly turb: Float32Array;
  /** Was brennt (W) — für die Flamme. */
  readonly burn: Float32Array;
  /** Wie die Flamme aussieht (`FIRE`): Gas blau, Holz und Paraffin gelb, Schwefel blau, Magnesium weiss … */
  readonly fire: Uint8Array;
  /** Wie viel Gas zuletzt aus der Flüssigkeit kam (mol/s) — Blasen, Schaum. */
  readonly fizz: Float32Array;

  constructor(readonly w: number, readonly h: number, readonly x0: number, readonly y0: number, readonly depth: number) {
    /* Eine Zelle mehr am Ende: zum Zwischenspeichern (sie ist nie Teil der Welt). */
    this.n = w * h;
    const n = this.n + 1;
    this.D = new Float32Array(n).fill(depth);
    this.mat = new Uint8Array(n);
    this.own = new Uint16Array(n);
    this.sp = new Int16Array(n).fill(-1);
    this.sn = new Float64Array(n);
    this.sform = new Uint8Array(n);
    this.lq = new Uint8Array(n);
    this.comp = new Float64Array(n * NC);
    this.msp = new Int16Array(n).fill(-1);
    this.mn = new Float64Array(n);
    this.gas = new Float64Array(n * NG);
    this.smoke = new Float32Array(n);
    this.mist = new Float32Array(n);
    this.fume = new Float32Array(n);
    this.fumeSp = new Int16Array(n).fill(-1);
    this.glow = new Float32Array(n);
    this.glowSp = new Int8Array(n).fill(-1);
    this.T = new Float64Array(n);
    this.q = new Float64Array(n);
    this.spec = new Array<Spec | null>(n).fill(null);
    this.hf = new Float64Array(n);
    this.chg = new Float32Array(n);
    this.specT = new Float32Array(n);
    this.look = new Float32Array(n * 4);
    this.turb = new Float32Array(n);
    this.burn = new Float32Array(n);
    this.fire = new Uint8Array(n);
    this.fizz = new Float32Array(n);
  }

  /* -- Lage ----------------------------------------------------------------------------------------- */

  /** Die Zelle an einem Punkt (cm) — −1: ausserhalb. */
  at(x: number, y: number): number {
    const cx = Math.floor((x - this.x0) / CELL);
    const cy = Math.floor((y - this.y0) / CELL);
    return cx < 0 || cy < 0 || cx >= this.w || cy >= this.h ? -1 : cy * this.w + cx;
  }

  cx(i: number): number { return this.x0 + ((i % this.w) + 0.5) * CELL; }
  cy(i: number): number { return this.y0 + (Math.floor(i / this.w) + 0.5) * CELL; }

  /* -- Volumen -------------------------------------------------------------------------------------- */

  vol(i: number): number { return CELL2 * this.D[i]; }

  /** Eine Wand, durch die nichts geht. */
  wall(i: number): boolean { const m = this.mat[i]; return m !== 0 && MAT_POROUS[m] === 0; }

  porous(i: number): boolean { return MAT_POROUS[this.mat[i]] === 1; }

  /** Platz, den der Feststoff einnimmt (cm³) — Körner mit ihren Lücken. */
  solidVol(i: number): number {
    const s = this.sp[i];
    if (s < 0) return 0;
    const v = (this.sn[i] * SOL_M[s]) / SOL_RHO[s];
    const f = this.sform[i];
    return f === F.piece || f === F.cast || f === F.coat ? v : v / PACK;
  }

  /** Der feste Stoff selbst (cm³, ohne Lücken). */
  solidTrue(i: number): number {
    const s = this.sp[i];
    return s < 0 ? 0 : (this.sn[i] * SOL_M[s]) / SOL_RHO[s];
  }

  liqVol(i: number): number {
    const l = this.lq[i];
    if (l === L.aq) return aqVolume(this.comp, i * NC);
    if (l === L.melt) { const s = this.msp[i]; return s < 0 ? 0 : (this.mn[i] * SOL_M[s]) / SOL_RHOL[s]; }
    return 0;
  }

  /** Was Flüssigkeit und Gas zusammen Platz haben (cm³) — zwischen Körnern auch die Lücken (Wasser dringt in einen Haufen Kristalle ein). */
  room(i: number): number {
    const m = this.mat[i];
    if (m !== 0 && MAT_POROUS[m] === 0) return 0;
    return Math.max(0, this.vol(i) * (1 - MAT_FILL[m]) - this.solidTrue(i));
  }

  gasVol(i: number): number { return Math.max(0, this.room(i) - this.liqVol(i)); }

  gasTotal(i: number): number {
    let n = 0;
    const o = i * NG;
    for (let g = 0; g < NG; g += 1) n += this.gas[o + g];
    return n;
  }

  /** Druck des Gases einer Zelle (kPa) — gilt nur, solange es Platz hat. */
  pressure(i: number): number {
    const V = this.gasVol(i);
    return V <= 1e-9 ? 0 : (this.gasTotal(i) * R * this.T[i]) / V * 1000;
  }

  /* -- Wärme ---------------------------------------------------------------------------------------- */

  /** Wärmekapazität (J/K) nur des Gases einer Zelle (mit dem Nebel). */
  gasCap(i: number): number {
    const T = this.T[i] - 298;
    const og = i * NG;
    let C = this.mist[i] * 75.3;
    for (let g = 0; g < NG; g += 1) { const x = this.gas[og + g]; if (x > 0) C += x * (GAS_CP[g] + GAS_CPB[g] * T); }
    return C;
  }

  /** Dichte des Gases (g/cm³). */
  gasRho(i: number): number {
    const V = this.gasVol(i);
    if (V <= 1e-9) return 0;
    const og = i * NG;
    let m = 0;
    for (let g = 0; g < NG; g += 1) m += this.gas[og + g] * GAS_M[g];
    return (m + this.mist[i] * 18 + this.smoke[i]) / V;
  }

  /** Wärmekapazität (J/K) einer Zelle mit allem darin. */
  cap(i: number): number {
    let C = 0;
    const m = this.mat[i];
    if (m !== 0) C += this.vol(i) * MAT_RC[m];
    const s = this.sp[i];
    if (s >= 0) C += this.sn[i] * SOL_CM[s];
    const l = this.lq[i];
    if (l === L.aq) { const o = i * NC; C += this.comp[o] * 75.3 + this.comp[o + ETHANOL] * 112; } else if (l === L.melt && this.msp[i] >= 0) C += this.mn[i] * SOL_CM[this.msp[i]];
    const T = this.T[i] - 298;
    const og = i * NG;
    for (let g = 0; g < NG; g += 1) { const x = this.gas[og + g]; if (x > 0) C += x * (GAS_CP[g] + GAS_CPB[g] * T); }
    C += this.mist[i] * 75.3;
    return C > 1e-9 ? C : 1e-9;
  }

  /** Wärmeleitfähigkeit (W/(cm·K)) — nach den Anteilen an der Zelle, Rühren und Flammen wirken wie bessere Leitung. */
  cond(i: number): number {
    const v = this.vol(i);
    const m = this.mat[i];
    let k = m !== 0 ? MAT_K[m] : 0;
    const s = this.sp[i];
    if (s >= 0) k += (this.solidTrue(i) / v) * SOL_K[s];
    const l = this.lq[i];
    const lv = this.liqVol(i);
    if (l === L.aq) k += (lv / v) * 0.006 * (1 + 300 * this.turb[i]);
    else if (l === L.melt && this.msp[i] >= 0) k += (lv / v) * SOL_KL[this.msp[i]];
    const gv = Math.max(0, this.room(i) - lv);
    if (gv > 0) k += (gv / v) * 0.00026 * (Math.max(250, this.T[i]) / 300) ** 0.8 * (1 + 80 * this.turb[i]);
    return k > 1e-7 ? k : 1e-7;
  }

  /** Wärme kommt mit Stoff herein: die Temperatur mischt sich (vor dem Hinzufügen aufrufen). */
  mixHeat(b: number, cIn: number, tIn: number): void {
    if (!(cIn > 0) || !Number.isFinite(tIn)) return;
    const cb = this.cap(b);
    this.T[b] = (cb * this.T[b] + cIn * tIn) / (cb + cIn);
  }

  /** Die frei gewordene Wärme gleich in Temperatur (bei Phasenwechseln, die bis zur Grenze rechnen). */
  applyQ(i: number): void {
    const q = this.q[i];
    if (q === 0) return;
    this.T[i] = Math.max(this.T[i] * 0.5, this.T[i] + q / this.cap(i));
    this.q[i] = 0;
  }

  /* -- Reaktionen: Mengen ändern sich, die Enthalpie wird gebucht ---------------------------------------- */

  /** `at`: in welcher Zelle die Wärme gebucht wird (ein Übergang zwischen zwei Zellen bucht beide Seiten in einer). */
  addAq(i: number, k: number, dn: number, at = i): void {
    if (dn === 0) return;
    const o = i * NC + k;
    const v = this.comp[o] + dn;
    this.comp[o] = v > 0 ? v : 0;
    this.q[at] -= dn * AQ_DHF[k];
    if (this.lq[i] === L.none && dn > 0) this.lq[i] = L.aq;
    this.touch(i, Math.abs(dn) / Math.max(1e-9, this.comp[i * NC] * 0.02));
  }

  addGas(i: number, g: number, dn: number, at = i): void {
    if (dn === 0) return;
    const o = i * NG + g;
    const v = this.gas[o] + dn;
    this.gas[o] = v > 0 ? v : 0;
    this.q[at] -= dn * GAS_DHF[g];
  }

  /** Feststoff dazu oder weg (die Zelle hat EINEN Stoff — ein anderer muss woanders hin). */
  addSolid(i: number, s: number, dn: number, form: Form, at = i): boolean {
    if (dn === 0) return true;
    if (this.sp[i] >= 0 && this.sp[i] !== s) return false;
    if (this.sp[i] < 0) { if (dn < 0) return false; this.sp[i] = s; this.sform[i] = form; }
    const v = this.sn[i] + dn;
    this.sn[i] = v > 0 ? v : 0;
    this.q[at] -= dn * SOL_DHF[s];
    if (this.sn[i] <= 1e-13) this.clearSolid(i);
    return true;
  }

  /** Schmelze dazu oder weg (ihre Enthalpie: der Feststoff plus die Schmelzwärme). */
  addMelt(i: number, s: number, dn: number, at = i): boolean {
    if (dn === 0) return true;
    if (this.lq[i] === L.aq) return false;
    if (this.msp[i] >= 0 && this.msp[i] !== s) return false;
    if (this.msp[i] < 0) { if (dn < 0) return false; this.msp[i] = s; this.lq[i] = L.melt; }
    const v = this.mn[i] + dn;
    this.mn[i] = v > 0 ? v : 0;
    this.q[at] -= dn * (SOL_DHF[s] + SOL_LF[s]);
    if (this.mn[i] <= 1e-13) { this.mn[i] = 0; this.msp[i] = -1; this.lq[i] = L.none; }
    return true;
  }

  /** Das Wasser hat sich geändert: irgendwann ein neues Gleichgewicht. */
  touch(i: number, amount: number): void {
    this.chg[i] = Math.min(10, this.chg[i] + amount);
  }

  clearSolid(i: number): void {
    this.sp[i] = -1;
    this.sn[i] = 0;
    this.sform[i] = F.none;
  }

  clearLiquid(i: number): void {
    const o = i * NC;
    this.comp.fill(0, o, o + NC);
    this.lq[i] = L.none;
    this.msp[i] = -1;
    this.mn[i] = 0;
    this.spec[i] = null;
    this.hf[i] = 0;
    this.chg[i] = 0;
  }

  /* -- Transport: Mengen wandern, die Enthalpie mit ihnen -------------------------------------------- */

  /** Einen Teil `f` des Wassers von a nach b (b leer oder Wasser). */
  moveAq(a: number, b: number, f: number): void {
    if (!(f > 0) || this.lq[a] !== L.aq || this.lq[b] === L.melt) return;
    const oa = a * NC;
    const ob = b * NC;
    if (f > 1) f = 1;
    const was = this.comp[ob];
    this.mixHeat(b, f * (this.comp[oa] * 75.3 + this.comp[oa + ETHANOL] * 112), this.T[a]);
    for (let k = 0; k < NC; k += 1) {
      const d = this.comp[oa + k] * f;
      if (d === 0) continue;
      this.comp[oa + k] -= d;
      this.comp[ob + k] += d;
    }
    const dh = this.hf[a] * f;
    this.hf[a] -= dh;
    this.hf[b] += dh;
    if (this.lq[b] !== L.aq) {
      this.lq[b] = L.aq;
      this.spec[b] = this.spec[a];
      this.specT[b] = this.specT[a];
      this.look.copyWithin(b * 4, a * 4, a * 4 + 4);
      this.chg[b] = this.chg[a];
    } else if (this.spec[a] !== this.spec[b]) this.touch(b, (this.comp[ob] - was) / Math.max(1e-12, this.comp[ob]));
    if (f >= 1 || this.comp[oa] * ML_W + this.comp[oa + ETHANOL] * 58.4 < 1e-7) this.dropLiquid(a, b);
  }

  /** Ein Rest, der zu klein ist: ganz hinüber (sonst bleiben Spuren in jeder Zelle). */
  private dropLiquid(a: number, b: number): void {
    const oa = a * NC;
    const ob = b * NC;
    for (let k = 0; k < NC; k += 1) { this.comp[ob + k] += this.comp[oa + k]; }
    this.hf[b] += this.hf[a];
    this.clearLiquid(a);
  }

  /** Einen Teil der Schmelze von a nach b (b leer oder dieselbe Schmelze). */
  moveMelt(a: number, b: number, f: number): void {
    const s = this.msp[a];
    if (!(f > 0) || this.lq[a] !== L.melt || s < 0 || this.lq[b] === L.aq || (this.msp[b] >= 0 && this.msp[b] !== s)) return;
    if (f > 1) f = 1;
    const d = this.mn[a] * f;
    this.mixHeat(b, d * SOL_CM[s], this.T[a]);
    this.mn[a] -= d;
    this.mn[b] += d;
    this.msp[b] = s;
    this.lq[b] = L.melt;
    if (this.mn[a] <= 1e-12) { this.mn[b] += this.mn[a]; this.mn[a] = 0; this.msp[a] = -1; this.lq[a] = L.none; }
  }

  /** `dn` mol des Gasgemisches von a nach b — mit Russ, Nebel, Rauch und Ionen. */
  moveGas(a: number, b: number, dn: number): void {
    const tot = this.gasTotal(a);
    if (!(dn > 0) || tot <= 0) return;
    const f = dn >= tot ? 1 : dn / tot;
    const oa = a * NG;
    const ob = b * NG;
    let cIn = 0;
    const T = this.T[a] - 298;
    for (let g = 0; g < NG; g += 1) { const x = this.gas[oa + g]; if (x > 0) cIn += x * (GAS_CP[g] + GAS_CPB[g] * T); }
    cIn = cIn * f + this.mist[a] * f * 75.3;
    this.mixHeat(b, cIn, this.T[a]);
    for (let g = 0; g < NG; g += 1) {
      const d = this.gas[oa + g] * f;
      if (d === 0) continue;
      this.gas[oa + g] -= d;
      this.gas[ob + g] += d;
    }
    this.carry(a, b, f);
  }

  /** Was in der Luft schwebt, geht mit dem Gas. */
  carry(a: number, b: number, f: number): void {
    let d = this.smoke[a] * f; this.smoke[a] -= d; this.smoke[b] += d;
    d = this.mist[a] * f; this.mist[a] -= d; this.mist[b] += d;
    d = this.fume[a] * f;
    if (d > 0) { this.fume[a] -= d; if (this.fumeSp[b] < 0 || this.fume[b] < d) this.fumeSp[b] = this.fumeSp[a]; this.fume[b] += d; }
    d = this.glow[a] * f;
    if (d > 0) { this.glow[a] -= d; if (this.glowSp[b] < 0 || this.glow[b] < d) this.glowSp[b] = this.glowSp[a]; this.glow[b] += d; }
  }

  /** `dn` mol Feststoff von a nach b (b leer oder derselbe Stoff) — fällt, wird mitgeschwemmt. */
  moveSolid(a: number, b: number, dn: number): boolean {
    const s = this.sp[a];
    if (s < 0 || !(dn > 0)) return false;
    if (this.sp[b] >= 0 && this.sp[b] !== s) return false;
    const d = Math.min(dn, this.sn[a]);
    this.mixHeat(b, d * SOL_CM[s], this.T[a]);
    if (this.sp[b] < 0) { this.sp[b] = s; this.sform[b] = this.sform[a]; }
    this.sn[b] += d;
    this.sn[a] -= d;
    if (this.sn[a] <= 1e-13) { this.sn[b] += this.sn[a]; this.clearSolid(a); }
    return true;
  }

  /** Eine Zelle mit Luft füllen (so viel, wie bei p und T in ihren Gasraum passt). */
  fillAir(i: number, T: number, p: number): void {
    const V = this.gasVol(i);
    const n = (p * V) / (R * T) / 1000;
    const o = i * NG;
    for (let g = 0; g < NG; g += 1) this.gas[o + g] = n * AIR_X[g];
  }

  /** Alles aus einer Zelle (ausser der Tiefe). */
  clear(i: number): void {
    this.mat[i] = 0;
    this.own[i] = 0;
    this.clearSolid(i);
    this.clearLiquid(i);
    this.gas.fill(0, i * NG, i * NG + NG);
    this.smoke[i] = 0;
    this.mist[i] = 0;
    this.fume[i] = 0;
    this.fumeSp[i] = -1;
    this.glow[i] = 0;
    this.glowSp[i] = -1;
    this.q[i] = 0;
    this.turb[i] = 0;
    this.burn[i] = 0;
    this.fizz[i] = 0;
  }

  /* -- Zwischenspeichern (Dinge tragen ihre Zellen) ------------------------------------------------- */

  save(i: number, b: CellBuf): void {
    const f = b.f;
    f[0] = this.D[i]; f[1] = this.mat[i]; f[2] = this.own[i]; f[3] = this.sp[i]; f[4] = this.sn[i]; f[5] = this.sform[i];
    f[6] = this.lq[i]; f[7] = this.msp[i]; f[8] = this.mn[i]; f[9] = this.T[i]; f[10] = this.hf[i]; f[11] = this.smoke[i];
    f[12] = this.mist[i]; f[13] = this.turb[i]; f[14] = this.chg[i]; f[15] = this.specT[i];
    for (let k = 0; k < NC; k += 1) f[SLOTS + k] = this.comp[i * NC + k];
    for (let g = 0; g < NG; g += 1) f[SLOTS + NC + g] = this.gas[i * NG + g];
    b.spec = this.spec[i];
  }

  load(i: number, b: CellBuf): void {
    const f = b.f;
    this.D[i] = f[0]; this.mat[i] = f[1]; this.own[i] = f[2]; this.sp[i] = f[3]; this.sn[i] = f[4]; this.sform[i] = f[5];
    this.lq[i] = f[6]; this.msp[i] = f[7]; this.mn[i] = f[8]; this.T[i] = f[9]; this.hf[i] = f[10]; this.smoke[i] = f[11];
    this.mist[i] = f[12]; this.turb[i] = f[13]; this.chg[i] = f[14]; this.specT[i] = f[15];
    for (let k = 0; k < NC; k += 1) this.comp[i * NC + k] = f[SLOTS + k];
    for (let g = 0; g < NG; g += 1) this.gas[i * NG + g] = f[SLOTS + NC + g];
    this.spec[i] = b.spec;
    this.fume[i] = 0; this.fumeSp[i] = -1; this.glow[i] = 0; this.glowSp[i] = -1; this.q[i] = 0; this.burn[i] = 0; this.fizz[i] = 0;
  }
}

const ML_W = 18.07;

/** Die Menge des Wassers einer Zelle (mol) — kurz. */
export const waterOf = (g: Grid, i: number): number => (g.lq[i] === L.aq ? g.comp[i * NC + WATER] : 0);
