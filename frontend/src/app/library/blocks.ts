/**
 * TREŚĆ W BLOKACH (2026-10-22; seit 2026-10-23 ein Feldtyp, `blocks`) — was
 * ein Eintrag sagt, in vier Formen, und die Form trägt Bedeutung:
 *
 * <code>
 *   paragraph   Prosa (im Zapis: Fussnoten, Verweise, eingebettete Zitate)
 *   ordered     die Reihenfolge zählt (ein Gedankengang)
 *   unordered   gleichrangige Punkte
 *   table       ein Vergleich: benannte Spalten, jede Zeile vergleicht dasselbe
 * </code>
 *
 * <b>Struktur, nicht Text.</b> Eine Zelle (und ein Listenpunkt) ist eine
 * Folge von Stücken: Zapis (`{ text }`) oder ein echter Verweis
 * (`{ ref, locator }`). Eine Zeile, die Łk 1,35 neben Dz 1,8 stellt, ist so
 * ein Datum — kein Text, der wie ein Verweis aussieht.
 *
 * <b>2026-10-23 — DREI TEILE.</b> Den Komentarz der Bibliothek gibt es nicht
 * mehr. Was er war, ist jetzt ein Rodzaj in Nauka mit einem Feld vom Typ
 * `blocks` (die Vorlage `templates/cogita/komentarz.json`: „O czym" und
 * „Treść"). JEDER Eintrag, dessen Rodzaj ein solches Feld hat, ist eine
 * AUSSAGE — gerechnet, nicht gespeichert:
 *
 * <code>
 *   Teza          der erste Satz des ersten Absatzes des ersten Feldes `blocks`;
 *                 fehlt er oder ist er länger als 200 Zeichen, steht es unter „Do zrobienia"
 *   Pytanie       eine Aussage, deren Teza mit „?" endet; beantwortet, sobald eine
 *                 andere Aussage auf sie zeigt (`statement.ts`)
 *   Informacja /  allein aus den Verweisen (`statement.ts`): zitiert sie nur Quellen
 *   Interpretacja der Bibliothek, ist sie eine Informacja; zeigt sie auf eine andere
 *                 Aussage (oder auf keine Quelle), eine Interpretacja. Eine Tabelle
 *                 allein macht nichts zur Deutung (2026-10-23).
 * </code>
 *
 * Diese Datei liest nichts aus `libraryKinds.ts` (die Arten lesen von hier).
 * Wo ein Eintrag seine Bausteine trägt, sagt sein Rodzaj: `blocksKeyOf`
 * fragt den Eintrag des Rodzaj (`kind`) in derselben Sicht — so gelingt es
 * auf einer Seite wie im Arbeitsbereich, ohne das Schema von Nauka zu laden.
 */

import { citedKeys, plainText } from './libraryMarkup';

export type Run = { readonly text: string } | { readonly ref: string; readonly locator?: string };
export type Cell = readonly Run[];

export type CommentBlock =
  | { readonly type: 'paragraph'; readonly text: string }
  | { readonly type: 'ordered' | 'unordered'; readonly items: readonly Cell[] }
  | { readonly type: 'table'; readonly columns: readonly string[]; readonly rows: readonly (readonly Cell[])[] };

export const BLOCK_TYPES = [
  { value: 'paragraph', label: 'Akapit' },
  { value: 'ordered', label: 'Lista numerowana' },
  { value: 'unordered', label: 'Lista punktów' },
  { value: 'table', label: 'Tabela' }
] as const;

const rec = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
const line = (value: unknown): string => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');

/* -- Lesen, duldsam ---------------------------------------------------------------------- */

/** Ein Stück: Text oder Verweis — ein blosser String ist Text. `keep`: auch ein leeres (der Editor tippt gerade). */
function runOf(value: unknown, keep = false): Run | null {
  if (typeof value === 'string') return value === '' && !keep ? null : { text: value };
  const r = rec(value);
  if (r === null) return null;
  const ref = line(r.ref).trim();
  if (ref !== '') {
    const locator = line(r.locator).trim();
    return locator === '' ? { ref } : { ref, locator };
  }
  const text = line(r.text);
  return text === '' && !keep ? null : { text };
}

