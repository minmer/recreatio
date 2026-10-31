/**
 * 2026-10-31 — DER TEXT EINES THEMAS ZUM LESEN (`EntityReading.tsx`): Absätze, fette Zwischentitel, Listen und
 * Fussnoten, wie auf der Seite des Eintrags — nie ein einziger Block. Hier nur die Rechnung, ohne React
 * (geprüft in `app-cogita-check.mjs`).
 *
 * <code>
 *   readingSource   eine Liste gleich unter einer Zeile beginnt doch eine Liste („**Wydarzenia**\n- …", wie in
 *                   Markdown) — sonst stünden ihre Punkte als Zeilen im Absatz darüber
 *   headingOf       ein Zwischentitel: `## …` oder ein Absatz nur aus Fettem („**Wydarzenia**", auch mit „:")
 *   leadAt          der erste Absatz, der kein Zwischentitel ist — der Anriss vor „Czytaj dalej"
 *   readingParts    Listen unter einem Zwischentitel klappen zu, der Titel ist der Knopf (ein Satz mit „:" davor
 *                   gehört dazu); alles andere bleibt, wie es ist
 *   citedPlaces     die Quellen des Textes mit ihrer Stelle, in der Reihenfolge — wohin „Czytaj tekst" führt
 *   formatReading   der Text eines Eintrags nach dem Wzór seines Rodzaju (`KindDef.reading`)
 * </code>
 */

import { blocksIn, blocksMarkup } from '../library/blocks';
import { parseMarkup, type Block, type CiteItem, type Inline } from '../library/libraryMarkup';
import { fieldsOf, fieldText, kindsOf, labelOf, valuesOf, type Entity, type FieldDef, type Lookup } from './schema';

/* Wie `parseMarkup` die Zeilen liest (libraryMarkup.ts) — nur so weit, wie es hier zählt. */
const ITEM = /^\s*([-*•]|(\d+)[.)])\s+\S/;
const HEADING = /^#{1,3}\s+\S/;
const RULE = /^\s*(-{3,}|\*{3,})\s*$/;
const EMBED = /^!\[@[^\]]+\]$/;
const INDENTED = /^\s{2,}\S/;
/** Eine Zeile nur aus Fettem (ein Stück, auch mit „:" danach) — ein Zwischentitel. */
const BOLD_LINE = /^\s*\*\*(?:(?!\*\*).)+\*\*\s*:?\s*$/;

/** Länger ist ein fetter Absatz kein Zwischentitel mehr, sondern ein betonter Satz. */
const HEAD_MAX = 100;

/**
 * Wie der Text eines Themas zu lesen ist, ehe `parseMarkup` ihn liest. Eine Liste, die gleich unter einer Zeile
 * beginnt, beginnt eine Liste (wie in Markdown: ein Punkt „- ", „* ", „• " unterbricht jeden Absatz, eine Nummer nur
 * als „1." — „1918. Wtedy…" bleibt Text); eine Zeile nur aus Fettem steht für sich (ein Zwischentitel, auch wenn der
 * Text gleich darunter weitergeht).
 */
export function readingSource(text: string): string {
  const out: string[] = [];
  let paragraph = false;
  let list = false;
  let quote = false;
  let afterHead = false;
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(/\s+$/, '');
    const wasHead = afterHead;
    afterHead = false;
    if (quote) {
      if (line.startsWith('>')) { out.push(raw); continue; }
      quote = false;
    }
    if (line.trim() === '') { paragraph = false; list = false; out.push(raw); continue; }
    if (line.startsWith('>')) { paragraph = false; list = false; quote = true; out.push(raw); continue; }
    if ((RULE.test(line) && !paragraph) || HEADING.test(line) || EMBED.test(line.trim())) { paragraph = false; list = false; out.push(raw); continue; }
    if (BOLD_LINE.test(line) && !(list && INDENTED.test(raw))) {
      if (paragraph || list) out.push('');
      paragraph = true;
      list = false;
      afterHead = true;
      out.push(raw);
      continue;
    }
    const item = ITEM.exec(line);
    if (item !== null && !paragraph) { list = true; out.push(raw); continue; }
    if (item !== null && (item[2] === undefined || Number(item[2]) === 1)) { out.push(''); paragraph = false; list = true; out.push(raw); continue; }
    if (list && INDENTED.test(raw)) { out.push(raw); continue; }
    if (wasHead) out.push('');
    list = false;
    paragraph = true;
    out.push(raw);
  }
  return out.join('\n');
}

