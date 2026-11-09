/**
 * DIE ZITATE EINES BUCHES — wie sie aus dem Lesen in die Bibliothek kommen.
 *
 * <b>Der gewöhnliche Weg:</b> lesen, mit dem Bleistift anstreichen, nach
 * ein paar Seiten die angestrichenen Seiten fotografieren. Die Fotos und das
 * Polecenie (`quotesPrompt`) gehen in den eigenen Chat mit einer KI — HIER
 * wird keine KI aufgerufen (auf Wunsch, 2026-10-02: „ich mache das selbst im
 * Chat, am Ende wird nur das JSON importiert"). Das JSON kommt auf der Seite
 * des Buches herein; jedes Zitat lässt sich vor dem Speichern prüfen, ändern
 * oder abwählen.
 *
 * <code>
 *   { "format": "recreatio/quotes", "version": 3,
 *     "work": { "key", "title", "isbn" },
 *     "quotes": [ { "text", "page", "language", "translation", "check", "uncertain" } ] }
 * </code>
 *
 * 2026-10-23 (Fassung 3, drei Teile) — die Bibliothek hält nur Quellen: ein
 * Zitat hat keine Themen und bringt keinen Komentarz mehr mit. Was die KI
 * nicht sicher lesen konnte (und ein Bleistift-Dopisek), steht in `check` —
 * nur zum Nachsehen vor dem Speichern, nie gespeichert. Ältere Dateien mit
 * `topics`, `comment`, `description` oder `notes` werden gelesen; diese
 * Felder werden genannt und nicht gespeichert (der Text des Komentarza
 * erscheint als „Do sprawdzenia", damit man ihn sieht, bevor er wegfällt).
 *
 * Alle Zitate gehören dem Buch, auf dessen Seite importiert wird — das
 * „work" im Dokument sagt nur, wofür es geschrieben wurde. Die Felder sind
 * die der Art „Cytat" (`libraryKinds.ts`); die Beschreibung entsteht daraus,
 * wie die der ganzen Bibliothek (siehe [[json-import-export]]).
 */

import { workLocatorKey } from './locations';
import { t, texts } from '../core/i18n';
import { isUuid } from './library';
import { citeSegs, newCiteState, segText } from './libraryCite';
import { ids, kindOf, slug, str, type EntryData, type LibEntry, type Lookup } from './libraryKinds';

export const QUOTES_FORMAT = 'recreatio/quotes';
export const QUOTES_VERSION = 3;

/** Was ein Plan vom Bestand wissen muss. */
export interface QuoteBase extends Lookup {
  all(): readonly LibEntry[];
}

export interface QuoteItem {
  readonly n: number;
  /** Ein Zitat, das es schon gibt (aus einem Export) — es wird geändert, nicht verdoppelt. */
  readonly id?: string;
  readonly text: string;
  readonly locator: string;
  readonly language: string;
  readonly translation: string;
  /** Was vor dem Speichern nachzusehen ist — nur hier, nie gespeichert. */
  readonly check: string;
  /** Die KI war sich nicht sicher — Wort, Seite oder Grenze des Anstrichs. */
  readonly uncertain: boolean;
  /** Wird gespeichert. */
  readonly keep: boolean;
  /** Dasselbe Zitat steht schon im Buch. */
  readonly duplicateOf?: string;
}

export interface QuotesPlan {
  readonly items: readonly QuoteItem[];
  readonly warnings: readonly string[];
}

/* -- Lesen ---------------------------------------------------------------------------------- */

const fold = (text: string): string => slug(text).replace(/-/g, ' ').trim();

/** Wie ein Zitat verglichen wird: ohne Satzzeichen, Gross/klein, Zeilenumbrüche — die ersten 80 Zeichen. */
export const quoteKey = (text: string): string => fold(text).slice(0, 80);

/** Was vom Abschreiben übrig bleibt: Trennstriche am Zeilenende, Umbrüche mitten im Absatz. */
export function cleanQuote(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/(\p{L})[-­]\n(\p{Ll})/gu, '$1$2')
    .split(/\n\s*\n/)
    .map((para) => para.replace(/\s*\n\s*/g, ' ').replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

/** „23" → „s. 23", „23-24" → „s. 23–24"; was schon eine Stelle ist („J 3,16", „nr 24", „s. 5"), bleibt. */
export function locatorOf(page: unknown, locator: unknown): string {
  const given = typeof locator === 'string' ? locator.trim() : '';
  if (given !== '') return given;
  const p = typeof page === 'number' ? String(page) : typeof page === 'string' ? page.trim() : '';
  if (p === '') return '';
  if (/^[\divxlcdm]+(\s*[-–]\s*[\divxlcdm]+)?$/i.test(p)) return `s. ${p.replace(/\s*[-–]\s*/, '–')}`;
  return p;
}


const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
const line = (value: unknown): string => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '');

