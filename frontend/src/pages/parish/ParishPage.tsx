import { useMemo, useState } from 'react';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';

type PortalMode = 'public' | 'user' | 'admin';
type ThemePreset = 'classic' | 'minimal' | 'warm';
type PublicPage =
  | 'home'
  | 'masses'
  | 'intentions'
  | 'announcements'
  | 'calendar'
  | 'clergy'
  | 'groups'
  | 'sacraments'
  | 'koleda'
  | 'contact';
type AdminPage =
  | 'dashboard'
  | 'calendar-rooms'
  | 'intentions'
  | 'announcements'
  | 'koleda'
  | 'groups'
  | 'priests'
  | 'locations'
  | 'settings';

type ParishOption = {
  id: string;
  name: string;
  location: string;
  logo: string;
  heroImage: string;
  theme: ThemePreset;
};

const parishes: ParishOption[] = [
  {
    id: 'st-john',
    name: 'Parafia pw. św. Jana Chrzciciela',
    location: 'Kraków • Prądnik',
    logo: '/logo_new.svg',
    heroImage: '/parish/visit.jpg',
    theme: 'classic'
  },
  {
    id: 'holy-family',
    name: 'Parafia Najświętszej Rodziny',
    location: 'Nowa Huta',
    logo: '/logo_new.svg',
    heroImage: '/parish/pursuit_saint.jpg',
    theme: 'warm'
  },
  {
    id: 'st-mary',
    name: 'Parafia Mariacka',
    location: 'Stare Miasto',
    logo: '/logo_new.svg',
    heroImage: '/parish/minister.jpg',
    theme: 'minimal'
  }
];

const publicNav: { id: PublicPage; label: string }[] = [
  { id: 'home', label: 'Strona główna' },
  { id: 'masses', label: 'Msze i nabożeństwa' },
  { id: 'intentions', label: 'Intencje' },
  { id: 'announcements', label: 'Ogłoszenia' },
  { id: 'calendar', label: 'Kalendarz' },
  { id: 'clergy', label: 'Duchowieństwo' },
  { id: 'groups', label: 'Grupy' },
  { id: 'sacraments', label: 'Sakramenty' },
  { id: 'koleda', label: 'Kolęda' },
  { id: 'contact', label: 'Kontakt' }
];

const adminNav: { id: AdminPage; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'calendar-rooms', label: 'Kalendarz i sale' },
  { id: 'intentions', label: 'Intencje' },
  { id: 'announcements', label: 'Ogłoszenia' },
  { id: 'koleda', label: 'Kolęda' },
  { id: 'groups', label: 'Grupy i osoby' },
  { id: 'priests', label: 'Duchowieństwo' },
  { id: 'locations', label: 'Lokalizacje' },
  { id: 'settings', label: 'Ustawienia' }
];

