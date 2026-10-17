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
 * <b>Privat ist, was `private` trägt</b> — Notizen, der Stand der Arbeit,
 * Fristen. Es geht nie in die offene Fassung, auch nicht mit einem
 * veröffentlichten Text.
 */

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
}

export type LibFieldType = 'line' | 'text' | 'markup' | 'number' | 'date' | 'select' | 'url' | 'ref' | 'refs' | 'outline';

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
  /** Geht nie in die offene Fassung. */
  readonly private?: boolean;
  /** Nur gezeigt, wenn — etwa Seitenzahlen nur bei Kapitel und Artikel. */
  readonly when?: (data: EntryData) => boolean;
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
    { key: 'description', label: 'Opis', type: 'text', says: 'Krótki opis — widoczny przy opublikowanych źródłach' },
    { key: 'url', label: 'Adres strony', type: 'url', says: 'Strona o tej osobie (np. biografia)' },
    { key: 'notes', label: 'Notatki prywatne', type: 'text', private: true, says: 'Tylko dla Ciebie — nigdy nie jest publikowane' }
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
    { key: 'libraryNumber', label: 'Numer w bibliotece', type: 'line', private: true, says: 'Własny numer egzemplarza w tej bibliotece (numer inwentarzowy, sygnatura) — można po nim szukać i go zeskanować', hint: 'np. B-0124', when: isVolume },
    { key: 'doi', label: 'DOI', type: 'line', says: 'Identyfikator DOI publikacji' },
    { key: 'url', label: 'Adres', type: 'url', says: 'Adres w sieci' },
    { key: 'accessed', label: 'Dostęp', type: 'date', says: 'Kiedy strona była czytana (RRRR-MM-DD)', when: (d) => str(d, 'workType') === 'web' || str(d, 'url') !== '' },
    { key: 'language', label: 'Język', type: 'line', says: 'Język (np. "pl", "la")' },
    { key: 'description', label: 'Opis', type: 'text', says: 'Krótki opis źródła — widoczny przy publikacji' },
    { key: 'topics', label: 'Tematy', type: 'refs', to: ['topic'], says: 'Tematy — odwołania' },
    { key: 'notes', label: 'Notatki prywatne', type: 'text', private: true, says: 'Tylko dla Ciebie — nigdy nie jest publikowane' }
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
      isbn: '978-83-7595-061-8', libraryNumber: 'B-0042', description: 'Pierwszy tom trylogii o Jezusie.', topics: ['@modlitwa']
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
    { key: 'translation', label: 'Przekład', type: 'text', says: 'Przekład cytatu (gdy tekst jest w innym języku)' },
    { key: 'description', label: 'Opis', type: 'text', says: 'Opis, komentarz, kontekst — widoczny w zbiorze cytatów' },
    { key: 'topics', label: 'Tematy', type: 'refs', to: ['topic'], says: 'Tematy — odwołania' },
    { key: 'notes', label: 'Notatki prywatne', type: 'text', private: true, says: 'Tylko dla Ciebie — nigdy nie jest publikowane' }
  ],
  title: (data) => clip(str(data, 'text').replace(/\s+/g, ' ').trim() || 'Cytat', 90),
  sort: (entry, look) => {
    const work = look.get(ids(entry.data, 'work')[0] ?? '');
    return clip(`${work === undefined ? '~' : WORK.sort(work, look)} ${str(entry.data, 'locator')}`, 64);
  },
  example: {
    key: 'ratzinger2007-1',
    data: {
      text: 'Modlitwa jest rozmową z Bogiem, w której człowiek staje się sobą.',
      work: '@ratzinger2007', locator: 's. 168', description: 'O modlitwie Jezusa na górze.', topics: ['@modlitwa']
    }
  }
};

/* -- Themen -------------------------------------------------------------------------------- */

