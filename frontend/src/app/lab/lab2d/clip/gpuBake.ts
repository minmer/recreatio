/**
 * LABOR 2D (v2) — BACKEN MIT DER GRAFIKKARTE (B, seit 2026-10-25): derselbe
 * Nachweis wie Baker (clip.ts) — dieselben Ebenen, Stücke, Schlüsselbilder,
 * Proben der Schreiber —, aber die Schritte rechnet die GPU (gpu/engine.ts)
 * und die Bilder nimmt sie selbst auf (gpu/capture.ts): genau die Bytes, die
 * sampleLayers aus dem Zustand der GPU nähme. Abgespielt wird wie jeder
 * Nachweis (Player, unverändert).
 *
 * - Bündel zu 8 Schritten, nach jedem Schritt die Aufnahme, am Ende Uhr,
 *   Köpfe und Plätze und die übliche Ablesung in Zwischenpuffer; höchstens
 *   drei Bündel unterwegs, der Reihe nach verarbeitet — nie wird auf einen
 *   Schritt gewartet, und das Warten weckt den Arbeiter, statt zu kreisen.
 * - Bild 0 und Schlüsselbild 0 kommen von der CPU-Engine (der Anfang der
 *   Szene, genau wie beim Backen auf der CPU).
 * - Schlüsselbilder „träge“: zeigt ein Bündel, dass das Bild des nächsten
 *   Schlüsselbilds aufgenommen ist, werden die Bündel geleert, der Zustand in
 *   die CPU-Engine geholt (GpuState.download), die Marken der Schreiber
 *   übernommen, die Bilanzen auf die Abweichungen der GPU gesetzt
 *   (Engine.rebaseline — sonst zeigte ein Schlüsselbild den Versatz der
 *   Treppen, +5,8 J nach 5 s) und aufgenommen. Es trägt das zuletzt
 *   aufgenommene Bild; der Zustand liegt weniger als ein Bild danach.
 * - Am Ende rechnet die GPU nicht weit über das letzte Bild hinaus (die
 *   Bündel werden kürzer); was sie noch aufnahm, kommt mit (ein paar Bilder
 *   mehr), dazu das letzte Schlüsselbild.
 *
 * Ein Nachweis von der GPU ist nicht wiederholbar (atomare Summen in f32):
 * „Na żywo od tej chwili“ geht ab dem Schlüsselbild davor weiter, nicht ab dem
 * gezeigten Bild (session.ts). Verliert der Browser die Karte mitten im
 * Backen, bleibt, was aufgenommen ist (wie beim Abbrechen).
 */

import type { Charts } from '../engine/charts';
import type { Engine } from '../engine/engine';
import type { ChartSample } from '../engine/protocol';
import { Capture, emptyLayers } from '../gpu/capture';
import { CAPTURE_KERNELS, HEAD_WORDS } from '../gpu/captureKernels';
import { GpuCharts } from '../gpu/charts';
import { GpuEngine } from '../gpu/engine';
import type { GpuCtx } from '../gpu/kernel';
import { allocLayers, sampleLayers, type Layers } from '../render/layers';
import { CLIP_FORMAT, CLIP_VERSION, rootOf, type Baked, type ClipHeader } from './clip';
import { ChunkWriter, OVERLAY_EVERY, pack } from './codec';
import { layoutOf, takeSnapshot } from './snapshot';

/** Schritte je Bündel, Bündel unterwegs, Probe der Schreiber (s), Kopie für die Vorschau (ms). */
const BATCH = 8;
const INFLIGHT = 3;
const SAMPLE_EVERY = 0.25;
const PREVIEW_MS = 250;

/** Gerät und Kerne samt denen der Aufnahme (beim Öffnen des Fensters schon vorbereitet; wirft ohne WebGPU oder bei einem Fehler im Übersetzen). */
export function prepareGpu(): Promise<GpuCtx> {
  return GpuEngine.prepare(CAPTURE_KERNELS);
}

/** Die Abweichungen der Bilanzen (J, kg). */
export interface BudgetErrors { readonly energy: number; readonly water: number; readonly other: number; readonly salt: number }

/** Prüfstand (G31, G33): bei jedem Schlüsselbild, wenn die CPU-Engine den Zustand der GPU hält — vor dem Aufnehmen. */
export interface KeyProbe {
  readonly frame: number;
  readonly e: Engine;
  readonly gpu: GpuEngine;
  readonly errors: BudgetErrors;
  /** Das Bild des Zustands jetzt, von den Kernen der Aufnahme (alle Ebenen). */
  readonly probe: () => Promise<Layers>;
}

