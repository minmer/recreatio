/**
 * EIN TEXT DER BIBLIOTHEK, GEZEICHNET (0064) — mit Fussnoten, eingebetteten
 * Zitaten, „Dalsze informacje" und den Quellen darunter.
 *
 * <b>Dieselbe Zeichnung im Editor und auf der Seite.</b> Der Editor reicht
 * seinen Speicher als `Lookup` herein, die Seite den Speicher, den sie für
 * diesen Leser geöffnet hat (`libraryOpen.ts`). Was der Leser sieht, sieht
 * der Schreibende schon beim Tippen — soweit der Leser es lesen darf.
 *
 * <b>2026-10-21 — ein Kazanie:</b> über der Treść die Wygłoszenia (mit
 * Player) und der Plan; wer ein Wygłoszenie wählt, sieht auf dem Plan, was
 * diesmal gesagt, nur gestreift, ausgelassen wurde und was dazukam. Ein Text
 * ohne Plan und ohne Wygłoszenia sieht aus wie bisher. Die Bausteine des
 * Zapis stehen in `markupView.tsx`, der Plan und die Wygłoszenia in
 * `SermonParts.tsx`.
 */

import { useContext, useEffect, useMemo, useRef, useState } from 'react';

import { bibliography, originOf } from './libraryCite';
import { ids, isAspect, ownTitle, str, TEXT_TYPES, type LibEntry, type Lookup } from './libraryKinds';
import { parseMarkup } from './libraryMarkup';
import { Blocks, CommentCard, CommentsOn, countNotes, MarkupLinks, NoteList, QuoteBody, Segs } from './markupView';
import { deliveriesOf, mediaFile, planOf, timeLink } from './sermon';
import { DeliveriesSection, MediaPlayer, PlanSection } from './SermonParts';

const typeLabel = (value: string) => TEXT_TYPES.find((t) => t.value === value)?.label ?? '';

export function dateWords(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m === null) return iso;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * 2026-10-21 — DER ASPEKT EINES THEMAS, über die Sammlung nach oben gelesen
 * („Adwent" → „Okres liturgiczny"). Ein Thema, das selbst Aspekt ist, oder
 * eines ohne Aspekt darüber: leer.
 */
function aspectName(topic: LibEntry, look: Lookup): string {
  let at = look.get(ids(topic.data, 'parent')[0] ?? '');
  for (let step = 0; step < 20 && at !== undefined && at.id !== topic.id; step += 1) {
    if (isAspect(at.data)) return str(at.data, 'name');
    at = look.get(ids(at.data, 'parent')[0] ?? '');
  }
  return '';
}

