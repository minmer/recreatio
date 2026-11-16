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
 *   $x^2$   $$\int_0^1 f$$     2026-11-01: ein Wzór (LaTeX) im Satz, für sich
 *   | a | b |                  2026-11-16: eine Tabelle (Zeilen mit „|"; eine zweite Zeile „|---|" macht die erste zum Kopf)
 *   ```chart … ```             2026-11-16: eine Grafik (chart, plot, diagram, tree, timeline — `visual.ts`); ein anderer
 *                              Zaun (```python) ist Code
 * </code>
 *
 * Die Verweise sind die von Pandoc (`[@schlüssel, Stelle]`) — wer seinen
 * Text einmal mit anderen Werkzeugen weiterbearbeitet, muss sie nicht
 * umschreiben. Ein `\` vor einem Zeichen nimmt ihm seine Bedeutung.
 *
 * Hier wird nur gelesen; gezeichnet wird in `LibraryText.tsx`, formatiert in
 * `libraryCite.ts`. So lässt sich der Zapis ohne Browser prüfen.
 */

import { mathAt, texPlain } from '../core/tex';
import { visualKindOf, visualPlain } from './visual';
import { t } from '../core/i18n';

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
  /** 2026-10-22 — `[[Wort|@token]]`: ein Verweis mit eigenem Wortlaut (aus den Bazy wiedzy) — ein Link, nie eine Fussnote. */
  /** 2026-11-15 — `[[Wort|@token|intro]]`: dazu WIE es hier vorkommt (das Werk, `scriptorium/work/workMarks.ts`): intro, def, ex, use, recall. */
  | { readonly t: 'ref'; readonly key: string; readonly c: readonly Inline[]; readonly mark?: string }
  /** 2026-11-01 — ein Wzór: `$x^2$` im Satz, `$$…$$` für sich (LaTeX, Pandocs Regel — `core/tex.ts`). */
  | { readonly t: 'math'; readonly tex: string; readonly display: boolean }
  | { readonly t: 'br' };

export type Block =
  | { readonly t: 'p'; readonly c: readonly Inline[] }
  | { readonly t: 'h'; readonly level: 2 | 3 | 4; readonly c: readonly Inline[] }
  | { readonly t: 'quote'; readonly c: readonly Block[] }
  | { readonly t: 'list'; readonly ordered: boolean; readonly items: readonly (readonly Inline[])[] }
  | { readonly t: 'embed'; readonly key: string; readonly locator: string }
  | { readonly t: 'hr' }
  /** 2026-11-05 (Prompt 23, D10) — zum Aufklappen (ein langer Beweis): `::: details Beweisidee` … `:::`. */
  | { readonly t: 'details'; readonly summary: readonly Inline[]; readonly c: readonly Block[] }
  /**
   * 2026-11-16 — ein umzäunter Block: `lang` nach den Backticks, `info` der Rest der Zeile, `body` unverändert. Eine Grafik
   * (`visual.ts`: chart, plot, diagram, tree, timeline, auch ihre polnischen Namen) oder Code.
   */
  | { readonly t: 'fence'; readonly lang: string; readonly info: string; readonly body: string }
  /** 2026-11-16 — eine Tabelle: Kopf (wenn die zweite Zeile „|---|" ist), Zeilen, Ausrichtung je Spalte. */
  | { readonly t: 'table'; readonly head: readonly (readonly Inline[])[] | null; readonly rows: readonly (readonly (readonly Inline[])[])[]; readonly align: readonly ('left' | 'center' | 'right' | null)[] };

const KEY = '[A-Za-z0-9][A-Za-z0-9_.:-]*';
const EMBED = new RegExp(`^!\\[@(${KEY})(?:\\s*,\\s*([^\\]]*))?\\]\\s*$`);
const CITE_ITEM = new RegExp(`^@(${KEY})(?:\\s*,\\s*(.*))?$`, 's');

/**
 * Eine Adresse, die ein Link sein darf — keine `javascript:`, keine Daten.
 * 2026-10-22: dieselbe Regel für alle Texte (Bibliothek, Bazy wiedzy, die
 * Bausteine einer Seite): ins Netz (`www.` wird `https://`), eine Seite hier
 * (`#/…`, auch `/#/…`), ein Pfad, eine E-Mail, ein Telefon.
 */
