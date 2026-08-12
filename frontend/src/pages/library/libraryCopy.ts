// Self-contained copy for the library module.
//
// The module keeps its own strings rather than extending the app-wide `Copy`
// type: that type is a single strongly-typed shape mirrored across pl/en/de,
// and a module this size would add several hundred keys to all four files.
// Same three languages, driven by the same `language` prop from App.

export type LibraryLanguage = 'pl' | 'en' | 'de';

export type LibraryCopyStrings = {
  brand: string;
  tagline: string;
  nav: {
    dashboard: string;
    works: string;
    shelf: string;
    people: string;
    publishers: string;
    shelves: string;
    tags: string;
    loans: string;
    reading: string;
    data: string;
    back: string;
  };
  common: {
    add: string;
    save: string;
    saving: string;
    saved: string;
    cancel: string;
    edit: string;
    delete: string;
    remove: string;
    close: string;
    search: string;
    filter: string;
    clear: string;
    loading: string;
    none: string;
    all: string;
    yes: string;
    no: string;
    optional: string;
    required: string;
    of: string;
    more: string;
    open: string;
    name: string;
    notes: string;
    year: string;
    language: string;
    confirmDelete: string;
    loadFailed: string;
    saveFailed: string;
    deleteFailed: string;
    nothingYet: string;
    unknown: string;
    total: string;
    showing: string;
    previous: string;
    next: string;
  };
  dashboard: {
    title: string;
    subtitle: string;
    works: string;
    editions: string;
    copies: string;
    translations: string;
    people: string;
    publishers: string;
    shelves: string;
    tags: string;
    reading: string;
    read: string;
    unread: string;
    lentOut: string;
    borrowed: string;
    overdue: string;
    byLanguage: string;
    byOriginalLanguage: string;
    byKind: string;
    byShelf: string;
    topAuthors: string;
    recentlyAdded: string;
    unshelved: string;
    quickStart: string;
    quickStartText: string;
    addFirstWork: string;
  };
  works: {
    title: string;
    subtitle: string;
    newWork: string;
    searchPlaceholder: string;
    filterKind: string;
    filterOriginalLanguage: string;
    filterEditionLanguage: string;
    filterAuthor: string;
    filterTag: string;
    filterPublisher: string;
    onlyTranslated: string;
    onlyOwned: string;
    sort: string;
    sortTitle: string;
    sortCreated: string;
    sortUpdated: string;
    sortYearAsc: string;
    sortYearDesc: string;
    editionCount: string;
    copyCount: string;
    empty: string;
    emptyFiltered: string;
  };
  work: {
    newTitle: string;
    editTitle: string;
    originalTitle: string;
    originalTitleHint: string;
    originalSubtitle: string;
    originalLanguage: string;
    originalLanguageHint: string;
    uniformTitle: string;
    uniformTitleHint: string;
    kind: string;
    firstPublishedYear: string;
    notes: string;
    authorsSection: string;
    authorsHint: string;
    tagsSection: string;
    editionsSection: string;
    editionsHint: string;
    addEdition: string;
    noEditions: string;
    originalEdition: string;
    translation: string;
    deleteWork: string;
    deleteWorkConfirm: string;
    createFirst: string;
  };
  edition: {
    newTitle: string;
    editTitle: string;
    ofWork: string;
    title: string;
    titleHint: string;
    subtitle: string;
    language: string;
    languageHint: string;
    translationBadge: string;
    originalBadge: string;
    publisher: string;
    publishedPlace: string;
    publishedYear: string;
    editionStatement: string;
    editionStatementHint: string;
    series: string;
    seriesNumber: string;
    isbn: string;
    issn: string;
    pageCount: string;
    volume: string;
    binding: string;
    coverUrl: string;
    notes: string;
    contributorsSection: string;
    contributorsHint: string;
    copiesSection: string;
    copiesHint: string;
    addCopy: string;
    noCopies: string;
    deleteEdition: string;
    deleteEditionConfirm: string;
  };
  copy: {
    title: string;
    shelf: string;
    signature: string;
    signatureHint: string;
    status: string;
    condition: string;
    acquiredDate: string;
    acquiredFrom: string;
    price: string;
    currency: string;
    barcode: string;
    readingStatus: string;
    rating: string;
    favourite: string;
    notes: string;
    deleteConfirm: string;
    lendOut: string;
    logReading: string;
    onLoanTo: string;
    borrowedFrom: string;
    due: string;
    markReturned: string;
  };
  shelfView: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    filterShelf: string;
    filterStatus: string;
    filterReading: string;
    filterLanguage: string;
    onlyFavourites: string;
    minRating: string;
    sort: string;
    sortAdded: string;
    sortRating: string;
    sortAcquired: string;
    sortSignature: string;
    empty: string;
    unshelved: string;
  };
  people: {
    title: string;
    subtitle: string;
    displayName: string;
    displayNameHint: string;
    sortName: string;
    sortNameHint: string;
    birthYear: string;
    deathYear: string;
    nationality: string;
    notes: string;
    worksCount: string;
    editionsCount: string;
    add: string;
    empty: string;
    deleteConfirm: string;
    searchPlaceholder: string;
    viewWorks: string;
  };
  publishers: {
    title: string;
    subtitle: string;
    name: string;
    city: string;
    notes: string;
    editionsCount: string;
    add: string;
    empty: string;
    deleteConfirm: string;
  };
  shelves: {
    title: string;
    subtitle: string;
    name: string;
    nameHint: string;
    location: string;
    locationHint: string;
    description: string;
    sortOrder: string;
    copiesCount: string;
    add: string;
    empty: string;
    deleteConfirm: string;
    browse: string;
  };
  tags: {
    title: string;
    subtitle: string;
    name: string;
    color: string;
    worksCount: string;
    add: string;
    empty: string;
    deleteConfirm: string;
    duplicate: string;
  };
  loans: {
    title: string;
    subtitle: string;
    openOnly: string;
    direction: string;
    counterpart: string;
    counterpartOut: string;
    counterpartIn: string;
    contact: string;
    lentOn: string;
    dueOn: string;
    returnedOn: string;
    notes: string;
    overdue: string;
    returned: string;
    open: string;
    empty: string;
    deleteConfirm: string;
    markReturned: string;
  };
  reading: {
    title: string;
    subtitle: string;
    startedOn: string;
    finishedOn: string;
    rating: string;
    notes: string;
    empty: string;
    deleteConfirm: string;
    inProgress: string;
    finished: string;
  };
  data: {
    title: string;
    subtitle: string;
    exportTitle: string;
    exportText: string;
    exportButton: string;
    exportDone: string;
    importTitle: string;
    importText: string;
    importButton: string;
    importWarning: string;
    importDone: string;
    importFailed: string;
    chooseFile: string;
  };
  kinds: Record<string, string>;
  roles: Record<string, string>;
  statuses: Record<string, string>;
  conditions: Record<string, string>;
  readingStatuses: Record<string, string>;
  bindings: Record<string, string>;
  languages: Record<string, string>;
};

