/**
 * 2026-10-18 — DIE WELT DER CHEMIA (die Piaskownica selbst): ein Gitter
 * (`chemGrid.ts`), die Dinge darauf (`chemThings.ts`) und die Zeit.
 *
 * <b>Ein Schritt</b>: die Dinge tun, was sie tun (der Brenner lässt Gas
 * ausströmen, die Heizplatte heizt, die Kerze brennt, der Draht nimmt eine
 * Probe, das Thermometer misst); Flüssigkeit fliesst, Körner fallen, Stücke
 * sinken oder schwimmen; Blasen steigen; das Gas gleicht seinen Druck aus,
 * steigt und mischt sich; Wasser mischt sich; in jeder Zelle die Chemie und
 * das Feuer; dann die Wärme (Leitung, Strahlung, Schmelzen, Kochen,
 * Verdunsten). Nichts davon kennt einen Versuch — ein Versuch ist nur, was
 * wo steht (`chemScene.ts`).
 *
 * <b>Beobachtungen</b> entstehen, wo etwas geschieht, und gehören dem Glas,
 * in dem es geschieht („Wytrąca się biały osad” in der Probówka B).
 */

import { SPECIES } from './chemData';
import { NC, WATER, aqLook, aqVolume, colorWord, specOf, type Bottle } from './chemAq';
import { Air, airStep, pressureAbove } from './chemAir';
import { ChemState, decomposeCells, gasCells, hydrateCells, metalCells, moleculeCells, saltCells, speciateCells, type ChemCtx } from './chemCell';
import { kineticCells } from './chemKinetics';
import { burnGases, burnSolids, flameColors, gasReactions, ignite, type FireNews } from './chemFire';
import { Bodies, Bubbles, fallSolids, flowLiquids, mixLiquids } from './chemFlow';
import { CELL, CellBuf, F, GAS_CP, Grid, L, MATI, NG, SOLI, SOL_M, SOL_TM, S_ICE, type Form } from './chemGrid';
import { conduct, heatScratch, phases, radiate, type HeatScratch } from './chemHeat';
import { corks, devicesStep, flameBase, piecesStep } from './chemDevices';
import * as fill from './chemFill';
import type { Spec } from './chemPh';
import {
  CONTAINERS, THING_NAME, cellsOf, displace, fits, inside, isContainer, makeThing, nozzleOf, paint, relocate, seatOf,
  settleNear, tipOf, toWorld, unpaint, wickOf, worldBox, type Thing, type ThingKind
} from './chemThings';

/** So viel Tisch liegt unter y = 0 (cm). */
export const BENCH = 1.2;

export interface Room { readonly T: number; readonly p: number }

/** Eine Beobachtung („Wydziela się gaz”) — mit Gleichung, wenn bekannt, und dem Ding, in dem sie geschah. */
export interface ChemEvent {
  readonly key: string;
  readonly thing: string;
  readonly text: string;
  readonly eq?: string;
  readonly t: number;
}

/** Was in einem Glas ist (zusammengezählt). */
export interface Summary {
  readonly ml: number;
  readonly comp: Float64Array;
  readonly spec: Spec | null;
  readonly look: Float32Array;
  readonly T: number;
  readonly Tmax: number;
  readonly gas: Float64Array;
  readonly gasMl: number;
  readonly P: number;
  readonly solids: ReadonlyMap<string, number>;
  readonly melts: ReadonlyMap<string, number>;
}

const name = (id: string): string => SPECIES[id]?.name ?? id;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const num1 = (x: number): string => x.toFixed(x < 10 && x > -10 ? 1 : 0).replace('.', ',').replace('-', '−');
const SOL_NAMES: readonly string[] = Object.keys(SOLI).sort((a, b) => SOLI[a] - SOLI[b]);
/** Zwei Zellen zum Tauschen (Umrühren). */
const STIR_A = new CellBuf();
const STIR_B = new CellBuf();

export class World {
  readonly g: Grid;
  readonly things: Thing[] = [];
  readonly air: Air;
  readonly bodies: Bodies;
  readonly bubbles: Bubbles;
  readonly chem: ChemState;
  private readonly heat: HeatScratch;
  time = 0;
  readonly log: ChemEvent[] = [];
  private readonly seen = new Set<string>();
  /** Niederschläge, die noch zu wenig waren, um sie zu sehen — gemeldet, sobald sie es sind. */
  private readonly waiting = new Map<string, { t: Thing; sp: number; key: string; text: string; eq: string | undefined; until: number; i: number }>();
  /** Tiefstwerte (je Gefäss und Beobachtung) — was sichtbar wieder zugenommen hat, ist eine Beobachtung. */
  private readonly lows = new Map<string, number>();
  private flip = false;
  private acc = 0;
  private watchClock = 0;
  /** Wie lange ein Schritt zuletzt dauerte (ms, gleitend). */
  private cost = 8;
  /** Zeit seit der letzten Rechnung der Diffusion (s). */
  private diffClock = 0;
  private readonly hues = new Map<string, { word: string; since: number; said: string | null }>();
  /** Was zuletzt geschah (für die Schleife): 2 — sichtbar, 1 — leise, 0 — Ruhe. */
  activity = 2;
  private busyUntil = 0;
  /** Streichhölzer, die noch brennen (sie halten ihre Stelle eine Weile glühend). */
  sparks: { x: number; y: number; left: number }[] = [];
  /** Gas aus der Flasche, das noch einströmt (in ein Glas — unten — oder an einen Punkt). */
  streams: { to: Thing | null; x: number; y: number; gi: number; left: number }[] = [];

