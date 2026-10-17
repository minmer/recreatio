/**
 * EIN SPIELER FÜR DIE GANZE APP — Sprachnachrichten und Musik aus den
 * Rozmowy spielen weiter, auch wenn man die Rozmowa verlässt, eine andere
 * öffnet oder (auf dem Telefon) die App in den Hintergrund legt.
 *
 * <b>Warum nicht das `<audio>` in der Nachricht:</b> es gehört der Nachricht.
 * Verlässt man die Rozmowa, verschwindet die Nachricht samt Element — und mit
 * ihr der Ton; ihre Adresse (`blob:`) wird beim Verschwinden zurückgegeben.
 * Hier hält EIN Element, das keiner Seite gehört, das Stück und seine eigene
 * Adresse, bis ein anderes kommt oder man es schliesst.
 *
 * <b>Media Session:</b> Titel und Knöpfe auf dem Sperrbildschirm und in der
 * Benachrichtigung des Telefons — damit spielt das System im Hintergrund
 * weiter und lässt sich von dort anhalten.
 */

import { useSyncExternalStore } from 'react';

export interface Track {
  /** Wiedererkennbar — dieselbe Nachricht, derselbe Anhang. */
  readonly key: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly blob: Blob;
}

export interface NowPlaying {
  readonly key: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly playing: boolean;
  /** Sekunden. */
  readonly time: number;
  readonly duration: number | null;
  readonly ended: boolean;
}

let audio: HTMLAudioElement | null = null;
let current: { key: string; title: string; subtitle: string | null; url: string } | null = null;
let snapshot: NowPlaying | null = null;
const listeners = new Set<() => void>();

const publish = () => {
  snapshot = current === null || audio === null ? null : {
    key: current.key,
    title: current.title,
    subtitle: current.subtitle,
    playing: !audio.paused && !audio.ended,
    time: audio.currentTime,
    duration: Number.isFinite(audio.duration) ? audio.duration : null,
    ended: audio.ended
  };
  for (const one of listeners) one();
};

function element(): HTMLAudioElement {
  if (audio !== null) return audio;
  audio = new Audio();
  audio.preload = 'auto';
  for (const event of ['play', 'pause', 'ended', 'timeupdate', 'loadedmetadata', 'durationchange']) {
    audio.addEventListener(event, publish);
  }

  /* Auf dem Sperrbildschirm und in der Benachrichtigung: anhalten, weiter, springen. */
  const session = typeof navigator === 'undefined' ? undefined : navigator.mediaSession;
  if (session !== undefined) {
    const safe = (action: MediaSessionAction, handler: MediaSessionActionHandler) => {
      try { session.setActionHandler(action, handler); } catch { /* nicht jede Aktion gibt es überall */ }
    };
    safe('play', () => { void audio?.play().catch(() => undefined); });
    safe('pause', () => audio?.pause());
    safe('stop', () => stop());
    safe('seekbackward', () => { if (audio !== null) audio.currentTime = Math.max(0, audio.currentTime - 10); });
    safe('seekforward', () => { if (audio !== null) audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); });
  }
  return audio;
}

/** Ein Stück spielen — dasselbe noch einmal: weiter (oder von vorn, wenn es zu Ende war). */
export function play(track: Track): void {
  const el = element();

  if (current?.key !== track.key) {
    if (current !== null) URL.revokeObjectURL(current.url);
    current = { key: track.key, title: track.title, subtitle: track.subtitle ?? null, url: URL.createObjectURL(track.blob) };
    el.src = current.url;

    if (typeof MediaMetadata !== 'undefined' && navigator.mediaSession !== undefined) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.subtitle ?? 'REcreatio', album: 'REcreatio' });
    }
  } else if (el.ended) {
    el.currentTime = 0;
  }

  void el.play().catch(() => publish());
  publish();
}

export function pause(): void {
  audio?.pause();
}

/** Spielt es gerade: anhalten; sonst weiter. */
export function toggle(): void {
  if (audio === null || current === null) return;
  if (audio.paused || audio.ended) void audio.play().catch(() => publish()); else audio.pause();
}

/** An eine Stelle springen (0 … 1). */
export function seek(fraction: number): void {
  if (audio === null || !Number.isFinite(audio.duration)) return;
  audio.currentTime = Math.max(0, Math.min(1, fraction)) * audio.duration;
}

/** Schliessen: der Ton hört auf, die Adresse geht zurück. */
export function stop(): void {
  if (audio !== null) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  if (current !== null) URL.revokeObjectURL(current.url);
  current = null;
  if (navigator.mediaSession !== undefined) navigator.mediaSession.metadata = null;
  publish();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** Was gerade spielt (oder angehalten ist) — `null`: nichts. */
export const useNowPlaying = (): NowPlaying | null => useSyncExternalStore(subscribe, () => snapshot, () => null);

/** „0:07", „12:34". */
export const clock = (seconds: number | null): string => {
  if (seconds === null || !Number.isFinite(seconds)) return '0:00';
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
