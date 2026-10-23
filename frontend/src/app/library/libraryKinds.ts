/**
 * DIE ARTEN DER BIBLIOTHEK (0064) — was ein Eintrag sein kann, an EINER Stelle.
 *
 * <b>Wie die Bausteine einer Seite (`part.ts`):</b> eine Art sagt, welche
 * Felder sie hat, welche davon privat bleiben, worauf sie verweist, wie sie
 * heisst und wie sie sortiert wird. Der Editor zeichnet daraus sein Formular,
 * die Veröffentlichung ihre offene Fassung, der JSON-Import seine
 * Beschreibung. Eine neue Art (später für Cogita: Wort, Satz, Frage) ist ein
 * Eintrag in `KINDS` — nichts sonst muss sie kennen.
 *
 * <b>Ein Werk gibt es einmal.</b> Ein Zitat zeigt auf sein Werk, das Werk
 * auf seine Autoren, ein Text (eine Predigt, ein Kapitel) nennt Werke und
 * Zitate über ihren Zitierschlüssel (`[@ratzinger2007, s. 23]`). Wer den
 * Titel eines Werks berichtigt, berichtigt ihn überall, wo es genannt wird.
 *
 * <b>Wer einen Eintrag liest, entscheidet sein Bereich — und nur er</b>
 * (2026-10-22). Es gibt keine privaten Felder und kein einzelnes
 * Veröffentlichen.
 *
 * <b>2026-10-23 — DREI TEILE.</b> Die Bibliothek hält nur noch Quellen
 * (`LIBRARY_KINDS`: Werke, Zitate, Personen) und zeigt nur auf Quellen. Das
 * Schreiben (`WRITING_KINDS`: Texte, Wygłoszenia, Projekte) steht im
 * Skryptorium; Komentarze und alles Geordnete sind eigene Arten in Cogita.
 * Themen gibt es keine mehr. `kindOf` kennt beide Gruppen — gelesen und
 * zitiert wird über die Teile hinweg.
 */

import { locatorKey } from './bible';
import { blockMarkups, blockRefs, blocksOf, commentTitle } from './comment';
import { mapRefTokens } from './libraryMarkup';

export type EntryData = Record<string, unknown>;

/** Was eine Art von einem Eintrag braucht — der ganze Eintrag oder seine offene Fassung. */
export interface LibEntry {
  readonly id: string;
  readonly kind: string;
  readonly key?: string;
  readonly data: EntryData;
}

/** Wie man einen Eintrag findet — im Speicher des Browsers oder in einer veröffentlichten Sammlung. */
export interface Lookup {
  get(id: string): LibEntry | undefined;
  byKey(key: string): LibEntry | undefined;
  /**
   * 2026-10-21 — wer auf einen Eintrag zeigt. Nur der Speicher im Browser
   * kennt es (die Wygłoszenia eines Textes); eine veröffentlichte Sammlung
   * nennt sie im Text selbst (`deliveries`).
   */
  backlinks?(id: string): readonly LibEntry[];
  /** 2026-10-22 — alles Lesbare, über die Bibliothek hinaus (für „Komentarze o tym wpisie"). */
  readable?(): readonly LibEntry[];
  /** 2026-10-22 — wie ein Eintrag heisst, wo die Bibliothek seine Art nicht kennt (ein Eintrag einer Baza wiedzy). */
  title?(entry: LibEntry): string;
}

/**
 * `items` (2026-10-21): eine Liste von Objekten mit eigenen Feldern (`LibField.item`)
 * — die Punkte eines Plans, die Zeilen „co z planu" eines Wygłoszenia.
 * `blocks` (2026-10-22): der Inhalt eines Komentarza — Absätze, Listen,
 * Tabellen, in deren Zellen echte Verweise stehen (`comment.ts`).
 */
export type LibFieldType = 'line' | 'text' | 'markup' | 'number' | 'date' | 'select' | 'url' | 'ref' | 'refs' | 'outline' | 'items' | 'blocks';

export interface LibField {
  readonly key: string;
  readonly label: string;
  readonly type: LibFieldType;
  /** Was das Feld im JSON bedeutet — für die Beschreibung neben dem Import. */
  readonly says: string;
  readonly hint?: string;
  readonly options?: readonly { readonly value: string; readonly label: string }[];
  /** Bei `ref`/`refs`: auf welche Arten es zeigen darf. */
  readonly to?: readonly string[];
  /** Nur gezeigt, wenn — etwa Seitenzahlen nur bei Kapitel und Artikel. */
  readonly when?: (data: EntryData) => boolean;
  /**
   * 2026-10-21 — bei `items`: die Felder EINES Eintrags der Liste. Sie werden
   * beschrieben, importiert und durchsucht wie die Felder einer Art.
   */
  readonly item?: readonly LibField[];
}

export interface LibKind {
  readonly kind: string;
  readonly label: string;
  readonly plural: string;
  /** Wozu die Art da ist, in einem Satz. */
  readonly says: string;
  /** Trägt sie einen Zitierschlüssel (`[@schlüssel]`)? */
  readonly keyed: boolean;
  readonly fields: readonly LibField[];
  readonly title: (data: EntryData, look: Lookup) => string;
  /** Wonach sie in Listen und öffentlich geordnet wird. */
  readonly sort: (entry: LibEntry, look: Lookup) => string;
  /** Ein ausgefülltes Beispiel für die Beschreibung (Verweise als `@schlüssel`). */
  readonly example: { readonly key?: string; readonly data: EntryData };
}

/* -- Duldsame Leser ------------------------------------------------------------------ */

export const str = (data: EntryData, key: string): string => {
  const value = data[key];
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
};

export const ids = (data: EntryData, key: string): string[] => {
  const value = data[key];
  if (Array.isArray(value)) return value.filter((one): one is string => typeof one === 'string' && one !== '');
  return typeof value === 'string' && value !== '' ? [value] : [];
};