const languageNamesPl: Record<string, string> = {
  pl: 'polski', en: 'angielski', de: 'niemiecki', fr: 'francuski', it: 'włoski',
  es: 'hiszpański', pt: 'portugalski', nl: 'niderlandzki', la: 'łacina', grc: 'greka klasyczna',
  he: 'hebrajski', ru: 'rosyjski', uk: 'ukraiński', cs: 'czeski', sk: 'słowacki',
  hu: 'węgierski', lt: 'litewski', sv: 'szwedzki', no: 'norweski', da: 'duński',
  fi: 'fiński', ro: 'rumuński', el: 'nowogrecki', tr: 'turecki', ar: 'arabski',
  zh: 'chiński', ja: 'japoński'
};

const languageNamesEn: Record<string, string> = {
  pl: 'Polish', en: 'English', de: 'German', fr: 'French', it: 'Italian',
  es: 'Spanish', pt: 'Portuguese', nl: 'Dutch', la: 'Latin', grc: 'Ancient Greek',
  he: 'Hebrew', ru: 'Russian', uk: 'Ukrainian', cs: 'Czech', sk: 'Slovak',
  hu: 'Hungarian', lt: 'Lithuanian', sv: 'Swedish', no: 'Norwegian', da: 'Danish',
  fi: 'Finnish', ro: 'Romanian', el: 'Modern Greek', tr: 'Turkish', ar: 'Arabic',
  zh: 'Chinese', ja: 'Japanese'
};

const languageNamesDe: Record<string, string> = {
  pl: 'Polnisch', en: 'Englisch', de: 'Deutsch', fr: 'Französisch', it: 'Italienisch',
  es: 'Spanisch', pt: 'Portugiesisch', nl: 'Niederländisch', la: 'Latein', grc: 'Altgriechisch',
  he: 'Hebräisch', ru: 'Russisch', uk: 'Ukrainisch', cs: 'Tschechisch', sk: 'Slowakisch',
  hu: 'Ungarisch', lt: 'Litauisch', sv: 'Schwedisch', no: 'Norwegisch', da: 'Dänisch',
  fi: 'Finnisch', ro: 'Rumänisch', el: 'Neugriechisch', tr: 'Türkisch', ar: 'Arabisch',
  zh: 'Chinesisch', ja: 'Japanisch'
};

