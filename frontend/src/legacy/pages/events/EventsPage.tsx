import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LanguageSelect } from '../../components/LanguageSelect';
import { AuthAction } from '../../components/AuthAction';
import type { EventDefinition, EventInnerPage, SharedEventPageProps } from './eventTypes';
import { WarsztatyEventPage } from './legacy/warsztaty26/WarsztatyEventPage';
import { Kal26EventPage } from './legacy/kal26/Kal26EventPage';
import { Edk26EventPage } from './legacy/edk26/Edk26EventPage';
import { LimanowaEventPage } from './legacy/limanowa/LimanowaEventPage';
import { TheaterProjectEventPage } from './legacy/teatr26/TheaterProjectEventPage';
import { FormularzeEventPage } from './legacy/formularze/FormularzeEventPage';
import { Rowerowa26EventPage } from './legacy/rowerowa26/Rowerowa26EventPage';
import { EventRouter } from './EventRouter';
import { EventsCatalogue } from './EventsCatalogue';
import '../../styles/events.css';

const EVENTS: EventDefinition[] = [
  {
    slug: 'formularze',
    title: 'Formularze',
    summary: 'Twórz formularze z pytaniami i zbieraj odpowiedzi od uczestników przez link.',
    date: '',
    location: '',
    pages: [{ slug: 'admin', title: 'Panel' }]
  },
  {
    slug: 'limanowa',
    title: 'Gra o wolność',
    summary: 'Limanowa 2026: historia, przygoda, formacja i zapisy grupowe.',
    date: '19–21.06.2026',
    location: 'Limanowa',
    category: 'Gra terenowa',
    audience: 'Młodzież i grupy parafialne',
    places: ['Limanowa'],
    startDate: '2026-06-19',
    endDate: '2026-06-21',
    pages: [
      { slug: 'start', title: 'Start' },
      { slug: 'admin', title: 'Panel główny' },
      { slug: 'group-admin', title: 'Panel grupy' },
      { slug: 'participant', title: 'Panel uczestnika' }
    ]
  },
  {
    slug: 'edk26',
    title: 'EDK 2026',
    summary: 'Nocna droga w małej wspólnocie: Kraków → Dobczyce.',
    date: '27/28.03.2026',
    location: 'Kraków - Dobczyce',
    category: 'Ekstremalna Droga Krzyżowa',
    audience: 'Dorośli i młodzież',
    places: ['Kraków', 'Dobczyce'],
    startDate: '2026-03-27',
    endDate: '2026-03-28',
    pages: [{ slug: 'start', title: 'Start' }]
  },
  {
    slug: 'warsztaty26',
    title: 'Warsztaty Muzyki Liturgicznej 2026',
    summary: 'Warsztaty liturgiczne SATB: praca nad repertuarem wielkopostnym i eucharystycznym.',
    date: '28.02.2026-01.03.2026',
    location: 'Krakow',
    category: 'Warsztaty muzyczne',
    audience: 'Śpiewacy SATB, schole i chóry',
    places: ['Kraków'],
    startDate: '2026-02-28',
    endDate: '2026-03-01',
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
    category: 'Pielgrzymka piesza',
    audience: 'Wszyscy chętni',
    places: ['Kraków', 'Kalwaria Zebrzydowska'],
    startDate: '2026-04-17',
    endDate: '2026-04-18',
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
      { slug: 'registered', title: 'Registered' },
      { slug: 'contributors', title: 'Contributors' },
      { slug: 'uczestnik', title: 'Strefa uczestnika' },
      { slug: 'organizator', title: 'Panel organizatora' }
    ]
  },
  {
    slug: 'teatr26',
    title: 'Teatr Drogi 2026',
    summary: 'Nowy projekt teatralny: proces twórczy, zespoły produkcyjne i finałowy spektakl.',
    date: '10.10.2026-30.05.2027',
    location: 'Kraków',
    category: 'Projekt teatralny',
    audience: 'Młodzież i dorośli',
    places: ['Kraków'],
    startDate: '2026-10-10',
    endDate: '2027-05-30',
    pages: [{ slug: 'start', title: 'Start' }]
  },
  {
    slug: 'rowerowa26',
    title: 'Rowerowa Częstochowa 2026',
    summary: 'Dwudniowa pielgrzymka rowerowa z Krakowa do Częstochowy z noclegiem w Domaniewicach.',
    date: '28-29.08.2026',
    location: 'Kraków - Częstochowa',
    category: 'Pielgrzymka rowerowa',
    audience: 'Osoby gotowe na dwa dni jazdy — łącznie ponad 130 km',
    places: ['Kraków', 'Domaniewice', 'Częstochowa'],
    startDate: '2026-08-28',
    endDate: '2026-08-29',
    pages: [{ slug: 'start', title: 'Start' }]
  }
];

/** Everything still served by the hand-coded pages, listed under /event_old. */
const CATALOGUE_EVENTS = EVENTS;

const KAL26_ROUTE_ALIASES: Record<string, string> = {
  // Information
  informacje: 'niezbednik',
  information: 'niezbednik',
  informationen: 'niezbednik',
  // Plan
  plan: 'program',
  // Register
  zapisy: 'zapisy',
  register: 'zapisy',
  anmeldung: 'zapisy',
  // FAQ
  faq: 'faq',
  // History
  historia: 'o-pielgrzymce',
  history: 'o-pielgrzymce',
  geschichte: 'o-pielgrzymce',
  // Gallery
  galeria: 'galeria',
  gallery: 'galeria',
  galerie: 'galeria',
  // Contact
  kontakt: 'kontakt',
  contact: 'kontakt',
  // Organizer (admin only menu link)
  organizator: 'organizator',
  organizer: 'organizator',
  organisator: 'organizator'
};

