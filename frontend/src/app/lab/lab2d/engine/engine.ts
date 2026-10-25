/**
 * LABOR 2D (v2) — DIE ENGINE: eine Welt, eine Schleife (Prompt v2, Prinzip 1).
 * Ein Gitter, ein Teilchenspeicher, ein Objektspeicher, und für jede Szene
 * derselbe Schritt:
 *
 *   1. Eingaben       Werkzeuge, Heizleistung, Umgebung
 *   2. Flüssigkeit    Teilchen → Gitter, Volumenanteile, Kräfte, Quellen,
 *                     Projektion mit freier Oberfläche, Gitter → Teilchen,
 *                     Transport, Driftausgleich
 *   3. Gas            Transport der Massen und der Enthalpie, MacCormack,
 *                     Auftrieb, Quellen (Niedrig-Mach), Projektion
 *   4. Blasen         Keimbildung, Wachsen, Ablösen, Bewegung, Verschmelzen,
 *                     Platzen (M1c)
 *   5. Grenzfläche    Verdunsten, Entspannungsverdampfen, Nebel, Tau (M1c)
 *   6. Wärme          implizite Leitung über alle Zellen, latente Wärme als Quelle
 *   7. Chemie         leer in M1
 *   8. Ränder         offene Seiten, Bilanzen, Sonden, Zeitmessung
 *   9. Körper         Kräfte der Flüssigkeit, Berührungen, neue Lagen (M3a;
 *                     ins Gitter geschrieben werden die wachen Körper zu
 *                     Beginn des nächsten Schritts, mit den Eingaben)
 *
 * Δt = min(1/120 s, Δx/u_max der Flüssigkeit). Nichts in der Schleife legt
 * Speicher an; der einzige Zufall ist der Generator mit Samen (Teil des
 * Zustands) — derselbe Samen, dieselben Befehle, derselbe Lauf.
 */

import { Bodies } from './bodies';
import { BodyMelt } from './bodyMelt';
import { BubbleModel } from './bubbleModel';
import { Extremes, type ExtremeStats } from './extremes';
import { Bubbles } from './bubbles';
import { emptyFlows, emptySnapshot, measure, type BudgetSnapshot, type Flows } from './budget';
import { applyOp, type EditLedger, type World } from './edits';
import { objectKey } from './objects';
import { Exchange } from './exchange';
import { surfaceAfterFill } from './fillCheck';
import { Gas } from './gas';
import { GrainFlow } from './grainFlow';
import { Grains } from './grains';
import { GrainSalt } from './grainSalt';
import { Grid } from './grid';
import { Heat, type Heater } from './heat';
import { pSat } from './if97';
import { Liquid } from './liquid';
import { AIR_N2, AIR_O2, MOLAR, WATER } from './materials';
import { Particles } from './particles';
import { Phase } from './phase';
import { liquidsAt, probe } from './probe';
import { Regions } from './regions';
import { Rng } from './rng';
import { Salt } from './salt';
import { CELL, freshId, isObjectOp, MAX_CELLS, readScene, writeScene, type ExtremeMode, type HeaterMode, type Op, type Quality, type ReadOptions, type Scene, type Side, type SideName } from './scene';
import { GridSolver } from './solver';
import { STAGE_COUNT } from './stages';
import { GAS, GAS_SPECIES, H2O, LIQUID, N2, O2, R_GAS, SPECIES_SLOTS } from './units';

export interface EngineOptions extends ReadOptions {
  /** Relatives Residuum der Druckprojektionen (Prompt v2: 1e-5 in Echtzeit, 1e-8 in Tests). */
  readonly tol?: number;
  readonly maxIter?: number;
  /** Keine Verluste an Wandseiten (Prüfstand: „isoliert“). */
  readonly insulated?: boolean;
  /** Längster Schritt (s); sonst 1/120 s (Prompt v2). Prüfstand: kürzer, um Zeitpunkte genau zu treffen. */
  readonly dtMax?: number;
}

export interface SolverInfo {
  iterations: number;
  residual: number;
  capped: boolean;
}

