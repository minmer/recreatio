/**
 * LABOR 2D (v2) — DER ARBEITER DES BESCHLEUNIGTEN WEGS („Widok
 * przyspieszony“): rechnet jeden Schritt auf der Grafikkarte (gpu/engine.ts)
 * und zeichnet direkt aus ihren Puffern in eine OffscreenCanvas mit WebGPU
 * (gpu/render.ts). Dieselben Nachrichten wie engine.worker.ts.
 *
 * Takt: je Bild (rAF) so viele Schritte, wie die vergangene Zeit mal Tempo
 * verlangt (höchstens MAX_STEPS je Bild), aufgezeichnet ohne zu warten; Δt
 * kennt die GPU selbst, der Arbeiter erfährt es mit jeder Ablesung (etwa
 * fünfmal je Sekunde, ebenfalls ohne zu warten). Handgriffe holen den
 * Zustand in die CPU-Engine, wenden den Handgriff dort an und laden ihn wieder
 * hoch — währenddessen ruht die Rechnung.
 *
 * Nachweise (B, seit 2026-10-25): gebacken und abgespielt wird im normalen
 * Weg; hier sucht der Arbeiter nur den Nachweis der Szene (für „Nagranie“,
 * bevorzugt den von der GPU) und geht mit init.resume aus einem Schlüsselbild
 * eines Nachweises von der GPU live weiter: zurückgeschrieben in die
 * CPU-Engine, hochgeladen, mit den Gesamtsummen, Abweichungen und Marken der
 * Schreiber von dort (gpu/handoff.ts).
 */

import { canonicalScene, clipKey, infoOf, rootOf } from './clip/clip';
import { layoutOf, restoreSnapshot } from './clip/snapshot';
import { browserStore, type ClipStore } from './clip/store';
import { Charts } from './engine/charts';
import { Engine } from './engine/engine';
import { tSat } from './engine/if97';
import { editObject, objectView } from './engine/objects';
import type { BubbleView, ChartSample, HostMessage, HostStats, WorkerMessage } from './engine/protocol';
import type { Op } from './engine/scene';
import { objectViewGpu } from './gpu/bodies';
import { GpuCharts } from './gpu/charts';
import { GpuEngine, type Readout } from './gpu/engine';
import { seedFromMirror } from './gpu/handoff';
import { GpuRenderer } from './gpu/render';
import { SALT_FULL, type Overlay } from './render/frame';
import type { Walls } from './render/glRenderer';
import { T_SCALE } from './render/palette';
import { fitView, type View } from './render/view';

const scope = self as unknown as {
  postMessage(message: WorkerMessage, options?: StructuredSerializeOptions): void;
  addEventListener(type: 'message', listener: (e: MessageEvent<HostMessage>) => void): void;
  requestAnimationFrame?: (cb: (t: number) => void) => number;
  navigator: Navigator;
};

const post = (m: WorkerMessage): void => scope.postMessage(m);

/** Höchstens so viele Schritte je Bild (sonst läuft die Zeit langsamer, und die Oberfläche sagt es). */
const MAX_STEPS = 8;
const MAX_LAG = 0.1;
/** Höchstens so viele Bilder zugleich unterwegs: mit zweien lief die Grafikkarte zwischen den Bildern leer (1 mm, „Wrzenie“: 98 statt 121 Schritte/s). */
const MAX_INFLIGHT = 3;
const STATS_MS = 200;
const SAMPLE_EVERY = 0.25;
const T0 = 273.15;

let cpu: Engine | null = null;
let gpu: GpuEngine | null = null;
let renderer: GpuRenderer | null = null;
let charts: GpuCharts | null = null;
let canvas: OffscreenCanvas | null = null;
let adapter = '';
let cssW = 1;
let cssH = 1;
let dpr = 1;
let view: View = { x0: 0, y0: 0, x1: 1, y1: 1 };
let walls: Walls = { left: true, right: true, bottom: true, top: false };
let paused = false;
let speed = 1;
let overlay: Overlay = 'none';
let showParticles = false;
let acc = 0;
let lastTick = 0;
let pendingSteps = 0;
let inflight = 0;
let readPending = false;
let lastStats = 0;
let statsSim = 0;
let frames = 0;
let stepsSince = 0;
let started = false;
let nextSample = 0;
let lastBubble: BubbleView | null = null;
/** Der gewählte Gegenstand (sein Name). */
let selectedObject: string | null = null;
const pendingSamples: ChartSample[] = [];
/* Aufgaben, die den Zustand brauchen (Handgriffe, Fragen), der Reihe nach; währenddessen ruht die Rechnung. */
const tasks: (() => Promise<void>)[] = [];
let busy = false;
const pendingOps: Op[] = [];
/* Der Nachweis der Szene (B): gesucht 0,3 s nach der letzten Änderung. */
let clipStore: Promise<ClipStore> | null = null;
let clipTimer: ReturnType<typeof setTimeout> | null = null;
let clipSeq = 0;