export function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^www\.[^\s<>"]+$/i.test(h)) return `https://${h}`;
  if (/^tel:\+?[0-9 ()-]{3,}$/i.test(h)) return h.replace(/\s+/g, '');
  if (/^\/#/.test(h) && !/[\s<>"]/.test(h)) return h.slice(1);
  if (/^(https?:\/\/|mailto:|#|\/(?!\/))/i.test(h) && !/[\s<>"]/.test(h)) return h;
  return null;
}

/**
 * Was an Stelle eines Verweises steht, den dieser Leser nicht öffnen kann —
 * nie etwas über das Ziel (2026-10-22 aus `comment.ts` hierher: jeder Text,
 * der Verweise zeigt, sagt dasselbe).
 */
/** 2026-11-09 — dasselbe in der Sprache der App. */
export const unreadable = (): string => t('library.markup.unreadable');

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
    /* 2026-11-01 — ein Wzór: was zwischen den Dollarzeichen steht, ist LaTeX, kein Zapis (auch über Zeilen, `$$…$$`). */
    if (c === '$') {
      const m = mathAt(text, i);
      if (m !== null) { flush(); out.push({ t: 'math', tex: m.tex, display: m.display }); i = m.end - 1; continue; }
    }
    if (c === '\n') { flush(); out.push({ t: 'br' }); continue; }

    /* Ein Verweis mit eigenem Wortlaut: [[Wort|@token]] */
    if (c === '[' && text[i + 1] === '[') {
      const end = text.indexOf(']]', i + 2);
      const inside = end > i + 2 ? text.slice(i + 2, end) : '';
      /* 2026-11-05 (Prompt 24) — in eine andere Baza: [[Wort|@@historia:@historia/rewolucja]] (`cogita/worlds.ts`); das Ziel als ganzes Zeichen. */
      const cross = inside.indexOf('|@@');
      if (cross > 0 && CROSS_ONLY.test(inside.slice(cross + 1))) {
        flush();
        out.push({ t: 'ref', key: inside.slice(cross + 1), c: parseInline(inside.slice(0, cross)) });
        i = end + 1;
        continue;
      }
      /* 2026-11-14 — `[[słowo]]` ohne Ziel ist eine markierte Lücke (Karten „Luki w tekście“): beim Lesen nur das Wort. */
      if (inside !== '' && !inside.includes('|') && !inside.includes('[')) {
        flush();
        out.push(...parseInline(inside));
        i = end + 1;
        continue;
      }
      const bar = inside.lastIndexOf('|@');
      const marked = bar > 0 ? splitMark(inside.slice(bar + 2)) : null;
      if (bar > 0 && marked !== null) {
        flush();
        out.push({ t: 'ref', key: marked.token, c: parseInline(inside.slice(0, bar)), ...(marked.mark === undefined ? {} : { mark: marked.mark }) });
        i = end + 1;
        continue;
      }
    }

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
const FENCE = /^(`{3,}|~{3,})\s*([^\s`~]*)\s*(.*)$/;
/** `|---|:-:|--:|` — auch kurz (`:-:`); `| - |` allein ist keine Trennzeile. */
const TABLE_RULE = { test: (line: string): boolean => /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line) && /--|:-|-:/.test(line) };
/**
 * Die Zellen einer Zeile. Kein Trenner ist ein Strich in `[[Wort|@…]]`, in einem Wzór (`$|x|$`) und nach `\` (`\|`).
 */
function tableCells(line: string): string[] {
  const s = line.trim().replace(/^\|/, '');
  const cells: string[] = [];
  let cell = '';
  let link = 0;
  let math = false;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (c === '\\' && s[i + 1] === '|') { cell += '|'; i += 1; continue; }
    if (c === '\\' && i + 1 < s.length) { cell += c + s[i + 1]; i += 1; continue; }
    if (c === '[' && s[i + 1] === '[') { link += 1; cell += '[['; i += 1; continue; }
    if (c === ']' && s[i + 1] === ']' && link > 0) { link -= 1; cell += ']]'; i += 1; continue; }
    if (c === '$') math = !math;
    if (c === '|' && link === 0 && !math) { cells.push(cell.trim()); cell = ''; continue; }
    cell += c;
  }
  if (cell.trim() !== '' || cells.length === 0) cells.push(cell.trim());
  return cells;
}

