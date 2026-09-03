/**
 * Die Schaudaten der Pfarrseite — übernommen aus `pages/parish/ParishPage.tsx`.
 *
 * <b>Warum Schaudaten und nicht der leere Zustand.</b> Eine Pfarrseite ohne
 * Inhalt zeigt nicht, was sie ist. Man sieht ein Gerüst und muss glauben, dass
 * es einmal etwas trägt. Mit einem Messplan, drei Ankündigungen und den
 * Intentionen einer Woche sieht man in fünf Sekunden, wofür die Seite da ist —
 * und kann sagen, was daran falsch ist.
 *
 * <b>Sie stehen in einer eigenen Datei</b>, damit die Stelle, an der sie durch
 * echte Daten ersetzt werden, genau eine ist: wer `RC_PARISH_MOCK` nicht mehr
 * einführt, hat sie alle los. Verstreut im Bauteil wären sie nicht mehr
 * auffindbar, sobald der erste echte Wert danebensteht.
 *
 * Die Namen sind erfunden. Die Uhrzeiten, Orte und Formen sind es nicht — sie
 * stammen aus der alten Seite und beschreiben, wie eine Pfarrei wirklich
 * arbeitet.
 */

export type RcPageId =
  | 'start' | 'about' | 'clergy' | 'office'
  | 'announcements' | 'intentions' | 'masses' | 'calendar'
  | 'sacrament-baptism' | 'sacrament-communion' | 'sacrament-confirmation'
  | 'sacrament-marriage' | 'sacrament-funeral' | 'sacrament-sick'
  | 'contact';

export type RcMenuItem = {
  readonly label: string;
  readonly id?: RcPageId;
  readonly children?: readonly { readonly id: RcPageId; readonly label: string }[];
};

/** Die Gliederung der Seite. Zwei Ebenen, mehr braucht eine Pfarrei nicht. */
export const RC_PARISH_MENU: readonly RcMenuItem[] = [
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
      { id: 'calendar', label: 'Kalendarz' }
    ]
  },
  {
    label: 'Sakramenty',
    children: [
      { id: 'sacrament-baptism', label: 'Chrzest' },
      { id: 'sacrament-communion', label: 'I Komunia' },
      { id: 'sacrament-marriage', label: 'Małżeństwo' },
      { id: 'sacrament-funeral', label: 'Pogrzeb' },
      { id: 'sacrament-sick', label: 'Chorzy' }
    ]
  },
  { label: 'Bierzmowanie', id: 'sacrament-confirmation' },
  { label: 'Kontakt', id: 'contact' }
];

// -- Ogłoszenia ---------------------------------------------------------------

export const RC_ANNOUNCEMENTS = [
  {
    id: 'ann-1',
    title: 'Niedziela Miłosierdzia',
    date: '12 kwietnia 2025',
    excerpt: 'Zapraszamy na Koronkę do Miłosierdzia Bożego o 15:00.',
    content:
      'Zapraszamy parafian i gości do wspólnej modlitwy. Koronka o 15:00 w kościele '
      + 'głównym, po niej krótka adoracja.'
  },
  {
    id: 'ann-2',
    title: 'Rekolekcje wielkopostne',
    date: '9 kwietnia 2025',
    excerpt: 'Konferencje w piątek, sobotę i niedzielę.',
    content:
      'Rekolekcje poprowadzi ks. Adam Kowalski. Szczegóły w gablocie i na stronie. '
      + 'Spowiedź dodatkowa w sobotę od 16:00.'
  },
  {
    id: 'ann-3',
    title: 'Wsparcie dla Caritas',
    date: '6 kwietnia 2025',
    excerpt: 'Zbiórka żywności w kruchcie kościoła.',
    content:
      'W najbliższą niedzielę prowadzimy zbiórkę żywności długoterminowej. Dary można '
      + 'składać w wyznaczonych koszach od 7:00 do 13:00.'
  }
] as const;

// -- Intencje -----------------------------------------------------------------

export const RC_INTENTIONS = [
  {
    day: 'Poniedziałek • 11 marca',
    items: [
      { time: '7:00', text: 'Za + Janinę i Stanisława Nowak', priest: 'ks. Marek' },
      { time: '18:00', text: 'O zdrowie dla Katarzyny i Łukasza', priest: 'ks. Adam' }
    ]
  },
  {
    day: 'Wtorek • 12 marca',
    items: [
      { time: '7:00', text: 'Dziękczynna za rodzinę Malinowskich', priest: 'ks. Marek' },
      { time: '18:00', text: 'Za + Helenę i Józefa', priest: 'ks. Paweł' }
    ]
  },
  {
    day: 'Środa • 13 marca',
    items: [
      { time: '7:00', text: 'O pokój w rodzinie', priest: 'ks. Adam' },
      { time: '18:00', text: 'Za + Alicję i Piotra', priest: 'ks. Marek' }
    ]
  }
] as const;

// -- Msze ---------------------------------------------------------------------

export const RC_MASS_TABS = ['Sunday', 'Weekdays', 'Devotions', 'Confession'] as const;
export type RcMassTab = (typeof RC_MASS_TABS)[number];

export const RC_MASS_TAB_LABELS: Record<RcMassTab, string> = {
  Sunday: 'Niedziela',
  Weekdays: 'Dni powszednie',
  Devotions: 'Nabożeństwa',
  Confession: 'Spowiedź'
};

export const RC_MASSES: Record<RcMassTab, readonly { time: string; place: string; note: string }[]> = {
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

/** Die Ausnahmen. Sie sind der Grund, warum ein Messplan überhaupt gelesen wird. */
export const RC_EXCEPTIONS = [
  { date: '19 marca (śr.)', detail: 'Msza o 18:00 przeniesiona do kaplicy' },
  { date: '25 marca (wt.)', detail: 'Dodatkowa Msza o 20:00 (rekolekcje)' },
  { date: '31 marca (pon.)', detail: 'Brak Mszy o 7:00 — zastępstwo' }
] as const;

// -- Duszpasterze -------------------------------------------------------------

export const RC_PRIESTS = [
  {
    id: 'pr-1',
    name: 'ks. Adam Kowalski',
    role: 'Proboszcz',
    bio: 'Duszpasterz rodzin, prowadzi katechezy dla narzeczonych.',
    hours: 'Pon.–Pt. 10:00–12:00'
  },
  {
    id: 'pr-2',
    name: 'ks. Marek Nowak',
    role: 'Wikariusz',
    bio: 'Opiekun ministrantów i chóru.',
    hours: 'Wt., Czw. 16:00–18:00'
  },
  {
    id: 'pr-3',
    name: 'ks. Paweł Zieliński',
    role: 'Rezydent',
    bio: 'Duszpasterz chorych i seniorów.',
    hours: 'Pon. 12:00–14:00'
  }
] as const;

// -- Kalendarz ----------------------------------------------------------------

export const RC_EVENTS = [
  {
    id: 'evt-1',
    title: 'Katecheza dla narzeczonych',
    date: '16 marca 2025',
    time: '19:00',
    place: 'Sala Jana Pawła II',
    category: 'Formacja'
  },
  {
    id: 'evt-2',
    title: 'Spotkanie ministrantów',
    date: '18 marca 2025',
    time: '17:00',
    place: 'Salka przy zakrystii',
    category: 'Wspólnoty'
  },
  {
    id: 'evt-3',
    title: 'Adoracja Najświętszego Sakramentu',
    date: '21 marca 2025',
    time: '20:00',
    place: 'Kościół główny',
    category: 'Modlitwa'
  }
] as const;
