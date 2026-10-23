/**
 * DER ZAPIS, GEZEICHNET (0064; 2026-10-21 aus `LibraryText.tsx` hierher) —
 * Absätze, Überschriften, Listen, Zitate und die Fussnoten, die über einen
 * ganzen Text gezählt werden: über den Plan, die Treść und die Dalsze
 * informacje. Der Text (`TextArticle`) und seine Teile (`SermonParts.tsx`)
 * zeichnen mit denselben Bausteinen, damit eine Fussnote im Plan dieselbe
 * Zählung hat wie eine im Text.
 */

import { createContext, Fragment, useContext, useMemo, type MouseEvent, type ReactNode } from 'react';

import { blocksOf, commentsAbout, isQuestion, statementRole, statementTokens, subjectsOf, thesisProblem, THESIS_LIMIT } from './comment';
import { citeSegs, newCiteState, originOf, refLabel, workBehind, type CiteState, type Seg } from './libraryCite';
import { isSource, ownTitle, refTarget, str, type LibEntry, type Lookup } from './libraryKinds';
import { parseInline, parseMarkup, UNREADABLE, walkBlocks, walkInline, type Block, type Inline } from './libraryMarkup';
import { later } from '../ui/later';

/* 2026-10-22 (Schritt 11) — ein Widok im Text: der Rechner (Cogita) kommt erst, wenn einer gezeigt wird. */
const LiveView = later(() => import('../cogita/ViewEmbed').then((m) => m.ViewEmbed));

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

/* -- 2026-10-22: eigene Einträge sind Links ------------------------------------------------- */

/**
 * Wohin ein Link auf einen eigenen Eintrag führt: eine Adresse (`hrefOf`, im
 * Arbeitsbereich: sein Editor) oder eine Ansicht daneben (`open`, auf einer
 * Seite). Ohne beides steht nur sein Name da.
 */
export interface MarkupLinkTo {
  readonly hrefOf?: (entry: LibEntry) => string | undefined;
  readonly open?: (entry: LibEntry) => void;
}

export const MarkupLinks = createContext<MarkupLinkTo>({});

/**
 * EIN VERWEIS AUF EINEN EIGENEN EINTRAG — ein Link mit seinem Namen (und der
 * Stelle) oder mit dem eigenen Wortlaut aus `[[Wort|@…]]`. Kann dieser Leser
 * das Ziel nicht lesen, steht der eigene Wortlaut ohne Link da, sonst
 * „[odwołanie niedostępne]" — nie etwas über das Ziel.
 */
