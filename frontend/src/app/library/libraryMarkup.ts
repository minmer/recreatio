/**
 * DER ZAPIS EINES TEXTES (0064) — so einfach, dass man ihn tippt, ohne
 * nachzudenken, und so genau, dass jede Quelle ihren Platz findet.
 *
 * <code>
 *   ## Überschrift            (# oder ## — Zwischentitel, ### — kleiner)
 *   Absatz; eine einfache Zeilenwende bleibt eine Zeilenwende (Psalmen, Lieder).
 *   **fett**  *kursiv*  [Link](https://…)
 *   [@ratzinger2007, s. 23]   eine Quelle, mit Stelle — wird zur Fussnote
 *   [@bt, J 6,35; @ratzinger2007]   mehrere in einer Fussnote
 *   ^[eine eigene Fussnote]   ohne Quelle
 *   ![@zitat-schlüssel]       ein Zitat aus der Bibliothek als Block, mit Herkunft
 *   > eingerücktes Zitat
 *   - Punkt   ·   1. Punkt
 *   ---                        Trennlinie
 * </code>
 *
 * Die Verweise sind die von Pandoc (`[@schlüssel, Stelle]`) — wer seinen
 * Text einmal mit anderen Werkzeugen weiterbearbeitet, muss sie nicht
 * umschreiben. Ein `\` vor einem Zeichen nimmt ihm seine Bedeutung.
 *
 * Hier wird nur gelesen; gezeichnet wird in `LibraryText.tsx`, formatiert in
 * `libraryCite.ts`. So lässt sich der Zapis ohne Browser prüfen.
 */

export interface CiteItem {
  readonly key: string;
  readonly locator: string;
}

export type Inline =
  | { readonly t: 'text'; readonly v: string }
  | { readonly t: 'b' | 'i'; readonly c: readonly Inline[] }
  | { readonly t: 'cite'; readonly items: readonly CiteItem[] }
  | { readonly t: 'note'; readonly c: readonly Inline[] }
  | { readonly t: 'link'; readonly href: string; readonly c: readonly Inline[] }
  | { readonly t: 'br' };

export type Block =
  | { readonly t: 'p'; readonly c: readonly Inline[] }
  | { readonly t: 'h'; readonly level: 2 | 3 | 4; readonly c: readonly Inline[] }
  | { readonly t: 'quote'; readonly c: readonly Block[] }
  | { readonly t: 'list'; readonly ordered: boolean; readonly items: readonly (readonly Inline[])[] }
  | { readonly t: 'embed'; readonly key: string; readonly locator: string }
  | { readonly t: 'hr' };

const KEY = '[A-Za-z0-9][A-Za-z0-9_.:-]*';
const EMBED = new RegExp(`^!\\[@(${KEY})(?:\\s*,\\s*([^\\]]*))?\\]\\s*$`);
const CITE_ITEM = new RegExp(`^@(${KEY})(?:\\s*,\\s*(.*))?$`, 's');

/** Eine Adresse, die ein Link sein darf — keine `javascript:`, keine Daten. */
export function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^(https?:\/\/|mailto:|#|\/)/i.test(h) && !/[\s<>"]/.test(h)) return h;
  return null;
}

/* -- Inline ------------------------------------------------------------------------------- */

/** Wo die schliessende Klammer zu einer öffnenden steht — oder -1. Escapes zählen nicht. */
function closing(text: string, from: number, open: string, close: string): number {
  let depth = 0;
  for (let i = from; i < text.length; i += 1) {
    const c = text[i];
    if (c === '\\') { i += 1; continue; }
    if (c === open) depth += 1;
    else if (c === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function citeItems(inside: string): CiteItem[] | null {
  const parts = inside.split(';').map((p) => p.trim()).filter((p) => p !== '');
  if (parts.length === 0) return null;
  const items: CiteItem[] = [];
  for (const part of parts) {
    const m = CITE_ITEM.exec(part);
    if (m === null) return null;
    items.push({ key: m[1], locator: (m[2] ?? '').trim() });
  }
  return items;
}

const wordChar = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c);

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let buffer = '';
  const flush = () => { if (buffer !== '') { out.push({ t: 'text', v: buffer }); buffer = ''; } };
  /* Die Fussnotenziffer steht am Wort, nicht nach einem Leerzeichen: „życia”¹, nicht „życia” ¹. */
  const attach = () => { buffer = buffer.replace(/[ \t]+$/, ''); flush(); };

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];

    if (c === '\\' && i + 1 < text.length) { buffer += text[i + 1]; i += 1; continue; }
    if (c === '\n') { flush(); out.push({ t: 'br' }); continue; }

    /* Fussnote ohne Quelle: ^[…] */
    if (c === '^' && text[i + 1] === '[') {
      const end = closing(text, i + 1, '[', ']');
      if (end > i + 1) {
        attach();
        out.push({ t: 'note', c: parseInline(text.slice(i + 2, end)) });
        i = end;
        continue;
      }
    }

    if (c === '[') {
      const end = closing(text, i, '[', ']');
      if (end > i) {
        const inside = text.slice(i + 1, end);
        /* Quelle(n): [@schlüssel, Stelle; @andere] */
        if (inside.startsWith('@')) {
          const items = citeItems(inside);
          if (items !== null) { attach(); out.push({ t: 'cite', items }); i = end; continue; }
        }
        /* Link: [Text](adresse) */
        if (text[end + 1] === '(') {
          const close = closing(text, end + 1, '(', ')');
          const href = close > end ? safeHref(text.slice(end + 2, close)) : null;
          if (href !== null) { flush(); out.push({ t: 'link', href, c: parseInline(inside) }); i = close; continue; }
        }
      }
    }

    /* **fett** */
    if (c === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2);
      if (end > i + 2) { flush(); out.push({ t: 'b', c: parseInline(text.slice(i + 2, end)) }); i = end + 1; continue; }
    }

    /* *kursiv* — und _kursiv_, aber nicht mitten im Wort (schlüssel_name bleibt, was es ist). */
    if ((c === '*' || (c === '_' && !wordChar(text[i - 1]))) && text[i + 1] !== undefined && text[i + 1] !== ' ') {
      let end = i + 1;
      while ((end = text.indexOf(c, end)) !== -1 && (text[end - 1] === ' ' || (c === '_' && wordChar(text[end + 1])))) end += 1;
      if (end > i + 1) { flush(); out.push({ t: 'i', c: parseInline(text.slice(i + 1, end)) }); i = end; continue; }
    }

    buffer += c;
  }

  flush();
  return out;
}