export interface EngineStats {
  time: number;
  dt: number;
  steps: number;
  nx: number;
  ny: number;
  dx: number;
  quality: Quality;
  particles: number;
  capacity: number;
  bubbles: number;
  liquidCells: number;
  gasCells: number;
  /** Zeit je Stufe (ms, gleitendes Mittel) und je Schritt. */
  stages: number[];
  stepMs: number;
  liquid: SolverInfo;
  gas: SolverInfo;
  heat: SolverInfo;
  gasSubsteps: number;
  /** Wie oft eine Höchstzahl an Iterationen erreicht wurde (seit dem Start). */
  capped: number;
  /** Mittlere Wassertemperatur (K, massengewichtet), höchste, Wassermasse. */
  waterT: number;
  waterTmax: number;
  /** Andere Flüssigkeiten (Öl): Masse (kg) und mittlere Temperatur (K, 0 ohne). */
  otherMass: number;
  otherT: number;
  /** Kochsalz (M2b): gelöst in den Teilchen und ausgefallen (Kruste, Boden der Kiste) (kg). */
  saltMass: number;
  saltSolid: number;
  /** Körper (M3a): alle, freie, wache. */
  bodies: { count: number; free: number; awake: number };
  heaters: { group: number; P: number; Tmean: number; mode: HeaterMode; power: number; target: number; on: boolean }[];
  /** Druck p0 je Gebiet (Pa), verschlossen? */
  regions: { p0: number; sealed: boolean; vGas: number }[];
  budget: BudgetSnapshot;
  flows: Flows;
  /** Abweichung der Energiebilanz (J), der Wasserbilanz, der Bilanz der anderen Flüssigkeiten und des Salzes (kg) seit dem Start. */
  energyError: number;
  waterError: number;
  otherError: number;
  saltError: number;
  /** Erzeugter Dampf (kg/s, gleitendes Mittel) und (P − Verluste)/h_lv als Vergleich. */
  vapourRate: number;
  ambientT: number;
  ambientP: number;
  g: number;
  /** Heftige Zustände (extremes.ts): Art der Rechnung, anstehende Frage, grösste Blase, schnellstes Teilchen, was gemildert wurde. */
  extremes: ExtremeStats;
  /** Braucht die Szene den normalen Weg (needsCpu)? Dann bietet die Oberfläche die beschleunigte Ansicht nicht an. */
  cpuOnly: boolean;
}

/** Was der Inspektor an einem Punkt sieht. */
export interface ProbeInfo {
  x: number;
  y: number;
  cell: {
    kind: 'solid' | 'liquid' | 'gas';
    material: string | null;
    T: number;
    /** Absoluter Druck (Pa) und die Siedetemperatur dort (K). */
    p: number;
    Tsat: number;
    /** Gas: Molenbrüche N₂, O₂, H₂O; relative Feuchte; Nebel (kg/m³); Dichte (kg/m³). */
    x: number[];
    rh: number;
    fog: number;
    rho: number;
    phi: number;
    u: number;
    v: number;
    heater: boolean;
    film: number;
    /** Salzkruste eines Feststoffs (kg). */
    crust: number;
    /** Die Flüssigkeiten der Zelle mit ihrem Massenanteil (leer ohne Flüssigkeit). */
    liquids: { id: string; share: number }[];
    /** Lösung in der Zelle: Massenanteil des Salzes, Molalität (mol/kg), Siedepunkt beim Druck dort und Gefrierpunkt (K); null ohne Salz. */
    salt: { w: number; molality: number; Tb: number; Tf: number } | null;
  };
  /** Das nächste Teilchen; salt: Massenanteil des gelösten Salzes (0: reine Flüssigkeit). */
  particle: { id: number; T: number; vx: number; vy: number; mass: number; rho: number; dist: number; liquid: string; salt: number } | null;
  bubble: { id: number; r: number; T: number; pb: number; pv: number; Tsat: number; mv: number; ma: number; vx: number; vy: number; dmdt: number; attached: boolean; force: number[] } | null;
  /** Der Körper an diesem Punkt (M3a): der Name seines Gegenstands, sein häufigster Werkstoff, Masse (kg), mittlere Temperatur (K), Geschwindigkeit (m/s), Drehung (rad, rad/s), Zustand. */
  body: { index: number; id: string; material: string; mass: number; T: number; vx: number; vy: number; angle: number; w: number; state: 'pinned' | 'asleep' | 'moving' } | null;
}

const DT_MAX = 1 / 120;

export class Engine {
  scene: Scene;
  private readonly options: EngineOptions;
  readonly warnings: string[] = [];
  /* -- Speicher und Module (je Szene neu) -- */
  grid!: Grid;
  particles!: Particles;
  bubbles!: Bubbles;
  liquid!: Liquid;
  gas!: Gas;
  regions!: Regions;
  heat!: Heat;
  bubbleModel!: BubbleModel;
  phase!: Phase;
  salt!: Salt;
  /** Körner (M3c): ihre Teilchen, ihr Kontinuum auf dem Gitter, Lösen und Wachsen. */
  grains!: Grains;
  grainFlow!: GrainFlow;
  grainSalt!: GrainSalt;
  exchange!: Exchange;
  bodies!: Bodies;
  melt!: BodyMelt;
  solver!: GridSolver;
  readonly extremes = new Extremes(this);
  private prevKind!: Uint8Array;
  private p0Start: Float64Array = new Float64Array(8);
  rng!: Rng;
  /* -- Zeit -- */
  time = 0;
  steps = 0;
  dt = DT_MAX;
  /* -- Umgebung -- */
  gy = 9.81;
  readonly ambientY = new Float64Array(SPECIES_SLOTS);
  ambientT = 293.15;
  pRef = 101325;
  /* -- Bilanzen -- */
  readonly ledger: EditLedger = { water: 0, air: 0, energy: 0, other: 0, salt: 0 };
  flows: Flows = emptyFlows();
  private readonly snap: BudgetSnapshot = emptySnapshot();
  private energy0 = 0;
  private water0 = 0;
  private other0 = 0;
  private salt0 = 0;
  private cappedCount = 0;
  private vapourRate = 0;
  private vapourLast = 0;
  /* -- Zeitmessung -- */
  readonly timings = new Float64Array(STAGE_COUNT);
  private readonly stamp = new Float64Array(STAGE_COUNT + 1);
  stepMs = 0;
  private quality: Quality = 'high';
  private readonly heaterOps = new Map<number, number>();
  /** Werden gerade die Schritte der Szene aufgebaut (dann wecken Handgriffe keine Körper)? */
  private building = false;

