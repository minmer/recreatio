/**
 * LABOR 2D (v2) — NACHWEISE (B, Backen und Wiedergabe; SANDBOX.md §9): eine
 * Szene einmal so schnell wie möglich rechnen, ohne zu zeichnen, und dabei
 * aufnehmen — dann beliebig oft abspielen, ohne zu rechnen (auch auf einem
 * schwachen Gerät), vor- und zurückspulen und an jeder Stelle live
 * weiterrechnen.
 *
 * Ein Nachweis („recreatio/lab2d-clip“, Fassung 2; Fassung 1 ohne die Körper als Rechtecke spielt weiter):
 *
 * - der Kopf: die Szene (mit Auflösung und Samen), das Gitter, die Bilder je
 *   Sekunde Simulationszeit (Vorgabe 30; seit 2026-10-24 beim Backen wählbar),
 *   die Stücke und Schlüsselbilder, die Proben der Schreiber (alle 0,25 s) und
 *   der Bau der Engine (layout);
 * - die Bilder: die Ebenen jedes Bildes (render/layers.ts), zwei Sekunden je
 *   Stück, als Unterschied zum vorigen Bild und gepackt (codec.ts);
 * - Schlüsselbilder: der ganze Zustand alle fünf Sekunden (wählbar; snapshot.ts),
 *   gepackt — daraus „Na żywo od tej chwili“.
 *
 * Der Backer läuft im Arbeiter in Happen (er gibt die Hand zurück, damit
 * Nachrichten durchkommen); gepackt wird nebenher (CompressionStream).
 */

import type { Charts } from '../engine/charts';
import type { Engine } from '../engine/engine';
import type { ChartSample } from '../engine/protocol';
import { readScene, writeScene, type Quality } from '../engine/scene';
import { allocLayers, sampleLayers, type Layers } from '../render/layers';
import { ChunkReader, ChunkWriter, pack, unpack } from './codec';
import { layoutOf, takeSnapshot, type SnapshotRoot } from './snapshot';

export const CLIP_FORMAT = 'recreatio/lab2d-clip';
/** Fassung 2 (2026-10-23): die Körper als genaue Rechtecke in den Bildern; Fassung 1 lässt sich weiter abspielen. */
export const CLIP_VERSION = 2;
/** Bilder je Sekunde Simulationszeit (Vorgabe; der Kopf sagt, wie gebacken wurde). */
export const FPS = 30;
/** Ein Schlüsselbild alle so viele Sekunden (Vorgabe). */
export const KEY_EVERY = 5;
/** Was sich beim Backen wählen lässt: Bilder je Sekunde, ein Schlüsselbild alle … Sekunden. */
export const BAKE_FPS: readonly number[] = [15, 30, 60];
export const BAKE_KEYS: readonly number[] = [1, 5, 10];
/** Probe der Schreiber alle so viele Sekunden (wie live). */
const SAMPLE_EVERY = 0.25;

/** Wer gebacken hat: die CPU-Engine (genau, wiederholbar) oder die Grafikkarte (gpuBake.ts; seit 2026-10-25). */
export type ClipEngine = 'cpu' | 'gpu';

export interface ClipHeader {
  readonly format: typeof CLIP_FORMAT;
  readonly version: number;
  readonly key: string;
  readonly scene: Record<string, unknown>;
  readonly quality: Quality;
  /** Der Bau der Engine, die gebacken hat (snapshot.layoutOf) — nur mit demselben geht es live weiter. */
  readonly layout: string;
  readonly fps: number;
  readonly nx: number;
  readonly ny: number;
  readonly dx: number;
  readonly depth: number;
  readonly boxW: number;
  readonly boxH: number;
  readonly frames: number;
  /** Simulationszeit des letzten Bildes (s). */
  readonly duration: number;
  /** Gewünschte Länge (s); kürzer, wenn das Backen abgebrochen wurde. */
  readonly seconds: number;
  readonly chunkFrames: number;
  readonly chunkBytes: readonly number[];
  readonly keyframes: readonly { readonly frame: number; readonly t: number; readonly bytes: number }[];
  readonly samples: readonly ChartSample[];
  readonly created: number;
  /** Rechenzeit des Backens (ms). */
  readonly bakeMs: number;
  /** Gepackte Grösse von Bildern und Schlüsselbildern (Bytes). */
  readonly bytes: number;
  /** Zuletzt abgespielt (ms seit 1970) — die ältesten weichen zuerst. */
  used: number;
  /** Seit 2026-10-25, fehlt bei der CPU: wer gebacken hat; false: live weiter nur ab einem Schlüsselbild (die GPU rechnet nicht Bit für Bit gleich); die Karte. */
  readonly engine?: ClipEngine;
  readonly exact?: boolean;
  readonly adapter?: string;
}

