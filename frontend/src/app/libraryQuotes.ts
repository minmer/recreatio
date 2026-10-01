/**
 * DIE ZITATE EINES BUCHES — wie sie aus dem Lesen in die Bibliothek kommen.
 *
 * <b>Der gewöhnliche Weg:</b> lesen, mit dem Bleistift anstreichen, nach
 * ein paar Seiten die angestrichenen Seiten fotografieren. Eine KI liest die
 * Fotos und schreibt die Zitate als JSON — entweder gleich hier (mit eigenem
 * Schlüssel, `libraryAi.ts`) oder in einem beliebigen Chat, dem man das
 * Polecenie (`quotesPrompt`) und die Fotos gibt. Das JSON kommt auf der Seite
 * des Buches herein; jedes Zitat lässt sich vor dem Speichern prüfen, ändern
 * oder abwählen.
 *
 * <code>
 *   { "format": "recreatio/quotes", "version": 1,
 *     "work": { "key", "title", "isbn" },
 *     "quotes": [ { "text", "page", "description", "topics", "notes", "uncertain", "photo" } ] }
 * </code>
 *
 * Alle Zitate gehören dem Buch, auf dessen Seite importiert wird — das
 * „work" im Dokument sagt nur, wofür es geschrieben wurde. Die Felder sind
 * die der Art „Cytat" (`libraryKinds.ts`); die Beschreibung entsteht daraus,
 * wie die der ganzen Bibliothek (siehe [[json-import-export]]).
 */

import { isUuid } from './library';
import { citeSegs, newCiteState, segText } from './libraryCite';
import { ids, kindOf, slug, str, type EntryData, type LibEntry, type Lookup } from './libraryKinds';

export const QUOTES_FORMAT = 'recreatio/quotes';

/** Was ein Plan vom Bestand wissen muss. */
export interface QuoteBase extends Lookup {
  all(): readonly LibEntry[];
}

export interface TopicRef {
  /** Ein Thema, das es schon gibt … */
  readonly id?: string;
  /** … oder der Name eines neuen. */
  readonly name: string;
}

export interface QuoteItem {
  readonly n: number;
  /** Ein Zitat, das es schon gibt (aus einem Export) — es wird geändert, nicht verdoppelt. */
  readonly id?: string;
  readonly text: string;
  readonly locator: string;
  readonly description: string;
  readonly topics: readonly TopicRef[];
  readonly language: string;
  readonly translation: string;
  readonly notes: string;
  /** Die KI war sich nicht sicher — Wort, Seite oder Grenze des Anstrichs. */
  readonly uncertain: boolean;
  /** Von welchem Foto (ab 1). */
  readonly photo?: number;
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

/** Die erste Seitenzahl einer Stelle — zum Ordnen nach Seiten. */
export const pageNumber = (locator: string): number => {
  const m = /(\d+)/.exec(locator);
  return m === null ? Number.POSITIVE_INFINITY : Number(m[1]);
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
const line = (value: unknown): string => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '');

/** Themen: Namen („Modlitwa"), Schlüssel („@modlitwa") oder Kennungen — bekannte werden gefunden, die anderen neu. */
export function topicsOf(value: unknown, base: QuoteBase): TopicRef[] {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,;]/) : [];
  const topics = base.all().filter((e) => e.kind === 'topic');
  const out: TopicRef[] = [];
  for (const raw of list) {
    const t = line(raw);
    if (t === '') continue;
    const byId = isUuid(t) ? base.get(t) : undefined;
    const byKey = t.startsWith('@') ? base.byKey(t.slice(1)) : base.byKey(t);
    const byName = topics.find((e) => fold(str(e.data, 'name')) === fold(t.replace(/^@/, '')));
    const found = [byId, byKey, byName].find((e) => e?.kind === 'topic');
    const ref: TopicRef = found !== undefined ? { id: found.id, name: str(found.data, 'name') } : { name: t.replace(/^@/, '').trim() };
    if (!out.some((o) => (o.id !== undefined && o.id === ref.id) || fold(o.name) === fold(ref.name))) out.push(ref);
  }
  return out;
}

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
    const photo = typeof raw.photo === 'number' && Number.isInteger(raw.photo) && raw.photo > 0 ? raw.photo : undefined;
    items.push({
      n: index,
      ...(update === undefined ? {} : { id: update.id }),
      text,
      locator: locatorOf(raw.page, raw.locator),
      description: line(raw.description),
      topics: topicsOf(raw.topics, base),
      language: line(raw.language),
      translation: line(raw.translation),
      notes: line(raw.notes),
      uncertain: raw.uncertain === true,
      ...(photo === undefined ? {} : { photo }),
      keep: duplicateOf === undefined,
      ...(duplicateOf === undefined ? {} : { duplicateOf })
    });
  });

  const doubled = items.filter((i) => i.duplicateOf !== undefined).length;
  if (doubled > 0) warnings.push(`${doubled} z nich już jest w tej książce — odznaczone (można zaznaczyć mimo to).`);
  return { items, warnings };
}

