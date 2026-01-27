import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';

type ThemePreset = 'classic' | 'minimal' | 'warm';
type PageId =
  | 'start'
  | 'about'
  | 'clergy'
  | 'office'
  | 'announcements'
  | 'intentions'
  | 'masses'
  | 'calendar'
  | 'koleda'
  | 'sacrament-baptism'
  | 'sacrament-communion'
  | 'sacrament-confirmation'
  | 'sacrament-marriage'
  | 'sacrament-funeral'
  | 'sacrament-sick'
  | 'community-bible'
  | 'community-formation'
  | 'contact';

type ParishOption = {
  id: string;
  slug: string;
  name: string;
  location: string;
  logo: string;
  heroImage: string;
  theme: ThemePreset;
};

type MenuItem = {
  label: string;
  id?: PageId;
  children?: { id: PageId; label: string }[];
};

const parishes: ParishOption[] = [
  {
    id: 'st-john',
    slug: 'jan-pradnik',
    name: 'Parafia pw. św. Jana Chrzciciela',
    location: 'Kraków • Prądnik',
    logo: '/parish/logo.svg',
    heroImage: '/parish/visit.jpg',
    theme: 'classic'
  },
  {
    id: 'holy-family',
    slug: 'sw-rodzina',
    name: 'Parafia Najświętszej Rodziny',
    location: 'Nowa Huta',
    logo: '/parish/logo.svg',
    heroImage: '/parish/pursuit_saint.jpg',
    theme: 'warm'
  },
  {
    id: 'st-mary',
    slug: 'mariacka',
    name: 'Parafia Mariacka',
    location: 'Stare Miasto',
    logo: '/parish/logo.svg',
    heroImage: '/parish/minister.jpg',
    theme: 'minimal'
  }
];

const menu: MenuItem[] = [
  { label: 'Start', id: 'start' },
  {
    label: 'Parafia',
    children: [
      { id: 'about', label: 'O parafii' },
      { id: 'clergy', label: 'Duszpasterze' },
      { id: 'office', label: 'Kancelaria' }
    ]
  },
  {
    label: 'Aktualne',
    children: [
      { id: 'announcements', label: 'Ogłoszenia' },
      { id: 'intentions', label: 'Intencje' },
      { id: 'masses', label: 'Msze i nabożeństwa' },
      { id: 'calendar', label: 'Kalendarz' },
      { id: 'koleda', label: 'Kolęda' }
    ]
  },
  {
    label: 'Sakramenty',
    children: [
      { id: 'sacrament-baptism', label: 'Chrzest' },
      { id: 'sacrament-communion', label: 'I Komunia' },
      { id: 'sacrament-confirmation', label: 'Bierzmowanie' },
      { id: 'sacrament-marriage', label: 'Małżeństwo' },
      { id: 'sacrament-funeral', label: 'Pogrzeb' },
      { id: 'sacrament-sick', label: 'Chorzy' }
    ]
  },
  {
    label: 'Wspólnoty',
    children: [
      { id: 'community-bible', label: 'Krąg biblijny' },
      { id: 'community-formation', label: 'Diakonia formacji' }
    ]
  },
  { label: 'Kontakt', id: 'contact' }
];

const todayStrip = [
  { label: 'Msze dzisiaj', value: '7:00, 18:00' },
  { label: 'Spowiedź', value: '17:15–17:45' },
  { label: 'Adoracja', value: '19:00–20:00' },
  { label: 'Kancelaria', value: '9:00–11:00' },
  { label: 'Telefon alarmowy', value: '+48 600 123 456' }
];

const homepageHighlights: {
  id: string;
  title: string;
  note: string;
  date: string;
  img: string | null;
  link: string;
}[] = [
  {
    id: 'highlight-1',
    title: 'Niedziela Miłosierdzia',
    note: 'Koronka o 15:00 i adoracja. Zapraszamy całe rodziny.',
    date: '12 kwietnia 2025',
    img: '/parish/minister.jpg',
    link: '/#/parish/jan-pradnik'
  },
  {
    id: 'highlight-2',
    title: 'Rekolekcje wielkopostne',
    note: 'Konferencje w piątek, sobotę i niedzielę.',
    date: '9 kwietnia 2025',
    img: '/parish/pursuit_saint.jpg',
    link: '/#/parish/jan-pradnik'
  },
  {
    id: 'highlight-3',
    title: 'Zbiórka dla Caritas',
    note: 'Kosze z darami w kruchcie. Wsparcie dla potrzebujących.',
    date: '6 kwietnia 2025',
    img: '/parish/finance.jpg',
    link: '/#/parish/jan-pradnik'
  },
  {
    id: 'highlight-4',
    title: 'Ogłoszenie tekstowe',
    note: 'Przykład komunikatu bez zdjęcia. Krótka informacja dla parafian.',
    date: '4 kwietnia 2025',
    img: null,
    link: '/#/parish/jan-pradnik'
  }
];

const calendarPreviewGroups = [
  {
    id: 'cal-group-1',
    time: 'Piątek, 15 marca • 17:15',
    entries: [
      {
        id: 'cal-1',
        title: 'Droga Krzyżowa',
        place: 'Kościół główny',
        provider: 'ks. Marek',
        link: '/#/parish/jan-pradnik'
      },
      {
        id: 'cal-1b',
        title: 'Spowiedź',
        place: 'Konfesjonały',
        provider: 'ks. Adam',
        link: '/#/parish/jan-pradnik'
      }
    ]
  },
  {
    id: 'cal-group-2',
    time: 'Środa, 19 marca • 19:00',
    entries: [
      {
        id: 'cal-2',
        title: 'Spotkanie kręgu biblijnego',
        place: 'Biblioteka parafialna',
        provider: 'ks. Paweł',
        link: '/#/parish/jan-pradnik'
      }
    ]
  },
  {
    id: 'cal-group-3',
    time: 'Czwartek, 20 marca • 18:30',
    entries: [
      {
        id: 'cal-3',
        title: 'Próba chóru',
        place: 'Sala muzyczna',
        provider: 'Anna Nowak',
        link: '/#/parish/jan-pradnik'
      }
    ]
  },
  {
    id: 'cal-group-4',
    time: 'Piątek, 21 marca • 19:30',
    entries: [
      {
        id: 'cal-4',
        title: 'Spotkanie młodzieży',
        place: 'Salki duszpasterskie',
        provider: 'ks. Adam',
        link: '/#/parish/jan-pradnik'
      }
    ]
  },
  {
    id: 'cal-group-5',
    time: 'Niedziela, 23 marca • 11:00',
    entries: [
      {
        id: 'cal-5',
        title: 'Msza za wspólnotę',
        place: 'Kościół główny',
        provider: 'ks. Marek',
        link: '/#/parish/jan-pradnik'
      }
    ]
  }
];

const announcements = [
  {
    id: 'ann-1',
    title: 'Niedziela Miłosierdzia',
    date: '12 kwietnia 2025',
    excerpt: 'Zapraszamy na Koronkę do Miłosierdzia Bożego o 15:00.',
    content:
      'Zapraszamy parafian i gości do wspólnej modlitwy. Koronka o 15:00 w kościele głównym, po niej krótka adoracja. Przynieście ze sobą intencje wdzięczności.'
  },
  {
    id: 'ann-2',
    title: 'Rekolekcje wielkopostne',
    date: '9 kwietnia 2025',
    excerpt: 'Konferencje w piątek, sobotę i niedzielę.',
    content:
      'Rekolekcje poprowadzi ks. Adam Kowalski. Szczegóły w gablocie i na stronie. Spowiedź dodatkowa w sobotę od 16:00.'
  },
  {
    id: 'ann-3',
    title: 'Wsparcie dla Caritas',
    date: '6 kwietnia 2025',
    excerpt: 'Zbiórka żywności w kruchcie kościoła.',
    content:
      'W najbliższą niedzielę prowadzimy zbiórkę żywności długoterminowej. Dary można składać w wyznaczonych koszach od 7:00 do 13:00.'
  }
];

