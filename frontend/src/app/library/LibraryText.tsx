/**
 * EIN TEXT DER BIBLIOTHEK, GEZEICHNET (0064) — mit Fussnoten, eingebetteten
 * Zitaten, „Dalsze informacje" und den Quellen darunter.
 *
 * <b>Dieselbe Zeichnung im Editor und auf der Seite.</b> Der Editor reicht
 * seinen Speicher als `Lookup` herein, die öffentliche Seite die offenen
 * Fassungen, die mit dem Text kamen (`publicLookup`). Was der Leser sieht,
 * sieht der Schreibende schon beim Tippen.
 */

import { Fragment, useMemo, type ReactNode } from 'react';

import { bibliography, citeSegs, newCiteState, originOf, workBehind, type CiteState, type Seg } from './libraryCite';
import { ids, kindOf, str, TEXT_TYPES, type LibEntry, type Lookup } from './libraryKinds';
import { parseMarkup, walkBlocks, type Block, type Inline } from './libraryMarkup';

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

export function Segs({ segs }: { segs: readonly Seg[] }) {
  return (
    <>
      {segs.map((s, i) => {
        const inner = s.italic === true ? <i>{s.text}</i> : s.text;
        return s.href !== undefined
          ? <a key={i} href={s.href} {...(/^https?:/i.test(s.href) ? { target: '_blank', rel: 'noreferrer noopener' } : {})}>{inner}</a>
          : <Fragment key={i}>{inner}</Fragment>;
      })}
    </>
  );
}

/* -- Fussnoten zählen --------------------------------------------------------------------- */

type Note = { readonly n: number; readonly body: ReactNode };

interface Notes {
  readonly numbers: WeakMap<Inline, number>;
  readonly list: Note[];
  readonly works: LibEntry[];
}

/**
 * Ein Durchgang VOR dem Zeichnen: jede Fussnote bekommt ihre Nummer in der
 * Reihenfolge des Textes, und „Tamże" / „dz. cyt." folgen genau dieser
 * Reihenfolge — auch über „Treść" und „Dalsze informacje" hinweg.
 */
function countNotes(parts: readonly (readonly Block[])[], look: Lookup, hrefOf?: (e: LibEntry) => string | undefined): Notes {
  const numbers = new WeakMap<Inline, number>();
  const list: Note[] = [];
  const works: LibEntry[] = [];
  const state: CiteState = newCiteState();

  for (const blocks of parts) {
    walkBlocks(blocks, (b) => {
      if (b.t !== 'embed') return;
      const work = workBehind(look.byKey(b.key), look);
      if (work !== undefined) works.push(work);
    }, (inline) => {
      if (inline.t === 'cite') {
        const n = list.length + 1;
        numbers.set(inline, n);
        const segs: Seg[] = [];
        inline.items.forEach((item, i) => {
          const target = look.byKey(item.key);
          const work = workBehind(target, look);
          if (work !== undefined) works.push(work);
          if (i > 0) segs.push({ text: '; ' });
          segs.push(...citeSegs(target, item.locator, look, state, hrefOf));
        });
        list.push({ n, body: <><Segs segs={segs} />.</> });
      } else if (inline.t === 'note') {
        const n = list.length + 1;
        numbers.set(inline, n);
        state.last = null;
        list.push({ n, body: <Inlines list={inline.c} notes={null} /> });
      }
    });
  }

  return { numbers, list, works };
}

/* -- Zeichnen ------------------------------------------------------------------------------- */

function Inlines({ list, notes, prefix = '' }: { list: readonly Inline[]; notes: Notes | null; prefix?: string }) {
  return (
    <>
      {list.map((one, i) => {
        switch (one.t) {
          case 'text': return <Fragment key={i}>{one.v}</Fragment>;
          case 'br': return <br key={i} />;
          case 'b': return <strong key={i}><Inlines list={one.c} notes={notes} prefix={prefix} /></strong>;
          case 'i': return <em key={i}><Inlines list={one.c} notes={notes} prefix={prefix} /></em>;
          case 'link':
            return (
              <a key={i} href={one.href} {...(/^https?:/i.test(one.href) ? { target: '_blank', rel: 'noreferrer noopener' } : {})}>
                <Inlines list={one.c} notes={notes} prefix={prefix} />
              </a>
            );
          case 'cite':
          case 'note': {
            const n = notes?.numbers.get(one);
            if (n === undefined) return null;
            return <sup key={i} className="lib-fnref" id={`${prefix}fnref-${n}`}><a href={`#${prefix}fn-${n}`} onClick={(e) => jump(e, `${prefix}fn-${n}`)}>{n}</a></sup>;
          }
          default: return null;
        }
      })}
    </>
  );
}

/** Ein Sprung innerhalb der Seite — die Adresse trägt die Weiche (`#/…`), deshalb von Hand. */
function jump(e: React.MouseEvent, id: string) {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function QuoteBody({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n\s*\n/).map((p, i) => <p key={i}>{p.split('\n').map((line, j) => <Fragment key={j}>{j > 0 && <br />}{line}</Fragment>)}</p>)}
    </>
  );
}

