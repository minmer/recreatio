/**
 * LABOR 2D (v2) — DIE SEITE DES ARBEITERS (Host): startet ihn, fragt, ob er auf
 * einer OffscreenCanvas mit WebGL2 zeichnen kann, und übergibt ihm dann die
 * Leinwand; sonst zeichnet die Seite selbst, was er je Bild schickt (und gibt
 * die Puffer zurück). Befehle gehen als Nachrichten hin, Antworten (Inspektor,
 * Speichern) kommen als Versprechen zurück. Zeiger rechnet sie mit der Ansicht
 * des Arbeiters in Meter um.
 */

import type { ProbeInfo } from './engine/engine';
import type { HostMessage, HostStats, WorkerMessage } from './engine/protocol';
import type { HeaterMode, Op, Quality, Side, SideName } from './engine/scene';
import type { Region } from './engine/shapes';
import { frameTransfer, type Overlay } from './render/frame';
import { LabRenderer, type Walls } from './render/glRenderer';
import { toScreen, toWorld, type View } from './render/view';

export interface HostEvents {
  readonly onReady: (info: { readonly offscreen: boolean; readonly warnings: readonly string[]; readonly quality: Quality }) => void;
  readonly onStats: (stats: HostStats) => void;
  readonly onView: (view: View, walls: Walls) => void;
  readonly onRefused: (message: string) => void;
  readonly onError: (message: string) => void;
  /** Beschleunigter Weg: läuft WebGPU (sonst kehrt die Oberfläche zur CPU zurück)? */
  readonly onGpu?: (ok: boolean, adapter: string, message: string) => void;
}

export class LabHost {
  private readonly worker: Worker;
  private readonly canvas: HTMLCanvasElement;
  private readonly events: HostEvents;
  private renderer: LabRenderer | null = null;
  private view: View = { x0: 0, y0: 0, x1: 1, y1: 1 };
  private walls: Walls = { left: true, right: true, bottom: true, top: false };
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

  async start(scene: unknown, width: number, height: number, dpr: number, dark: boolean): Promise<void> {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    const webgl2 = await this.probe();
    if (this.disposed) return;
    if (webgl2 && typeof this.canvas.transferControlToOffscreen === 'function') {
      const off = this.canvas.transferControlToOffscreen();
      this.post({ type: 'init', canvas: off, width, height, dpr, scene, dark }, [off]);
      return;
    }
    const gl = this.canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: true, alpha: false });
    if (gl === null) this.events.onError('Ta przeglądarka nie obsługuje WebGL2 — laboratorium liczy, ale nie rysuje.');
    else {
      this.renderer = new LabRenderer(gl);
      this.theme(dark);
    }
    this.sizeCanvas();
    this.post({ type: 'init', canvas: null, width, height, dpr, scene, dark });
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
        this.walls = m.walls;
        this.events.onReady({ offscreen: m.offscreen, warnings: m.warnings, quality: m.quality });
        this.events.onView(m.view, m.walls);
        break;
      case 'view':
        this.view = m.view;
        this.walls = m.walls;
        this.events.onView(m.view, m.walls);
        break;
      case 'stats':
        this.events.onStats(m.stats);
        break;
      case 'frame':
        this.view = m.view;
        this.walls = m.walls;
        this.renderer?.draw(m.frame, m.view, this.canvas.width, this.canvas.height, m.walls, 0.003);
        this.post({ type: 'frameDone', frame: m.frame }, frameTransfer(m.frame));
        break;
      case 'reply': {
        const fn = this.waiting.get(m.id);
        this.waiting.delete(m.id);
        fn?.(m.data);
        break;
      }
      case 'refused':
        this.events.onRefused(m.message);
        break;
      case 'error':
        this.events.onError(m.message);
        break;
      case 'gpu':
        this.events.onGpu?.(m.ok, m.adapter, m.message);
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

  theme(dark: boolean): void {
    if (this.renderer !== null) {
      this.renderer.ground = dark ? [0.1, 0.12, 0.15] : [0.93, 0.95, 0.97];
      this.renderer.outside = dark ? [0.06, 0.07, 0.09] : [0.86, 0.88, 0.9];
      this.renderer.wall = dark ? [0.55, 0.6, 0.66] : [0.42, 0.46, 0.5];
    }
    this.post({ type: 'theme', dark });
  }

  apply(op: Op): void { this.post({ type: 'op', op }); }
  addLiquid(region: Region, composition: Readonly<Record<string, number>>, T: number): void { this.post({ type: 'addLiquid', region, composition, T }); }
  addSolid(region: Region, material: string, T: number): void { this.post({ type: 'addSolid', region, material, T }); }
  setHeater(group: number, mode: HeaterMode, power: number, target: number, on: boolean): void { this.post({ type: 'setHeater', group, mode, power, target, on }); }
  setAmbient(p: number, T: number, rh: number, g: number, air?: { N2: number; O2: number }): void { this.post({ type: 'setAmbient', p, T, rh, g, air }); }
  /** Die rohen Teilchen zeigen statt der glatten Wasserfläche. */
  particles(on: boolean): void { this.post({ type: 'particles', on }); }
  setBoundary(side: SideName, value: Side): void { this.post({ type: 'setBoundary', side, value }); }
  select(bubble: number | null): void { this.post({ type: 'select', bubble }); }
  overlay(overlay: Overlay): void { this.post({ type: 'overlay', overlay }); }
  pause(paused: boolean): void { this.post({ type: 'pause', paused }); }
  step(): void { this.post({ type: 'step' }); }
  setSpeed(speed: number): void { this.post({ type: 'setSpeed', speed }); }
  setQuality(quality: Quality): void { this.post({ type: 'setQuality', quality }); }
  load(scene: unknown): void { this.post({ type: 'load', scene }); }

  query(x: number, y: number): Promise<ProbeInfo | null> {
    return this.ask<ProbeInfo>((id) => ({ type: 'query', id, x, y }));
  }

  serialize(): Promise<Record<string, unknown> | null> {
    return this.ask<Record<string, unknown>>((id) => ({ type: 'serialize', id }));
  }

  /** Ein Punkt der Leinwand (CSS-Pixel) in Metern der Kiste. */
  toWorld(px: number, py: number): [number, number] {
    return toWorld(this.view, px, py, this.width, this.height);
  }

  /** Meter in CSS-Pixel. */
  toScreen(x: number, y: number): [number, number] {
    return toScreen(this.view, x, y, this.width, this.height);
  }

  get currentWalls(): Walls { return this.walls; }

  dispose(): void {
    this.disposed = true;
    this.waiting.clear();
    this.worker.terminate();
  }
}
