/**
 * PARTIKEL-LABOR — DIE ENGINE: ein Speicher, ein Nachbargitter, eine
 * Schrittschleife. Befehle (malen, löschen, Festkörper, Geräte) kommen
 * zwischen den Schritten; jeder Schritt (dt = 1/240 s, bei schnellen Partikeln
 * in bis zu vier Teilschritten) führt jede Partikel durch dieselbe Folge, und
 * jede Stufe wird gemessen:
 *
 * <code>
 *   1 forces       Schwere → Geschwindigkeit, Orte vorhersagen (feste Partikeln bleiben)
 *   2 grid         Nachbargitter neu, Nachbarlisten
 *   3 constraints  Dichte nach PBF, mehrphasig, nach Masse gewichtet (solver.ts)
 *   4 velocity     Geschwindigkeit aus den Orten, Viskosität, Kohäsion, Adhäsion, Druck
 *   5 heat         Wärmeleitung, Heizung, Verluste (M1b)
 *   6 phaseChange  Keime, Verdampfen, Kondensieren, Teilen (M1c)
 *   7 chemistry    Haken für die Chemie (leer in M1)
 *   8 boundary     wer die Welt verlässt, entweicht; der Saum der Luft wandert (band.ts)
 *   9 diagnostics  Bilanzen, Messfühler
 * </code>
 *
 * Die Kerne der Stufen 1–4 rechnet ein `Runner` — ein Faden oder der Rechner
 * mit Helfern; das Ergebnis ist bitgenau dasselbe. Keine Allokation in der
 * Schleife, kein Math.random (der Zufall `rng` gehört zum Zustand): derselbe
 * Samen und dieselben Befehle ergeben denselben Lauf.
 */

import { Band, type BandHost } from './band';
import { Grid, MARGIN_SITES, MAX_NBR } from './grid';
import { Kernels, latticeSum, pressureScale } from './kernels';
import { Mem } from './mem';
import { Rng } from './rng';
import { SerialRunner, type Runner } from './runner';
import { EMPTY_SCENE, SPACING, writeScene, type HeaterMode, type Op, type Quality, type Scene } from './scene';
import { beakerParts, hotplateParts, inRegion, regionBounds, type Region } from './shapes';
import {
  JOB_DELTA, JOB_ENDSUB, JOB_LAMBDA, JOB_PREDICT, JOB_SEARCH,
  P_A0, P_DEPTH, P_DT, P_EPS, P_FIN, P_FIRST, P_GNX, P_GNY, P_GX, P_GY, P_H, P_H2, P_KD, P_KS, P_N, P_NEXT, P_OMEGA, P_PALPHA,
  P_PAMB, P_PSCALE, P_S, P_SMOOTH, P_SNX, P_SRC, P_TOP, P_VMAX, P_W0, P_X0, P_XSPH_G, P_XSPH_L, P_XSPH_W, P_Y0, PARAMS, setSurfaceModel, viewsOf
} from './solver';
import { SPECIES, enthalpy, gasDensity, liquidDensity, mappedGasDensity, MOLAR, phaseName, solidDensity, spIndex } from './species';
import { STAGES } from './stages';
import { ORIGIN_AIR, ORIGIN_OP, ORIGIN_WALL, SLOTS, Store } from './store';
import { GAS, LIQUID, SOLID, type PhaseId } from './units';

export interface Heater {
  readonly group: number;
  mode: HeaterMode;
  /** Leistung je Scheibentiefe (W). */
  power: number;
  /** Solltemperatur (K) im Thermostatbetrieb. */
  target: number;
  on: boolean;
  elements: number;
}

export interface ParticleInfo {
  readonly index: number;
  readonly uid: number;
  /** Keine Partikel: Umgebungsluft ohne Partikeln (der Rest gibt ihre Werte). */
  readonly implicit: boolean;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly phase: PhaseId;
  readonly fixed: boolean;
  readonly role: number;
  readonly T: number;
  readonly mass: number;
  readonly H: number;
  readonly rho: number;
  readonly p: number;
  readonly neighbours: number;
  readonly composition: readonly { readonly id: string; readonly name: string; readonly kg: number; readonly fraction: number }[];
}

export interface EngineStats {
  readonly time: number;
  readonly steps: number;
  readonly particles: number;
  readonly capacity: number;
  /** Bewegliche Partikeln je Phase und feste. */
  readonly solid: number;
  readonly liquid: number;
  readonly gas: number;
  readonly fixed: number;
  /** Luftpartikeln des Saums (der Rest der Luft hat keine Partikeln). */
  readonly air: number;
  /** Mittlere Zeit je Stufe (ms) über die letzten Schritte. */
  readonly stages: readonly number[];
  readonly overflow: number;
  readonly escapedMass: number;
  readonly spacing: number;
  readonly threads: number;
  /** Teilschritte im letzten Schritt (1–4, nach der Geschwindigkeit). */
  readonly substeps: number;
  readonly box: { readonly w: number; readonly h: number };
}

