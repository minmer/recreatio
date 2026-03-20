import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LanguageSelect } from '../../components/LanguageSelect';
import { AuthAction } from '../../components/AuthAction';
import type { EventDefinition, EventInnerPage, SharedEventPageProps } from './eventTypes';
import { WarsztatyEventPage } from './WarsztatyEventPage';
import { Kal26EventPage } from './Kal26EventPage';
import { Edk26EventPage } from './Edk26EventPage';
import '../../styles/events.css';

const EVENTS: EventDefinition[] = [
  {
    slug: 'edk26',
    title: 'EDK 2026',
    summary: 'Nocna droga w małej wspólnocie: Kraków → Dobczyce.',
    date: '27/28.03.2026',
    location: 'Kraków - Dobczyce',
    pages: [{ slug: 'start', title: 'Start' }]
  },
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
      { slug: 'registered', title: 'Registered' },
      { slug: 'contributors', title: 'Contributors' },
      { slug: 'uczestnik', title: 'Strefa uczestnika' },
      { slug: 'organizator', title: 'Panel organizatora' }
    ]
  }
];

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
  contact: 'kontakt'
};

type EventPageRendererProps = SharedEventPageProps & { event: EventDefinition; page: EventInnerPage };

const EVENT_PAGE_RENDERERS: Record<
  EventDefinition['slug'],
  (props: EventPageRendererProps) => JSX.Element
> = {
  warsztaty26: WarsztatyEventPage,
  kal26: Kal26EventPage,
  edk26: Edk26EventPage
};

export function EventsPage(props: SharedEventPageProps) {
  const { copy } = props;
  const navigate = useNavigate();
  const location = useLocation();
  const segments = useMemo(() => location.pathname.split('/').filter(Boolean), [location.pathname]);
  const routeRoot = segments[0] ?? 'event';
  const selectedEventSlug = segments[1] ?? null;
  const selectedPageSlugRaw = routeRoot === 'event' ? segments[2] ?? null : null;

  const selectedEvent = selectedEventSlug ? EVENTS.find((entry) => entry.slug === selectedEventSlug) ?? null : null;
  const selectedPageSlug =
    selectedEvent?.slug === 'kal26'
      ? (KAL26_ROUTE_ALIASES[selectedPageSlugRaw ?? ''] ?? selectedPageSlugRaw)
      : selectedPageSlugRaw;
  const defaultPage = selectedEvent?.pages[0] ?? null;
  const isDirectEdkRoute = routeRoot === 'event' && selectedEvent?.slug === 'edk26' && !selectedPageSlugRaw;
  const selectedInnerPage =
    selectedEvent && selectedPageSlug
      ? selectedEvent.pages.find((eventPage) => eventPage.slug === selectedPageSlug) ?? null
      : defaultPage;

  useEffect(() => {
    if (isDirectEdkRoute) return;
    if (!selectedEvent || selectedPageSlug) return;
    const firstPage = selectedEvent.pages[0];
    if (!firstPage) return;
    navigate(`/event/${selectedEvent.slug}/${firstPage.slug}`, { replace: true });
  }, [isDirectEdkRoute, navigate, selectedEvent, selectedPageSlug]);

  if (selectedEvent?.slug === 'edk26' && routeRoot === 'event') {
    const EventPageRenderer = EVENT_PAGE_RENDERERS.edk26;
    const fallbackPage = selectedEvent.pages[0] ?? { slug: 'start', title: 'Start' };
    return <EventPageRenderer {...props} event={selectedEvent} page={fallbackPage} />;
  }

  if (selectedEvent && selectedInnerPage) {
    const EventPageRenderer = EVENT_PAGE_RENDERERS[selectedEvent.slug];
    return <EventPageRenderer {...props} event={selectedEvent} page={selectedInnerPage} />;
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
                const eventHref =
                  eventEntry.slug === 'edk26'
                    ? '/#/event/edk26'
                    : `/#/event/${eventEntry.slug}/${firstPage.slug}`;
                return (
                  <article key={eventEntry.slug} className={`events-card events-card--${eventEntry.slug}`}>
                    <h3>{eventEntry.title}</h3>
                    <p>{eventEntry.summary}</p>
                    <dl>
                      <div>
                        <dt>Data</dt>
                        <dd>{eventEntry.date}</dd>
                      </div>
                      <div>
                        <dt>Miejsce</dt>
                        <dd>{eventEntry.location}</dd>
                      </div>
                    </dl>
                    <a className="cta" href={eventHref}>
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
