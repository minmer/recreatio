/**
 * DIE BIBLIOTHEK AUF EINER ÖFFENTLICHEN SEITE (0064) — ohne Konto, nur aus
 * dem, was veröffentlicht ist.
 *
 * <code>
 *   WritingCard    ein Text (eine Predigt) mit Fussnoten, Dalsze informacje, Quellen
 *   WritingsCard   das Archiv: Texte einer Bibliothek, eines Projekts, eines Themas
 *   QuotesCard     die Sammlung von Zitaten — im Streifen „Myśl dnia"
 * </code>
 *
 * Jede Grösse sagt etwas anderes (`part.ts`): im Streifen ein Satz, als Block
 * eine Übersicht, hoch und im Vollbild das Ganze.
 */

import { useCallback, useEffect, useState } from 'react';

import { loadPublished, loadPublishedOne, summaryOf, type PublishedItem } from './library';
import { str, type LibEntry, type Lookup } from './libraryKinds';
import { excerpt } from './libraryMarkup';
import { dateWords, publicLookup, QuoteFigure, readPublic, TextArticle } from './LibraryText';
import { latexFileName, textToLatex } from './libraryLatex';
import { saveBlob } from './platform';
import type { PartSize } from './part';

/* -- Ein Text --------------------------------------------------------------------------------- */

type Loaded = { readonly entry: LibEntry; readonly look: Lookup } | 'missing' | null;

function usePublishedOne(library: string, entryId: string): Loaded {
  const [loaded, setLoaded] = useState<Loaded>(null);
  useEffect(() => {
    if (library === '' || entryId === '') { setLoaded('missing'); return undefined; }
    let alive = true;
    setLoaded(null);
    void loadPublishedOne(library, entryId).then((r) => {
      const all = [r.entry, ...r.refs].map((one) => readPublic(one.json)).filter((e): e is LibEntry => e !== null);
      const main = all.find((e) => e.id === entryId);
      if (alive) setLoaded(main === undefined ? 'missing' : { entry: main, look: publicLookup(all) });
    }, () => { if (alive) setLoaded('missing'); });
    return () => { alive = false; };
  }, [library, entryId]);
  return loaded;
}

export function WritingCard({ library, entryId, size, whole = false, prefix }: {
  library: string;
  entryId: string;
  size: PartSize;
  whole?: boolean;
  prefix: string;
}) {
  const loaded = usePublishedOne(library, entryId);
  const [open, setOpen] = useState(false);

  if (loaded === null) return <p className="wk-card-text lib-loading">Wczytywanie tekstu…</p>;
  if (loaded === 'missing') return <p className="wk-card-text">Tego tekstu nie ma albo nie jest już opublikowany.</p>;

  const full = whole || open || size.height === 'tall';
  if (full) {
    return (
      <>
        <TextArticle entry={loaded.entry} look={loaded.look} prefix={prefix} />
        {/* Druck: derselbe Text mit Fussnoten und Quellen als LaTeX — aus dem, was veröffentlicht ist. */}
        <p className="lib-print">
          <button type="button" className="wk-link-btn" onClick={() => void saveBlob(
            new Blob([textToLatex(loaded.entry, loaded.look)], { type: 'application/x-tex' }), latexFileName(loaded.entry))}>
            Pobierz do druku (LaTeX)
          </button>
        </p>
      </>
    );
  }

  const d = loaded.entry.data;
  const lead = str(d, 'summary').trim() || excerpt(str(d, 'body'), size.width === 'narrow' ? 160 : 420);
  return (
    <div className="lib-teaser">
      <h2 className="wk-card-title">{str(d, 'title')}</h2>
      <p className="lib-meta">{[str(d, 'date') === '' ? '' : dateWords(str(d, 'date')), str(d, 'occasion')].filter(Boolean).join(' · ')}</p>
      {lead !== '' && <p className="wk-card-text">{lead}</p>}
      <button type="button" className="wk-link-btn wk-card-more" onClick={() => setOpen(true)}>Czytaj całość</button>
    </div>
  );
}

/* -- Das Archiv -------------------------------------------------------------------------------- */

/** `?t=<kennung>` in der Adresse — ein Text des Archivs lässt sich verschicken. */
function textInAddress(): string | null {
  const at = window.location.hash.indexOf('?');
  if (at < 0) return null;
  return new URLSearchParams(window.location.hash.slice(at + 1)).get('t');
}