export interface EngineOptions {
  /** Wer die Kerne rechnet (ohne: ein Faden). */
  readonly runner?: Runner;
  /** Die Felder auf gemeinsamem Speicher anlegen (für Helfer). */
  readonly shared?: boolean;
  /** Luft nur im Saum um das, was zählt (Standard) — oder die ganze Kiste voll Luftpartikeln. */
  readonly airBand?: boolean;
}

/* -- Zahlen des Lösers (Modell, SIMPLIFICATIONS.md) --------------------------------------------------------------- */

export const TUNE = {
  /** Teilschritte je Schritt (kleine Schritte, je eine Iteration): mindestens KMIN bei 2 mm (gröber anteilig weniger, der Dichtefehler hängt an dt/s); bewegt sich eine Partikel schneller als CFL·h je Teilschritt, mehr — bis KMAX. */
  KMIN: 8,
  KMAX: 16,
  CFL: 0.4,
  /** PBF-Iterationen je Teilschritt. */
  ITERS: 1,
  /** Entspannung im Nenner von λ, relativ zum Gitter (0,4/s² ist Σ|∇C|² einer Partikel im Gitter). */
  EPS_REL: 0.01,
  /** Entspannung der Korrektur (Jacobi summiert die Korrekturen aller Bedingungen einer Partikel und schösse sonst über). */
  OMEGA: 0.5,
  /** XSPH je Teilschritt: Flüssigkeit, Gas (mit allem, auch an der ruhenden Umgebungsluft), an festen Wänden. Gas glättet stärker: leicht, wie es ist, nimmt es die Unruhe der Iterationen am meisten auf. */
  XSPH_LIQUID: 0.03,
  XSPH_GAS: 0.08,
  XSPH_WALL: 0.03,
  /** Glättung des angezeigten Drucks (s). */
  TAU_P: 0.05,
  /** Eichung der Kohäsion: die Paarkraft nach der Formel gibt die 16-fache Oberflächenspannung (Laplace-Druck einer Scheibe, 2–3 mm, Radius 8–12 mm; Prüfung `m1a`). */
  COH_CAL: 1 / 16,
  /** Aktiv (spannt den Saum auf) ist Luft, die wärmer oder kälter als die Umgebung ist (später auch: anders zusammengesetzt). */
  ACTIVE_DT: 0.5
};

const now = (): number => performance.now();

export class Engine implements BandHost {
  readonly dt = 1 / 240;
  private scene: Scene = EMPTY_SCENE;
  private ops: Op[] = [];
  private readonly runner: Runner;
  private readonly shared: boolean;
  private readonly airBand: boolean;

  /** Gitterweite, Glättungsradius, Ruhefläche einer Partikel (aus dem Gitter, kernkonsistent). */
  s = 0;
  h = 0;
  A0 = 0;
  depth = 0.01;
  /** Plätze des Innengitters und die wirksame Innengrösse der Kiste (m). */
  nx = 0;
  ny = 0;
  boxW = 0;
  boxH = 0;

  store: Store;
  grid: Grid;
  kern: Kernels = new Kernels(1);
  rng: Rng = new Rng(1);
  heaters: Heater[] = [];
  private P: Float64Array;
  private band: Band;

  time = 0;
  steps = 0;
  escapedMass = 0;
  /** Luft, die vom Saum in die Umgebung zurückging bzw. aus ihr kam (kg, J) — für die Bilanzen. */
  airOutMass = 0;
  airInMass = 0;
  airOutH = 0;
  airInH = 0;
  substeps = 1;
  /** Mittlere Zeit je Stufe (ms). */
  readonly stageMs = new Float64Array(STAGES.length);
  private readonly stageAcc = new Float64Array(STAGES.length);

  /** Fester Partikel je Platz des Gitters (−1: keiner) und ob dort Luft sein kann (in der Kiste, hinter einer offenen Seite). */
  private siteStatic = new Int32Array(0);
  private siteAir = new Uint8Array(0);
  private airSp = new Int32Array(0);
  private airW = new Float64Array(0);
  private airT = 293.15;

  constructor(scene: Scene = EMPTY_SCENE, options: EngineOptions = {}) {
    this.runner = options.runner ?? new SerialRunner();
    this.shared = options.shared === true;
    this.airBand = options.airBand !== false;
    const mem = new Mem(false);
    this.store = new Store(1, mem);
    this.grid = new Grid(1, 0, 0, 1, 1, 1, mem);
    this.P = mem.f64('params', PARAMS);
    this.band = new Band(1);
    this.load(scene);
  }

  /* -- Aufbau ------------------------------------------------------------------------------------------- */

