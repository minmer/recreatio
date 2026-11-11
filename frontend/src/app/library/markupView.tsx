/**
 * DER ZAPIS, GEZEICHNET (0064; 2026-10-21 aus `LibraryText.tsx` hierher) —
 * Absätze, Überschriften, Listen, Zitate und die Fussnoten, die über einen
 * ganzen Text gezählt werden: über den Plan, die Treść und die Dalsze
 * informacje. Der Text (`TextArticle`) und seine Teile (`SermonParts.tsx`)
 * zeichnen mit denselben Bausteinen, damit eine Fussnote im Plan dieselbe
 * Zählung hat wie eine im Text.
 */

import { createContext, Fragment, useContext, useMemo, type MouseEvent, type ReactNode } from 'react';

import { blocksKeyOf, blocksOf, THESIS_LIMIT } from './blocks';
import { aboutLine, isAnswered, statementOf, statementRole } from './statement';
import { citeSegs, newCiteState, originOf, refLabel, workBehind, type CiteState, type Seg } from './libraryCite';
import { isSource, ownTitle, refTarget, str, type LibEntry, type Lookup } from './libraryKinds';
import { parseInline, parseMarkup, unreadable, walkBlocks, walkInline, type Block, type Inline } from './libraryMarkup';
import { later } from '../ui/later';
import { Glue, glue, Tex } from '../ui/tex/Tex';
import { texPieces } from '../core/tex';
import { TextJump } from './SourceJump';
import { useT } from '../core/i18n';
import { viewPath } from '../routes';

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
  /**
   * 2026-11-05 (Prompt 24) — ein Verweis in eine andere Baza ([[Wort|@@historia:@…]], `cogita/worlds.ts`): wie er gezeichnet
   * wird (Cogita: ein Link, wenn der Leser die andere Baza lesen kann). Ohne: nur der eigene Wortlaut.
   */
  readonly cross?: (token: string, label: ReactNode) => ReactNode;
}

export const MarkupLinks = createContext<MarkupLinkTo>({});

/** 2026-11-11 — die Wege zur Quelle einer Fussnote hinter einem kleinen Zeichen (leer: gar nichts). */
function NoteActs({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <details className="lib-note-acts">
      <summary aria-label={t('librarySource.openSource')} title={t('librarySource.openSource')}>↗</summary>
      <span className="lib-note-acts-body">{children}</span>
    </details>
  );
}