  constructor(readonly x0: number, readonly x1: number, readonly top: number, readonly depth: number, readonly room: Room, readonly rand: () => number = Math.random) {
    const w = Math.max(8, Math.ceil((x1 - x0) / CELL));
    const h = Math.max(8, Math.ceil((top + BENCH) / CELL));
    const g = new Grid(w, h, x0, -BENCH, depth);
    this.g = g;
    this.air = new Air(g.n);
    this.bodies = new Bodies(g);
    this.bubbles = new Bubbles(g, rand);
    this.chem = new ChemState(g.n);
    this.heat = heatScratch(g.n);
    for (let i = 0; i < g.n; i += 1) {
      g.T[i] = room.T;
      if (g.cy(i) < 0) { g.mat[i] = MATI.wood; g.D[i] = 12; continue; }
      g.fillAir(i, room.T, room.p);
    }
  }

  thing(id: string): Thing | undefined { return this.things.find((t) => t.id === id); }

  /* -- Dinge ------------------------------------------------------------------------------------------ */

  /** Auf das Gitter legen (Kanten der Zellen). */
  snap(v: number, base: number): number { return base + Math.round((v - base) / CELL) * CELL; }
  /** Auf die Mitte einer Zelle (waagerecht): schmale Teile (Stab, Span, Brennerrohr) liegen so symmetrisch in ihren Zellen. */
  snapX(v: number): number { return this.g.x0 + (Math.floor((v - this.g.x0) / CELL) + 0.5) * CELL; }

