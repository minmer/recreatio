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
 */

/** Was an der Stelle eines Verweises steht, dessen Ziel dieser Leser nicht lesen darf — nichts über das Ziel, nicht einmal sein Titel. */
export const UNREADABLE = '[odwołanie niedostępne]';

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
 * Eintrags. Diese werden Komentarze ÜBER ihn (`libraryMigrate.ts`; ein
 * Import alter Dateien macht dasselbe).
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