const pl: LibraryCopyStrings = {
  brand: 'Biblioteka',
  tagline: 'Mój prywatny księgozbiór',
  nav: {
    dashboard: 'Przegląd',
    works: 'Dzieła',
    shelf: 'Półka',
    people: 'Osoby',
    publishers: 'Wydawnictwa',
    shelves: 'Regały',
    tags: 'Etykiety',
    loans: 'Wypożyczenia',
    reading: 'Lektury',
    data: 'Dane',
    back: 'Powrót'
  },
  common: {
    add: 'Dodaj',
    save: 'Zapisz',
    saving: 'Zapisywanie…',
    saved: 'Zapisano',
    cancel: 'Anuluj',
    edit: 'Edytuj',
    delete: 'Usuń',
    remove: 'Usuń',
    close: 'Zamknij',
    search: 'Szukaj',
    filter: 'Filtry',
    clear: 'Wyczyść',
    loading: 'Wczytywanie…',
    none: 'brak',
    all: 'wszystkie',
    yes: 'tak',
    no: 'nie',
    optional: 'opcjonalne',
    required: 'wymagane',
    of: 'z',
    more: 'więcej',
    open: 'Otwórz',
    name: 'Nazwa',
    notes: 'Notatki',
    year: 'Rok',
    language: 'Język',
    confirmDelete: 'Czy na pewno usunąć?',
    loadFailed: 'Nie udało się wczytać danych.',
    saveFailed: 'Nie udało się zapisać.',
    deleteFailed: 'Nie udało się usunąć.',
    nothingYet: 'Nic tu jeszcze nie ma.',
    unknown: 'nieznane',
    total: 'łącznie',
    showing: 'Pokazano',
    previous: 'Poprzednia',
    next: 'Następna'
  },
  dashboard: {
    title: 'Biblioteka',
    subtitle: 'Dzieła, wydania i egzemplarze na moich półkach.',
    works: 'Dzieła',
    editions: 'Wydania',
    copies: 'Egzemplarze',
    translations: 'Przekłady',
    people: 'Osoby',
    publishers: 'Wydawnictwa',
    shelves: 'Regały',
    tags: 'Etykiety',
    reading: 'W trakcie',
    read: 'Przeczytane',
    unread: 'Nieprzeczytane',
    lentOut: 'Wypożyczone innym',
    borrowed: 'Pożyczone od innych',
    overdue: 'Po terminie',
    byLanguage: 'Wg języka wydania',
    byOriginalLanguage: 'Wg języka oryginału',
    byKind: 'Wg rodzaju',
    byShelf: 'Wg regału',
    topAuthors: 'Najczęstsi autorzy',
    recentlyAdded: 'Ostatnio dodane',
    unshelved: 'Bez regału',
    quickStart: 'Od czego zacząć',
    quickStartText:
      'Dodaj dzieło z tytułem oryginalnym i językiem oryginału, potem dopisz do niego wydania — także przekłady — a na końcu egzemplarze, które masz na półce.',
    addFirstWork: 'Dodaj pierwsze dzieło'
  },
  works: {
    title: 'Dzieła',
    subtitle: 'Utwory niezależnie od wydania — tytuł oryginalny i język oryginału.',
    newWork: 'Nowe dzieło',
    searchPlaceholder: 'Tytuł oryginalny lub tytuł wydania…',
    filterKind: 'Rodzaj',
    filterOriginalLanguage: 'Język oryginału',
    filterEditionLanguage: 'Język wydania',
    filterAuthor: 'Osoba',
    filterTag: 'Etykieta',
    filterPublisher: 'Wydawnictwo',
    onlyTranslated: 'Tylko z przekładem',
    onlyOwned: 'Tylko posiadane',
    sort: 'Sortowanie',
    sortTitle: 'Tytuł',
    sortCreated: 'Ostatnio dodane',
    sortUpdated: 'Ostatnio zmienione',
    sortYearAsc: 'Rok rosnąco',
    sortYearDesc: 'Rok malejąco',
    editionCount: 'wyd.',
    copyCount: 'egz.',
    empty: 'Brak dzieł. Dodaj pierwsze, aby zacząć.',
    emptyFiltered: 'Żadne dzieło nie pasuje do filtrów.'
  },
  work: {
    newTitle: 'Nowe dzieło',
    editTitle: 'Dzieło',
    originalTitle: 'Tytuł oryginalny',
    originalTitleHint: 'Tytuł w języku, w którym dzieło powstało.',
    originalSubtitle: 'Podtytuł oryginalny',
    originalLanguage: 'Język oryginału',
    originalLanguageHint: 'Wydanie w innym języku zostanie rozpoznane jako przekład.',
    uniformTitle: 'Tytuł ujednolicony',
    uniformTitleHint: 'Tytuł, pod którym trzymasz to dzieło, jeśli inny niż oryginalny.',
    kind: 'Rodzaj',
    firstPublishedYear: 'Rok pierwszego wydania',
    notes: 'Notatki',
    authorsSection: 'Autorzy',
    authorsHint: 'Autorstwo należy do dzieła. Tłumaczy dopisz przy wydaniu.',
    tagsSection: 'Etykiety',
    editionsSection: 'Wydania',
    editionsHint: 'Każde wydanie to osobna publikacja — oryginał albo przekład.',
    addEdition: 'Dodaj wydanie',
    noEditions: 'Brak wydań. Dodaj pierwsze, aby móc dopisać egzemplarze.',
    originalEdition: 'oryginał',
    translation: 'przekład',
    deleteWork: 'Usuń dzieło',
    deleteWorkConfirm:
      'Usunąć to dzieło wraz ze wszystkimi wydaniami, egzemplarzami, wypożyczeniami i lekturami? Tego nie można cofnąć.',
    createFirst: 'Zapisz dzieło, aby dodać wydania i egzemplarze.'
  },
  edition: {
    newTitle: 'Nowe wydanie',
    editTitle: 'Wydanie',
    ofWork: 'Dzieło',
    title: 'Tytuł wydania',
    titleHint: 'Tytuł z karty tytułowej — przy przekładzie tytuł przetłumaczony.',
    subtitle: 'Podtytuł',
    language: 'Język wydania',
    languageHint: 'Inny niż język oryginału oznacza przekład.',
    translationBadge: 'przekład',
    originalBadge: 'oryginał',
    publisher: 'Wydawnictwo',
    publishedPlace: 'Miejsce wydania',
    publishedYear: 'Rok wydania',
    editionStatement: 'Oznaczenie wydania',
    editionStatementHint: 'Np. „wyd. 2 popr.”.',
    series: 'Seria',
    seriesNumber: 'Numer w serii',
    isbn: 'ISBN',
    issn: 'ISSN',
    pageCount: 'Liczba stron',
    volume: 'Tom',
    binding: 'Oprawa',
    coverUrl: 'Adres okładki',
    notes: 'Notatki',
    contributorsSection: 'Współtwórcy wydania',
    contributorsHint: 'Tłumacz, redaktor, ilustrator, autor wstępu.',
    copiesSection: 'Egzemplarze',
    copiesHint: 'Fizyczne książki, które masz z tego wydania.',
    addCopy: 'Dodaj egzemplarz',
    noCopies: 'Brak egzemplarzy tego wydania.',
    deleteEdition: 'Usuń wydanie',
    deleteEditionConfirm:
      'Usunąć to wydanie wraz z egzemplarzami, wypożyczeniami i lekturami? Tego nie można cofnąć.'
  },
  copy: {
    title: 'Egzemplarz',
    shelf: 'Regał',
    signature: 'Sygnatura',
    signatureHint: 'Twoje własne oznaczenie na półce.',
    status: 'Status',
    condition: 'Stan',
    acquiredDate: 'Data nabycia',
    acquiredFrom: 'Skąd',
    price: 'Cena',
    currency: 'Waluta',
    barcode: 'Kod kreskowy',
    readingStatus: 'Lektura',
    rating: 'Ocena',
    favourite: 'Ulubione',
    notes: 'Notatki',
    deleteConfirm: 'Usunąć ten egzemplarz wraz z jego wypożyczeniami i lekturami?',
    lendOut: 'Wypożycz',
    logReading: 'Zapisz lekturę',
    onLoanTo: 'Wypożyczone:',
    borrowedFrom: 'Pożyczone od:',
    due: 'termin',
    markReturned: 'Oznacz jako zwrócone'
  },
  shelfView: {
    title: 'Półka',
    subtitle: 'Egzemplarze, które fizycznie posiadam.',
    searchPlaceholder: 'Tytuł, sygnatura lub kod kreskowy…',
    filterShelf: 'Regał',
    filterStatus: 'Status',
    filterReading: 'Lektura',
    filterLanguage: 'Język',
    onlyFavourites: 'Tylko ulubione',
    minRating: 'Ocena min.',
    sort: 'Sortowanie',
    sortAdded: 'Ostatnio dodane',
    sortRating: 'Ocena',
    sortAcquired: 'Data nabycia',
    sortSignature: 'Sygnatura',
    empty: 'Brak egzemplarzy pasujących do filtrów.',
    unshelved: 'bez regału'
  },
  people: {
    title: 'Osoby',
    subtitle: 'Autorzy, tłumacze, redaktorzy i ilustratorzy.',
    displayName: 'Nazwa wyświetlana',
    displayNameHint: 'Tak jak na karcie tytułowej, np. „Franz Kafka”.',
    sortName: 'Nazwa do sortowania',
    sortNameHint: 'Forma katalogowa, np. „Kafka, Franz”.',
    birthYear: 'Rok urodzenia',
    deathYear: 'Rok śmierci',
    nationality: 'Narodowość',
    notes: 'Notatki',
    worksCount: 'dzieł',
    editionsCount: 'wydań',
    add: 'Dodaj osobę',
    empty: 'Brak osób. Dodaj autora, aby móc go przypisać do dzieła.',
    deleteConfirm: 'Usunąć tę osobę? Jej przypisania znikną, ale dzieła pozostaną.',
    searchPlaceholder: 'Szukaj osoby…',
    viewWorks: 'Pokaż dzieła'
  },
  publishers: {
    title: 'Wydawnictwa',
    subtitle: 'Oficyny, których wydania masz w zbiorach.',
    name: 'Nazwa',
    city: 'Miasto',
    notes: 'Notatki',
    editionsCount: 'wydań',
    add: 'Dodaj wydawnictwo',
    empty: 'Brak wydawnictw.',
    deleteConfirm: 'Usunąć to wydawnictwo? Wydania pozostaną, stracą tylko odniesienie.'
  },
  shelves: {
    title: 'Regały',
    subtitle: 'Fizyczne miejsca, w których stoją książki.',
    name: 'Nazwa',
    nameHint: 'Np. „Regał A, półka 3”.',
    location: 'Lokalizacja',
    locationHint: 'Pokój lub budynek.',
    description: 'Opis',
    sortOrder: 'Kolejność',
    copiesCount: 'egz.',
    add: 'Dodaj regał',
    empty: 'Brak regałów.',
    deleteConfirm: 'Usunąć ten regał? Egzemplarze pozostaną, ale stracą przypisanie.',
    browse: 'Przeglądaj'
  },
  tags: {
    title: 'Etykiety',
    subtitle: 'Tematy przypisane do dzieł.',
    name: 'Nazwa',
    color: 'Kolor',
    worksCount: 'dzieł',
    add: 'Dodaj etykietę',
    empty: 'Brak etykiet.',
    deleteConfirm: 'Usunąć tę etykietę ze wszystkich dzieł?',
    duplicate: 'Etykieta o tej nazwie już istnieje.'
  },
  loans: {
    title: 'Wypożyczenia',
    subtitle: 'Co pożyczyłem innym i co pożyczyłem od innych.',
    openOnly: 'Tylko otwarte',
    direction: 'Kierunek',
    counterpart: 'Osoba',
    counterpartOut: 'Komu',
    counterpartIn: 'Od kogo',
    contact: 'Kontakt',
    lentOn: 'Data wypożyczenia',
    dueOn: 'Termin zwrotu',
    returnedOn: 'Data zwrotu',
    notes: 'Notatki',
    overdue: 'po terminie',
    returned: 'zwrócone',
    open: 'otwarte',
    empty: 'Brak wypożyczeń.',
    deleteConfirm: 'Usunąć ten wpis wypożyczenia?',
    markReturned: 'Zwrócone dziś'
  },
  reading: {
    title: 'Lektury',
    subtitle: 'Dziennik czytania — kiedy i z jaką oceną.',
    startedOn: 'Rozpoczęto',
    finishedOn: 'Ukończono',
    rating: 'Ocena',
    notes: 'Notatki',
    empty: 'Brak wpisów lektury.',
    deleteConfirm: 'Usunąć ten wpis lektury?',
    inProgress: 'w trakcie',
    finished: 'ukończone'
  },
  data: {
    title: 'Dane',
    subtitle: 'Kopia zapasowa i przeniesienie księgozbioru.',
    exportTitle: 'Eksport',
    exportText: 'Pobiera całą bibliotekę jako jeden plik JSON — dzieła, wydania, egzemplarze, wypożyczenia i lektury.',
    exportButton: 'Pobierz plik JSON',
    exportDone: 'Plik został pobrany.',
    importTitle: 'Import',
    importText: 'Wczytuje plik JSON wyeksportowany z tej biblioteki.',
    importButton: 'Importuj',
    importWarning: 'Import dodaje wpisy obok istniejących — nie zastępuje ich.',
    importDone: 'Zaimportowano:',
    importFailed: 'Nie udało się zaimportować pliku.',
    chooseFile: 'Wybierz plik'
  },
  kinds: {
    book: 'książka', article: 'artykuł', essay: 'esej', poetry: 'poezja', drama: 'dramat',
    treatise: 'traktat', collection: 'zbiór', reference: 'wydawnictwo źródłowe', other: 'inne'
  },
  roles: {
    author: 'autor', coauthor: 'współautor', editor: 'redaktor', translator: 'tłumacz',
    illustrator: 'ilustrator', foreword: 'autor wstępu', afterword: 'autor posłowia',
    commentary: 'autor komentarza', compiler: 'opracowanie', other: 'inna rola'
  },
  statuses: {
    shelf: 'na półce', lent: 'wypożyczone', borrowed: 'pożyczone', wanted: 'poszukiwane',
    ordered: 'zamówione', lost: 'zagubione', sold: 'sprzedane'
  },
  conditions: {
    new: 'nowy', good: 'dobry', fair: 'przeciętny', worn: 'zaczytany', damaged: 'uszkodzony'
  },
  readingStatuses: {
    unread: 'nieprzeczytane', reading: 'w trakcie', read: 'przeczytane',
    abandoned: 'porzucone', reference: 'podręczne'
  },
  bindings: {
    hardcover: 'twarda', paperback: 'miękka', leather: 'skórzana',
    ebook: 'e-book', audiobook: 'audiobook', other: 'inna'
  },
  languages: languageNamesPl
};

