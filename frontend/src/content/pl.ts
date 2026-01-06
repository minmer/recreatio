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
  hero: {
    headline: 'ReCreatio — platforma zaufania i wiedzy wspólnotowej.',
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
    title: 'Dostęp do ReCreatio',
    subtitle: 'Logowanie daje dostęp do funkcji zarządzania, ale portale publiczne są dostępne bez konta.',
    login: 'Logowanie',
    register: 'Rejestracja',
    loginId: 'Login (e-mail lub nazwa)',
    password: 'Hasło',
    confirm: 'Potwierdź hasło',
    displayName: 'Imię i nazwisko (opcjonalnie)',
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
    loginCta: 'Zaloguj się przez ReCreatio'
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
    loginCta: 'Zaloguj się przez ReCreatio'
  },
  faq: {
    title: 'FAQ i bezpieczeństwo',
    items: [
      {
        q: 'Czy moje dane są szyfrowane?',
        a: 'Tak. Dane są szyfrowane kluczami, które wynikają z ról użytkowników. Bez kluczy nie ma dostępu.'
      },
      {
        q: 'Czy serwer zna moje hasło?',
        a: 'Nie. Hasło jest przekształcane lokalnie, a serwer przechowuje tylko bezpieczny weryfikator.'
      },
      {
        q: 'Czy mogę korzystać bez konta?',
        a: 'Tak. Portale publiczne (Parafia i Cogita) mają treści dostępne bez logowania.'
      }
    ]
  },
  legal: {
    title: 'RODO, regulamin i transparentność',
    items: [
      {
        title: 'RODO i polityka prywatności',
        desc:
          'Administratorem danych jest Parafia Rzymskokatolicka pw. św. Jana Chrzciciela w Krakowie, ul. Dobrego Pasterza 117, 31-416 Kraków, Polska, NIP 9451520798, REGON 040098025, e-mail: parafia@janchrzciciel.eu, tel. +48 12 412 58 50.'
      },
      {
        title: 'Regulamin',
        desc: 'Zasady korzystania z platformy, roli administratorów i odpowiedzialności użytkowników.'
      },
      {
        title: 'Impressum',
        desc:
          'Kontakt techniczny: ks. Michael Mleczek, mleczek_pradnik@outlook.com. Hosting: Webio (Hosting Webio), ul. Gwiaździsta 8/52, 66-400 Gorzów Wielkopolski, Polska, NIP 5992688099, REGON 080265578, e-mail: sprzedaz@webio.pl.'
      },
      {
        title: 'Inspektor Ochrony Danych',
        desc:
          'IOD: rodo@diecezja.krakow.pl, tel. +48 12 628 81 00, ul. Franciszkańska 3, 31-004 Kraków, Polska.'
      },
      {
        title: 'Organ nadzoru',
        desc:
          'Kościelny Inspektor Ochrony Danych (KIOD), Skwer kard. Stefana Wyszyńskiego 6, 01–015 Warszawa, e-mail: kiod@episkopat.pl.'
      }
    ]
  },
  account: {
    title: 'Ustawienia profilu',
    subtitle: 'Sekcja dostępna po zalogowaniu.',
    placeholder: 'Wkrótce: zarządzanie danymi osobowymi, rolami, kluczami i historią aktywności.'
  },
  footer: {
    headline: 'ReCreatio — wspólny ekosystem wiedzy i zaufania',
    contact: 'Kontakt: kontakt@recreatio.pl',
    imprint: 'Impressum i RODO',
    security: 'Dokumentacja bezpieczeństwa'
  },
  loginCard: {
    title: 'ReCreatio',
    contextDefault: 'Dostęp przez ReCreatio'
  }
};
