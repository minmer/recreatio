/**
 * PARTIKEL-LABOR — DER ARBEITER: besitzt die Engine (und, wo der Browser es
 * kann, den Zeichner auf einer OffscreenCanvas). Je Bild läuft er so viele
 * Teilschritte (dt = 1/240 s), wie die vergangene Zeit mal Tempo verlangt —
 * höchstens so viele, wie in sein Zeitbudget passen (sonst läuft die Zeit
 * langsamer, und das HUD sagt es) — und zeichnet zwischen den letzten beiden
 * Teilschritten gemittelt. Kennzahlen gehen fünfmal je Sekunde zur Seite.
 */

import { Engine } from './engine/engine';
import type { HostMessage, HostStats, View, WorkerMessage } from './engine/protocol';
import { readScene } from './engine/scene';
import { ParticleRenderer } from './render/glRenderer';
import { snapshot } from './render/snapshot';
import { fitView } from './render/view';

const scope = self as unknown as {
  postMessage(message: WorkerMessage, options?: StructuredSerializeOptions): void;
  addEventListener(type: 'message', listener: (e: MessageEvent<HostMessage>) => void): void;
  requestAnimationFrame?: (cb: (t: number) => void) => number;
};

const post = (m: WorkerMessage, transfer?: Transferable[]): void => scope.postMessage(m, transfer === undefined ? undefined : { transfer });

/** Zeit je Bild für die Teilschritte (ms) — der Rest bleibt fürs Zeichnen und die Seite. */
const STEP_BUDGET = 12;

let engine: Engine | null = null;
let renderer: ParticleRenderer | null = null;
let canvas: OffscreenCanvas | null = null;
let cssW = 1;
let cssH = 1;
let dpr = 1;
let view: View = { x0: 0, y0: 0, x1: 1, y1: 1 };
let paused = false;
let speed = 1;
let showAir = true;
let pendingSteps = 0;
let acc = 0;
let last = 0;
let stepMs = 0.5;
let running = false;

/* Zeichenpuffer: im Arbeiter eigene; für das Zeichnen auf der Seite ein Satz, der hin und zurück wandert. */
interface Buffers { pos: Float32Array; size: Float32Array; col: Uint8Array }
const alloc = (n: number): Buffers => ({ pos: new Float32Array(2 * n), size: new Float32Array(n), col: new Uint8Array(4 * n) });
let own: Buffers = alloc(0);
let spare: Buffers | null = null;

/* Kennzahlen. */
let frames = 0;
let stepsDone = 0;
let simDone = 0;
let renderMs = 0;
let lastStats = 0;

function resize(w: number, h: number, ratio: number): void {
  cssW = Math.max(1, w);
  cssH = Math.max(1, h);
  dpr = Math.max(0.5, Math.min(3, ratio));
  if (canvas !== null) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  if (engine !== null) view = fitView(engine.boxW, engine.boxH, cssW, cssH, 2.5 * engine.s + 0.004);
}

function render(alpha: number): void {
  if (engine === null) return;
  const t0 = performance.now();
  const st = engine.store;
  if (renderer !== null && canvas !== null) {
    if (own.size.length < st.count) own = alloc(Math.ceil(st.count * 1.25));
    const n = snapshot(st, engine.s, alpha, showAir, own.pos, own.size, own.col);
    renderer.draw(n, own.pos, own.size, own.col, view, canvas.width, canvas.height);
  } else if (spare !== null) {
    let b = spare;
    spare = null;
    if (b.size.length < st.count) b = alloc(Math.ceil(st.count * 1.25));
    const n = snapshot(st, engine.s, alpha, showAir, b.pos, b.size, b.col);
    post({ type: 'frame', n, pos: b.pos, size: b.size, col: b.col, view }, [b.pos.buffer, b.size.buffer, b.col.buffer]);
  }
  renderMs += performance.now() - t0;
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
    paused
  };
  post({ type: 'stats', stats });
  frames = 0;
  stepsDone = 0;
  simDone = 0;
  renderMs = 0;
  lastStats = t;
}

