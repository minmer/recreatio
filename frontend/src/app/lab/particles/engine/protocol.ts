/**
 * PARTIKEL-LABOR — DIE NACHRICHTEN zwischen Seite (Host) und Arbeiter.
 * Partikeldaten gehen nie in React; die Oberfläche liest Kennzahlen mit
 * 5–10 Hz. Rendert der Arbeiter nicht selbst (kein WebGL2 auf einer
 * OffscreenCanvas), schickt er je Bild eine Momentaufnahme in übertragbaren
 * Puffern, und die Seite gibt sie mit `frameDone` zurück.
 */

import type { EngineStats, ParticleInfo } from './engine';
import type { HeaterMode, Op, Quality, Side } from './scene';

export interface View { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }

export type HostMessage =
  | { readonly type: 'probe' }
  | { readonly type: 'init'; readonly canvas: OffscreenCanvas | null; readonly width: number; readonly height: number; readonly dpr: number; readonly scene: unknown; readonly showAir: boolean }
  | { readonly type: 'resize'; readonly width: number; readonly height: number; readonly dpr: number }
  | { readonly type: 'op'; readonly op: Op }
  | { readonly type: 'setHeater'; readonly group: number; readonly mode: HeaterMode; readonly power: number; readonly target: number; readonly on: boolean }
  | { readonly type: 'setAmbient'; readonly p: number; readonly T: number; readonly g: number }
  | { readonly type: 'setBoundary'; readonly side: 'left' | 'right' | 'bottom' | 'top'; readonly value: Side }
  | { readonly type: 'query'; readonly id: number; readonly x: number; readonly y: number }
  | { readonly type: 'pause'; readonly paused: boolean }
  | { readonly type: 'step' }
  | { readonly type: 'setSpeed'; readonly speed: number }
  | { readonly type: 'setQuality'; readonly quality: Quality }
  | { readonly type: 'showAir'; readonly show: boolean }
  | { readonly type: 'serialize'; readonly id: number }
  | { readonly type: 'load'; readonly scene: unknown }
  | { readonly type: 'frameDone'; readonly pos: Float32Array; readonly size: Float32Array; readonly col: Uint8Array };

export interface HostStats {
  readonly engine: EngineStats;
  /** Teilschritte je Sekunde Echtzeit und Simulationssekunden je Sekunde Echtzeit. */
  readonly stepsPerSecond: number;
  readonly simRate: number;
  /** Bilder je Sekunde und Zeit je Bild beim Zeichnen (ms). */
  readonly fps: number;
  readonly renderMs: number;
  readonly mode: 'worker' | 'main';
  readonly paused: boolean;
}

export type WorkerMessage =
  | { readonly type: 'probe'; readonly webgl2: boolean }
  | { readonly type: 'ready'; readonly offscreen: boolean; readonly warnings: readonly string[]; readonly view: View; readonly quality: Quality }
  | { readonly type: 'view'; readonly view: View }
  | { readonly type: 'stats'; readonly stats: HostStats }
  | { readonly type: 'frame'; readonly n: number; readonly pos: Float32Array; readonly size: Float32Array; readonly col: Uint8Array; readonly view: View }
  | { readonly type: 'reply'; readonly id: number; readonly data: ParticleInfo | Record<string, unknown> | null }
  | { readonly type: 'error'; readonly message: string };
