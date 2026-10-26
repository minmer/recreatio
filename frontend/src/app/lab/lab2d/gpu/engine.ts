/**
 * LABOR 2D (v2) — DER BESCHLEUNIGTE WEG (WebGPU): derselbe Schritt wie
 * Engine.step, ganz auf der GPU — Flüssigkeit, Gas, Blasen, Grenzfläche,
 * Wärme, Diagnose (Kerne in k*.ts, Löser in solver.ts). Die CPU-Engine bleibt
 * die Werkstatt für Szenen und Werkzeuge: vor einem Handgriff wird der
 * Zustand in sie zurückgeholt, danach wieder hochgeladen (state.ts).
 *
 * Der Rechner zeichnet Schritte auf, ohne auf die GPU zu warten; Δt bestimmt
 * die GPU selbst (Courant der Flüssigkeit). Etwa fünfmal je Sekunde liest er
 * die Zähler, die Teilsummen der Kennzahlen und die gewählte Blase zurück
 * (ohne zu warten) und führt daraus die Gesamtsummen in f64 — und passt die
 * aufgezeichneten Iterationen der Löser an das an, was die letzten Schritte
 * brauchten (der Transport zeichnet immer alle 16 Teilschritte auf). Keine
 * Wiederholbarkeit Bit für Bit (atomare Summen); die Bilanzen gelten bis auf
 * die Rundung in f32.
 */

import { latentPerKg } from '../engine/body';
import type { Engine, EngineStats } from '../engine/engine';
import { tSat } from '../engine/if97';
import { STAGE_COUNT } from '../engine/stages';
import { iceMass } from './bodies';
import { BodyStep, type BodyHooks } from './bodyStep';
import { BR } from './kbodylib';
import { GpuCtx, type KernelDef, type Resource } from './kernel';
import { ALL_KERNELS } from './kernels';
import { emptyTotals, INTERVALS, type IntervalKey, type ReadLayout, type ReadMeta, type Readout, type Totals } from './readout';
import { GpuSolver, SOLVE_DIFF, SOLVE_GAS, SOLVE_HEAT, SOLVE_LIQUID } from './solver';
import { C, CNT_SIZE, G, GLOB_SIZE, H, HEAT_STRIDE, INTERVAL_END, INTERVAL_FIRST, R, REG_STRIDE } from './slots';
import { GpuState, MEAS_K } from './state';

export type { Readout, Totals } from './readout';

type Variant = '' | 'A' | 'B' | 'S1' | 'S2';
/** Jacobi-Schritte der Zähigkeit je Schritt (gerade; das System ist stark diagonal dominant, ρ_ref Δx²/Δt ≫ η). */
const VISC_SWEEPS = 24;
const SLOT = 256;
const QUERIES = 2 * STAGE_COUNT;

export class GpuEngine {
  readonly ctx: GpuCtx;
  cpu: Engine;
  state!: GpuState;
  solver!: GpuSolver;
  /** Die Körper im Schritt (bodyStep.ts; nur wenn alle genaue Anteile haben). */
  private bstep!: BodyStep;
  /** Rechneten beim letzten Hochladen alle Körper mit genauen Anteilen (null: noch keins)? */
  private lastBody: boolean | null = null;
  private sub!: GPUBuffer;
  private groups = new Map<string, GPUBindGroup>();
  /** Zählt die Neuaufbauten des Zustands (der Zeichner baut dann seine Gruppen neu). */
  stateVersion = 0;
  /* Aufgezeichnete Iterationen (aus den letzten Ablesungen); nsub: die meisten nötigen Teilschritte seit der letzten (nur zur Anzeige). */
  itL = 16;
  itG = 18;
  itH = 8;
  itD = 6;
  nsub = 0;
  readonly totals: Totals = emptyTotals();
  last: Readout | null = null;
  /** Die letzte Ablesung mit Schritten: Löser und Teilschritte für die Anzeige, auch während der Pause. */
  private stepped: Readout | null = null;
  /** Bezugswerte der Bilanzen (die erste Ablesung auf der GPU — die f32-Rundung des Hochladens zählt so nicht als Fehler). */
  private energy0: number | null = null;
  private water0: number | null = null;
  private other0: number | null = null;
  private salt0: number | null = null;
  /** Live weiter aus einem Schlüsselbild (B): die Abweichungen, mit denen die Bilanzen an der ersten Ablesung weitergehen (sonst null). */
  private carry: { readonly energy: number; readonly water: number; readonly other: number; readonly salt: number } | null = null;
  private sealed = false;
  /** Gelöstes Salz in der Szene (M2b): Kristalle und Austausch laufen nur dann. */
  private salty = false;
  /** Andere Flüssigkeiten als Wasser in der Szene (M2a): Zähigkeit und Drift der Tröpfchen. */
  private mixed = false;
  private readonly staging: GPUBuffer[] = [];
  private readonly busy = new Set<GPUBuffer>();
  /** Wofür eine Ablesung aufgezeichnet wurde: ein Neuaufbau dazwischen macht sie wertlos; Gebiete und Heizungen gelten wie beim Aufzeichnen. */
  private readonly reading = new Map<GPUBuffer, ReadMeta>();
  private readonly querySet: GPUQuerySet | null;
  private readonly queryBuf: GPUBuffer | null;
  private vapourMark = 0;
  private vapourLast = 0;
  vapourRate = 0;
  /** Zeit je Stufe (ms) aus der letzten Messung mit Zeitstempeln. */
  stageMs: number[] = new Array<number>(STAGE_COUNT).fill(0);

  private constructor(ctx: GpuCtx, cpu: Engine) {
    this.ctx = ctx;
    this.cpu = cpu;
    this.querySet = ctx.timestamps ? ctx.device.createQuerySet({ type: 'timestamp', count: QUERIES }) : null;
    this.queryBuf = ctx.timestamps ? ctx.buffer('ts', 8 * QUERIES, GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC) : null;
    this.rebuild();
  }

  /** Ein Gerät holen und alle Kerne übersetzen (wirft, wenn WebGPU fehlt oder ein Kern nicht übersetzt). */
  static async create(cpu: Engine): Promise<GpuEngine> {
    return GpuEngine.on(await GpuEngine.prepare(), cpu);
  }