/** Felder älterer Fassungen, die nicht mehr gespeichert werden — mit dem Grund. */
const DROPPED: Readonly<Record<string, string>> = texts({
  topics: 'libraryData.quotesImport.noTopics',
  comment: 'libraryData.quotesImport.noComments',
  description: 'libraryData.quotesImport.noComments',
  notes: 'libraryData.quotesImport.noComments'
});

/**
 * Was ein Dokument für dieses Buch bedeuten würde. Nimmt das eigene Format,
 * eine blosse Liste von Zitaten und ein Dokument der Bibliothek (dessen
 * Zitate).
 */
export function planQuotes(doc: unknown, work: LibEntry, base: QuoteBase): QuotesPlan | { error: string } {
  const root = asRecord(doc);
  const list: unknown[] = Array.isArray(doc) ? doc
    : Array.isArray(root.quotes) ? root.quotes
    : Array.isArray(root.entries) ? root.entries.filter((e) => asRecord(e).kind === 'quote').map((e) => ({ ...asRecord(asRecord(e).data), id: asRecord(e).id }))
    : typeof root.text === 'string' ? [root]
    : [];
  if (root.format !== undefined && root.format !== QUOTES_FORMAT && root.format !== 'recreatio/library') {
    return { error: t('libraryData.patch.otherFormat', { given: String(root.format), format: QUOTES_FORMAT }) };
  }
  if (list.length === 0) return { error: t('libraryData.quotesImport.none') };

  const warnings: string[] = [];
  const meant = asRecord(root.work);
  const meantTitle = line(meant.title);
  if (meantTitle !== '' && fold(meantTitle) !== fold(str(work.data, 'title')) && !fold(str(work.data, 'title')).startsWith(fold(meantTitle).slice(0, 20))) {
    warnings.push(t('libraryData.quotesImport.otherBook', { meant: meantTitle, title: str(work.data, 'title') }));
  }

  const mine = base.all().filter((e) => e.kind === 'quote' && ids(e.data, 'work').includes(work.id));
  const seen = new Map(mine.map((q) => [quoteKey(str(q.data, 'text')), q.id]));
  const items: QuoteItem[] = [];
  const dropped = new Map<string, number>();

  list.forEach((one, index) => {
    const raw = asRecord(one);
    const text = cleanQuote(line(raw.text));
    if (text === '') { warnings.push(t('libraryData.quotesImport.noText', { n: index + 1 })); return; }
    const givenId = line(raw.id);
    const existing = givenId === '' ? undefined : base.get(givenId);
    const update = existing !== undefined && existing.kind === 'quote' && ids(existing.data, 'work').includes(work.id) ? existing : undefined;
    if (isUuid(givenId) && update === undefined) warnings.push(`Cytat ${index + 1}: nieznane „id” — powstanie nowy.`);
    const key = quoteKey(text);
    const duplicateOf = update === undefined ? seen.get(key) : undefined;
    if (update === undefined && duplicateOf === undefined) seen.set(key, `doc:${index}`);
    for (const old of Object.keys(DROPPED)) {
      const value = raw[old];
      if (value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0)) dropped.set(old, (dropped.get(old) ?? 0) + 1);
    }
    /* Ein alter Komentarz (Fassung 1/2) wird nicht gespeichert — aber vor dem Speichern gezeigt. */
    const oldThoughts = [line(raw.comment), line(raw.description), line(raw.notes)].filter(Boolean).join(' · ');
    const check = [line(raw.check), oldThoughts === '' ? '' : `(nie zostanie zapisane) ${oldThoughts}`].filter(Boolean).join(' — ');
    items.push({
      n: index,
      ...(update === undefined ? {} : { id: update.id }),
      text,
      locator: locatorOf(raw.page, raw.locator),
      language: line(raw.language),
      translation: line(raw.translation),
      check,
      uncertain: raw.uncertain === true,
      keep: duplicateOf === undefined,
      ...(duplicateOf === undefined ? {} : { duplicateOf })
    });
  });

  for (const [old, count] of dropped) warnings.push(t('libraryData.quotesImport.dropped', { field: old, count, why: DROPPED[old] ?? '' }));
  const doubled = items.filter((i) => i.duplicateOf !== undefined).length;
  if (doubled > 0) warnings.push(t('libraryData.quotesImport.doubled', { n: doubled }));
  return { items, warnings };
}

/**
 * Speichern: die Zitate — neue mit dem Buch als Quelle, geänderte an Ort und
 * Stelle (nur die Felder, die etwas sagen). `save` ist der Speicher der
 * Bibliothek; der Schlüssel (`ricci2016-3`) entsteht dort.
 */