const en: LibraryCopyStrings = {
  brand: 'Library',
  tagline: 'My private book collection',
  nav: {
    dashboard: 'Overview',
    works: 'Works',
    shelf: 'Shelf',
    people: 'People',
    publishers: 'Publishers',
    shelves: 'Shelves',
    tags: 'Tags',
    loans: 'Loans',
    reading: 'Reading',
    data: 'Data',
    back: 'Back'
  },
  common: {
    add: 'Add',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    remove: 'Remove',
    close: 'Close',
    search: 'Search',
    filter: 'Filters',
    clear: 'Clear',
    loading: 'Loading…',
    none: 'none',
    all: 'all',
    yes: 'yes',
    no: 'no',
    optional: 'optional',
    required: 'required',
    of: 'of',
    more: 'more',
    open: 'Open',
    name: 'Name',
    notes: 'Notes',
    year: 'Year',
    language: 'Language',
    confirmDelete: 'Delete this?',
    loadFailed: 'Could not load the data.',
    saveFailed: 'Could not save.',
    deleteFailed: 'Could not delete.',
    nothingYet: 'Nothing here yet.',
    unknown: 'unknown',
    total: 'total',
    showing: 'Showing',
    previous: 'Previous',
    next: 'Next'
  },
  dashboard: {
    title: 'Library',
    subtitle: 'Works, editions and the copies on my shelves.',
    works: 'Works',
    editions: 'Editions',
    copies: 'Copies',
    translations: 'Translations',
    people: 'People',
    publishers: 'Publishers',
    shelves: 'Shelves',
    tags: 'Tags',
    reading: 'Reading',
    read: 'Read',
    unread: 'Unread',
    lentOut: 'Lent out',
    borrowed: 'Borrowed',
    overdue: 'Overdue',
    byLanguage: 'By edition language',
    byOriginalLanguage: 'By original language',
    byKind: 'By kind',
    byShelf: 'By shelf',
    topAuthors: 'Most frequent authors',
    recentlyAdded: 'Recently added',
    unshelved: 'Unshelved',
    quickStart: 'Where to start',
    quickStartText:
      'Add a work with its original title and language, then attach editions to it — translations included — and finally the copies you actually own.',
    addFirstWork: 'Add the first work'
  },
  works: {
    title: 'Works',
    subtitle: 'The creations themselves — original title and original language.',
    newWork: 'New work',
    searchPlaceholder: 'Original title or edition title…',
    filterKind: 'Kind',
    filterOriginalLanguage: 'Original language',
    filterEditionLanguage: 'Edition language',
    filterAuthor: 'Person',
    filterTag: 'Tag',
    filterPublisher: 'Publisher',
    onlyTranslated: 'Only translated',
    onlyOwned: 'Only owned',
    sort: 'Sort',
    sortTitle: 'Title',
    sortCreated: 'Recently added',
    sortUpdated: 'Recently changed',
    sortYearAsc: 'Year ascending',
    sortYearDesc: 'Year descending',
    editionCount: 'ed.',
    copyCount: 'cop.',
    empty: 'No works yet. Add the first one to begin.',
    emptyFiltered: 'No work matches these filters.'
  },
  work: {
    newTitle: 'New work',
    editTitle: 'Work',
    originalTitle: 'Original title',
    originalTitleHint: 'The title in the language the work was written in.',
    originalSubtitle: 'Original subtitle',
    originalLanguage: 'Original language',
    originalLanguageHint: 'An edition in another language is recognised as a translation.',
    uniformTitle: 'Uniform title',
    uniformTitleHint: 'The title you file this work under, when it differs from the original.',
    kind: 'Kind',
    firstPublishedYear: 'First published',
    notes: 'Notes',
    authorsSection: 'Authors',
    authorsHint: 'Authorship belongs to the work. Add translators on the edition.',
    tagsSection: 'Tags',
    editionsSection: 'Editions',
    editionsHint: 'Each edition is a separate publication — the original or a translation.',
    addEdition: 'Add edition',
    noEditions: 'No editions yet. Add one before recording copies.',
    originalEdition: 'original',
    translation: 'translation',
    deleteWork: 'Delete work',
    deleteWorkConfirm:
      'Delete this work with all its editions, copies, loans and readings? This cannot be undone.',
    createFirst: 'Save the work to add editions and copies.'
  },
  edition: {
    newTitle: 'New edition',
    editTitle: 'Edition',
    ofWork: 'Work',
    title: 'Edition title',
    titleHint: 'The title on the title page — the translated title when translated.',
    subtitle: 'Subtitle',
    language: 'Edition language',
    languageHint: 'Different from the original language means this is a translation.',
    translationBadge: 'translation',
    originalBadge: 'original',
    publisher: 'Publisher',
    publishedPlace: 'Place of publication',
    publishedYear: 'Year of publication',
    editionStatement: 'Edition statement',
    editionStatementHint: 'For example "2nd revised edition".',
    series: 'Series',
    seriesNumber: 'Number in series',
    isbn: 'ISBN',
    issn: 'ISSN',
    pageCount: 'Pages',
    volume: 'Volume',
    binding: 'Binding',
    coverUrl: 'Cover image URL',
    notes: 'Notes',
    contributorsSection: 'Edition contributors',
    contributorsHint: 'Translator, editor, illustrator, author of the foreword.',
    copiesSection: 'Copies',
    copiesHint: 'The physical books you hold of this edition.',
    addCopy: 'Add copy',
    noCopies: 'No copies of this edition.',
    deleteEdition: 'Delete edition',
    deleteEditionConfirm:
      'Delete this edition with its copies, loans and readings? This cannot be undone.'
  },
  copy: {
    title: 'Copy',
    shelf: 'Shelf',
    signature: 'Signature',
    signatureHint: 'Your own call number on the shelf.',
    status: 'Status',
    condition: 'Condition',
    acquiredDate: 'Acquired on',
    acquiredFrom: 'Acquired from',
    price: 'Price',
    currency: 'Currency',
    barcode: 'Barcode',
    readingStatus: 'Reading',
    rating: 'Rating',
    favourite: 'Favourite',
    notes: 'Notes',
    deleteConfirm: 'Delete this copy along with its loans and readings?',
    lendOut: 'Lend out',
    logReading: 'Log reading',
    onLoanTo: 'Lent to:',
    borrowedFrom: 'Borrowed from:',
    due: 'due',
    markReturned: 'Mark returned'
  },
  shelfView: {
    title: 'Shelf',
    subtitle: 'The copies I physically own.',
    searchPlaceholder: 'Title, signature or barcode…',
    filterShelf: 'Shelf',
    filterStatus: 'Status',
    filterReading: 'Reading',
    filterLanguage: 'Language',
    onlyFavourites: 'Only favourites',
    minRating: 'Min. rating',
    sort: 'Sort',
    sortAdded: 'Recently added',
    sortRating: 'Rating',
    sortAcquired: 'Acquisition date',
    sortSignature: 'Signature',
    empty: 'No copies match these filters.',
    unshelved: 'unshelved'
  },
  people: {
    title: 'People',
    subtitle: 'Authors, translators, editors and illustrators.',
    displayName: 'Display name',
    displayNameHint: 'As printed on the title page, e.g. "Franz Kafka".',
    sortName: 'Sort name',
    sortNameHint: 'The filing form, e.g. "Kafka, Franz".',
    birthYear: 'Born',
    deathYear: 'Died',
    nationality: 'Nationality',
    notes: 'Notes',
    worksCount: 'works',
    editionsCount: 'editions',
    add: 'Add person',
    empty: 'No people yet. Add an author to attribute a work.',
    deleteConfirm: 'Delete this person? Their attributions go, the works stay.',
    searchPlaceholder: 'Search people…',
    viewWorks: 'Show works'
  },
  publishers: {
    title: 'Publishers',
    subtitle: 'The houses whose editions are in the collection.',
    name: 'Name',
    city: 'City',
    notes: 'Notes',
    editionsCount: 'editions',
    add: 'Add publisher',
    empty: 'No publishers yet.',
    deleteConfirm: 'Delete this publisher? Editions stay, they just lose the reference.'
  },
  shelves: {
    title: 'Shelves',
    subtitle: 'The physical places the books stand in.',
    name: 'Name',
    nameHint: 'For example "Bookcase A, shelf 3".',
    location: 'Location',
    locationHint: 'Room or building.',
    description: 'Description',
    sortOrder: 'Order',
    copiesCount: 'copies',
    add: 'Add shelf',
    empty: 'No shelves yet.',
    deleteConfirm: 'Delete this shelf? Copies stay but become unshelved.',
    browse: 'Browse'
  },
  tags: {
    title: 'Tags',
    subtitle: 'Subjects attached to works.',
    name: 'Name',
    color: 'Colour',
    worksCount: 'works',
    add: 'Add tag',
    empty: 'No tags yet.',
    deleteConfirm: 'Remove this tag from every work?',
    duplicate: 'A tag with this name already exists.'
  },
  loans: {
    title: 'Loans',
    subtitle: 'What I lent out and what I borrowed.',
    openOnly: 'Open only',
    direction: 'Direction',
    counterpart: 'Person',
    counterpartOut: 'Lent to',
    counterpartIn: 'Borrowed from',
    contact: 'Contact',
    lentOn: 'Lent on',
    dueOn: 'Due on',
    returnedOn: 'Returned on',
    notes: 'Notes',
    overdue: 'overdue',
    returned: 'returned',
    open: 'open',
    empty: 'No loans recorded.',
    deleteConfirm: 'Delete this loan record?',
    markReturned: 'Returned today'
  },
  reading: {
    title: 'Reading',
    subtitle: 'The reading log — when, and what I thought.',
    startedOn: 'Started',
    finishedOn: 'Finished',
    rating: 'Rating',
    notes: 'Notes',
    empty: 'No reading entries yet.',
    deleteConfirm: 'Delete this reading entry?',
    inProgress: 'in progress',
    finished: 'finished'
  },
  data: {
    title: 'Data',
    subtitle: 'Backup and transfer of the collection.',
    exportTitle: 'Export',
    exportText: 'Downloads the whole library as one JSON file — works, editions, copies, loans and readings.',
    exportButton: 'Download JSON file',
    exportDone: 'The file has been downloaded.',
    importTitle: 'Import',
    importText: 'Reads a JSON file exported from this library.',
    importButton: 'Import',
    importWarning: 'Import adds entries alongside existing ones — it does not replace them.',
    importDone: 'Imported:',
    importFailed: 'Could not import the file.',
    chooseFile: 'Choose file'
  },
  kinds: {
    book: 'book', article: 'article', essay: 'essay', poetry: 'poetry', drama: 'drama',
    treatise: 'treatise', collection: 'collection', reference: 'reference work', other: 'other'
  },
  roles: {
    author: 'author', coauthor: 'co-author', editor: 'editor', translator: 'translator',
    illustrator: 'illustrator', foreword: 'foreword', afterword: 'afterword',
    commentary: 'commentary', compiler: 'compiler', other: 'other role'
  },
  statuses: {
    shelf: 'on the shelf', lent: 'lent out', borrowed: 'borrowed', wanted: 'wanted',
    ordered: 'ordered', lost: 'lost', sold: 'sold'
  },
  conditions: {
    new: 'new', good: 'good', fair: 'fair', worn: 'worn', damaged: 'damaged'
  },
  readingStatuses: {
    unread: 'unread', reading: 'reading', read: 'read',
    abandoned: 'abandoned', reference: 'reference'
  },
  bindings: {
    hardcover: 'hardcover', paperback: 'paperback', leather: 'leather',
    ebook: 'e-book', audiobook: 'audiobook', other: 'other'
  },
  languages: languageNamesEn
};

