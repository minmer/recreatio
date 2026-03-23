import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ApiError,
  bootstrapEdk26Event,
  createEdkRegistration,
  exportEdkRegistrations,
  getEdkOrganizerDashboard,
  getEdkSite,
  type EdkOrganizerDashboard,
  type EdkRoutePoint,
  type EdkSite
} from '../../lib/api';
import { normalizePolishPhone } from '../../lib/phone';
import type { EventDefinition, EventInnerPage, SharedEventPageProps } from './eventTypes';

type ParticipantStatusValue =
  | 'adult'
  | 'minor_with_guardian'
  | 'adult_guardian_for_minor';

type RegistrationFormState = {
  fullName: string;
  phone: string;
  participantStatus: ParticipantStatusValue;
  additionalInfo: string;
};

const EDK26_SLUG = 'edk26';

const PARTICIPANT_STATUS_OPTIONS: Array<{ value: ParticipantStatusValue; label: string }> = [
  { value: 'adult', label: 'Osoba pełnoletnia' },
  { value: 'minor_with_guardian', label: 'Osoba niepełnoletnia z opiekunem' },
  {
    value: 'adult_guardian_for_minor',
    label: 'Osoba pełnoletnia odpowiedzialna za osobę niepełnoletnią'
  }
];

const PARTICIPANT_STATUS_LABELS: Record<ParticipantStatusValue, string> = {
  adult: 'Osoba pełnoletnia',
  minor_with_guardian: 'Osoba niepełnoletnia z opiekunem',
  adult_guardian_for_minor: 'Osoba małoletnia bez opiekuna'
};

const DEFAULT_FORM: RegistrationFormState = {
  fullName: '',
  phone: '',
  participantStatus: 'adult',
  additionalInfo: ''
};

const NAV_ITEMS = [
  { id: 'o-wydarzeniu', label: 'O wydarzeniu' },
  { id: 'jak-idziemy', label: 'Jak idziemy' },
  { id: 'plan-i-logistyka', label: 'Plan i logistyka' },
  { id: 'prowadzacy', label: 'Prowadzący' },
  { id: 'trasa', label: 'Trasa' },
  { id: 'wazne-informacje', label: 'Ważne informacje' },
  { id: 'faq', label: 'FAQ' },
  { id: 'zapisy', label: 'Zapisy' },
  { id: 'kontakt', label: 'Kontakt' }
] as const;

const ROUTE_POINT_TYPES = new Set<EdkRoutePoint['type']>(['start', 'station', 'finish', 'distance']);

function normalizeRouteType(value: string | undefined, fallback: EdkRoutePoint['type']): EdkRoutePoint['type'] {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  return ROUTE_POINT_TYPES.has(normalized as EdkRoutePoint['type'])
    ? (normalized as EdkRoutePoint['type'])
    : fallback;
}

function isMissingRouteUrl(value: string): boolean {
  const normalized = value.trim();
  return normalized.length === 0 || normalized === '[link / do uzupełnienia]';
}

function isMissingDistanceValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length === 0
    || normalized === '[x km]'
    || normalized === 'x km'
    || normalized === '[xkm]'
  );
}

function mergeRoutePointsWithDefaults(
  configuredRoutePoints: EdkRoutePoint[] | null | undefined,
  defaultRoutePoints: EdkRoutePoint[]
): EdkRoutePoint[] {
  if (!configuredRoutePoints || configuredRoutePoints.length === 0) {
    return defaultRoutePoints;
  }

  const length = Math.max(configuredRoutePoints.length, defaultRoutePoints.length);
  const merged: EdkRoutePoint[] = [];
  for (let index = 0; index < length; index += 1) {
    const configured = configuredRoutePoints[index];
    const fallback = defaultRoutePoints[index];
    if (!configured && !fallback) {
      continue;
    }

    const type = normalizeRouteType(configured?.type, fallback?.type ?? 'station');
    const title = configured?.title_pl?.trim() || fallback?.title_pl || '';
    const url = configured ? configured.url : '';
    const distanceKm = configured ? configured.distance_km : '';

    const resolvedUrl = isMissingRouteUrl(url) ? (fallback?.url ?? '') : url.trim();
    const resolvedDistanceKm = type === 'distance' && isMissingDistanceValue(distanceKm)
      ? (fallback?.distance_km ?? '')
      : distanceKm.trim();

    merged.push({
      type,
      title_pl: title,
      url: resolvedUrl,
      distance_km: resolvedDistanceKm
    });
  }

  return merged;
}