  /** Nur Gerät und Kerne, noch ohne Szene (Backen: schon beim Öffnen des Fensters); extra: weitere Kerne (die der Aufnahme). */
  static async prepare(extra: readonly KernelDef[] = []): Promise<GpuCtx> {
    const ctx = await GpuCtx.create();
    const errors = await ctx.compile([...ALL_KERNELS, ...extra]);
    if (errors.length > 0) { ctx.destroy(); throw new Error(`WGSL: ${errors.slice(0, 3).join(' | ')}`); }
    return ctx;
  }

  /** Die Engine auf einem vorbereiteten Gerät (prepare) für die CPU-Engine cpu (lädt ihren Zustand hoch). */
  static on(ctx: GpuCtx, cpu: Engine): GpuEngine {
    return new GpuEngine(ctx, cpu);
  }

  /** Alle Puffer neu für die jetzige CPU-Engine (neue Szene, andere Auflösung, mehr Kavitäten, Gebiete, Heizungen als Platz). */
  rebuild(): void {
    this.stateVersion += 1;
    const before = this.state === undefined ? null : this.state.d;
    if (this.state !== undefined) this.state.destroy();
    if (this.solver !== undefined) this.solver.destroy();
    if (this.bstep !== undefined) this.bstep.destroy();
    if (this.sub !== undefined) this.ctx.release([this.sub]);
    this.state = new GpuState(this.ctx, this.cpu);
    const S = this.state;
    /* Ein anderes Gitter braucht andere Iterationszahlen: von den reichlichen Anfangswerten aus anpassen (mit denen der
       alten Auflösung war jeder Schritt der ersten Ablesungen gekappt). */
    if (before === null || before.nx !== S.d.nx || before.ny !== S.d.ny) { this.itL = 16; this.itG = 18; this.itH = 8; this.itD = 6; }
    this.solver = new GpuSolver(this.ctx, S.plan, { params: S.params, mgF: S.mgF, mgU: S.mgU, cgv: S.cgv, cgs: S.cgs, lab: S.lab, cfl: S.cfl, csum: S.csum, cnt: S.cnt, cgp: S.cgp });
    this.bstep = new BodyStep(S, this.solver);
    const sub = new Uint32Array((SLOT / 4) * 16);
    for (let s = 0; s < 16; s += 1) sub[(SLOT / 4) * s] = s;
    this.sub = this.ctx.uniform('sub', sub.buffer);
    this.groups.clear();
    this.upload();
  }

  /** Den Zustand der CPU-Engine hochladen (nach einem Handgriff); passt er nicht in die Puffer, alles neu. */
  upload(): void {
    if (!this.state.fits(this.cpu)) { this.rebuild(); return; }
    this.state.upload(this.cpu);
    /* Treppe ↔ genaue Anteile (ein Körper wurde frei oder angeheftet): die Treppe trug eine andere Energie der Körper als ihre genauen
       Zellen (test 39: das Glas 168,80 statt 167,32 J) — die Bilanzen gehen mit den Abweichungen der CPU-Engine weiter, die eben alles bekam.
       Der Modus des letzten Hochladens überdauert einen Neuaufbau (mehr Platz ist kein Wechsel). */
    if (this.lastBody !== null && this.state.body !== this.lastBody) this.carryErrors({ energy: this.cpu.energyError(), water: this.cpu.waterError(), other: this.cpu.otherError(), salt: this.cpu.saltError() });
    this.lastBody = this.state.body;
    this.bstep.writeSel();
    this.mixed = this.cpu.particles.hasOther();
    this.salty = this.cpu.particles.hasSalt();
    this.sealed = false;
    for (let r = 0; r < this.cpu.regions.count; r += 1) if (this.cpu.regions.open[r] === 0) this.sealed = true;
    /* Die Teilchen gleich nach Zellen sortieren (A → B → A, wie in einem Schritt): Zeichner und Aufnahme lesen die Listen je Zelle, die sonst
       erst der nächste Schritt füllt — ruhend nach dem Hochladen fehlte das Wasser (auch beim Weiterrechnen aus einem Schlüsselbild, B). */
    const enc = this.ctx.device.createCommandEncoder();
    const p = enc.beginComputePass();
    this.sort(p, 1);
    this.sort(p, 2);
    p.end();
    this.ctx.device.queue.submit([enc.finish()]);
  }

  /** Den Zustand in die CPU-Engine zurückholen (vor einem Handgriff, für den Inspektor, zum Speichern). */
  async download(): Promise<void> {
    await this.state.download(this.cpu);
    const e = this.cpu;
    const t = this.totals;
    e.time = t.time;
    e.steps = t.steps;
    const f = e.flows;
    f.heater = t.heater; f.lossWalls = t.lossWalls; f.lossOpen = t.lossOpen; f.escapedEnergy = t.escapedEnergy; f.escapedWater = t.escapedWater; f.escapedAir = t.escapedAir;
    f.escapedOther = t.escapedOther; f.escapedSalt = t.escapedSalt;
    e.salt.crystallized = t.crystallized;
    e.phase.produced = t.produced; e.phase.condensed = t.condensed; e.phase.dew = t.dew; e.phase.fogMade = t.fogMade;
    const bm = e.bubbleModel;
    bm.burstVapour = t.burstVapour; bm.nucleated = t.nucleated; bm.departed = t.departed; bm.merged = t.merged; bm.burst = t.burst; bm.collapsed = t.collapsed;
    bm.burstCold = t.burstCold; bm.burstWarm = t.burstWarm; bm.collapsedCold = t.collapsedCold; bm.collapsedWarm = t.collapsedWarm;
    e.heat.fluxSL = t.fluxSL; e.heat.fluxLG = t.fluxLG; e.heat.fluxSG = t.fluxSG; e.heat.lossSolids = t.lossSolids;
    f.bodyWork = t.bodyWork;
    e.melt.melted = t.melted;
    e.melt.frozen = t.frozen;
    if (this.last !== null && this.last.firstSuperheat !== null && bm.firstSuperheat === null) bm.firstSuperheat = this.last.firstSuperheat;
  }

