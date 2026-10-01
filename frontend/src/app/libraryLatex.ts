/**
 * LaTeX — ein Text oder ein ganzes Projekt als `.tex`, so, wie
 * er gedruckt erscheinen soll: Fussnoten mit den Quellen (polnischer Brauch:
 * dz. cyt., Tamże — `libraryCite.ts`), eingebettete Zitate mit Herkunft,
 * Überschriften, Listen, und am Ende „Źródła".
 *
 * <b>Der Normalfall des Schreibens.</b> Was im Editor entsteht, ist der
 * Zapis (`libraryMarkup.ts`); die Seite zeichnet ihn als HTML, der Druck
 * geht über LaTeX. Beide lesen denselben Baum — eine Quelle, zwei Wege.
 *
 * Heraus kommt EIN Dokument, das ohne weitere Dateien mit `pdflatex` (oder
 * `lualatex`) übersetzt wird: UTF-8, Polnisch, keine Bibliografiedatei —
 * die Angaben stehen fertig formatiert darin.
 */

import { bibliography, citeSegs, newCiteState, originOf, workBehind, type CiteState, type Seg } from './libraryCite';
import { ids, outline, str, TEXT_TYPES, type LibEntry, type Lookup } from './libraryKinds';
import { parseMarkup, walkBlocks, type Block, type Inline } from './libraryMarkup';