const de: LibraryCopyStrings = {
  brand: 'Bibliothek',
  tagline: 'Meine private Büchersammlung',
  nav: {
    dashboard: 'Übersicht',
    works: 'Werke',
    shelf: 'Regal',
    people: 'Personen',
    publishers: 'Verlage',
    shelves: 'Regale',
    tags: 'Schlagwörter',
    loans: 'Ausleihen',
    reading: 'Lektüre',
    data: 'Daten',
    back: 'Zurück'
  },
  common: {
    add: 'Hinzufügen',
    save: 'Speichern',
    saving: 'Wird gespeichert…',
    saved: 'Gespeichert',
    cancel: 'Abbrechen',
    edit: 'Bearbeiten',
    delete: 'Löschen',
    remove: 'Entfernen',
    close: 'Schließen',
    search: 'Suchen',
    filter: 'Filter',
    clear: 'Zurücksetzen',
    loading: 'Wird geladen…',
    none: 'keine',
    all: 'alle',
    yes: 'ja',
    no: 'nein',
    optional: 'optional',
    required: 'erforderlich',
    of: 'von',
    more: 'mehr',
    open: 'Öffnen',
    name: 'Name',
    notes: 'Notizen',
    year: 'Jahr',
    language: 'Sprache',
    confirmDelete: 'Wirklich löschen?',
    loadFailed: 'Die Daten konnten nicht geladen werden.',
    saveFailed: 'Speichern fehlgeschlagen.',
    deleteFailed: 'Löschen fehlgeschlagen.',
    nothingYet: 'Hier ist noch nichts.',
    unknown: 'unbekannt',
    total: 'gesamt',
    showing: 'Angezeigt',
    previous: 'Zurück',
    next: 'Weiter'
  },
  dashboard: {
    title: 'Bibliothek',
    subtitle: 'Werke, Ausgaben und die Exemplare in meinen Regalen.',
    works: 'Werke',
    editions: 'Ausgaben',
    copies: 'Exemplare',
    translations: 'Übersetzungen',
    people: 'Personen',
    publishers: 'Verlage',
    shelves: 'Regale',
    tags: 'Schlagwörter',
    reading: 'In Lektüre',
    read: 'Gelesen',
    unread: 'Ungelesen',
    lentOut: 'Verliehen',
    borrowed: 'Geliehen',
    overdue: 'Überfällig',
    byLanguage: 'Nach Ausgabesprache',
    byOriginalLanguage: 'Nach Originalsprache',
    byKind: 'Nach Art',
    byShelf: 'Nach Regal',
    topAuthors: 'Häufigste Autoren',
    recentlyAdded: 'Zuletzt hinzugefügt',
    unshelved: 'Ohne Regal',
    quickStart: 'Wie anfangen',
    quickStartText:
      'Lege ein Werk mit Originaltitel und Originalsprache an, hänge dann Ausgaben daran — auch Übersetzungen — und zuletzt die Exemplare, die du besitzt.',
    addFirstWork: 'Erstes Werk anlegen'
  },
  works: {
    title: 'Werke',
    subtitle: 'Die Schöpfungen selbst — Originaltitel und Originalsprache.',
    newWork: 'Neues Werk',
    searchPlaceholder: 'Originaltitel oder Ausgabetitel…',
    filterKind: 'Art',
    filterOriginalLanguage: 'Originalsprache',
    filterEditionLanguage: 'Ausgabesprache',
    filterAuthor: 'Person',
    filterTag: 'Schlagwort',
    filterPublisher: 'Verlag',
    onlyTranslated: 'Nur übersetzte',
    onlyOwned: 'Nur vorhandene',
    sort: 'Sortierung',
    sortTitle: 'Titel',
    sortCreated: 'Zuletzt hinzugefügt',
    sortUpdated: 'Zuletzt geändert',
    sortYearAsc: 'Jahr aufsteigend',
    sortYearDesc: 'Jahr absteigend',
    editionCount: 'Ausg.',
    copyCount: 'Ex.',
    empty: 'Noch keine Werke. Lege das erste an.',
    emptyFiltered: 'Kein Werk passt zu diesen Filtern.'
  },
  work: {
    newTitle: 'Neues Werk',
    editTitle: 'Werk',
    originalTitle: 'Originaltitel',
    originalTitleHint: 'Der Titel in der Sprache, in der das Werk verfasst wurde.',
    originalSubtitle: 'Originaluntertitel',
    originalLanguage: 'Originalsprache',
    originalLanguageHint: 'Eine Ausgabe in anderer Sprache gilt als Übersetzung.',
    uniformTitle: 'Einheitstitel',
    uniformTitleHint: 'Der Titel, unter dem du das Werk führst, falls abweichend.',
    kind: 'Art',
    firstPublishedYear: 'Erstveröffentlichung',
    notes: 'Notizen',
    authorsSection: 'Autoren',
    authorsHint: 'Die Autorschaft gehört zum Werk. Übersetzer gehören zur Ausgabe.',
    tagsSection: 'Schlagwörter',
    editionsSection: 'Ausgaben',
    editionsHint: 'Jede Ausgabe ist eine eigene Publikation — Original oder Übersetzung.',
    addEdition: 'Ausgabe hinzufügen',
    noEditions: 'Noch keine Ausgaben. Lege eine an, bevor du Exemplare erfasst.',
    originalEdition: 'Original',
    translation: 'Übersetzung',
    deleteWork: 'Werk löschen',
    deleteWorkConfirm:
      'Dieses Werk mit allen Ausgaben, Exemplaren, Ausleihen und Lektüren löschen? Das lässt sich nicht rückgängig machen.',
    createFirst: 'Speichere das Werk, um Ausgaben und Exemplare anzulegen.'
  },
  edition: {
    newTitle: 'Neue Ausgabe',
    editTitle: 'Ausgabe',
    ofWork: 'Werk',
    title: 'Titel der Ausgabe',
    titleHint: 'Der Titel auf dem Titelblatt — bei Übersetzungen der übersetzte Titel.',
    subtitle: 'Untertitel',
    language: 'Sprache der Ausgabe',
    languageHint: 'Weicht sie von der Originalsprache ab, ist dies eine Übersetzung.',
    translationBadge: 'Übersetzung',
    originalBadge: 'Original',
    publisher: 'Verlag',
    publishedPlace: 'Erscheinungsort',
    publishedYear: 'Erscheinungsjahr',
    editionStatement: 'Ausgabebezeichnung',
    editionStatementHint: 'Zum Beispiel „2., überarbeitete Auflage“.',
    series: 'Reihe',
    seriesNumber: 'Nummer in der Reihe',
    isbn: 'ISBN',
    issn: 'ISSN',
    pageCount: 'Seiten',
    volume: 'Band',
    binding: 'Einband',
    coverUrl: 'Cover-URL',
    notes: 'Notizen',
    contributorsSection: 'Mitwirkende der Ausgabe',
    contributorsHint: 'Übersetzer, Herausgeber, Illustrator, Verfasser des Vorworts.',
    copiesSection: 'Exemplare',
    copiesHint: 'Die physischen Bücher dieser Ausgabe, die du besitzt.',
    addCopy: 'Exemplar hinzufügen',
    noCopies: 'Keine Exemplare dieser Ausgabe.',
    deleteEdition: 'Ausgabe löschen',
    deleteEditionConfirm:
      'Diese Ausgabe mit Exemplaren, Ausleihen und Lektüren löschen? Das lässt sich nicht rückgängig machen.'
  },
  copy: {
    title: 'Exemplar',
    shelf: 'Regal',
    signature: 'Signatur',
    signatureHint: 'Deine eigene Kennzeichnung im Regal.',
    status: 'Status',
    condition: 'Zustand',
    acquiredDate: 'Erworben am',
    acquiredFrom: 'Erworben von',
    price: 'Preis',
    currency: 'Währung',
    barcode: 'Barcode',
    readingStatus: 'Lektüre',
    rating: 'Bewertung',
    favourite: 'Favorit',
    notes: 'Notizen',
    deleteConfirm: 'Dieses Exemplar mit seinen Ausleihen und Lektüren löschen?',
    lendOut: 'Verleihen',
    logReading: 'Lektüre eintragen',
    onLoanTo: 'Verliehen an:',
    borrowedFrom: 'Geliehen von:',
    due: 'fällig',
    markReturned: 'Als zurück markieren'
  },
  shelfView: {
    title: 'Regal',
    subtitle: 'Die Exemplare, die ich physisch besitze.',
    searchPlaceholder: 'Titel, Signatur oder Barcode…',
    filterShelf: 'Regal',
    filterStatus: 'Status',
    filterReading: 'Lektüre',
    filterLanguage: 'Sprache',
    onlyFavourites: 'Nur Favoriten',
    minRating: 'Mind. Bewertung',
    sort: 'Sortierung',
    sortAdded: 'Zuletzt hinzugefügt',
    sortRating: 'Bewertung',
    sortAcquired: 'Erwerbsdatum',
    sortSignature: 'Signatur',
    empty: 'Keine Exemplare passen zu diesen Filtern.',
    unshelved: 'ohne Regal'
  },
  people: {
    title: 'Personen',
    subtitle: 'Autoren, Übersetzer, Herausgeber und Illustratoren.',
    displayName: 'Anzeigename',
    displayNameHint: 'Wie auf dem Titelblatt, z. B. „Franz Kafka“.',
    sortName: 'Sortiername',
    sortNameHint: 'Die Ansetzungsform, z. B. „Kafka, Franz“.',
    birthYear: 'Geboren',
    deathYear: 'Gestorben',
    nationality: 'Nationalität',
    notes: 'Notizen',
    worksCount: 'Werke',
    editionsCount: 'Ausgaben',
    add: 'Person hinzufügen',
    empty: 'Noch keine Personen. Lege einen Autor an, um ein Werk zuzuordnen.',
    deleteConfirm: 'Diese Person löschen? Ihre Zuordnungen entfallen, die Werke bleiben.',
    searchPlaceholder: 'Personen suchen…',
    viewWorks: 'Werke anzeigen'
  },
  publishers: {
    title: 'Verlage',
    subtitle: 'Die Häuser, deren Ausgaben in der Sammlung stehen.',
    name: 'Name',
    city: 'Stadt',
    notes: 'Notizen',
    editionsCount: 'Ausgaben',
    add: 'Verlag hinzufügen',
    empty: 'Noch keine Verlage.',
    deleteConfirm: 'Diesen Verlag löschen? Ausgaben bleiben, verlieren nur den Bezug.'
  },
  shelves: {
    title: 'Regale',
    subtitle: 'Die physischen Orte, an denen die Bücher stehen.',
    name: 'Name',
    nameHint: 'Zum Beispiel „Schrank A, Fach 3“.',
    location: 'Ort',
    locationHint: 'Raum oder Gebäude.',
    description: 'Beschreibung',
    sortOrder: 'Reihenfolge',
    copiesCount: 'Ex.',
    add: 'Regal hinzufügen',
    empty: 'Noch keine Regale.',
    deleteConfirm: 'Dieses Regal löschen? Exemplare bleiben, stehen aber ohne Regal.',
    browse: 'Durchsehen'
  },
  tags: {
    title: 'Schlagwörter',
    subtitle: 'Themen, die an Werken hängen.',
    name: 'Name',
    color: 'Farbe',
    worksCount: 'Werke',
    add: 'Schlagwort hinzufügen',
    empty: 'Noch keine Schlagwörter.',
    deleteConfirm: 'Dieses Schlagwort von allen Werken entfernen?',
    duplicate: 'Ein Schlagwort mit diesem Namen existiert bereits.'
  },
  loans: {
    title: 'Ausleihen',
    subtitle: 'Was ich verliehen und was ich geliehen habe.',
    openOnly: 'Nur offene',
    direction: 'Richtung',
    counterpart: 'Person',
    counterpartOut: 'Verliehen an',
    counterpartIn: 'Geliehen von',
    contact: 'Kontakt',
    lentOn: 'Verliehen am',
    dueOn: 'Fällig am',
    returnedOn: 'Zurück am',
    notes: 'Notizen',
    overdue: 'überfällig',
    returned: 'zurück',
    open: 'offen',
    empty: 'Keine Ausleihen erfasst.',
    deleteConfirm: 'Diesen Ausleiheintrag löschen?',
    markReturned: 'Heute zurück'
  },
  reading: {
    title: 'Lektüre',
    subtitle: 'Das Lesetagebuch — wann und mit welchem Urteil.',
    startedOn: 'Begonnen',
    finishedOn: 'Beendet',
    rating: 'Bewertung',
    notes: 'Notizen',
    empty: 'Noch keine Lektüreeinträge.',
    deleteConfirm: 'Diesen Lektüreeintrag löschen?',
    inProgress: 'laufend',
    finished: 'beendet'
  },
  data: {
    title: 'Daten',
    subtitle: 'Sicherung und Übertragung der Sammlung.',
    exportTitle: 'Export',
    exportText: 'Lädt die ganze Bibliothek als eine JSON-Datei — Werke, Ausgaben, Exemplare, Ausleihen und Lektüren.',
    exportButton: 'JSON-Datei laden',
    exportDone: 'Die Datei wurde geladen.',
    importTitle: 'Import',
    importText: 'Liest eine aus dieser Bibliothek exportierte JSON-Datei.',
    importButton: 'Importieren',
    importWarning: 'Der Import ergänzt vorhandene Einträge — er ersetzt sie nicht.',
    importDone: 'Importiert:',
    importFailed: 'Die Datei konnte nicht importiert werden.',
    chooseFile: 'Datei wählen'
  },
  kinds: {
    book: 'Buch', article: 'Aufsatz', essay: 'Essay', poetry: 'Lyrik', drama: 'Drama',
    treatise: 'Traktat', collection: 'Sammlung', reference: 'Nachschlagewerk', other: 'sonstiges'
  },
  roles: {
    author: 'Autor', coauthor: 'Mitautor', editor: 'Herausgeber', translator: 'Übersetzer',
    illustrator: 'Illustrator', foreword: 'Vorwort', afterword: 'Nachwort',
    commentary: 'Kommentar', compiler: 'Bearbeitung', other: 'andere Rolle'
  },
  statuses: {
    shelf: 'im Regal', lent: 'verliehen', borrowed: 'geliehen', wanted: 'gesucht',
    ordered: 'bestellt', lost: 'verloren', sold: 'verkauft'
  },
  conditions: {
    new: 'neu', good: 'gut', fair: 'mäßig', worn: 'abgegriffen', damaged: 'beschädigt'
  },
  readingStatuses: {
    unread: 'ungelesen', reading: 'in Lektüre', read: 'gelesen',
    abandoned: 'abgebrochen', reference: 'Nachschlagewerk'
  },
  bindings: {
    hardcover: 'gebunden', paperback: 'broschiert', leather: 'Leder',
    ebook: 'E-Book', audiobook: 'Hörbuch', other: 'sonstiger'
  },
  languages: languageNamesDe
};

const strings: Record<LibraryLanguage, LibraryCopyStrings> = { pl, en, de };

export function getLibraryCopy(language: string): LibraryCopyStrings {
  if (language === 'en' || language === 'de') return strings[language];
  return strings.pl;
}

/** Falls back to the raw code so hand-typed languages still render. */
export function languageLabel(t: LibraryCopyStrings, code: string): string {
  if (!code) return t.common.unknown;
  return t.languages[code] ?? code;
}
