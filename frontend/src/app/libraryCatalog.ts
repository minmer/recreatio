/**
 * EIN BUCH AUS DEM KATALOG — zur ISBN, was die Kataloge über es wissen, als
 * Felder eines Werks (`libraryKinds.ts`).
 *
 * Der Dienst ist nur der Bote (`LibraryCatalog.cs`): er fragt die Biblioteka
 * Narodowa (MARC 21 aus dem Katalog der Bibliotheken im Netz), e-ISBN (was
 * die Verlage gemeldet haben, ONIX) und Open Library und reicht die Antworten
 * herein. Gelesen wird HIER — wie alles in der Bibliothek.
 *
 * <b>Ein Buch, mehrere Beschreibungen.</b> Zu einer ISBN beschreiben oft
 * mehrere Bibliotheken mehrere Ausgaben (erste und zweite, broschiert und
 * gebunden — die ISBN wird manchmal weitergegeben). Welche man in der Hand
 * hält, weiss nur, wer sie in der Hand hält: alle werden gezeigt, die
 * wahrscheinlichste zuerst.
 *
 * <b>Personen gibt es einmal.</b> Steht „Ricci, Nicola" schon in der
 * Bibliothek, zeigt das Werk auf ihn; sonst entsteht er neu.
 */

import { newId } from './ids';
import { isbn13 } from './isbn';
import { personName, slug, str, type EntryData, type LibEntry } from './libraryKinds';
import { call } from './session';

export interface CatalogName {
  readonly given?: string;
  readonly surname?: string;
  readonly name?: string;
  readonly years?: string;
}

export interface CatalogBook {
  readonly source: 'bn' | 'e-isbn' | 'openlibrary';
  /** Woher genau — für die Auswahl und als Schlüssel in der Liste. */
  readonly ref: string;
  readonly isbn: string;
  /** Steht die ISBN in der Beschreibung als DIESE Ausgabe (nicht nur als „auch erschienen als")? */
  readonly exact: boolean;
  readonly title: string;
  readonly subtitle?: string;
  readonly originalTitle?: string;
  readonly authors: readonly CatalogName[];
  readonly editors: readonly CatalogName[];
  readonly translators: readonly CatalogName[];
  readonly edition?: string;
  readonly publisher?: string;
  readonly place?: string;
  readonly year?: string;
  readonly series?: string;
  readonly pageCount?: number;
  readonly height?: number;
  readonly width?: number;
  readonly length?: number;
  readonly binding?: string;
  readonly language?: string;
}

export const SOURCE_NAME: Record<CatalogBook['source'], string> = {
  bn: 'Katalog Biblioteki Narodowej',
  'e-isbn': 'e-ISBN (dane wydawcy)',
  openlibrary: 'Open Library'
};

/* -- Kleine Leser ------------------------------------------------------------------------ */

const fold = (text: string): string => slug(text).replace(/-/g, ' ').trim();

/** ISBD-Satzzeichen am Ende weg: „Poznań :", „Wydawnictwo M,", „Tytuł /", „2015." — Abkürzungen („s.", „ks.") behalten ihren Punkt. */
export function tidy(text: string | undefined): string {
  let t = (text ?? '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i += 1) {
    t = t.replace(/\s*[/:;,=+]\s*$/, '').trim();
    const dot = /(\S+)\.$/.exec(t);
    if (dot !== null && (dot[1]!.length > 4 || /^\d+$/.test(dot[1]!)) && !/\.\S*$/.test(dot[1]!)) t = t.slice(0, -1).trim();
  }
  return t.replace(/^\[(.*)\]$/, '$1').trim();
}

const yearOf = (text: string | undefined): string | undefined => /\b(1[4-9]\d\d|20\d\d)\b/.exec(text ?? '')?.[1];

