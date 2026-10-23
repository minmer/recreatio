/**
 * KOMENTARZ (2026-10-22) — die eigenen Gedanken zu Quellen, Zitaten,
 * Bibelstellen und anderen Komentarzen, als EIGENER Eintrag: einmal
 * geschrieben, in beliebig vielen Texten verwendet.
 *
 * <code>
 *   subjects   worum es geht: Einträge jeder Art, je mit Stelle („J 3,16",
 *              „s. 23") und bei einem Text mit dem Punkt seines Plans
 *   blocks     was er sagt — vier Formen, und die Form trägt Bedeutung:
 *              paragraph   Prosa
 *              ordered     die Reihenfolge zählt (ein Gedankengang)
 *              unordered   gleichrangige Punkte
 *              table       ein Vergleich: benannte Spalten, jede Zeile vergleicht dasselbe
 * </code>
 *
 * <b>Struktur, nicht Text.</b> Eine Zelle (und ein Listenpunkt) ist eine
 * Folge von Stücken: Zapis (\`{ text }\`, mit Formatierung und Fussnoten wie
 * in einem Text) oder ein echter Verweis (\`{ ref, locator }\`). Eine Zeile,
 * die Łk 1,35 neben Dz 1,8 stellt, ist so ein Datum — \`pairedWith\`
 * beantwortet später „womit wurde Dz 1,8 zusammengestellt?".
 *
 * Eine Synthese ist ein Komentarz über Komentarze; eine eigene Art braucht
 * sie nicht. Keine Einstufung (Beobachtung, Vergleich, Gewissheit): wie
 * schwer ein Satz wiegt, steht in seinen Worten.
 *
 * Diese Datei liest nichts aus \`libraryKinds.ts\` zur Laufzeit — die Art
 * selbst steht dort, und sie liest von hier (keine Schleife beim Laden).
 *
 * <b>2026-10-22 — DIE AUSSAGE (Schritt 6).</b> Der Komentarz ist die eine Art
 * für Aussagen: was Cogita „Wiedza" nannte, wird ein Komentarz in einer
 * Bibliothek. (2026-10-23: der Komentarz zieht als eigene Art nach Cogita — Schritt 4.) Was eine Aussage ist, wird
 * gerechnet, nicht gespeichert:
 *
 * <code>
 *   Teza          der erste Satz des ersten Absatzes (Entscheidung 1) — fehlt er
 *                 oder ist er länger als 200 Zeichen, steht es unter „Do zrobienia"
 *   Pytanie       eine Aussage, deren erster Satz eine Frage ist (Entscheidung 2);
 *                 beantwortet, sobald eine andere Aussage auf sie zeigt
 *   Informacja /  gibt wieder, was eine Quelle sagt (zitiert ein Werk, ein Zitat,
 *   Interpretacja eine Person, stützt sich auf keine andere Aussage, vergleicht
 *                 nicht in einer Tabelle) — sonst eine Deutung
 * </code>
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

export interface Subject {
  readonly ref: string;
  readonly locator: string;
  /** Bei einem Text: der Punkt seines Plans (`p4k2x`). */
  readonly point: string;
}

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

export function blocksOf(data: Readonly<Record<string, unknown>>, key = 'blocks', keep = false): CommentBlock[] {
  const value = data[key];
  return (Array.isArray(value) ? value : []).map((one) => blockOf(one, keep)).filter((b): b is CommentBlock => b !== null);
}

export function subjectsOf(data: Readonly<Record<string, unknown>>): Subject[] {
  const value = data.subjects;
  return (Array.isArray(value) ? value : []).map(rec).filter((r): r is Record<string, unknown> => r !== null)
    .map((r) => ({ ref: line(r.ref).trim(), locator: line(r.locator).trim(), point: line(r.point).trim() }))
    .filter((s) => s.ref !== '');
}

/** Wie ein Stück, eine Zelle, ein Baustein gespeichert wird — ohne Leeres. */
export const runData = (run: Run): Record<string, unknown> =>
  'ref' in run ? { ref: run.ref, ...(run.locator === undefined || run.locator === '' ? {} : { locator: run.locator }) } : { text: run.text };