  /** Nur die Parameter neu (Umgebung). */
  writeParams(): void { this.state.writeParams(this.cpu); }
  /** Nur die Einstellungen einer Heizgruppe. */
  writeHeater(group: number): void { this.state.writeHeaterSettings(this.cpu, group); }
  /** Die gewählte Blase (Kennung; null: keine). */
  watch(id: number | null): void {
    this.ctx.device.queue.writeBuffer(this.state.cnt, 4 * C.WATCH, new Uint32Array([id ?? 0xffffffff]));
    this.ctx.device.queue.writeBuffer(this.state.cnt, 4 * C.WATCH_FATE, new Uint32Array([0]));
  }

  destroy(): void {
    this.state.destroy();
    this.ctx.destroy();
  }

  /* -- Aufzeichnen ---------------------------------------------------------------------------------- */

  private resources(v: Variant): Readonly<Record<string, Resource>> {
    const S = this.state;
    const base: Record<string, Resource> = {
      P: S.params, glob: S.glob, cnt: S.cnt, cf: S.cf, cu: S.cu, at: S.at, ff: S.ff, fu: S.fu, af: S.af, reg: S.reg, racc: S.racc, heat: S.heat,
      hacc: S.hacc, sites: S.sites, sbub: S.sbub, bubs: S.bubs, bubs2: S.bubs2, bacc: S.bacc, btarget: S.btarget, meas: S.meas, probe: S.probe,
      mgF: S.mgF, mgU: S.mgU, cgv: S.cgv, cgs: S.cgs, lab: S.lab, cfl: S.cfl, csum: S.csum, pkey: S.pkey, pslot: S.pslot, pargs: S.pargs,
      cstart: S.cstart, bsum: S.bsum, L: this.solver.level0,
      bod: S.bodies.bod, bgeo: S.bodies.bgeo, bcell: S.bodies.bcell, bcon: S.bodies.bcon, bat: S.bodies.bat, bread: S.bodies.bread, bmelt: S.bodies.bmelt
    };
    if (v === 'A') { base.parts = S.partsA; base.ccount = S.ccountB; }
    if (v === 'B') { base.parts = S.partsB; base.ccount = S.ccountA; }
    if (v === 'S1') { base.parts = S.partsA; base.parts2 = S.partsB; base.ccount = S.ccountA; base.cclear = S.ccountB; }
    if (v === 'S2') { base.parts = S.partsB; base.parts2 = S.partsA; base.ccount = S.ccountB; base.cclear = S.ccountA; }
    return base;
  }

  private group(name: string, v: Variant, sub = -1): GPUBindGroup {
    const key = `${name}|${v}|${sub}`;
    let g = this.groups.get(key);
    if (g === undefined) {
      const res = sub >= 0 ? { ...this.resources(v), SUB: { buffer: this.sub, offset: SLOT * sub, size: 16 } } : this.resources(v);
      g = this.ctx.bind(name, res);
      this.groups.set(key, g);
    }
    return g;
  }

  private cells(p: GPUComputePassEncoder, name: string, v: Variant = '', sub = -1): void { this.ctx.dispatch(p, name, this.group(name, v, sub), this.state.d.n); }
  private faces(p: GPUComputePassEncoder, name: string, v: Variant = '', sub = -1): void { this.ctx.dispatch(p, name, this.group(name, v, sub), this.state.d.nf); }
  /* Teilchenkerne direkt über die ganze Kapazität (jeder prüft die Zahl selbst): ein indirekter Aufruf kostet in Chrome ~30 µs Prüfung, eine leere Arbeitsgruppe fast nichts. */
  private parts(p: GPUComputePassEncoder, name: string, v: Variant): void { this.ctx.dispatch(p, name, this.group(name, v), this.state.d.pcap); }
  private bubs(p: GPUComputePassEncoder, name: string): void { this.ctx.dispatch(p, name, this.group(name, ''), this.state.d.bcap); }
  private one(p: GPUComputePassEncoder, name: string, v: Variant = ''): void { this.ctx.dispatchOne(p, name, this.group(name, v)); }

  /** Was bodyStep.ts zum Aufzeichnen braucht. */
  private readonly hooks: BodyHooks = {
    cells: (p, name, v) => this.cells(p, name, v ?? ''),
    faces: (p, name) => this.faces(p, name),
    parts: (p, name) => this.parts(p, name, 'A'),
    bubs: (p, name) => this.bubs(p, name),
    one: (p, name) => this.one(p, name),
    run: (p, name, threads, key, extra) => {
      const id = `${name}|run|${key}`;
      let g = this.groups.get(id);
      if (g === undefined) { g = this.ctx.bind(name, { ...this.resources('A'), ...extra }); this.groups.set(id, g); }
      this.ctx.dispatch(p, name, g, threads);
    }
  };

  /** Die Teilchen nach Zellen sortieren (1: A → B am Anfang, 2: B → A nach dem Transport). */
  private sort(p: GPUComputePassEncoder, which: 1 | 2): void {
    const v: Variant = which === 1 ? 'S1' : 'S2';
    const d = this.state.d;
    this.ctx.dispatch(p, 'sortCount', this.group('sortCount', v), d.pcap);
    this.ctx.dispatch(p, 'sortScan', this.group('sortScan', v), Math.ceil(d.n / 4));
    this.one(p, 'sortTop', v);
    this.ctx.dispatch(p, 'sortScatter', this.group('sortScatter', v), d.pcap);
  }

  /** `steps` Schritte aufzeichnen; mit `timed` der erste mit Zeitstempeln je Stufe. */
  encodeSteps(enc: GPUCommandEncoder, steps: number, timed: boolean): void {
    for (let s = 0; s < steps; s += 1) this.encodeStep(enc, timed && s === 0 && this.querySet !== null);
    if (timed && steps > 0 && this.querySet !== null && this.queryBuf !== null) enc.resolveQuerySet(this.querySet, 0, QUERIES, this.queryBuf, 0);
  }

  private pass(enc: GPUCommandEncoder, timed: boolean, stage: number): GPUComputePassEncoder {
    /* Beim Messen öffnet jeder Aufruf seinen eigenen Pass (GpuCtx.profiler): hier nur eine Attrappe. */
    if (this.ctx.profiler !== null) {
      const none = (): void => undefined;
      return { label: '', setPipeline: none, setBindGroup: none, dispatchWorkgroups: none, dispatchWorkgroupsIndirect: none, end: none };
    }
    if (!timed || this.querySet === null) return enc.beginComputePass();
    return enc.beginComputePass({ timestampWrites: { querySet: this.querySet, beginningOfPassWriteIndex: 2 * stage, endOfPassWriteIndex: 2 * stage + 1 } });
  }

