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

const BLACK_STONES_PATTERN_PATH = `M 0.18741979,-3.9217776 10.830939,6.5757389 44.39706,15.963539 60.700767,14.638845 93.417295,18.46323 143.87624,16.890788 169.58932,14.705444 182.78179,14.091549 207.2598,2.5143774 201.1843,-3.9217776 Z M 210,3.6441998 l -15.13453,8.1065512 10.622,13.744118 4.48675,-16.9259559 z M 0.32630663,4.0598274 0.18896871,18.351748 11.174166,14.161892 3.6384757,5.6962869 Z M 20.147369,13.183506 10.874595,21.600684 34.942564,32.42498 41.725186,24.547094 37.2049,16.798389 Z m 173.129421,0.529732 -20.04204,12.670196 8.72494,7.645068 21.04382,-7.14838 z m -145.055693,0.408915 -6.860183,18.727522 17.980391,1.417268 8.165159,-9.14581 -8.074907,-8.129965 z m 117.203973,3.069968 3.13045,6.919225 5.18945,-5.597947 z m -4.28123,0.02891 -36.92892,3.78402 14.30003,11.418922 16.54575,3.598411 z m -87.789387,2.929015 -0.988027,11.890668 12.09163,2.581583 8.400687,-7.963305 -6.73085,-6.010627 z M 0.18896871,20.661193 V 39.700049 L 12.278971,35.840587 9.6666568,25.454679 Z m 97.32972929,0.646418 5.755052,7.577358 0.87683,-6.281167 z m 19.447772,0.682043 -3.02498,10.488837 9.42577,0.453209 -3.79509,-9.247651 z m 92.91169,4.608048 -17.26019,7.065674 11.313,8.232491 5.99116,-11.410972 -0.044,-3.887193 z m -40.85339,0.822995 -9.97135,8.495639 4.42374,7.673476 8.26748,-9.173426 z M 19.635708,29.912399 8.2126484,48.085845 39.015326,57.870475 38.708124,36.087958 Z m 110.360312,0.9846 -6.73115,10.411241 11.22611,5.201776 5.38547,-7.428378 z m -61.289372,3.486627 -10.996281,7.095451 0.925785,11.986709 13.366606,6.720846 8.093128,-21.364307 z m 121.583292,0 -16.28641,4.164023 -0.68256,15.87802 23.76153,-7.232959 z m -148.33269,0.961365 0.943319,12.414832 10.2704,-1.333313 -4.461817,-9.297661 z m 106.36719,2.566051 -5.71405,23.165188 16.63376,-2.416187 -6.13003,-16.899951 z M 0.18896871,41.30112 0.27622475,55.282223 9.2594669,42.295529 Z m 170.73426129,0.764136 -10.42084,7.515272 5.25598,6.049183 5.15844,-11.012789 0.006,-2.551666 z m 28.29575,0.355736 2.07555,17.266371 8.59911,-2.381755 -1.41587,-12.335595 z m -158.198313,7.124533 3.316762,18.938177 14.785976,2.546776 9.367427,-10.438027 z m 95.435403,0.0041 -9.39915,4.386522 8.3282,1.601151 z m 60.60938,0.200327 -36.90156,12.396039 38.66256,2.604469 z M 5.8678399,52.004184 1.3993797,63.434048 14.376902,68.47678 25.785018,65.905902 22.715036,56.112828 Z M 31.794244,58.151863 27.686746,70.710081 38.701539,73.768533 36.4541,62.408519 Z m 38.218663,4.915768 -7.175961,10.442278 9.591057,2.217016 -0.824579,-10.864208 z m 87.851863,0.307203 -14.27178,4.630766 20.45299,11.679948 2.78161,-10.789507 z m 52.05417,0.922643 -23.56205,10.163037 1.07139,9.98654 17.33275,-2.587592 5.19545,-9.759925 -0.0376,-7.80206 z M 0.3572851,69.00982 0.18896871,83.812884 11.341711,77.482807 4.2513749,69.62864 Z m 18.2649099,1.821017 -9.4184894,14.327029 17.3204214,0.76022 10.942677,-6.196842 z m 28.691749,0.973757 -2.653422,10.743201 13.87322,0.894898 -2.506202,-9.226449 z m 25.30322,9.085472 -7.853555,13.50528 10.739325,5.996604 9.725053,-10.417963 z m 85.888866,0.180707 -8.19202,10.264004 8.66848,6.540743 7.20621,-11.859549 z m 20.6327,0.158507 -10.76026,6.618873 4.31208,7.362084 7.78485,-7.465701 z m 30.60983,0.73419 -15.36894,5.882296 11.78378,1.311483 z M 37.502028,83.179891 24.085322,94.645729 32.74696,100.8887 56.220664,100.09403 55.756751,89.321882 Z M 0.45589993,85.810996 0.18896871,110.13633 12.896451,106.74361 23.883373,90.11339 Z M 191.7764,87.654732 l -11.28443,7.992963 14.25268,0.155925 z m -44.77939,3.760271 -9.35558,8.320106 9.67666,6.832561 2.90354,-10.922679 z M 87.351562,91.877098 75.375281,104.42235 86.742834,115.97371 102.83874,98.331981 Z m 122.234368,0.285519 -12.13736,2.975889 3.71534,15.253394 8.70948,-9.5964 z m -14.07559,5.634468 -33.83474,2.766965 -7.19627,7.41654 30.50302,3.16678 13.82616,0.37576 z m -91.61163,2.824205 -9.141228,10.4258 24.917218,0.88767 z m -47.11258,1.76474 -36.575255,1.45238 -8.204512,9.2484 24.90416,5.99085 27.204082,-9.50307 z m 71.55564,2.121 -10.77742,15.20372 29.21736,1.10799 -5.77852,-14.82423 z m -54.129214,1.7575 -7.28533,8.67545 10.402197,7.71491 1.960686,-11.1618 z m 135.654754,2.08434 -9.57209,7.90733 7.18199,7.22123 z m -64.11048,2.39877 6.60244,10.926 21.00868,1.83713 -8.62794,-10.73127 z M 0.18896871,112.5289 0.27725737,127.60871 11.678886,115.38253 Z m 168.49039129,0.1585 16.69342,18.55713 17.33902,-4.64314 -8.56892,-11.62543 z m -69.821876,0.36659 -16.815118,9.68025 20.136314,-5.74851 z m -37.97445,0.20859 -28.698462,8.52682 19.125371,4.25114 21.409967,-2.65471 z m 50.048836,0.82299 -13.010452,7.59902 15.113892,-1.62151 z M 15.767012,116.3124 0.18896871,130.90998 13.783428,137.4183 24.29461,133.25717 27.329107,121.22066 Z m 100.254098,6.24217 -8.93428,13.52182 -4.78247,21.59125 65.81274,0.34282 14.02912,-17.1471 -6.64798,-14.9058 z m -17.719174,2.6373 -54.921742,4.97772 -8.634218,23.0356 17.486513,4.79781 47.34318,-0.13193 8.071961,-32.28371 z m -66.388426,1.19474 -7.75288,13.48028 8.444217,10.76296 7.742554,-20.4427 z m 170.72188,2.49273 -17.99592,5.33553 13.86926,11.50054 11.31926,4.9212 -0.83233,-15.69632 z M 0.44557377,138.26272 0.29119769,152.2526 19.10804,156.48736 21.074658,140.30472 Z m 23.39907623,5.32727 -2.191211,14.50102 10.668859,-1.04028 z m 165.39719,0.77652 -12.99088,8.96739 6.13532,7.66592 7.26358,-5.81321 z m 7.00888,3.2543 -3.70156,16.54938 7.3574,9.04848 10.07447,-2.36183 -0.0874,-16.90352 -13.64292,-6.33251 z M 0.18896871,153.68845 v 19.20408 l 18.55667529,-2.1268 0.73732,-10.97618 z m 40.19354129,6.93248 -14.443773,4.36631 -8.53916,13.52272 16.783127,-1.66192 10.252308,-12.12247 z m 13.321778,0.33921 -17.30666,17.40253 1.796082,11.84582 9.396529,7.02329 60.607691,-0.39861 6.08064,-35.11045 z m 63.278702,0.35263 -6.61855,35.81577 64.57309,-0.47243 7.35762,-15.53463 -9.0444,-18.03622 z m 61.80206,1.97643 4.24988,11.41852 0.83996,-9.13216 z m -163.119234,10.88326 -15.48046145,0.5607 0.10584314,23.19979 10.22217531,-9.09173 6.476256,-14.15556 -0.684634,-0.26541 z m 174.247734,0.62422 -6.14303,13.26808 15.91107,3.21298 -6.03358,-15.69887 z m 7.1137,0.63711 10.39483,28.20591 2.57072,-25.81967 -11.72097,-2.31113 -0.73296,-0.0443 -0.51161,-0.0309 z m -179.172805,5.88437 -7.823489,18.20151 8.313063,-1.89829 9.505115,-10.37819 z m 13.641889,7.33209 -8.149636,10.16139 3.063192,11.5913 10.300235,-4.65999 -1.396576,-11.58232 z m 151.165676,2.2924 1.3859,12.29858 12.965,0.70176 0.93632,-7.04508 z m -161.745342,7.55772 -0.793075,4.81643 z m 153.530882,0.85656 -53.51273,1.42294 -7.73378,37.10964 57.30657,-2.34663 22.07268,-14.73542 z M 0.18896871,201.34109 V 223.4969 L 14.652329,213.13224 9.0308326,205.43471 Z m 43.65073929,0.0279 -17.424877,26.96779 18.384957,8.07088 33.197146,3.32109 32.800696,-1.71016 7.20301,-36.52465 z m 166.156162,4.25334 -22.4754,2.57741 10.31069,12.66027 11.91837,3.31841 z m -188.440013,6.08831 -11.386139,10.11551 12.686203,6.74039 7.357904,-11.81726 z m 173.419583,10.58741 -19.81074,13.63156 26.51397,15.8424 8.3172,-8.81149 V 227.8504 Z M 6.3862131,224.34829 0.16238786,236.38435 0,263.29908 20.677617,233.30881 Z m 16.9953089,9.61003 -12.588104,17.0454 11.464559,6.29651 24.454334,-7.43374 -0.803775,-10.14299 z m 148.017748,4.45626 -45.60341,2.29293 -2.34573,10.89001 19.77603,6.93707 26.17397,-7.83292 3.65577,-12.08198 z m -51.54974,2.23045 -63.838894,3.17632 2.517958,9.84229 21.91012,5.8416 11.64473,-5.86865 11.125296,5.4243 15.45648,-15.17 z m 57.81514,0.26383 -6.43526,17.0645 18.70634,5.69023 7.74979,-11.96957 z m -7.52519,10.93025 -27.25125,9.52691 -1.13197,12.27743 20.03813,5.27652 z m -54.6796,0.49151 -6.74368,7.28182 13.35221,-4.89134 z m 90.32756,0.18175 -8.89701,8.29531 8.9205,8.47193 4.18752,-8.61056 z m -157.667538,0.56226 -28.536246,7.16828 -11.3353211,-0.15498 3.4941761,12.36844 9.745367,4.57079 22.753063,-12.20814 5.922259,-9.81284 z m 42.860788,1.23295 -6.755337,10.08636 11.412146,5.35201 -1.552619,-12.22809 z m 39.05043,1.8205 -15.05502,6.68257 8.34904,9.60422 14.99944,0.46223 0.97313,-12.71755 z m -74.904404,0.9278 -5.863311,15.11356 16.586132,2.0212 20.122965,-2.11691 -14.300197,-11.41913 z m 116.241574,2.327 -4.85072,15.52745 23.67583,4.93383 8.55609,-8.83107 -26.29266,-11.28621 -0.70015,-0.22126 z m -67.37767,2.24543 0.57714,9.27816 7.73539,-2.6257 z m -100.8385599,1.77712 -2.97856749,21.58718 7.78123149,0.28155 4.4798139,-8.19843 z m 43.7534849,3.07565 -13.440012,7.04812 10.950578,-1.09955 z m 156.682435,5.54979 -9.74325,8.99874 16.01638,7.98934 0.13734,-14.29191 z m -107.779295,1.08683 -47.015529,5.9156 -17.853079,0.0144 -26.8283055,9.82342 2.8956428,7.6949 c 0,0 21.4524127,0.14538 32.1011677,0.43399 H 210 c -0.53095,-13.59737 -21.20976,-14.25671 -31.54654,-17.87994 -11.1083,-5.17443 -18.53272,5.82408 -29.33648,-1.74125 -17.28428,-4.74557 -35.58411,-3.05826 -53.308295,-4.26115 z m 84.128255,-197.812907 -10.34754,5.968753 2.86759,-12.520944 16.34856,0.140117 z`;

