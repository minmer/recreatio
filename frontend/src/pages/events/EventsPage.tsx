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

const BLACK_STONES_PATTERN_PATH = `M 0.00673123,285.86312 3.5870023,271.89142 22.012681,257.35185 42.735581,269.1843 22.324694,297 H 0.00181903 Z m 28.27118977,7.31999 18.154231,-23.373 72.334428,-3.97244 L 103.64199,297 H 25.5255 Z m 78.596579,3.74296 15.0194,-31.45748 59.10446,-0.36293 9.1151,31.71017 z m 86.07342,-1.02407 -6.30558,-22.53519 23.33968,10.33632 L 208.46078,297 h -15.19853 l -0.20934,-0.73124 v -10e-6 z m 16.17738,-15.318 -23.76406,-11.06699 6.90492,-15.76227 11.64063,-13.10386 5.99398,10.64357 -0.0756,29.59313 -0.69781,-0.30267 v 0 l -0.002,-9.1e-4 z M 0.00238066,260.93357 6.2309841,252.02589 18.426796,256.97358 0.00238066,271.95249 Z m 42.66519234,4.43719 -29.698318,-14.3969 9.449026,-32.46744 90.549439,0.71734 -6.19779,44.83623 -60.651489,3.3641 z m 67.344077,-2.52164 7.37651,-43.88057 62.16357,0.20605 19.34574,22.29575 -17.86242,20.81185 z M 8.9955388,250.03242 0.83356344,240.59274 8.6219262,228.63263 17.956355,224.406 10.564109,250.49211 Z m 189.5671212,-14.57276 -13.44181,-15.00623 20.887,-19.9963 3.92185,14.81326 0.0523,19.40149 -11.41937,0.78778 z M 0.00238066,217.95243 1.2053127,203.43548 l 11.3440033,-8.7009 8.676678,21.22248 -21.10784953,15.58117 z m 169.30133934,-1.7 -67.74151,-0.78447 8.49238,-47.71838 83.71322,3.45086 8.32135,28.32249 -17.56949,16.95699 z m -124.126428,-0.20238 -20.60564,-0.19756 -9.346155,-23.38392 22.426556,-25.24184 69.375747,0.40198 -8.62359,47.91008 z M 0.00238066,183.54283 v -17.91392 l 34.35073034,1.3206 -34.35073034,34.50726 z m 205.08460934,14.3554 -7.49219,-25.75665 12.38282,5.74481 -0.1002,17.73299 z m -1.37923,-26.31628 -10.82491,-8.16419 2.27144,-12.24292 9.71292,-6.91248 4.87857,17.77502 -2.19083,10.82162 z m -16.20859,-3.55238 -3.06354,-4.03483 z m -16.41774,-1.05584 -80.883751,-3.51591 12.777861,-42.61529 92.29842,6.54177 5.00889,12.59182 -19.6947,20.64462 z m -137.511577,-2.9046 -29.5937483,-1.1072 12.5063263,-33.45103 57.501461,-7.1855 25.869155,0.0661 -12.69232,41.31855 -53.590874,0.35907 z M 0.00238066,154.18122 4.7485231,141.70549 5.7679639,150.65371 1.4398002,162.3923 Z M 209.4898,144.27326 l -23.0652,-38.78462 23.55746,5.02311 -0.0997,34.23209 -0.39252,-0.47058 z M 0.05349361,124.63645 0.10692435,106.79046 52.550735,99.834087 67.909021,118.94465 15.79266,126.25668 0,142.48243 Z m 189.64167639,-0.50446 -35.81376,-3.33503 0.31054,-12.19491 27.08908,-4.69866 15.07925,20.76271 z m -39.94633,-3.79105 -43.50177,-1.72662 13.68972,-12.24617 4.70004,-12.030347 10.72742,-0.895616 13.66448,22.581383 z m -72.570432,-6.65291 16.148862,-5.35933 18.0313,2.93199 -15.730947,7.75855 H 72.131789 Z M 97.472772,87.829962 70.280448,118.39181 55.098465,98.96274 76.191746,80.954313 Z M 108.23393,108.44587 85.581721,104.90703 99.418133,90.892317 117.39544,106.04083 Z m 100.28412,-0.42231 -29.28004,-7.27075 5.35087,-25.235348 25.39318,4.426663 -0.15686,28.388055 -0.74027,-0.17478 v 0 z m -61.81448,-5.16063 -11.11276,-14.519382 11.11296,-5.437387 18.0986,21.088319 -14.70394,3.1036 z M 0.00238066,90.052917 0.40137602,75.517462 39.870318,80.260048 50.997756,96.955315 0.00238066,104.58782 Z M 165.38348,101.30216 147.90186,79.37049 l 12.30715,-12.890107 15.84351,8.103523 3.76813,12.178112 -3.23985,15.332672 z M 52.757777,95.333775 42.485935,79.135987 53.837666,65.074397 71.036385,76.782034 61.680945,90.458681 Z M 39.634997,77.463145 0.46789201,73.282483 10.803725,65.224666 30.411114,63.894011 46.632668,70.550202 Z m 166.164193,-0.493605 -14.78621,-2.783412 8.55621,-10.725398 10.28545,1.903876 -1.37635,12.014438 z M 164.75321,66.402777 154.29738,53.771495 209.98206,39.720761 V 57.710256 L 181.99284,68.465514 Z M 46.85044,68.310842 30.600687,60.98954 40.268592,38.957642 52.952973,45.909417 54.100036,60.364519 Z M 0.00238066,52.288486 4.7325008,41.584521 32.061927,50.145606 22.231559,61.589038 0.08706595,64.432881 Z M 147.94826,49.212442 l -3.17253,-11.812823 9.11517,-9.4299 14.08549,5.947704 -5.09246,14.551992 -13.76951,1.638256 -0.60334,-0.463165 z M 27.295559,46.026539 0.10695369,37.961004 0.07492794,15.493394 33.576318,34.220492 31.496579,45.0898 Z m 138.975581,0.758102 6.8953,-10.252158 5.11763,6.784041 z m 17.87813,-6.480816 -19.68963,-10.913694 45.39864,-16.669653 -0.058,24.942088 -24.97763,2.902704 -0.67334,-0.261445 z M 38.48471,34.294116 20.786024,23.156686 27.461493,1.4808052 52.288158,12.950744 46.69358,39.335299 Z m 86.61553,-3.000127 11.06153,-10.392737 13.1276,-1.471401 -6.71836,17.296902 -9.92811,0.554629 z m 30.76603,-4.875178 -2.03802,-16.210289 6.84636,-12.0684904 12.95371,-4.3915883 4.71117,22.2978637 -7.84579,8.867245 -13.42255,2.087441 -0.68487,-0.330917 z m -41.18969,-0.456542 -1.78546,-13.607873 9.32316,0.423236 4.18091,11.769438 z M 14.224115,19.34817 0.00238066,13.007934 V -3.7943236 L 20.05884,1.3205873 19.306531,14.635846 Z m 167.011345,-0.874486 1.20127,-13.7842524 27.43194,-12.8292068 0.11339,18.3396742 -28.69698,9.894641 -0.0496,-1.620856 z M 132.12595,17.779549 116.9094,4.799664 127.59999,-12.648914 154.29653,-0.94292517 149.35854,15.534465 132.8842,18.196249 132.21761,17.82992 Z m -27.87742,-9.2386267 -3.22728,-12.1425816 9.03673,8.0518697 z M 48.732729,7.1505411 29.427244,-0.17709433 33.568533,-20.084496 l 39.320218,0.12813 1.603715,15.6857364 -20.949453,12.9924801 z m 63.579491,-6.0229999 -10.06047,-9.1165422 7.02481,-12.018378 18.64271,1.088761 -12.88018,22.0720343 z m 67.6003,-0.95388208 -1.95512,-13.35439112 10.60144,-6.854804 21.31864,0.07918 -5.54227,12.1170243 -23.16707,9.9475707 z M 21.544126,-1.4429687 0.00238066,-5.8962876 V -20.060937 H 29.083829 l -1.439756,16.7851303 z m 71.6315,-1.9832914 -16.593448,-2.297635 -1.288276,-14.3370419 31.021298,0.137839 -9.442115,16.9914914 z m 62.324644,0.1461047 c -9.62167,-0.8477847 -24.04267,-9.5736256 -24.0531,-16.5283366 15.74337,-0.237008 31.4887,-0.05812 47.23294,-0.113256 -2.81662,12.2508707 -13.07006,12.9688598 -23.17984,16.6415926 z`;
const BLACK_STONES_SUBPATHS = BLACK_STONES_PATTERN_PATH.match(/[Mm][^Mm]*/g) ?? [];
const START_MOSAIC_COLORS = ['#88C529', '#FB9926', '#F45741'] as const;
const STONE_PART_SIZE = Math.ceil(BLACK_STONES_SUBPATHS.length / 3);

