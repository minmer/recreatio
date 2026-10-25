/**
 * LABOR 2D (v2) — BACKEN UND WIEDERGABE IM ARBEITER (B): die Seite des
 * Arbeiters, die einen Nachweis backt, abspielt und daraus live weiterrechnen
 * lässt. Der Arbeiter (engine.worker.ts) fragt sie, was er zeichnen soll, und
 * reicht ihr die Nachrichten der Oberfläche weiter.
 *
 * Zustände: live (die Engine rechnet oder ruht), backen (die Engine rechnet
 * vom Anfang der Szene, so schnell sie kann; alle 0,3 s ein Vorschaubild),
 * Wiedergabe (nichts rechnet; das Bild kommt aus dem Nachweis).
 *
 * Seit 2026-10-25 backt auf Wunsch die Grafikkarte (gpuBake.ts, erst beim
 * Backen geladen; ihre Engine rechnet auf der Engine dieses Arbeiters als
 * Spiegel). Nachweise beider Engines derselben Szene bleiben nebeneinander
 * (eigene Schlüssel): „Nagranie“ spielt den bevorzugten (im normalen Weg den
 * der CPU, aus dem beschleunigten den der GPU), sonst den, der da ist; bei der
 * Wiedergabe lässt sich umschalten. Live weiter aus einem Nachweis der GPU
 * geht ab dem Schlüsselbild davor — im beschleunigten Weg (resume an die
 * Seite), wenn die Seite es kann, sonst hier.
 */

import { Charts } from '../engine/charts';
import type { Engine } from '../engine/engine';
import type { BakeNote, BakeOptions, HostStats, WorkerMessage } from '../engine/protocol';
import type { GpuCtx } from '../gpu/kernel';
import type { Layers } from '../render/layers';
import { BAKE_FPS, BAKE_KEYS, Baker, canonicalScene, clipKey, infoOf, Player, rootOf, type Baked, type ClipEngine, type ClipHeader, type ClipInfo } from './clip';
import { unpack } from './codec';
import type { GpuBaker } from './gpuBake';
import { layoutOf, restoreSnapshot } from './snapshot';
import { browserStore, type ClipStore } from './store';

export type ClipMode = 'live' | 'baking' | 'playback';

export interface SessionHost {
  readonly engine: () => Engine;
  readonly charts: () => Charts;
  readonly setCharts: (c: Charts) => void;
  readonly post: (m: WorkerMessage, transfer?: Transferable[]) => void;
  /** Nach einem neuen Aufbau der Engine: Schreiber, Ansicht, Wände neu (engine.worker.ts: restart). */
  readonly rebuilt: () => void;
  readonly wake: () => void;
}

/** Was backt (Baker auf der CPU, GpuBaker auf der Grafikkarte): Fortschritt, Vorschau, Abschluss. */
interface Recorder {
  readonly seconds: number;
  readonly time: number;
  readonly frames: number;
  readonly last: Layers;
  finish(): Promise<Baked | null>;
}

/** So lange rechnet der Backer am Stück, bevor er Nachrichten durchlässt (ms). */
const SLICE_MS = 30;
const PROGRESS_MS = 150;
const PREVIEW_MS = 300;
const other = (e: ClipEngine): ClipEngine => (e === 'gpu' ? 'cpu' : 'gpu');
const hasWebGpu = (): boolean => typeof navigator !== 'undefined' && 'gpu' in navigator;

export class ClipSession {
  mode: ClipMode = 'live';
  private readonly host: SessionHost;
  private store: Promise<ClipStore> | null = null;
  /** Der Nachweis, den „Nagranie“ spielt (null: keiner; bei der Wiedergabe der gezeigte) — mit dem der anderen Engine als alt. */
  info: ClipInfo | null = null;
  /** Die Schlüssel der jetzigen Szene je Engine und ihre Nachweise (null: keiner). */
  private keys: Record<ClipEngine, string> | null = null;
  private found: Record<ClipEngine, ClipHeader | null> = { cpu: null, gpu: null };
  /** Welcher Nachweis spielt, wenn es beide gibt (die Seite sagt es: aus dem beschleunigten Weg der der GPU). */
  private prefer: ClipEngine = 'cpu';
  private checking: Promise<void> | null = null;
  private checkTimer: ReturnType<typeof setTimeout> | null = null;
  private checkSeq = 0;
  private baker: Baker | null = null;
  private recorder: Recorder | null = null;
  private gpuBaker: { stop(): void } | null = null;
  /** Gerät und Kerne für das Backen mit der Grafikkarte, schon beim Öffnen des Fensters vorbereitet (bakePrepare). */
  private prepared: Promise<GpuCtx> | null = null;
  private bakeEngine: ClipEngine = 'cpu';
  private bakeNote: BakeNote | undefined;
  private bakeSeconds = 0;
  private bakeStart = 0;
  private lastProgress = 0;
  private lastPreview = 0;
  private previewFrames = -1;
  private stopRequested = false;
  private player: Player | null = null;
  /** Ein eben gebackener Nachweis (im Speicher, bis er aus dem Speicher des Browsers gelesen wird). */
  private baked: Baked | null = null;
  t = 0;
  playing = false;
  loop = false;
  speed = 1;
  private busy = false;