  /** Eine Szene laden: Wände, die Handgriffe der Reihe nach, und um das, was zählt, ein Saum aus Luft. */
  load(scene: Scene): void {
    this.scene = scene;
    this.ops = [];
    const s = SPACING[scene.quality];
    this.s = s;
    this.h = 2 * s;
    this.depth = scene.box.depth;
    this.nx = Math.max(4, Math.round(scene.box.w / s));
    this.ny = Math.max(4, Math.round(scene.box.h / s));
    this.boxW = this.nx * s;
    this.boxH = this.ny * s;
    this.kern = new Kernels(this.h, 2);
    this.A0 = 1 / latticeSum(this.kern, s);
    const cap = (this.nx + 2 * MARGIN_SITES) * (this.ny + 2 * MARGIN_SITES) * 2;
    const mem = new Mem(this.shared);
    this.store = new Store(cap, mem);
    const margin = MARGIN_SITES * s;
    this.grid = new Grid(cap, -margin, -margin, this.boxW + 2 * margin, this.boxH + 2 * margin, s, mem);
    this.P = mem.f64('params', PARAMS);
    this.band = new Band(this.grid.nx * this.grid.ny);
    this.runner.bind(viewsOf(this.store, this.grid), this.P, mem.blocks);
    this.rng = new Rng(scene.seed);
    this.heaters = [];
    this.time = 0;
    this.steps = 0;
    this.escapedMass = 0;
    this.airOutMass = 0;
    this.airInMass = 0;
    this.airOutH = 0;
    this.airInH = 0;
    this.substeps = 1;
    this.stageMs.fill(0);
    const air = Object.entries(scene.ambient.air).map(([id, w]) => [spIndex(id), w] as const).filter(([sp]) => sp >= 0);
    this.airSp = Int32Array.from(air, ([sp]) => sp);
    this.airW = Float64Array.from(air, ([, w]) => w);
    this.airT = scene.ambient.T;
    this.sites();
    setSurfaceModel(this.h, this.depth, (sp) => liquidDensity(sp, this.airT), this.A0, TUNE.COH_CAL);
    this.setStatics();
    this.walls();
    if (this.airBand) this.band.reset(this.grid);
    else {
      this.band.none(this.grid, this.roomCells());
      this.forSites(null, true, (i, j, x, y) => { if (this.siteStatic[this.grid.siteOf(i, j)] < 0) this.spawnFluid(x, y, this.airSp, this.airW, GAS, this.airT, ORIGIN_AIR); });
    }
    for (const op of scene.ops) this.apply(op);
    this.settleBand();
  }

  /** Dieselbe Szene in einer anderen Auflösung (die Handgriffe bleiben). */
  setQuality(quality: Quality): void {
    this.load({ ...this.scene, quality, ops: this.ops.slice() });
  }

  /** Die Szene, wie sie gebaut wurde (JSON). */
  serialize(): Record<string, unknown> {
    return writeScene({ ...this.scene, ops: this.ops.slice() });
  }

  get quality(): Quality {
    return this.scene.quality;
  }

  get threads(): number {
    return this.runner.threads;
  }

  /** Einen Handgriff ausführen (und für das Speichern merken). */
  apply(op: Op): void {
    const T = 'T' in op ? op.T : this.airT;
    /* Das Gitter auf die jetzigen Orte: neue Partikeln dürfen keiner alten zu nahe kommen. */
    this.grid.build(this.store, false);
    switch (op.op) {
      case 'fill': {
        const comp = Object.entries(op.composition).map(([id, w]) => [spIndex(id), w] as const).filter(([sp]) => sp >= 0);
        if (comp.length === 0) return;
        const sp = Int32Array.from(comp, ([k]) => k);
        const w = Float64Array.from(comp, ([, v]) => v);
        this.removeIn(op.region, false);
        const phase = op.phase === 'gas' ? GAS : LIQUID;
        this.forSites(op.region, true, (i, j, x, y) => { if (this.free(i, j, x, y)) this.spawnFluid(x, y, sp, w, phase, op.T, ORIGIN_OP); });
        break;
      }
      case 'erase':
        this.removeIn(op.region, true);
        /* Wo der Saum ist, kommt Umgebungsluft auf die freien Plätze; sonst ist dort ohnehin Umgebung. */
        this.forSites(op.region, true, (i, j, x, y) => {
          const site = this.grid.siteOf(i, j);
          if (site >= 0 && this.grid.cellAir[this.grid.cellOfSite(site)] === 0 && this.free(i, j, x, y)) this.spawnFluid(x, y, this.airSp, this.airW, GAS, this.airT, ORIGIN_AIR);
        });
        break;
      case 'solid':
        this.solid(op.region, spIndex(op.material), T, 0, 0);
        break;
      case 'beaker':
        for (const part of beakerParts(op.x, op.y, op.w, op.h, op.wall, op.material, this.s)) this.solid(part.region, spIndex(part.material), T, part.role, 0);
        break;
      case 'hotplate': {
        const group = this.heaters.length + 1;
        let elements = 0;
        for (const part of hotplateParts(op.x, op.y, op.w, op.h, op.material, this.s)) {
          const n = this.solid(part.region, spIndex(part.material), T, part.role, group);
          if (part.role === 1) elements = n;
        }
        this.heaters.push({ group, mode: op.mode, power: op.power, target: op.target, on: op.on, elements });
        break;
      }
    }
    this.ops.push(op);
    this.settleBand();
  }

