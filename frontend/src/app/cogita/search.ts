/**
 * 0109 — SZUKAJ IN DEN BIBLIOTHEKEN [F5, P12]: was dieser Tab schon geöffnet
 * hat. Die Speicher bleiben im Tab (`loadedStores`), die Namen der
 * Bibliotheken merkt sich `openLibraries` — kein Abruf, nichts geht an den
 * Dienst, versiegelt bleibt, was nicht offen ist.
 *
 * Eingebaute Arten öffnen im Editor der Bibliothek, eigene Entitäten und die
 * Dokumente (Powtórki, Przebiegi, Szablony, Zbiory) in Cogita.
 */

import { openedLibraryNames } from '../library';
import { kindOf } from '../libraryKinds';
import { loadedStores } from '../libraryStore';
import { viewPath } from '../routes';
import type { SearchEntry } from '../search';
import { DOC_LABEL, type DocKind } from './kinds';
import { CogitaLibrary } from './store';

/** Mehr braucht die Suche nicht — das Fenster zeigt höchstens 40. */
const MAX_PER_LIBRARY = 3000;

/** Wohin ein Dokument führt (der Reiter in Cogita). */
const DOC_TAB: Partial<Record<DocKind, readonly string[]>> = {
  revision: ['powtorki'],
  flow: ['przebiegi'],
  template: ['karty'],
  kind: ['schemat'],
  view: ['wpisy', 'widok']
};

export function libraryHits(): SearchEntry[] {
  const names = openedLibraryNames();
  const out: SearchEntry[] = [...names].map(([libraryId, name]) => ({
    id: `library:${libraryId}`, label: name, kind: 'Biblioteka', href: viewPath('library', libraryId)
  }));
  for (const store of loadedStores()) {
    const where = names.get(store.libraryId) ?? 'Biblioteka';
    const lib = new CogitaLibrary(store, false);
    let count = 0;
    for (const entity of lib.entities()) {
      if (count++ >= MAX_PER_LIBRARY) break;
      const builtIn = kindOf(entity.kinds[0] ?? '');
      out.push({
        id: `entry:${entity.id}`,
        label: lib.label(entity),
        kind: builtIn?.label ?? lib.kind(entity.kinds[0] ?? '')?.name ?? 'Wpis',
        href: builtIn !== undefined ? viewPath('library', store.libraryId, entity.id) : viewPath('library', store.libraryId, 'cogita', 'wpisy', entity.id),
        hint: where
      });
    }
    for (const [kind, tab] of Object.entries(DOC_TAB) as [DocKind, readonly string[]][]) {
      for (const doc of lib.docs(kind)) {
        if (doc.data.builtin !== undefined) continue;
        const name = typeof doc.data.name === 'string' && doc.data.name.trim() !== '' ? doc.data.name : DOC_LABEL[kind];
        out.push({ id: `doc:${doc.id}`, label: name, kind: DOC_LABEL[kind], href: viewPath('library', store.libraryId, 'cogita', ...tab, doc.id), hint: where });
      }
    }
  }
  return out;
}
