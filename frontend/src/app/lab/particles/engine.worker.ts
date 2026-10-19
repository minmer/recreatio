/**
 * PARTIKEL-LABOR — DER ARBEITER: besitzt die Engine (und, wo der Browser es
 * kann, den Zeichner auf einer OffscreenCanvas). Zwei Takte, die einander
 * nicht bremsen:
 *
 * - Die Teilschritte (dt = 1/240 s) laufen in kurzen Happen: so viele, wie die
 *   vergangene Zeit mal Tempo verlangt. Kommt der Rechner nicht nach, laufen
 *   sie ohne Pause, so viele der Faden schafft — die Zeit läuft dann langsamer,
 *   und HUD und Oberfläche sagen es.
 * - Gezeichnet wird im Takt des Bildschirms (rAF im Arbeiter), gemittelt
 *   zwischen den letzten beiden Teilschritten; ohne OffscreenCanvas geht ein
 *   Abbild höchstens 60-mal je Sekunde zur Seite. Ein voller Faden lässt den
 *   Bildschirmtakt nicht mehr zu Wort kommen (Chromium ruft rAF im Arbeiter
 *   nicht, solange Nachrichten anstehen) — dann zeichnen die Happen selbst,
 *   etwa 60-mal je Sekunde.
 *
 * So nutzt ein schneller Rechner seinen Faden ganz, auch an einem Bildschirm
 * mit 144 Hz (an die Bilder gebunden bekäme jedes Bild nur einen Schritt).
 * Kennzahlen gehen fünfmal je Sekunde zur Seite.
 */

import { Engine } from './engine/engine';
import type { HostMessage, HostStats, View, WorkerMessage } from './engine/protocol';
import { SharedRunner } from './engine/runner';
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

/** Längster Happen Teilschritte am Stück (ms) — dazwischen kommen Zeichnen und Befehle dran. */
const CHUNK_MS = 4;
/** Höchstens so viel Rückstand (s Simulationszeit je Tempo 1): was der Rechner darüber hinaus nicht schafft, fällt weg. */
const MAX_LAG = 0.1;
/** Takt der Bilder, wenn die Seite zeichnet (ms). */
const FRAME_MS = 16;
/** So alt (ms) darf das letzte Bild werden, dann zeichnen die Happen selbst (der Takt der Bilder bleibt aus, wenn der Faden voll ist). */
const DRAW_GAP_MS = 16;
/** Der Takt der Bilder zeichnet, wenn das letzte Bild mindestens so alt ist (ms) — hängt die Simulation nach, nur etwa 60-mal je Sekunde (der Faden gehört den Schritten). */
const BEAT_GAP_MS = 4;

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
let lastTick = 0;
let lastDraw = 0;
/** Nach dem letzten Happen waren noch Schritte offen (der Rechner kommt nicht nach). */
let behind = false;
let started = false;

/* Der Takt der Teilschritte: ein Kanal für „gleich weiter“ (ohne die Mindestwartezeit der Zeitgeber), ein Zeitgeber für „wenn der nächste fällig ist“. */
const pump = new MessageChannel();
let pumped = false;
let timer: ReturnType<typeof setTimeout> | null = null;

/* Zeichenpuffer: im Arbeiter eigene; für das Zeichnen auf der Seite zwei Sätze, die hin und zurück wandern (einer ist unterwegs, der andere schon frei). */
interface Buffers { pos: Float32Array; size: Float32Array; col: Uint8Array }
const alloc = (n: number): Buffers => ({ pos: new Float32Array(2 * n), size: new Float32Array(n), col: new Uint8Array(4 * n) });
let own: Buffers = alloc(0);
const spares: Buffers[] = [];

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