function Blocks({ blocks, look, notes, prefix }: { blocks: readonly Block[]; look: Lookup; notes: Notes; prefix: string }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'p': return <p key={i}><Inlines list={b.c} notes={notes} prefix={prefix} /></p>;
          case 'h': {
            const H = b.level === 2 ? 'h3' : b.level === 3 ? 'h4' : 'h5';
            return <H key={i} className="lib-h"><Inlines list={b.c} notes={notes} prefix={prefix} /></H>;
          }
          case 'quote': return <blockquote key={i} className="lib-blockquote"><Blocks blocks={b.c} look={look} notes={notes} prefix={prefix} /></blockquote>;
          case 'list': {
            const L = b.ordered ? 'ol' : 'ul';
            return <L key={i}>{b.items.map((item, j) => <li key={j}><Inlines list={item} notes={notes} prefix={prefix} /></li>)}</L>;
          }
          case 'hr': return <hr key={i} className="lib-hr" />;
          case 'embed': {
            const quote = look.byKey(b.key);
            if (quote === undefined) return <p key={i} className="lib-missing">[brak cytatu „{b.key}”]</p>;
            if (quote.kind !== 'quote') return <p key={i} className="lib-missing">„{b.key}” to nie cytat.</p>;
            const origin = originOf(quote, look);
            const where = b.locator !== '' ? b.locator : '';
            return (
              <figure key={i} className="lib-embed">
                <blockquote><QuoteBody text={str(quote.data, 'text')} /></blockquote>
                {str(quote.data, 'translation') !== '' && <p className="lib-embed-translation">{str(quote.data, 'translation')}</p>}
                <figcaption>— {[origin, where].filter(Boolean).join(', ')}</figcaption>
              </figure>
            );
          }
          default: return null;
        }
      })}
    </>
  );
}

const typeLabel = (value: string) => TEXT_TYPES.find((t) => t.value === value)?.label ?? '';

export function dateWords(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m === null) return iso;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Ein Nagranie: ein Player, wo die Adresse eine Tondatei ist — sonst ein Link. */
function Recording({ url, kind }: { url: string; kind: 'audio' | 'video' }) {
  const file = /\.(mp3|m4a|ogg|oga|wav|aac|opus)(\?|$)/i.test(url) && kind === 'audio';
  const movie = /\.(mp4|webm|mov)(\?|$)/i.test(url) && kind === 'video';
  if (!/^https?:\/\//i.test(url)) return null;
  if (file) return <audio className="lib-audio" controls preload="none" src={url} />;
  if (movie) return <video className="lib-video" controls preload="none" src={url} />;
  return <a className="lib-recording" href={url} target="_blank" rel="noreferrer noopener">{kind === 'audio' ? 'Nagranie' : 'Wideo'} ↗</a>;
}

export function TextArticle({ entry, look, prefix = '', heading = 'h2', hrefOf, compact = false }: {
  entry: LibEntry;
  look: Lookup;
  /** Kennungen der Fussnoten — zwei Texte auf einer Seite dürfen sich nicht ins Gehege kommen. */
  prefix?: string;
  heading?: 'h1' | 'h2' | 'h3';
  hrefOf?: (e: LibEntry) => string | undefined;
  /** Ohne Bibliografie und Dalsze informacje — für die Vorschau neben dem Schreiben. */
  compact?: boolean;
}) {
  const d = entry.data;
  const body = useMemo(() => parseMarkup(str(d, 'body')), [d]);
  const further = useMemo(() => parseMarkup(str(d, 'further')), [d]);
  const notes = useMemo(() => countNotes(compact ? [body] : [body, further], look, hrefOf), [body, further, look, compact, hrefOf]);
  const sources = useMemo(() => bibliography(notes.works, look), [notes, look]);
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
            {str(d, 'audio') !== '' && <Recording url={str(d, 'audio')} kind="audio" />}
            {str(d, 'video') !== '' && <Recording url={str(d, 'video')} kind="video" />}
          </div>
        )}
      </header>

      <div className="lib-body"><Blocks blocks={body} look={look} notes={notes} prefix={prefix} /></div>

      {!compact && further.length > 0 && (
        <section className="lib-further">
          <h3 className="lib-section">Dalsze informacje</h3>
          <Blocks blocks={further} look={look} notes={notes} prefix={prefix} />
        </section>
      )}

      {notes.list.length > 0 && (
        <section className="lib-notes">
          <h3 className="lib-section">Przypisy</h3>
          <ol>
            {notes.list.map((note) => (
              <li key={note.n} id={`${prefix}fn-${note.n}`}>
                {note.body}{' '}
                <a className="lib-back" href={`#${prefix}fnref-${note.n}`} aria-label="Wróć do tekstu" onClick={(e) => jump(e, `${prefix}fnref-${note.n}`)}>↩</a>
              </li>
            ))}
          </ol>
        </section>
      )}

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
        <p className="lib-topics">{topics.map((t) => <span key={t.id} className="lib-chip">{str(t.data, 'name')}</span>)}</p>
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

export const kindLabel = (kind: string): string => kindOf(kind)?.label ?? kind;