  private encodeStep(enc: GPUCommandEncoder, timed: boolean): void {
    const e = this.cpu;
    /* Mit freien Körpern rechnen alle Körper mit genauen Anteilen (bodyStep.ts): ihre Kerne kommen zu denen der Treppe hinzu. */
    const body = this.state.body;
    let p: GPUComputePassEncoder;
    /* 1. Eingaben: die wachen Körper ins Gitter (ohne freie Körper leer). 2. Flüssigkeit. */
    if (body) { p = this.pass(enc, timed, 0); this.bstep.prepare(p, this.hooks); p.end(); }
    p = this.pass(enc, timed, 1);
    this.sort(p, 1);
    if (this.mixed) this.cells(p, 'cellHost', 'B');
    this.cells(p, 'splat', 'B');
    this.cells(p, 'classify');
    this.cells(p, 'transitions');
    this.cells(p, 'gasApply');
    this.cells(p, 'regCells');
    this.parts(p, 'regParts', 'B');
    this.bubs(p, 'regBubs');
    if (body) this.cells(p, 'bRegVol');
    this.one(p, 'regFinishStart');
    this.faces(p, 'p2g', 'B');
    if (body) this.faces(p, 'bFaceL');
    /* Mit anderen Flüssigkeiten: die Zähigkeit (Jacobi, gerade Zahl Schritte — das Ergebnis steht wieder in UL), dann die Kräfte. */
    if (this.mixed) {
      for (let k = 0; k < VISC_SWEEPS; k += 2) { this.faces(p, 'viscJacA'); this.faces(p, 'viscJacB'); }
      this.faces(p, 'viscForce');
    }
    this.cells(p, 'liqAssemble');
    this.solver.encodeMG(p, SOLVE_LIQUID, this.itL, true, false);
    this.cells(p, 'liqPressure');
    this.faces(p, 'liqCorrect');
    if (body) this.bstep.probe(p, this.hooks);
    this.faces(p, 'extrap1');
    this.faces(p, 'extrap2');
    this.parts(p, 'g2p', 'B');
    this.sort(p, 2);
    this.parts(p, 'heatWeights', 'A');
    p.end();
    /* 3. Gas. */
    p = this.pass(enc, timed, 2);
    this.cells(p, 'gasVolumes');
    this.faces(p, 'markFaces');
    if (body) this.faces(p, 'bFaceG');
    this.cells(p, 'gasMaxOut');
    /* Alle 16 Teilschritte; wie viele davon arbeiten, entscheidet die GPU in jedem Schritt (substepsOf). */
    for (let s = 0; s < 16; s += 1) {
      this.cells(p, 'gasFlux', '', s);
      this.cells(p, 'gasMove', '', s);
    }
    this.cells(p, 'gasApplyMid');
    this.faces(p, 'macFwd');
    this.faces(p, 'macBack');
    this.faces(p, 'viscosity');
    this.cells(p, 'gasAssemble');
    this.solver.encodeMG(p, SOLVE_GAS, this.itG, true, true);
    this.cells(p, 'gasPressure');
    this.faces(p, 'gasCorrect');
    p.end();
    /* 4. Blasen. */
    p = this.pass(enc, timed, 3);
    this.cells(p, 'gatherFull', 'A');
    if (this.state.nsites > 0) this.ctx.dispatch(p, 'bubNucleate', this.group('bubNucleate', ''), this.state.nsites);
    this.bubs(p, 'bubAdvance');
    this.bubs(p, 'bubTarget');
    this.bubs(p, 'bubMerge');
    this.bubs(p, 'bubMergeFinal');
    this.bubs(p, 'bubVent');
    this.bubs(p, 'bubFinish');
    this.one(p, 'bubCompact');
    this.bubs(p, 'bubCopyBack');
    this.parts(p, 'applyMass', 'A');
    this.cells(p, 'spawnWater', 'A');
    this.cells(p, 'gatherPlain', 'A');
    this.bubs(p, 'bubAlpha');
    this.cells(p, 'cellAlpha');
    this.cells(p, 'gasApply');
    p.end();
    /* 5. Grenzfläche. */
    p = this.pass(enc, timed, 4);
    this.cells(p, 'diffPrep');
    this.cells(p, 'diffAssemble');
    this.solver.encodeMG(p, SOLVE_DIFF, this.itD, false);
    this.faces(p, 'diffFaces');
    this.cells(p, 'diffOut');
    this.cells(p, 'diffApply');
    this.cells(p, 'latentSrc');
    this.parts(p, 'applyMass', 'A');
    this.cells(p, 'spawnWater', 'A');
    this.cells(p, 'gatherPlain', 'A');
    this.cells(p, 'gasApply');
    this.cells(p, 'flashTs');
    this.cells(p, 'flashVap', 'A');
    this.parts(p, 'flashParts', 'A');
    this.cells(p, 'flashDist');
    this.cells(p, 'gasApply');
    this.cells(p, 'fog');
    this.cells(p, 'films', 'A');
    /* Übersättigte Lösungen geben Kristalle ab (M2b); gasApply bucht Kruste und Boden sofort. */
    if (this.salty) { this.parts(p, 'saltCryst', 'A'); this.cells(p, 'gasApply'); }
    p.end();
    /* 6. Wärme. */
    p = this.pass(enc, timed, 5);
    this.cells(p, 'heaterSums');
    if (body) this.one(p, 'bHeaters');
    this.one(p, 'heaterPI');
    if (e.heat.liquidPower !== 0) this.parts(p, 'sumCl', 'A');
    this.cells(p, 'heatPrep', 'A');
    this.cells(p, 'heatAssemble');
    this.solver.encodeMG(p, SOLVE_HEAT, this.itH, false);
    this.cells(p, 'heatFlux');
    this.parts(p, 'heatParts', 'A');
    this.cells(p, 'heatShare', 'A');
    /* Salz innerhalb der Zellen und von Zelle zu Zelle (M2b). */
    if (this.salty) { this.cells(p, 'saltSums', 'A'); this.cells(p, 'saltShare', 'A'); }
    p.end();
    /* 7. Chemie: leer. 8. Ränder und Diagnose. */
    p = this.pass(enc, timed, 7);
    this.cells(p, 'regCells');
    this.parts(p, 'regParts', 'A');
    this.bubs(p, 'regBubs');
    if (body) this.cells(p, 'bRegVol');
    this.one(p, 'regFinish');
    if (this.sealed) {
      this.cells(p, 'compSums');
      this.one(p, 'compStep0');
      this.cells(p, 'compApply');
      this.cells(p, 'compSums');
      this.one(p, 'compStep1');
      this.cells(p, 'compApply');
      this.cells(p, 'compSums');
      this.one(p, 'compStepEnd');
      this.parts(p, 'pwParts', 'A');
      this.bubs(p, 'pwBubs');
    }
    this.cells(p, 'gasEos');
    if (!body) { this.one(p, 'stepEnd'); p.end(); return; }
    p.end();
    /* 9. Körper: collect, Kräfte, Berührungen, neue Lagen; dann Δt (auch nach dem schnellsten Körper). */
    p = this.pass(enc, timed, 8);
    this.bstep.finish(p, this.hooks);
    this.one(p, 'stepEnd');
    p.end();
  }