  /** Der Saum nach einem Aufbau: einordnen, Saum ziehen (die neuen Partikeln sind sofort von Luft umgeben). */
  private settleBand(): void {
    if (!this.airBand) return;
    this.grid.build(this.store, false);
    this.band.update(this);
  }

  /* -- Plätze ------------------------------------------------------------------------------------------------ */

  /** Wo Luft sein kann: in der Kiste und hinter offenen Seiten (der Raum); hinter Wänden nichts. */
  private sites(): void {
    const g = this.grid;
    const n = g.siteNx * g.siteNy;
    this.siteStatic = new Int32Array(n).fill(-1);
    this.siteAir = new Uint8Array(n);
    const sides = this.scene.sides;
    for (let b = 0; b < g.siteNy; b += 1) {
      const j = b - MARGIN_SITES;
      const rowOk = (j >= 0 && j < this.ny) || (j < 0 && sides.bottom === 'open') || (j >= this.ny && sides.top === 'open');
      for (let a = 0; a < g.siteNx; a += 1) {
        const i = a - MARGIN_SITES;
        const colOk = (i >= 0 && i < this.nx) || (i < 0 && sides.left === 'open') || (i >= this.nx && sides.right === 'open');
        this.siteAir[b * g.siteNx + a] = rowOk && colOk ? 1 : 0;
      }
    }
  }

  /** Zellen ganz ausserhalb der Kiste, in denen Luft sein kann (der Raum hinter offenen Seiten): 1. */
  private roomCells(): Uint8Array {
    const g = this.grid;
    const out = new Uint8Array(g.nx * g.ny);
    for (let c = 0; c < out.length; c += 1) {
      const cx = c % g.nx;
      const cy = (c - cx) / g.nx;
      let inside = false;
      let air = false;
      for (let b = 2 * cy; b < 2 * cy + 2; b += 1) {
        for (let a = 2 * cx; a < 2 * cx + 2; a += 1) {
          const i = a - MARGIN_SITES;
          const j = b - MARGIN_SITES;
          if (i >= 0 && i < this.nx && j >= 0 && j < this.ny) inside = true;
          if (this.siteAir[b * g.siteNx + a] === 1) air = true;
        }
      }
      out[c] = air && !inside ? 1 : 0;
    }
    return out;
  }

  /** `siteFree` aus `siteAir` und den festen Partikeln. */
  private setStatics(): void {
    const g = this.grid;
    for (let k = 0; k < this.siteAir.length; k += 1) g.siteFree[k] = this.siteAir[k] === 1 && this.siteStatic[k] < 0 ? 1 : 0;
  }

  /** Ein Gitterplatz ist frei: keine feste Partikel auf ihm, keine lebende näher als 0,6 s (nach dem letzten Einordnen). */
  private free(i: number, j: number, x: number, y: number): boolean {
    const site = this.grid.siteOf(i, j);
    if (site < 0 || this.siteStatic[site] >= 0) return false;
    return this.vacant(x, y, 1);
  }

  /** Keine lebende Partikel näher als 0,6 s an (x, y) — gesucht in (2r+1)² Zellen. */
  private vacant(x: number, y: number, r: number): boolean {
    const g = this.grid;
    const st = this.store;
    const r2 = (0.6 * this.s) ** 2;
    const c = g.cellIndex(x, y);
    const cx = c % g.nx;
    const cy = (c - cx) / g.nx;
    for (let gy = Math.max(0, cy - r); gy <= Math.min(g.ny - 1, cy + r); gy += 1) {
      for (let gx = Math.max(0, cx - r); gx <= Math.min(g.nx - 1, cx + r); gx += 1) {
        const cell = gy * g.nx + gx;
        for (let k = g.cellStart[cell]; k < g.cellStart[cell + 1]; k += 1) {
          const q = g.sorted[k];
          if (st.alive[q] === 1 && (st.x[q] - x) ** 2 + (st.y[q] - y) ** 2 < r2) return false;
        }
      }
    }
    return true;
  }