const ogloszeniaShortcuts = [
  { date: '12–18 marca', link: '/#/parish/jan-pradnik' },
  { date: '5–11 marca', link: '/#/parish/jan-pradnik' },
  { date: 'Marzec 2025', link: '/#/parish/jan-pradnik' }
];

const intentionShortcuts = [
  { label: 'Intencje dzisiaj', desc: 'Lista na dziś', link: '/#/parish/jan-pradnik' },
  { label: 'Intencje tygodnia', desc: 'Pełny harmonogram', link: '/#/parish/jan-pradnik' },
  { label: 'Intencje pogrzebowe', desc: 'Msze za zmarłych', link: '/#/parish/jan-pradnik' }
];

const aktualnosciImages = [
  { img: '/parish/trip.jpg', link: '/#/parish/jan-pradnik' },
  { img: '/parish/choir.jpg', link: '/#/parish/jan-pradnik' },
  { img: '/parish/bible_circle.jpg', link: '/#/parish/jan-pradnik' }
];

const wspolnotyImages = [
  { img: '/parish/user.jpg', link: '/#/parish/jan-pradnik' },
  { img: '/parish/minister.jpg', link: '/#/parish/jan-pradnik' },
  { img: '/parish/visit.jpg', link: '/#/parish/jan-pradnik' }
];

const upcomingEvents = [
  { title: 'Spotkanie rady parafialnej', date: 'Śr., 13 marca', place: 'Sala Jana Pawła II', tag: 'Organizacja' },
  { title: 'Nabożeństwo Drogi Krzyżowej', date: 'Pt., 15 marca', place: 'Kościół główny', tag: 'Nabożeństwo' },
  { title: 'Spotkanie młodzieży', date: 'Sb., 16 marca', place: 'Salki duszpasterskie', tag: 'Młodzież' },
  { title: 'Koncert chóru', date: 'Nd., 17 marca', place: 'Kościół główny', tag: 'Muzyka' }
];

const intentionsWeek = [
  {
    day: 'Poniedziałek • 11 marca',
    items: [
      { time: '7:00', text: 'Za + Janinę i Stanisława Nowak', location: 'Kościół', priest: 'ks. Marek' },
      { time: '18:00', text: 'O zdrowie dla Katarzyny i Łukasza', location: 'Kościół', priest: 'ks. Adam' }
    ]
  },
  {
    day: 'Wtorek • 12 marca',
    items: [
      { time: '7:00', text: 'Dziękczynna za rodzinę Malinowskich', location: 'Kaplica', priest: 'ks. Marek' },
      { time: '18:00', text: 'Za + Helenę i Józefa', location: 'Kościół', priest: 'ks. Paweł' }
    ]
  },
  {
    day: 'Środa • 13 marca',
    items: [
      { time: '7:00', text: 'O pokój w rodzinie', location: 'Kościół', priest: 'ks. Adam' },
      { time: '18:00', text: 'Za + Alicję i Piotra', location: 'Kościół', priest: 'ks. Marek' }
    ]
  }
];

const massesTables = {
  Sunday: [
    { time: '7:00', place: 'Kościół główny', note: 'Cicha' },
    { time: '9:00', place: 'Kościół główny', note: 'Rodzinna' },
    { time: '11:00', place: 'Kościół główny', note: 'Suma' },
    { time: '18:00', place: 'Kościół główny', note: 'Młodzieżowa' }
  ],
  Weekdays: [
    { time: '7:00', place: 'Kaplica', note: 'Pon–Pt' },
    { time: '18:00', place: 'Kościół główny', note: 'Pon–Sb' }
  ],
  Devotions: [
    { time: 'Śr. 19:00', place: 'Kościół', note: 'Nowenna' },
    { time: 'Pt. 17:15', place: 'Kościół', note: 'Droga Krzyżowa' }
  ],
  Confession: [
    { time: 'Wt.–Sb. 17:15', place: 'Konfesjonały', note: 'Stała' },
    { time: 'Nd. 8:30', place: 'Konfesjonały', note: 'Przed Mszą' }
  ]
};

const exceptions = [
  { date: '19 marca (śr.)', detail: 'Msza o 18:00 przeniesiona do kaplicy' },
  { date: '25 marca (wt.)', detail: 'Dodatkowa Msza o 20:00 (rekolekcje)' },
  { date: '31 marca (pon.)', detail: 'Brak Mszy o 7:00 — zastępstwo' }
];

const calendarEvents = [
  {
    id: 'evt-1',
    title: 'Katecheza dla narzeczonych',
    date: '16 marca 2025',
    time: '19:00',
    place: 'Sala Jana Pawła II',
    priest: 'ks. Adam',
    category: 'Formacja',
    recurring: true,
    description: 'Spotkanie przygotowujące do sakramentu małżeństwa.'
  },
  {
    id: 'evt-2',
    title: 'Chór parafialny',
    date: '14 marca 2025',
    time: '18:30',
    place: 'Sala muzyczna',
    priest: 'ks. Marek',
    category: 'Muzyka',
    recurring: true,
    description: 'Próba chóru przed uroczystością parafialną.'
  },
  {
    id: 'evt-3',
    title: 'Spotkanie seniorów',
    date: '15 marca 2025',
    time: '10:00',
    place: 'Sala parafialna',
    priest: 'ks. Paweł',
    category: 'Wspólnota',
    recurring: false,
    description: 'Rozmowa i herbata dla seniorów, tematyka: wspomnienia z pielgrzymek.'
  }
];

const priests = [
  {
    id: 'pr-1',
    name: 'ks. Adam Kowalski',
    role: 'Proboszcz',
    img: '/parish/minister.jpg',
    bio: 'Duszpasterz rodzin, prowadzi katechezy dla narzeczonych.',
    contact: 'Pon.–Pt. 10:00–12:00'
  },
  {
    id: 'pr-2',
    name: 'ks. Marek Nowak',
    role: 'Wikariusz',
    img: '/parish/visit.jpg',
    bio: 'Opiekun ministrantów i chóru.',
    contact: 'Wt., Czw. 16:00–18:00'
  },
  {
    id: 'pr-3',
    name: 'ks. Paweł Zieliński',
    role: 'Rezydent',
    img: '/parish/pursuit_saint.jpg',
    bio: 'Duszpasterz chorych i seniorów.',
    contact: 'Pon. 12:00–14:00'
  }
];

