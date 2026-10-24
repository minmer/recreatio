/**
 * LABOR 2D (v2) — DER ARBEITER: besitzt die Engine (und, wo der Browser es
 * kann, den Zeichner auf einer OffscreenCanvas). Zwei Takte, die einander
 * nicht bremsen (wie im Teilchenlabor v1):
 *
 * - Die Schritte (Δt ≤ 1/120 s, kürzer, wenn Wasser schnell fliesst) laufen in
 *   kurzen Happen: so viele, wie die vergangene Zeit mal Tempo verlangt. Kommt
 *   der Rechner nicht nach, laufen sie ohne Pause — die Zeit läuft langsamer,
 *   und die Oberfläche sagt es.
 * - Gezeichnet wird im Takt des Bildschirms (rAF im Arbeiter); ohne
 *   OffscreenCanvas geht höchstens 60-mal je Sekunde ein Bild zur Seite. Ein
 *   voller Faden lässt rAF nicht mehr zu Wort kommen (Chromium) — dann
 *   zeichnen die Happen selbst.
 *
 * Kennzahlen und neue Proben der Schreiber gehen fünfmal je Sekunde zur Seite.
 *
 * Nachweise (B, clip/session.ts): beim Backen rechnen die Happen ohne Pause
 * und ohne zu zeichnen (alle 0,3 s ein Vorschaubild), bei der Wiedergabe
 * rechnet nichts — das Bild kommt aus dem Nachweis. Das Labor beginnt ruhend
 * (init.paused): es startet nie von selbst.
 */

import { ClipSession } from './clip/session';
import { Charts } from './engine/charts';
import { Engine } from './engine/engine';
import { editObject, objectView } from './engine/objects';
import type { BubbleView, ChartSample, HostMessage, HostStats, WorkerMessage } from './engine/protocol';
import { allocFrame, buildFrame, frameFits, frameFitsLayers, frameFromLayers, frameTransfer, type FrameBuffers, type Overlay } from './render/frame';
import type { Layers } from './render/layers';
import { LabRenderer, type Walls } from './render/glRenderer';
import { fitView, type View } from './render/view';

const scope = self as unknown as {
  postMessage(message: WorkerMessage, options?: StructuredSerializeOptions): void;
  addEventListener(type: 'message', listener: (e: MessageEvent<HostMessage>) => void): void;
  requestAnimationFrame?: (cb: (t: number) => void) => number;
};

const post = (m: WorkerMessage, transfer?: Transferable[]): void => scope.postMessage(m, transfer === undefined ? undefined : { transfer });

const CHUNK_MS = 6;
const MAX_LAG = 0.1;
const FRAME_MS = 16;
const DRAW_GAP_MS = 16;
const BEAT_GAP_MS = 4;
/** Probe der Schreiber alle so viele Sekunden Simulationszeit. */
const SAMPLE_EVERY = 0.25;

let engine: Engine | null = null;
let charts: Charts | null = null;
let session: ClipSession | null = null;
/* Bei der Wiedergabe nur neu zeichnen, wenn sich Bild, Einblendung oder Grösse ändern. */
let shown = '';
let lastBeat = 0;
let renderer: LabRenderer | null = null;
let canvas: OffscreenCanvas | null = null;
let cssW = 1;
let cssH = 1;
let dpr = 1;
let view: View = { x0: 0, y0: 0, x1: 1, y1: 1 };
let walls: Walls = { left: true, right: true, bottom: true, top: false };
let paused = false;
let speed = 1;
let overlay: Overlay = 'none';
/** Der letzte Zustand der gewählten Blase (nach ihrem Ende bleibt er stehen, mit dem, was aus ihr wurde). */
let lastBubble: BubbleView | null = null;
/** Der gewählte Gegenstand (sein Name) — seine Daten gehen mit den Kennzahlen. */
let selectedObject: string | null = null;
/** Die Skala der Einblendung im zuletzt gezeichneten Bild (für die Legende). */
const scale: [number, number, number] = [0, 1, 0];
/** Die rohen Teilchen zeigen (statt der glatten Fläche). */
let showParticles = false;
let pendingSteps = 0;
let acc = 0;
let lastTick = 0;
let lastDraw = 0;
let behind = false;
let started = false;
let nextSample = 0;
const pendingSamples: ChartSample[] = [];

const pump = new MessageChannel();
let pumped = false;
let timer: ReturnType<typeof setTimeout> | null = null;

let own: FrameBuffers = allocFrame(0, 0, 0);
const spares: FrameBuffers[] = [];

let frames = 0;
let stepsDone = 0;
let simDone = 0;
let renderMs = 0;
let lastStats = 0;

function setWalls(): void {
  if (engine === null) return;
  const s = engine.scene.sides;
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
  if (engine !== null) view = fitView(engine.boxW, engine.boxH, cssW, cssH, 0.006);
}