/** 2026-11-08 — jede lesbare Quelle eines Przypis führt zu ihrem Eintrag („Otwórz źródło"), auch ohne abgeschriebenen Text. */
function CitationSource({ entry, look }: { entry: LibEntry; look: Lookup }) {
  const t = useT();
  const to = useContext(MarkupLinks);
  const owner = (entry as LibEntry & { libraryId?: string }).libraryId;
  const workspace = typeof window !== 'undefined' && window.location.hash.startsWith('#/workspace');
  const href = to.hrefOf?.(entry) ?? (workspace && owner !== undefined ? viewPath('library', owner, entry.id) : undefined);
  const title = t('librarySource.openSourceTitle', { name: ownTitle(entry, look) });
  if (href !== undefined) return <> <a className="src-jump" href={href} title={title}>{t('librarySource.openSource')}</a></>;
  if (to.open !== undefined) return <> <button type="button" className="src-jump" onClick={() => to.open!(entry)} title={title}>{t('librarySource.openSource')}</button></>;
  return null;
}

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
  if (token.startsWith('@@')) return <>{to.cross !== undefined ? to.cross(token, said) : <span className="lib-own-ref is-cross">{said}</span>}</>;
  if (entry === undefined || look === undefined) return <span className="lib-own-ref is-unreadable">{said ?? unreadable()}</span>;
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

  /* 2026-10-22 — eine eingebettete Aussage zählt mit, wo sie steht; eine, die sich selbst (über andere) einbettet, nur einmal. 2026-10-23: jeder Eintrag mit Feld blocks. */
  const onBlock = (path: ReadonlySet<string>) => (b: Block) => {
    if (b.t !== 'embed') return;
    const target = refTarget(look, b.key);
    const key = target === undefined ? null : blocksKeyOf(target, look);
    if (target !== undefined && key !== null) {
      if (!path.has(target.id)) walkStatement(target, key, new Set([...path, target.id]));
      return;
    }
    const work = workBehind(target, look);
    if (work !== undefined) works.push(work);
  };
  const walkStatement = (entry: LibEntry, key: string, path: ReadonlySet<string>) => {
    for (const block of parsedStatement(entry, key)) {
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
        /* 2026-10-24 — hat das zitierte Werk einen Text, den dieser Leser lesen darf: dorthin (`SourceJump.tsx`). */
        const jumps: { entry: LibEntry; workId?: string; locator: string }[] = [];
        sources.forEach((item, i) => {
          const target = refTarget(look, item.key);
          const work = workBehind(target, look);
          if (work !== undefined) {
            works.push(work);
          }
          if (target !== undefined) jumps.push({ entry: work ?? target, workId: work?.id, locator: target.kind === 'quote' ? (item.locator || str(target.data, 'locator')) : item.locator });
          if (i > 0) segs.push({ text: '; ' });
          segs.push(...citeSegs(target, item.locator, look, state));
        });
        /*
          2026-11-11 (Eigentümer: „drei Links an jeder Fussnote sind zu viel") — EIN kleines Zeichen je Fussnote; ein Tippen klappt
          „Otwórz źródło", „pokaż w tekście" und „czytnik" auf.
        */
        list.push({ n, body: <><Segs segs={segs} />.{jumps.length > 0 && <NoteActs>{jumps.map((j, i) => <Fragment key={i}><CitationSource entry={j.entry} look={look} />{j.workId !== undefined && <TextJump look={look} workId={j.workId} locator={j.locator} />}</Fragment>)}</NoteActs>}</> });
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

/* -- Aussagen (2026-10-22; seit 2026-10-23 jeder Eintrag mit Feld `blocks`) ------------------------ */

type ParsedRun = { readonly t: 'text'; readonly c: readonly Inline[] } | { readonly t: 'ref'; readonly ref: string; readonly locator: string };
type ParsedBlock =
  | { readonly type: 'paragraph'; readonly blocks: readonly Block[] }
  | { readonly type: 'ordered' | 'unordered'; readonly items: readonly (readonly ParsedRun[])[] }
  | { readonly type: 'table'; readonly columns: readonly string[]; readonly rows: readonly (readonly (readonly ParsedRun[])[])[] };

/* Gelesen EINMAL je Fassung: die Fussnoten hängen an genau diesen Bäumen (Zählen und Zeichnen sehen dieselben). */
const parsed = new WeakMap<LibEntry, { key: string; blocks: ParsedBlock[] }>();

function parsedStatement(entry: LibEntry, key: string): ParsedBlock[] {
  let found = parsed.get(entry);
  if (found === undefined || found.key !== key) {
    const cell = (runs: readonly ({ text: string } | { ref: string; locator?: string })[]): ParsedRun[] =>
      runs.map((run) => ('ref' in run ? { t: 'ref', ref: run.ref, locator: run.locator ?? '' } : { t: 'text', c: parseInline(run.text) }));
    found = {
      key,
      blocks: blocksOf(entry.data, key).map((block): ParsedBlock => (block.type === 'paragraph' ? { type: 'paragraph', blocks: parseMarkup(block.text) }
        : block.type === 'table' ? { type: 'table', columns: block.columns, rows: block.rows.map((row) => row.map(cell)) }
        : { type: block.type, items: block.items.map(cell) }))
    };
    parsed.set(entry, found);
  }
  return found.blocks;
}

function Runs({ runs, look, notes, prefix }: { runs: readonly ParsedRun[]; look: Lookup; notes: Notes | null; prefix: string }) {
  return (
    <>
      {runs.map((run, i) => {
        if (run.t === 'text') return <Inlines key={i} list={run.c} notes={notes} prefix={prefix} look={look} />;
        const target = look.get(run.ref);
        /* 2026-10-22 — ein eigener Eintrag in einer Zelle ist ein Link; eine Quelle (Łk 1,35) steht als Name da. */
        if (target !== undefined && !isSource(target)) return <OwnRef key={i} token={run.ref} locator={run.locator} look={look} />;
        /* 2026-10-24 — eine Stelle eines Werks mit Text (der Vers eines Komentarza biblijnego): dorthin. */
        const work = workBehind(target, look);
        const locator = target?.kind === 'quote' ? (run.locator || str(target.data, 'locator')) : run.locator;
        return (
          <Fragment key={i}>
            <span className={target === undefined ? 'lib-ref is-unreadable' : 'lib-ref'}>{refLabel(run.ref, run.locator, look)}</span>
            {work !== undefined && <TextJump look={look} workId={work.id} locator={locator} />}
          </Fragment>
        );
      })}
    </>
  );
}

/** Die Bausteine einer Aussage: Absätze, Listen, eine Tabelle. `path`: wer schon eingebettet ist (gegen Kreise). */
export function StatementBody({ entry, look, notes, prefix, path = new Set() }: {
  entry: LibEntry; look: Lookup; notes: Notes | null; prefix: string; path?: ReadonlySet<string>;
}) {
  const key = blocksKeyOf(entry, look);
  if (key === null) return null;
  const inner = new Set([...path, entry.id]);
  return (
    <>
      {parsedStatement(entry, key).map((block, i) => {
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

/**
 * 2026-10-22 — WAS EINE AUSSAGE IST, GERECHNET (`statement.ts`): Informacja
 * oder Interpretacja, eine Frage (offen oder beantwortet — beantwortet, sobald
 * eine andere lesbare Aussage auf sie zeigt); für den, der schreibt
 * (`author`), dazu eine Teza, die fehlt oder zu lang ist.
 */
export function StatementMarks({ entry, look, author = false }: { entry: LibEntry; look: Lookup; author?: boolean }) {
  const t = useT();
  const statement = statementOf(entry, look);
  if (statement === null) return null;
  const role = statementRole(entry, look);
  const answered = statement.question && isAnswered(entry, look);
  const problem = author ? statement.problem : null;
  return (
    <p className="lib-stmts">
      <span className={`lib-stmt ${role === 'information' ? 'is-info' : 'is-interp'}`}
        title={role === 'information' ? t('library.markup.infoTitle') : t('library.markup.interpTitle')}>
        {role === 'information' ? t('library.markup.info') : t('library.markup.interp')}
      </span>
      {statement.question && <span className={`lib-stmt is-question${answered ? '' : ' is-open'}`}>{answered ? t('library.markup.answered') : t('library.markup.open')}</span>}
      {problem === 'missing' && <span className="lib-stmt is-warn">{t('library.markup.noThesis')}</span>}
      {problem === 'long' && <span className="lib-stmt is-warn">{t('library.markup.longThesis', { n: THESIS_LIMIT })}</span>}
    </p>
  );
}

/**
 * EINE AUSSAGE FÜR SICH — mit eigenen Fussnoten (eigener Präfix), damit sie
 * die Zählung eines Textes nicht stört; `about`: worüber sie ist.
 */
export function StatementCard({ entry, look, prefix, about = false }: { entry: LibEntry; look: Lookup; prefix: string; about?: boolean }) {
  const own = `${prefix}c${entry.id.slice(0, 8)}-`;
  const key = blocksKeyOf(entry, look);
  const notes = useMemo(() => {
    const blocks = key === null ? [] : parsedStatement(entry, key).flatMap((b) => (b.type === 'paragraph' ? [b.blocks] : []));
    return countNotes(blocks, look);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, key, look, look.revision]);
  const said = about ? aboutLine(entry, look) : '';
  return (
    <aside className="lib-comment">
      <StatementMarks entry={entry} look={look} />
      {said !== '' && <p className="lib-comment-about">o: {said}</p>}
      <StatementBody entry={entry} look={look} notes={notes} prefix={own} />
      <NoteList notes={notes} prefix={own} />
    </aside>
  );
}

/* -- Zeichnen ------------------------------------------------------------------------------- */

/** Ein Sprung innerhalb der Seite — die Adresse trägt die Weiche (`#/…`), deshalb von Hand. */
export function jump(e: MouseEvent, id: string) {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/** 2026-11-01 — Satzzeichen nach einem Wzór im Satz bleiben bei ihm (`glue`, ui/tex/Tex.tsx). */
export const gluedInlines = (list: readonly Inline[]) =>
  glue(list, (x) => x.t === 'math' && !x.display, (x) => (x.t === 'text' ? x.v : null), (_x, v): Inline => ({ t: 'text', v }));

export function Inlines({ list, notes, prefix = '', look }: { list: readonly Inline[]; notes: Notes | null; prefix?: string; look?: Lookup }) {
  return (
    <>
      {gluedInlines(list).map(({ item: one, punct }, i) => {
        switch (one.t) {
          case 'text': return <Fragment key={i}>{one.v}</Fragment>;
          case 'br': return <br key={i} />;
          /* 2026-11-01 — ein Wzór (KaTeX, erst geladen, wenn einer zu sehen ist). */
          case 'math': return <Glue key={i} punct={punct}><Tex tex={one.tex} display={one.display} /></Glue>;
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

/** Der Wortlaut eines Zitats: Absätze, Zeilen — 2026-11-01 und seine Wzory (`$…$`, aus dem Czytnik eines Lehrbuchs). */
export function QuoteBody({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n\s*\n/).map((p, i) => (
        <p key={i}>
          {texPieces(p).map((piece, k) => (piece.t === 'math'
            ? <Tex key={k} tex={piece.tex} display={piece.display} />
            : <Fragment key={k}>{piece.v.split('\n').map((line, j) => <Fragment key={j}>{j > 0 && <br />}{line}</Fragment>)}</Fragment>))}
        </p>
      ))}
    </>
  );
}

export function Blocks({ blocks, look, notes, prefix, path = new Set() }: { blocks: readonly Block[]; look: Lookup; notes: Notes | null; prefix: string; path?: ReadonlySet<string> }) {
  const t = useT();
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'p': return <p key={i}><Inlines list={b.c} notes={notes} prefix={prefix} look={look} /></p>;
          case 'h': {
            const H = b.level === 2 ? 'h3' : b.level === 3 ? 'h4' : 'h5';
            return <H key={i} className="lib-h"><Inlines list={b.c} notes={notes} prefix={prefix} look={look} /></H>;
          }
          case 'quote': {
            /* 2026-11-05 — die letzte Zeile eines Zitats, die mit „—" beginnt, ist sein Autor: abgesetzt unter dem Zitat. */
            /* Zwei `>`-Zeilen ergeben einen Absatz mit Zeilenumbruch: der Autor ist, was nach dem letzten Umbruch kommt (oder ein eigener letzter Absatz). */
            const dash = (x: Inline | undefined) => x?.t === 'text' && /^\s*[—–]\s/.test(x.v);
            const last = b.c[b.c.length - 1];
            let body: readonly Block[] = b.c;
            let by: readonly Inline[] | null = null;
            if (last?.t === 'p') {
              const cut = last.c.map((x) => x.t).lastIndexOf('br');
              if (cut > 0 && dash(last.c[cut + 1])) { body = [...b.c.slice(0, -1), { ...last, c: last.c.slice(0, cut) }]; by = last.c.slice(cut + 1); }
              else if (b.c.length > 1 && dash(last.c[0])) { body = b.c.slice(0, -1); by = last.c; }
            }
            return (
              <blockquote key={i} className="lib-blockquote">
                <Blocks blocks={body} look={look} notes={notes} prefix={prefix} path={path} />
                {by !== null && <p className="lib-quote-by"><Inlines list={by} notes={notes} prefix={prefix} look={look} /></p>}
              </blockquote>
            );
          }
          case 'list': {
            const L = b.ordered ? 'ol' : 'ul';
            return <L key={i}>{b.items.map((item, j) => <li key={j}><Inlines list={item} notes={notes} prefix={prefix} look={look} /></li>)}</L>;
          }
          case 'hr': return <hr key={i} className="lib-hr" />;
          /* 2026-11-05 (Prompt 23, D10) — zum Aufklappen (ein langer Beweis): zu, mit seiner Überschrift. */
          case 'details': return (
            <details key={i} className="lib-details" data-markup-details="">
              <summary><Inlines list={b.summary} notes={notes} prefix={prefix} look={look} /></summary>
              <Blocks blocks={b.c} look={look} notes={notes} prefix={prefix} path={path} />
            </details>
          );
          case 'embed': {
            const quote = refTarget(look, b.key);
            if (quote === undefined) return <p key={i} className="lib-missing">{unreadable()}</p>;
            /* 2026-10-23 — jede Aussage (ein Eintrag mit Feld blocks, z. B. ein Komentarz): ihre Bausteine, mit Tabellen. */
            if (blocksKeyOf(quote, look) !== null) {
              if (path.has(quote.id)) return <p key={i} className="lib-missing">{t('library.markup.selfEmbed')}</p>;
              return <aside key={i} className="lib-comment is-embedded"><StatementBody entry={quote} look={look} notes={notes} prefix={prefix} path={path} /></aside>;
            }
            /* 2026-10-22 (Schritt 11) — ein Widok einer Baza wiedzy: was er jetzt wählt („wszystkie psalmy jutrzni niedzielnej"). */
            if (quote.kind === 'view') return <LiveView key={i} viewId={quote.id} libraryId={(quote as { libraryId?: string }).libraryId ?? ''} />;
            if (quote.kind !== 'quote') return <p key={i} className="lib-missing">„{b.key}” to nie cytat, wypowiedź (treść w blokach) ani widok.</p>;
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
  const t = useT();
  if (notes.list.length === 0) return null;
  return (
    <section className="lib-notes">
      <h3 className="lib-section">{t('library.markup.notes')}</h3>
      <ol>
        {notes.list.map((note) => (
          <li key={note.n} id={`${prefix}fn-${note.n}`}>
            {note.body}{' '}
            <a className="lib-back" href={`#${prefix}fnref-${note.n}`} aria-label={t('library.markup.back')} onClick={(e) => jump(e, `${prefix}fnref-${note.n}`)}>↩</a>
          </li>
        ))}
      </ol>
    </section>
  );
}