function PilgrimageStoneMap() {
  return (
    <svg
      className="start-graphic"
      viewBox="0 0 210 301"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Wielkanocna Kalwaria with black stones"
    >
      <g transform="translate(0,4.000004)">
        <path fill="#4172eb" d="m 91.448037,72.677154 28.129673,-1.848906 0.13208,-17.300405 34.86494,27.469357 -35.26114,27.60142 -0.3962,-17.696605 -31.299221,-2.773349 z" />
        <path fill="#fab75e" d="m 114.29516,63.960848 -22.847123,8.716266 28.129713,-1.848926 z m -26.676976,24.167848 26.280786,10.036829 5.01842,-7.26352 z" />
        <path fill="#fb9109" d="m 119.70976,53.527834 -5.4146,10.433014 5.28259,6.86734 z m -0.79237,37.374171 -5.01842,7.26352 5.41461,10.433015 z" />
        <path fill="#f65f44" d="m 94.465987,33.060536 -2.988753,3.54228 1.881716,3.652927 3.431632,1.328337 3.431628,-3.652928 -0.885608,-3.763711 z m -1.439121,9.741231 -10.405403,1.660422 -3.210193,10.737623 6.347405,-0.200243 -4.133461,18.133072 2.385663,1.10967 2.83504,-1.084052 2.638673,-12.534311 4.538663,3.542279 1.201488,5.473292 3.716629,-7.129978 -0.04747,-0.446465 -5.424137,-5.202841 0.664173,-5.645431 1.992504,2.656671 6.0883,-0.221435 0.32253,7.418165 1.81899,1.251614 -0.59175,-8.337695 1.32835,-3.652926 h -6.420392 z" />
        <path fill="#1441b6" d="M 119.31359,108.59862 141.15072,81.526792 119.70978,53.527843 154.57473,80.9972 Z" />
        <path fill="#9c1e07" d="m 99.336602,34.167441 -1.789071,3.842785 -2.798346,2.783666 2.041397,0.790188 3.431628,-3.652928 z m -5.202698,17.047363 1.992504,2.656671 6.088302,-0.221435 0.32253,7.418165 0.8856,0.609332 -0.357,-9.303902 -5.674932,-0.07824 z m -13.963326,1.445216 -0.759308,2.539792 6.347405,-0.200253 -4.133461,18.133082 2.385663,1.10967 4.88723,-21.320834 z m 9.784299,4.566641 -0.470287,3.397287 4.538663,3.542279 1.201488,5.473292 2.421942,-4.646123 z" />
        <text x="114.95033" y="80.246109" textAnchor="middle" fill="#040d24" fontFamily="Reem Kufi, sans-serif" fontSize="6.78371">Wielkanocna</text>
        <text x="114.67078" y="86.202629" textAnchor="middle" fill="#040d24" fontFamily="Reem Kufi, sans-serif" fontSize="7.58392">KALWARIA</text>
        <path fill="#000000" d={BLACK_STONES_PATTERN_PATH} />
      </g>
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
          <div className="start-graphic-wrap">
            <PilgrimageStoneMap />
          </div>
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
