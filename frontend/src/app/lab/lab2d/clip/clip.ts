/**
 * LABOR 2D (v2) — NACHWEISE (B, Backen und Wiedergabe; SANDBOX.md §9): eine
 * Szene einmal so schnell wie möglich rechnen, ohne zu zeichnen, und dabei
 * aufnehmen — dann beliebig oft abspielen, ohne zu rechnen (auch auf einem
 * schwachen Gerät), vor- und zurückspulen und an jeder Stelle live
 * weiterrechnen.
 *
 * Ein Nachweis („recreatio/lab2d-clip“, Fassung 1):
 *
 * - der Kopf: die Szene (mit Auflösung und Samen), das Gitter, 30 Bilder je
 *   Sekunde Simulationszeit, die Stücke und Schlüsselbilder, die Proben der
 *   Schreiber (alle 0,25 s) und der Bau der Engine (layout);
 * - die Bilder: die Ebenen jedes Bildes (render/layers.ts), eine Sekunde je
 *   Stück, als Unterschied zum vorigen Bild und gepackt (codec.ts);
 * - Schlüsselbilder: der ganze Zustand alle fünf Sekunden (snapshot.ts),
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
export const CLIP_VERSION = 1;
/** Bilder je Sekunde Simulationszeit. */
export const FPS = 30;
/** Ein Schlüsselbild alle so viele Sekunden. */
export const KEY_EVERY = 5;
/** Bilder je Stück (zwei Sekunden): das erste Bild eines Stücks steht roh, die anderen als Unterschied. */
export const CHUNK_FRAMES = 2 * FPS;
/** Probe der Schreiber alle so viele Sekunden (wie live). */
const SAMPLE_EVERY = 0.25;

export interface ClipHeader {
  readonly format: typeof CLIP_FORMAT;
  readonly version: typeof CLIP_VERSION;
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
  /** Kann man an jeder Stelle live weiterrechnen (gleicher Bau der Engine)? */
  readonly resumable: boolean;
  readonly samples: readonly ChartSample[];
}

export function infoOf(h: ClipHeader, layout: string): ClipInfo {
  return {
    key: h.key, duration: h.duration, seconds: h.seconds, frames: h.frames, fps: h.fps, bytes: h.bytes, created: h.created,
    bakeMs: h.bakeMs, quality: h.quality, resumable: h.layout === layout, samples: h.samples
  };
}

/** Die Szene in ihrer festen Form (so hängt der Schlüssel nicht an Schreibweisen). */
export function canonicalScene(raw: unknown): Record<string, unknown> {
  return writeScene(readScene(raw).scene);
}

/** Der Schlüssel eines Nachweises: SHA-256 über Format und Szene (mit Auflösung, Samen und allen Handgriffen). */
export async function clipKey(scene: Record<string, unknown>): Promise<string> {
  const text = `${CLIP_FORMAT}/${CLIP_VERSION}\n${JSON.stringify(scene)}`;
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

  /** e: frisch gebaut aus scene (Zeit 0), charts: ihre Schreiber. */
  constructor(e: Engine, charts: Charts, scene: Record<string, unknown>, key: string, seconds: number) {
    this.e = e;
    this.charts = charts;
    this.scene = scene;
    this.key = key;
    this.seconds = seconds;
    this.total = Math.round(seconds * FPS) + 1;
    this.layers = allocLayers(e.grid.nx, e.grid.ny, e.grid.dx, 256);
    this.writer = new ChunkWriter(e.grid.nx, e.grid.ny, e.grid.dx);
    this.layout = layoutOf(rootOf(e, charts));
  }

  /** Simulationszeit des zuletzt aufgenommenen Bildes (s). */
  get time(): number { return this.frames > 0 ? (this.frames - 1) / FPS : 0; }
  get done(): boolean { return this.frames >= this.total; }

  /** Rechnen und aufnehmen, höchstens budgetMs lang; liefert, ob alles aufgenommen ist. */
  run(budgetMs: number): boolean {
    const start = performance.now();
    const e = this.e;
    while (this.frames < this.total) {
      if (e.time >= this.frames / FPS - 1e-9) { this.capture(); continue; }
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
    if (this.writer.count >= CHUNK_FRAMES) this.flush();
    if (k % (KEY_EVERY * FPS) === 0) {
      const bytes = takeSnapshot(rootOf(this.e, this.charts));
      this.keys.push({ frame: k, t: k / FPS, data: pack(bytes) });
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
      fps: FPS, nx: g.nx, ny: g.ny, dx: g.dx, depth: g.depth, boxW: g.w, boxH: g.h, frames: this.frames, duration: (this.frames - 1) / FPS,
      seconds: this.seconds, chunkFrames: CHUNK_FRAMES, chunkBytes: chunks.map((c) => c.length),
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
      .then((raw) => { this.ready.set(i, new ChunkReader(raw, h.nx, h.ny, h.dx)); })
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