  constructor(raw: Scene | unknown, options: EngineOptions = {}) {
    this.options = options;
    const scene = isScene(raw) ? raw : readScene(raw, options).scene;
    this.scene = { ...scene, ops: [] };
    this.build(scene);
  }

  get tol(): number { return this.options.tol ?? 1e-5; }
  get dtMax(): number { return this.options.dtMax ?? DT_MAX; }
  get maxIter(): number { return this.options.maxIter ?? 60; }
  get dx(): number { return this.grid.dx; }
  get boxW(): number { return this.grid.w; }
  get boxH(): number { return this.grid.h; }
  get currentQuality(): Quality { return this.quality; }
  /** Die Bezugswerte der Bilanzen (Energie und Wasser beim Aufbau) — für die Kennzahlen des beschleunigten Wegs (gpu/). */
  get baseline(): { readonly energy0: number; readonly water0: number } { return { energy0: this.energy0, water0: this.water0 }; }
  get optionsUsed(): EngineOptions { return this.options; }

  /* -- Aufbau ---------------------------------------------------------------------------------------- */

  private build(scene: Scene): void {
    let dx = CELL[scene.quality];
    this.quality = scene.quality;
    let nx = Math.max(4, Math.round(scene.box.w / dx));
    let ny = Math.max(4, Math.round(scene.box.h / dx));
    while (nx * ny > MAX_CELLS) {
      dx *= 1.25;
      nx = Math.max(4, Math.round(scene.box.w / dx));
      ny = Math.max(4, Math.round(scene.box.h / dx));
      this.warnings.push(`too many cells for "${scene.quality}", using ${(dx * 1000).toFixed(2)} mm`);
    }
    const grid = new Grid(nx, ny, dx, scene.box.depth);
    grid.openL = scene.sides.left === 'open';
    grid.openR = scene.sides.right === 'open';
    grid.openB = scene.sides.bottom === 'open';
    grid.openT = scene.sides.top === 'open';
    this.grid = grid;
    this.particles = new Particles(Math.max(4096, 4 * grid.n + 1024));
    this.bubbles = new Bubbles(4096);
    this.solver = new GridSolver(nx, ny);
    this.regions = new Regions(grid);
    this.liquid = new Liquid(grid, this.particles, this.solver);
    this.gas = new Gas(grid, this.regions, this.solver);
    this.heat = new Heat(grid, this.particles, this.liquid, this.gas, this.solver);
    this.bubbleModel = new BubbleModel(this);
    this.phase = new Phase(this);
    this.salt = new Salt(this);
    this.grains = new Grains(Math.max(1024, 4 * grid.n));
    this.grainFlow = new GrainFlow(this);
    this.grainSalt = new GrainSalt(this);
    this.exchange = new Exchange(this);
    this.bodies = new Bodies(this);
    this.regions.freeAt = (o) => { const b = this.bodies.list[o - 1]; return b !== undefined && b.free; };
    this.heat.bodies = this.bodies.list;
    this.heat.grains = this.grains;
    this.melt = new BodyMelt(this);
    this.bodies.afterCollect = () => { this.melt.step(); };
    this.liquid.bodyHit = (x0, y0, x, y, out) => this.bodies.hitPoint(x0, y0, x, y, out);
    this.liquid.afterSolve = (S, i0, j0, dt) => this.bodies.probe(S, i0, j0, dt);
    this.prevKind = new Uint8Array(grid.n);
    this.rng = new Rng(scene.seed);
    this.time = 0;
    this.steps = 0;
    this.dt = this.dtMax;
    this.ledger.water = 0;
    this.ledger.air = 0;
    this.ledger.energy = 0;
    this.ledger.other = 0;
    this.ledger.salt = 0;
    this.flows = emptyFlows();
    this.heaterOps.clear();
    this.extremes.reset();
    this.setAmbientState(scene.ambient.p, scene.ambient.T, scene.ambient.rh, scene.ambient.g, scene.ambient.air.N2, scene.ambient.air.O2);
    if (this.options.insulated === true) this.heat.hExt = 0;
    /* Die leere Kiste voll Umgebungsluft. */
    grid.updateStatic();
    this.regions.label();
    for (let r = 0; r < this.regions.count; r += 1) { this.regions.p0[r] = this.pRef; this.regions.rhoBar[r] = this.regions.rhoAmb; }
    for (let c = 0; c < grid.n; c += 1) {
      grid.kind[c] = GAS;
      this.gas.fillCell(c, this.ambientT, this.ambientY);
    }
    this.bubbleModel.rebuildSites();
    this.building = true;
    for (const op of scene.ops) this.apply(op);
    this.building = false;
    this.settle();
    /* Freie Körper schlafen; wer nichts berührt, fällt gleich. */
    this.bodies.settleStart();
    this.ledger.water = 0;
    this.ledger.air = 0;
    this.ledger.energy = 0;
    this.ledger.other = 0;
    this.ledger.salt = 0;
    this.measureBudget();
    this.energy0 = this.snap.energy;
    this.water0 = this.snap.water.total;
    this.other0 = this.snap.other.total;
    this.salt0 = this.snap.salt.total;
  }