export const num = (data: EntryData, key: string): number | null => {
  const value = data[key];
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

/** Die Einträge eines `items`-Feldes — duldsam: was kein Objekt ist, fällt weg. */
export function itemsOf(data: EntryData, key: string): Record<string, unknown>[] {
  const value = data[key];
  if (!Array.isArray(value)) return [];
  return value.filter((one): one is Record<string, unknown> => typeof one === 'object' && one !== null && !Array.isArray(one));
}

/** Ein Punkt der Gliederung eines Projekts: eine Überschrift oder ein Text. */
export type OutlineItem = { readonly heading: string } | { readonly text: string };

export function outline(data: EntryData, key = 'outline'): OutlineItem[] {
  const value = data[key];
  if (!Array.isArray(value)) return [];
  const out: OutlineItem[] = [];
  for (const one of value) {
    if (typeof one !== 'object' || one === null) continue;
    const item = one as Record<string, unknown>;
    if (typeof item.text === 'string' && item.text !== '') out.push({ text: item.text });
    else if (typeof item.heading === 'string') out.push({ heading: item.heading });
  }
  return out;
}

const clip = (text: string, length: number): string =>
  text.length <= length ? text : `${text.slice(0, length - 1).trimEnd()}…`;

/** Polnisch nach ASCII, für Schlüssel: „Świętość” → „swietosc”. */
export function slug(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/* -- Personen ---------------------------------------------------------------------------- */

export const personName = (data: EntryData): string =>
  str(data, 'name').trim() || [str(data, 'givenNames'), str(data, 'surname')].map((s) => s.trim()).filter(Boolean).join(' ') || 'Osoba';

const PERSON: LibKind = {
  kind: 'person',
  label: 'Osoba',
  plural: 'Osoby',
  says: 'Autor, redaktor, tłumacz — albo instytucja, która wydała dokument.',
  keyed: true,
  fields: [
    {
      key: 'personType', label: 'Kto to', type: 'select', says: '"person" — osoba, "organization" — instytucja',
      options: [{ value: 'person', label: 'Osoba' }, { value: 'organization', label: 'Instytucja' }]
    },
    { key: 'name', label: 'Jak się nazywa', type: 'line', says: 'Pełna nazwa, gdy nie dzieli się na imię i nazwisko (np. "Franciszek", "św. Augustyn", "Kongregacja Nauki Wiary")', hint: 'np. św. Augustyn' },
    { key: 'givenNames', label: 'Imiona', type: 'line', says: 'Imiona — w przypisach skracane do inicjałów', hint: 'np. Joseph' },
    { key: 'surname', label: 'Nazwisko', type: 'line', says: 'Nazwisko — według niego układa się bibliografia', hint: 'np. Ratzinger' },
    { key: 'years', label: 'Lata', type: 'line', says: 'Lata życia albo działalności', hint: 'np. 1927–2022' },
    { key: 'description', label: 'Opis', type: 'text', says: 'Krótki opis osoby (biogram) — widoczny przy jej źródłach' },
    { key: 'url', label: 'Adres strony', type: 'url', says: 'Strona o tej osobie (np. biografia)' }
  ],
  title: (data) => personName(data),
  sort: (entry) => (str(entry.data, 'surname') || personName(entry.data)).toLowerCase(),
  example: {
    key: 'ratzinger',
    data: { personType: 'person', givenNames: 'Joseph', surname: 'Ratzinger', years: '1927–2022', description: 'Papież Benedykt XVI.' }
  }
};

/* -- Werke (Quellen) --------------------------------------------------------------------- */

export const WORK_TYPES = [
  { value: 'book', label: 'Książka' },
  { value: 'chapter', label: 'Rozdział w książce' },
  { value: 'article', label: 'Artykuł w czasopiśmie' },
  { value: 'periodical', label: 'Czasopismo' },
  { value: 'document', label: 'Dokument (Kościoła, urzędowy)' },
  { value: 'bible', label: 'Pismo Święte' },
  { value: 'web', label: 'Strona internetowa' },
  { value: 'talk', label: 'Wykład, kazanie, nagranie' },
  { value: 'other', label: 'Inne' }
] as const;

const isPart = (data: EntryData) => ['chapter', 'article'].includes(str(data, 'workType'));

/** Was man in die Hand nimmt und ins Regal stellt — Seiten, Einband, Masse, eine eigene Nummer. */
const isVolume = (data: EntryData) => !['chapter', 'article', 'web', 'talk'].includes(str(data, 'workType'));

export const BINDINGS = [
  { value: 'soft', label: 'Miękka' },
  { value: 'soft-flaps', label: 'Miękka ze skrzydełkami' },
  { value: 'hard', label: 'Twarda' },
  { value: 'integrated', label: 'Zintegrowana' },
  { value: 'cloth', label: 'Płócienna' },
  { value: 'leather', label: 'Skórzana' },
  { value: 'spiral', label: 'Spirala' },
  { value: 'ebook', label: 'E-book' },
  { value: 'other', label: 'Inna' }
] as const;

export const workTitle = (data: EntryData): string => {
  const title = str(data, 'title').trim();
  const sub = str(data, 'subtitle').trim();
  return title === '' ? 'Bez tytułu' : sub === '' ? title : `${title}. ${sub}`;
};

const WORK: LibKind = {
  kind: 'work',
  label: 'Źródło',
  plural: 'Źródła',
  says: 'Dzieło, z którego się korzysta: książka, rozdział, artykuł, dokument Kościoła, Pismo Święte, strona.',
  keyed: true,
  fields: [
    { key: 'workType', label: 'Rodzaj', type: 'select', options: WORK_TYPES, says: `Rodzaj: ${WORK_TYPES.map((t) => `"${t.value}" (${t.label})`).join(', ')}` },
    { key: 'title', label: 'Tytuł', type: 'line', says: 'Tytuł dzieła' },
    { key: 'subtitle', label: 'Podtytuł', type: 'line', says: 'Podtytuł (albo rodzaj dokumentu, np. "adhortacja apostolska")' },
    { key: 'originalTitle', label: 'Tytuł oryginału', type: 'line', says: 'Tytuł oryginału (oryginalny tytuł przekładu)' },
    { key: 'authors', label: 'Autorzy', type: 'refs', to: ['person'], says: 'Autorzy — odwołania do osób, w kolejności' },
    { key: 'editors', label: 'Redakcja', type: 'refs', to: ['person'], says: 'Redaktorzy — odwołania do osób' },
    { key: 'translators', label: 'Tłumaczenie', type: 'refs', to: ['person'], says: 'Tłumacze — odwołania do osób' },
    { key: 'container', label: 'W (książka, czasopismo)', type: 'ref', to: ['work'], says: 'Dla rozdziału: książka; dla artykułu: czasopismo — odwołanie do źródła', when: isPart },
    { key: 'volume', label: 'Tom / rocznik', type: 'line', says: 'Tom (książka) albo rocznik (czasopismo)', hint: 'np. 1' },
    { key: 'issue', label: 'Numer', type: 'line', says: 'Numer czasopisma', when: (d) => str(d, 'workType') === 'article' },
    { key: 'edition', label: 'Wydanie', type: 'line', says: 'Które wydanie', hint: 'np. 2' },
    { key: 'publisher', label: 'Wydawca', type: 'line', says: 'Wydawnictwo' },
    { key: 'place', label: 'Miejsce wydania', type: 'line', says: 'Miejsce wydania', hint: 'np. Kraków' },
    { key: 'year', label: 'Rok', type: 'line', says: 'Rok wydania (albo data dokumentu)', hint: 'np. 2007' },
    { key: 'series', label: 'Seria', type: 'line', says: 'Seria wydawnicza, z numerem tomu w serii', hint: 'np. Źródła Monastyczne, t. 45', when: isVolume },
    { key: 'pages', label: 'Strony', type: 'line', says: 'Zakres stron rozdziału albo artykułu', hint: 'np. 45–60', when: isPart },
    { key: 'pageCount', label: 'Liczba stron', type: 'number', says: 'Ile stron ma książka', hint: 'np. 384', when: isVolume },
    { key: 'binding', label: 'Oprawa', type: 'select', options: BINDINGS, says: `Oprawa: ${BINDINGS.map((b) => `"${b.value}" (${b.label})`).join(', ')}`, when: isVolume },
    { key: 'height', label: 'Wysokość (cm)', type: 'number', says: 'Wysokość w centymetrach', hint: 'np. 20,5', when: isVolume },
    { key: 'width', label: 'Szerokość (cm)', type: 'number', says: 'Szerokość w centymetrach', hint: 'np. 14,5', when: isVolume },
    { key: 'length', label: 'Grubość (cm)', type: 'number', says: 'Trzeci wymiar — grubość (długość grzbietu w głąb) w centymetrach', hint: 'np. 2,5', when: isVolume },
    { key: 'siglum', label: 'Skrót przekładu', type: 'line', says: 'Dla Pisma Świętego: skrót przekładu, dopisywany do sigli', hint: 'np. BT', when: (d) => str(d, 'workType') === 'bible' },
    { key: 'isbn', label: 'ISBN', type: 'line', says: 'Numer ISBN książki (z kreskami albo bez; kilka — po przecinku)' },
    { key: 'libraryNumber', label: 'Numer w bibliotece', type: 'line', says: 'Własny numer egzemplarza w tej bibliotece (numer inwentarzowy, sygnatura) — można po nim szukać i go zeskanować', hint: 'np. B-0124', when: isVolume },
    { key: 'doi', label: 'DOI', type: 'line', says: 'Identyfikator DOI publikacji' },
    { key: 'url', label: 'Adres', type: 'url', says: 'Adres w sieci' },
    { key: 'accessed', label: 'Dostęp', type: 'date', says: 'Kiedy strona była czytana (RRRR-MM-DD)', when: (d) => str(d, 'workType') === 'web' || str(d, 'url') !== '' },
    { key: 'language', label: 'Język', type: 'line', says: 'Język (np. "pl", "la")' }
  ],
  title: (data) => workTitle(data),
  sort: (entry, look) => {
    const first = ids(entry.data, 'authors')[0];
    const author = first === undefined ? undefined : look.get(first);
    const by = author === undefined ? '' : `${(str(author.data, 'surname') || personName(author.data)).toLowerCase()} `;
    return clip(`${by}${str(entry.data, 'title').toLowerCase()} ${str(entry.data, 'year')}`, 64);
  },
  example: {
    key: 'ratzinger2007',
    data: {
      workType: 'book', title: 'Jezus z Nazaretu', subtitle: 'Część 1: Od chrztu w Jordanie do Przemienienia',
      originalTitle: 'Jesus von Nazareth', authors: ['@ratzinger'], volume: '1', publisher: 'Wydawnictwo M', place: 'Kraków', year: '2007',
      series: 'Dzieła wybrane, t. 1', pageCount: 384, binding: 'hard', height: 24, width: 16.5, length: 3,
      isbn: '978-83-7595-061-8', libraryNumber: 'B-0042'
    }
  }
};

/* -- Zitate ------------------------------------------------------------------------------- */

const QUOTE: LibKind = {
  kind: 'quote',
  label: 'Cytat',
  plural: 'Cytaty',
  says: 'Fragment ze źródła — z miejscem (strona, werset, numer) i opisem.',
  keyed: true,
  fields: [
    { key: 'text', label: 'Tekst cytatu', type: 'text', says: 'Dokładne brzmienie cytatu' },
    { key: 'work', label: 'Źródło', type: 'ref', to: ['work'], says: 'Z jakiego źródła — odwołanie' },
    { key: 'locator', label: 'Miejsce', type: 'line', says: 'Gdzie w źródle: "s. 23", "J 3,16", "nr 24"', hint: 's. 23 · J 3,16 · nr 24' },
    { key: 'language', label: 'Język', type: 'line', says: 'Język cytatu (np. "pl", "la")' },
    { key: 'translation', label: 'Przekład', type: 'text', says: 'Przekład cytatu (gdy tekst jest w innym języku)' }
  ],
  title: (data) => clip(str(data, 'text').replace(/\s+/g, ' ').trim() || 'Cytat', 90),
  sort: (entry, look) => quoteOrder(entry, look).slice(0, 64),
  example: {
    key: 'ratzinger2007-1',
    data: {
      text: 'Modlitwa jest rozmową z Bogiem, w której człowiek staje się sobą.',
      work: '@ratzinger2007', locator: 's. 168'
    }
  }
};

/**
 * 2026-10-22 — WIE ZITATE STEHEN: nach dem Werk, dann nach der Stelle — in der
 * Schrift nach dem Kanon („Dz 1,8" vor „Dz 1,14", „Rdz" vor „Mt"), sonst mit
 * Zahlen als Zahlen („s. 9" vor „s. 10").
 */
export function quoteOrder(entry: LibEntry, look: Lookup): string {
  const work = look.get(ids(entry.data, 'work')[0] ?? '');
  const bible = work !== undefined && str(work.data, 'workType') === 'bible';
  return `${work === undefined ? '~' : WORK.sort(work, look).slice(0, 36)}|${locatorKey(str(entry.data, 'locator'), bible)}`;
}

/* -- Eigene Texte ------------------------------------------------------------------------- */

export const TEXT_TYPES = [
  { value: 'sermon', label: 'Kazanie' },
  { value: 'homily', label: 'Homilia' },
  { value: 'conference', label: 'Konferencja' },
  { value: 'meditation', label: 'Rozważanie' },
  { value: 'chapter', label: 'Rozdział' },
  { value: 'article', label: 'Artykuł' },
  { value: 'note', label: 'Notatka' },
  { value: 'other', label: 'Inny' }
] as const;

export const TEXT_STATUS = [
  { value: 'idea', label: 'Pomysł' },
  { value: 'draft', label: 'Szkic' },
  { value: 'revision', label: 'Do poprawy' },
  { value: 'final', label: 'Gotowy' }
] as const;

/*
 * 2026-10-21 — DER PLAN EINES TEXTES: die Hauptgedanken der Reihe nach, unter
 * ihnen Zitate, Beispiele, Fragen, Anwendungen. Jeder Punkt hat eine feste
 * Kennung — ein Wygłoszenie sagt über sie, was gesagt wurde und was nicht.
 * Der Punkt selbst ist Zapis: `[@klucz, s. 12]` wird zur Fussnote, ein
 * `![@cytat]` allein ist ein Zitat aus der Bibliothek.
 */
export const POINT_KINDS = [
  { value: 'thought', label: 'Myśl' },
  { value: 'quote', label: 'Cytat' },
  { value: 'example', label: 'Przykład' },
  { value: 'question', label: 'Pytanie' },
  { value: 'application', label: 'Zastosowanie' }
] as const;

const PLAN_ITEM: readonly LibField[] = [
  { key: 'id', label: 'Identyfikator', type: 'line', says: 'Stały identyfikator punktu (np. "p4k2x"); pominięty — nada się sam. Wygłoszenia wskazują punkty po nim' },
  { key: 'text', label: 'Treść', type: 'markup', says: 'Myśl w jednym-dwóch zdaniach, w zapisie treści: [@klucz, s. 12] — źródło, sam ![@klucz-cytatu] — cytat z biblioteki' },
  { key: 'depth', label: 'Poziom', type: 'number', says: '0 — główna myśl, 1 — pod nią, 2 — jeszcze głębiej' },
  { key: 'kind', label: 'Rodzaj', type: 'select', options: POINT_KINDS, says: `Rodzaj punktu: ${POINT_KINDS.map((k) => `"${k.value}" (${k.label})`).join(', ')}; pominięty — myśl` }
];

/*
 * 2026-10-21 — WAS EIN WYGŁOSZENIE ÜBER DEN PLAN SAGT: Punkt für Punkt, ob er
 * gesagt, nur gestreift oder ausgelassen wurde (mit der Stelle im Nagranie),
 * und was dazukam, das nicht im Plan stand.
 */
export const COVERAGE_STATES = [
  { value: 'said', label: 'Powiedziane' },
  { value: 'short', label: 'Krótko' },
  { value: 'skipped', label: 'Pominięte' }
] as const;

const COVERAGE_ITEM: readonly LibField[] = [
  { key: 'point', label: 'Punkt planu', type: 'line', says: '"id" punktu z planu tekstu' },
  { key: 'state', label: 'Jak', type: 'select', options: COVERAGE_STATES, says: '"said" — powiedziane, "short" — tylko wspomniane, krótko, "skipped" — pominięte' },
  { key: 'at', label: 'Czas', type: 'line', says: 'Kiedy w nagraniu zaczyna się ten punkt (mm:ss albo gg:mm:ss)' },
  { key: 'note', label: 'Uwaga', type: 'text', says: 'Co było inaczej niż w planie' }
];

const ADDED_ITEM: readonly LibField[] = [
  { key: 'text', label: 'Co', type: 'markup', says: 'Co zostało powiedziane (jedno-dwa zdania), w zapisie treści' },
  { key: 'at', label: 'Czas', type: 'line', says: 'Kiedy w nagraniu (mm:ss)' },
  { key: 'after', label: 'Po punkcie', type: 'line', says: '"id" punktu planu, po którym to padło; puste — na końcu' }
];

const TEXT: LibKind = {
  kind: 'text',
  label: 'Tekst',
  plural: 'Teksty',
  says: 'Własny tekst — kazanie, rozważanie, rozdział książki — z odwołaniami do źródeł i cytatów.',
  keyed: true,
  fields: [
    { key: 'textType', label: 'Rodzaj', type: 'select', options: TEXT_TYPES, says: `Rodzaj: ${TEXT_TYPES.map((t) => `"${t.value}" (${t.label})`).join(', ')}` },
    { key: 'title', label: 'Tytuł', type: 'line', says: 'Tytuł' },
    { key: 'subtitle', label: 'Podtytuł', type: 'line', says: 'Podtytuł' },
    { key: 'project', label: 'Projekt (książka, cykl)', type: 'ref', to: ['project'], says: 'Do jakiej książki albo cyklu należy — odwołanie' },
    { key: 'status', label: 'Stan pracy', type: 'select', options: TEXT_STATUS, says: `Stan pracy: ${TEXT_STATUS.map((t) => `"${t.value}"`).join(', ')}` },
    { key: 'date', label: 'Data wygłoszenia / napisania', type: 'date', says: 'Data (RRRR-MM-DD) — według niej układa się archiwum' },
    { key: 'occasion', label: 'Okazja', type: 'line', says: 'Okazja, dzień liturgiczny', hint: 'np. XVIII Niedziela zwykła' },
    { key: 'place', label: 'Miejsce', type: 'line', says: 'Gdzie wygłoszony' },
    { key: 'readings', label: 'Czytania', type: 'line', says: 'Czytania, sigla biblijne', hint: 'np. Iz 55,1-3; Rz 8,35.37-39; Mt 14,13-21' },
    { key: 'summary', label: 'Krótki opis', type: 'text', says: 'Krótki opis — w archiwum, nad treścią' },
    {
      key: 'plan', label: 'Plan', type: 'items', item: PLAN_ITEM,
      says: 'Plan — główne myśli po kolei, pod nimi cytaty, przykłady, pytania, zastosowania; lista punktów { "id", "text", "depth", "kind", "note" }. Wygłoszenia odwołują się do punktów po "id"'
    },
    { key: 'body', label: 'Treść', type: 'markup', says: 'Treść w prostym zapisie (niżej: "Zapis treści") — z odwołaniami [@klucz, s. 12]' },
    { key: 'further', label: 'Dalsze informacje', type: 'markup', says: 'Dalsze informacje pod tekstem — w tym samym zapisie' },
    { key: 'audio', label: 'Nagranie (adres)', type: 'url', says: 'Adres nagrania audio' },
    { key: 'video', label: 'Wideo (adres)', type: 'url', says: 'Adres nagrania wideo' },
    { key: 'targetWords', label: 'Docelowa liczba słów', type: 'number', says: 'Ile słów ma mieć' }
  ],
  title: (data) => str(data, 'title').trim() || 'Bez tytułu',
  sort: (entry) => (str(entry.data, 'date') || '0000-00-00') + ' ' + str(entry.data, 'title').toLowerCase().slice(0, 50),
  example: {
    key: 'kazanie-chleb',
    data: {
      textType: 'sermon', title: 'Chleb, który daje życie', date: '2026-08-02', occasion: 'XVIII Niedziela zwykła',
      readings: 'Wj 16,2-4.12-15; Ef 4,17.20-24; J 6,24-35', status: 'final',
      summary: 'O głodzie, którego nie nasyci chleb.',
      plan: [
        { id: 'p1', text: 'Głód, którego nie nasyci chleb', depth: 0 },
        { id: 'p2', text: 'Prośba o chleb sięga dalej niż pokarm [@ratzinger2007, s. 183]', depth: 1, kind: 'quote' },
        { id: 'p3', text: '![@ratzinger2007-1]', depth: 1, kind: 'quote' },
        { id: 'p4', text: 'Chleb dzielony przy stole w domu', depth: 1, kind: 'example' },
        { id: 'p5', text: 'Gdzie w tym tygodniu będę szukać chleba?', depth: 0, kind: 'question' }
      ],
      body: '## Głód\nJezus mówi, że jest chlebem życia — a prośba o chleb sięga dalej niż pokarm [@ratzinger2007, s. 183].\n\n![@ratzinger2007-1]\n\nModlitwa to nie technika^[Por. też Katechizm, nr 2559.].',
      further: 'Do czytania: [@ratzinger2007].', project: '@niedziele-2026'
    }
  }
};

/* -- Wygłoszenia: ein Text, gesagt (2026-10-21) --------------------------------------------- */

/** Der erste Text eines Wygłoszenia — sein Titel nennt es in Listen. */
const deliveredText = (data: EntryData, look: Lookup): LibEntry | undefined => look.get(ids(data, 'texts')[0] ?? '');

const DELIVERY: LibKind = {
  kind: 'delivery',
  label: 'Wygłoszenie',
  plural: 'Wygłoszenia',
  says: 'Jedno wygłoszenie przygotowanego tekstu (kazania, konferencji): kiedy i gdzie, nagranie — i co z planu zostało powiedziane, co tylko krótko, co pominięte, a co doszło.',
  keyed: false,
  fields: [
    { key: 'texts', label: 'Kazanie (tekst)', type: 'refs', to: ['text'], says: 'Który przygotowany tekst wygłoszono — odwołanie (zwykle jedno; kilka, gdy łączyło się materiał)' },
    { key: 'date', label: 'Data', type: 'date', says: 'Kiedy (RRRR-MM-DD) — według niej układa się archiwum' },
    { key: 'occasion', label: 'Okazja', type: 'line', says: 'Dzień liturgiczny, okazja', hint: 'np. XVIII Niedziela zwykła' },
    { key: 'place', label: 'Miejsce', type: 'line', says: 'Gdzie: kościół, Msza', hint: 'np. Kraków, Msza o 10:30' },
    { key: 'audience', label: 'Dla kogo', type: 'line', says: 'Słuchacze', hint: 'np. Msza z udziałem dzieci' },
    { key: 'readings', label: 'Czytania', type: 'line', says: 'Czytania tego dnia, sigla biblijne' },
    { key: 'audio', label: 'Nagranie (adres)', type: 'url', says: 'Adres nagrania audio — plik (mp3, m4a, ogg) albo strona z nagraniem' },
    { key: 'video', label: 'Wideo (adres)', type: 'url', says: 'Adres nagrania wideo — plik (mp4, webm) albo YouTube' },
    { key: 'duration', label: 'Długość', type: 'line', says: 'Długość nagrania (mm:ss)', hint: 'np. 14:30' },
    { key: 'summary', label: 'Krótko o tym wygłoszeniu', type: 'text', says: 'Co tym razem było najważniejsze, czym się różniło' },
    {
      key: 'coverage', label: 'Co z planu', type: 'items', item: COVERAGE_ITEM,
      says: 'Co z planu tekstu zostało powiedziane — punkt po punkcie: { "point", "state", "at", "note" }'
    },
    {
      key: 'added', label: 'Co doszło', type: 'items', item: ADDED_ITEM,
      says: 'Co zostało powiedziane, a nie było w planie: { "text", "at", "after" }'
    },
    { key: 'transcript', label: 'Zapis (transkrypcja)', type: 'markup', says: 'To, co zostało powiedziane, spisane słowo w słowo — w zapisie treści' }
  ],
  title: (data, look) => {
    const text = deliveredText(data, look);
    return [text === undefined ? '' : str(text.data, 'title').trim(), str(data, 'date'), str(data, 'occasion')].filter((s) => s !== '').join(' · ') || 'Wygłoszenie';
  },
  sort: (entry, look) => clip(`${str(entry.data, 'date') || '0000-00-00'} ${str(deliveredText(entry.data, look)?.data ?? {}, 'title').toLowerCase()}`, 64),
  example: {
    data: {
      texts: ['@kazanie-chleb'], date: '2026-08-02', occasion: 'XVIII Niedziela zwykła', place: 'Kraków, Msza o 10:30',
      audio: 'https://example.pl/kazania/2026-08-02.mp3', duration: '14:30', summary: 'Tym razem mocniej o niedzielnej Eucharystii.',
      coverage: [
        { point: 'p1', state: 'said', at: '0:40' },
        { point: 'p2', state: 'said', at: '2:05' },
        { point: 'p3', state: 'short', at: '4:30', note: 'Bez całego cytatu.' },
        { point: 'p4', state: 'skipped' },
        { point: 'p5', state: 'said', at: '11:20' }
      ],
      added: [{ text: 'Zaproszenie na czwartkową adorację.', at: '13:05', after: 'p5' }]
    }
  }
};

export const PROJECT_TYPES = [
  { value: 'book', label: 'Książka' },
  { value: 'series', label: 'Cykl kazań' },
  { value: 'collection', label: 'Zbiór' },
  { value: 'article', label: 'Artykuł' },
  { value: 'other', label: 'Inny' }
] as const;

export const PROJECT_STATUS = [
  { value: 'planned', label: 'Planowany' },
  { value: 'writing', label: 'Piszę' },
  { value: 'editing', label: 'Redakcja' },
  { value: 'done', label: 'Gotowy' }
] as const;

const PROJECT: LibKind = {
  kind: 'project',
  label: 'Projekt',
  plural: 'Projekty',
  says: 'Książka, cykl kazań, zbiór — z planem (rozdziały, części) i postępem pisania.',
  keyed: true,
  fields: [
    { key: 'projectType', label: 'Rodzaj', type: 'select', options: PROJECT_TYPES, says: `Rodzaj: ${PROJECT_TYPES.map((t) => `"${t.value}" (${t.label})`).join(', ')}` },
    { key: 'title', label: 'Tytuł', type: 'line', says: 'Tytuł' },
    { key: 'subtitle', label: 'Podtytuł', type: 'line', says: 'Podtytuł' },
    { key: 'description', label: 'Opis', type: 'text', says: 'Opis projektu — o czym jest książka albo cykl' },
    { key: 'outline', label: 'Plan', type: 'outline', says: 'Plan: lista {"heading": "Część I"} i {"text": <odwołanie do tekstu>} w kolejności; czytelnik widzi te teksty, które może czytać' },
    { key: 'status', label: 'Stan', type: 'select', options: PROJECT_STATUS, says: `Stan: ${PROJECT_STATUS.map((t) => `"${t.value}"`).join(', ')}` },
    { key: 'deadline', label: 'Termin', type: 'date', says: 'Do kiedy (RRRR-MM-DD)' },
    { key: 'targetWords', label: 'Docelowa liczba słów', type: 'number', says: 'Ile słów ma mieć całość' }
  ],
  title: (data) => str(data, 'title').trim() || 'Projekt',
  sort: (entry) => str(entry.data, 'title').toLowerCase(),
  example: {
    key: 'niedziele-2026',
    data: {
      projectType: 'series', title: 'Niedziele 2026', description: 'Kazania niedzielne roku B.',
      outline: [{ heading: 'Lipiec' }, { text: '@kazanie-chleb' }], status: 'writing'
    }
  }
};

/* -- ÜBERGANG (2026-10-23): Thema und Komentarz, nur noch für Cogita ------------------------
 * Die Bibliothek bietet beide nicht mehr an (weder Reiter noch Format); ihre
 * alten Einträge stehen unter „Stare wpisy". Cogita baut aus ihnen noch zwei
 * eingebaute Arten — der Komentarz wird dort in Schritt 4 eine eigene Art mit
 * einem Feld `blocks`, das Thema fällt in Schritt 5 ganz weg. Dann gehen sie
 * auch hier. */

const TOPIC: LibKind = {
  kind: 'topic',
  label: 'Temat',
  plural: 'Tematy',
  says: 'Hasło, według którego porządkuje się wpisy; tematy mogą mieć nadrzędne.',
  keyed: true,
  fields: [
    { key: 'name', label: 'Nazwa', type: 'line', says: 'Nazwa tematu' },
    { key: 'description', label: 'Opis', type: 'text', says: 'Opis tematu' },
    { key: 'parent', label: 'Temat nadrzędny', type: 'ref', to: ['topic'], says: 'Temat nadrzędny — odwołanie' },
    { key: 'aspect', label: 'Aspekt', type: 'select', options: [{ value: 'yes', label: 'Tak — oś podziału' }], says: '"yes" — ten temat jest osią podziału: jego podtematy to wartości' },
    { key: 'order', label: 'Kolejność', type: 'number', says: 'Miejsce wśród tematów o tym samym nadrzędnym', hint: 'np. 1' }
  ],
  title: (data) => str(data, 'name').trim() || 'Temat',
  sort: (entry) => str(entry.data, 'name').toLowerCase(),
  example: { key: 'modlitwa', data: { name: 'Modlitwa', description: 'Rozmowa z Bogiem.' } }
};

const SUBJECT_ITEM: readonly LibField[] = [
  { key: 'ref', label: 'O czym', type: 'ref', to: ['work', 'quote', 'person', 'text', 'delivery', 'project', 'comment'], says: 'Wpis, którego dotyczy — kennung albo "@klucz"' },
  { key: 'locator', label: 'Miejsce', type: 'line', says: 'Gdzie w nim: "s. 23", "J 3,16"', hint: 'J 3,16 · s. 23' },
  { key: 'point', label: 'Punkt planu', type: 'line', says: 'Przy tekście: "id" punktu jego planu' }
];

const COMMENT: LibKind = {
  kind: 'comment',
  label: 'Komentarz',
  plural: 'Komentarze',
  says: 'Własne przemyślenia o źródłach i innych wpisach (stary rodzaj — teraz własny rodzaj w Nauce).',
  keyed: true,
  fields: [
    { key: 'subjects', label: 'O czym', type: 'items', item: SUBJECT_ITEM, says: 'O czym jest komentarz: lista { "ref", "locator", "point" }' },
    { key: 'blocks', label: 'Treść', type: 'blocks', says: 'Treść jako bloki: paragraph, ordered, unordered, table' }
  ],
  title: (data, look) => commentTitle(data, (id) => {
    const target = look.get(id);
    return target === undefined ? undefined : kindOf(target.kind)?.title(target.data, look);
  }),
  sort: (entry, look) => (COMMENT.title(entry.data, look)).toLowerCase().slice(0, 64),
  example: { key: 'komentarz', data: { subjects: [], blocks: [{ type: 'paragraph', text: 'Teza.' }] } }
};

/** Die Bibliothek (2026-10-23): nur Quellen — in dieser Reihenfolge stehen ihre Reiter. */
export const LIBRARY_KINDS: readonly LibKind[] = [WORK, QUOTE, PERSON];

/** Das Skryptorium (2026-10-23): das Schreiben. */
export const WRITING_KINDS: readonly LibKind[] = [TEXT, DELIVERY, PROJECT];

/** Nur für Cogita, bis Schritt 4/5 (oben). */
export const COGITA_LEGACY_KINDS: readonly LibKind[] = [TOPIC, COMMENT];

/** Alle Arten, die diese Fassung kennt — gelesen, zitiert und gezeigt wird über die Teile hinweg. */
export const KINDS: readonly LibKind[] = [...WRITING_KINDS, ...LIBRARY_KINDS, ...COGITA_LEGACY_KINDS];

export const isLibraryKind = (kind: string): boolean => LIBRARY_KINDS.some((k) => k.kind === kind);
export const isWritingKind = (kind: string): boolean => WRITING_KINDS.some((k) => k.kind === kind);

const BY_KIND = new Map(KINDS.map((one) => [one.kind, one]));

export const kindOf = (kind: string): LibKind | undefined => BY_KIND.get(kind);

/** Der Name eines Eintrags — gleich welcher Art. */
export function entryTitle(entry: LibEntry, look: Lookup): string {
  const def = kindOf(entry.kind);
  if (def !== undefined) return def.title(entry.data, look);
  /* 2026-10-22 (Schritt 11) — ein Eintrag einer Baza wiedzy (ein Słowo, ein Widok): sein Name aus den Daten. */
  for (const key of ['name', 'title', 'tekst', 'text', 'nazwa', 'word', 'slowo']) {
    const value = str(entry.data, key).trim();
    if (value !== '') return value.length > 80 ? `${value.slice(0, 79)}…` : value;
  }
  return entry.kind;
}

export function entrySort(entry: LibEntry, look: Lookup): string {
  return (kindOf(entry.kind)?.sort(entry, look) ?? '').slice(0, 64);
}

/** Worauf ein Eintrag in seinen Feldern zeigt (Verweise in einem Text kommen aus `libraryMarkup`). */
export function fieldRefs(entry: LibEntry): string[] {
  const def = kindOf(entry.kind);
  if (def === undefined) return [];
  const out: string[] = [];
  for (const field of def.fields) {
    if (field.type === 'ref' || field.type === 'refs') out.push(...ids(entry.data, field.key));
    if (field.type === 'outline') for (const item of outline(entry.data, field.key)) if ('text' in item) out.push(item.text);
    if (field.type === 'items') {
      for (const item of itemsOf(entry.data, field.key)) {
        for (const sub of field.item ?? []) if (sub.type === 'ref' || sub.type === 'refs') out.push(...ids(item, sub.key));
      }
    }
    if (field.type === 'blocks') out.push(...blockRefs(blocksOf(entry.data, field.key)).map((r) => r.ref));
  }
  return [...new Set(out)];
}

/**
 * 2026-10-21 — ALLES, WAS EIN EINTRAG IM ZAPIS TRÄGT: die Felder und die
 * Unterfelder (die Punkte eines Plans, „co doszło" eines Wygłoszenia). Wer
 * Quellen sucht — Rückverweise, Veröffentlichung, Bibliografie, LaTeX —,
 * liest hier, nicht Feld für Feld.
 */
export function markupsOf(entry: LibEntry): string[] {
  const def = kindOf(entry.kind);
  if (def === undefined) return [];
  const out: string[] = [];
  for (const field of def.fields) {
    if (field.type === 'markup') out.push(str(entry.data, field.key));
    if (field.type === 'blocks') out.push(...blockMarkups(blocksOf(entry.data, field.key)));
    if (field.type !== 'items') continue;
    for (const item of itemsOf(entry.data, field.key)) {
      for (const sub of field.item ?? []) if (sub.type === 'markup') out.push(str(item, sub.key));
    }
  }
  return out.filter((one) => one.trim() !== '');
}

/* -- 2026-10-22: Kennungen im Speicher, Schlüssel im Editor ----------------------------------- */

/**
 * Wohin ein Verweis im Zapis zeigt. Gespeichert steht eine Kennung (sie
 * ändert sich nie); getippt, im JSON und in alten Texten ein Schlüssel. Beide
 * gelten — die Kennung zuerst.
 */
export function refTarget(look: Lookup, token: string): LibEntry | undefined {
  return look.get(token) ?? look.byKey(token);
}

/**
 * 2026-10-22 — ZITIERT WIRD NUR, WAS VON AUSSEN KOMMT: ein Werk (auch ein
 * Lexikon: ein Werk mit dem Stichwort als Stelle), ein Zitat, eine Person —
 * das wird eine Fussnote. Die eigenen Einträge (Texte, Komentarze, Themen,
 * Projekte, Wygłoszenia, Einträge der Bazy wiedzy) werden verlinkt oder
 * eingebettet, nie zitiert. Ein Ziel, das dieser Leser nicht lesen kann,
 * bleibt eine Fussnote „[brak źródła]" (man sieht, dass da etwas ist — mehr nicht).
 */
export const SOURCE_KINDS: ReadonlySet<string> = new Set(['work', 'quote', 'person']);

export const isSource = (entry: LibEntry | undefined): boolean => entry === undefined || SOURCE_KINDS.has(entry.kind);

/** Wie ein eigener Eintrag im Text heisst (der Link). */
export const ownTitle = (entry: LibEntry, look: Lookup): string => look.title?.(entry) ?? entryTitle(entry, look);

/** Für den Speicher: ein Schlüssel, der aufgeht, wird seine Kennung; was nicht aufgeht, bleibt, wie es getippt ist. */
export const storedText = (text: string, look: Lookup): string =>
  mapRefTokens(text, (token) => (look.get(token) !== undefined ? token : (look.byKey(token)?.id ?? token)));

/**
 * Für den Editor, das JSON, die Polecenia: eine Kennung wird ihr Schlüssel —
 * aber nur, wenn dieser Schlüssel von hier aus wieder genau diesen Eintrag
 * findet (zwei Bibliotheken können denselben Schlüssel haben). Sonst bleibt
 * die Kennung stehen; der Text zeigt dann weiter genau dorthin.
 */
export const shownText = (text: string, look: Lookup): string =>
  mapRefTokens(text, (token) => {
    const entry = look.get(token);
    if (entry?.key === undefined) return token;
    return look.byKey(entry.key)?.id === entry.id ? entry.key : token;
  });

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Jeder Zapis eines Eintrags durch `fn`: die Felder, die Unterfelder (die
 * Punkte eines Plans, „co doszło"), die Absätze und Textstücke eines
 * Komentarza. Was sich nicht ändert, bleibt dasselbe Objekt.
 */
export function mapMarkups(kind: string, data: EntryData, fn: (text: string) => string): EntryData {
  const def = kindOf(kind);
  if (def === undefined) return data;
  let out: EntryData | null = null;
  const set = (key: string, value: unknown) => { out ??= { ...data }; out[key] = value; };

  for (const field of def.fields) {
    const value = data[field.key];
    if (field.type === 'markup' && typeof value === 'string') {
      const next = fn(value);
      if (next !== value) set(field.key, next);
    } else if (field.type === 'items' && Array.isArray(value)) {
      const subs = (field.item ?? []).filter((sub) => sub.type === 'markup');
      if (subs.length === 0) continue;
      let changed = false;
      const items = value.map((raw) => {
        if (!isRecord(raw)) return raw;
        let item = raw;
        for (const sub of subs) {
          const text = item[sub.key];
          if (typeof text !== 'string') continue;
          const next = fn(text);
          if (next !== text) { item = { ...item, [sub.key]: next }; changed = true; }
        }
        return item;
      });
      if (changed) set(field.key, items);
    } else if (field.type === 'blocks' && Array.isArray(value)) {
      let changed = false;
      const run = (raw: unknown): unknown => {
        if (typeof raw === 'string') { const next = fn(raw); if (next !== raw) changed = true; return next; }
        if (isRecord(raw) && typeof raw.text === 'string') { const next = fn(raw.text); if (next !== raw.text) { changed = true; return { ...raw, text: next }; } }
        return raw;
      };
      const cell = (raw: unknown): unknown => (Array.isArray(raw) ? raw.map(run) : run(raw));
      const blocks = value.map((raw) => {
        if (!isRecord(raw)) return raw;
        if (typeof raw.text === 'string' && raw.type === 'paragraph') { const next = fn(raw.text); if (next !== raw.text) { changed = true; return { ...raw, text: next }; } return raw; }
        if (Array.isArray(raw.items)) return { ...raw, items: raw.items.map(cell) };
        if (Array.isArray(raw.rows)) return { ...raw, rows: raw.rows.map((row) => (Array.isArray(row) ? row.map(cell) : cell(row))) };
        return raw;
      });
      if (changed) set(field.key, blocks);
    }
  }
  return out ?? data;
}

/** Ein ganzer Eintrag für den Speicher (Kennungen) … */
export const storedMarkup = (kind: string, data: EntryData, look: Lookup): EntryData => mapMarkups(kind, data, (text) => storedText(text, look));

/** … und für den Editor und das JSON (Schlüssel, wo sie eindeutig sind). */
export const shownMarkup = (kind: string, data: EntryData, look: Lookup): EntryData => mapMarkups(kind, data, (text) => shownText(text, look));

/**
 * ALTE SCHLÜSSEL (2026-10-22): wer einen Schlüssel ändert, behält den alten als
 * zweiten (`_aliases` in den Daten). Ein Text, der noch den alten nennt (aus
 * einer JSON-Datei, aus der Zeit vor den Kennungen, aus einer Bibliothek, die
 * man nicht ändern darf), findet den Eintrag weiter.
 */
export const ALIASES = '_aliases';

export function aliasesOf(data: EntryData): string[] {
  const value = data[ALIASES];
  return Array.isArray(value) ? value.filter((one): one is string => typeof one === 'string' && isKey(one)) : [];
}

/** Die alten Schlüssel nach einer Änderung: der bisherige kommt dazu, der neue nicht; jeder einmal, höchstens zehn. */
export function nextAliases(previousKey: string | undefined, nextKey: string | undefined, given: readonly string[]): string[] {
  const all = [...given, ...(previousKey !== undefined && previousKey !== nextKey ? [previousKey] : [])];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const one of all) {
    const low = one.toLowerCase();
    if ((nextKey !== undefined && low === nextKey.toLowerCase()) || seen.has(low)) continue;
    seen.add(low);
    out.push(one);
  }
  return out.slice(-10);
}

/** Wörter eines Textes — ohne Zeichen des Zapis, ohne Verweise. */
export function wordCount(text: string): number {
  const plain = text.replace(/\[\[([^\]|]*)\|@[^\]]*\]\]/g, ' $1 ').replace(/\[@[^\]]*\]/g, ' ').replace(/!\[@[^\]]*\]/g, ' ').replace(/[#>*_`[\]()^-]/g, ' ');
  const words = plain.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu);
  return words === null ? 0 : words.length;
}

