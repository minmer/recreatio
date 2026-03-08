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

function WarsztatyEventContent({ pageSlug }: { pageSlug: string }) {
  if (pageSlug === 'program') {
    return (
      <article className="events-content-card events-content-card--warsztaty">
        <h2>Program</h2>
        <p>
          Uklad warsztatow jest praktyczny: rozspiewka, praca w glosach, skladanie calosci i proba generalna.
          Msza Swieta jest zwienczeniem - spiewamy przecwiczone utwory w liturgii.
        </p>

        <section className="events-program-block">
          <h3>Sobota - 28.02.2026 (9:30-18:30 + Msza 18:30)</h3>
          <dl className="events-schedule">
            <div>
              <dt>09:00</dt>
              <dd>Otwarcie sali. Wejscie do budynku, zgloszenia, sprawy organizacyjne.</dd>
            </div>
            <div>
              <dt>09:30</dt>
              <dd>Rozspiewka. Oddech, emisja, przygotowanie do wieloglosu.</dd>
            </div>
            <div>
              <dt>10:15</dt>
              <dd>Praca w SATB. Nauka materialu w sekcjach, intonacja i tekst.</dd>
            </div>
            <div>
              <dt>11:30</dt>
              <dd>Przerwa. Herbata, ciastka, owoce.</dd>
            </div>
            <div>
              <dt>13:10</dt>
              <dd>Obiad. Dla zapisanych do 24.02 - prosty posilek.</dd>
            </div>
            <div>
              <dt>16:20</dt>
              <dd>Proba calosci. Pelne przejscia, wejscia, zakonczenia.</dd>
            </div>
            <div>
              <dt>18:30</dt>
              <dd>Msza Swieta. Zwienczenie dnia - wykonanie przecwiczonych utworow.</dd>
            </div>
            <div>
              <dt>19:15</dt>
              <dd>Adoracja i Spowiedz. Spiew przed Najswietszym Sakramentem oraz mozliwosc Spowiedzi Swietej.</dd>
            </div>
          </dl>
        </section>

        <section className="events-program-block">
          <h3>Niedziela - 01.03.2026 (9:30-12:00 + Msza 12:00)</h3>
          <dl className="events-schedule">
            <div>
              <dt>09:30</dt>
              <dd>Rozspiewka. Wprowadzenie i przygotowanie do prob.</dd>
            </div>
            <div>
              <dt>10:05</dt>
              <dd>Powtorka repertuaru. Praca nad utworami liturgicznymi.</dd>
            </div>
            <div>
              <dt>11:10</dt>
              <dd>Proba generalna. Ostatnie przygotowanie przed Msza.</dd>
            </div>
            <div>
              <dt>12:00</dt>
              <dd>Msza Swieta. Wykonanie przygotowanych utworow, po Mszy krotka adoracja.</dd>
            </div>
          </dl>
        </section>
      </article>
    );
  }

  if (pageSlug === 'prowadzacy') {
    return (
      <article className="events-content-card events-content-card--warsztaty">
        <h2>Prowadzacy - Pawel Bebenek</h2>
        <p>
          Pawel Bebenek to znany i ceniony polski dyrygent, kompozytor i wokalista. Jego tworczosc laczy gleboka
          duchowosc z tradycja muzyki liturgicznej. Jest absolwentem studiow podyplomowych z chormistrzostwa i emisji
          glosu oraz czlonkiem Stowarzyszenia Polskich Muzykow Koscielnych. Od dekad pracuje z chorami i scholami w
          Polsce i za granica.
        </p>
        <p>
          Jego kompozycje i aranzacje byly wykonywane przez zespoly w wielu krajach - od Polski przez Europe po Stany
          Zjednoczone. Jest autorem licznych nagran i wydawnictw nutowych wykorzystywanych w srodowisku muzyki
          sakralnej.
        </p>

        <h3>Dlaczego warto przyjsc?</h3>
        <p>
          Jako prowadzacy warsztaty liturgiczno-muzyczne inspiruje uczestnikow do odkrywania piekna spiewu w kontekscie
          liturgii. Laczy solidne umiejetnosci techniczne z troska o duchowe przezycie muzyczne.
        </p>
        <ul className="events-bullet-list">
          <li>Doswiadczenie miedzynarodowe - prowadzil warsztaty choralne w wielu krajach.</li>
          <li>Bogaty dorobek kompozytorski - jego utwory trafily do spiewnikow i repertuarow scholi oraz chorow.</li>
          <li>Muzyka sakralna - skupiona na pieknie liturgii i zywej modlitwie.</li>
        </ul>
      </article>
    );
  }

  return (
    <article className="events-content-card events-content-card--warsztaty">
      <h2>O warsztatach</h2>
      <p>
        Celem warsztatow jest zachwyt nad Bogiem przez liturgie i jej integralna czesc, ktora jest muzyka. Pracujemy
        nad spiewem wieloglosowym (SATB), a zwienczeniem sa Msze Swiete, podczas ktorych wykonamy przygotowane utwory.
      </p>
      <p>
        Tematyka obejmuje utwory wielkopostne i eucharystyczne, a po Mszy przewidziany jest czas adoracji.
      </p>

      <h3>Dla kogo?</h3>
      <p>
        Dla pasjonatow, poczatkujacych i doswiadczonych. Warto miec doswiadczenie ze spiewaniem, ale mozna tez zaczac
        bez niego, jesli ktos spiewa ze sluchu i chce sie uczyc.
      </p>
      <p>
        Zapraszamy rowniez mlodszych uczestnikow, jesli maja doswiadczenie spiewu i zapewniona opieke osoby doroslej.
      </p>
      <ul className="events-bullet-list">
        <li>Materialy: nuty beda przygotowane na warsztaty - nie trzeba nic drukowac.</li>
        <li>Podzial na glosy: SATB - ustalany na miejscu.</li>
        <li>Msza jako zwienczenie: wykonanie przecwiczonych utworow bezposrednio w liturgii.</li>
      </ul>
    </article>
  );
}

