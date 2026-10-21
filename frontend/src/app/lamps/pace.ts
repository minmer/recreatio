/**
 * DAS TEMPO (2026-10-19) — gespeichert bleibt ein Sygnał so schnell, wie er
 * aufgenommen oder eingetragen wurde. Zwei Regler verlangsamen ihn beim Senden,
 * ohne ihn zu ändern:
 *
 * <code>
 *   przerwa   eine Pause zwischen zwei Sendungen — auf jeder Ebene: zwischen den
 *             einzelnen Paketen, die Android während einer Ramka wiederholt (das
 *             Intervall: 100 ms + Pause, `packetInterval`), zwischen den Ramki eines
 *             Sygnał, zwischen zwei Drücken in der Warteschlange, zwischen den Aktionen
 *             eines Timers — eine Lampe, die schnelle gleiche Pakete als EINEN Druck
 *             liest, zählt so jeden einzeln
 *   limit     wie lange jede Ramka höchstens gesendet wird (nie länger als gespeichert)
 * </code>
 *
 * Beide Regler stehen am Anfang auf „najszybciej": keine Pause, kein Limit.
 *
 * <b>Zwei Paare von Reglern.</b> Die unter den Knöpfen gelten nur für das, was man von
 * Hand sendet (Knöpfe, Proben) — gemerkt am Konto (`lamps.pace`). Jeder Timer hat seine
 * eigenen, gespeichert im Timer (`LampTimerData.pace`) und im Plan des Telefons.
 */

import { DURATION_MIN, GAP_MAX, tidyPace } from './lampStore';
import type { NativeFrame } from './native';

export interface Pace {
  /** Pause zwischen zwei Sendungen, ms. */
  readonly pauseMs: number;
  /** Höchstens so lange je Ramka, ms — `null`: wie gespeichert. */
  readonly limitMs: number | null;
}

export const FASTEST: Pace = { pauseMs: 0, limitMs: null };

/** Der gemerkte Wert am Konto. */
export const PACE_PREF = 'lamps.pace';

/** Die Stufen der Regler — fein, wo es zählt (unter einer Sekunde), grob darüber. */
export const PAUSE_STEPS: readonly number[] = [0, 50, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000];
export const LIMIT_STEPS: readonly number[] = [100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000];

/** Ein Paket alle 100 ms — schneller wiederholt Android eine Werbung nicht. */
export const PACKET_MS = 100;
/** So weit reicht das Intervall (100 ms + die längste Pause) — `LampFrame.MAX_INTERVAL_MS` im Telefon. */
export const PACKET_MAX_MS = PACKET_MS + 10_000;

/** Wie oft das Paket einer Ramka hinausgeht: so schnell wie möglich und die Pause dazu. */
export const packetInterval = (p: Pace): number => Math.min(PACKET_MAX_MS, PACKET_MS + p.pauseMs);

/** Wie viele Pakete eine Ramka dieser Dauer ungefähr bekommt (das erste gleich beim Start). */
export const packetsIn = (durationMs: number, p: Pace): number => Math.floor(durationMs / packetInterval(p)) + 1;

/** Gelesen, was gemerkt war — Unlesbares heisst „najszybciej". */
export function readPace(text: string): Pace {
  try {
    return tidyPace(JSON.parse(text));
  } catch {
    return FASTEST;
  }
}

export const paceText = (p: Pace): string => JSON.stringify({ pauseMs: p.pauseMs, limitMs: p.limitMs });

export const isFastest = (p: Pace): boolean => p.pauseMs === 0 && p.limitMs === null;

/** Die Stufe eines Reglers, die dem Wert am nächsten liegt. */
export const nearestStep = (steps: readonly number[], value: number): number =>
  steps.reduce((best, s, i) => (Math.abs(s - value) < Math.abs(steps[best] - value) ? i : best), 0);

/** Wie lange eine Ramka mit diesem Tempo gesendet wird. */
export const pacedDuration = (durationMs: number, p: Pace): number =>
  (p.limitMs === null ? durationMs : Math.max(DURATION_MIN, Math.min(durationMs, p.limitMs)));

/** Die Pause nach einer Ramka, wenn noch eine folgt: die gespeicherte und die des Reglers. */
export const pacedGap = (gapMs: number, p: Pace): number => Math.min(GAP_MAX, gapMs + p.pauseMs);

/** Die Ramki eines Sygnał mit diesem Tempo: kürzer (Limit), mit mehr Pause zwischen den Paketen und den Ramki. */
export function pacedFrames(frames: readonly NativeFrame[], p: Pace): NativeFrame[] {
  return frames.map((f, i) => ({
    ...f,
    durationMs: pacedDuration(f.durationMs, p),
    gapMs: i < frames.length - 1 ? pacedGap(f.gapMs, p) : f.gapMs,
    intervalMs: packetInterval(p)
  }));
}

export const pauseText = (ms: number): string => (ms === 0 ? 'bez przerwy' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toLocaleString('pl-PL')} s`);

/** Kurz, für eine Zeile: „przerwa 300 ms · najwyżej 500 ms" — `null`, wenn so schnell wie gespeichert. */
export function paceSummary(p: Pace): string | null {
  if (isFastest(p)) return null;
  return [p.pauseMs > 0 ? `przerwa ${pauseText(p.pauseMs)}` : null, p.limitMs !== null ? limitText(p.limitMs) : null].filter(Boolean).join(' · ');
}

export const limitText = (ms: number | null): string =>
  (ms === null ? 'jak zapisano' : `najwyżej ${ms < 1000 ? `${ms} ms` : `${(ms / 1000).toLocaleString('pl-PL')} s`}`);