/** Was die Oberfläche von einem Nachweis wissen muss. */
export interface ClipInfo {
  readonly key: string;
  readonly duration: number;
  readonly seconds: number;
  readonly frames: number;
  readonly fps: number;
  readonly bytes: number;
  readonly created: number;
  readonly bakeMs: number;
  readonly quality: Quality;
  /** Kann man live weiterrechnen (gleicher Bau der Engine)? */
  readonly resumable: boolean;
  /** Genau ab dem gezeigten Bild (CPU) — sonst ab dem Schlüsselbild davor (GPU). */
  readonly exact: boolean;
  readonly engine: ClipEngine;
  readonly samples: readonly ChartSample[];
  /** Der Nachweis derselben Szene von der anderen Engine (beide bleiben nebeneinander), sonst null. */
  readonly alt: ClipInfo | null;
}

export function infoOf(h: ClipHeader, layout: string, alt: ClipHeader | null = null): ClipInfo {
  const engine = h.engine ?? 'cpu';
  return {
    key: h.key, duration: h.duration, seconds: h.seconds, frames: h.frames, fps: h.fps, bytes: h.bytes, created: h.created,
    bakeMs: h.bakeMs, quality: h.quality, resumable: h.layout === layout, exact: engine === 'cpu' && h.exact !== false, engine, samples: h.samples,
    alt: alt === null ? null : infoOf(alt, layout)
  };
}

/** Die Szene in ihrer festen Form (so hängt der Schlüssel nicht an Schreibweisen). */
export function canonicalScene(raw: unknown): Record<string, unknown> {
  return writeScene(readScene(raw).scene);
}

/**
 * Der Schlüssel eines Nachweises: SHA-256 über Format und Szene (mit Auflösung, Samen und allen Handgriffen). Ein
 * Nachweis von der Grafikkarte hat seinen eigenen (die Engine im Text): beide bleiben nebeneinander; die der CPU sind
 * dieselben wie vor 2026-10-25.
 */
export async function clipKey(scene: Record<string, unknown>, engine: ClipEngine = 'cpu'): Promise<string> {
  const text = `${CLIP_FORMAT}/${CLIP_VERSION}${engine === 'gpu' ? '/gpu' : ''}\n${JSON.stringify(scene)}`;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Die Wurzel eines Schlüsselbilds: die Engine und ihre Schreiber. */
export const rootOf = (e: Engine, charts: Charts): SnapshotRoot => ({ e, charts });

/** Ein gebackener Nachweis: Kopf, gepackte Stücke, gepackte Schlüsselbilder. */
export interface Baked {
  readonly header: ClipHeader;
  readonly chunks: readonly Uint8Array[];
  readonly keys: readonly Uint8Array[];
}

/** Der Backer: rechnet die Szene vom Anfang an und nimmt dabei auf. */
export class Baker {
  readonly e: Engine;
  readonly charts: Charts;
  readonly seconds: number;
  readonly total: number;
  /** Bilder je Sekunde, Bilder je Stück (zwei Sekunden), ein Schlüsselbild alle so viele Bilder. */
  readonly fps: number;
  readonly chunkFrames: number;
  readonly keyFrames: number;
  frames = 0;
  /** Nach jedem aufgenommenen Bild (Prüfstand: das Live-Bild daneben). */
  onFrame: ((k: number, L: Layers) => void) | null = null;
  private readonly key: string;
  private readonly scene: Record<string, unknown>;
  private readonly layers: Layers;
  private writer: ChunkWriter;
  private readonly chunks: Promise<Uint8Array>[] = [];
  private readonly keys: { frame: number; t: number; data: Promise<Uint8Array> }[] = [];
  private readonly samples: ChartSample[] = [];
  private nextSample = 0;
  private readonly layout: string;
  private computeMs = 0;

  /** e: frisch gebaut aus scene (Zeit 0), charts: ihre Schreiber; fps: Bilder je Sekunde, keyEvery: ein Schlüsselbild alle … Sekunden. */
  constructor(e: Engine, charts: Charts, scene: Record<string, unknown>, key: string, seconds: number, fps = FPS, keyEvery = KEY_EVERY) {
    this.e = e;
    this.charts = charts;
    this.scene = scene;
    this.key = key;
    this.seconds = seconds;
    this.fps = Math.max(1, Math.round(fps));
    this.chunkFrames = 2 * this.fps;
    this.keyFrames = Math.max(1, Math.round(keyEvery * this.fps));
    this.total = Math.round(seconds * this.fps) + 1;
    this.layers = allocLayers(e.grid.nx, e.grid.ny, e.grid.dx, 256);
    this.writer = new ChunkWriter(e.grid.nx, e.grid.ny, e.grid.dx);
    this.layout = layoutOf(rootOf(e, charts));
  }

  /** Simulationszeit des zuletzt aufgenommenen Bildes (s). */
  get time(): number { return this.frames > 0 ? (this.frames - 1) / this.fps : 0; }
  get done(): boolean { return this.frames >= this.total; }

  /** Rechnen und aufnehmen, höchstens budgetMs lang; liefert, ob alles aufgenommen ist. */
  run(budgetMs: number): boolean {
    const start = performance.now();
    const e = this.e;
    while (this.frames < this.total) {
      if (e.time >= this.frames / this.fps - 1e-9) { this.capture(); continue; }
      e.step();
      if (e.time >= this.nextSample) {
        this.nextSample = e.time + SAMPLE_EVERY;
        this.samples.push(this.charts.sample());
      }
      if (performance.now() - start >= budgetMs) break;
    }
    this.computeMs += performance.now() - start;
    return this.frames >= this.total;
  }

  /** Die Ebenen des zuletzt aufgenommenen Bildes (für eine Vorschau). */
  get last(): Layers { return this.layers; }

  private capture(): void {
    if (this.layers.bubbles.length < 4 * this.e.bubbles.count) Object.assign(this.layers, { bubbles: new Uint16Array(4 * Math.ceil(this.e.bubbles.count * 1.5)) });
    sampleLayers(this.e, this.layers, null);
    this.writer.add(this.layers);
    const k = this.frames;
    this.frames += 1;
    this.onFrame?.(k, this.layers);
    if (this.writer.count >= this.chunkFrames) this.flush();
    if (k % this.keyFrames === 0) {
      const bytes = takeSnapshot(rootOf(this.e, this.charts));
      this.keys.push({ frame: k, t: k / this.fps, data: pack(bytes) });
    }
  }

  private flush(): void {
    if (this.writer.count === 0) return;
    this.chunks.push(pack(this.writer.finish()));
    this.writer = new ChunkWriter(this.e.grid.nx, this.e.grid.ny, this.e.grid.dx);
  }

  /** Abschliessen (auch nach einem Abbruch: was aufgenommen ist, bleibt). */
  async finish(): Promise<Baked | null> {
    this.flush();
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
      used: Date.now()
    };
    return { header, chunks, keys };
  }
}

