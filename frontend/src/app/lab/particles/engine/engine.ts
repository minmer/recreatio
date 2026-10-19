/**
 * PARTIKEL-LABOR — DIE ENGINE: ein Speicher, ein Nachbargitter, eine
 * Schrittschleife. Befehle (malen, löschen, Festkörper, Geräte) kommen
 * zwischen den Teilschritten; jeder Teilschritt (dt = 1/240 s) führt jede
 * Partikel durch dieselbe Folge, und jede Stufe wird gemessen:
 *
 * <code>
 *   1 forces       Schwere → Geschwindigkeit, Orte vorhersagen (feste Partikeln bleiben)
 *   2 grid         Nachbargitter neu, Nachbarlisten
 *   3 constraints  Zwangsbedingungen (M0: Abstand halten; M1a: Dichte nach PBF)
 *   4 velocity     Geschwindigkeit aus den korrigierten Orten (M1a: Viskosität, Kohäsion)
 *   5 heat         Wärmeleitung, Heizung, Verluste (M1b)
 *   6 phaseChange  Keime, Verdampfen, Kondensieren, Teilen (M1c)
 *   7 chemistry    Haken für die Chemie (leer in M1)
 *   8 boundary     wer die Welt verlässt, entweicht (M1c: offene Seiten, frische Luft)
 *   9 diagnostics  Bilanzen, Messfühler
 * </code>
 *
 * Keine Allokation in der Schleife, kein Math.random (der Zufall `rng` gehört
 * zum Zustand): derselbe Samen und dieselben Befehle ergeben denselben Lauf.
 */

import { Grid, MAX_NBR } from './grid';
import { Kernels, latticeSum } from './kernels';
import { Rng } from './rng';
import { EMPTY_SCENE, SPACING, writeScene, type HeaterMode, type Op, type Quality, type Scene } from './scene';
import { beakerParts, hotplateParts, inRegion, regionBounds, type Region } from './shapes';
import { SPECIES, enthalpy, gasDensity, liquidDensity, mappedGasDensity, MOLAR, phaseName, solidDensity, spIndex } from './species';
import { STAGES } from './stages';
import { SLOTS, Store } from './store';
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
  /** Mittlere Zeit je Stufe (ms) über die letzten Teilschritte. */
  readonly stages: readonly number[];
  readonly overflow: number;
  readonly escapedMass: number;
  readonly spacing: number;
  readonly box: { readonly w: number; readonly h: number };
}

const now = (): number => performance.now();

export class Engine {
  readonly dt = 1 / 240;
  private scene: Scene = EMPTY_SCENE;
  private ops: Op[] = [];

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

  store: Store = new Store(1);
  grid: Grid = new Grid(1, 0, 0, 1, 1, 1);
  kern: Kernels = new Kernels(1);
  rng: Rng = new Rng(1);
  heaters: Heater[] = [];

  time = 0;
  steps = 0;
  escapedMass = 0;
  /** Mittlere Zeit je Stufe (ms). */
  readonly stageMs = new Float64Array(STAGES.length);

  /** Fester Partikel je Gitterplatz (−1: keiner) — Wände und Geräte stehen auf dem Gitter. */
  private siteStatic = new Int32Array(0);
  private airSp = new Int32Array(0);
  private airW = new Float64Array(0);

  constructor(scene: Scene = EMPTY_SCENE) {
    this.load(scene);
  }

  /* -- Aufbau ------------------------------------------------------------------------------------------- */

  /** Eine Szene laden: eine Kiste voll Umgebungsluft, dann ihre Handgriffe der Reihe nach. */
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
    this.kern = new Kernels(this.h);
    this.A0 = 1 / latticeSum(this.kern, s);
    const cap = (this.nx + 4) * (this.ny + 4) * 2;
    if (this.store.cap !== cap) {
      this.store = new Store(cap);
    } else this.store.reset();
    const margin = 2 * this.h + 2 * s;
    this.grid = new Grid(cap, -margin, -margin, this.boxW + 2 * margin, this.boxH + 2 * margin, this.h);
    this.siteStatic = new Int32Array((this.nx + 4) * (this.ny + 4)).fill(-1);
    this.rng = new Rng(scene.seed);
    this.heaters = [];
    this.time = 0;
    this.steps = 0;
    this.escapedMass = 0;
    this.stageMs.fill(0);
    const air = Object.entries(scene.ambient.air).map(([id, w]) => [spIndex(id), w] as const).filter(([sp]) => sp >= 0);
    this.airSp = Int32Array.from(air, ([sp]) => sp);
    this.airW = Float64Array.from(air, ([, w]) => w);
    this.walls();
    this.forSites(null, true, (i, j, x, y) => { if (this.siteStatic[this.siteIndex(i, j)] < 0) this.spawnFluid(x, y, this.airSp, this.airW, GAS, scene.ambient.T); });
    for (const op of scene.ops) this.apply(op);
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

