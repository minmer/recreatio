/**
 * LABOR 2D (v2) — DIE NACHRICHTEN zwischen Seite (Host) und Arbeiter (Prompt
 * v2: addLiquid, addSolid, setHeater, setAmbient, setBoundary, query, pause,
 * step, setSpeed, setQuality, serialize, load). Feld- und Teilchendaten gehen
 * nie in React; die Oberfläche liest Kennzahlen fünfmal je Sekunde. Zeichnet
 * der Arbeiter nicht selbst (kein WebGL2 auf einer OffscreenCanvas), schickt
 * er je Bild die Puffer (übertragbar), und die Seite gibt sie zurück.
 */

import type { ClipEngine, ClipInfo } from '../clip/clip';
import type { FrameBuffers, Overlay } from '../render/frame';
import type { Walls } from '../render/glRenderer';
import type { View } from '../render/view';
import type { EngineStats, ProbeInfo } from './engine';
import type { ExtremeEvent } from './extremes';
import type { ObjectPatch, ObjectView } from './objects';
import type { ExtremeMode, HeaterMode, Op, Quality, Side, SideName } from './scene';
import type { Region } from './shapes';

export type HostMessage =
  | { readonly type: 'probe' }
  /** paused: ruhend beginnen (das Labor startet nie von selbst, B); resume: ein Schlüsselbild der Szene, ab dem es live weitergeht (B, Nachweis von der GPU). */
  | { readonly type: 'init'; readonly canvas: OffscreenCanvas | null; readonly width: number; readonly height: number; readonly dpr: number; readonly scene: unknown; readonly dark: boolean; readonly paused?: boolean; readonly resume?: Uint8Array }
  | { readonly type: 'resize'; readonly width: number; readonly height: number; readonly dpr: number }
  | { readonly type: 'op'; readonly op: Op }
  | { readonly type: 'addLiquid'; readonly region: Region; readonly composition: Readonly<Record<string, number>>; readonly T: number }
  | { readonly type: 'addSolid'; readonly region: Region; readonly material: string; readonly T: number }
  | { readonly type: 'setHeater'; readonly group: number; readonly mode: HeaterMode; readonly power: number; readonly target: number; readonly on: boolean }
  | { readonly type: 'setAmbient'; readonly p: number; readonly T: number; readonly rh: number; readonly g: number; readonly air?: { readonly N2: number; readonly O2: number } }
  | { readonly type: 'setBoundary'; readonly side: SideName; readonly value: Side }
  | { readonly type: 'query'; readonly id: number; readonly x: number; readonly y: number }
  | { readonly type: 'select'; readonly bubble: number | null }
  /** Gegenstände (seit 2026-10-23): einen wählen (seine Daten kommen mit den Kennzahlen) und seine Einstellungen ändern (Antwort: neu aufgebaut?, Warnung). */
  | { readonly type: 'selectObject'; readonly object: string | null }
  | { readonly type: 'editObject'; readonly id: number; readonly object: string; readonly patch: ObjectPatch }
  | { readonly type: 'overlay'; readonly overlay: Overlay }
  | { readonly type: 'particles'; readonly on: boolean }
  | { readonly type: 'pause'; readonly paused: boolean }
  | { readonly type: 'step' }
  | { readonly type: 'setSpeed'; readonly speed: number }
  | { readonly type: 'setQuality'; readonly quality: Quality }
  /** Wie heftige Zustände gerechnet werden (extremes.ts): auch die Antwort auf eine Frage (extreme). */
  | { readonly type: 'setExtremes'; readonly mode: ExtremeMode }
  | { readonly type: 'serialize'; readonly id: number }
  | { readonly type: 'load'; readonly scene: unknown }
  | { readonly type: 'theme'; readonly dark: boolean }
  | { readonly type: 'frameDone'; readonly frame: FrameBuffers }
  /* -- Nachweise (B): backen, abspielen, live weiter (backen und abspielen nur der normale Weg) -- */
  | { readonly type: 'bake'; readonly options: BakeOptions }
  | { readonly type: 'bakeStop' }
  /** Das Fenster des Backens ist offen: Grafikkarte und Kerne schon vorbereiten (die Übersetzung dauert Sekunden). */
  | { readonly type: 'bakePrepare' }
  /** prefer: welcher Nachweis spielt, wenn es beide gibt (sonst der da ist). */
  | { readonly type: 'clipOpen'; readonly play: boolean; readonly prefer?: ClipEngine }
  /** Bei der Wiedergabe den Nachweis der anderen Engine abspielen (an derselben Stelle). */
  | { readonly type: 'clipEngine'; readonly engine: ClipEngine }
  | { readonly type: 'clipPlay'; readonly playing: boolean }
  | { readonly type: 'clipSeek'; readonly t: number }
  | { readonly type: 'clipLoop'; readonly on: boolean }
  /** accel: ein Nachweis von der GPU geht im beschleunigten Weg weiter (der Arbeiter schickt resume), sonst hier. */
  | { readonly type: 'clipLive'; readonly accel?: boolean }
  | { readonly type: 'clipClose' }
  | { readonly type: 'clipDelete' };

/**
 * Wie gebacken wird (seit 2026-10-24): Länge (s Simulationszeit), Bilder je Sekunde (die Genauigkeit der Zeitleiste),
 * ein Schlüsselbild alle keyEvery Sekunden (dort geht es live weiter; mehr kostet Platz), die Auflösung und wie heftige
 * Zustände gerechnet werden (beim Backen wird nicht gefragt). Auflösung und Heftigkeit gehören zur Szene — und so zum
 * Schlüssel des Nachweises.
 */
