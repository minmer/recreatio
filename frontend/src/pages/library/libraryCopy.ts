// Self-contained copy for the library module.
//
// The module keeps its own strings rather than extending the app-wide `Copy`
// type: that type is one strongly-typed shape mirrored across pl/en/de, and a
// module this size would add several hundred keys to all four files. Same three
// languages, driven by the same `language` prop from App.

export type LibraryLanguage = 'pl' | 'en' | 'de';

type Vocab = Record<string, string>;

export type LibraryCopyStrings = {
  brand: string;
  tagline: string;
  nav: {
    dashboard: string;
    quotes: string;
    works: string;
    shelf: string;
    arrangement: string;
    people: string;
    publishers: string;
    shelves: string;
    groups: string;
    tags: string;
    loans: string;
    reading: string;
    data: string;
    back: string;
  };
  common: {
    add: string; save: string; saving: string; saved: string; cancel: string;
    edit: string; delete: string; remove: string; close: string; open: string;
    search: string; clear: string; loading: string; none: string; all: string;
    optional: string; of: string; showing: string; previous: string; next: string;
    total: string; unknown: string; nothingYet: string; confirmDelete: string;
    loadFailed: string; saveFailed: string; deleteFailed: string; copy: string;
    copied: string; language: string; notes: string; year: string; name: string;
    apply: string; applied: string;
  };
  dashboard: {
    title: string; subtitle: string;
    works: string; expressions: string; manifestations: string; items: string;
    quotes: string; translations: string; people: string; publishers: string;
    read: string; reading: string; unread: string; lentOut: string;
    borrowed: string; overdue: string;
    byLanguage: string; byScheme: string; byKind: string; byShelf: string;
    topAuthors: string; topTags: string; recentQuotes: string; recentlyAdded: string;
    unshelved: string; quickStart: string; quickStartText: string; addFirstWork: string;
  };
  works: {
    title: string; subtitle: string; newWork: string;
    searchPlaceholder: string;
    filterKind: string; filterScheme: string; filterOriginalLanguage: string;
    filterExpressionLanguage: string; filterAuthor: string; filterTag: string;
    filterPublisher: string;
    onlyTranslated: string; onlyOwned: string; onlyQuoted: string;
    sort: string; sortTitle: string; sortCreated: string; sortUpdated: string;
    sortYearAsc: string; sortYearDesc: string;
    expressionCount: string; manifestationCount: string; itemCount: string; quoteCount: string;
    empty: string; emptyFiltered: string;
  };
  work: {
    newTitle: string; editTitle: string;
    originalTitle: string; originalTitleHint: string; originalSubtitle: string;
    originalLanguage: string; originalLanguageHint: string;
    uniformTitle: string; uniformTitleHint: string;
    kind: string; firstPublishedYear: string; notes: string;
    citationSection: string; citationHint: string;
    scheme: string; schemeHint: string; sigil: string; sigilHint: string;
    structureTemplate: string; structureTemplateHint: string;
    structureAdd: string; structureKey: string; structureAbbr: string;
    authorsSection: string; authorsHint: string; tagsSection: string;
    expressionsSection: string; expressionsHint: string; addExpression: string; noExpressions: string;
    manifestationsSection: string; manifestationsHint: string; addManifestation: string; noManifestations: string;
    originalLabel: string; translationLabel: string;
    deleteWork: string; deleteWorkConfirm: string; deleteWorkHasQuotes: string;
    createFirst: string; quotesSection: string; viewQuotes: string;
  };
  expression: {
    newTitle: string; editTitle: string; ofWork: string;
    language: string; languageHint: string;
    name: string; nameHint: string; notes: string;
    translatorsSection: string; translatorsHint: string;
    manifestationsSection: string; addManifestation: string;
    deleteExpression: string; deleteConfirm: string;
    originalBadge: string; translationBadge: string; noneOption: string;
  };
  manifestation: {
    newTitle: string; editTitle: string; ofWork: string;
    format: string; formatHint: string;
    title: string; titleHint: string; subtitle: string;
    expression: string; expressionHint: string;
    publisher: string; publishedPlace: string; publishedYear: string;
    editionStatement: string; editionStatementHint: string;
    series: string; seriesNumber: string; isbn: string; issn: string;
    pageCount: string; volume: string; binding: string;
    url: string; urlHint: string; originalTextUrl: string; originalTextUrlHint: string;
    coverImageUrl: string; notes: string;
    dimensionsSection: string; dimensionsHint: string;
    heightMm: string; widthMm: string; depthMm: string;
    contributorsSection: string; contributorsHint: string;
    itemsSection: string; itemsHint: string; addItem: string; noItems: string;
    deleteManifestation: string; deleteConfirm: string;
    scanPrefill: string;
  };
  item: {
    title: string; shelf: string; placementGroup: string; positionInShelf: string;
    seriesPosition: string; signature: string; signatureHint: string;
    status: string; condition: string; acquiredDate: string; acquiredFrom: string;
    price: string; currency: string; barcode: string; readingStatus: string;
    rating: string; favourite: string; scanImageUrl: string; scanImageHint: string;
    notes: string; deleteConfirm: string;
    lendOut: string; logReading: string; onLoanTo: string; borrowedFrom: string;
    due: string; markReturned: string;
  };
  quotes: {
    title: string; subtitle: string; newQuote: string;
    searchPlaceholder: string; searchHint: string;
    filterWork: string; filterTag: string; filterAuthor: string; filterScheme: string;
    sort: string; sortNewest: string; sortOldest: string; sortUpdated: string; sortLocator: string;
    style: string; styleHint: string;
    empty: string; emptyFiltered: string;
    copyReference: string; copyQuote: string; copyBoth: string;
    showBibliography: string; bibliography: string;
  };
  quote: {
    newTitle: string; editTitle: string;
    sourceSection: string; sourceHint: string;
    work: string; workRequired: string; pickWork: string;
    expression: string; expressionHint: string; expressionNone: string;
    manifestation: string; manifestationHint: string; manifestationNone: string;
    textSection: string; quoteText: string; quoteTextHint: string;
    locatorSection: string; locatorHint: string; locatorPreview: string;
    bookField: string; chapterField: string; verseField: string; verseEndField: string;
    pageField: string; pageEndField: string; paragraphField: string; paragraphEndField: string;
    structuredHint: string; structuredNoTemplate: string;
    interpretationSection: string; description: string; descriptionHint: string;
    context: string; contextHint: string; optionalNote: string;
    tagsSection: string;
    deleteQuote: string; deleteConfirm: string;
    referencePreview: string; schemeMismatch: string;
  };
  people: {
    title: string; subtitle: string; displayName: string; displayNameHint: string;
    sortName: string; sortNameHint: string; birthYear: string; deathYear: string;
    nationality: string; notes: string; contributions: string;
    add: string; empty: string; deleteConfirm: string; searchPlaceholder: string;
    viewWorks: string;
  };
  publishers: {
    title: string; subtitle: string; name: string; city: string; notes: string;
    manifestations: string; add: string; empty: string; deleteConfirm: string;
  };
  shelves: {
    title: string; subtitle: string; name: string; nameHint: string;
    location: string; locationHint: string; description: string; sortOrder: string;
    heightMm: string; depthMm: string; widthMm: string; dimensionsHint: string;
    items: string; add: string; empty: string; deleteConfirm: string; browse: string;
  };
  groups: {
    title: string; subtitle: string; name: string; kind: string; kindHint: string;
    notes: string; items: string; add: string; empty: string; deleteConfirm: string;
  };
  tags: {
    title: string; subtitle: string; name: string; color: string;
    works: string; quotes: string; add: string; empty: string;
    deleteConfirm: string; duplicate: string;
  };
  arrangement: {
    title: string; subtitle: string; propose: string; proposing: string;
    filterShelf: string; allShelves: string;
    unplaced: string; unplacedHint: string; notes: string;
    neighbours: string; previous: string; next: string;
    applyAll: string; applyConfirm: string; applied: string;
    alreadyInPlace: string; wouldMove: string; empty: string;
  };
  loans: {
    title: string; subtitle: string; openOnly: string; direction: string;
    counterpartOut: string; counterpartIn: string; contact: string;
    lentOn: string; dueOn: string; returnedOn: string; notes: string;
    overdue: string; returned: string; open: string; empty: string;
    deleteConfirm: string; markReturned: string;
  };
  reading: {
    title: string; subtitle: string; startedOn: string; finishedOn: string;
    rating: string; notes: string; empty: string; deleteConfirm: string;
    inProgress: string; finished: string;
  };
  data: {
    title: string; subtitle: string;
    quoteImportTitle: string; quoteImportText: string; quoteImportButton: string;
    quoteImportWarning: string; quoteImportDone: string; quoteImportFailed: string;
    quoteImportErrors: string; sampleTitle: string; sampleText: string;
    chooseFile: string;
  };
  scan: {
    button: string; title: string; addTitle: string; prefillTitle: string;
    manualLabel: string; manualHint: string;
    useCamera: string; stopCamera: string; aimHint: string;
    cameraDenied: string; cameraUnsupported: string; cameraInsecure: string;
    lookUp: string; looking: string; invalidCode: string; notFound: string; lookupOff: string;
    alreadyOwned: string; alreadyOwnedHint: string; foundVia: string;
    addToLibrary: string; adding: string; addedTitle: string;
    openWork: string; openManifestation: string; searchInstead: string;
    createItem: string; createItemHint: string; shelf: string; scanAgain: string;
    prefillApplied: string; prefillNothing: string;
    treatAsOriginal: string; treatAsOriginalHint: string;
    originalTitleField: string; translationHint: string;
  };
  kinds: Vocab;
  schemes: Vocab;
  schemeHints: Vocab;
  roles: Vocab;
  formats: Vocab;
  statuses: Vocab;
  conditions: Vocab;
  readingStatuses: Vocab;
  bindings: Vocab;
  groupKinds: Vocab;
  languages: Vocab;
};