  /** Einen Handgriff ausführen (und für das Speichern merken). */
  apply(op: Op): void {
    const T = 'T' in op ? op.T : this.scene.ambient.T;
    /* Das Gitter auf die jetzigen Orte: neue Partikeln dürfen keiner alten zu nahe kommen (die Alten sind vom Gitter fortgewandert). */
    this.grid.build(this.store, false);
    switch (op.op) {
      case 'fill': {
        const comp = Object.entries(op.composition).map(([id, w]) => [spIndex(id), w] as const).filter(([sp]) => sp >= 0);
        if (comp.length === 0) return;
        const sp = Int32Array.from(comp, ([k]) => k);
        const w = Float64Array.from(comp, ([, v]) => v);
        this.removeIn(op.region, false);
        const phase = op.phase === 'gas' ? GAS : LIQUID;
        this.forSites(op.region, true, (i, j, x, y) => { if (this.free(i, j, x, y)) this.spawnFluid(x, y, sp, w, phase, op.T); });
        break;
      }
      case 'erase':
        this.removeIn(op.region, true);
        this.forSites(op.region, true, (i, j, x, y) => { if (this.free(i, j, x, y)) this.spawnFluid(x, y, this.airSp, this.airW, GAS, this.scene.ambient.T); });
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
  }

  /* -- Das Gitter der Plätze ------------------------------------------------------------------------------- */

  /** Ein Gitterplatz ist frei: keine feste Partikel auf ihm, keine lebende näher als 0,6 s (nach dem letzten Einordnen). */
  private free(i: number, j: number, x: number, y: number): boolean {
    if (this.siteStatic[this.siteIndex(i, j)] >= 0) return false;
    const g = this.grid;
    const st = this.store;
    const r2 = (0.6 * this.s) ** 2;
    const c = g.cellIndex(x, y);
    const cx = c % g.nx;
    const cy = (c - cx) / g.nx;
    for (let gy = Math.max(0, cy - 1); gy <= Math.min(g.ny - 1, cy + 1); gy += 1) {
      for (let gx = Math.max(0, cx - 1); gx <= Math.min(g.nx - 1, cx + 1); gx += 1) {
        const cell = gy * g.nx + gx;
        for (let k = g.cellStart[cell]; k < g.cellStart[cell + 1]; k += 1) {
          const q = g.sorted[k];
          if (st.alive[q] === 1 && (st.x[q] - x) ** 2 + (st.y[q] - y) ** 2 < r2) return false;
        }
      }
    }
    return true;
  }

  private siteIndex(i: number, j: number): number {
    return i + 2 + (j + 2) * (this.nx + 4);
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
        if (wall) this.spawnStatic(i, j, glass, this.scene.ambient.T, 0, 0);
      }
    }
  }

  /** Feste Partikeln eines Werkstoffes im Gebiet (was dort war, weicht). Gibt die Zahl zurück. */
  private solid(region: Region, sp: number, T: number, role: number, group: number): number {
    if (sp < 0) return 0;
    this.removeIn(region, false);
    let n = 0;
    this.forSites(region, false, (i, j) => { if (this.spawnStatic(i, j, sp, T, role, group) >= 0) n += 1; });
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
        const k = this.siteIndex(Math.round(st.x[i] / this.s - 0.5), Math.round(st.y[i] / this.s - 0.5));
        if (this.siteStatic[k] === i) this.siteStatic[k] = -1;
      }
      st.kill(i);
    }
  }

  private spawnStatic(i: number, j: number, sp: number, T: number, role: number, group: number): number {
    const st = this.store;
    const k = this.siteIndex(i, j);
    const old = this.siteStatic[k];
    if (old >= 0) st.kill(old);
    this.siteStatic[k] = -1;
    const p = st.spawn();
    if (p < 0) return -1;
    const x = (i + 0.5) * this.s;
    const y = (j + 0.5) * this.s;
    st.x[p] = x; st.px[p] = x; st.ox[p] = x;
    st.y[p] = y; st.py[p] = y; st.oy[p] = y;
    st.fixed[p] = 1;
    st.phase[p] = SOLID;
    st.role[p] = role;
    st.group[p] = group;
    const rho = solidDensity(sp);
    st.addSpecies(p, sp, rho * this.s * this.s * this.depth);
    st.H[p] = enthalpy(sp, SOLID, T);
    st.T[p] = T;
    st.rho[p] = rho;
    st.wInv[p] = 0;
    st.area[p] = this.A0;
    this.siteStatic[k] = p;
    return p;
  }

  /** Eine bewegliche Partikel einer Zusammensetzung (Massenanteile `w` der Stoffe `sp`) in einer Phase bei T. */
  private spawnFluid(x: number, y: number, sp: Int32Array, w: Float64Array, phase: PhaseId, T: number): number {
    const st = this.store;
    const p = st.spawn();
    if (p < 0) return -1;
    st.x[p] = x; st.px[p] = x; st.ox[p] = x;
    st.y[p] = y; st.py[p] = y; st.oy[p] = y;
    st.phase[p] = phase;
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
    return p;
  }

  /* -- Der Teilschritt ---------------------------------------------------------------------------------------- */

  step(): void {
    const st = this.store;
    const dt = this.dt;
    let t = now();

    /* 1 Schwere, Orte vorhersagen. */
    const gy = -this.scene.ambient.g * dt;
    const top = st.highWater;
    for (let i = 0; i < top; i += 1) {
      if (st.alive[i] === 0) continue;
      st.ox[i] = st.x[i];
      st.oy[i] = st.y[i];
      if (st.fixed[i] === 1) { st.px[i] = st.x[i]; st.py[i] = st.y[i]; continue; }
      st.vy[i] += gy;
      st.px[i] = st.x[i] + st.vx[i] * dt;
      st.py[i] = st.y[i] + st.vy[i] * dt;
    }
    t = this.lap(0, t);

    /* 2 Nachbarn. */
    this.grid.build(st, true);
    this.grid.neighbours(st, this.h, true);
    t = this.lap(1, t);

    /* 3 Zwangsbedingungen — M0: Abstand halten (wird in M1a durch die Dichte nach PBF ersetzt). */
    this.keepApart(3);
    t = this.lap(2, t);

    /* 4 Geschwindigkeit aus den korrigierten Orten. */
    const inv = 1 / dt;
    const g = this.grid;
    for (let k = 0; k < g.n; k += 1) {
      const i = g.sorted[k];
      if (st.fixed[i] === 1) continue;
      let vx = (st.px[i] - st.x[i]) * inv;
      let vy = (st.py[i] - st.y[i]) * inv;
      /* M0-Sicherheitsnetz: höchstens 3 m/s (freier Fall aus 45 cm) — Projektionen dürfen keine Energie einbringen. */
      const v2 = vx * vx + vy * vy;
      if (v2 > 9) { const f = 3 / Math.sqrt(v2); vx *= f; vy *= f; }
      st.vx[i] = vx;
      st.vy[i] = vy;
      st.x[i] = st.px[i];
      st.y[i] = st.py[i];
    }
    t = this.lap(3, t);

    /* 5 Wärme (M1b), 6 Phasenwechsel (M1c), 7 Chemie (später) — noch leer. */
    t = this.lap(4, t);
    t = this.lap(5, t);
    t = this.lap(6, t);

    /* 8 Wer die Welt verlässt, entweicht (M1c: offene Seiten mit frischer Luft). */
    this.leave();
    t = this.lap(7, t);

    /* 9 Bilanzen (M1b). */
    t = this.lap(8, t);

    this.time += dt;
    this.steps += 1;
  }

  /** Die Zeit einer Stufe (gleitendes Mittel) — eine Methode, keine Closure: der Schritt legt nichts an. */
  private lap(k: number, t: number): number {
    const n = now();
    this.stageMs[k] = this.stageMs[k] * 0.95 + (n - t) * 0.05;
    return n;
  }

  /** So viele Teilschritte, wie `seconds` brauchen (für Prüfungen und kopflose Läufe). */
  advance(seconds: number): void {
    const n = Math.round(seconds / this.dt);
    for (let k = 0; k < n; k += 1) this.step();
  }

  /**
   * M0-Platzhalter für Stufe 3: eine Partikel, die einer anderen näher als s
   * kommt, weicht ihr ganz aus — Gauss-Seidel in der Reihenfolge der Zellen,
   * also von unten nach oben: was weiter unten liegt, trägt (wie die
   * „shock propagation” bei Stapeln). Kein Fluid: kein Druck, kein Auftrieb,
   * keine Masse — das kommt mit der Dichte nach PBF (M1a).
   */
  private keepApart(iterations: number): void {
    const g = this.grid;
    for (let it = 0; it < iterations; it += 1) {
      for (let k = 0; k < g.n; k += 1) {
        const i = g.sorted[k];
        if (this.store.wInv[i] === 0) continue;
        /* Zuerst den beweglichen Nachbarn ausweichen, zuletzt den festen: Wände gewinnen immer. */
        this.yield(i, false);
        this.yield(i, true);
      }
    }
  }

  /** Eine Partikel aus allen Nachbarn einer Art (fest oder beweglich) herausschieben, die näher als s sind. */
  private yield(i: number, fixed: boolean): void {
    const st = this.store;
    const g = this.grid;
    /* Ein Spielraum von 0,1 %: Nachbarn, die sich gerade berühren, schieben nicht (sonst wachsen Rundungsfehler zu Bewegung). */
    const s = this.s * 0.999;
    const s2 = s * s;
    const base = i * MAX_NBR;
    const cnt = g.nbrCount[i];
    for (let q = 0; q < cnt; q += 1) {
      const j = g.nbrList[base + q];
      if ((st.fixed[j] === 1) !== fixed) continue;
      /* Bewegliche Nachbarn: nur denen ausweichen, die in diesem Durchgang schon dran waren (weiter unten) — die oberen weichen später selbst. */
      if (!fixed && g.rank[j] > g.rank[i]) continue;
      let rx = st.px[i] - st.px[j];
      let ry = st.py[i] - st.py[j];
      let d2 = rx * rx + ry * ry;
      if (d2 >= s2) continue;
      if (d2 < 1e-18) {
        /* Genau übereinander: eine feste, vom Index abhängige Richtung (kein Zufall nötig). */
        const a = ((i * 2.399963) % (2 * Math.PI)) + (j > i ? Math.PI : 0);
        rx = Math.cos(a) * 1e-6;
        ry = Math.sin(a) * 1e-6;
        d2 = 1e-12;
      }
      const d = Math.sqrt(d2);
      const c = (s - d) / d;
      st.px[i] += rx * c;
      st.py[i] += ry * c;
    }
  }

  /** Partikeln ausserhalb des Gitters sind fort (ihre Masse wird als entwichen gezählt). */
  private leave(): void {
    const st = this.store;
    const g = this.grid;
    const x0 = g.x0;
    const y0 = g.y0;
    const x1 = g.x0 + g.nx * g.cell;
    const y1 = g.y0 + g.ny * g.cell;
    for (let k = 0; k < g.n; k += 1) {
      const i = g.sorted[k];
      if (st.fixed[i] === 1) continue;
      const x = st.x[i];
      const y = st.y[i];
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) continue;
      this.escapedMass += st.mass[i];
      st.kill(i);
    }
  }

  /* -- Abfragen ------------------------------------------------------------------------------------------------- */

  /** Die Partikel am nächsten bei (x, y), höchstens 1,5 s entfernt. */
  query(x: number, y: number): ParticleInfo | null {
    const st = this.store;
    let best = -1;
    let bd = (1.5 * this.s) ** 2;
    for (let i = 0; i < st.highWater; i += 1) {
      if (st.alive[i] === 0) continue;
      const d = (st.x[i] - x) ** 2 + (st.y[i] - y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    if (best < 0) return null;
    const i = best;
    const comp: { id: string; name: string; kg: number; fraction: number }[] = [];
    for (let k = 0; k < SLOTS; k += 1) {
      const sp = st.spc[i * SLOTS + k] - 1;
      if (sp < 0) continue;
      const kg = st.smass[i * SLOTS + k];
      comp.push({ id: SPECIES[sp].id, name: phaseName(sp, st.phase[i] as PhaseId), kg, fraction: st.mass[i] > 0 ? kg / st.mass[i] : 0 });
    }
    return {
      index: i, uid: st.uid[i], x: st.x[i], y: st.y[i], vx: st.vx[i], vy: st.vy[i], phase: st.phase[i] as PhaseId, fixed: st.fixed[i] === 1,
      role: st.role[i], T: st.T[i], mass: st.mass[i], H: st.H[i], rho: st.rho[i], p: st.p[i], neighbours: st.nbr[i], composition: comp
    };
  }

  stats(): EngineStats {
    const st = this.store;
    let solid = 0;
    let liquid = 0;
    let gas = 0;
    let fixed = 0;
    for (let i = 0; i < st.highWater; i += 1) {
      if (st.alive[i] === 0) continue;
      if (st.fixed[i] === 1) { fixed += 1; continue; }
      const p = st.phase[i];
      if (p === SOLID) solid += 1; else if (p === LIQUID) liquid += 1; else gas += 1;
    }
    return {
      time: this.time, steps: this.steps, particles: st.count, capacity: st.cap, solid, liquid, gas, fixed,
      stages: Array.from(this.stageMs), overflow: this.grid.overflow, escapedMass: this.escapedMass, spacing: this.s,
      box: { w: this.boxW, h: this.boxH }
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