export const cellData = (cell: Cell): Record<string, unknown>[] => cell.map(runData);
export function blockData(block: CommentBlock): Record<string, unknown> {
  if (block.type === 'paragraph') return { type: block.type, text: block.text };
  if (block.type === 'table') return { type: block.type, columns: [...block.columns], rows: block.rows.map((row) => row.map(cellData)) };
  return { type: block.type, items: block.items.map(cellData) };
}
export const subjectData = (s: Subject): Record<string, unknown> => ({
  ref: s.ref, ...(s.locator === '' ? {} : { locator: s.locator }), ...(s.point === '' ? {} : { point: s.point })
});

/* -- Was er nennt ------------------------------------------------------------------------- */

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

const plain = (text: string): string =>
  text.replace(/!?\[@[^\]]*\]/g, ' ').replace(/\^\[[^\]]*\]/g, ' ').replace(/[*_#>`]/g, '').replace(/\s+/g, ' ').trim();

/** Der Name eines Komentarza in Listen: sein Anfang — sonst, worum es geht. */
export function commentTitle(data: Readonly<Record<string, unknown>>, titleOf: (id: string) => string | undefined): string {
  for (const block of blocksOf(data)) {
    const first = block.type === 'paragraph' ? plain(block.text)
      : cellsOf(block).flat().map((run) => ('text' in run ? plain(run.text) : '')).find((t) => t !== '') ?? '';
    if (first !== '') return first.length > 90 ? `${first.slice(0, 89).trimEnd()}…` : first;
  }
  const about = subjectsOf(data).map((s) => [titleOf(s.ref), s.locator].filter(Boolean).join(' ')).filter(Boolean);
  return about.length > 0 ? `Komentarz: ${about.slice(0, 2).join('; ')}` : 'Komentarz';
}

/* -- Fragen an die Struktur ------------------------------------------------------------------ */

interface EntryLike {
  readonly id: string;
  readonly kind: string;
  readonly data: Readonly<Record<string, unknown>>;
}

/** Die Komentarze ÜBER einen Eintrag (und, bei einem Text, über einen Punkt seines Plans). */
export function commentsAbout<E extends EntryLike>(id: string, entries: Iterable<E>, point?: string): E[] {
  const out: E[] = [];
  for (const e of entries) {
    if (e.kind !== 'comment') continue;
    if (subjectsOf(e.data).some((s) => s.ref === id && (point === undefined || s.point === point))) out.push(e);
  }
  return out;
}

const sameLocator = (a: string, b: string): boolean => a.replace(/\s+/g, '').toLowerCase() === b.replace(/\s+/g, '').toLowerCase();

/**
 * WOMIT WURDE DAS ZUSAMMENGESTELLT? In einer Tabellenzeile oder einem
 * Listenpunkt, der `ref` (an dieser Stelle) nennt: die anderen Verweise
 * derselben Zeile — mit dem Komentarz, in dem es steht.
 */
export function pairedWith<E extends EntryLike>(ref: string, locator: string, entries: Iterable<E>): { ref: string; locator: string; comment: E }[] {
  const out: { ref: string; locator: string; comment: E }[] = [];
  const hit = (run: Run) => 'ref' in run && run.ref === ref && (locator === '' || sameLocator(run.locator ?? '', locator));
  for (const e of entries) {
    if (e.kind !== 'comment') continue;
    for (const block of blocksOf(e.data)) {
      const groups: Cell[][] = block.type === 'table' ? block.rows.map((row) => [...row]) : block.type === 'paragraph' ? [] : block.items.map((cell) => [cell]);
      for (const group of groups) {
        const runs = group.flat();
        if (!runs.some(hit)) continue;
        for (const run of runs) if ('ref' in run && !hit(run)) out.push({ ref: run.ref, locator: run.locator ?? '', comment: e });
      }
    }
  }
  return out;
}

/* -- Was aus alten Feldern ein Komentarz wird --------------------------------------------------- */

/**
 * Bis 2026-10-22 standen solche Gedanken in Feldern eines einzelnen
 * Eintrags. (2026-10-23: die Umstellung ist weg — alte Werte reisen
 * unverändert mit, gezeigt werden sie nicht.)
 */
export const LEGACY_COMMENT_FIELDS: Readonly<Record<string, readonly { key: string; private: boolean }[]>> = {
  quote: [{ key: 'description', private: false }, { key: 'notes', private: true }],
  work: [{ key: 'description', private: false }, { key: 'notes', private: true }],
  person: [{ key: 'notes', private: true }],
  topic: [{ key: 'notes', private: true }],
  text: [{ key: 'notes', private: true }],
  project: [{ key: 'notes', private: true }],
  delivery: [{ key: 'notes', private: true }]
};

/** Ein alter Wert als Komentarz: Absätze bleiben Absätze. */
export function legacyBlocks(value: string): CommentBlock[] {
  return value.replace(/\r\n?/g, '\n').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((text) => ({ type: 'paragraph', text }));
}

/* -- 2026-10-22: die Aussage — Teza, Frage, Rolle (Schritt 6) -------------------------------------- */

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

/** Die Teza einer Aussage: der erste Satz ihres ersten Absatzes — leer, wenn sie nicht mit einem Absatz beginnt. */
export function thesisOf(data: Readonly<Record<string, unknown>>): string {
  const first = blocksOf(data)[0];
  return first?.type === 'paragraph' ? firstSentence(first.text) : '';
}

/** Ab hier ist eine Teza zu lang (Entscheidung 1). */
export const THESIS_LIMIT = 200;

/** Was an der Teza fehlt: `missing` — sie beginnt nicht mit einem Satz, `long` — der erste Satz ist zu lang; `null` — gut. */
export function thesisProblem(data: Readonly<Record<string, unknown>>): 'missing' | 'long' | null {
  const thesis = thesisOf(data);
  if (thesis === '') return 'missing';
  return thesis.length > THESIS_LIMIT ? 'long' : null;
}

/** Entscheidung 2: eine Frage ist eine Aussage, deren erster Satz eine Frage ist. */
export const isQuestion = (data: Readonly<Record<string, unknown>>): boolean => /\?["”»)]*$/.test(thesisOf(data));

/** Die Absätze einer Aussage als Zapis (für Suche, Karten, Lesen ohne Tabellen). */
export function statementText(data: Readonly<Record<string, unknown>>): string {
  return blocksOf(data).filter((b): b is Extract<CommentBlock, { type: 'paragraph' }> => b.type === 'paragraph').map((b) => b.text).join('\n\n');
}

/** Was eine Aussage nennt: ihre Gegenstände, die Verweise in ihren Zellen und im Zapis (Kennungen oder Schlüssel). */
export function statementTokens(data: Readonly<Record<string, unknown>>): string[] {
  const blocks = blocksOf(data);
  return [...new Set([...subjectsOf(data).map((s) => s.ref), ...blockRefs(blocks).map((r) => r.ref), ...citedKeys(...blockMarkups(blocks))])];
}

export type StatementRole = 'information' | 'interpretation';

/**
 * DIE ROLLE, GERECHNET (nicht gespeichert): eine Information gibt wieder, was
 * eine Quelle sagt — sie zitiert ein Werk, ein Zitat oder eine Person (im
 * Zapis oder in einer Zelle), stützt sich auf keine andere Aussage und stellt
 * nichts in einer Tabelle gegenüber. Alles andere ist eine Interpretation:
 * eine Deutung, ein Vergleich, eine Synthese, ein eigener Gedanke.
 * `kindOf`: die Art eines Ziels (Kennung oder Schlüssel) — `undefined`: nicht lesbar.
 */
export function statementRole(data: Readonly<Record<string, unknown>>, kindOf: (token: string) => string | undefined): StatementRole {
  const blocks = blocksOf(data);
  if (blocks.some((b) => b.type === 'table')) return 'interpretation';
  const cited = [...new Set([...blockRefs(blocks).map((r) => r.ref), ...citedKeys(...blockMarkups(blocks))])].map(kindOf);
  const about = subjectsOf(data).map((s) => kindOf(s.ref));
  if ([...cited, ...about].includes('comment')) return 'interpretation';
  return cited.some((k) => k === 'work' || k === 'quote' || k === 'person') ? 'information' : 'interpretation';
}

/** Ein Stück einer Zelle als Zapis: Text bleibt, ein Verweis mit Stelle wird ein Link mit der Stelle (`[[Łk 1,35|@…]]`), ohne Stelle ein Verweis. */
const runMarkup = (run: Run): string => ('ref' in run ? (run.locator !== undefined && run.locator !== '' ? `[[${run.locator}|@${run.ref}]]` : `[@${run.ref}]`) : run.text);

/**
 * 2026-10-22 — EINE AUSSAGE ALS ZAPIS (für einen Ablauf, eine Sprechblase,
 * eine öffentliche Fassung): Absätze, wie sie sind; Listen als Listen;
 * eine Tabelle Zeile für Zeile („Łk 1,35 — Dz 1,8").
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