  constructor(host: SessionHost) {
    this.host = host;
  }

  private clips(): Promise<ClipStore> {
    if (this.store === null) this.store = browserStore();
    return this.store;
  }

  /** Nach jeder Änderung der Szene: gibt es für sie einen Nachweis? (gebündelt, 0,3 s nach der letzten Änderung) */
  checkSoon(): void {
    if (this.checkTimer !== null) clearTimeout(this.checkTimer);
    this.checkTimer = setTimeout(() => { this.checkTimer = null; void this.check(); }, 300);
  }

  check(): Promise<void> {
    const job = this.lookup(this.checkSeq += 1);
    this.checking = job;
    return job;
  }

  private async lookup(seq: number): Promise<void> {
    const e = this.host.engine();
    const scene = canonicalScene(e.serialize());
    let keys: Record<ClipEngine, string> | null = null;
    const found: Record<ClipEngine, ClipHeader | null> = { cpu: null, gpu: null };
    try {
      keys = { cpu: await clipKey(scene, 'cpu'), gpu: await clipKey(scene, 'gpu') };
      const store = await this.clips();
      [found.cpu, found.gpu] = await Promise.all([store.header(keys.cpu), store.header(keys.gpu)]);
    } catch { keys = null; }
    if (seq !== this.checkSeq || this.mode === 'baking') return;
    this.keys = keys;
    this.found = found;
    this.info = this.infoFor(this.pick(this.prefer));
    this.host.post({ type: 'clip', info: this.info });
  }

  /** Der Nachweis, der bei dieser Vorliebe spielt (sonst der andere). */
  private pick(prefer: ClipEngine): ClipHeader | null {
    return this.found[prefer] ?? this.found[other(prefer)];
  }

  /** Was die Oberfläche von h erfährt, mit dem Nachweis der anderen Engine daneben. */
  private infoFor(h: ClipHeader | null): ClipInfo | null {
    if (h === null) return null;
    const alt = this.found[other(h.engine ?? 'cpu')];
    return infoOf(h, layoutOf(rootOf(this.host.engine(), this.host.charts())), alt !== null && alt.key !== h.key ? alt : null);
  }

  /** Das Fenster des Backens ist offen: Grafikkarte und Kerne schon jetzt (die Übersetzung dauert Sekunden; der Shader-Cache des Browsers kürzt sie beim nächsten Mal). */
  prepare(): void {
    if (this.prepared !== null || !hasWebGpu()) return;
    const job = import('./gpuBake').then((m) => m.prepareGpu());
    job.catch(() => { if (this.prepared === job) this.prepared = null; });
    this.prepared = job;
  }

  /* -- Backen ------------------------------------------------------------------------------------------ */

  /**
   * Die Szene, wie sie jetzt aufgebaut ist, vom Anfang an backen — mit der gewählten Länge, Bildern je Sekunde,
   * Schlüsselbildern, Auflösung und Rechnung heftiger Zustände (die beiden letzten gehören zur Szene: ein anderer
   * Nachweis). Ein Nachweis derselben Szene und Engine mit anderen Bildern je Sekunde ersetzt den alten. Mit
   * o.engine = 'gpu' rechnet die Grafikkarte — ausser die Szene braucht die CPU (Körper in Bewegung, Eis, Körner),
   * es gibt kein WebGPU, oder Karte und Kerne versagen: dann die CPU, und die Oberfläche sagt warum (note).
   */
  async bake(o: BakeOptions): Promise<void> {
    if (this.mode === 'baking' || this.busy) return;
    const e = this.host.engine();
    const scene = canonicalScene({ ...e.serialize(), quality: o.quality, extremes: o.extremes });
    const fps = BAKE_FPS.includes(o.fps) ? o.fps : 30;
    const keyEvery = BAKE_KEYS.includes(o.keyEvery) ? o.keyEvery : 5;
    const seconds = Math.max(1, Math.min(600, o.seconds));
    const keys = { cpu: await clipKey(scene, 'cpu'), gpu: await clipKey(scene, 'gpu') };
    this.leavePlayback();
    this.mode = 'baking';
    this.keys = keys;
    this.found = { cpu: null, gpu: null };
    this.stopRequested = false;
    this.bakeSeconds = seconds;
    this.bakeNote = undefined;
    this.previewFrames = -1;
    const charts = this.fresh(e, scene);
    if (o.engine === 'gpu') {
      this.bakeNote = e.needsCpu() ? 'cpu-only' : hasWebGpu() ? undefined : 'no-webgpu';
      if (this.bakeNote === undefined && await this.bakeGpu(e, charts, scene, keys, seconds, fps, keyEvery)) return;
      this.bakeNote ??= 'gpu-failed';
    }
    this.bakeCpu(e, charts, scene, keys.cpu, seconds, fps, keyEvery);
  }