const EDK26_ROUTE_STRUCTURE: EdkRoutePoint[] = [
  { type: 'start', title_pl: 'Punkt startowy', url: 'https://maps.app.goo.gl/JbKuRvUNriWWKGJH7', distance_km: '' },
  { type: 'distance', title_pl: '+ odległość do kolejnego punktu', url: '', distance_km: '2,1 km' },
  { type: 'station', title_pl: 'Stacja I — Jezus na śmierć skazany', url: 'https://maps.app.goo.gl/P2Jv3Up112DMAy5PA', distance_km: '' },
  { type: 'distance', title_pl: '+ odległość do kolejnego punktu', url: '', distance_km: '2,3 km' },
  { type: 'station', title_pl: 'Stacja II — Jezus bierze krzyż na swoje ramiona', url: 'https://maps.app.goo.gl/xjWWJFudVoewKQSj6', distance_km: '' },
  { type: 'distance', title_pl: '+ odległość do kolejnego punktu', url: '', distance_km: '3,2 km' },
  { type: 'station', title_pl: 'Stacja III — Jezus upada po raz pierwszy', url: 'https://maps.app.goo.gl/By6JyayGQByDXHvV7', distance_km: '' },
  { type: 'distance', title_pl: '+ odległość do kolejnego punktu', url: '', distance_km: '1,6 km' },
  { type: 'station', title_pl: 'Stacja IV — Jezus spotyka swoją Matkę', url: 'https://maps.app.goo.gl/dwfAeLRieQGjZ5eQA', distance_km: '' },
  { type: 'distance', title_pl: '+ odległość do kolejnego punktu', url: '', distance_km: '2,5 km' },
  {
    type: 'station',
    title_pl: 'Stacja V — Szymon z Cyreny pomaga nieść krzyż Jezusowi',
    url: 'https://maps.app.goo.gl/eBYb9tSkFLzucwGy8',
    distance_km: ''
  },
  { type: 'distance', title_pl: '+ odległość do kolejnego punktu', url: '', distance_km: '2,8 km' },
  { type: 'station', title_pl: 'Stacja VI — Weronika ociera twarz Jezusowi', url: 'https://maps.app.goo.gl/T8rbSyY2MLTV77949', distance_km: '' },
  { type: 'distance', title_pl: '+ odległość do kolejnego punktu', url: '', distance_km: '3,5 km' },
  { type: 'station', title_pl: 'Stacja VII — Jezus upada po raz drugi', url: 'https://maps.app.goo.gl/Mq534arWZD8S8hkc6', distance_km: '' },
  { type: 'distance', title_pl: '+ odległość do kolejnego punktu', url: '', distance_km: '2,2 km' },
  {
    type: 'station',
    title_pl: 'Stacja VIII — Jezus pociesza płaczące niewiasty',
    url: 'https://maps.app.goo.gl/x4zEUUuRxa1BqJBM7',
    distance_km: ''
  },
  { type: 'distance', title_pl: '+ odległość do kolejnego punktu', url: '', distance_km: '2,6 km' },
  { type: 'station', title_pl: 'Stacja IX — Jezus upada po raz trzeci', url: 'https://maps.app.goo.gl/op9yy4LwFrFBigq68', distance_km: '' },
  { type: 'distance', title_pl: '+ odległość do kolejnego punktu', url: '', distance_km: '1,7 km' },
  { type: 'station', title_pl: 'Stacja X — Jezus z szat obnażony', url: 'https://maps.app.goo.gl/9PS81EWU4AJ7D9CW7', distance_km: '' },
  { type: 'distance', title_pl: '+ odległość do kolejnego punktu', url: '', distance_km: '2,2 km' },
  { type: 'station', title_pl: 'Stacja XI — Jezus przybity do krzyża', url: 'https://maps.app.goo.gl/inh6p8ypkRQXYpzGA', distance_km: '' },
  { type: 'distance', title_pl: '+ odległość do kolejnego punktu', url: '', distance_km: '2,7 km' },
  { type: 'station', title_pl: 'Stacja XII — Jezus umiera na krzyżu', url: 'https://maps.app.goo.gl/Nbr1DKH7E9ioENvU7', distance_km: '' },
  { type: 'distance', title_pl: '+ odległość do kolejnego punktu', url: '', distance_km: '1,9 km' },
  { type: 'station', title_pl: 'Stacja XIII — Jezus zdjęty z krzyża', url: 'https://maps.app.goo.gl/rapW9iQ6TBzdXirW9', distance_km: '' },
  { type: 'distance', title_pl: '+ odległość do kolejnego punktu', url: '', distance_km: '1,5 km' },
  { type: 'station', title_pl: 'Stacja XIV — Jezus złożony do grobu', url: 'https://maps.app.goo.gl/o17uTobMpE3fHyEh8', distance_km: '' },
  { type: 'distance', title_pl: '+ odległość do mety', url: '', distance_km: '0,6 km' },
  { type: 'finish', title_pl: 'Punkt końcowy', url: 'https://maps.app.goo.gl/Ram1tdB3hcbY1D5Y8', distance_km: '' }
];

