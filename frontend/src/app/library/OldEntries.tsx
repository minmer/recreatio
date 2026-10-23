/**
 * „STARE WPISY" (2026-10-23) — wpisy rodzajów, których ta wersja już nie zna
 * (w Bibliotece po podziale: teksty, wygłoszenia, projekty, komentarze,
 * tematy; w Nauce: wiedza i tematy). Nic się przez nie nie psuje: stoją tu z
 * nazwą i rodzajem, do przejrzenia i usunięcia. Same nie znikają.
 */

import { useMemo } from 'react';

import { PickBar, PickBox, usePicked } from './EntryPick';
import type { Entry, LibraryStore } from './libraryStore';
import { oldKindLabel, oldTitle } from './oldKinds';

export { oldKindLabel, oldTitle } from './oldKinds';

/**
 * Wpisy tej biblioteki, których rodzaju ta wersja nie zna. `known` dostaje
 * rodzaj wpisu i sam wpis (w Nauce rozstrzygają jego rodzaje w `_kinds`).
 */
export const oldEntriesOf = (store: LibraryStore, known: (kind: string, entry: Entry) => boolean): Entry[] =>
  store.all().filter((e) => !known(e.kind, e));

export function OldEntries({ store, known, writes, where, labelOf }: {
  store: LibraryStore;
  known: (kind: string, entry: Entry) => boolean;
  writes: boolean;
  /** Gdzie te treści są teraz (zdanie pod nagłówkiem). */
  where: string;
  /** Jak nazwać rodzaj starego wpisu (domyślnie: po jego rodzaju w bibliotece). */
  labelOf?: (entry: Entry) => string;
}) {
  const { picked, toggle, set } = usePicked();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const old = useMemo(() => oldEntriesOf(store, known).sort((a, b) => a.kind.localeCompare(b.kind) || oldTitle(a).localeCompare(oldTitle(b), 'pl')), [store, store.revision]);

  return (
    <section className="wk-form" data-old-entries="">
      <h2 className="wk-h2">Stare wpisy ({old.length})</h2>
      <p>Wpisy rodzajów, których ta wersja już nie obsługuje. {where} Można je przejrzeć i usunąć — same nie znikną.</p>
      {old.length === 0 ? <p className="wk-empty">Nie ma starych wpisów.</p> : (
        <ul className="lib-list">
          {old.map((entry) => (
            <li key={entry.id} className="has-pick">
              {writes && <PickBox checked={picked.has(entry.id)} label={oldTitle(entry)} onToggle={() => toggle(entry.id)} />}
              <span className="lib-row">
                <span className="lib-row-title">{oldTitle(entry)} <span className="lib-badge is-implicit">{labelOf === undefined ? oldKindLabel(entry.kind) : labelOf(entry)}</span></span>
                <span className="lib-row-meta">zmieniony {entry.updatedAt.slice(0, 10)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <PickBar store={store} picked={picked} all={old.map((e) => e.id)} onPicked={set} writes={writes} />
    </section>
  );
}