function frame(t: number): void {
  if (engine === null) return;
  const real = last === 0 ? 0 : Math.min(0.1, (t - last) / 1000);
  last = t;
  const dt = engine.dt;
  let n = 0;
  if (!paused) {
    acc += real * speed;
    const most = Math.max(1, Math.floor(STEP_BUDGET / Math.max(0.02, stepMs)));
    n = Math.min(most, Math.floor(acc / dt));
    acc -= n * dt;
    /* Zu langsam für das verlangte Tempo: den Rückstand fallen lassen (die Zeit läuft langsamer, das HUD zeigt es). */
    if (acc > 2 * dt) acc %= dt;
  } else if (pendingSteps > 0) {
    n = pendingSteps;
    pendingSteps = 0;
    acc = 0;
  }
  if (n > 0) {
    const t0 = performance.now();
    for (let k = 0; k < n; k += 1) engine.step();
    stepMs = stepMs * 0.8 + ((performance.now() - t0) / n) * 0.2;
    stepsDone += n;
    simDone += n * dt;
  }
  render(paused ? 1 : Math.min(1, acc / dt));
  frames += 1;
  if (t - lastStats > 200) sendStats(t);
  schedule(t);
}

/** Das nächste Bild: im Takt des Bildschirms (rAF im Arbeiter), sonst so bald wie möglich, höchstens 60-mal je Sekunde. */
function schedule(started: number): void {
  if (renderer !== null && typeof scope.requestAnimationFrame === 'function') { scope.requestAnimationFrame(frame); return; }
  setTimeout(() => frame(performance.now()), Math.max(0, 16 - (performance.now() - started)));
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
        const { scene, warnings } = readScene(m.scene);
        engine = new Engine(scene);
        canvas = m.canvas;
        if (canvas !== null) {
          const gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: true, alpha: false }) as WebGL2RenderingContext | null;
          renderer = gl === null ? null : new ParticleRenderer(gl);
        }
        if (renderer === null) spare = alloc(Math.ceil(engine.store.count * 1.25));
        showAir = m.showAir;
        resize(m.width, m.height, m.dpr);
        post({ type: 'ready', offscreen: renderer !== null, warnings, view, quality: engine.quality });
        if (!running) { running = true; lastStats = performance.now(); schedule(lastStats); }
        break;
      }
      case 'resize':
        resize(m.width, m.height, m.dpr);
        post({ type: 'view', view });
        break;
      case 'op':
        engine?.apply(m.op);
        break;
      case 'setHeater': {
        const h = engine?.heaters.find((x) => x.group === m.group);
        if (h !== undefined) { h.mode = m.mode; h.power = m.power; h.target = m.target; h.on = m.on; }
        break;
      }
      case 'setAmbient':
      case 'setBoundary':
        /* M1c: Umgebung und offene Seiten zur Laufzeit. */
        break;
      case 'query':
        post({ type: 'reply', id: m.id, data: engine?.query(m.x, m.y) ?? null });
        break;
      case 'pause':
        paused = m.paused;
        acc = 0;
        break;
      case 'step':
        if (paused) pendingSteps += 1;
        break;
      case 'setSpeed':
        speed = Math.min(64, Math.max(0.05, m.speed));
        break;
      case 'setQuality':
        if (engine !== null) { engine.setQuality(m.quality); resize(cssW, cssH, dpr); post({ type: 'view', view }); }
        break;
      case 'showAir':
        showAir = m.show;
        break;
      case 'serialize':
        post({ type: 'reply', id: m.id, data: engine?.serialize() ?? null });
        break;
      case 'load':
        if (engine !== null) { engine.load(readScene(m.scene).scene); resize(cssW, cssH, dpr); post({ type: 'view', view }); }
        break;
      case 'frameDone':
        spare = { pos: m.pos, size: m.size, col: m.col };
        break;
    }
  } catch (e) {
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
  }
});