type EventPageRendererProps = SharedEventPageProps & { event: EventDefinition; page: EventInnerPage };

const EVENT_PAGE_RENDERERS: Record<
  EventDefinition['slug'],
  (props: EventPageRendererProps) => JSX.Element
> = {
  warsztaty26: WarsztatyEventPage,
  kal26: Kal26EventPage,
  edk26: Edk26EventPage,
  limanowa: LimanowaEventPage,
  teatr26: TheaterProjectEventPage,
  formularze: FormularzeEventPage,
  rowerowa26: Rowerowa26EventPage
};

/**
 * Segments after /event that address the builder rather than an event. No
 * event site may take one of these as its slug; the API rejects them too.
 */
const RESERVED_EVENT_SLUGS = new Set(['admin', 'link']);

export function EventsPage(props: SharedEventPageProps) {
  const { copy } = props;
  const navigate = useNavigate();
  const location = useLocation();
  const segments = useMemo(() => location.pathname.split('/').filter(Boolean), [location.pathname]);

  const routeRoot = segments[0] ?? 'event';
  const isLegacyRoute = routeRoot === 'event_old';

  // ── /event: composable events ───────────────────────────────────────────
  const firstSegment = segments[1] ?? null;

  // ── /event_old: the hand-coded pages, kept reachable while they are phased
  // out. The formularze tool still lives here permanently.
  const legacyEvent = isLegacyRoute && firstSegment
    ? EVENTS.find((entry) => entry.slug === firstSegment) ?? null
    : null;
  const legacyPageSlugRaw = isLegacyRoute ? segments[2] ?? null : null;
  const legacyPageSlug =
    legacyEvent?.slug === 'kal26'
      ? (KAL26_ROUTE_ALIASES[legacyPageSlugRaw ?? ''] ?? legacyPageSlugRaw)
      : legacyPageSlugRaw;
  const isDirectEdkRoute = legacyEvent?.slug === 'edk26' && !legacyPageSlugRaw;
  const legacyInnerPage =
    legacyEvent && legacyPageSlug
      ? legacyEvent.pages.find((eventPage) => eventPage.slug === legacyPageSlug) ?? null
      : (legacyEvent?.pages[0] ?? null);

  useEffect(() => {
    if (!isLegacyRoute || isDirectEdkRoute) return;
    if (!legacyEvent || legacyPageSlug) return;
    const firstPage = legacyEvent.pages[0];
    if (!firstPage) return;
    navigate(`/event_old/${legacyEvent.slug}/${firstPage.slug}`, { replace: true });
  }, [isDirectEdkRoute, isLegacyRoute, legacyEvent, legacyPageSlug, navigate]);

  if (!isLegacyRoute && firstSegment) {
    if (firstSegment === 'admin') {
      return <EventRouter mode="admin" argument={segments[2] ?? null} />;
    }
    if (firstSegment === 'link') {
      return (
        <EventRouter
          mode="link"
          argument={segments[2] ?? null}
          page={segments[3] ?? null}
          part={segments[4] ?? null}
        />
      );
    }
    if (!RESERVED_EVENT_SLUGS.has(firstSegment)) {
      return <EventRouter mode="site" argument={firstSegment} part={segments[2] ?? null} />;
    }
  }

  if (isLegacyRoute && legacyEvent) {
    const EventPageRenderer = EVENT_PAGE_RENDERERS[legacyEvent.slug];
    if (isDirectEdkRoute) {
      const fallbackPage = legacyEvent.pages[0] ?? { slug: 'start', title: 'Start' };
      return <EventPageRenderer {...props} event={legacyEvent} page={fallbackPage} />;
    }
    if (legacyInnerPage) {
      return <EventPageRenderer {...props} event={legacyEvent} page={legacyInnerPage} />;
    }
  }

  return (
    <div className="portal-page events">
      <main className="events-main">
        <article className="events-shell-card">
          <div className="events-card-head">
            <div className="events-card-nav">
              <a className="ghost" href="/#/section-1">{copy.nav.home}</a>
              {/* The organizer's two ways in, kept in the chrome so the list
                  itself stays about the events. */}
              {isLegacyRoute ? (
                <a className="ghost" href="/#/event">
                  ← Aktualne wydarzenia
                </a>
              ) : props.showProfileMenu ? (
                <>
                  <a className="ghost" href="/#/event_old">
                    Poprzednie wydarzenia
                  </a>
                  <a className="cta events-create" href="/#/event/admin">
                    + Nowe wydarzenie
                  </a>
                </>
              ) : null}
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

          {/* Title only: the search and filters follow immediately, and the
              events themselves carry the rest. */}
          <section className="events-hero">
            <p className="tag">REcreatio</p>
            <h1>{isLegacyRoute ? 'Poprzednie wydarzenia' : copy.events.title}</h1>
            {isLegacyRoute ? (
              <p>Strony w starym mechanizmie. Zostają dostępne, dopóki trwa przenoszenie treści do kreatora.</p>
            ) : null}
          </section>

          <section className="events-chooser">
            {isLegacyRoute ? (
              <ul className="events-legacy-list">
                {CATALOGUE_EVENTS.map((entry) => (
                  <li key={entry.slug}>
                    <a href={`/#/event_old/${entry.slug}/${entry.pages[0].slug}`}>
                      <strong>{entry.title}</strong>
                      <span>{entry.summary}</span>
                      {entry.date || entry.location ? (
                        <em>{[entry.date, entry.location].filter(Boolean).join(' · ')}</em>
                      ) : null}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <EventsCatalogue legacyEvents={[]} />
            )}
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
