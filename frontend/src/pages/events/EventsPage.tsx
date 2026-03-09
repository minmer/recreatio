import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import { LanguageSelect } from '../../components/LanguageSelect';
import { AuthAction } from '../../components/AuthAction';
import {
  ApiError,
  createPilgrimageAnnouncement,
  createPilgrimageContactInquiry,
  createPilgrimageParticipantIssue,
  createPilgrimageRegistration,
  createPilgrimageTask,
  getPilgrimageExportUrl,
  getPilgrimageOrganizerDashboard,
  getPilgrimageParticipantZone,
  getPilgrimageSite,
  updatePilgrimageIssue,
  updatePilgrimageInquiry,
  updatePilgrimageParticipant,
  updatePilgrimageTask,
  type PilgrimageOrganizerDashboard,
  type PilgrimageParticipantZone,
  type PilgrimageSection,
  type PilgrimageSite
} from '../../lib/api';
import '../../styles/events.css';

type EventInnerPage = {
  slug: string;
  title: string;
};

type EventDefinition = {
  slug: 'warsztaty26' | 'kal26';
  title: string;
  summary: string;
  date: string;
  location: string;
  pages: EventInnerPage[];
};

type SharedEventPageProps = {
  copy: Copy;
  authLabel: string;
  showProfileMenu: boolean;
  onAuthAction: () => void;
  onProfileNavigate: () => void;
  onToggleSecureMode: () => void;
  onLogout: () => void;
  secureMode: boolean;
  language: 'pl' | 'en' | 'de';
  onLanguageChange: (language: 'pl' | 'en' | 'de') => void;
  onNavigate: (route: RouteKey) => void;
};

const EVENTS: EventDefinition[] = [
  {
    slug: 'warsztaty26',
    title: 'Warsztaty Muzyki Liturgicznej 2026',
    summary: 'Warsztaty liturgiczne SATB: praca nad repertuarem wielkopostnym i eucharystycznym.',
    date: '28.02.2026-01.03.2026',
    location: 'Krakow',
    pages: [
      { slug: 'o-warsztatach', title: 'O warsztatach' },
      { slug: 'program', title: 'Program' },
      { slug: 'prowadzacy', title: 'Prowadzacy' }
    ]
  },
  {
    slug: 'kal26',
    title: '5. piesza pielgrzymka z Krakowa do Kalwarii Zebrzydowskiej',
    summary: 'Pelny serwis wydarzenia: publiczny, uczestnika i organizatora.',
    date: '17.04.2026-18.04.2026',
    location: 'Krakow - Kalwaria Zebrzydowska',
    pages: [
      { slug: 'start', title: 'Start' },
      { slug: 'o-pielgrzymce', title: 'O pielgrzymce' },
      { slug: 'program', title: 'Program' },
      { slug: 'trasa', title: 'Trasa' },
      { slug: 'zapisy', title: 'Zapisy' },
      { slug: 'galeria', title: 'Galeria' },
      { slug: 'niezbednik', title: 'Niezbednik' },
      { slug: 'faq', title: 'FAQ' },
      { slug: 'kontakt', title: 'Kontakt' },
      { slug: 'formalnosci', title: 'Formalnosci' },
      { slug: 'uczestnik', title: 'Strefa uczestnika' },
      { slug: 'organizator', title: 'Panel organizatora' }
    ]
  }
];

function WarsztatyBody({ pageSlug }: { pageSlug: string }) {
  if (pageSlug === 'program') {
    return (
      <>
        <h2>Program</h2>
        <p>
          Uklad warsztatow jest praktyczny: rozspiewka, praca w glosach, skladanie calosci i proba generalna. Msza
          Swieta jest zwienczeniem - spiewamy przecwiczone utwory w liturgii.
        </p>
        <h3>Sobota - 28.02.2026</h3>
        <ul className="warsztaty-schedule">
          <li><strong>09:00</strong> Otwarcie sali, zgloszenia, sprawy organizacyjne.</li>
          <li><strong>09:30</strong> Rozspiewka: oddech, emisja, przygotowanie do wieloglosu.</li>
          <li><strong>10:15</strong> Praca w SATB: nauka materialu, intonacja i tekst.</li>
          <li><strong>11:30</strong> Przerwa: herbata, ciastka, owoce.</li>
          <li><strong>13:10</strong> Obiad dla zapisanych do 24.02.</li>
          <li><strong>16:20</strong> Proba calosci: przejscia, wejscia, zakonczenia.</li>
          <li><strong>18:30</strong> Msza Swieta: wykonanie przecwiczonych utworow.</li>
          <li><strong>19:15</strong> Adoracja i Spowiedz.</li>
        </ul>
        <h3>Niedziela - 01.03.2026</h3>
        <ul className="warsztaty-schedule">
          <li><strong>09:30</strong> Rozspiewka.</li>
          <li><strong>10:05</strong> Powtorka repertuaru.</li>
          <li><strong>11:10</strong> Proba generalna.</li>
          <li><strong>12:00</strong> Msza Swieta i krotka adoracja po Mszy.</li>
        </ul>
      </>
    );
  }

  if (pageSlug === 'prowadzacy') {
    return (
      <>
        <h2>Prowadzacy - Pawel Bebenek</h2>
        <p>
          Pawel Bebenek to ceniony dyrygent, kompozytor i wokalista, laczacy duchowosc z tradycja muzyki liturgicznej.
          Prowadzi chorowe warsztaty w Polsce i za granica.
        </p>
        <p>
          Jego utwory i aranzacje wykonywane sa przez schole i chory w wielu krajach. Jako prowadzacy inspiruje do
          wzrostu artystycznego i modlitwy przez muzyke.
        </p>
        <ul>
          <li>Doswiadczenie miedzynarodowe.</li>
          <li>Bogaty dorobek kompozytorski i wydawniczy.</li>
          <li>Nacisk na piekno liturgii i formacje muzyczna.</li>
        </ul>
      </>
    );
  }

  return (
    <>
      <h2>O warsztatach</h2>
      <p>
        Celem warsztatow jest zachwyt nad Bogiem przez liturgie i muzyke. Pracujemy nad spiewem wieloglosowym SATB, a
        zwienczeniem sa Msze Swiete, podczas ktorych wykonamy przygotowane utwory.
      </p>
      <p>Tematyka: wielkopostna i eucharystyczna. Po Mszy przewidziany jest czas adoracji.</p>
      <h3>Dla kogo?</h3>
      <p>
        Dla pasjonatow, poczatkujacych i doswiadczonych. Mozna zaczac takze bez formalnego przygotowania, jesli
        uczestnik spiewa ze sluchu i chce sie uczyc.
      </p>
      <ul>
        <li>Materialy: nuty beda przygotowane na miejscu.</li>
        <li>Podzial na glosy: SATB ustalany podczas warsztatow.</li>
        <li>Msza jako zwienczenie: wykonanie przecwiczonych utworow w liturgii.</li>
      </ul>
    </>
  );
}

function WarsztatyEventPage({
  copy,
  language,
  onLanguageChange,
  onAuthAction,
  authLabel,
  showProfileMenu,
  onProfileNavigate,
  onToggleSecureMode,
  onLogout,
  secureMode,
  onNavigate,
  page,
  event
}: SharedEventPageProps & { page: EventInnerPage; event: EventDefinition }) {
  return (
    <div className="event-page warsztaty-page">
      <header className="warsztaty-header">
        <a href="/#/event" className="warsztaty-back">{copy.events.backToEvents}</a>
        <div className="warsztaty-head-main">
          <h1>{event.title}</h1>
          <p>{event.date} - {event.location}</p>
        </div>
        <div className="warsztaty-head-tools">
          <LanguageSelect value={language} onChange={onLanguageChange} />
          <AuthAction
            copy={copy}
            label={authLabel}
            isAuthenticated={showProfileMenu}
            secureMode={secureMode}
            onLogin={onAuthAction}
            onProfileNavigate={onProfileNavigate}
            onToggleSecureMode={onToggleSecureMode}
            onLogout={onLogout}
            variant="ghost"
          />
        </div>
      </header>

      <main className="warsztaty-main">
        <nav className="warsztaty-tabs">
          {event.pages.map((item) => (
            <a key={item.slug} href={`/#/event/${event.slug}/${item.slug}`} className={item.slug === page.slug ? 'active' : ''}>
              {item.title}
            </a>
          ))}
        </nav>
        <article className="warsztaty-content">
          <WarsztatyBody pageSlug={page.slug} />
        </article>
      </main>

      <footer className="warsztaty-footer">
        <span>{copy.footer.headline}</span>
        <a className="ghost" href="/#/section-1" onClick={() => onNavigate('home')}>{copy.nav.home}</a>
      </footer>
    </div>
  );
}

type RegistrationFormState = {
  fullName: string;
  phone: string;
  email: string;
  parish: string;
  birthDate: string;
  isMinor: boolean;
  participationVariant: string;
  needsLodging: boolean;
  needsBaggageTransport: boolean;
  emergencyContactName: string;
  emergencyContactPhone: string;
  healthNotes: string;
  dietNotes: string;
  acceptedTerms: boolean;
  acceptedRodo: boolean;
  acceptedImageConsent: boolean;
};

const defaultRegistrationForm: RegistrationFormState = {
  fullName: '',
  phone: '',
  email: '',
  parish: '',
  birthDate: '',
  isMinor: false,
  participationVariant: 'full',
  needsLodging: true,
  needsBaggageTransport: true,
  emergencyContactName: '',
  emergencyContactPhone: '',
  healthNotes: '',
  dietNotes: '',
  acceptedTerms: false,
  acceptedRodo: false,
  acceptedImageConsent: false
};

type ContactFormState = {
  name: string;
  phone: string;
  email: string;
  topic: string;
  message: string;
};

const defaultContactForm: ContactFormState = {
  name: '',
  phone: '',
  email: '',
  topic: 'Pytanie organizacyjne',
  message: ''
};

type StoneTone = 'coral' | 'yellow' | 'orange' | 'green' | 'greenDark';
type StoneFacetTone = 'red' | 'orange' | 'green';
type StonePolygon = {
  id: string;
  tone: StoneTone;
  points: string;
  facetPoints?: string;
  facetTone?: StoneFacetTone;
};

const STONE_MAIN_COLORS: Record<StoneTone, string> = {
  coral: '#F45741',
  yellow: '#FCE960',
  orange: '#FB9926',
  green: '#88C529',
  greenDark: '#6D8F1E'
};

const STONE_FACET_COLORS: Record<StoneFacetTone, string> = {
  red: '#93260E',
  orange: '#FB9926',
  green: '#6D8F1E'
};

