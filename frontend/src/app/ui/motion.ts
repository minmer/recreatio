/**
 * 2026-11-05 (Prompt 17) — WIE VIEL BEWEGUNG: „pełne" (alles), „ograniczone" (nur Überblendungen, nichts bewegt sich),
 * „wyłączone" (Zustände wechseln sofort). Gewählt auf diesem Gerät (Powiadomienia → Na tym urządzeniu → Animacje); ohne
 * Wahl folgt es dem Betriebssystem („weniger Bewegung" → ograniczone). Steht als `data-motion` an <html>, damit auch reines
 * CSS sich danach richtet (`:root[data-motion='off'] …`).
 */

import { useSyncExternalStore } from 'react';

export type MotionLevel = 'full' | 'reduced' | 'off';
export type MotionChoice = MotionLevel | 'auto';

const KEY = 'rc-motion';
const listeners = new Set<() => void>();

const osReduced = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Was gewählt ist (`auto`: das Betriebssystem entscheidet). */
export function motionChoice(): MotionChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'full' || v === 'reduced' || v === 'off') return v;
  } catch { /* ohne Speicher */ }
  return 'auto';
}

/** Was gilt: die Wahl, sonst das Betriebssystem. */
export function motionLevel(): MotionLevel {
  const c = motionChoice();
  if (c !== 'auto') return c;
  return osReduced() ? 'reduced' : 'full';
}

/** Die Wahl ändern (`auto`: zurück zum Betriebssystem). */
export function setMotionChoice(c: MotionChoice): void {
  try { if (c === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, c); } catch { /* ohne Speicher */ }
  applyMotion();
  for (const f of listeners) f();
}

/** `data-motion` an <html> setzen (beim Laden und bei jeder Änderung). */
export function applyMotion(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.motion = motionLevel();
}

function subscribe(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

/** Für React: was gilt, neu bei jeder Änderung (auch der des Betriebssystems). */
export function useMotion(): MotionLevel {
  return useSyncExternalStore(subscribe, motionLevel, () => 'full' as MotionLevel);
}

export function useMotionChoice(): MotionChoice {
  return useSyncExternalStore(subscribe, motionChoice, () => 'auto' as MotionChoice);
}

/* Einmal beim Laden: das Attribut setzen und dem Betriebssystem zuhören. */
if (typeof window !== 'undefined') {
  applyMotion();
  try {
    window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => { applyMotion(); for (const f of listeners) f(); });
  } catch { /* ältere Browser */ }
}