function PilgrimageStoneMap() {
  return (
    <svg
      className="start-graphic"
      viewBox="0 0 210 317"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Wielkanocna Kalwaria"
    >
      <g transform="translate(0,19.999998)">
        <path fill="#4172eb" d="M 75.660691,52.455002 112.28113,50.04802 112.45307,27.525592 157.84178,63.286404 111.93728,99.219139 111.4215,76.180925 70.674808,72.570456 Z" />
        <path fill="#fab75e" d="M 105.40408,41.107734 75.660699,52.454947 112.28119,50.047936 Z m -34.729251,31.462768 34.213471,13.066381 6.5332,-9.455971 z" />
        <path fill="#fb9109" d="m 112.45304,27.52558 -7.04896,13.582154 6.87711,8.940202 z m -1.03154,48.655332 -6.5332,9.455971 7.04897,13.582155 z" />
        <path fill="#f65f44" d="m 79.589594,0.88035485 -3.890892,4.61149455 2.4497,4.7555416 4.467448,1.729286 4.467443,-4.7555417 -1.152919,-4.8997641 z m -1.873513,12.68156115 -13.546206,2.16161 -4.17917,13.978711 8.263332,-0.260691 -5.381127,23.606429 3.10576,1.444621 3.690783,-1.411267 3.435138,-16.317718 5.908636,4.611495 1.564148,7.125376 4.838471,-9.282116 -0.06184,-0.581238 -7.061378,-6.773285 0.864645,-7.349468 2.59393,3.458572 7.92602,-0.288274 0.419885,9.657292 2.368032,1.629411 -0.770353,-10.854382 1.729286,-4.755538 h -8.35834 z" />
        <path fill="#1441b6" d="M 111.93728,99.219139 140.36581,63.975844 112.45306,27.525592 157.84178,63.286404 Z" />
        <path fill="#9c1e07" d="m 85.930374,2.3213712 -2.32909,5.0027067 -3.643006,3.6238981 2.657572,1.028701 4.467443,-4.7555417 z m -6.7731,22.1930038 2.59393,3.458572 7.92602,-0.288274 0.419885,9.657292 1.152919,0.79325 -0.464774,-12.112222 -7.387873,-0.101861 z m -18.178071,1.881447 -0.988498,3.306415 8.263332,-0.260695 -5.381127,23.606437 3.10576,1.444617 6.362416,-27.756398 z m 12.737633,5.945054 -0.612245,4.422735 5.908636,4.611495 1.564148,7.125376 3.152992,-6.048538 z" />
        <text x="106.25701" y="62.308605" textAnchor="middle" fill="#040d24" fontFamily="Reem Kufi, sans-serif" fontSize="8.83133">Wielkanocna</text>
        <text x="105.89307" y="70.063057" textAnchor="middle" fill="#040d24" fontFamily="Reem Kufi, sans-serif" fontSize="9.87308">KALWARIA</text>
        {BLACK_STONES_SUBPATHS.map((subpath, index) => (
          <path
            key={`stone-subpath-${index}`}
            d={subpath}
            fill={START_MOSAIC_COLORS[Math.min(2, Math.floor(index / STONE_PART_SIZE))]}
          />
        ))}
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
