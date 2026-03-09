import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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

const PILGRIMAGE_START_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="301mm" viewBox="0 0 210 301" version="1.1"><g id="layer1" transform="translate(0,4.000004)"><path style="fill:#ffe640;fill-opacity:1;stroke:none;stroke-width:0.08459px;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1" d="m 91.448037,72.677154 28.129673,-1.848906 0.13208,-17.300405 34.86494,27.469357 -35.26114,27.60142 -0.3962,-17.696605 -31.299221,-2.773349 z" id="path6244" /><path id="path6246" style="fill:#88c529;fill-opacity:1;stroke:none;stroke-width:0.08459px;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1" d="m 114.29516,63.960848 -22.847123,8.716266 28.129713,-1.848926 z m -26.676976,24.167848 26.280786,10.036829 5.01842,-7.26352 z" /><path id="path6248" style="fill:#578d04;fill-opacity:1;stroke:none;stroke-width:0.08459px;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1" d="m 119.70976,53.527834 -5.4146,10.433014 5.28259,6.86734 z m -0.79237,37.374171 -5.01842,7.26352 5.41461,10.433015 z" /><path id="path6367" style="fill:#f45842;fill-opacity:1;stroke:none;stroke-width:0.0709036px;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1" d="m 94.465987,33.060536 -2.988753,3.54228 1.881716,3.652927 3.431632,1.328337 3.431628,-3.652928 -0.885608,-3.763711 z m -1.439121,9.741231 -10.405403,1.660422 -3.210193,10.737623 6.347405,-0.200243 -4.133461,18.133072 2.385663,1.10967 2.83504,-1.084052 2.638673,-12.534311 4.538663,3.542279 1.201488,5.473292 3.716629,-7.129978 -0.04747,-0.446465 -5.424137,-5.202841 0.664173,-5.645431 1.992504,2.656671 6.0883,-0.221435 0.32253,7.418165 1.81899,1.251614 -0.59175,-8.337695 1.32835,-3.652926 h -6.420392 z" /><path style="fill:#ffad09;fill-opacity:1;stroke:none;stroke-width:0.08459px;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1" d="M 119.31359,108.59862 141.15072,81.526792 119.70978,53.527843 154.57473,80.9972 Z" id="path45047" /><path id="path45053" style="fill:#9a1b08;fill-opacity:1;stroke:none;stroke-width:0.0709036px;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1" d="m 99.336602,34.167441 -1.789071,3.842785 -2.798346,2.783666 2.041397,0.790188 3.431628,-3.652928 z m -5.202698,17.047363 1.992504,2.656671 6.088302,-0.221435 0.32253,7.418165 0.8856,0.609332 -0.357,-9.303902 -5.674932,-0.07824 z m -13.963326,1.445216 -0.759308,2.539792 6.347405,-0.200253 -4.133461,18.133082 2.385663,1.10967 4.88723,-21.320834 z m 9.784299,4.566641 -0.470287,3.397287 4.538663,3.542279 1.201488,5.473292 2.421942,-4.646123 z" /><text xml:space="preserve" style="font-style:normal;font-weight:normal;font-size:6.78371px;line-height:0.85;font-family:sans-serif;fill:#1a2a02;fill-opacity:1;stroke:none;stroke-width:0.169594" x="114.95033" y="80.246109" id="text80535"><tspan style="font-style:normal;font-variant:normal;font-weight:normal;font-stretch:normal;font-family:'Reem Kufi';-inkscape-font-specification:'Reem Kufi';text-align:center;text-anchor:middle;fill:#1a2a02;fill-opacity:1;stroke-width:0.169594" x="114.95033" y="80.246109" id="tspan91363">Wielkanocna</tspan></text><text xml:space="preserve" style="font-style:normal;font-weight:normal;font-size:7.58392px;line-height:0.85;font-family:sans-serif;fill:#1a2a02;fill-opacity:1;stroke:none;stroke-width:0.189599" x="114.67078" y="86.202629" id="text123617"><tspan style="font-style:normal;font-variant:normal;font-weight:normal;font-stretch:normal;font-family:'Reem Kufi';-inkscape-font-specification:'Reem Kufi';text-align:center;text-anchor:middle;fill:#1a2a02;fill-opacity:1;stroke-width:0.189599" x="114.67078" y="86.202629" id="tspan123615">KALWARIA</tspan></text><a href="/#/event/kal26/informacje" xlink:href="/#/event/kal26/informacje" target="_self"><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 98.301936,125.19187 -54.921742,4.97772 -8.634218,23.0356 17.486513,4.79781 47.34318,-0.13193 8.071961,-32.28371 z" id="path1066" /><text x="72" y="144" text-anchor="middle" dominant-baseline="middle" font-family="Reem Kufi, sans-serif" font-size="9" fill="#1a2a02"><tspan x="72" dy="-2.8">Dowiedz si&#281;</tspan><tspan x="72" dy="9">wi&#281;cej</tspan></text></a><a href="/#/event/kal26/plan" xlink:href="/#/event/kal26/plan" target="_self"><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 116.02134,122.55455 -8.93434,13.52165 -4.78265,21.59145 65.81252,0.34261 14.02912,-17.14675 -6.64766,-14.90607 z" id="path1064" /><text x="142" y="143" text-anchor="middle" dominant-baseline="middle" font-family="Reem Kufi, sans-serif" font-size="9" fill="#1a2a02"><tspan x="142" dy="-2.8">Zobacz plan</tspan><tspan x="142" dy="9">pielgrzymki</tspan></text></a><a href="/#/event/kal26/zapisy" xlink:href="/#/event/kal26/zapisy" target="_self"><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 53.704215,160.95995 -17.306437,17.40256 1.795756,11.84579 9.396843,7.02334 60.607673,-0.39842 6.08076,-35.11052 z" id="path884" /><text x="74" y="178" text-anchor="middle" dominant-baseline="middle" font-family="Reem Kufi, sans-serif" font-size="9" fill="#1a2a02"><tspan x="74" dy="-2.8">Zapisz si&#281;</tspan><tspan x="74" dy="9">teraz</tspan></text></a><a href="/#/event/kal26/faq" xlink:href="/#/event/kal26/faq" target="_self"><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 116.98304,161.3129 -6.61872,35.81539 64.57332,-0.47232 7.35769,-15.53446 -9.04441,-18.03611 z" id="path15214" /><text x="146" y="178" text-anchor="middle" dominant-baseline="middle" font-family="Reem Kufi, sans-serif" font-size="9" fill="#1a2a02"><tspan x="146" dy="-2.8">Sprawd&#378; pytania</tspan><tspan x="146" dy="9">i odpowiedzi</tspan></text></a><a href="/#/event/kal26/historia" xlink:href="/#/event/kal26/historia" target="_self"><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 43.839708,201.36899 -17.424877,26.96779 18.384957,8.07088 33.197146,3.32109 32.800696,-1.71016 7.20301,-36.52465 z" id="path14290" /><text x="72" y="220" text-anchor="middle" dominant-baseline="middle" font-family="Reem Kufi, sans-serif" font-size="9" fill="#1a2a02"><tspan x="72" dy="-2.8">Odkryj nasz&#261;</tspan><tspan x="72" dy="9">histori&#281;</tspan></text></a><a href="/#/event/kal26/galeria" xlink:href="/#/event/kal26/galeria" target="_self"><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 174.44775,199.35709 -53.51301,1.42265 -7.7339,37.10988 57.30658,-2.34662 22.07307,-14.73554 z" id="path14294" /><text x="154" y="220" text-anchor="middle" dominant-baseline="middle" font-family="Reem Kufi, sans-serif" font-size="9" fill="#1a2a02"><tspan x="154" dy="-2.8">Zobacz</tspan><tspan x="154" dy="9">wspomnienia</tspan></text></a><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 105.18115,233.3822 -43.655054,-0.0885 -16.726308,3.114 33.197146,3.32109 32.800696,-1.71016 7.20301,-36.52465 z" id="path15218" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 95.41042,152.86781 -12.581687,1.46659 -48.082757,-1.12921 17.486513,4.79781 47.34318,-0.13193 8.071961,-32.28371 z" id="path11505" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 171.71531,191.46728 -61.35099,5.66101 64.57332,-0.47232 7.35769,-15.53446 -5.12021,3.03065 z" id="path14286" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 178.80854,139.90365 -12.44546,14.34779 -64.05873,3.41621 65.81252,0.34261 14.02912,-17.14675 -6.64766,-14.90607 z" id="path11730" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 187.0075,220.53341 -17.44024,10.6234 -56.36642,6.73281 57.30658,-2.34662 22.07307,-14.73554 z" id="path14298" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 111.01819,166.84625 -5.12076,28.34901 -52.110364,-0.64969 -6.196689,2.68607 60.607673,-0.39842 6.08076,-35.11052 z" id="path12085" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 171.36835,259.38289 -4.85087,15.52721 23.67608,4.93407 8.55607,-8.83099 -26.29297,-11.28613 -0.70022,-0.22117 z" id="path15210" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 55.126868,257.0559 -5.863208,15.11329 16.586067,2.02158 20.122803,-2.11719 -14.300419,-11.41894 z" id="path15208" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 130.03134,256.1283 -15.05541,6.68228 8.34936,9.60407 14.99908,0.4625 0.97359,-12.71757 z" id="path15206" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 177.66461,240.90908 -6.43527,17.06407 18.70635,5.69061 7.74992,-11.96981 z" id="path15204" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 21.55579,211.71086 -11.385868,10.11515 12.686047,6.74067 7.357691,-11.81737 z" id="path15202" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 17.854207,181.3184 -7.823295,18.20147 8.313188,-1.89859 9.504846,-10.37818 z" id="path15200" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 197.02725,175.43349 v 5.1e-4 l 10.39471,28.20552 2.57091,-25.81961 -11.72125,-2.31097 -0.73277,-0.0444 z" id="path15198" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 15.66571,174.17258 -15.48019161,0.56069 0.10593669,23.19962 10.22211492,-9.09143 6.476091,-14.15573 -0.684713,-0.26562 z" id="path15196" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 40.382548,160.62096 -14.443563,4.36614 -8.53953,13.52269 16.783471,-1.66192 10.252088,-12.12226 z" id="path15194" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 0.44545085,138.26263 -0.15399577,13.98984 18.81642292,4.23489 1.966805,-16.18248 z" id="path15192" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 202.63518,128.87922 -17.9958,5.3356 13.86943,11.50059 11.31921,4.92114 -0.83251,-15.6962 z" id="path15190" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 31.913298,126.38635 -7.752499,13.48032 8.443929,10.76316 7.74268,-20.44268 z" id="path15188" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 15.766996,116.31255 -15.57786026,14.59756 13.59451926,6.50813 10.510986,-4.16099 3.03444,-12.03647 z" id="path15186" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 110.93173,114.08581 -13.010058,7.59902 15.113808,-1.62161 z" id="path15184" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 195.51055,97.796883 -33.83515,2.767277 -7.19594,7.4166 30.50305,3.16673 13.82603,0.37569 z" id="path15182" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="M 87.351774,91.877348 75.375244,104.42232 86.743026,115.97355 102.83868,98.331734 Z" id="path15180" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 146.99723,91.414844 -9.35602,8.320422 9.67693,6.832654 2.9037,-10.922843 z" id="path15178" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="M 0.45578613,85.811052 0.18913574,110.13618 12.89637,106.74362 23.883297,90.113631 Z" id="path15176" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="M 47.313908,71.804671 44.660323,82.547685 58.533895,83.442721 56.027588,74.21641 Z" id="path15174" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 209.91897,64.297602 -23.56187,10.162687 1.07125,9.986987 17.3328,-2.587955 5.19554,-9.759611 z" id="path15172" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 157.86478,63.374661 -14.27199,4.630725 20.45301,11.679907 2.78174,-10.789522 z" id="path15170" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 136.45627,49.549665 -9.39943,4.386296 8.32818,1.601452 z" id="path15168" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 41.020752,49.545565 3.316593,18.938379 14.786178,2.546614 9.367387,-10.438122 z" id="path15166" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 190.29019,34.3837 -16.28686,4.164087 -0.68213,15.8781 23.76134,-7.23315 z" id="path15164" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="M 0.18913574,20.661023 V 39.700171 L 12.278837,35.840458 9.6665934,25.454529 Z" id="path15162" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 73.354696,20.149943 -0.988054,11.890747 12.091252,2.581755 8.401037,-7.963338 -6.730855,-6.010486 z" id="path15160" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 161.14365,17.220923 -36.92849,3.784265 14.2999,11.418941 16.54576,3.59823 z" id="path15158" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 48.221346,14.122404 -0.577742,1.577165 -6.282821,17.149857 17.980298,1.417485 8.165393,-9.145695 -8.07496,-8.130253 -6.670393,-1.706873 z" id="path15156" /><path style="fill:#ffe640;fill-opacity:1;stroke-width:0.20489" d="m 210.0001,3.6439739 -15.13448,8.1069991 10.6221,13.743863 4.48654,-16.9260981 z" id="path12598" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 95.808622,273.11745 -47.015218,5.91592 -17.853174,0.0145 -26.8283363,9.82317 2.8954305,7.69514 c 0,0 21.4526558,0.14547 32.1013998,0.43408 H 210.0001 c -0.53095,-13.59736 -21.20962,-14.25682 -31.54639,-17.88005 -11.10829,-5.17442 -18.53296,5.82383 -29.33671,-1.74149 -17.28427,-4.74557 -35.58421,-3.05835 -53.308378,-4.26124 z" id="path14150" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 3.1522624,263.40538 -2.97862959,21.58731 7.78092039,0.28164 4.4798298,-8.19847 z" id="path14148" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 103.99055,261.62823 0.57723,9.27798 7.73544,-2.62568 z" id="path14146" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 48.12006,253.07474 -28.536242,7.16804 -11.3352259,-0.15503 3.4938439,12.36876 9.745658,4.57078 22.752616,-12.20804 5.922636,-9.81284 z" id="path14144" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 170.13949,251.83916 -27.25105,9.52707 -1.13223,12.27728 20.03805,5.27668 z" id="path14142" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 119.84953,240.64501 -63.838995,3.17655 2.518192,9.8423 21.909774,5.8415 11.644767,-5.86889 11.125422,5.42447 15.45642,-15.17013 z" id="path14140" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="M 6.3861735,224.34833 0.162264,236.38429 0,263.29893 20.677808,233.30903 Z" id="path14138" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 194.9757,222.29781 -19.8112,13.63173 26.51415,15.84244 8.31732,-8.81135 v -15.11019 z" id="path14136" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="M 0.18913574,201.34095 V 223.4967 L 14.652336,213.13248 9.0309733,205.43476 Z" id="path14134" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 182.66224,190.94262 1.38544,12.29847 12.9651,0.70177 0.93638,-7.04505 z" id="path14132" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 178.78495,163.28901 4.24987,11.41894 0.84026,-9.13226 z" id="path14130" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 189.24168,144.36665 -12.99094,8.96741 6.13554,7.66568 7.26364,-5.81308 z" id="path14128" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 60.883105,113.26261 -28.698506,8.52661 19.125447,4.25142 21.410063,-2.65462 z" id="path14126" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 145.75699,110.74751 6.60219,10.92595 21.00853,1.8371 -8.62789,-10.73113 z" id="path14124" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 209.86729,108.34869 -9.57202,7.90753 7.18199,7.22127 z" id="path14122" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 56.786198,102.38627 -36.575545,1.4521 -8.204151,9.24854 24.903907,5.99084 27.204024,-9.50329 z" id="path14120" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 103.89857,100.62152 -9.141046,10.42572 24.917346,0.88728 z" id="path14118" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 191.77641,87.654867 -11.28458,7.992793 14.25287,0.156063 z" id="path14116" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 209.74844,81.963224 -15.36857,5.882329 11.78377,1.311547 z" id="path14114" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 179.13894,81.229419 -10.76059,6.618717 4.3124,7.362342 7.78454,-7.465694 z" id="path14112" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 72.617273,80.889905 -7.853784,13.505635 10.739396,5.99653 9.724988,-10.417965 z" id="path14110" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="M 18.622119,70.831087 9.2035726,85.157861 26.523962,85.918022 37.466964,79.721501 Z" id="path14108" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 172.45717,68.752661 -2.86752,12.520683 10.34717,-5.968628 8.86871,-6.412012 z" id="path14106" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 70.012781,63.067737 -7.17579,10.442257 9.591146,2.216919 -0.824756,-10.864454 z" id="path14104" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="M 0.18913574,41.301107 0.27646891,55.282166 9.2593831,42.295361 Z" id="path14102" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 129.9962,30.897091 -6.73137,10.411251 11.22619,5.201749 5.3852,-7.428487 z" id="path14100" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="M 19.635494,29.912655 8.2124186,48.085706 39.01519,57.870638 38.708232,36.087988 Z" id="path14098" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 169.02483,27.420817 -9.97149,8.495606 4.42402,7.673433 8.2672,-9.1736 z" id="path14096" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 97.518595,21.307495 5.755205,7.577315 0.87695,-6.280753 z" id="path14094" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="m 193.27657,13.713127 -20.04167,12.670544 8.72454,7.645012 21.04419,-7.148401 z" id="path14092" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="M 0.32607829,4.0599691 0.18913574,18.351603 11.173995,14.161678 3.6385376,5.696045 Z" id="path14090" /><path style="fill:#88c529;fill-opacity:1;stroke-width:0.20489" d="M 0.18758545,-3.9219726 10.830863,6.5755779 44.39729,15.963635 l 3.246314,-0.264066 0.577742,-1.577165 4.539775,1.161686 7.939567,-0.645438 32.716349,3.824572 50.459453,-1.572513 25.71264,-2.185397 13.19248,-0.613916 24.47809,-11.5770709 -6.0756,-6.4362997 z" id="path12600" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 203.58798,272.03087 -9.74325,8.99874 16.01638,7.98934 0.13734,-14.29191 z" id="path14282" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 46.905545,266.48108 -13.440012,7.04812 10.950578,-1.09955 z" id="path14280" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 90.98069,254.30758 -6.755337,10.08636 11.412146,5.35201 -1.552619,-12.22809 z" id="path14278" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 205.78744,252.51237 -8.89701,8.29531 8.9205,8.47193 4.18752,-8.61056 z" id="path14276" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 115.45988,252.33062 -6.74368,7.28182 13.35221,-4.89134 z" id="path14274" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 171.39927,238.41458 -45.60341,2.29293 -2.34573,10.89001 19.77603,6.93707 26.17397,-7.83292 3.65577,-12.08198 z" id="path14272" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 23.381522,233.95832 -12.588104,17.0454 11.464559,6.29651 24.454334,-7.43374 -0.803775,-10.14299 z" id="path14270" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 209.99587,205.62233 -22.4754,2.57741 10.31069,12.66027 11.91837,3.31841 z" id="path14268" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 20.916668,198.50037 -0.793075,4.81643 z" id="path14266" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 31.496334,188.65025 -8.149636,10.16139 3.063192,11.5913 10.300235,-4.65999 -1.396576,-11.58232 z" id="path14264" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 189.91355,174.79668 -6.14303,13.26808 15.91107,3.21298 -6.03358,-15.69887 z" id="path14262" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 0.18896871,153.68845 v 19.20408 l 18.55667529,-2.1268 0.73732,-10.97618 z" id="path14260" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 196.25072,147.62081 -3.70156,16.54938 7.3574,9.04848 10.07447,-2.36183 -0.0874,-16.90352 -13.64292,-6.33251 z" id="path14258" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 23.84465,143.58999 -2.191211,14.50102 10.668859,-1.04028 z" id="path14256" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 98.857484,113.05399 -16.815118,9.68025 20.136314,-5.74851 z" id="path14254" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 168.67936,112.6874 16.69342,18.55713 17.33902,-4.64314 -8.56892,-11.62543 z" id="path14252" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="M 0.18896871,112.5289 0.27725737,127.60871 11.678886,115.38253 Z" id="path14250" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 74.212556,106.26453 -7.28533,8.67545 10.402197,7.71491 1.960686,-11.1618 z" id="path14248" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 128.34177,104.50703 -10.77742,15.20372 29.21736,1.10799 -5.77852,-14.82423 z" id="path14246" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 209.58593,92.162617 -12.13736,2.975889 3.71534,15.253394 8.70948,-9.5964 z" id="path14244" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="M 37.502028,83.179891 24.085322,94.645729 32.74696,100.8887 56.220664,100.09403 55.756751,89.321882 Z" id="path14242" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 158.50603,81.070773 -8.19202,10.264004 8.66848,6.540743 7.20621,-11.859549 z" id="path14240" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="M 0.3572851,69.00982 0.18896871,83.812884 11.341711,77.482807 4.2513749,69.62864 Z" id="path14238" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="M 31.794244,58.151863 27.686746,70.710081 38.701539,73.768533 36.4541,62.408519 Z" id="path14236" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="M 5.8678399,52.004184 1.3993797,63.434048 14.376902,68.47678 25.785018,65.905902 22.715036,56.112828 Z" id="path14234" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 197.06545,49.749952 -36.90156,12.396039 38.66256,2.604469 z" id="path14232" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 199.21898,42.420992 2.07555,17.266371 8.59911,-2.381755 -1.41587,-12.335595 z" id="path14230" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 148.32444,37.911042 -5.71405,23.165188 16.63376,-2.416187 -6.13003,-16.899951 z" id="path14228" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 41.95725,35.344991 0.943319,12.414832 10.2704,-1.333313 -4.461817,-9.297661 z" id="path14226" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 68.706648,34.383626 -10.996281,7.095451 0.925785,11.986709 13.366606,6.720846 8.093128,-21.364307 z" id="path14224" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 209.87816,26.597702 -17.26019,7.065674 11.313,8.232491 5.99116,-11.410972 -0.044,-3.887193 z" id="path14222" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 116.96647,21.989654 -3.02498,10.488837 9.42577,0.453209 -3.79509,-9.247651 z" id="path14220" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="m 165.42507,17.192121 3.13045,6.919225 5.18945,-5.597947 z" id="path14218" /><path style="fill:#f45842;fill-opacity:1;stroke-width:0.20489" d="M 20.147369,13.183506 10.874595,21.600684 34.942564,32.42498 41.725186,24.547094 37.2049,16.798389 Z" id="path12602" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 207.92525,284.62962 -14.08052,-3.60001 16.01638,7.98934 0.13734,-14.29191 z" id="path14426" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 46.905545,266.48108 -3.939317,4.1566 1.449883,1.79197 z" id="path14424" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 93.046059,266.69979 -8.820706,-2.30585 11.412146,5.35201 -1.552619,-12.22809 z" id="path14422" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 206.82012,263.8719 -2.28783,2.92535 1.27864,2.48236 4.18752,-8.61056 z" id="path14420" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 113.60105,256.46136 -4.88485,3.15108 13.35221,-4.89134 z" id="path14418" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 171.39927,238.41458 -4.29604,11.58709 -22.3798,5.31351 -1.49727,3.21941 26.17397,-7.83292 3.65577,-12.08198 z" id="path14416" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 42.589449,248.82897 -16.512304,3.62051 -3.819168,4.85075 24.454334,-7.43374 -0.803775,-10.14299 z" id="path14414" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 209.99587,205.62233 -2.02825,15.58923 -10.13646,-0.35155 11.91837,3.31841 z" id="path14412" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 20.916668,198.50037 -0.793075,4.81643 z" id="path14410" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 33.561703,204.55359 -5.877731,2.72606 -1.274082,3.12329 10.300235,-4.65999 -1.396576,-11.58232 z" id="path14408" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 195.69658,187.8085 -11.92606,0.25626 15.91107,3.21298 -6.03358,-15.69887 z" id="path14406" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 16.092306,168.5591 -15.90333729,4.33343 18.55667529,-2.1268 0.73732,-10.97618 z" id="path14404" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 205.33834,168.2745 -5.56039,1.67872 0.12861,3.26545 10.07447,-2.36183 -0.0874,-16.90352 -2.69647,11.6362 z" id="path14402" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 28.388461,154.94952 -6.735022,3.14149 10.668859,-1.04028 z" id="path14400" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 97.324026,117.4353 -15.28166,5.29894 20.136314,-5.74851 z" id="path14398" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 197.80106,125.28615 -12.42828,5.95838 17.33902,-4.64314 -8.56892,-11.62543 z" id="path14396" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="M 4.3197058,120.3773 0.27725737,127.60871 11.678886,115.38253 Z" id="path14394" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 77.498537,114.36995 -2.319847,5.38947 2.150733,2.89547 1.960686,-11.1618 z" id="path14392" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 143.00589,118.13846 -25.44154,1.57229 29.21736,1.10799 -5.77852,-14.82423 z" id="path14390" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 209.58593,92.162617 -1.60398,8.345843 -6.81804,9.88344 8.70948,-9.5964 z" id="path14388" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="M 52.763585,98.003317 34.673484,98.880994 32.74696,100.8887 56.220664,100.09403 55.756751,89.321882 Z" id="path14386" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 161.19101,89.951858 -3.23514,5.92673 1.02662,1.996932 7.20621,-11.859549 z" id="path14384" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="M 5.9069422,77.188262 0.18896871,83.812884 11.341711,77.482807 4.2513749,69.62864 Z" id="path14382" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="M 35.591378,69.835352 27.686746,70.710081 38.701539,73.768533 36.4541,62.408519 Z" id="path14380" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="M 16.967154,65.148109 1.3993797,63.434048 14.376902,68.47678 25.785018,65.905902 22.715036,56.112828 Z" id="path14378" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 197.06545,49.749952 -0.96415,10.33067 2.72515,4.669838 z" id="path14376" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 207.48045,56.672035 -6.18592,3.015328 8.59911,-2.381755 -1.41587,-12.335595 z" id="path14374" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 156.79245,57.118969 -14.18206,3.957261 16.63376,-2.416187 -6.13003,-16.899951 z" id="path14372" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 48.675256,44.107608 -5.774687,3.652215 10.2704,-1.333313 -4.461817,-9.297661 z" id="path14370" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 70.751259,55.121818 -8.951671,-2.543427 -3.163436,0.887395 13.366606,6.720846 8.093128,-21.364307 z" id="path14368" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 209.87816,26.597702 -3.62876,6.6526 -2.31843,8.645565 5.99116,-11.410972 -0.044,-3.887193 z" id="path14366" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 120.89067,31.077276 -6.94918,1.401215 9.42577,0.453209 -3.79509,-9.247651 z" id="path14364" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 169.14273,20.496711 -0.58721,3.614635 5.18945,-5.597947 z" id="path14362" /><path style="fill:#9a1b08;fill-opacity:1;stroke-width:0.20489" d="m 16.93441,21.361948 -6.059815,0.238736 24.067969,10.824296 6.782622,-7.877886 -8.609507,3.058522 z" id="path12604" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 55.533936,285.7162 -19.132743,6.74207 -25.908111,1.04718 -6.3811883,-4.63441 2.8954305,7.69514 32.1013998,0.43408 H 210.0001 l -7.17504,-3.42247 -19.00987,-4.63301 -113.823675,2.14141 z" id="path14214" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 6.6633889,283.23292 -6.48975609,1.75977 7.78092039,0.28164 4.4798298,-8.19847 z" id="path14212" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 106.88207,267.41126 -2.31429,3.49495 7.73544,-2.62568 z" id="path14210" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 48.12006,253.07474 -6.643336,10.05956 -19.5967,11.20449 -10.137588,-1.88228 9.745658,4.57078 22.752616,-12.20804 5.922636,-9.81284 z" id="path14208" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 170.13949,251.83916 -9.48888,23.1585 -18.8944,-1.35415 20.03805,5.27668 z" id="path14206" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 102.2939,255.30913 -9.519805,-4.25878 -34.245368,2.61351 21.909774,5.8415 11.644767,-5.86889 11.125422,5.42447 15.45642,-15.17013 z" id="path14204" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="M 14.647648,237.97976 3.6733905,252.08109 0,263.29893 20.677808,233.30903 Z" id="path14202" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 206.33523,241.2992 -5.14709,6.40294 0.49051,4.06984 8.31732,-8.81135 v -15.11019 z" id="path14200" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="M 10.722515,213.11355 0.18913574,223.4967 14.652336,213.13248 9.0309733,205.43476 Z" id="path14198" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 194.84791,202.09561 -10.80023,1.14548 12.9651,0.70177 0.93638,-7.04505 z" id="path14196" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 182.29608,169.27858 0.73874,5.42937 0.84026,-9.13226 z" id="path14194" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 189.24168,144.36665 -1.42488,10.00009 -5.43052,6.633 7.26364,-5.81308 z" id="path14192" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 65.013842,121.52408 -13.621316,2.74358 -0.08248,1.77298 21.410063,-2.65462 z" id="path14190" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 168.06297,121.07435 -15.70379,0.59911 21.00853,1.8371 -8.62789,-10.73113 z" id="path14188" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 209.86729,108.34869 -2.96284,7.28792 0.57281,7.84088 z" id="path14186" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 56.579661,109.8216 -19.639523,6.61552 -24.933636,-3.35021 24.903907,5.99084 27.204024,-9.50329 z" id="path14184" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 109.88814,109.5026 -15.130616,1.54464 24.917346,0.88728 z" id="path14182" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 190.33065,93.850973 -9.83882,1.796687 14.25287,0.156063 z" id="path14180" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 209.74844,81.963224 -4.21558,4.436571 0.63078,2.757305 z" id="path14178" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 179.13894,81.229419 -0.64028,6.205643 -5.80791,7.775416 7.78454,-7.465694 z" id="path14176" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 80.259137,92.042895 -4.755732,5.037624 -5.2e-4,3.311551 9.724988,-10.417965 z" id="path14174" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="M 25.437835,83.842909 9.2035726,85.157861 26.523962,85.918022 37.466964,79.721501 Z" id="path14172" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 178.65328,74.74223 -9.06363,6.531114 10.34717,-5.968628 8.86871,-6.412012 z" id="path14170" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 70.838928,73.601116 -8.001937,-0.09112 9.591146,2.216919 -0.824756,-10.864454 z" id="path14168" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="M 2.667578,48.32336 0.27646891,55.282166 9.2593831,42.295361 Z" id="path14166" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 136.60538,39.984713 -2.3941,4.008608 0.27974,2.51677 5.3852,-7.428487 z" id="path14164" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="M 35.538832,54.284004 8.2124186,48.085706 39.01519,57.870638 38.708232,36.087988 Z" id="path14162" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 169.02483,27.420817 0.76843,6.843311 -6.3159,9.325728 8.2672,-9.1736 z" id="path14160" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 102.06241,25.644769 1.21139,3.240041 0.87695,-6.280753 z" id="path14158" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="m 193.27657,13.713127 6.60158,12.464007 -17.91871,7.851549 21.04419,-7.148401 z" id="path14156" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="M 7.9679418,13.147591 0.18913574,18.351603 11.173995,14.161678 3.6385376,5.696045 Z" id="path14154" /><path style="fill:#578d04;fill-opacity:1;stroke-width:0.20489" d="M 181.57375,9.2219522 79.471359,12.709409 44.39729,15.963635 l 3.246314,-0.264066 0.577742,-1.577165 4.539775,1.161686 7.939567,-0.645438 32.716349,3.824572 50.459453,-1.572513 25.71264,-2.185397 13.19248,-0.613916 24.47809,-11.5770709 -6.0756,-6.4362997 z" id="path12606" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 166.51748,274.9101 23.67608,4.93407 8.55607,-8.83099 -9.16585,6.50515 z" id="path14358" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 68.270793,272.53652 -19.007133,-0.36733 16.586067,2.02158 20.122803,-2.11719 -5.099672,-1.19589 z" id="path14356" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 136.74935,270.00244 -9.35971,0.25636 -4.06435,2.15585 14.99908,0.4625 0.97359,-12.71757 z" id="path14354" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 192.7071,255.3674 -3.07627,6.1108 0.30486,2.18556 7.74992,-11.96981 z" id="path14352" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 25.20688,220.76556 -2.477208,5.14967 0.126297,2.65145 7.357691,-11.81737 z" id="path14350" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 187.0075,220.53341 -17.44024,10.6234 -56.36642,6.73281 57.30658,-2.34662 22.07307,-14.73554 z" id="path14348" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 16.977945,196.21485 -6.947033,3.30502 8.313188,-1.89859 9.504846,-10.37818 z" id="path14346" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 207.42196,203.63952 2.57091,-25.81961 -4.23801,16.49119 z" id="path14344" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 8.0718733,187.87719 -7.78041822,10.0557 10.22211492,-9.09143 6.476091,-14.15573 -3.560095,3.18868 z" id="path14342" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 41.69694,163.97996 -8.163687,10.93811 -16.133798,3.59172 16.783471,-1.66192 10.252088,-12.12226 z" id="path14340" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 18.262771,154.47347 -17.97131592,-2.221 18.81642292,4.23489 1.966805,-16.18248 z" id="path14338" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 207.30858,146.84258 -6.75045,-1.52845 -2.04932,0.40128 11.31921,4.92114 -0.83251,-15.6962 z" id="path14336" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 36.148563,135.14897 -4.393496,11.28966 0.849661,4.1912 7.74268,-20.44268 z" id="path14334" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 22.485002,131.93922 -7.983593,3.3522 -0.717754,2.12682 10.510986,-4.16099 3.03444,-12.03647 z" id="path14332" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 106.25833,119.48942 -8.336658,2.19541 15.113808,-1.62161 z" id="path14330" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 195.51055,97.796883 -0.24512,11.821977 -40.78597,-1.6381 30.50305,3.16673 13.82603,0.37569 z" id="path14328" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 93.777693,102.83062 -7.157091,9.77014 0.122424,3.37279 16.095654,-17.641816 z" id="path14326" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 146.85119,102.51416 -0.15528,2.33263 0.62223,1.72113 2.9037,-10.922843 z" id="path14324" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="M 11.993231,104.94276 0.18913574,110.13618 12.89637,106.74362 23.883297,90.113631 Z" id="path14322" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="M 56.076525,81.735636 44.660323,82.547685 58.533895,83.442721 56.027588,74.21641 Z" id="path14320" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 209.91897,64.297636 -6.76685,15.858388 -15.72377,4.291286 17.3328,-2.587955 5.19554,-9.759611 z" id="path14318" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 163.26839,76.956751 -19.6756,-8.951331 20.45301,11.679907 2.78174,-10.789522 z" id="path14316" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 136.45627,49.549699 -2.24329,3.948165 1.17204,2.039583 z" id="path14314" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="M 58.545985,69.261452 44.337345,68.483944 59.123523,71.030558 68.49091,60.592436 Z" id="path14312" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 190.29019,34.3837 4.30529,11.612311 -21.27428,8.429876 23.76134,-7.23315 z" id="path14310" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="M 9.9740575,34.827253 0.18913574,39.700171 12.278837,35.840458 9.6665934,25.454529 Z" id="path14308" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 83.723792,31.687388 -11.35715,0.353302 12.091252,2.581755 8.401037,-7.963338 -4.10207,0.853564 z" id="path14306" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 161.14365,17.220923 -6.84351,16.636103 -15.78508,-1.432897 16.54576,3.59823 z" id="path14304" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 60.342966,29.895114 -3.352571,0.99299 -15.629612,1.961322 17.980298,1.417485 8.165393,-9.145695 -8.07496,-8.130253 4.867052,7.347831 z" id="path14302" /><path style="fill:#ffad09;fill-opacity:1;stroke-width:0.20489" d="m 210.0001,3.6439739 -2.28264,6.0623886 -2.22974,15.7884735 4.48654,-16.9260981 z" id="path12608" /></g></svg>
`;
function PilgrimageStoneMap() {
  const graphicRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = graphicRef.current;
    if (!root) {
      return;
    }

    const jumpToClickableGroup = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      const target = root.querySelector<SVGGraphicsElement>('#path1064');
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const jumpIds = ['path6244', 'text80535', 'text123617', 'tspan91363', 'tspan123615'];
    const boundElements: Element[] = [];
    const textIds = ['text80535', 'text123617', 'tspan91363', 'tspan123615'];
    const textBoundElements: Element[] = [];
    const headerPath = root.querySelector<SVGGraphicsElement>('#path6244');

    const turnOnHeaderPathGlow = () => headerPath?.classList.add('text-hover-glow');
    const turnOffHeaderPathGlow = () => headerPath?.classList.remove('text-hover-glow');

    for (const id of jumpIds) {
      const element = root.querySelector(`#${id}`);
      if (!element) {
        continue;
      }
      (element as HTMLElement).style.cursor = 'pointer';
      element.addEventListener('click', jumpToClickableGroup);
      boundElements.push(element);
    }

    for (const id of textIds) {
      const element = root.querySelector(`#${id}`);
      if (!element) {
        continue;
      }
      element.addEventListener('mouseenter', turnOnHeaderPathGlow);
      element.addEventListener('mouseleave', turnOffHeaderPathGlow);
      element.addEventListener('focus', turnOnHeaderPathGlow);
      element.addEventListener('blur', turnOffHeaderPathGlow);
      textBoundElements.push(element);
    }

    return () => {
      for (const element of boundElements) {
        element.removeEventListener('click', jumpToClickableGroup);
      }
      for (const element of textBoundElements) {
        element.removeEventListener('mouseenter', turnOnHeaderPathGlow);
        element.removeEventListener('mouseleave', turnOffHeaderPathGlow);
        element.removeEventListener('focus', turnOnHeaderPathGlow);
        element.removeEventListener('blur', turnOffHeaderPathGlow);
      }
    };
  }, []);

  return <div ref={graphicRef} className="start-graphic" dangerouslySetInnerHTML={{ __html: PILGRIMAGE_START_SVG }} />;
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
  const selectedPageSlugRaw = segments[2] ?? null;

  const selectedEvent = selectedEventSlug ? EVENTS.find((entry) => entry.slug === selectedEventSlug) ?? null : null;
  const selectedPageSlug =
    selectedEvent?.slug === 'kal26'
      ? ({
          informacje: 'niezbednik',
          plan: 'program',
          historia: 'o-pielgrzymce'
        }[selectedPageSlugRaw ?? ''] ?? selectedPageSlugRaw)
      : selectedPageSlugRaw;
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
  }, [navigate, selectedEvent, selectedPageSlugRaw]);

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
