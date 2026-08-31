/**
 * Polnisch — die Hauptsprache der öffentlichen Seite.
 *
 * Die Absätze des Manifests stammen aus der Gründungskarte und dem
 * Satzungsentwurf, die unter `content/local/` liegen und NICHT mitversioniert
 * werden. Übernommen ist daraus, was den ZWECK betrifft; nicht übernommen ist
 * alles Persönliche und Rechtliche — Namen, Anschriften, Beträge, Zustimmungen.
 * Eine Tatsache zu haben ist keine Erlaubnis, sie zu veröffentlichen.
 *
 * Was als `{ missing: … }` steht, ist eine Tatsache, die noch niemand
 * entschieden hat (Abschnitt 7). Bei zweien davon — Namen und Anschrift —
 * stehen die Angaben in den Unterlagen; sie bleiben hier trotzdem offen, weil
 * die Entscheidung über ihre Veröffentlichung nicht mir gehört.
 *
 * Alles andere steht so im Auftrag und ist deshalb echter Text — die
 * Beschreibung des Ośrodek (4.2), die Platzhalterseiten (5) und die Wege der
 * Unterstützung (6) sind dort ausformuliert und mussten nicht erfunden werden.
 */

import type { PublicCopy } from './types';

export const pl: PublicCopy = {
  meta: {
    siteName: 'REcreatio',
    description:
      'REcreatio — inicjatywa rodzinna i duszpasterska na rzecz integralnego rozwoju '
      + 'człowieka. Powstający ośrodek w Limanowej, rekolekcje, formacja, edukacja '
      + 'i wypoczynek.',
    titleSuffix: 'REcreatio'
  },

  nav: {
    manifest: 'REcreatio',
    osrodek: 'Ośrodek',
    wydarzenia: 'Wydarzenia',
    biblioteka: 'Biblioteka',
    cogita: 'Cogita',
    narzedzia: 'Narzędzia',
    wesprzyj: 'Wesprzyj',
    'o-nas': 'O inicjatywie',
    przejrzystosc: 'Przejrzystość',
    kontakt: 'Kontakt',
    menu: 'Menu',
    skipToContent: 'Przejdź do treści',
    signIn: 'Zaloguj się',
    platform: 'Platforma'
  },

  manifest: {
    title: 'REcreatio',
    opening: {
      lead:
        'REcreatio to inicjatywa rodzinna i duszpasterska, która służy integralnemu '
        + 'rozwojowi człowieka — duchowemu, religijnemu, moralnemu, intelektualnemu, '
        + 'psychicznemu, społecznemu i fizycznemu. W samej nazwie mieści się to, o co '
        + 'chodzi: odnowienie, odpoczynek i rekreacja, ponowne odkrywanie człowieka, '
        + 'odnowa duchowa i nowe stworzenie w Chrystusie.',
      inFormation:
        'REcreatio jest inicjatywą w trakcie powstawania — rodzinnym i duszpasterskim '
        + 'przedsięwzięciem, które zamierza w przyszłości przyjąć formę zarejestrowanej '
        + 'fundacji. Dziś fundacja jeszcze nie istnieje i nie prowadzimy zbiórki środków.'
    },

    mission: {
      title: 'Misja',
      body:
        'Człowieka nie da się rozwijać po kawałku. To, co duchowe, i to, co cielesne; '
        + 'to, czego uczy się rozum, i to, czego uczy się serce; samotna modlitwa '
        + 'i wspólna wyprawa — wszystko to należy do jednego życia i tak też jest tutaj '
        + 'traktowane. Stąd porządek, który obowiązuje: życie duchowe, ewangelizacja '
        + 'i kult stanowią fundament, a z niego wyrastają pozostałe cele — rodzina, '
        + 'wychowanie, edukacja, kultura, zdrowie, sport, rekreacja i turystyka. '
        + 'Nie obok siebie, lecz jedno z drugiego.'
    },

    areas: {
      title: 'Sześć obszarów',
      items: [
        {
          name: 'Życie duchowe i wiara',
          body:
            'Rekolekcje, dni skupienia, pielgrzymki, spotkania modlitewne i formacyjne. '
            + 'Praca nad tym, żeby wiara nie była dodatkiem do życia, lecz jego porządkiem.'
        },
        {
          name: 'Rodzina',
          body:
            'Wsparcie małżeństwa, rodziny i więzi między pokoleniami — oraz rodziców '
            + 'w tym, co należy przede wszystkim do nich: w wychowaniu własnych dzieci.'
        },
        {
          name: 'Dzieci i młodzież',
          body:
            'Wychowanie i wszechstronny rozwój: odpowiedzialność, dojrzałość, cnoty, '
            + 'kompetencje społeczne i gotowość do służby. Nie zajęcia na przeczekanie, '
            + 'lecz praca nad charakterem.'
        },
        {
          name: 'Edukacja',
          body:
            'Edukacja, nauka, samokształcenie i praca popularyzatorska; kultura, sztuka '
            + 'i czytelnictwo; działalność wydawnicza i internetowa — książki, kursy, '
            + 'nagrania i portal edukacyjny. Stąd biorą się Biblioteka i Cogita.'
        },
        {
          name: 'Zdrowie i rozwój integralny',
          body:
            'Profilaktyka zdrowia psychicznego, fizycznego i społecznego; '
            + 'przeciwdziałanie uzależnieniom, przemocy, wykluczeniu i samotności. '
            + 'Bez działalności leczniczej — ta wymaga odrębnych uprawnień, których '
            + 'nie mamy i których nie udajemy.'
        },
        {
          name: 'Pielgrzymki, sport i przygoda',
          body:
            'Sport, kultura fizyczna, rekreacja, turystyka i krajoznawstwo; wyprawy '
            + 'piesze i rowerowe, aktywny wypoczynek i bezpieczny kontakt z przyrodą. '
            + 'Droga, którą idzie się razem, uczy tego, czego nie uczy sala.'
        }
      ]
    },

    inspiration: {
      title: 'Inspiracja chrześcijańska i otwartość',
      body:
        'Inspiracją jest Ewangelia, chrześcijańska wizja człowieka i dziedzictwo kultury '
        + 'chrześcijańskiej. Z niej bierze się to, co uznajemy: niezbywalną godność osoby '
        + 'ludzkiej, prymat prawdy i dobra, wolność i odpowiedzialność, miłość bliźniego, '
        + 'solidarność i służbę dobru wspólnemu. Działania są przy tym otwarte dla '
        + 'wszystkich, niezależnie od wyznania i światopoglądu. Kto wierzy, może wiarę '
        + 'pogłębić. Kto szuka, może pytać. Kto nie wierzy, jest przyjęty z tym samym '
        + 'szacunkiem. Udział pozostaje dobrowolny, a tożsamość chrześcijańska nie jest '
        + 'przy tym ukrywana — jedno nie wyklucza drugiego.'
    },

    family: {
      title: 'Zakorzenienie w rodzinie',
      body:
        'Rzecz wyrasta z jednej rodziny i z odpowiedzialności za ciągłość tego, co '
        + 'zostało zaczęte. Nie chodzi jednak o „fundację rodzinną” w znaczeniu prawnym '
        + 'ani o instytucję kościelną: docelowo ma to być rodzinny, świecki podmiot prawa '
        + 'cywilnego, który współpracuje z parafiami i wspólnotami, zachowując własną '
        + 'autonomię. Rodzina jest punktem wyjścia, nie zamknięciem — dom otwiera się dla '
        + 'innych, i w tym mieści się sens całego przedsięwzięcia.'
    },

    road: {
      title: 'Dokąd to zmierza',
      intro:
        'Kolejność nie jest przypadkowa. Najpierw musi stanąć dom, bo bez miejsca reszta '
        + 'zostaje planem.',
      steps: [
        'Najpierw dom.',
        'Własne rekolekcje i wydarzenia.',
        'Otwarcie przestrzeni dla innych wspólnot.',
        'Pielgrzymki oraz wydarzenia sportowo-formacyjne.',
        'Materiały edukacyjne.',
        'Działalność wydawnicza.',
        'Portal edukacyjny.',
        'Projekty dla dzieci, młodzieży i rodzin.'
      ]
    },

    closing: ['Odnowić.', 'Odpocząć.', 'Wzrastać.', 'Spotkać.']
  },

  about: {
    title: 'O inicjatywie',
    lead:
      'REcreatio nie jest jeszcze fundacją. Ta strona mówi wprost, czym jest dzisiaj '
      + 'i co musi się wydarzyć, zanim będzie czymś więcej.',
    whatInitiativeMeans: {
      title: 'Co znaczy „inicjatywa w trakcie powstawania”',
      body:
        'Nie istnieje osoba prawna: nie ma numeru KRS ani NIP, nie ma zarządu, statutu '
        + 'ani statusu organizacji pożytku publicznego. Działania prowadzone są '
        + 'nieformalnie, przez rodzinę i osoby z nią współpracujące. Wszystko, co czytasz '
        + 'na tej stronie, opisuje zamiar i to, co realnie istnieje — nie strukturę prawną.'
    },
    family: {
      title: 'Rodzina, nie „fundacja rodzinna”',
      body:
        'Inicjatywa wyrasta z jednej rodziny i z poczucia odpowiedzialności za ciągłość '
        + 'tego, co zostało zaczęte. To nie jest „fundacja rodzinna” w znaczeniu prawnym — '
        + 'to zwykłe stwierdzenie, skąd rzecz pochodzi i kto za nią dziś odpowiada.'
    },
    road: {
      title: 'Droga do formy prawnej',
      body:
        'Rejestracja fundacji jest zamiarem, nie faktem. Dopóki nie nastąpi, na tej '
        + 'stronie nie pojawi się numer rejestrowy, konto do wpłat ani apel o darowizny. '
        + 'Kiedy nastąpi, zmieni się treść tej strony — nie jej budowa.'
    },
    people: {
      title: 'Kto za tym stoi',
      body: { missing: 'Imiona i nazwiska osób oraz zgoda na ich publikację' }
    }
  },

  transparency: {
    title: 'Przejrzystość',
    lead:
      'Jak rozdzielone są sprawy: działalność inicjatywy i prywatny majątek osób, '
      + 'które ją prowadzą, to dwie różne rzeczy. Opisujemy to w czasie teraźniejszym '
      + 'i tylko w takim zakresie, w jakim jest to dziś prawdą.',
    separation: {
      title: 'Działalność a majątek prywatny',
      body:
        'Działania inicjatywy oraz prywatny majątek założycieli pozostają rozdzielone. '
        + 'Inicjatywa nie jest właścicielem nieruchomości ani innego majątku — nie ma '
        + 'osobowości prawnej, więc nie może nim być.'
    },
    house: {
      title: 'Dom',
      body:
        'Dom w Limanowej pozostaje własnością prywatną i nie jest wnoszony do przyszłej '
        + 'fundacji — nie jest darowizną ani wkładem. Po ewentualnej rejestracji byłby '
        + 'udostępniany na podstawie umowy najmu na warunkach rynkowych. Zasada, którą '
        + 'przyjmujemy z góry: każda umowa z osobą bliską wymaga zgody organu '
        + 'kontrolnego, udokumentowania warunków rynkowych i podpisania przez osobę '
        + 'przez ten organ wskazaną, a nakłady poczynione na prywatną nieruchomość '
        + 'wymagają odrębnego rozliczenia. Piszemy to teraz, a nie wtedy, gdy zacznie '
        + 'to być wygodne.'
    },
    notYet: {
      title: 'Czego jeszcze nie ma',
      body:
        'Nie prowadzimy odrębnej księgowości inicjatywy, nie mamy statusu organizacji '
        + 'pożytku publicznego i nie podlegamy audytowi. Piszemy to wprost, ponieważ '
        + 'brak takiego zdania czytałoby się jako sugestia, że jest inaczej.'
    }
  },

  contact: {
    title: 'Kontakt',
    lead: 'Najprostsza droga to poczta elektroniczna. Odpowiada człowiek, nie formularz.',
    email: 'kontakt@recreatio.pl',
    address: { missing: 'Adres pocztowy i decyzja, czy może być publikowany przed otwarciem' },
    people: { missing: 'Osoby do kontaktu i zgoda na publikację nazwisk' }
  },

  osrodek: {
    title: 'Ośrodek w Limanowej',
    underConstruction:
      'Ośrodek jest w budowie. Nie przyjmujemy jeszcze gości — poniżej opisujemy, '
      + 'czym ma być i dla kogo, żeby grupy mogły planować z wyprzedzeniem.',
    purpose: {
      title: 'Do czego służy',
      body:
        'Rekolekcje, dni skupienia, formacja, edukacja i wypoczynek — w jednym miejscu '
        + 'i bez rozdzielania tych rzeczy od siebie.'
    },
    capacity: {
      title: 'Ile osób',
      body: 'Około 52 osoby. Ośrodek pomyślany jest przede wszystkim dla grup.',
      exact: { missing: 'Potwierdzenie, czy docelowa liczba miejsc to dokładnie 52' },
      groups: [
        'grupy rekolekcyjne',
        'parafialne',
        'ministranckie',
        'młodzieżowe',
        'harcerskie',
        'rodzinne',
        'szkolne',
        'formacyjne',
        'sportowe i turystyczne'
      ]
    },
    character: {
      title: 'Charakter miejsca',
      body:
        'Prosto, gościnnie i żywo — miejsce, w którym można się modlić, pracować, '
        + 'rozmawiać, uczyć się, odpoczywać i po prostu być razem.'
    },
    facilities: {
      title: 'Co jest na miejscu',
      items: [
        'miejsca noclegowe',
        'przestrzeń wspólna',
        'jadalnia',
        'kuchnia, z której grupa może korzystać samodzielnie'
      ]
    },
    openToOthers: {
      title: 'Nie tylko dla nas',
      body: 'Ośrodek nie służy wyłącznie własnym projektom inicjatywy. Zapraszamy również:',
      items: [
        'parafie',
        'wspólnoty Ruchu Światło–Życie',
        'grupy ministranckie',
        'duszpasterstwa',
        'harcerstwo',
        'szkoły',
        'organizacje społeczne',
        'rodziny',
        'inicjatywy młodzieżowe'
      ]
    },
    supports: {
      title: 'Dlaczego odpłatnie',
      body:
        'Udostępnianie domu za opłatą wspiera pozostałe działania inicjatywy. '
        + 'Mówimy o tym wprost, bo tak jest.'
    },
    where: {
      title: 'Gdzie',
      address: { missing: 'Adres ośrodka i decyzja, czy publikować go przed otwarciem' }
    },
    photos: { missing: 'Zdjęcia domu, okolicy i wcześniejszych wydarzeń' },

    availability: {
      title: 'Wolne terminy',
      intro: 'Które okresy są jeszcze wolne.',
      showsNothingElse:
        'Ta lista pokazuje wyłącznie, czy termin jest wolny czy zajęty. Nie pokazuje, '
        + 'kto przyjeżdża, w jakim celu ani jak się z kimkolwiek skontaktować — '
        + 'i nie będzie tego pokazywać.',
      free: 'wolne',
      held: 'wstępnie zarezerwowane',
      taken: 'zajęte',
      loading: 'Sprawdzamy terminy…',
      unreachable:
        'Nie udało się pobrać terminów. To nie znaczy, że są zajęte — spróbuj ponownie '
        + 'albo napisz do nas.',
      noAccountNeeded: 'Podgląd terminów nie wymaga konta.',
      month: 'Miesiąc',
      nothingPlanned: 'W tym miesiącu nie ma jeszcze żadnych zajętych terminów.'
    },

    enquiry: {
      title: 'Zapytanie o termin',
      intro: 'Wypełnij formularz, a odpiszemy.',
      brokeredNotBooked:
        'To zapytanie, nie rezerwacja. Nie pobieramy opłat ani zaliczki i nie zawieramy '
        + 'umowy przez tę stronę — na zgłoszenie odpowiada człowiek i dopiero wtedy '
        + 'ustalamy szczegóły.',
      groupName: 'Nazwa grupy',
      contactPerson: 'Osoba do kontaktu',
      contact: 'Telefon lub e-mail',
      from: 'Termin od',
      to: 'Termin do',
      people: 'Liczba osób',
      groupKind: 'Rodzaj grupy',
      note: 'Uwagi',
      submit: 'Wyślij zapytanie',
      sending: 'Wysyłamy…',
      sent: 'Zapytanie wysłane.',
      sentBody: 'Odpiszemy na podany kontakt. Nie musisz nic więcej robić.',
      failed:
        'Nie udało się wysłać zapytania. Spróbuj ponownie albo napisz '
        + 'na kontakt@recreatio.pl.',
      sealedNote:
        'Dane z formularza zapisujemy w postaci zaszyfrowanej. Odczytać je może tylko '
        + 'osoba prowadząca ośrodek — nie serwer i nie my „na wszelki wypadek”.',
      required: 'To pole jest wymagane.'
    }
  },

  wesprzyj: {
    title: 'Wesprzyj',
    lead:
      'Można pomóc na kilka sposobów. Żaden z nich nie polega dziś na przekazaniu pieniędzy.',
    ways: [
      {
        name: 'Wolontariat',
        body: 'Praca przy domu, pomoc przy wydarzeniach, obecność wtedy, gdy potrzeba rąk.'
      },
      {
        name: 'Wiedza i umiejętności',
        body:
          'Doświadczenie zawodowe, którym można się podzielić — budowlane, prawne, '
          + 'edukacyjne, techniczne.'
      },
      {
        name: 'Współorganizacja wydarzeń',
        body:
          'Rekolekcje, pielgrzymki, wyprawy i wydarzenia sportowo-formacyjne '
          + 'przygotowywane razem.'
      },
      {
        name: 'Korzystanie z domu',
        body:
          'Kiedy ośrodek zostanie otwarty, przyjazd z grupą będzie sam w sobie wsparciem '
          + 'dla pozostałych działań.'
      },
      {
        name: 'Modlitwa',
        body:
          'Wymieniona tu nie z grzeczności — dla inicjatywy o tym charakterze jest to '
          + 'realne wsparcie.'
      }
    ],
    financialLater:
      'Wsparcie finansowe zostanie zorganizowane dopiero wtedy, gdy inicjatywa przyjmie '
      + 'formę prawną. Do tego czasu nie zbieramy darowizn i nie podajemy numeru konta.'
  },

  placeholders: {
    wydarzenia: {
      title: 'Wydarzenia',
      body:
        'Rekolekcje, pielgrzymki piesze i rowerowe, wyprawy oraz wydarzenia '
        + 'sportowo-formacyjne. Tutaj znajdą się zapisy i szczegóły.',
      preparing: 'Ta część jest przygotowywana.'
    },
    biblioteka: {
      title: 'Biblioteka',
      body:
        'Spis wydanych książek wraz z informacjami, które pomagają z nich korzystać. '
        + 'Jest to również źródło cytatów, z którego korzysta Cogita.',
      preparing: 'Ta część jest przygotowywana.'
    },
    cogita: {
      title: 'Cogita',
      body: 'Środowisko do nauki: storyboardy, teksty, zbiory i powtórki.',
      preparing: 'Ta część jest przygotowywana.'
    },
    narzedzia: {
      title: 'Narzędzia',
      body:
        'Wspólne moduły — kalendarz, czat, obłożenie, formularze — z których inne '
        + 'wspólnoty będą mogły korzystać na własnych stronach.',
      preparing: 'Ta część jest przygotowywana.'
    }
  },

  notFound: {
    title: 'Nie ma takiej strony',
    body: 'Adres, pod który trafiłeś, nie istnieje. Być może link jest już nieaktualny.',
    back: 'Wróć na stronę główną'
  },

  footer: {
    logoAlt: 'REcreatio',
    initiative: 'Inicjatywa w trakcie powstawania.',
    platform: 'Platforma'
  },

  factNeeded: 'Brakująca informacja',
  sourceTextNeeded: 'Tekst źródłowy'
};