const STONE_VIEWBOX_WIDTH = 1600;
const STONE_VIEWBOX_HEIGHT = 960;
const START_STAGE_VIEWBOX_HEIGHT = 5200;
const START_BACKGROUND_STONES: StonePolygon[] = [
  { id: 's1', tone: 'yellow', points: '24,34 338,24 416,186 294,332 36,274', facetPoints: '244,40 394,182 294,314 212,208', facetTone: 'orange' },
  { id: 's2', tone: 'orange', points: '366,30 736,24 808,186 628,304 432,234', facetPoints: '582,34 782,178 638,292 556,192', facetTone: 'orange' },
  { id: 's3', tone: 'green', points: '770,32 1158,24 1266,208 1042,286 820,198', facetPoints: '1006,36 1246,206 1054,278 954,196', facetTone: 'green' },
  { id: 's4', tone: 'coral', points: '1190,38 1574,56 1570,282 1320,336 1164,182', facetPoints: '1360,66 1562,78 1556,262 1382,308', facetTone: 'red' },
  { id: 's5', tone: 'greenDark', points: '26,312 266,372 296,598 32,692', facetPoints: '158,382 284,592 62,662 94,504', facetTone: 'green' },
  { id: 's6', tone: 'orange', points: '302,356 532,330 564,564 346,706 250,542', facetPoints: '436,342 552,556 356,692 328,552', facetTone: 'orange' },
  { id: 's7', tone: 'yellow', points: '1094,356 1386,330 1572,490 1570,758 1264,826 1058,626', facetPoints: '1312,346 1560,498 1558,734 1338,786', facetTone: 'orange' },
  { id: 's8', tone: 'green', points: '1218,836 1572,786 1574,1096 1342,1216 1132,1030', facetPoints: '1368,804 1560,792 1560,1088 1376,1182', facetTone: 'green' },
  { id: 's9', tone: 'coral', points: '24,734 232,710 334,892 262,1124 30,1054', facetPoints: '168,724 322,886 254,1112 156,982', facetTone: 'red' },
  { id: 's10', tone: 'yellow', points: '268,728 522,700 614,920 478,1128 248,1066', facetPoints: '442,714 600,916 486,1112 382,962', facetTone: 'orange' },
  { id: 's11', tone: 'orange', points: '548,712 844,668 930,890 792,1114 536,1042', facetPoints: '748,690 918,882 802,1098 694,940', facetTone: 'orange' },
  { id: 's12', tone: 'greenDark', points: '864,662 1120,632 1218,846 1084,1042 846,948', facetPoints: '1034,642 1208,838 1088,1028 1004,888', facetTone: 'green' },
  { id: 's13', tone: 'green', points: '28,1112 312,1172 364,1412 212,1600 22,1504', facetPoints: '192,1190 350,1404 220,1586 134,1454', facetTone: 'green' },
  { id: 's14', tone: 'coral', points: '340,1158 618,1120 744,1322 612,1558 328,1480', facetPoints: '536,1134 734,1316 620,1544 496,1374', facetTone: 'red' },
  { id: 's15', tone: 'yellow', points: '768,1120 1080,1080 1204,1294 1022,1548 742,1448', facetPoints: '990,1102 1192,1288 1028,1536 890,1364', facetTone: 'orange' },
  { id: 's16', tone: 'orange', points: '1128,1216 1572,1162 1574,1466 1324,1622 1078,1464', facetPoints: '1304,1186 1560,1172 1560,1456 1368,1578', facetTone: 'orange' },
  { id: 's17', tone: 'greenDark', points: '32,1542 214,1622 280,1868 88,2048 20,1836', facetPoints: '118,1638 266,1854 102,2028 64,1862', facetTone: 'green' },
  { id: 's18', tone: 'orange', points: '302,1582 548,1546 688,1772 560,1994 274,1910', facetPoints: '498,1562 674,1766 568,1980 448,1824', facetTone: 'orange' },
  { id: 's19', tone: 'green', points: '718,1564 986,1520 1130,1766 958,1988 688,1892', facetPoints: '908,1542 1118,1758 966,1972 836,1820', facetTone: 'green' },
  { id: 's20', tone: 'coral', points: '1160,1642 1572,1568 1572,1912 1338,2068 1106,1898', facetPoints: '1332,1602 1560,1582 1560,1888 1370,2028', facetTone: 'red' },
  { id: 's21', tone: 'yellow', points: '26,2078 292,2026 428,2258 260,2498 22,2388', facetPoints: '204,2052 418,2248 272,2484 138,2328', facetTone: 'orange' },
  { id: 's22', tone: 'green', points: '316,2012 666,1984 760,2240 616,2484 286,2398', facetPoints: '560,1992 748,2234 626,2472 500,2318', facetTone: 'green' },
  { id: 's23', tone: 'orange', points: '784,1998 1028,1950 1178,2190 1032,2416 756,2338', facetPoints: '964,1972 1168,2182 1040,2400 914,2248', facetTone: 'orange' },
  { id: 's24', tone: 'greenDark', points: '1202,2074 1572,1988 1574,2310 1322,2480 1140,2316', facetPoints: '1362,2022 1562,2002 1562,2288 1366,2438', facetTone: 'green' },
  { id: 's25', tone: 'coral', points: '24,2418 236,2512 274,2746 42,2872', facetPoints: '138,2522 262,2736 54,2858 80,2694', facetTone: 'red' },
  { id: 's26', tone: 'yellow', points: '266,2506 522,2460 638,2688 510,2932 252,2858', facetPoints: '438,2478 626,2680 518,2914 410,2764', facetTone: 'orange' },
  { id: 's27', tone: 'green', points: '664,2446 978,2400 1106,2648 932,2894 636,2788', facetPoints: '882,2420 1094,2640 940,2878 804,2716', facetTone: 'green' },
  { id: 's28', tone: 'orange', points: '1130,2510 1572,2402 1572,2726 1326,2912 1084,2762', facetPoints: '1308,2436 1560,2416 1560,2712 1354,2870', facetTone: 'orange' },
  { id: 's29', tone: 'greenDark', points: '32,2898 334,2948 402,3178 208,3390 22,3264', facetPoints: '206,2962 390,3170 220,3374 126,3220', facetTone: 'green' },
  { id: 's30', tone: 'coral', points: '360,2950 660,2898 814,3138 674,3386 336,3282', facetPoints: '572,2920 802,3128 684,3368 544,3218', facetTone: 'red' },
  { id: 's31', tone: 'yellow', points: '846,2924 1168,2862 1302,3118 1122,3386 806,3276', facetPoints: '1076,2892 1290,3110 1132,3372 978,3212', facetTone: 'orange' },
  { id: 's32', tone: 'green', points: '1228,2952 1572,2894 1572,3208 1362,3408 1188,3232', facetPoints: '1388,2918 1560,2904 1560,3198 1402,3376', facetTone: 'green' },
  { id: 's33', tone: 'orange', points: '20,3340 212,3422 250,3688 44,3828', facetPoints: '118,3442 238,3678 54,3814 82,3648', facetTone: 'orange' },
  { id: 's34', tone: 'green', points: '236,3428 488,3378 642,3608 494,3868 216,3768', facetPoints: '430,3402 630,3598 504,3850 388,3702', facetTone: 'green' },
  { id: 's35', tone: 'coral', points: '668,3386 986,3340 1132,3594 972,3852 640,3744', facetPoints: '886,3360 1120,3582 982,3836 838,3684', facetTone: 'red' },
  { id: 's36', tone: 'yellow', points: '1160,3440 1570,3358 1574,3706 1332,3888 1128,3712', facetPoints: '1330,3390 1560,3372 1560,3690 1360,3848', facetTone: 'orange' },
  { id: 's37', tone: 'greenDark', points: '26,3864 306,3820 402,4094 202,4318 18,4178', facetPoints: '192,3842 390,4082 212,4302 110,4148', facetTone: 'green' },
  { id: 's38', tone: 'orange', points: '332,3888 706,3828 826,4084 658,4334 300,4236', facetPoints: '576,3850 812,4074 666,4318 526,4168', facetTone: 'orange' },
  { id: 's39', tone: 'yellow', points: '850,3854 1142,3802 1316,4046 1136,4318 814,4224', facetPoints: '1060,3822 1304,4036 1146,4302 1012,4148', facetTone: 'orange' },
  { id: 's40', tone: 'green', points: '1340,3898 1574,3836 1574,4166 1410,4366 1294,4194', facetPoints: '1442,3868 1562,3848 1562,4148 1428,4332', facetTone: 'green' },
  { id: 's41', tone: 'coral', points: '24,4346 266,4388 306,4626 40,4760', facetPoints: '158,4404 292,4612 50,4746 90,4592', facetTone: 'red' },
  { id: 's42', tone: 'greenDark', points: '292,4396 638,4342 760,4572 610,4806 260,4722', facetPoints: '528,4368 748,4560 620,4790 486,4654', facetTone: 'green' },
  { id: 's43', tone: 'orange', points: '788,4362 1128,4300 1288,4550 1120,4792 758,4704', facetPoints: '1020,4326 1278,4540 1130,4774 980,4628', facetTone: 'orange' },
  { id: 's44', tone: 'yellow', points: '1316,4394 1572,4340 1572,4672 1398,4878 1260,4688', facetPoints: '1424,4362 1560,4352 1560,4658 1410,4848', facetTone: 'orange' },
  { id: 's45', tone: 'green', points: '22,4782 248,4874 214,5192 20,5192', facetPoints: '148,4894 236,5180 74,5180', facetTone: 'green' },
  { id: 's46', tone: 'coral', points: '282,4832 638,4786 758,5192 264,5192', facetPoints: '520,4812 744,5180 404,5180', facetTone: 'red' },
  { id: 's47', tone: 'yellow', points: '786,4788 1172,4728 1332,5192 766,5192', facetPoints: '1048,4762 1320,5180 916,5180', facetTone: 'orange' },
  { id: 's48', tone: 'greenDark', points: '1362,4744 1574,4692 1574,5192 1328,5192', facetPoints: '1452,4724 1562,4702 1562,5180 1428,5180', facetTone: 'green' }
];