  /** Nach Aufbau und Werkzeugen: Gewichte, Volumenanteile, Arten und abgeleitete Grössen ohne Zeitschritt bestimmen. */
  private settle(): void {
    const { grid, liquid } = this;
    liquid.computeWeights();
    liquid.splatVolume();
    this.grainFlow.splatVolume();
    liquid.classify();
    this.prevKind.set(grid.kind);
    this.regions.update(this.particles, this.bubbles);
    this.gas.deriveAll();
    liquid.computeHeatWeights();
    for (let c = 0; c < grid.n; c += 1) if (grid.solid[c] !== 0 || grid.capB[c] > 0) this.heat.deriveSolid(c);
    this.heat.countHeaters();
  }

  /** Umgebung: Druck (Pa), Temperatur (K), relative Feuchte, Schwerkraft, trockene Luft (Massenanteile). */
  private setAmbientState(p: number, T: number, rh: number, g: number, yN2: number, yO2: number): void {
    this.pRef = p;
    this.ambientT = T;
    this.gy = g;
    const dry = yN2 + yO2 > 0 ? yN2 + yO2 : 1;
    const n2 = (yN2 > 0 ? yN2 : AIR_N2) / dry;
    const o2 = (yO2 > 0 || yN2 > 0 ? yO2 : AIR_O2) / dry;
    const mDry = 1 / (n2 / MOLAR[N2] + o2 / MOLAR[O2]);
    const xv = Math.min(0.99, (rh * pSat(T)) / p);
    const yv = (xv * MOLAR[H2O]) / (xv * MOLAR[H2O] + (1 - xv) * mDry);
    this.ambientY.fill(0);
    this.ambientY[N2] = (1 - yv) * n2;
    this.ambientY[O2] = (1 - yv) * o2;
    this.ambientY[H2O] = yv;
    let inv = 0;
    for (let k = 0; k < GAS_SPECIES; k += 1) inv += this.ambientY[k] / MOLAR[k];
    this.regions.pAmb = p;
    this.regions.rhoAmb = p / (R_GAS * T * inv);
    this.regions.gy = g;
    this.gas.setAmbient(T, p, this.ambientY);
    this.heat.ambientT = T;
  }

  /** Die Welt für die Handgriffe. */
  private world(): World {
    return {
      grid: this.grid,
      particles: this.particles,
      bubbles: this.bubbles,
      gas: this.gas,
      heat: this.heat,
      liquid: this.liquid,
      grains: this.grains,
      ambientY: this.ambientY,
      ambientT: this.ambientT,
      ledger: this.ledger,
      bodies: this.bodies,
      opIndex: this.scene.ops.length,
      objectKey: (id: string) => objectKey(this, id),
      solidsChanged: () => this.solidsChanged()
    };
  }

  private solidsChanged(): void {
    /* Ein fester Bau änderte sich: die Körper neu in die Zellen (ein Bau nimmt keinen Körper auf), dann alles Feste. */
    this.bodies.reweigh();
    this.grid.updateStatic();
    this.regions.label();
    for (let r = 0; r < this.regions.count; r += 1) if (this.regions.open[r] !== 0) this.regions.p0[r] = this.pRef;
    this.bubbleModel.rebuildSites();
    this.liquid.weightsDirty = true;
    this.bodies.changed();
  }

  /* -- Befehle --------------------------------------------------------------------------------------- */

  /** Einen Handgriff ausführen (Szene und Werkzeuge). Liefert eine Warnung oder null; eine Flüssigkeit ohne freie Oberfläche wird abgelehnt. */
  apply(given: Op): string | null {
    /* Ein Gegenstand ohne Namen oder mit einem schon vergebenen bekommt einen neuen. */
    const op: Op = isObjectOp(given) && (given.id === '' || objectKey(this, given.id) >= 0) ? { ...given, id: freshId(this.scene.ops, given.op) } : given;
    if (op.op === 'fill' && op.phase === 'liquid' && !surfaceAfterFill(this, op)) {
      return 'refused: the liquid would have no free surface (no pressure law for a region filled with liquid in M1)';
    }
    /*
     * Ein Handgriff kann Gebiete verschliessen, öffnen oder ihr Volumen ändern:
     * dann springt der Anteil −p0·V der Bilanz (U statt H) — ein Eingriff,
     * kein Fluss; er wird gebucht.
     */
    const pv0 = this.regions.pvTerm();
    const warning = applyOp(this.world(), op);
    this.bodies.sync();
    if (op.op === 'hotplate') this.heaterOps.set(this.heat.heaters.length - 1, this.scene.ops.length);
    this.scene = { ...this.scene, ops: [...this.scene.ops, op] };
    this.settle();
    this.ledger.energy += this.regions.pvTerm() - pv0;
    /* Nach einem Werkzeug wachen die freien Körper auf (vielleicht fehlt ihnen der Halt); sie schlafen bald wieder ein. */
    if (!this.building) this.bodies.wakeFree();
    if (warning !== null) this.warnings.push(warning);
    return warning;
  }