  /** Die Engine frisch aus der Szene (Zeit 0) mit neuen Schreibern. */
  private fresh(e: Engine, scene: Record<string, unknown>): Charts {
    e.load(scene);
    const charts = new Charts(e);
    this.host.setCharts(charts);
    this.host.rebuilt();
    return charts;
  }

  private bakeCpu(e: Engine, charts: Charts, scene: Record<string, unknown>, key: string, seconds: number, fps: number, keyEvery: number): void {
    this.bakeEngine = 'cpu';
    this.baker = new Baker(e, charts, scene, key, seconds, fps, keyEvery);
    this.recorder = this.baker;
    this.bakeStart = performance.now();
    this.progress('running');
    this.host.wake();
  }

  /** Mit der Grafikkarte backen (erst die Kerne, schon vorbereitet, wenn das Fenster offen war); false: es ging nicht. */
  private async bakeGpu(e: Engine, charts: Charts, scene: Record<string, unknown>, keys: Record<ClipEngine, string>, seconds: number, fps: number, keyEvery: number): Promise<boolean> {
    this.bakeEngine = 'gpu';
    this.progress('preparing');
    let b: GpuBaker;
    try {
      const mod = await import('./gpuBake');
      const prepared = this.prepared;
      this.prepared = null;
      const ctx = prepared !== null ? await prepared.catch(() => mod.prepareGpu()) : await mod.prepareGpu();
      b = await mod.GpuBaker.create(e, charts, scene, keys.gpu, seconds, fps, keyEvery, ctx);
    } catch {
      return false;
    }
    this.recorder = b;
    this.gpuBaker = b;
    this.bakeStart = performance.now();
    if (this.stopRequested) b.stop();
    this.progress('running');
    void b.run(() => { if (performance.now() - this.lastProgress >= PROGRESS_MS) this.progress('running'); }).then(async () => {
      if (b.lost !== null && b.frames < 2 && !this.stopRequested) {
        /* Die Karte versagte gleich am Anfang: dieselbe Szene von vorn auf der CPU. */
        b.release();
        this.recorder = null;
        this.gpuBaker = null;
        this.bakeNote = 'gpu-failed';
        this.bakeCpu(e, this.fresh(e, scene), scene, keys.cpu, seconds, fps, keyEvery);
        return;
      }
      /* Mitten im Backen verloren: was aufgenommen ist, bleibt (wie beim Abbrechen). */
      if (b.lost !== null) this.bakeNote = 'gpu-lost';
      await this.finishBake();
    });
    return true;
  }

  /** Abbrechen: was schon aufgenommen ist, bleibt als kürzerer Nachweis. */
  stopBake(): void {
    if (this.mode === 'baking') { this.stopRequested = true; this.gpuBaker?.stop(); }
    this.host.wake();
  }

  /** Ein Happen Backen (aus dem Takt des Arbeiters); liefert, ob weitergebacken wird. */
  slice(): boolean {
    const b = this.baker;
    if (this.mode !== 'baking' || b === null) return false;
    const done = this.stopRequested || b.run(SLICE_MS);
    const now = performance.now();
    if (now - this.lastProgress >= PROGRESS_MS) this.progress('running');
    if (done) { void this.finishBake(); return false; }
    return true;
  }

  private progress(state: 'preparing' | 'running' | 'saving' | 'done' | 'failed', message?: string): void {
    const b = this.recorder;
    this.lastProgress = performance.now();
    const wall = (this.lastProgress - this.bakeStart) / 1000;
    const t = b?.time ?? 0;
    this.host.post({ type: 'bake', state, t, seconds: b?.seconds ?? this.bakeSeconds, rate: wall > 0 && state === 'running' ? t / wall : 0, message, engine: this.bakeEngine, note: this.bakeNote });
  }

