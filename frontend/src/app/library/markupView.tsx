/**
 * DER ZAPIS, GEZEICHNET (0064; 2026-10-21 aus `LibraryText.tsx` hierher) —
 * Absätze, Überschriften, Listen, Zitate und die Fussnoten, die über einen
 * ganzen Text gezählt werden: über den Plan, die Treść und die Dalsze
 * informacje. Der Text (`TextArticle`) und seine Teile (`SermonParts.tsx`)
 * zeichnen mit denselben Bausteinen, damit eine Fussnote im Plan dieselbe
 * Zählung hat wie eine im Text.
 */

import { Fragment, useMemo, type MouseEvent, type ReactNode } from 'react';

import { blocksOf, commentsAbout, subjectsOf, UNREADABLE } from './comment';
import { citeSegs, newCiteState, originOf, refLabel, workBehind, type CiteState, type Seg } from './libraryCite';
import { refTarget, str, type LibEntry, type Lookup } from './libraryKinds';
import { parseInline, parseMarkup, walkBlocks, walkInline, type Block, type Inline } from './libraryMarkup';

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

export interface Notes {
  readonly numbers: WeakMap<Inline, number>;
  readonly list: Note[];
  readonly works: LibEntry[];
}

/**
 * Ein Durchgang VOR dem Zeichnen: jede Fussnote bekommt ihre Nummer in der
 * Reihenfolge des Textes, und „Tamże" / „dz. cyt." folgen genau dieser
 * Reihenfolge — über den Plan, die Treść und die Dalsze informacje hinweg.
 * Gezählt wird an den GELESENEN Bäumen: dieselben Objekte müssen danach
 * gezeichnet werden (die Nummern hängen an ihnen).
 */
