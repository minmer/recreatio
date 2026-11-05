/**
 * 2026-11-05 (Prompt 17) — DAS ABSPIELEN AUF DER KARTE, ohne Leinwand: was abgespielt wird (`WorldPlayback`, von
 * `LandscapeView` aus dem letzten gezeigten Stand), wann jeder Teil läuft (`playTimes`) und wie die Welle läuft
 * (`waveDelays`). Gezeichnet wird in `WorldMap`.
 * <code>
 *   Reihenfolge   Kamera → Säulen und Ringe → Umrisse und Schimmer → Figuren → Punkte → Gebiete (und Meldungen)
 *   Dauer         je Teil 300–800 ms, zusammen meist unter 3 s; die Welle der Nachbarn höchstens 0,3 s
 *   Eingabe       nichts blockiert: ein Klick oder eine Taste überspringt den Rest (das Ende steht sofort)
 *   Bewegung      „pełne" wie oben; „ograniczone" — nur eine Überblendung vom alten Bild zum neuen; „wyłączone" — sofort
 * </code>
 */

import type { WorldBefore } from './landscapeShown';
import type { MotionLevel } from '../ui/motion';

export interface WorldPlayback {
  /** Neu je Abspielen (dieselbe `id`: nicht noch einmal). */
  readonly id: number;
  /** return — zurück auf die Karte; live — während sie zu sehen war (keine Kamera, keine fliegenden Punkte); first — der erste Besuch. */
  readonly kind: 'return' | 'live' | 'first';
  /** Je Thema (in der Reihenfolge der Karte), wie es vorher aussah; leer beim ersten Besuch. */
  readonly before: readonly (WorldBefore | null)[];
  readonly learned: readonly number[];
  readonly reviewed: readonly number[];
  readonly opened: readonly number[];
  readonly lowered: readonly number[];
  readonly moved: readonly number[];
  readonly fresh: readonly number[];
  /** Punkte je Thema (die grössten fliegen einzeln) — und der Rest als eine Summe. */
  readonly points: readonly { readonly t: number; readonly n: number }[];
  readonly rest: number;
  /** Neu eroberte Gebiete (nur die obersten davon). */
  readonly conquered: readonly string[];
  /** Figuren, die weitergingen — und die, deren Thema jetzt gekonnt ist (sie gehen). */
  readonly walks: readonly { readonly from: number; readonly to: number; readonly kind: 'single' | 'goal' }[];
  readonly leaving: readonly { readonly t: number; readonly kind: 'single' | 'goal' }[];
}

export type PlaybackEvent =
  | { readonly kind: 'start'; readonly id: number; readonly points: number }
  | { readonly kind: 'points'; readonly id: number; readonly n: number }
  | { readonly kind: 'regions'; readonly id: number; readonly keys: readonly string[] }
  | { readonly kind: 'end'; readonly id: number; readonly skipped: boolean };

/** Alle Punkte eines Abspielens (was zum Zähler fliegt). */
export const playPoints = (pb: WorldPlayback): number => pb.points.reduce((s, p) => s + p.n, 0) + pb.rest;

export const COL_MS = 600;
export const RISE_MS = 750;
export const LINE_MS = 650;
export const SHIMMER_MS = 700;
export const PULSE_MS = 520;
export const WALK_MS = 700;
export const FLY_MS = 750;
export const FLY_GAP = 90;
export const REGION_MS = 900;
export const FADE_MS = 500;
export const CAM_MS = 620;
/** Höchstens so viele „+N" einzeln — der Rest fliegt als eine Summe. */
export const FLY_SINGLE = 4;

export interface PlayTimes {
  readonly cam1: number;
  readonly col0: number;
  /** Wie lange eine Säule sinkt (oder steigt). */
  readonly colMs: number;
  readonly col1: number;
  readonly line0: number;
  readonly line1: number;
  readonly walk0: number;
  readonly walk1: number;
  readonly pts0: number;
  readonly reg0: number;
  readonly end: number;
  /** „ograniczone": so lange die Überblendung (sonst 0). */
  readonly fade: number;
}