/** 2026-11-16 — Zeilen mit „|" als Tabelle (mindestens zwei; eine zweite Zeile „|---|" macht die erste zum Kopf). */
function tableOf(lines: readonly string[]): Block {
  const ruled = lines.length >= 2 && TABLE_RULE.test(lines[1]);
  const align = ruled
    ? tableCells(lines[1]).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : null))
    : [];
  const body = (ruled ? lines.slice(2) : lines).filter((l) => !TABLE_RULE.test(l));
  return { t: 'table', head: ruled ? tableCells(lines[0]).map(parseInline) : null, rows: body.map((l) => tableCells(l).map(parseInline)), align };
}

export function parseMarkup(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] | null = null;
  /* 2026-11-05 (Prompt 23, D10) — ein Block zum Aufklappen, bis zu seinem `:::` (auch ineinander). */
  let fold: { summary: string; lines: string[]; depth: number } | null = null;
  /* 2026-11-16 — ein Zaun (Grafik oder Code) bis zu seinem schliessenden Zaun; dazwischen wird nichts gelesen. */
  let fence: { mark: string; lang: string; info: string; lines: string[] } | null = null;
  /* 2026-11-16 — die Zeilen einer Tabelle. */
  let table: string[] | null = null;

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
  const endTable = () => {
    if (table !== null) { if (table.length >= 2) blocks.push(tableOf(table)); else paragraph.push(...table); }
    table = null;
  };
  const endAll = () => { endTable(); endParagraph(); endList(); endQuote(); };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');

    if (fence !== null) {
      const close = line.trim();
      if (close.length >= fence.mark.length && close[0] === fence.mark[0] && close === close[0].repeat(close.length)) {
        blocks.push({ t: 'fence', lang: fence.lang, info: fence.info, body: fence.lines.join('\n') });
        fence = null;
      } else fence.lines.push(line);
      continue;
    }
    if (fold === null && quote === null) {
      const opens = FENCE.exec(line);
      if (opens !== null) {
        endAll();
        fence = { mark: opens[1], lang: opens[2].toLowerCase(), info: opens[3].trim(), lines: [] };
        continue;
      }
      if (line.trimStart().startsWith('|') && (table !== null || paragraph.length === 0)) {
        if (table === null) { endList(); table = []; }
        table.push(line.trim());
        continue;
      }
      if (table !== null) endTable();
    }

    if (fold !== null) {
      if (/^:::\s*details\b/.test(line.trim())) fold.depth += 1;
      else if (line.trim() === ':::') {
        if (fold.depth === 0) { blocks.push({ t: 'details', summary: parseInline(fold.summary), c: parseMarkup(fold.lines.join('\n')) }); fold = null; continue; }
        fold.depth -= 1;
      }
      fold.lines.push(raw);
      continue;
    }
    const opens = /^:::\s*details(?:\s+(.*))?$/.exec(line.trim());
    if (opens !== null) { endAll(); fold = { summary: (opens[1] ?? '').trim(), lines: [], depth: 0 }; continue; }

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
  /* Ein Zaun ohne Ende reicht bis zum Schluss des Textes (so sieht es aus, während man tippt). */
  if (fence !== null) { const f: { lang: string; info: string; lines: string[] } = fence; blocks.push({ t: 'fence', lang: f.lang, info: f.info, body: f.lines.join('\n') }); }
  if (fold !== null) { const f: { summary: string; lines: string[] } = fold; blocks.push({ t: 'details', summary: parseInline(f.summary), c: parseMarkup(f.lines.join('\n')) }); }
  return blocks;
}

/* -- Was ein Text nennt ---------------------------------------------------------------- */

export function walkInline(inlines: readonly Inline[], visit: (one: Inline) => void): void {
  for (const one of inlines) {
    visit(one);
    if (one.t === 'b' || one.t === 'i' || one.t === 'note' || one.t === 'link' || one.t === 'ref') walkInline(one.c, visit);
  }
}