const languageNamesPl: Vocab = {
  pl: 'polski', en: 'angielski', de: 'niemiecki', fr: 'francuski', it: 'włoski',
  es: 'hiszpański', pt: 'portugalski', nl: 'niderlandzki', la: 'łacina', grc: 'greka klasyczna',
  he: 'hebrajski', ru: 'rosyjski', uk: 'ukraiński', cs: 'czeski', sk: 'słowacki',
  hu: 'węgierski', lt: 'litewski', sv: 'szwedzki', no: 'norweski', da: 'duński',
  fi: 'fiński', ro: 'rumuński', el: 'nowogrecki', tr: 'turecki', ar: 'arabski',
  zh: 'chiński', ja: 'japoński'
};

const languageNamesEn: Vocab = {
  pl: 'Polish', en: 'English', de: 'German', fr: 'French', it: 'Italian',
  es: 'Spanish', pt: 'Portuguese', nl: 'Dutch', la: 'Latin', grc: 'Ancient Greek',
  he: 'Hebrew', ru: 'Russian', uk: 'Ukrainian', cs: 'Czech', sk: 'Slovak',
  hu: 'Hungarian', lt: 'Lithuanian', sv: 'Swedish', no: 'Norwegian', da: 'Danish',
  fi: 'Finnish', ro: 'Romanian', el: 'Modern Greek', tr: 'Turkish', ar: 'Arabic',
  zh: 'Chinese', ja: 'Japanese'
};

const languageNamesDe: Vocab = {
  pl: 'Polnisch', en: 'Englisch', de: 'Deutsch', fr: 'Französisch', it: 'Italienisch',
  es: 'Spanisch', pt: 'Portugiesisch', nl: 'Niederländisch', la: 'Latein', grc: 'Altgriechisch',
  he: 'Hebräisch', ru: 'Russisch', uk: 'Ukrainisch', cs: 'Tschechisch', sk: 'Slowakisch',
  hu: 'Ungarisch', lt: 'Litauisch', sv: 'Schwedisch', no: 'Norwegisch', da: 'Dänisch',
  fi: 'Finnisch', ro: 'Rumänisch', el: 'Neugriechisch', tr: 'Türkisch', ar: 'Arabisch',
  zh: 'Chinesisch', ja: 'Japanisch'
};

