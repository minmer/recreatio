/**
 * DIE BIBLIOTHEK AUF EINER SEITE (0064).
 *
 * <code>
 *   WritingCard    ein Text (eine Predigt) mit Plan, Wygłoszenia, Fussnoten, Dalsze informacje, Quellen
 *   QuotesCard     die Sammlung von Zitaten — im Streifen „Myśl dnia"
 * </code>
 *
 * Das Archiv (`WritingsCard`) steht seit 2026-10-21 in `LibraryBrowse.tsx`.
 *
 * 2026-10-22 — wer was sieht, sagt der Bereich: die Seite öffnet die
 * Bibliothek, so wie dieser Leser sie lesen darf (`libraryOpen.ts`), und
 * zeigt die Einträge selbst — keine veröffentlichten Fassungen mehr. Ein
 * Eintrag, der in eine andere Bibliothek gezogen ist, wird dort gefunden.
 *
 * Jede Grösse sagt etwas anderes (`part.ts`): im Streifen ein Satz, als Block
 * eine Übersicht, hoch und im Vollbild das Ganze.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { entryTitle, ids, str, type LibEntry, type Lookup } from './libraryKinds';
import { excerpt } from './libraryMarkup';
import { dateWords, OpenedEntry, QuoteFigure, TextArticle } from './LibraryText';
import { latexFileName, planToLatex, textToLatex } from './libraryLatex';
import { findOnPage, usePageLibrary } from './libraryOpen';
import { MarkupLinks, type MarkupLinkTo } from './markupView';
import { deliveriesOf, planOf, pointLine } from './sermon';
import { saveBlob } from '../core/platform';
import type { PartSize } from '../pages/part';
import { Loading } from '../ui/Loading';

/* -- Ein Text --------------------------------------------------------------------------------- */

/** `delivery`: kam man über ein Wygłoszenie, ist es auf dem Plan gewählt. */
type Loaded = { readonly entry: LibEntry; readonly look: Lookup; readonly delivery: string | null } | 'missing' | null;

function usePageEntry(library: string, entryId: string): Loaded {
  const [loaded, setLoaded] = useState<Loaded>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (library === '' || entryId === '') { setLoaded('missing'); return undefined; }
    let alive = true;
    let off: (() => void) | null = null;
    void findOnPage(library, entryId).then((found) => {
      if (!alive) return;
      if (found === null) { setLoaded('missing'); return; }
      off = found.store.subscribe(() => setTick((n) => n + 1));
      const main = found.entry;
      /* 2026-10-21 — ein Wygłoszenie öffnet seinen Text, mit ihm auf dem Plan. */
      const text = main.kind === 'delivery' ? ids(main.data, 'texts').map((id) => found.store.get(id)).find((e) => e?.kind === 'text') : main;
      setLoaded(text === undefined ? 'missing' : { entry: text, look: found.store, delivery: main.kind === 'delivery' ? main.id : null });
    });
    return () => { alive = false; off?.(); };
  }, [library, entryId, tick]);
  return loaded;
}

export function WritingCard({ library, entryId, size, whole = false, prefix, delivery, onDelivery }: {
  library: string;
  entryId: string;
  size: PartSize;
  whole?: boolean;
  prefix: string;
  /** 2026-10-21 — das gewählte Wygłoszenie (aus der Adresse des Archivs) und wohin eine andere Wahl geht. */
  delivery?: string | null;
  onDelivery?: (id: string | null) => void;
}) {
  const loaded = usePageEntry(library, entryId);
  const [open, setOpen] = useState(false);
  /* 2026-10-22 — ein eigener Eintrag, auf den der Text verweist (ein Link, keine Fussnote), öffnet sich unter dem Text. */
  const [opened, setOpened] = useState<LibEntry | null>(null);
  const openedAt = useRef<HTMLDivElement | null>(null);
  const links = useMemo<MarkupLinkTo>(() => ({ open: (e) => setOpened(e) }), []);
  useEffect(() => { if (opened !== null) openedAt.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [opened]);

  if (loaded === null) return <Loading label="Wczytywanie tekstu…" />;
  if (loaded === 'missing') return <p className="wk-card-text">Tego tekstu nie ma albo nie możesz go zobaczyć.</p>;

  const full = whole || open || size.height === 'tall';
  if (full) {
    const hasPlan = planOf(loaded.entry.data).length > 0;
    return (
      <MarkupLinks.Provider value={links}>
        <TextArticle entry={loaded.entry} look={loaded.look} prefix={prefix} delivery={delivery ?? loaded.delivery} onDelivery={onDelivery} />
        {opened !== null && (
          <div ref={openedAt}>
            <OpenedEntry entry={opened} look={loaded.look} prefix={`${prefix}o${opened.id.slice(0, 8)}-`} onClose={() => setOpened(null)} />
          </div>
        )}
        {/* Druck: derselbe Text mit Fussnoten und Quellen als LaTeX — aus dem, was dieser Leser sieht. */}
        <p className="lib-print">
          <button type="button" className="wk-link-btn" onClick={() => void saveBlob(
            new Blob([textToLatex(loaded.entry, loaded.look)], { type: 'application/x-tex' }), latexFileName(loaded.entry))}>
            Pobierz do druku (LaTeX)
          </button>
          {hasPlan && (
            <button type="button" className="wk-link-btn" onClick={() => void saveBlob(
              new Blob([planToLatex(loaded.entry, loaded.look)], { type: 'application/x-tex' }), latexFileName(loaded.entry, '-plan'))}>
              Sam plan (LaTeX)
            </button>
          )}
        </p>
      </MarkupLinks.Provider>
    );
  }

  const d = loaded.entry.data;
  /* 2026-10-21 — als Block auch die Hauptgedanken des Plans und wann der Text gehalten wurde. */
  const thoughts = planOf(d).filter((p) => p.depth === 0).map((p) => pointLine(p.text, undefined, 140)).filter((s) => s !== '').slice(0, size.width === 'narrow' ? 3 : 5);
  const held = deliveriesOf(loaded.entry, loaded.look);
  const lead = str(d, 'summary').trim() || (thoughts.length > 0 ? '' : excerpt(str(d, 'body'), size.width === 'narrow' ? 160 : 420));
  const when = str(held[0]?.data ?? {}, 'date') || str(d, 'date');
  return (
    <div className="lib-teaser">
      <h2 className="wk-card-title">{str(d, 'title')}</h2>
      <p className="lib-meta">{[when === '' ? '' : dateWords(when), str(held[0]?.data ?? {}, 'occasion') || str(d, 'occasion'), held.length > 1 ? `wygłoszony ${held.length}×` : ''].filter(Boolean).join(' · ')}</p>
      {lead !== '' && <p className="wk-card-text">{lead}</p>}
      {thoughts.length > 0 && <ol className="lib-teaser-plan">{thoughts.map((t, i) => <li key={i}>{t}</li>)}</ol>}
      <button type="button" className="wk-link-btn wk-card-more" onClick={() => setOpen(true)}>{held.length > 0 ? 'Plan, nagrania i całość' : 'Czytaj całość'}</button>
    </div>
  );
}

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
