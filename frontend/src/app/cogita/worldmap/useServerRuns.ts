/**
 * 2026-11-09 (PR A) — FÜR REACT: speichert der Dienst Durchgänge? Fragt einmal je Fenster (`learnFeatures`) und zeichnet neu,
 * wenn die Antwort kommt (`wmFeatures.ts`). Ohne Antwort: die letzte aus diesem Browser, sonst nein.
 */

import { useEffect, useSyncExternalStore } from 'react';

import { learnFeatures } from '../learn';
import { onServerRuns, serverRuns } from './wmFeatures';

export function useServerRuns(): boolean {
  useEffect(() => { void learnFeatures().catch(() => undefined); }, []);
  return useSyncExternalStore(onServerRuns, serverRuns, () => false);
}