  /**
   * EIN DING AUFSTELLEN: `x` (Mitte), `y` (Unterkante; sonst auf dem, was
   * darunter ist), `on` (auf einem Dreifuss, Stativ, einer Heizplatte), `into`
   * (in ein Glas, auf seinen Boden). Ist der Platz besetzt, rückt es höher;
   * `within`: nur im Glas oder über seiner Öffnung (Eiswürfel stapeln sich darin).
   */
  place(kind: ThingKind, id: string, opts: { x: number; y?: number; on?: Thing; into?: Thing; within?: Thing; size?: number; of?: string; angle?: number; label?: string; held?: boolean; height?: number }): Thing {
    const t = makeThing(kind, id, {
      ...(opts.size === undefined ? {} : { size: opts.size }),
      ...(opts.of === undefined ? {} : { of: opts.of }),
      ...(opts.label === undefined ? {} : { label: opts.label }),
      ...(opts.held === undefined ? {} : { held: opts.held }),
      ...(opts.height === undefined ? {} : { height: opts.height })
    });
    t.angle = opts.angle ?? 0;
    t.x = this.snapX(opts.x);
    let y = opts.y ?? 0;
    if (opts.on !== undefined) { const s = seatOf(opts.on); if (s !== null) { y = s; t.x = this.snapX(opts.on.x); } }
    if (opts.into !== undefined && opts.into.prof !== null) {
      /* In ein Glas: auf seinen Boden — an der gegebenen Stelle, wenn sie im Glas liegt, sonst in der Mitte. Ein Thermometer hängt eine Zelle über dem Boden (es misst den Inhalt, nicht das heisse Glas). */
      const half = opts.into.prof.half(opts.into.prof.t + 0.2);
      if (Math.abs(opts.x - opts.into.x) > half - 0.3) t.x = this.snapX(opts.into.x);
      y = opts.into.y + opts.into.prof.t + 0.05 + (kind === 'thermometer' ? CELL : 0);
    }
    t.y = this.snap(y, this.g.y0);
    const set = new Set([t.num]);
    /* Ist der Platz besetzt: daneben (abwechselnd links und rechts), dann höher — was in ein Glas soll, zuerst im Glas
       (auf dem Eis im Wasserbad, nicht neben der Zlewka). */
    const x0 = t.x;
    const y0 = t.y;
    const ok = opts.within !== undefined ? fill.within(this, opts.within) : null;
    const room = opts.into !== undefined && opts.into.prof !== null ? opts.into.prof.half(opts.into.prof.t + 0.2) : -1;
    let placed = false;
    for (let pass = room > 0 ? 0 : 1; pass < 2 && !placed; pass += 1) for (let up = 0; up < 120 && !placed; up += 1) {
      for (let k = 0; k <= 50 && !placed; k += 1) {
        t.x = x0 + (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * CELL;
        t.y = y0 + up * CELL;
        if (pass === 0 && opts.into !== undefined && Math.abs(t.x - opts.into.x) > room) continue;
        const cells = cellsOf(this.g, t);
        if (cells.length === 0 || !fits(this.g, cells, set) || (ok !== null && !cells.every((c) => ok(c.i)))) continue;
        /* Was dort lag (Körner im Tiegel, Wasser), weicht dem Ding aus — auch aus seinem Inneren: eine Probówka, die in ein
           Wasserbad gestellt wird, bringt ihre Luft mit, das Wasser steigt um sie herum. */
        const away = displace(this.g, cells, true);
        paint(this.g, t, cells, true);
        /* Ein neues Ding hat Zimmertemperatur (auch in heissem Wasser — es wärmt sich erst), ein neues Glas kommt voll Luft. */
        for (const c of cells) if (this.g.own[c.i] === t.num) { this.g.T[c.i] = this.room.T; this.g.q[c.i] = 0; }
        for (const c of cells) if (c.inner && this.g.own[c.i] === t.num && this.g.lq[c.i] === L.none) this.g.fillAir(c.i, this.room.T, this.room.p);
        for (const d of away) settleNear(this.g, d.buf, this.g.cx(d.i), this.g.cy(d.i), set);
        placed = true;
      }
    }
    if (!placed) { t.x = x0; t.y = y0; }
    else this.things.push(t);
    this.poke();
    return t;
  }

  remove(t: Thing): void {
    unpaint(this.g, this.things, t, new Set([t.num]), this.room.T);
    const k = this.things.indexOf(t);
    if (k >= 0) this.things.splice(k, 1);
    for (const u of this.things) if (u.onto === t.id) this.remove(u);
    this.poke();
  }

  /** Was mit einem Ding mitgeht: was in ihm steht, was auf ihm liegt, sein Stopfen. */
  carried(t: Thing): Thing[] {
    const out: Thing[] = [];
    const add = (u: Thing) => {
      if (u === t || out.includes(u)) return;
      out.push(u);
      for (const v of this.carried(u)) if (v !== t && !out.includes(v)) out.push(v);
    };
    const seat = seatOf(t);
    for (const u of this.things) {
      if (u === t || u.held) continue;
      if (u.onto === t.id) { add(u); continue; }
      if (t.prof !== null && u.prof === null && u.kind !== 'stopper' && inside(t, u.x, u.y + CELL)) { add(u); continue; }
      if (t.prof !== null && u.prof !== null && u.prof.full < t.prof.full && inside(t, u.x, u.y + CELL)) { add(u); continue; }
      if (seat !== null && Math.abs(u.y - seat) < CELL * 1.5 && Math.abs(u.x - t.x) < 6) add(u);
    }
    return out;
  }

  /**
   * Mit der Hand dorthin: ist der Platz besetzt (ein Bein des Dreifusses, der
   * Brenner), hebt die Hand das Ding über das Hindernis — losgelassen fällt es
   * auf das, was darunter ist (die Siatka).
   */
  moveNear(t: Thing, x: number, y: number): boolean {
    if (this.move(t, x, y)) return true;
    for (let k = 1; k <= 60; k += 1) if (this.move(t, x, y + k * CELL)) return true;
    return false;
  }

  /** Verschieben (mit allem, was mitgeht) — `false`: der Platz ist besetzt. */
  move(t: Thing, x: number, y: number): boolean {
    const dx = this.snap(x - t.x, 0);
    const dy = this.snap(y - t.y, 0);
    if (dx === 0 && dy === 0) return true;
    const ok = relocate(this.g, this.things, [t, ...this.carried(t)], dx, dy, 0, [0, 0], this.room.T);
    if (ok) this.poke();
    return ok;
  }

  /** Neigen um den Rand (zum Ausgiessen) — negativ: nach rechts. */
  tilt(t: Thing, angle: number): boolean {
    const turn = angle - t.angle;
    if (Math.abs(turn) < 1e-4) return true;
    const half = t.prof !== null ? t.prof.width / 2 : 0.3;
    const top = t.prof !== null ? t.prof.top : 1;
    const side = angle < 0 || (angle === 0 && t.angle < 0) ? 1 : -1;
    const pivot = toWorld(t, side * half, top);
    const ok = relocate(this.g, this.things, [t, ...this.carried(t)], 0, 0, turn, pivot, this.room.T);
    if (ok) this.poke();
    return ok;
  }

  /** Fallen lassen, bis es aufliegt. */
  drop(t: Thing): void {
    if (t.held) return;
    for (let k = 0; k < 400; k += 1) if (!relocate(this.g, this.things, [t, ...this.carried(t)], 0, -CELL, 0, [0, 0], this.room.T)) break;
    this.poke();
  }

  /** Ein Ding unter einem Punkt (das kleinste). */
  at(x: number, y: number): Thing | null {
    const i = this.g.at(x, y);
    if (i >= 0 && this.g.own[i] !== 0) {
      const t = this.things.find((u) => u.num === this.g.own[i]);
      if (t !== undefined) return t;
    }
    let best: Thing | null = null;
    let area = Infinity;
    for (const t of this.things) {
      const [a, b, c, d] = worldBox(t);
      const pad = CELL * 1.5;
      if (x < a - pad || x > c + pad || y < b - pad || y > d + pad) continue;
      const s = (c - a) * (d - b);
      if (s < area) { area = s; best = t; }
    }
    return best;
  }

  /** Das Glas, zu dem eine Zelle gehört (ihr Inneres, oder in dem das Ding dort steht). */
  containerOf(i: number): Thing | null {
    const g = this.g;
    const x = g.cx(i);
    const y = g.cy(i);
    let best: Thing | null = null;
    for (const t of this.things) {
      if (t.prof === null || !inside(t, x, y)) continue;
      if (best === null || (best.prof !== null && t.prof.full < best.prof.full)) best = t;
    }
    if (best !== null) return best;
    const o = this.things.find((t) => t.num === g.own[i]);
    return o ?? null;
  }

  /* -- Hineingeben (`chemFill.ts`) ---------------------------------------------------------------------- */

  /** Ein Reagenz in ein Glas oder an einen Punkt — `settled`: gleich unten (eine Szene füllen). */
  add(id: string, amount: number, to: Thing | null, at: readonly [number, number] | null = null, settled = false): boolean { return fill.addReagent(this, id, amount, to, at, settled); }
  settleSolids(): void { fill.settleSolids(this); }
  spill(b: Bottle, ml: number, T: number, x: number, y: number, into: Thing | null = null): void { fill.spill(this, b, ml, T, x, y, into); }
  fillSettled(t: Thing, b: Bottle, ml: number, T: number): void { fill.fillSettled(this, t, b, ml, T); }
  blend(t: Thing): void { fill.blend(this, t); }
  sprinkle(s: number, n: number, form: Form, T: number, x: number, y: number, into: Thing | null): void { fill.sprinkle(this, s, n, form, T, x, y, into); }
  transfer(from: Thing, to: Thing, ml: number): number { return fill.transfer(this, from, to, ml); }
  fillGas(t: Thing, gi: number, n: number): void { fill.fillGas(this, t, gi, n); }
  fillGasMix(t: Thing, x: ArrayLike<number>): void { fill.fillGasMix(this, t, x); }

  /**
   * Den Inhalt auf T bringen — in dem Zustand, den er bei T hat: Zinn über
   * 232 °C ist flüssig, Eis über 0 °C Wasser, eine Schmelze darunter fest (als
   * wäre die Wärme dafür schon geflossen).
   */
  warmTo(t: Thing, T: number): void {
    const g = this.g;
    const set = (i: number): void => {
      const s = g.sp[i];
      if (s >= 0 && s !== S_ICE && SOL_TM[s] > 0 && T > SOL_TM[s] && g.lq[i] !== L.aq && (g.msp[i] < 0 || g.msp[i] === s)) {
        const n = g.sn[i];
        g.addSolid(i, s, -n, g.sform[i] as Form);
        g.addMelt(i, s, n);
      } else if (s === S_ICE && T > 273.15 && g.lq[i] !== L.melt) {
        const n = g.sn[i];
        g.addSolid(i, s, -n, g.sform[i] as Form);
        g.addAq(i, WATER, n);
      }
      const m = g.msp[i];
      if (g.lq[i] === L.melt && m >= 0 && T < SOL_TM[m] && (g.sp[i] < 0 || g.sp[i] === m)) {
        const n = g.mn[i];
        g.addMelt(i, m, -n);
        g.addSolid(i, m, n, F.cast);
      }
      g.q[i] = 0;
      g.T[i] = T;
    };
    for (const i of t.cells) if (g.own[i] === t.num) set(i);
    for (const u of this.carried(t)) for (const i of u.cells) if (g.own[i] === u.num) set(i);
  }

  /** Was an einem Punkt ist (für die Sonde): Temperatur, was dort ist, Druck, pH. */
  probe(x: number, y: number): { T: number; what: string; P: number; pH: number | null } | null {
    const g = this.g;
    const i = g.at(x, y);
    if (i < 0) return null;
    const what = g.wall(i) ? 'ściana'
      : g.lq[i] === L.aq ? 'roztwór'
        : g.lq[i] === L.melt ? `${name(SOL_NAMES[g.msp[i]] ?? '')} (ciekły)`
          : g.sp[i] >= 0 ? name(SOL_NAMES[g.sp[i]] ?? '')
            : 'gaz';
    const p = this.air.pressureOf(i);
    return { T: g.T[i], what, P: p > 0 ? p : this.room.p, pH: g.lq[i] === L.aq ? (g.spec[i]?.pH ?? null) : null };
  }

  /* -- Werkzeuge --------------------------------------------------------------------------------------- */

  /** Ein Streichholz an einen Punkt (zündet Brenner, Kerze, Holzspan, Etanoldampf, Schwefel …) — es brennt eine knappe Sekunde. */
  ignite(x: number, y: number): void {
    ignite(this.g, x, y);
    this.sparks.push({ x, y, left: 0.9 });
    for (const t of this.things) {
      if (t.kind === 'candle') { const [wx, wy] = wickOf(t); if (Math.hypot(wx - x, wy - y) < 1.2) t.on = true; }
      if (t.kind === 'burner' && t.on) { const [nx, ny] = nozzleOf(t); if (Math.abs(nx - x) < 2 && y > ny - 1 && y < ny + 4) t.lit = true; }
    }
    this.poke();
  }

  /** Ein brennender (oder glimmender) Holzspan in der Hand, Spitze unten. */
  splint(x: number, y: number, glowing: boolean): Thing {
    const t = this.place('splint', `span-${this.things.length + 1}`, { x, y, held: true, ...(glowing ? { of: 'C' } : {}) });
    const tip = this.g.at(...tipOf(t));
    if (tip >= 0) this.g.T[tip] = glowing ? 950 : 1100;
    t.on = true;
    this.poke();
    return t;
  }

  /** Den Hahn der Bürette öffnen (cm³/s) oder schliessen. */
  tap(t: Thing, rate: number): void {
    const was = t.on;
    t.on = rate > 0;
    if (rate > 0) t.flow = rate;
    if (!was && t.on) t.readout = 0;
    const i = t.cells[0] ?? -1;
    if (was && !t.on) this.say(`tap:${this.time.toFixed(1)}`, `→ Kranik zamknięty — z biurety wypłynęło ${num1(Number.isFinite(t.readout) ? t.readout : 0)} cm³.`, i);
    if (!was && t.on) this.say(`tap:${this.time.toFixed(1)}`, `→ Kranik biurety otwarty (${num1(rate)} cm³/s).`, i);
    this.poke();
  }

  /** Den Brenner an- und anzünden (oder ausmachen). */
  burner(t: Thing, on: boolean): void {
    t.on = on;
    t.lit = on;
    if (on) { const [x, y] = nozzleOf(t); this.sparks.push({ x, y: y + CELL, left: 0.5 }); }
    this.poke();
  }

  /** Rühren: das Wasser im Glas wird aufgewühlt. */
  stir(t: Thing): void {
    const g = this.g;
    for (const i of t.cells) if (g.lq[i] === L.aq) g.turb[i] = Math.max(g.turb[i], 0.9);
    /* Der Stab mischt auch, was in der Flüssigkeit liegt (Eis mit Salz, Pulver): benachbarte Zellen gleicher Grösse tauschen ihren Inhalt. */
    const inner = t.cells.filter((i) => g.own[i] === t.num && g.mat[i] === 0 && (g.lq[i] !== L.none || (g.sp[i] >= 0 && g.sform[i] >= F.granules && g.sform[i] <= F.precip)));
    const set = new Set(inner);
    for (let k = 0; k < inner.length * 3; k += 1) {
      const i = inner[Math.floor(this.rand() * inner.length)];
      const r = this.rand();
      const j = r < 0.25 ? i - 1 : r < 0.5 ? i + 1 : r < 0.75 ? i - g.w : i + g.w;
      if (!set.has(j) || Math.abs(g.D[i] - g.D[j]) > 1e-6 * g.D[i]) continue;
      g.save(i, STIR_A);
      g.save(j, STIR_B);
      g.load(i, STIR_B);
      g.load(j, STIR_A);
    }
    this.poke();
  }

  /** Den Stopfen aufsetzen oder abnehmen. */
  stopper(t: Thing): Thing | null {
    const has = this.things.find((u) => u.kind === 'stopper' && u.onto === t.id);
    if (has !== undefined) { this.remove(has); return null; }
    if (t.prof === null) return null;
    const p = t.prof;
    const mouth = 2 * p.half(p.top - CELL * 0.5);
    const s = makeThing('stopper', `${t.id}-korek`, { size: mouth, onto: t.id });
    s.angle = t.angle;
    [s.x, s.y] = toWorld(t, 0, p.top - 0.8);
    s.x = this.snapX(s.x);
    s.y = this.snap(s.y, this.g.y0);
    const cells = cellsOf(this.g, s).filter((c) => this.g.mat[c.i] === 0 || this.g.own[c.i] === s.num);
    for (const c of cells) {
      const i = c.i;
      this.g.clearLiquid(i);
      this.g.gas.fill(0, i * NG, i * NG + NG);
    }
    paint(this.g, s, cells, true);
    this.things.push(s);
    this.poke();
    return s;
  }

  /** Ein Glas ausleeren. */
  empty(t: Thing): void {
    const g = this.g;
    for (const i of t.cells) {
      if (g.own[i] !== t.num || g.mat[i] !== 0) continue;
      g.clearLiquid(i);
      if (g.sform[i] !== F.piece) g.clearSolid(i);
      g.fillAir(i, this.room.T, this.room.p);
      g.T[i] = this.room.T;
    }
    for (const u of [...this.things]) if (u.kind === 'piece' && inside(t, u.x, u.y + CELL)) this.remove(u);
    this.poke();
  }

  /** Was ein Indikatorpapier an einem Punkt zeigt (pH) — oder `null`: dort ist kein Wasser. */
  phAt(x: number, y: number): number | null {
    const i = this.g.at(x, y);
    if (i < 0) return null;
    for (const j of [i, i - this.g.w, i - 1, i + 1]) if (j >= 0 && this.g.lq[j] === L.aq) return (this.g.spec[j] ?? specOf(this.g.comp, j * NC, this.g.T[j], null)).pH;
    return null;
  }

  /* -- Beobachtungen ---------------------------------------------------------------------------------- */

  say(key: string, text: string, i: number, eq?: string): void {
    const t = i >= 0 ? this.containerOf(i) : null;
    const id = t?.id ?? '—';
    if (t === null && (key === 'boil' || key.startsWith('freeze:water'))) return;
    /* Paraffin, das unter der Flamme der Kerze schmilzt, ist keine Beobachtung wert. */
    if ((key.startsWith('melt:') || key.startsWith('freeze:')) && SOL_NAMES[Number(key.slice(key.indexOf(':') + 1))] === 'wax') return;
    const k = `${id}:${key}`;
    if (this.seen.has(k)) return;
    /* Kochen, Schmelzen, Erstarren, Gefrieren: nur, was man sieht — genug Flüssigkeit, der Inhalt als Ganzes so warm bzw. kalt. */
    if (t !== null && (key === 'boil' || key.startsWith('freeze:') || key.startsWith('melt:'))) {
      const s = this.summary(t, false);
      if (key === 'boil' && (s.ml < 1 || s.T < 365)) return;
      /* Schmelzen und Erstarren erst, wenn sichtbar mehr flüssig bzw. fest geworden ist (ein Viertel, höchstens 0,5 g): an der Grenze frieren und tauen einzelne Zellen hin und her. */
      if (key.startsWith('melt:') || (key.startsWith('freeze:') && key !== 'freeze:water')) {
        const sp = Number(key.slice(key.indexOf(':') + 1));
        const melt = (s.melts.get(SOL_NAMES[sp]) ?? 0) * SOL_M[sp];
        const see = Math.min(0.5, (melt + (s.solids.get(SOL_NAMES[sp]) ?? 0) * SOL_M[sp]) * 0.25);
        if (key.startsWith('melt:') ? !this.grown(k, melt, see) : s.Tmax > SOL_TM[sp] + 1 || !this.grown(k, -melt, see)) return;
      }
      /* Eis im Salzwasser schmilzt — Gefrieren ist, wenn das Eis zunimmt. */
      if (key === 'freeze:water' && (s.T > 273.5 || !this.grown(k, (s.solids.get('ice') ?? 0) * 18.015, 0.5))) return;
    }
    /* Niederschlag, Kristalle, Auflösen: erst, wenn man es sieht (2 mg im Gefäss) — Spuren an der Grenze zweier Lösungen
       bleiben stumm. Was noch zu wenig ist, wartet: wächst es binnen 20 s, wird es gemeldet (`watch`). */
    if (t !== null && (key.startsWith('precip:') || key.startsWith('cryst:') || key.startsWith('attack:'))) {
      const sp = SOLI[key.slice(key.indexOf(':') + 1)];
      if (sp !== undefined && this.solidIn(t, sp) * SOL_M[sp] < 0.002) {
        if (!key.startsWith('attack:') && !this.waiting.has(k)) this.waiting.set(k, { t, sp, key: k, text, eq, until: this.time + 20, i });
        return;
      }
    }
    this.waiting.delete(k);
    this.seen.add(k);
    let line = text;
    if (line === '') {
      const T = i >= 0 ? this.g.T[i] - 273.15 : 0;
      if (key.startsWith('melt:')) { const sp = SOL_NAMES[Number(key.slice(5))] ?? ''; line = `${cap(name(sp))} topi się (temperatura topnienia ${num1(SOL_TM[SOLI[sp]] - 273.15)} °C).`; }
      else if (key.startsWith('freeze:water')) line = 'Woda zamarza.';
      else if (key.startsWith('freeze:')) { const sp = SOL_NAMES[Number(key.slice(7))] ?? ''; line = `${cap(name(sp))} krzepnie.`; }
      else if (key === 'boil') line = `Ciecz wrze w temperaturze ${num1(T)} °C.`;
      else return;
    }
    this.log.push({ key: k, thing: id, text: line, t: this.time, ...(eq === undefined ? {} : { eq }) });
    if (this.log.length > 300) this.log.splice(0, this.log.length - 300);
  }

  /** Wie viel von einem Feststoff (mol) in den Zellen eines Gefässes liegt. */
  private solidIn(t: Thing, sp: number): number {
    const g = this.g;
    let s = 0;
    for (const i of t.cells) if (g.own[i] === t.num && g.sp[i] === sp) s += g.sn[i];
    return s;
  }

  /** Ist der Wert um `see` über seinen bisherigen Tiefstwert gestiegen? */
  private grown(k: string, v: number, see: number): boolean {
    const low = Math.min(this.lows.get(k) ?? v, v);
    this.lows.set(k, low);
    return v - low >= see;
  }

  forget(prefix: string): void {
    for (const k of [...this.seen]) if (k.includes(prefix)) this.seen.delete(k);
    for (const k of [...this.lows.keys()]) if (k.includes(prefix)) this.lows.delete(k);
    for (const k of [...this.waiting.keys()]) if (k.includes(prefix)) this.waiting.delete(k);
  }

  /* -- Die Zeit ----------------------------------------------------------------------------------------- */

  /** Nach einer Handlung: die nächsten Augenblicke zeichnen. */
  poke(): void { this.busyUntil = this.time + 1.5; this.activity = 2; }

  /**
   * Ein Bild: so viele Schritte, wie die Zeit (mal Tempo) braucht — höchstens
   * vier und höchstens `budget` Millisekunden (ein langsames Telefon rechnet
   * dann eben langsamer als befohlen, statt zu stocken).
   */
  frame(dt: number, speed: number, budget = 14): number {
    this.acc += Math.min(0.25, dt) * speed;
    const base = 1 / 30;
    let n = Math.floor(this.acc / base + 1e-9);
    if (n <= 0) return this.activity;
    /* So viele Schritte, wie in die Zeit eines Bildes passen: bei hohem Tempo werden sie länger, statt dass die Zeit
       langsamer läuft als befohlen — bis 0,12 s, solange etwas brennt oder tropft (Flammen, Bürette), sonst bis 2 s
       (Zeitraffer: Lösen, Diffusion, Abkühlen). */
    n = Math.min(4, n, Math.max(1, Math.floor(budget / Math.max(0.5, this.cost))));
    const hMax = this.fierce() ? 0.12 : 2;
    const h = Math.min(hMax, this.acc / n);
    const start = typeof performance === 'undefined' ? 0 : performance.now();
    let done = 0;
    for (let k = 0; k < n; k += 1) {
      this.step(h);
      done += 1;
      if (typeof performance !== 'undefined' && performance.now() - start > budget) break;
    }
    if (typeof performance !== 'undefined') this.cost = this.cost * 0.8 + ((performance.now() - start) / done) * 0.2;
    this.acc = done < n ? 0 : Math.max(0, this.acc - n * h);
    if (this.acc > hMax) this.acc = hMax;
    return this.activity;
  }

  step(dt: number): void {
    const g = this.g;
    this.time += dt;
    this.flip = !this.flip;
    g.fizz.fill(0);
    const ctx: ChemCtx = { g, bubbles: this.bubbles, dt, say: (k, t, i, eq) => this.say(k, t, i, eq), pAt: (i) => pressureAbove(g, this.air, i, this.room.p) };
    devicesStep(this, ctx);
    const iters = Math.min(6, Math.max(2, Math.round((3 * dt) / (1 / 30))));
    let moved = false;
    for (let k = 0; k < iters; k += 1) moved = flowLiquids(g, (k & 1) === 1) || moved;
    /* Lange Schritte (Zeitraffer): Körner fallen mehrere Zellen. */
    for (let k = Math.min(8, Math.max(1, Math.round(dt / (1 / 30)))); k > 0; k -= 1) moved = fallSolids(g, Math.min(dt, 1 / 30), this.rand) || moved;
    moved = piecesStep(this) || moved;
    this.bodies.update(this.air);
    this.bubbles.step(dt);
    airStep(g, this.air, this.bodies, dt, this.room.T, this.room.p, this.flip, { trapped: (i) => this.bubbles.trap(i), bubbleOut: (i, j, n) => this.bubbles.from(i, j, n) }, this.rand);
    corks(this);
    /* Die Diffusion ist so langsam, dass sie gesammelt alle halbe Sekunde gerechnet wird. */
    this.diffClock += dt;
    const mol = this.diffClock >= 0.5 ? this.diffClock : 0;
    if (mol > 0) this.diffClock = 0;
    mixLiquids(g, dt, this.rand, mol);
    speciateCells(ctx, this.chem);
    saltCells(ctx, this.chem);
    moleculeCells(ctx);
    metalCells(ctx);
    kineticCells(ctx);
    hydrateCells(ctx);
    gasCells(ctx);
    decomposeCells(ctx);
    for (const s of this.streams) {
      /* Durch eine Flüssigkeit perlt das Gas von unten (Gas aus der Flasche durch Kalkwasser), sonst strömt es unten ins Glas. */
      const low = s.to !== null ? fill.lowest(this, s.to) : -1;
      const cell = low >= 0 && g.lq[low] === L.aq ? low : s.to !== null ? fill.lowestGas(this, s.to) : g.at(s.x, s.y);
      if (cell < 0) { s.left = 0; continue; }
      const dn = Math.min(s.left, 4e-3 * dt);
      if (g.lq[cell] === L.aq) this.bubbles.out(cell, s.gi, dn);
      else { g.mixHeat(cell, dn * GAS_CP[s.gi], this.room.T); g.gas[cell * NG + s.gi] += dn; }
      g.turb[cell] = Math.max(g.turb[cell], 0.15);
      s.left -= dn;
    }
    if (this.streams.length > 0) this.streams = this.streams.filter((s) => s.left > 1e-12);
    for (const s of this.sparks) { ignite(g, s.x, s.y); s.left -= dt; }
    if (this.sparks.length > 0) this.sparks = this.sparks.filter((s) => s.left > 0);
    flameBase(this);
    const news: FireNews = { h2: 0, h2At: -1 };
    burnGases(ctx, news);
    burnSolids(ctx);
    gasReactions(ctx);
    flameColors(ctx);
    if (news.h2 > 4e-6) this.say(`pop:${Math.floor(this.time)}`, 'Pyk! — wodór zmieszany z powietrzem spala się z charakterystycznym odgłosem.', news.h2At, '2H₂ + O₂ → 2H₂O');
    conduct(g, dt, this.flip, this.heat);
    radiate(g, dt, this.room.T);
    phases(g, dt, { pAt: ctx.pAt, bubble: (i, gas, n) => this.bubbles.out(i, gas, n), say: (k, t, i) => this.say(k, t, i) });
    for (let c = 0; c < g.w; c += 1) g.T[c] = this.room.T;
    const kg = Math.exp(-dt / 0.7);
    for (let i = 0; i < g.n; i += 1) if (g.glow[i] > 0) { g.glow[i] *= kg; if (g.glow[i] < 1e-12) { g.glow[i] = 0; g.glowSp[i] = -1; } }
    this.watch(dt);
    this.activity = this.measure(moved);
  }

  /** Was eben knallte (Korken, Wasserstoff) — für die Bilder. */
  pops: { x: number; y: number; t: number }[] = [];

  /** Was man sehen kann: ein Glas wird warm oder kalt, seine Lösung bekommt eine neue Farbe. */
  private watch(dt: number): void {
    this.watchClock += dt;
    if (this.watchClock < 0.3) return;
    this.watchClock = 0;
    for (const [k, w] of [...this.waiting]) {
      if (this.time > w.until || !this.things.includes(w.t)) { this.waiting.delete(k); continue; }
      if (this.solidIn(w.t, w.sp) * SOL_M[w.sp] < 0.002) continue;
      this.waiting.delete(k);
      if (this.seen.has(k)) continue;
      this.seen.add(k);
      this.log.push({ key: k, thing: w.t.id, text: w.text, t: this.time, ...(w.eq === undefined ? {} : { eq: w.eq }) });
    }
    for (const t of this.things) {
      if (t.prof === null) continue;
      const s = this.summary(t, false);
      if (s.ml < 0.5) continue;
      const word = colorWord(s.look[0], s.look[1], s.look[2], s.look[3]);
      const h = this.hues.get(t.id);
      if (h === undefined) { this.hues.set(t.id, { word, since: this.time, said: word }); continue; }
      if (h.word !== word) { h.word = word; h.since = this.time; continue; }
      if (this.time - h.since < 0.6 || h.said === word) continue;
      h.said = word;
      this.forget(`${t.id}:color:`);
      this.say(`color:${word}`, word === 'bezbarwny' ? 'Roztwór odbarwia się.' : `Roztwór barwi się na ${ADVERB[word] ?? word}.`, t.cells.find((i) => this.g.lq[i] === L.aq) ?? -1);
    }
  }

  /** Was kurze Schritte braucht: eine Flamme, ein Funke, eine offene Bürette, Gas aus der Flasche. */
  private fierce(): boolean {
    if (this.sparks.length > 0 || this.streams.length > 0) return true;
    for (const t of this.things) if (t.on && (t.kind === 'burner' || t.kind === 'candle' || t.kind === 'burette' || t.kind === 'splint')) return true;
    return false;
  }

  private measure(moved: boolean): number {
    const g = this.g;
    if (this.time < this.busyUntil || moved || this.bubbles.list.length > 0) return 2;
    for (const t of this.things) if ((t.kind === 'burner' || t.kind === 'hotplate' || t.kind === 'candle') && (t.on || t.stir)) return 2;
    let slow = false;
    for (let i = 0; i < g.n; i += 1) {
      if (g.burn[i] > 1e-3 || g.turb[i] > 0.05) return 2;
      if (!slow && Math.abs(g.T[i] - this.room.T) > 0.5 && g.cy(i) >= 0) slow = true;
    }
    return slow ? 1 : 0;
  }

  /* -- Was in einem Glas ist ---------------------------------------------------------------------------- */

  /** Alles im Inneren eines Glases zusammengezählt — mit pH der gemischten Lösung (`exact`) oder dem Mittel der Zellen. */
  summary(t: Thing, exact = true): Summary {
    const g = this.g;
    const comp = new Float64Array(NC);
    const gas = new Float64Array(NG);
    const solids = new Map<string, number>();
    const melts = new Map<string, number>();
    const look = new Float32Array(4);
    let ml = 0;
    let gasMl = 0;
    let C = 0;
    let CT = 0;
    let Tmax = -Infinity;
    let P = this.room.p;
    let lv = 0;
    let lookW = 0;
    /* Temperatur des Inhalts (Flüssigkeit, Feststoffe; nicht ein Tautropfen an heissem Glas) — nur ohne Inhalt die des Gases. */
    let Cc = 0;
    let CTc = 0;
    let Tc = -Infinity;
    const [x0, y0, x1, y1] = worldBox(t);
    const c0 = Math.max(0, Math.floor((x0 - g.x0) / CELL));
    const c1 = Math.min(g.w - 1, Math.floor((x1 - g.x0) / CELL));
    const r0 = Math.max(0, Math.floor((y0 - g.y0) / CELL));
    const r1 = Math.min(g.h - 1, Math.floor((y1 - g.y0) / CELL));
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        const i = r * g.w + c;
        if (g.mat[i] !== 0 || !inside(t, g.cx(i), g.cy(i))) continue;
        if (g.lq[i] === L.aq) {
          const o = i * NC;
          const v = aqVolume(g.comp, o);
          ml += v;
          for (let k = 0; k < NC; k += 1) comp[k] += g.comp[o + k];
          for (let k = 0; k < 4; k += 1) look[k] += g.look[i * 4 + k] * v;
          lookW += v;
          lv += v;
        } else if (g.lq[i] === L.melt && g.msp[i] >= 0) melts.set(SOL_NAMES[g.msp[i]], (melts.get(SOL_NAMES[g.msp[i]]) ?? 0) + g.mn[i]);
        if (g.sp[i] >= 0) solids.set(SOL_NAMES[g.sp[i]], (solids.get(SOL_NAMES[g.sp[i]]) ?? 0) + g.sn[i]);
        const gv = g.gasVol(i);
        if (gv > 0) { gasMl += gv; for (let k = 0; k < NG; k += 1) gas[k] += g.gas[i * NG + k]; const p = this.air.pressureOf(i); if (p > 0) P = p; }
        const ci = g.cap(i);
        C += ci;
        CT += ci * g.T[i];
        Tmax = Math.max(Tmax, g.T[i]);
        if ((g.lq[i] !== L.none && g.liqVol(i) > 0.05 * g.room(i)) || g.sp[i] >= 0) { Cc += ci; CTc += ci * g.T[i]; Tc = Math.max(Tc, g.T[i]); }
      }
    }
    if (Cc > 0) { C = Cc; CT = CTc; Tmax = Tc; }
    if (lookW > 0) for (let k = 0; k < 4; k += 1) look[k] /= lookW; else { look[0] = 170; look[1] = 208; look[2] = 238; look[3] = 0.16; }
    const T = C > 0 ? CT / C : this.room.T;
    let spec: Spec | null = null;
    if (exact && lv > 0.05) {
      spec = specOf(comp, 0, T, null);
      aqLook(comp, 0, spec, look);
    }
    return { ml, comp, spec, look, T, Tmax: Number.isFinite(Tmax) ? Tmax : T, gas, gasMl, P, solids, melts };
  }

  /** pH eines Glases als Mittel seiner Zellen (schnell — für Anzeigen und den Schreiber) — `null`: kein Wasser. */
  /**
   * Der pH des ganzen Inhalts, wie nach dem Umrühren gemessen — nicht ein Mittel
   * der Zellen (ein Tropfen Säure, der eben oben ankam, wöge sonst die ganze
   * Lauge auf).
   */
  phOf(t: Thing): number | null {
    const g = this.g;
    const total = this.phBuf;
    total.fill(0);
    let v = 0;
    let vt = 0;
    for (const i of t.cells) {
      if (g.lq[i] !== L.aq || g.own[i] !== t.num) continue;
      const o = i * NC;
      const vol = aqVolume(g.comp, o);
      for (let k = 0; k < NC; k += 1) total[k] += g.comp[o + k];
      v += vol;
      vt += vol * g.T[i];
    }
    if (v < 0.3) return null;
    const spec = specOf(total, 0, vt / v, this.phGuess.get(t.num) ?? null);
    this.phGuess.set(t.num, spec.pH);
    return spec.pH;
  }

  private readonly phBuf = new Float64Array(NC);
  private readonly phGuess = new Map<number, number>();

  /** Die Grenzen dessen, was auf dem Tisch steht [x0, y0, x1, y1]. */
  bounds(): [number, number, number, number] {
    let a = Infinity; let b = -BENCH; let c = -Infinity; let d = 8;
    for (const t of this.things) {
      const [x0, , x1, y1] = worldBox(t);
      a = Math.min(a, x0 - 1.5); c = Math.max(c, x1 + 1.5); d = Math.max(d, y1 + 2);
    }
    if (!Number.isFinite(a)) { a = this.x0; c = this.x1; }
    return [a, b - 0.5, c, d];
  }
}

const ADVERB: Readonly<Record<string, string>> = {
  różowy: 'różowo', czerwony: 'czerwono', pomarańczowy: 'pomarańczowo', żółty: 'żółto', zielony: 'zielono', niebieskozielony: 'niebieskozielono',
  niebieski: 'niebiesko', fioletowy: 'fioletowo', brunatny: 'brunatno', biały: 'biało', szary: 'szaro', czarny: 'czarno'
};


export { CONTAINERS, THING_NAME, isContainer };
