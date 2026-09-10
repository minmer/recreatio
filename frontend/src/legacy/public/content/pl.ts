/**
 * Polnisch — die Hauptsprache der öffentlichen Seite.
 *
 * <b>Kurz und konkret.</b> Die erste Fassung war zu lang und las sich
 * geschrieben: Antithesen („nicht X, sondern Y"), Sinnsprüche am Absatzende,
 * Sätze, die etwas Allgemeines behaupten. Was hier steht, soll Tatsachen
 * nennen — Zahlen, Namen, was wirklich geschieht.
 *
 * Die Absätze stammen aus der Gründungskarte und dem Satzungsentwurf unter
 * `content/local/`, die NICHT mitversioniert werden. Übernommen ist daraus,
 * was den ZWECK betrifft; Namen, Anschriften, Beträge und Zustimmungen sind es
 * nicht. Eine Tatsache zu haben ist keine Erlaubnis, sie zu veröffentlichen.
 *
 * Was als `{ missing: … }` steht, ist eine Tatsache, die noch niemand
 * entschieden hat. Bei zweien — Namen und Anschrift — stehen die Angaben in
 * den Unterlagen; sie bleiben trotzdem offen, weil die Entscheidung über ihre
 * Veröffentlichung nicht mir gehört.
 */

import type { PublicCopy } from './types';

