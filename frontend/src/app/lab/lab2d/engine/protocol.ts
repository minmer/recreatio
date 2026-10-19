/**
 * LABOR 2D (v2) — DIE NACHRICHTEN zwischen Seite (Host) und Arbeiter (Prompt
 * v2: addLiquid, addSolid, setHeater, setAmbient, setBoundary, query, pause,
 * step, setSpeed, setQuality, serialize, load). Feld- und Teilchendaten gehen
 * nie in React; die Oberfläche liest Kennzahlen fünfmal je Sekunde. Zeichnet
 * der Arbeiter nicht selbst (kein WebGL2 auf einer OffscreenCanvas), schickt
 * er je Bild die Puffer (übertragbar), und die Seite gibt sie zurück.
 */

import type { FrameBuffers, Overlay } from '../render/frame';
import type { Walls } from '../render/glRenderer';
import type { View } from '../render/view';
import type { EngineStats, ProbeInfo } from './engine';
import type { HeaterMode, Op, Quality, Side, SideName } from './scene';
import type { Region } from './shapes';

export type HostMessage =
  | { readonly type: 'probe' }
  | { readonly type: 'init'; readonly canvas: OffscreenCanvas | null; readonly width: number; readonly height: number; readonly dpr: number; readonly scene: unknown; readonly dark: boolean }
  | { readonly type: 'resize'; readonly width: number; readonly height: number; readonly dpr: number }
  | { readonly type: 'op'; readonly op: Op }
  | { readonly type: 'addLiquid'; readonly region: Region; readonly composition: Readonly<Record<string, number>>; readonly T: number }
  | { readonly type: 'addSolid'; readonly region: Region; readonly material: string; readonly T: number }
  | { readonly type: 'setHeater'; readonly group: number; readonly mode: HeaterMode; readonly power: number; readonly target: number; readonly on: boolean }
  | { readonly type: 'setAmbient'; readonly p: number; readonly T: number; readonly rh: number; readonly g: number }
  | { readonly type: 'setBoundary'; readonly side: SideName; readonly value: Side }
  | { readonly type: 'query'; readonly id: number; readonly x: number; readonly y: number }
  | { readonly type: 'select'; readonly bubble: number | null }
  | { readonly type: 'overlay'; readonly overlay: Overlay }
  | { readonly type: 'pause'; readonly paused: boolean }
  | { readonly type: 'step' }
  | { readonly type: 'setSpeed'; readonly speed: number }
  | { readonly type: 'setQuality'; readonly quality: Quality }
  | { readonly type: 'serialize'; readonly id: number }
  | { readonly type: 'load'; readonly scene: unknown }
  | { readonly type: 'theme'; readonly dark: boolean }
  | { readonly type: 'frameDone'; readonly frame: FrameBuffers };

/** Eine Zeile der Schreiber (alle 0,25 s Simulationszeit). */
export interface ChartSample {
  t: number;
  /** Mittlere und höchste Wassertemperatur (K), Siedetemperatur an der Oberfläche (K). */
  waterT: number;
  waterTmax: number;
  Tsat: number;
  /** Energie seit dem Start (J): Heizung, gespeichert fühlbar, latent (Dampf), Verluste (Wände, offene Seiten), entwichen. */
  heater: number;
  sensible: number;
  latent: number;
  losses: number;
  escaped: number;
  /** Wasser nach Zustand (kg). */
  liquid: number;
  vapour: number;
  fog: number;
  film: number;
  bubbles: number;
  escapedWater: number;
  /** Dampferzeugung (kg/s) und (P − Verluste)/h_lv (kg/s). */
  vapourRate: number;
  expectedRate: number;
}

/** Die gewählte Blase für die Ansicht „Blase“: Zustand und Kräfte (N). */
export type BubbleView = NonNullable<ProbeInfo['bubble']> & { readonly x: number; readonly y: number; readonly Tl: number };

export interface HostStats {
  readonly engine: EngineStats;
  readonly stepsPerSecond: number;
  readonly simRate: number;
  readonly fps: number;
  readonly renderMs: number;
  readonly mode: 'worker' | 'main';
  readonly paused: boolean;
  readonly samples: readonly ChartSample[];
  readonly bubble: BubbleView | null;
}

export type WorkerMessage =
  | { readonly type: 'probe'; readonly webgl2: boolean }
  | { readonly type: 'ready'; readonly offscreen: boolean; readonly warnings: readonly string[]; readonly view: View; readonly quality: Quality; readonly walls: Walls }
  | { readonly type: 'view'; readonly view: View; readonly walls: Walls }
  | { readonly type: 'stats'; readonly stats: HostStats }
  | { readonly type: 'frame'; readonly frame: FrameBuffers; readonly view: View; readonly walls: Walls }
  | { readonly type: 'reply'; readonly id: number; readonly data: ProbeInfo | Record<string, unknown> | null }
  | { readonly type: 'refused'; readonly message: string }
  | { readonly type: 'error'; readonly message: string };
