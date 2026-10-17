/**
 * 0109 — SZUKAJ IN DEN BIBLIOTHEKEN UND BAZY WIEDZY [F5, P12]: was dieser Tab
 * schon geöffnet hat. Die Speicher bleiben im Tab (`loadedStores`), die Namen
 * und Arten merkt sich `openLibraries` — kein Abruf, nichts geht an den
 * Dienst, versiegelt bleibt, was nicht offen ist.
 *
 * 0110 — eine Bibliothek führt in ihren Editor (Werke, Zitate, Texte), eine
 * Baza wiedzy in Nauka: ihre Einträge und ihre Dokumente (Powtórki,
 * Przebiegi, Szablony, Rodzaje, Widoki).
 */

import { openedLibraryKind, openedLibraryNames } from '../library';
import { kindOf } from '../libraryKinds';
import { loadedStores } from '../libraryStore';
import { viewPath } from '../routes';
import type { SearchEntry } from '../search';
import { DOC_LABEL, type DocKind } from './kinds';
import { CogitaLibrary } from './store';

/** Mehr braucht die Suche nicht — das Fenster zeigt höchstens 40. */
const MAX_PER_LIBRARY = 3000;

/** Wohin ein Dokument führt (der Reiter der Baza wiedzy). */
const DOC_TAB: Partial<Record<DocKind, readonly string[]>> = {
  revision: ['powtorki'],
  flow: ['przebiegi'],
  template: ['karty'],
  kind: ['schemat'],
  view: ['wpisy', 'widok']
};

export function libraryHits(): SearchEntry[] {
  const names = openedLibraryNames();
  const isBase = (libraryId: string) => openedLibraryKind(libraryId) === 'knowledge';
  const out: SearchEntry[] = [...names].map(([libraryId, name]) => ({
    id: `library:${libraryId}`, label: name,
    kind: isBase(libraryId) ? 'Baza wiedzy' : 'Biblioteka',
    href: isBase(libraryId) ? viewPath('learn', libraryId) : viewPath('library', libraryId)
  }));
  for (const store of loadedStores()) {
    const base = isBase(store.libraryId);
    const where = names.get(store.libraryId) ?? (base ? 'Baza wiedzy' : 'Biblioteka');
    const lib = new CogitaLibrary(store, false);
    let count = 0;
    for (const entity of lib.entities()) {
      if (count++ >= MAX_PER_LIBRARY) break;
      const builtIn = kindOf(entity.kinds[0] ?? '');
      out.push({
        id: `entry:${entity.id}`,
        label: lib.label(entity),
        kind: lib.kind(entity.kinds[0] ?? '')?.name ?? builtIn?.label ?? 'Wpis',
        href: base ? viewPath('learn', store.libraryId, 'wpisy', entity.id) : viewPath('library', store.libraryId, entity.id),
        hint: where
      });
    }
    if (!base) continue;
    for (const [kind, tab] of Object.entries(DOC_TAB) as [DocKind, readonly string[]][]) {
      for (const doc of lib.docs(kind)) {
        if (doc.data.builtin !== undefined || !lib.isOwn(doc.id)) continue;
        const name = typeof doc.data.name === 'string' && doc.data.name.trim() !== '' ? doc.data.name : DOC_LABEL[kind];
        out.push({ id: `doc:${doc.id}`, label: name, kind: DOC_LABEL[kind], href: viewPath('learn', store.libraryId, ...tab, doc.id), hint: where });
      }
    }
  }
  return out;
}