const sacraments = [
  {
    id: 'baptism',
    title: 'Chrzest',
    img: '/parish/baptism.jpg',
    steps: ['Zgłoszenie w kancelarii', 'Katecheza rodziców', 'Ustalenie terminu', 'Liturgia chrztu'],
    docs: ['Akt urodzenia dziecka', 'Dane rodziców chrzestnych', 'Zgoda parafii chrzestnych']
  },
  {
    id: 'communion',
    title: 'Pierwsza Komunia',
    img: '/parish/communion.jpg',
    steps: ['Spotkania formacyjne', 'Spowiedź dzieci', 'Próby liturgiczne', 'Uroczysta Msza'],
    docs: ['Metryka chrztu', 'Zgoda szkoły', 'Karta zgłoszeniowa']
  },
  {
    id: 'confirmation',
    title: 'Bierzmowanie',
    img: '/parish/confirmation.jpg',
    steps: ['Zgłoszenie', 'Przygotowanie roczne', 'Próba generalna', 'Sakrament'],
    docs: ['Metryka chrztu', 'Świadectwo religii', 'Zgoda rodziców']
  },
  {
    id: 'marriage',
    title: 'Małżeństwo',
    img: '/parish/visit.jpg',
    steps: ['Rozmowa w kancelarii', 'Kurs przedmałżeński', 'Spisanie protokołu', 'Ślub'],
    docs: ['Akt chrztu', 'Dowody osobiste', 'Zaświadczenie z USC']
  },
  {
    id: 'funeral',
    title: 'Pogrzeb',
    img: '/parish/obit.jpg',
    steps: ['Kontakt z kancelarią', 'Ustalenie daty', 'Modlitwa różańcowa', 'Msza pogrzebowa'],
    docs: ['Akt zgonu', 'Dokumenty z USC', 'Dane osoby zmarłej']
  },
  {
    id: 'sick',
    title: 'Namaszczenie chorych',
    img: '/parish/unction.jpg',
    steps: ['Telefon do kancelarii', 'Ustalenie wizyty', 'Przygotowanie domu', 'Sakrament'],
    docs: ['Dane chorego', 'Kontakt do rodziny', 'Informacja o stanie zdrowia']
  }
];

const sacramentDescriptions: Record<string, string> = {
  baptism: 'Wprowadzenie dziecka do wspólnoty Kościoła wraz z błogosławieństwem rodziny.',
  communion: 'Uroczyste spotkanie dzieci z Eucharystią, przygotowanie trwa cały rok formacyjny.',
  confirmation: 'Sakrament dojrzałości chrześcijańskiej, przyjmowany w parafii wiosną.',
  marriage: 'Towarzyszymy narzeczonym od pierwszej rozmowy aż po dzień ślubu.',
  funeral: 'Pomagamy rodzinie w modlitwie i przygotowaniu liturgii pogrzebowej.',
  sick: 'Odwiedzamy chorych w domach i szpitalach, z posługą sakramentalną.'
};

const sacramentPageMap: Record<PageId, string> = {
  'sacrament-baptism': 'baptism',
  'sacrament-communion': 'communion',
  'sacrament-confirmation': 'confirmation',
  'sacrament-marriage': 'marriage',
  'sacrament-funeral': 'funeral',
  'sacrament-sick': 'sick',
  start: '',
  about: '',
  clergy: '',
  office: '',
  announcements: '',
  intentions: '',
  masses: '',
  calendar: '',
  koleda: '',
  'community-bible': '',
  'community-formation': '',
  contact: ''
};

const communityPages: Record<
  'community-bible' | 'community-formation',
  {
    title: string;
    image: string;
    lead: string;
    cadence: string;
    location: string;
    leader: string;
    roles: string[];
    plan: string[];
  }
> = {
  'community-bible': {
    title: 'Krąg biblijny',
    image: '/parish/bible_circle.jpg',
    lead: 'Spotkania z Pismem Świętym, dzielenie się i wspólna modlitwa.',
    cadence: 'Co dwa tygodnie, środa 19:00',
    location: 'Biblioteka parafialna',
    leader: 'ks. Paweł Zieliński',
    roles: ['prowadzący', 'uczestnik'],
    plan: ['Modlitwa wstępna', 'Lectio divina', 'Dzielenie w grupach', 'Zakończenie']
  },
  'community-formation': {
    title: 'Diakonia formacji',
    image: '/parish/choir.jpg',
    lead: 'Zespół odpowiedzialny za formację wspólnot i przygotowanie spotkań.',
    cadence: 'Co tydzień, wtorek 18:30',
    location: 'Sala Jana Pawła II',
    leader: 'Anna Nowak',
    roles: ['koordynator', 'mentor', 'wolontariusz'],
    plan: ['Przygotowanie materiałów', 'Konsultacje z duszpasterzem', 'Warsztaty', 'Podsumowanie']
  }
};

const koledaByDate = [
  {
    date: '7 stycznia',
    window: '16:00–20:00',
    area: 'Os. Zielone 12–24',
    priest: 'ks. Marek'
  },
  {
    date: '8 stycznia',
    window: '16:00–20:00',
    area: 'ul. Dobrego Pasterza 1–15',
    priest: 'ks. Adam'
  },
  {
    date: '9 stycznia',
    window: '16:00–20:00',
    area: 'Os. Cegielniana 5–18',
    priest: 'ks. Paweł'
  }
];

const koledaByArea = [
  { area: 'Os. Zielone', streets: 'Bloki 1–30', date: '7–10 stycznia', priest: 'ks. Marek' },
  { area: 'ul. Dobrego Pasterza', streets: '1–45', date: '8–12 stycznia', priest: 'ks. Adam' },
  { area: 'Os. Cegielniana', streets: '1–22', date: '9–11 stycznia', priest: 'ks. Paweł' }
];

const quickActions = [
  { label: 'Kontakt', detail: 'Telefony i e-mail', icon: 'C' },
  { label: 'Kancelaria', detail: 'Godziny przyjęć', icon: 'K' },
  { label: 'Sakramenty', detail: 'Wymagane dokumenty', icon: 'S' },
  { label: 'Wspólnoty', detail: 'Znajdź grupę', icon: 'W' },
  { label: 'Kolęda', detail: 'Plan wizyt', icon: 'L' },
  { label: 'Ofiary', detail: 'Wsparcie parafii', icon: 'O' }
];

const parishLocations = [
  {
    title: 'Kościół główny',
    address: 'ul. Dobrego Pasterza 117, 31-416 Kraków',
    info: 'Wejście od strony placu, parking przy plebanii.',
    hours: 'Codziennie 6:30–20:30'
  },
  {
    title: 'Kaplica adoracji',
    address: 'ul. Dobrego Pasterza 117, wejście boczne',
    info: 'Dostępna codziennie, wejście z dziedzińca.',
    hours: 'Pon.–Pt. 8:00–19:00'
  },
  {
    title: 'Sala parafialna',
    address: 'ul. Dobrego Pasterza 117, budynek A',
    info: 'Wejście z tyłu kościoła, parking rowerowy.',
    hours: 'Wg harmonogramu spotkań'
  }
];

const officeHours = [
  { day: 'Poniedziałek', hours: '9:00–11:00, 16:00–18:00' },
  { day: 'Wtorek', hours: '9:00–11:00, 16:00–18:00' },
  { day: 'Środa', hours: '9:00–11:00' },
  { day: 'Czwartek', hours: '9:00–11:00, 16:00–18:00' },
  { day: 'Piątek', hours: '9:00–11:00, 16:00–18:00' }
];

const aboutHighlights = [
  { label: 'Rok założenia', value: '1984' },
  { label: 'Wspólnoty', value: '12' },
  { label: 'Msze tygodniowo', value: '18' },
  { label: 'Wolontariusze', value: '45' }
];