function Kal26EventContent({ pageSlug }: { pageSlug: string }) {
  if (pageSlug === 'trasa') {
    return (
      <article className="events-content-card events-content-card--kal">
        <h2>Trasa</h2>
        <p>
          Dzien 1: wyjscie z Krakowa i pierwszy etap do punktu noclegowego. Dzien 2 i 3: dalsza droga z modlitwa,
          konferencjami i wspolnym wejsciem do Kalwarii Zebrzydowskiej.
        </p>
        <ul className="events-bullet-list">
          <li>Etapy sa prowadzone przez sluzbe porzadkowa i animatorow grup.</li>
          <li>Na trasie sa punkty postojowe i strefy wsparcia medycznego.</li>
          <li>Szczegolowy przebieg kilometrowy jest publikowany przed startem.</li>
        </ul>
      </article>
    );
  }

  if (pageSlug === 'uczestnictwo') {
    return (
      <article className="events-content-card events-content-card--kal">
        <h2>Uczestnictwo</h2>
        <p>
          Zapisy odbywaja sie przez formularz wydarzenia oraz punkt parafialny. Wymagane jest potwierdzenie regulaminu
          i danych kontaktowych.
        </p>
        <ul className="events-bullet-list">
          <li>Rejestracja obejmuje wybor grupy i informacje o stanie zdrowia.</li>
          <li>Uczestnicy otrzymuja pakiet pielgrzyma oraz dane kontaktowe sluzb.</li>
          <li>Osoby niepelnoletnie uczestnicza pod opieka doroslego opiekuna.</li>
        </ul>
      </article>
    );
  }

  return (
    <article className="events-content-card events-content-card--kal">
      <h2>Opis</h2>
      <p>
        5. piesza pielgrzymka z Krakowa do Kalwarii Zebrzydowskiej to wspolna droga modlitwy i budowania wspolnoty.
        Kazdy etap laczy liturgie, konferencje oraz czas ciszy i rozmowy.
      </p>
      <p>
        Celem wydarzenia jest przezycie drogi pielgrzyma w duchu jednosci, odpowiedzialnosci i wdziecznosci.
      </p>
    </article>
  );
}