export function walkBlocks(blocks: readonly Block[], onBlock: (b: Block) => void, onInline: (i: Inline) => void): void {
  for (const block of blocks) {
    onBlock(block);
    if (block.t === 'p' || block.t === 'h') walkInline(block.c, onInline);
    else if (block.t === 'list') block.items.forEach((item) => walkInline(item, onInline));
    else if (block.t === 'quote') walkBlocks(block.c, onBlock, onInline);
    else if (block.t === 'details') { walkInline(block.summary, onInline); walkBlocks(block.c, onBlock, onInline); }
    else if (block.t === 'table') for (const row of [...(block.head === null ? [] : [block.head]), ...block.rows]) for (const cell of row) walkInline(cell, onInline);
  }
}

/** Alle Verweise eines Textes (Kennungen oder Schlüssel) — Quellen, eingebettete Blöcke, Links `[[…|@…]]` — in der Reihenfolge. */
export function citedKeys(...sources: readonly string[]): string[] {
  const keys: string[] = [];
  for (const source of sources) {
    walkBlocks(parseMarkup(source),
      (b) => { if (b.t === 'embed') keys.push(b.key); },
      (i) => { if (i.t === 'cite') keys.push(...i.items.map((one) => one.key)); else if (i.t === 'ref') keys.push(i.key); });
  }
  return [...new Set(keys)];
}

/**
 * 2026-10-22 — DIE VERWEISE EINES TEXTES MIT IHREN STELLEN (`[@bt, Dz 1,14]`,
 * `![@q, s. 3]`, `[[Wort|@x]]` ohne Stelle), in der Reihenfolge, jeder
 * einmal — für das Verzeichnis der Verweise und die Suche nach einer Stelle.
 */
export function markupRefs(source: string): { readonly key: string; readonly locator: string }[] {
  const out = new Map<string, { key: string; locator: string }>();
  const add = (key: string, locator: string) => { const id = `${key}\u0000${locator}`; if (!out.has(id)) out.set(id, { key, locator }); };
  walkBlocks(parseMarkup(source),
    (b) => { if (b.t === 'embed') add(b.key, b.locator); },
    (i) => { if (i.t === 'cite') for (const one of i.items) add(one.key, one.locator); else if (i.t === 'ref') add(i.key, ''); });
  return [...out.values()];
}

/* -- 2026-10-22: Verweise umschreiben ------------------------------------------------------- */

const TOKEN_ONLY = new RegExp(`^${KEY}$`);
/** 2026-11-15 — die Rollen eines Vorkommens im Werk, als Anhang an einen Link: `[[Anna|@anna|intro]]`. */
export const MARK_WORDS: readonly string[] = ['intro', 'def', 'ex', 'use', 'recall'];
/** Ein Ziel mit oder ohne Rolle: "anna" → { token }, "anna|intro" → { token, mark }; sonst `null`. */
export function splitMark(raw: string): { token: string; mark?: string } | null {
  const bar = raw.indexOf('|');
  const token = bar < 0 ? raw : raw.slice(0, bar);
  const mark = bar < 0 ? undefined : raw.slice(bar + 1);
  if (!TOKEN_ONLY.test(token)) return null;
  if (mark !== undefined && !MARK_WORDS.includes(mark)) return null;
  return mark === undefined ? { token } : { token, mark };
}
/** 2026-11-05 (Prompt 24) — ein Verweis in eine andere Baza: "@@name:@bleibender/name" oder "@@name:kennung" (der Schlüssel des `ref` beginnt mit "@@"). */
const CROSS_ONLY = /^@@[a-z0-9][a-z0-9_-]{0,39}:@?[A-Za-z0-9][A-Za-z0-9_.:/-]*$/i;
const ITEM_TOKEN = new RegExp(`(^|;)(\\s*)@(${KEY})`, 'g');

/**
 * DIE VERWEISE EINES ZAPIS UMSCHREIBEN — und sonst nichts. In Quellen
 * `[@a, s. 3; @b]`, eingebetteten Blöcken `![@a]` und Links der Bazy wiedzy
 * `[[Wort|@a]]` wird jedes `@token` durch `map(token)` ersetzt; jedes andere
 * Zeichen bleibt, wie es war (auch Escapes, Zeilenwenden, Leerzeichen).
 *
 * Damit wechselt der gespeicherte Text zwischen seinen zwei Formen: im
 * Speicher stehen Kennungen (ein Schlüssel kann sich ändern, eine Kennung
 * nicht), im Editor und im JSON die Schlüssel (`storedMarkup` / `shownMarkup`
 * in `libraryKinds.ts`).
 */