/** Gibt es Nachweise dieser Szene? Die beschleunigte Ansicht bietet „Nagranie“ an — bevorzugt den von der GPU (abgespielt im normalen Weg). */
function checkClipsSoon(): void {
  if (clipTimer !== null) clearTimeout(clipTimer);
  clipTimer = setTimeout(() => { clipTimer = null; void checkClips(); }, 300);
}

async function checkClips(): Promise<void> {
  const e = cpu;
  if (e === null) return;
  const seq = (clipSeq += 1);
  try {
    const scene = canonicalScene(e.serialize());
    const kc = await clipKey(scene, 'cpu');
    const kg = await clipKey(scene, 'gpu');
    clipStore ??= browserStore();
    const store = await clipStore;
    const [hc, hg] = await Promise.all([store.header(kc), store.header(kg)]);
    if (seq !== clipSeq || cpu !== e) return;
    const h = hg ?? hc;
    post({ type: 'clip', info: h === null ? null : infoOf(h, layoutOf(rootOf(e, new Charts(e))), hg !== null ? hc : null) });
  } catch { /* ohne Speicher keine Nachweise */ }
}

function setWalls(): void {
  if (cpu === null) return;
  const s = cpu.scene.sides;
  walls = { left: s.left === 'wall', right: s.right === 'wall', bottom: s.bottom === 'wall', top: s.top === 'wall' };
}

function resize(w: number, h: number, ratio: number): void {
  cssW = Math.max(1, w);
  cssH = Math.max(1, h);
  dpr = Math.max(0.5, Math.min(3, ratio));
  if (canvas !== null) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  if (cpu !== null) view = fitView(cpu.boxW, cpu.boxH, cssW, cssH, 0.006);
}

function theme(dark: boolean): void {
  if (renderer === null) return;
  renderer.theme = {
    ground: dark ? [0.1, 0.12, 0.15] : [0.93, 0.95, 0.97],
    outside: dark ? [0.06, 0.07, 0.09] : [0.86, 0.88, 0.9],
    wall: dark ? [0.55, 0.6, 0.66] : [0.42, 0.46, 0.5],
    ink: dark ? [0.9, 0.93, 0.96] : [0.08, 0.1, 0.12]
  };
}

/** Eine Aufgabe einreihen; die Rechnung wartet, bis die GPU leer ist und die Aufgabe fertig. */
function task(fn: () => Promise<void>): void {
  tasks.push(fn);
  if (!busy) void drain();
}

async function drain(): Promise<void> {
  if (gpu === null) return;
  busy = true;
  try {
    while (tasks.length > 0) {
      const fn = tasks.shift() as () => Promise<void>;
      await gpu.ctx.device.queue.onSubmittedWorkDone();
      try { await fn(); } catch (e) { post({ type: 'error', message: e instanceof Error ? e.message : String(e) }); }
    }
  } finally {
    busy = false;
    lastTick = performance.now();
  }
}

/** Vor dem Zurückholen: die offenen Zwischensummen ablesen (sie gingen beim Hochladen verloren). */
async function settleGpu(): Promise<void> {
  if (gpu === null) return;
  const enc = gpu.ctx.device.createCommandEncoder();
  const buf = gpu.encodeReadback(enc, false);
  gpu.ctx.device.queue.submit([enc.finish()]);
  if (buf !== null) await gpu.finishReadback(buf, false);
  gpu.baselineFromLast();
}

/**
 * Freie Körper (M3a) und Eis (M3b) rechnet der beschleunigte Weg noch nicht:
 * die Szene geht mit allen Handgriffen an den normalen Weg zurück.
 */
function refuseCpuOnly(): boolean {
  if (cpu === null || !cpu.needsCpu()) return false;
  post({ type: 'gpu', ok: false, adapter, message: 'cpu-only', scene: cpu.serialize() });
  return true;
}

