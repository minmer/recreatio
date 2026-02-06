import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, Dispatch, SetStateAction, PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent
} from '@dnd-kit/core';
import {
  createParishSite,
  createParishIntention,
  createParishMass,
  getParishPublicIntentions,
  getParishPublicMasses,
  getParishSite,
  listParishes,
  updateParishSite,
  type ParishHomepageConfig,
  type ParishLayoutItem,
  type ParishPublicIntention,
  type ParishPublicMass,
  type ParishSummary
} from '../../lib/api';

type ThemePreset = 'classic' | 'minimal' | 'warm';
type ModuleWidth = 'one-third' | 'one-half' | 'two-thirds' | 'full';
type ModuleHeight = 'one' | 'three' | 'five';

const HOME_GAP = 16;
const EDITOR_GAP = 0;
const allowedColSpans = [2, 3, 4, 6];
const snapColSpan = (value: number, columns: number) => {
  const candidates = allowedColSpans.filter((span) => span <= columns);
  if (candidates.length === 0) return columns;
  return candidates.reduce((closest, current) =>
    Math.abs(current - value) < Math.abs(closest - value) ? current : closest
  );
};
const snapRowSpan = (value: number) => {
  if (value <= 2) return 1;
  if (value <= 4) return 3;
  return 5;
};
const MIN_COL_SPAN = 2;
const MIN_ROW_SPAN = 1;
const MAX_ROW_SPAN = 5;
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