const FAQ_ITEMS: Array<{ question: string; answer: string }> = [
  {
    question: 'Czy to wydarzenie jest dla każdego?',
    answer:
      'To propozycja dla osób gotowych na nocną drogę, wysiłek i skupienie. Nie trzeba mieć „wyników sportowych”, ale trzeba podejść do tej drogi dojrzale i odpowiedzialnie.'
  },
  {
    question: 'Czy idziemy w ciszy?',
    answer:
      'Tak. Między stacjami chcemy zachować ciszę i ograniczyć rozmowy do minimum. Na stacjach zatrzymujemy się wspólnie na rozważanie i modlitwę.'
  },
  {
    question: 'Od czego zaczynamy?',
    answer:
      'Spotykamy się w piątek 27 marca 2026. EDK rozpoczynamy Mszą Świętą o godzinie 18:30 w kościele parafii św. Jana na Prądniku w Krakowie, a po niej wyruszamy na trasę.'
  },
  {
    question: 'Czy organizowany jest powrót?',
    answer:
      'Tak. Po zakończeniu drogi organizujemy powrót w sobotę rano, około godziny 8:00. Szczegóły przekażemy uczestnikom po zapisach.'
  },
  {
    question: 'Czy osoby niepełnoletnie mogą wziąć udział?',
    answer:
      'Tak. Osoby niepełnoletnie mogą wziąć udział, jeśli idą pod opieką wskazanej osoby pełnoletniej, która bierze za nie odpowiedzialność organizacyjną podczas wydarzenia.'
  },
  {
    question: 'Nie mam wskazanego opiekuna. Co wtedy?',
    answer:
      'Skontaktuj się z ks. Michałem Mleczkiem przed zapisaniem. W razie potrzeby pomożemy znaleźć osobę pełnoletnią, która podejmie się opieki organizacyjnej.'
  },
  {
    question: 'Czy potrzebna jest pisemna zgoda rodziców?',
    answer: 'Nie. W ramach zasad organizacyjnych tego wyjścia nie wymagamy pisemnej zgody rodziców.'
  },
  {
    question: 'Czy trzeba zapisać się wcześniej?',
    answer:
      'Tak, prosimy o wcześniejsze zapisy. Pomaga nam to zadbać o organizację, bezpieczeństwo i kameralny charakter grupy.'
  },
  {
    question: 'Czy po zapisaniu dostanę więcej informacji?',
    answer:
      'Tak. Po zapisach przekażemy szczegóły organizacyjne dotyczące przygotowania, startu, przebiegu drogi oraz powrotu.'
  }
];

function mapParticipantStatusLabel(value: string): string {
  if (value === 'minor_with_guardian') {
    return PARTICIPANT_STATUS_LABELS.minor_with_guardian;
  }
  if (value === 'adult_guardian_for_minor') {
    return PARTICIPANT_STATUS_LABELS.adult_guardian_for_minor;
  }
  if (value === 'adult') {
    return PARTICIPANT_STATUS_LABELS.adult;
  }
  return value;
}