  setHeater(group: number, mode: HeaterMode, power: number, target: number, on: boolean): void {
    const h = this.heat.heaters[group];
    if (h === undefined) return;
    h.mode = mode;
    h.power = Math.max(0, power);
    h.target = target;
    h.on = on;
    const at = this.heaterOps.get(group);
    const op = at === undefined ? undefined : this.scene.ops[at];
    if (at !== undefined && op !== undefined && op.op === 'hotplate') {
      const ops = [...this.scene.ops];
      ops[at] = { ...op, mode, power: h.power, target, on };
      this.scene = { ...this.scene, ops };
    }
  }

  /** Umgebung zur Laufzeit: Druck (Pa), Temperatur (K), Feuchte (0–1), Schwerkraft (m/s²). */
  /** Umgebung: Druck (Pa), Temperatur (K), relative Feuchte, Schwerkraft, wahlweise die trockene Luft (Massenanteile) — sie kommt durch offene Seiten herein; das Gas in der Kiste behält seine. */
  setAmbient(p: number, T: number, rh: number, g: number, air?: { readonly N2: number; readonly O2: number }): void {
    const gg = this.options.harness === true ? g : Math.min(2 * 9.80665, Math.max(0.25 * 9.80665, g));
    const dry = air !== undefined && air.N2 >= 0 && air.O2 >= 0 && air.N2 + air.O2 > 0 ? { N2: air.N2 / (air.N2 + air.O2), O2: air.O2 / (air.N2 + air.O2) } : this.scene.ambient.air;
    this.scene = { ...this.scene, ambient: { ...this.scene.ambient, p, T, rh, g: gg, air: dry } };
    this.setAmbientState(p, T, rh, gg, dry.N2, dry.O2);
  }

  setBoundary(side: SideName, value: Side): void {
    /* Eine Seite zu- oder aufmachen verschliesst oder öffnet Gebiete: der Sprung von −p0·V wird gebucht (siehe apply). */
    const pv0 = this.regions.pvTerm();
    this.scene = { ...this.scene, sides: { ...this.scene.sides, [side]: value } };
    const g = this.grid;
    if (side === 'left') g.openL = value === 'open';
    if (side === 'right') g.openR = value === 'open';
    if (side === 'bottom') g.openB = value === 'open';
    if (side === 'top') g.openT = value === 'open';
    this.solidsChanged();
    this.settle();
    this.ledger.energy += this.regions.pvTerm() - pv0;
  }

  /** Die Szene, wie sie jetzt aufgebaut ist (Anfangsaufbau plus Handgriffe), als JSON. */
  serialize(): Record<string, unknown> {
    return writeScene({ ...this.scene, quality: this.quality, seed: this.scene.seed });
  }

  /** Neu laden (eine Szene oder dieselbe in einer anderen Auflösung). */
  load(raw: Scene | unknown): void {
    const scene = isScene(raw) ? raw : readScene(raw, this.options).scene;
    this.scene = { ...scene, ops: [] };
    this.build(scene);
  }

  /** Wie heftige Zustände gerechnet werden (extremes.ts) — jederzeit, ohne neu aufzubauen; eine beantwortete Frage kommt nicht wieder. */
  setExtremes(mode: ExtremeMode): void {
    this.scene = { ...this.scene, extremes: mode };
    this.extremes.pending = null;
  }

  setQuality(q: Quality): void {
    const scene = readScene(this.serialize(), this.options).scene;
    this.load({ ...scene, quality: q });
  }

  /* -- Der Schritt ----------------------------------------------------------------------------------- */

