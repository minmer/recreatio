/**
 * LABOR 2D (v2) — BACKEN UND WIEDERGABE IM ARBEITER (B): die Seite des
 * Arbeiters, die einen Nachweis backt, abspielt und daraus live weiterrechnen
 * lässt. Der Arbeiter (engine.worker.ts) fragt sie, was er zeichnen soll, und
 * reicht ihr die Nachrichten der Oberfläche weiter.
 *
 * Zustände: live (die Engine rechnet oder ruht), backen (die Engine rechnet
 * vom Anfang der Szene, so schnell sie kann; alle 0,3 s ein Vorschaubild),
 * Wiedergabe (nichts rechnet; das Bild kommt aus dem Nachweis).
 */

import { Charts } from '../engine/charts';
import type { Engine } from '../engine/engine';
import type { BakeOptions, HostStats, WorkerMessage } from '../engine/protocol';
import type { Layers } from '../render/layers';
import { BAKE_FPS, BAKE_KEYS, Baker, canonicalScene, clipKey, infoOf, Player, rootOf, type Baked, type ClipHeader, type ClipInfo } from './clip';
import { unpack } from './codec';
import { layoutOf, restoreSnapshot } from './snapshot';
import { browserStore, type ClipStore } from './store';

export type ClipMode = 'live' | 'baking' | 'playback';

export interface SessionHost {
  readonly engine: () => Engine;
  readonly charts: () => Charts;
  readonly setCharts: (c: Charts) => void;
  readonly post: (m: WorkerMessage) => void;
  /** Nach einem neuen Aufbau der Engine: Schreiber, Ansicht, Wände neu (engine.worker.ts: restart). */
  readonly rebuilt: () => void;
  readonly wake: () => void;
}

/** So lange rechnet der Backer am Stück, bevor er Nachrichten durchlässt (ms). */
const SLICE_MS = 30;
const PROGRESS_MS = 150;
const PREVIEW_MS = 300;

export class ClipSession {
  mode: ClipMode = 'live';
  private readonly host: SessionHost;
  private store: Promise<ClipStore> | null = null;
  /** Der Nachweis der jetzigen Szene (null: keiner) und ihr Schlüssel. */
  info: ClipInfo | null = null;
  private key: string | null = null;
  private checkTimer: ReturnType<typeof setTimeout> | null = null;
  private checkSeq = 0;
  private baker: Baker | null = null;
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

  async check(): Promise<void> {
    const seq = (this.checkSeq += 1);
    const e = this.host.engine();
    const scene = canonicalScene(e.serialize());
    let info: ClipInfo | null = null;
    let key: string | null = null;
    try {
      key = await clipKey(scene);
      const h = await (await this.clips()).header(key);
      if (h !== null) info = infoOf(h, layoutOf(rootOf(e, this.host.charts())));
    } catch { info = null; }
    if (seq !== this.checkSeq || this.mode === 'baking') return;
    this.key = key;
    this.info = info;
    this.host.post({ type: 'clip', info });
  }

  /* -- Backen ------------------------------------------------------------------------------------------ */

  /**
   * Die Szene, wie sie jetzt aufgebaut ist, vom Anfang an backen — mit der gewählten Länge, Bildern je Sekunde,
   * Schlüsselbildern, Auflösung und Rechnung heftiger Zustände (die beiden letzten gehören zur Szene: ein anderer
   * Nachweis). Ein Nachweis derselben Szene mit anderen Bildern je Sekunde ersetzt den alten.
   */
  async bake(o: BakeOptions): Promise<void> {
    if (this.mode === 'baking' || this.busy) return;
    const e = this.host.engine();
    const scene = canonicalScene({ ...e.serialize(), quality: o.quality, extremes: o.extremes });
    const fps = BAKE_FPS.includes(o.fps) ? o.fps : 30;
    const keyEvery = BAKE_KEYS.includes(o.keyEvery) ? o.keyEvery : 5;
    const seconds = Math.max(1, Math.min(600, o.seconds));
    const key = await clipKey(scene);
    this.leavePlayback();
    e.load(scene);
    const charts = new Charts(e);
    this.host.setCharts(charts);
    this.host.rebuilt();
    this.baker = new Baker(e, charts, scene, key, seconds, fps, keyEvery);
    this.key = key;
    this.mode = 'baking';
    this.stopRequested = false;
    this.bakeStart = performance.now();
    this.previewFrames = -1;
    this.progress('running');
    this.host.wake();
  }