  private async finishBake(): Promise<void> {
    const b = this.recorder;
    if (b === null) return;
    this.busy = true;
    this.progress('saving');
    try {
      const baked = await b.finish();
      this.recorder = null;
      this.baker = null;
      this.gpuBaker = null;
      if (baked === null) { this.mode = 'live'; this.progress('failed', 'short'); return; }
      this.baked = baked;
      const store = await this.clips();
      try { await store.save(baked.header, baked.chunks, baked.keys); } catch { /* ohne Speicher gilt der Nachweis nur jetzt */ }
      /* Der eben gebackene und, wenn es ihn gibt, der Nachweis derselben Szene von der anderen Engine. */
      const engine = baked.header.engine ?? 'cpu';
      this.found[engine] = baked.header;
      try { this.found[other(engine)] = this.keys === null ? null : await store.header(this.keys[other(engine)]); } catch { this.found[other(engine)] = null; }
      this.progress('done');
      this.startPlayback(baked.header, true);
    } catch (err) {
      this.recorder = null;
      this.baker = null;
      this.gpuBaker = null;
      this.mode = 'live';
      this.progress('failed', err instanceof Error ? err.message : String(err));
    } finally {
      this.busy = false;
    }
  }

  /** Ein Vorschaubild beim Backen: die Ebenen des zuletzt aufgenommenen Bildes, höchstens alle 0,3 s. */
  preview(): Layers | null {
    const b = this.recorder;
    if (b === null || b.frames === this.previewFrames) return null;
    const now = performance.now();
    if (now - this.lastPreview < PREVIEW_MS && this.previewFrames >= 0) return null;
    this.lastPreview = now;
    this.previewFrames = b.frames;
    return b.last;
  }

  /* -- Wiedergabe -------------------------------------------------------------------------------------- */

  private loader(h: ClipHeader): (i: number) => Promise<Uint8Array | null> {
    const baked = this.baked;
    if (baked !== null && baked.header.key === h.key) return async (i) => baked.chunks[i] ?? null;
    return async (i) => (await this.clips()).chunk(h.key, i);
  }

  private startPlayback(h: ClipHeader, play: boolean): void {
    this.player = new Player(h, this.loader(h));
    this.mode = 'playback';
    this.t = 0;
    this.playing = play;
    /* Die Leiste erfährt, welcher Nachweis spielt (und ob es den der anderen Engine gibt). */
    this.info = this.infoFor(h);
    this.host.post({ type: 'clip', info: this.info });
    void this.clips().then((s) => s.touch(h.key)).catch(() => undefined);
    this.host.wake();
  }

  /** Den Nachweis der jetzigen Szene abspielen; prefer: welcher, wenn es beide gibt. */
  async open(play: boolean, prefer?: ClipEngine): Promise<void> {
    if (this.mode === 'baking' || this.busy) return;
    if (prefer !== undefined) this.prefer = prefer;
    if (this.mode === 'playback') { this.playing = play; return; }
    if (this.checking !== null) await this.checking.catch(() => undefined);
    if (this.mode !== 'live') return;
    const h = this.pick(this.prefer);
    if (h === null) { this.info = null; this.host.post({ type: 'clip', info: null }); return; }
    this.startPlayback(h, play);
  }

  /** Bei der Wiedergabe den Nachweis der anderen Engine zeigen — an derselben Stelle, im selben Lauf. */
  switchEngine(engine: ClipEngine): void {
    const p = this.player;
    const h = this.found[engine];
    if (this.mode !== 'playback' || p === null || h === null || h.key === p.header.key) return;
    const { t, playing } = this;
    this.prefer = engine;
    this.startPlayback(h, playing);
    this.t = Math.min(t, h.duration);
  }

  play(playing: boolean): void {
    if (this.mode !== 'playback' || this.player === null) return;
    if (playing && this.t >= this.player.header.duration - 1e-6) this.t = 0;
    this.playing = playing;
  }

  seek(t: number): void {
    if (this.mode !== 'playback' || this.player === null) return;
    this.t = Math.max(0, Math.min(this.player.header.duration, t));
  }

  /** Die Uhr der Wiedergabe weiterdrehen (real: vergangene echte Zeit, s). */
  advance(real: number): void {
    const p = this.player;
    if (this.mode !== 'playback' || p === null || !this.playing) return;
    this.t += real * this.speed;
    const end = p.header.duration;
    if (this.t >= end) {
      if (this.loop) this.t = 0;
      else { this.t = end; this.playing = false; }
    }
  }