  /** Jeder Gitterplatz im Gebiet (ohne Gebiet: alle), nur innen oder auch in den Wandreihen. */
  private forSites(region: Region | null, interior: boolean, fn: (i: number, j: number, x: number, y: number) => void): void {
    const s = this.s;
    let iLo = interior ? 0 : -2;
    let iHi = interior ? this.nx - 1 : this.nx + 1;
    let jLo = interior ? 0 : -2;
    let jHi = interior ? this.ny - 1 : this.ny + 1;
    if (region !== null) {
      const [x0, y0, x1, y1] = regionBounds(region);
      iLo = Math.max(iLo, Math.floor(x0 / s - 0.5));
      iHi = Math.min(iHi, Math.ceil(x1 / s - 0.5));
      jLo = Math.max(jLo, Math.floor(y0 / s - 0.5));
      jHi = Math.min(jHi, Math.ceil(y1 / s - 0.5));
    }
    for (let j = jLo; j <= jHi; j += 1) {
      for (let i = iLo; i <= iHi; i += 1) {
        const x = (i + 0.5) * s;
        const y = (j + 0.5) * s;
        if (region === null || inRegion(region, x, y)) fn(i, j, x, y);
      }
    }
  }

  /** Die Wände der Kiste: zwei Reihen fester Partikeln (Glas) an jeder Seite, die keine offene ist. */
  private walls(): void {
    const sides = this.scene.sides;
    const glass = spIndex('glass');
    for (let j = -2; j <= this.ny + 1; j += 1) {
      for (let i = -2; i <= this.nx + 1; i += 1) {
        const left = i < 0;
        const right = i >= this.nx;
        const bottom = j < 0;
        const top = j >= this.ny;
        if (!left && !right && !bottom && !top) continue;
        const wall = (left && sides.left === 'wall') || (right && sides.right === 'wall') || (bottom && sides.bottom === 'wall') || (top && sides.top === 'wall');
        if (wall) this.spawnStatic(i, j, glass, this.airT, 0, 0, ORIGIN_WALL);
      }
    }
  }

  /** Feste Partikeln eines Werkstoffes im Gebiet (was dort war, weicht). Gibt die Zahl zurück. */
  private solid(region: Region, sp: number, T: number, role: number, group: number): number {
    if (sp < 0) return 0;
    this.removeIn(region, false);
    let n = 0;
    this.forSites(region, false, (i, j) => { if (this.spawnStatic(i, j, sp, T, role, group, ORIGIN_OP) >= 0) n += 1; });
    return n;
  }

  /** Alle Partikeln im Gebiet entfernen (feste nur mit `fixedToo`). */
  private removeIn(region: Region, fixedToo: boolean): void {
    const st = this.store;
    for (let i = 0; i < st.highWater; i += 1) {
      if (st.alive[i] === 0) continue;
      if (st.fixed[i] === 1 && !fixedToo) continue;
      if (!inRegion(region, st.x[i], st.y[i])) continue;
      if (st.fixed[i] === 1) {
        const site = this.grid.siteOf(Math.round(st.x[i] / this.s - 0.5), Math.round(st.y[i] / this.s - 0.5));
        if (site >= 0 && this.siteStatic[site] === i) { this.siteStatic[site] = -1; this.grid.siteFree[site] = this.siteAir[site]; }
      } else if (st.origin[i] === ORIGIN_AIR) {
        this.bookAirOut(i);
      }
      st.kill(i);
    }
  }

  private spawnStatic(i: number, j: number, sp: number, T: number, role: number, group: number, origin: number): number {
    const st = this.store;
    const site = this.grid.siteOf(i, j);
    if (site < 0) return -1;
    const old = this.siteStatic[site];
    if (old >= 0) st.kill(old);
    this.siteStatic[site] = -1;
    const p = st.spawn();
    if (p < 0) return -1;
    const x = (i + 0.5) * this.s;
    const y = (j + 0.5) * this.s;
    st.x[p] = x; st.px[p] = x; st.qx[p] = x; st.ox[p] = x;
    st.y[p] = y; st.py[p] = y; st.qy[p] = y; st.oy[p] = y;
    st.fixed[p] = 1;
    st.phase[p] = SOLID;
    st.role[p] = role;
    st.group[p] = group;
    st.origin[p] = origin;
    const rho = solidDensity(sp);
    st.addSpecies(p, sp, rho * this.s * this.s * this.depth);
    st.H[p] = enthalpy(sp, SOLID, T);
    st.T[p] = T;
    st.rho[p] = rho;
    st.wInv[p] = 0;
    st.area[p] = this.A0;
    st.p[p] = this.scene.ambient.p;
    this.siteStatic[site] = p;
    this.grid.siteFree[site] = 0;
    return p;
  }