const pl: LibraryCopyStrings = {
  brand: 'Biblioteka',
  tagline: 'Księgozbiór i cytaty',
  nav: {
    dashboard: 'Przegląd', quotes: 'Cytaty', works: 'Dzieła', shelf: 'Półka',
    arrangement: 'Układ', people: 'Osoby', publishers: 'Wydawnictwa', shelves: 'Regały',
    groups: 'Grupy', tags: 'Etykiety', loans: 'Wypożyczenia', reading: 'Lektury',
    data: 'Dane', back: 'Powrót'
  },
  common: {
    add: 'Dodaj', save: 'Zapisz', saving: 'Zapisywanie…', saved: 'Zapisano', cancel: 'Anuluj',
    edit: 'Edytuj', delete: 'Usuń', remove: 'Usuń', close: 'Zamknij', open: 'Otwórz',
    search: 'Szukaj', clear: 'Wyczyść', loading: 'Wczytywanie…', none: 'brak', all: 'wszystkie',
    optional: 'opcjonalne', of: 'z', showing: 'Pokazano', previous: 'Poprzednia', next: 'Następna',
    total: 'łącznie', unknown: 'nieznane', nothingYet: 'Nic tu jeszcze nie ma.',
    confirmDelete: 'Czy na pewno usunąć?', loadFailed: 'Nie udało się wczytać danych.',
    saveFailed: 'Nie udało się zapisać.', deleteFailed: 'Nie udało się usunąć.',
    copy: 'Kopiuj', copied: 'Skopiowano', language: 'Język', notes: 'Notatki',
    year: 'Rok', name: 'Nazwa', apply: 'Zastosuj', applied: 'Zastosowano'
  },
  dashboard: {
    title: 'Biblioteka', subtitle: 'Dzieła, przekłady, wydania, egzemplarze i cytaty.',
    works: 'Dzieła', expressions: 'Wersje językowe', manifestations: 'Wydania', items: 'Egzemplarze',
    quotes: 'Cytaty', translations: 'Przekłady', people: 'Osoby', publishers: 'Wydawnictwa',
    read: 'Przeczytane', reading: 'W trakcie', unread: 'Nieprzeczytane',
    lentOut: 'Wypożyczone innym', borrowed: 'Pożyczone', overdue: 'Po terminie',
    byLanguage: 'Wg języka', byScheme: 'Wg sposobu cytowania', byKind: 'Wg rodzaju',
    byShelf: 'Wg regału', topAuthors: 'Najczęstsi autorzy', topTags: 'Najczęstsze etykiety',
    recentQuotes: 'Ostatnie cytaty', recentlyAdded: 'Ostatnio dodane', unshelved: 'Bez regału',
    quickStart: 'Od czego zacząć',
    quickStartText:
      'Dodaj dzieło z tytułem oryginalnym i sposobem cytowania. Potem dopisz wersję językową (przekład), wydanie, a na końcu egzemplarz — albo od razu zapisz cytat, nawet jeśli książki nie masz.',
    addFirstWork: 'Dodaj pierwsze dzieło'
  },
  works: {
    title: 'Dzieła', subtitle: 'Utwory niezależnie od wydania.', newWork: 'Nowe dzieło',
    searchPlaceholder: 'Tytuł, tytuł wydania lub ISBN…',
    filterKind: 'Rodzaj', filterScheme: 'Sposób cytowania', filterOriginalLanguage: 'Język oryginału',
    filterExpressionLanguage: 'Język wersji', filterAuthor: 'Osoba', filterTag: 'Etykieta',
    filterPublisher: 'Wydawnictwo',
    onlyTranslated: 'Tylko z przekładem', onlyOwned: 'Tylko posiadane', onlyQuoted: 'Tylko cytowane',
    sort: 'Sortowanie', sortTitle: 'Tytuł', sortCreated: 'Ostatnio dodane',
    sortUpdated: 'Ostatnio zmienione', sortYearAsc: 'Rok rosnąco', sortYearDesc: 'Rok malejąco',
    expressionCount: 'wers.', manifestationCount: 'wyd.', itemCount: 'egz.', quoteCount: 'cyt.',
    empty: 'Brak dzieł. Dodaj pierwsze, aby zacząć.',
    emptyFiltered: 'Żadne dzieło nie pasuje do filtrów.'
  },
  work: {
    newTitle: 'Nowe dzieło', editTitle: 'Dzieło',
    originalTitle: 'Tytuł oryginalny', originalTitleHint: 'Tytuł w języku, w którym dzieło powstało.',
    originalSubtitle: 'Podtytuł oryginalny',
    originalLanguage: 'Język oryginału',
    originalLanguageHint: 'Wersja w innym języku zostanie rozpoznana jako przekład.',
    uniformTitle: 'Tytuł ujednolicony', uniformTitleHint: 'Tytuł, pod którym trzymasz to dzieło.',
    kind: 'Rodzaj', firstPublishedYear: 'Rok powstania', notes: 'Notatki',
    citationSection: 'Sposób cytowania',
    citationHint: 'Decyduje, jakie pola lokalizacji pojawią się przy cytacie z tego dzieła.',
    scheme: 'Schemat', schemeHint: 'Strona, werset biblijny, struktura wewnętrzna albo numer punktu.',
    sigil: 'Sigla', sigilHint: 'Skrót przed lokalizacją, np. „STh” albo „FR”.',
    structureTemplate: 'Struktura wewnętrzna',
    structureTemplateHint: 'Kolejne poziomy podziału, np. część → kwestia → artykuł.',
    structureAdd: 'Dodaj poziom', structureKey: 'Klucz', structureAbbr: 'Skrót',
    authorsSection: 'Autorzy', authorsHint: 'Autorstwo należy do dzieła. Tłumacza dopisz przy wersji językowej.',
    tagsSection: 'Etykiety',
    expressionsSection: 'Wersje językowe',
    expressionsHint: 'Przekład albo nazwany tekst oryginalny. Dzieło bez rozróżnień nie potrzebuje żadnej.',
    addExpression: 'Dodaj wersję', noExpressions: 'Brak wersji językowych.',
    manifestationsSection: 'Wydania',
    manifestationsHint: 'Konkretna publikacja: druk, strona internetowa albo e-book.',
    addManifestation: 'Dodaj wydanie', noManifestations: 'Brak wydań.',
    originalLabel: 'oryginał', translationLabel: 'przekład',
    deleteWork: 'Usuń dzieło',
    deleteWorkConfirm: 'Usunąć to dzieło wraz z wersjami, wydaniami i egzemplarzami?',
    deleteWorkHasQuotes: 'To dzieło ma cytaty. Usunięcie skasuje także je. Kontynuować?',
    createFirst: 'Zapisz dzieło, aby dodać wersje i wydania.',
    quotesSection: 'Cytaty', viewQuotes: 'Pokaż cytaty'
  },
  expression: {
    newTitle: 'Nowa wersja językowa', editTitle: 'Wersja językowa', ofWork: 'Dzieło',
    language: 'Język', languageHint: 'Inny niż język oryginału oznacza przekład.',
    name: 'Nazwa', nameHint: 'Np. „Biblia Tysiąclecia”, „wydanie Marietti”.',
    notes: 'Notatki',
    translatorsSection: 'Tłumacze', translatorsHint: 'Przekład należy do wersji językowej, nie do wydania.',
    manifestationsSection: 'Wydania tej wersji', addManifestation: 'Dodaj wydanie',
    deleteExpression: 'Usuń wersję',
    deleteConfirm: 'Usunąć tę wersję językową? Cytaty i wydania pozostaną, stracą tylko odniesienie.',
    originalBadge: 'oryginał', translationBadge: 'przekład', noneOption: '— bez wersji (oryginał) —'
  },
  manifestation: {
    newTitle: 'Nowe wydanie', editTitle: 'Wydanie', ofWork: 'Dzieło',
    format: 'Postać', formatHint: 'Druk, strona internetowa albo e-book.',
    title: 'Tytuł wydania', titleHint: 'Tytuł z karty tytułowej.',
    subtitle: 'Podtytuł',
    expression: 'Wersja językowa', expressionHint: 'Wybierz przekład albo zostaw puste dla oryginału.',
    publisher: 'Wydawnictwo', publishedPlace: 'Miejsce wydania', publishedYear: 'Rok wydania',
    editionStatement: 'Oznaczenie wydania', editionStatementHint: 'Np. „wyd. 2 popr.”.',
    series: 'Seria', seriesNumber: 'Numer w serii', isbn: 'ISBN', issn: 'ISSN',
    pageCount: 'Liczba stron', volume: 'Tom', binding: 'Oprawa',
    url: 'Adres strony', urlHint: 'Wymagany dla źródła internetowego.',
    originalTextUrl: 'Adres tekstu oryginalnego',
    originalTextUrlHint: 'Tylko do odnalezienia tekstu — nie trafia do przypisu.',
    coverImageUrl: 'Adres okładki', notes: 'Notatki',
    dimensionsSection: 'Wymiary',
    dimensionsHint: 'Potrzebne, aby układ półek sprawdził, czy książka się zmieści.',
    heightMm: 'Wysokość (mm)', widthMm: 'Szerokość (mm)', depthMm: 'Grubość (mm)',
    contributorsSection: 'Współtwórcy wydania',
    contributorsHint: 'Redaktor, ilustrator, autor wstępu.',
    itemsSection: 'Egzemplarze', itemsHint: 'Fizyczne książki, które masz z tego wydania.',
    addItem: 'Dodaj egzemplarz', noItems: 'Brak egzemplarzy.',
    deleteManifestation: 'Usuń wydanie',
    deleteConfirm: 'Usunąć to wydanie wraz z egzemplarzami?',
    scanPrefill: 'Wczytaj z ISBN'
  },
  item: {
    title: 'Egzemplarz', shelf: 'Regał', placementGroup: 'Grupa', positionInShelf: 'Pozycja na półce',
    seriesPosition: 'Numer w serii', signature: 'Sygnatura', signatureHint: 'Twoje oznaczenie.',
    status: 'Status', condition: 'Stan', acquiredDate: 'Data nabycia', acquiredFrom: 'Skąd',
    price: 'Cena', currency: 'Waluta', barcode: 'Kod kreskowy', readingStatus: 'Lektura',
    rating: 'Ocena', favourite: 'Ulubione', scanImageUrl: 'Skan okładki',
    scanImageHint: 'Używany, gdy nie udało się pobrać okładki.',
    notes: 'Notatki', deleteConfirm: 'Usunąć ten egzemplarz?',
    lendOut: 'Wypożycz', logReading: 'Zapisz lekturę', onLoanTo: 'Wypożyczone:',
    borrowedFrom: 'Pożyczone od:', due: 'termin', markReturned: 'Oznacz jako zwrócone'
  },
  quotes: {
    title: 'Cytaty', subtitle: 'Wypisy wraz z pełnym odsyłaczem.', newQuote: 'Nowy cytat',
    searchPlaceholder: 'Treść, dzieło, autor, etykieta lub lokalizacja…',
    searchHint: 'Jedno pole przeszukuje treść cytatu, tytuł, autora, etykiety i lokalizację.',
    filterWork: 'Dzieło', filterTag: 'Etykieta', filterAuthor: 'Autor', filterScheme: 'Sposób cytowania',
    sort: 'Sortowanie', sortNewest: 'Najnowsze', sortOldest: 'Najstarsze',
    sortUpdated: 'Ostatnio zmienione', sortLocator: 'Lokalizacja',
    style: 'Styl cytowania', styleHint: 'Zmienia zapis odsyłacza, nie samo miejsce w dziele.',
    empty: 'Brak cytatów. Dodaj pierwszy.', emptyFiltered: 'Żaden cytat nie pasuje do filtrów.',
    copyReference: 'Kopiuj odsyłacz', copyQuote: 'Kopiuj cytat', copyBoth: 'Kopiuj z odsyłaczem',
    showBibliography: 'Pokaż formę bibliograficzną', bibliography: 'Forma bibliograficzna'
  },
  quote: {
    newTitle: 'Nowy cytat', editTitle: 'Cytat',
    sourceSection: 'Źródło', sourceHint: 'Cytat zawsze należy do dzieła. Reszta jest opcjonalna.',
    work: 'Dzieło', workRequired: 'Wybierz dzieło.', pickWork: 'Szukaj dzieła…',
    expression: 'Wersja językowa', expressionHint: 'Który przekład — istotne przy Biblii.',
    expressionNone: '— nie dotyczy —',
    manifestation: 'Wydanie', manifestationHint: 'Gdzie to znalazłem — istotne przy numerze strony.',
    manifestationNone: '— nie dotyczy —',
    textSection: 'Treść', quoteText: 'Cytat', quoteTextHint: 'Dosłowne brzmienie.',
    locatorSection: 'Lokalizacja', locatorHint: 'Pola zależą od sposobu cytowania wybranego dzieła.',
    locatorPreview: 'Podgląd',
    bookField: 'Księga', chapterField: 'Rozdział', verseField: 'Werset', verseEndField: 'Werset końcowy',
    pageField: 'Strona', pageEndField: 'Strona końcowa',
    paragraphField: 'Punkt', paragraphEndField: 'Punkt końcowy',
    structuredHint: 'Poziomy pochodzą ze struktury zdefiniowanej przy dziele.',
    structuredNoTemplate: 'To dzieło nie ma jeszcze zdefiniowanej struktury — uzupełnij ją w dziele.',
    interpretationSection: 'Moje uwagi', description: 'Interpretacja',
    descriptionHint: 'Jak rozumiem ten tekst.',
    context: 'Kontekst', contextHint: 'O czym jest otaczający fragment.',
    optionalNote: 'Oba pola są opcjonalne — sam cytat wystarczy.',
    tagsSection: 'Etykiety',
    deleteQuote: 'Usuń cytat', deleteConfirm: 'Usunąć ten cytat?',
    referencePreview: 'Odsyłacz', schemeMismatch: 'Wybrane dzieło używa innego sposobu cytowania.'
  },
  people: {
    title: 'Osoby', subtitle: 'Autorzy, tłumacze, redaktorzy.',
    displayName: 'Nazwa wyświetlana', displayNameHint: 'Jak na karcie tytułowej, np. „Karl Rahner”.',
    sortName: 'Nazwa do sortowania',
    sortNameHint: 'Forma katalogowa, np. „Rahner, Karl”. Ważna dla stylów cytowania.',
    birthYear: 'Rok urodzenia', deathYear: 'Rok śmierci', nationality: 'Narodowość',
    notes: 'Notatki', contributions: 'przypisań', add: 'Dodaj osobę',
    empty: 'Brak osób.', deleteConfirm: 'Usunąć tę osobę? Przypisania znikną, dzieła pozostaną.',
    searchPlaceholder: 'Szukaj osoby…', viewWorks: 'Pokaż dzieła'
  },
  publishers: {
    title: 'Wydawnictwa', subtitle: 'Oficyny wydań w zbiorach.',
    name: 'Nazwa', city: 'Miasto', notes: 'Notatki', manifestations: 'wydań',
    add: 'Dodaj wydawnictwo', empty: 'Brak wydawnictw.',
    deleteConfirm: 'Usunąć to wydawnictwo? Wydania pozostaną.'
  },
  shelves: {
    title: 'Regały', subtitle: 'Fizyczne miejsca i ich wymiary.',
    name: 'Nazwa', nameHint: 'Np. „Regał A, półka 3”.',
    location: 'Lokalizacja', locationHint: 'Pokój lub budynek.',
    description: 'Opis', sortOrder: 'Kolejność',
    heightMm: 'Wysokość (mm)', depthMm: 'Głębokość (mm)', widthMm: 'Szerokość (mm)',
    dimensionsHint: 'Bez wymiarów układ nie sprawdzi, czy książka się zmieści.',
    items: 'egz.', add: 'Dodaj regał', empty: 'Brak regałów.',
    deleteConfirm: 'Usunąć ten regał? Egzemplarze pozostaną bez przypisania.', browse: 'Przeglądaj'
  },
  groups: {
    title: 'Grupy ustawienia', subtitle: 'Serie i zestawy, które mają stać razem.',
    name: 'Nazwa', kind: 'Rodzaj',
    kindHint: 'Seria zachowuje kolejność, zestaw tylko sąsiedztwo.',
    notes: 'Notatki', items: 'egz.', add: 'Dodaj grupę', empty: 'Brak grup.',
    deleteConfirm: 'Usunąć tę grupę? Egzemplarze pozostaną.'
  },
  tags: {
    title: 'Etykiety', subtitle: 'Tematy przypisane do dzieł i cytatów.',
    name: 'Nazwa', color: 'Kolor', works: 'dzieł', quotes: 'cytatów',
    add: 'Dodaj etykietę', empty: 'Brak etykiet.',
    deleteConfirm: 'Usunąć tę etykietę wszędzie?', duplicate: 'Etykieta o tej nazwie już istnieje.'
  },
  arrangement: {
    title: 'Układ półek', subtitle: 'Propozycja ustawienia — decyzja należy do Ciebie.',
    propose: 'Zaproponuj układ', proposing: 'Liczenie…',
    filterShelf: 'Regał', allShelves: 'Wszystkie regały',
    unplaced: 'Nie zmieściły się', unplacedHint: 'Każda pozycja z powodem.',
    notes: 'Uwagi', neighbours: 'Sąsiedztwo', previous: 'poprzednia', next: 'następna',
    applyAll: 'Zastosuj propozycję', applyConfirm: 'Zapisać to ustawienie dla wszystkich pozycji?',
    applied: 'Ustawienie zapisane.',
    alreadyInPlace: 'już na miejscu', wouldMove: 'do przestawienia',
    empty: 'Brak egzemplarzy do ustawienia.'
  },
  loans: {
    title: 'Wypożyczenia', subtitle: 'Co pożyczyłem i co pożyczono mnie.',
    openOnly: 'Tylko otwarte', direction: 'Kierunek',
    counterpartOut: 'Komu', counterpartIn: 'Od kogo', contact: 'Kontakt',
    lentOn: 'Data wypożyczenia', dueOn: 'Termin zwrotu', returnedOn: 'Data zwrotu',
    notes: 'Notatki', overdue: 'po terminie', returned: 'zwrócone', open: 'otwarte',
    empty: 'Brak wypożyczeń.', deleteConfirm: 'Usunąć ten wpis?', markReturned: 'Zwrócone dziś'
  },
  reading: {
    title: 'Lektury', subtitle: 'Dziennik czytania.',
    startedOn: 'Rozpoczęto', finishedOn: 'Ukończono', rating: 'Ocena', notes: 'Notatki',
    empty: 'Brak wpisów.', deleteConfirm: 'Usunąć ten wpis?',
    inProgress: 'w trakcie', finished: 'ukończone'
  },
  data: {
    title: 'Dane', subtitle: 'Import cytatów z pliku JSON.',
    quoteImportTitle: 'Import cytatów',
    quoteImportText: 'Wczytuje tablicę cytatów. Dzieło można podać przez „workId” albo przez tytuł i język.',
    quoteImportButton: 'Importuj cytaty',
    quoteImportWarning: 'Import dodaje wpisy obok istniejących. Błędny rekord nie przerywa całości.',
    quoteImportDone: 'Zaimportowano:', quoteImportFailed: 'Nie udało się wczytać pliku.',
    quoteImportErrors: 'Odrzucone rekordy', sampleTitle: 'Przykładowy plik',
    sampleText: 'Minimalny cytat to tekst i dzieło. Reszta jest opcjonalna.',
    chooseFile: 'Wybierz plik'
  },
  scan: {
    button: 'Skanuj', title: 'Skanuj kod kreskowy', addTitle: 'Dodaj przez skanowanie',
    prefillTitle: 'Wczytaj dane z ISBN',
    manualLabel: 'ISBN lub kod kreskowy',
    manualHint: 'Wpisz numer i naciśnij Enter. Skaner ręczny wpisze go sam.',
    useCamera: 'Użyj aparatu', stopCamera: 'Zatrzymaj aparat',
    aimHint: 'Skieruj aparat na kod kreskowy.',
    cameraDenied: 'Brak dostępu do aparatu. Wpisz numer ręcznie.',
    cameraUnsupported: 'Ta przeglądarka nie obsługuje skanowania. Wpisz numer ręcznie.',
    cameraInsecure: 'Aparat wymaga HTTPS. Wpisz numer ręcznie.',
    lookUp: 'Szukaj', looking: 'Szukanie…',
    invalidCode: 'To nie jest poprawny numer ISBN.',
    notFound: 'Nie znaleziono w katalogach publicznych.',
    lookupOff: 'Wyszukiwanie zewnętrzne jest wyłączone.',
    alreadyOwned: 'Masz już tę książkę', alreadyOwnedHint: 'Ten ISBN jest już w bibliotece.',
    foundVia: 'źródło', addToLibrary: 'Dodaj do biblioteki', adding: 'Dodawanie…',
    addedTitle: 'Dodano do biblioteki', openWork: 'Otwórz dzieło', openManifestation: 'Otwórz wydanie',
    searchInstead: 'Szukaj w bibliotece', createItem: 'Dodaj egzemplarz na półkę',
    createItemHint: 'Odznacz, aby skatalogować wydanie bez posiadania go.',
    shelf: 'Regał', scanAgain: 'Skanuj kolejną',
    prefillApplied: 'Wczytano dane z ISBN.', prefillNothing: 'Nie znaleziono danych.',
    treatAsOriginal: 'To jest wydanie oryginalne',
    treatAsOriginalHint: 'Odznacz, jeśli skanujesz przekład.',
    originalTitleField: 'Tytuł oryginalny',
    translationHint: 'Katalogi opisują wydanie, nie oryginał.'
  },
  kinds: {
    book: 'książka', article: 'artykuł', essay: 'esej', poetry: 'poezja', drama: 'dramat',
    treatise: 'traktat', collection: 'zbiór', reference: 'wydawnictwo źródłowe',
    scripture: 'Pismo Święte', document: 'dokument', other: 'inne'
  },
  schemes: {
    Page: 'strona', BibleReference: 'werset biblijny',
    StructuredWork: 'struktura wewnętrzna', DocumentParagraph: 'numer punktu'
  },
  schemeHints: {
    Page: 'Numer strony należy do wydania.',
    BibleReference: 'Liczy się przekład, nie druk.',
    StructuredWork: 'Cytowane wg własnego podziału dzieła.',
    DocumentParagraph: 'Cytowany jest dokument, nie strona internetowa.'
  },
  roles: {
    author: 'autor', coauthor: 'współautor', editor: 'redaktor', translator: 'tłumacz',
    illustrator: 'ilustrator', foreword: 'autor wstępu', afterword: 'autor posłowia',
    commentary: 'autor komentarza', compiler: 'opracowanie', other: 'inna rola'
  },
  formats: { Print: 'druk', Web: 'strona internetowa', Ebook: 'e-book' },
  statuses: {
    shelf: 'na półce', lent: 'wypożyczone', borrowed: 'pożyczone', wanted: 'poszukiwane',
    ordered: 'zamówione', lost: 'zagubione', sold: 'sprzedane'
  },
  conditions: { new: 'nowy', good: 'dobry', fair: 'przeciętny', worn: 'zaczytany', damaged: 'uszkodzony' },
  readingStatuses: {
    unread: 'nieprzeczytane', reading: 'w trakcie', read: 'przeczytane',
    abandoned: 'porzucone', reference: 'podręczne'
  },
  bindings: {
    hardcover: 'twarda', paperback: 'miękka', leather: 'skórzana',
    ebook: 'e-book', audiobook: 'audiobook', other: 'inna'
  },
  groupKinds: { series: 'seria (kolejność)', collection: 'zestaw (sąsiedztwo)', free: 'bez ograniczeń' },
  languages: languageNamesPl
};