  /** Die Ebenen des Bildes, das jetzt zu zeigen ist (null: sein Stück lädt noch). */
  current(): Layers | null {
    const p = this.player;
    if (p === null) return null;
    return p.frame(p.frameAt(this.t));
  }

  private leavePlayback(): void {
    this.player = null;
    this.playing = false;
    if (this.mode === 'playback') this.mode = 'live';
  }

  /** Die Wiedergabe beenden: zurück zum Anfang der Szene (live, ruhend). */
  close(): void {
    const p = this.player;
    if (p === null) return;
    this.leavePlayback();
    const e = this.host.engine();
    e.load(p.header.scene);
    this.host.setCharts(new Charts(e));
    this.host.rebuilt();
  }

  /**
   * Live weiterrechnen ab dem gezeigten Bild: das Schlüsselbild davor laden und
   * bis zu diesem Bild rechnen — Bit für Bit derselbe Zustand wie beim Backen.
   * Ein Nachweis von der GPU ist nicht wiederholbar: er geht ab dem
   * Schlüsselbild davor weiter, ohne bis zum Bild zu rechnen — mit accel im
   * beschleunigten Weg (die Seite bekommt Szene und Schlüsselbild), sonst hier.
   */
  async live(accel = false): Promise<void> {
    const p = this.player;
    if (p === null || this.busy) return;
    const h = p.header;
    const k = p.frameAt(this.t);
    const ki = p.keyframeBefore(k);
    this.busy = true;
    this.playing = false;
    try {
      const baked = this.baked?.header.key === h.key ? this.baked : null;
      const packed = baked !== null ? baked.keys[ki] ?? null : await (await this.clips()).keyframe(h.key, ki);
      if (packed === null) throw new Error('missing keyframe');
      const raw = await unpack(packed);
      if (h.engine === 'gpu' && accel) {
        this.leavePlayback();
        this.host.post({ type: 'resume', scene: h.scene, snapshot: raw, t: h.keyframes[ki]?.t ?? 0 }, [raw.buffer as ArrayBuffer]);
        return;
      }
      const e = this.host.engine();
      e.load(h.scene);
      const charts = new Charts(e);
      restoreSnapshot(rootOf(e, charts), raw);
      this.host.setCharts(charts);
      const target = h.engine === 'gpu' ? e.time : k / h.fps - 1e-9;
      const from = e.time;
      /* Vom Schlüsselbild bis zum gezeigten Bild rechnen — in Happen, mit Fortschritt. */
      while (e.time < target) {
        const t0 = performance.now();
        while (e.time < target && performance.now() - t0 < SLICE_MS) e.step();
        this.host.post({ type: 'bake', state: 'seeking', t: e.time - from, seconds: Math.max(1e-6, target - from), rate: 0 });
        await new Promise((r) => setTimeout(r, 0));
      }
      this.leavePlayback();
      this.host.rebuilt();
      this.host.post({ type: 'live', t: e.time });
    } catch (err) {
      this.host.post({ type: 'bake', state: 'failed', t: 0, seconds: 0, rate: 0, message: err instanceof Error && err.message.includes('built differently') ? 'engine' : err instanceof Error ? err.message : String(err) });
    } finally {
      this.busy = false;
    }
  }

  /** Den gezeigten (sonst den bevorzugten) Nachweis löschen; der der anderen Engine bleibt. */
  async remove(): Promise<void> {
    const key = this.player?.header.key ?? this.info?.key ?? null;
    if (this.mode === 'playback') this.close();
    if (key === null) return;
    if (this.baked?.header.key === key) this.baked = null;
    try { await (await this.clips()).remove(key); } catch { /* nichts zu löschen */ }
    if (this.found.cpu?.key === key) this.found.cpu = null;
    if (this.found.gpu?.key === key) this.found.gpu = null;
    this.info = this.infoFor(this.pick(this.prefer));
    this.host.post({ type: 'clip', info: this.info });
  }

  /** Was die Oberfläche fünfmal je Sekunde vom Nachweis erfährt. */
  stats(): HostStats['clip'] {
    if (this.mode === 'playback' && this.player !== null) {
      return { mode: 'playback', t: this.t, duration: this.player.header.duration, playing: this.playing, loop: this.loop, loading: this.player.failed ?? null };
    }
    if (this.mode === 'baking') {
      const b = this.recorder;
      return { mode: 'baking', t: b?.time ?? 0, duration: b?.seconds ?? this.bakeSeconds, playing: false, loop: this.loop, loading: null };
    }
    return null;
  }
}