  /* -- Ablesen -------------------------------------------------------------------------------------- */

  private layout(): ReadLayout {
    const S = this.state;
    const cnt = 0;
    const glob = cnt + 4 * CNT_SIZE;
    const reg = glob + 4 * GLOB_SIZE;
    const heat = reg + 4 * REG_STRIDE * S.d.nreg;
    const meas = heat + 4 * HEAT_STRIDE * S.d.nheat;
    const nm = S.measGroups[0] + S.measGroups[1] + S.measGroups[2];
    const probe = meas + 4 * MEAS_K * nm;
    const ts = probe + 4 * 64;
    const bodies = ts + 8 * QUERIES;
    const nbody = S.body ? S.bodies.nbody : 0;
    const total = bodies + 4 * BR * nbody;
    return { cnt, glob, reg, heat, meas, probe, ts, bodies, nbody, total };
  }

  /** Eine Ablesung aufzeichnen (Kennzahlen rechnen, kopieren, Zwischensummen leeren); null, wenn kein Zwischenpuffer frei ist. */
  encodeReadback(enc: GPUCommandEncoder, timed: boolean): GPUBuffer | null {
    const S = this.state;
    const L = this.layout();
    let buf = this.staging.find((b) => !this.busy.has(b) && b.size >= L.total);
    if (buf === undefined) {
      /* Die Aufteilung wuchs (ein Körper, ein Gebiet, eine Heizung mehr): ein freier, zu kleiner Puffer weicht. Sonst waren nach drei
         solchen Schritten alle drei zu klein, und es kam keine Ablesung mehr — die Anzeige stand still (die Fahrt der Oberfläche, 2026-10-26). */
      const small = this.staging.findIndex((b) => !this.busy.has(b) && b.size < L.total);
      if (small >= 0) { this.staging[small].destroy(); this.staging.splice(small, 1); }
      if (this.staging.length >= 3) return null;
      buf = this.ctx.device.createBuffer({ label: 'readback', size: Math.ceil(L.total / 16) * 16 + 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
      this.staging.push(buf);
    }
    const p = enc.beginComputePass();
    this.ctx.dispatch(p, 'measCells', this.group('measCells', ''), S.d.n);
    this.ctx.dispatch(p, 'measParts', this.group('measParts', 'A'), S.d.pcap);
    this.ctx.dispatch(p, 'measBubs', this.group('measBubs', ''), S.d.bcap);
    this.ctx.dispatch(p, 'bubWatch', this.group('bubWatch', ''), S.d.bcap);
    if (L.nbody > 0) this.bstep.measure(p, this.hooks);
    p.end();
    if (L.nbody > 0) enc.copyBufferToBuffer(S.bodies.bread, 0, buf, L.bodies, 4 * BR * L.nbody);
    enc.copyBufferToBuffer(S.cnt, 0, buf, L.cnt, 4 * CNT_SIZE);
    enc.copyBufferToBuffer(S.glob, 0, buf, L.glob, 4 * GLOB_SIZE);
    enc.copyBufferToBuffer(S.reg, 0, buf, L.reg, 4 * REG_STRIDE * S.d.nreg);
    enc.copyBufferToBuffer(S.heat, 0, buf, L.heat, 4 * HEAT_STRIDE * S.d.nheat);
    enc.copyBufferToBuffer(S.meas, 0, buf, L.meas, L.probe - L.meas);
    enc.copyBufferToBuffer(S.probe, 0, buf, L.probe, 4 * 64);
    if (timed && this.queryBuf !== null) enc.copyBufferToBuffer(this.queryBuf, 0, buf, L.ts, 8 * QUERIES);
    enc.clearBuffer(S.cnt, 4 * INTERVAL_FIRST, 4 * (INTERVAL_END - INTERVAL_FIRST));
    enc.clearBuffer(S.cnt, 4 * C.VMAXP, 4 * 4);
    enc.clearBuffer(S.cnt, 4 * C.ESC_OTHER, 4 * 3);
    enc.clearBuffer(S.cnt, 4 * C.REL_MASS, 4 * 4);
    enc.clearBuffer(S.cnt, 4 * C.BODYWORK, 4 * (C.CONT_FULL + 1 - C.BODYWORK));
    enc.clearBuffer(S.cnt, 4 * C.MELTED, 4 * (C.MELTFULL + 1 - C.MELTED));
    this.busy.add(buf);
    /* Je Gebiet der GPU einmal (mit genauen Anteilen legt das Hochladen Gebiete der CPU zusammen, die nur freie Körper trennen — sonst zählte
       ihr −p0 V doppelt). */
    const regions: number[] = [];
    for (let k = 0; k < this.cpu.regions.count; k += 1) { const r = S.gpuRegion(k); if (!regions.includes(r)) regions.push(r); }
    this.reading.set(buf, { version: this.stateVersion, layout: L, regions, heaters: this.cpu.heat.heaters.length, groups: [...S.measGroups], nreg: S.d.nreg, nheat: S.d.nheat });
    return buf;
  }

  /** Eine aufgezeichnete Ablesung lesen (nach dem Abschicken), die Gesamtsummen führen, die Zahlen der Löser anpassen. */
  async finishReadback(buf: GPUBuffer, timed: boolean): Promise<Readout | null> {
    const meta = this.reading.get(buf);
    const done = (): void => { this.busy.delete(buf); this.reading.delete(buf); };
    try {
      await buf.mapAsync(GPUMapMode.READ);
    } catch {
      done();
      return null;
    }
    /*
     * Neu aufgebaut, während die Ablesung unterwegs war (andere Auflösung, neue Szene): ihre Zahlen gehören zu keinem
     * Zustand mehr. Mit der neuen Aufteilung gelesen, wurden sie zu Unsinn in den Gesamtsummen und im Bezugswert der
     * Bilanzen (E NaN, ein Wasserfehler von Gramm, Löser bei 60 Iterationen).
     */
    if (meta === undefined || meta.version !== this.stateVersion) {
      buf.unmap();
      done();
      return null;
    }
    const all = buf.getMappedRange(0, Math.ceil(meta.layout.total / 16) * 16).slice(0);
    buf.unmap();
    done();
    const r = this.parse(all, meta, timed);
    this.absorb(r);
    return r;
  }

  private parse(all: ArrayBuffer, meta: ReadMeta, timed: boolean): Readout {
    const L = meta.layout;
    const cu = new Uint32Array(all, L.cnt, CNT_SIZE);
    const cf = new Float32Array(all, L.cnt, CNT_SIZE);
    const glob = new Float32Array(all, L.glob, GLOB_SIZE);
    const reg = new Float32Array(all, L.reg, REG_STRIDE * meta.nreg);
    const heat = new Float32Array(all, L.heat, HEAT_STRIDE * meta.nheat);
    const meas = new Float32Array(all, L.meas, (L.probe - L.meas) / 4);
    const probe = new Float32Array(all, L.probe, 64);
    /* Teilsummen in f64 addieren. */
    const [g0, g1, g2] = meta.groups;
    const sum = (base: number, groups: number, k: number): number => { let s = 0; for (let g = 0; g < groups; g += 1) s += meas[(base + g) * MEAS_K + k]; return s; };
    const regions: Readout['regions'] = [];
    for (const gr of meta.regions) {
      const o = REG_STRIDE * gr;
      regions.push({ p0: reg[o + R.P0], sealed: reg[o + R.OPEN] === 0, vGas: reg[o + R.VGAS], vFluid: reg[o + R.VFLUID] });
    }
    const heaters: Readout['heaters'] = [];
    for (let k = 0; k < meta.heaters; k += 1) {
      const o = HEAT_STRIDE * k;
      heaters.push({ P: heat[o + H.P], Tmean: heat[o + H.TMEAN], integral: heat[o + H.INTEGRAL], cells: heat[o + H.CELLS] });
    }
    let stageMs: number[] | null = null;
    if (timed && this.queryBuf !== null) {
      const ts = new BigUint64Array(all, L.ts, QUERIES);
      stageMs = [];
      for (let s = 0; s < STAGE_COUNT; s += 1) {
        const a = ts[2 * s];
        const b = ts[2 * s + 1];
        stageMs.push(b > a && a > 0n ? Number(b - a) / 1e6 : 0);
      }
    }
    const wm = cf[C.SUM_WM];
    const intervals = {} as Record<IntervalKey, number>;
    for (const [key, slot, kind] of INTERVALS) intervals[key] = kind === 'f' ? cf[slot] : cu[slot];
    return {
      intervals,
      ov: [cf[C.OV_PMAX], cf[C.OV_VMAX], cf[C.OV_VLIQ]],
      pcount: cu[C.PCOUNT],
      bcount: cu[C.BCOUNT],
      dt: glob[G.DT],
      stepsSince: cu[C.STEPS],
      simSince: cf[C.SIMTIME],
      itL: cu[C.IT_L], itG: cu[C.IT_G], itH: cu[C.IT_H], itD: cu[C.IT_D],
      capL: cu[C.CAP_L], capG: cu[C.CAP_G], capH: cu[C.CAP_H], capD: cu[C.CAP_D],
      resL: cf[C.RES_L], resG: cf[C.RES_G], resH: cf[C.RES_H],
      nsub: cu[C.NSUBMAX],
      uMaxG: cf[C.UMAXG],
      waterMass: wm,
      waterT: wm > 0 ? cf[C.SUM_WMT] / wm : 0,
      waterTmax: cf[C.TMAX],
      solids: sum(0, g0, 0), film: sum(0, g0, 1), gas: sum(0, g0, 2), vapour: sum(0, g0, 3), fog: sum(0, g0, 4), air: sum(0, g0, 5),
      liquidCells: Math.round(sum(0, g0, 6)), gasCells: Math.round(sum(0, g0, 7)),
      liquidH: sum(g0, g1, 0), liquidMass: sum(g0, g1, 1), sensible: sum(g0, g1, 3), otherMass: sum(g0, g1, 4), otherMT: sum(g0, g1, 5),
      saltLiquid: sum(g0, g1, 6), crust: sum(0, g0, 8), floor: sum(0, g0, 9), floorH: sum(0, g0, 10),
      bubH: sum(g0 + g1, g2, 0), bubWater: sum(g0 + g1, g2, 1), bubAir: sum(g0 + g1, g2, 2),
      regions,
      heaters,
      watch: { found: probe[31] === 1, id: new Uint32Array(probe.buffer, probe.byteOffset + 4 * 21, 1)[0], fate: cu[C.WATCH_FATE], data: new Float32Array(probe) },
      firstSuperheat: cu[C.FIRST_SH] !== 0 ? cf[C.FIRST_SH] - 1000 : null,
      stageMs,
      vmaxP: cf[C.VMAXP], rmaxB: cf[C.RMAXB], slowed: cu[C.SLOWED], vented: cf[C.VENTED],
      bodies: L.nbody > 0 ? this.state.bodies.parse(all, L.bodies, L.nbody) : [],
      itP: cu[C.IT_P], capP: cu[C.CAP_P]
    };
  }

  /** Gesamtsummen und angepasste Zahlen der Löser. */
  private absorb(r: Readout): void {
    const t = this.totals;
    this.last = r;
    if (r.stepsSince > 0) this.stepped = r;
    if (r.stageMs !== null) this.stageMs = r.stageMs;
    for (const [key] of INTERVALS) t[key] += r.intervals[key];
    t.time += r.simSince;
    t.steps += r.stepsSince;
    t.capped += r.capL + r.capG + r.capH + r.capD;
    t.slowed += r.slowed;
    t.vented += r.vented;
    /* Das meiste Gebrauchte seit der letzten Ablesung plus Spielraum; gekappt: anderthalbmal so viele. Die Gaslösung schwankt
       am meisten von Schritt zu Schritt (mit einer Iteration Spielraum war sie alle paar Sekunden einmal gekappt). */
    const adapt = (cur: number, used: number, capped: number, lo: number, hi: number, margin: number): number => {
      if (used === 0 && capped === 0) return cur;
      const want = capped > 0 ? Math.ceil(cur * 1.5) + 2 : used + margin;
      return Math.min(hi, Math.max(lo, cur > want ? Math.max(want, cur - 2) : want));
    };
    if (r.stepsSince > 0) {
      this.itL = adapt(this.itL, r.itL, r.capL, 4, 60, 1);
      this.itG = adapt(this.itG, r.itG, r.capG, 4, 60, 2);
      this.itH = adapt(this.itH, r.itH, r.capH, 3, 60, 1);
      this.itD = adapt(this.itD, r.itD, r.capD, 3, 60, 1);
      this.nsub = r.nsub;
      this.bstep.adapt(r.itP, r.capP);
    }
    /* Gemessen werden die freien Körper, die eben wach waren (BodyStep.select). */
    if (this.state.body && r.bodies.length > 0) this.bstep.select(r.bodies);
  }

  /* -- Kennzahlen im Format der CPU-Engine ---------------------------------------------------------- */

  stats(stepMs: number): EngineStats {
    const e = this.cpu;
    const g = e.grid;
    const r = this.last;
    const t = this.totals;
    const budget = this.budget();
    const flows = {
      heater: t.heater, lossWalls: t.lossWalls, lossOpen: t.lossOpen, escapedEnergy: t.escapedEnergy, editEnergy: e.ledger.energy,
      escapedWater: t.escapedWater, escapedAir: t.escapedAir, editWater: e.ledger.water, editAir: e.ledger.air,
      escapedOther: t.escapedOther, editOther: e.ledger.other, escapedSalt: t.escapedSalt, editSalt: e.ledger.salt, bodyWork: t.bodyWork
    };
    const e0 = this.energy0 ?? budget.energy;
    const w0 = this.water0 ?? budget.water.total;
    const energyError = budget.energy - e0 - (flows.heater - flows.lossWalls - flows.lossOpen - flows.escapedEnergy + flows.editEnergy + flows.bodyWork);
    const waterError = budget.water.total - w0 - flows.editWater;
    const otherError = budget.other.total - (this.other0 ?? budget.other.total) - flows.editOther;
    const saltError = budget.salt.total - (this.salt0 ?? budget.salt.total) - flows.editSalt;
    const produced = t.produced + t.burstVapour;
    const span = t.time - this.vapourLast;
    if (span > 0.2) { this.vapourRate = (produced - this.vapourMark) / span; this.vapourMark = produced; this.vapourLast = t.time; }
    const heaters = e.heat.heaters.map((h, k) => ({ h, k, rd: r?.heaters[k] })).filter(({ rd, h }) => (rd?.cells ?? h.cells) > 0)
      .map(({ h, rd }) => ({ group: h.group, P: rd?.P ?? h.P, Tmean: rd?.Tmean ?? h.Tmean, mode: h.mode, power: h.power, target: h.target, on: h.on }));
    const sol = (it: number, res: number, capped: number): { iterations: number; residual: number; capped: boolean } => ({ iterations: it, residual: res, capped: capped > 0 });
    const rs = this.stepped ?? r;
    return {
      time: t.time,
      dt: r?.dt ?? e.dt,
      steps: t.steps,
      nx: g.nx, ny: g.ny, dx: g.dx,
      quality: e.currentQuality,
      particles: r?.pcount ?? e.particles.count,
      capacity: e.particles.cap,
      bubbles: r?.bcount ?? e.bubbles.count,
      liquidCells: r?.liquidCells ?? 0,
      gasCells: r?.gasCells ?? 0,
      stages: [...this.stageMs],
      stepMs,
      liquid: sol(rs?.itL ?? 0, rs?.resL ?? 0, rs?.capL ?? 0),
      gas: sol(rs?.itG ?? 0, rs?.resG ?? 0, rs?.capG ?? 0),
      heat: sol(rs?.itH ?? 0, rs?.resH ?? 0, rs?.capH ?? 0),
      gasSubsteps: rs?.nsub ?? 0,
      capped: t.capped,
      waterT: r?.waterT ?? 0,
      waterTmax: r?.waterTmax ?? 0,
      otherMass: r?.otherMass ?? 0,
      otherT: r !== null && r.otherMass > 0 ? r.otherMT / r.otherMass : 0,
      saltMass: r?.saltLiquid ?? 0,
      saltSolid: (r?.crust ?? 0) + (r?.floor ?? 0),
      /* Mit freien Körpern aus der Ablesung; sonst stehen nur angeheftete Körper als Treppe da. */
      bodies: this.bodyCounts(),
      heaters,
      regions: (r?.regions ?? []).map((q) => ({ p0: q.p0, sealed: q.sealed, vGas: q.vGas })),
      budget,
      flows,
      energyError,
      waterError,
      otherError,
      saltError,
      vapourRate: this.vapourRate,
      ambientT: e.ambientT,
      ambientP: e.pRef,
      g: e.gy,
      extremes: { ...e.extremes.stats(), slowed: t.slowed, vented: t.vented },
      /* Mehr als 128 Berührungen zugleich (kbodydyn.ts MAXC) fielen weg: die Oberfläche sagt, dass die Szene in den normalen Weg gehört. */
      cpuOnly: t.contFull > 0
    };
  }

  /** Körper für die Anzeige: alle, freie, wache (mit freien Körpern aus der Ablesung). */
  private bodyCounts(): { count: number; free: number; awake: number } {
    const list = this.cpu.bodies.list;
    const rd = this.last?.bodies ?? [];
    if (!this.state.body || rd.length === 0) return { count: list.filter((b) => !b.gone).length, free: 0, awake: 0 };
    let count = 0, free = 0, awake = 0;
    for (const b of rd) { if (b.gone) continue; count += 1; if (!b.pinned) { free += 1; if (!b.asleep) awake += 1; } }
    return { count, free, awake };
  }

  /**
   * Die Körper in der Bilanz (genaue Anteile): ihre inneren Zellen samt dem Versatz eines schmelzenden Stoffs, Film, Kruste, Eis als Wasser;
   * dazu das Schmelzwasser, das noch kein Teilchen ist (Wasser, Enthalpie, Salz — es zählt zur Flüssigkeit, wie budget.ts).
   */
  private bodySums(): { E: number; film: number; crust: number; ice: number; pm: number; pH: number; ps: number } {
    const rd = this.last?.bodies ?? [];
    let E = 0, film = 0, crust = 0, pm = 0, pH = 0, ps = 0;
    const list = this.cpu.bodies.list;
    rd.forEach((b, k) => {
      pm += b.pm; pH += b.pH; ps += b.ps;
      if (b.gone) return;
      E += b.E + latentPerKg(list[k]?.mat ?? 0) * b.m; film += b.film; crust += b.crust;
    });
    return { E, film, crust, ice: rd.length > 0 ? iceMass(this.cpu, rd) : 0, pm, pH, ps };
  }

  /** Die Bilanz aus der letzten Ablesung (wie budget.ts measure). */
  budget(): EngineStats['budget'] {
    const r = this.last;
    const t = this.totals;
    let pv = 0;
    for (const q of r?.regions ?? []) if (q.sealed) pv -= q.p0 * q.vFluid;
    const bs = this.bodySums();
    /* Schmelzwasser, das noch kein Teilchen ist, zählt zur Flüssigkeit (wie budget.ts). */
    const liquid = (r?.liquidH ?? 0) + bs.pH;
    const liquidMass = (r?.liquidMass ?? 0) + bs.pm;
    /* Das Salz am Boden der Kiste zählt mit seiner Enthalpie zu den Feststoffen (wie budget.ts). */
    const solids = (r?.solids ?? 0) + (r?.floorH ?? 0) + bs.E;
    const gas = r?.gas ?? 0;
    const bubbles = r?.bubH ?? 0;
    const film = (r?.film ?? 0) + bs.film;
    const water = {
      /* Eis: die Masse der schmelzbaren Körper (mit genauen Anteilen; ohne sie schmilzt keins). */
      liquid: liquidMass, ice: bs.ice, vapour: r?.vapour ?? 0, fog: r?.fog ?? 0, film, bubbles: r?.bubWater ?? 0, escaped: t.escapedWater,
      total: liquidMass + bs.ice + (r?.vapour ?? 0) + (r?.fog ?? 0) + film + (r?.bubWater ?? 0) + t.escapedWater
    };
    const om = r?.otherMass ?? 0;
    return { energy: solids + liquid + gas + bubbles + pv, solids, liquid, gas, bubbles, pv, water, other: { liquid: om, escaped: t.escapedOther, total: om + t.escapedOther }, salt: this.saltBudget(), air: (r?.air ?? 0) + (r?.bubAir ?? 0) + t.escapedAir };
  }

  /** Das Salz aus der letzten Ablesung (gelöst, Kruste, Boden, entwichen). */
  private saltBudget(): EngineStats['budget']['salt'] {
    const r = this.last;
    const bs = this.bodySums();
    const liquid = (r?.saltLiquid ?? 0) + bs.ps;
    const crust = (r?.crust ?? 0) + bs.crust;
    const floor = r?.floor ?? 0;
    const escaped = this.totals.escapedSalt;
    return { liquid, crust, grains: 0, floor, escaped, total: liquid + crust + floor + escaped };
  }

  /** Neue Szene: Gesamtsummen, Bezugswerte, Schreiber von vorn. */
  resetTotals(): void {
    Object.assign(this.totals, emptyTotals());
    this.last = null;
    this.stepped = null;
    this.energy0 = null;
    this.water0 = null;
    this.other0 = null;
    this.salt0 = null;
    this.vapourMark = 0;
    this.vapourLast = 0;
    this.vapourRate = 0;
    this.carry = null;
  }

  /** Die Bezugswerte der Bilanzen jetzt setzen (nach dem ersten Hochladen und nach jedem Neuaufbau). */
  resetBaseline(): void {
    this.energy0 = null;
    this.water0 = null;
    this.other0 = null;
    this.salt0 = null;
  }

  /** Live weiter aus einem Schlüsselbild: an der ersten Ablesung zeigen die Bilanzen genau diese Abweichungen (die der CPU-Engine nach dem Wiederherstellen). */
  carryErrors(c: { readonly energy: number; readonly water: number; readonly other: number; readonly salt: number }): void {
    this.resetBaseline();
    this.carry = c;
  }

  /** Nach einer Ablesung: die Bezugswerte, falls noch keine da sind (mit den mitgenommenen Abweichungen). */
  baselineFromLast(): void {
    if (this.last === null || this.energy0 !== null) return;
    const b = this.budget();
    const t = this.totals;
    const e = this.cpu;
    const c = this.carry ?? { energy: 0, water: 0, other: 0, salt: 0 };
    this.energy0 = b.energy - (t.heater - t.lossWalls - t.lossOpen - t.escapedEnergy + e.ledger.energy + t.bodyWork) - c.energy;
    this.water0 = b.water.total - e.ledger.water - c.water;
    this.other0 = b.other.total - e.ledger.other - c.other;
    this.salt0 = b.salt.total - e.ledger.salt - c.salt;
    this.carry = null;
  }

  /** Die Siedetemperatur an der Oberfläche (Umgebungsdruck). */
  get tsatAmb(): number { return tSat(this.cpu.regions.pAmb); }
}