/** Neue Themen, die die gewählten Zitate brauchen. */
export const newTopics = (items: readonly QuoteItem[]): string[] => {
  const out: string[] = [];
  for (const item of items) {
    if (!item.keep) continue;
    for (const t of item.topics) if (t.id === undefined && !out.some((o) => fold(o) === fold(t.name))) out.push(t.name);
  }
  return out;
};

/**
 * Speichern: erst die neuen Themen (wenn gewollt), dann die Zitate — neue mit
 * dem Buch als Quelle, geänderte an Ort und Stelle (nur die Felder, die
 * etwas sagen). `save` ist der Speicher der Bibliothek; der Schlüssel
 * (`ricci2016-3`) entsteht dort.
 */
export async function importQuotes(
  items: readonly QuoteItem[],
  work: LibEntry,
  base: QuoteBase,
  save: (input: { id?: string; kind: string; data: EntryData }) => Promise<{ id: string }>,
  options: { createTopics: boolean; stage?: (what: string) => void }
): Promise<{ saved: number; topics: number; failed: string[] }> {
  const chosen = items.filter((i) => i.keep);
  const topicIds = new Map<string, string>();
  let topics = 0;
  const failed: string[] = [];
  if (options.createTopics) {
    for (const name of newTopics(chosen)) {
      try {
        const done = await save({ kind: 'topic', data: { name } });
        topicIds.set(fold(name), done.id);
        topics += 1;
      } catch {
        failed.push(`Temat „${name}”`);
      }
    }
  }

  let saved = 0;
  for (const [index, item] of chosen.entries()) {
    options.stage?.(`Zapisywanie ${index + 1} z ${chosen.length}…`);
    const topicList = item.topics.map((t) => t.id ?? topicIds.get(fold(t.name))).filter((id): id is string => id !== undefined);
    const fields: EntryData = {
      text: item.text,
      locator: item.locator,
      description: item.description,
      language: item.language,
      translation: item.translation,
      notes: item.notes
    };
    const before = item.id === undefined ? undefined : base.get(item.id);
    const data: EntryData = { ...(before?.data ?? {}), work: work.id };
    for (const [k, v] of Object.entries(fields)) {
      if (typeof v === 'string' && v !== '') data[k] = v;
      else if (before === undefined) delete data[k];
    }
    if (topicList.length > 0) data.topics = topicList;
    try {
      await save({ ...(item.id === undefined ? {} : { id: item.id }), kind: 'quote', data });
      saved += 1;
    } catch {
      failed.push(`„${item.text.slice(0, 40)}…”`);
    }
  }
  return { saved, topics, failed };
}

/* -- Hinaus ------------------------------------------------------------------------------- */