/* -- Blöcke ------------------------------------------------------------------------------- */

const LIST_ITEM = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/;

export function parseMarkup(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] | null = null;

  const endParagraph = () => {
    if (paragraph.length > 0) blocks.push({ t: 'p', c: parseInline(paragraph.join('\n').trim()) });
    paragraph = [];
  };
  const endList = () => {
    if (list !== null) blocks.push({ t: 'list', ordered: list.ordered, items: list.items.map((one) => parseInline(one.trim())) });
    list = null;
  };
  const endQuote = () => {
    if (quote !== null) blocks.push({ t: 'quote', c: parseMarkup(quote.join('\n')) });
    quote = null;
  };
  const endAll = () => { endParagraph(); endList(); endQuote(); };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');

    if (quote !== null) {
      if (line.startsWith('>')) { quote.push(line.replace(/^>\s?/, '')); continue; }
      endQuote();
    }

    if (line.trim() === '') { endParagraph(); endList(); continue; }

    if (line.startsWith('>')) { endParagraph(); endList(); quote = [line.replace(/^>\s?/, '')]; continue; }

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line) && paragraph.length === 0) { endAll(); blocks.push({ t: 'hr' }); continue; }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading !== null) {
      endAll();
      blocks.push({ t: 'h', level: heading[1].length >= 3 ? 3 : 2, c: parseInline(heading[2].trim()) });
      continue;
    }

    const embed = EMBED.exec(line.trim());
    if (embed !== null) {
      endAll();
      blocks.push({ t: 'embed', key: embed[1], locator: (embed[2] ?? '').trim() });
      continue;
    }

    const item = LIST_ITEM.exec(line);
    if (item !== null && paragraph.length === 0) {
      const ordered = /\d/.test(item[2]);
      if (list !== null && list.ordered !== ordered) endList();
      if (list === null) list = { ordered, items: [] };
      list.items.push(item[3]);
      continue;
    }

    /* Eine eingerückte Zeile unter einem Punkt gehört zu ihm. */
    if (list !== null && /^\s{2,}\S/.test(raw)) {
      list.items[list.items.length - 1] += `\n${line.trim()}`;
      continue;
    }

    endList();
    paragraph.push(line);
  }

  endAll();
  return blocks;
}

/* -- Was ein Text nennt ---------------------------------------------------------------- */

function walkInline(inlines: readonly Inline[], visit: (one: Inline) => void): void {
  for (const one of inlines) {
    visit(one);
    if (one.t === 'b' || one.t === 'i' || one.t === 'note' || one.t === 'link') walkInline(one.c, visit);
  }
}

export function walkBlocks(blocks: readonly Block[], onBlock: (b: Block) => void, onInline: (i: Inline) => void): void {
  for (const block of blocks) {
    onBlock(block);
    if (block.t === 'p' || block.t === 'h') walkInline(block.c, onInline);
    else if (block.t === 'list') block.items.forEach((item) => walkInline(item, onInline));
    else if (block.t === 'quote') walkBlocks(block.c, onBlock, onInline);
  }
}

/** Alle Schlüssel, die ein Text nennt — als Quelle oder als eingebettetes Zitat, in der Reihenfolge. */
export function citedKeys(...sources: readonly string[]): string[] {
  const keys: string[] = [];
  for (const source of sources) {
    walkBlocks(parseMarkup(source),
      (b) => { if (b.t === 'embed') keys.push(b.key); },
      (i) => { if (i.t === 'cite') keys.push(...i.items.map((one) => one.key)); });
  }
  return [...new Set(keys)];
}

/** Der Text ohne Zeichen — für Auszüge und die Suche. `headings: false` — nur, was man liest (für den Anfang eines Textes). */
export function plainText(source: string, headings = true): string {
  const parts: string[] = [];
  const inline = (list: readonly Inline[]): string => list.map((one) =>
    one.t === 'text' ? one.v : one.t === 'br' ? ' ' : one.t === 'cite' || one.t === 'note' ? '' : inline(one.c)).join('');
  const blocks = (list: readonly Block[]) => {
    for (const b of list) {
      if (b.t === 'p' || (b.t === 'h' && headings)) parts.push(inline(b.c));
      else if (b.t === 'list') parts.push(...b.items.map(inline));
      else if (b.t === 'quote') blocks(b.c);
    }
  };
  blocks(parseMarkup(source));
  return parts.join('\n').replace(/[ \t]+/g, ' ').replace(/ +([.,;:!?])/g, '$1').trim();
}

/** Der Anfang eines Textes, bis zu `length` Zeichen, an einer Wortgrenze. */
export function excerpt(source: string, length = 300): string {
  const plain = plainText(source, false).replace(/\s+/g, ' ');
  if (plain.length <= length) return plain;
  const cut = plain.slice(0, length);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), length - 30)).trimEnd()}…`;
}