/** Nach einem Hochladen oder Neuaufbau. */
function afterUpload(version: number): void {
  if (gpu !== null && renderer !== null && gpu.stateVersion !== version) renderer.reset();
}

function applyOps(): void {
  task(async () => {
    if (gpu === null || cpu === null || pendingOps.length === 0) return;
    const ops = pendingOps.splice(0, pendingOps.length);
    await settleGpu();
    await gpu.download();
    for (const op of ops) {
      const warning = cpu.apply(op);
      if (warning !== null && warning.startsWith('refused')) post({ type: 'refused', message: warning });
    }
    if (refuseCpuOnly()) return;
    const v = gpu.stateVersion;
    gpu.upload();
    afterUpload(v);
    checkClipsSoon();
  });
}

function overlayScale(r: Readout | null): [number, number, number] {
  const ov = r?.ov ?? [0, 0, 0];
  const vliq = ov[2];
  if (overlay === 'temperature') return [T0 + T_SCALE[0], T0 + T_SCALE[1], vliq];
  if (overlay === 'pressure') { const p = Math.max(1, ov[0]); return [-p, p, vliq]; }
  if (overlay === 'velocity') return [0, Math.max(0.02, ov[1]), vliq];
  if (overlay === 'vapour') return [0, 0.6, vliq];
  if (overlay === 'salt') return [0, SALT_FULL, vliq];
  return [0, 1, vliq];
}

function bubbleView(r: Readout | null): BubbleView | null {
  if (r === null) return null;
  const w = r.watch;
  if (w.found) {
    const d = w.data;
    lastBubble = {
      id: w.id, r: d[2], T: d[3], pb: d[4], pv: d[5], Tsat: tSat(d[4]), mv: d[6], ma: d[7], vx: d[8], vy: d[9], dmdt: d[10],
      attached: d[11] > 0.5, force: Array.from(d.subarray(12, 20)), x: d[0], y: d[1], Tl: d[20], fate: w.fate === 3 ? 'merged' : null
    };
    return lastBubble;
  }
  if (lastBubble !== null && (w.fate === 1 || w.fate === 2)) return { ...lastBubble, fate: w.fate === 1 ? 'burst' : 'collapsed' };
  return null;
}

function onReadout(r: Readout, now: number): void {
  if (gpu === null || charts === null) return;
  gpu.baselineFromLast();
  /* Heftige Zustände (extremes.ts): bei „ask“ anhalten und fragen, wie auf der CPU (nur ein Weilchen später — die Ablesung kommt fünfmal je Sekunde). */
  if (cpu !== null && r.stepsSince > 0) {
    cpu.extremes.observe(r.rmaxB, r.vmaxP, gpu.totals.time);
    const ev = cpu.extremes.take();
    if (ev !== null) { paused = true; acc = 0; pendingSteps = 0; post({ type: 'extreme', event: ev }); }
  }
  if (gpu.totals.time >= nextSample) {
    const s = charts.sample();
    if (s !== null) {
      pendingSamples.push(s);
      if (pendingSamples.length > 400) pendingSamples.splice(0, pendingSamples.length - 400);
      nextSample = gpu.totals.time + SAMPLE_EVERY;
    }
  }
  const span = Math.max(1e-3, (now - lastStats) / 1000);
  const stepMs = (r.stageMs ?? gpu.stageMs).reduce((a, b) => a + b, 0);
  const stats: HostStats = {
    engine: gpu.stats(stepMs),
    stepsPerSecond: stepsSince / span,
    simRate: (gpu.totals.time - statsSim) / span,
    fps: frames / span,
    renderMs: 0,
    mode: 'gpu',
    adapter,
    paused,
    samples: pendingSamples.splice(0, pendingSamples.length),
    bubble: bubbleView(r),
    /* Mit freien Körpern liegt ihre Lage nur auf der GPU: die Tafel des Gegenstands aus der Ablesung. */
    object: selectedObject !== null && cpu !== null ? (gpu.state.body ? objectViewGpu(cpu, selectedObject, r.bodies) : objectView(cpu, selectedObject)) : null,
    overlayScale: overlayScale(r)
  };
  post({ type: 'stats', stats });
  frames = 0;
  stepsSince = 0;
  statsSim = gpu.totals.time;
  lastStats = now;
}