  step(): void {
    const { grid, liquid, gas, regions, heat, particles, bubbles } = this;
    const dt = this.dt;
    const stamp = this.stamp;
    stamp[0] = now();
    /* 1. Eingaben: Werkzeuge kommen zwischen den Schritten (apply); die Heizleistung regelt Stufe 6. Die wachen Körper
       ins Gitter (M3a); füllen oder leeren sie Zellen eines verschlossenen Gebiets, ist der Sprung von −p0·V ihre Arbeit. */
    const pvBodies = regions.pvTerm();
    if (this.bodies.prepare()) {
      regions.update(particles, bubbles);
      this.flows.bodyWork += regions.pvTerm() - pvBodies;
    }
    stamp[1] = now();

    /* 2. Flüssigkeit (die Körner nehmen ihr Platz weg), dann die Körner (M3c) mit ihrer Geschwindigkeit. */
    this.grainFlow.splatVolume();
    liquid.splatVolumeChange(dt);
    if (liquid.weightsDirty) liquid.computeWeights();
    liquid.splatVolume();
    this.prevKind.set(grid.kind);
    liquid.classify(this.prevKind);
    gas.transitions(this.prevKind);
    regions.update(particles, bubbles);
    if (this.p0Start.length < regions.count) this.p0Start = new Float64Array(2 * regions.count);
    for (let r = 0; r < regions.count; r += 1) this.p0Start[r] = regions.p0[r];
    for (let c = 0; c < grid.n; c += 1) liquid.pGas[c] = grid.kind[c] === GAS ? regions.pAt(c) - this.pRef : 0;
    liquid.step(dt, this.gy, this.tol, this.maxIter);
    liquid.computeHeatWeights();
    this.flows.escapedWater += liquid.last.escapedMass;
    this.flows.escapedOther += liquid.last.escapedOther;
    this.flows.escapedSalt += liquid.last.escapedSalt;
    this.flows.escapedEnergy += liquid.last.escapedEnergy;
    this.grainFlow.step(dt);
    stamp[2] = now();

    /* 3. Gas: φ hat sich geändert — Volumina und Dichten neu (T bleibt). */
    gas.updateVolumes();
    gas.markFaces();
    const esc0 = gas.escaped[H2O] + gas.escaped[GAS_SPECIES];
    const escAir0 = gas.escaped[N2] + gas.escaped[O2];
    const escH0 = gas.escaped[GAS_SPECIES + 1];
    gas.transport(dt);
    this.flows.escapedWater += gas.escaped[H2O] + gas.escaped[GAS_SPECIES] - esc0;
    this.flows.escapedAir += gas.escaped[N2] + gas.escaped[O2] - escAir0;
    this.flows.escapedEnergy += gas.escaped[GAS_SPECIES + 1] - escH0;
    gas.updateEos();
    gas.veosMid.set(gas.veos);
    gas.velocity(dt, this.gy);
    gas.sources(dt);
    gas.project(dt, this.tol, this.maxIter);
    stamp[3] = now();

    /* 4. Blasen. */
    this.bubbleModel.step(dt);
    stamp[4] = now();

    /* 5. Grenzfläche und Phasenwechsel im Gas; übersättigte Lösungen geben Kristalle ab (M2b). */
    this.phase.step(dt);
    this.salt.step();
    /* Körner lösen sich, nehmen die Temperatur ihrer Zelle an, setzen Blasen frei (M3c). */
    this.grainSalt.step(dt);
    stamp[5] = now();

    /* 6. Wärme. */
    /* Die Bilanz der Wärme ist für jede Toleranz genau (Flüsse aus den gelösten Temperaturen); 1e-6 relativ zum Wärmestrom genügt. */
    heat.step(dt, 1e-6, 200);
    /* Innerhalb jeder Zelle gleichen ihre Teilchen Wärme und Salz aus, so schnell wie die Diffusion über die Zelle (M2b). */
    this.exchange.step(dt);
    this.flows.heater += heat.last.heater;
    this.flows.lossWalls += heat.last.lossWalls;
    this.flows.lossOpen += heat.last.lossOpen;
    stamp[6] = now();

    /* 7. Chemie: in M1 leer (M2: jede Zelle ein durchmischter Reaktor). */
    stamp[7] = now();

    /* 8. Ränder und Diagnose: verschlossene Gebiete (p0 und Kompressionswärme), Quellen fürs nächste Mal, Bilanzen. */
    regions.update(particles, bubbles);
    gas.compressionHeating(this.p0Start);
    this.pressureWork();
    gas.updateEos();
    for (let c = 0; c < grid.n; c += 1) gas.srcV[c] = grid.kind[c] === GAS ? gas.veos[c] - gas.veosMid[c] : 0;
    if (liquid.last.solve.capped) this.cappedCount += 1;
    if (gas.last.solve.capped) this.cappedCount += 1;
    if (heat.last.solve.capped) this.cappedCount += 1;
    this.extremes.afterStep();
    this.time += dt;
    this.steps += 1;
    stamp[8] = now();

    /* 9. Körper (M3a): Kräfte, Berührungen, neue Lagen. Kein Punkt eines Körpers rückt mehr als eine halbe Zelle je Schritt. */
    this.bodies.finish(dt);
    this.dt = Math.min(this.dtMax, liquid.last.uMax > 0 ? (0.9 * grid.dx) / liquid.last.uMax : this.dtMax, this.bodies.dtLimit(), this.grainFlow.dtLimit());
    stamp[9] = now();
    /* Zeiten: gleitendes Mittel über etwa 30 Schritte. */
    const a = this.steps < 5 ? 1 : 1 / 30;
    for (let s = 0; s < STAGE_COUNT; s += 1) this.timings[s] += a * (stamp[s + 1] - stamp[s] - this.timings[s]);
    this.stepMs += a * (stamp[STAGE_COUNT] - stamp[0] - this.stepMs);
  }