export class GpuBaker {
  readonly e: Engine;
  readonly charts: Charts;
  readonly seconds: number;
  readonly fps: number;
  readonly total: number;
  readonly chunkFrames: number;
  readonly keyFrames: number;
  frames = 0;
  /** Prüfstand: nach jedem Bild (die Ebenen gelten nur während des Aufrufs) und bei jedem Schlüsselbild. */
  onFrame: ((k: number, L: Layers) => void) | null = null;
  onKey: ((k: KeyProbe) => Promise<void>) | null = null;
  /** Warum die GPU aufhörte (Gerät verloren, Fehler), sonst null. */
  lost: string | null = null;
  /** Gemessen: Halt je Schlüsselbild (ms), verlorene Bilder (sollte 0 bleiben), CPU-Zeit beim Verarbeiten der Bilder (ms), Rechenzeit (ms). */
  readonly keyStallMs: number[] = [];
  lostFrames = 0;
  cpuMs = 0;
  computeMs = 0;
  readonly gpu: GpuEngine;
  private readonly capture: Capture;
  private readonly gcharts: GpuCharts;
  private readonly key: string;
  private readonly scene: Record<string, unknown>;
  private readonly layout: string;
  private writer: ChunkWriter;
  private readonly chunks: Promise<Uint8Array>[] = [];
  private readonly keys: { frame: number; t: number; data: Promise<Uint8Array> }[] = [];
  private readonly samples: ChartSample[] = [];
  private nextSample = 0;
  private nextKey: number;
  /** Aufgenommene Bilder laut der letzten Ablesung (die Nummer des nächsten), aufgezeichnete Schritte. */
  private captured = 1;
  private issued = 0;
  private stopping = false;
  private released = false;
  private chain: Promise<void> = Promise.resolve();
  private readonly inflight: Promise<void>[] = [];
  private readonly free: GPUBuffer[] = [];
  private readonly view = emptyLayers();
  /** Die Vorschau: zuerst Bild 0 (von der CPU), dann alle 0,25 s eine Kopie eines Bildes mit Einblendungen. */
  private preview: Layers;
  private readonly previewView = emptyLayers();
  private previewBuf: ArrayBuffer | null = null;
  private previewQuads = new Uint16Array(0);
  private previewAt = 0;

  private constructor(gpu: GpuEngine, e: Engine, charts: Charts, scene: Record<string, unknown>, key: string, seconds: number, fps: number, keyEvery: number) {
    this.gpu = gpu;
    this.e = e;
    this.charts = charts;
    this.scene = scene;
    this.key = key;
    this.seconds = seconds;
    this.fps = Math.max(1, Math.round(fps));
    this.chunkFrames = 2 * this.fps;
    this.keyFrames = Math.max(1, Math.round(keyEvery * this.fps));
    this.total = Math.round(seconds * this.fps) + 1;
    this.nextKey = this.keyFrames;
    this.layout = layoutOf(rootOf(e, charts));
    this.writer = new ChunkWriter(e.grid.nx, e.grid.ny, e.grid.dx);
    /* Bild 0 und Schlüsselbild 0: der Anfang der Szene, von der CPU-Engine (vor jedem Schritt). */
    const L0 = allocLayers(e.grid.nx, e.grid.ny, e.grid.dx, Math.max(64, Math.ceil(1.5 * e.bubbles.count)));
    sampleLayers(e, L0, null);
    this.writer.add(L0);
    this.frames = 1;
    this.preview = L0;
    this.keys.push({ frame: 0, t: 0, data: pack(takeSnapshot(rootOf(e, charts))) });
    this.capture = new Capture(gpu, this.fps, BATCH, L0);
    this.capture.start(this.fps);
    this.gcharts = new GpuCharts(gpu);
    const dev = gpu.ctx.device;
    void dev.lost.then((info) => { if (!this.released) this.lost = info.message || info.reason || 'lost'; });
    dev.addEventListener('uncapturederror', (ev) => { if (!this.released && this.lost === null) this.lost = `WebGPU: ${ev.error.message}`; });
  }