export function mapRefTokens(source: string, map: (token: string) => string): string {
  const edits: { at: number; length: number; to: string }[] = [];
  for (let i = 0; i < source.length; i += 1) {
    const c = source[i];
    if (c === '\\') { i += 1; continue; }
    if (c !== '[') continue;

    /* Ein Link der Bazy wiedzy: [[Wort|@token]] */
    if (source[i + 1] === '[') {
      const end = source.indexOf(']]', i + 2);
      if (end > i + 2) {
        const inside = source.slice(i + 2, end);
        const bar = inside.lastIndexOf('|@');
        const token = bar < 0 ? '' : splitMark(inside.slice(bar + 2))?.token ?? '';
        if (bar >= 0 && TOKEN_ONLY.test(token)) {
          const to = map(token);
          if (to !== token) edits.push({ at: i + 2 + bar + 2, length: token.length, to });
        }
        i = end + 1;
        continue;
      }
    }

    /* Eine Quelle oder ein Block: [@a, Stelle; @b] — und ![@a] (das `!` steht davor). */
    const end = closing(source, i, '[', ']');
    if (end < 0) continue;
    const inside = source.slice(i + 1, end);
    if (!inside.startsWith('@') || citeItems(inside) === null) continue;
    ITEM_TOKEN.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = ITEM_TOKEN.exec(inside)) !== null) {
      const token = m[3];
      const to = map(token);
      if (to !== token) edits.push({ at: i + 1 + m.index + m[1].length + m[2].length + 1, length: token.length, to });
    }
  }
  let out = source;
  for (const e of edits.sort((a, b) => b.at - a.at)) out = out.slice(0, e.at) + e.to + out.slice(e.at + e.length);
  return out;
}

/**
 * 2026-11-01 — WAS AUS EINEM WZÓR IM SCHLICHTEN TEXT WIRD: `plain` eine Zeile ohne LaTeX (Suche, Auszüge, Etiketten
 * ohne KaTeX); `keep` der Wzór, wie er war (`$…$`, `$$…$$`), und ein Dollar im Text als `\$` — so setzt ihn `TexText`
 * später; `inline` dasselbe, aber jeder Wzór im Satz (`$…$`) — für Zeilen in Listen.
 */
export type TexMode = 'plain' | 'keep' | 'inline';

/** Der Text ohne Zeichen — für Auszüge und die Suche. `headings: false` — nur, was man liest (für den Anfang eines Textes). */
export function plainText(source: string, headings = true, tex: TexMode = 'plain'): string {
  const parts: string[] = [];
  const mathOf = (one: { readonly tex: string; readonly display: boolean }): string =>
    tex === 'plain' ? texPlain(one.tex) : one.display && tex === 'keep' ? `$$${one.tex}$$` : `$${one.tex.replace(/\s+/g, ' ').trim()}$`;
  const textOf = (v: string): string => (tex === 'plain' ? v : v.replace(/\$/g, '\\$'));
  const inline = (list: readonly Inline[]): string => list.map((one) =>
    one.t === 'text' ? textOf(one.v) : one.t === 'br' ? ' ' : one.t === 'cite' || one.t === 'note' ? '' : one.t === 'math' ? mathOf(one) : inline(one.c)).join('');
  const blocks = (list: readonly Block[]) => {
    for (const b of list) {
      if (b.t === 'p' || (b.t === 'h' && headings)) parts.push(inline(b.c));
      else if (b.t === 'list') parts.push(...b.items.map(inline));
      else if (b.t === 'quote') blocks(b.c);
      else if (b.t === 'details') { parts.push(inline(b.summary)); blocks(b.c); }
      /* 2026-11-16 — eine Tabelle Zeile für Zeile; eine Grafik als ihr Inhalt in Worten; Code, wie er ist. */
      else if (b.t === 'table') { for (const row of [...(b.head === null ? [] : [b.head]), ...b.rows]) parts.push(row.map(inline).join(' | ')); }
      else if (b.t === 'fence') parts.push(visualKindOf(b.lang) !== null ? visualPlain(b.lang, b.info, b.body) : b.body);
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
