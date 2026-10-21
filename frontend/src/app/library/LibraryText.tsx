/**
 * EIN TEXT DER BIBLIOTHEK, GEZEICHNET (0064) — mit Fussnoten, eingebetteten
 * Zitaten, „Dalsze informacje" und den Quellen darunter.
 *
 * <b>Dieselbe Zeichnung im Editor und auf der Seite.</b> Der Editor reicht
 * seinen Speicher als `Lookup` herein, die öffentliche Seite die offenen
 * Fassungen, die mit dem Text kamen (`publicLookup`). Was der Leser sieht,
 * sieht der Schreibende schon beim Tippen.
 *
 * <b>2026-10-21 — ein Kazanie:</b> über der Treść die Wygłoszenia (mit
 * Player) und der Plan; wer ein Wygłoszenie wählt, sieht auf dem Plan, was
 * diesmal gesagt, nur gestreift, ausgelassen wurde und was dazukam. Ein Text
 * ohne Plan und ohne Wygłoszenia sieht aus wie bisher. Die Bausteine des
 * Zapis stehen in `markupView.tsx`, der Plan und die Wygłoszenia in
 * `SermonParts.tsx`.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { bibliography, originOf } from './libraryCite';
import { ids, isAspect, str, TEXT_TYPES, type LibEntry, type Lookup } from './libraryKinds';
import { parseMarkup } from './libraryMarkup';
import { Blocks, countNotes, NoteList, QuoteBody, Segs } from './markupView';
import { deliveriesOf, mediaFile, planOf, timeLink } from './sermon';
import { DeliveriesSection, MediaPlayer, PlanSection } from './SermonParts';

/** Eine Sammlung offener Fassungen als `Lookup` — so liest die öffentliche Seite. */
export function publicLookup(entries: readonly LibEntry[]): Lookup {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const byKey = new Map(entries.filter((e) => e.key !== undefined).map((e) => [e.key!.toLowerCase(), e]));
  return { get: (id) => byId.get(id), byKey: (key) => byKey.get(key.toLowerCase()) };
}

/** Eine offene Fassung (`PublicDoc` als JSON) als Eintrag — duldsam. */
export function readPublic(json: string): LibEntry | null {
  try {
    const doc = JSON.parse(json) as { id?: unknown; kind?: unknown; key?: unknown; data?: unknown };
    if (typeof doc.id !== 'string' || typeof doc.kind !== 'string' || typeof doc.data !== 'object' || doc.data === null) return null;
    return { id: doc.id, kind: doc.kind, ...(typeof doc.key === 'string' ? { key: doc.key } : {}), data: doc.data as Record<string, unknown> };
  } catch {
    return null;
  }
}

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
  const notes = useMemo(() => countNotes([...plan.map((p) => p.blocks), body, ...(compact ? [] : [further])], look, hrefOf), [plan, body, further, look, compact, hrefOf]);
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
        <PlanSection points={plan} look={look} notes={notes} prefix={prefix} delivery={chosen} onSeek={playable || linkable !== undefined ? seek : undefined} />
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

      {!compact && sources.length > 0 && (
        <section className="lib-sources">
          <h3 className="lib-section">Źródła</h3>
          <ul>
            {sources.map(({ work, segs }) => (
              <li key={work.id}>
                <Segs segs={segs} />
                {str(work.data, 'description') !== '' && <span className="lib-source-note">{str(work.data, 'description')}</span>}
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
  );
}

/** Ein Zitat mit Herkunft und Beschreibung — in der Sammlung, in der Bibliothek. */
export function QuoteFigure({ entry, look, full = true }: { entry: LibEntry; look: Lookup; full?: boolean }) {
  const d = entry.data;
  const topics = ids(d, 'topics').map((id) => look.get(id)).filter((t): t is LibEntry => t !== undefined);
  return (
    <figure className="lib-quote">
      <blockquote><QuoteBody text={str(d, 'text')} /></blockquote>
      {str(d, 'translation') !== '' && <p className="lib-embed-translation">{str(d, 'translation')}</p>}
      <figcaption>— {originOf(entry, look)}</figcaption>
      {full && str(d, 'description') !== '' && <p className="lib-quote-note">{str(d, 'description')}</p>}
      {full && topics.length > 0 && <p className="lib-topics">{topics.map((t) => <span key={t.id} className="lib-chip">{str(t.data, 'name')}</span>)}</p>}
    </figure>
  );
}