/** „Ricci, Nicola" → Nachname und Vornamen; „Benedykt XVI" bleibt ein Name. */
export function nameOf(text: string, years?: string): CatalogName | null {
  const t = tidy(text).replace(/\s*\(.*$/, '');
  if (t === '') return null;
  const y = years === undefined ? undefined : tidy(years).replace(/[()]/g, '').replace(/-/g, '–').trim() || undefined;
  const comma = t.indexOf(',');
  if (comma > 0) {
    const surname = t.slice(0, comma).trim();
    const given = tidy(t.slice(comma + 1));
    return { surname, ...(given === '' ? {} : { given }), ...(y === undefined ? {} : { years: y }) };
  }
  const words = t.split(' ');
  /* „Nicola Ricci" (so schreiben Verlage bei e-ISBN): der letzte Teil ist der Nachname. */
  if (words.length >= 2 && words.every((w) => /^\p{Lu}/u.test(w)) && !/\b[IVX]+$/.test(t)) {
    return { given: words.slice(0, -1).join(' '), surname: words[words.length - 1]!, ...(y === undefined ? {} : { years: y }) };
  }
  return { name: t, ...(y === undefined ? {} : { years: y }) };
}

const nameText = (n: CatalogName): string => n.name ?? [n.given, n.surname].filter(Boolean).join(' ');

const BINDING_WORDS: readonly [RegExp, string][] = [
  [/skrzyd/i, 'soft-flaps'], [/mi[eę]k|broszur|paperback|softcover|\bBC\b/i, 'soft'], [/tward|hardback|hardcover|\bBB\b/i, 'hard'],
  [/zintegr/i, 'integrated'], [/p[lł][oó]cien|cloth/i, 'cloth'], [/sk[oó]r/i, 'leather'], [/spiral/i, 'spiral']
];

export function bindingOf(text: string | undefined): string | undefined {
  if (text === undefined || text.trim() === '') return undefined;
  return BINDING_WORDS.find(([pattern]) => pattern.test(text))?.[1];
}

const ORDINALS: Record<string, string> = {
  pierwsze: '1', drugie: '2', trzecie: '3', czwarte: '4', piąte: '5', szóste: '6', siódme: '7', ósme: '8', dziewiąte: '9', dziesiąte: '10'
};
const ROMAN: Record<string, string> = { I: '1', II: '2', III: '3', IV: '4', V: '5', VI: '6', VII: '7', VIII: '8', IX: '9', X: '10' };

/** „Wydanie drugie." → „2", „Wyd. 3 popr." → „3 popr."; was sich nicht lesen lässt, bleibt Text. */
export function editionOf(text: string | undefined): string | undefined {
  const t = tidy(text);
  if (t === '') return undefined;
  const rest = t.replace(/^(wydanie|wyd\.?)\s*/i, '');
  const word = rest.split(/\s+/)[0]!.toLowerCase();
  const tail = rest.split(/\s+/).slice(1).join(' ');
  const n = ORDINALS[word] ?? ROMAN[rest.split(/\s+/)[0]!.replace(/\.$/, '')] ?? (/^\d+/.exec(word)?.[0]);
  return n === undefined ? t : [n, tail].filter(Boolean).join(' ');
}

const LANGUAGES: Record<string, string> = {
  pol: 'pl', lat: 'la', ita: 'it', eng: 'en', ger: 'de', deu: 'de', fre: 'fr', fra: 'fr', spa: 'es', rus: 'ru', ukr: 'uk',
  cze: 'cs', ces: 'cs', slo: 'sk', slk: 'sk', por: 'pt', gre: 'el', grc: 'grc', heb: 'he', hun: 'hu', lit: 'lt', dut: 'nl', nld: 'nl'
};
const languageOf = (code: string | undefined): string | undefined => (code === undefined || code.trim() === '' ? undefined : LANGUAGES[code.trim().toLowerCase()] ?? code.trim().toLowerCase());

const decimal = (text: string | undefined): number | undefined => {
  if (text === undefined) return undefined;
  const n = Number(text.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const role = (relator: string): 'author' | 'editor' | 'translator' | null => {
  const r = relator.toLowerCase();
  if (/t[lł]\.|t[lł]um|trl|transl|przek[lł]/.test(r)) return 'translator';
  if (/red|edt|edit|oprac|wyb[oó]r|compil|\bcom\b/.test(r)) return 'editor';
  if (/aut|wsp[oó][lł]aut/.test(r)) return 'author';
  return null;
};

/* -- MARC 21 (Biblioteka Narodowa) ------------------------------------------------------------- */

type MarcField = Record<string, string | { ind1?: string; ind2?: string; subfields: Record<string, string>[] }>;
interface DataField { readonly tag: string; readonly ind1: string; readonly ind2: string; readonly subs: readonly [string, string][] }

function dataFields(fields: readonly MarcField[]): DataField[] {
  const out: DataField[] = [];
  for (const one of fields) {
    const [tag, value] = Object.entries(one)[0] ?? [];
    if (tag === undefined || typeof value !== 'object' || value === null || !Array.isArray(value.subfields)) continue;
    out.push({ tag, ind1: value.ind1 ?? ' ', ind2: value.ind2 ?? ' ', subs: value.subfields.flatMap((s) => Object.entries(s)) as [string, string][] });
  }
  return out;
}

const sub = (field: DataField | undefined, code: string): string | undefined => field?.subs.find(([c]) => c === code)?.[1];
const subs = (field: DataField, code: string): string[] => field.subs.filter(([c]) => c === code).map(([, v]) => v);

export function fromMarc(fields: readonly MarcField[], isbn: string, ref: string): CatalogBook | null {
  const all = dataFields(fields);
  const first = (tag: string) => all.find((f) => f.tag === tag);
  const t245 = first('245');
  const title = tidy([sub(t245, 'a'), sub(t245, 'n'), sub(t245, 'p')].filter(Boolean).map((p) => tidy(p)).join('. '));
  if (title === '') return null;
  const subtitle = tidy(sub(t245, 'b'));

  /* Diese Ausgabe? 020 $a ist die ISBN der beschriebenen Ausgabe, $z eine falsche oder fremde. */
  const isbnFields = all.filter((f) => f.tag === '020');
  const mine = isbnFields.find((f) => isbn13(sub(f, 'a') ?? '') === isbn);
  const binding = bindingOf(sub(mine, 'q'));

  const authors: CatalogName[] = [];
  const editors: CatalogName[] = [];
  const translators: CatalogName[] = [];
  const seen = new Set<string>();
  const put = (who: CatalogName | null, as: 'author' | 'editor' | 'translator') => {
    if (who === null) return;
    const k = `${as}:${fold(nameText(who))}`;
    if (seen.has(k)) return;
    seen.add(k);
    (as === 'author' ? authors : as === 'editor' ? editors : translators).push(who);
  };
  for (const f of all.filter((x) => x.tag === '100' || x.tag === '700')) {
    const relators = [...subs(f, 'e'), ...subs(f, '4')].join(' ');
    const as = relators === '' ? (f.tag === '100' ? 'author' : null) : role(relators);
    if (as === null) continue;
    put(nameOf(sub(f, 'a') ?? '', sub(f, 'd')), as);
  }

  const imprint = all.find((f) => f.tag === '264' && f.ind2 === '1') ?? first('260') ?? first('264');
  const physical = first('300');
  const extent = sub(physical, 'a') ?? '';
  const pages = [...extent.matchAll(/(\d+)\s*(?:s\.|str\.|stron|p\.|pages|pp\.)/gi)].map((m) => Number(m[1]));
  const size = /(\d+(?:[.,]\d+)?)\s*(?:x\s*(\d+(?:[.,]\d+)?))?\s*(?:x\s*(\d+(?:[.,]\d+)?))?\s*cm/i.exec(sub(physical, 'c') ?? '');

  const t041 = first('041');
  const translated = t041?.ind1 === '1' || (t041 !== undefined && sub(t041, 'h') !== undefined);
  const notedOriginal = all.filter((f) => f.tag === '500').map((f) => sub(f, 'a') ?? '')
    .map((n) => /^(?:Tyt\.?\s*oryg\.?|Tytuł oryginału)\s*:\s*(.+)$/i.exec(n)?.[1]).find((x) => x !== undefined);
  const t246 = all.find((f) => f.tag === '246' && /oryg/i.test(sub(f, 'i') ?? '') && (sub(f, 'a') ?? '').length > 2);
  const originalTitle = tidy((translated ? sub(first('240'), 'a') : undefined) ?? notedOriginal ?? sub(t246, 'a') ?? sub(first('765'), 't'));

  const seriesField = first('490') ?? first('830');
  const series = seriesField === undefined ? '' : [tidy(sub(seriesField, 'a')), tidy(sub(seriesField, 'v'))].filter(Boolean).join(', ');
  const control008 = fields.map((f) => f['008']).find((v): v is string => typeof v === 'string');

  return {
    source: 'bn',
    ref,
    isbn,
    exact: mine !== undefined,
    title,
    ...(subtitle === '' ? {} : { subtitle }),
    ...(originalTitle === '' || originalTitle === title ? {} : { originalTitle }),
    authors, editors, translators,
    ...optional('edition', editionOf(sub(first('250'), 'a'))),
    ...optional('publisher', tidy(sub(imprint, 'b')) || undefined),
    ...optional('place', tidy(sub(imprint, 'a')) || undefined),
    ...optional('year', yearOf(sub(imprint, 'c'))),
    ...optional('series', series || undefined),
    ...optional('pageCount', pages.length > 0 ? pages[pages.length - 1] : undefined),
    ...optional('height', decimal(size?.[1])),
    ...optional('width', decimal(size?.[2])),
    ...optional('length', decimal(size?.[3])),
    ...optional('binding', binding),
    ...optional('language', languageOf(sub(t041, 'a') ?? control008?.slice(35, 38)))
  };
}

function optional<K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } {
  return (value === undefined ? {} : { [key]: value }) as { [P in K]?: V };
}

/* -- ONIX 3 (e-ISBN) --------------------------------------------------------------------------- */

const entity = (text: string): string => text
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
  .replace(/&amp;/g, '&');

/** Der Inhalt aller `<Tag>` — ONIX ist flach genug, dass kein ganzer XML-Leser nötig ist. */
const blocks = (xml: string, tag: string): string[] =>
  [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => m[1]!);
const text = (xml: string | undefined, tag: string): string | undefined => {
  if (xml === undefined) return undefined;
  const found = blocks(xml, tag)[0];
  return found === undefined ? undefined : entity(found.replace(/<[^>]+>/g, '')).trim() || undefined;
};

export function fromOnix(xml: string, isbn: string): CatalogBook | null {
  const product = blocks(xml, 'Product')[0];
  if (product === undefined) return null;
  const detail = blocks(product, 'DescriptiveDetail')[0] ?? product;
  const titleDetail = blocks(detail, 'TitleDetail').find((t) => text(t, 'TitleType') === '01') ?? blocks(detail, 'TitleDetail')[0];
  const title = text(titleDetail, 'TitleText') ?? [text(titleDetail, 'TitlePrefix'), text(titleDetail, 'TitleWithoutPrefix')].filter(Boolean).join(' ');
  if (title === undefined || title === '') return null;

  const authors: CatalogName[] = [];
  const editors: CatalogName[] = [];
  const translators: CatalogName[] = [];
  for (const c of blocks(detail, 'Contributor')) {
    const code = text(c, 'ContributorRole') ?? '';
    const as = code.startsWith('A0') ? 'author' : code === 'B06' ? 'translator' : code.startsWith('B0') || code === 'B12' ? 'editor' : null;
    if (as === null) continue;
    const given = text(c, 'NamesBeforeKey');
    const key = text(c, 'KeyNames');
    const who = key !== undefined ? { surname: key, ...(given === undefined ? {} : { given }) }
      : nameOf(text(c, 'PersonName') ?? text(c, 'PersonNameInverted') ?? text(c, 'CorporateName') ?? '');
    if (who !== null) (as === 'author' ? authors : as === 'editor' ? editors : translators).push(who);
  }

  const measures = blocks(detail, 'Measure').map((m) => {
    const value = decimal(text(m, 'Measurement'));
    const unit = text(m, 'MeasureUnitCode');
    return { type: text(m, 'MeasureType'), cm: value === undefined ? undefined : unit === 'mm' ? value / 10 : unit === 'cm' ? value : undefined };
  });
  const measure = (type: string) => measures.find((m) => m.type === type)?.cm;
  const pages = blocks(detail, 'Extent').find((e) => ['00', '11', '07'].includes(text(e, 'ExtentType') ?? '') && (text(e, 'ExtentUnit') ?? '03') === '03');
  const form = text(detail, 'ProductForm') ?? '';
  const collection = blocks(detail, 'Collection')[0];
  const series = collection === undefined ? undefined
    : [text(collection, 'TitleText'), text(collection, 'PartNumber')].filter(Boolean).join(', t. ') || undefined;
  const publishing = blocks(product, 'PublishingDetail')[0] ?? product;
  const edition = text(detail, 'EditionNumber');

  return {
    source: 'e-isbn',
    ref: `e-isbn:${isbn}`,
    isbn,
    exact: true,
    title,
    ...optional('subtitle', text(titleDetail, 'Subtitle')),
    authors, editors, translators,
    ...optional('edition', edition === '1' ? undefined : edition),
    ...optional('publisher', text(publishing, 'PublisherName') ?? text(publishing, 'ImprintName')),
    ...optional('place', text(publishing, 'CityOfPublication')),
    ...optional('year', yearOf(text(publishing, 'Date')?.slice(0, 4))),
    ...optional('series', series),
    ...optional('pageCount', pages === undefined ? undefined : decimal(text(pages, 'ExtentValue'))),
    ...optional('height', measure('01')),
    ...optional('width', measure('02')),
    ...optional('length', measure('03')),
    ...optional('binding', form === 'BB' ? 'hard' : form === 'BC' ? 'soft' : form === 'BE' ? 'spiral' : form.startsWith('E') ? 'ebook' : undefined),
    ...optional('language', languageOf(text(detail, 'LanguageCode')))
  };
}

/* -- Open Library ------------------------------------------------------------------------------ */

interface OpenLibraryBook {
  title?: string;
  subtitle?: string;
  authors?: { name?: string }[];
  publishers?: { name?: string }[];
  publish_places?: { name?: string }[];
  publish_date?: string;
  number_of_pages?: number;
}

export function fromOpenLibrary(book: OpenLibraryBook, isbn: string): CatalogBook | null {
  if (typeof book.title !== 'string' || book.title.trim() === '') return null;
  return {
    source: 'openlibrary',
    ref: `openlibrary:${isbn}`,
    isbn,
    exact: true,
    title: book.title.trim(),
    ...optional('subtitle', book.subtitle?.trim() || undefined),
    authors: (book.authors ?? []).map((a) => nameOf(a.name ?? '')).filter((n): n is CatalogName => n !== null),
    editors: [],
    translators: [],
    ...optional('publisher', book.publishers?.[0]?.name?.trim() || undefined),
    ...optional('place', book.publish_places?.[0]?.name?.trim() || undefined),
    ...optional('year', yearOf(book.publish_date)),
    ...optional('pageCount', typeof book.number_of_pages === 'number' && book.number_of_pages > 0 ? book.number_of_pages : undefined)
  };
}

/* -- Fragen ------------------------------------------------------------------------------------ */

export interface CatalogAnswer {
  readonly isbn: string;
  readonly sources: readonly (
    | { readonly source: 'bn'; readonly records: readonly { readonly id?: number | string; readonly fields: readonly MarcField[] }[] }
    | { readonly source: 'e-isbn'; readonly onix: string }
    | { readonly source: 'openlibrary'; readonly book: OpenLibraryBook }
  )[];
}

/** Wie vollständig eine Beschreibung ist — die vollere zuerst. */
const fullness = (b: CatalogBook): number =>
  ['subtitle', 'originalTitle', 'edition', 'publisher', 'place', 'year', 'series', 'pageCount', 'height', 'binding', 'language']
    .filter((k) => (b as unknown as Record<string, unknown>)[k] !== undefined).length + b.authors.length + b.translators.length + b.editors.length;

/** Alle Beschreibungen einer Antwort, die wahrscheinlichste zuerst: diese Ausgabe vor „auch erschienen als", BN vor e-ISBN vor Open Library, die vollere vor der dürren. */
export function booksOf(answer: CatalogAnswer): CatalogBook[] {
  const out: CatalogBook[] = [];
  for (const one of answer.sources) {
    if (one.source === 'bn') {
      for (const record of one.records) {
        const book = fromMarc(record.fields, answer.isbn, `bn:${String(record.id ?? out.length)}`);
        if (book !== null) out.push(book);
      }
    } else if (one.source === 'e-isbn') {
      const book = fromOnix(one.onix, answer.isbn);
      if (book !== null) out.push(book);
    } else {
      const book = fromOpenLibrary(one.book, answer.isbn);
      if (book !== null) out.push(book);
    }
  }
  const order: CatalogBook['source'][] = ['bn', 'e-isbn', 'openlibrary'];
  return out.map((b, i) => ({ b, i })).sort((x, y) =>
    Number(y.b.exact) - Number(x.b.exact)
    || order.indexOf(x.b.source) - order.indexOf(y.b.source)
    || fullness(y.b) - fullness(x.b)
    || x.i - y.i).map(({ b }) => b);
}

/** Der Dienst fragt die Kataloge — ohne Sitzung: welches Buch jemand sucht, hängt an keinem Konto. */
export async function lookupIsbn(isbn: string): Promise<CatalogBook[]> {
  const answer = await call<CatalogAnswer>(`/library/catalog/${encodeURIComponent(isbn)}`, { credentials: 'omit' });
  return booksOf(answer);
}

/** Eine Zeile zur Auswahl: Ausgabe, Ort, Verlag, Jahr, Seiten, Einband. */
export function bookLine(book: CatalogBook): string {
  return [
    book.edition === undefined ? '' : /^\d/.test(book.edition) ? `wyd. ${book.edition}` : book.edition,
    [book.place, [book.publisher, book.year].filter(Boolean).join(' ')].filter(Boolean).join(': '),
    book.pageCount === undefined ? '' : `${book.pageCount} s.`,
    book.height === undefined ? '' : `${String(book.height).replace('.', ',')} cm`,
    book.binding === 'hard' ? 'oprawa twarda' : book.binding === 'soft' ? 'oprawa miękka' : book.binding === undefined ? '' : `oprawa: ${book.binding}`,
    book.series ?? ''
  ].filter(Boolean).join(' · ');
}

export const peopleLine = (book: CatalogBook): string => [
  book.authors.map(nameText).join(', '),
  book.editors.length > 0 ? `red. ${book.editors.map(nameText).join(', ')}` : '',
  book.translators.length > 0 ? `tłum. ${book.translators.map(nameText).join(', ')}` : ''
].filter(Boolean).join(' · ');

/* -- Ins Werk ---------------------------------------------------------------------------------- */

export interface BookPlan {
  /** Personen, die neu entstehen (die anderen gibt es schon). */
  readonly persons: readonly { readonly id: string; readonly data: EntryData }[];
  /** Was ins Werk geht — bei einem bestehenden nur, was dort noch leer ist. */
  readonly data: EntryData;
  /** Welche Felder gesetzt werden, für die Anzeige. */
  readonly filled: readonly string[];
}

const FILLED_LABEL: Record<string, string> = {
  title: 'tytuł', subtitle: 'podtytuł', originalTitle: 'tytuł oryginału', authors: 'autorzy', editors: 'redakcja', translators: 'tłumaczenie',
  edition: 'wydanie', publisher: 'wydawca', place: 'miejsce', year: 'rok', series: 'seria', pageCount: 'liczba stron',
  height: 'wysokość', width: 'szerokość', length: 'grubość', binding: 'oprawa', language: 'język', isbn: 'ISBN'
};

/**
 * Das Werk aus einer Beschreibung. `existing`: die Daten eines Werks, das
 * schon da ist — dann wird nur gefüllt, was leer ist; nichts, was jemand
 * eingetragen hat, wird überschrieben.
 */
export function planBook(book: CatalogBook, people: readonly LibEntry[], existing?: EntryData): BookPlan {
  const persons: { id: string; data: EntryData }[] = [];
  const known = new Map<string, string>();
  for (const p of people) {
    const name = personName(p.data);
    known.set(fold(name), p.id);
    const surname = str(p.data, 'surname');
    const given = str(p.data, 'givenNames');
    if (surname !== '' && given !== '') known.set(fold(`${surname} ${given}`), p.id);
  }
  const idOf = (who: CatalogName): string => {
    const k = fold(nameText(who));
    const found = known.get(k);
    if (found !== undefined) return found;
    const id = newId();
    known.set(k, id);
    persons.push({
      id,
      data: who.name !== undefined
        ? { personType: 'person', name: who.name, ...(who.years === undefined ? {} : { years: who.years }) }
        : { personType: 'person', ...(who.given === undefined ? {} : { givenNames: who.given }), surname: who.surname ?? '', ...(who.years === undefined ? {} : { years: who.years }) }
    });
    return id;
  };

  const before = existing ?? {};
  const empty = (key: string) => {
    const v = before[key];
    return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  };
  const data: EntryData = {};
  const filled: string[] = [];
  const give = (key: string, value: unknown) => {
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0) || !empty(key)) return;
    data[key] = value;
    filled.push(FILLED_LABEL[key] ?? key);
  };

  if (empty('workType')) data.workType = 'book';
  give('title', book.title);
  give('subtitle', book.subtitle);
  give('originalTitle', book.originalTitle);
  /* Personen erst anlegen, wenn das Feld wirklich gefüllt wird. */
  if (empty('authors') && book.authors.length > 0) give('authors', book.authors.map(idOf));
  if (empty('editors') && book.editors.length > 0) give('editors', book.editors.map(idOf));
  if (empty('translators') && book.translators.length > 0) give('translators', book.translators.map(idOf));
  give('edition', book.edition);
  give('publisher', book.publisher);
  give('place', book.place);
  give('year', book.year);
  give('series', book.series);
  give('pageCount', book.pageCount);
  give('height', book.height);
  give('width', book.width);
  give('length', book.length);
  give('binding', book.binding);
  give('language', book.language);
  give('isbn', book.isbn);
  return { persons, data, filled };
}