const parishSeed: ParishOption[] = [
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

const parishModuleCatalog: { type: string; label: string; width: ModuleWidth; height: ModuleHeight }[] = [
  { type: 'intentions', label: 'Intencje', width: 'one-half', height: 'three' },
  { type: 'sticky', label: 'Sticky', width: 'one-third', height: 'one' },
  { type: 'hours', label: 'Godziny', width: 'one-third', height: 'one' },
  { type: 'news', label: 'News', width: 'one-half', height: 'three' },
  { type: 'announcements', label: 'Ogłoszenia', width: 'one-third', height: 'three' },
  { type: 'calendar', label: 'Kalendarz', width: 'two-thirds', height: 'five' },
  { type: 'masses', label: 'Msze', width: 'two-thirds', height: 'one' },
  { type: 'groups', label: 'Grupy', width: 'one-half', height: 'three' },
  { type: 'events', label: 'Wydarzenia', width: 'one-half', height: 'three' },
  { type: 'sacraments', label: 'Sakramenty', width: 'one-half', height: 'three' },
  { type: 'contact', label: 'Kontakt', width: 'one-third', height: 'one' },
  { type: 'gallery', label: 'Galeria', width: 'two-thirds', height: 'three' }
];

const defaultHomepageConfig: ParishHomepageConfig = {
  modules: parishModuleCatalog.slice(0, 4).map((module, index) => ({
    id: `seed-${module.type}`,
    type: module.type,
    position: { row: 1 + index * 3, col: 1 },
    size: { colSpan: 3, rowSpan: 3 },
    props: { title: module.label }
  }))
};

const placeItems = (items: ParishLayoutItem[], columns: number) => {
  const occupied = new Map<string, boolean>();
  const next: ParishLayoutItem[] = [];
  items.forEach((item) => {
    let startRow = Math.max(1, item.position.row);
    let startCol = Math.max(1, Math.min(item.position.col, columns));
    const colSpan = snapColSpan(item.size.colSpan, columns);
    const rowSpan = snapRowSpan(item.size.rowSpan);
    let placed = false;
    let row = startRow;
    let col = startCol;
    while (!placed) {
      if (col + colSpan - 1 > columns) {
        col = 1;
        row += 1;
      }
      let overlap = false;
      for (let r = row; r < row + rowSpan; r += 1) {
        for (let c = col; c < col + colSpan; c += 1) {
          if (occupied.get(`${r}:${c}`)) overlap = true;
        }
      }
      if (!overlap) {
        for (let r = row; r < row + rowSpan; r += 1) {
          for (let c = col; c < col + colSpan; c += 1) {
            occupied.set(`${r}:${c}`, true);
          }
        }
        next.push({
          ...item,
          position: { row, col },
          size: { colSpan, rowSpan }
        });
        placed = true;
      } else {
        col += 1;
      }
    }
  });
  return next;
};

const normalizeLayoutItems = (items: ParishLayoutItem[], columns: number) => {
  const normalized = items.map((item) => ({
    ...item,
    position: {
      row: Math.max(1, item.position.row),
      col: Math.max(1, Math.min(item.position.col, columns))
    },
    size: {
      colSpan: snapColSpan(item.size.colSpan, columns),
      rowSpan: snapRowSpan(item.size.rowSpan)
    }
  }));
  return placeItems(normalized, columns);
};

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
  isAuthenticated,
  onNavigate,
  language,
  onLanguageChange,
  parishSlug
}: {
  copy: Copy;
  onAuthAction: () => void;
  authLabel: string;
  isAuthenticated: boolean;
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
  const [parishOptions, setParishOptions] = useState<ParishOption[]>(parishSeed);
  const [parishId, setParishId] = useState(parishSeed[0].id);
  const [theme, setTheme] = useState<ThemePreset>(parishSeed[0].theme);
  const [massTab, setMassTab] = useState<keyof typeof massesTables>('Sunday');
  const [announcementId, setAnnouncementId] = useState(announcements[0].id);
  const [calendarView, setCalendarView] = useState<'month' | 'agenda'>('month');
  const [selectedEventId, setSelectedEventId] = useState(calendarEvents[0].id);
  const [selectedPriestId, setSelectedPriestId] = useState(priests[0].id);
  const [selectedSacramentId, setSelectedSacramentId] = useState(sacraments[0].id);
  const [view, setView] = useState<'chooser' | 'parish' | 'builder'>(
    parishSlug ? 'parish' : 'chooser'
  );

  const parish = useMemo(
    () => parishOptions.find((item) => item.id === parishId) ?? parishOptions[0],
    [parishId, parishOptions]
  );
  const [builderStep, setBuilderStep] = useState(0);
  const [builderName, setBuilderName] = useState('');
  const [builderLocation, setBuilderLocation] = useState('');
  const [builderSlug, setBuilderSlug] = useState('');
  const [builderSlugTouched, setBuilderSlugTouched] = useState(false);
  const [builderTheme, setBuilderTheme] = useState<ThemePreset>('classic');
  const [builderLayoutItems, setBuilderLayoutItems] = useState<ParishLayoutItem[]>([]);
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [siteConfig, setSiteConfig] = useState<ParishHomepageConfig | null>(null);
  const [publicIntentions, setPublicIntentions] = useState<ParishPublicIntention[]>([]);
  const [publicMasses, setPublicMasses] = useState<ParishPublicMass[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editLayoutItems, setEditLayoutItems] = useState<ParishLayoutItem[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [newIntentionDate, setNewIntentionDate] = useState('');
  const [newIntentionChurch, setNewIntentionChurch] = useState('');
  const [newIntentionText, setNewIntentionText] = useState('');
  const [newIntentionInternal, setNewIntentionInternal] = useState('');
  const [newMassDate, setNewMassDate] = useState('');
  const [newMassChurch, setNewMassChurch] = useState('');
  const [newMassTitle, setNewMassTitle] = useState('');
  const [newMassNote, setNewMassNote] = useState('');
  const [adminFormError, setAdminFormError] = useState<string | null>(null);
  const baseColumns = 6;
  const [gridColumns, setGridColumns] = useState(baseColumns);
  const [gridRowHeight, setGridRowHeight] = useState(90);
  const homeGridRef = useRef<HTMLDivElement | null>(null);
  const editorGridRef = useRef<HTMLDivElement | null>(null);
  const [selectedBuilderId, setSelectedBuilderId] = useState<string | null>(null);
  const [selectedEditId, setSelectedEditId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{
    layout: 'builder' | 'edit' | null;
    activeId: string | null;
    activeType: 'palette' | 'item' | null;
    activeItemId: string | null;
    size: { colSpan: number; rowSpan: number } | null;
    overCell: { row: number; col: number } | null;
    overValid: boolean;
  }>({
    layout: null,
    activeId: null,
    activeType: null,
    activeItemId: null,
    size: null,
    overCell: null,
    overValid: false
  });
  useEffect(() => {
    setBuilderLayoutItems(normalizeLayoutItems(defaultHomepageConfig.modules, baseColumns));
  }, [baseColumns]);
  const [resizeState, setResizeState] = useState<{
    layout: 'builder' | 'edit';
    itemId: string;
    originColStart: number;
    originColEnd: number;
    originRowStart: number;
    originRowEnd: number;
    gridLeft: number;
    gridTop: number;
    cellWidth: number;
    rowHeight: number;
    handle:
      | 'left'
      | 'right'
      | 'top'
      | 'bottom'
      | 'top-left'
      | 'top-right'
      | 'bottom-left'
      | 'bottom-right';
  } | null>(null);
  const normalizeSlug = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  const canCreateParish =
    builderName.trim().length > 0 &&
    builderSlug.trim().length > 0 &&
    builderLayoutItems.length > 0;

  const handleStartBuilder = () => {
    setBuilderStep(0);
    setBuilderName('');
    setBuilderLocation('');
    setBuilderSlug('');
    setBuilderSlugTouched(false);
    setBuilderTheme('classic');
    setBuilderLayoutItems(normalizeLayoutItems(defaultHomepageConfig.modules, baseColumns));
    setBuilderError(null);
    setView('builder');
  };

  const handleBuilderNameChange = (value: string) => {
    setBuilderName(value);
    if (!builderSlugTouched) {
      setBuilderSlug(normalizeSlug(value));
    }
  };

  const handleBuilderSlugChange = (value: string) => {
    setBuilderSlugTouched(true);
    setBuilderSlug(normalizeSlug(value));
  };


  const handleCreateParishSite = async () => {
    if (!canCreateParish) return;
    setBuilderError(null);
    try {
      const homepage = {
        modules: builderLayoutItems
      };
      const created = await createParishSite({
        name: builderName.trim(),
        location: builderLocation.trim(),
        slug: builderSlug.trim(),
        theme: builderTheme,
        heroImageUrl: null,
        homepage
      });
      const newParish: ParishOption = {
        id: created.id,
        slug: created.slug,
        name: created.name,
        location: created.location,
        logo: '/parish/logo.svg',
        heroImage: created.heroImageUrl ?? '/parish/visit.jpg',
        theme: (created.theme as ThemePreset) ?? 'classic'
      };
      setParishOptions((current) => [...current, newParish]);
      setParishId(created.id);
      setTheme((created.theme as ThemePreset) ?? builderTheme);
      setSiteConfig(created.homepage);
      setActivePage('start');
      setView('parish');
      navigate(`/parish/${created.slug}`);
    } catch (error) {
      setBuilderError('Nie udało się utworzyć strony. Spróbuj ponownie.');
    }
  };

  useEffect(() => {
    let mounted = true;
    listParishes()
      .then((items: ParishSummary[]) => {
        if (!mounted || items.length === 0) return;
        const mapped = items.map((item) => ({
          id: item.id,
          slug: item.slug,
          name: item.name,
          location: item.location,
          logo: '/parish/logo.svg',
          heroImage: item.heroImageUrl ?? '/parish/visit.jpg',
          theme: (item.theme as ThemePreset) ?? 'classic'
        }));
        setParishOptions(mapped);
        if (!parishSlug && mapped[0]) {
          setParishId(mapped[0].id);
          setTheme(mapped[0].theme);
        }
      })
      .catch(() => {
        setParishOptions(parishSeed);
      });
    return () => {
      mounted = false;
    };
  }, [parishSlug]);

  useEffect(() => {
    const resolveColumns = () => {
      if (typeof window === 'undefined') return;
      const width = window.innerWidth;
      if (width < 720) {
        setGridColumns(2);
      } else if (width < 980) {
        setGridColumns(4);
      } else {
        setGridColumns(6);
      }
    };
    resolveColumns();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', resolveColumns);
      return () => window.removeEventListener('resize', resolveColumns);
    }
  }, []);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const target = view === 'builder' || editMode ? editorGridRef.current : homeGridRef.current;
    if (!target) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const styles = window.getComputedStyle(target);
      const paddingLeft = Number.parseFloat(styles.paddingLeft || '0');
      const paddingRight = Number.parseFloat(styles.paddingRight || '0');
      const width = entry.contentRect.width - paddingLeft - paddingRight;
      const gap = target === homeGridRef.current ? HOME_GAP : EDITOR_GAP;
      const columns = gridColumns;
      const cell = columns > 0 ? (width - gap * (columns - 1)) / columns : width;
      const rowHeight = Math.max(80, Math.round(cell * 0.23));
      setGridRowHeight(rowHeight);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [gridColumns, view, editMode]);

  useEffect(() => {
    if (!parishSlug) return;
    getParishSite(parishSlug)
      .then((data) => {
        setSiteConfig({
          ...data.homepage,
          modules: normalizeLayoutItems(data.homepage.modules, baseColumns)
        });
        setTheme((data.theme as ThemePreset) ?? 'classic');
        setEditLayoutItems(normalizeLayoutItems(data.homepage.modules, baseColumns));
      })
      .catch(() => {
        setSiteConfig(null);
      });
  }, [parishSlug]);

  useEffect(() => {
    if (!parishSlug) return;
    getParishPublicIntentions(parishSlug)
      .then((items) => setPublicIntentions(items))
      .catch(() => setPublicIntentions([]));
    getParishPublicMasses(parishSlug)
      .then((items) => setPublicMasses(items))
      .catch(() => setPublicMasses([]));
  }, [parishSlug]);
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

  const communityData = useMemo(() => {
    if (activePage === 'community-bible' || activePage === 'community-formation') {
      return communityPages[activePage];
    }
    return null;
  }, [activePage]);

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
      if (view !== 'builder') {
        setView('chooser');
      }
      return;
    }
    const nextParish = parishOptions.find((item) => item.slug === parishSlug);
    if (nextParish) {
      setParishId(nextParish.id);
      setTheme(nextParish.theme);
      setView('parish');
      setActivePage('start');
    }
  }, [parishSlug, parishOptions, view]);

  const renderModuleContent = (module: ParishLayoutItem) => (
    <div className="module-placeholder">
      <p>Moduł: {module.type}</p>
      <span className="muted">
        Rozmiar: {module.size.colSpan}x{module.size.rowSpan}
      </span>
    </div>
  );

  const createLayoutItem = (type: string, row = 1, col = 1): ParishLayoutItem => {
    const moduleDef = parishModuleCatalog.find((module) => module.type === type);
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${type}-${Date.now()}`;
    return {
      id,
      type,
      position: { row, col },
      size: {
        colSpan: MIN_COL_SPAN,
        rowSpan: MIN_ROW_SPAN
      },
      props: { title: moduleDef?.label ?? type }
    };
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  const parseCellId = (id: string) => {
    if (!id.startsWith('cell:')) return null;
    const [, rowStr, colStr] = id.split(':');
    const row = Number(rowStr);
    const col = Number(colStr);
    if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
    return { row, col };
  };

  const getValidDropCells = (
    items: ParishLayoutItem[],
    size: { colSpan: number; rowSpan: number },
    columns: number,
    excludeId?: string | null
  ) => {
    const occupied = new Set<string>();
    let maxRow = 4;
    items.forEach((item) => {
      if (excludeId && item.id === excludeId) return;
      const colSpan = Math.min(item.size.colSpan, columns);
      const rowSpan = snapRowSpan(item.size.rowSpan);
      const endRow = item.position.row + rowSpan - 1;
      maxRow = Math.max(maxRow, endRow);
      for (let r = item.position.row; r < item.position.row + rowSpan; r += 1) {
        for (let c = item.position.col; c < item.position.col + colSpan; c += 1) {
          occupied.add(`${r}:${c}`);
        }
      }
    });
    const clampedSize = {
      colSpan: snapColSpan(size.colSpan, columns),
      rowSpan: snapRowSpan(size.rowSpan)
    };
    const targetRows = Math.max(4, maxRow + 4);
    const valid = new Set<string>();
    for (let row = 1; row <= targetRows; row += 1) {
      for (let col = 1; col <= columns; col += 1) {
        if (col + clampedSize.colSpan - 1 > columns) continue;
        let overlap = false;
        for (let r = row; r < row + clampedSize.rowSpan; r += 1) {
          for (let c = col; c < col + clampedSize.colSpan; c += 1) {
            if (occupied.has(`${r}:${c}`)) {
              overlap = true;
              break;
            }
          }
          if (overlap) break;
        }
        if (!overlap) valid.add(`${row}:${col}`);
      }
    }
    return { valid, rows: targetRows, size: clampedSize };
  };

  const canPlaceItem = (
    items: ParishLayoutItem[],
    candidate: ParishLayoutItem,
    columns: number,
    excludeId?: string | null
  ) => {
    const colSpan = snapColSpan(candidate.size.colSpan, columns);
    const rowSpan = snapRowSpan(candidate.size.rowSpan);
    const startRow = candidate.position.row;
    const startCol = candidate.position.col;
    if (startRow < 1 || startCol < 1) return false;
    if (startCol + colSpan - 1 > columns) return false;
    const occupied = new Set<string>();
    items.forEach((item) => {
      if (excludeId && item.id === excludeId) return;
      const itemColSpan = snapColSpan(item.size.colSpan, columns);
      const itemRowSpan = snapRowSpan(item.size.rowSpan);
      for (let r = item.position.row; r < item.position.row + itemRowSpan; r += 1) {
        for (let c = item.position.col; c < item.position.col + itemColSpan; c += 1) {
          occupied.add(`${r}:${c}`);
        }
      }
    });
    for (let r = startRow; r < startRow + rowSpan; r += 1) {
      for (let c = startCol; c < startCol + colSpan; c += 1) {
        if (occupied.has(`${r}:${c}`)) return false;
      }
    }
    return true;
  };

  const handleLayoutDragStart = (
    event: DragStartEvent,
    layout: 'builder' | 'edit',
    items: ParishLayoutItem[],
    onSelect: (id: string) => void
  ) => {
    const activeId = String(event.active.id);
    if (activeId.startsWith('palette:')) {
      const size = {
        colSpan: MIN_COL_SPAN,
        rowSpan: MIN_ROW_SPAN
      };
      setDragState({
        layout,
        activeId,
        activeType: 'palette',
        activeItemId: null,
        size,
        overCell: null,
        overValid: false
      });
      return;
    }
    if (activeId.startsWith('item:')) {
      const itemId = activeId.replace('item:', '');
      const existing = items.find((item) => item.id === itemId);
      if (!existing) return;
      onSelect(itemId);
      setDragState({
        layout,
        activeId,
        activeType: 'item',
        activeItemId: itemId,
        size: { ...existing.size },
        overCell: null,
        overValid: false
      });
    }
  };

  const handleLayoutDragOver = (
    event: DragOverEvent,
    layout: 'builder' | 'edit',
    items: ParishLayoutItem[]
  ) => {
    if (dragState.layout !== layout || !dragState.size) return;
    const { over } = event;
    if (!over) {
      setDragState((prev) => ({ ...prev, overCell: null, overValid: false }));
      return;
    }
    const target = parseCellId(String(over.id));
    if (!target) {
      setDragState((prev) => ({ ...prev, overCell: null, overValid: false }));
      return;
    }
    const { valid } = getValidDropCells(
      items,
      dragState.size,
      gridColumns,
      dragState.activeItemId ?? undefined
    );
    const key = `${target.row}:${target.col}`;
    setDragState((prev) => ({
      ...prev,
      overCell: target,
      overValid: valid.has(key)
    }));
  };

  const handleLayoutDragCancel = () => {
    setDragState({
      layout: null,
      activeId: null,
      activeType: null,
      activeItemId: null,
      size: null,
      overCell: null,
      overValid: false
    });
  };

  const handleLayoutDragEnd = (
    event: DragEndEvent,
    layout: 'builder' | 'edit',
    items: ParishLayoutItem[],
    setItems: Dispatch<SetStateAction<ParishLayoutItem[]>>,
    onSelect: (id: string) => void
  ) => {
    const { active, over } = event;
    const activeId = String(active.id);
    if (!over) {
      handleLayoutDragCancel();
      return;
    }
    const target = parseCellId(String(over.id));
    if (!target) {
      handleLayoutDragCancel();
      return;
    }
    if (dragState.layout !== layout || !dragState.size) {
      handleLayoutDragCancel();
      return;
    }
    const { valid } = getValidDropCells(
      items,
      dragState.size,
      gridColumns,
      dragState.activeItemId ?? undefined
    );
    const key = `${target.row}:${target.col}`;
    if (!valid.has(key)) {
      handleLayoutDragCancel();
      return;
    }
    if (activeId.startsWith('palette:')) {
      const type = activeId.replace('palette:', '');
      const newItem = createLayoutItem(type, target.row, target.col);
      const next = [...items, newItem];
      setItems(next);
      onSelect(newItem.id);
      handleLayoutDragCancel();
      return;
    }
    if (activeId.startsWith('item:')) {
      const itemId = activeId.replace('item:', '');
      const existing = items.find((item) => item.id === itemId);
      if (!existing) {
        handleLayoutDragCancel();
        return;
      }
      const updated = items.map((item) =>
        item.id === itemId ? { ...item, position: { row: target.row, col: target.col } } : item
      );
      setItems(updated);
      onSelect(itemId);
    }
    handleLayoutDragCancel();
  };

  const compactLayout = (items: ParishLayoutItem[], setItems: Dispatch<SetStateAction<ParishLayoutItem[]>>) => {
    setItems(placeItems(items, gridColumns));
  };

  const PaletteButton = ({ type, label }: { type: string; label: string }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${type}` });
    return (
      <button
        ref={setNodeRef}
        type="button"
        className={`module-pill ${isDragging ? 'is-dragging' : ''}`}
        {...listeners}
        {...attributes}
      >
        {label}
      </button>
    );
  };

  const DroppableCell = ({
    row,
    col,
    isValid,
    isActive
  }: {
    row: number;
    col: number;
    isValid: boolean;
    isActive: boolean;
  }) => {
    const { setNodeRef, isOver } = useDroppable({ id: `cell:${row}:${col}` });
    return (
      <div
        ref={setNodeRef}
        className={`editor-cell is-dropzone ${isActive ? 'is-active' : ''} ${isValid ? 'is-valid' : ''} ${
          isOver ? 'is-over' : ''
        }`}
      />
    );
  };

  const GridItem = ({
    item,
    isActive,
    onSelect,
    isHidden,
    onResizeStart
  }: {
    item: ParishLayoutItem;
    isActive?: boolean;
    onSelect?: () => void;
    isHidden?: boolean;
    onResizeStart?: (
      handle:
        | 'left'
        | 'right'
        | 'top'
        | 'bottom'
        | 'top-left'
        | 'top-right'
        | 'bottom-left'
        | 'bottom-right',
      event: ReactPointerEvent<HTMLButtonElement>
    ) => void;
  }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `item:${item.id}` });
    return (
      <div
        ref={setNodeRef}
        className={`editor-module ${isActive ? 'is-active' : ''} ${isDragging ? 'is-dragging' : ''} ${
          isHidden ? 'is-hidden' : ''
        }`}
        style={{
          gridColumn: `${item.position.col} / span ${snapColSpan(item.size.colSpan, gridColumns)}`,
          gridRow: `${item.position.row} / span ${snapRowSpan(item.size.rowSpan)}`
        }}
        onClick={onSelect}
        {...listeners}
        {...attributes}
      >
        <strong>{item.type}</strong>
        <span className="muted">
          {item.size.colSpan}x{item.size.rowSpan}
        </span>
        {onResizeStart ? (
          <>
            <button
              type="button"
              className="resize-handle resize-handle-left"
              aria-label="Zmień szerokość modułu"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onResizeStart('left', event);
              }}
            />
            <button
              type="button"
              className="resize-handle resize-handle-right"
              aria-label="Zmień szerokość modułu"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onResizeStart('right', event);
              }}
            />
            <button
              type="button"
              className="resize-handle resize-handle-top"
              aria-label="Zmień wysokość modułu"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onResizeStart('top', event);
              }}
            />
            <button
              type="button"
              className="resize-handle resize-handle-bottom"
              aria-label="Zmień wysokość modułu"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onResizeStart('bottom', event);
              }}
            />
            <button
              type="button"
              className="resize-handle resize-handle-top-left"
              aria-label="Zmień rozmiar modułu"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onResizeStart('top-left', event);
              }}
            />
            <button
              type="button"
              className="resize-handle resize-handle-top-right"
              aria-label="Zmień rozmiar modułu"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onResizeStart('top-right', event);
              }}
            />
            <button
              type="button"
              className="resize-handle resize-handle-bottom-left"
              aria-label="Zmień rozmiar modułu"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onResizeStart('bottom-left', event);
              }}
            />
            <button
              type="button"
              className="resize-handle resize-handle-bottom-right"
              aria-label="Zmień rozmiar modułu"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onResizeStart('bottom-right', event);
              }}
            />
          </>
        ) : null}
      </div>
    );
  };

  const builderSteps = ['Dane podstawowe', 'Zawartość', 'Wygląd', 'Podsumowanie'];
  const selectedModuleLabels = builderLayoutItems.map((module) => module.type);
  const homepageModules = (siteConfig ?? defaultHomepageConfig).modules;
  const dragLabel = useMemo(() => {
    if (!dragState.activeId) return 'Moduł';
    if (dragState.activeType === 'palette') {
      const type = dragState.activeId.replace('palette:', '');
      return parishModuleCatalog.find((module) => module.type === type)?.label ?? type;
    }
    if (dragState.activeType === 'item') {
      const itemId = dragState.activeId.replace('item:', '');
      const source =
        (dragState.layout === 'builder' ? builderLayoutItems : editLayoutItems).find(
          (item) => item.id === itemId
        ) ?? null;
      return source?.type ?? 'Moduł';
    }
    return 'Moduł';
  }, [dragState, builderLayoutItems, editLayoutItems]);
  const builderDragActive = dragState.layout === 'builder' && !!dragState.activeId;
  const builderDropInfo =
    builderDragActive && dragState.size
      ? getValidDropCells(builderLayoutItems, dragState.size, gridColumns, dragState.activeItemId)
      : null;
  const editDragActive = dragState.layout === 'edit' && !!dragState.activeId;
  const editDropInfo =
    editDragActive && dragState.size
      ? getValidDropCells(editLayoutItems, dragState.size, gridColumns, dragState.activeItemId)
      : null;


  const handleSaveLayout = async () => {
    if (!parish) return;
    try {
      setEditError(null);
      const homepage: ParishHomepageConfig = {
        modules: editLayoutItems
      };
      await updateParishSite(parish.id, { homepage, isPublished: true });
      setSiteConfig(homepage);
      setEditMode(false);
    } catch {
      setEditError('Nie udało się zapisać układu strony.');
    }
  };

  const handleAddIntention = async () => {
    if (!parish) return;
    if (!newIntentionDate || !newIntentionChurch || !newIntentionText) {
      setAdminFormError('Uzupełnij datę, kościół i treść intencji.');
      return;
    }
    setAdminFormError(null);
    try {
      await createParishIntention(parish.id, {
        massDateTime: new Date(newIntentionDate).toISOString(),
        churchName: newIntentionChurch,
        publicText: newIntentionText,
        internalText: newIntentionInternal || null,
        status: 'Active'
      });
      setNewIntentionDate('');
      setNewIntentionChurch('');
      setNewIntentionText('');
      setNewIntentionInternal('');
      if (parishSlug) {
        const items = await getParishPublicIntentions(parishSlug);
        setPublicIntentions(items);
      }
    } catch {
      setAdminFormError('Nie udało się zapisać intencji.');
    }
  };

  const handleAddMass = async () => {
    if (!parish) return;
    if (!newMassDate || !newMassChurch || !newMassTitle) {
      setAdminFormError('Uzupełnij datę, kościół i nazwę mszy.');
      return;
    }
    setAdminFormError(null);
    try {
      await createParishMass(parish.id, {
        massDateTime: new Date(newMassDate).toISOString(),
        churchName: newMassChurch,
        title: newMassTitle,
        note: newMassNote || null
      });
      setNewMassDate('');
      setNewMassChurch('');
      setNewMassTitle('');
      setNewMassNote('');
      if (parishSlug) {
        const items = await getParishPublicMasses(parishSlug);
        setPublicMasses(items);
      }
    } catch {
      setAdminFormError('Nie udało się zapisać mszy.');
    }
  };

  const startResize = (
    layout: 'builder' | 'edit',
    item: ParishLayoutItem,
    handle:
      | 'left'
      | 'right'
      | 'top'
      | 'bottom'
      | 'top-left'
      | 'top-right'
      | 'bottom-left'
      | 'bottom-right',
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    const grid = editorGridRef.current;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const totalWidth = rect.width;
    const cellWidth =
      gridColumns > 0 ? (totalWidth - EDITOR_GAP * (gridColumns - 1)) / gridColumns : totalWidth;
    const colSpan = Math.min(item.size.colSpan, gridColumns);
    const rowSpan = snapRowSpan(item.size.rowSpan);
    setResizeState({
      layout,
      itemId: item.id,
      originColStart: item.position.col,
      originColEnd: item.position.col + colSpan - 1,
      originRowStart: item.position.row,
      originRowEnd: item.position.row + rowSpan - 1,
      gridLeft: rect.left,
      gridTop: rect.top,
      cellWidth,
      rowHeight: gridRowHeight,
      handle
    });
    if (typeof document !== 'undefined') {
      document.body.style.userSelect = 'none';
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  useEffect(() => {
    if (!resizeState) return;
    const handlePointerMove = (event: PointerEvent) => {
      const {
        layout,
        itemId,
        originColStart,
        originColEnd,
        originRowStart,
        originRowEnd,
        gridLeft,
        gridTop,
        cellWidth,
        rowHeight,
        handle
      } = resizeState;
      const pointerCol = Math.floor((event.clientX - gridLeft) / (cellWidth + EDITOR_GAP)) + 1;
      const pointerRow = Math.floor((event.clientY - gridTop) / (rowHeight + EDITOR_GAP)) + 1;
      const maxColSpan = Math.min(baseColumns, gridColumns);
      const updateItems = (current: ParishLayoutItem[]) => {
        let nextColStart = originColStart;
        let nextColEnd = originColEnd;
        let nextRowStart = originRowStart;
        let nextRowEnd = originRowEnd;

        if (handle === 'left' || handle === 'top-left' || handle === 'bottom-left') {
          nextColStart = clamp(pointerCol, 1, originColEnd);
        }
        if (handle === 'right' || handle === 'top-right' || handle === 'bottom-right') {
          nextColEnd = clamp(pointerCol, originColStart, gridColumns);
        }
        if (handle === 'top' || handle === 'top-left' || handle === 'top-right') {
          nextRowStart = clamp(pointerRow, 1, originRowEnd);
        }
        if (handle === 'bottom' || handle === 'bottom-left' || handle === 'bottom-right') {
          nextRowEnd = clamp(pointerRow, originRowStart, originRowStart + MAX_ROW_SPAN + 6);
        }

        let resolvedColSpan = snapColSpan(
          clamp(nextColEnd - nextColStart + 1, MIN_COL_SPAN, maxColSpan),
          gridColumns
        );
        let resolvedRowSpan = snapRowSpan(clamp(nextRowEnd - nextRowStart + 1, MIN_ROW_SPAN, MAX_ROW_SPAN));

        if (handle === 'left' || handle === 'top-left' || handle === 'bottom-left') {
          nextColStart = nextColEnd - resolvedColSpan + 1;
        }
        if (handle === 'top' || handle === 'top-left' || handle === 'top-right') {
          nextRowStart = nextRowEnd - resolvedRowSpan + 1;
        }

        if (nextColStart < 1) {
          nextColStart = 1;
        }
        if (nextColStart + resolvedColSpan - 1 > gridColumns) {
          nextColStart = gridColumns - resolvedColSpan + 1;
        }

        const candidate: ParishLayoutItem = {
          id: itemId,
          type: 'resized',
          position: { row: nextRowStart, col: nextColStart },
          size: { colSpan: resolvedColSpan, rowSpan: resolvedRowSpan },
          props: {}
        };

        if (!canPlaceItem(current, candidate, gridColumns, itemId)) {
          return current;
        }

        return current.map((item) =>
          item.id === itemId
            ? {
                ...item,
                position: { row: nextRowStart, col: nextColStart },
                size: { colSpan: resolvedColSpan, rowSpan: resolvedRowSpan }
              }
            : item
        );
      };
      if (layout === 'builder') {
        setBuilderLayoutItems(updateItems);
      } else {
        setEditLayoutItems(updateItems);
      }
    };
    const handlePointerUp = () => {
      setResizeState(null);
      if (typeof document !== 'undefined') {
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [resizeState, baseColumns, gridColumns]);

  return (
    <div className={`parish-portal theme-${theme}`} lang={language}>
      {view === 'chooser' ? (
        <>
          <header className="parish-header parish-header--chooser">
            <a className="parish-brand" href="/#/">
              <img src="/parish/logo.svg" alt="Logo parafii" className="parish-logo" />
              <span className="parish-name">Parafie</span>
            </a>
            <div className="parish-controls">
              <button type="button" className="parish-back" onClick={handleBack}>
                Back
              </button>
              <a className="parish-up" href="/#/">
                Up
              </a>
              {isAuthenticated && (
                <button type="button" className="parish-create" onClick={handleStartBuilder}>
                  Utwórz stronę parafii
                </button>
              )}
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
                  {parishOptions.map((item) => (
                    <a
                      key={item.id}
                      className="chooser-item"
                      href={`/#/parish/${item.slug}`}
                    >
                      <div>
                        <strong>{item.name}</strong>
                        <span className="muted">{item.location}</span>
                      </div>
                      <span className="pill">Wejdź</span>
                    </a>
                  ))}
                </div>
                {isAuthenticated && (
                  <div className="chooser-action">
                    <button type="button" className="parish-create" onClick={handleStartBuilder}>
                      Utwórz nową parafię
                    </button>
                  </div>
                )}
              </div>
            </section>
          </main>
        </>
      ) : view === 'builder' ? (
        <>
          <header className="parish-header parish-header--chooser">
            <button
              type="button"
              className="parish-brand"
              onClick={() => {
                setView('chooser');
                setBuilderStep(0);
              }}
            >
              <img src="/parish/logo.svg" alt="Logo parafii" className="parish-logo" />
              <span className="parish-name">Nowa strona parafii</span>
            </button>
            <div className="parish-controls">
              <button
                type="button"
                className="parish-back"
                onClick={() => {
                  if (builderStep === 0) {
                    setView('chooser');
                    return;
                  }
                  setBuilderStep((current) => Math.max(0, current - 1));
                }}
              >
                Wróć
              </button>
              <button type="button" className="parish-login" onClick={onAuthAction}>
                {authLabel}
              </button>
            </div>
          </header>
          <main className="parish-main">
            <section className="parish-builder">
              <div className="builder-card">
                <div className="builder-intro">
                  <p className="tag">Panel tworzenia</p>
                  <h1>Stwórz witrynę parafii</h1>
                  <p className="lead">
                    Wybierz zakres informacji, które mają być widoczne publicznie. Po utworzeniu
                    zostaniesz głównym administratorem i możesz przydzielać role.
                  </p>
                </div>
                <div className="builder-steps">
                  {builderSteps.map((label, index) => (
                    <div
                      key={label}
                      className={`builder-step ${builderStep === index ? 'is-active' : ''} ${
                        builderStep > index ? 'is-done' : ''
                      }`}
                    >
                      <span>{index + 1}</span>
                      <strong>{label}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="builder-card">
                {builderStep === 0 && (
                  <div className="builder-panel">
                    <h2>Dane parafii</h2>
                    <div className="builder-grid">
                      <label className="builder-field">
                        <span>Nazwa parafii</span>
                        <input
                          type="text"
                          value={builderName}
                          onChange={(event) => handleBuilderNameChange(event.target.value)}
                          placeholder="np. Parafia św. Jana"
                        />
                      </label>
                      <label className="builder-field">
                        <span>Lokalizacja</span>
                        <input
                          type="text"
                          value={builderLocation}
                          onChange={(event) => setBuilderLocation(event.target.value)}
                          placeholder="np. Kraków • Prądnik"
                        />
                      </label>
                      <label className="builder-field">
                        <span>Adres w URL (slug)</span>
                        <input
                          type="text"
                          value={builderSlug}
                          onChange={(event) => handleBuilderSlugChange(event.target.value)}
                          placeholder="np. sw-jan"
                        />
                      </label>
                    </div>
                  </div>
                )}
                {builderStep === 1 && (
                  <div className="builder-panel">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={pointerWithin}
                      onDragStart={(event) =>
                        handleLayoutDragStart(event, 'builder', builderLayoutItems, setSelectedBuilderId)
                      }
                      onDragOver={(event) => handleLayoutDragOver(event, 'builder', builderLayoutItems)}
                      onDragCancel={handleLayoutDragCancel}
                      onDragEnd={(event) =>
                        handleLayoutDragEnd(
                          event,
                          'builder',
                          builderLayoutItems,
                          setBuilderLayoutItems,
                          setSelectedBuilderId
                        )
                      }
                    >
                      <div className="layout-header">
                        <h2>Układ strony</h2>
                        <div className="layout-subheader">Moduły</div>
                        <div className="layout-palette">
                          {parishModuleCatalog.map((module) => (
                            <PaletteButton key={module.type} type={module.type} label={module.label} />
                          ))}
                        </div>
                      </div>
                      <div
                        className={`editor-grid-shell ${builderDragActive ? 'is-dragging' : ''}`}
                        ref={editorGridRef}
                        style={
                          {
                            '--grid-row-height': `${gridRowHeight}px`,
                            '--grid-gap': `${EDITOR_GAP}px`
                          } as CSSProperties
                        }
                      >
                        {(() => {
                          const rows = builderDropInfo?.rows
                            ? builderDropInfo.rows
                            : Math.max(
                                4,
                                Math.max(
                                  1,
                                  ...builderLayoutItems.map(
                                    (module) => module.position.row + snapRowSpan(module.size.rowSpan) - 1
                                  )
                                ) + 2
                              );
                          return (
                            <>
                              <div className="editor-grid-layer editor-grid-cells">
                                {Array.from({ length: rows }).flatMap((_, rowIndex) => {
                                  const r = rowIndex + 1;
                                  return Array.from({ length: gridColumns }).map((__, colIndex) => {
                                    const c = colIndex + 1;
                                    const key = `${r}:${c}`;
                                    const isValid =
                                      builderDragActive && (builderDropInfo?.valid?.has(key) ?? false);
                                    return (
                                      <DroppableCell
                                        key={`builder-cell-${r}-${c}`}
                                        row={r}
                                        col={c}
                                        isValid={isValid}
                                        isActive={builderDragActive}
                                      />
                                    );
                                  });
                                })}
                              </div>
                              <div className="editor-grid-layer editor-grid-modules">
                                {builderLayoutItems.map((module) => (
                                  <GridItem
                                    key={`builder-item-${module.id}`}
                                    item={module}
                                    isActive={selectedBuilderId === module.id}
                                    onSelect={() => setSelectedBuilderId(module.id)}
                                    isHidden={builderDragActive && dragState.activeItemId === module.id}
                                    onResizeStart={(mode, event) => startResize('builder', module, mode, event)}
                                  />
                                ))}
                                {builderDragActive && dragState.overValid && dragState.overCell && dragState.size ? (
                                  <div
                                    className="editor-module is-ghost"
                                    style={{
                                      gridColumn: `${dragState.overCell.col} / span ${snapColSpan(
                                        dragState.size.colSpan,
                                        gridColumns
                                      )}`,
                                      gridRow: `${dragState.overCell.row} / span ${snapRowSpan(
                                        dragState.size.rowSpan
                                      )}`
                                    }}
                                  >
                                    <strong>Podgląd</strong>
                                    <span className="muted">
                                      {snapColSpan(dragState.size.colSpan, gridColumns)}x
                                      {snapRowSpan(dragState.size.rowSpan)}
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      <DragOverlay>
                        {builderDragActive && !dragState.overValid && dragState.size ? (
                          <div className="editor-module drag-overlay">
                            <strong>{dragLabel}</strong>
                            <span className="muted">
                                {snapColSpan(dragState.size.colSpan, gridColumns)}x{snapRowSpan(dragState.size.rowSpan)}
                            </span>
                          </div>
                        ) : null}
                      </DragOverlay>
                    </DndContext>
                    <div className="builder-actions">
                      <button
                        type="button"
                        className="parish-back"
                        onClick={() => compactLayout(builderLayoutItems, setBuilderLayoutItems)}
                      >
                        Compact layout
                      </button>
                    </div>
                    {selectedBuilderId && (
                      <div className="builder-layout">
                        <h3>Ustawienia modułu</h3>
                        {builderLayoutItems
                          .filter((module) => module.id === selectedBuilderId)
                          .map((module) => (
                            <div key={module.id} className="builder-layout-row">
                              <strong>{module.type}</strong>
                              <span className="muted">
                                Rozmiar: {module.size.colSpan}x{module.size.rowSpan} (zmień przez przeciągnięcie
                                narożnika)
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                    {builderError && <p className="builder-error">{builderError}</p>}
                  </div>
                )}
                {builderStep === 2 && (
                  <div className="builder-panel">
                    <h2>Styl i motyw</h2>
                    <div className="builder-options builder-themes">
                      {(['classic', 'warm', 'minimal'] as ThemePreset[]).map((preset) => (
                        <label key={preset} className="builder-theme">
                          <input
                            type="radio"
                            name="theme"
                            checked={builderTheme === preset}
                            onChange={() => setBuilderTheme(preset)}
                          />
                          <span>{preset === 'classic' ? 'Klasyczny' : preset === 'warm' ? 'Ciepły' : 'Minimal'}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {builderStep === 3 && (
                  <div className="builder-panel">
                    <h2>Podsumowanie</h2>
                    <div className="builder-summary">
                      <div>
                        <strong>{builderName || 'Nowa parafia'}</strong>
                        <span className="muted">{builderLocation || 'Lokalizacja do uzupełnienia'}</span>
                        <span className="muted">Adres: /parish/{builderSlug || 'slug'}</span>
                      </div>
                      <div>
                        <strong>Moduły</strong>
                        <span className="muted">
                          {selectedModuleLabels.length ? selectedModuleLabels.join(', ') : 'Brak wybranych modułów'}
                        </span>
                      </div>
                      <div>
                        <strong>Rola główna</strong>
                        <span className="muted">Po utworzeniu zostaniesz głównym administratorem.</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="builder-actions">
                  <button
                    type="button"
                    className="parish-back"
                    onClick={() => {
                      if (builderStep === 0) {
                        setView('chooser');
                        return;
                      }
                      setBuilderStep((current) => Math.max(0, current - 1));
                    }}
                  >
                    Wróć
                  </button>
                  {builderStep < 3 ? (
                    <button
                      type="button"
                      className="parish-login"
                      onClick={() => setBuilderStep((current) => Math.min(3, current + 1))}
                    >
                      Dalej
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="parish-login"
                      disabled={!canCreateParish}
                      onClick={handleCreateParishSite}
                    >
                      Utwórz stronę
                    </button>
                  )}
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
              <a className="parish-up" href="/#/parish">
                Up
              </a>
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
            {isAuthenticated && (
              <div className="parish-edit-control">
                <button
                  type="button"
                  className={`parish-back ${editMode ? 'is-active' : ''}`}
                  onClick={() => setEditMode((current) => !current)}
                >
                  {editMode ? 'Zakończ edycję' : 'Tryb edycji'}
                </button>
              </div>
            )}
            <div className="parish-login-control">
              <button type="button" className="parish-login" onClick={onAuthAction}>
                {authLabel}
              </button>
            </div>
          </header>
          <main className="parish-main">
            {activePage === 'start' && (
              <section className="parish-section home-grid">
                <div className="home-grid-header">
                  <div>
                    <p className="tag">Strona główna</p>
                    <h2>Moduły parafii</h2>
                    <p className="muted">
                      Cała strona główna składa się z modułów. Układ jest tworzony podczas konfiguracji
                      i edycji.
                    </p>
                  </div>
                </div>
                {editMode && (
                  <div className="home-grid-editor">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={pointerWithin}
                      onDragStart={(event) =>
                        handleLayoutDragStart(event, 'edit', editLayoutItems, setSelectedEditId)
                      }
                      onDragOver={(event) => handleLayoutDragOver(event, 'edit', editLayoutItems)}
                      onDragCancel={handleLayoutDragCancel}
                      onDragEnd={(event) =>
                        handleLayoutDragEnd(
                          event,
                          'edit',
                          editLayoutItems,
                          setEditLayoutItems,
                          setSelectedEditId
                        )
                      }
                    >
                      <div className="layout-header">
                        <h3>Edycja układu</h3>
                        <div className="layout-subheader">Moduły</div>
                        <div className="layout-palette">
                          {parishModuleCatalog.map((module) => (
                            <PaletteButton key={`edit-${module.type}`} type={module.type} label={module.label} />
                          ))}
                        </div>
                      </div>
                      <div
                        className={`editor-grid-shell ${editDragActive ? 'is-dragging' : ''}`}
                        ref={editorGridRef}
                        style={
                          {
                            '--grid-row-height': `${gridRowHeight}px`,
                            '--grid-gap': `${EDITOR_GAP}px`
                          } as CSSProperties
                        }
                      >
                        {(() => {
                          const rows = editDropInfo?.rows
                            ? editDropInfo.rows
                            : Math.max(
                                4,
                                Math.max(
                                  1,
                                  ...editLayoutItems.map(
                                    (module) => module.position.row + snapRowSpan(module.size.rowSpan) - 1
                                  )
                                ) + 2
                              );
                          return (
                            <>
                              <div className="editor-grid-layer editor-grid-cells">
                                {Array.from({ length: rows }).flatMap((_, rowIndex) => {
                                  const r = rowIndex + 1;
                                  return Array.from({ length: gridColumns }).map((__, colIndex) => {
                                    const c = colIndex + 1;
                                    const key = `${r}:${c}`;
                                    const isValid =
                                      editDragActive && (editDropInfo?.valid?.has(key) ?? false);
                                    return (
                                      <DroppableCell
                                        key={`edit-cell-${r}-${c}`}
                                        row={r}
                                        col={c}
                                        isValid={isValid}
                                        isActive={editDragActive}
                                      />
                                    );
                                  });
                                })}
                              </div>
                              <div className="editor-grid-layer editor-grid-modules">
                                {editLayoutItems.map((module) => (
                                  <GridItem
                                    key={`edit-item-${module.id}`}
                                    item={module}
                                    isActive={selectedEditId === module.id}
                                    onSelect={() => setSelectedEditId(module.id)}
                                    isHidden={editDragActive && dragState.activeItemId === module.id}
                                    onResizeStart={(mode, event) => startResize('edit', module, mode, event)}
                                  />
                                ))}
                                {editDragActive && dragState.overValid && dragState.overCell && dragState.size ? (
                                  <div
                                    className="editor-module is-ghost"
                                    style={{
                                      gridColumn: `${dragState.overCell.col} / span ${snapColSpan(
                                        dragState.size.colSpan,
                                        gridColumns
                                      )}`,
                                      gridRow: `${dragState.overCell.row} / span ${snapRowSpan(
                                        dragState.size.rowSpan
                                      )}`
                                    }}
                                  >
                                    <strong>Podgląd</strong>
                                    <span className="muted">
                                      {snapColSpan(dragState.size.colSpan, gridColumns)}x
                                      {snapRowSpan(dragState.size.rowSpan)}
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      <DragOverlay>
                        {editDragActive && !dragState.overValid && dragState.size ? (
                          <div className="editor-module drag-overlay">
                            <strong>{dragLabel}</strong>
                            <span className="muted">
                                {snapColSpan(dragState.size.colSpan, gridColumns)}x{snapRowSpan(dragState.size.rowSpan)}
                            </span>
                          </div>
                        ) : null}
                      </DragOverlay>
                    </DndContext>
                    <div className="builder-actions">
                      <button
                        type="button"
                        className="parish-back"
                        onClick={() => compactLayout(editLayoutItems, setEditLayoutItems)}
                      >
                        Compact layout
                      </button>
                      <button type="button" className="parish-back" onClick={() => setEditMode(false)}>
                        Anuluj
                      </button>
                      <button type="button" className="parish-login" onClick={handleSaveLayout}>
                        Zapisz układ
                      </button>
                    </div>
                    {selectedEditId && (
                      <div className="builder-layout">
                        <h3>Ustawienia modułu</h3>
                        {editLayoutItems
                          .filter((module) => module.id === selectedEditId)
                          .map((module) => (
                            <div key={module.id} className="builder-layout-row">
                              <strong>{module.type}</strong>
                              <span className="muted">
                                Rozmiar: {module.size.colSpan}x{module.size.rowSpan} (zmień przez przeciągnięcie
                                narożnika)
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                    {editError && <p className="builder-error">{editError}</p>}
                  </div>
                )}
                <div
                  className="home-grid"
                  ref={homeGridRef}
                  style={
                    {
                      '--grid-row-height': `${gridRowHeight}px`
                    } as CSSProperties
                  }
                >
                  {homepageModules.map((module) => {
                    return (
                      <article
                        key={module.id}
                        className="home-module"
                        style={{
                          gridColumn: `${module.position.col} / span ${snapColSpan(module.size.colSpan, gridColumns)}`,
                          gridRow: `${module.position.row} / span ${snapRowSpan(module.size.rowSpan)}`
                        }}
                      >
                        <header>
                          <h3>{module.type}</h3>
                          <span className="pill">
                            {module.size.colSpan}x{module.size.rowSpan}
                          </span>
                        </header>
                        <div className="module-body">{renderModuleContent(module)}</div>
                      </article>
                    );
                  })}
                </div>
              </section>
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
                {isAuthenticated && (
                  <div className="parish-card admin-form">
                    <div className="section-header">
                      <div>
                        <p className="tag">Panel admina</p>
                        <h3>Dodaj Mszę</h3>
                      </div>
                    </div>
                    <div className="admin-form-grid">
                      <label>
                        <span>Data i godzina</span>
                        <input
                          type="datetime-local"
                          value={newMassDate}
                          onChange={(event) => setNewMassDate(event.target.value)}
                        />
                      </label>
                      <label>
                        <span>Kościół</span>
                        <input
                          type="text"
                          value={newMassChurch}
                          onChange={(event) => setNewMassChurch(event.target.value)}
                        />
                      </label>
                      <label className="admin-form-full">
                        <span>Nazwa</span>
                        <input
                          type="text"
                          value={newMassTitle}
                          onChange={(event) => setNewMassTitle(event.target.value)}
                        />
                      </label>
                      <label className="admin-form-full">
                        <span>Uwagi</span>
                        <input
                          type="text"
                          value={newMassNote}
                          onChange={(event) => setNewMassNote(event.target.value)}
                        />
                      </label>
                    </div>
                    <div className="builder-actions">
                      <button type="button" className="parish-login" onClick={handleAddMass}>
                        Zapisz mszę
                      </button>
                    </div>
                    {adminFormError && <p className="builder-error">{adminFormError}</p>}
                  </div>
                )}
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
                {publicMasses.length > 0 && (
                  <div className="parish-card">
                    <div className="section-header">
                      <h3>Najbliższe Msze</h3>
                      <span className="muted">Publiczne ogłoszenia</span>
                    </div>
                    <ul className="status-list">
                      {publicMasses.slice(0, 6).map((mass) => (
                        <li key={mass.id}>
                          <strong>
                            {new Date(mass.massDateTime).toLocaleString([], {
                              dateStyle: 'short',
                              timeStyle: 'short'
                            })}
                          </strong>
                          <span>{mass.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
                {isAuthenticated && (
                  <div className="parish-card admin-form">
                    <div className="section-header">
                      <div>
                        <p className="tag">Panel admina</p>
                        <h3>Dodaj intencję</h3>
                      </div>
                    </div>
                    <div className="admin-form-grid">
                      <label>
                        <span>Data i godzina</span>
                        <input
                          type="datetime-local"
                          value={newIntentionDate}
                          onChange={(event) => setNewIntentionDate(event.target.value)}
                        />
                      </label>
                      <label>
                        <span>Kościół</span>
                        <input
                          type="text"
                          value={newIntentionChurch}
                          onChange={(event) => setNewIntentionChurch(event.target.value)}
                        />
                      </label>
                      <label className="admin-form-full">
                        <span>Treść publiczna</span>
                        <input
                          type="text"
                          value={newIntentionText}
                          onChange={(event) => setNewIntentionText(event.target.value)}
                        />
                      </label>
                      <label className="admin-form-full">
                        <span>Treść wewnętrzna (opcjonalnie)</span>
                        <input
                          type="text"
                          value={newIntentionInternal}
                          onChange={(event) => setNewIntentionInternal(event.target.value)}
                        />
                      </label>
                    </div>
                    <div className="builder-actions">
                      <button type="button" className="parish-login" onClick={handleAddIntention}>
                        Zapisz intencję
                      </button>
                    </div>
                    {adminFormError && <p className="builder-error">{adminFormError}</p>}
                  </div>
                )}
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
                    {publicIntentions.length > 0 && (
                      <div className="intentions-public">
                        {publicIntentions.slice(0, 8).map((item) => (
                          <div key={item.id} className="intent-row">
                            <span>{new Date(item.massDateTime).toLocaleString()}</span>
                            <div>
                              <p>{item.publicText}</p>
                              <span className="muted">{item.churchName}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
              <a className="portal-brand" href="/#/">
                <img src="/logo_new.svg" alt="Recreatio" className="parish-footer-logo" />
              </a>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