function frame(): void {
  const now = performance.now();
  if (gpu !== null && renderer !== null && canvas !== null && cpu !== null && !busy) {
    const dev = gpu.ctx.device;
    const real = lastTick === 0 ? 0 : Math.min(0.1, (now - lastTick) / 1000);
    lastTick = now;
    const dt = gpu.last?.dt ?? cpu.dt;
    let steps = 0;
    if (paused) {
      steps = Math.min(MAX_STEPS, pendingSteps);
      pendingSteps -= steps;
      acc = 0;
    } else {
      acc = Math.min(acc + real * speed, MAX_LAG * Math.max(1, speed));
      steps = inflight >= MAX_INFLIGHT ? 0 : Math.min(MAX_STEPS, Math.floor(acc / Math.max(1e-5, dt)));
      acc -= steps * dt;
    }
    /* Am liebsten zusammen mit Schritten ablesen — nur dann misst sie die Zeiten der Stufen (bei 16× war die GPU voll,
       die Ablesung fiel immer auf Bilder ohne Schritte, und die Anzeige zeigte 0 ms); ohne Schritte nur in der Pause oder
       wenn es schon zu lange her ist. */
    const due = !readPending && now - lastStats > STATS_MS && (steps > 0 || paused || now - lastStats > 4 * STATS_MS);
    const enc = dev.createCommandEncoder();
    if (steps > 0) gpu.encodeSteps(enc, steps, due);
    const buf = due ? gpu.encodeReadback(enc, due && steps > 0) : null;
    renderer.encode(enc, view, canvas.width, canvas.height, walls, overlay, showParticles);
    dev.queue.submit([enc.finish()]);
    inflight += 1;
    void dev.queue.onSubmittedWorkDone().then(() => { inflight -= 1; });
    stepsSince += steps;
    frames += 1;
    if (buf !== null) {
      readPending = true;
      const timed = steps > 0;
      void gpu.finishReadback(buf, timed).then((r) => {
        readPending = false;
        if (r !== null) onReadout(r, performance.now());
      });
    }
  }
  if (typeof scope.requestAnimationFrame === 'function') scope.requestAnimationFrame(frame);
  else setTimeout(frame, 16);
}

async function init(m: Extract<HostMessage, { type: 'init' }>): Promise<void> {
  cpu = new Engine(m.scene);
  /* Live weiter aus einem Schlüsselbild eines Nachweises von der GPU (B): erst in die CPU-Engine, dann hoch. */
  const mirrorCharts = new Charts(cpu);
  if (m.resume !== undefined) restoreSnapshot(rootOf(cpu, mirrorCharts), m.resume);
  paused = m.paused === true;
  if (refuseCpuOnly()) return;
  canvas = m.canvas;
  if (canvas === null) throw new Error('no OffscreenCanvas');
  gpu = await GpuEngine.create(cpu);
  if (m.resume !== undefined) {
    seedFromMirror(gpu);
    nextSample = cpu.time;
    statsSim = cpu.time;
  }
  const info = await (async () => {
    try {
      const a = await scope.navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      const i = a?.info;
      return i === undefined ? '' : [i.vendor, i.architecture, i.description].filter(Boolean).join(' ');
    } catch { return ''; }
  })();
  adapter = info;
  renderer = new GpuRenderer(gpu, canvas);
  await renderer.init();
  theme(m.dark);
  charts = new GpuCharts(gpu);
  if (m.resume !== undefined) charts.copyFrom(mirrorCharts);
  gpu.ctx.device.addEventListener('uncapturederror', (e) => post({ type: 'error', message: `WebGPU: ${e.error.message}` }));
  void gpu.ctx.device.lost.then((l) => post({ type: 'gpu', ok: false, adapter, message: l.message || l.reason }));
  setWalls();
  resize(m.width, m.height, m.dpr);
  post({ type: 'gpu', ok: true, adapter, message: '' });
  post({ type: 'ready', offscreen: true, warnings: cpu.warnings, view, quality: cpu.currentQuality, walls });
  if (m.resume !== undefined) post({ type: 'live', t: cpu.time });
  lastStats = performance.now();
  lastTick = performance.now();
  if (!started) { started = true; frame(); }
  checkClipsSoon();
}