const TOPIC: LibKind = {
  kind: 'topic',
  label: 'Temat',
  plural: 'Tematy',
  says: 'Hasło, według którego porządkuje się cytaty, źródła i teksty; tematy mogą mieć nadrzędne.',
  keyed: true,
  fields: [
    { key: 'name', label: 'Nazwa', type: 'line', says: 'Nazwa tematu' },
    { key: 'description', label: 'Opis', type: 'text', says: 'Opis tematu' },
    { key: 'parent', label: 'Temat nadrzędny', type: 'ref', to: ['topic'], says: 'Temat nadrzędny — odwołanie' },
    { key: 'notes', label: 'Notatki prywatne', type: 'text', private: true, says: 'Tylko dla Ciebie — nigdy nie jest publikowane' }
  ],
  title: (data) => str(data, 'name').trim() || 'Temat',
  sort: (entry) => str(entry.data, 'name').toLowerCase(),
  example: { key: 'modlitwa', data: { name: 'Modlitwa', description: 'Rozmowa z Bogiem.' } }
};

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
    { key: 'status', label: 'Stan pracy', type: 'select', options: TEXT_STATUS, private: true, says: `Stan pracy (prywatny): ${TEXT_STATUS.map((t) => `"${t.value}"`).join(', ')}` },
    { key: 'date', label: 'Data wygłoszenia / napisania', type: 'date', says: 'Data (RRRR-MM-DD) — według niej układa się archiwum' },
    { key: 'occasion', label: 'Okazja', type: 'line', says: 'Okazja, dzień liturgiczny', hint: 'np. XVIII Niedziela zwykła' },
    { key: 'place', label: 'Miejsce', type: 'line', says: 'Gdzie wygłoszony' },
    { key: 'readings', label: 'Czytania', type: 'line', says: 'Czytania, sigla biblijne', hint: 'np. Iz 55,1-3; Rz 8,35.37-39; Mt 14,13-21' },
    { key: 'summary', label: 'Krótki opis', type: 'text', says: 'Krótki opis — w archiwum, nad treścią' },
    { key: 'body', label: 'Treść', type: 'markup', says: 'Treść w prostym zapisie (niżej: "Zapis treści") — z odwołaniami [@klucz, s. 12]' },
    { key: 'further', label: 'Dalsze informacje', type: 'markup', says: 'Dalsze informacje pod tekstem — w tym samym zapisie' },
    { key: 'topics', label: 'Tematy', type: 'refs', to: ['topic'], says: 'Tematy — odwołania' },
    { key: 'audio', label: 'Nagranie (adres)', type: 'url', says: 'Adres nagrania audio' },
    { key: 'video', label: 'Wideo (adres)', type: 'url', says: 'Adres nagrania wideo' },
    { key: 'targetWords', label: 'Docelowa liczba słów', type: 'number', private: true, says: 'Ile słów ma mieć (prywatne)' },
    { key: 'notes', label: 'Notatki prywatne', type: 'text', private: true, says: 'Tylko dla Ciebie — nigdy nie jest publikowane' }
  ],
  title: (data) => str(data, 'title').trim() || 'Bez tytułu',
  sort: (entry) => (str(entry.data, 'date') || '0000-00-00') + ' ' + str(entry.data, 'title').toLowerCase().slice(0, 50),
  example: {
    key: 'kazanie-chleb',
    data: {
      textType: 'sermon', title: 'Chleb, który daje życie', date: '2026-08-02', occasion: 'XVIII Niedziela zwykła',
      readings: 'Wj 16,2-4.12-15; Ef 4,17.20-24; J 6,24-35', status: 'final',
      summary: 'O głodzie, którego nie nasyci chleb.',
      body: '## Głód\nJezus mówi: „Ja jestem chlebem życia” [@bt, J 6,35].\n\n![@ratzinger2007-1]\n\nModlitwa to nie technika^[Por. też Katechizm, nr 2559.].',
      further: 'Do czytania: [@ratzinger2007].', topics: ['@modlitwa'], project: '@niedziele-2026'
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
    { key: 'description', label: 'Opis', type: 'text', says: 'Opis — widoczny, gdy coś z projektu jest opublikowane' },
    { key: 'outline', label: 'Plan', type: 'outline', says: 'Plan: lista {"heading": "Część I"} i {"text": <odwołanie do tekstu>} w kolejności; publicznie widać tylko opublikowane teksty' },
    { key: 'status', label: 'Stan', type: 'select', options: PROJECT_STATUS, private: true, says: `Stan (prywatny): ${PROJECT_STATUS.map((t) => `"${t.value}"`).join(', ')}` },
    { key: 'deadline', label: 'Termin', type: 'date', private: true, says: 'Do kiedy (prywatne, RRRR-MM-DD)' },
    { key: 'targetWords', label: 'Docelowa liczba słów', type: 'number', private: true, says: 'Ile słów ma mieć całość (prywatne)' },
    { key: 'notes', label: 'Notatki prywatne', type: 'text', private: true, says: 'Tylko dla Ciebie — nigdy nie jest publikowane' }
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

export const KINDS: readonly LibKind[] = [TEXT, PROJECT, QUOTE, WORK, PERSON, TOPIC];

const BY_KIND = new Map(KINDS.map((one) => [one.kind, one]));

export const kindOf = (kind: string): LibKind | undefined => BY_KIND.get(kind);

/** Der Name eines Eintrags — gleich welcher Art. */
export function entryTitle(entry: LibEntry, look: Lookup): string {
  return kindOf(entry.kind)?.title(entry.data, look) ?? entry.kind;
}

export function entrySort(entry: LibEntry, look: Lookup): string {
  return (kindOf(entry.kind)?.sort(entry, look) ?? '').slice(0, 64);
}

/** Worauf ein Eintrag in seinen Feldern zeigt (Verweise in einem Text kommen aus `libraryMarkup`). */
export function fieldRefs(entry: LibEntry, onlyPublic = false): string[] {
  const def = kindOf(entry.kind);
  if (def === undefined) return [];
  const out: string[] = [];
  for (const field of def.fields) {
    if (onlyPublic && field.private === true) continue;
    if (field.type === 'ref' || field.type === 'refs') out.push(...ids(entry.data, field.key));
    if (field.type === 'outline') for (const item of outline(entry.data, field.key)) if ('text' in item) out.push(item.text);
  }
  return [...new Set(out)];
}

/** Die Felder ohne die privaten — die offene Fassung eines Eintrags. */
export function publicData(entry: LibEntry): EntryData {
  const def = kindOf(entry.kind);
  if (def === undefined) return {};
  const out: EntryData = {};
  for (const field of def.fields) {
    if (field.private === true) continue;
    const value = entry.data[field.key];
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) continue;
    out[field.key] = value;
  }
  return out;
}

/** Wörter eines Textes — ohne Zeichen des Zapis, ohne Verweise. */
export function wordCount(text: string): number {
  const plain = text.replace(/\[@[^\]]*\]/g, ' ').replace(/!\[@[^\]]*\]/g, ' ').replace(/[#>*_`[\]()^-]/g, ' ');
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
    case 'topic':
      return slug(str(data, 'name')).slice(0, 40) || 'temat';
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