  /** Eine bewegliche Partikel einer Zusammensetzung (Massenanteile `w` der Stoffe `sp`) in einer Phase bei T. */
  private spawnFluid(x: number, y: number, sp: Int32Array, w: Float64Array, phase: PhaseId, T: number, origin: number): number {
    const st = this.store;
    const p = st.spawn();
    if (p < 0) return -1;
    st.x[p] = x; st.px[p] = x; st.qx[p] = x; st.ox[p] = x;
    st.y[p] = y; st.py[p] = y; st.qy[p] = y; st.oy[p] = y;
    st.phase[p] = phase;
    st.origin[p] = origin;
    const vol = this.s * this.s * this.depth;
    let rho: number;
    let solverMass: number;
    if (phase === LIQUID) {
      rho = liquidDensity(sp[0], T);
      solverMass = rho * vol;
    } else {
      let inv = 0;
      for (let k = 0; k < sp.length; k += 1) inv += MOLAR[sp[k]] > 0 ? w[k] / MOLAR[sp[k]] : 0;
      rho = gasDensity(inv > 0 ? 1 / inv : 0.029, T, this.scene.ambient.p);
      solverMass = mappedGasDensity(rho) * vol;
    }
    const mass = rho * vol;
    let H = 0;
    for (let k = 0; k < sp.length && k < SLOTS; k += 1) {
      st.addSpecies(p, sp[k], mass * w[k]);
      H += w[k] * enthalpy(sp[k], phase, T);
    }
    st.H[p] = H;
    st.T[p] = T;
    st.rho[p] = rho;
    st.wInv[p] = 1 / solverMass;
    st.area[p] = this.A0;
    st.p[p] = this.scene.ambient.p;
    return p;
  }

  /* -- Der Saum der Luft (BandHost) -------------------------------------------------------------------------- */

  /**
   * Was den Saum aufspannt: jede Flüssigkeit, jedes Gemalte, jedes Gas, das
   * nicht Umgebungsluft ist — und Luft oder Aparatura, die wärmer oder kälter
   * als die Umgebung ist (eine Zlewka bei Raumtemperatur braucht keine Luft
   * um sich; eine heisse Platte schon).
   */
  isActive(i: number): boolean {
    const st = this.store;
    if (st.alive[i] === 0) return false;
    if (st.fixed[i] === 0 && st.origin[i] !== ORIGIN_AIR) return true;
    return Math.abs(st.T[i] - this.airT) > TUNE.ACTIVE_DT;
  }

  isPlainAir(i: number): boolean {
    const st = this.store;
    return st.alive[i] === 1 && st.fixed[i] === 0 && st.origin[i] === ORIGIN_AIR && !this.isActive(i);
  }

  spawnAir(site: number): number {
    const g = this.grid;
    const a = site % g.siteNx;
    const b = (site - a) / g.siteNx;
    const p = this.spawnFluid(g.x0 + (a + 0.5) * this.s, g.y0 + (b + 0.5) * this.s, this.airSp, this.airW, GAS, this.airT, ORIGIN_AIR);
    if (p >= 0) { this.airInMass += this.store.mass[p]; this.airInH += this.store.mass[p] * this.store.H[p]; }
    return p;
  }

  returnAir(i: number): void {
    this.bookAirOut(i);
    this.store.kill(i);
  }

  siteVacant(site: number): boolean {
    const g = this.grid;
    const a = site % g.siteNx;
    const b = (site - a) / g.siteNx;
    return this.vacant(g.x0 + (a + 0.5) * this.s, g.y0 + (b + 0.5) * this.s, 2);
  }

  private bookAirOut(i: number): void {
    const st = this.store;
    this.airOutMass += st.mass[i];
    this.airOutH += st.mass[i] * st.H[i];
  }

  /* -- Der Schritt ------------------------------------------------------------------------------------------------ */

  /** Die festen Zahlen der Kerne (nach dem Laden und bei jedem Schritt, weil sich dt mit den Teilschritten ändert). */
  private params(dts: number): void {
    const P = this.P;
    const g = this.grid;
    const h = this.h;
    P[P_DT] = dts;
    P[P_H] = h;
    P[P_H2] = h * h;
    P[P_KS] = this.kern.ks;
    P[P_KD] = this.kern.kd;
    P[P_W0] = this.kern.w0;
    P[P_GX] = 0;
    P[P_GY] = -this.scene.ambient.g;
    P[P_EPS] = (TUNE.EPS_REL * 0.4) / (this.s * this.s);
    P[P_S] = this.s;
    P[P_A0] = this.A0;
    P[P_X0] = g.x0;
    P[P_Y0] = g.y0;
    P[P_GNX] = g.nx;
    P[P_GNY] = g.ny;
    P[P_SNX] = g.siteNx;
    P[P_VMAX] = (TUNE.KMAX * TUNE.CFL * h) / this.dt;
    P[P_DEPTH] = this.depth;
    P[P_PAMB] = this.scene.ambient.p;
    P[P_PALPHA] = Math.min(1, dts / TUNE.TAU_P);
    P[P_OMEGA] = TUNE.OMEGA;
    P[P_PSCALE] = 1 / pressureScale(this.kern, this.s, this.A0);
    P[P_XSPH_L] = TUNE.XSPH_LIQUID;
    P[P_XSPH_G] = TUNE.XSPH_GAS;
    P[P_XSPH_W] = TUNE.XSPH_WALL;
  }