  /**
   * In verschlossenen Gebieten bekommt jede Phase dH = V dp0, nicht nur das
   * Gas: Teilchen und Blasen ihren Anteil V Δp0 (die Enthalpie hängt in der
   * Schliessung nur von T ab — die Flüssigkeit wird dadurch um Δp0/(ρ c_p),
   * 0,02 K je bar, wärmer; SIMPLIFICATIONS.md #12). So gilt mit
   * U = H − p0 V_Fluid genau dU = δQ.
   */
  private pressureWork(): void {
    const { grid, regions, particles: P, bubbles: B, gas, liquid } = this;
    let any = false;
    for (let r = 0; r < regions.count; r += 1) if (gas.dp0[r] !== 0) any = true;
    if (!any) return;
    for (let p = 0; p < P.count; p += 1) {
      const c = grid.cellAt(P.x[p], P.y[p]);
      const r = c < 0 ? -1 : regions.id[c];
      if (r < 0 || gas.dp0[r] === 0) continue;
      const m = P.mass[p];
      const before = m / P.rho[p];
      P.h[p] += (before * gas.dp0[r]) / m;
      P.derive(p);
      liquid.dVp[p] += m / P.rho[p] - before;
    }
    for (let b = 0; b < B.count; b += 1) {
      const c = grid.cellAt(B.x[b], B.y[b]);
      const r = c < 0 ? -1 : regions.id[c];
      if (r >= 0 && gas.dp0[r] !== 0) B.H[b] += B.V[b] * gas.dp0[r];
    }
  }

  /** Die Bilanzen jetzt zählen. */
  measureBudget(): BudgetSnapshot {
    const f = this.flows;
    f.editEnergy = this.ledger.energy;
    f.editWater = this.ledger.water;
    f.editAir = this.ledger.air;
    f.editOther = this.ledger.other;
    f.editSalt = this.ledger.salt;
    return measure(this.grid, this.particles, this.bubbles, this.regions, this.flows, this.snap, this.salt.floorTotals(), this.bodies.list, this.melt.pendingTotals(), this.grains.totals());
  }

  /** Abweichung der Energiebilanz seit dem Start (J): ΔE − (Heizung − Verluste − Entwichenes + Eingriffe). */
  energyError(): number {
    const s = this.measureBudget();
    const f = this.flows;
    return s.energy - this.energy0 - (f.heater - f.lossWalls - f.lossOpen - f.escapedEnergy + f.editEnergy + f.bodyWork);
  }

  /** Abweichung der Wasserbilanz seit dem Start (kg): das Entwichene ist im Gesamtwert schon enthalten. */
  waterError(): number {
    const s = this.measureBudget();
    return s.water.total - this.water0 - this.flows.editWater;
  }

  /** Abweichung der Bilanz der anderen Flüssigkeiten (Öl) seit dem Start (kg) — sie verdampfen nicht, ihre Masse bleibt genau. */
  otherError(): number {
    const s = this.measureBudget();
    return s.other.total - this.other0 - this.flows.editOther;
  }

  /** Braucht die Szene den normalen Weg? Freie Körper (M3a) und Eis, das schmilzt oder wächst (M3b), kennt der beschleunigte Weg noch nicht (andere Flüssigkeiten und Salz seit 2026-10-24). */
  needsCpu(): boolean {
    return this.bodies.anyFree || this.melt.any() || this.grains.count > 0;
  }

  /** Abweichung der Salzbilanz seit dem Start (kg): gelöst + Kruste + Boden + entwichen gegen den Anfang und die Eingriffe. */
  saltError(): number {
    const s = this.measureBudget();
    return s.salt.total - this.salt0 - this.flows.editSalt;
  }

  /** Die Bezugswerte so setzen, dass die Bilanzen jetzt genau diese Abweichungen zeigen (ein Schlüsselbild beim Backen mit der GPU trägt deren Abweichungen, nicht die der Treppen; B). */
  rebaseline(err: { readonly energy: number; readonly water: number; readonly other: number; readonly salt: number }): void {
    const s = this.measureBudget();
    const f = this.flows;
    this.energy0 = s.energy - (f.heater - f.lossWalls - f.lossOpen - f.escapedEnergy + f.editEnergy + f.bodyWork) - err.energy;
    this.water0 = s.water.total - f.editWater - err.water;
    this.other0 = s.other.total - f.editOther - err.other;
    this.salt0 = s.salt.total - f.editSalt - err.salt;
  }

  /* -- Fragen ---------------------------------------------------------------------------------------- */