function fresh(): FrameBuffers {
  if (engine === null) return allocFrame(0, 0, 0);
  return allocFrame(engine.grid.nx, engine.grid.ny, Math.max(64, Math.ceil(engine.bubbles.count * 1.5)), showParticles ? Math.ceil(engine.particles.count * 1.25) + 64 : 0);
}

/** Was jetzt zu zeichnen ist, wenn nicht die Engine: das Bild der Wiedergabe oder eine Vorschau beim Backen (undefined: live; null: nichts Neues). */
function clipLayers(): Layers | null | undefined {
  if (session === null || session.mode === 'live') return undefined;
  if (session.mode === 'baking') return session.preview();
  const L = session.current();
  if (L === null) return null;
  const key = `${L.t}|${overlay}|${cssW}x${cssH}`;
  if (key === shown) return null;
  shown = key;
  return L;
}

function fromLayers(f: FrameBuffers, L: Layers): FrameBuffers {
  const out = frameFitsLayers(f, L) ? f : allocFrame(L.nx, L.ny, Math.max(64, Math.ceil(L.nb * 1.5)), 0);
  frameFromLayers(L, out, overlay);
  return out;
}

function render(): boolean {
  if (engine === null) return false;
  const L = clipLayers();
  if (L === null) return false;
  const t0 = performance.now();
  if (renderer !== null && canvas !== null) {
    if (L !== undefined) own = fromLayers(own, L);
    else {
      if (!frameFits(own, engine, showParticles)) own = fresh();
      buildFrame(engine, own, overlay, showParticles);
    }
    scale[0] = own.scaleLo;
    scale[1] = own.scaleHi;
    scale[2] = own.vLiq;
    renderer.draw(own, view, canvas.width, canvas.height, walls, 0.003);
  } else if (spares.length > 0) {
    let f = spares.pop() as FrameBuffers;
    if (L !== undefined) f = fromLayers(f, L);
    else {
      if (!frameFits(f, engine, showParticles)) f = fresh();
      buildFrame(engine, f, overlay, showParticles);
    }
    scale[0] = f.scaleLo;
    scale[1] = f.scaleHi;
    scale[2] = f.vLiq;
    post({ type: 'frame', frame: f, view, walls }, frameTransfer(f));
  } else return false;
  renderMs += performance.now() - t0;
  return true;
}

function bubbleView(): HostStats['bubble'] {
  if (engine === null) return null;
  const bm = engine.bubbleModel;
  const b = bm.watch >= 0 ? engine.bubbles.find(bm.watch) : -1;
  if (b >= 0) {
    const d = bm.describe(b);
    if (d === null) return null;
    const c = engine.grid.cellAt(engine.bubbles.x[b], engine.bubbles.y[b]);
    lastBubble = { ...d, x: engine.bubbles.x[b], y: engine.bubbles.y[b], Tl: c >= 0 ? engine.phase.Tl[c] : 0, fate: bm.watchFate === 3 ? 'merged' : null };
    return lastBubble;
  }
  if (lastBubble !== null && (bm.watchFate === 1 || bm.watchFate === 2)) return { ...lastBubble, fate: bm.watchFate === 1 ? 'burst' : 'collapsed' };
  return null;
}

function select(id: number | null): void {
  lastBubble = null;
  if (engine === null) return;
  engine.bubbleModel.watch = id ?? -1;
  engine.bubbleModel.watchFate = 0;
}

function sendStats(t: number): void {
  if (engine === null) return;
  const span = Math.max(1e-3, (t - lastStats) / 1000);
  const stats: HostStats = {
    engine: engine.stats(),
    stepsPerSecond: stepsDone / span,
    simRate: simDone / span,
    fps: frames / span,
    renderMs: frames > 0 ? renderMs / frames : 0,
    mode: renderer !== null ? 'worker' : 'main',
    paused,
    samples: pendingSamples.splice(0, pendingSamples.length),
    bubble: bubbleView(),
    object: selectedObject !== null ? objectView(engine, selectedObject) : null,
    overlayScale: [scale[0], scale[1], scale[2]],
    clip: session?.stats() ?? null
  };
  post({ type: 'stats', stats });
  frames = 0;
  stepsDone = 0;
  simDone = 0;
  renderMs = 0;
  lastStats = t;
}

function wake(ms: number): void {
  if (ms > 0.5) {
    if (timer === null && !pumped) timer = setTimeout(() => { timer = null; tick(); }, ms);
    return;
  }
  if (timer !== null) { clearTimeout(timer); timer = null; }
  if (!pumped) { pumped = true; pump.port2.postMessage(null); }
}
pump.port1.onmessage = () => { pumped = false; tick(); };