/** Wann jeder Teil läuft (Millisekunden ab dem Anfang). */
export function playTimes(o: {
  readonly kind: WorldPlayback['kind'];
  readonly motion: MotionLevel;
  readonly camMove: boolean;
  /** Die längste Verzögerung der Welle. */
  readonly wave: number;
  readonly lines: boolean;
  readonly pulses: boolean;
  readonly walks: boolean;
  /** Wie viele „+N" fliegen. */
  readonly flights: number;
  readonly regions: boolean;
}): PlayTimes {
  if (o.motion === 'off') return { cam1: 0, col0: 0, colMs: 0, col1: 0, line0: 0, line1: 0, walk0: 0, walk1: 0, pts0: 0, reg0: 0, end: 0, fade: 0 };
  if (o.motion === 'reduced') return { cam1: 0, col0: 0, colMs: 0, col1: 0, line0: 0, line1: 0, walk0: 0, walk1: 0, pts0: 0, reg0: FADE_MS, end: FADE_MS, fade: FADE_MS };
  const cam1 = o.camMove ? CAM_MS : 0;
  const col0 = cam1 + (o.camMove ? 60 : 0);
  const colMs = o.kind === 'first' ? RISE_MS : COL_MS;
  const col1 = col0 + colMs + o.wave;
  if (o.kind === 'first') return { cam1, col0, colMs, col1, line0: col1, line1: col1, walk0: col1, walk1: col1, pts0: col1, reg0: col1, end: col1, fade: 0 };
  const pulseEnd = o.pulses ? col0 + colMs - 120 + PULSE_MS : col1;
  const line0 = col0 + colMs - 150;
  const line1 = line0 + (o.lines ? Math.max(LINE_MS, SHIMMER_MS) : 0);
  const walk0 = Math.max(col1, line1 - 200);
  const walk1 = walk0 + (o.walks ? WALK_MS : 0);
  const pts0 = o.walks ? walk0 + 250 : Math.max(col1 - 100, line1 - 150);
  const ptsEnd = o.flights > 0 ? pts0 + FLY_MS + FLY_GAP * (Math.min(o.flights, FLY_SINGLE + 1) - 1) : pts0;
  /* Die Fahne steigt, während die letzten Punkte noch fliegen. */
  const reg0 = o.flights > 0 ? pts0 + 450 : Math.max(line1, walk1, pulseEnd) - 100;
  const end = Math.max(col1, pulseEnd, line1, walk1, ptsEnd, o.regions ? reg0 + REGION_MS : 0);
  return { cam1, col0, colMs, col1, line0, line1, walk0, walk1, pts0, reg0, end, fade: 0 };
}

export const easeOut = (k: number): number => 1 - (1 - k) ** 3;
export const easeInOut = (k: number): number => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
export const clamp01 = (k: number): number => (k <= 0 ? 0 : k >= 1 ? 1 : k);

const HEX: readonly (readonly [number, number])[] = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];

/**
 * DIE WELLE: wer niedriger wurde, sinkt kurz nach dem Gelernten — je Schritt auf der Karte (Nachbarfeld) ein wenig
 * später, höchstens 0,3 s. Beim ersten Besuch steigen die Säulen von der Mitte nach aussen auf (höchstens 0,45 s).
 */
export function waveDelays(cells: readonly { readonly q: number; readonly r: number; readonly x: number; readonly y: number }[], kind: WorldPlayback['kind'], from: readonly number[], late: readonly number[]): Float32Array {
  const n = cells.length;
  const out = new Float32Array(n);
  if (kind === 'first') {
    let most = 0;
    for (const c of cells) most = Math.max(most, Math.hypot(c.x, c.y));
    for (let i = 0; i < n; i += 1) out[i] = most <= 0 ? 0 : (450 * Math.hypot(cells[i].x, cells[i].y)) / most;
    return out;
  }
  if (late.length === 0) return out;
  const at = new Map<string, number>();
  cells.forEach((c, i) => at.set(`${c.q},${c.r}`, i));
  const dist = new Int16Array(n).fill(-1);
  let front: number[] = [];
  for (const i of from) if (i >= 0 && i < n && dist[i] < 0) { dist[i] = 0; front.push(i); }
  for (let d = 1; d <= 4 && front.length > 0; d += 1) {
    const next: number[] = [];
    for (const i of front) {
      for (const [dq, dr] of HEX) {
        const j = at.get(`${cells[i].q + dq},${cells[i].r + dr}`);
        if (j === undefined || dist[j] >= 0) continue;
        dist[j] = d;
        next.push(j);
      }
    }
    front = next;
  }
  for (const i of late) out[i] = dist[i] < 0 ? 300 : Math.min(300, 120 + 60 * Math.max(0, dist[i] - 1));
  return out;
}