/** Was in LaTeX eine Bedeutung hat, entschärft — und die Typografie, die TeX selbst nicht errät. */
export function latexEscape(text: string): string {
  return text
    .replace(/\\/g, '\u0000')
    .replace(/([{}$&#%_])/g, '\\$1')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\u0000/g, '\\textbackslash{}')
    .replace(/…/g, '\\dots{}')
    .replace(/\u00a0/g, '~')
    .replace(/ – /g, ' -- ')
    .replace(/ — /g, ' --- ')
    .replace(/(\d)–(\d)/g, '$1--$2');
}

/** Eine Adresse für `\href` — dort zählen nur `#`, `%`, `\`. */
const hrefEscape = (url: string): string => url.replace(/\\/g, '/').replace(/([#%])/g, '\\$1');

const segsLatex = (segs: readonly Seg[]): string =>
  segs.map((s) => {
    const body = latexEscape(s.text);
    const styled = s.italic === true ? `\\emph{${body}}` : body;
    return s.href !== undefined && /^https?:/i.test(s.href) ? `\\href{${hrefEscape(s.href)}}{${styled}}` : styled;
  }).join('');

interface Ctx {
  readonly look: Lookup;
  readonly state: CiteState;
  readonly works: LibEntry[];
}

function inlines(list: readonly Inline[], ctx: Ctx, inNote = false): string {
  return list.map((one) => {
    switch (one.t) {
      case 'text': return latexEscape(one.v);
      case 'br': return inNote ? ' ' : '\\\\\n';
      case 'b': return `\\textbf{${inlines(one.c, ctx, inNote)}}`;
      case 'i': return `\\emph{${inlines(one.c, ctx, inNote)}}`;
      case 'link': return `\\href{${hrefEscape(one.href)}}{${inlines(one.c, ctx, inNote)}}`;
      case 'cite': {
        const parts = one.items.map((item) => {
          const target = ctx.look.byKey(item.key);
          const work = workBehind(target, ctx.look);
          if (work !== undefined) ctx.works.push(work);
          return segsLatex(citeSegs(target, item.locator, ctx.look, ctx.state));
        });
        return `\\footnote{${parts.join('; ')}.}`;
      }
      case 'note': {
        ctx.state.last = null;
        return `\\footnote{${inlines(one.c, ctx, true)}}`;
      }
      default: return '';
    }
  }).join('');
}

/** Die Ebenen des Zapis (## / ###) — unter einem Kapitel eine Stufe tiefer. */
const SECTION = { article: ['\\section*', '\\subsection*', '\\subsubsection*'], book: ['\\section*', '\\subsection*', '\\subsubsection*'] } as const;

function blocks(list: readonly Block[], ctx: Ctx, depth: 0 | 1): string {
  const out: string[] = [];
  for (const b of list) {
    switch (b.t) {
      case 'p': out.push(inlines(b.c, ctx)); break;
      case 'h': {
        const level = Math.min(2, (b.level === 2 ? 0 : 1) + depth);
        out.push(`${SECTION.article[level]}{${inlines(b.c, ctx, true)}}`);
        break;
      }
      case 'quote': out.push(`\\begin{quotation}\n${blocks(b.c, ctx, depth)}\n\\end{quotation}`); break;
      case 'list': {
        const env = b.ordered ? 'enumerate' : 'itemize';
        out.push(`\\begin{${env}}\n${b.items.map((item) => `  \\item ${inlines(item, ctx)}`).join('\n')}\n\\end{${env}}`);
        break;
      }
      case 'hr': out.push('\\begin{center}*\\quad*\\quad*\\end{center}'); break;
      case 'embed': {
        const quote = ctx.look.byKey(b.key);
        if (quote === undefined || quote.kind !== 'quote') { out.push(`% brak cytatu: ${b.key}`); break; }
        const work = workBehind(quote, ctx.look);
        if (work !== undefined) ctx.works.push(work);
        const text = str(quote.data, 'text').split(/\n\s*\n/).map((p) => latexEscape(p).replace(/\n/g, '\\\\\n')).join('\n\n');
        const translation = str(quote.data, 'translation');
        const origin = [originOf(quote, ctx.look), b.locator].filter((s) => s.trim() !== '').join(', ');
        out.push([
          '\\begin{quotation}',
          text,
          translation === '' ? '' : `\n\\emph{${latexEscape(translation)}}`,
          `\n\\hfill--- ${latexEscape(origin)}`,
          '\\end{quotation}'
        ].filter((s) => s !== '').join('\n'));
        break;
      }
    }
  }
  return out.join('\n\n');
}

const PREAMBLE = (kind: 'article' | 'book') => [
  `\\documentclass[11pt,a4paper${kind === 'book' ? ',openany' : ''}]{${kind}}`,
  '\\usepackage[utf8]{inputenc}',
  '\\usepackage[T1]{fontenc}',
  '\\usepackage[polish]{babel}',
  '\\usepackage{lmodern}',
  '\\usepackage{microtype}',
  '\\usepackage[hidelinks]{hyperref}',
  '\\usepackage{enumitem}',
  '\\setlist{itemsep=0.2em}',
  '\\frenchspacing'
].join('\n');

const typeLabel = (value: string) => TEXT_TYPES.find((t) => t.value === value)?.label ?? '';

/** Was über einem Text steht: Art, Datum, Anlass, Ort, Lesungen. */
function metaLine(d: LibEntry['data']): string {
  const meta = [typeLabel(str(d, 'textType')), str(d, 'date'), str(d, 'occasion'), str(d, 'place')].filter((s) => s.trim() !== '');
  const readings = str(d, 'readings');
  return [
    meta.length > 0 ? `\\noindent\\textsc{${latexEscape(meta.join(' · '))}}` : '',
    readings !== '' ? `\\par\\noindent Czytania: ${latexEscape(readings)}` : ''
  ].filter(Boolean).join('\n');
}

/** Ein Text im Körper — für einen eigenen Artikel oder als Kapitel eines Buches. */
function textBody(entry: LibEntry, ctx: Ctx, depth: 0 | 1): string {
  const d = entry.data;
  const body = blocks(parseMarkup(str(d, 'body')), ctx, depth);
  const further = str(d, 'further').trim() === '' ? ''
    : `\n\n${depth === 0 ? '\\section*' : '\\subsection*'}{Dalsze informacje}\n${blocks(parseMarkup(str(d, 'further')), ctx, depth)}`;
  return `${body}${further}`;
}

function sources(ctx: Ctx, heading: string): string {
  const list = bibliography(ctx.works, ctx.look);
  if (list.length === 0) return '';
  return [
    heading,
    '\\begin{itemize}[label={},leftmargin=1.5em,itemindent=-1.5em]',
    ...list.map(({ work, segs }) => {
      const note = str(work.data, 'description');
      return `  \\item ${segsLatex(segs)}.${note === '' ? '' : ` ${latexEscape(note)}`}`;
    }),
    '\\end{itemize}'
  ].join('\n');
}

/** EIN TEXT als vollständiges Dokument. */
export function textToLatex(entry: LibEntry, look: Lookup, options: { author?: string } = {}): string {
  const d = entry.data;
  const ctx: Ctx = { look, state: newCiteState(), works: [] };
  const project = look.get(ids(d, 'project')[0] ?? '');
  const body = textBody(entry, ctx, 0);

  return [
    PREAMBLE('article'),
    '',
    `\\title{${latexEscape(str(d, 'title') || 'Bez tytułu')}${str(d, 'subtitle') === '' ? '' : `\\\\\\large ${latexEscape(str(d, 'subtitle'))}`}}`,
    `\\author{${latexEscape(options.author ?? '')}}`,
    `\\date{${latexEscape(str(d, 'date'))}}`,
    '',
    '\\begin{document}',
    '\\maketitle',
    project !== undefined ? `\\begin{center}\\emph{${latexEscape(str(project.data, 'title'))}}\\end{center}` : '',
    metaLine(d),
    '',
    body,
    '',
    sources(ctx, '\\section*{Źródła}'),
    '\\end{document}',
    ''
  ].filter((line, i, all) => !(line === '' && all[i - 1] === '')).join('\n');
}

/**
 * EIN PROJEKT als Buch: Teile aus den Überschriften des Plans, Kapitel aus
 * den Texten in seiner Reihenfolge. Die Fussnoten zählen über das ganze Buch
 * („dz. cyt." gilt ab der ersten vollen Angabe im Buch), die Quellen stehen
 * einmal am Ende. `only`: nur diese Texte (etwa die veröffentlichten).
 */
export function projectToLatex(project: LibEntry, look: Lookup, options: { author?: string; only?: (text: LibEntry) => boolean } = {}): string {
  const d = project.data;
  const ctx: Ctx = { look, state: newCiteState(), works: [] };
  const parts: string[] = [];

  for (const item of outline(d)) {
    if ('heading' in item) {
      parts.push(`\\part*{${latexEscape(item.heading)}}\n\\addcontentsline{toc}{part}{${latexEscape(item.heading)}}`);
      continue;
    }
    const text = look.get(item.text) ?? look.byKey(item.text.replace(/^@/, ''));
    if (text === undefined || text.kind !== 'text' || (options.only !== undefined && !options.only(text))) continue;
    const title = str(text.data, 'title') || 'Bez tytułu';
    parts.push([
      `\\chapter*{${latexEscape(title)}}`,
      `\\addcontentsline{toc}{chapter}{${latexEscape(title)}}`,
      str(text.data, 'subtitle') === '' ? '' : `\\noindent\\emph{${latexEscape(str(text.data, 'subtitle'))}}\\par\\medskip`,
      metaLine(text.data),
      '',
      textBody(text, ctx, 0)
    ].filter((s) => s !== '').join('\n'));
  }

  return [
    PREAMBLE('book'),
    '',
    `\\title{${latexEscape(str(d, 'title') || 'Projekt')}${str(d, 'subtitle') === '' ? '' : `\\\\\\large ${latexEscape(str(d, 'subtitle'))}`}}`,
    `\\author{${latexEscape(options.author ?? '')}}`,
    '\\date{}',
    '',
    '\\begin{document}',
    '\\maketitle',
    str(d, 'description') === '' ? '' : `\\begin{abstract}\n${latexEscape(str(d, 'description'))}\n\\end{abstract}`,
    '\\tableofcontents',
    '',
    parts.join('\n\n'),
    '',
    sources(ctx, '\\chapter*{Źródła}\n\\addcontentsline{toc}{chapter}{Źródła}'),
    '\\end{document}',
    ''
  ].filter((line, i, all) => !(line === '' && all[i - 1] === '')).join('\n');
}

/** Der Dateiname: der Titel als ASCII. */
export function latexFileName(entry: LibEntry): string {
  const base = (str(entry.data, 'title') || entry.kind).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `${base || 'tekst'}.tex`;
}

/** Die Schlüssel, die ein Text nennt, aber die Bibliothek nicht hat — vor dem Export zu sagen. */
export function missingKeys(entry: LibEntry, look: Lookup): string[] {
  const missing = new Set<string>();
  for (const field of ['body', 'further']) {
    walkBlocks(parseMarkup(str(entry.data, field)),
      (b) => { if (b.t === 'embed' && look.byKey(b.key) === undefined) missing.add(b.key); },
      (i) => { if (i.t === 'cite') for (const item of i.items) if (look.byKey(item.key) === undefined) missing.add(item.key); });
  }
  return [...missing];
}