export function countNotes(parts: readonly (readonly Block[])[], look: Lookup, hrefOf?: (e: LibEntry) => string | undefined): Notes {
  const numbers = new WeakMap<Inline, number>();
  const list: Note[] = [];
  const works: LibEntry[] = [];
  const state: CiteState = newCiteState();

  /* 2026-10-22 — ein eingebetteter Komentarz zählt mit, wo er steht; einer, der sich selbst (über andere) einbettet, nur einmal. */
  const onBlock = (path: ReadonlySet<string>) => (b: Block) => {
    if (b.t !== 'embed') return;
    const target = refTarget(look, b.key);
    if (target?.kind === 'comment') {
      if (!path.has(target.id)) walkComment(target, new Set([...path, target.id]));
      return;
    }
    const work = workBehind(target, look);
    if (work !== undefined) works.push(work);
  };
  const walkComment = (comment: LibEntry, path: ReadonlySet<string>) => {
    for (const block of parsedComment(comment)) {
      if (block.type === 'paragraph') { walkBlocks(block.blocks, onBlock(path), onInline); continue; }
      for (const run of (block.type === 'table' ? block.rows.flat() : block.items).flat()) {
        if (run.t === 'text') walkInline(run.c, onInline);
        else { const work = workBehind(look.get(run.ref), look); if (work !== undefined) works.push(work); }
      }
    }
  };
  const onInline = (inline: Inline) => {
      if (inline.t === 'cite') {
        const n = list.length + 1;
        numbers.set(inline, n);
        const segs: Seg[] = [];
        inline.items.forEach((item, i) => {
          const target = refTarget(look, item.key);
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
  };

  for (const blocks of parts) walkBlocks(blocks, onBlock(new Set()), onInline);

  return { numbers, list, works };
}

/* -- Komentarze (2026-10-22) --------------------------------------------------------------- */

type ParsedRun = { readonly t: 'text'; readonly c: readonly Inline[] } | { readonly t: 'ref'; readonly ref: string; readonly locator: string };
type ParsedBlock =
  | { readonly type: 'paragraph'; readonly blocks: readonly Block[] }
  | { readonly type: 'ordered' | 'unordered'; readonly items: readonly (readonly ParsedRun[])[] }
  | { readonly type: 'table'; readonly columns: readonly string[]; readonly rows: readonly (readonly (readonly ParsedRun[])[])[] };

/* Gelesen EINMAL je Fassung: die Fussnoten hängen an genau diesen Bäumen (Zählen und Zeichnen sehen dieselben). */
const parsed = new WeakMap<LibEntry, ParsedBlock[]>();

function parsedComment(comment: LibEntry): ParsedBlock[] {
  let found = parsed.get(comment);
  if (found === undefined) {
    const cell = (runs: readonly ({ text: string } | { ref: string; locator?: string })[]): ParsedRun[] =>
      runs.map((run) => ('ref' in run ? { t: 'ref', ref: run.ref, locator: run.locator ?? '' } : { t: 'text', c: parseInline(run.text) }));
    found = blocksOf(comment.data).map((block): ParsedBlock => (block.type === 'paragraph' ? { type: 'paragraph', blocks: parseMarkup(block.text) }
      : block.type === 'table' ? { type: 'table', columns: block.columns, rows: block.rows.map((row) => row.map(cell)) }
      : { type: block.type, items: block.items.map(cell) }));
    parsed.set(comment, found);
  }
  return found;
}

function Runs({ runs, look, notes, prefix }: { runs: readonly ParsedRun[]; look: Lookup; notes: Notes | null; prefix: string }) {
  return (
    <>
      {runs.map((run, i) => (run.t === 'text'
        ? <Inlines key={i} list={run.c} notes={notes} prefix={prefix} />
        : <span key={i} className={look.get(run.ref) === undefined ? 'lib-ref is-unreadable' : 'lib-ref'}>{refLabel(run.ref, run.locator, look)}</span>))}
    </>
  );
}

/** Die Bausteine eines Komentarza: Absätze, Listen, eine Tabelle. `path`: wer schon eingebettet ist (gegen Kreise). */
export function CommentBody({ comment, look, notes, prefix, path = new Set() }: {
  comment: LibEntry; look: Lookup; notes: Notes | null; prefix: string; path?: ReadonlySet<string>;
}) {
  const inner = new Set([...path, comment.id]);
  return (
    <>
      {parsedComment(comment).map((block, i) => {
        if (block.type === 'paragraph') return <Blocks key={i} blocks={block.blocks} look={look} notes={notes} prefix={prefix} path={inner} />;
        if (block.type === 'table') {
          return (
            <div key={i} className="lib-table-wrap">
              <table className="lib-table">
                {block.columns.some((c) => c !== '') && <thead><tr>{block.columns.map((c, j) => <th key={j} scope="col">{c}</th>)}</tr></thead>}
                <tbody>{block.rows.map((row, j) => <tr key={j}>{row.map((cell, k) => <td key={k}><Runs runs={cell} look={look} notes={notes} prefix={prefix} /></td>)}</tr>)}</tbody>
              </table>
            </div>
          );
        }
        const L = block.type === 'ordered' ? 'ol' : 'ul';
        return <L key={i}>{block.items.map((item, j) => <li key={j}><Runs runs={item} look={look} notes={notes} prefix={prefix} /></li>)}</L>;
      })}
    </>
  );
}

/** Worüber ein Komentarz ist — „o: Łk 1,35; Dz 1,8". */
export function aboutLine(comment: LibEntry, look: Lookup): string {
  return subjectsOf(comment.data).map((s) => refLabel(s.ref, s.locator, look)).join('; ');
}

/** Die Komentarze über einen Eintrag (und einen Punkt seines Plans), soweit dieser Leser sie lesen darf. */
export function commentsOn(id: string, look: Lookup, point?: string): LibEntry[] {
  return commentsAbout(id, look.readable?.() ?? [], point);
}

/**
 * EIN KOMENTARZ FÜR SICH — unter einem Zitat, einem Werk, einem Punkt des
 * Plans: mit eigenen Fussnoten (eigener Präfix), damit er die Zählung des
 * Textes nicht stört.
 */
export function CommentCard({ comment, look, prefix, about = false }: { comment: LibEntry; look: Lookup; prefix: string; about?: boolean }) {
  const own = `${prefix}c${comment.id.slice(0, 8)}-`;
  const notes = useMemo(() => {
    const blocks = parsedComment(comment).flatMap((b) => (b.type === 'paragraph' ? [b.blocks] : []));
    return countNotes(blocks, look);
  }, [comment, look]);
  return (
    <aside className="lib-comment">
      {about && <p className="lib-comment-about">o: {aboutLine(comment, look)}</p>}
      <CommentBody comment={comment} look={look} notes={notes} prefix={own} />
      <NoteList notes={notes} prefix={own} />
    </aside>
  );
}

/**
 * Die Komentarze über einen Eintrag als Abschnitt — leer, wenn keiner da (oder
 * lesbar) ist. `point`: '' — nur die über den ganzen Eintrag, sonst die über
 * diesen Punkt. `folded`: zugeklappt, mit der Zahl.
 */
export function CommentsOn({ id, look, prefix, point, title = 'Komentarze', folded = false }: {
  id: string; look: Lookup; prefix: string; point?: string; title?: string; folded?: boolean;
}) {
  const found = commentsOn(id, look, point);
  if (found.length === 0) return null;
  if (folded) {
    return (
      <details className="lib-comments is-folded">
        <summary>{title} ({found.length})</summary>
        {found.map((c) => <CommentCard key={c.id} comment={c} look={look} prefix={prefix} />)}
      </details>
    );
  }
  return (
    <section className="lib-comments">
      <h4 className="lib-comments-head">{title}</h4>
      {found.map((c) => <CommentCard key={c.id} comment={c} look={look} prefix={prefix} />)}
    </section>
  );
}

/* -- Zeichnen ------------------------------------------------------------------------------- */

/** Ein Sprung innerhalb der Seite — die Adresse trägt die Weiche (`#/…`), deshalb von Hand. */
export function jump(e: MouseEvent, id: string) {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export function Inlines({ list, notes, prefix = '' }: { list: readonly Inline[]; notes: Notes | null; prefix?: string }) {
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

export function QuoteBody({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n\s*\n/).map((p, i) => <p key={i}>{p.split('\n').map((line, j) => <Fragment key={j}>{j > 0 && <br />}{line}</Fragment>)}</p>)}
    </>
  );
}

export function Blocks({ blocks, look, notes, prefix, path = new Set() }: { blocks: readonly Block[]; look: Lookup; notes: Notes | null; prefix: string; path?: ReadonlySet<string> }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'p': return <p key={i}><Inlines list={b.c} notes={notes} prefix={prefix} /></p>;
          case 'h': {
            const H = b.level === 2 ? 'h3' : b.level === 3 ? 'h4' : 'h5';
            return <H key={i} className="lib-h"><Inlines list={b.c} notes={notes} prefix={prefix} /></H>;
          }
          case 'quote': return <blockquote key={i} className="lib-blockquote"><Blocks blocks={b.c} look={look} notes={notes} prefix={prefix} path={path} /></blockquote>;
          case 'list': {
            const L = b.ordered ? 'ol' : 'ul';
            return <L key={i}>{b.items.map((item, j) => <li key={j}><Inlines list={item} notes={notes} prefix={prefix} /></li>)}</L>;
          }
          case 'hr': return <hr key={i} className="lib-hr" />;
          case 'embed': {
            const quote = refTarget(look, b.key);
            if (quote === undefined) return <p key={i} className="lib-missing">{UNREADABLE}</p>;
            if (quote.kind === 'comment') {
              if (path.has(quote.id)) return <p key={i} className="lib-missing">[komentarz osadza sam siebie]</p>;
              return <aside key={i} className="lib-comment is-embedded"><CommentBody comment={quote} look={look} notes={notes} prefix={prefix} path={path} /></aside>;
            }
            if (quote.kind !== 'quote') return <p key={i} className="lib-missing">„{b.key}” to nie cytat ani komentarz.</p>;
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

/** Die Fussnoten unter einem Text — mit dem Sprung zurück an ihre Stelle. */
export function NoteList({ notes, prefix }: { notes: Notes; prefix: string }) {
  if (notes.list.length === 0) return null;
  return (
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
  );
}
