/**
 * DIE BIBLIOTHEK AUF EINER SEITE (0064): `QuotesCard`, die Sammlung von
 * Zitaten — im Streifen „Myśl dnia".
 *
 * Ein Text (`WritingCard`) und das Archiv (`WritingsCard`) stehen seit
 * 2026-10-23 im Skryptorium (`scriptorium/WritingCard.tsx`, `ArchiveCard.tsx`).
 *
 * 2026-10-22 — wer was sieht, sagt der Bereich: die Seite öffnet die
 * Bibliothek, so wie dieser Leser sie lesen darf (`libraryOpen.ts`), und
 * zeigt die Einträge selbst — keine veröffentlichten Fassungen mehr. Ein
 * Eintrag, der in eine andere Bibliothek gezogen ist, wird dort gefunden.
 *
 * Jede Grösse sagt etwas anderes (`part.ts`): im Streifen ein Satz, als Block
 * eine Übersicht, hoch und im Vollbild das Ganze.
 */

import { useEffect, useMemo, useState } from 'react';

import { entryTitle, ids } from './libraryKinds';
import { QuoteFigure } from './LibraryText';
import { usePageLibrary } from './libraryOpen';
import type { PartSize } from '../pages/part';
import { Loading } from '../ui/Loading';

/* -- Die Zitate ---------------------------------------------------------------------------------- */

const dayNumber = (): number => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000);

export function QuotesCard({ library, title, work, size, whole = false }: {
  library: string;
  title: string;
  /** 2026-10-23 — nur Zitate dieses Werks (statt eines Themas). */
  work: string;
  size: PartSize;
  whole?: boolean;
}) {
  const big = whole || size.height === 'tall';
  const daily = !big;
  const take = size.height === 'strip' ? 1 : daily ? (size.width === 'narrow' || size.width === 'medium' ? 1 : 2) : 20;
  const { store, revision, state } = usePageLibrary(library === '' ? null : library);
  const [query, setQuery] = useState('');
  const [chosenWork, setChosenWork] = useState(work);
  const [shown, setShown] = useState(take);

  useEffect(() => { setChosenWork(work); }, [work]);
  useEffect(() => { setShown(take); }, [take, chosenWork, query]);

  /* Die Zitate dieser Bibliothek, in fester Ordnung — „Myśl dnia" ist so für alle dieselbe. */
  const all = useMemo(() => (store === null ? [] : [...store.ofKind('quote')].sort((a, b) => a.id.localeCompare(b.id))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, revision]);
  /* Die Werke, aus denen Zitate stammen — zum Wählen in der grossen Ansicht. */
  const works = useMemo(() => {
    if (store === null) return [];
    const found = new Map<string, string>();
    for (const q of all) for (const id of ids(q.data, 'work')) { const w = store.get(id); if (w !== undefined) found.set(id, entryTitle(w, store)); }
    return [...found].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  }, [store, all]);
  const matching = useMemo(() => {
    let list = chosenWork === '' ? all : all.filter((q) => ids(q.data, 'work').includes(chosenWork));
    if (query.trim() !== '' && store !== null) { const hit = new Set(store.ownSearch(query, ['quote']).map((e) => e.id)); list = list.filter((q) => hit.has(q.id)); }
    return list;
  }, [all, chosenWork, query, store]);

  if (state === 'loading') return <Loading label="Wczytywanie…" />;
  if (store === null) return <p className="wk-card-text">Tej biblioteki nie widzisz — jej obszar nie jest publiczny.</p>;

  const items = daily
    ? Array.from({ length: Math.min(take, matching.length) }, (_, i) => matching[(dayNumber() + i) % matching.length])
    : matching.slice(0, shown);

  return (
    <div className={`lib-quotes${daily ? ' is-daily' : ''}`}>
      {title !== '' && <h2 className="wk-card-title">{title}</h2>}
      {big && (
        <div className="lib-quotes-tools">
          <input type="search" value={query} placeholder="Szukaj w cytatach…" aria-label="Szukaj w cytatach" onChange={(e) => setQuery(e.target.value)} />
          {works.length > 1 && work === '' && (
            <div className="lib-topics" role="group" aria-label="Źródła">
              <button type="button" className={chosenWork === '' ? 'lib-chip is-on' : 'lib-chip'} onClick={() => setChosenWork('')}>wszystkie</button>
              {works.map((w) => <button key={w.id} type="button" className={chosenWork === w.id ? 'lib-chip is-on' : 'lib-chip'} onClick={() => setChosenWork(w.id)}>{w.name}</button>)}
            </div>
          )}
        </div>
      )}
      {items.length === 0 && <p className="wk-card-text">{query === '' ? 'Nie ma jeszcze cytatów.' : 'Nic nie znaleziono.'}</p>}
      {items.length > 0 && (
        <ul className="lib-quote-list">{items.map((q) => <li key={q.id}><QuoteFigure entry={q} look={store} full={big || size.height !== 'strip'} /></li>)}</ul>
      )}
      {big && items.length < matching.length && <button type="button" className="wk-link-btn" onClick={() => setShown((n) => n + take)}>Więcej ({matching.length - items.length})</button>}
    </div>
  );
}