const todayStrip = [
  { label: 'Msze dzisiaj', value: '7:00, 18:00' },
  { label: 'Spowiedź', value: '17:15–17:45' },
  { label: 'Adoracja', value: '19:00–20:00' },
  { label: 'Kancelaria', value: '9:00–11:00' },
  { label: 'Telefon alarmowy', value: '+48 600 123 456' }
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

const groups = [
  {
    id: 'gr-1',
    name: 'Schola dziecięca',
    category: 'Muzyka',
    cadence: 'Co tydzień, sobota 10:00',
    location: 'Sala muzyczna',
    priest: 'ks. Marek',
    roles: ['lider', 'animator', 'członek'],
    desc: 'Grupa śpiewająca podczas liturgii rodzinnych.'
  },
  {
    id: 'gr-2',
    name: 'Wspólnota młodzieży',
    category: 'Formacja',
    cadence: 'Co tydzień, piątek 19:30',
    location: 'Salki duszpasterskie',
    priest: 'ks. Adam',
    roles: ['lider', 'mentor', 'członek'],
    desc: 'Spotkania modlitewne i tematyczne.'
  },
  {
    id: 'gr-3',
    name: 'Krąg biblijny',
    category: 'Słowo',
    cadence: 'Co dwa tygodnie, środa 19:00',
    location: 'Biblioteka parafialna',
    priest: 'ks. Paweł',
    roles: ['prowadzący', 'uczestnik'],
    desc: 'Wspólne czytanie i rozważanie Pisma Świętego.'
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

export function ParishPage({
  copy,
  onAuthAction,
  authLabel,
  showProfileMenu,
  onProfileNavigate,
  onToggleSecureMode,
  onLogout,
  secureMode,
  onNavigate,
  language,
  onLanguageChange
}: {
  copy: Copy;
  onAuthAction: () => void;
  authLabel: string;
  showProfileMenu: boolean;
  onProfileNavigate: () => void;
  onToggleSecureMode: () => void;
  onLogout: () => void;
  secureMode: boolean;
  onNavigate: (route: RouteKey) => void;
  language: 'pl' | 'en' | 'de';
  onLanguageChange: (language: 'pl' | 'en' | 'de') => void;
}) {
  const [mode, setMode] = useState<PortalMode>('public');
  const [activePage, setActivePage] = useState<PublicPage>('home');
  const [adminPage, setAdminPage] = useState<AdminPage>('dashboard');
  const [parishId, setParishId] = useState(parishes[0].id);
  const [theme, setTheme] = useState<ThemePreset>(parishes[0].theme);
  const [massTab, setMassTab] = useState<keyof typeof massesTables>('Sunday');
  const [announcementId, setAnnouncementId] = useState(announcements[0].id);
  const [calendarView, setCalendarView] = useState<'month' | 'agenda'>('month');
  const [selectedEventId, setSelectedEventId] = useState(calendarEvents[0].id);
  const [selectedPriestId, setSelectedPriestId] = useState(priests[0].id);
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0].id);
  const [selectedSacramentId, setSelectedSacramentId] = useState(sacraments[0].id);
  const [profileOpen, setProfileOpen] = useState(false);

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
  const selectedGroup = useMemo(() => groups.find((item) => item.id === selectedGroupId) ?? groups[0], [selectedGroupId]);
  const selectedSacrament = useMemo(
    () => sacraments.find((item) => item.id === selectedSacramentId) ?? sacraments[0],
    [selectedSacramentId]
  );

  const handleModeChange = (next: PortalMode) => {
    setMode(next);
    if (next === 'admin') {
      setAdminPage('dashboard');
    } else {
      setActivePage('home');
    }
  };

  const handleParishChange = (nextId: string) => {
    const nextParish = parishes.find((item) => item.id === nextId) ?? parishes[0];
    setParishId(nextParish.id);
    setTheme(nextParish.theme);
  };

  const profileLabel = showProfileMenu ? copy.nav.account : authLabel;

  return (
    <div className={`parish-portal theme-${theme} mode-${mode}`} lang={language}>
      {mode !== 'admin' ? (
        <>
          <header className="parish-header">
            <button type="button" className="parish-brand" onClick={() => onNavigate('home')}>
              <img src={parish.logo} alt={copy.loginCard.title} />
              <div>
                <span className="parish-name">{parish.name}</span>
                <span className="parish-location">{parish.location}</span>
              </div>
            </button>
            <nav className="parish-nav" aria-label={copy.nav.parish}>
              {publicNav.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === activePage ? 'is-active' : undefined}
                  onClick={() => setActivePage(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="parish-controls">
              <div className="mode-switch" role="group" aria-label="Tryb portalu">
                {(['public', 'user', 'admin'] as PortalMode[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={mode === item ? 'is-active' : undefined}
                    onClick={() => handleModeChange(item)}
                  >
                    {item === 'public' ? 'Public' : item === 'user' ? 'User' : 'Admin'}
                  </button>
                ))}
              </div>
              <select
                className="parish-select"
                value={parishId}
                onChange={(event) => handleParishChange(event.target.value)}
              >
                {parishes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select className="parish-select" value={theme} onChange={(event) => setTheme(event.target.value as ThemePreset)}>
                <option value="classic">Klasyczny</option>
                <option value="minimal">Minimal</option>
                <option value="warm">Ciepły</option>
              </select>
              <button type="button" className="parish-icon-button" aria-label="Wyszukaj">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
              </button>
              <div className={`parish-profile ${profileOpen ? 'open' : ''}`}>
                <button
                  type="button"
                  className="parish-profile-button"
                  onClick={() => {
                    if (showProfileMenu) {
                      setProfileOpen((open) => !open);
                    } else {
                      onAuthAction();
                    }
                  }}
                >
                  {profileLabel}
                </button>
                {showProfileMenu && (
                  <div className="parish-profile-menu">
                    <button type="button" onClick={onProfileNavigate}>
                      {copy.accountMenu.profile}
                    </button>
                    <button type="button" onClick={onToggleSecureMode}>
                      {secureMode ? copy.accountMenu.secureModeOff : copy.accountMenu.secureModeOn}
                    </button>
                    <button type="button" onClick={onLogout}>
                      {copy.accountMenu.logout}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>
          <main className="parish-main">
            {activePage === 'home' && (
              <>
                <section className="parish-hero">
                  <div className="parish-hero-media">
                    <img src={parish.heroImage} alt="Wnętrze kościoła" />
                    <div className="parish-hero-tag">
                      <p className="tag">Ten tydzień</p>
                      <h1>Wspólnota, która modli się razem</h1>
                      <p className="lead">
                        Aktualne godziny Mszy, intencje, wydarzenia i sprawy kancelaryjne. Wszystko w jednym miejscu.
                      </p>
                    </div>
                  </div>
                  <div className="parish-hero-side">
                    <div className="parish-card next-mass">
                      <span className="section-label">Najbliższa Msza</span>
                      <h3>Środa, 13 marca • 18:00</h3>
                      <p className="note">Kościół główny • Nawa boczna</p>
                      <div className="chip-row">
                        <span className="chip">ks. Marek Nowak</span>
                        <span className="chip">Msza wieczorna</span>
                      </div>
                      <button type="button" className="cta ghost">
                        Dodaj do kalendarza
                      </button>
                    </div>
                    <div className="today-strip">
                      {todayStrip.map((item) => (
                        <div key={item.label} className="today-chip">
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
                <section className="parish-section two-column">
                  <div className="column">
                    <div className="parish-card">
                      <div className="section-header">
                        <h2>Ogłoszenia — najnowsze</h2>
                        <button type="button" className="ghost" onClick={() => setActivePage('announcements')}>
                          Wszystkie ogłoszenia
                        </button>
                      </div>
                      <div className="stack">
                        {announcements.map((item) => (
                          <article key={item.id} className="announcement-card">
                            <p className="date">{item.date}</p>
                            <h3>{item.title}</h3>
                            <p className="note">{item.excerpt}</p>
                          </article>
                        ))}
                      </div>
                    </div>
                    <div className="parish-card">
                      <div className="section-header">
                        <h2>Nadchodzące 14 dni</h2>
                        <span className="muted">Aktualizacja: 12 marca</span>
                      </div>
                      <ul className="event-list">
                        {upcomingEvents.map((event) => (
                          <li key={event.title}>
                            <div>
                              <strong>{event.title}</strong>
                              <span>{event.place}</span>
                            </div>
                            <div className="event-meta">
                              <span className="pill">{event.tag}</span>
                              <span>{event.date}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <div className="skeleton-row">
                        <div className="skeleton block" />
                        <div className="skeleton block" />
                      </div>
                    </div>
                  </div>
                  <div className="column">
                    <div className="parish-card">
                      <div className="section-header">
                        <h2>Intencje na tydzień</h2>
                        <button type="button" className="ghost" onClick={() => setActivePage('intentions')}>
                          Przejdź do intencji
                        </button>
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
                                </div>
                              ))}
                            </div>
                          </details>
                        ))}
                      </div>
                    </div>
                    <div className="parish-card live-card">
                      <div>
                        <p className="tag">Live / Stream</p>
                        <h3>Najbliższa transmisja: Niedziela 9:00</h3>
                        <p className="note">Link pojawi się 10 minut przed rozpoczęciem.</p>
                        <button type="button" className="cta ghost">
                          Powiadom mnie
                        </button>
                      </div>
                      <div className="live-player">
                        <img src="/parish/minister.jpg" alt="Podgląd transmisji" />
                        <span className="live-badge">Live</span>
                      </div>
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
                      <button key={action.label} type="button" className="quick-card">
                        <span className="quick-icon">{action.icon}</span>
                        <div>
                          <strong>{action.label}</strong>
                          <span>{action.detail}</span>
                        </div>
                      </button>
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
                  {mode === 'user' && (
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
                  )}
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
            {activePage === 'groups' && (
              <section className="parish-section groups-page">
                <div className="section-header">
                  <div>
                    <p className="tag">Grupy i wspólnoty</p>
                    <h2>Katalog wspólnot</h2>
                  </div>
                  <div className="filters">
                    <select className="parish-select">
                      <option>Wszystkie kategorie</option>
                      <option>Muzyka</option>
                      <option>Formacja</option>
                      <option>Słowo</option>
                    </select>
                    <select className="parish-select">
                      <option>Wszystkie dni</option>
                      <option>Piątek</option>
                      <option>Sobota</option>
                      <option>Środa</option>
                    </select>
                  </div>
                </div>
                <div className="groups-layout">
                  <div className="parish-card group-list">
                    {groups.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        className={group.id === selectedGroupId ? 'is-active' : undefined}
                        onClick={() => setSelectedGroupId(group.id)}
                      >
                        <strong>{group.name}</strong>
                        <span>{group.category}</span>
                        <p className="note">{group.cadence}</p>
                      </button>
                    ))}
                  </div>
                  <article className="parish-card group-detail">
                    <div className="section-header">
                      <h3>{selectedGroup.name}</h3>
                      <span className="pill">{selectedGroup.category}</span>
                    </div>
                    <p>{selectedGroup.desc}</p>
                    <div className="detail-grid">
                      <div>
                        <span className="label">Kadencja spotkań</span>
                        <strong>{selectedGroup.cadence}</strong>
                      </div>
                      <div>
                        <span className="label">Miejsce</span>
                        <strong>{selectedGroup.location}</strong>
                      </div>
                      <div>
                        <span className="label">Opiekun</span>
                        <strong>{selectedGroup.priest}</strong>
                      </div>
                    </div>
                    <div className="chip-row">
                      {selectedGroup.roles.map((role) => (
                        <span key={role} className="chip">
                          {role}
                        </span>
                      ))}
                    </div>
                  </article>
                </div>
              </section>
            )}
            {activePage === 'sacraments' && (
              <section className="parish-section sacraments-page">
                <div className="section-header">
                  <div>
                    <p className="tag">Sakramenty</p>
                    <h2>Zacznij od zadania</h2>
                  </div>
                  <span className="muted">Wybierz sakrament, aby zobaczyć kroki</span>
                </div>
                <div className="sacrament-grid">
                  {sacraments.map((sacrament) => (
                    <button
                      key={sacrament.id}
                      type="button"
                      className={sacrament.id === selectedSacramentId ? 'is-active' : undefined}
                      onClick={() => setSelectedSacramentId(sacrament.id)}
                    >
                      <img src={sacrament.img} alt={sacrament.title} />
                      <strong>{sacrament.title}</strong>
                    </button>
                  ))}
                </div>
                <div className="parish-card sacrament-detail">
                  <div className="section-header">
                    <h3>{selectedSacrament.title}</h3>
                    <button type="button" className="ghost">
                      Kontakt
                    </button>
                  </div>
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
                      <h4>Kancelaria parafialna</h4>
                      <p className="note">Pon.–Pt. 9:00–11:00, 16:00–18:00</p>
                      <button type="button" className="cta">
                        Umów spotkanie
                      </button>
                    </div>
                  </div>
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
                  {mode === 'user' && (
                    <aside className="parish-card my-area">
                      <h3>Moja okolica</h3>
                      <p className="note">Os. Zielone 12–24 — 7 stycznia</p>
                      <button type="button" className="cta ghost">
                        Zobacz trasę
                      </button>
                    </aside>
                  )}
                </div>
              </section>
            )}
            {activePage === 'contact' && (
              <section className="parish-section contact-page">
                <div className="section-header">
                  <div>
                    <p className="tag">Kontakt i kancelaria</p>
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
          </footer>
          <nav className="parish-bottom-nav">
            {[
              { id: 'home', label: 'Home' },
              { id: 'masses', label: 'Msze' },
              { id: 'intentions', label: 'Intencje' },
              { id: 'calendar', label: 'Kalendarz' },
              { id: 'more', label: 'Więcej' }
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === activePage ? 'is-active' : undefined}
                onClick={() => {
                  if (item.id === 'more') setActivePage('contact');
                  else setActivePage(item.id as PublicPage);
                }}
              >
                <span className="bottom-icon">{item.label[0]}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </>
      ) : (
        <div className="admin-shell">
          <aside className="admin-sidebar">
            <div className="admin-brand">
              <img src={parish.logo} alt={copy.loginCard.title} />
              <div>
                <strong>{parish.name}</strong>
                <span>{parish.location}</span>
              </div>
            </div>
            <nav>
              {adminNav.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === adminPage ? 'is-active' : undefined}
                  onClick={() => setAdminPage(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>
          <div className="admin-main">
            <header className="admin-header">
              <div>
                <p className="tag">Panel administratora</p>
                <h2>{adminNav.find((item) => item.id === adminPage)?.label}</h2>
              </div>
              <div className="admin-controls">
                <div className="mode-switch">
                  {(['public', 'user', 'admin'] as PortalMode[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={mode === item ? 'is-active' : undefined}
                      onClick={() => handleModeChange(item)}
                    >
                      {item === 'public' ? 'Public' : item === 'user' ? 'User' : 'Admin'}
                    </button>
                  ))}
                </div>
                <button type="button" className="ghost">
                  Eksportuj
                </button>
              </div>
            </header>
            <div className="admin-content">
              {adminPage === 'dashboard' && (
                <section className="admin-grid">
                  <div className="admin-card">
                    <h3>Ogłoszenia</h3>
                    <p className="stat">12 aktywnych</p>
                    <span className="muted">Ostatnia zmiana: 2 godz. temu</span>
                  </div>
                  <div className="admin-card">
                    <h3>Intencje</h3>
                    <p className="stat">34 wpisy</p>
                    <span className="muted">8 nowych zgłoszeń</span>
                  </div>
                  <div className="admin-card">
                    <h3>Sale</h3>
                    <p className="stat">6 zasobów</p>
                    <span className="muted">2 konflikty</span>
                  </div>
                  <div className="admin-card wide">
                    <h3>Ostatnie zmiany</h3>
                    <ul>
                      <li>Dodano ogłoszenie: Rekolekcje wielkopostne</li>
                      <li>Zmieniono plan kolędy — Os. Zielone</li>
                      <li>Nowe zgłoszenie intencji — 17 marca</li>
                    </ul>
                  </div>
                </section>
              )}
              {adminPage === 'calendar-rooms' && (
                <section className="admin-split">
                  <div className="admin-card">
                    <h3>Kalendarz tygodniowy</h3>
                    <div className="admin-week">
                      {['Pon', 'Wt', 'Śr', 'Czw', 'Pt'].map((day) => (
                        <div key={day} className="admin-day">
                          <strong>{day}</strong>
                          <span>8:00 — Msza</span>
                          <span>17:00 — Próba chóru</span>
                        </div>
                      ))}
                    </div>
                    <div className="template-cards">
                      <div>
                        <strong>Szablon tygodnia</strong>
                        <p className="note">Msze: Pon–Pt 7:00, 18:00</p>
                      </div>
                      <button type="button" className="ghost">
                        Dodaj wyjątek
                      </button>
                    </div>
                  </div>
                  <div className="admin-card">
                    <h3>Obłożenie sal</h3>
                    <div className="room-timeline">
                      <span>Sala JP2</span>
                      <div className="timeline-bar">
                        <span className="fill" />
                      </div>
                      <span>Kaplica</span>
                      <div className="timeline-bar">
                        <span className="fill light" />
                      </div>
                      <span>Sala muzyczna</span>
                      <div className="timeline-bar">
                        <span className="fill" />
                      </div>
                    </div>
                  </div>
                </section>
              )}
              {adminPage === 'intentions' && (
                <section className="admin-split">
                  <div className="admin-card">
                    <h3>Skrzynka intencji</h3>
                    <ul className="admin-list">
                      <li>
                        <strong>Nowa intencja</strong>
                        <span>17 marca, 7:00</span>
                      </li>
                      <li>
                        <strong>Do korekty</strong>
                        <span>19 marca, 18:00</span>
                      </li>
                      <li>
                        <strong>Potwierdzona</strong>
                        <span>21 marca, 7:00</span>
                      </li>
                    </ul>
                    <button type="button" className="ghost">
                      Drukuj plan tygodnia
                    </button>
                  </div>
                  <div className="admin-card">
                    <h3>Planer tygodniowy</h3>
                    <div className="planner-grid">
                      {['Pon', 'Wt', 'Śr', 'Czw', 'Pt'].map((day) => (
                        <div key={day} className="planner-day">
                          <strong>{day}</strong>
                          <span className="pill">7:00</span>
                          <span className="pill">18:00</span>
                        </div>
                      ))}
                    </div>
                    <div className="drag-hint">Przeciągnij intencje (mock)</div>
                  </div>
                </section>
              )}
              {adminPage === 'announcements' && (
                <section className="admin-split">
                  <div className="admin-card">
                    <h3>Edytor ogłoszeń</h3>
                    <input type="text" placeholder="Tytuł ogłoszenia" />
                    <textarea placeholder="Treść ogłoszenia" rows={6} />
                    <div className="admin-row">
                      <label>Publikacja</label>
                      <input type="date" />
                    </div>
                    <button type="button" className="cta">
                      Zapisz szkic
                    </button>
                  </div>
                  <div className="admin-card">
                    <h3>Podgląd</h3>
                    <article className="preview">
                      <strong>Nowe ogłoszenie</strong>
                      <p className="note">Podgląd treści ogłoszenia, gotowy do publikacji.</p>
                    </article>
                    <div className="schedule">
                      <span>Zaplanowano: 18 marca 2025</span>
                      <span className="pill">W kolejce</span>
                    </div>
                  </div>
                </section>
              )}
              {adminPage === 'koleda' && (
                <section className="admin-card">
                  <h3>Widok ministra</h3>
                  <div className="minister-view">
                    <div>
                      <strong>Trasa</strong>
                      <p>Os. Zielone 12–24</p>
                    </div>
                    <div>
                      <strong>Przydział</strong>
                      <p>ks. Marek • 7 stycznia • 16:00–20:00</p>
                    </div>
                    <div>
                      <strong>Notatki</strong>
                      <p>Uwaga na blok 18, wejście od podwórza.</p>
                    </div>
                  </div>
                </section>
              )}
              {adminPage === 'groups' && (
                <section className="admin-split">
                  <div className="admin-card">
                    <h3>Nowa grupa</h3>
                    <input type="text" placeholder="Nazwa grupy" />
                    <select>
                      <option>Kategoria</option>
                      <option>Muzyka</option>
                      <option>Formacja</option>
                    </select>
                    <input type="text" placeholder="Opiekun (ksiądz)" />
                    <div className="chip-row">
                      <span className="chip">lider</span>
                      <span className="chip">animator</span>
                      <span className="chip">członek</span>
                    </div>
                    <button type="button" className="cta ghost">
                      Zapisz
                    </button>
                  </div>
                  <div className="admin-card">
                    <h3>Uczestnicy</h3>
                    <ul className="admin-list">
                      <li>
                        <strong>Anna Nowak</strong>
                        <span className="pill">lider</span>
                      </li>
                      <li>
                        <strong>Piotr Zieliński</strong>
                        <span className="pill">członek</span>
                      </li>
                    </ul>
                  </div>
                </section>
              )}
              {adminPage === 'priests' && (
                <section className="admin-card">
                  <h3>Lista kapłanów</h3>
                  <div className="admin-list">
                    {priests.map((priest) => (
                      <div key={priest.id} className="admin-list-item">
                        <img src={priest.img} alt={priest.name} />
                        <div>
                          <strong>{priest.name}</strong>
                          <span>{priest.role}</span>
                        </div>
                        <button type="button" className="ghost">
                          Edytuj
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {adminPage === 'locations' && (
                <section className="admin-card">
                  <h3>Lokalizacje parafii</h3>
                  <div className="admin-list">
                    {parishLocations.map((location) => (
                      <div key={location.title} className="admin-list-item">
                        <div>
                          <strong>{location.title}</strong>
                          <span>{location.address}</span>
                        </div>
                        <button type="button" className="ghost">
                          Edytuj kartę
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {adminPage === 'settings' && (
                <section className="admin-card settings">
                  <h3>Ustawienia wyglądu</h3>
                  <div className="settings-grid">
                    {(['classic', 'minimal', 'warm'] as ThemePreset[]).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`theme-tile ${theme === preset ? 'is-active' : ''}`}
                        onClick={() => setTheme(preset)}
                      >
                        <span>{preset === 'classic' ? 'Klasyczny' : preset === 'minimal' ? 'Minimal' : 'Ciepły'}</span>
                        <div className={`theme-preview ${preset}`} />
                      </button>
                    ))}
                  </div>
                  <div className="settings-row">
                    <div>
                      <strong>Logo parafii</strong>
                      <p className="note">Dodaj wersję jasną i ciemną.</p>
                    </div>
                    <button type="button" className="ghost">
                      Prześlij logo
                    </button>
                  </div>
                  <div className="settings-row">
                    <div>
                      <strong>Kolory przewodnie</strong>
                      <p className="note">Wybierz akcent i kolor tła.</p>
                    </div>
                    <button type="button" className="ghost">
                      Edytuj paletę
                    </button>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
