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

import { locatorKey } from './bible';
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
const DROPPED: Readonly<Record<string, string>> = {
  topics: 'tematów już nie ma',
  comment: 'komentarze są teraz własnym rodzajem w Nauce',
  description: 'komentarze są teraz własnym rodzajem w Nauce',
  notes: 'komentarze są teraz własnym rodzajem w Nauce'
};

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
    return { error: `Inny format: „${String(root.format)}”, a tu przyjmowany jest "${QUOTES_FORMAT}".` };
  }
  if (list.length === 0) return { error: 'Brak cytatów — dokument powinien mieć listę "quotes".' };

  const warnings: string[] = [];
  const meant = asRecord(root.work);
  const meantTitle = line(meant.title);
  if (meantTitle !== '' && fold(meantTitle) !== fold(str(work.data, 'title')) && !fold(str(work.data, 'title')).startsWith(fold(meantTitle).slice(0, 20))) {
    warnings.push(`Dokument był pisany dla „${meantTitle}” — cytaty trafią do tej książki („${str(work.data, 'title')}”).`);
  }

  const mine = base.all().filter((e) => e.kind === 'quote' && ids(e.data, 'work').includes(work.id));
  const seen = new Map(mine.map((q) => [quoteKey(str(q.data, 'text')), q.id]));
  const items: QuoteItem[] = [];
  const dropped = new Map<string, number>();

  list.forEach((one, index) => {
    const raw = asRecord(one);
    const text = cleanQuote(line(raw.text));
    if (text === '') { warnings.push(`Cytat ${index + 1}: bez tekstu — pominięty.`); return; }
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

  for (const [old, count] of dropped) warnings.push(`„${old}” (${count}×) nie jest już zapisywane — ${DROPPED[old]}.`);
  const doubled = items.filter((i) => i.duplicateOf !== undefined).length;
  if (doubled > 0) warnings.push(`${doubled} z nich już jest w tej książce — odznaczone (można zaznaczyć mimo to).`);
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
  const bible = str(work.data, 'workType') === 'bible';
  const quotes = base.all().filter((e) => e.kind === 'quote' && ids(e.data, 'work').includes(work.id))
    .sort((a, b) => locatorKey(str(a.data, 'locator'), bible).localeCompare(locatorKey(str(b.data, 'locator'), bible)));
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

const EXTRA_SAYS: readonly [string, string][] = [
  ['check', 'Co sprawdzić przed zapisem (niepewne słowo, strona, granica zaznaczenia; odręczny dopisek czytelnika przy fragmencie) — widać to tylko przy przeglądaniu, nie jest zapisywane'],
  ['page', 'Strona, np. "23" albo "23–24" — zamiast "locator" (staje się „s. 23”)'],
  ['uncertain', 'true, gdy odczyt słowa, strona albo granica zaznaczenia jest niepewna (do sprawdzenia przed zapisem)'],
  ['id', 'Tylko przy poprawianiu wyeksportowanych cytatów: ich "id" — wtedy cytat jest zmieniany, nie dodawany']
];

const QUOTE_EXAMPLE = {
  text: 'Modlitwa jest rozmową z Bogiem, w której człowiek staje się sobą.',
  page: '168',
  check: 'Dopisek ołówkiem: „do kazania na XVII niedzielę”.'
};

/** Was ein Zitat im Dokument haben kann — aus den Feldern der Art „Cytat" (ohne „work": das ist das Buch). */
export function quoteFieldsDoc(): string {
  const def = kindOf('quote')!;
  const own = def.fields.filter((f) => f.key !== 'work').map((f) => `  "${f.key}" — ${f.label}: ${f.says}`);
  const extra = EXTRA_SAYS.map(([k, s]) => `  "${k}" — ${s}`);
  return [...own, ...extra].join('\n');
}

export function quotesDescription(work: LibEntry): string {
  const summary = workSummary(work);
  return `# Cytaty jednej książki jako JSON ("${QUOTES_FORMAT}", wersja ${QUOTES_VERSION})

Co robi import (na stronie książki „${summary.title}”):
- Każdy cytat staje się wpisem „Cytat” z tą książką jako źródłem; klucz cytowania nadaje się sam (${work.key ?? 'klucz'}-1, ${work.key ?? 'klucz'}-2, …).
- Przed zapisem widać listę: każdy cytat można poprawić albo odznaczyć.
- Cytat, który już jest w tej książce (ten sam tekst), jest odznaczony. Cytat z "id" z eksportu jest zmieniany w miejscu.
- Cytaty trafiają do biblioteki tej książki — widzą je ci, którzy widzą jej obszar. Biblioteka trzyma tylko źródła: cytaty nie mają tematów ani komentarzy (własne myśli to rodzaj w Nauce).
- Starsze pola ("topics", "comment", "description", "notes") są tylko pokazywane przy sprawdzaniu — nie są zapisywane.
- Nic nie jest usuwane.
Zwróć JEDEN obiekt JSON, bez komentarzy.

{
  "format": "${QUOTES_FORMAT}",
  "version": ${QUOTES_VERSION},
  "work": ${JSON.stringify(summary)},
  "quotes": [ { … }, … ]
}

## Pola cytatu ("quotes": lista)
${quoteFieldsDoc()}
"text" jest wymagany. Akapity w "text" oddziel pustą linią.

Przykład:
${JSON.stringify({ format: QUOTES_FORMAT, version: QUOTES_VERSION, work: summary, quotes: [QUOTE_EXAMPLE] }, null, 2)}
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
    ? `Czytelnik zaznaczył w książce ołówkiem fragmenty, które chce zachować: podkreślenia, pionowe kreski albo nawiasy na marginesie, wykrzykniki, haczyki. Przepisz KAŻDY zaznaczony fragment jako osobny cytat. Tekstu niezaznaczonego nie przepisuj.`
    : `Każde zdjęcie pokazuje fragment do zachowania. Przepisz cały tekst główny z każdego zdjęcia jako cytat (bez żywej paginy, numeru strony i przypisów u dołu strony).`;
  return `Na zdjęciach są strony książki: ${bookLineFor(work, look)}.
${what}

Zasady:
- Przepisuj słowo w słowo, jak w druku: pisownia, interpunkcja, cudzysłowy. Niczego nie poprawiaj, nie streszczaj, nie tłumacz.
- Wyrazy podzielone na końcu wiersza złącz („modli-” + „twa” → „modlitwa”). Wewnątrz akapitu bez przejść do nowej linii; akapity oddziel pustą linią.
- Jeśli zaznaczenie zaczyna się albo kończy w środku zdania, przepisz dokładnie zaznaczony zakres. Pominięty środek oznacz „[…]”.
- Fragment, który przechodzi na następną stronę, to JEDEN cytat — "page": "23–24".
- Numer strony bierz z nadrukowanej paginy tej strony. Gdy go nie widać, zostaw "page" puste i ustaw "uncertain": true.
- Odręczny dopisek czytelnika przy fragmencie przepisz w "check" (sam fragment bez dopisku).
- Gdy nie masz pewności co do słowa albo granic zaznaczenia: "uncertain": true i krótko w "check", co sprawdzić.
- Kolejność cytatów: według stron.

${quotesDescription(work)}`;
}