/** Eine Zelle: ein String, ein Stück, eine Liste von Stücken. */
export function cellOf(value: unknown, keep = false): Run[] {
  if (Array.isArray(value)) return value.map((one) => runOf(one, keep)).filter((r): r is Run => r !== null);
  const one = runOf(value, keep);
  return one === null ? [] : [one];
}

/** Ein Baustein — duldsam; `keep`: auch leere (ein neuer Absatz, eine Tabelle ohne Zeilen — der Editor). */
export function blockOf(value: unknown, keep = false): CommentBlock | null {
  const r = rec(value);
  if (r === null) return typeof value === 'string' && value.trim() !== '' ? { type: 'paragraph', text: value } : null;
  const type = line(r.type);
  const cell = (one: unknown) => cellOf(one, keep);
  if (type === 'paragraph') {
    const text = line(r.text);
    return text.trim() === '' && !keep ? null : { type, text };
  }
  if (type === 'ordered' || type === 'unordered') {
    const items = (Array.isArray(r.items) ? r.items : []).map(cell);
    return items.length === 0 && !keep ? null : { type, items };
  }
  if (type === 'table') {
    const columns = (Array.isArray(r.columns) ? r.columns : []).map(line);
    const rows = (Array.isArray(r.rows) ? r.rows : []).map((row) => (Array.isArray(row) ? row.map(cell) : [cell(row)]));
    return columns.length === 0 && rows.length === 0 && !keep ? null : { type, columns, rows };
  }
  return null;
}

/** Die Bausteine eines Wertes (die Liste eines Feldes `blocks`). */
export function blocksIn(value: unknown, keep = false): CommentBlock[] {
  return (Array.isArray(value) ? value : []).map((one) => blockOf(one, keep)).filter((b): b is CommentBlock => b !== null);
}

/** Die Bausteine unter einem Schlüssel der Daten. */
export const blocksOf = (data: Readonly<Record<string, unknown>>, key: string, keep = false): CommentBlock[] => blocksIn(data[key], keep);

/** Wie ein Stück, eine Zelle, ein Baustein gespeichert wird — ohne Leeres. */
export const runData = (run: Run): Record<string, unknown> =>
  'ref' in run ? { ref: run.ref, ...(run.locator === undefined || run.locator === '' ? {} : { locator: run.locator }) } : { text: run.text };
export const cellData = (cell: Cell): Record<string, unknown>[] => cell.map(runData);
export function blockData(block: CommentBlock): Record<string, unknown> {
  if (block.type === 'paragraph') return { type: block.type, text: block.text };
  if (block.type === 'table') return { type: block.type, columns: [...block.columns], rows: block.rows.map((row) => row.map(cellData)) };
  return { type: block.type, items: block.items.map(cellData) };
}

/* -- Wo ein Eintrag seine Bausteine trägt (sein Rodzaj sagt es) ------------------------------------ */

interface Seen {
  readonly kind: string;
  readonly data: Readonly<Record<string, unknown>>;
}

/**
 * Der Schlüssel des ersten Feldes `blocks` eines Eintrags — aus dem Eintrag
 * seines Rodzaj (ein Dokument `kind` derselben Baza, über `look`). `null`:
 * keiner (dann ist der Eintrag keine Aussage).
 */
export function blocksKeyOf(entry: Seen, look: { get(id: string): Seen | undefined }): string | null {
  if (entry.kind !== 'entity') return null;
  const kinds = Array.isArray(entry.data._kinds) ? entry.data._kinds.filter((k): k is string => typeof k === 'string') : [];
  for (const kindId of kinds) {
    const doc = look.get(kindId);
    if (doc === undefined || doc.kind !== 'kind') continue;
    for (const field of Array.isArray(doc.data.fields) ? doc.data.fields : []) {
      const f = rec(field);
      if (f !== null && f.type === 'blocks' && typeof f.key === 'string' && f.key !== '') return f.key;
    }
  }
  return null;
}