function oneStep(): void {
  if (engine === null || charts === null) return;
  const dt = engine.dt;
  engine.step();
  stepsDone += 1;
  simDone += dt;
  /* Ein heftiger Zustand bei „ask“ (extremes.ts): anhalten und fragen — die Antwort kommt als setExtremes. */
  const ev = engine.extremes.take();
  if (ev !== null) { paused = true; acc = 0; post({ type: 'extreme', event: ev }); }
  if (engine.time >= nextSample) {
    nextSample = engine.time + SAMPLE_EVERY;
    pendingSamples.push(charts.sample());
    if (pendingSamples.length > 400) pendingSamples.splice(0, pendingSamples.length - 400);
  }
}

function tick(): void {
  if (engine === null) return;
  /* Backen: Happen ohne Pause (die Nachrichten kommen zwischen ihnen durch); bei der Wiedergabe rechnet nichts. */
  if (session !== null && session.mode !== 'live') {
    if (session.mode === 'baking' && session.slice()) wake(0);
    lastTick = performance.now();
    /* Ein voller Faden lässt rAF nicht zu Wort kommen: dann zeichnen (Vorschau) und melden die Happen selbst. */
    if (lastTick - lastDraw >= DRAW_GAP_MS) draw(lastTick);
    return;
  }
  const t = performance.now();
  const real = lastTick === 0 ? 0 : Math.min(0.1, (t - lastTick) / 1000);
  lastTick = t;
  if (paused) {
    for (; pendingSteps > 0; pendingSteps -= 1) oneStep();
    acc = 0;
  } else {
    acc = Math.min(acc + real * speed, MAX_LAG * Math.max(1, speed));
    while (acc >= engine.dt) {
      const dt = engine.dt;
      oneStep();
      acc -= dt;
      if (performance.now() - t >= CHUNK_MS) break;
    }
  }
  behind = !paused && acc >= engine.dt;
  const now = performance.now();
  if (now - lastDraw >= DRAW_GAP_MS) draw(now);
  if (!paused) wake(acc >= engine.dt ? 0 : ((engine.dt - acc) / speed) * 1000);
}

function draw(t: number): void {
  if (engine === null) return;
  lastDraw = t;
  if (render()) frames += 1;
  if (t - lastStats > 200) sendStats(t);
}

function frame(): void {
  const beat = performance.now();
  /* Die Uhr der Wiedergabe läuft mit den Bildern des Bildschirms. */
  if (session !== null) session.advance(lastBeat === 0 ? 0 : Math.min(0.1, (beat - lastBeat) / 1000));
  lastBeat = beat;
  if (beat - lastDraw >= (behind ? DRAW_GAP_MS : BEAT_GAP_MS)) draw(beat);
  if (renderer !== null && typeof scope.requestAnimationFrame === 'function') scope.requestAnimationFrame(frame);
  else setTimeout(frame, Math.max(0, FRAME_MS - (performance.now() - beat)));
}

function theme(dark: boolean): void {
  if (renderer === null) return;
  renderer.ground = dark ? [0.1, 0.12, 0.15] : [0.93, 0.95, 0.97];
  renderer.outside = dark ? [0.06, 0.07, 0.09] : [0.86, 0.88, 0.9];
  renderer.wall = dark ? [0.55, 0.6, 0.66] : [0.42, 0.46, 0.5];
  renderer.ink = dark ? [0.9, 0.93, 0.96] : [0.08, 0.1, 0.12];
}

/** Nach einem neuen Aufbau der Engine: Ansicht, Wände, Puffer (die Schreiber bleiben, wie sie sind). */
function rebuilt(): void {
  if (engine === null) return;
  nextSample = engine.time;
  acc = 0;
  shown = '';
  select(null);
  setWalls();
  resize(cssW, cssH, dpr);
  if (renderer === null) { spares.length = 0; spares.push(fresh(), fresh()); }
  post({ type: 'view', view, walls });
}

function restart(): void {
  if (engine === null) return;
  charts = new Charts(engine);
  pendingSamples.length = 0;
  rebuilt();
  session?.checkSoon();
}

/** Ein Handgriff ändert die Szene — nur live (bei Wiedergabe und Backen gehört das Bild dem Nachweis). */
function live(): Engine | null {
  return session !== null && session.mode !== 'live' ? null : engine;
}