function setTextInAddress(id: string | null): void {
  const [base, query = ''] = window.location.hash.split('?');
  const params = new URLSearchParams(query);
  if (id === null) params.delete('t'); else params.set('t', id);
  const next = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${base}${next === '' ? '' : `?${next}`}`);
}

const topicList = (s: Record<string, unknown>): { id: string; name: string }[] =>
  Array.isArray(s.topics) ? s.topics.filter((t): t is { id: string; name: string } =>
    typeof t === 'object' && t !== null && typeof (t as { id?: unknown }).id === 'string' && typeof (t as { name?: unknown }).name === 'string') : [];

export function WritingsCard({ library, title, project, topic, size, whole = false, prefix }: {
  library: string;
  title: string;
  project: string;
  topic: string;
  size: PartSize;
  whole?: boolean;
  prefix: string;
}) {
  const big = whole || size.height === 'tall';
  const take = size.height === 'strip' ? 1 : big ? 12 : size.width === 'narrow' ? 4 : 6;
  const [items, setItems] = useState<readonly PublishedItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(() => textInAddress());
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (skip: number, q: string) => {
    const done = await loadPublished(library, { kind: 'text', ref: project !== '' ? project : topic, q, order: '-sort', take, skip });
    const filtered = project !== '' && topic !== '' ? done.items.filter((i) => topicList(summaryOf(i)).some((t) => t.id === topic)) : done.items;
    return { items: filtered, total: done.total };
  }, [library, project, topic, take]);

  useEffect(() => {
    if (library === '') return undefined;
    let alive = true;
    const timer = window.setTimeout(() => {
      void load(0, query).then((r) => { if (alive) { setItems(r.items); setTotal(r.total); setFailed(false); } }, () => { if (alive) setFailed(true); });
    }, query === '' ? 0 : 300);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [load, query, library]);

  const more = async () => {
    const r = await load(items?.length ?? 0, query);
    setItems([...(items ?? []), ...r.items]);
  };

  const pick = (id: string | null) => { setSelected(id); setTextInAddress(id); };

  if (selected !== null) {
    return (
      <div className="lib-archive-one">
        <button type="button" className="wk-link-btn" onClick={() => pick(null)}>← Wszystkie teksty</button>
        <WritingCard library={library} entryId={selected} size={size} whole prefix={prefix} />
      </div>
    );
  }

  return (
    <div className="lib-archive">
      {title !== '' && <h2 className="wk-card-title">{title}</h2>}
      {big && <input className="lib-archive-search" type="search" value={query} placeholder="Szukaj w tekstach…" aria-label="Szukaj w tekstach" onChange={(e) => setQuery(e.target.value)} />}
      {failed && <p className="wk-card-text">Nie udało się wczytać tekstów.</p>}
      {items === null && !failed && <p className="wk-card-text lib-loading">Wczytywanie…</p>}
      {items !== null && items.length === 0 && <p className="wk-card-text">{query === '' ? 'Nie ma jeszcze opublikowanych tekstów.' : 'Nic nie znaleziono.'}</p>}
      {items !== null && items.length > 0 && (
        <ul className="lib-archive-list">
          {items.map((item) => {
            const s = summaryOf(item);
            const date = typeof s.date === 'string' && s.date !== '' ? dateWords(s.date) : '';
            return (
              <li key={item.entryId}>
                <button type="button" className="lib-archive-item" onClick={() => pick(item.entryId)}>
                  <span className="lib-archive-title">{String(s.title ?? 'Bez tytułu')}</span>
                  <span className="lib-meta">{[date, String(s.occasion ?? '')].filter(Boolean).join(' · ')}</span>
                  {size.height !== 'strip' && size.width !== 'narrow' && typeof s.summary === 'string' && s.summary !== '' && <span className="lib-archive-lead">{s.summary}</span>}
                  {big && topicList(s).length > 0 && <span className="lib-topics">{topicList(s).map((t) => <span key={t.id} className="lib-chip">{t.name}</span>)}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {items !== null && items.length < total && size.height !== 'strip' && (
        <button type="button" className="wk-link-btn" onClick={() => void more()}>Więcej ({total - items.length})</button>
      )}
    </div>
  );
}

/* -- Die Zitate ---------------------------------------------------------------------------------- */

const dayNumber = (): number => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000);

function QuoteItem({ library, item, full }: { library: string; item: PublishedItem; full: boolean }) {
  const s = summaryOf(item);
  const [whole, setWhole] = useState<LibEntry | null>(null);
  const [look, setLook] = useState<Lookup | null>(null);

  const open = async () => {
    const r = await loadPublishedOne(library, item.entryId);
    const all = [r.entry, ...r.refs].map((one) => readPublic(one.json)).filter((e): e is LibEntry => e !== null);
    setWhole(all.find((e) => e.id === item.entryId) ?? null);
    setLook(publicLookup(all));
  };

  if (whole !== null && look !== null) return <li><QuoteFigure entry={whole} look={look} /></li>;

  return (
    <li>
      <figure className="lib-quote">
        <blockquote><p>{String(s.text ?? '')}</p></blockquote>
        {typeof s.translation === 'string' && s.translation !== '' && full && <p className="lib-embed-translation">{s.translation}</p>}
        <figcaption>— {String(s.origin ?? '')}</figcaption>
        {full && typeof s.description === 'string' && s.description !== '' && <p className="lib-quote-note">{s.description}</p>}
        {full && topicList(s).length > 0 && <p className="lib-topics">{topicList(s).map((t) => <span key={t.id} className="lib-chip">{t.name}</span>)}</p>}
        {s.truncated === true && <button type="button" className="wk-link-btn" onClick={() => void open()}>Cały cytat</button>}
      </figure>
    </li>
  );
}

export function QuotesCard({ library, title, topic, size, whole = false }: {
  library: string;
  title: string;
  topic: string;
  size: PartSize;
  whole?: boolean;
}) {
  const big = whole || size.height === 'tall';
  const daily = !big;
  const take = size.height === 'strip' ? 1 : daily ? (size.width === 'narrow' || size.width === 'medium' ? 1 : 2) : 20;
  const [items, setItems] = useState<readonly PublishedItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [chosenTopic, setChosenTopic] = useState(topic);
  const [topics, setTopics] = useState<readonly { id: string; name: string }[]>([]);

  useEffect(() => { setChosenTopic(topic); }, [topic]);

  useEffect(() => {
    if (library === '') return undefined;
    let alive = true;
    const timer = window.setTimeout(() => void (async () => {
      try {
        if (daily) {
          /* „Myśl dnia": jeden (albo dwa) — co dzień inny, dla każdego ten sam. */
          const first = await loadPublished(library, { kind: 'quote', ref: chosenTopic, order: 'sort', take: 1 });
          const skip = first.total === 0 ? 0 : dayNumber() % first.total;
          const done = await loadPublished(library, { kind: 'quote', ref: chosenTopic, order: 'sort', take, skip });
          if (alive) { setItems(done.items); setTotal(first.total); }
        } else {
          const done = await loadPublished(library, { kind: 'quote', ref: chosenTopic, q: query, order: 'sort', take });
          if (!alive) return;
          setItems(done.items);
          setTotal(done.total);
          const found = new Map<string, string>();
          for (const item of done.items) for (const t of topicList(summaryOf(item))) found.set(t.id, t.name);
          if (chosenTopic === '' && query === '') setTopics([...found].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'pl')));
        }
      } catch {
        if (alive) setItems([]);
      }
    })(), query === '' ? 0 : 300);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [library, chosenTopic, query, daily, take]);

  const more = async () => {
    const done = await loadPublished(library, { kind: 'quote', ref: chosenTopic, q: query, order: 'sort', take, skip: items?.length ?? 0 });
    setItems([...(items ?? []), ...done.items]);
  };

  return (
    <div className={`lib-quotes${daily ? ' is-daily' : ''}`}>
      {title !== '' && <h2 className="wk-card-title">{title}</h2>}
      {big && (
        <div className="lib-quotes-tools">
          <input type="search" value={query} placeholder="Szukaj w cytatach…" aria-label="Szukaj w cytatach" onChange={(e) => setQuery(e.target.value)} />
          {topics.length > 0 && topic === '' && (
            <div className="lib-topics" role="group" aria-label="Tematy">
              <button type="button" className={chosenTopic === '' ? 'lib-chip is-on' : 'lib-chip'} onClick={() => setChosenTopic('')}>wszystkie</button>
              {topics.map((t) => <button key={t.id} type="button" className={chosenTopic === t.id ? 'lib-chip is-on' : 'lib-chip'} onClick={() => setChosenTopic(t.id)}>{t.name}</button>)}
            </div>
          )}
        </div>
      )}
      {items === null && <p className="wk-card-text lib-loading">Wczytywanie…</p>}
      {items !== null && items.length === 0 && <p className="wk-card-text">{query === '' ? 'Nie ma jeszcze opublikowanych cytatów.' : 'Nic nie znaleziono.'}</p>}
      {items !== null && items.length > 0 && (
        <ul className="lib-quote-list">{items.map((item) => <QuoteItem key={item.entryId} library={library} item={item} full={big || size.height !== 'strip'} />)}</ul>
      )}
      {big && items !== null && items.length < total && <button type="button" className="wk-link-btn" onClick={() => void more()}>Więcej ({total - items.length})</button>}
    </div>
  );
}