export async function importQuotes(
  items: readonly QuoteItem[],
  work: LibEntry,
  base: QuoteBase,
  save: (input: { id?: string; kind: string; data: EntryData }) => Promise<{ id: string }>,
  options: { stage?: (what: string) => void } = {}
): Promise<{ saved: number; failed: string[] }> {
  const chosen = items.filter((i) => i.keep);
  const failed: string[] = [];

  let saved = 0;
  for (const [index, item] of chosen.entries()) {
    options.stage?.(`Zapisywanie ${index + 1} z ${chosen.length}…`);
    const fields: EntryData = {
      text: item.text,
      locator: item.locator,
      language: item.language,
      translation: item.translation
    };
    const before = item.id === undefined ? undefined : base.get(item.id);
    const data: EntryData = { ...(before?.data ?? {}), work: work.id };
    for (const [k, v] of Object.entries(fields)) {
      if (typeof v === 'string' && v !== '') data[k] = v;
      else if (before === undefined) delete data[k];
    }
    try {
      await save({ ...(item.id === undefined ? {} : { id: item.id }), kind: 'quote', data });
      saved += 1;
    } catch {
      failed.push(`„${item.text.slice(0, 40)}…”`);
    }
  }
  return { saved, failed };
}

/* -- Hinaus ------------------------------------------------------------------------------- */

/** Die Zitate des Buches als Dokument — zum Nachbessern (mit einer KI) und wieder Hereinholen. */
export function exportQuotes(work: LibEntry, base: QuoteBase): Record<string, unknown> {
  const quotes = base.all().filter((e) => e.kind === 'quote' && ids(e.data, 'work').includes(work.id))
    .sort((a, b) => workLocatorKey(str(a.data, 'locator'), work.data).localeCompare(workLocatorKey(str(b.data, 'locator'), work.data)));
  return {
    format: QUOTES_FORMAT,
    version: QUOTES_VERSION,
    work: workSummary(work),
    quotes: quotes.map((q) => {
      const out: Record<string, unknown> = { id: q.id };
      for (const k of ['text', 'locator', 'language', 'translation']) if (str(q.data, k) !== '') out[k] = str(q.data, k);
      return out;
    })
  };
}

const workSummary = (work: LibEntry): Record<string, string> => {
  const out: Record<string, string> = { title: str(work.data, 'title') };
  if (work.key !== undefined) out.key = work.key;
  if (str(work.data, 'isbn') !== '') out.isbn = str(work.data, 'isbn');
  return out;
};

/* -- Die Beschreibung und das Polecenie ------------------------------------------------------- */

const EXTRA_SAYS: readonly string[] = ['check', 'page', 'uncertain', 'id'];

/* Beispieldaten (ein echtes Zitat) — wie die Beispiele der Arten nicht übersetzt. */
const QUOTE_EXAMPLE = {
  text: 'Modlitwa jest rozmową z Bogiem, w której człowiek staje się sobą.', // i18n-ignore
  page: '168',
  check: 'Dopisek ołówkiem: „do kazania na XVII niedzielę”.' // i18n-ignore
};

/** Was ein Zitat im Dokument haben kann — aus den Feldern der Art „Cytat" (ohne „work": das ist das Buch). */
export function quoteFieldsDoc(): string {
  const def = kindOf('quote')!;
  const own = def.fields.filter((f) => f.key !== 'work').map((f) => `  "${f.key}" — ${f.label}: ${f.says}`);
  const extra = EXTRA_SAYS.map((k) => `  "${k}" — ${t(`libraryData.quotesDoc.extra.${k}`)}`);
  return [...own, ...extra].join('\n');
}

/** 2026-10-30 — am Ende „Jak aplikacja używa tych danych": wo die Zitate danach stehen und wer sie liest. */
export function quotesDescription(work: LibEntry): string {
  const summary = workSummary(work);
  const stem = work.key ?? t('libraryData.quotesDoc.keyWord');
  const key = `${stem}-1`;
  return `${t('libraryData.quotesDoc.head', { format: QUOTES_FORMAT, version: QUOTES_VERSION, title: summary.title, key: stem, summary: JSON.stringify(summary) })}
${quoteFieldsDoc()}
${t('libraryData.quotesDoc.afterFields')}
${JSON.stringify({ format: QUOTES_FORMAT, version: QUOTES_VERSION, work: summary, quotes: [QUOTE_EXAMPLE] }, null, 2)}

${t('libraryData.quotesDoc.use', { key })}
`;
}

export type MarkMode = 'marked' | 'whole';

/** Wie das Buch in der Aufgabe heisst — die volle Angabe: „N. Ricci, Wielkość…, tłum. K. Werbowy, Poznań 2016". */
const bookLineFor = (work: LibEntry, look: Lookup): string => segText(citeSegs(work, '', look, newCiteState())) || str(work.data, 'title');

/**
 * Das Polecenie für die KI im eigenen Chat: was auf den Fotos zu lesen ist
 * und wie — und darunter die Beschreibung des JSON, das zurückkommen soll.
 */
export function quotesPrompt(work: LibEntry, look: QuoteBase, mode: MarkMode): string {
  const what = mode === 'marked'
    ? t('libraryData.quotesPrompt.marked')
    : t('libraryData.quotesPrompt.whole');
  return `${t('libraryData.quotesPrompt.intro', { book: bookLineFor(work, look) })}
${what}

${t('libraryData.quotesPrompt.rules')}

${quotesDescription(work)}`;
}