/** Der Text ohne Zeichen und ohne Fussnoten, in einer Zeile. */
export function plainInlines(list: readonly Inline[]): string {
  const walk = (xs: readonly Inline[]): string => xs.map((x) =>
    x.t === 'text' ? x.v : x.t === 'br' ? ' ' : x.t === 'cite' || x.t === 'note' ? '' : walk(x.c)).join('');
  return walk(list).replace(/\s+/g, ' ').replace(/ +([.,;:!?])/g, '$1').trim();
}

/** Ohne den Doppelpunkt am Ende („**Wydarzenia:**" → Wydarzenia) — Fussnoten darin bleiben dieselben Objekte (ihre Nummern hängen daran). */
function withoutColon(list: readonly Inline[]): Inline[] {
  const last = list[list.length - 1];
  if (last === undefined) return [];
  if (last.t === 'text') {
    const v = last.v.replace(/\s*:\s*$/, '');
    return v === '' ? list.slice(0, -1) : [...list.slice(0, -1), { t: 'text', v }];
  }
  if (last.t === 'b' || last.t === 'i') return [...list.slice(0, -1), { t: last.t, c: withoutColon(last.c) }];
  return [...list];
}

/** Ein Zwischentitel — seine Worte (fett), sonst `null`. */
export function headingOf(block: Block): readonly Inline[] | null {
  if (block.t === 'h') return [{ t: 'b', c: withoutColon(block.c) }];
  if (block.t !== 'p') return null;
  const parts = block.c.filter((x) => x.t !== 'br' && !(x.t === 'text' && x.v.trim() === ''));
  const [first, second] = parts;
  if (first === undefined || first.t !== 'b' || parts.length > 2) return null;
  if (second !== undefined && !(second.t === 'text' && /^\s*:\s*$/.test(second.v))) return null;
  const words = plainInlines(first.c);
  if (words === '' || words.length > HEAD_MAX) return null;
  return [{ t: 'b', c: withoutColon(first.c) }];
}

/** Wo der Anriss steht: der erste Absatz, der kein Zwischentitel ist — `-1`: keiner (der Text ist nur Titel und Listen). */
export function leadAt(blocks: readonly Block[]): number {
  return blocks.findIndex((b) => b.t === 'p' && headingOf(b) === null);
}

export type ReadingPart =
  | { readonly t: 'block'; readonly block: Block }
  /** Zugeklappt: der Zwischentitel ist der Knopf, darunter (ein einleitender Satz und) die Listen; `items` Punkte. */
  | { readonly t: 'fold'; readonly head: readonly Inline[]; readonly body: readonly Block[]; readonly items: number };

const endsWithColon = (block: Block): boolean => block.t === 'p' && plainInlines(block.c).endsWith(':');

/** Der Text in Teilen: Listen unter ihrem Zwischentitel zugeklappt, alles andere, wie es ist. */
export function readingParts(blocks: readonly Block[]): ReadingPart[] {
  const out: ReadingPart[] = [];
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]!;
    const head = headingOf(block);
    if (head !== null) {
      let at = i + 1;
      const next = blocks[at];
      const intro = next !== undefined && headingOf(next) === null && endsWithColon(next) && blocks[at + 1]?.t === 'list' ? next : null;
      if (intro !== null) at += 1;
      const lists: Block[] = [];
      for (let b = blocks[at]; b !== undefined && b.t === 'list'; b = blocks[at]) { lists.push(b); at += 1; }
      if (lists.length > 0) {
        const items = lists.reduce((n, l) => n + (l.t === 'list' ? l.items.length : 0), 0);
        out.push({ t: 'fold', head, body: intro === null ? lists : [intro, ...lists], items });
        i = at - 1;
        continue;
      }
    }
    out.push({ t: 'block', block });
  }
  return out;
}