export function ParishPage({
  copy,
  onAuthAction,
  authLabel,
  onNavigate,
  language,
  onLanguageChange,
  parishSlug
}: {
  copy: Copy;
  onAuthAction: () => void;
  authLabel: string;
  onNavigate: (route: RouteKey) => void;
  language: 'pl' | 'en' | 'de';
  onLanguageChange: (language: 'pl' | 'en' | 'de') => void;
  parishSlug?: string;
}) {
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    onNavigate('home');
  };
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState<PageId>('start');
  const [menuOpen, setMenuOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [parishId, setParishId] = useState(parishes[0].id);
  const [theme, setTheme] = useState<ThemePreset>(parishes[0].theme);
  const [massTab, setMassTab] = useState<keyof typeof massesTables>('Sunday');
  const [announcementId, setAnnouncementId] = useState(announcements[0].id);
  const [calendarView, setCalendarView] = useState<'month' | 'agenda'>('month');
  const [selectedEventId, setSelectedEventId] = useState(calendarEvents[0].id);
  const [selectedPriestId, setSelectedPriestId] = useState(priests[0].id);
  const [selectedSacramentId, setSelectedSacramentId] = useState(sacraments[0].id);
  const [view, setView] = useState<'chooser' | 'parish'>(parishSlug ? 'parish' : 'chooser');
  const [activeSlide, setActiveSlide] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchDeltaX, setTouchDeltaX] = useState(0);
  const [aktualnosciIndex, setAktualnosciIndex] = useState(0);
  const [wspolnotyIndex, setWspolnotyIndex] = useState(0);
  const [aktualnosciPrevIndex, setAktualnosciPrevIndex] = useState(0);
  const [wspolnotyPrevIndex, setWspolnotyPrevIndex] = useState(0);

  const parish = useMemo(() => parishes.find((item) => item.id === parishId) ?? parishes[0], [parishId]);
  const announcement = useMemo(
    () => announcements.find((item) => item.id === announcementId) ?? announcements[0],
    [announcementId]
  );
  const selectedEvent = useMemo(
    () => calendarEvents.find((item) => item.id === selectedEventId) ?? calendarEvents[0],
    [selectedEventId]
  );
  const selectedPriest = useMemo(() => priests.find((item) => item.id === selectedPriestId) ?? priests[0], [
    selectedPriestId
  ]);

  const selectedSacrament = useMemo(
    () => sacraments.find((item) => item.id === selectedSacramentId) ?? sacraments[0],
    [selectedSacramentId]
  );
  const activeHighlight = homepageHighlights[activeSlide] ?? homepageHighlights[0];

  const communityData = useMemo(() => {
    if (activePage === 'community-bible' || activePage === 'community-formation') {
      return communityPages[activePage];
    }
    return null;
  }, [activePage]);

  const handleParishChange = (nextId: string) => {
    const nextParish = parishes.find((item) => item.id === nextId) ?? parishes[0];
    setParishId(nextParish.id);
    setTheme(nextParish.theme);
  };

  useEffect(() => {
    if (!autoRotate) return;
    const interval = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % homepageHighlights.length);
    }, 6000);
    return () => window.clearInterval(interval);
  }, [autoRotate, homepageHighlights.length]);

  useEffect(() => {
    const baseDelay = 5000;
    const minDelay = baseDelay * 0.8;
    const maxDelay = baseDelay * 1.2;
    const schedule = (
      length: number,
      update: Dispatch<SetStateAction<number>>,
      updatePrev: Dispatch<SetStateAction<number>>
    ) => {
      const tick = () => {
        update((prev) => {
          updatePrev(prev);
          return (prev + 1) % length;
        });
        const nextDelay = Math.floor(minDelay + Math.random() * (maxDelay - minDelay));
        timeoutId = window.setTimeout(tick, nextDelay);
      };
      let timeoutId = window.setTimeout(tick, minDelay + Math.random() * (maxDelay - minDelay));
      return () => window.clearTimeout(timeoutId);
    };

    const cleanupAktualnosci = schedule(aktualnosciImages.length, setAktualnosciIndex, setAktualnosciPrevIndex);
    const cleanupWspolnoty = schedule(wspolnotyImages.length, setWspolnotyIndex, setWspolnotyPrevIndex);
    return () => {
      cleanupAktualnosci();
      cleanupWspolnoty();
    };
  }, []);

  const selectPage = (next: PageId) => {
    setActivePage(next);
    setMenuOpen(false);
    setOpenSection(null);
    if (sacramentPageMap[next]) {
      setSelectedSacramentId(sacramentPageMap[next]);
    }
  };

  useEffect(() => {
    if (!parishSlug) {
      setView('chooser');
      return;
    }
    const nextParish = parishes.find((item) => item.slug === parishSlug);
    if (nextParish) {
      setParishId(nextParish.id);
      setTheme(nextParish.theme);
      setView('parish');
      setActivePage('start');
    }
  }, [parishSlug]);

  return (
    <div className={`parish-portal theme-${theme}`} lang={language}>
      {view === 'chooser' ? (
        <>
          <header className="parish-header parish-header--chooser">
            <button type="button" className="parish-brand" onClick={() => onNavigate('home')}>
              <img src="/parish/logo.svg" alt="Logo parafii" className="parish-logo" />
              <span className="parish-name">Parafie</span>
            </button>
            <div className="parish-controls">
              <button type="button" className="parish-back" onClick={handleBack}>
                Back
              </button>
              <button type="button" className="parish-login" onClick={onAuthAction}>
                {authLabel}
              </button>
            </div>
          </header>
          <main className="parish-main">
            <section className="parish-chooser">
              <div className="chooser-card">
                <div>
                  <p className="tag">Portal parafialny</p>
                  <h1>Wybierz parafię</h1>
                  <p className="lead">Na start udostępniamy jedną parafię testową.</p>
                </div>
                <div className="chooser-list">
                  {parishes.slice(0, 1).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="chooser-item"
                      onClick={() => {
                        handleParishChange(item.id);
                        setView('parish');
                        setActivePage('start');
                        navigate(`/parish/${item.slug}`);
                      }}
                    >
                      <div>
                        <strong>{item.name}</strong>
                        <span className="muted">{item.location}</span>
                      </div>
                      <span className="pill">Wejdź</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </main>
        </>
      ) : (
        <>
          <header className="parish-header">
            <button
              type="button"
              className="parish-brand"
              onClick={() => {
                setActivePage('start');
                setMenuOpen(false);
                setOpenSection(null);
                navigate(`/parish/${parish.slug}`);
              }}
            >
              <img src={parish.logo} alt={`Logo ${parish.name}`} className="parish-logo" />
              <span className="parish-name">{parish.name}</span>
            </button>
            <nav className={`parish-menu ${menuOpen ? 'open' : ''}`} aria-label="Menu parafialne">
              {menu.map((item) => {
                if (item.children) {
                  const isActiveGroup = item.children.some((child) => child.id === activePage);
                  const isOpen = openSection === item.label;
                  return (
                    <div key={item.label} className={`menu-item ${isActiveGroup ? 'is-active' : ''} ${isOpen ? 'open' : ''}`}>
                      <button
                        type="button"
                        className="menu-button"
                        aria-haspopup="true"
                        onClick={() => setOpenSection((current) => (current === item.label ? null : item.label))}
                      >
                        {item.label}
                      </button>
                      <button
                        type="button"
                        className="submenu-toggle"
                        aria-label={`Rozwiń ${item.label}`}
                        onClick={() => setOpenSection((current) => (current === item.label ? null : item.label))}
                      >
                        ▾
                      </button>
                      <div className="submenu">
                        {item.children.map((child) => (
                          <button
                            key={child.id}
                            type="button"
                            className={`submenu-link ${activePage === child.id ? 'is-active' : ''}`}
                            onClick={() => selectPage(child.id)}
                          >
                            {child.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <button
                    key={item.label}
                    type="button"
                    className={`menu-link ${activePage === item.id ? 'is-active' : ''}`}
                    onClick={() => selectPage(item.id as PageId)}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
            <div className="parish-back-control">
              <button type="button" className="parish-back" onClick={handleBack}>
                Back
              </button>
            </div>
            <div className="parish-menu-control">
              <button
                type="button"
                className="menu-toggle"
                onClick={() => {
                  setMenuOpen((open) => {
                    if (open) setOpenSection(null);
                    return !open;
                  });
                }}
              >
                Menu
              </button>
            </div>
            <div className="parish-login-control">
              <button type="button" className="parish-login" onClick={onAuthAction}>
                {authLabel}
              </button>
            </div>
          </header>
          <main className="parish-main">
            {activePage === 'start' && (
              <>
                <section className="parish-section home-top">
                  <div className="home-top-grid">
                    <div
                      className="carousel"
                      onTouchStart={(event) => {
                        const touch = event.touches[0];
                        if (!touch) return;
                        setTouchStartX(touch.clientX);
                        setTouchDeltaX(0);
                      }}
                      onTouchMove={(event) => {
                        if (touchStartX === null) return;
                        const touch = event.touches[0];
                        if (!touch) return;
                        setTouchDeltaX(touch.clientX - touchStartX);
                      }}
                      onTouchEnd={() => {
                        if (touchStartX === null) return;
                        if (Math.abs(touchDeltaX) > 40) {
                          setAutoRotate(false);
                          setActiveSlide((prev) =>
                            touchDeltaX > 0
                              ? (prev - 1 + homepageHighlights.length) % homepageHighlights.length
                              : (prev + 1) % homepageHighlights.length
                          );
                        }
                        setTouchStartX(null);
                        setTouchDeltaX(0);
                      }}
                    >
                      {homepageHighlights.map((item, index) => (
                        <a
                          key={item.id}
                          className={`carousel-slide ${activeSlide === index ? 'is-active' : ''} ${
                            item.img ? '' : 'text-only'
                          }`}
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {item.img ? <img src={item.img} alt={item.title} /> : null}
                        </a>
                      ))}
                      <a
                        className={`carousel-caption ${activeHighlight.img ? '' : 'text-only'}`}
                        href={activeHighlight.link}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="pill">{activeHighlight.date}</span>
                        <h2>{activeHighlight.title}</h2>
                        <p className="note">{activeHighlight.note}</p>
                      </a>
                      <button
                        type="button"
                        className="carousel-arrow left"
                        aria-label="Poprzednia informacja"
                        onClick={() => {
                          setAutoRotate(false);
                          setActiveSlide((prev) => (prev - 1 + homepageHighlights.length) % homepageHighlights.length);
                        }}
                      >
                        <span>‹</span>
                      </button>
                      <button
                        type="button"
                        className="carousel-arrow right"
                        aria-label="Następna informacja"
                        onClick={() => {
                          setAutoRotate(false);
                          setActiveSlide((prev) => (prev + 1) % homepageHighlights.length);
                        }}
                      >
                        <span>›</span>
                      </button>
                      <div className="carousel-dots" role="tablist" aria-label="Ważne informacje">
                        {homepageHighlights.map((item, index) => (
                          <button
                            key={item.id}
                            type="button"
                            className={activeSlide === index ? 'is-active' : undefined}
                            onClick={() => {
                              setAutoRotate(false);
                              setActiveSlide(index);
                            }}
                            aria-label={`Slajd ${index + 1}`}
                          />
                        ))}
                      </div>
                    </div>
                    <aside className="calendar-panel">
                      <div className="section-header">
                        <h3>Nadchodzące wydarzenia</h3>
                        <button type="button" className="ghost" onClick={() => selectPage('calendar')}>
                          Pełny kalendarz
                        </button>
                      </div>
                      <div className="calendar-list">
                        {calendarPreviewGroups.map((group) => (
                          <div key={group.id} className="calendar-group">
                            <span className="calendar-time">{group.time}</span>
                            <div className="calendar-row">
                              {group.entries.map((entry) => (
                                <a key={entry.id} href={entry.link} target="_blank" rel="noreferrer">
                                  <strong>{entry.title}</strong>
                                  <span>{entry.place}</span>
                                  <span className="muted">Prowadzi: {entry.provider}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </aside>
                  </div>
                </section>
                <section className="parish-section home-split">
                  <div className="widget-row">
                    <div className="parish-card slim-widget">
                      <div className="section-header">
                        <h3>Ogłoszenia — skróty</h3>
                        <button type="button" className="ghost" onClick={() => selectPage('announcements')}>
                          Wszystkie ogłoszenia
                        </button>
                      </div>
                      <div className="shortcut-list">
                        {ogloszeniaShortcuts.map((item) => (
                          <a key={item.date} href={item.link} target="_blank" rel="noreferrer">
                            <strong>{item.date}</strong>
                          </a>
                        ))}
                      </div>
                    </div>
                    <div className="parish-card slim-widget">
                      <div className="section-header">
                        <h3>Intencje</h3>
                        <button type="button" className="ghost" onClick={() => selectPage('intentions')}>
                          Wszystkie intencje
                        </button>
                      </div>
                      <div className="shortcut-list">
                        {intentionShortcuts.map((item) => (
                          <a key={item.label} href={item.link} target="_blank" rel="noreferrer">
                            <strong>{item.label}</strong>
                            <span className="muted">{item.desc}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="widget-row">
                    <div className="parish-card image-widget">
                      <div className="section-header">
                        <h3>Aktualności</h3>
                        <button type="button" className="ghost" onClick={() => selectPage('announcements')}>
                          Wszystkie aktualności
                        </button>
                      </div>
                      <a
                        className="image-link"
                        href={aktualnosciImages[aktualnosciIndex]?.link}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <div
                          className="image-layer is-prev"
                          style={{ backgroundImage: `url(${aktualnosciImages[aktualnosciPrevIndex]?.img})` }}
                        />
                        <div
                          className="image-layer is-current"
                          key={aktualnosciImages[aktualnosciIndex]?.img}
                          style={{ backgroundImage: `url(${aktualnosciImages[aktualnosciIndex]?.img})` }}
                        />
                        <span>Przejdź do aktualności</span>
                      </a>
                    </div>
                    <div className="parish-card image-widget">
                      <div className="section-header">
                        <h3>Wspólnoty</h3>
                        <button type="button" className="ghost" onClick={() => selectPage('community-bible')}>
                          Wszystkie wspólnoty
                        </button>
                      </div>
                      <a
                        className="image-link"
                        href={wspolnotyImages[wspolnotyIndex]?.link}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <div
                          className="image-layer is-prev"
                          style={{ backgroundImage: `url(${wspolnotyImages[wspolnotyPrevIndex]?.img})` }}
                        />
                        <div
                          className="image-layer is-current"
                          key={wspolnotyImages[wspolnotyIndex]?.img}
                          style={{ backgroundImage: `url(${wspolnotyImages[wspolnotyIndex]?.img})` }}
                        />
                        <span>Przejdź do wspólnot</span>
                      </a>
                    </div>
                  </div>
                </section>
                <section className="parish-section">
                  <div className="section-header">
                    <h2>Szybkie działania</h2>
                    <span className="muted">Najczęściej wybierane</span>
                  </div>
                  <div className="quick-grid">
                    {quickActions.map((action) => (
                      <div key={action.label} className="quick-card">
                        <span className="quick-icon">{action.icon}</span>
                        <div>
                          <strong>{action.label}</strong>
                          <span>{action.detail}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="parish-section">
                  <div className="section-header">
                    <h2>Lokalizacje parafialne</h2>
                    <span className="muted">Ujednolicony format adresu</span>
                  </div>
                  <div className="location-grid">
                    {parishLocations.map((location) => (
                      <div key={location.title} className="location-card">
                        <div>
                          <h3>{location.title}</h3>
                          <p>{location.address}</p>
                          <p className="note">{location.info}</p>
                        </div>
                        <div className="location-meta">
                          <span>{location.hours}</span>
                          <div className="map-placeholder">Mapa</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
            {activePage === 'about' && (
              <section className="parish-section about-page">
                <div className="section-header">
                  <div>
                    <p className="tag">Parafia</p>
                    <h2>O parafii</h2>
                  </div>
                  <span className="muted">Historia i misja wspólnoty</span>
                </div>
                <div className="about-grid">
                  <div className="parish-card">
                    <h3>Misja i wspólnota</h3>
                    <p className="note">
                      Tworzymy miejsce modlitwy, edukacji i pomocy. Każda inicjatywa służy budowaniu relacji i
                      wzmacnianiu wiary.
                    </p>
                    <div className="highlight-grid">
                      {aboutHighlights.map((item) => (
                        <div key={item.label}>
                          <strong>{item.value}</strong>
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="parish-card">
                    <h3>Historia parafii</h3>
                    <p className="note">
                      Parafia powstała w odpowiedzi na rozwój dzielnicy. Od początku łączy duchowość z aktywnym
                      zaangażowaniem społecznym.
                    </p>
                    <ul className="history-list">
                      <li>1984 — erygowanie parafii i budowa kościoła.</li>
                      <li>2002 — otwarcie centrum formacji i biblioteki.</li>
                      <li>2020 — uruchomienie transmisji i nowych wspólnot.</li>
                    </ul>
                  </div>
                  <div className="parish-card about-media">
                    <img src="/parish/trip.jpg" alt="Wspólnota parafialna" />
                    <div>
                      <h3>Zaangażowanie</h3>
                      <p className="note">Wspieramy wolontariat, wydarzenia rodzinne oraz działania charytatywne.</p>
                    </div>
                  </div>
                </div>
              </section>
            )}
            {activePage === 'office' && (
              <section className="parish-section office-page">
                <div className="section-header">
                  <div>
                    <p className="tag">Kancelaria</p>
                    <h2>Godziny przyjęć i kontakt</h2>
                  </div>
                  <button type="button" className="ghost">
                    Pobierz formularze
                  </button>
                </div>
                <div className="office-grid">
                  <div className="parish-card">
                    <h3>Godziny kancelarii</h3>
                    <ul className="office-hours">
                      {officeHours.map((item) => (
                        <li key={item.day}>
                          <strong>{item.day}</strong>
                          <span>{item.hours}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="notice">
                      <strong>Uwaga</strong>
                      <p>W święta i uroczystości godziny mogą ulec zmianie.</p>
                    </div>
                  </div>
                  <div className="parish-card">
                    <h3>Sprawy urzędowe</h3>
                    <p className="note">Spisanie protokołów, zapisy na sakramenty i sprawy administracyjne.</p>
                    <div className="detail-grid">
                      <div>
                        <span className="label">Telefon</span>
                        <strong>+48 12 412 58 50</strong>
                      </div>
                      <div>
                        <span className="label">E-mail</span>
                        <strong>kancelaria@janchrzciciel.eu</strong>
                      </div>
                      <div>
                        <span className="label">Lokalizacja</span>
                        <strong>Wejście od strony plebanii</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}
            {activePage === 'masses' && (
              <section className="parish-section">
                <div className="section-header">
                  <div>
                    <p className="tag">Msze i nabożeństwa</p>
                    <h2>Stały rytm tygodnia</h2>
                  </div>
                  <span className="muted">Tydzień 11–17 marca 2025</span>
                </div>
                <div className="tabs">
                  {(['Sunday', 'Weekdays', 'Devotions', 'Confession'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={massTab === tab ? 'is-active' : undefined}
                      onClick={() => setMassTab(tab)}
                    >
                      {tab === 'Sunday' && 'Niedziele'}
                      {tab === 'Weekdays' && 'Dni powszednie'}
                      {tab === 'Devotions' && 'Nabożeństwa'}
                      {tab === 'Confession' && 'Spowiedź'}
                    </button>
                  ))}
                </div>
                <div className="parish-card">
                  <table className="schedule-table">
                    <thead>
                      <tr>
                        <th>Godzina</th>
                        <th>Miejsce</th>
                        <th>Uwagi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {massesTables[massTab].map((row) => (
                        <tr key={`${massTab}-${row.time}`}>
                          <td>{row.time}</td>
                          <td>{row.place}</td>
                          <td>{row.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="parish-card exceptions">
                  <div className="section-header">
                    <h3>Wyjątki i zmiany</h3>
                    <span className="muted">Nadpisują plan tygodniowy</span>
                  </div>
                  <ul>
                    {exceptions.map((item) => (
                      <li key={item.date}>
                        <strong>{item.date}</strong>
                        <span>{item.detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}
            {activePage === 'intentions' && (
              <section className="parish-section intentions-page">
                <div className="section-header">
                  <div>
                    <p className="tag">Intencje</p>
                    <h2>Lista intencji na tydzień</h2>
                  </div>
                  <div className="intentions-controls">
                    <button type="button" className="ghost">
                      Dzisiaj
                    </button>
                    <button type="button" className="ghost">
                      Ta niedziela
                    </button>
                    <button type="button" className="ghost">
                      Drukuj
                    </button>
                  </div>
                </div>
                <div className="intentions-layout">
                  <div className="parish-card">
                    <div className="intentions-search">
                      <input type="text" placeholder="Szukaj intencji (mock)" />
                      <span>Tydzień 11–17 marca 2025</span>
                    </div>
                    <div className="accordion">
                      {intentionsWeek.map((day) => (
                        <details key={day.day} open>
                          <summary>{day.day}</summary>
                          <div className="accordion-body">
                            {day.items.map((item) => (
                              <div key={`${day.day}-${item.time}`} className="intent-row">
                                <span>{item.time}</span>
                                <div>
                                  <p>{item.text}</p>
                                  <span className="muted">
                                    {item.location} • {item.priest}
                                  </span>
                                </div>
                                <span className="chip">{item.priest}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                  <aside className="parish-card">
                    <div className="section-header">
                      <h3>Moje intencje</h3>
                      <span className="muted">Statusy</span>
                    </div>
                    <ul className="status-list">
                      <li>
                        <strong>14 marca, 7:00</strong>
                        <span>W toku</span>
                      </li>
                      <li>
                        <strong>17 marca, 18:00</strong>
                        <span>Potwierdzona</span>
                      </li>
                      <li>
                        <strong>21 marca, 7:00</strong>
                        <span>Weryfikacja</span>
                      </li>
                    </ul>
                    <button type="button" className="cta ghost">
                      Zgłoś intencję
                    </button>
                  </aside>
                </div>
              </section>
            )}
            {activePage === 'announcements' && (
              <section className="parish-section announcements-page">
                <div className="section-header">
                  <div>
                    <p className="tag">Ogłoszenia</p>
                    <h2>Aktualności parafialne</h2>
                  </div>
                  <div className="intentions-controls">
                    <button type="button" className="ghost">
                      Drukuj
                    </button>
                    <button type="button" className="ghost">
                      Udostępnij
                    </button>
                  </div>
                </div>
                <div className="announcement-layout">
                  <div className="parish-card announcement-list">
                    {announcements.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={item.id === announcementId ? 'is-active' : undefined}
                        onClick={() => setAnnouncementId(item.id)}
                      >
                        <span>{item.date}</span>
                        <strong>{item.title}</strong>
                        <p className="note">{item.excerpt}</p>
                      </button>
                    ))}
                  </div>
                  <article className="parish-card announcement-detail">
                    <p className="date">{announcement.date}</p>
                    <h3>{announcement.title}</h3>
                    <p className="lead">{announcement.content}</p>
                    <div className="print-row">
                      <button type="button" className="ghost">
                        Drukuj
                      </button>
                      <button type="button" className="ghost">
                        Udostępnij
                      </button>
                    </div>
                  </article>
                  <aside className="parish-card archive">
                    <h3>Archiwum</h3>
                    <ul>
                      <li>Marzec 2025</li>
                      <li>Luty 2025</li>
                      <li>Styczeń 2025</li>
                      <li>Grudzień 2024</li>
                    </ul>
                  </aside>
                </div>
              </section>
            )}
            {activePage === 'calendar' && (
              <section className="parish-section calendar-page">
                <div className="section-header">
                  <div>
                    <p className="tag">Kalendarz</p>
                    <h2>Wydarzenia i spotkania</h2>
                  </div>
                  <div className="calendar-controls">
                    <div className="tabs small">
                      <button
                        type="button"
                        className={calendarView === 'month' ? 'is-active' : undefined}
                        onClick={() => setCalendarView('month')}
                      >
                        Miesiąc
                      </button>
                      <button
                        type="button"
                        className={calendarView === 'agenda' ? 'is-active' : undefined}
                        onClick={() => setCalendarView('agenda')}
                      >
                        Agenda
                      </button>
                    </div>
                    <select className="parish-select">
                      <option>Wszystkie kategorie</option>
                      <option>Liturgia</option>
                      <option>Muzyka</option>
                      <option>Formacja</option>
                    </select>
                    <select className="parish-select">
                      <option>Wszystkie miejsca</option>
                      <option>Kościół główny</option>
                      <option>Sala Jana Pawła II</option>
                      <option>Kaplica</option>
                    </select>
                  </div>
                </div>
                <div className="calendar-layout">
                  <div className="parish-card calendar-main">
                    {calendarView === 'month' ? (
                      <>
                        <div className="calendar-grid">
                          {Array.from({ length: 30 }).map((_, index) => (
                            <div key={`day-${index + 1}`} className="calendar-day">
                              <span>{index + 1}</span>
                              {index % 6 === 0 && <em>Spotkanie</em>}
                            </div>
                          ))}
                        </div>
                        <div className="empty-state">
                          <strong>Brak wydarzeń w tym filtrze</strong>
                          <p>Wybierz inną kategorię lub lokalizację.</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <ul className="agenda-list">
                          {calendarEvents.map((event) => (
                            <li key={event.id}>
                              <div>
                                <strong>{event.title}</strong>
                                <span>{event.date}</span>
                              </div>
                              <button type="button" className="ghost" onClick={() => setSelectedEventId(event.id)}>
                                Szczegóły
                              </button>
                            </li>
                          ))}
                        </ul>
                        <div className="empty-state">
                          <strong>Brak wydarzeń w tym filtrze</strong>
                          <p>Wybierz inną kategorię lub lokalizację.</p>
                        </div>
                      </>
                    )}
                  </div>
                  <aside className="parish-card calendar-drawer">
                    <div className="section-header">
                      <h3>Szczegóły wydarzenia</h3>
                      <button type="button" className="ghost" onClick={() => setSelectedEventId(calendarEvents[0].id)}>
                        Reset
                      </button>
                    </div>
                    <p className="date">
                      {selectedEvent.date} • {selectedEvent.time}
                    </p>
                    <h4>{selectedEvent.title}</h4>
                    <p className="note">{selectedEvent.description}</p>
                    <div className="chip-row">
                      <span className="chip">{selectedEvent.category}</span>
                      <span className="chip">{selectedEvent.place}</span>
                    </div>
                    <p className="muted">Prowadzi: {selectedEvent.priest}</p>
                    {selectedEvent.recurring && <span className="pill">Wydarzenie cykliczne</span>}
                    <div className="exception-callout">
                      <strong>Wyjątki</strong>
                      <p>Wielki Piątek: wydarzenie odwołane.</p>
                    </div>
                  </aside>
                </div>
              </section>
            )}
            {activePage === 'clergy' && (
              <section className="parish-section clergy-page">
                <div className="section-header">
                  <div>
                    <p className="tag">Duchowieństwo</p>
                    <h2>Księża posługujący w parafii</h2>
                  </div>
                  <span className="muted">Publiczne godziny kontaktu</span>
                </div>
                <div className="clergy-layout">
                  <div className="clergy-grid">
                    {priests.map((priest) => (
                      <button
                        key={priest.id}
                        type="button"
                        className={`clergy-card ${priest.id === selectedPriestId ? 'is-active' : ''}`}
                        onClick={() => setSelectedPriestId(priest.id)}
                      >
                        <img src={priest.img} alt={priest.name} />
                        <div>
                          <strong>{priest.name}</strong>
                          <span>{priest.role}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <article className="parish-card clergy-profile">
                    <div className="profile-header">
                      <img src={selectedPriest.img} alt={selectedPriest.name} />
                      <div>
                        <h3>{selectedPriest.name}</h3>
                        <p className="note">{selectedPriest.role}</p>
                        <span className="pill">Kontakt: {selectedPriest.contact}</span>
                      </div>
                    </div>
                    <p>{selectedPriest.bio}</p>
                    <div className="schedule-snippet">
                      <h4>Najbliższe 7 dni</h4>
                      <ul>
                        <li>Pt., 15 marca — Msza 18:00</li>
                        <li>Sb., 16 marca — Spowiedź 17:00</li>
                        <li>Nd., 17 marca — Suma 11:00</li>
                      </ul>
                    </div>
                  </article>
                </div>
              </section>
            )}
            {(activePage === 'community-bible' || activePage === 'community-formation') && communityData && (
              <section className="parish-section community-page">
                <div className="section-header">
                  <div>
                    <p className="tag">Wspólnoty</p>
                    <h2>{communityData.title}</h2>
                  </div>
                  <button type="button" className="ghost">
                    Dołącz do wspólnoty
                  </button>
                </div>
                <div className="community-hero">
                  <img src={communityData.image} alt={communityData.title} />
                  <div className="parish-card">
                    <p className="lead">{communityData.lead}</p>
                    <div className="detail-grid">
                      <div>
                        <span className="label">Spotkania</span>
                        <strong>{communityData.cadence}</strong>
                      </div>
                      <div>
                        <span className="label">Miejsce</span>
                        <strong>{communityData.location}</strong>
                      </div>
                      <div>
                        <span className="label">Prowadzący</span>
                        <strong>{communityData.leader}</strong>
                      </div>
                    </div>
                    <div className="chip-row">
                      {communityData.roles.map((role) => (
                        <span key={role} className="chip">
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="parish-card">
                  <h3>Plan spotkania</h3>
                  <ul className="plan-list">
                    {communityData.plan.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="parish-card">
                  <h3>Aktualności wspólnoty</h3>
                  <p className="note">Najbliższe spotkanie: 19 marca, 19:00. Temat: Ewangelia wg św. Marka.</p>
                </div>
              </section>
            )}
            {activePage === 'koleda' && (
              <section className="parish-section koleda-page">
                <div className="section-header">
                  <div>
                    <p className="tag">Kolęda</p>
                    <h2>Plan wizyt duszpasterskich</h2>
                  </div>
                  <span className="pill">Aktualizacja: 5 stycznia</span>
                </div>
                <div className="notice">
                  <strong>Zmiany i aktualizacje</strong>
                  <p>
                    Z powodu choroby ks. Pawła, plan na 10 stycznia został przesunięty na 12 stycznia. Szczegóły w tabeli.
                  </p>
                </div>
                <div className="koleda-layout">
                  <div className="parish-card">
                    <h3>Plan wg dat</h3>
                    <ul className="koleda-list">
                      {koledaByDate.map((item) => (
                        <li key={item.date}>
                          <div>
                            <strong>{item.date}</strong>
                            <span>{item.window}</span>
                          </div>
                          <div>
                            <span>{item.area}</span>
                            <span className="chip">{item.priest}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="parish-card">
                    <h3>Plan wg ulic i rejonów</h3>
                    <ul className="koleda-list">
                      {koledaByArea.map((item) => (
                        <li key={item.area}>
                          <div>
                            <strong>{item.area}</strong>
                            <span>{item.streets}</span>
                          </div>
                          <div>
                            <span>{item.date}</span>
                            <span className="chip">{item.priest}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <aside className="parish-card my-area">
                    <h3>Moja okolica</h3>
                    <p className="note">Os. Zielone 12–24 — 7 stycznia</p>
                    <button type="button" className="cta ghost">
                      Zobacz trasę
                    </button>
                  </aside>
                </div>
              </section>
            )}
            {activePage.startsWith('sacrament-') && (
              <section className="parish-section sacrament-page">
                <div className="section-header">
                  <div>
                    <p className="tag">Sakramenty</p>
                    <h2>{selectedSacrament.title}</h2>
                    <p className="lead">{sacramentDescriptions[selectedSacrament.id]}</p>
                  </div>
                  <button type="button" className="ghost">
                    Pobierz checklistę
                  </button>
                </div>
                <div className="sacrament-hero">
                  <img src={selectedSacrament.img} alt={selectedSacrament.title} />
                  <div className="parish-card">
                    <h3>Kontakt w sprawie sakramentu</h3>
                    <p className="note">Kancelaria: Pon.–Pt. 9:00–11:00, 16:00–18:00</p>
                    <button type="button" className="cta">
                      Umów spotkanie
                    </button>
                  </div>
                </div>
                <div className="parish-card sacrament-detail">
                  <div className="detail-columns">
                    <div>
                      <h4>Kroki</h4>
                      <ol>
                        {selectedSacrament.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </div>
                    <div>
                      <h4>Wymagane dokumenty</h4>
                      <ul className="download-list">
                        {selectedSacrament.docs.map((doc) => (
                          <li key={doc}>
                            <span>{doc}</span>
                            <button type="button" className="ghost">
                              Pobierz
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="contact-box">
                      <h4>Przygotowanie</h4>
                      <p className="note">Przynieś dokumenty i ustal terminy z wyprzedzeniem.</p>
                      <div className="chip-row">
                        <span className="chip">Dokumenty</span>
                        <span className="chip">Spotkanie</span>
                        <span className="chip">Liturgia</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}
            {activePage === 'contact' && (
              <section className="parish-section contact-page">
                <div className="section-header">
                  <div>
                    <p className="tag">Kontakt</p>
                    <h2>Adresy i godziny</h2>
                  </div>
                  <span className="muted">Gotowe do wydruku</span>
                </div>
                <div className="contact-grid">
                  <div className="parish-card address-card">
                    <h3>Adres główny</h3>
                    <p>ul. Dobrego Pasterza 117, 31-416 Kraków</p>
                    <div className="map-placeholder">Mapa</div>
                    <p className="note">Wejście główne, parking po prawej stronie.</p>
                    <div className="address-meta">
                      <span>Otwarte: 6:30–20:30</span>
                      <span>Dostępność: podjazd</span>
                    </div>
                  </div>
                  <div className="parish-card address-card">
                    <h3>Kancelaria parafialna</h3>
                    <p>ul. Dobrego Pasterza 117, pokój 2</p>
                    <div className="map-placeholder">Mapa</div>
                    <p className="note">Wejście od strony plebanii, domofon.</p>
                    <div className="address-meta">
                      <span>Pon.–Pt. 9:00–11:00</span>
                      <span>Pon.–Pt. 16:00–18:00</span>
                    </div>
                  </div>
                  <div className="parish-card address-card">
                    <h3>Kaplica adoracji</h3>
                    <p>Wejście boczne, dziedziniec</p>
                    <div className="map-placeholder">Mapa</div>
                    <p className="note">Dostępna codziennie, cisza.</p>
                    <div className="address-meta">
                      <span>8:00–19:00</span>
                      <span>Parking rowerowy</span>
                    </div>
                  </div>
                </div>
                <div className="emergency-card">
                  <div>
                    <h3>Telefon alarmowy</h3>
                    <p className="note">Pogrzeb / namaszczenie chorych</p>
                  </div>
                  <button type="button" className="cta">
                    Zadzwoń: +48 600 123 456
                  </button>
                </div>
              </section>
            )}
          </main>
          <footer className="parish-footer">
            <div className="footer-grid">
              <div className="footer-card">
                <h4>Adres parafii</h4>
                <p>ul. Dobrego Pasterza 117, 31-416 Kraków</p>
                <p className="note">Tel. +48 12 412 58 50 • parafia@janchrzciciel.eu</p>
              </div>
              <div className="footer-card">
                <h4>Godziny kancelarii</h4>
                <p>Pon.–Pt. 9:00–11:00</p>
                <p>Pon.–Pt. 16:00–18:00</p>
              </div>
              <div className="footer-card">
                <h4>Telefon alarmowy</h4>
                <p className="note">Pogrzeb / chorzy</p>
                <strong>+48 600 123 456</strong>
              </div>
              <div className="footer-card">
                <h4>Polityki</h4>
                <button type="button" className="footer-link">
                  {copy.footer.imprint}
                </button>
                <button type="button" className="footer-link">
                  {copy.footer.security}
                </button>
                <label className="language-label" htmlFor="parish-language">
                  Język
                </label>
                <select
                  id="parish-language"
                  className="parish-select"
                  value={language}
                  onChange={(event) => onLanguageChange(event.target.value as 'pl' | 'en' | 'de')}
                >
                  <option value="pl">Polski</option>
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>
            </div>
            <div className="parish-footer-brand">
              <button type="button" className="portal-brand" onClick={() => onNavigate('home')}>
                <img src="/logo_new.svg" alt="Recreatio" className="parish-footer-logo" />
              </button>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