/** Die Wiedergabe: Bild k aus den Stücken (gelesen und entpackt, wenn gebraucht; die nächsten im Voraus). */
export class Player {
  readonly header: ClipHeader;
  private readonly load: (i: number) => Promise<Uint8Array | null>;
  private readonly ready = new Map<number, ChunkReader>();
  private readonly pending = new Map<number, Promise<void>>();
  private layers: Layers;
  failed: string | null = null;

  constructor(header: ClipHeader, load: (i: number) => Promise<Uint8Array | null>) {
    this.header = header;
    this.load = load;
    this.layers = allocLayers(header.nx, header.ny, header.dx, 256);
    this.layers.depth = header.depth;
    this.layers.boxW = header.boxW;
    this.layers.boxH = header.boxH;
  }

  get frames(): number { return this.header.frames; }

  /** Das Bild zur Zeit t (s), auf ganze Bilder abgerundet. */
  frameAt(t: number): number {
    return Math.max(0, Math.min(this.header.frames - 1, Math.floor(t * this.header.fps + 1e-6)));
  }

  /** Die Ebenen von Bild k, wenn sein Stück schon da ist (sonst null; es wird geholt). */
  frame(k: number): Layers | null {
    const i = Math.floor(k / this.header.chunkFrames);
    this.fetch(i);
    this.fetch(i + 1);
    const reader = this.ready.get(i);
    if (reader === undefined) return null;
    /* Nur drei Stücke im Speicher: das jetzige und seine Nachbarn. */
    for (const j of this.ready.keys()) if (j < i - 1 || j > i + 1) this.ready.delete(j);
    this.layers = reader.read(k - i * this.header.chunkFrames, this.layers);
    return this.layers;
  }

  /** Bild k, notfalls nach dem Laden seines Stücks. */
  async frameAsync(k: number): Promise<Layers | null> {
    const i = Math.floor(k / this.header.chunkFrames);
    this.fetch(i);
    await this.pending.get(i);
    return this.frame(k);
  }

  private fetch(i: number): void {
    if (i < 0 || i >= this.header.chunkBytes.length || this.ready.has(i) || this.pending.has(i)) return;
    const h = this.header;
    const job = this.load(i)
      .then((bytes) => (bytes === null ? Promise.reject(new Error('missing chunk')) : unpack(bytes)))
      .then((raw) => { this.ready.set(i, new ChunkReader(raw, h.nx, h.ny, h.dx, h.version)); })
      .catch((e: unknown) => { this.failed = e instanceof Error ? e.message : String(e); })
      .finally(() => { this.pending.delete(i); });
    this.pending.set(i, job);
  }

  /** Das letzte Schlüsselbild an oder vor Bild k. */
  keyframeBefore(k: number): number {
    let best = 0;
    this.header.keyframes.forEach((kf, i) => { if (kf.frame <= k) best = i; });
    return best;
  }
}