/** Was ein Text zuerst zeigt und ob danach noch etwas kommt. */
export function leadShape(text: string): { readonly lead: boolean; readonly more: boolean } {
  const blocks = parseMarkup(readingSource(text));
  const at = leadAt(blocks);
  return { lead: at >= 0, more: blocks.length > (at >= 0 ? 1 : 0) };
}

/** Der Anriss eines Textes ohne Zeichen — für eine Zeile (die Erklärung nach einer Antwort). */
export function leadPlain(text: string): string {
  const blocks = parseMarkup(readingSource(text));
  const at = leadAt(blocks);
  const block = at < 0 ? undefined : blocks[at];
  return block === undefined || block.t !== 'p' ? '' : plainInlines(block.c);
}

/** Jede Quelle des Textes mit ihrer Stelle (`[@dzielo, s. 12]`), in der Reihenfolge, auch in Listen und Zitaten. */
export function citedPlaces(blocks: readonly Block[]): CiteItem[] {
  const out: CiteItem[] = [];
  const inline = (xs: readonly Inline[]) => {
    for (const x of xs) {
      if (x.t === 'cite') out.push(...x.items);
      else if (x.t === 'b' || x.t === 'i' || x.t === 'link' || x.t === 'ref' || x.t === 'note') inline(x.c);
    }
  };
  const walk = (bs: readonly Block[]) => {
    for (const b of bs) {
      if (b.t === 'p' || b.t === 'h') inline(b.c);
      else if (b.t === 'list') b.items.forEach(inline);
      else if (b.t === 'quote') walk(b.c);
    }
  };
  walk(blocks);
  return out;
}

/* -- 2026-10-31: der Wzór eines Rodzaju (`KindDef.reading`) ------------------------------------------------------- */

const SLOT = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;
const SLOT_ALONE = /^\s*\{([A-Za-z][A-Za-z0-9_]*)\}\s*$/;

/** Schlichter Text in einem Zapis: seine Zeichen bedeuten dort nichts (`*`, `_`, `[`, `]`, `^`, `\`). */
const plainInMarkup = (text: string): string => text.replace(/([\\*_[\]^])/g, '\\$1');

/** Ein Name in einem Link `[[…|@…]]` — ohne die Zeichen, die ihn beenden. */
const linkWords = (text: string): string => text.replace(/\||\[|\]/g, ' ').replace(/\s+/g, ' ').trim();

/** Ein Feld an seiner Stelle im Wzór; `alone`: allein in seiner Zeile — dann darf es Absätze und Punkte bilden. */
function slotText(entity: Entity, field: FieldDef, look: Lookup, alone: boolean): string {
  const values = valuesOf(entity, field);
  const oneLine = (t: string) => (alone ? t : t.replace(/\s*\n\s*/g, ' '));
  switch (field.type) {
    case 'markup':
    case 'text': {
      const texts = values.map((v) => (typeof v.value === 'string' ? v.value.trim() : '')).filter((t) => t !== '');
      return oneLine((field.type === 'text' ? texts.map(plainInMarkup) : texts).join(alone ? '\n\n' : ' '));
    }
    case 'blocks':
      return oneLine(blocksMarkup(blocksIn(entity.data[field.key])).trim());
    case 'list': {
      const items = values.flatMap((v) => (Array.isArray(v.value) ? v.value : [v.value]))
        .map((x) => (typeof x === 'string' ? x.trim() : '')).filter((x) => x !== '').map(plainInMarkup);
      return alone ? items.map((x) => `- ${x}`).join('\n') : items.join(', ');
    }
    case 'ref':
      return values.map((v) => {
        if (typeof v.value !== 'string' || v.value === '') return '';
        /* Mit Stelle: eine Quelle wird eine Fussnote (mit „pokaż w tekście"), ein eigener Eintrag „(zob. …)". */
        const place = (v.locator ?? '').replace(/;/g, ',').replace(/\]/g, ')').trim();
        if (field.locator === true && place !== '') return `[@${v.value}, ${place}]`;
        const target = look.entity(v.value);
        const name = target === undefined ? '' : linkWords(labelOf(target, look));
        return name === '' ? '' : `[[${name}|@${v.value}]]`;
      }).filter((t) => t !== '').join(', ');
    case 'url':
      return values.map((v) => (typeof v.value === 'string' && /^https?:\/\/\S+$/i.test(v.value.trim()) ? `[${plainInMarkup(v.value.trim())}](${v.value.trim()})` : ''))
        .filter((t) => t !== '').join(', ');
    case 'media':
    case 'geo':
      return '';
    default:
      return plainInMarkup(fieldText(entity, field, look));
  }
}

