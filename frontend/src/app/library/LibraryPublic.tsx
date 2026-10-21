/**
 * DIE BIBLIOTHEK AUF EINER ÖFFENTLICHEN SEITE (0064) — ohne Konto, nur aus
 * dem, was veröffentlicht ist.
 *
 * <code>
 *   WritingCard    ein Text (eine Predigt) mit Plan, Wygłoszenia, Fussnoten, Dalsze informacje, Quellen
 *   QuotesCard     die Sammlung von Zitaten — im Streifen „Myśl dnia"
 * </code>
 *
 * Das Archiv (`WritingsCard`) steht seit 2026-10-21 in `LibraryBrowse.tsx`.
 *
 * Jede Grösse sagt etwas anderes (`part.ts`): im Streifen ein Satz, als Block
 * eine Übersicht, hoch und im Vollbild das Ganze.
 */

import { useEffect, useState } from 'react';

import { loadPublished, loadPublishedOne, summaryOf, type PublishedItem } from './library';
import { ids, str, type LibEntry, type Lookup } from './libraryKinds';
import { excerpt } from './libraryMarkup';
import { dateWords, publicLookup, QuoteFigure, readPublic, TextArticle } from './LibraryText';
import { latexFileName, planToLatex, textToLatex } from './libraryLatex';
import { deliveriesOf, planOf, pointLine } from './sermon';
import { saveBlob } from '../core/platform';
import type { PartSize } from '../pages/part';
import { Loading } from '../ui/Loading';

/* -- Ein Text --------------------------------------------------------------------------------- */

/** `delivery`: kam man über ein Wygłoszenie, ist es auf dem Plan gewählt. */
type Loaded = { readonly entry: LibEntry; readonly look: Lookup; readonly delivery: string | null } | 'missing' | null;

function usePublishedOne(library: string, entryId: string): Loaded {
  const [loaded, setLoaded] = useState<Loaded>(null);
  useEffect(() => {
    if (library === '' || entryId === '') { setLoaded('missing'); return undefined; }
    let alive = true;
    setLoaded(null);
    void loadPublishedOne(library, entryId).then((r) => {
      const all = [r.entry, ...r.refs].map((one) => readPublic(one.json)).filter((e): e is LibEntry => e !== null);
      const main = all.find((e) => e.id === entryId);
      /* 2026-10-21 — ein Wygłoszenie öffnet seinen Text, mit ihm auf dem Plan. */
      const text = main?.kind === 'delivery' ? ids(main.data, 'texts').map((id) => all.find((e) => e.id === id)).find((e) => e?.kind === 'text') : main;
      if (alive) setLoaded(text === undefined ? 'missing' : { entry: text, look: publicLookup(all), delivery: main?.kind === 'delivery' ? main.id : null });
    }, () => { if (alive) setLoaded('missing'); });
    return () => { alive = false; };
  }, [library, entryId]);
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
  const loaded = usePublishedOne(library, entryId);
  const [open, setOpen] = useState(false);

  if (loaded === null) return <Loading label="Wczytywanie tekstu…" />;
  if (loaded === 'missing') return <p className="wk-card-text">Tego tekstu nie ma albo nie jest już opublikowany.</p>;

  const full = whole || open || size.height === 'tall';
  if (full) {
    const hasPlan = planOf(loaded.entry.data).length > 0;
    return (
      <>
        <TextArticle entry={loaded.entry} look={loaded.look} prefix={prefix} delivery={delivery ?? loaded.delivery} onDelivery={onDelivery} />
        {/* Druck: derselbe Text mit Fussnoten und Quellen als LaTeX — aus dem, was veröffentlicht ist. */}
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
      </>
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

const topicList = (s: Record<string, unknown>): { id: string; name: string }[] =>
  Array.isArray(s.topics) ? s.topics.filter((t): t is { id: string; name: string } =>
    typeof t === 'object' && t !== null && typeof (t as { id?: unknown }).id === 'string' && typeof (t as { name?: unknown }).name === 'string') : [];

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
      {items === null && <Loading label="Wczytywanie…" />}
      {items !== null && items.length === 0 && <p className="wk-card-text">{query === '' ? 'Nie ma jeszcze opublikowanych cytatów.' : 'Nic nie znaleziono.'}</p>}
      {items !== null && items.length > 0 && (
        <ul className="lib-quote-list">{items.map((item) => <QuoteItem key={item.entryId} library={library} item={item} full={big || size.height !== 'strip'} />)}</ul>
      )}
      {big && items !== null && items.length < total && <button type="button" className="wk-link-btn" onClick={() => void more()}>Więcej ({total - items.length})</button>}
    </div>
  );
}