/* -- Zitierschlüssel ------------------------------------------------------------------------- */

const firstWord = (text: string): string => slug(text).split('-').find((w) => w.length > 2) ?? slug(text).split('-')[0] ?? '';

/** Ein Vorschlag für den Schlüssel — noch nicht eindeutig gemacht. */
export function suggestKey(entry: LibEntry, look: Lookup): string {
  const data = entry.data;
  switch (entry.kind) {
    case 'person':
      return slug(str(data, 'surname') || personName(data)).slice(0, 40) || 'osoba';
    case 'work': {
      if (str(data, 'workType') === 'bible') return slug(str(data, 'siglum')) || 'biblia';
      const author = look.get(ids(data, 'authors')[0] ?? '');
      const who = author === undefined ? firstWord(str(data, 'title')) : slug(str(author.data, 'surname') || personName(author.data)).split('-').pop() ?? '';
      const year = (str(data, 'year').match(/\d{4}/) ?? [''])[0];
      return `${who || 'zrodlo'}${year}`.slice(0, 40);
    }
    case 'quote': {
      const work = look.get(ids(data, 'work')[0] ?? '');
      return `${work?.key ?? 'cytat'}-1`;
    }
    case 'text':
      return slug(str(data, 'title')).slice(0, 40) || 'tekst';
    case 'project':
      return slug(str(data, 'title')).slice(0, 40) || 'projekt';
    default:
      return entry.kind;
  }
}

/** Den Vorschlag eindeutig machen: `ratzinger2007`, `ratzinger2007b`, …; bei Zitaten `…-1`, `…-2`. */
export function uniqueKey(wanted: string, taken: (key: string) => boolean): string {
  const base = wanted.replace(/[^a-z0-9_.:-]/gi, '').slice(0, 60) || 'wpis';
  if (!taken(base)) return base;
  const numbered = /^(.*-)(\d+)$/.exec(base);
  if (numbered !== null) {
    for (let n = Number(numbered[2]) + 1; n < 10000; n += 1) if (!taken(`${numbered[1]}${n}`)) return `${numbered[1]}${n}`;
  }
  for (let i = 1; i < 26; i += 1) {
    const next = `${base}${String.fromCharCode(97 + i)}`;
    if (!taken(next)) return next;
  }
  for (let n = 2; n < 100000; n += 1) if (!taken(`${base}-${n}`)) return `${base}-${n}`;
  return `${base}-${Date.now()}`;
}

/** Ein Schlüssel, wie er in `[@…]` stehen darf. */
export const isKey = (key: string): boolean => /^[a-z0-9][a-z0-9_.:-]{0,59}$/i.test(key);