  /**
   * Den Backer bauen: die GPU-Engine auf der CPU-Engine e (frisch aus scene, Zeit 0 — sie wird ihr Spiegel), auf dem
   * vorbereiteten Gerät ctx (sonst ein neues). Wirft, wenn WebGPU fehlt oder die Kerne nicht übersetzen.
   */
  static async create(e: Engine, charts: Charts, scene: Record<string, unknown>, key: string, seconds: number, fps: number, keyEvery: number, ctx: GpuCtx | null): Promise<GpuBaker> {
    const device = ctx ?? await prepareGpu();
    let gpu: GpuEngine | null = null;
    try {
      gpu = GpuEngine.on(device, e);
      return new GpuBaker(gpu, e, charts, scene, key, seconds, fps, keyEvery);
    } catch (err) {
      if (gpu !== null) gpu.destroy(); else device.destroy();
      throw err;
    }
  }

  /** Simulationszeit des zuletzt aufgenommenen Bildes (s). */
  get time(): number { return this.frames > 0 ? (this.frames - 1) / this.fps : 0; }
  get done(): boolean { return this.frames >= this.total; }
  /** Die Ebenen eines der letzten Bilder mit Einblendungen (Vorschau, etwa alle 0,25 s neu). */
  get last(): Layers { return this.preview; }

  stop(): void { this.stopping = true; }

  /** Rechnen und aufnehmen, bis alles aufgenommen ist, abgebrochen wurde oder die Karte verloren ging; progress nach jedem Bündel. */
  async run(progress: () => void): Promise<void> {
    const start = performance.now();
    try {
      while (this.frames < this.total && !this.stopping && this.lost === null) {
        if (this.nextKey < this.total && this.captured > this.nextKey) {
          await this.drain();
          await this.keyframe();
          continue;
        }
        if (this.inflight.length >= INFLIGHT) { await this.next(); progress(); continue; }
        const room = this.room();
        if (room <= 0 && this.inflight.length > 0) { await this.next(); progress(); continue; }
        this.submit(Math.max(1, Math.min(BATCH, room)));
      }
      if (this.lost === null) {
        await this.drain();
        /* Das letzte Schlüsselbild (am Ende fällig, wie auf der CPU bei einer Länge, die ein Vielfaches des Abstands ist). */
        if (!this.stopping && this.nextKey <= this.captured - 1) await this.keyframe();
      }
    } catch (err) {
      if (this.lost === null) this.lost = err instanceof Error ? err.message : String(err);
    }
    this.computeMs = performance.now() - start;
  }

  /** Wie viele Schritte höchstens noch, ohne weit über das letzte Bild hinauszurechnen (Δt ≤ Δt_max; ≤ 0: erst die Bündel unterwegs abwarten). */
  private room(): number {
    const G = this.gpu;
    const dtmax = Math.fround(this.e.dtMax);
    const upper = G.totals.time + (this.issued - G.totals.steps) * dtmax;
    return Math.ceil(((this.total - 1) / this.fps - upper) / dtmax - 1e-9);
  }

