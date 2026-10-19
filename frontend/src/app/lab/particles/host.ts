/**
 * PARTIKEL-LABOR — DIE SEITE DES ARBEITERS (Host): startet ihn, fragt, ob er
 * auf einer OffscreenCanvas mit WebGL2 zeichnen kann, und übergibt ihm dann
 * die Leinwand; sonst zeichnet die Seite selbst, was er je Bild schickt (und
 * gibt die Puffer zurück). Befehle gehen als Nachrichten hin, Antworten auf
 * Fragen (Inspektor, Speichern) kommen als Versprechen zurück. Zeiger rechnet
 * sie mit der Ansicht des Arbeiters in Meter um.
 */

import type { ParticleInfo } from './engine/engine';
import type { HostMessage, HostStats, View, WorkerMessage } from './engine/protocol';
import type { HeaterMode, Op, Quality } from './engine/scene';
import { ParticleRenderer } from './render/glRenderer';
import { toWorld } from './render/view';

export interface HostEvents {
  readonly onReady: (info: { readonly offscreen: boolean; readonly warnings: readonly string[]; readonly quality: Quality }) => void;
  readonly onStats: (stats: HostStats) => void;
  readonly onError: (message: string) => void;
}

export class ParticleHost {
  private readonly worker: Worker;
  private readonly canvas: HTMLCanvasElement;
  private readonly events: HostEvents;
  private renderer: ParticleRenderer | null = null;
  private view: View = { x0: 0, y0: 0, x1: 1, y1: 1 };
  private width = 1;
  private height = 1;
  private dpr = 1;
  private seq = 0;
  private readonly waiting = new Map<number, (data: unknown) => void>();
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, createWorker: () => Worker, events: HostEvents) {
    this.canvas = canvas;
    this.events = events;
    this.worker = createWorker();
    this.worker.addEventListener('message', (e: MessageEvent<WorkerMessage>) => this.receive(e.data));
    this.worker.addEventListener('error', (e) => events.onError(e.message || 'Silnik przestał działać.'));
  }

  /** Starten: zuerst fragen, wo gezeichnet wird, dann die Szene laden. */
  async start(scene: unknown, showAir: boolean, width: number, height: number, dpr: number): Promise<void> {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    const webgl2 = await this.probe();
    if (this.disposed) return;
    if (webgl2 && typeof this.canvas.transferControlToOffscreen === 'function') {
      const off = this.canvas.transferControlToOffscreen();
      this.post({ type: 'init', canvas: off, width, height, dpr, scene, showAir }, [off]);
      return;
    }
    const gl = this.canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: true, alpha: false });
    if (gl === null) this.events.onError('Ta przeglądarka nie obsługuje WebGL2 — laboratorium liczy, ale nie rysuje.');
    else this.renderer = new ParticleRenderer(gl);
    this.sizeCanvas();
    this.post({ type: 'init', canvas: null, width, height, dpr, scene, showAir });
  }

  private probe(): Promise<boolean> {
    return new Promise((resolve) => {
      let done = false;
      const listener = (e: MessageEvent<WorkerMessage>): void => {
        if (e.data.type !== 'probe' || done) return;
        done = true;
        this.worker.removeEventListener('message', listener);
        resolve(e.data.webgl2);
      };
      this.worker.addEventListener('message', listener);
      this.post({ type: 'probe' });
      setTimeout(() => { if (!done) { done = true; this.worker.removeEventListener('message', listener); resolve(false); } }, 2000);
    });
  }

  private sizeCanvas(): void {
    if (this.renderer === null) return;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }

  private receive(m: WorkerMessage): void {
    switch (m.type) {
      case 'ready':
        this.view = m.view;
        this.events.onReady({ offscreen: m.offscreen, warnings: m.warnings, quality: m.quality });
        break;
      case 'view':
        this.view = m.view;
        break;
      case 'stats':
        this.events.onStats(m.stats);
        break;
      case 'frame':
        this.view = m.view;
        this.renderer?.draw(m.n, m.pos, m.size, m.col, m.view, this.canvas.width, this.canvas.height);
        this.post({ type: 'frameDone', pos: m.pos, size: m.size, col: m.col }, [m.pos.buffer, m.size.buffer, m.col.buffer]);
        break;
      case 'reply': {
        const fn = this.waiting.get(m.id);
        this.waiting.delete(m.id);
        fn?.(m.data);
        break;
      }
      case 'error':
        this.events.onError(m.message);
        break;
      case 'probe':
        break;
    }
  }

  private post(m: HostMessage, transfer: Transferable[] = []): void {
    if (!this.disposed) this.worker.postMessage(m, transfer);
  }

  private ask<T>(make: (id: number) => HostMessage): Promise<T | null> {
    const id = (this.seq += 1);
    return new Promise((resolve) => {
      this.waiting.set(id, (data) => resolve(data as T | null));
      this.post(make(id));
    });
  }

  resize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.sizeCanvas();
    this.post({ type: 'resize', width, height, dpr });
  }

  apply(op: Op): void { this.post({ type: 'op', op }); }
  pause(paused: boolean): void { this.post({ type: 'pause', paused }); }
  step(): void { this.post({ type: 'step' }); }
  setSpeed(speed: number): void { this.post({ type: 'setSpeed', speed }); }
  setQuality(quality: Quality): void { this.post({ type: 'setQuality', quality }); }
  showAir(show: boolean): void { this.post({ type: 'showAir', show }); }
  load(scene: unknown): void { this.post({ type: 'load', scene }); }
  setHeater(group: number, mode: HeaterMode, power: number, target: number, on: boolean): void { this.post({ type: 'setHeater', group, mode, power, target, on }); }

  query(x: number, y: number): Promise<ParticleInfo | null> {
    return this.ask<ParticleInfo>((id) => ({ type: 'query', id, x, y }));
  }

  serialize(): Promise<Record<string, unknown> | null> {
    return this.ask<Record<string, unknown>>((id) => ({ type: 'serialize', id }));
  }

  /** Ein Punkt der Leinwand (CSS-Pixel) in Metern der Kiste. */
  toWorld(px: number, py: number): [number, number] {
    return toWorld(this.view, px, py, this.width, this.height);
  }

  get currentView(): View { return this.view; }

  dispose(): void {
    this.disposed = true;
    this.waiting.clear();
    this.worker.terminate();
  }
}