/** Neue Szene (Laden, andere Auflösung): alles neu auf der GPU. */
function restart(): void {
  if (gpu === null || cpu === null) return;
  const v = gpu.stateVersion;
  gpu.cpu = cpu;
  gpu.rebuild();
  gpu.resetTotals();
  afterUpload(v);
  charts = new GpuCharts(gpu);
  nextSample = 0;
  pendingSamples.length = 0;
  acc = 0;
  lastBubble = null;
  setWalls();
  resize(cssW, cssH, dpr);
  post({ type: 'view', view, walls });
  checkClipsSoon();
}

scope.addEventListener('message', (event) => {
  const m = event.data;
  try {
    switch (m.type) {
      case 'probe':
        post({ type: 'probe', webgl2: typeof OffscreenCanvas !== 'undefined' && scope.navigator.gpu !== undefined });
        break;
      case 'init':
        void init(m).catch((e: unknown) => post({ type: 'gpu', ok: false, adapter, message: e instanceof Error ? e.message : String(e) }));
        break;
      case 'resize':
        resize(m.width, m.height, m.dpr);
        post({ type: 'view', view, walls });
        break;
      case 'op':
        pendingOps.push(m.op);
        applyOps();
        break;
      case 'addLiquid':
        pendingOps.push({ op: 'fill', region: m.region, phase: 'liquid', T: m.T, composition: m.composition });
        applyOps();
        break;
      case 'addSolid':
        pendingOps.push({ op: 'solid', region: m.region, material: m.material, T: m.T });
        applyOps();
        break;
      case 'setHeater':
        cpu?.setHeater(m.group, m.mode, m.power, m.target, m.on);
        gpu?.writeHeater(m.group);
        checkClipsSoon();
        break;
      case 'setAmbient':
        cpu?.setAmbient(m.p, m.T, m.rh, m.g, m.air);
        gpu?.writeParams();
        checkClipsSoon();
        break;
      case 'setBoundary':
        task(async () => {
          if (gpu === null || cpu === null) return;
          await settleGpu();
          await gpu.download();
          cpu.setBoundary(m.side, m.value);
          const v = gpu.stateVersion;
          gpu.upload();
          afterUpload(v);
          setWalls();
          post({ type: 'view', view, walls });
          checkClipsSoon();
        });
        break;
      case 'query':
        task(async () => {
          if (gpu === null || cpu === null) { post({ type: 'reply', id: m.id, data: null }); return; }
          await settleGpu();
          await gpu.download();
          post({ type: 'reply', id: m.id, data: cpu.query(m.x, m.y) });
        });
        break;
      case 'select':
        lastBubble = null;
        gpu?.watch(m.bubble);
        break;
      case 'overlay':
        overlay = m.overlay;
        break;
      case 'particles':
        showParticles = m.on;
        break;
      case 'pause':
        paused = m.paused;
        acc = 0;
        lastTick = performance.now();
        break;
      case 'step':
        if (paused) pendingSteps += 1;
        break;
      case 'setSpeed':
        speed = Math.min(64, Math.max(0.05, m.speed));
        break;
      case 'setExtremes':
        cpu?.setExtremes(m.mode);
        gpu?.writeParams();
        checkClipsSoon();
        break;
      case 'setQuality':
        task(async () => { if (cpu === null) return; cpu.setQuality(m.quality); restart(); });
        break;
      case 'serialize':
        /* Hinter den wartenden Handgriffen: sonst fehlten die letzten Pinselstriche (Umschalten gleich nach dem Malen). */
        if (gpu === null) post({ type: 'reply', id: m.id, data: cpu?.serialize() ?? null });
        else task(async () => { post({ type: 'reply', id: m.id, data: cpu?.serialize() ?? null }); });
        break;
      case 'load':
        task(async () => { if (cpu === null) return; cpu.load(m.scene); if (refuseCpuOnly()) return; restart(); });
        break;
      case 'selectObject':
        selectedObject = m.object;
        break;
      case 'editObject':
        task(async () => {
          if (gpu === null || cpu === null) { post({ type: 'reply', id: m.id, data: null }); return; }
          await settleGpu();
          await gpu.download();
          const result = editObject(cpu, m.object, m.patch);
          post({ type: 'reply', id: m.id, data: result });
          if (refuseCpuOnly()) return;
          if (result.rebuilt) { restart(); return; }
          const v = gpu.stateVersion;
          gpu.upload();
          afterUpload(v);
          checkClipsSoon();
        });
        break;
      case 'theme':
        theme(m.dark);
        break;
      case 'frameDone':
        break;
    }
  } catch (e) {
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
  }
});
