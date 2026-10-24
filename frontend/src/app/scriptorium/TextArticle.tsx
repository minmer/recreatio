/**
 * EIN TEXT, GEZEICHNET (0064; seit 2026-10-23 im Skryptorium) — mit Fussnoten,
 * eingebetteten Zitaten, „Dalsze informacje" und den Quellen darunter.
 *
 * <b>Dieselbe Zeichnung im Editor und auf der Seite.</b> Der Editor reicht
 * seinen Speicher als `Lookup` herein, die Seite den Speicher, den sie für
 * diesen Leser geöffnet hat (`libraryOpen.ts`). Was der Leser sieht, sieht
 * der Schreibende schon beim Tippen — soweit der Leser es lesen darf.
 *
 * <b>2026-10-21 — ein Kazanie:</b> über der Treść die Wygłoszenia (mit
 * Player) und der Plan; wer ein Wygłoszenie wählt, sieht auf dem Plan, was
 * diesmal gesagt, nur gestreift, ausgelassen wurde und was dazukam. Die
 * Bausteine des Zapis stehen in `library/markupView.tsx`, der Plan und die
 * Wygłoszenia in `SermonParts.tsx`.
 */

import { useContext, useEffect, useMemo, useRef, useState } from 'react';

import { bibliography } from '../library/libraryCite';
import { ids, ownTitle, str, textTypeName, type LibEntry, type Lookup } from '../library/libraryKinds';
import { viewPath } from '../routes';
import { parseMarkup } from '../library/libraryMarkup';
import { QuoteFigure } from '../library/LibraryText';
import { blocksKeyOf } from '../library/blocks';
import { Blocks, countNotes, MarkupLinks, NoteList, Segs, StatementCard } from '../library/markupView';
import { deliveriesOf, mediaFile, planOf, timeLink } from './sermon';
import { DeliveriesSection, MediaPlayer, PlanSection } from './SermonParts';
import { typeLines } from './textTypes';

export function dateWords(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m === null) return iso;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
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
  /* 2026-10-23 — neu gerechnet, wenn eine Quelle nachkommt (die Bibliothek eines Textes des Skryptorium lädt auf einer Seite später). */
  const revision = look.revision ?? 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const notes = useMemo(() => countNotes([...plan.map((p) => p.blocks), body, ...(compact ? [] : [further])], look), [plan, body, further, look, compact, revision]);
  const outer = useContext(MarkupLinks);
  const links = useMemo(() => (hrefOf === undefined ? outer : { ...outer, hrefOf }), [outer, hrefOf]);
  const sources = useMemo(() => bibliography(notes.works, look), [notes, look]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const deliveries = useMemo(() => (compact ? [] : deliveriesOf(entry, look)), [entry, look, compact, revision]);
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

  const project = look.get(ids(d, 'project')[0] ?? '');
  const fieldLines = typeLines(d, look);
  const H = heading;

  const meta = [textTypeName(d, look), str(d, 'date') === '' ? '' : dateWords(str(d, 'date')), str(d, 'occasion'), str(d, 'place')]
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
        {/* 2026-10-23 — die eigenen Felder seines Rodzaj tekstu („Tajemnica: Zwiastowanie"); was der Leser nicht lesen kann, fehlt. */}
        {fieldLines.length > 0 && <dl className="lib-type-lines">{fieldLines.map((one) => <div key={one.label}><dt>{one.label}</dt><dd>{one.value}</dd></div>)}</dl>}
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
              </li>
            ))}
          </ul>
        </section>
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
  /* 2026-10-23 — eine Aussage: jeder Eintrag, dessen Rodzaj ein Feld blocks hat (z. B. ein Komentarz in Nauka). */
  const statement = blocksKeyOf(entry, look) !== null;
  return (
    <aside className="lib-opened" aria-label={ownTitle(entry, look)}>
      <p className="lib-opened-bar">
        <span className="lib-section">{statement ? 'Wypowiedź' : entry.kind === 'text' ? 'Tekst' : entry.kind === 'quote' ? 'Cytat' : 'Wpis'}</span>
        <button type="button" className="wk-link-btn" onClick={onClose}>Zamknij</button>
      </p>
      {entry.kind === 'text' ? <TextArticle entry={entry} look={look} prefix={prefix} heading="h3" compact />
        : statement ? <StatementCard entry={entry} look={look} prefix={prefix} about />
        : entry.kind === 'quote' ? <QuoteFigure entry={entry} look={look} />
        : entry.kind === 'entity' ? <BaseEntry entry={entry} look={look} />
        : (
          <>
            <h3 className="lib-h">{ownTitle(entry, look)}</h3>
            {said !== '' && <p className="lib-opened-text">{said}</p>}
          </>
        )}
    </aside>
  );
}

/**
 * 2026-10-22 (Schritt 11) — EIN EINTRAG EINER BAZA WIEDZY, auf den ein Text
 * verweist (ein Słowo eines Słownik): sein Name, seine kurzen Werte — und im
 * Arbeitsbereich der Weg zu ihm in Nauka.
 */
function BaseEntry({ entry, look }: { entry: LibEntry; look: Lookup }) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
  const shown = Object.entries(entry.data)
    .filter(([key, value]) => !key.startsWith('_') && typeof value === 'string' && value.trim() !== '' && !uuid.test(value) && value.length < 200)
    .slice(0, 6) as [string, string][];
  const base = (entry as { libraryId?: string }).libraryId;
  return (
    <>
      <h3 className="lib-h">{ownTitle(entry, look)}</h3>
      {shown.length > 1 && <ul className="lib-opened-text">{shown.slice(1).map(([key, value]) => <li key={key}>{value}</li>)}</ul>}
      {base !== undefined && window.location.hash.startsWith('#/workspace') && <p><a className="wk-link" href={viewPath('knowledge', base, 'wpisy', entry.id)}>Otwórz w Wiedzy</a></p>}
    </>
  );
}