/** Die Bausteine einer Aussage — leer, wenn der Eintrag keine ist. */
export function statementBlocks(entry: Seen, look: { get(id: string): Seen | undefined }): CommentBlock[] {
  const key = blocksKeyOf(entry, look);
  return key === null ? [] : blocksOf(entry.data, key);
}

/* -- Was sie nennt ------------------------------------------------------------------------- */

export function cellsOf(block: CommentBlock): Cell[] {
  if (block.type === 'paragraph') return [];
  if (block.type === 'table') return block.rows.flat();
  return [...block.items];
}

/** Alle echten Verweise in den Bausteinen — mit Stelle. */
export function blockRefs(blocks: readonly CommentBlock[]): { ref: string; locator: string }[] {
  const out: { ref: string; locator: string }[] = [];
  for (const block of blocks) for (const cell of cellsOf(block)) for (const run of cell) if ('ref' in run) out.push({ ref: run.ref, locator: run.locator ?? '' });
  return out;
}

/** Aller Zapis in den Bausteinen (Absätze und Textstücke) — für Fussnoten, Quellen, Suche. */
export function blockMarkups(blocks: readonly CommentBlock[]): string[] {
  const out: string[] = [];
  for (const block of blocks) {
    if (block.type === 'paragraph') out.push(block.text);
    else for (const cell of cellsOf(block)) for (const run of cell) if ('text' in run) out.push(run.text);
  }
  return out;
}

/** Was die Bausteine nennen: Kennungen der Zellen und Schlüssel/Kennungen im Zapis. */
export const blockTokens = (blocks: readonly CommentBlock[]): string[] =>
  [...new Set([...blockRefs(blocks).map((r) => r.ref), ...citedKeys(...blockMarkups(blocks))])];

/* -- Die Teza (Entscheidung 1) und die Frage (Entscheidung 2) --------------------------------------- */

