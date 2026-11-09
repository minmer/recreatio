/**
 * 2026-11-09 — KANN DER DIENST DURCHGÄNGE SPEICHERN? (PR A: `GET /workspace/learn/features`, Migration 0140). Die letzte
 * Antwort bleibt in diesem Browser (`learnFeatures` in `learn.ts` fragt einmal je Fenster und schreibt sie hierher).
 * Bis der Dienst ja sagt, gibt es für einen Lernenden mit Konto KEINE Stufen (`effectiveWorldFor` gibt 0): keine Bögen,
 * kein „Rozpocznij przebieg", jede Wiederholung wie bisher — sonst verliessen Karten die Wiederholungen, ohne dass jemand
 * sie je erobern könnte. Ohne Konto (lokal, im Browser) gibt es Durchgänge immer: sie bleiben beim Lernenden.
 * Ohne `window` (Prüfungen in node): keine Antwort — nein.
 */

export const FEATURES_KEY = 'cg-learn-features';

const listeners = new Set<() => void>();

/** Die letzte Antwort des Dienstes in diesem Browser (ohne Antwort: nein). */
export function serverRuns(): boolean {
  try { return localStorage.getItem(FEATURES_KEY) === 'run'; } catch { return false; }
}

/** Die Antwort merken — und wer zuhört (eine offene Karte, die Einstellungen), zeichnet neu. */
export function keepServerRuns(run: boolean): void {
  try { localStorage.setItem(FEATURES_KEY, run ? 'run' : ''); } catch { /* nur in diesem Fenster */ }
  for (const f of listeners) f();
}

export function onServerRuns(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

/** Werden Durchgänge dieses Halters gespeichert? Ohne Konto immer; mit Konto (oder ohne Lernenden) erst nach 0140. */
export const runsOn = (holder: { readonly kind: string } | null | undefined): boolean => holder?.kind === 'local' || serverRuns();
