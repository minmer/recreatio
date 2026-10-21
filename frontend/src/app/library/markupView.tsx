/**
 * DER ZAPIS, GEZEICHNET (0064; 2026-10-21 aus `LibraryText.tsx` hierher) —
 * Absätze, Überschriften, Listen, Zitate und die Fussnoten, die über einen
 * ganzen Text gezählt werden: über den Plan, die Treść und die Dalsze
 * informacje. Der Text (`TextArticle`) und seine Teile (`SermonParts.tsx`)
 * zeichnen mit denselben Bausteinen, damit eine Fussnote im Plan dieselbe
 * Zählung hat wie eine im Text.
 */

import { Fragment, type MouseEvent, type ReactNode } from 'react';

import { citeSegs, newCiteState, originOf, workBehind, type CiteState, type Seg } from './libraryCite';
import { str, type LibEntry, type Lookup } from './libraryKinds';
import { walkBlocks, type Block, type Inline } from './libraryMarkup';

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

export function Blocks({ blocks, look, notes, prefix }: { blocks: readonly Block[]; look: Lookup; notes: Notes; prefix: string }) {
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