export function TextArticle({ entry, look, prefix = '', heading = 'h2', hrefOf, compact = false, delivery = null, onDelivery }: {
  entry: LibEntry;
  look: Lookup;
  /** Kennungen der Fussnoten — zwei Texte auf einer Seite dürfen sich nicht ins Gehege kommen. */
  prefix?: string;
  heading?: 'h1' | 'h2' | 'h3';
  /** Wohin ein Link auf einen eigenen Eintrag führt (im Arbeitsbereich: sein Editor). Ohne: was die Umgebung sagt (`MarkupLinks`). */
  hrefOf?: (e: LibEntry) => string | undefined;
  /** Ohne Bibliografie, Dalsze informacje und Wygłoszenia — für die Vorschau neben dem Schreiben. */
  compact?: boolean;
  /** 2026-10-21 — das Wygłoszenie, das gleich gewählt ist (etwa aus der Adresse). */
  delivery?: string | null;
  /** … und wohin eine andere Wahl gemeldet wird (die Adresse). */
  onDelivery?: (id: string | null) => void;
}) {
  const d = entry.data;
  /* Gelesen EINMAL: die Fussnoten hängen an genau diesen Bäumen — erst der Plan, dann die Treść. */
  const plan = useMemo(() => planOf(d).map((point) => ({ point, blocks: parseMarkup(point.text) })), [d]);
  const body = useMemo(() => parseMarkup(str(d, 'body')), [d]);
  const further = useMemo(() => parseMarkup(str(d, 'further')), [d]);
  const notes = useMemo(() => countNotes([...plan.map((p) => p.blocks), body, ...(compact ? [] : [further])], look), [plan, body, further, look, compact]);
  const outer = useContext(MarkupLinks);
  const links = useMemo(() => (hrefOf === undefined ? outer : { ...outer, hrefOf }), [outer, hrefOf]);
  const sources = useMemo(() => bibliography(notes.works, look), [notes, look]);
  const deliveries = useMemo(() => (compact ? [] : deliveriesOf(entry, look)), [entry, look, compact]);
  const [chosenId, setChosenId] = useState<string | null>(delivery);
  useEffect(() => { setChosenId(delivery); }, [delivery]);
  const chosen = deliveries.find((one) => one.id === chosenId) ?? null;
  const media = useRef<HTMLMediaElement | null>(null);

  const choose = (id: string | null) => {
    setChosenId(id);
    onDelivery?.(id);
  };

  /* Eine Zeit im Plan: im Player dorthin — oder YouTube, Vimeo, die Datei an der Stelle öffnen. */
  const linkable = chosen === null ? undefined
    : [str(chosen.data, 'video'), str(chosen.data, 'audio')].find((url) => url !== '' && timeLink(url, 0) !== null);
  const playable = chosen !== null && (mediaFile(str(chosen.data, 'audio')) !== null || mediaFile(str(chosen.data, 'video')) !== null);
  const seek = (seconds: number) => {
    const el = media.current;
    if (el !== null && el.isConnected) {
      el.currentTime = seconds;
      void el.play().catch(() => undefined);
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    const link = linkable === undefined ? null : timeLink(linkable, seconds);
    if (link !== null) window.open(link, '_blank', 'noopener,noreferrer');
  };

  const topics = ids(d, 'topics').map((id) => look.get(id)).filter((t): t is LibEntry => t !== undefined);
  const project = look.get(ids(d, 'project')[0] ?? '');
  const H = heading;

  const meta = [typeLabel(str(d, 'textType')), str(d, 'date') === '' ? '' : dateWords(str(d, 'date')), str(d, 'occasion'), str(d, 'place')]
    .filter((s) => s.trim() !== '');

  return (
    <MarkupLinks.Provider value={links}>
    <article className="lib-article">
      <header className="lib-article-head">
        {project !== undefined && <p className="lib-eyebrow">{str(project.data, 'title')}</p>}
        <H className="lib-title">{str(d, 'title') || 'Bez tytułu'}</H>
        {str(d, 'subtitle') !== '' && <p className="lib-subtitle">{str(d, 'subtitle')}</p>}
        {meta.length > 0 && <p className="lib-meta">{meta.join(' · ')}</p>}
        {str(d, 'readings') !== '' && <p className="lib-readings"><span>Czytania:</span> {str(d, 'readings')}</p>}
        {(str(d, 'audio') !== '' || str(d, 'video') !== '') && (
          <div className="lib-recordings">
            {str(d, 'audio') !== '' && <MediaPlayer url={str(d, 'audio')} kind="audio" />}
            {str(d, 'video') !== '' && <MediaPlayer url={str(d, 'video')} kind="video" />}
          </div>
        )}
      </header>

      <DeliveriesSection deliveries={deliveries} chosen={chosen} onChoose={choose} plan={plan.map((p) => p.point)} look={look} prefix={prefix} media={media} />

      {plan.length > 0 && (
        <PlanSection textId={entry.id} points={plan} look={look} notes={notes} prefix={prefix} delivery={chosen} onSeek={playable || linkable !== undefined ? seek : undefined} />
      )}

      {plan.length > 0 && body.length > 0 ? (
        <section className="lib-body-part">
          <h3 className="lib-section">Tekst</h3>
          <div className="lib-body"><Blocks blocks={body} look={look} notes={notes} prefix={prefix} /></div>
        </section>
      ) : (body.length > 0 || plan.length === 0) && <div className="lib-body"><Blocks blocks={body} look={look} notes={notes} prefix={prefix} /></div>}

      {!compact && further.length > 0 && (
        <section className="lib-further">
          <h3 className="lib-section">Dalsze informacje</h3>
          <Blocks blocks={further} look={look} notes={notes} prefix={prefix} />
        </section>
      )}

      <NoteList notes={notes} prefix={prefix} />

      {!compact && <CommentsOn id={entry.id} point="" look={look} prefix={`${prefix}tc-`} title="Komentarze do tekstu" folded />}

      {!compact && sources.length > 0 && (
        <section className="lib-sources">
          <h3 className="lib-section">Źródła</h3>
          <ul>
            {sources.map(({ work, segs }) => (
              <li key={work.id}>
                <Segs segs={segs} />
                <CommentsOn id={work.id} look={look} prefix={`${prefix}w${work.id.slice(0, 8)}-`} folded />
              </li>
            ))}
          </ul>
        </section>
      )}

      {!compact && topics.length > 0 && (
        <p className="lib-topics">
          {topics.map((t) => {
            const aspect = aspectName(t, look);
            return <span key={t.id} className="lib-chip">{aspect !== '' && <span className="lib-chip-aspect">{aspect}:</span>}{str(t.data, 'name')}</span>;
          })}
        </p>
      )}
    </article>
    </MarkupLinks.Provider>
  );
}

/**
 * 2026-10-22 — EIN EIGENER EINTRAG, AUS EINEM TEXT HERAUS GEÖFFNET (ein Link
 * statt einer Fussnote): ein Text kurz (ohne Quellen und Wygłoszenia), ein
 * Komentarz mit dem, worüber er ist, ein Zitat mit Herkunft, sonst Name und
 * Beschreibung. Gezeigt wird nur, was dieser Leser ohnehin lesen kann — der
 * Eintrag kommt aus seinem `Lookup`.
 */
export function OpenedEntry({ entry, look, prefix, onClose }: { entry: LibEntry; look: Lookup; prefix: string; onClose: () => void }) {
  const said = str(entry.data, 'description') || str(entry.data, 'summary') || str(entry.data, 'note');
  return (
    <aside className="lib-opened" aria-label={ownTitle(entry, look)}>
      <p className="lib-opened-bar">
        <span className="lib-section">{entry.kind === 'comment' ? 'Komentarz' : entry.kind === 'text' ? 'Tekst' : entry.kind === 'quote' ? 'Cytat' : 'Wpis'}</span>
        <button type="button" className="wk-link-btn" onClick={onClose}>Zamknij</button>
      </p>
      {entry.kind === 'text' ? <TextArticle entry={entry} look={look} prefix={prefix} heading="h3" compact />
        : entry.kind === 'comment' ? <CommentCard comment={entry} look={look} prefix={prefix} about />
        : entry.kind === 'quote' ? <QuoteFigure entry={entry} look={look} />
        : (
          <>
            <h3 className="lib-h">{ownTitle(entry, look)}</h3>
            {said !== '' && <p className="lib-opened-text">{said}</p>}
          </>
        )}
    </aside>
  );
}

/** Ein Zitat mit Herkunft und den Komentarzen über es — in der Sammlung, in der Bibliothek. */
export function QuoteFigure({ entry, look, full = true }: { entry: LibEntry; look: Lookup; full?: boolean }) {
  const d = entry.data;
  const topics = ids(d, 'topics').map((id) => look.get(id)).filter((t): t is LibEntry => t !== undefined);
  return (
    <figure className="lib-quote">
      <blockquote><QuoteBody text={str(d, 'text')} /></blockquote>
      {str(d, 'translation') !== '' && <p className="lib-embed-translation">{str(d, 'translation')}</p>}
      <figcaption>— {originOf(entry, look)}</figcaption>
      {full && <CommentsOn id={entry.id} look={look} prefix={`q${entry.id.slice(0, 8)}-`} folded />}
      {full && topics.length > 0 && <p className="lib-topics">{topics.map((t) => <span key={t.id} className="lib-chip">{str(t.data, 'name')}</span>)}</p>}
    </figure>
  );
}