scope.addEventListener('message', (event) => {
  const m = event.data;
  try {
    switch (m.type) {
      case 'probe': {
        let ok = false;
        try { ok = typeof OffscreenCanvas !== 'undefined' && new OffscreenCanvas(1, 1).getContext('webgl2') !== null; } catch { ok = false; }
        post({ type: 'probe', webgl2: ok });
        break;
      }
      case 'init': {
        engine = new Engine(m.scene);
        charts = new Charts(engine);
        paused = m.paused === true;
        session = new ClipSession({
          engine: () => engine as Engine,
          charts: () => charts as Charts,
          setCharts: (c) => { charts = c; pendingSamples.length = 0; },
          post: (msg) => post(msg),
          rebuilt,
          wake: () => wake(0)
        });
        canvas = m.canvas;
        if (canvas !== null) {
          const gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: true, alpha: false }) as WebGL2RenderingContext | null;
          renderer = gl === null ? null : new LabRenderer(gl);
          theme(m.dark);
        }
        if (renderer === null) { spares.length = 0; spares.push(fresh(), fresh()); }
        setWalls();
        resize(m.width, m.height, m.dpr);
        post({ type: 'ready', offscreen: renderer !== null, warnings: engine.warnings, view, quality: engine.currentQuality, walls });
        if (!started) { started = true; lastStats = performance.now(); frame(); }
        lastTick = performance.now();
        void session.check();
        wake(0);
        break;
      }
      case 'resize':
        resize(m.width, m.height, m.dpr);
        post({ type: 'view', view, walls });
        break;
      case 'op': {
        const warning = live()?.apply(m.op) ?? null;
        if (warning !== null && warning.startsWith('refused')) post({ type: 'refused', message: warning });
        session?.checkSoon();
        break;
      }
      case 'addLiquid': {
        const warning = live()?.apply({ op: 'fill', region: m.region, phase: 'liquid', T: m.T, composition: m.composition }) ?? null;
        if (warning !== null && warning.startsWith('refused')) post({ type: 'refused', message: warning });
        session?.checkSoon();
        break;
      }
      case 'addSolid':
        live()?.apply({ op: 'solid', region: m.region, material: m.material, T: m.T });
        session?.checkSoon();
        break;
      case 'setHeater':
        live()?.setHeater(m.group, m.mode, m.power, m.target, m.on);
        session?.checkSoon();
        break;
      case 'setAmbient':
        live()?.setAmbient(m.p, m.T, m.rh, m.g, m.air);
        session?.checkSoon();
        break;
      case 'setBoundary':
        if (live() === null) break;
        engine?.setBoundary(m.side, m.value);
        setWalls();
        post({ type: 'view', view, walls });
        session?.checkSoon();
        break;
      case 'query':
        post({ type: 'reply', id: m.id, data: engine?.query(m.x, m.y) ?? null });
        break;
      case 'select':
        select(m.bubble);
        break;
      case 'selectObject':
        selectedObject = m.object;
        break;
      case 'editObject': {
        const e = live();
        const result = e === null ? { rebuilt: false, warning: 'refused: not live' } : editObject(e, m.object, m.patch);
        if (result.rebuilt) restart();
        post({ type: 'reply', id: m.id, data: result });
        session?.checkSoon();
        break;
      }
      case 'overlay':
        overlay = m.overlay;
        shown = '';
        break;
      case 'particles':
        showParticles = m.on;
        break;
      case 'pause':
        paused = m.paused;
        acc = 0;
        lastTick = performance.now();
        if (!paused) wake(0);
        break;
      case 'step':
        if (paused) { pendingSteps += 1; wake(0); }
        break;
      case 'setSpeed':
        speed = Math.min(64, Math.max(0.05, m.speed));
        if (session !== null) session.speed = Math.min(16, Math.max(0.05, m.speed));
        if (!paused) wake(0);
        break;
      case 'setExtremes':
        if (live() !== null) { engine?.setExtremes(m.mode); session?.checkSoon(); }
        break;
      case 'setQuality':
        if (engine !== null && live() !== null) { engine.setQuality(m.quality); restart(); }
        break;
      case 'serialize':
        post({ type: 'reply', id: m.id, data: engine?.serialize() ?? null });
        break;
      case 'load':
        if (engine !== null && session?.mode !== 'baking') {
          if (session?.mode === 'playback') session.close();
          engine.load(m.scene);
          restart();
        }
        break;
      case 'bake':
        void session?.bake(m.options);
        break;
      case 'bakeStop':
        session?.stopBake();
        break;
      case 'clipOpen':
        shown = '';
        void session?.open(m.play);
        break;
      case 'clipPlay':
        session?.play(m.playing);
        break;
      case 'clipSeek':
        session?.seek(m.t);
        break;
      case 'clipLoop':
        if (session !== null) session.loop = m.on;
        break;
      case 'clipLive':
        void session?.live().then(() => { paused = true; acc = 0; lastTick = performance.now(); });
        break;
      case 'clipClose':
        session?.close();
        session?.checkSoon();
        break;
      case 'clipDelete':
        void session?.remove();
        break;
      case 'theme':
        theme(m.dark);
        shown = '';
        break;
      case 'frameDone':
        spares.push(m.frame);
        break;
    }
  } catch (e) {
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
  }
});

