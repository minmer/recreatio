/**
 * „STARE WPISY" (2026-10-23) — wpisy rodzajów, których ta wersja już nie zna
 * (w Bibliotece po podziale: teksty, wygłoszenia, projekty, komentarze,
 * tematy; w Nauce: wiedza i tematy). Nic się przez nie nie psuje: stoją tu z
 * nazwą i rodzajem, do przejrzenia i usunięcia. Same nie znikają.
 */

import { useMemo } from 'react';

import { PickBar, PickBox, usePicked } from './EntryPick';
import { str, type LibEntry } from './libraryKinds';
import type { Entry, LibraryStore } from './libraryStore';

/** Jak nazywały się rodzaje, których już nie ma. */
const OLD_KINDS: Readonly<Record<string, string>> = {
  text: 'Tekst', delivery: 'Wygłoszenie', project: 'Projekt', comment: 'Komentarz', topic: 'Temat', knowledge: 'Wiedza', textType: 'Rodzaj tekstu'
};

export const oldKindLabel = (kind: string): string => OLD_KINDS[kind] ?? kind;

/** Nazwa starego wpisu — z tego, co ma w danych. */
export function oldTitle(entry: LibEntry): string {
  const clip = (value: string) => (value.length > 90 ? `${value.slice(0, 89)}…` : value);
  for (const key of ['title', 'name', 'nazwa', 'text', 'tekst', 'occasion', 'date']) {
    const value = str(entry.data, key).replace(/\s+/g, ' ').trim();
    if (value !== '') return clip(value);
  }
  /* Ein alter Komentarz: der erste Absatz seiner Bausteine. */
  const blocks = Array.isArray(entry.data.blocks) ? entry.data.blocks : [];
  for (const block of blocks) {
    const text = typeof block === 'object' && block !== null && typeof (block as { text?: unknown }).text === 'string' ? (block as { text: string }).text : '';
    const plain = text.replace(/\[@[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
    if (plain !== '') return clip(plain);
  }
  return '(bez nazwy)';
}

/** Wpisy tej biblioteki, których rodzaju ta wersja nie zna. */
export const oldEntriesOf = (store: LibraryStore, known: (kind: string) => boolean): Entry[] =>
  store.all().filter((e) => !known(e.kind));

export function OldEntries({ store, known, writes, where }: {
  store: LibraryStore;
  known: (kind: string) => boolean;
  writes: boolean;
  /** Gdzie te treści są teraz (zdanie pod nagłówkiem). */
  where: string;
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
                <span className="lib-row-title">{oldTitle(entry)} <span className="lib-badge is-implicit">{oldKindLabel(entry.kind)}</span></span>
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
