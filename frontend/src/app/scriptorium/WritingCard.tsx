/**
 * EIN TEXT AUF EINER SEITE (0064; seit 2026-10-23 aus dem Skryptorium) — eine
 * Predigt mit Plan, Wygłoszenia, Fussnoten, Dalsze informacje, Quellen.
 *
 * Wer was sieht, sagt der Bereich: die Seite öffnet das Skryptorium so, wie
 * dieser Leser es lesen darf (`library/libraryOpen.ts`), und zeigt den Text
 * selbst. Ein Text, der in ein anderes Skryptorium gezogen ist (öffentlich
 * geworden), wird dort gefunden.
 *
 * Jede Grösse sagt etwas anderes (`part.ts`): als Block eine Übersicht,
 * hoch und im Vollbild das Ganze.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { ids, str, type LibEntry, type Lookup } from '../library/libraryKinds';
import { excerpt } from '../library/libraryMarkup';
import { findOnPage } from '../library/libraryOpen';
import { MarkupLinks, type MarkupLinkTo } from '../library/markupView';
import { saveBlob } from '../core/platform';
import type { PartSize } from '../pages/part';
import { Loading } from '../ui/Loading';
import { latexFileName, planToLatex, textToLatex } from './latex';
import { deliveriesOf, planOf, pointLine } from './sermon';
import { dateWords, OpenedEntry, TextArticle } from './TextArticle';

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
