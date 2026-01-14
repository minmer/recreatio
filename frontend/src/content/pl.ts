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
    loginCta: 'Zaloguj się przez REcreatio'
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
      persons: 'Osoby',
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
    persons: {
      lead: 'Twórz role osób dla użytkowników korzystających z tego konta. Każda osoba ma osobne pola szyfrowane i listę dostępu.',
      addToggle: 'Dodaj osobę',
      nameLabel: 'Nazwa osoby',
      namePlaceholder: 'Imię i nazwisko lub etykieta',
      descriptionLabel: 'Opis',
      descriptionPlaceholder: 'Relacja lub rola',
      createAction: 'Utwórz osobę',
      createWorking: 'Tworzenie osoby…',
      createSuccess: 'Osoba została utworzona.',
      createError: 'Nie udało się utworzyć osoby.',
      createMissing: 'Nazwa i opis są wymagane.',
      loading: 'Ładowanie osób…',
      empty: 'Brak osób.',
      missingField: 'Brak danych',
      encryptedPlaceholder: 'Zaszyfrowana wartość',
      editToggle: 'Edytuj dane',
      editAction: 'Zapisz dane',
      editCancel: 'Anuluj',
      editWorking: 'Zapisywanie…',
      editSuccess: 'Osoba została zaktualizowana.',
      editError: 'Nie udało się zaktualizować osoby.',
      accessToggle: 'Dostęp',
      accessTitle: 'Lista dostępu',
      accessRefresh: 'Odśwież',
      accessLoading: 'Ładowanie dostępu…',
      accessError: 'Nie udało się pobrać dostępu.',
      accessEmpty: 'Brak przypisanych użytkowników.',
      memberTitle: 'Dodaj użytkownika',
      memberLoginLabel: 'Login użytkownika',
      memberLoginPlaceholder: 'Podaj login',
      memberKeyLabel: 'Zaszyfrowany klucz roli (Base64)',
      memberKeyPlaceholder: 'Wklej kopię zaszyfrowanego klucza',
      memberTypeLabel: 'Rola dostępu',
      memberAction: 'Dodaj dostęp',
      memberWorking: 'Dodawanie użytkownika…',
      memberSuccess: 'Użytkownik został dodany.',
      memberError: 'Nie udało się dodać użytkownika.',
      memberMissing: 'Login i zaszyfrowany klucz są wymagane.',
      memberRolesLabel: 'Inne role',
      memberRolesEmpty: 'Brak ról',
      roleOwner: 'Właściciel',
      roleRead: 'Odczyt',
      roleWrite: 'Zapis',
      roleRecovery: 'Odzysk'
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
