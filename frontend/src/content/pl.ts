import type { Copy } from './types';

export const pl: Copy = {
  nav: {
    home: 'Start',
    parish: 'Parafia',
    cogita: 'Cogita',
    faq: 'FAQ',
    legal: 'RODO i regulamin',
    login: 'Zaloguj się',
    account: 'Profil'
  },
  accountMenu: {
    profile: 'Ustawienia użytkownika',
    secureModeOn: 'Włącz tryb bezpieczny',
    secureModeOff: 'Wyłącz tryb bezpieczny',
    logout: 'Wyloguj'
  },
  hero: {
    headline: 'REcreatio — platforma zaufania i wiedzy wspólnotowej.',
    subtitle:
      'Łączymy edukację, parafie i społeczności w jednym ekosystemie, gdzie dostęp do danych jest kontrolowany kryptograficznie — a nie tylko hasłami.',
    ctaPrimary: 'Wejdź do systemu',
    ctaSecondary: 'Poznaj portale'
  },
  modules: {
    title: 'Publiczne portale i przyszłe moduły',
    items: [
      {
        title: 'Parafia',
        desc: 'Intencje, ogłoszenia, kalendarz i darowizny — publicznie i bezpiecznie.',
        tag: 'publiczny',
        route: 'parish'
      },
      {
        title: 'Cogita',
        desc: 'Przestrzeń wiedzy, quizów i współtworzenia treści edukacyjnych.',
        tag: 'publiczny',
        route: 'cogita'
      },
      {
        title: 'Strefa użytkownika',
        desc: 'Ustawienia profilu, role, klucze dostępu i historia aktywności.',
        tag: 'wkrótce',
        route: 'account'
      }
    ]
  },
  access: {
    title: 'Dostęp do REcreatio',
    subtitle: 'Logowanie daje dostęp do funkcji zarządzania, ale portale publiczne są dostępne bez konta.',
    login: 'Logowanie',
    register: 'Rejestracja',
    loginId: 'Login (nazwa użytkownika lub e-mail)',
    password: 'Hasło',
    confirm: 'Potwierdź hasło',
    displayName: 'Publiczny nick (opcjonalnie)',
    secureMode: 'Tryb bezpieczny (brak cache kluczy)',
    create: 'Utwórz konto',
    signIn: 'Zaloguj się',
    statusTitle: 'Status',
    statusReady: 'Gotowe.',
    loginRequired: 'Login i hasło są wymagane.',
    loginError: 'Logowanie nieudane.',
    registerError: 'Rejestracja nieudana.',
    loginTaken: 'Login jest już zajęty.',
    passwordMismatch: 'Hasła nie są zgodne.',
    passwordTooShort: 'Użyj co najmniej 8 znaków.',
    passwordCommon: 'To hasło jest zbyt popularne.',
    passwordWeak: 'Użyj wielkich/małych liter, cyfr i symboli.',
    passwordStrong: 'Silne hasło.',
    loadingLogin: 'Logowanie…',
    loadingRegister: 'Rejestracja…',
    sessionLabel: 'Sesja',
    checkSession: 'Sprawdź sesję',
    toggleMode: 'Zmień tryb',
    logout: 'Wyloguj'
  },
  dashboard: {
    title: 'Panel po zalogowaniu',
    subtitle: 'Tu pojawi się centrum zarządzania, skróty do modułów i wskazówki bezpieczeństwa.',
    cards: [
      {
        title: 'Ustawienia profilu',
        desc: 'Wkrótce: dane osobowe, role i bezpieczeństwo konta.',
        action: 'Przejdź (wkrótce)',
        route: 'account'
      },
      {
        title: 'Parafia',
        desc: 'Wejście do intencji, ogłoszeń i panelu administracyjnego.',
        action: 'Otwórz portal',
        route: 'parish'
      },
      {
        title: 'Cogita',
        desc: 'Przejdź do wiedzy, quizów i materiałów edukacyjnych.',
        action: 'Otwórz portal',
        route: 'cogita'
      }
    ]
  },
  parish: {
    title: 'Portal parafialny',
    subtitle:
      'Publiczne informacje są dostępne bez logowania. Konta są wymagane do edycji, rozliczeń i zarządzania rolami.',
    items: [
      'Intencje i ofiary — bezpiecznie i z pełnym audytem.',
      'Ogłoszenia i kalendarz wydarzeń.',
      'Publiczne zestawienia oraz prywatne dane finansowe.'
    ],
    note: 'Już teraz możesz przeglądać publiczne treści. Funkcje administracyjne pojawią się po zalogowaniu.',
    loginCta: 'Zaloguj się przez REcreatio'
  },
  cogita: {
    title: 'Portal Cogita',
    subtitle:
      'Strefa wiedzy i wspólnego tworzenia treści. Dostęp publiczny do materiałów, konto do tworzenia i edycji.',
    items: [
      'Quizy na żywo i moduły interaktywne.',
      'Biblioteka wiedzy i narzędzia edukacyjne.',
      'Udostępnianie materiałów z kontrolą dostępu.'
    ],
    note: 'Cogita będzie mogła działać również jako osobna domena, np. cogita.pl — bez zmiany backendu.',
    loginCta: 'Zaloguj się przez REcreatio',
    shell: {
      back: 'Wstecz',
      up: 'Góra'
    },
    user: {
      librariesKicker: 'Biblioteki',
      librariesTitle: 'Twoje biblioteki wiedzy',
      librariesSubtitle: 'Utwórz rolę biblioteki, a potem wejdź, aby zarządzać zaszyfrowanymi kartami i połączeniami.',
      createLibraryTitle: 'Utwórz nową bibliotekę',
      libraryNameLabel: 'Nazwa biblioteki',
      libraryNamePlaceholder: 'np. Teologia średniowieczna',
      createLibraryAction: 'Utwórz bibliotekę',
      availableLibraries: 'Dostępne biblioteki',
      loadingLibraries: 'Ładowanie bibliotek...',
      noLibraries: 'Brak bibliotek. Utwórz pierwszą.',
      libraryRoleLabel: 'Rola biblioteki',
      openOverview: 'Otwórz przegląd',
      openCards: 'Otwórz karty',
      libraryNameRequired: 'Nazwa biblioteki jest wymagana.',
      libraryCreateFailed: 'Nie udało się jeszcze utworzyć biblioteki.'
    },
    introSlides: [
      {
        id: 'entry',
        title: 'Cogita.',
        subtitle: 'Scena wiedzy na żywo dla nauki i dialogu.',
        micro: 'Wejdź i zobacz, jak prowadzi mapa wiedzy.',
        cta: 'Rozpocznij pokaz'
      },
      {
        id: 'workspace',
        title: 'Nie dostajesz kolejnego kroku, zanim nie jesteś gotowy.',
        body:
          'Nowa wiedza otwiera się dopiero, gdy rozumiesz poprzednią.\nGdy brakuje podstaw, Cogita je odbudowuje — i prowadzi dalej.',
        micro: 'Drzewo wiedzy, które prowadzi.',
        cta: 'Dalej: Jak prowadzi'
      },
      {
        id: 'library',
        title: 'Wiedza do ponownego użycia — nie tylko do czytania.',
        body:
          'Zapisuj idee jako karty: streszczenie, cytat, źródło, tagi.\nPotem układaj z nich argumenty i notatki, bez utraty kontekstu.',
        micro: 'Twoje pudełko wiedzy.',
        cta: 'Dalej: Współpraca na żywo'
      },
      {
        id: 'live',
        title: 'Wiedza żyje w rozmowie.',
        body:
          'Uczysz się szybciej, gdy myślisz razem z innymi.\nWspólna runda pytań i odpowiedzi zamienia naukę w dialog.',
        micro: 'Pytaj, odpowiadaj, wyjaśniaj.',
        cta: 'Dalej: Wspólna gra'
      },
      {
        id: 'quiz',
        title: 'Widzisz postęp — i co trenować dalej.',
        body:
          'Śledź swój rozwój i porównuj się z grupą.\nZnajduj luki i łącz się z osobami na podobnym poziomie.',
        micro: 'Jasna informacja zwrotna.',
        cta: 'Dalej: Zaufanie i prywatność'
      },
      {
        id: 'protection',
        title: 'Otwarte, ale chronione.',
        body: 'To, co prywatne, pozostaje prywatne — dostęp jest kontrolowany, a dane chronione.',
        micro: 'Zaufanie jako fundament.',
        cta: 'Dalej: Dołącz'
      },
      {
        id: 'register',
        title: 'Wejdź do Cogita.',
        body: 'Załóż konto i rozpocznij pierwszą scenę wiedzy.',
        micro: 'To zajmie chwilę.',
        cta: 'Zarejestruj się',
        secondary: 'Wróć do początku'
      }
    ],
    page: {
      nav: [
        { id: 'home', label: 'Start' },
        { id: 'library', label: 'Biblioteka' },
        { id: 'live', label: 'Live' },
        { id: 'participation', label: 'Udział' },
        { id: 'results', label: 'Wyniki' },
        { id: 'security', label: 'Bezpieczeństwo' },
        { id: 'join', label: 'Wejście' }
      ],
      hero: {
        tag: 'Cogita',
        title: 'Żywa przestrzeń wiedzy dla quizów, dialogu i wspólnej pamięci.',
        subtitle:
          'Projektuj quizy, prowadź sesje live i daj każdemu uczestnikowi własny widok wyników. Cogita utrzymuje treści publiczne, a klucze prywatne.',
        primaryCta: 'Zacznij z REcreatio',
        secondaryCta: 'Zobacz podstrony'
      },
      homeSlides: [
        {
          id: 'overview',
          title: 'Cogita. Scena wiedzy na żywo dla nauki i dialogu.',
          text:
            'Prezentacja dla quizów, sesji i zasobów, otwarta, ale chroniona kryptografią.',
          ctaLabel: 'Rozpocznij pokaz'
        },
        {
          id: 'library',
          title: 'Biblioteka wiedzy z gotowymi zestawami quizów.',
          text: 'Twórz lekcje, dodawaj materiały i publikuj kolekcje tematyczne.',
          ctaLabel: 'Dalej: live'
        },
        {
          id: 'live',
          title: 'Sesje live z kontrolowanym tempem.',
          text: 'Uruchom sesję, udostępnij kod i prowadź grupę krok po kroku.',
          ctaLabel: 'Dalej: udział'
        },
        {
          id: 'results',
          title: 'Udział, wyniki i SharedViews.',
          text: 'Każdy uczestnik ma własny widok wyników, nawet bez konta.',
          ctaLabel: 'Dalej: bezpieczeństwo'
        },
        {
          id: 'security',
          title: 'Bezpieczeństwo wbudowane w proces.',
          text: 'Klucze ról, audyt zmian i osobne domeny, np. cogita.pl.',
          ctaLabel: 'Dalej: logowanie',
          variant: 'secondary'
        },
        {
          id: 'login',
          title: 'Gotowy na Cogita?',
          text: 'Zaloguj się przez REcreatio, aby tworzyć quizy i prowadzić sesje.',
          ctaLabel: 'Zaloguj się przez REcreatio'
        }
      ],
      stats: [
        { value: '3 tryby', label: 'Nauczyciel, uczeń, gość' },
        { value: '1 link', label: 'QR lub kod sesji' },
        { value: '0 zaufania', label: 'dostęp wymusza klucz' }
      ],
      highlights: [
        {
          title: 'Sterowanie sesją live',
          desc: 'Start, pauza i zamknięcie sesji jednym ruchem.'
        },
        {
          title: 'Anonimowo, ale prywatnie',
          desc: 'Uczestnicy bez konta mają własny, prywatny widok wyników.'
        },
        {
          title: 'Audit-first',
          desc: 'Każda zmiana jest rejestrowana i powiązana z rolą.'
        }
      ],
      sections: [
        {
          id: 'library',
          tag: 'Biblioteka wiedzy',
          title: 'Buduj lekcje, używaj zestawów pytań, trzymaj kontekst.',
          subtitle: 'Quizy i materiały z szablonami, wersjonowaniem i współautorstwem.',
          cards: [
            {
              title: 'Kreator quizów',
              desc: 'Banki pytań, szablony i warianty losowe do sprawdzania wiedzy.',
              meta: 'Szablony + generator'
            },
            {
              title: 'Tablice wiedzy',
              desc: 'Grupuj tematy, dodawaj materiały i utrzymuj kontekst.',
              meta: 'Kolekcje + tagi'
            },
            {
              title: 'Współedycja',
              desc: 'Zapraszaj współtwórców z dostępem opartym o role.',
              meta: 'Dostęp rolowy'
            }
          ],
          bullets: [
            'Szablony pytań z losowanymi parametrami.',
            'Materiały, linki i media przy każdej sekcji.',
            'Publiczne podglądy bez ujawniania odpowiedzi.'
          ]
        },
        {
          id: 'live',
          tag: 'Sesje live',
          title: 'Prowadź udział na żywo bez utraty koncentracji.',
          subtitle: 'Uruchom sesję, udostępnij kod i prowadź grupę w czasie rzeczywistym.',
          cards: [
            {
              title: 'Panel sesji',
              desc: 'Kontrola pytań, czasu i kolejnych rund.',
              meta: 'Kontrola prowadzącego'
            },
            {
              title: 'Natychmiastowy feedback',
              desc: 'Zbieraj odpowiedzi, pokazuj trendy i decyduj o ujawnieniu wyników.',
              meta: 'Dashboard live'
            },
            {
              title: 'Zakres grupy',
              desc: 'Ogranicz do klasy lub otwórz dla gości.',
              meta: 'Zasięg'
            }
          ],
          bullets: [
            'Quizy z natychmiastową informacją zwrotną.',
            'Uczestnicy zalogowani i anonimowi w jednej sesji.',
            'Prywatne wyniki dzięki widokom QR.'
          ]
        },
        {
          id: 'participation',
          tag: 'Udział',
          title: 'Dopasuj udział do potrzeb grupy.',
          subtitle: 'Trzy sposoby dołączenia, każdy z własnym widokiem danych.',
          cards: [
            {
              title: 'Uczniowie zalogowani',
              desc: 'Wyniki są przypięte do konta ucznia.',
              meta: 'Powiązane z kontem'
            },
            {
              title: 'Anonimowi goście',
              desc: 'Szybkie wejście przez QR i prywatny link wyników.',
              meta: 'Bez konta'
            },
            {
              title: 'Przypnij później',
              desc: 'Gość może później dołączyć wyniki do konta.',
              meta: 'SharedView'
            }
          ],
          bullets: [
            'Wejście przez QR z indywidualnym SharedView.',
            'Prywatne linki wyników możliwe do odwołania.',
            'Historia zostaje po założeniu konta.'
          ]
        },
        {
          id: 'results',
          tag: 'Wyniki',
          title: 'Zobacz sygnały uczenia, nie tylko punkty.',
          subtitle: 'Czas, poprawność i dynamika grupy bez ujawniania surowych danych.',
          cards: [
            {
              title: 'Czas vs poprawność',
              desc: 'Gdzie pojawia się niepewność, a gdzie pewność.',
              meta: 'Analityka'
            },
            {
              title: 'Powtórka sesji',
              desc: 'Powrót do pytań z zagregowanym obrazem.',
              meta: 'Podsumowanie'
            },
            {
              title: 'Eksport widoków',
              desc: 'Udostępniaj podsumowania bez ujawniania odpowiedzi.',
              meta: 'Raporty kontrolowane'
            }
          ],
          bullets: [
            'Wnioski zagregowane bez wglądu w odpowiedzi indywidualne.',
            'Widoki QR dla osobistych wyników.',
            'Zaufanie dzięki audytowalnym raportom.'
          ]
        },
        {
          id: 'security',
          tag: 'Bezpieczeństwo',
          title: 'Dostęp wymuszany jest kluczami, nie tylko hasłem.',
          subtitle: 'Cogita korzysta z kryptografii REcreatio dla pełnej kontroli.',
          cards: [
            {
              title: 'Klucze ról',
              desc: 'Nauczyciele, admini i klasy mają własne klucze danych.',
              meta: 'Key Ledger'
            },
            {
              title: 'SharedViews',
              desc: 'Anonimowe wyniki są ograniczone do jednej osoby.',
              meta: 'Bezpieczeństwo QR'
            },
            {
              title: 'Audit trail',
              desc: 'Zmiany w quizach i sesjach są rejestrowane.',
              meta: 'Auth Ledger'
            }
          ],
          bullets: [
            'Szyfrowane konfiguracje i odpowiedzi.',
            'Brak dostępu bez właściwego klucza roli.',
            'Tryb secure bez cache kluczy.'
          ]
        }
      ],
      join: {
        title: 'Wejdź do Cogita',
        subtitle: 'Zaloguj się, aby tworzyć, albo poznaj publiczne treści.',
        cards: [
          {
            title: 'Zaloguj się do tworzenia',
            desc: 'Projektuj quizy, prowadź sesje i zapraszaj współtwórców.',
            action: 'Zaloguj się'
          },
          {
            title: 'Zobacz publiczne treści',
            desc: 'Przeglądaj tablice wiedzy i demo sesje.',
            action: 'Odkryj'
          },
          {
            title: 'Porozmawiaj z zespołem',
            desc: 'Zaplanuj pilotaż z Twoją szkołą lub wspólnotą.',
            action: 'Kontakt'
          }
        ]
      }
    },
    library: {
      nav: {
        overview: 'Przegląd',
        list: 'Lista kart',
        add: 'Dodaj info',
        collections: 'Kolekcje'
      },
      navLabel: 'Nawigacja biblioteki',
      sidebar: {
        title: 'Mapa biblioteki',
        sections: {
          library: 'Biblioteka',
          cards: 'Karty',
          collections: 'Kolekcje',
          currentCollection: 'Bieżąca kolekcja'
        },
        groups: {
          libraryOverview: 'Przegląd',
          libraryGraph: 'Grafy',
          libraryStats: 'Statystyki',
          libraryTransfers: 'Transfery',
          librarySecurity: 'Bezpieczeństwo',
          cardsBrowse: 'Przeglądanie',
          cardsAdd: 'Dodawanie',
          cardsTypes: 'Typy',
          collectionsManage: 'Zarządzanie',
          collectionsTemplates: 'Szablony',
          collectionsRevision: 'Powtórka',
          currentOverview: 'Przegląd',
          currentRevision: 'Powtórka',
          currentInsights: 'Wgląd',
          currentExport: 'Eksport'
        },
        items: {
          overview: 'Przegląd',
          list: 'Przeglądaj karty',
          add: 'Dodaj nowe info',
          dependencies: 'Graf zależności',
          libraryStats: 'Statystyki biblioteki',
          libraryRoles: 'Graf ról',
          libraryTransfers: 'Eksport i import',
          librarySecurity: 'Bezpieczeństwo i klucze',
          typeVocab: 'Karty słownictwa',
          typeLanguage: 'Języki',
          typeWord: 'Słowa',
          typeSentence: 'Zdania / cytaty',
          typeTopic: 'Tematy',
          typePerson: 'Osoby',
          typeAddress: 'Adresy',
          typeEmail: 'E-maile',
          typePhone: 'Telefony',
          typeBook: 'Książki',
          typeMedia: 'Media',
          typeGeo: 'Geografia',
          typeMusic: 'Muzyka',
          typeComputed: 'Obliczeniowe',
          collections: 'Wszystkie kolekcje',
          createCollection: 'Utwórz kolekcję',
          smartCollections: 'Inteligentne kolekcje',
          dependencyRules: 'Reguły zależności',
          revisionQueue: 'Kolejka powtórek',
          revisionHistory: 'Historia powtórek',
          sharedRevisions: 'Udostępnione powtórki',
          collectionDetail: 'Szczegóły kolekcji',
          collectionGraph: 'Graf kolekcji',
          revisionSettings: 'Ustawienia powtórki',
          revisionRun: 'Start powtórki',
          collectionStats: 'Statystyki kolekcji',
          collectionKnowness: 'Mapa wiedzy',
          collectionExport: 'Eksport kolekcji'
        },
        badges: {
          comingSoon: 'Wkrótce'
        }
      },
      actions: {
        backToCogita: 'Wróć do Cogita',
        libraryOverview: 'Przegląd biblioteki',
        openList: 'Otwórz listę',
        collections: 'Kolekcje',
        addInfo: 'Dodaj nowe info',
        createCollection: 'Utwórz kolekcję',
        saveCollection: 'Zapisz kolekcję',
        startRevision: 'Rozpocznij powtórkę',
        collectionDetail: 'Szczegóły kolekcji'
      },
      infoTypes: {
        any: 'Wszystkie karty',
        vocab: 'Karta słownictwa',
        language: 'Język',
        word: 'Słowo',
        sentence: 'Zdanie / cytat',
        topic: 'Temat',
        collection: 'Kolekcja',
        person: 'Osoba',
        address: 'Adres',
        email: 'Email',
        phone: 'Telefon',
        book: 'Książka',
        media: 'Media',
        geo: 'Geo',
        musicPiece: 'Utwór muzyczny',
        musicFragment: 'Fragment muzyczny',
        computed: 'Obliczane'
      },
      connectionTypes: {
        wordLanguage: 'Słowo - język',
        wordTopic: 'Słowo - temat',
        languageSentence: 'Język - zdanie',
        translation: 'Połączenie tłumaczenia'
      },
      groupTypes: {
        vocab: 'Karta słownictwa'
      },
      overview: {
        kicker: 'Biblioteka',
        subtitle: 'Przegląd zaszyfrowanej biblioteki kart.',
        stats: {
          totalInfos: 'Łącznie informacji',
          connections: 'Połączenia',
          words: 'Słowa',
          sentences: 'Zdania',
          languages: 'Języki',
          collections: 'Kolekcje'
        },
        quickActionsTitle: 'Szybkie akcje',
        quickActionsText: 'Przejdź do listy, aby przeglądać karty lub dodać wpis.',
        browseList: 'Przeglądaj listę',
        viewCollections: 'Zobacz kolekcje',
        addInfo: 'Dodaj info',
        seedMock: 'Utwórz dane testowe',
        seedSuccess: 'Dane testowe gotowe: {languages} języki, {translations} kart słownictwa.',
        seedFail: 'Nie udało się utworzyć danych testowych.',
        focusTitle: 'Co jest w środku?',
        focusBody1: 'Każda karta jest szyfrowana i łączona relacjami.',
        focusBody2: 'Użyj listy do przeglądu, potem dodawaj lub łącz nowe węzły wiedzy.',
        transferTitle: 'Eksport i import',
        transferBody: 'Eksport odszyfrowuje bibliotekę do paczki JSON. Import odtwarza ją z nowymi kluczami.',
        export: 'Eksportuj bibliotekę',
        import: 'Importuj paczkę',
        exporting: 'Eksportowanie biblioteki…',
        importing: 'Importowanie paczki…',
        exportProgress: 'Postęp eksportu: {loaded} / {total}',
        importProgress: 'Postęp importu: {loaded} / {total}',
        progressUnknown: 'nieznany',
        exportReady: 'Eksport gotowy.',
        exportFail: 'Eksport nieudany.',
        importDone: 'Import zakończony.',
        importStageInfos: 'Informacje',
        importStageConnections: 'Połączenia',
        importStageCollections: 'Kolekcje',
        importLiveProgress: '{stage}: {done}/{total} (info {infos}, połączeń {connections}, kolekcji {collections})',
        importSummary: 'Zaimportowano: {infos} informacji, {connections} połączeń, {collections} kolekcji.',
        importFail: 'Import nieudany.'
      },
      list: {
        kicker: 'Lista biblioteki',
        subtitle: 'Przeglądaj wszystkie zaszyfrowane karty.',
        searchTitle: 'Wyszukaj',
        searchPlaceholder: 'Szukaj tekstu, nazwy lub etykiety',
        cardCount: '{shown} z {total} kart',
        cardTypeInfo: 'Info',
        cardTypeConnection: 'Połączenie',
        cardTypeVocab: 'Słownictwo',
        modes: {
          detail: 'Szczegóły',
          collection: 'Kolekcja',
          list: 'Lista'
        },
        selectedTitle: 'Wybrana informacja',
        selectedEmpty: 'Wybierz kartę',
        selectedHint: 'Użyj strony dodawania, aby tworzyć połączenia lub słownictwo.',
        noMatch: 'Brak pasujących informacji.',
        addInfo: 'Dodaj informację',
        loadMore: 'Załaduj więcej',
        loading: 'Ładowanie...',
        ready: 'Gotowe',
        progressUnlimited: 'Bez limitu',
        computedSampleTitle: 'Przykład obliczeniowy',
        computedPromptLabel: 'Zadanie:',
        computedAnswerLabel: 'Odpowiedź:',
        computedLoading: 'Tworzenie przykładu…',
        computedEmpty: 'Brak dostępnego przykładu.',
        editInfo: 'Edytuj informację',
        deleteConnection: 'Usuń połączenie',
        deleteConnectionConfirm: 'Usunąć to połączenie? Tej operacji nie można cofnąć.',
        deleteConnectionFailed: 'Nie udało się usunąć połączenia.'
      },
      filters: {
        title: 'Filtry',
        clear: 'Wyczyść filtry',
        languageA: 'Język A',
        languageB: 'Język B',
        topic: 'Temat',
        level: 'Tag tłumaczenia',
        placeholderLanguageA: 'Filtruj po języku A',
        placeholderLanguageB: 'Filtruj po języku B',
        placeholderTopic: 'Filtruj po temacie',
        placeholderLevel: 'Filtruj po tagu tłumaczenia'
      },
      add: {
        kicker: 'Dodaj info',
        subtitle: 'Twórz nowe karty, połączenia lub słownictwo.',
        tabs: {
          info: 'info',
          connection: 'połączenie',
          group: 'grupa'
        },
        tabDesc: {
          info: 'Dodaj język, słowo, zdanie, temat, osobę lub dane.',
          connection: 'Połącz dwie lub więcej informacji relacją.',
          group: 'Twórz powiązania słownictwa ze słów, języków i tłumaczeń.'
        },
        info: {
          typeLabel: 'Typ informacji',
          labelLabel: 'Etykieta',
          labelPlaceholder: 'Tytuł, nazwa lub główny tekst',
          languageLabel: 'Język',
          languagePlaceholder: 'Wyszukaj lub utwórz język',
          notesLabel: 'Notatki',
          notesPlaceholder: 'Opis, źródło cytatu lub metadane',
          computedLabel: 'Szablon pytania',
          computedPlaceholder: 'Przykład: {a} + {b} = ?',
          computedAnswerLabel: 'Zdanie odpowiedzi',
          computedAnswerPlaceholder: 'The {entry} is of type {entry}',
          computedAnswerRequired: 'Zdanie odpowiedzi jest wymagane.',
          computedAnswerMissingOutput: 'Zdanie odpowiedzi musi zawierać wszystkie zmienne wyjściowe.',
          computedRequired: 'Graf obliczeń jest wymagany.',
          computedInvalid: 'Definicja obliczeń musi być poprawnym JSON.',
          computedInvalidName: 'Nieprawidłowe nazwy zmiennych w grafie.',
          computedDuplicateName: 'Powtórzone nazwy zmiennych w grafie.',
        computedPreview: 'Pokaż przykład',
        computedPreviewTitle: 'Przykład obliczeniowy',
        computedPreviewFail: 'Nie udało się wygenerować przykładu.',
        save: 'Zapisz informację',
        update: 'Zapisz zmiany',
        saved: 'Informacja zapisana.',
        updated: 'Informacja zaktualizowana.',
        failed: 'Nie udało się zapisać informacji.'
      },
        connection: {
          typeLabel: 'Typ połączenia',
          languageLabel: 'Język',
          languagePlaceholder: 'Wyszukaj lub utwórz język',
          wordLabel: 'Słowo',
          wordPlaceholder: 'Wyszukaj lub utwórz słowo',
          wordALabel: 'Słowo A',
          wordAPlaceholder: 'Wyszukaj lub utwórz słowo A',
          wordBLabel: 'Słowo B',
          wordBPlaceholder: 'Wyszukaj lub utwórz słowo B',
          sentenceLabel: 'Zdanie',
          sentencePlaceholder: 'Wyszukaj lub utwórz zdanie',
          topicLabel: 'Temat',
          topicPlaceholder: 'Wyszukaj lub utwórz temat',
          noteLabel: 'Notatka',
          notePlaceholder: 'Opcjonalny kontekst połączenia',
          save: 'Zapisz połączenie',
          saved: 'Połączenie zapisane.',
          failed: 'Nie udało się zapisać połączenia.',
          pairExists: 'To słowo jest już przypisane do tego języka.',
          selectWordLanguage: 'Wybierz język i słowo.',
          selectWordTopic: 'Wybierz słowo i temat.',
          selectTwoWords: 'Wybierz dwa słowa do połączenia.',
          selectLanguageSentence: 'Wybierz język i zdanie.'
        },
        group: {
          typeLabel: 'Typ grupy',
          languageALabel: 'Język A',
          languageAPlaceholder: 'Wyszukaj lub utwórz język A',
          wordATagsLabel: 'Tagi dla słowa A',
          wordATagsPlaceholder: 'Wyszukaj lub utwórz tagi dla słowa A',
          wordBTagsLabel: 'Tagi dla słowa B',
          wordBTagsPlaceholder: 'Wyszukaj lub utwórz tagi dla słowa B',
          translationTagsLabel: 'Tagi tłumaczenia',
          translationTagsPlaceholder: 'Wyszukaj lub utwórz tagi tłumaczenia',
          wordALabel: 'Słowo A',
          wordAPlaceholder: 'Wyszukaj lub utwórz słowo A',
          languageBLabel: 'Język B',
          languageBPlaceholder: 'Wyszukaj lub utwórz język B',
          wordBLabel: 'Słowo B',
          wordBPlaceholder: 'Wyszukaj lub utwórz słowo B',
          save: 'Zapisz połączenia słownictwa',
          saved: 'Połączenia słownictwa zapisane.',
          failed: 'Nie udało się zapisać połączeń słownictwa.',
          pairExistsA: 'Słowo A jest już przypisane do języka A.',
          pairExistsB: 'Słowo B jest już przypisane do języka B.',
          selectBoth: 'Wybierz oba języki i oba słowa.'
        }
      },
      collections: {
        listKicker: 'Kolekcje',
        listSubtitle: 'Zestawy kart do powtórek.',
        searchPlaceholder: 'Szukaj nazwy kolekcji',
        emptyTitle: 'Brak kolekcji.',
        emptyAction: 'Utwórz pierwszą kolekcję',
        countLabel: '{shown} z {total} kolekcji',
        collectionLabel: 'Kolekcja',
        noNotes: 'Brak notatek',
        defaultName: 'Kolekcja',
        itemCountLabel: '{count} kart',
        detailKicker: 'Szczegóły kolekcji',
        detailSubtitle: 'Zestawy kart do powtórek.',
        noCards: 'Brak kart w tej kolekcji.',
        detailFocusTitle: 'Przygotuj zestawy powtórek',
        detailFocusBody: 'Twórz kolekcje ze słów, tłumaczeń lub dowolnych kart.',
        createKicker: 'Nowa kolekcja',
        createSubtitle: 'Zbierz karty do powtórki.',
        collectionInfoTitle: 'Informacje o kolekcji',
        nameLabel: 'Nazwa',
        namePlaceholder: 'np. Podstawy niemieckiego',
        notesLabel: 'Notatki',
        notesPlaceholder: 'Fokus, harmonogram lub notatki',
        saveRequiredName: 'Nazwa kolekcji jest wymagana.',
        saveSuccess: 'Kolekcja zapisana.',
        saveFail: 'Nie udało się zapisać kolekcji.',
        findCardsTitle: 'Znajdź karty',
        searchCardsPlaceholder: 'Szukaj kart',
        addToCollection: 'Dodaj do kolekcji',
        added: 'Dodano',
        selectedCardsTitle: 'Wybrane karty',
        selectedCountLabel: '{count} elementów',
        noSelected: 'Brak wybranych kart.',
        remove: 'Usuń',
        loading: 'Ładowanie...',
        ready: 'Gotowe'
      },
      revision: {
        settingsKicker: 'Ustawienia powtórki',
        settingsSubtitle: 'Ustawienia powtórki',
        runKicker: 'Powtórka',
        shareRunKicker: 'Udostępniona powtórka',
        modeSummary: 'Tryb: {mode} · Sprawdzanie: {check}',
        modeLabel: 'Tryb',
        modeValue: 'Losowy',
        modeValueLevels: 'Poziomy',
        modeValueTemporal: 'Czasowy',
        levelsLabel: 'Poziomy',
        stackLabel: 'Wielkość stosu',
        levelsCurrentLabel: 'Poziom karty',
        levelsCountsLabel: 'Karty na poziom',
        levelsStackLabel: 'Aktywny stos',
        triesLabel: 'Liczba prób przed podpowiedzią',
        minCorrectnessLabel: 'Minimalna poprawność (%)',
        compareLabel: 'Porównanie',
        compareBidirectional: 'Dwukierunkowe',
        comparePrefix: 'Tylko początek',
        compareAnchors: 'Kotwice',
        temporalUnknownLabel: 'Nieznane',
        temporalKnownLabel: 'Znane > 1',
        checkLabel: 'Sprawdzanie',
        checkValue: 'Dokładne dopasowanie',
        cardsPerSessionLabel: 'Karty na sesję',
        reviewerLabel: 'Osoba',
        shareKicker: 'Link publiczny',
        shareTitle: 'Udostępnij tę powtórkę',
        shareBody: 'Utwórz publiczny link, który otwiera tę powtórkę w trybie tylko do odczytu.',
        shareAction: 'Utwórz link publiczny',
        shareWorking: 'Tworzenie linku…',
        shareLinkLabel: 'Link udostępnienia',
        shareCopyAction: 'Kopiuj link',
        shareCopied: 'Link skopiowany.',
        shareCopyError: 'Nie udało się skopiować linku.',
        shareError: 'Nie udało się utworzyć linku.',
        shareListTitle: 'Aktywne linki',
        shareListLoading: 'Wczytywanie linków…',
        shareListEmpty: 'Brak aktywnych linków.',
        shareRevokeAction: 'Cofnij',
        shareRevoked: 'Cofnięty',
        shareInvalid: 'Ten link do powtórki jest nieprawidłowy lub wygasł.',
        shareLoading: 'Wczytywanie udostępnionej powtórki…',
        previewTitle: 'Losowa kolejność, ścisłe odpowiedzi',
        previewBody1: 'Karty słownictwa proszą o tłumaczenie.',
        previewBody2: 'Karty słów proszą o wybór języka.',
        start: 'Rozpocznij powtórkę',
        progressTitle: 'Postęp',
        loading: 'Ładowanie kart powtórki...',
        loadingComputed: 'Tworzenie karty obliczeniowej...',
        error: 'Nie udało się wczytać kart.',
        empty: 'Brak kart do powtórki.',
        completed: 'Powtórka zakończona. Świetna robota!',
        vocabLabel: 'Słownictwo',
        infoLabel: 'Info',
        answerLabel: 'Twoja odpowiedź',
        answerPlaceholder: 'Wpisz tłumaczenie',
        answerPlaceholderComputed: 'Wpisz wynik',
        answerSentenceLabel: 'Zdanie odpowiedzi',
        answerSentencePlaceholder: 'Wpisz pełne zdanie odpowiedzi',
        checkAnswer: 'Sprawdź odpowiedź',
        skip: 'Pomiń',
        nextQuestion: 'Następne pytanie',
        hintSelectLanguage: 'Wybierz język dla tego słowa.',
        hintReview: 'Przejrzyj kartę i oznacz jako zrobioną.',
        markDone: 'Oznacz jako zrobione',
        correct: 'Poprawnie',
        tryAgain: 'Spróbuj ponownie',
        noLanguages: 'Brak języków.',
        matchLabel: 'Dopasuj tłumaczenia',
        knownessTitle: 'Znajomość',
        knownessEmpty: 'Brak danych',
        knownessStats: '{correct} / {total} poprawnych',
        knownessLast: 'Ostatnio sprawdzane: {date}',
        knownessHint: 'Rozpocznij powtórkę, aby zobaczyć statystyki znajomości.',
        revealModeLabel: 'Pokaż odpowiedź:',
        revealModeAfterIncorrect: 'po błędnej odpowiedzi (ręcznie)',
        showAnswer: 'Pokaż poprawną odpowiedź',
        correctAnswerLabel: 'Poprawna odpowiedź'
      },
      lookup: {
        searchFailed: 'Wyszukiwanie nieudane.',
        createFailed: 'Tworzenie nieudane.',
        createNew: 'Utwórz nowe {type}',
        saving: 'Zapisywanie...',
        loadMore: 'Pokaż więcej'
      },
      graph: {
        kicker: 'Graf kolekcji',
        subtitle: 'Buduj logikę filtrów za pomocą węzłów i podłącz do wyjścia.',
        palette: 'Dodaj węzły',
        inspector: 'Inspektor węzła',
        typeLabel: 'Typ:',
        save: 'Zapisz graf',
        saveSuccess: 'Graf zapisany.',
        saveFail: 'Nie udało się zapisać grafu.',
        preview: 'Podgląd',
        previewLabel: '{total} pasujących kart',
        previewBreakdown: '{connections} połączeń · {infos} informacji',
        emptyInspector: 'Wybierz węzeł, aby edytować parametry.',
        nameLabel: 'Nazwa zmiennej',
        namePlaceholder: 'np. wynik',
        outputLabel: 'Nazwa wyświetlana wyjścia',
        outputPlaceholder: 'np. wartość',
        duplicateName: 'Nazwa już użyta. Wybierz unikalną.',
        invalidName: 'Użyj tylko liter, cyfr i podkreśleń. Zacznij od litery.',
        nameHint: 'Używaj tylko a–z, 0–9, _ dla wstawek LaTeX jak {x_1}.',
        regenerateRandom: 'Nowa wartość losowa',
        deleteNode: 'Usuń węzeł',
        noParams: 'Ten węzeł nie ma parametrów.',
        listLabel: 'Elementy listy',
        listPlaceholder: 'Jeden wpis na linię',
        nodeTypes: {
          inputRandom: 'Losowe wejście',
          inputConst: 'Stała',
          inputList: 'Element listy',
          add: 'Dodawanie',
          sub: 'Odejmowanie',
          mul: 'Mnożenie',
          div: 'Dzielenie',
          pow: 'Potęga',
          exp: 'Wykładnik',
          log: 'Logarytm',
          abs: 'Wartość bezwzględna',
          min: 'Minimum',
          max: 'Maksimum',
          floor: 'Zaokrąglenie w dół',
          ceil: 'Zaokrąglenie w górę',
          round: 'Zaokrąglenie',
          mod: 'Modulo',
          output: 'Wyjście'
        },
        handleLabels: {
          input: 'Wejście',
          add: 'Dodaj',
          sub: 'Odejmij',
          numerator: 'Licznik',
          denominator: 'Mianownik',
          base: 'Podstawa',
          exponent: 'Wykładnik',
          value: 'Wartość',
          index: 'Indeks',
          name: 'Nazwa'
        },
        tagLabel: 'Tag',
        tagPlaceholder: 'Wyszukaj tag',
        languageLabel: 'Język',
        languagePlaceholder: 'Wyszukaj język',
        scopeLabel: 'Zakres',
        scopeAny: 'Dowolny',
        scopeTranslation: 'Tagi tłumaczenia',
        scopeWordA: 'Słowo A',
        scopeWordB: 'Słowo B',
        infoTypeLabel: 'Typ informacji',
        specificInfoLabel: 'Konkretna informacja',
        specificInfoPlaceholder: 'Wyszukaj informację',
        connectionTypeLabel: 'Typ połączenia',
        connectionIdLabel: 'Konkretne połączenie',
        connectionIdPlaceholder: 'Wklej GUID połączenia'
      }
    }
  },
  faq: {
    title: 'FAQ i bezpieczeństwo',
    items: [
      {
        q: 'Czy moje dane są szyfrowane?',
        a: 'Tak. Dane są szyfrowane kluczami wynikającymi z ról użytkowników.\nBez kluczy nie ma dostępu, nawet dla administratora.'
      },
      {
        q: 'Czy serwer zna moje hasło?',
        a: 'Nie. Hasło jest przekształcane lokalnie, a serwer przechowuje tylko bezpieczny weryfikator.\nW bazie nie ma H1/H2/H3, tylko weryfikator H4.'
      },
      {
        q: 'Czy mogę korzystać bez konta?',
        a: 'Tak. Portale publiczne (Parafia i Cogita) mają treści dostępne bez logowania.'
      },
      {
        q: 'Jak działa tryb bezpieczny?',
        a: 'W trybie bezpiecznym klucze nie są przechowywane w pamięci sesji.\nSą odtwarzane wyłącznie na czas jednego żądania.'
      },
      {
        q: 'Czy jest klasyczny reset hasła?',
        a: 'Nie. Odzyskiwanie dostępu wymaga procedury wieloosobowej i audytu.\nTo chroni przed cichym resetem przez osoby trzecie.'
      },
      {
        q: 'Jakie są stany konta?',
        a: 'Konta mogą być w stanie Pending, Active, Locked, Disabled lub Deleted.\nZmiany stanu są zapisywane w Auth Ledger.'
      },
      {
        q: 'Jak wygląda sesja po zalogowaniu?',
        a: 'Po zalogowaniu tworzony jest SessionId oraz token dostępu.\nToken nie zawiera kluczy szyfrujących ani danych wrażliwych.'
      },
      {
        q: 'Czy zmiany są rejestrowane?',
        a: 'Tak. Najważniejsze zdarzenia zapisywane są w Auth Ledger.\nUmożliwia to audyt i kontrolę zmian.'
      }
    ]
  },
  legal: {
    title: 'RODO, regulamin i transparentność',
    items: [
      {
        title: 'RODO i polityka prywatności',
        desc:
          'Administratorem danych jest Parafia Rzymskokatolicka pw. św. Jana Chrzciciela w Krakowie.\nAdres: ul. Dobrego Pasterza 117, 31-416 Kraków, Polska.\nNIP 9451520798, REGON 040098025.\nKontakt: parafia@janchrzciciel.eu, tel. +48 12 412 58 50.'
      },
      {
        title: 'Cele i podstawy przetwarzania',
        desc:
          'Cele: prowadzenie kont użytkowników, obsługa portali publicznych, komunikacja, bezpieczeństwo i audyt.\nPodstawy: zgoda, realizacja usług, uzasadniony interes administratora, obowiązki prawne.'
      },
      {
        title: 'Kategorie danych',
        desc:
          'Identyfikacyjne: login, e-mail, imię i nazwisko (jeśli podane).\nTechniczne: identyfikatory sesji, informacje o urządzeniu, logi bezpieczeństwa.\nTreści portali: dane przekazane dobrowolnie przez użytkownika.'
      },
      {
        title: 'Odbiorcy i podmioty przetwarzające',
        desc:
          'Hosting i infrastruktura: Webio (Hosting Webio).\nPodmioty wspierające administrację IT tylko w zakresie niezbędnym do utrzymania usług.\nDane nie są sprzedawane.'
      },
      {
        title: 'Środki bezpieczeństwa',
        desc:
          'Szyfrowanie danych, kontrola ról, rejestry audytu oraz ograniczony dostęp administracyjny.\nStałe monitorowanie i rejestrowanie zdarzeń bezpieczeństwa.'
      },
      {
        title: 'Regulamin',
        desc:
          'Zasady korzystania z platformy, role administratorów oraz odpowiedzialność użytkowników.\nZakaz działań niezgodnych z prawem i nadużyć.'
      },
      {
        title: 'Impressum',
        desc:
          'Kontakt techniczny: ks. Michael Mleczek, mleczek_pradnik@outlook.com.\nHosting: Webio (Hosting Webio), ul. Gwiaździsta 8/52, 66-400 Gorzów Wielkopolski, Polska.\nNIP 5992688099, REGON 080265578, e-mail: sprzedaz@webio.pl.'
      },
      {
        title: 'Okres przechowywania',
        desc:
          'Dane konta przechowujemy przez okres aktywności konta i przez czas wymagany przepisami.\nLogi bezpieczeństwa i audytu mogą być przechowywane dłużej dla zgodności i bezpieczeństwa.'
      },
      {
        title: 'Przekazywanie danych',
        desc:
          'Dane nie są przekazywane poza Europejski Obszar Gospodarczy.\nNie stosujemy zautomatyzowanego podejmowania decyzji ani profilowania.'
      },
      {
        title: 'Inspektor Ochrony Danych',
        desc:
          'IOD: rodo@diecezja.krakow.pl, tel. +48 12 628 81 00.\nAdres: ul. Franciszkańska 3, 31-004 Kraków, Polska.'
      },
      {
        title: 'Organ nadzoru',
        desc:
          'Kościelny Inspektor Ochrony Danych (KIOD).\nAdres: Skwer kard. Stefana Wyszyńskiego 6, 01–015 Warszawa.\nE-mail: kiod@episkopat.pl.'
      },
      {
        title: 'Prawa osób, których dane dotyczą',
        desc:
          'Prawo dostępu, sprostowania, usunięcia, ograniczenia przetwarzania oraz przenoszenia danych.\nPrawo sprzeciwu i prawo wniesienia skargi do organu nadzoru.'
      }
    ]
  },
  account: {
    title: 'Ustawienia użytkownika',
    subtitle: 'Zarządzaj publicznym profilem i bezpieczeństwem.',
    overviewTitle: 'Przegląd',
    overviewLead: 'Login nie musi być e-mailem. Nick jest publiczny.',
    sections: {
      overview: 'Przegląd',
      profile: 'Profil publiczny',
      roles: 'Graf ról',
      security: 'Bezpieczeństwo'
    },
    menuLabel: 'Sekcje',
    loginIdLabel: 'Login',
    loginIdHint: 'Może to być nazwa użytkownika lub e-mail i nie można go zmienić.',
    nicknameLabel: 'Publiczny nick',
    nicknameHint: 'Widoczny dla innych użytkowników. Bez danych wrażliwych.',
    nicknamePlaceholder: 'Wpisz publiczny nick',
    nicknameToggle: 'Zmień nick',
    nicknameAction: 'Zapisz nick',
    nicknameWorking: 'Zapisywanie nicku…',
    nicknameSuccess: 'Nick został zaktualizowany.',
    nicknameError: 'Nie udało się zaktualizować nicku.',
    passwordTitle: 'Zmiana hasła',
    currentPassword: 'Aktualne hasło',
    newPassword: 'Nowe hasło',
    confirmPassword: 'Potwierdź nowe hasło',
    passwordToggle: 'Zmień hasło',
    passwordAction: 'Zmień hasło',
    passwordWorking: 'Zmiana hasła…',
    passwordSuccess: 'Hasło zostało zmienione.',
    passwordError: 'Nie udało się zmienić hasła.',
    secureModeTitle: 'Tryb bezpieczny',
    secureModeNote: 'Tryb bezpieczny wyłącza cache kluczy na serwerze.',
    secureModeEnable: 'Włącz tryb bezpieczny',
    secureModeDisable: 'Wyłącz tryb bezpieczny',
    logoutAction: 'Wyloguj',
    roles: {
      lead: 'Graf pokazuje role, dane i relacje kluczy. Kliknij węzeł lub krawędź, aby zobaczyć szczegóły.',
      searchPlaceholder: 'Szukaj po nicku lub ID roli',
      reachableToggle: 'Pokaż tylko osiągalne od wybranej',
      fullscreenEnter: 'Pełny ekran',
      fullscreenExit: 'Wyjdź z pełnego ekranu',
      noFilters: 'Brak typów relacji.',
      loading: 'Ładowanie grafu…',
      noNodes: 'Brak ról do wyświetlenia.',
      panelTitle: 'Szczegóły',
      panelEmpty: 'Wybierz rolę lub relację.',
      legendTitle: 'Legenda',
      edgeTitle: 'Relacja',
      edgeDeleteAction: 'Usuń relację',
      edgeDeleteWorking: 'Usuwanie relacji…',
      edgeDeleteSuccess: 'Relacja usunięta.',
      edgeDeleteError: 'Nie udało się usunąć relacji.',
      linkDraftTitle: 'Ostatnie połączenie',
      linkDraftHint: 'Najnowsza relacja utworzona w grafie.',
      linkWorking: 'Łączenie ról…',
      linkSuccess: 'Relacja zapisana.',
      linkError: 'Nie udało się połączyć ról.',
      createOwnedRole: 'Utwórz rolę podrzędną',
      createOwnedRoleHint: 'Właścicielem będzie wybrana rola.',
      createRoleTitle: 'Nowa rola',
      createRoleNickLabel: 'Nick roli',
      createRoleKindLabel: 'Typ roli',
      createRoleRelationLabel: 'Relacja',
      createRoleAction: 'Utwórz rolę',
      createRoleWorking: 'Tworzenie roli…',
      createRoleSuccess: 'Rola utworzona.',
      createRoleError: 'Nie udało się utworzyć roli.',
      dataAddTitle: 'Dodaj pole danych',
      dataFieldLabel: 'Typ pola',
      dataKindLabel: 'Typ danych',
      dataKindData: 'Dane',
      dataKindKey: 'Klucz',
      dataValueLabel: 'Wartość',
      dataAddAction: 'Dodaj pole',
      dataAddWorking: 'Zapisywanie danych…',
      dataAddSuccess: 'Dane zapisane.',
      dataAddError: 'Nie udało się dodać danych.',
      dataEditTitle: 'Edytuj dane',
      dataEditAction: 'Zapisz dane',
      dataEditWorking: 'Zapisywanie zmian…',
      dataEditSuccess: 'Dane zaktualizowane.',
      dataEditError: 'Nie udało się zaktualizować danych.',
      dataDeleteAction: 'Usuń pole',
      dataDeleteWorking: 'Usuwanie danych…',
      dataDeleteSuccess: 'Dane usunięte.',
      dataDeleteError: 'Nie udało się usunąć danych.',
      dataOwnerLabel: 'Rola właściciela',
      dataShareTitle: 'Udostępnij dane',
      dataShareTargetLabel: 'ID roli docelowej',
      dataSharePermissionLabel: 'Typ dostępu',
      dataShareAction: 'Udostępnij dane',
      dataShareWorking: 'Udostępnianie danych…',
      dataShareSuccess: 'Dane udostępnione.',
      dataShareError: 'Nie udało się udostępnić danych.',
      shareRoleTitle: 'Udostępnij rolę',
      shareRoleTargetLabel: 'Docelowe ID roli',
      shareRoleRelationLabel: 'Typ dostępu',
      shareRoleAction: 'Udostępnij rolę',
      shareRoleWorking: 'Udostępnianie roli…',
      shareRoleSuccess: 'Rola udostępniona.',
      shareRoleError: 'Nie udało się udostępnić roli.',
      shareRoleHint: 'Tworzy zaproszenie oczekujące na akceptację.',
      recoveryPrepareAction: 'Przygotuj klucz odzysku',
      recoveryPrepareWorking: 'Przygotowywanie klucza odzysku…',
      recoveryPrepareSuccess: 'Klucz odzysku przygotowany.',
      recoveryPrepareError: 'Nie udało się przygotować klucza odzysku.',
      recoveryPlanTitle: 'Klucz odzysku (szkic)',
      recoveryPlanHint: 'Połącz role właścicieli, potem aktywuj klucz odzysku.',
      recoveryPlanNeedsShares: 'Brakuje: dodaj co najmniej jedno połączenie właściciela.',
      recoveryPlanLabel: 'Klucz odzysku',
      recoveryPlanError: 'Wybierz szkic klucza odzysku.',
      recoveryShareWorking: 'Dodawanie udziału odzysku…',
      recoveryShareSuccess: 'Udział odzysku dodany.',
      recoveryShareError: 'Nie udało się dodać udziału odzysku.',
      recoveryActivateAction: 'Utwórz klucz odzysku',
      recoveryActivateWorking: 'Aktywowanie klucza odzysku…',
      recoveryActivateSuccess: 'Klucz odzysku aktywny.',
      recoveryActivateError: 'Nie udało się aktywować klucza odzysku.',
      contextAddRoleTitle: 'Dodaj rolę do grafu',
      contextAddRolePlaceholder: 'ID roli',
      contextAddRoleAction: 'Pokaż rolę',
      contextAddRoleWorking: 'Ładowanie roli…',
      contextAddRoleSuccess: 'Rola dodana.',
      contextAddRoleError: 'Tej roli nie ma w grafie.',
      linkPermissionNeeded: 'Brak uprawnień do utworzenia relacji.',
      contextAddData: 'Dodaj dane',
      contextPrepareRecovery: 'Przygotuj klucz odzysku',
      contextClose: 'Zamknij',
      pendingTitle: 'Oczekujące zaproszenia',
      pendingAction: 'Załaduj zaproszenia',
      pendingWorking: 'Ładowanie zaproszeń…',
      pendingError: 'Nie udało się pobrać zaproszeń.',
      pendingEmpty: 'Brak zaproszeń.',
      pendingAccept: 'Akceptuj',
      pendingDataTitle: 'Oczekujące udostępnienia danych',
      pendingDataAction: 'Załaduj udostępnienia',
      pendingDataWorking: 'Ładowanie udostępnień…',
      pendingDataError: 'Nie udało się pobrać udostępnień.',
      pendingDataEmpty: 'Brak udostępnień.',
      parentsTitle: 'Role nadrzędne',
      parentsAction: 'Załaduj rodziców',
      parentsWorking: 'Ładowanie rodziców…',
      parentsError: 'Nie udało się pobrać rodziców.',
      parentsRemoved: 'Relacja z rodzicem usunięta.',
      parentsRemoveAction: 'Usuń',
      verifyTitle: 'Weryfikacja księgi',
      verifyAction: 'Sprawdź podpisy',
      verifyWorking: 'Weryfikacja księgi…',
      verifyError: 'Weryfikacja nie powiodła się.',
      verifyHashOk: 'Łańcuch hashy OK',
      verifyHashIssue: 'Błąd hasha',
      verifySigOk: 'Podpisy OK',
      verifySigIssue: 'Problem z podpisem',
      verifyRoleSigned: 'Podpisy roli: {count}',
      relationNotesTitle: 'Znaczenie relacji',
      relationOwner: 'Owner — pełna kontrola, edycja relacji.',
      relationWrite: 'Write — edycja danych, bez kontroli członków.',
      relationRead: 'Read — tylko odczyt.',
      viewGraph: 'Graf',
      viewDetails: 'Szczegóły',
      cancelAction: 'Anuluj',
      incomingTitle: 'Przychodzące',
      outgoingTitle: 'Wychodzące',
      none: 'Brak'
    }
  },
  footer: {
    headline: 'REcreatio — wspólny ekosystem wiedzy i zaufania',
    contact: 'Kontakt: kontakt@recreatio.pl',
    imprint: 'Impressum i RODO',
    security: 'Dokumentacja bezpieczeństwa'
  },
  loginCard: {
    title: 'REcreatio',
    contextDefault: 'Dostęp przez REcreatio'
  }
};