export const pl: PublicCopy = {
  meta: {
    siteName: 'REcreatio',
    description:
      'REcreatio — inicjatywa rodzinna i duszpasterska z Limanowej. Powstający ośrodek '
      + 'na 52 osoby, pielgrzymki, rekolekcje, formacja i narzędzia edukacyjne.',
    titleSuffix: 'REcreatio'
  },

  nav: {
    front: 'Start',
    recreatio: 'REcreatio',
    'o-nas': 'O inicjatywie',
    bezpieczenstwo: 'Bezpieczeństwo',
    przejrzystosc: 'Przejrzystość',
    kontakt: 'Kontakt',
    osrodek: 'Ośrodek',
    wydarzenia: 'Wydarzenia',
    biblioteka: 'Biblioteka',
    cogita: 'Cogita',
    narzedzia: 'Narzędzia',
    wesprzyj: 'Wesprzyj',

    menu: 'Menu',
    skipToContent: 'Przejdź do treści',
    signIn: 'Zaloguj się',
    register: 'Rejestracja',
    access: 'Dostęp',
    platform: 'Platforma',
    account: 'Konto',
    lock: 'Zablokuj klucze',
    signOut: 'Wyloguj',
    more: 'Więcej'
  },

  front: {
    screen1: {
      wordmark: 'REcreatio',
      sentence: 'Inicjatywa starająca się o integralny rozwój człowieka',
      hint: 'Przewiń'
    },

    scenes: [
      {
        label: 'Człowiek jest całością',
        bubbles: [
          { kind: 'title', lines: ['Człowiek jest całością'] },
          {
            kind: 'body',
            lines: [
              'Nie rozwijamy się osobno duchowo, intelektualnie, emocjonalnie czy '
              + 'fizycznie. To wszystko spotyka się w jednym człowieku i w jednym życiu. '
              + 'Dlatego REcreatio chce tworzyć okazje do wzrostu w różnych wymiarach — '
              + 'przez formację, rozmowę, pracę, naukę, ruch, odpoczynek, kulturę '
              + 'i modlitwę.'
            ]
          },
          {
            kind: 'close',
            lines: ['Nie kolejna dziedzina życia.', 'Bardziej ludzkie życie jako całość.']
          },
          { kind: 'note', lines: ['w sobie · we wspólnocie · z Bogiem'] }
        ]
      },
      {
        label: 'Człowiek potrzebuje człowieka',
        bubbles: [
          { kind: 'title', lines: ['Człowiek potrzebuje człowieka'] },
          {
            kind: 'body',
            lines: [
              'Nie chcemy tworzyć kolejnego miejsca, które zatrzymuje człowieka przed '
              + 'ekranem. Chcemy wykorzystywać współczesne możliwości, aby łatwiej było '
              + 'się spotkać, coś razem zorganizować, uczyć się, wyruszyć w drogę, '
              + 'przeczytać dobrą książkę czy zbudować wspólnotę.',

              'Wracamy do rzeczy podstawowych — relacji, odpowiedzialności, dobrej '
              + 'rozmowy, wspólnej pracy, odpoczynku i modlitwy — korzystając z narzędzi '
              + 'współczesnego świata tam, gdzie rzeczywiście pomagają.'
            ]
          },
          {
            kind: 'close',
            lines: ['Narzędzia mają prowadzić do życia.', 'Nie życie do narzędzi.']
          }
        ]
      },
      {
        label: 'Twoje dane są twoje',
        bubbles: [
          { kind: 'title', lines: ['Twoje dane są twoje'] },
          {
            kind: 'body',
            lines: [
              'Nie chcemy budować systemu, który wie o człowieku więcej, niż naprawdę '
              + 'potrzebuje.',

              'REcreatio ma zbierać tylko te dane, które są konieczne do działania '
              + 'konkretnej funkcji. Dostęp do informacji powinny mieć tylko osoby, '
              + 'którym został on rzeczywiście nadany — nie jeden administrator, który '
              + 'z definicji może zobaczyć wszystko.',

              'Nie chcemy śledzić użytkowników ani tworzyć ich profili na podstawie '
              + 'aktywności. Bezpieczeństwo i prywatność mają wynikać ze sposobu, w jaki '
              + 'system jest zbudowany, a nie tylko z regulaminu.'
            ]
          },
          {
            kind: 'close',
            lines: [
              'Mniej danych.',
              'Mniej śledzenia.',
              'Mniej zbędnego dostępu.',
              '',
              'Więcej kontroli po stronie człowieka.',
              '',
              'Prywatność przez ograniczenie.',
              'Nie przez obietnicę.'
            ]
          }
        ]
      }
    ],

    screen3: {
      title: 'Jak to się dzieje',
      stages: 'Te części są na różnych etapach.',
      works: [
        {
          name: 'Hortus Dei',
          body:
            'Dom w Limanowej, w budowie, na około 52 osoby. Rekolekcje, dni skupienia, '
            + 'formacja, edukacja i wypoczynek. Pomyślany dla grup — parafii, wspólnot, '
            + 'ministrantów, duszpasterstw, harcerstwa, szkół, rodzin i inicjatyw '
            + 'młodzieżowych.',
          cta: 'Zobacz ośrodek'
        },
        {
          name: 'Wydarzenia',
          body:
            'Rekolekcje, pielgrzymki piesze i rowerowe, wyprawy oraz wydarzenia '
            + 'sportowo-formacyjne. Wysiłek, modlitwa, przyroda, rozmowa i przekraczanie '
            + 'własnych granic.',
          cta: 'Zobacz wydarzenia'
        },
        {
          name: 'Cogita',
          body: 'Środowisko do nauki: teksty, storyboardy, zbiory i powtórki.',
          cta: 'Zobacz Cogitę'
        },
        {
          name: 'I dalej',
          body:
            'Działalność wydawnicza i spis książek, materiały edukacyjne, portal '
            + 'edukacyjny oraz projekty dla dzieci, młodzieży i rodzin.',
          cta: 'Zobacz bibliotekę'
        }
      ]
    }
  },

  manifest: {
    title: 'REcreatio',
    opening: {
      lead:
        'Inicjatywa rodzinna i duszpasterska z Limanowej. Nazwa mówi, o co chodzi: '
        + 'odnowienie, odpoczynek i rekreacja, ponowne odkrywanie człowieka, odnowa '
        + 'duchowa i nowe stworzenie w Chrystusie.',
      inFormation:
        'Fundacja jeszcze nie istnieje. Nie ma numeru KRS, zarządu ani statutu, '
        + 'nie zbieramy darowizn i nie podajemy numeru konta.'
    },

    mission: {
      title: 'Misja',
      body:
        'Rozwój człowieka w całości: duchowy, religijny, moralny, intelektualny, '
        + 'psychiczny, społeczny i fizyczny. Podstawą jest życie duchowe; z niego '
        + 'wynikają rodzina, wychowanie, edukacja, kultura, zdrowie, sport i turystyka.'
    },

    areas: {
      title: 'Sześć obszarów',
      items: [
        {
          name: 'Życie duchowe i wiara',
          body: 'Rekolekcje, dni skupienia, pielgrzymki, spotkania modlitewne i formacyjne.'
        },
        {
          name: 'Rodzina',
          body: 'Wsparcie małżeństw, więzi międzypokoleniowych i rodziców w wychowaniu dzieci.'
        },
        {
          name: 'Dzieci i młodzież',
          body: 'Formacja, obozy i wyprawy. Odpowiedzialność, dojrzałość, kompetencje społeczne.'
        },
        {
          name: 'Edukacja',
          body: 'Kursy, materiały, wydawnictwa i portal edukacyjny. Stąd Cogita i Biblioteka.'
        },
        {
          name: 'Zdrowie i rozwój integralny',
          body:
            'Profilaktyka zdrowia psychicznego, fizycznego i społecznego. Bez działalności '
            + 'leczniczej — na to trzeba odrębnych uprawnień.'
        },
        {
          name: 'Pielgrzymki, sport i przygoda',
          body: 'Wyprawy piesze i rowerowe, sport, rekreacja, turystyka i krajoznawstwo.'
        }
      ]
    },

    inspiration: {
      title: 'Inspiracja chrześcijańska i otwartość',
      body:
        'Inspiracją jest Ewangelia i chrześcijańska wizja człowieka: godność osoby, '
        + 'prymat prawdy, wolność i odpowiedzialność, miłość bliźniego, służba dobru '
        + 'wspólnemu. Udział jest otwarty dla wszystkich, niezależnie od wyznania '
        + 'i światopoglądu, i dobrowolny. Tożsamości chrześcijańskiej przy tym nie '
        + 'ukrywamy.'
    },

    family: {
      title: 'Zakorzenienie w rodzinie',
      body:
        'Przedsięwzięcie prowadzi jedna rodzina. Docelowo ma to być rodzinny, świecki '
        + 'podmiot prawa cywilnego — nie instytucja kościelna i nie „fundacja rodzinna” '
        + 'w znaczeniu prawnym. Współpraca z parafiami i wspólnotami, przy zachowaniu '
        + 'własnej autonomii.'
    },

    road: {
      title: 'Dokąd to zmierza',
      intro: 'Najpierw dom. Bez miejsca reszta zostaje planem.',
      steps: [
        'Dom w Limanowej.',
        'Własne rekolekcje i wydarzenia.',
        'Otwarcie ośrodka dla innych wspólnot.',
        'Pielgrzymki i wydarzenia sportowo-formacyjne.',
        'Materiały edukacyjne.',
        'Działalność wydawnicza.',
        'Portal edukacyjny.',
        'Projekty dla dzieci, młodzieży i rodzin.'
      ]
    },

    closing: ['Odnowić.', 'Odpocząć.', 'Wzrastać.', 'Spotkać.']
  },

  security: {
    title: 'Bezpieczeństwo i dlaczego tak',
    lead:
      'Narzędzia REcreatio są zbudowane inaczej niż większość. Poniżej wprost, na czym '
      + 'ta różnica polega i czego ona kosztuje.',

    points: [
      {
        q: 'Nie ma administratora',
        a:
          'Nikt po naszej stronie nie może otworzyć twoich treści. Klucze powstają na '
          + 'twoim urządzeniu; serwer ich nie zna. Kto wykradłby całą bazę, dostałby '
          + 'zaszyfrowane bloki i daty.'
      },
      {
        q: 'Hasła nie da się zresetować — ale da się odzyskać konto',
        a:
          'Hasło nie opuszcza urządzenia. Wychodzi z niego tylko klucz wyliczony przez '
          + 'Argon2id, po 64 MiB pamięci na jedno wyliczenie. Serwer nie zna hasła, więc '
          + 'nie może go zmienić — żaden e-mail „ustaw nowe hasło” nie jest możliwy. '
          + 'Odzyskanie działa inaczej: wskazujesz kilku poręczycieli. Każdy trzyma jeden '
          + 'udział, zaszyfrowany własnym kluczem. Gdy wystarczająco wielu przekaże swój '
          + 'udział, konto wraca. Jeden poręczyciel nie wystarczy, a pojedynczy udział '
          + 'nic nie znaczy.'
      },
      {
        q: 'Narzędzia są publiczne, ale wejście prowadzi przez adres',
        a:
          'Nie ma katalogu ani wyszukiwarki wspólnot. Adres wygląda tak: '
          + '/parish/limanowa, /cogita/nazwa-biblioteki. Kto zna adres, wchodzi; kto nie '
          + 'zna, nie natrafi na niego przeglądając. Sam adres nie otwiera treści '
          + 'zaszyfrowanych — daje dostęp do tego, co i tak jest jawne, na przykład do '
          + 'planu mszy w gablocie.'
      },
      {
        q: 'Nie podajesz danych — udostępniasz swoje',
        a:
          'Nie prosimy o dane po to, żeby je przechowywać. Ty trzymasz swoje, a innym '
          + 'udostępniasz wybrany fragment. Udostępnienie da się cofnąć. Ograniczenie, '
          + 'które mówimy wprost: cofnięcie działa od chwili cofnięcia. Kto miał dostęp '
          + 'wcześniej, mógł już przeczytać, a tego nie cofnie żaden przycisk. Nowe '
          + 'wpisy są od tego momentu zamknięte dla niego; przeszłość zostaje '
          + 'przeszłością. Obiecywanie czegoś innego byłoby kłamstwem.'
      }
    ],

    originTitle: 'Skąd biorą się te narzędzia',
    origin:
      'Żadne nie powstało jako produkt na sprzedaż. Każde powstało przy konkretnej '
      + 'pracy, w której czegoś zabrakło: plan mszy z intencjami, lista kandydatów do '
      + 'bierzmowania, zapisy na pielgrzymkę, kalendarz sal. Dlatego są takie, jakie są '
      + '— i dlatego ich układ mówi coś o samej inicjatywie: rzeczy powstają tu z '
      + 'potrzeby, a nie odwrotnie. Kto zrobi je dobrze raz, może udostępnić je innym '
      + 'wspólnotom, i tak też robimy.',

    toolsTitle: 'Narzędzia po kolei',
    toolsIntro: 'Co robi każde z nich i co przy tym widać, a czego nie.',
    tools: [
      {
        name: 'Czat',
        body:
          'Rozmowa w grupie. Kto dołącza dziś, nie widzi tego, co napisano wcześniej — '
          + 'chyba że ktoś świadomie da mu klucz do przeszłości. Odejście kogoś zamyka '
          + 'epokę: dalsze wiadomości są dla niego nieczytelne.'
      },
      {
        name: 'Kalendarz',
        body:
          'Czas jest jawny, treść nie. Widać, że ktoś jest zajęty we wtorek o 10; nie '
          + 'widać, czym. Dzięki temu da się szukać wolnych terminów, nie pokazując '
          + 'nikomu, co się dzieje.'
      },
      {
        name: 'Obłożenie',
        body:
          'To samo dla sal i domów: wolne albo zajęte, bez nazwy grupy i bez kontaktu. '
          + 'Widoczne bez konta, żeby grupa mogła sprawdzić lipiec i nie zakładać nic '
          + 'po drodze.'
      },
      {
        name: 'Formularze',
        body:
          'Zapisy i zgłoszenia. Wysyłane otwarcie, zapisywane w postaci zaszyfrowanej — '
          + 'szyfruje przeglądarka, zanim cokolwiek wyjdzie z urządzenia. Odczytać może '
          + 'tylko osoba prowadząca.'
      },
      {
        name: 'Parafia',
        body:
          'Plan mszy i intencje. Jedna linijka bywa jednocześnie jawna i wewnętrzna: '
          + '„w pewnej intencji” w gablocie, a wewnątrz — w jakiej i od kogo.'
      },
      {
        name: 'Cogita',
        body:
          'Nauka: storyboardy, teksty, zbiory, powtórki i sesje na żywo. Treści bywają '
          + 'publiczne; klucze pozostają prywatne.'
      }
    ]
  },

  about: {
    title: 'O inicjatywie',
    lead: 'Czym REcreatio jest dzisiaj i czego jeszcze nie ma.',
    whatInitiativeMeans: {
      title: 'Inicjatywa, nie fundacja',
      body:
        'Nie istnieje osoba prawna: brak numeru KRS i NIP, zarządu, statutu i statusu '
        + 'OPP. Działania prowadzi rodzina i osoby z nią współpracujące. Rejestracja '
        + 'fundacji jest zamiarem; do tego czasu na tej stronie nie pojawi się numer '
        + 'rejestrowy ani konto do wpłat.'
    },
    family: {
      title: 'Rodzina',
      body:
        'Przedsięwzięcie wyrasta z jednej rodziny i z odpowiedzialności za jego dalszy '
        + 'ciąg. Docelowa forma to rodzinny, świecki podmiot prawa cywilnego, '
        + 'współpracujący z parafiami i wspólnotami przy zachowaniu autonomii.'
    },
    road: {
      title: 'Co musi się wydarzyć',
      body:
        'Dokumenty założycielskie, pisemna zgoda władzy kościelnej, obsługa księgowa '
        + 'i akt notarialny. Dopiero potem rejestracja. Status OPP wymaga osobno '
        + 'spełnionych warunków ustawowych i niezależnej komisji rewizyjnej.'
    },
    people: {
      title: 'Kto za tym stoi',
      body: { missing: 'Imiona i nazwiska osób oraz zgoda na ich publikację' }
    }
  },

  transparency: {
    title: 'Przejrzystość',
    lead: 'Jak rozdzielone są działalność inicjatywy i prywatny majątek osób, które ją prowadzą.',
    separation: {
      title: 'Działalność a majątek prywatny',
      body:
        'Inicjatywa nie ma osobowości prawnej, więc nie jest właścicielem nieruchomości '
        + 'ani innego majątku. Majątek prywatny założycieli pozostaje odrębny.'
    },
    house: {
      title: 'Dom',
      body:
        'Dom w Limanowej pozostaje własnością prywatną i nie jest wnoszony do przyszłej '
        + 'fundacji — ani jako darowizna, ani jako wkład. Po ewentualnej rejestracji '
        + 'byłby wynajmowany na warunkach rynkowych. Zasada przyjęta z góry: umowa '
        + 'z osobą bliską wymaga zgody organu kontrolnego, udokumentowanych warunków '
        + 'rynkowych i podpisu osoby przez ten organ wskazanej; nakłady na prywatną '
        + 'nieruchomość rozlicza się odrębnie.'
    },
    notYet: {
      title: 'Czego jeszcze nie ma',
      body:
        'Nie prowadzimy odrębnej księgowości, nie mamy statusu OPP i nie podlegamy '
        + 'audytowi. Piszemy to wprost, bo brak takiego zdania czytałoby się odwrotnie.'
    }
  },

  contact: {
    title: 'Kontakt',
    email: 'mleczek_grzegorzki@outlook.com',
    address: 'ul. Żuławskiego 3E\n34-600 Limanowa',
    people: 'ks. Michał Mleczek'
  },

  osrodek: {
    title: 'Ośrodek w Limanowej',
    underConstruction:
      'Ośrodek jest w budowie i nie przyjmuje jeszcze gości. Poniżej to, co już wiadomo, '
      + 'żeby grupy mogły planować z wyprzedzeniem.',
    purpose: {
      title: 'Do czego służy',
      body: 'Rekolekcje, dni skupienia, formacja, edukacja i wypoczynek.'
    },
    capacity: {
      title: 'Ile osób',
      body: 'Około 52 osoby, przede wszystkim grupy.',
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
      body: 'Prosto i gościnnie: modlitwa, praca, nauka, rozmowa i odpoczynek w jednym miejscu.'
    },
    facilities: {
      title: 'Co jest na miejscu',
      items: [
        'miejsca noclegowe',
        'przestrzeń wspólna',
        'jadalnia',
        'kuchnia do samodzielnego użytku grupy'
      ]
    },
    openToOthers: {
      title: 'Nie tylko dla nas',
      body: 'Ośrodek nie służy wyłącznie własnym projektom. Zapraszamy również:',
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
      body: 'Wynajem domu finansuje pozostałe działania inicjatywy.'
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
        'Lista pokazuje wyłącznie: wolne albo zajęte. Nie pokazuje, kto przyjeżdża, '
        + 'w jakim celu ani jak się z kimkolwiek skontaktować.',
      free: 'wolne',
      held: 'wstępnie zarezerwowane',
      taken: 'zajęte',
      loading: 'Sprawdzamy terminy…',
      unreachable:
        'Nie udało się pobrać terminów. To nie znaczy, że są zajęte — spróbuj ponownie '
        + 'albo napisz.',
      noAccountNeeded: 'Podgląd terminów nie wymaga konta.',
      month: 'Miesiąc',
      nothingPlanned: 'W tym miesiącu nie ma jeszcze zajętych terminów.'
    },

    enquiry: {
      title: 'Zapytanie o termin',
      intro: 'Wypełnij formularz, odpiszemy.',
      brokeredNotBooked:
        'To zapytanie, nie rezerwacja. Nie pobieramy opłat ani zaliczki i nie zawieramy '
        + 'umowy przez tę stronę.',
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
      sentBody: 'Odpiszemy na podany kontakt.',
      failed:
        'Nie udało się wysłać zapytania. Spróbuj ponownie albo napisz '
        + 'na mleczek_grzegorzki@outlook.com.',
      sealedNote:
        'Formularz szyfruje dane w przeglądarce, zanim wyjdą z urządzenia. Odczyta je '
        + 'tylko osoba prowadząca ośrodek.',
      required: 'To pole jest wymagane.'
    }
  },

  wesprzyj: {
    title: 'Wesprzyj',
    lead: 'Żaden z tych sposobów nie polega dziś na przekazaniu pieniędzy.',
    ways: [
      { name: 'Wolontariat', body: 'Praca przy domu i pomoc przy wydarzeniach.' },
      {
        name: 'Wiedza i umiejętności',
        body: 'Doświadczenie budowlane, prawne, edukacyjne lub techniczne.'
      },
      {
        name: 'Współorganizacja wydarzeń',
        body: 'Rekolekcje, pielgrzymki, wyprawy i wydarzenia sportowo-formacyjne.'
      },
      {
        name: 'Korzystanie z domu',
        body: 'Po otwarciu ośrodka przyjazd z grupą finansuje pozostałe działania.'
      },
      { name: 'Modlitwa', body: 'Wymieniona tu nie z grzeczności.' }
    ],
    financialLater:
      'Wsparcie finansowe zostanie zorganizowane po uzyskaniu formy prawnej. Do tego '
      + 'czasu nie zbieramy darowizn i nie podajemy numeru konta.'
  },

  placeholders: {
    wydarzenia: {
      title: 'Wydarzenia',
      body:
        'Pielgrzymki piesze i rowerowe, wyprawy, rekolekcje i wydarzenia '
        + 'sportowo-formacyjne. Tutaj znajdą się zapisy i szczegóły.',
      preparing: 'Ta część jest przygotowywana.'
    },
    biblioteka: {
      title: 'Biblioteka',
      body:
        'Spis wydanych książek z informacjami, które pomagają z nich korzystać. '
        + 'Także źródło cytatów dla Cogity.',
      preparing: 'Ta część jest przygotowywana.'
    },
    cogita: {
      title: 'Cogita',
      body: 'Środowisko do nauki: storyboardy, teksty, zbiory i powtórki.',
      preparing: 'Ta część jest przygotowywana.'
    }
  },

  tools: {
    title: "Narzędzia",
    lead: "REcreatio buduje dla siebie narzędzia, które są jej potrzebne — ale udostępnia je także innym.",
    noneYet: "Jeszcze nic tu nie działa.",
    embedded: "Część innego narzędzia.",
    items: [
      {
        name: "Parafia",
        body: "Pełnoprawna strona internetowa dla parafii — msze, intencje, ogłoszenia, kancelaria i przygotowanie do bierzmowania.",
        part: "parish",
        make: "Stwórz własną parafię"
      },
      {
        name: "Wydarzenia",
        body: "Strona internetowa służąca do organizowania wydarzeń — zapisy, program, uczestnicy i komunikacja.",
        part: "event",
        make: "Stwórz własne wydarzenie"
      },
      {
        name: "Cogita",
        body: "Środowisko do pracy z wiedzą: notatki powiązane w graf, powtórki i wspólne opracowania.",
        part: "cogita",
        make: "Stwórz własną przestrzeń"
      },
      {
        name: "Kalendarz",
        body: "Wspólny kalendarz dla grupy — terminy, dyżury i cykliczne spotkania.",
        part: "calendar",
        make: "Stwórz własny kalendarz"
      },
      {
        name: "Rozmowy",
        body: "Zaszyfrowane rozmowy i decyzje w obrębie jednego obszaru.",
        part: "chat",
        make: "Stwórz własny obszar"
      }
    ],
    note: "Części są w bardzo różnym stopniu gotowe. To spis tego, co powstaje, a nie oferta."
  },

  notFound: {
    title: 'Nie ma takiej strony',
    body: 'Ten adres nie istnieje. Link może być nieaktualny.',
    back: 'Wróć na stronę główną'
  },

  footer: {
    logoAlt: 'REcreatio',
    initiative: 'Inicjatywa w trakcie powstawania.'
  },

  factNeeded: 'Brakująca informacja',
  sourceTextNeeded: 'Tekst źródłowy'
};