/** Die Zitate des Buches als Dokument — zum Nachbessern (mit einer KI) und wieder Hereinholen. */
export function exportQuotes(work: LibEntry, base: QuoteBase): Record<string, unknown> {
  const quotes = base.all().filter((e) => e.kind === 'quote' && ids(e.data, 'work').includes(work.id))
    .sort((a, b) => pageNumber(str(a.data, 'locator')) - pageNumber(str(b.data, 'locator')));
  const topicName = (id: string) => { const t = base.get(id); return t === undefined ? null : str(t.data, 'name'); };
  return {
    format: QUOTES_FORMAT,
    version: 1,
    work: workSummary(work),
    quotes: quotes.map((q) => {
      const out: Record<string, unknown> = { id: q.id };
      for (const k of ['text', 'locator', 'description', 'language', 'translation', 'notes']) if (str(q.data, k) !== '') out[k] = str(q.data, k);
      const topics = ids(q.data, 'topics').map(topicName).filter((n): n is string => n !== null);
      if (topics.length > 0) out.topics = topics;
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
  ['page', 'Strona, np. "23" albo "23–24" — zamiast "locator" (staje się „s. 23”)'],
  ['uncertain', 'true, gdy odczyt słowa, strona albo granica zaznaczenia jest niepewna (do sprawdzenia przed zapisem)'],
  ['photo', 'Numer zdjęcia (1, 2, …), na którym jest ten fragment'],
  ['id', 'Tylko przy poprawianiu wyeksportowanych cytatów: ich "id" — wtedy cytat jest zmieniany, nie dodawany']
];

const QUOTE_EXAMPLE = {
  text: 'Modlitwa jest rozmową z Bogiem, w której człowiek staje się sobą.',
  page: '168',
  description: 'O modlitwie Jezusa na górze.',
  topics: ['Modlitwa'],
  notes: 'Do kazania na XVII niedzielę.'
};

/** Was ein Zitat im Dokument haben kann — aus den Feldern der Art „Cytat" (ohne „work": das ist das Buch). */
export function quoteFieldsDoc(): string {
  const def = kindOf('quote')!;
  const own = def.fields.filter((f) => f.key !== 'work').map((f) => {
    const says = f.key === 'topics' ? 'Tematy — nazwy ("Modlitwa") albo klucze ("@modlitwa"); nowe nazwy mogą stać się nowymi tematami' : f.says;
    return `  "${f.key}" — ${f.label}: ${says}${f.private === true ? ' (prywatne — nigdy nie jest publikowane)' : ''}`;
  });
  const extra = EXTRA_SAYS.map(([k, s]) => `  "${k}" — ${s}`);
  return [...own, ...extra].join('\n');
}

export function quotesDescription(work: LibEntry): string {
  const summary = workSummary(work);
  return `# Cytaty jednej książki jako JSON ("${QUOTES_FORMAT}", wersja 1)

Co robi import (na stronie książki „${summary.title}”):
- Każdy cytat staje się wpisem „Cytat” z tą książką jako źródłem; klucz cytowania nadaje się sam (${work.key ?? 'klucz'}-1, ${work.key ?? 'klucz'}-2, …).
- Przed zapisem widać listę: każdy cytat można poprawić, odznaczyć, sprawdzić ze zdjęciem.
- Cytat, który już jest w tej książce (ten sam tekst), jest odznaczony. Cytat z "id" z eksportu jest zmieniany w miejscu.
- Nic nie jest usuwane ani publikowane.
Zwróć JEDEN obiekt JSON, bez komentarzy.

{
  "format": "${QUOTES_FORMAT}",
  "version": 1,
  "work": ${JSON.stringify(summary)},
  "quotes": [ { … }, … ]
}

## Pola cytatu ("quotes": lista)
${quoteFieldsDoc()}
"text" jest wymagany. Akapity w "text" oddziel pustą linią.

Przykład:
${JSON.stringify({ format: QUOTES_FORMAT, version: 1, work: summary, quotes: [QUOTE_EXAMPLE] }, null, 2)}
`;
}

export type MarkMode = 'marked' | 'whole';

/** Wie das Buch in der Aufgabe heisst — die volle Angabe: „N. Ricci, Wielkość…, tłum. K. Werbowy, Poznań 2016". */
const bookLineFor = (work: LibEntry, look: Lookup): string => segText(citeSegs(work, '', look, newCiteState())) || str(work.data, 'title');

/**
 * Das Polecenie für die KI: was auf den Fotos zu lesen ist und wie. Mit
 * `withFormat` hängt die Beschreibung des JSON daran (für einen fremden
 * Chat); hier im Haus gibt das Werkzeug die Form vor (`libraryAi.ts`).
 */
export function quotesPrompt(work: LibEntry, look: QuoteBase, mode: MarkMode, withFormat: boolean): string {
  const topics = look.all().filter((e) => e.kind === 'topic').map((e) => str(e.data, 'name')).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pl')).slice(0, 120);
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
- Odręczny dopisek czytelnika przy fragmencie przepisz do "notes" (sam fragment bez dopisku).
- Gdy nie masz pewności co do słowa albo granic zaznaczenia: "uncertain": true i krótko w "notes", co sprawdzić.
- "description": jedno krótkie zdanie po polsku — o czym jest fragment.
- "topics": 1–3 krótkie tematy${topics.length > 0 ? `; jeśli pasują, użyj istniejących: ${topics.join(', ')}` : ''}.
- "photo": numer zdjęcia, na którym jest fragment (zdjęcia liczone od 1, w kolejności).
- Kolejność cytatów: według stron.${withFormat ? `

${quotesDescription(work)}` : ''}`;
}

/** Die Form, die die KI im Haus ausfüllt (Werkzeug mit Schema — so kommt sicher JSON zurück). */
export const QUOTES_TOOL = {
  name: 'zapisz_cytaty',
  description: 'Zapisuje cytaty odczytane ze zdjęć stron książki.',
  input_schema: {
    type: 'object',
    properties: {
      quotes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Dokładne brzmienie fragmentu' },
            page: { type: 'string', description: 'Strona, np. "23" albo "23–24"; puste, gdy nie widać' },
            description: { type: 'string', description: 'Jedno krótkie zdanie — o czym jest fragment' },
            topics: { type: 'array', items: { type: 'string' }, description: '1–3 tematy' },
            notes: { type: 'string', description: 'Dopisek czytelnika albo co sprawdzić' },
            uncertain: { type: 'boolean', description: 'Odczyt albo zaznaczenie niepewne' },
            photo: { type: 'integer', description: 'Numer zdjęcia, od 1' }
          },
          required: ['text']
        }
      }
    },
    required: ['quotes']
  }
} as const;