const en: LibraryCopyStrings = {
  brand: 'Library',
  tagline: 'Books and quotations',
  nav: {
    dashboard: 'Overview', quotes: 'Quotes', works: 'Works', shelf: 'Shelf',
    arrangement: 'Arrangement', people: 'People', publishers: 'Publishers', shelves: 'Shelves',
    groups: 'Groups', tags: 'Tags', loans: 'Loans', reading: 'Reading', data: 'Data', back: 'Back'
  },
  common: {
    add: 'Add', save: 'Save', saving: 'Saving…', saved: 'Saved', cancel: 'Cancel',
    edit: 'Edit', delete: 'Delete', remove: 'Remove', close: 'Close', open: 'Open',
    search: 'Search', clear: 'Clear', loading: 'Loading…', none: 'none', all: 'all',
    optional: 'optional', of: 'of', showing: 'Showing', previous: 'Previous', next: 'Next',
    total: 'total', unknown: 'unknown', nothingYet: 'Nothing here yet.',
    confirmDelete: 'Delete this?', loadFailed: 'Could not load the data.',
    saveFailed: 'Could not save.', deleteFailed: 'Could not delete.',
    copy: 'Copy', copied: 'Copied', language: 'Language', notes: 'Notes',
    year: 'Year', name: 'Name', apply: 'Apply', applied: 'Applied'
  },
  dashboard: {
    title: 'Library', subtitle: 'Works, translations, editions, copies and quotations.',
    works: 'Works', expressions: 'Translations', manifestations: 'Editions', items: 'Copies',
    quotes: 'Quotes', translations: 'Translated', people: 'People', publishers: 'Publishers',
    read: 'Read', reading: 'Reading', unread: 'Unread',
    lentOut: 'Lent out', borrowed: 'Borrowed', overdue: 'Overdue',
    byLanguage: 'By language', byScheme: 'By citation scheme', byKind: 'By kind',
    byShelf: 'By shelf', topAuthors: 'Most frequent authors', topTags: 'Most used tags',
    recentQuotes: 'Recent quotes', recentlyAdded: 'Recently added', unshelved: 'Unshelved',
    quickStart: 'Where to start',
    quickStartText:
      'Add a work with its original title and citation scheme. Then attach a translation, an edition, and finally a copy — or record a quote straight away, even for a book you do not own.',
    addFirstWork: 'Add the first work'
  },
  works: {
    title: 'Works', subtitle: 'The creations themselves, independent of any edition.',
    newWork: 'New work', searchPlaceholder: 'Title, edition title or ISBN…',
    filterKind: 'Kind', filterScheme: 'Citation scheme', filterOriginalLanguage: 'Original language',
    filterExpressionLanguage: 'Translation language', filterAuthor: 'Person', filterTag: 'Tag',
    filterPublisher: 'Publisher',
    onlyTranslated: 'Only translated', onlyOwned: 'Only owned', onlyQuoted: 'Only quoted',
    sort: 'Sort', sortTitle: 'Title', sortCreated: 'Recently added',
    sortUpdated: 'Recently changed', sortYearAsc: 'Year ascending', sortYearDesc: 'Year descending',
    expressionCount: 'transl.', manifestationCount: 'ed.', itemCount: 'cop.', quoteCount: 'quo.',
    empty: 'No works yet. Add the first one.',
    emptyFiltered: 'No work matches these filters.'
  },
  work: {
    newTitle: 'New work', editTitle: 'Work',
    originalTitle: 'Original title', originalTitleHint: 'The title in the language it was written in.',
    originalSubtitle: 'Original subtitle',
    originalLanguage: 'Original language',
    originalLanguageHint: 'A version in another language is recognised as a translation.',
    uniformTitle: 'Uniform title', uniformTitleHint: 'The title you file this work under.',
    kind: 'Kind', firstPublishedYear: 'First written', notes: 'Notes',
    citationSection: 'Citation',
    citationHint: 'Decides which locator fields appear on a quote from this work.',
    scheme: 'Scheme', schemeHint: 'Page, biblical verse, internal structure or paragraph number.',
    sigil: 'Sigil', sigilHint: 'Abbreviation before the locator, e.g. "STh" or "FR".',
    structureTemplate: 'Internal structure',
    structureTemplateHint: 'The levels of division, e.g. part → question → article.',
    structureAdd: 'Add level', structureKey: 'Key', structureAbbr: 'Abbreviation',
    authorsSection: 'Authors', authorsHint: 'Authorship belongs to the work. Translators go on the translation.',
    tagsSection: 'Tags',
    expressionsSection: 'Translations',
    expressionsHint: 'A translation, or a named original text. A work with nothing to distinguish needs none.',
    addExpression: 'Add translation', noExpressions: 'No translations yet.',
    manifestationsSection: 'Editions',
    manifestationsHint: 'A concrete publication: print, web page or ebook.',
    addManifestation: 'Add edition', noManifestations: 'No editions yet.',
    originalLabel: 'original', translationLabel: 'translation',
    deleteWork: 'Delete work',
    deleteWorkConfirm: 'Delete this work with its translations, editions and copies?',
    deleteWorkHasQuotes: 'This work has quotes. Deleting removes them too. Continue?',
    createFirst: 'Save the work to add translations and editions.',
    quotesSection: 'Quotes', viewQuotes: 'Show quotes'
  },
  expression: {
    newTitle: 'New translation', editTitle: 'Translation', ofWork: 'Work',
    language: 'Language', languageHint: 'Different from the original means this is a translation.',
    name: 'Name', nameHint: 'e.g. "Einheitsübersetzung 2016", "Marietti edition".',
    notes: 'Notes',
    translatorsSection: 'Translators', translatorsHint: 'Translation belongs here, not on the edition.',
    manifestationsSection: 'Editions of this version', addManifestation: 'Add edition',
    deleteExpression: 'Delete translation',
    deleteConfirm: 'Delete this translation? Quotes and editions survive without the reference.',
    originalBadge: 'original', translationBadge: 'translation', noneOption: '— none (original) —'
  },
  manifestation: {
    newTitle: 'New edition', editTitle: 'Edition', ofWork: 'Work',
    format: 'Format', formatHint: 'Print, web page or ebook.',
    title: 'Edition title', titleHint: 'The title on the title page.',
    subtitle: 'Subtitle',
    expression: 'Translation', expressionHint: 'Pick a translation, or leave empty for the original.',
    publisher: 'Publisher', publishedPlace: 'Place of publication', publishedYear: 'Year',
    editionStatement: 'Edition statement', editionStatementHint: 'For example "2nd revised edition".',
    series: 'Series', seriesNumber: 'Number in series', isbn: 'ISBN', issn: 'ISSN',
    pageCount: 'Pages', volume: 'Volume', binding: 'Binding',
    url: 'URL', urlHint: 'Required for a web source.',
    originalTextUrl: 'Original text URL',
    originalTextUrlHint: 'For finding the text only — never appears in the footnote.',
    coverImageUrl: 'Cover image URL', notes: 'Notes',
    dimensionsSection: 'Dimensions',
    dimensionsHint: 'Needed so the shelf arrangement can check what fits.',
    heightMm: 'Height (mm)', widthMm: 'Width (mm)', depthMm: 'Depth (mm)',
    contributorsSection: 'Edition contributors',
    contributorsHint: 'Editor, illustrator, author of the foreword.',
    itemsSection: 'Copies', itemsHint: 'The physical books you hold of this edition.',
    addItem: 'Add copy', noItems: 'No copies.',
    deleteManifestation: 'Delete edition',
    deleteConfirm: 'Delete this edition with its copies?',
    scanPrefill: 'Load from ISBN'
  },
  item: {
    title: 'Copy', shelf: 'Shelf', placementGroup: 'Group', positionInShelf: 'Position on shelf',
    seriesPosition: 'Number in series', signature: 'Signature', signatureHint: 'Your own call number.',
    status: 'Status', condition: 'Condition', acquiredDate: 'Acquired on', acquiredFrom: 'Acquired from',
    price: 'Price', currency: 'Currency', barcode: 'Barcode', readingStatus: 'Reading',
    rating: 'Rating', favourite: 'Favourite', scanImageUrl: 'Cover scan',
    scanImageHint: 'Used when no cover could be fetched.',
    notes: 'Notes', deleteConfirm: 'Delete this copy?',
    lendOut: 'Lend out', logReading: 'Log reading', onLoanTo: 'Lent to:',
    borrowedFrom: 'Borrowed from:', due: 'due', markReturned: 'Mark returned'
  },
  quotes: {
    title: 'Quotes', subtitle: 'Passages with their full reference.', newQuote: 'New quote',
    searchPlaceholder: 'Text, work, author, tag or locator…',
    searchHint: 'One box searches the passage, title, author, tags and locator.',
    filterWork: 'Work', filterTag: 'Tag', filterAuthor: 'Author', filterScheme: 'Citation scheme',
    sort: 'Sort', sortNewest: 'Newest', sortOldest: 'Oldest',
    sortUpdated: 'Recently changed', sortLocator: 'Locator',
    style: 'Citation style', styleHint: 'Changes how the reference is written, not where the quote sits.',
    empty: 'No quotes yet. Add the first one.', emptyFiltered: 'No quote matches these filters.',
    copyReference: 'Copy reference', copyQuote: 'Copy quote', copyBoth: 'Copy with reference',
    showBibliography: 'Show bibliography form', bibliography: 'Bibliography form'
  },
  quote: {
    newTitle: 'New quote', editTitle: 'Quote',
    sourceSection: 'Source', sourceHint: 'A quote always belongs to a work. The rest is optional.',
    work: 'Work', workRequired: 'Choose a work.', pickWork: 'Search works…',
    expression: 'Translation', expressionHint: 'Which translation — this is what matters for scripture.',
    expressionNone: '— not applicable —',
    manifestation: 'Edition', manifestationHint: 'Where I found it — this is what matters for a page number.',
    manifestationNone: '— not applicable —',
    textSection: 'Text', quoteText: 'Quote', quoteTextHint: 'The verbatim wording.',
    locatorSection: 'Locator', locatorHint: "Fields follow the work's citation scheme.",
    locatorPreview: 'Preview',
    bookField: 'Book', chapterField: 'Chapter', verseField: 'Verse', verseEndField: 'Verse to',
    pageField: 'Page', pageEndField: 'Page to',
    paragraphField: 'Paragraph', paragraphEndField: 'Paragraph to',
    structuredHint: 'Levels come from the structure defined on the work.',
    structuredNoTemplate: 'This work has no structure defined yet — set one on the work.',
    interpretationSection: 'My notes', description: 'Interpretation',
    descriptionHint: 'How I read this passage.',
    context: 'Context', contextHint: 'What the surrounding passage is about.',
    optionalNote: 'Both fields are optional — a bare quote is enough.',
    tagsSection: 'Tags',
    deleteQuote: 'Delete quote', deleteConfirm: 'Delete this quote?',
    referencePreview: 'Reference', schemeMismatch: 'The chosen work uses a different citation scheme.'
  },
  people: {
    title: 'People', subtitle: 'Authors, translators, editors.',
    displayName: 'Display name', displayNameHint: 'As on the title page, e.g. "Karl Rahner".',
    sortName: 'Sort name',
    sortNameHint: 'The filing form, e.g. "Rahner, Karl". Citation styles depend on it.',
    birthYear: 'Born', deathYear: 'Died', nationality: 'Nationality',
    notes: 'Notes', contributions: 'attributions', add: 'Add person',
    empty: 'No people yet.', deleteConfirm: 'Delete this person? Attributions go, works stay.',
    searchPlaceholder: 'Search people…', viewWorks: 'Show works'
  },
  publishers: {
    title: 'Publishers', subtitle: 'The houses behind the editions.',
    name: 'Name', city: 'City', notes: 'Notes', manifestations: 'editions',
    add: 'Add publisher', empty: 'No publishers yet.',
    deleteConfirm: 'Delete this publisher? Editions stay.'
  },
  shelves: {
    title: 'Shelves', subtitle: 'Physical places and their dimensions.',
    name: 'Name', nameHint: 'For example "Bookcase A, shelf 3".',
    location: 'Location', locationHint: 'Room or building.',
    description: 'Description', sortOrder: 'Order',
    heightMm: 'Height (mm)', depthMm: 'Depth (mm)', widthMm: 'Width (mm)',
    dimensionsHint: 'Without dimensions the arrangement cannot check what fits.',
    items: 'copies', add: 'Add shelf', empty: 'No shelves yet.',
    deleteConfirm: 'Delete this shelf? Copies stay but become unshelved.', browse: 'Browse'
  },
  groups: {
    title: 'Placement groups', subtitle: 'Series and sets that belong together.',
    name: 'Name', kind: 'Kind',
    kindHint: 'A series keeps its order; a set only needs to stay adjacent.',
    notes: 'Notes', items: 'copies', add: 'Add group', empty: 'No groups yet.',
    deleteConfirm: 'Delete this group? Copies stay.'
  },
  tags: {
    title: 'Tags', subtitle: 'Subjects attached to works and quotes.',
    name: 'Name', color: 'Colour', works: 'works', quotes: 'quotes',
    add: 'Add tag', empty: 'No tags yet.',
    deleteConfirm: 'Remove this tag everywhere?', duplicate: 'A tag with this name already exists.'
  },
  arrangement: {
    title: 'Shelf arrangement', subtitle: 'A suggestion — the decision stays yours.',
    propose: 'Propose an arrangement', proposing: 'Working…',
    filterShelf: 'Shelf', allShelves: 'All shelves',
    unplaced: 'Did not fit', unplacedHint: 'Each with its reason.',
    notes: 'Notes', neighbours: 'Neighbours', previous: 'previous', next: 'next',
    applyAll: 'Apply this arrangement', applyConfirm: 'Save this placement for every listed copy?',
    applied: 'Placement saved.',
    alreadyInPlace: 'already in place', wouldMove: 'would move',
    empty: 'No copies to arrange.'
  },
  loans: {
    title: 'Loans', subtitle: 'What I lent out and what I borrowed.',
    openOnly: 'Open only', direction: 'Direction',
    counterpartOut: 'Lent to', counterpartIn: 'Borrowed from', contact: 'Contact',
    lentOn: 'Lent on', dueOn: 'Due on', returnedOn: 'Returned on',
    notes: 'Notes', overdue: 'overdue', returned: 'returned', open: 'open',
    empty: 'No loans recorded.', deleteConfirm: 'Delete this record?', markReturned: 'Returned today'
  },
  reading: {
    title: 'Reading', subtitle: 'The reading log.',
    startedOn: 'Started', finishedOn: 'Finished', rating: 'Rating', notes: 'Notes',
    empty: 'No entries yet.', deleteConfirm: 'Delete this entry?',
    inProgress: 'in progress', finished: 'finished'
  },
  data: {
    title: 'Data', subtitle: 'Import quotes from a JSON file.',
    quoteImportTitle: 'Quote import',
    quoteImportText: 'Reads an array of quotes. A work can be given by "workId" or by title and language.',
    quoteImportButton: 'Import quotes',
    quoteImportWarning: 'Import adds alongside existing entries. One bad record does not stop the batch.',
    quoteImportDone: 'Imported:', quoteImportFailed: 'Could not read the file.',
    quoteImportErrors: 'Rejected records', sampleTitle: 'Example file',
    sampleText: 'A minimal quote is text plus a work. Everything else is optional.',
    chooseFile: 'Choose file'
  },
  scan: {
    button: 'Scan', title: 'Scan a barcode', addTitle: 'Add by scanning',
    prefillTitle: 'Load data from ISBN',
    manualLabel: 'ISBN or barcode',
    manualHint: 'Type the number and press Enter. A handheld scanner types it for you.',
    useCamera: 'Use the camera', stopCamera: 'Stop the camera',
    aimHint: 'Point the camera at the barcode.',
    cameraDenied: 'No access to the camera. Type the number instead.',
    cameraUnsupported: 'This browser cannot scan. Type the number instead.',
    cameraInsecure: 'The camera needs HTTPS. Type the number instead.',
    lookUp: 'Look up', looking: 'Looking up…',
    invalidCode: 'That is not a valid ISBN.',
    notFound: 'Not found in the public catalogues.',
    lookupOff: 'External lookup is switched off.',
    alreadyOwned: 'You already have this', alreadyOwnedHint: 'This ISBN is already in the library.',
    foundVia: 'source', addToLibrary: 'Add to the library', adding: 'Adding…',
    addedTitle: 'Added to the library', openWork: 'Open the work', openManifestation: 'Open the edition',
    searchInstead: 'Search the library', createItem: 'Put a copy on the shelf',
    createItemHint: 'Clear this to catalogue the edition without owning it.',
    shelf: 'Shelf', scanAgain: 'Scan another',
    prefillApplied: 'Loaded from the ISBN.', prefillNothing: 'Nothing found.',
    treatAsOriginal: 'This is the original edition',
    treatAsOriginalHint: 'Clear this when scanning a translation.',
    originalTitleField: 'Original title',
    translationHint: 'Catalogues describe the edition, not the original.'
  },
  kinds: {
    book: 'book', article: 'article', essay: 'essay', poetry: 'poetry', drama: 'drama',
    treatise: 'treatise', collection: 'collection', reference: 'reference work',
    scripture: 'scripture', document: 'document', other: 'other'
  },
  schemes: {
    Page: 'page', BibleReference: 'biblical verse',
    StructuredWork: 'internal structure', DocumentParagraph: 'paragraph number'
  },
  schemeHints: {
    Page: 'A page number belongs to the edition.',
    BibleReference: 'The translation matters, not the printing.',
    StructuredWork: "Cited by the work's own division.",
    DocumentParagraph: 'The document is cited, not the website.'
  },
  roles: {
    author: 'author', coauthor: 'co-author', editor: 'editor', translator: 'translator',
    illustrator: 'illustrator', foreword: 'foreword', afterword: 'afterword',
    commentary: 'commentary', compiler: 'compiler', other: 'other role'
  },
  formats: { Print: 'print', Web: 'web page', Ebook: 'ebook' },
  statuses: {
    shelf: 'on the shelf', lent: 'lent out', borrowed: 'borrowed', wanted: 'wanted',
    ordered: 'ordered', lost: 'lost', sold: 'sold'
  },
  conditions: { new: 'new', good: 'good', fair: 'fair', worn: 'worn', damaged: 'damaged' },
  readingStatuses: {
    unread: 'unread', reading: 'reading', read: 'read',
    abandoned: 'abandoned', reference: 'reference'
  },
  bindings: {
    hardcover: 'hardcover', paperback: 'paperback', leather: 'leather',
    ebook: 'ebook', audiobook: 'audiobook', other: 'other'
  },
  groupKinds: { series: 'series (ordered)', collection: 'set (adjacent)', free: 'unconstrained' },
  languages: languageNamesEn
};