  step(): void {
    const st = this.store;
    const g = this.grid;
    const P = this.P;
    const run = this.runner;
    const acc = this.stageAcc;
    acc.fill(0);
    let t = now();

    /* Wie schnell ist die schnellste Partikel (nach der Schwere dieses Schritts)? Danach die Teilschritte. */
    const gy = this.scene.ambient.g * this.dt;
    let v2 = 0;
    for (let i = 0; i < st.highWater; i += 1) {
      if (st.alive[i] === 0 || st.fixed[i] === 1) continue;
      const vy = Math.abs(st.vy[i]) + gy;
      const u = st.vx[i] * st.vx[i] + vy * vy;
      if (u > v2) v2 = u;
    }
    const kmin = Math.max(4, Math.ceil((TUNE.KMIN * 0.002) / this.s - 1e-9));
    const k = Math.min(TUNE.KMAX, Math.max(kmin, Math.ceil((Math.sqrt(v2) * this.dt) / (TUNE.CFL * this.h))));
    this.substeps = k;
    const iters = Math.max(1, TUNE.ITERS);
    this.params(this.dt / k);

    /* 1 Schwere, Orte vorhersagen (die weiteren Teilschritte sagt das Ende des vorigen vorher). */
    P[P_FIRST] = 1;
    P[P_TOP] = st.highWater;
    run.run(JOB_PREDICT);
    t = this.lap(0, t);

    for (let sub = 0; sub < k; sub += 1) {
      /* 2 Einordnen (die Zellen haben die Kerne beim Vorhersagen ausgerechnet); die Suche der Nachbarn ist zugleich die erste Iteration (Stufe 3). */
      g.sort(st);
      P[P_N] = g.nMove;
      t = this.lap(1, t);

      /* 3 Dichte nach PBF: Suche + λ, Korrektur von px nach qx, weitere Iterationen abwechselnd. */
      run.run(JOB_SEARCH);
      P[P_SRC] = 0;
      P[P_SMOOTH] = 1;
      run.run(JOB_DELTA);
      P[P_SMOOTH] = 0;
      let src = 1;
      for (let it = 1; it < iters; it += 1) {
        P[P_SRC] = src;
        run.run(JOB_LAMBDA);
        run.run(JOB_DELTA);
        src = 1 - src;
      }
      t = this.lap(2, t);

      /* 4 Geschwindigkeit aus den Orten, Druck — und gleich die Vorhersage des nächsten Teilschritts. */
      P[P_FIN] = src;
      P[P_NEXT] = sub + 1 < k ? 1 : 0;
      run.run(JOB_ENDSUB);
      t = this.lap(3, t);
    }


    /* 5 Wärme (M1b), 6 Phasenwechsel (M1c), 7 Chemie (später) — noch leer. */
    t = this.lap(4, t);
    t = this.lap(5, t);
    t = this.lap(6, t);

    /* 8 Wer die Welt verlässt, entweicht; der Saum der Luft folgt dem, was zählt. */
    this.leave();
    if (this.airBand) this.band.update(this);
    t = this.lap(7, t);

    /* 9 Bilanzen (M1b). */
    t = this.lap(8, t);
    void t;

    for (let s = 0; s < acc.length; s += 1) this.stageMs[s] = this.stageMs[s] * 0.95 + acc[s] * 0.05;
    this.time += this.dt;
    this.steps += 1;
  }

  /** Die Zeit einer Stufe zählen — eine Methode, keine Closure: der Schritt legt nichts an. */
  private lap(k: number, t: number): number {
    const n = now();
    this.stageAcc[k] += n - t;
    return n;
  }

  /** So viele Schritte, wie `seconds` brauchen (für Prüfungen und kopflose Läufe). */
  advance(seconds: number): void {
    const n = Math.round(seconds / this.dt);
    for (let k = 0; k < n; k += 1) this.step();
  }