/** Nach diesen Abkürzungen endet kein Satz (polnisch, lateinisch, englisch; Bücher der Schrift). */
const ABBREVIATION = /(?:^|[\s(„"])(?:św|bł|ks|o|s|ss|r|rr|n|nr|np|tzw|por|zob|dz|cyt|wg|tj|itd|itp|ok|jw|art|kan|pkt|rozdz|t|tt|wyd|red|tłum|przyp|pt|cf|vs|ca|op|loc|ibid|id|al|ch|vol|ed|eds|trans|p|pp|m\.in)\.$/iu;
/** Ein Anfangsbuchstabe („J. Ratzinger") beendet keinen Satz. */
const INITIAL = /(?:^|[\s(„"])\p{Lu}\.$/u;

/**
 * DER ERSTE SATZ eines Textes (ohne Zeichen des Zapis): bis zum ersten . ! ? …
 * vor einem neuen Satz (Grossbuchstabe, Anführung, Klammer, Ziffer) — nicht
 * nach einer Abkürzung („św.", „np.", „Łk."). Ohne solches Ende: der ganze Text.
 */
export function firstSentence(text: string): string {
  const flat = plainText(text).replace(/\s+/g, ' ').trim();
  for (const m of flat.matchAll(/([.!?…]+)(["”»)]*)\s+(?=[\p{Lu}„"«(\d])/gu)) {
    const stop = (m.index ?? 0) + m[1].length;
    if (m[1] === '.' && (ABBREVIATION.test(flat.slice(0, stop)) || INITIAL.test(flat.slice(0, stop)))) continue;
    return flat.slice(0, stop + m[2].length).trim();
  }
  return flat;
}

/** Die Teza: der erste Satz des ersten Absatzes — leer, wenn die Bausteine nicht mit einem Absatz beginnen. */
export function thesisOf(blocks: readonly CommentBlock[]): string {
  const first = blocks[0];
  return first?.type === 'paragraph' ? firstSentence(first.text) : '';
}

/** Ab hier ist eine Teza zu lang (Entscheidung 1). */
export const THESIS_LIMIT = 200;

/** Was an der Teza fehlt: `missing` — sie beginnt nicht mit einem Satz, `long` — der erste Satz ist zu lang; `null` — gut. */
export function thesisProblem(blocks: readonly CommentBlock[]): 'missing' | 'long' | null {
  const thesis = thesisOf(blocks);
  if (thesis === '') return 'missing';
  return thesis.length > THESIS_LIMIT ? 'long' : null;
}

/** Entscheidung 2: eine Frage ist eine Aussage, deren Teza mit „?" endet. */
export const isQuestion = (blocks: readonly CommentBlock[]): boolean => /\?["”»)]*$/.test(thesisOf(blocks));

/** Die Absätze als Zapis (für Suche, Karten, Lesen ohne Tabellen). */
export function blocksText(blocks: readonly CommentBlock[]): string {
  return blocks.filter((b): b is Extract<CommentBlock, { type: 'paragraph' }> => b.type === 'paragraph').map((b) => b.text).join('\n\n');
}

/** Der Name einer Aussage in Listen: ihr Anfang (die Teza, sonst das erste Wort einer Liste oder Tabelle). */
export function blocksTitle(blocks: readonly CommentBlock[]): string {
  const plain = (text: string): string =>
    text.replace(/!?\[@[^\]]*\]/g, ' ').replace(/\^\[[^\]]*\]/g, ' ').replace(/[*_#>`]/g, '').replace(/\s+/g, ' ').trim();
  const thesis = thesisOf(blocks);
  if (thesis !== '') return thesis.length > 90 ? `${thesis.slice(0, 89).trimEnd()}…` : thesis;
  for (const block of blocks) {
    const first = block.type === 'paragraph' ? plain(block.text)
      : cellsOf(block).flat().map((run) => ('text' in run ? plain(run.text) : '')).find((t) => t !== '') ?? '';
    if (first !== '') return first.length > 90 ? `${first.slice(0, 89).trimEnd()}…` : first;
  }
  return '';
}

/* -- Als Zapis, als Klartext ------------------------------------------------------------------------ */

/** Ein Stück einer Zelle als Zapis: Text bleibt, ein Verweis mit Stelle wird ein Link mit der Stelle (`[[Łk 1,35|@…]]`), ohne Stelle ein Verweis. */
const runMarkup = (run: Run): string => ('ref' in run ? (run.locator !== undefined && run.locator !== '' ? `[[${run.locator}|@${run.ref}]]` : `[@${run.ref}]`) : run.text);

/**
 * EINE AUSSAGE ALS ZAPIS (für einen Ablauf, eine Sprechblase): Absätze, wie
 * sie sind; Listen als Listen; eine Tabelle Zeile für Zeile („Łk 1,35 — Dz 1,8").
 */
export function blocksMarkup(blocks: readonly CommentBlock[]): string {
  return blocks.map((block) => {
    if (block.type === 'paragraph') return block.text;
    if (block.type === 'table') return block.rows.map((row) => `- ${row.map((cell) => cell.map(runMarkup).join(' ')).join(' — ')}`).join('\n');
    return block.items.map((cell, i) => `${block.type === 'ordered' ? `${i + 1}.` : '-'} ${cell.map(runMarkup).join(' ')}`).join('\n');
  }).join('\n\n');
}

/** Ein Baustein als Klartext — eine Zelle mit den Namen ihrer Verweise (`label`: Kennung → Name, Stelle). */
export function blockPlain(block: CommentBlock, label: (ref: string, locator: string) => string): string {
  const cell = (c: Cell) => c.map((run) => ('ref' in run ? label(run.ref, run.locator ?? '') : plainText(run.text))).join(' ').replace(/\s+/g, ' ').trim();
  if (block.type === 'paragraph') return plainText(block.text).replace(/\s+/g, ' ').trim();
  if (block.type === 'table') return block.rows.map((row) => row.map(cell).join(' — ')).join('; ');
  return block.items.map(cell).join('; ');
}