export function OwnRef({ token, locator = '', label, look }: { token: string; locator?: string; label?: readonly Inline[]; look?: Lookup }) {
  const to = useContext(MarkupLinks);
  const entry = look === undefined ? undefined : refTarget(look, token);
  const said = label !== undefined && label.length > 0 ? <Inlines list={label} notes={null} look={look} /> : null;
  if (entry === undefined || look === undefined) return <span className="lib-own-ref is-unreadable">{said ?? UNREADABLE}</span>;
  const text = said ?? `${ownTitle(entry, look)}${locator === '' ? '' : `, ${locator}`}`;
  const href = to.hrefOf?.(entry);
  if (href !== undefined) return <a className="lib-own-ref" href={href}>{text}</a>;
  if (to.open !== undefined) return <button type="button" className="lib-own-ref" onClick={() => to.open!(entry)}>{text}</button>;
  return <span className="lib-own-ref">{text}</span>;
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
export function countNotes(parts: readonly (readonly Block[])[], look: Lookup): Notes {
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
        /* 2026-10-22 — nur die Quellen kommen in die Fussnote; eigene Einträge stehen als Link im Text. */
        const sources = inline.items.filter((item) => isSource(refTarget(look, item.key)));
        if (sources.length === 0) return;
        const n = list.length + 1;
        numbers.set(inline, n);
        const segs: Seg[] = [];
        sources.forEach((item, i) => {
          const target = refTarget(look, item.key);
          const work = workBehind(target, look);
          if (work !== undefined) works.push(work);
          if (i > 0) segs.push({ text: '; ' });
          segs.push(...citeSegs(target, item.locator, look, state));
        });
        list.push({ n, body: <><Segs segs={segs} />.</> });
      } else if (inline.t === 'note') {
        const n = list.length + 1;
        numbers.set(inline, n);
        state.last = null;
        list.push({ n, body: <Inlines list={inline.c} notes={null} look={look} /> });
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
      {runs.map((run, i) => {
        if (run.t === 'text') return <Inlines key={i} list={run.c} notes={notes} prefix={prefix} look={look} />;
        const target = look.get(run.ref);
        /* 2026-10-22 — ein eigener Eintrag in einer Zelle ist ein Link; eine Quelle (Łk 1,35) steht als Name da. */
        if (target !== undefined && !isSource(target)) return <OwnRef key={i} token={run.ref} locator={run.locator} look={look} />;
        return <span key={i} className={target === undefined ? 'lib-ref is-unreadable' : 'lib-ref'}>{refLabel(run.ref, run.locator, look)}</span>;
      })}
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
 * 2026-10-22 — WAS EINE AUSSAGE IST, GERECHNET (`comment.ts`): Informacja oder
 * Interpretacja, eine Frage (offen oder beantwortet — beantwortet, sobald eine
 * andere lesbare Aussage auf sie zeigt); für den, der schreibt (`author`),
 * dazu eine Teza, die fehlt oder zu lang ist.
 */
export function StatementMarks({ comment, look, author = false }: { comment: LibEntry; look: Lookup; author?: boolean }) {
  const kindOf = (token: string) => refTarget(look, token)?.kind;
  const role = statementRole(comment.data, kindOf);
  const question = isQuestion(comment.data);
  const answered = question && (look.readable?.() ?? []).some((e) => e.id !== comment.id && e.kind === 'comment'
    && statementTokens(e.data).some((t) => refTarget(look, t)?.id === comment.id));
  const problem = author ? thesisProblem(comment.data) : null;
  return (
    <p className="lib-stmts">
      <span className={`lib-stmt ${role === 'information' ? 'is-info' : 'is-interp'}`}
        title={role === 'information' ? 'Zdaje sprawę ze źródła: cytuje dzieło, cytat albo osobę i nie opiera się na innym komentarzu.' : 'Własna myśl, porównanie albo synteza — nie samo źródło.'}>
        {role === 'information' ? 'Informacja' : 'Interpretacja'}
      </span>
      {question && <span className={`lib-stmt is-question${answered ? '' : ' is-open'}`}>{answered ? 'Pytanie — jest odpowiedź' : 'Pytanie otwarte'}</span>}
      {problem === 'missing' && <span className="lib-stmt is-warn">Brak tezy: komentarz nie zaczyna się od zdania</span>}
      {problem === 'long' && <span className="lib-stmt is-warn">Teza dłuższa niż {THESIS_LIMIT} znaków</span>}
    </p>
  );
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
      <StatementMarks comment={comment} look={look} />
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

export function Inlines({ list, notes, prefix = '', look }: { list: readonly Inline[]; notes: Notes | null; prefix?: string; look?: Lookup }) {
  return (
    <>
      {list.map((one, i) => {
        switch (one.t) {
          case 'text': return <Fragment key={i}>{one.v}</Fragment>;
          case 'br': return <br key={i} />;
          case 'b': return <strong key={i}><Inlines list={one.c} notes={notes} prefix={prefix} look={look} /></strong>;
          case 'i': return <em key={i}><Inlines list={one.c} notes={notes} prefix={prefix} look={look} /></em>;
          case 'link':
            return (
              <a key={i} href={one.href} {...(/^https?:/i.test(one.href) ? { target: '_blank', rel: 'noreferrer noopener' } : {})}>
                <Inlines list={one.c} notes={notes} prefix={prefix} look={look} />
              </a>
            );
          /* 2026-10-22 — ein Verweis mit eigenem Wortlaut: ein Link, nie eine Fussnote. */
          case 'ref': return <OwnRef key={i} token={one.key} label={one.c} look={look} />;
          case 'cite': {
            const n = notes?.numbers.get(one);
            /* Eigene Einträge in der Klammer stehen als Links im Text — „(zob. …)", wo sonst die Fussnote stünde; nur die Quellen haben eine. */
            const own = look === undefined ? [] : one.items.filter((item) => !isSource(refTarget(look, item.key)));
            return (
              <Fragment key={i}>
                {own.length > 0 && <> (zob. {own.map((item, j) => <Fragment key={j}>{j > 0 && '; '}<OwnRef token={item.key} locator={item.locator} look={look} /></Fragment>)})</>}
                {n !== undefined && <sup className="lib-fnref" id={`${prefix}fnref-${n}`}><a href={`#${prefix}fn-${n}`} onClick={(e) => jump(e, `${prefix}fn-${n}`)}>{n}</a></sup>}
              </Fragment>
            );
          }
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
          case 'p': return <p key={i}><Inlines list={b.c} notes={notes} prefix={prefix} look={look} /></p>;
          case 'h': {
            const H = b.level === 2 ? 'h3' : b.level === 3 ? 'h4' : 'h5';
            return <H key={i} className="lib-h"><Inlines list={b.c} notes={notes} prefix={prefix} look={look} /></H>;
          }
          case 'quote': return <blockquote key={i} className="lib-blockquote"><Blocks blocks={b.c} look={look} notes={notes} prefix={prefix} path={path} /></blockquote>;
          case 'list': {
            const L = b.ordered ? 'ol' : 'ul';
            return <L key={i}>{b.items.map((item, j) => <li key={j}><Inlines list={item} notes={notes} prefix={prefix} look={look} /></li>)}</L>;
          }
          case 'hr': return <hr key={i} className="lib-hr" />;
          case 'embed': {
            const quote = refTarget(look, b.key);
            if (quote === undefined) return <p key={i} className="lib-missing">{UNREADABLE}</p>;
            if (quote.kind === 'comment') {
              if (path.has(quote.id)) return <p key={i} className="lib-missing">[komentarz osadza sam siebie]</p>;
              return <aside key={i} className="lib-comment is-embedded"><CommentBody comment={quote} look={look} notes={notes} prefix={prefix} path={path} /></aside>;
            }
            /* 2026-10-22 (Schritt 11) — ein Widok einer Baza wiedzy: was er jetzt wählt („wszystkie psalmy jutrzni niedzielnej"). */
            if (quote.kind === 'view') return <LiveView key={i} viewId={quote.id} libraryId={(quote as { libraryId?: string }).libraryId ?? ''} />;
            if (quote.kind !== 'quote') return <p key={i} className="lib-missing">„{b.key}” to nie cytat, komentarz ani widok.</p>;
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