/** Ein Bild: im Arbeiter gezeichnet oder als Abbild zur Seite geschickt (nur, wenn ein Puffer frei ist). */
function render(alpha: number): boolean {
  if (engine === null) return false;
  const t0 = performance.now();
  const st = engine.store;
  if (renderer !== null && canvas !== null) {
    if (own.size.length < st.count) own = alloc(Math.ceil(st.count * 1.25));
    const n = snapshot(st, engine.s, alpha, showAir, own.pos, own.size, own.col);
    renderer.draw(n, own.pos, own.size, own.col, view, canvas.width, canvas.height);
  } else if (spares.length > 0) {
    let b = spares.pop() as Buffers;
    if (b.size.length < st.count) b = alloc(Math.ceil(st.count * 1.25));
    const n = snapshot(st, engine.s, alpha, showAir, b.pos, b.size, b.col);
    post({ type: 'frame', n, pos: b.pos, size: b.size, col: b.col, view }, [b.pos.buffer, b.size.buffer, b.col.buffer]);
  } else return false;
  renderMs += performance.now() - t0;
  return true;
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

/* -- Teilschritte ---------------------------------------------------------------------------------------- */

/** Den nächsten Happen bestellen: gleich (es sind noch Schritte offen) oder in `ms` (wenn der nächste fällig ist). */
function wake(ms: number): void {
  if (ms > 0.5) {
    if (timer === null && !pumped) timer = setTimeout(() => { timer = null; tick(); }, ms);
    return;
  }
  if (timer !== null) { clearTimeout(timer); timer = null; }
  if (!pumped) { pumped = true; pump.port2.postMessage(null); }
}
pump.port1.onmessage = () => { pumped = false; tick(); };

function tick(): void {
  if (engine === null) return;
  const t = performance.now();
  const real = lastTick === 0 ? 0 : Math.min(0.1, (t - lastTick) / 1000);
  lastTick = t;
  const dt = engine.dt;
  let n = 0;
  if (paused) {
    /* Angehalten: nur die bestellten Einzelschritte. */
    for (; pendingSteps > 0; pendingSteps -= 1) { engine.step(); n += 1; }
    acc = 0;
  } else {
    acc = Math.min(acc + real * speed, MAX_LAG * Math.max(1, speed));
    while (acc >= dt) {
      engine.step();
      acc -= dt;
      n += 1;
      if (performance.now() - t >= CHUNK_MS) break;
    }
  }
  stepsDone += n;
  simDone += n * dt;
  behind = !paused && acc >= dt;
  const now = performance.now();
  if (now - lastDraw >= DRAW_GAP_MS) draw(now);
  if (!paused) wake(acc >= dt ? 0 : ((dt - acc) / speed) * 1000);
}

/* -- Zeichnen ---------------------------------------------------------------------------------------------- */

function draw(t: number): void {
  if (engine === null) return;
  lastDraw = t;
  if (render(paused ? 1 : Math.min(1, acc / engine.dt))) frames += 1;
  if (t - lastStats > 200) sendStats(t);
}

/** Im Takt des Bildschirms (rAF im Arbeiter); ohne eigenen Zeichner etwa 60-mal je Sekunde. */
function frame(): void {
  const beat = performance.now();
  if (beat - lastDraw >= (behind ? DRAW_GAP_MS : BEAT_GAP_MS)) draw(beat);
  if (renderer !== null && typeof scope.requestAnimationFrame === 'function') scope.requestAnimationFrame(frame);
  else setTimeout(frame, Math.max(0, FRAME_MS - (performance.now() - beat)));
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
        /* Mit Helfern (die Seite ist isoliert): Felder auf gemeinsamem Speicher, die Kerne in Stücken über alle. */
        engine = m.helpers.length > 0 ? new Engine(scene, { runner: new SharedRunner(m.helpers), shared: true }) : new Engine(scene);
        canvas = m.canvas;
        if (canvas !== null) {
          const gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: true, alpha: false }) as WebGL2RenderingContext | null;
          renderer = gl === null ? null : new ParticleRenderer(gl);
        }
        if (renderer === null) { spares.length = 0; spares.push(alloc(Math.ceil(engine.store.count * 1.25)), alloc(Math.ceil(engine.store.count * 1.25))); }
        showAir = m.showAir;
        resize(m.width, m.height, m.dpr);
        post({ type: 'ready', offscreen: renderer !== null, warnings, view, quality: engine.quality });
        if (!started) { started = true; lastStats = performance.now(); frame(); }
        lastTick = performance.now();
        wake(0);
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
        lastTick = performance.now();
        if (!paused) wake(0);
        break;
      case 'step':
        if (paused) { pendingSteps += 1; wake(0); }
        break;
      case 'setSpeed':
        speed = Math.min(64, Math.max(0.05, m.speed));
        if (!paused) wake(0);
        break;
      case 'setQuality':
        if (engine !== null) { engine.setQuality(m.quality); acc = 0; resize(cssW, cssH, dpr); post({ type: 'view', view }); }
        break;
      case 'showAir':
        showAir = m.show;
        break;
      case 'serialize':
        post({ type: 'reply', id: m.id, data: engine?.serialize() ?? null });
        break;
      case 'load':
        if (engine !== null) { engine.load(readScene(m.scene).scene); acc = 0; resize(cssW, cssH, dpr); post({ type: 'view', view }); }
        break;
      case 'frameDone':
        spares.push({ pos: m.pos, size: m.size, col: m.col });
        break;
    }
  } catch (e) {
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
  }
});