/**
 * DER TEXT EINES EINTRAGS NACH DEM WZÓR SEINES RODZAJU: ein Zapis, in dem `{klucz}` der Wert des Feldes wird — ein
 * Zapis bleibt Zapis, Text bleibt Text, eine Liste allein in ihrer Zeile wird Punkte (unter einem fetten Titel also
 * zugeklappt), ein Verweis mit Stelle eine Fussnote, ein Verweis ein Link mit dem Namen, alles andere sein Text
 * (Datum, Zahl mit Einheit, Wahl). Ein Abschnitt bis zur Leerzeile, dessen Felder alle leer sind, fällt weg — samt
 * seinem Zwischentitel. Der erste Absatz ist der Anriss vor „Czytaj dalej".
 */
export function formatReading(pattern: string, entity: Entity, look: Lookup): string {
  const fields = new Map(fieldsOf(entity, look).map((f) => [f.key, f]));
  const out: string[] = [];
  for (const chunk of pattern.replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/)) {
    let slots = 0;
    let filled = 0;
    const lines: string[] = [];
    for (const line of chunk.split('\n')) {
      const alone = SLOT_ALONE.test(line);
      let here = 0;
      let full = 0;
      const text = line.replace(SLOT, (_all, key: string) => {
        here += 1;
        const field = fields.get(key);
        const value = field === undefined ? '' : slotText(entity, field, look, alone);
        if (value !== '') full += 1;
        return value;
      });
      slots += here;
      filled += full;
      /* Eine Zeile, deren Felder alle leer sind, fällt weg („Miejsce: {gdzie}"); eine halb leere verliert, was nun am Rand hängt. */
      if (here > 0 && full === 0) continue;
      lines.push(here > full ? tidyLine(text) : text.replace(/\s+$/, ''));
    }
    if (slots > 0 && filled === 0) continue;
    const text = lines.join('\n');
    if (text.trim() !== '') out.push(text);
  }
  return out.join('\n\n').trim();
}

/** Was in einer Zeile übrig bleibt, wenn ein Feld darin leer war: keine leeren Klammern, kein Trenner doppelt oder am Ende. */
function tidyLine(line: string): string {
  return line
    .replace(/\(\s*\)|\[\s*\]/g, '')
    .replace(/[ \t]+([,.;:)\]])/g, '$1')
    .replace(/([,;:·–—])([ \t]*[,;:·–—])+/g, '$1')
    .replace(/[ \t,;:·–—]+$/, '')
    .replace(/(\S)[ \t]{2,}/g, '$1 ');
}

/** Der Wzór, nach dem ein Eintrag gelesen wird: der seines ersten Rodzaju, der einen hat. */
export function readingPattern(entity: Entity, look: Pick<Lookup, 'kind'>): string | undefined {
  return kindsOf(entity, look).find((k) => (k.reading ?? '').trim() !== '')?.reading;
}