function PilgrimageStoneMap({
  stones,
  viewHeight = STONE_VIEWBOX_HEIGHT,
  includeEmblem = false
}: {
  stones: StonePolygon[];
  viewHeight?: number;
  includeEmblem?: boolean;
}) {
  return (
    <svg
      className="stone-map"
      viewBox={`0 0 ${STONE_VIEWBOX_WIDTH} ${viewHeight}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMin slice"
      aria-hidden="true"
      focusable="false"
    >
      <rect width={STONE_VIEWBOX_WIDTH} height={viewHeight} fill="#F1FDE8" />
      {stones.map((stone) => (
        <g key={stone.id}>
          <polygon points={stone.points} fill={STONE_MAIN_COLORS[stone.tone]} />
          {stone.facetPoints && stone.facetTone ? (
            <polygon points={stone.facetPoints} fill={STONE_FACET_COLORS[stone.facetTone]} />
          ) : null}
        </g>
      ))}
      {includeEmblem ? (
        <g transform="translate(548 190) scale(2.78)">
          <path fill="#88C529" d="m 35.7858,173.32382 73.23581,-4.81363 0.34384,-45.04173 90.77114,71.51666 -91.80263,71.86049 -1.0315,-46.07323 -81.487734,-7.22044 z" />
          <path fill="#FCE960" d="m 95.268459,150.63086 -59.482642,22.69285 73.235903,-4.81369 z m -69.453696,62.92117 68.422216,26.13095 13.065481,-18.91063 z" />
          <path fill="#FB9926" d="m 109.3654,123.46844 -14.096941,27.16242 13.753261,17.87916 z m -2.06294,97.30391 -13.065481,18.91063 14.096951,27.16243 z" />
          <path fill="#F45741" d="m 88.391819,28.915275 -9.283258,11.002527 5.844728,11.346208 10.65885,4.125892 10.658841,-11.346207 -2.75074,-11.690319 z M 83.921817,59.172115 51.60203,64.329483 41.630976,97.681179 61.3464,97.059199 48.507609,153.3816 l 7.410006,3.44671 8.805806,-3.36713 8.195871,-38.93232 14.097377,11.00253 3.73189,17.00038 11.544071,-22.14613 -0.14754,-1.38677 -16.847691,-16.16033 2.06295,-17.535047 6.18884,8.251786 18.910631,-0.68779 1.0018,23.041261 5.64987,3.8876 -1.83798,-25.897391 4.12589,-11.346204 h -19.9421 z" />
          <path fill="#6D8F1E" d="m 108.33396,266.84561 56.85311,-70.4817 -55.82163,-72.89545 90.77115,71.51666 z" />
          <path fill="#93260E" d="m 103.52024,32.353376 -5.556961,11.935929 -8.69182,8.646225 6.34068,2.454373 10.658841,-11.346208 z m -16.159891,52.950117 6.18884,8.251786 18.910631,-0.68779 1.0018,23.041261 2.75074,1.89261 -1.1089,-28.898463 -17.626671,-0.243029 z m -43.37092,4.488932 -2.358453,7.888754 19.715424,-0.62199 -12.83879,56.322421 7.410005,3.4467 15.180037,-66.223783 z m 30.390614,14.184265 -1.460752,10.55217 14.097378,11.00253 3.73189,17.00038 7.5227,-14.43116 z" />
          <text x="96.974197" y="193.02968" textAnchor="middle" fontFamily="'Reem Kufi', sans-serif" fontSize="17.6614" fill="#111111">Wielkanocna</text>
          <text x="96.246361" y="208.53749" textAnchor="middle" fontFamily="'Reem Kufi', sans-serif" fontSize="19.7448" fill="#111111">KALWARIA</text>
        </g>
      ) : null}
    </svg>
  );
}

function PilgrimageSectionBlock({ section }: { section: PilgrimageSection }) {
  return (
    <section className="pilgrimage-section-block" id={`kal-${section.id}`}>
      <header>
        <h2>{section.title}</h2>
        {section.lead ? <p>{section.lead}</p> : null}
      </header>
      <div className="pilgrimage-card-grid">
        {section.cards.map((card) => (
          <article key={card.id} className={`pilgrimage-card pilgrimage-card--${card.accent ?? 'default'}`}>
            <h3>{card.title}</h3>
            <p>{card.body}</p>
            {card.meta ? <small>{card.meta}</small> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function PilgrimageKalwariaLogo() {
  return (
    <svg viewBox="220 20 1040 255" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wielkanocna Kalwaria">
      <path
        fill="#F45741"
        d="m 367.24141,27.454415 -17.55436,20.805444 11.05221,21.455332 20.15554,7.801938 20.15556,-21.455333 -5.20157,-22.106037 z m -8.45264,57.214763 -61.11574,9.752425 -18.85495,63.067047 37.28126,-1.17615 -24.27776,106.50395 14.01209,6.51762 16.65151,-6.36714 15.49815,-73.61982 32.20737,22.85005 3.55183,52.30123 19.20071,1.05915 5.56275,-60.45561 -37.11603,-37.86086 3.90097,-33.15824 11.70291,15.60387 35.75942,-1.30059 1.89437,43.57032 10.68374,7.35133 -3.47557,-48.97116 7.80194,-21.45534 h -37.70992 z"
      />
      <path
        fill="#93260E"
        d="m 395.84879,33.95576 -10.50805,22.570476 -16.43597,16.349749 11.99003,4.641145 20.15556,-21.455333 z m -30.55786,100.12707 11.7029,15.60388 35.75944,-1.3006 1.89436,43.57032 5.20156,3.57886 -2.09689,-54.6461 -33.33149,-0.45956 z m -82.01309,8.48843 -4.45976,14.91738 37.28126,-1.17614 -24.27776,106.50396 14.01209,6.51761 28.70499,-125.22715 z m 57.46772,26.82201 -2.76224,19.95383 32.20738,22.85006 2.55959,37.69036 13.17283,-34.87665 z"
      />
      <text x="785.73004" y="116.91441" fill="#111111" textAnchor="middle" fontFamily="'Reem Kufi', sans-serif">
        <tspan x="785.73004" y="116.91441" fontSize="121.275">Wielkanocna</tspan>
        <tspan x="785.73004" y="256.28879" fontSize="176.4">Kalwaria</tspan>
      </text>
    </svg>
  );
}

function Kal26EventPage({
  copy,
  language,
  onLanguageChange,
  onAuthAction,
  authLabel,
  showProfileMenu,
  onProfileNavigate,
  onToggleSecureMode,
  onLogout,
  secureMode,
  onNavigate,
  page,
  event
}: SharedEventPageProps & { page: EventInnerPage; event: EventDefinition }) {
  const location = useLocation();
  const queryToken = useMemo(() => new URLSearchParams(location.search).get('token') ?? '', [location.search]);
  const [site, setSite] = useState<PilgrimageSite | null>(null);
  const [siteLoading, setSiteLoading] = useState(true);
  const [siteError, setSiteError] = useState<string | null>(null);

  const [registrationForm, setRegistrationForm] = useState<RegistrationFormState>(defaultRegistrationForm);
  const [registrationPending, setRegistrationPending] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [registrationResult, setRegistrationResult] = useState<{ link: string; token: string } | null>(null);
  const [registrationStep, setRegistrationStep] = useState<1 | 2 | 3 | 4>(1);

  const [participantToken, setParticipantToken] = useState(queryToken);
  const [participantPending, setParticipantPending] = useState(false);
  const [participantError, setParticipantError] = useState<string | null>(null);
  const [participantZone, setParticipantZone] = useState<PilgrimageParticipantZone | null>(null);
  const [participantIssueKind, setParticipantIssueKind] = useState('problem');
  const [participantIssueMessage, setParticipantIssueMessage] = useState('');
  const [participantIssuePending, setParticipantIssuePending] = useState(false);
  const [participantIssueStatus, setParticipantIssueStatus] = useState<string | null>(null);

  const [organizerPending, setOrganizerPending] = useState(false);
  const [organizerError, setOrganizerError] = useState<string | null>(null);
  const [organizerDashboard, setOrganizerDashboard] = useState<PilgrimageOrganizerDashboard | null>(null);
  const [participantDrafts, setParticipantDrafts] = useState<
    Record<string, {
      registrationStatus: string;
      paymentStatus: string;
      attendanceStatus: string;
      groupName: string;
      needsLodging: boolean;
      needsBaggageTransport: boolean;
    }>
  >({});
  const [issueDrafts, setIssueDrafts] = useState<Record<string, { status: string; resolutionNote: string }>>({});
  const [taskDrafts, setTaskDrafts] = useState<
    Record<string, {
      title: string;
      description: string;
      status: string;
      priority: string;
      assignee: string;
      comments: string;
      attachments: string;
      dueUtc: string;
    }>
  >({});
  const [inquiryDrafts, setInquiryDrafts] = useState<Record<string, { status: string }>>({});
  const [participantSearch, setParticipantSearch] = useState('');
  const [participantStatusFilter, setParticipantStatusFilter] = useState('all');
  const [participantPaymentFilter, setParticipantPaymentFilter] = useState('all');
  const [participantVariantFilter, setParticipantVariantFilter] = useState('all');
  const [organizerActionError, setOrganizerActionError] = useState<string | null>(null);
  const [organizerSavingId, setOrganizerSavingId] = useState<string | null>(null);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [announcementAudience, setAnnouncementAudience] = useState('participant');
  const [announcementCritical, setAnnouncementCritical] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskComments, setTaskComments] = useState('');
  const [taskAttachments, setTaskAttachments] = useState('');
  const [taskDueUtc, setTaskDueUtc] = useState('');

  const [contactForm, setContactForm] = useState<ContactFormState>(defaultContactForm);
  const [contactPending, setContactPending] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSuccess, setContactSuccess] = useState<string | null>(null);
  const [isHeaderCompact, setIsHeaderCompact] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setParticipantToken(queryToken);
  }, [queryToken]);

  useEffect(() => {
    const onScroll = () => {
      setIsHeaderCompact(window.scrollY > 24);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    let active = true;
    setSiteLoading(true);
    setSiteError(null);
    getPilgrimageSite(event.slug)
      .then((response) => {
        if (!active) return;
        setSite(response);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setSiteError(error instanceof Error ? error.message : 'Nie udalo sie pobrac strony pielgrzymki.');
      })
      .finally(() => {
        if (!active) return;
        setSiteLoading(false);
      });

    return () => {
      active = false;
    };
  }, [event.slug]);

  useEffect(() => {
    if (page.slug !== 'uczestnik') return;
    if (!participantToken || participantToken.trim().length === 0) return;
    if (participantZone || participantPending) return;

    setParticipantPending(true);
    setParticipantError(null);
    getPilgrimageParticipantZone(event.slug, participantToken.trim())
      .then((zone) => {
        setParticipantZone(zone);
      })
      .catch((error: unknown) => {
        setParticipantError(error instanceof Error ? error.message : 'Nie udalo sie zaladowac strefy uczestnika.');
      })
      .finally(() => {
        setParticipantPending(false);
      });
  }, [event.slug, page.slug, participantPending, participantToken, participantZone]);

  const loadOrganizerDashboard = async () => {
    if (!showProfileMenu) {
      setOrganizerDashboard(null);
      return;
    }
    if (!site?.id) {
      setOrganizerError('Panel organizatora wymaga skonfigurowanego wydarzenia w bazie.');
      return;
    }

    setOrganizerPending(true);
    setOrganizerError(null);
    try {
      const dashboard = await getPilgrimageOrganizerDashboard(site.id);
      setOrganizerDashboard(dashboard);
    } catch (error: unknown) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setOrganizerError('Brak dostepu do panelu organizatora dla aktualnych rol.');
      } else {
        setOrganizerError(error instanceof Error ? error.message : 'Nie udalo sie pobrac panelu organizatora.');
      }
    } finally {
      setOrganizerPending(false);
    }
  };

  useEffect(() => {
    if (page.slug !== 'organizator') return;
    void loadOrganizerDashboard();
  }, [page.slug, showProfileMenu, site?.id]);

  useEffect(() => {
    if (!organizerDashboard) return;
    const participantMap: Record<string, {
      registrationStatus: string;
      paymentStatus: string;
      attendanceStatus: string;
      groupName: string;
      needsLodging: boolean;
      needsBaggageTransport: boolean;
    }> = {};
    organizerDashboard.participants.forEach((entry) => {
      participantMap[entry.id] = {
        registrationStatus: entry.registrationStatus,
        paymentStatus: entry.paymentStatus,
        attendanceStatus: entry.attendanceStatus,
        groupName: entry.groupName ?? '',
        needsLodging: entry.needsLodging,
        needsBaggageTransport: entry.needsBaggageTransport
      };
    });
    setParticipantDrafts(participantMap);

    const issueMap: Record<string, { status: string; resolutionNote: string }> = {};
    organizerDashboard.issues.forEach((issue) => {
      issueMap[issue.id] = {
        status: issue.status,
        resolutionNote: issue.resolutionNote ?? ''
      };
    });
    setIssueDrafts(issueMap);

    const taskMap: Record<string, {
      title: string;
      description: string;
      status: string;
      priority: string;
      assignee: string;
      comments: string;
      attachments: string;
      dueUtc: string;
    }> = {};
    organizerDashboard.tasks.forEach((task) => {
      taskMap[task.id] = {
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assignee: task.assignee,
        comments: task.comments ?? '',
        attachments: task.attachments ?? '',
        dueUtc: task.dueUtc ? new Date(task.dueUtc).toISOString().slice(0, 16) : ''
      };
    });
    setTaskDrafts(taskMap);

    const inquiryMap: Record<string, { status: string }> = {};
    organizerDashboard.inquiries.forEach((inquiry) => {
      inquiryMap[inquiry.id] = { status: inquiry.status };
    });
    setInquiryDrafts(inquiryMap);
  }, [organizerDashboard]);

  const publicSections = site?.site.public.sections ?? [];
  const sectionById = (id: string) => publicSections.find((section) => section.id === id) ?? null;

  const aboutSections = useMemo(() => {
    const order = ['jak-wyglada', 'najwazniejsze'];
    return order
      .map((id) => sectionById(id))
      .filter((section): section is PilgrimageSection => section !== null);
  }, [publicSections]);

  const contactSections = useMemo(() => {
    const order = ['kontakt'];
    return order
      .map((id) => sectionById(id))
      .filter((section): section is PilgrimageSection => section !== null);
  }, [publicSections]);

  const filteredParticipants = useMemo(() => {
    if (!organizerDashboard) {
      return [];
    }

    const normalizedSearch = participantSearch.trim().toLowerCase();
    return organizerDashboard.participants.filter((row) => {
      if (participantStatusFilter !== 'all' && row.registrationStatus !== participantStatusFilter) {
        return false;
      }
      if (participantPaymentFilter !== 'all' && row.paymentStatus !== participantPaymentFilter) {
        return false;
      }
      if (participantVariantFilter !== 'all' && row.participationVariant !== participantVariantFilter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }

      const haystack = `${row.fullName} ${row.phone} ${row.email ?? ''} ${row.groupName ?? ''}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [
    organizerDashboard,
    participantPaymentFilter,
    participantSearch,
    participantStatusFilter,
    participantVariantFilter
  ]);

  const signupSection = sectionById('zapisy');
  const headerMenuPages = [
    { slug: 'o-pielgrzymce', label: 'INFORMACJE' },
    { slug: 'program', label: 'PROGRAM' },
    { slug: 'zapisy', label: 'REJESTRACJA' },
    { slug: 'uczestnik', label: 'GRUPY' },
    { slug: 'faq', label: 'FAQ' },
    { slug: 'formalnosci', label: 'POBIERZ' },
    { slug: 'galeria', label: 'HISTORIA' },
    { slug: 'kontakt', label: 'WSPARCIE' }
  ];

  useEffect(() => {
    setIsMenuOpen(false);
  }, [page.slug]);

  const handleRegistrationSubmit = async (eventForm: FormEvent) => {
    eventForm.preventDefault();
    if (registrationStep < 4) {
      goToNextRegistrationStep();
      return;
    }

    setRegistrationPending(true);
    setRegistrationError(null);
    setRegistrationResult(null);

    try {
      const response = await createPilgrimageRegistration(event.slug, {
        fullName: registrationForm.fullName,
        phone: registrationForm.phone,
        email: registrationForm.email || null,
        parish: registrationForm.parish || null,
        birthDate: registrationForm.birthDate || null,
        isMinor: registrationForm.isMinor,
        participationVariant: registrationForm.participationVariant,
        needsLodging: registrationForm.needsLodging,
        needsBaggageTransport: registrationForm.needsBaggageTransport,
        emergencyContactName: registrationForm.emergencyContactName,
        emergencyContactPhone: registrationForm.emergencyContactPhone,
        healthNotes: registrationForm.healthNotes || null,
        dietNotes: registrationForm.dietNotes || null,
        acceptedTerms: registrationForm.acceptedTerms,
        acceptedRodo: registrationForm.acceptedRodo,
        acceptedImageConsent: registrationForm.acceptedImageConsent
      });
      setRegistrationResult({ link: response.accessLink, token: response.accessToken });
      setParticipantToken(response.accessToken);
      setRegistrationForm(defaultRegistrationForm);
      setRegistrationStep(1);
    } catch (error: unknown) {
      setRegistrationError(error instanceof Error ? error.message : 'Nie udalo sie zapisac uczestnika.');
    } finally {
      setRegistrationPending(false);
    }
  };

  const goToNextRegistrationStep = () => {
    setRegistrationError(null);
    if (registrationStep === 1) {
      if (!registrationForm.fullName.trim() || !registrationForm.phone.trim()) {
        setRegistrationError('W kroku 1 uzupelnij imie i nazwisko oraz telefon.');
        return;
      }
    }

    if (registrationStep === 3) {
      if (!registrationForm.emergencyContactName.trim() || !registrationForm.emergencyContactPhone.trim()) {
        setRegistrationError('W kroku 3 uzupelnij kontakt awaryjny.');
        return;
      }
    }

    setRegistrationStep((previous) => (previous + 1) as 1 | 2 | 3 | 4);
  };

  const loadParticipantZone = async () => {
    if (!participantToken.trim()) {
      setParticipantError('Podaj token z SMS.');
      return;
    }

    setParticipantPending(true);
    setParticipantError(null);
    try {
      const zone = await getPilgrimageParticipantZone(event.slug, participantToken.trim());
      setParticipantZone(zone);
    } catch (error: unknown) {
      setParticipantError(error instanceof Error ? error.message : 'Nie udalo sie zaladowac strefy uczestnika.');
    } finally {
      setParticipantPending(false);
    }
  };

  const handleParticipantIssueSubmit = async (eventForm: FormEvent) => {
    eventForm.preventDefault();
    if (!participantToken.trim()) {
      setParticipantIssueStatus('Podaj token uczestnika.');
      return;
    }
    if (!participantIssueMessage.trim()) {
      setParticipantIssueStatus('Wpisz tresc zgloszenia.');
      return;
    }

    setParticipantIssuePending(true);
    setParticipantIssueStatus(null);
    try {
      await createPilgrimageParticipantIssue(event.slug, participantToken.trim(), {
        kind: participantIssueKind,
        message: participantIssueMessage.trim()
      });
      setParticipantIssueMessage('');
      setParticipantIssueStatus('Zgloszenie wyslane do organizatorow.');
    } catch (error: unknown) {
      setParticipantIssueStatus(error instanceof Error ? error.message : 'Nie udalo sie wyslac zgloszenia.');
    } finally {
      setParticipantIssuePending(false);
    }
  };

  const handleContactSubmit = async (eventForm: FormEvent) => {
    eventForm.preventDefault();
    setContactPending(true);
    setContactError(null);
    setContactSuccess(null);
    try {
      await createPilgrimageContactInquiry(event.slug, {
        name: contactForm.name,
        phone: contactForm.phone || null,
        email: contactForm.email || null,
        topic: contactForm.topic,
        message: contactForm.message
      });
      setContactSuccess('Wiadomosc zostala wyslana.');
      setContactForm(defaultContactForm);
    } catch (error: unknown) {
      setContactError(error instanceof Error ? error.message : 'Nie udalo sie wyslac wiadomosci.');
    } finally {
      setContactPending(false);
    }
  };

  const handleParticipantUpdate = async (participantId: string) => {
    if (!site?.id) return;
    const draft = participantDrafts[participantId];
    if (!draft) return;

    setOrganizerActionError(null);
    setOrganizerSavingId(`participant:${participantId}`);
    try {
      await updatePilgrimageParticipant(site.id, participantId, {
        registrationStatus: draft.registrationStatus,
        paymentStatus: draft.paymentStatus,
        attendanceStatus: draft.attendanceStatus,
        groupName: draft.groupName || null,
        needsLodging: draft.needsLodging,
        needsBaggageTransport: draft.needsBaggageTransport
      });
      await loadOrganizerDashboard();
    } catch (error: unknown) {
      setOrganizerActionError(error instanceof Error ? error.message : 'Nie udalo sie zaktualizowac uczestnika.');
    } finally {
      setOrganizerSavingId(null);
    }
  };

  const handleIssueUpdate = async (issueId: string) => {
    if (!site?.id) return;
    const draft = issueDrafts[issueId];
    if (!draft) return;

    setOrganizerActionError(null);
    setOrganizerSavingId(`issue:${issueId}`);
    try {
      await updatePilgrimageIssue(site.id, issueId, {
        status: draft.status,
        resolutionNote: draft.resolutionNote || null
      });
      await loadOrganizerDashboard();
    } catch (error: unknown) {
      setOrganizerActionError(error instanceof Error ? error.message : 'Nie udalo sie zaktualizowac zgloszenia.');
    } finally {
      setOrganizerSavingId(null);
    }
  };

  const handleTaskUpdate = async (taskId: string) => {
    if (!site?.id) return;
    const draft = taskDrafts[taskId];
    if (!draft) return;

    setOrganizerActionError(null);
    setOrganizerSavingId(`task:${taskId}`);
    try {
      await updatePilgrimageTask(site.id, taskId, {
        title: draft.title,
        description: draft.description,
        status: draft.status,
        priority: draft.priority,
        assignee: draft.assignee,
        comments: draft.comments || null,
        attachments: draft.attachments || null,
        dueUtc: draft.dueUtc ? new Date(draft.dueUtc).toISOString() : null
      });
      await loadOrganizerDashboard();
    } catch (error: unknown) {
      setOrganizerActionError(error instanceof Error ? error.message : 'Nie udalo sie zaktualizowac zadania.');
    } finally {
      setOrganizerSavingId(null);
    }
  };

  const handleInquiryUpdate = async (inquiryId: string) => {
    if (!site?.id) return;
    const draft = inquiryDrafts[inquiryId];
    if (!draft) return;

    setOrganizerActionError(null);
    setOrganizerSavingId(`inquiry:${inquiryId}`);
    try {
      await updatePilgrimageInquiry(site.id, inquiryId, { status: draft.status });
      await loadOrganizerDashboard();
    } catch (error: unknown) {
      setOrganizerActionError(error instanceof Error ? error.message : 'Nie udalo sie zaktualizowac zapytania.');
    } finally {
      setOrganizerSavingId(null);
    }
  };

  const handleAnnouncementCreate = async (eventForm: FormEvent) => {
    eventForm.preventDefault();
    if (!site?.id) return;
    setOrganizerActionError(null);
    setOrganizerSavingId('announcement:create');
    try {
      await createPilgrimageAnnouncement(site.id, {
        audience: announcementAudience,
        title: announcementTitle,
        body: announcementBody,
        isCritical: announcementCritical
      });
      setAnnouncementTitle('');
      setAnnouncementBody('');
      setAnnouncementCritical(false);
      await loadOrganizerDashboard();
    } catch (error: unknown) {
      setOrganizerActionError(error instanceof Error ? error.message : 'Nie udalo sie dodac komunikatu.');
    } finally {
      setOrganizerSavingId(null);
    }
  };

  const handleTaskCreate = async (eventForm: FormEvent) => {
    eventForm.preventDefault();
    if (!site?.id) return;
    setOrganizerActionError(null);
    setOrganizerSavingId('task:create');
    try {
      await createPilgrimageTask(site.id, {
        title: taskTitle,
        description: taskDescription,
        status: 'todo',
        priority: 'normal',
        assignee: taskAssignee || undefined,
        comments: taskComments || null,
        attachments: taskAttachments || null,
        dueUtc: taskDueUtc ? new Date(taskDueUtc).toISOString() : null
      });
      setTaskTitle('');
      setTaskDescription('');
      setTaskAssignee('');
      setTaskComments('');
      setTaskAttachments('');
      setTaskDueUtc('');
      await loadOrganizerDashboard();
    } catch (error: unknown) {
      setOrganizerActionError(error instanceof Error ? error.message : 'Nie udalo sie dodac zadania.');
    } finally {
      setOrganizerSavingId(null);
    }
  };

  const renderPublicPage = () => {
    const programSection = sectionById('program');
    const routeSection = sectionById('trasa');
    const gallerySection = sectionById('foto');
    const checklistSection = sectionById('niezbednik');
    const faqSection = sectionById('faq');
    const legalSection = sectionById('formalnosci');

    if (page.slug === 'start') {
      return (
        <section className="pilgrimage-start-stage" aria-label="Wielkanocna Kalwaria background">
          <PilgrimageStoneMap stones={START_BACKGROUND_STONES} viewHeight={START_STAGE_VIEWBOX_HEIGHT} includeEmblem />
          <div className="start-blank-height" />
        </section>
      );
    }

    if (page.slug === 'o-pielgrzymce') {
      return <>{aboutSections.map((section) => <PilgrimageSectionBlock key={section.id} section={section} />)}</>;
    }

    if (page.slug === 'program' && programSection) {
      return <PilgrimageSectionBlock section={programSection} />;
    }

    if (page.slug === 'trasa' && routeSection) {
      return (
        <>
          <PilgrimageSectionBlock section={routeSection} />
          <section className="pilgrimage-signup-form">
            <h3>Mapa i pliki trasy</h3>
            <div className="pilgrimage-quick-links">
              <a className="ghost" href={`/#/event/${event.slug}/kontakt`}>Pobierz mape PDF (w przygotowaniu)</a>
              <a className="ghost" href="https://maps.google.com" target="_blank" rel="noreferrer">Otworz trase w Google Maps</a>
              <a className="ghost" href={`/#/event/${event.slug}/kontakt`}>Pobierz plik GPX (w przygotowaniu)</a>
            </div>
          </section>
        </>
      );
    }

    if (page.slug === 'niezbednik' && checklistSection) {
      return <PilgrimageSectionBlock section={checklistSection} />;
    }

    if (page.slug === 'galeria' && gallerySection) {
      return (
        <section className="pilgrimage-section-block">
          <header>
            <h2>Galeria</h2>
            <p>A curated visual story: departure, route, prayer, rest, and arrival.</p>
          </header>
          <div className="pilgrimage-gallery-grid">
            {gallerySection.cards.map((card, index) => (
              <article key={card.id} className={`pilgrimage-gallery-item pilgrimage-gallery-item--${(index % 6) + 1}`}>
                <div className="pilgrimage-gallery-overlay">
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                  {card.meta ? <small>{card.meta}</small> : null}
                </div>
              </article>
            ))}
          </div>
          <div className="pilgrimage-quick-links">
            <a className="ghost" href={`/#/event/${event.slug}/kontakt`}>Send more photos to organizers</a>
          </div>
        </section>
      );
    }

    if (page.slug === 'faq' && faqSection) {
      return (
        <section className="pilgrimage-section-block" id={`kal-${faqSection.id}`}>
          <header>
            <h2>{faqSection.title}</h2>
            {faqSection.lead ? <p>{faqSection.lead}</p> : null}
          </header>
          <div className="pilgrimage-accordion">
            {faqSection.cards.map((card) => (
              <details key={card.id} className="pilgrimage-accordion-item">
                <summary>{card.title}</summary>
                <p>{card.body}</p>
                {card.meta ? <small>{card.meta}</small> : null}
              </details>
            ))}
          </div>
        </section>
      );
    }

    if (page.slug === 'formalnosci' && legalSection) {
      return <PilgrimageSectionBlock section={legalSection} />;
    }

    if (page.slug === 'kontakt') {
      return (
        <>
          {contactSections.map((section) => <PilgrimageSectionBlock key={section.id} section={section} />)}
          <section className="pilgrimage-signup-form">
            <h2>Formularz kontaktowy</h2>
            <form onSubmit={handleContactSubmit}>
              <div className="pilgrimage-form-grid">
                <label>
                  Imie i nazwisko
                  <input
                    value={contactForm.name}
                    onChange={(eventInput) => setContactForm((previous) => ({ ...previous, name: eventInput.target.value }))}
                    required
                  />
                </label>
                <label>
                  Telefon
                  <input
                    value={contactForm.phone}
                    onChange={(eventInput) => setContactForm((previous) => ({ ...previous, phone: eventInput.target.value }))}
                  />
                </label>
                <label>
                  E-mail
                  <input
                    value={contactForm.email}
                    onChange={(eventInput) => setContactForm((previous) => ({ ...previous, email: eventInput.target.value }))}
                  />
                </label>
                <label>
                  Temat
                  <input
                    value={contactForm.topic}
                    onChange={(eventInput) => setContactForm((previous) => ({ ...previous, topic: eventInput.target.value }))}
                    required
                  />
                </label>
                <label className="full-width">
                  Wiadomosc
                  <textarea
                    value={contactForm.message}
                    onChange={(eventInput) => setContactForm((previous) => ({ ...previous, message: eventInput.target.value }))}
                    required
                  />
                </label>
              </div>
              <button className="cta" type="submit" disabled={contactPending}>
                {contactPending ? 'Wysylanie...' : 'Wyslij'}
              </button>
              {contactError ? <p className="pilgrimage-error">{contactError}</p> : null}
              {contactSuccess ? <p className="pilgrimage-success">{contactSuccess}</p> : null}
            </form>
          </section>
        </>
      );
    }

    if (page.slug === 'zapisy') {
      return (
        <>
          {signupSection ? <PilgrimageSectionBlock section={signupSection} /> : null}
          <section className="pilgrimage-signup-form">
            <h2>Formularz zapisow (4 kroki)</h2>
            <form onSubmit={handleRegistrationSubmit}>
              <p>Krok {registrationStep} z 4</p>
              {registrationStep === 1 ? (
                <div className="pilgrimage-form-grid">
                  <label>
                    Imie i nazwisko
                    <input
                      value={registrationForm.fullName}
                      onChange={(eventInput) =>
                        setRegistrationForm((previous) => ({ ...previous, fullName: eventInput.target.value }))
                      }
                      required
                    />
                  </label>
                  <label>
                    Telefon
                    <input
                      value={registrationForm.phone}
                      onChange={(eventInput) =>
                        setRegistrationForm((previous) => ({ ...previous, phone: eventInput.target.value }))
                      }
                      required
                    />
                  </label>
                  <label>
                    E-mail
                    <input
                      value={registrationForm.email}
                      onChange={(eventInput) =>
                        setRegistrationForm((previous) => ({ ...previous, email: eventInput.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Parafia / wspolnota
                    <input
                      value={registrationForm.parish}
                      onChange={(eventInput) =>
                        setRegistrationForm((previous) => ({ ...previous, parish: eventInput.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Data urodzenia
                    <input
                      type="date"
                      value={registrationForm.birthDate}
                      onChange={(eventInput) =>
                        setRegistrationForm((previous) => ({ ...previous, birthDate: eventInput.target.value }))
                      }
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={registrationForm.isMinor}
                      onChange={(eventInput) =>
                        setRegistrationForm((previous) => ({ ...previous, isMinor: eventInput.target.checked }))
                      }
                    />
                    Uczestnik niepelnoletni
                  </label>
                </div>
              ) : null}

              {registrationStep === 2 ? (
                <div className="pilgrimage-form-grid">
                  <label>
                    Wariant udzialu
                    <select
                      value={registrationForm.participationVariant}
                      onChange={(eventInput) =>
                        setRegistrationForm((previous) => ({ ...previous, participationVariant: eventInput.target.value }))
                      }
                    >
                      <option value="full">Calosc</option>
                      <option value="saturday">Tylko sobota</option>
                      <option value="without-lodging">Bez noclegu</option>
                      <option value="with-lodging">Z noclegiem</option>
                    </select>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={registrationForm.needsLodging}
                      onChange={(eventInput) =>
                        setRegistrationForm((previous) => ({ ...previous, needsLodging: eventInput.target.checked }))
                      }
                    />
                    Potrzebuje noclegu
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={registrationForm.needsBaggageTransport}
                      onChange={(eventInput) =>
                        setRegistrationForm((previous) => ({ ...previous, needsBaggageTransport: eventInput.target.checked }))
                      }
                    />
                    Potrzebuje transportu bagazu
                  </label>
                </div>
              ) : null}

              {registrationStep === 3 ? (
                <div className="pilgrimage-form-grid">
                  <label>
                    Kontakt awaryjny (imie i nazwisko)
                    <input
                      value={registrationForm.emergencyContactName}
                      onChange={(eventInput) =>
                        setRegistrationForm((previous) => ({ ...previous, emergencyContactName: eventInput.target.value }))
                      }
                      required
                    />
                  </label>
                  <label>
                    Telefon awaryjny
                    <input
                      value={registrationForm.emergencyContactPhone}
                      onChange={(eventInput) =>
                        setRegistrationForm((previous) => ({ ...previous, emergencyContactPhone: eventInput.target.value }))
                      }
                      required
                    />
                  </label>
                  <label className="full-width">
                    Uwagi zdrowotne
                    <textarea
                      value={registrationForm.healthNotes}
                      onChange={(eventInput) =>
                        setRegistrationForm((previous) => ({ ...previous, healthNotes: eventInput.target.value }))
                      }
                    />
                  </label>
                  <label className="full-width">
                    Dieta i preferencje
                    <textarea
                      value={registrationForm.dietNotes}
                      onChange={(eventInput) =>
                        setRegistrationForm((previous) => ({ ...previous, dietNotes: eventInput.target.value }))
                      }
                    />
                  </label>
                </div>
              ) : null}

              {registrationStep === 4 ? (
                <div className="pilgrimage-form-checks">
                  <label>
                    <input
                      type="checkbox"
                      checked={registrationForm.acceptedTerms}
                      onChange={(eventInput) =>
                        setRegistrationForm((previous) => ({ ...previous, acceptedTerms: eventInput.target.checked }))
                      }
                      required
                    />
                    Akceptuje regulamin
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={registrationForm.acceptedRodo}
                      onChange={(eventInput) =>
                        setRegistrationForm((previous) => ({ ...previous, acceptedRodo: eventInput.target.checked }))
                      }
                      required
                    />
                    Akceptuje RODO
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={registrationForm.acceptedImageConsent}
                      onChange={(eventInput) =>
                        setRegistrationForm((previous) => ({ ...previous, acceptedImageConsent: eventInput.target.checked }))
                      }
                    />
                    Zgoda na wykorzystanie wizerunku
                  </label>
                </div>
              ) : null}

              <div className="pilgrimage-quick-links">
                {registrationStep > 1 ? (
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => {
                      setRegistrationError(null);
                      setRegistrationStep((previous) => (previous - 1) as 1 | 2 | 3 | 4);
                    }}
                  >
                    Wstecz
                  </button>
                ) : null}
                {registrationStep < 4 ? (
                  <button className="cta" type="button" onClick={goToNextRegistrationStep}>
                    Dalej
                  </button>
                ) : (
                  <button className="cta" type="submit" disabled={registrationPending}>
                    {registrationPending ? 'Zapisywanie...' : 'Wyslij zapis'}
                  </button>
                )}
              </div>
              {registrationError ? <p className="pilgrimage-error">{registrationError}</p> : null}
              {registrationResult ? (
                <p className="pilgrimage-success">
                  Zapisano. Link uczestnika: <a href={registrationResult.link}>{registrationResult.link}</a>
                </p>
              ) : null}
            </form>
          </section>
        </>
      );
    }

    return <p>Brak tresci dla wybranej sekcji.</p>;
  };

  const renderParticipantPage = () => {
    return (
      <>
        <section className="pilgrimage-participant-access">
          <h2>Strefa uczestnika</h2>
          <p>Dostep przez unikalny link wysylany SMS po zapisie.</p>
          <div className="pilgrimage-participant-token-row">
            <input
              placeholder="Wklej token z SMS"
              value={participantToken}
              onChange={(eventInput) => setParticipantToken(eventInput.target.value)}
            />
            <button className="cta" onClick={loadParticipantZone} disabled={participantPending}>
              {participantPending ? 'Ladowanie...' : 'Otworz'}
            </button>
          </div>
          {participantError ? <p className="pilgrimage-error">{participantError}</p> : null}
        </section>

        {participantZone ? (
          <>
            <section className="pilgrimage-participant-profile">
              <h3>{participantZone.participant.fullName}</h3>
              <p>
                Status: <strong>{participantZone.participant.registrationStatus}</strong> | Platnosc:{' '}
                <strong>{participantZone.participant.paymentStatus}</strong> | Obecnosc:{' '}
                <strong>{participantZone.participant.attendanceStatus}</strong>
              </p>
              <p>
                Wariant: {participantZone.participant.participationVariant} | Nocleg:{' '}
                {participantZone.participant.needsLodging ? 'tak' : 'nie'} | Bagaz:{' '}
                {participantZone.participant.needsBaggageTransport ? 'tak' : 'nie'}
              </p>
              <p>
                Grupa: {participantZone.participant.groupName || 'nieprzypisana'} | Kontakt awaryjny:{' '}
                {participantZone.participant.emergencyContactName} ({participantZone.participant.emergencyContactPhone})
              </p>
              {(participantZone.announcements.find((entry) => entry.isCritical) ?? participantZone.announcements[0]) ? (
                <p className="pilgrimage-warning">
                  Nearest update:{' '}
                  <strong>
                    {(participantZone.announcements.find((entry) => entry.isCritical) ?? participantZone.announcements[0])?.title}
                  </strong>
                </p>
              ) : null}
              <div className="pilgrimage-quick-links">
                <a className="ghost" href="#kal-participant-schedule">Harmonogram</a>
                <a className="ghost" href="#kal-participant-checklist">Co zabrac</a>
                <a className="ghost" href="#kal-participant-emergency">Kontakt awaryjny</a>
                <a className="ghost" href={`/#/event/${event.slug}/trasa`}>Mapa trasy</a>
              </div>
            </section>

            {participantZone.zone.sections.map((section) => (
              <PilgrimageSectionBlock key={section.id} section={section} />
            ))}

            <section className="pilgrimage-announcements">
              <h3>Komunikaty</h3>
              <div className="pilgrimage-announcement-list">
                {participantZone.announcements.map((entry) => (
                  <article key={entry.id} className={entry.isCritical ? 'critical' : ''}>
                    <h4>{entry.title}</h4>
                    <p>{entry.body}</p>
                    <small>{new Date(entry.createdUtc).toLocaleString()}</small>
                  </article>
                ))}
              </div>
            </section>

            <section className="pilgrimage-signup-form">
              <h3>Zglos problem / potrzebe odbioru</h3>
              <div className="pilgrimage-quick-links">
                <a className="ghost" href={`tel:${participantZone.participant.emergencyContactPhone}`}>Zadzwon awaryjnie</a>
                <a className="ghost" href={`sms:${participantZone.participant.emergencyContactPhone}`}>Wyslij SMS</a>
              </div>
              <form onSubmit={handleParticipantIssueSubmit}>
                <div className="pilgrimage-form-grid">
                  <label>
                    Typ zgloszenia
                    <select value={participantIssueKind} onChange={(eventInput) => setParticipantIssueKind(eventInput.target.value)}>
                      <option value="problem">Problem na trasie</option>
                      <option value="pickup">Potrzeba odbioru</option>
                      <option value="resignation">Rezygnacja</option>
                      <option value="health-alert">Alert zdrowotny</option>
                      <option value="question">Pytanie</option>
                    </select>
                  </label>
                  <label className="full-width">
                    Opis
                    <textarea
                      value={participantIssueMessage}
                      onChange={(eventInput) => setParticipantIssueMessage(eventInput.target.value)}
                      required
                    />
                  </label>
                </div>
                <button className="cta" type="submit" disabled={participantIssuePending}>
                  {participantIssuePending ? 'Wysylanie...' : 'Wyslij zgloszenie'}
                </button>
                {participantIssueStatus ? <p className="pilgrimage-success">{participantIssueStatus}</p> : null}
              </form>
            </section>
          </>
        ) : null}
      </>
    );
  };

  const renderOrganizerPage = () => {
    if (!showProfileMenu) {
      return (
        <section className="pilgrimage-organizer-locked">
          <h2>Panel organizatora</h2>
          <p>Zaloguj sie, aby przejsc do panelu z danymi uczestnikow, zadaniami i komunikatami.</p>
          <button className="cta" onClick={onAuthAction}>Zaloguj</button>
        </section>
      );
    }

    if (organizerPending) {
      return <p>Ladowanie panelu organizatora...</p>;
    }

    if (organizerError) {
      return <p className="pilgrimage-error">{organizerError}</p>;
    }

    if (!organizerDashboard) {
      return <p>Brak danych panelu organizatora.</p>;
    }

    return (
      <>
        <section className="pilgrimage-organizer-stats">
          <h2>Dashboard</h2>
          <div className="pilgrimage-card-grid">
            <article className="pilgrimage-card"><h3>Zgloszenia</h3><p>{organizerDashboard.stats.registrations}</p></article>
            <article className="pilgrimage-card"><h3>Potwierdzone</h3><p>{organizerDashboard.stats.confirmed}</p></article>
            <article className="pilgrimage-card"><h3>Oplaceni</h3><p>{organizerDashboard.stats.paid}</p></article>
            <article className="pilgrimage-card"><h3>Nocleg</h3><p>{organizerDashboard.stats.withLodging}</p></article>
            <article className="pilgrimage-card"><h3>Jednodniowi</h3><p>{organizerDashboard.stats.oneDay}</p></article>
            <article className="pilgrimage-card"><h3>Niepelnoletni</h3><p>{organizerDashboard.stats.minors}</p></article>
            <article className="pilgrimage-card"><h3>Otwarte zadania</h3><p>{organizerDashboard.stats.openTasks}</p></article>
            <article className="pilgrimage-card"><h3>Krytyczne komunikaty</h3><p>{organizerDashboard.stats.criticalAnnouncements}</p></article>
          </div>
          <div className="pilgrimage-quick-links">
            <a className="ghost" href="#kal-org-participants">Uczestnicy</a>
            <a className="ghost" href="#kal-org-tasks">Zadania</a>
            <a className="ghost" href="#kal-org-announcements">Komunikaty</a>
            <a className="ghost" href="#kal-org-issues">Zgloszenia</a>
            <a className="ghost" href="#kal-org-inquiries">Zapytania</a>
          </div>
        </section>

        {organizerDashboard.zone.sections.map((section) => (
          <PilgrimageSectionBlock key={section.id} section={section} />
        ))}

        {organizerActionError ? <p className="pilgrimage-error">{organizerActionError}</p> : null}

        <section className="pilgrimage-signup-form">
          <h3>Nowy komunikat</h3>
          <form onSubmit={handleAnnouncementCreate}>
            <div className="pilgrimage-form-grid">
              <label>
                Odbiorcy
                <select value={announcementAudience} onChange={(eventInput) => setAnnouncementAudience(eventInput.target.value)}>
                  <option value="participant">participant</option>
                  <option value="public">public</option>
                  <option value="organizer">organizer</option>
                  <option value="all">all</option>
                </select>
              </label>
              <label>
                Tytul
                <input value={announcementTitle} onChange={(eventInput) => setAnnouncementTitle(eventInput.target.value)} required />
              </label>
              <label className="full-width">
                Tresc
                <textarea value={announcementBody} onChange={(eventInput) => setAnnouncementBody(eventInput.target.value)} required />
              </label>
            </div>
            <label>
              <input
                type="checkbox"
                checked={announcementCritical}
                onChange={(eventInput) => setAnnouncementCritical(eventInput.target.checked)}
              />
              Krytyczny komunikat
            </label>
            <button className="cta" type="submit" disabled={organizerSavingId === 'announcement:create'}>
              {organizerSavingId === 'announcement:create' ? 'Zapisywanie...' : 'Dodaj komunikat'}
            </button>
          </form>
        </section>

        <section className="pilgrimage-signup-form">
          <h3>Nowe zadanie</h3>
          <form onSubmit={handleTaskCreate}>
            <div className="pilgrimage-form-grid">
              <label>
                Tytul
                <input value={taskTitle} onChange={(eventInput) => setTaskTitle(eventInput.target.value)} required />
              </label>
              <label>
                Odpowiedzialny
                <input value={taskAssignee} onChange={(eventInput) => setTaskAssignee(eventInput.target.value)} />
              </label>
              <label>
                Termin
                <input type="datetime-local" value={taskDueUtc} onChange={(eventInput) => setTaskDueUtc(eventInput.target.value)} />
              </label>
              <label className="full-width">
                Opis
                <textarea value={taskDescription} onChange={(eventInput) => setTaskDescription(eventInput.target.value)} required />
              </label>
              <label className="full-width">
                Komentarze
                <textarea value={taskComments} onChange={(eventInput) => setTaskComments(eventInput.target.value)} />
              </label>
              <label className="full-width">
                Zalaczniki (linki)
                <input value={taskAttachments} onChange={(eventInput) => setTaskAttachments(eventInput.target.value)} />
              </label>
            </div>
            <button className="cta" type="submit" disabled={organizerSavingId === 'task:create'}>
              {organizerSavingId === 'task:create' ? 'Zapisywanie...' : 'Dodaj zadanie'}
            </button>
          </form>
        </section>

        <section className="pilgrimage-organizer-participants" id="kal-org-participants">
          <h3>Uczestnicy</h3>
          {site?.id ? (
            <div className="pilgrimage-quick-links">
              <a className="ghost" href={getPilgrimageExportUrl(site.id, 'participants')} target="_blank" rel="noreferrer">
                CSV uczestnicy
              </a>
              <a className="ghost" href={getPilgrimageExportUrl(site.id, 'lodging')} target="_blank" rel="noreferrer">
                CSV nocleg
              </a>
              <a className="ghost" href={getPilgrimageExportUrl(site.id, 'payments')} target="_blank" rel="noreferrer">
                CSV oplaty
              </a>
              <a className="ghost" href={getPilgrimageExportUrl(site.id, 'contacts')} target="_blank" rel="noreferrer">
                CSV kontakty
              </a>
              <a className="ghost" href={getPilgrimageExportUrl(site.id, 'groups')} target="_blank" rel="noreferrer">
                CSV grupy
              </a>
              <a className="ghost" href={getPilgrimageExportUrl(site.id, 'attendance')} target="_blank" rel="noreferrer">
                CSV obecnosc
              </a>
            </div>
          ) : null}
          <div className="pilgrimage-form-grid">
            <label>
              Szukaj
              <input
                value={participantSearch}
                onChange={(eventInput) => setParticipantSearch(eventInput.target.value)}
                placeholder="Imie, telefon, email, grupa"
              />
            </label>
            <label>
              Status zgloszenia
              <select value={participantStatusFilter} onChange={(eventInput) => setParticipantStatusFilter(eventInput.target.value)}>
                <option value="all">all</option>
                <option value="pending">pending</option>
                <option value="confirmed">confirmed</option>
                <option value="cancelled">cancelled</option>
                <option value="rejected">rejected</option>
              </select>
            </label>
            <label>
              Status platnosci
              <select value={participantPaymentFilter} onChange={(eventInput) => setParticipantPaymentFilter(eventInput.target.value)}>
                <option value="all">all</option>
                <option value="pending">pending</option>
                <option value="paid">paid</option>
                <option value="waived">waived</option>
                <option value="refunded">refunded</option>
              </select>
            </label>
            <label>
              Wariant
              <select value={participantVariantFilter} onChange={(eventInput) => setParticipantVariantFilter(eventInput.target.value)}>
                <option value="all">all</option>
                <option value="full">full</option>
                <option value="saturday">saturday</option>
                <option value="without-lodging">without-lodging</option>
                <option value="with-lodging">with-lodging</option>
              </select>
            </label>
          </div>
          <div className="pilgrimage-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Imie i nazwisko</th>
                  <th>Telefon</th>
                  <th>E-mail</th>
                  <th>Wariant</th>
                  <th>Grupa</th>
                  <th>Nocleg</th>
                  <th>Bagaz</th>
                  <th>Platnosc</th>
                  <th>Status</th>
                  <th>Obecnosc</th>
                  <th>Awaryjny</th>
                  <th>Zdrowie / dieta</th>
                  <th>Akcja</th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.map((row) => (
                  <tr key={row.id}>
                    <td>{row.fullName}</td>
                    <td>{row.phone}</td>
                    <td>{row.email || '-'}</td>
                    <td>{row.participationVariant}</td>
                    <td>
                      <input
                        value={participantDrafts[row.id]?.groupName ?? ''}
                        onChange={(eventInput) =>
                          setParticipantDrafts((previous) => ({
                            ...previous,
                            [row.id]: {
                              registrationStatus: previous[row.id]?.registrationStatus ?? row.registrationStatus,
                              paymentStatus: previous[row.id]?.paymentStatus ?? row.paymentStatus,
                              attendanceStatus: previous[row.id]?.attendanceStatus ?? row.attendanceStatus,
                              groupName: eventInput.target.value,
                              needsLodging: previous[row.id]?.needsLodging ?? row.needsLodging,
                              needsBaggageTransport: previous[row.id]?.needsBaggageTransport ?? row.needsBaggageTransport
                            }
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={participantDrafts[row.id]?.needsLodging ?? row.needsLodging}
                        onChange={(eventInput) =>
                          setParticipantDrafts((previous) => ({
                            ...previous,
                            [row.id]: {
                              registrationStatus: previous[row.id]?.registrationStatus ?? row.registrationStatus,
                              paymentStatus: previous[row.id]?.paymentStatus ?? row.paymentStatus,
                              attendanceStatus: previous[row.id]?.attendanceStatus ?? row.attendanceStatus,
                              groupName: previous[row.id]?.groupName ?? row.groupName ?? '',
                              needsLodging: eventInput.target.checked,
                              needsBaggageTransport: previous[row.id]?.needsBaggageTransport ?? row.needsBaggageTransport
                            }
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={participantDrafts[row.id]?.needsBaggageTransport ?? row.needsBaggageTransport}
                        onChange={(eventInput) =>
                          setParticipantDrafts((previous) => ({
                            ...previous,
                            [row.id]: {
                              registrationStatus: previous[row.id]?.registrationStatus ?? row.registrationStatus,
                              paymentStatus: previous[row.id]?.paymentStatus ?? row.paymentStatus,
                              attendanceStatus: previous[row.id]?.attendanceStatus ?? row.attendanceStatus,
                              groupName: previous[row.id]?.groupName ?? row.groupName ?? '',
                              needsLodging: previous[row.id]?.needsLodging ?? row.needsLodging,
                              needsBaggageTransport: eventInput.target.checked
                            }
                          }))
                        }
                      />
                    </td>
                    <td>
                      <select
                        value={participantDrafts[row.id]?.paymentStatus ?? row.paymentStatus}
                        onChange={(eventInput) =>
                          setParticipantDrafts((previous) => ({
                            ...previous,
                            [row.id]: {
                              registrationStatus: previous[row.id]?.registrationStatus ?? row.registrationStatus,
                              paymentStatus: eventInput.target.value,
                              attendanceStatus: previous[row.id]?.attendanceStatus ?? row.attendanceStatus,
                              groupName: previous[row.id]?.groupName ?? row.groupName ?? '',
                              needsLodging: previous[row.id]?.needsLodging ?? row.needsLodging,
                              needsBaggageTransport: previous[row.id]?.needsBaggageTransport ?? row.needsBaggageTransport
                            }
                          }))
                        }
                      >
                        <option value="pending">pending</option>
                        <option value="paid">paid</option>
                        <option value="waived">waived</option>
                        <option value="refunded">refunded</option>
                      </select>
                    </td>
                    <td>
                      <select
                        value={participantDrafts[row.id]?.registrationStatus ?? row.registrationStatus}
                        onChange={(eventInput) =>
                          setParticipantDrafts((previous) => ({
                            ...previous,
                            [row.id]: {
                              registrationStatus: eventInput.target.value,
                              paymentStatus: previous[row.id]?.paymentStatus ?? row.paymentStatus,
                              attendanceStatus: previous[row.id]?.attendanceStatus ?? row.attendanceStatus,
                              groupName: previous[row.id]?.groupName ?? row.groupName ?? '',
                              needsLodging: previous[row.id]?.needsLodging ?? row.needsLodging,
                              needsBaggageTransport: previous[row.id]?.needsBaggageTransport ?? row.needsBaggageTransport
                            }
                          }))
                        }
                      >
                        <option value="pending">pending</option>
                        <option value="confirmed">confirmed</option>
                        <option value="cancelled">cancelled</option>
                        <option value="rejected">rejected</option>
                      </select>
                    </td>
                    <td>
                      <select
                        value={participantDrafts[row.id]?.attendanceStatus ?? row.attendanceStatus}
                        onChange={(eventInput) =>
                          setParticipantDrafts((previous) => ({
                            ...previous,
                            [row.id]: {
                              registrationStatus: previous[row.id]?.registrationStatus ?? row.registrationStatus,
                              paymentStatus: previous[row.id]?.paymentStatus ?? row.paymentStatus,
                              attendanceStatus: eventInput.target.value,
                              groupName: previous[row.id]?.groupName ?? row.groupName ?? '',
                              needsLodging: previous[row.id]?.needsLodging ?? row.needsLodging,
                              needsBaggageTransport: previous[row.id]?.needsBaggageTransport ?? row.needsBaggageTransport
                            }
                          }))
                        }
                      >
                        <option value="not-checked-in">not-checked-in</option>
                        <option value="checked-in">checked-in</option>
                        <option value="absent">absent</option>
                      </select>
                    </td>
                    <td>{row.emergencyContactName} / {row.emergencyContactPhone}</td>
                    <td>{row.healthNotes || '-'} / {row.dietNotes || '-'}</td>
                    <td>
                      <button
                        className="ghost"
                        onClick={() => void handleParticipantUpdate(row.id)}
                        disabled={organizerSavingId === `participant:${row.id}`}
                      >
                        {organizerSavingId === `participant:${row.id}` ? 'Zapisywanie...' : 'Zapisz'}
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredParticipants.length === 0 ? (
                  <tr>
                    <td colSpan={13}>Brak uczestnikow pasujacych do filtrow.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="pilgrimage-organizer-kanban" id="kal-org-tasks">
          <h3>Zadania</h3>
          <div className="pilgrimage-card-grid">
            {organizerDashboard.tasks.map((task) => (
              <article key={task.id} className="pilgrimage-card">
                <label>
                  Tytul
                  <input
                    value={taskDrafts[task.id]?.title ?? task.title}
                    onChange={(eventInput) =>
                      setTaskDrafts((previous) => ({
                        ...previous,
                        [task.id]: {
                          title: eventInput.target.value,
                          description: previous[task.id]?.description ?? task.description,
                          status: previous[task.id]?.status ?? task.status,
                          priority: previous[task.id]?.priority ?? task.priority,
                          assignee: previous[task.id]?.assignee ?? task.assignee,
                          comments: previous[task.id]?.comments ?? task.comments ?? '',
                          attachments: previous[task.id]?.attachments ?? task.attachments ?? '',
                          dueUtc: previous[task.id]?.dueUtc ?? (task.dueUtc ? new Date(task.dueUtc).toISOString().slice(0, 16) : '')
                        }
                      }))
                    }
                  />
                </label>
                <label>
                  Opis
                  <textarea
                    value={taskDrafts[task.id]?.description ?? task.description}
                    onChange={(eventInput) =>
                      setTaskDrafts((previous) => ({
                        ...previous,
                        [task.id]: {
                          title: previous[task.id]?.title ?? task.title,
                          description: eventInput.target.value,
                          status: previous[task.id]?.status ?? task.status,
                          priority: previous[task.id]?.priority ?? task.priority,
                          assignee: previous[task.id]?.assignee ?? task.assignee,
                          comments: previous[task.id]?.comments ?? task.comments ?? '',
                          attachments: previous[task.id]?.attachments ?? task.attachments ?? '',
                          dueUtc: previous[task.id]?.dueUtc ?? (task.dueUtc ? new Date(task.dueUtc).toISOString().slice(0, 16) : '')
                        }
                      }))
                    }
                  />
                </label>
                <label>
                  Status
                  <select
                    value={taskDrafts[task.id]?.status ?? task.status}
                    onChange={(eventInput) =>
                      setTaskDrafts((previous) => ({
                        ...previous,
                        [task.id]: {
                          title: previous[task.id]?.title ?? task.title,
                          description: previous[task.id]?.description ?? task.description,
                          status: eventInput.target.value,
                          priority: previous[task.id]?.priority ?? task.priority,
                          assignee: previous[task.id]?.assignee ?? task.assignee,
                          comments: previous[task.id]?.comments ?? task.comments ?? '',
                          attachments: previous[task.id]?.attachments ?? task.attachments ?? '',
                          dueUtc: previous[task.id]?.dueUtc ?? (task.dueUtc ? new Date(task.dueUtc).toISOString().slice(0, 16) : '')
                        }
                      }))
                    }
                  >
                    <option value="todo">todo</option>
                    <option value="doing">doing</option>
                    <option value="done">done</option>
                    <option value="urgent">urgent</option>
                  </select>
                </label>
                <label>
                  Priorytet
                  <select
                    value={taskDrafts[task.id]?.priority ?? task.priority}
                    onChange={(eventInput) =>
                      setTaskDrafts((previous) => ({
                        ...previous,
                        [task.id]: {
                          title: previous[task.id]?.title ?? task.title,
                          description: previous[task.id]?.description ?? task.description,
                          status: previous[task.id]?.status ?? task.status,
                          priority: eventInput.target.value,
                          assignee: previous[task.id]?.assignee ?? task.assignee,
                          comments: previous[task.id]?.comments ?? task.comments ?? '',
                          attachments: previous[task.id]?.attachments ?? task.attachments ?? '',
                          dueUtc: previous[task.id]?.dueUtc ?? (task.dueUtc ? new Date(task.dueUtc).toISOString().slice(0, 16) : '')
                        }
                      }))
                    }
                  >
                    <option value="low">low</option>
                    <option value="normal">normal</option>
                    <option value="high">high</option>
                    <option value="critical">critical</option>
                  </select>
                </label>
                <label>
                  Odpowiedzialny
                  <input
                    value={taskDrafts[task.id]?.assignee ?? task.assignee}
                    onChange={(eventInput) =>
                      setTaskDrafts((previous) => ({
                        ...previous,
                        [task.id]: {
                          title: previous[task.id]?.title ?? task.title,
                          description: previous[task.id]?.description ?? task.description,
                          status: previous[task.id]?.status ?? task.status,
                          priority: previous[task.id]?.priority ?? task.priority,
                          assignee: eventInput.target.value,
                          comments: previous[task.id]?.comments ?? task.comments ?? '',
                          attachments: previous[task.id]?.attachments ?? task.attachments ?? '',
                          dueUtc: previous[task.id]?.dueUtc ?? (task.dueUtc ? new Date(task.dueUtc).toISOString().slice(0, 16) : '')
                        }
                      }))
                    }
                  />
                </label>
                <label>
                  Komentarze
                  <textarea
                    value={taskDrafts[task.id]?.comments ?? task.comments ?? ''}
                    onChange={(eventInput) =>
                      setTaskDrafts((previous) => ({
                        ...previous,
                        [task.id]: {
                          title: previous[task.id]?.title ?? task.title,
                          description: previous[task.id]?.description ?? task.description,
                          status: previous[task.id]?.status ?? task.status,
                          priority: previous[task.id]?.priority ?? task.priority,
                          assignee: previous[task.id]?.assignee ?? task.assignee,
                          comments: eventInput.target.value,
                          attachments: previous[task.id]?.attachments ?? task.attachments ?? '',
                          dueUtc: previous[task.id]?.dueUtc ?? (task.dueUtc ? new Date(task.dueUtc).toISOString().slice(0, 16) : '')
                        }
                      }))
                    }
                  />
                </label>
                <label>
                  Zalaczniki (linki)
                  <input
                    value={taskDrafts[task.id]?.attachments ?? task.attachments ?? ''}
                    onChange={(eventInput) =>
                      setTaskDrafts((previous) => ({
                        ...previous,
                        [task.id]: {
                          title: previous[task.id]?.title ?? task.title,
                          description: previous[task.id]?.description ?? task.description,
                          status: previous[task.id]?.status ?? task.status,
                          priority: previous[task.id]?.priority ?? task.priority,
                          assignee: previous[task.id]?.assignee ?? task.assignee,
                          comments: previous[task.id]?.comments ?? task.comments ?? '',
                          attachments: eventInput.target.value,
                          dueUtc: previous[task.id]?.dueUtc ?? (task.dueUtc ? new Date(task.dueUtc).toISOString().slice(0, 16) : '')
                        }
                      }))
                    }
                  />
                </label>
                <label>
                  Termin
                  <input
                    type="datetime-local"
                    value={taskDrafts[task.id]?.dueUtc ?? (task.dueUtc ? new Date(task.dueUtc).toISOString().slice(0, 16) : '')}
                    onChange={(eventInput) =>
                      setTaskDrafts((previous) => ({
                        ...previous,
                        [task.id]: {
                          title: previous[task.id]?.title ?? task.title,
                          description: previous[task.id]?.description ?? task.description,
                          status: previous[task.id]?.status ?? task.status,
                          priority: previous[task.id]?.priority ?? task.priority,
                          assignee: previous[task.id]?.assignee ?? task.assignee,
                          comments: previous[task.id]?.comments ?? task.comments ?? '',
                          attachments: previous[task.id]?.attachments ?? task.attachments ?? '',
                          dueUtc: eventInput.target.value
                        }
                      }))
                    }
                  />
                </label>
                <small>Utworzono: {new Date(task.createdUtc).toLocaleString()}</small>
                <button
                  className="ghost"
                  onClick={() => void handleTaskUpdate(task.id)}
                  disabled={organizerSavingId === `task:${task.id}`}
                >
                  {organizerSavingId === `task:${task.id}` ? 'Zapisywanie...' : 'Zapisz zadanie'}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="pilgrimage-announcements" id="kal-org-announcements">
          <h3>Komunikaty</h3>
          <div className="pilgrimage-announcement-list">
            {organizerDashboard.announcements.map((entry) => (
              <article key={entry.id} className={entry.isCritical ? 'critical' : ''}>
                <h4>{entry.title}</h4>
                <p>{entry.body}</p>
                <small>
                  {entry.audience} | {new Date(entry.createdUtc).toLocaleString()}
                </small>
              </article>
            ))}
          </div>
        </section>

        <section className="pilgrimage-organizer-kanban" id="kal-org-issues">
          <h3>Zgloszenia uczestnikow</h3>
          <div className="pilgrimage-card-grid">
            {organizerDashboard.issues.map((issue) => (
              <article key={issue.id} className="pilgrimage-card">
                <h4>{issue.participantName}</h4>
                <p><strong>{issue.kind}</strong>: {issue.message}</p>
                <label>
                  Status
                  <select
                    value={issueDrafts[issue.id]?.status ?? issue.status}
                    onChange={(eventInput) =>
                      setIssueDrafts((previous) => ({
                        ...previous,
                        [issue.id]: {
                          status: eventInput.target.value,
                          resolutionNote: previous[issue.id]?.resolutionNote ?? issue.resolutionNote ?? ''
                        }
                      }))
                    }
                  >
                    <option value="open">open</option>
                    <option value="in-progress">in-progress</option>
                    <option value="resolved">resolved</option>
                    <option value="closed">closed</option>
                  </select>
                </label>
                <label>
                  Notatka
                  <textarea
                    value={issueDrafts[issue.id]?.resolutionNote ?? issue.resolutionNote ?? ''}
                    onChange={(eventInput) =>
                      setIssueDrafts((previous) => ({
                        ...previous,
                        [issue.id]: {
                          status: previous[issue.id]?.status ?? issue.status,
                          resolutionNote: eventInput.target.value
                        }
                      }))
                    }
                  />
                </label>
                <button
                  className="ghost"
                  onClick={() => void handleIssueUpdate(issue.id)}
                  disabled={organizerSavingId === `issue:${issue.id}`}
                >
                  {organizerSavingId === `issue:${issue.id}` ? 'Zapisywanie...' : 'Zapisz status'}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="pilgrimage-announcements" id="kal-org-inquiries">
          <h3>Zapytania kontaktowe (publiczne)</h3>
          <div className="pilgrimage-announcement-list">
            {organizerDashboard.inquiries.map((entry) => (
              <article key={entry.id}>
                <h4>{entry.topic} - {entry.name}</h4>
                <p>{entry.message}</p>
                <small>{entry.phone || '-'} | {entry.email || '-'}</small>
                <label>
                  Status
                  <select
                    value={inquiryDrafts[entry.id]?.status ?? entry.status}
                    onChange={(eventInput) =>
                      setInquiryDrafts((previous) => ({
                        ...previous,
                        [entry.id]: { status: eventInput.target.value }
                      }))
                    }
                  >
                    <option value="new">new</option>
                    <option value="in-progress">in-progress</option>
                    <option value="resolved">resolved</option>
                    <option value="closed">closed</option>
                  </select>
                </label>
                <button
                  className="ghost"
                  onClick={() => void handleInquiryUpdate(entry.id)}
                  disabled={organizerSavingId === `inquiry:${entry.id}`}
                >
                  {organizerSavingId === `inquiry:${entry.id}` ? 'Zapisywanie...' : 'Zapisz status'}
                </button>
              </article>
            ))}
            {organizerDashboard.inquiries.length === 0 ? <p>Brak zapytan kontaktowych.</p> : null}
          </div>
        </section>
      </>
    );
  };

  return (
    <div className="event-page kal-page">
      <header className={`kal-header${isHeaderCompact ? ' is-compact' : ''}${page.slug === 'start' ? ' kal-header--overlay' : ''}`}>
        <a className={`kal-header-logo${page.slug === 'start' ? ' active' : ''}`} href={`/#/event/${event.slug}/start`}>
          <PilgrimageKalwariaLogo />
        </a>
        <nav className="kal-top-nav kal-top-nav--desktop" aria-label="Pilgrimage sections">
          {headerMenuPages.map((item) => (
            <a key={item.slug} href={`/#/event/${event.slug}/${item.slug}`} className={item.slug === page.slug ? 'active' : ''}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="kal-top-nav kal-top-nav--mobile">
          <button
            type="button"
            className="kal-hamburger"
            aria-label="Open menu"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((previous) => !previous)}
          >
            <span />
            <span />
            <span />
          </button>
          {isMenuOpen ? (
            <nav className="kal-menu-dropdown" aria-label="Pilgrimage sections">
              {headerMenuPages.map((item) => (
                <a key={item.slug} href={`/#/event/${event.slug}/${item.slug}`} className={item.slug === page.slug ? 'active' : ''}>
                  {item.label}
                </a>
              ))}
            </nav>
          ) : null}
        </div>
        <div className="kal-tools">
          <LanguageSelect value={language} onChange={onLanguageChange} />
          <AuthAction
            copy={copy}
            label={authLabel}
            isAuthenticated={showProfileMenu}
            secureMode={secureMode}
            onLogin={onAuthAction}
            onProfileNavigate={onProfileNavigate}
            onToggleSecureMode={onToggleSecureMode}
            onLogout={onLogout}
            variant="ghost"
          />
        </div>
      </header>

      <main className={`kal-main${page.slug === 'start' ? ' kal-main--start' : ''}`}>
        {page.slug !== 'start' ? (
          <aside className="kal-sidebar">
            <a href="/#/event" className="ghost">{copy.events.backToEvents}</a>
            <p>{site?.motto || 'Droga, wspolnota i modlitwa'}</p>
            <div className="kal-page-links">
              {event.pages.map((item) => (
                <a key={item.slug} href={`/#/event/${event.slug}/${item.slug}`} className={item.slug === page.slug ? 'active' : ''}>
                  {item.title}
                </a>
              ))}
            </div>
          </aside>
        ) : null}

        <section className={`kal-content pilgrimage-content${page.slug === 'start' ? ' pilgrimage-content--start' : ''}`}>
          {siteLoading ? <p>Ladowanie strony pielgrzymki...</p> : null}
          {!siteLoading && siteError ? <p className="pilgrimage-error">{siteError}</p> : null}
          {!siteLoading && !siteError && site ? (
            <>
              {page.slug !== 'start' ? (
                <>
                  <section className="pilgrimage-hero">
                    <div className="pilgrimage-hero-main">
                      <p className="pilgrimage-hero-kicker">Pilgrimage route</p>
                      <h2>{site.site.public.heroTitle}</h2>
                      <p>{site.site.public.heroSubtitle}</p>
                      <p className="pilgrimage-hero-route">{site.site.public.routeLabel}</p>
                      <p className="pilgrimage-hero-date">{site.site.public.dateLabel}</p>
                      <div className="pilgrimage-quick-links">
                        <a className="cta" href={`/#/event/${event.slug}/zapisy`}>Sign up</a>
                        <a className="ghost" href={`/#/event/${event.slug}/program`}>Program</a>
                        <a className="ghost" href={`/#/event/${event.slug}/uczestnik`}>Participant zone</a>
                      </div>
                      {!site.isProvisioned ? (
                        <p className="pilgrimage-warning">
                          This event is in preview mode. To enable registrations and organizer dashboard, provision it via `POST /pilgrimage`.
                        </p>
                      ) : null}
                    </div>
                    <div className="pilgrimage-hero-visual">
                      <div className="pilgrimage-hero-photo pilgrimage-hero-photo--a" />
                      <div className="pilgrimage-hero-photo pilgrimage-hero-photo--b" />
                      <div className="pilgrimage-hero-photo pilgrimage-hero-photo--c" />
                    </div>
                  </section>

                  <section className="pilgrimage-hero-facts">
                    {site.site.public.heroFacts.map((fact) => (
                      <article key={fact.id} className={`pilgrimage-card pilgrimage-card--${fact.accent ?? 'default'}`}>
                        <h3>{fact.title}</h3>
                        <p>{fact.body}</p>
                        {fact.meta ? <small>{fact.meta}</small> : null}
                      </article>
                    ))}
                    <article className="pilgrimage-card pilgrimage-card--blue">
                      <h3>Private participant access</h3>
                      <p>After registration, each participant gets an individual SMS link to their zone.</p>
                    </article>
                  </section>
                </>
              ) : null}

              {page.slug === 'uczestnik' ? renderParticipantPage() : null}
              {page.slug === 'organizator' ? renderOrganizerPage() : null}
              {!['uczestnik', 'organizator'].includes(page.slug) ? renderPublicPage() : null}
              {!['uczestnik', 'organizator', 'start'].includes(page.slug) ? (
                <a className="pilgrimage-mobile-sticky cta" href={`/#/event/${event.slug}/zapisy`}>
                  Zapisz sie
                </a>
              ) : null}
            </>
          ) : null}
        </section>
      </main>

      <footer className={`kal-footer${page.slug === 'start' ? ' kal-footer--overlay' : ''}`}>
        <a href="/#/" className="kal-logo">Recreatio</a>
        <nav className="kal-footer-links" aria-label="Footer navigation">
          <a href={`/#/event/${event.slug}/start`}>Start</a>
          <a href={`/#/event/${event.slug}/program`}>Program</a>
          <a href={`/#/event/${event.slug}/zapisy`}>Zapisy</a>
          <a href={`/#/event/${event.slug}/kontakt`}>Kontakt</a>
          <a href={`/#/event/${event.slug}/formalnosci`}>Regulamin i RODO</a>
        </nav>
        <a className="ghost" href="/#/section-1" onClick={() => onNavigate('home')}>{copy.nav.home}</a>
      </footer>
    </div>
  );
}

export function EventsPage(props: SharedEventPageProps) {
  const { copy } = props;
  const navigate = useNavigate();
  const location = useLocation();
  const segments = useMemo(() => location.pathname.split('/').filter(Boolean), [location.pathname]);
  const selectedEventSlug = segments[1] ?? null;
  const selectedPageSlug = segments[2] ?? null;

  const selectedEvent = selectedEventSlug ? EVENTS.find((entry) => entry.slug === selectedEventSlug) ?? null : null;
  const defaultPage = selectedEvent?.pages[0] ?? null;
  const selectedInnerPage =
    selectedEvent && selectedPageSlug
      ? selectedEvent.pages.find((eventPage) => eventPage.slug === selectedPageSlug) ?? null
      : defaultPage;

  useEffect(() => {
    if (!selectedEvent || selectedPageSlug) return;
    const firstPage = selectedEvent.pages[0];
    if (!firstPage) return;
    navigate(`/event/${selectedEvent.slug}/${firstPage.slug}`, { replace: true });
  }, [navigate, selectedEvent, selectedPageSlug]);

  if (selectedEvent && selectedInnerPage) {
    if (selectedEvent.slug === 'warsztaty26') {
      return <WarsztatyEventPage {...props} event={selectedEvent} page={selectedInnerPage} />;
    }
    return <Kal26EventPage {...props} event={selectedEvent} page={selectedInnerPage} />;
  }

  return (
    <div className="portal-page events">
      <main className="events-main">
        <article className="events-shell-card">
          <div className="events-card-head">
            <div className="events-card-nav">
              <a className="ghost" href="/#/section-1">{copy.nav.home}</a>
            </div>
            <div className="events-card-actions">
              <LanguageSelect value={props.language} onChange={props.onLanguageChange} />
              <AuthAction
                copy={copy}
                label={props.authLabel}
                isAuthenticated={props.showProfileMenu}
                secureMode={props.secureMode}
                onLogin={props.onAuthAction}
                onProfileNavigate={props.onProfileNavigate}
                onToggleSecureMode={props.onToggleSecureMode}
                onLogout={props.onLogout}
                variant="ghost"
              />
            </div>
          </div>

          <section className="events-hero">
            <p className="tag">REcreatio</p>
            <h1>{copy.events.title}</h1>
            <p>{copy.events.subtitle}</p>
          </section>

          <section className="events-chooser">
            <div className="events-chooser-head">
              <h2>{copy.events.chooserTitle}</h2>
              <p>{copy.events.chooserSubtitle}</p>
            </div>
            <div className="events-grid">
              {EVENTS.map((eventEntry) => {
                const firstPage = eventEntry.pages[0];
                return (
                  <article key={eventEntry.slug} className={`events-card events-card--${eventEntry.slug}`}>
                    <h3>{eventEntry.title}</h3>
                    <p>{eventEntry.summary}</p>
                    <dl>
                      <div>
                        <dt>Date</dt>
                        <dd>{eventEntry.date}</dd>
                      </div>
                      <div>
                        <dt>Location</dt>
                        <dd>{eventEntry.location}</dd>
                      </div>
                    </dl>
                    <a className="cta" href={`/#/event/${eventEntry.slug}/${firstPage.slug}`}>
                      {copy.events.openEvent}
                    </a>
                  </article>
                );
              })}
            </div>
          </section>
        </article>
      </main>

      <footer className="portal-footer cogita-footer events-footer">
        <a className="portal-brand portal-footer-brand" href="/#/">
          <img src="/logo_inv.svg" alt="Recreatio" />
        </a>
        <span>{copy.footer.headline}</span>
        <a className="ghost events-footer-home" href="/#/section-1" onClick={() => props.onNavigate('home')}>
          {copy.nav.home}
        </a>
      </footer>
    </div>
  );
}