  /** Abbrechen: was schon aufgenommen ist, bleibt als kürzerer Nachweis. */
  stopBake(): void {
    if (this.mode === 'baking') this.stopRequested = true;
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

  private progress(state: 'running' | 'saving' | 'done' | 'failed', message?: string): void {
    const b = this.baker;
    this.lastProgress = performance.now();
    const wall = (this.lastProgress - this.bakeStart) / 1000;
    const t = b?.time ?? 0;
    this.host.post({ type: 'bake', state, t, seconds: b?.seconds ?? 0, rate: wall > 0 ? t / wall : 0, message });
  }

  private async finishBake(): Promise<void> {
    const b = this.baker;
    if (b === null) return;
    this.busy = true;
    this.progress('saving');
    try {
      const baked = await b.finish();
      this.baker = null;
      if (baked === null) { this.mode = 'live'; this.progress('failed', 'short'); return; }
      this.baked = baked;
      try { await (await this.clips()).save(baked.header, baked.chunks, baked.keys); } catch { /* ohne Speicher gilt der Nachweis nur jetzt */ }
      this.info = infoOf(baked.header, baked.header.layout);
      this.host.post({ type: 'clip', info: this.info });
      this.progress('done');
      this.startPlayback(baked.header, true);
    } catch (err) {
      this.baker = null;
      this.mode = 'live';
      this.progress('failed', err instanceof Error ? err.message : String(err));
    } finally {
      this.busy = false;
    }
  }

  /** Ein Vorschaubild beim Backen: die Ebenen des zuletzt aufgenommenen Bildes, höchstens alle 0,3 s. */
  preview(): Layers | null {
    const b = this.baker;
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
    void this.clips().then((s) => s.touch(h.key)).catch(() => undefined);
    this.host.wake();
  }

  /** Den Nachweis der jetzigen Szene abspielen. */
  async open(play: boolean): Promise<void> {
    if (this.mode === 'baking' || this.busy) return;
    if (this.mode === 'playback') { this.playing = play; return; }
    const key = this.key;
    if (key === null) return;
    const h = this.baked?.header.key === key ? this.baked.header : await (await this.clips()).header(key);
    if (h === null) { this.info = null; this.host.post({ type: 'clip', info: null }); return; }
    this.startPlayback(h, play);
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
   */
  async live(): Promise<void> {
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
      const e = this.host.engine();
      e.load(h.scene);
      const charts = new Charts(e);
      restoreSnapshot(rootOf(e, charts), raw);
      this.host.setCharts(charts);
      const target = k / h.fps - 1e-9;
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

  async remove(): Promise<void> {
    const key = this.player?.header.key ?? this.key;
    if (this.mode === 'playback') this.close();
    if (key === null) return;
    if (this.baked?.header.key === key) this.baked = null;
    try { await (await this.clips()).remove(key); } catch { /* nichts zu löschen */ }
    this.info = null;
    this.host.post({ type: 'clip', info: null });
  }

  /** Was die Oberfläche fünfmal je Sekunde vom Nachweis erfährt. */
  stats(): HostStats['clip'] {
    if (this.mode === 'playback' && this.player !== null) {
      return { mode: 'playback', t: this.t, duration: this.player.header.duration, playing: this.playing, loop: this.loop, loading: this.player.failed ?? null };
    }
    if (this.mode === 'baking' && this.baker !== null) {
      return { mode: 'baking', t: this.baker.time, duration: this.baker.seconds, playing: false, loop: this.loop, loading: null };
    }
    return null;
  }
}
