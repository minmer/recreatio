/**
 * „PRZEBIEG W NAUCE" (2026-10-22, Schritt 12; COGITA.md §8 „One narrative") —
 * aus dem Editor einer Präsentation heraus: der Ablauf in der Baza wiedzy des
 * Przebiegs, der auf diese Präsentation zeigt. Gibt es ihn schon, wird er
 * gefunden; sonst angelegt: `{ name, look: "scenes", presentation: <pfad> }`,
 * ohne eigenen Graphen (der kommt aus der Seite).
 *
 * Nur wer in der Baza schreibt, legt ihn an. Wer die Baza liest, sieht ihn in
 * Przebiegi; spielen kann er ihn, wenn er die Seite sehen darf.
 */

import { libraryKindOf, loadLibraries, openLibraries } from '../library/library';
import { storeOf } from '../library/libraryStore';
import type { Ring } from '../core/keys';
import { CogitaLibrary } from './store';

const clean = (path: string): string => path.trim().replace(/^#?\/?/, '');

export async function flowForPresentation(ring: Ring, baseId: string, path: string, name: string): Promise<{ readonly flowId: string; readonly made: boolean }> {
  const rows = await openLibraries(ring, (await loadLibraries()).libraries);
  const base = rows.find((r) => r.libraryId === baseId && libraryKindOf(r) === 'knowledge');
  if (base === undefined) throw new Error('Nie masz dostępu do tej bazy wiedzy.');
  const store = storeOf(ring, base);
  await store.sync();
  const lib = new CogitaLibrary(store, base.writes);
  const found = lib.docs('flow').find((e) => typeof e.data.presentation === 'string' && clean(e.data.presentation) === clean(path));
  if (found !== undefined) return { flowId: found.id, made: false };
  if (!base.writes) throw new Error('W tej bazie wiedzy nie piszesz — przebieg może założyć ktoś, kto w niej pisze.');
  const saved = await lib.saveDoc('flow', { name: name.trim().slice(0, 120) || 'Prezentacja', look: 'scenes', presentation: clean(path), graph: { nodes: [], edges: [] } });
  return { flowId: saved.id, made: true };
}