const de: LibraryCopyStrings = {
  brand: 'Bibliothek',
  tagline: 'Bücher und Zitate',
  nav: {
    dashboard: 'Übersicht', quotes: 'Zitate', works: 'Werke', shelf: 'Regal',
    arrangement: 'Anordnung', people: 'Personen', publishers: 'Verlage', shelves: 'Regale',
    groups: 'Gruppen', tags: 'Schlagwörter', loans: 'Ausleihen', reading: 'Lektüre',
    data: 'Daten', back: 'Zurück'
  },
  common: {
    add: 'Hinzufügen', save: 'Speichern', saving: 'Wird gespeichert…', saved: 'Gespeichert',
    cancel: 'Abbrechen', edit: 'Bearbeiten', delete: 'Löschen', remove: 'Entfernen',
    close: 'Schließen', open: 'Öffnen', search: 'Suchen', clear: 'Zurücksetzen',
    loading: 'Wird geladen…', none: 'keine', all: 'alle', optional: 'optional', of: 'von',
    showing: 'Angezeigt', previous: 'Zurück', next: 'Weiter', total: 'gesamt',
    unknown: 'unbekannt', nothingYet: 'Hier ist noch nichts.', confirmDelete: 'Wirklich löschen?',
    loadFailed: 'Die Daten konnten nicht geladen werden.', saveFailed: 'Speichern fehlgeschlagen.',
    deleteFailed: 'Löschen fehlgeschlagen.', copy: 'Kopieren', copied: 'Kopiert',
    language: 'Sprache', notes: 'Notizen', year: 'Jahr', name: 'Name',
    apply: 'Übernehmen', applied: 'Übernommen'
  },
  dashboard: {
    title: 'Bibliothek', subtitle: 'Werke, Übersetzungen, Ausgaben, Exemplare und Zitate.',
    works: 'Werke', expressions: 'Übersetzungen', manifestations: 'Ausgaben', items: 'Exemplare',
    quotes: 'Zitate', translations: 'Übersetzt', people: 'Personen', publishers: 'Verlage',
    read: 'Gelesen', reading: 'In Lektüre', unread: 'Ungelesen',
    lentOut: 'Verliehen', borrowed: 'Geliehen', overdue: 'Überfällig',
    byLanguage: 'Nach Sprache', byScheme: 'Nach Zitierschema', byKind: 'Nach Art',
    byShelf: 'Nach Regal', topAuthors: 'Häufigste Autoren', topTags: 'Häufigste Schlagwörter',
    recentQuotes: 'Neueste Zitate', recentlyAdded: 'Zuletzt hinzugefügt', unshelved: 'Ohne Regal',
    quickStart: 'Wie anfangen',
    quickStartText:
      'Lege ein Werk mit Originaltitel und Zitierschema an. Hänge dann eine Übersetzung, eine Ausgabe und zuletzt ein Exemplar daran — oder erfasse gleich ein Zitat, auch ohne das Buch zu besitzen.',
    addFirstWork: 'Erstes Werk anlegen'
  },
  works: {
    title: 'Werke', subtitle: 'Die Schöpfungen selbst, unabhängig von jeder Ausgabe.',
    newWork: 'Neues Werk', searchPlaceholder: 'Titel, Ausgabetitel oder ISBN…',
    filterKind: 'Art', filterScheme: 'Zitierschema', filterOriginalLanguage: 'Originalsprache',
    filterExpressionLanguage: 'Sprache der Übersetzung', filterAuthor: 'Person',
    filterTag: 'Schlagwort', filterPublisher: 'Verlag',
    onlyTranslated: 'Nur übersetzte', onlyOwned: 'Nur vorhandene', onlyQuoted: 'Nur zitierte',
    sort: 'Sortierung', sortTitle: 'Titel', sortCreated: 'Zuletzt hinzugefügt',
    sortUpdated: 'Zuletzt geändert', sortYearAsc: 'Jahr aufsteigend', sortYearDesc: 'Jahr absteigend',
    expressionCount: 'Übers.', manifestationCount: 'Ausg.', itemCount: 'Ex.', quoteCount: 'Zit.',
    empty: 'Noch keine Werke. Lege das erste an.',
    emptyFiltered: 'Kein Werk passt zu diesen Filtern.'
  },
  work: {
    newTitle: 'Neues Werk', editTitle: 'Werk',
    originalTitle: 'Originaltitel', originalTitleHint: 'Der Titel in der Verfassersprache.',
    originalSubtitle: 'Originaluntertitel',
    originalLanguage: 'Originalsprache',
    originalLanguageHint: 'Eine Fassung in anderer Sprache gilt als Übersetzung.',
    uniformTitle: 'Einheitstitel', uniformTitleHint: 'Der Titel, unter dem du das Werk führst.',
    kind: 'Art', firstPublishedYear: 'Entstehungsjahr', notes: 'Notizen',
    citationSection: 'Zitierweise',
    citationHint: 'Bestimmt, welche Stellenangaben ein Zitat aus diesem Werk bekommt.',
    scheme: 'Schema', schemeHint: 'Seite, Bibelvers, innere Gliederung oder Randnummer.',
    sigil: 'Sigel', sigilHint: 'Kürzel vor der Stellenangabe, z. B. „STh“ oder „FR“.',
    structureTemplate: 'Innere Gliederung',
    structureTemplateHint: 'Die Ebenen der Gliederung, z. B. Teil → Quaestio → Artikel.',
    structureAdd: 'Ebene hinzufügen', structureKey: 'Schlüssel', structureAbbr: 'Kürzel',
    authorsSection: 'Autoren',
    authorsHint: 'Die Autorschaft gehört zum Werk. Übersetzer gehören zur Übersetzung.',
    tagsSection: 'Schlagwörter',
    expressionsSection: 'Übersetzungen',
    expressionsHint: 'Eine Übersetzung oder ein benannter Originaltext. Nicht jedes Werk braucht eine.',
    addExpression: 'Übersetzung hinzufügen', noExpressions: 'Noch keine Übersetzungen.',
    manifestationsSection: 'Ausgaben',
    manifestationsHint: 'Eine konkrete Publikation: Druck, Webseite oder E-Book.',
    addManifestation: 'Ausgabe hinzufügen', noManifestations: 'Noch keine Ausgaben.',
    originalLabel: 'Original', translationLabel: 'Übersetzung',
    deleteWork: 'Werk löschen',
    deleteWorkConfirm: 'Dieses Werk mit Übersetzungen, Ausgaben und Exemplaren löschen?',
    deleteWorkHasQuotes: 'Dieses Werk hat Zitate. Beim Löschen gehen sie mit verloren. Fortfahren?',
    createFirst: 'Speichere das Werk, um Übersetzungen und Ausgaben anzulegen.',
    quotesSection: 'Zitate', viewQuotes: 'Zitate anzeigen'
  },
  expression: {
    newTitle: 'Neue Übersetzung', editTitle: 'Übersetzung', ofWork: 'Werk',
    language: 'Sprache', languageHint: 'Weicht sie vom Original ab, ist dies eine Übersetzung.',
    name: 'Name', nameHint: 'z. B. „Einheitsübersetzung 2016“, „Marietti-Ausgabe“.',
    notes: 'Notizen',
    translatorsSection: 'Übersetzer', translatorsHint: 'Die Übersetzung gehört hierher, nicht zur Ausgabe.',
    manifestationsSection: 'Ausgaben dieser Fassung', addManifestation: 'Ausgabe hinzufügen',
    deleteExpression: 'Übersetzung löschen',
    deleteConfirm: 'Diese Übersetzung löschen? Zitate und Ausgaben bleiben ohne den Bezug erhalten.',
    originalBadge: 'Original', translationBadge: 'Übersetzung', noneOption: '— keine (Original) —'
  },
  manifestation: {
    newTitle: 'Neue Ausgabe', editTitle: 'Ausgabe', ofWork: 'Werk',
    format: 'Form', formatHint: 'Druck, Webseite oder E-Book.',
    title: 'Titel der Ausgabe', titleHint: 'Der Titel auf dem Titelblatt.',
    subtitle: 'Untertitel',
    expression: 'Übersetzung', expressionHint: 'Übersetzung wählen oder für das Original leer lassen.',
    publisher: 'Verlag', publishedPlace: 'Erscheinungsort', publishedYear: 'Erscheinungsjahr',
    editionStatement: 'Ausgabebezeichnung', editionStatementHint: 'Zum Beispiel „2., überarb. Aufl.“.',
    series: 'Reihe', seriesNumber: 'Nummer in der Reihe', isbn: 'ISBN', issn: 'ISSN',
    pageCount: 'Seiten', volume: 'Band', binding: 'Einband',
    url: 'URL', urlHint: 'Für eine Webquelle erforderlich.',
    originalTextUrl: 'URL des Originaltextes',
    originalTextUrlHint: 'Nur zum Auffinden — steht nie in der Fußnote.',
    coverImageUrl: 'Cover-URL', notes: 'Notizen',
    dimensionsSection: 'Maße',
    dimensionsHint: 'Nötig, damit die Regalanordnung prüfen kann, was passt.',
    heightMm: 'Höhe (mm)', widthMm: 'Breite (mm)', depthMm: 'Tiefe (mm)',
    contributorsSection: 'Mitwirkende der Ausgabe',
    contributorsHint: 'Herausgeber, Illustrator, Verfasser des Vorworts.',
    itemsSection: 'Exemplare', itemsHint: 'Die physischen Bücher dieser Ausgabe.',
    addItem: 'Exemplar hinzufügen', noItems: 'Keine Exemplare.',
    deleteManifestation: 'Ausgabe löschen',
    deleteConfirm: 'Diese Ausgabe mit ihren Exemplaren löschen?',
    scanPrefill: 'Aus ISBN laden'
  },
  item: {
    title: 'Exemplar', shelf: 'Regal', placementGroup: 'Gruppe', positionInShelf: 'Position im Regal',
    seriesPosition: 'Nummer in der Reihe', signature: 'Signatur', signatureHint: 'Deine Kennzeichnung.',
    status: 'Status', condition: 'Zustand', acquiredDate: 'Erworben am', acquiredFrom: 'Erworben von',
    price: 'Preis', currency: 'Währung', barcode: 'Barcode', readingStatus: 'Lektüre',
    rating: 'Bewertung', favourite: 'Favorit', scanImageUrl: 'Cover-Scan',
    scanImageHint: 'Wird genutzt, wenn kein Cover geladen werden konnte.',
    notes: 'Notizen', deleteConfirm: 'Dieses Exemplar löschen?',
    lendOut: 'Verleihen', logReading: 'Lektüre eintragen', onLoanTo: 'Verliehen an:',
    borrowedFrom: 'Geliehen von:', due: 'fällig', markReturned: 'Als zurück markieren'
  },
  quotes: {
    title: 'Zitate', subtitle: 'Stellen samt vollständigem Nachweis.', newQuote: 'Neues Zitat',
    searchPlaceholder: 'Text, Werk, Autor, Schlagwort oder Stelle…',
    searchHint: 'Ein Feld durchsucht Text, Titel, Autor, Schlagwörter und Stellenangabe.',
    filterWork: 'Werk', filterTag: 'Schlagwort', filterAuthor: 'Autor', filterScheme: 'Zitierschema',
    sort: 'Sortierung', sortNewest: 'Neueste', sortOldest: 'Älteste',
    sortUpdated: 'Zuletzt geändert', sortLocator: 'Stellenangabe',
    style: 'Zitierstil', styleHint: 'Ändert die Schreibweise des Nachweises, nicht die Stelle selbst.',
    empty: 'Noch keine Zitate.', emptyFiltered: 'Kein Zitat passt zu diesen Filtern.',
    copyReference: 'Nachweis kopieren', copyQuote: 'Zitat kopieren', copyBoth: 'Mit Nachweis kopieren',
    showBibliography: 'Bibliographische Form zeigen', bibliography: 'Bibliographische Form'
  },
  quote: {
    newTitle: 'Neues Zitat', editTitle: 'Zitat',
    sourceSection: 'Quelle', sourceHint: 'Ein Zitat gehört immer zu einem Werk. Alles andere ist optional.',
    work: 'Werk', workRequired: 'Wähle ein Werk.', pickWork: 'Werke suchen…',
    expression: 'Übersetzung', expressionHint: 'Welche Übersetzung — entscheidend bei der Bibel.',
    expressionNone: '— nicht zutreffend —',
    manifestation: 'Ausgabe', manifestationHint: 'Wo gefunden — entscheidend bei einer Seitenzahl.',
    manifestationNone: '— nicht zutreffend —',
    textSection: 'Text', quoteText: 'Zitat', quoteTextHint: 'Der wörtliche Wortlaut.',
    locatorSection: 'Stellenangabe', locatorHint: 'Die Felder folgen dem Zitierschema des Werkes.',
    locatorPreview: 'Vorschau',
    bookField: 'Buch', chapterField: 'Kapitel', verseField: 'Vers', verseEndField: 'Vers bis',
    pageField: 'Seite', pageEndField: 'Seite bis',
    paragraphField: 'Randnummer', paragraphEndField: 'Randnummer bis',
    structuredHint: 'Die Ebenen stammen aus der am Werk definierten Gliederung.',
    structuredNoTemplate: 'Für dieses Werk ist noch keine Gliederung definiert.',
    interpretationSection: 'Meine Notizen', description: 'Deutung',
    descriptionHint: 'Wie ich diese Stelle verstehe.',
    context: 'Kontext', contextHint: 'Wovon der umgebende Abschnitt handelt.',
    optionalNote: 'Beide Felder sind optional — das Zitat allein genügt.',
    tagsSection: 'Schlagwörter',
    deleteQuote: 'Zitat löschen', deleteConfirm: 'Dieses Zitat löschen?',
    referencePreview: 'Nachweis', schemeMismatch: 'Das gewählte Werk nutzt ein anderes Zitierschema.'
  },
  people: {
    title: 'Personen', subtitle: 'Autoren, Übersetzer, Herausgeber.',
    displayName: 'Anzeigename', displayNameHint: 'Wie auf dem Titelblatt, z. B. „Karl Rahner“.',
    sortName: 'Sortiername',
    sortNameHint: 'Die Ansetzungsform, z. B. „Rahner, Karl“. Zitierstile hängen davon ab.',
    birthYear: 'Geboren', deathYear: 'Gestorben', nationality: 'Nationalität',
    notes: 'Notizen', contributions: 'Zuordnungen', add: 'Person hinzufügen',
    empty: 'Noch keine Personen.',
    deleteConfirm: 'Diese Person löschen? Zuordnungen entfallen, die Werke bleiben.',
    searchPlaceholder: 'Personen suchen…', viewWorks: 'Werke anzeigen'
  },
  publishers: {
    title: 'Verlage', subtitle: 'Die Häuser hinter den Ausgaben.',
    name: 'Name', city: 'Stadt', notes: 'Notizen', manifestations: 'Ausgaben',
    add: 'Verlag hinzufügen', empty: 'Noch keine Verlage.',
    deleteConfirm: 'Diesen Verlag löschen? Ausgaben bleiben.'
  },
  shelves: {
    title: 'Regale', subtitle: 'Physische Orte und ihre Maße.',
    name: 'Name', nameHint: 'Zum Beispiel „Schrank A, Fach 3“.',
    location: 'Ort', locationHint: 'Raum oder Gebäude.',
    description: 'Beschreibung', sortOrder: 'Reihenfolge',
    heightMm: 'Höhe (mm)', depthMm: 'Tiefe (mm)', widthMm: 'Breite (mm)',
    dimensionsHint: 'Ohne Maße kann die Anordnung nicht prüfen, was passt.',
    items: 'Ex.', add: 'Regal hinzufügen', empty: 'Noch keine Regale.',
    deleteConfirm: 'Dieses Regal löschen? Exemplare bleiben ohne Regal.', browse: 'Durchsehen'
  },
  groups: {
    title: 'Aufstellungsgruppen', subtitle: 'Reihen und Sets, die zusammenstehen sollen.',
    name: 'Name', kind: 'Art',
    kindHint: 'Eine Reihe behält ihre Ordnung; ein Set muss nur benachbart stehen.',
    notes: 'Notizen', items: 'Ex.', add: 'Gruppe hinzufügen', empty: 'Noch keine Gruppen.',
    deleteConfirm: 'Diese Gruppe löschen? Exemplare bleiben.'
  },
  tags: {
    title: 'Schlagwörter', subtitle: 'Themen an Werken und Zitaten.',
    name: 'Name', color: 'Farbe', works: 'Werke', quotes: 'Zitate',
    add: 'Schlagwort hinzufügen', empty: 'Noch keine Schlagwörter.',
    deleteConfirm: 'Dieses Schlagwort überall entfernen?',
    duplicate: 'Ein Schlagwort mit diesem Namen existiert bereits.'
  },
  arrangement: {
    title: 'Regalanordnung', subtitle: 'Ein Vorschlag — die Entscheidung bleibt bei dir.',
    propose: 'Anordnung vorschlagen', proposing: 'Wird berechnet…',
    filterShelf: 'Regal', allShelves: 'Alle Regale',
    unplaced: 'Nicht untergebracht', unplacedHint: 'Jeweils mit Begründung.',
    notes: 'Hinweise', neighbours: 'Nachbarn', previous: 'vorher', next: 'danach',
    applyAll: 'Anordnung übernehmen', applyConfirm: 'Diese Aufstellung für alle Einträge speichern?',
    applied: 'Aufstellung gespeichert.',
    alreadyInPlace: 'steht schon so', wouldMove: 'würde umziehen',
    empty: 'Keine Exemplare zum Anordnen.'
  },
  loans: {
    title: 'Ausleihen', subtitle: 'Was ich verliehen und was ich geliehen habe.',
    openOnly: 'Nur offene', direction: 'Richtung',
    counterpartOut: 'Verliehen an', counterpartIn: 'Geliehen von', contact: 'Kontakt',
    lentOn: 'Verliehen am', dueOn: 'Fällig am', returnedOn: 'Zurück am',
    notes: 'Notizen', overdue: 'überfällig', returned: 'zurück', open: 'offen',
    empty: 'Keine Ausleihen erfasst.', deleteConfirm: 'Diesen Eintrag löschen?',
    markReturned: 'Heute zurück'
  },
  reading: {
    title: 'Lektüre', subtitle: 'Das Lesetagebuch.',
    startedOn: 'Begonnen', finishedOn: 'Beendet', rating: 'Bewertung', notes: 'Notizen',
    empty: 'Noch keine Einträge.', deleteConfirm: 'Diesen Eintrag löschen?',
    inProgress: 'laufend', finished: 'beendet'
  },
  data: {
    title: 'Daten', subtitle: 'Zitate aus einer JSON-Datei importieren.',
    quoteImportTitle: 'Zitatimport',
    quoteImportText: 'Liest ein Array von Zitaten. Das Werk kann per „workId“ oder per Titel und Sprache angegeben werden.',
    quoteImportButton: 'Zitate importieren',
    quoteImportWarning: 'Der Import ergänzt vorhandene Einträge. Ein fehlerhafter Datensatz stoppt den Lauf nicht.',
    quoteImportDone: 'Importiert:', quoteImportFailed: 'Die Datei konnte nicht gelesen werden.',
    quoteImportErrors: 'Abgelehnte Datensätze', sampleTitle: 'Beispieldatei',
    sampleText: 'Ein minimales Zitat ist Text plus Werk. Alles andere ist optional.',
    chooseFile: 'Datei wählen'
  },
  scan: {
    button: 'Scannen', title: 'Barcode scannen', addTitle: 'Per Scan hinzufügen',
    prefillTitle: 'Daten aus ISBN laden',
    manualLabel: 'ISBN oder Barcode',
    manualHint: 'Nummer eingeben und Enter drücken. Ein Handscanner tippt sie selbst.',
    useCamera: 'Kamera verwenden', stopCamera: 'Kamera stoppen',
    aimHint: 'Richte die Kamera auf den Barcode.',
    cameraDenied: 'Kein Zugriff auf die Kamera. Bitte eintippen.',
    cameraUnsupported: 'Dieser Browser kann nicht scannen. Bitte eintippen.',
    cameraInsecure: 'Die Kamera braucht HTTPS. Bitte eintippen.',
    lookUp: 'Suchen', looking: 'Wird gesucht…',
    invalidCode: 'Das ist keine gültige ISBN.',
    notFound: 'In den öffentlichen Katalogen nicht gefunden.',
    lookupOff: 'Die externe Suche ist abgeschaltet.',
    alreadyOwned: 'Das hast du bereits', alreadyOwnedHint: 'Diese ISBN steht schon in der Bibliothek.',
    foundVia: 'Quelle', addToLibrary: 'Zur Bibliothek hinzufügen', adding: 'Wird hinzugefügt…',
    addedTitle: 'Hinzugefügt', openWork: 'Werk öffnen', openManifestation: 'Ausgabe öffnen',
    searchInstead: 'Bibliothek durchsuchen', createItem: 'Exemplar ins Regal stellen',
    createItemHint: 'Abwählen, um die Ausgabe ohne Besitz zu katalogisieren.',
    shelf: 'Regal', scanAgain: 'Nächstes scannen',
    prefillApplied: 'Aus der ISBN geladen.', prefillNothing: 'Nichts gefunden.',
    treatAsOriginal: 'Das ist die Originalausgabe',
    treatAsOriginalHint: 'Abwählen, wenn du eine Übersetzung scannst.',
    originalTitleField: 'Originaltitel',
    translationHint: 'Kataloge beschreiben die Ausgabe, nicht das Original.'
  },
  kinds: {
    book: 'Buch', article: 'Aufsatz', essay: 'Essay', poetry: 'Lyrik', drama: 'Drama',
    treatise: 'Traktat', collection: 'Sammlung', reference: 'Nachschlagewerk',
    scripture: 'Heilige Schrift', document: 'Dokument', other: 'sonstiges'
  },
  schemes: {
    Page: 'Seite', BibleReference: 'Bibelvers',
    StructuredWork: 'innere Gliederung', DocumentParagraph: 'Randnummer'
  },
  schemeHints: {
    Page: 'Eine Seitenzahl gehört zur Ausgabe.',
    BibleReference: 'Es zählt die Übersetzung, nicht der Druck.',
    StructuredWork: 'Zitiert nach der eigenen Gliederung des Werkes.',
    DocumentParagraph: 'Zitiert wird das Dokument, nicht die Webseite.'
  },
  roles: {
    author: 'Autor', coauthor: 'Mitautor', editor: 'Herausgeber', translator: 'Übersetzer',
    illustrator: 'Illustrator', foreword: 'Vorwort', afterword: 'Nachwort',
    commentary: 'Kommentar', compiler: 'Bearbeitung', other: 'andere Rolle'
  },
  formats: { Print: 'Druck', Web: 'Webseite', Ebook: 'E-Book' },
  statuses: {
    shelf: 'im Regal', lent: 'verliehen', borrowed: 'geliehen', wanted: 'gesucht',
    ordered: 'bestellt', lost: 'verloren', sold: 'verkauft'
  },
  conditions: { new: 'neu', good: 'gut', fair: 'mäßig', worn: 'abgegriffen', damaged: 'beschädigt' },
  readingStatuses: {
    unread: 'ungelesen', reading: 'in Lektüre', read: 'gelesen',
    abandoned: 'abgebrochen', reference: 'Nachschlagewerk'
  },
  bindings: {
    hardcover: 'gebunden', paperback: 'broschiert', leather: 'Leder',
    ebook: 'E-Book', audiobook: 'Hörbuch', other: 'sonstiger'
  },
  groupKinds: { series: 'Reihe (geordnet)', collection: 'Set (benachbart)', free: 'ohne Vorgabe' },
  languages: languageNamesDe
};

const strings: Record<LibraryLanguage, LibraryCopyStrings> = { pl, en, de };

export function getLibraryCopy(language: string): LibraryCopyStrings {
  if (language === 'en' || language === 'de') return strings[language];
  return strings.pl;
}

/** Falls back to the raw code so hand-typed languages still render. */
export function languageLabel(t: LibraryCopyStrings, code: string | null | undefined): string {
  if (!code) return t.common.unknown;
  return t.languages[code] ?? code;
}