/** Steht diese ISBN schon in einem Werk? */
export function worksWithIsbn(works: readonly LibEntry[], isbn: string, isbnsOf: (text: string) => string[]): LibEntry[] {
  return works.filter((w) => isbnsOf(str(w.data, 'isbn')).includes(isbn));
}

/** Die nächste freie Nummer in der Art der zuletzt vergebenen: „B-0123" → „B-0124". */
export function nextLibraryNumber(works: readonly (LibEntry & { readonly updatedAt?: string })[]): string {
  const numbered = works
    .map((w) => ({ n: str(w.data, 'libraryNumber').trim(), at: w.updatedAt ?? '' }))
    .map((w) => ({ ...w, m: /^(.*?)(\d+)$/.exec(w.n) }))
    .filter((w): w is { n: string; at: string; m: RegExpExecArray } => w.m !== null);
  if (numbered.length === 0) return '1';
  const latest = [...numbered].sort((a, b) => b.at.localeCompare(a.at))[0]!;
  const prefix = latest.m[1]!;
  const width = latest.m[2]!.length;
  const top = Math.max(...numbered.filter((w) => w.m[1] === prefix).map((w) => Number(w.m[2])));
  return `${prefix}${String(top + 1).padStart(width, '0')}`;
}

/** Werke mit derselben eigenen Nummer — eine Nummer gehört einem Exemplar. */
export const sameNumber = (works: readonly LibEntry[], number: string, except: string): LibEntry[] =>
  number.trim() === '' ? [] : works.filter((w) => w.id !== except && fold(str(w.data, 'libraryNumber')) === fold(number));

