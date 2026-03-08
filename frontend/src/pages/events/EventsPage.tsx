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
  body: string[];
};

type EventDefinition = {
  slug: string;
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
    summary: 'Warsztaty formacyjne dla schol, organistow i osob odpowiedzialnych za oprawe muzyczna liturgii.',
    date: '24-27 September 2026',
    location: 'Krakow',
    pages: [
      {
        slug: 'overview',
        title: 'Opis',
        body: [
          'Warsztaty obejmuja emisje glosu, prace z psalmem i przygotowanie oprawy mszy swietej.',
          'Kazdy dzien laczy probe wspolnego spiewu z blokiem formacyjnym i konsultacjami.'
        ]
      },
      {
        slug: 'program',
        title: 'Program',
        body: [
          'Czwartek-piatek: warsztaty sekcyjne i przygotowanie repertuaru.',
          'Sobota-niedziela: proby laczone i liturgia finalowa.'
        ]
      },
      {
        slug: 'organizacja',
        title: 'Organizacja',
        body: [
          'Uczestnicy otrzymuja materialy nutowe i harmonogram zajec przed rozpoczeciem wydarzenia.',
          'Zapisy prowadzone sa online do wyczerpania miejsc.'
        ]
      }
    ]
  },
  {
    slug: 'kal26',
    title: '5. piesza pielgrzymka z Krakowa do Kalwarii Zebrzydowskiej',
    summary: 'Wspolna pielgrzymka piesza z codzienna modlitwa, konferencjami i liturgia w drodze.',
    date: '1-3 May 2026',
    location: 'Krakow - Kalwaria Zebrzydowska',
    pages: [
      {
        slug: 'overview',
        title: 'Opis',
        body: [
          'Pielgrzymka prowadzona jest etapami z punktami modlitwy i postojami organizacyjnymi.',
          'Kazdy uczestnik otrzymuje pakiet pielgrzyma z trasa, kontaktami i zasadami bezpieczenstwa.'
        ]
      },
      {
        slug: 'trasa',
        title: 'Trasa',
        body: [
          'Dzien 1: wyjscie z Krakowa i etap do punktu noclegowego.',
          'Dzien 2-3: dalsza droga zakonczona wejsciem do Kalwarii Zebrzydowskiej.'
        ]
      },
      {
        slug: 'uczestnictwo',
        title: 'Uczestnictwo',
        body: [
          'Zapisy odbywaja sie przez formularz wydarzenia oraz punkt parafialny.',
          'Wymagane jest potwierdzenie regulaminu i danych kontaktowych.'
        ]
      }
    ]
  },
  {
    slug: 'holy-week-mission-2026',
    title: 'Holy Week Mission 2026',
    summary: 'A week of liturgy, talks, and evening prayer for families and youth.',
    date: 'March 29 - April 4, 2026',
    location: 'St. Michael Parish Campus',
    pages: [
      {
        slug: 'overview',
        title: 'Overview',
        body: [
          'This mission week focuses on reflection, service, and preparation for Easter.',
          'Each evening includes guided prayer, a keynote, and open discussion circles.'
        ]
      },
      {
        slug: 'schedule',
        title: 'Schedule',
        body: [
          'Mon-Fri: 18:00 evening mass, 19:00 keynote, 20:00 group sessions.',
          'Saturday: 10:00 family workshop, 17:00 vigil rehearsal.'
        ]
      },
      {
        slug: 'practical-info',
        title: 'Practical Information',
        body: [
          'Registration is free and open to all parish members and guests.',
          'Parking is available near the parish hall; child care starts at 17:45 each evening.'
        ]
      }
    ]
  },
  {
    slug: 'summer-youth-camp-2026',
    title: 'Summer Youth Camp 2026',
    summary: 'Workshops, outdoor activities, and community projects for teenagers.',
    date: 'July 6 - July 12, 2026',
    location: 'Retreat House Zielone Wzgorza',
    pages: [
      {
        slug: 'overview',
        title: 'Overview',
        body: [
          'The camp combines formation, sport, and practical service projects.',
          'Participants are grouped into teams with dedicated mentors.'
        ]
      },
      {
        slug: 'program',
        title: 'Program',
        body: [
          'Morning block: formation sessions and reflection circles.',
          'Afternoon block: outdoor challenges, music, and volunteer projects.'
        ]
      },
      {
        slug: 'parents',
        title: 'For Parents',
        body: [
          'Arrival and pickup windows are listed in the registration packet.',
          'Emergency contact lines remain active 24/7 during the camp week.'
        ]
      }
    ]
  },
  {
    slug: 'advent-charity-forum-2026',
    title: 'Advent Charity Forum 2026',
    summary: 'An event focused on local outreach, volunteering, and support programs.',
    date: 'December 5 - December 6, 2026',
    location: 'Recreatio Community Hall',
    pages: [
      {
        slug: 'overview',
        title: 'Overview',
        body: [
          'The forum connects volunteers, parish teams, and local organizations.',
          'The main goal is to map urgent support needs before Christmas.'
        ]
      },
      {
        slug: 'sessions',
        title: 'Sessions',
        body: [
          'Day 1: regional needs review, funding panel, volunteer onboarding.',
          'Day 2: implementation workshops and team planning.'
        ]
      },
      {
        slug: 'join',
        title: 'How to Join',
        body: [
          'You can register as a participant, volunteer coordinator, or donor liaison.',
          'Teams receive starter templates and a follow-up planning checklist.'
        ]
      }
    ]
  }
];

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

  const openEventPage = (eventSlug: string, pageSlug: string) => {
    navigate(`/event/${eventSlug}/${pageSlug}`);
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
      return;
    }
    onNavigate('home');
  };

  return (
    <div className="portal-page events">
      <header className="portal-header events-header">
        <div className="portal-header-left">
          <button type="button" className="ghost portal-back" onClick={handleBack}>
            {copy.nav.home}
          </button>
          <button
            type="button"
            className="ghost events-up"
            onClick={() => {
              navigate('/event');
            }}
          >
            {copy.events.backToEvents}
          </button>
          <button
            type="button"
            className="portal-brand events-brand"
            onClick={() => {
              navigate('/event');
            }}
          >
            <img src="/logo_new.svg" alt={copy.events.title} />
          </button>
        </div>
        <div className="events-header-actions">
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

      <main className="events-main">
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
                  <article key={eventEntry.slug} className="events-card">
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
                    <button type="button" className="cta" onClick={() => openEventPage(eventEntry.slug, firstPage.slug)}>
                      {copy.events.openEvent}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="events-detail">
            <aside className="events-sidebar">
              <h2>{selectedEvent.title}</h2>
              <p className="events-meta">{selectedEvent.date}</p>
              <p className="events-meta">{selectedEvent.location}</p>

              <div className="events-side-group">
                <h3>{copy.events.pagesLabel}</h3>
                <div className="events-page-links">
                  {selectedEvent.pages.map((page) => (
                    <button
                      key={page.slug}
                      type="button"
                      className={`events-page-link ${resolvedPage?.slug === page.slug ? 'active' : ''}`}
                      onClick={() => openEventPage(selectedEvent.slug, page.slug)}
                    >
                      {page.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="events-side-group">
                <h3>{copy.events.chooserTitle}</h3>
                <div className="events-switch-links">
                  {EVENTS.map((eventEntry) => (
                    <button
                      key={eventEntry.slug}
                      type="button"
                      className={`events-switch-link ${selectedEvent.slug === eventEntry.slug ? 'active' : ''}`}
                      onClick={() => openEventPage(eventEntry.slug, eventEntry.pages[0].slug)}
                    >
                      {eventEntry.title}
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            <article className="events-content-card">
              {unknownPage && <p className="events-warning">{copy.events.unknownPage}</p>}
              <h2>{resolvedPage?.title}</h2>
              {resolvedPage?.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </article>
          </section>
        )}
      </main>

      <footer className="portal-footer events-footer">
        <a className="portal-brand portal-footer-brand" href="/#/">
          <img src="/logo_new.svg" alt="Recreatio" />
        </a>
        <span>{copy.footer.headline}</span>
      </footer>
    </div>
  );
}
