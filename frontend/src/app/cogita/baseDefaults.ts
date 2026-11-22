/**
 * 2026-11-22 (guide-good-world §1.3, I7) — WOMIT EINE NEUE BAZA WIEDZY BEGINNT: mit den empfohlenen Stufen der Eroberung
 * (`RECOMMENDED_LEVELS`: 75 % bei beliebig vielen Versuchen, 90 % mit einer Korrektur, Pfade ab Stufe 1). Eine Empfehlung, keine
 * Regel: der Autor ändert sie in den Ustawienia oder mit einem Import ("settings.levelsSetup"); bestehende Bazy bleiben, wie sie sind.
 *
 * `createLibrary` (Art `knowledge`) ruft `seedNewBase` gleich nach dem Anlegen — so bekommt jede neue Baza sie, gleich wo sie entsteht
 * (Nauka → „Nowa baza", der Kurs, eine Klasse …). Schlägt es fehl, bleibt die Baza ohne (0 Stufen, wie bisher).
 */

import type { Ring } from '../core/keys';
import { storeOf } from '../library/libraryStore';
import { CogitaLibrary } from './store';
import { RECOMMENDED_LEVELS } from './worldmap/wmRuns';

/** Die Ustawienia einer neuen Baza (frische Kopie). */
export const newBaseSettings = (): Record<string, unknown> => ({
  levelsSetup: { ...RECOMMENDED_LEVELS, rules: RECOMMENDED_LEVELS.rules.map((r) => ({ ...r })) }
});

/** Die neue Baza mit ihren Ustawienia — nur, wenn sie noch keine Stufen hat (nie über etwas, das schon da ist). */
export async function seedNewBase(ring: Ring, base: { readonly libraryId: string; readonly areaId: string }): Promise<void> {
  const store = storeOf(ring, base);
  await store.sync();
  const lib = new CogitaLibrary(store, true);
  if (lib.settings().levelsSetup !== undefined) return;
  await lib.saveSettings(newBaseSettings());
}