  /** Partikeln ausserhalb des Gitters sind fort: Stoffe als entwichen gezählt, ruhende Luft zurück in die Umgebung. */
  private leave(): void {
    const st = this.store;
    const g = this.grid;
    const x0 = g.x0;
    const y0 = g.y0;
    const x1 = g.x0 + g.nx * g.cell;
    const y1 = g.y0 + g.ny * g.cell;
    for (let k = 0; k < g.n; k += 1) {
      const i = g.sorted[k];
      if (st.alive[i] === 0 || st.fixed[i] === 1) continue;
      const x = st.x[i];
      const y = st.y[i];
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) continue;
      if (st.origin[i] === ORIGIN_AIR) this.bookAirOut(i);
      else this.escapedMass += st.mass[i];
      st.kill(i);
    }
  }

  /* -- Abfragen ------------------------------------------------------------------------------------------------- */

  /** Die Partikel am nächsten bei (x, y), höchstens 1,5 s entfernt — oder die Umgebungsluft ohne Partikeln dort. */
  query(x: number, y: number): ParticleInfo | null {
    const st = this.store;
    let best = -1;
    let bd = (1.5 * this.s) ** 2;
    for (let i = 0; i < st.highWater; i += 1) {
      if (st.alive[i] === 0) continue;
      const d = (st.x[i] - x) ** 2 + (st.y[i] - y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    if (best < 0) return this.ambientAt(x, y);
    const i = best;
    const comp: { id: string; name: string; kg: number; fraction: number }[] = [];
    for (let k = 0; k < SLOTS; k += 1) {
      const sp = st.spc[i * SLOTS + k] - 1;
      if (sp < 0) continue;
      const kg = st.smass[i * SLOTS + k];
      comp.push({ id: SPECIES[sp].id, name: phaseName(sp, st.phase[i] as PhaseId), kg, fraction: st.mass[i] > 0 ? kg / st.mass[i] : 0 });
    }
    return {
      index: i, uid: st.uid[i], implicit: false, x: st.x[i], y: st.y[i], vx: st.vx[i], vy: st.vy[i], phase: st.phase[i] as PhaseId, fixed: st.fixed[i] === 1,
      role: st.role[i], T: st.T[i], mass: st.mass[i], H: st.H[i], rho: st.rho[i], p: st.p[i], neighbours: st.nbr[i], composition: comp
    };
  }

  /** Umgebungsluft ohne Partikeln an (x, y), wenn dort welche ist. */
  private ambientAt(x: number, y: number): ParticleInfo | null {
    const g = this.grid;
    const site = g.siteOf(Math.floor(x / this.s), Math.floor(y / this.s));
    if (site < 0 || this.siteAir[site] !== 1 || this.siteStatic[site] >= 0) return null;
    if (g.cellAir[g.cellOfSite(site)] !== 1) return null;
    let inv = 0;
    for (let k = 0; k < this.airSp.length; k += 1) inv += MOLAR[this.airSp[k]] > 0 ? this.airW[k] / MOLAR[this.airSp[k]] : 0;
    const rho = gasDensity(inv > 0 ? 1 / inv : 0.029, this.airT, this.scene.ambient.p);
    let H = 0;
    const comp: { id: string; name: string; kg: number; fraction: number }[] = [];
    for (let k = 0; k < this.airSp.length; k += 1) {
      const sp = this.airSp[k];
      H += this.airW[k] * enthalpy(sp, GAS, this.airT);
      comp.push({ id: SPECIES[sp].id, name: phaseName(sp, GAS), kg: 0, fraction: this.airW[k] });
    }
    return {
      index: -1, uid: 0, implicit: true, x, y, vx: 0, vy: 0, phase: GAS, fixed: false, role: 0, T: this.airT, mass: 0, H, rho,
      p: this.scene.ambient.p, neighbours: 0, composition: comp
    };
  }

  stats(): EngineStats {
    const st = this.store;
    let solid = 0;
    let liquid = 0;
    let gas = 0;
    let fixed = 0;
    let air = 0;
    let overflow = 0;
    for (let i = 0; i < st.highWater; i += 1) {
      if (st.alive[i] === 0) continue;
      if (st.fixed[i] === 1) { fixed += 1; continue; }
      const p = st.phase[i];
      if (p === SOLID) solid += 1; else if (p === LIQUID) liquid += 1; else gas += 1;
      if (st.origin[i] === ORIGIN_AIR) air += 1;
      if (this.grid.nbrCount[i] >= MAX_NBR) overflow += 1;
    }
    return {
      time: this.time, steps: this.steps, particles: st.count, capacity: st.cap, solid, liquid, gas, fixed, air,
      stages: Array.from(this.stageMs), overflow, escapedMass: this.escapedMass, spacing: this.s, threads: this.runner.threads,
      substeps: this.substeps, box: { w: this.boxW, h: this.boxH }
    };
  }

  /** Masse eines Stoffes in allen lebenden Partikeln (kg) — für Bilanzen und Prüfungen. */
  totalMass(sp: number): number {
    const st = this.store;
    let m = 0;
    for (let i = 0; i < st.highWater; i += 1) if (st.alive[i] === 1) m += st.massOf(i, sp);
    return m;
  }
}