export interface BakeOptions {
  readonly seconds: number;
  readonly fps: number;
  readonly keyEvery: number;
  readonly quality: Quality;
  readonly extremes: Exclude<ExtremeMode, 'ask'>;
  /** Wer rechnet (seit 2026-10-25; fehlt: die CPU): die Grafikkarte, wo WebGPU geht und die Szene es erlaubt — sonst die CPU mit einem Hinweis. */
  readonly engine?: ClipEngine;
}

/** Warum die CPU backt, obwohl die Grafikkarte gewählt war: Körper in Bewegung, Eis, Körner; kein WebGPU; Karte oder Kerne versagten. Mitten im Backen verloren: ein kürzerer Nachweis. */
export type BakeNote = 'cpu-only' | 'no-webgpu' | 'gpu-failed' | 'gpu-lost';

/** Der Stand eines Nachweises in den Kennzahlen: beim Backen (t: aufgenommen) oder bei der Wiedergabe (t: gezeigt). */
export interface ClipStats {
  readonly mode: 'baking' | 'playback';
  readonly t: number;
  readonly duration: number;
  readonly playing: boolean;
  readonly loop: boolean;
  /** Ein Stück liess sich nicht laden (Meldung) — sonst null. */
  readonly loading: string | null;
}

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
/** Was aus der gewählten Blase wurde: lebt (null), geplatzt, vergangen (kondensiert), in eine andere aufgegangen (die gezeigte ist die vereinigte). */
export type BubbleFate = 'burst' | 'collapsed' | 'merged' | null;

export type BubbleView = NonNullable<ProbeInfo['bubble']> & { readonly x: number; readonly y: number; readonly Tl: number; readonly fate: BubbleFate };

export interface HostStats {
  readonly engine: EngineStats;
  readonly stepsPerSecond: number;
  readonly simRate: number;
  readonly fps: number;
  readonly renderMs: number;
  /** Wer rechnet und zeichnet: der Arbeiter (CPU, WebGL2), die Seite (Bilder vom Arbeiter) oder der beschleunigte Weg (WebGPU). */
  readonly mode: 'worker' | 'main' | 'gpu';
  /** Beschleunigter Weg: die Grafikkarte. */
  readonly adapter?: string;
  readonly paused: boolean;
  readonly samples: readonly ChartSample[];
  readonly bubble: BubbleView | null;
  /** Der gewählte Gegenstand (null: keiner oder nicht mehr da). */
  readonly object?: ObjectView | null;
  /** Anfang und Ende der Farbskala der Einblendung im letzten Bild (SI-Einheiten); dazu die grösste Geschwindigkeit des Wassers (Pfeile). */
  readonly overlayScale: readonly [number, number, number];
  /** Backen oder Wiedergabe (null: live). */
  readonly clip?: ClipStats | null;
}

export type WorkerMessage =
  | { readonly type: 'probe'; readonly webgl2: boolean }
  | { readonly type: 'ready'; readonly offscreen: boolean; readonly warnings: readonly string[]; readonly view: View; readonly quality: Quality; readonly walls: Walls }
  | { readonly type: 'view'; readonly view: View; readonly walls: Walls }
  | { readonly type: 'stats'; readonly stats: HostStats }
  | { readonly type: 'frame'; readonly frame: FrameBuffers; readonly view: View; readonly walls: Walls }
  | { readonly type: 'reply'; readonly id: number; readonly data: ProbeInfo | Record<string, unknown> | null }
  | { readonly type: 'refused'; readonly message: string }
  /** Beschleunigter Weg: ob WebGPU läuft (sonst zurück zur CPU) und auf welcher Karte. */
  /** Der beschleunigte Weg: gestartet oder nicht; lehnt er eine Szene ab (z. B. mit Öl), schickt er sie zurück (scene), damit der normale Weg mit allen Handgriffen weitermacht. */
  | { readonly type: 'gpu'; readonly ok: boolean; readonly adapter: string; readonly message: string; readonly scene?: unknown }
  | { readonly type: 'error'; readonly message: string }
  /** Der Nachweis der jetzigen Szene (null: keiner) — nach dem Start, nach Änderungen, nach dem Backen. */
  | { readonly type: 'clip'; readonly info: ClipInfo | null }
  /**
   * Backen: bereitet die Grafikkarte vor (Kerne übersetzen), läuft (t von seconds, rate: Simulations- je echte Sekunde), wird gespeichert,
   * fertig, fehlgeschlagen; seeking: auf dem Weg zum gezeigten Bild (live weiter). engine: wer backt; note: warum die CPU statt der Karte.
   */
  | { readonly type: 'bake'; readonly state: 'preparing' | 'running' | 'saving' | 'done' | 'failed' | 'seeking'; readonly t: number; readonly seconds: number; readonly rate: number; readonly message?: string; readonly engine?: ClipEngine; readonly note?: BakeNote }
  /** Live weiter ab t (die Wiedergabe ist vorbei; das Labor ruht). */
  | { readonly type: 'live'; readonly t: number }
  /** Live weiter aus einem Nachweis von der GPU im beschleunigten Weg: die Szene und das Schlüsselbild (ungepackt) für dessen Arbeiter (init.resume); t: seine Zeit. */
  | { readonly type: 'resume'; readonly scene: unknown; readonly snapshot: Uint8Array; readonly t: number }
  /** Ein heftiger Zustand bei „ask“: der Arbeiter hat angehalten und wartet auf setExtremes. */
  | { readonly type: 'extreme'; readonly event: ExtremeEvent };