  private staging(): GPUBuffer {
    const b = this.free.pop();
    if (b !== undefined) return b;
    return this.gpu.ctx.device.createBuffer({ label: 'bake', size: Math.ceil(this.capture.batchBytes / 16) * 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
  }

  /** Ein Bündel: steps Schritte, nach jedem die Aufnahme; Plätze und Ablesung zurück (ohne zu warten). */
  private submit(steps: number): void {
    const G = this.gpu;
    const dev = G.ctx.device;
    const cap = this.capture;
    const enc = dev.createCommandEncoder();
    cap.begin(enc);
    for (let k = 0; k < steps; k += 1) {
      G.encodeSteps(enc, 1, false);
      cap.encode(enc);
    }
    const stg = this.staging();
    cap.copyOut(enc, stg);
    const rb = G.encodeReadback(enc, false);
    dev.queue.submit([enc.finish()]);
    this.issued += steps;
    const mapped = Promise.all([rb !== null ? G.finishReadback(rb, false) : Promise.resolve(null), stg.mapAsync(GPUMapMode.READ)]);
    const done = this.chain.then(() => mapped).then(() => this.absorb(stg));
    this.chain = done;
    done.catch(() => undefined);
    this.inflight.push(done);
  }

  private async next(): Promise<void> {
    const b = this.inflight.shift();
    if (b !== undefined) await b;
  }

  private async drain(): Promise<void> {
    while (this.inflight.length > 0) await this.next();
  }

  /** Ein zurückgelesenes Bündel: Bilanzen, Proben der Schreiber, seine Bilder in den Nachweis. */
  private absorb(stg: GPUBuffer): void {
    const t0 = performance.now();
    const G = this.gpu;
    const cap = this.capture;
    G.baselineFromLast();
    if (G.totals.time >= this.nextSample) {
      const s = this.gcharts.sample();
      if (s !== null) { this.samples.push(s); this.nextSample = G.totals.time + SAMPLE_EVERY; }
    }
    const all = stg.getMappedRange();
    try {
      const r = cap.read(all);
      this.lostFrames = r.lost;
      this.captured = r.captured;
      for (let k = 0; k < r.count; k += 1) {
        const idx = cap.index(all, k);
        if (idx !== this.frames) throw new Error(`capture: frame ${idx} arrived, ${this.frames} expected`);
        const L = cap.frame(all, k, this.view);
        this.writer.add(L);
        this.onFrame?.(idx, L);
        this.frames += 1;
        if (idx % OVERLAY_EVERY === 0 && t0 - this.previewAt >= PREVIEW_MS) this.keepPreview(all, k, t0);
        if (this.writer.count >= this.chunkFrames) this.flush();
      }
    } finally {
      stg.unmap();
      this.free.push(stg);
      this.cpuMs += performance.now() - t0;
    }
  }

  /** Ein Bild mit Einblendungen als Vorschau behalten (eine Kopie: das Bündel wird gleich wieder frei). */
  private keepPreview(all: ArrayBuffer, k: number, now: number): void {
    this.previewAt = now;
    this.previewBuf = this.capture.copyFrame(all, k, this.previewBuf);
    const P = this.capture.layersAt(this.previewBuf, 0, 4 * HEAD_WORDS, this.previewView);
    if (this.previewQuads.length < P.quads.length) this.previewQuads = new Uint16Array(P.quads.length);
    this.previewQuads.set(P.quads);
    P.quads = this.previewQuads;
    this.preview = P;
  }

  /** Ein Schlüsselbild aus dem Zustand der GPU (nach dem Leeren der Bündel): zurückholen, Marken, Bilanzen, aufnehmen. */
  private async keyframe(): Promise<void> {
    const t0 = performance.now();
    const G = this.gpu;
    const e = this.e;
    const frame = this.captured - 1;
    await G.download();
    this.gcharts.copyTo(this.charts);
    const s = G.stats(0);
    const errors: BudgetErrors = { energy: s.energyError, water: s.waterError, other: s.otherError, salt: s.saltError };
    e.rebaseline(errors);
    if (this.onKey !== null) await this.onKey({ frame, e, gpu: G, errors, probe: () => this.capture.probe() });
    this.keys.push({ frame, t: frame / this.fps, data: pack(takeSnapshot(rootOf(e, this.charts))) });
    this.keyStallMs.push(performance.now() - t0);
    this.nextKey = (Math.floor(frame / this.keyFrames) + 1) * this.keyFrames;
  }

  private flush(): void {
    if (this.writer.count === 0) return;
    this.chunks.push(pack(this.writer.finish()));
    this.writer = new ChunkWriter(this.e.grid.nx, this.e.grid.ny, this.e.grid.dx);
  }

  /** Abschliessen (auch nach einem Abbruch oder dem Verlust der Karte: was aufgenommen ist, bleibt); gibt die GPU frei. */
  async finish(): Promise<Baked | null> {
    this.flush();
    const adapter = this.gpu.ctx.adapter;
    this.release();
    if (this.frames < 2) return null;
    const chunks = await Promise.all(this.chunks);
    const keys = await Promise.all(this.keys.map((k) => k.data));
    const g = this.e.grid;
    const header: ClipHeader = {
      format: CLIP_FORMAT, version: CLIP_VERSION, key: this.key, scene: this.scene, quality: this.e.currentQuality, layout: this.layout,
      fps: this.fps, nx: g.nx, ny: g.ny, dx: g.dx, depth: g.depth, boxW: g.w, boxH: g.h, frames: this.frames, duration: (this.frames - 1) / this.fps,
      seconds: this.seconds, chunkFrames: this.chunkFrames, chunkBytes: chunks.map((c) => c.length),
      keyframes: this.keys.map((k, i) => ({ frame: k.frame, t: k.t, bytes: keys[i].length })),
      samples: this.samples, created: Date.now(), bakeMs: Math.round(this.computeMs), bytes: chunks.reduce((s, c) => s + c.length, 0) + keys.reduce((s, c) => s + c.length, 0),
      used: Date.now(), engine: 'gpu', exact: false, adapter
    };
    return { header, chunks, keys };
  }

  /** Die GPU freigeben (Puffer, Gerät) — die CPU-Engine bleibt. */
  release(): void {
    if (this.released) return;
    this.released = true;
    this.capture.destroy();
    this.gpu.destroy();
  }
}
