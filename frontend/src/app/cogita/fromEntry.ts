/**
 * EINE POWTÓRKA AUS EINEM KAZANIE (2026-10-22, Schritt 11) — aus der
 * Skryptorium heraus: die Karten dessen, worauf der Text verweist (seine Cytaty,
 * Aussagen, die Słowa eines Słownik, die Stellen seines Plans), über den
 * Schritt „Z wpisu" (`source.from`), den Widoki und Powtórki teilen.
 *
 * Die Powtórka lebt in einer Baza wiedzy, die diese Bibliothek als Quelle
 * nennt — gibt es keine, wird eine Baza desselben Bereichs, in der ich
 * schreibe, zu einer (die Bibliothek kommt in ihre Quellen). Wer die Baza
 * liest, sieht die Powtórka; die Karten zeigen nur, was er in der Bibliothek
 * lesen darf.
 */

import { libraryKindOf, loadLibraries, openLibraries, type OpenLibrary } from '../library/library';
import { storeOf, type LibraryStore } from '../library/libraryStore';
import type { Ring } from '../core/keys';
import { graphJson } from './graph';
import { CogitaLibrary } from './store';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const sourcesOf = (store: LibraryStore): Record<string, unknown>[] => {
  const settings = store.all().find((e) => e.kind === 'settings');
  return Array.isArray(settings?.data.sources) ? settings!.data.sources.filter(isObject) : [];
};

/** Der Graph: „Z wpisu" → „Sposób pytania" (nach dem, was ich umiem). */
export function fromEntryGraph(entryId: string): Record<string, unknown> {
  return graphJson({
    nodes: [
      { id: 'src', type: 'source.from', x: 40, y: 40, config: { entry: entryId } },
      { id: 'plan', type: 'strategy', x: 320, y: 40, config: { mode: 'temporal', stackSize: 20 } }
    ],
    edges: [{ id: 'e1', from: 'src', out: 'cards', to: 'plan', in: 'cards' }]
  });
}

/** Welche Baza die Powtórka trägt: eine, die die Bibliothek nennt — sonst eine des Bereichs (sie nennt sie dann). */
export function baseFor(rows: readonly OpenLibrary[], libraryId: string, stores: (row: OpenLibrary) => LibraryStore): { base: OpenLibrary; link: boolean } | null {
  const library = rows.find((r) => r.libraryId === libraryId);
  const bases = rows.filter((r) => libraryKindOf(r) === 'knowledge' && r.writes);
  const linked = bases.find((b) => sourcesOf(stores(b)).some((s) => s.id === libraryId));
  if (linked !== undefined) return { base: linked, link: false };
  const near = bases.find((b) => b.areaId === library?.areaId);
  return near === undefined ? null : { base: near, link: true };
}

export async function revisionFromEntry(ring: Ring, libraryId: string, entryId: string, title: string): Promise<{ baseId: string; revisionId: string; linked: boolean }> {
  const rows = await openLibraries(ring, (await loadLibraries()).libraries);
  const bases = rows.filter((r) => libraryKindOf(r) === 'knowledge' && r.writes);
  await Promise.all(bases.map((b) => storeOf(ring, b).sync().catch(() => undefined)));
  const chosen = baseFor(rows, libraryId, (row) => storeOf(ring, row));
  const source = rows.find((r) => r.libraryId === libraryId);
  const writing = source !== undefined && libraryKindOf(source) === 'writing';
  if (chosen === null) throw new Error(writing ? 'Nie ma bazy wiedzy, która korzysta z tego skryptorium, ani takiej w jego obszarze — załóż ją w Nauce.' : 'Nie ma bazy wiedzy, która korzysta z tej biblioteki, ani takiej w jej obszarze — załóż ją w Nauce.');
  const store = storeOf(ring, chosen.base);
  if (chosen.link) {
    const settings = store.all().find((e) => e.kind === 'settings');
    const name = source?.name ?? (writing ? 'Skryptorium' : 'Biblioteka');
    /* 2026-10-23 — ein Skryptorium ist eine Quelle eigener Art (`writing`). */
    await store.save({ ...(settings === undefined ? {} : { id: settings.id }), kind: 'settings', data: { ...(settings?.data ?? {}), sources: [...sourcesOf(store), { id: libraryId, kind: writing ? 'writing' : 'books', name }] } });
  }
  const lib = new CogitaLibrary(store, true);
  const saved = await lib.saveDoc('revision', { name: `Z kazania: ${title}`.slice(0, 120), graph: fromEntryGraph(entryId) });
  return { baseId: chosen.base.libraryId, revisionId: saved.id, linked: chosen.link };
}