export function EventsPage({
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

  const unknownEvent = Boolean(selectedEventSlug && !selectedEvent);
  const unknownPage = Boolean(selectedEvent && selectedPageSlug && !selectedInnerPage);
  const resolvedPage = selectedInnerPage ?? defaultPage;

  useEffect(() => {
    if (!selectedEvent || selectedPageSlug) return;
    const firstPage = selectedEvent.pages[0];
    if (!firstPage) return;
    navigate(`/event/${selectedEvent.slug}/${firstPage.slug}`, { replace: true });
  }, [navigate, selectedEvent, selectedPageSlug]);

  return (
    <div className="portal-page events">
      <main className="events-main">
        <article className="events-shell-card">
          <div className="events-card-head">
            <div className="events-card-nav">
              <a className="ghost" href="/#/section-1">
                {copy.nav.home}
              </a>
              <a className="ghost" href="/#/event">
                {copy.events.backToEvents}
              </a>
            </div>
            <div className="events-card-actions">
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
          </div>

          <section className="events-hero">
            <p className="tag">REcreatio</p>
            <h1>{copy.events.title}</h1>
            <p>{copy.events.subtitle}</p>
          </section>

          {unknownEvent && <p className="events-warning">{copy.events.unknownEvent}</p>}

          {!selectedEvent ? (
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
          ) : (
            <section className={`events-detail events-detail--${selectedEvent.slug}`}>
              <aside className={`events-sidebar events-sidebar--${selectedEvent.slug}`}>
                <h2>{selectedEvent.title}</h2>
                <p className="events-meta">{selectedEvent.date}</p>
                <p className="events-meta">{selectedEvent.location}</p>

                <div className="events-side-group">
                  <h3>{copy.events.pagesLabel}</h3>
                  <div className="events-page-links">
                    {selectedEvent.pages.map((page) => (
                      <a
                        key={page.slug}
                        className={`events-page-link ${resolvedPage?.slug === page.slug ? 'active' : ''}`}
                        href={`/#/event/${selectedEvent.slug}/${page.slug}`}
                      >
                        {page.title}
                      </a>
                    ))}
                  </div>
                </div>

                <div className="events-side-group">
                  <h3>{copy.events.chooserTitle}</h3>
                  <div className="events-switch-links">
                    {EVENTS.map((eventEntry) => (
                      <a
                        key={eventEntry.slug}
                        className={`events-switch-link ${selectedEvent.slug === eventEntry.slug ? 'active' : ''}`}
                        href={`/#/event/${eventEntry.slug}/${eventEntry.pages[0].slug}`}
                      >
                        {eventEntry.title}
                      </a>
                    ))}
                  </div>
                </div>
              </aside>

              {unknownPage && <p className="events-warning">{copy.events.unknownPage}</p>}
              {!unknownPage && selectedEvent.slug === 'warsztaty26' && resolvedPage ? (
                <WarsztatyEventContent pageSlug={resolvedPage.slug} />
              ) : null}
              {!unknownPage && selectedEvent.slug === 'kal26' && resolvedPage ? (
                <Kal26EventContent pageSlug={resolvedPage.slug} />
              ) : null}
            </section>
          )}
        </article>
      </main>

      <footer className="portal-footer cogita-footer events-footer">
        <a className="portal-brand portal-footer-brand" href="/#/">
          <img src="/logo_inv.svg" alt="Recreatio" />
        </a>
        <span>{copy.footer.headline}</span>
        <a className="ghost events-footer-home" href="/#/section-1" onClick={() => onNavigate('home')}>
          {copy.nav.home}
        </a>
      </footer>
    </div>
  );
}