export function Edk26EventPage({
  showProfileMenu,
  onAuthAction,
  onProfileNavigate,
  onLogout,
  onNavigate
}: SharedEventPageProps & { page: EventInnerPage; event: EventDefinition }) {
  const [site, setSite] = useState<EdkSite | null>(null);
  const [siteLoading, setSiteLoading] = useState(true);
  const [siteError, setSiteError] = useState<string | null>(null);
  const [provisionPending, setProvisionPending] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<string>('o-wydarzeniu');

  const [registrationForm, setRegistrationForm] = useState<RegistrationFormState>(DEFAULT_FORM);
  const [registrationPending, setRegistrationPending] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState<string | null>(null);

  const [organizerDashboard, setOrganizerDashboard] = useState<EdkOrganizerDashboard | null>(null);
  const [organizerPending, setOrganizerPending] = useState(false);
  const [organizerError, setOrganizerError] = useState<string | null>(null);
  const [exportPending, setExportPending] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'EDK 2026 | REcreatio';

    const ensureMeta = (selector: string, attribute: 'name' | 'property', value: string, content: string) => {
      let element = document.head.querySelector<HTMLMetaElement>(selector);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, value);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    ensureMeta(
      'meta[name="description"]',
      'name',
      'description',
      'Kameralna EDK 2026 z Krakowa do Dobczyc. Msza Święta na rozpoczęcie, wspólna nocna droga, rozważania Drogi Krzyżowej, troska o siebie nawzajem i prowadzenie ks. Michała Mleczka.'
    );
    ensureMeta('meta[property="og:title"]', 'property', 'og:title', 'EDK 2026 | REcreatio');
    ensureMeta(
      'meta[property="og:description"]',
      'property',
      'og:description',
      'Nocna droga w małej wspólnocie. 27/28.03.2026, Kraków → Dobczyce.'
    );

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', '/#/event/edk26');
  }, []);

  useEffect(() => {
    let active = true;
    setSiteLoading(true);
    setSiteError(null);

    getEdkSite(EDK26_SLUG)
      .then((response) => {
        if (!active) return;
        setSite(response);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setSiteError(error instanceof Error ? error.message : 'Nie udało się pobrać konfiguracji wydarzenia.');
      })
      .finally(() => {
        if (!active) return;
        setSiteLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!showProfileMenu || !site?.id) {
      setOrganizerDashboard(null);
      return;
    }

    let active = true;
    setOrganizerPending(true);
    setOrganizerError(null);

    getEdkOrganizerDashboard(site.id)
      .then((response) => {
        if (!active) return;
        setOrganizerDashboard(response);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          setOrganizerError('Brak uprawnień do podglądu panelu zapisów.');
          return;
        }
        setOrganizerError(error instanceof Error ? error.message : 'Nie udało się pobrać listy uczestników.');
      })
      .finally(() => {
        if (!active) return;
        setOrganizerPending(false);
      });

    return () => {
      active = false;
    };
  }, [showProfileMenu, site?.id]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!mostVisible) return;
        setActiveSection(mostVisible.target.id);
      },
      { rootMargin: '-25% 0px -55% 0px', threshold: [0.1, 0.35, 0.6] }
    );

    NAV_ITEMS.forEach((item) => {
      const section = document.getElementById(item.id);
      if (section) {
        observer.observe(section);
      }
    });

    return () => observer.disconnect();
  }, []);

  const participantRows = useMemo(() => {
    return [...(organizerDashboard?.registrations ?? [])].sort((a, b) => {
      return new Date(b.createdUtc).getTime() - new Date(a.createdUtc).getTime();
    });
  }, [organizerDashboard]);

  const routeStructure = useMemo(() => {
    return mergeRoutePointsWithDefaults(site?.site.routePoints, EDK26_ROUTE_STRUCTURE);
  }, [site?.site.routePoints]);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async (eventForm: FormEvent) => {
    eventForm.preventDefault();
    setRegistrationError(null);
    setRegistrationSuccess(null);

    const fullName = registrationForm.fullName.trim();
    const phone = normalizePolishPhone(registrationForm.phone);
    if (!fullName || !phone) {
      setRegistrationError('Uzupełnij imię i nazwisko oraz poprawny numer telefonu (+48 i 9 cyfr).');
      return;
    }

    setRegistrationPending(true);
    try {
      await createEdkRegistration(EDK26_SLUG, {
        fullName,
        phone,
        participantStatus: registrationForm.participantStatus,
        additionalInfo: registrationForm.additionalInfo.trim() || null
      });

      try {
        const refreshedSite = await getEdkSite(EDK26_SLUG);
        setSite(refreshedSite);
      } catch {
        // Registration succeeded; site refresh is best-effort only.
      }

      setRegistrationForm(DEFAULT_FORM);
      setRegistrationSuccess(
        'Dziękujemy za zgłoszenie. Skontaktujemy się z Tobą w sprawach organizacyjnych dotyczących EDK 2026.'
      );
    } catch (error: unknown) {
      setRegistrationError(error instanceof Error ? error.message : 'Nie udało się wysłać zgłoszenia.');
    } finally {
      setRegistrationPending(false);
    }
  };

  const handleProvisionEdk = async () => {
    setProvisionPending(true);
    setProvisionError(null);
    try {
      const response = await bootstrapEdk26Event();
      setSite(response);
      setSiteError(null);
    } catch (error: unknown) {
      setProvisionError(error instanceof Error ? error.message : 'Nie udało się aktywować wydarzenia.');
    } finally {
      setProvisionPending(false);
    }
  };

  const handleExportRegistrations = async () => {
    if (!site?.id) {
      setExportError('Eksport jest dostępny dopiero po aktywacji wydarzenia.');
      return;
    }

    setExportPending(true);
    setExportError(null);
    try {
      const payload = await exportEdkRegistrations(site.id);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `edk26-registrations-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('Nie udało się wyeksportować listy zapisów.');
    } finally {
      setExportPending(false);
    }
  };

  return (
    <div className="event-page edk-page">
      <header className="edk-header">
        <div className="edk-header-main">
          <a
            className="edk-back-link"
            href="/#/event"
            onClick={() => {
              onNavigate('events');
            }}
          >
            Wydarzenia
          </a>
          <div className="edk-header-actions">
            {showProfileMenu ? (
              <>
                <button className="ghost" type="button" onClick={onProfileNavigate}>Konto</button>
                <button className="ghost" type="button" onClick={onLogout}>Wyloguj</button>
              </>
            ) : (
              <button className="ghost" type="button" onClick={onAuthAction}>Zaloguj</button>
            )}
          </div>
        </div>
        <nav className="edk-top-nav" aria-label="Nawigacja sekcji EDK 2026">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === activeSection ? 'active' : ''}
              onClick={() => scrollToSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="edk-main">
        <section className="edk-hero" aria-labelledby="edk-hero-title">
          <div className="edk-hero-media" />
          <div className="edk-hero-overlay">
            <p className="edk-hero-badge">27/28.03.2026 · Kraków → Dobczyce · prowadzi ks. Michał Mleczek</p>
            <h1 id="edk-hero-title">
              EDK 2026
              <span>Nocna droga w małej wspólnocie</span>
            </h1>
            <p>
              W nocy z 27 na 28 marca 2026 wyruszamy z Krakowa do Dobczyc. Zaczynamy Mszą Świętą o 18:30 w kościele
              parafii św. Jana na Prądniku, a następnie ruszamy w drogę jako mała grupa, dbając o siebie nawzajem i
              wspólnie rozważając stacje Drogi Krzyżowej.
            </p>
            <p>
              To będzie droga ciszy, modlitwy i uważności. Nie idziemy po wynik ani po wrażenia. Idziemy po spotkanie
              z Bogiem, z prawdą o sobie i z drugim człowiekiem, którego nie zostawiamy samego na trasie.
            </p>
            <div className="edk-hero-actions">
              <button className="cta" type="button" onClick={() => scrollToSection('zapisy')}>Zapisz się</button>
              <button className="ghost" type="button" onClick={() => scrollToSection('trasa')}>Zobacz trasę</button>
            </div>
            <small>Powrót organizujemy w sobotę rano, około godziny 8:00.</small>
          </div>
        </section>

        <section className="edk-section edk-reveal" id="o-wydarzeniu">
          <header>
            <h2>O wydarzeniu</h2>
            <p>Czym jest nasza EDK 2026</p>
          </header>
          <div className="edk-section-body">
            <p>
              EDK 2026 w naszej formule to nocna Droga Krzyżowa przeżywana w sposób kameralny i odpowiedzialny.
              Zachowujemy ducha tej drogi: prostotę, ciszę, wysiłek i modlitwę.
            </p>
            <p>
              Nie będzie to wyjście sportowe ani towarzyska nocna wyprawa. Nie chodzi o tempo, rekord, dystans ani
              pokaz własnej siły. Chodzi o drogę, która prowadzi przez ciemność, zmęczenie, milczenie i rozważanie męki
              Chrystusa.
            </p>
            <p>
              Idziemy w małej grupie, dbamy o siebie nawzajem i wspólnie zatrzymujemy się przy kolejnych stacjach
              Drogi Krzyżowej. To propozycja dla tych, którzy chcą wejść głębiej w Wielki Post.
            </p>
          </div>
        </section>

        <section className="edk-section edk-reveal" id="jak-idziemy">
          <header>
            <h2>Jak idziemy</h2>
            <p>
              Nasza grupa będzie mała nie przypadkiem. Kameralna forma pomaga zachować skupienie, odpowiedzialność i
              prawdziwą obecność.
            </p>
          </header>
          <div className="edk-card-grid">
            <article className="edk-card">
              <h3>Mała grupa</h3>
              <p>Idziemy razem, ale bez tłumu. Zależy nam na skupieniu, prostocie i realnym byciu ze sobą w drodze.</p>
            </article>
            <article className="edk-card">
              <h3>Dbamy o siebie nawzajem</h3>
              <p>
                Zwracamy uwagę na tempo, samopoczucie i bezpieczeństwo drugiej osoby. Nie zostawiamy nikogo samego w
                kryzysie.
              </p>
            </article>
            <article className="edk-card">
              <h3>Między stacjami wybieramy ciszę</h3>
              <p>
                Ograniczamy rozmowy do tego, co naprawdę potrzebne. Cisza jest częścią tej drogi, a nie dodatkiem.
              </p>
            </article>
            <article className="edk-card">
              <h3>Przy stacjach modlimy się wspólnie</h3>
              <p>
                Na kolejnych stacjach zatrzymujemy się razem, słuchamy rozważań i przeżywamy Drogę Krzyżową jako
                wspólnotę.
              </p>
            </article>
            <article className="edk-card">
              <h3>Szanujemy granice i rytm drogi</h3>
              <p>
                Nie rywalizujemy, nie poganiamy i nie robimy z tej nocy próby charakteru dla samej próby. Idziemy
                uczciwie i dojrzale.
              </p>
            </article>
            <article className="edk-card">
              <h3>To droga duchowa, nie wydarzenie sportowe</h3>
              <p>Wysiłek jest ważny, ale nie jest celem. Ma służyć modlitwie, prawdzie i wewnętrznemu poruszeniu.</p>
            </article>
          </div>
        </section>

        <section className="edk-section edk-reveal" id="plan-i-logistyka">
          <header>
            <h2>Plan i logistyka</h2>
            <p>
              Chcemy, aby ta droga była przeżyta spokojnie, odpowiedzialnie i bez chaosu. Dlatego od początku jasno
              pokazujemy plan wydarzenia.
            </p>
          </header>
          <div className="edk-plan-layout">
            <div className="edk-timeline">
              <article className="edk-step-card">
                <h3>1. Rozpoczęcie</h3>
                <p>
                  Spotykamy się w piątek 27 marca 2026. EDK rozpoczynamy Mszą Świętą o godzinie 18:30 w kościele parafii
                  św. Jana na Prądniku w Krakowie.
                </p>
              </article>
              <article className="edk-step-card">
                <h3>2. Wyjście na trasę</h3>
                <p>Po Mszy Świętej i krótkich informacjach organizacyjnych wyruszamy wspólnie na trasę do Dobczyc.</p>
              </article>
              <article className="edk-step-card">
                <h3>3. Nocna droga</h3>
                <p>
                  Idziemy jako mała grupa, z troską o siebie nawzajem. Między stacjami zachowujemy skupienie i ciszę,
                  a przy kolejnych stacjach wspólnie zatrzymujemy się na rozważanie Drogi Krzyżowej.
                </p>
              </article>
              <article className="edk-step-card">
                <h3>4. Zakończenie i powrót</h3>
                <p>
                  Po zakończeniu drogi organizujemy powrót w sobotę rano, około godziny 8:00. Szczegóły logistyczne
                  przekażemy uczestnikom po zapisach.
                </p>
              </article>
            </div>
            <aside className="edk-summary-card">
              <h3>Najważniejsze w skrócie</h3>
              <ul>
                <li>Start: piątek, 27.03.2026</li>
                <li>Msza Święta: 18:30</li>
                <li>Miejsce rozpoczęcia: parafia św. Jana na Prądniku, Kraków</li>
                <li>Trasa: Kraków → Dobczyce</li>
                <li>Powrót: sobota rano, około 8:00</li>
                <li>Forma: mała grupa, wspólna modlitwa, nocna droga</li>
              </ul>
            </aside>
          </div>
        </section>

        <section className="edk-section edk-reveal" id="prowadzacy">
          <header>
            <h2>Prowadzący</h2>
          </header>
          <div className="edk-section-body">
            <h3>Grupę prowadzi ks. Michał Mleczek</h3>
            <p>
              W tej drodze będzie nam towarzyszył ks. Michał Mleczek. Poprowadzi grupę przez kolejne etapy nocnego
              przejścia, pomoże zachować modlitewny rytm drogi i będzie przewodnikiem we wspólnym przeżywaniu stacji
              Drogi Krzyżowej.
            </p>
            <p>
              To wydarzenie jest organizowane przez niego i prowadzone w duchu prostoty, skupienia oraz odpowiedzialności
              za siebie nawzajem.
            </p>
          </div>
        </section>

        <section className="edk-section edk-reveal" id="trasa">
          <header>
            <h2>Trasa</h2>
            <h3>Kraków → Dobczyce</h3>
          </header>
          <div className="edk-section-body">
            <p>
              Wyruszamy z Krakowa, od parafii św. Jana na Prądniku, i kierujemy się do Dobczyc. To nocna droga, która
              ma swój rytm, ciszę i wymagania. Każdy etap trasy ma stać się przestrzenią modlitwy i skupienia.
            </p>
            <p>
              Poniżej znajduje się układ trasy do uzupełnienia o konkretne punkty, linki i odległości.
            </p>
          </div>

          <div className="edk-route-meta">
            <article>
              <h4>Start</h4>
              <p>św. Jana w Krakowie-Prądnik</p>
            </article>
            <article>
              <h4>Meta</h4>
              <p>Dobczyce</p>
            </article>
            <article>
              <h4>Termin</h4>
              <p>27/28.03.2026</p>
            </article>
            <article>
              <h4>Powrót</h4>
              <p>Sobota rano, około 8:00</p>
            </article>
            <article>
              <h4>Charakter trasy</h4>
              <p>Wymagająca nocna droga przeżywana w skupieniu</p>
            </article>
          </div>

          <div className="edk-route-list" aria-label="Struktura trasy EDK 2026">
            {routeStructure.map((item, index) => {
              if (item.type === 'distance') {
                return (
                  <div key={`${item.title_pl}-${index}`} className="edk-route-distance">
                    <span>{item.title_pl}:</span>
                    <strong>{item.distance_km}</strong>
                  </div>
                );
              }

              const isLinkReady = item.url.trim().length > 0;
              return (
                <article key={`${item.title_pl}-${index}`} className={`edk-route-item edk-route-item--${item.type}`}>
                  <h4>{item.title_pl}</h4>
                  {isLinkReady ? (
                    <a href={item.url} target="_blank" rel="noreferrer">Otwórz punkt</a>
                  ) : (
                    <p>[link / do uzupełnienia]</p>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <section className="edk-section edk-reveal" id="wazne-informacje">
          <header>
            <h2>Ważne informacje</h2>
          </header>
          <div className="edk-section-body">
            <p>
              Ta noc wymaga prostego, ale odpowiedzialnego przygotowania. Potrzebne będą wygodne i sprawdzone buty,
              odpowiedni ubiór, picie, coś do jedzenia, telefon oraz powerbank.
            </p>
            <p>
              Kameralny charakter grupy oznacza także ograniczoną liczbę miejsc. Zależy nam na tym, aby zachować
              modlitewny rytm drogi, wzajemną uważność i bezpieczeństwo.
            </p>
            <p>
              Po zapisaniu się uczestnicy otrzymają dodatkowe informacje organizacyjne dotyczące przygotowania, przebiegu
              trasy oraz szczegółów powrotu.
            </p>
            <ul>
              <li>Idziemy nocą i w skupieniu.</li>
              <li>To droga wymagająca fizycznie i duchowo.</li>
              <li>Dbamy o siebie nawzajem, ale każdy odpowiada za własne przygotowanie.</li>
              <li>Liczba miejsc może być ograniczona.</li>
              <li>Po zapisach przekażemy szczegóły organizacyjne.</li>
              <li>Powrót organizujemy w sobotę rano.</li>
              <li>
                Osoby niepełnoletnie mogą wziąć udział, jeśli idą pod opieką wskazanej osoby pełnoletniej, która bierze
                za nie odpowiedzialność.
              </li>
              <li>
                Jeśli osoba niepełnoletnia nie ma wskazanego opiekuna, prosimy o kontakt z prowadzącym — pomożemy
                znaleźć osobę pełnoletnią.
              </li>
              <li>W ramach zasad organizacyjnych tego wyjścia nie wymagamy pisemnej zgody rodziców.</li>
            </ul>
          </div>
        </section>

        <section className="edk-section edk-reveal" id="faq">
          <header>
            <h2>FAQ</h2>
          </header>
          <div className="edk-faq-list">
            {FAQ_ITEMS.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="edk-section edk-section-cta edk-reveal" id="zapisy">
          <header>
            <h2>Zapisy</h2>
            <h3>Zapisz się na EDK 2026</h3>
            <p>
              Jeśli chcesz przeżyć tę noc w małej wspólnocie, w ciszy, modlitwie i odpowiedzialności za siebie nawzajem —
              zapisz się.
            </p>
          </header>
          <div className="edk-section-body">
            <p>
              Zapisy pomagają nam zachować kameralny charakter grupy, przekazać ważne informacje organizacyjne i lepiej
              zadbać o bezpieczeństwo drogi.
            </p>
          </div>

          {siteLoading ? <p className="edk-inline-note">Ładowanie konfiguracji zapisów...</p> : null}
          {siteError ? <p className="pilgrimage-error">{siteError}</p> : null}

          <form className="edk-form" onSubmit={(eventForm) => void handleSubmit(eventForm)}>
            <label>
              Imię i nazwisko
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
              Status uczestnika
              <select
                value={registrationForm.participantStatus}
                onChange={(eventInput) =>
                  setRegistrationForm((previous) => ({
                    ...previous,
                    participantStatus: eventInput.target.value as ParticipantStatusValue
                  }))
                }
                required
              >
                {PARTICIPANT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label>
              Dodatkowe informacje
              <textarea
                value={registrationForm.additionalInfo}
                onChange={(eventInput) =>
                  setRegistrationForm((previous) => ({ ...previous, additionalInfo: eventInput.target.value }))
                }
              />
              <small>Możesz wpisać tutaj informacje organizacyjne, zdrowotne albo inne ważne uwagi.</small>
            </label>

            <p className="edk-consent">
              Klikając „Wyślij zgłoszenie”, potwierdzasz chęć udziału w wydarzeniu oraz akceptujesz kontakt organizacyjny
              związany z EDK 2026. Twoje dane będą przetwarzane zgodnie z polityką prywatności REcreatio.{' '}
              <a href="/#/legal">Polityka prywatności REcreatio</a>
            </p>

            <button className="cta" type="submit" disabled={registrationPending}>
              {registrationPending ? 'Wysyłanie...' : 'Wyślij zgłoszenie'}
            </button>

            {registrationError ? <p className="pilgrimage-error">{registrationError}</p> : null}
            {registrationSuccess ? <p className="pilgrimage-success">{registrationSuccess}</p> : null}
          </form>

          {showProfileMenu ? (
            <section className="edk-admin-block">
              <header>
                <h3>Panel zapisów (administracja)</h3>
                <p>Widok pełnej listy zgłoszeń EDK 2026.</p>
              </header>

              {!site?.isProvisioned ? (
                <div className="edk-admin-warning">
                  <p>
                    Wydarzenie nie jest jeszcze aktywowane w bazie jako pełne wydarzenie. Aktywacja przygotuje zapisy i panel
                    admina w standardzie REcreatio.
                  </p>
                  <button className="ghost" type="button" onClick={() => void handleProvisionEdk()} disabled={provisionPending}>
                    {provisionPending ? 'Aktywowanie...' : 'Aktywuj EDK 2026 w systemie'}
                  </button>
                  {provisionError ? <p className="pilgrimage-error">{provisionError}</p> : null}
                </div>
              ) : null}

              {organizerPending ? <p className="edk-inline-note">Ładowanie listy uczestników...</p> : null}
              {organizerError ? <p className="pilgrimage-error">{organizerError}</p> : null}

              {organizerDashboard ? (
                <>
                  <div className="edk-admin-tools">
                    <button className="ghost" type="button" onClick={() => void handleExportRegistrations()} disabled={exportPending}>
                      {exportPending ? 'Eksportowanie...' : 'Eksportuj listę zapisów'}
                    </button>
                    {exportError ? <p className="pilgrimage-error">{exportError}</p> : null}
                  </div>

                  <div className="edk-admin-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Imię i nazwisko</th>
                          <th>Telefon</th>
                          <th>Status uczestnika</th>
                          <th>Dodatkowe informacje</th>
                          <th>Data zgłoszenia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {participantRows.map((row) => (
                          <tr key={row.id}>
                            <td>{row.fullName}</td>
                            <td>{row.phone}</td>
                            <td>{mapParticipantStatusLabel(row.participantStatus)}</td>
                            <td>{row.additionalInfo ?? '—'}</td>
                            <td>{new Date(row.createdUtc).toLocaleString('pl-PL')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </section>
          ) : null}
        </section>

        <section className="edk-section edk-reveal" id="kontakt">
          <header>
            <h2>Kontakt</h2>
          </header>
          <div className="edk-section-body">
            <p>
              Masz pytania dotyczące przygotowania, zapisów albo przebiegu drogi? Skontaktuj się ze mną. Chętnie pomogę
              w sprawach organizacyjnych.
            </p>
          </div>
          <div className="edk-contact-grid">
            <article className="edk-contact-card">
              <h3>E-mail</h3>
              <p>
                <a href="mailto:mleczek_pradnik@outlook.com">mleczek_pradnik@outlook.com</a>
              </p>
            </article>
            <article className="edk-contact-card">
              <h3>Telefon</h3>
              <p>
                <a href="tel:+48505548677">+48 505 548 677</a>
              </p>
            </article>
          </div>
          <div className="edk-contact-actions">
            <a className="ghost" href="mailto:mleczek_pradnik@outlook.com">Napisz wiadomość</a>
          </div>
        </section>
      </main>

      <footer className="edk-footer">
        <p>EDK 2026 · 27/28.03.2026 · Kraków → Dobczyce</p>
        <p>Organizator: ks. Michał Mleczek</p>
        <p>Wydarzenie w ekosystemie REcreatio</p>
      </footer>
    </div>
  );
}
