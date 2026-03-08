import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import { LanguageSelect } from '../../components/LanguageSelect';
import { AuthAction } from '../../components/AuthAction';
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
    summary: 'Wspolna pielgrzymka piesza z codzienna modlitwa i liturgia w drodze.',
    date: '01.05.2026-03.05.2026',
    location: 'Krakow - Kalwaria Zebrzydowska',
    pages: [
      { slug: 'opis', title: 'Opis' },
      { slug: 'trasa', title: 'Trasa' },
      { slug: 'uczestnictwo', title: 'Uczestnictwo' }
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
      <p>
        Tematyka: wielkopostna i eucharystyczna. Po Mszy przewidziany jest czas adoracji.
      </p>
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

function Kal26Body({ pageSlug }: { pageSlug: string }) {
  if (pageSlug === 'trasa') {
    return (
      <>
        <h2>Trasa</h2>
        <p>Dzien 1: wyjscie z Krakowa i dojscie do punktu noclegowego.</p>
        <p>Dzien 2-3: dalsza droga i wejscie do Kalwarii Zebrzydowskiej.</p>
      </>
    );
  }

  if (pageSlug === 'uczestnictwo') {
    return (
      <>
        <h2>Uczestnictwo</h2>
        <p>Zapisy przez formularz wydarzenia oraz punkt parafialny.</p>
        <p>Wymagane jest potwierdzenie regulaminu i danych kontaktowych.</p>
      </>
    );
  }

  return (
    <>
      <h2>Opis</h2>
      <p>Wspolna droga modlitwy i budowania wspolnoty na trasie Krakow - Kalwaria Zebrzydowska.</p>
    </>
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
  return (
    <div className="event-page kal-page">
      <header className="kal-header">
        <div>
          <p className="kal-kicker">Pielgrzymka</p>
          <h1>{event.title}</h1>
          <p>{event.date}</p>
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

      <main className="kal-main">
        <aside className="kal-sidebar">
          <a href="/#/event" className="ghost">{copy.events.backToEvents}</a>
          <p>{event.location}</p>
          <div className="kal-page-links">
            {event.pages.map((item) => (
              <a key={item.slug} href={`/#/event/${event.slug}/${item.slug}`} className={item.slug === page.slug ? 'active' : ''}>
                {item.title}
              </a>
            ))}
          </div>
        </aside>

        <section className="kal-content">
          <Kal26Body pageSlug={page.slug} />
        </section>
      </main>

      <footer className="kal-footer">
        <a href="/#/" className="kal-logo">Recreatio</a>
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
      ? selectedEvent.pages.find((page) => page.slug === selectedPageSlug) ?? null
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