  /** Mittlere Wassertemperatur (massengewichtet, K), höchste und Masse. */
  waterTemperature(): { mean: number; max: number; mass: number } {
    const P = this.particles;
    let m = 0;
    let mt = 0;
    let max = 0;
    for (let p = 0; p < P.count; p += 1) {
      if (P.mat[p] !== WATER) continue;
      m += P.mass[p];
      mt += P.mass[p] * P.T[p];
      if (P.T[p] > max) max = P.T[p];
    }
    return { mean: m > 0 ? mt / m : 0, max, mass: m };
  }

  /** Mittlere Temperatur (K) und Masse der anderen Flüssigkeiten (Öl). */
  otherTemperature(): { mean: number; mass: number } {
    const P = this.particles;
    let m = 0;
    let mt = 0;
    for (let p = 0; p < P.count; p += 1) {
      if (P.mat[p] === WATER) continue;
      m += P.mass[p];
      mt += P.mass[p] * P.T[p];
    }
    return { mean: m > 0 ? mt / m : 0, mass: m };
  }

  /** Absoluter Druck in Zelle c (Pa). */
  pressureAt(c: number): number {
    const g = this.grid;
    if (g.kind[c] === LIQUID) return this.pRef + g.pl[c];
    if (g.kind[c] === GAS) return this.regions.pAt(c) + g.pg[c];
    return this.regions.pAt(c);
  }

  /** Was der Inspektor an (x, y) sieht (probe.ts). */
  query(x: number, y: number): ProbeInfo | null {
    return probe(this, x, y);
  }

  /** Die Flüssigkeiten einer Zelle mit ihrem Massenanteil — aus den Teilchen, deren Wärmegewicht in die Zelle fällt. */
  liquidsAt(c: number): { id: string; share: number }[] {
    return liquidsAt(this, c);
  }

  stats(): EngineStats {
    const g = this.grid;
    let liquidCells = 0;
    let gasCells = 0;
    for (let c = 0; c < g.n; c += 1) { if (g.kind[c] === LIQUID) liquidCells += 1; else if (g.kind[c] === GAS) gasCells += 1; }
    const wt = this.waterTemperature();
    const ot = this.otherTemperature();
    const budget = this.measureBudget();
    const f = this.flows;
    const energyError = budget.energy - this.energy0 - (f.heater - f.lossWalls - f.lossOpen - f.escapedEnergy + f.editEnergy + f.bodyWork);
    const waterError = budget.water.total - this.water0 - f.editWater;
    const otherError = budget.other.total - this.other0 - f.editOther;
    const saltError = budget.salt.total - this.salt0 - f.editSalt;
    const produced = this.phase.produced + this.bubbleModel.burstVapour;
    const span = this.time - this.vapourLast;
    if (span > 0.2) {
      this.vapourRate = (produced - this.phase.producedMark) / span;
      this.phase.producedMark = produced;
      this.vapourLast = this.time;
    }
    const regions = [];
    for (let r = 0; r < this.regions.count; r += 1) regions.push({ p0: this.regions.p0[r], sealed: this.regions.open[r] === 0, vGas: this.regions.vGas[r] });
    return {
      time: this.time,
      dt: this.dt,
      steps: this.steps,
      nx: g.nx,
      ny: g.ny,
      dx: g.dx,
      quality: this.quality,
      particles: this.particles.count,
      capacity: this.particles.cap,
      bubbles: this.bubbles.count,
      liquidCells,
      gasCells,
      stages: Array.from(this.timings),
      stepMs: this.stepMs,
      liquid: { ...this.liquid.last.solve },
      gas: { ...this.gas.last.solve },
      heat: { ...this.heat.last.solve },
      gasSubsteps: this.gas.last.substeps,
      capped: this.cappedCount,
      waterT: wt.mean,
      waterTmax: wt.max,
      otherMass: ot.mass,
      otherT: ot.mean,
      saltMass: budget.salt.liquid,
      saltSolid: budget.salt.crust + budget.salt.floor + budget.salt.grains,
      bodies: {
        count: this.bodies.list.filter((b) => !b.gone).length,
        free: this.bodies.list.filter((b) => b.free).length,
        awake: this.bodies.list.filter((b) => b.awake).length
      },
      heaters: this.heat.heaters.filter((h: Heater) => h.cells > 0).map((h: Heater) => ({ group: h.group, P: h.P, Tmean: h.Tmean, mode: h.mode, power: h.power, target: h.target, on: h.on })),
      regions,
      budget: { ...budget, water: { ...budget.water }, other: { ...budget.other }, salt: { ...budget.salt } },
      flows: { ...f },
      energyError,
      waterError,
      otherError,
      saltError,
      vapourRate: this.vapourRate,
      ambientT: this.ambientT,
      ambientP: this.pRef,
      g: this.gy,
      extremes: this.extremes.stats(),
      cpuOnly: this.needsCpu()
    };
  }
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function isScene(v: unknown): v is Scene {
  return v !== null && typeof v === 'object' && 'box' in v && 'ops' in v && 'quality' in v && 'sides' in v && 'ambient' in v
    && typeof (v as { ambient: { p: unknown } }).ambient.p === 'number' && (v as { ambient: { p: number } }).ambient.p > 1000;
}

