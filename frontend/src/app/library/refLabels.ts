/**
 * 2026-10-22 — WIE EIN VERWEIS HEISST UND WOHIN ER FÜHRT, für die Liste der
 * Powiązania (`LibraryRelations.tsx`), „Fragment Pisma" und die Rückverweise
 * in Cogita (`EntityEditor.tsx`): ein Eintrag der Bibliothek, ein Eintrag oder
 * ein Dokument einer Baza wiedzy (Powtórka, Przebieg, Widok …), und die Stelle
 * im Zeigenden („plan, punkt 2.1 · Dz 1,14"). Ohne Ansichten — leicht genug
 * für jede Seite, die es braucht.
 */

import { viewPath } from '../routes';
import { containerPath, openedLibraryKind } from './library';
import { entryTitle, kindOf, str, type LibEntry } from './libraryKinds';
import { plainText } from './libraryMarkup';
import type { Entry, LibraryStore } from './libraryStore';
import type { Hit } from './refIndex';
import { planOf, pointNumbers } from '../scriptorium/sermon';

/** Eine Bibliothek (`books`) — nicht eine Baza wiedzy. */
export const isBooksStore = (store: Pick<LibraryStore, 'libraryId'>): boolean => openedLibraryKind(store.libraryId) !== 'knowledge';

/** Ein Eintrag in einer Zeile: eine Person mit Jahren, ein Werk mit Autor und Jahr, sonst der Titel. */
export function entryLine(entry: LibEntry, store: LibraryStore): string {
  const title = store.title(entry);
  if (entry.kind === 'person') return [title, str(entry.data, 'years')].filter(Boolean).join(' · ');
  if (entry.kind === 'work') {
    const author = store.get((entry.data.authors as string[] | undefined)?.[0] ?? '');
    return [author === undefined ? '' : store.title(author), title, str(entry.data, 'year')].filter(Boolean).join(' · ');
  }
  return title;
}

/** Die Dokumente einer Baza wiedzy — mit Namen und Weg. */
export const DOC_LABEL: Readonly<Record<string, string>> = {
  template: 'Szablon karty', revision: 'Powtórka', flow: 'Przebieg', view: 'Widok', collection: 'Zbiór',
  addform: 'Formularz dodawania', kind: 'Rodzaj', rules: 'Zasady', values: 'Wartości', look: 'Wygląd', contribution: 'Propozycja'
};
const DOC_TAB: Readonly<Record<string, readonly string[]>> = {
  template: ['karty'], revision: ['powtorki'], flow: ['przebiegi'], view: ['wpisy', 'widok'], addform: ['schemat', 'formularz']
};

const clip = (text: string, length: number) => (text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text);

/** Der Name dessen, der zeigt — ein Eintrag der Bibliothek, ein Eintrag oder ein Dokument der Bazy wiedzy. */
export function hitTitle(entry: Entry, store: LibraryStore): string {
  if (isBooksStore(store)) return entry.kind === 'quote' ? `„${store.title(entry)}”` : entryLine(entry, store);
  const doc = DOC_LABEL[entry.kind];
  const name = str(entry.data, 'name') || str(entry.data, 'title') || str(entry.data, 'label');
  if (doc !== undefined) return name === '' ? doc : `${doc}: „${name}”`;
  if (kindOf(entry.kind) !== undefined) return entryTitle(entry, store);
  const said = name || str(entry.data, 'prompt') || [str(entry.data, 'givenNames'), str(entry.data, 'surname')].filter(Boolean).join(' ')
    || plainText(str(entry.data, 'text')).replace(/\s+/g, ' ');
  return said === '' ? 'Wpis' : clip(said, 90);
}

/** Wohin ein Klick führt: in die Bibliothek, ins Skryptorium (2026-10-23) oder in die Baza wiedzy (ihr Reiter). */
export function hitHref(entry: Entry, store: LibraryStore): string {
  if (isBooksStore(store)) return containerPath(entry.libraryId, entry.id);
  const tab = DOC_TAB[entry.kind];
  if (tab !== undefined) return viewPath('learn', entry.libraryId, ...tab, entry.id);
  if (DOC_LABEL[entry.kind] !== undefined) return viewPath('learn', entry.libraryId, entry.kind === 'kind' ? 'schemat' : 'wpisy');
  return viewPath('learn', entry.libraryId, 'wpisy', entry.id);
}

const WHERE: Readonly<Record<string, string>> = {
  body: 'w treści', further: 'w „Dalszych informacjach”', blocks: 'w treści komentarza', subjects: 'o nim', added: 'w tym, co doszło',
  transcript: 'w zapisie wygłoszenia', outline: 'w zarysie', text: 'w treści'
};

/** Wo im Zeigenden — „plan, punkt 2.1 · Dz 1,14". */
export function whereText(hit: Hit<LibraryStore>): string {
  const { field, at, locator } = hit.ref;
  let part = WHERE[field] ?? '';
  if (field === 'plan') {
    const number = at === undefined ? undefined : pointNumbers(planOf(hit.from.data)).get(at);
    part = number === undefined ? 'w planie' : `plan, punkt ${number}`;
  }
  return [part, locator].filter(Boolean).join(' · ');
}
