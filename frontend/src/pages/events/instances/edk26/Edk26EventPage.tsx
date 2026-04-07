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
} from '../../../../lib/api';
import { normalizePolishPhone } from '../../../../lib/phone';
import type { EventDefinition, EventInnerPage, SharedEventPageProps } from '../../eventTypes';
import { EventSinglePageTemplate, type EventTemplateSlide } from '../../templates/EventSinglePageTemplate';

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
  { value: 'adult', label: 'Osoba pelnoletnia' },
  { value: 'minor_with_guardian', label: 'Osoba niepelnoletnia z opiekunem' },
  {
    value: 'adult_guardian_for_minor',
    label: 'Osoba pelnoletnia odpowiedzialna za osobe niepelnoletnia'
  }
];

const PARTICIPANT_STATUS_LABELS: Record<ParticipantStatusValue, string> = {
  adult: 'Osoba pelnoletnia',
  minor_with_guardian: 'Osoba niepelnoletnia z opiekunem',
  adult_guardian_for_minor: 'Osoba maloletnia bez opiekuna'
};

const DEFAULT_FORM: RegistrationFormState = {
  fullName: '',
  phone: '',
  participantStatus: 'adult',
  additionalInfo: ''
};

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
  return normalized.length === 0 || normalized === '[link / do uzupelnienia]';
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
  { type: 'distance', title_pl: '+ odleglosc do kolejnego punktu', url: '', distance_km: '2,1 km' },
  { type: 'station', title_pl: 'Stacja I - Jezus na smierc skazany', url: 'https://maps.app.goo.gl/P2Jv3Up112DMAy5PA', distance_km: '' },
  { type: 'distance', title_pl: '+ odleglosc do kolejnego punktu', url: '', distance_km: '2,3 km' },
  { type: 'station', title_pl: 'Stacja II - Jezus bierze krzyz na swoje ramiona', url: 'https://maps.app.goo.gl/xjWWJFudVoewKQSj6', distance_km: '' },
  { type: 'distance', title_pl: '+ odleglosc do kolejnego punktu', url: '', distance_km: '3,2 km' },
  { type: 'station', title_pl: 'Stacja III - Jezus upada po raz pierwszy', url: 'https://maps.app.goo.gl/By6JyayGQByDXHvV7', distance_km: '' },
  { type: 'distance', title_pl: '+ odleglosc do kolejnego punktu', url: '', distance_km: '1,6 km' },
  { type: 'station', title_pl: 'Stacja IV - Jezus spotyka swoja Matke', url: 'https://maps.app.goo.gl/dwfAeLRieQGjZ5eQA', distance_km: '' },
  { type: 'distance', title_pl: '+ odleglosc do kolejnego punktu', url: '', distance_km: '2,5 km' },
  {
    type: 'station',
    title_pl: 'Stacja V - Szymon z Cyreny pomaga niesc krzyz Jezusowi',
    url: 'https://maps.app.goo.gl/eBYb9tSkFLzucwGy8',
    distance_km: ''
  },
  { type: 'distance', title_pl: '+ odleglosc do kolejnego punktu', url: '', distance_km: '2,8 km' },
  { type: 'station', title_pl: 'Stacja VI - Weronika ociera twarz Jezusowi', url: 'https://maps.app.goo.gl/T8rbSyY2MLTV77949', distance_km: '' },
  { type: 'distance', title_pl: '+ odleglosc do kolejnego punktu', url: '', distance_km: '3,5 km' },
  { type: 'station', title_pl: 'Stacja VII - Jezus upada po raz drugi', url: 'https://maps.app.goo.gl/Mq534arWZD8S8hkc6', distance_km: '' },
  { type: 'distance', title_pl: '+ odleglosc do kolejnego punktu', url: '', distance_km: '2,2 km' },
  {
    type: 'station',
    title_pl: 'Stacja VIII - Jezus pociesza placzace niewiasty',
    url: 'https://maps.app.goo.gl/x4zEUUuRxa1BqJBM7',
    distance_km: ''
  },
  { type: 'distance', title_pl: '+ odleglosc do kolejnego punktu', url: '', distance_km: '2,6 km' },
  { type: 'station', title_pl: 'Stacja IX - Jezus upada po raz trzeci', url: 'https://maps.app.goo.gl/op9yy4LwFrFBigq68', distance_km: '' },
  { type: 'distance', title_pl: '+ odleglosc do kolejnego punktu', url: '', distance_km: '1,7 km' },
  { type: 'station', title_pl: 'Stacja X - Jezus z szat obnazony', url: 'https://maps.app.goo.gl/9PS81EWU4AJ7D9CW7', distance_km: '' },
  { type: 'distance', title_pl: '+ odleglosc do kolejnego punktu', url: '', distance_km: '2,2 km' },
  { type: 'station', title_pl: 'Stacja XI - Jezus przybity do krzyza', url: 'https://maps.app.goo.gl/inh6p8ypkRQXYpzGA', distance_km: '' },
  { type: 'distance', title_pl: '+ odleglosc do kolejnego punktu', url: '', distance_km: '2,7 km' },
  { type: 'station', title_pl: 'Stacja XII - Jezus umiera na krzyzu', url: 'https://maps.app.goo.gl/Nbr1DKH7E9ioENvU7', distance_km: '' },
  { type: 'distance', title_pl: '+ odleglosc do kolejnego punktu', url: '', distance_km: '1,9 km' },
  { type: 'station', title_pl: 'Stacja XIII - Jezus zdjety z krzyza', url: 'https://maps.app.goo.gl/rapW9iQ6TBzdXirW9', distance_km: '' },
  { type: 'distance', title_pl: '+ odleglosc do kolejnego punktu', url: '', distance_km: '1,5 km' },
  { type: 'station', title_pl: 'Stacja XIV - Jezus zlozony do grobu', url: 'https://maps.app.goo.gl/o17uTobMpE3fHyEh8', distance_km: '' },
  { type: 'distance', title_pl: '+ odleglosc do mety', url: '', distance_km: '0,6 km' },
  { type: 'finish', title_pl: 'Punkt koncowy', url: 'https://maps.app.goo.gl/Ram1tdB3hcbY1D5Y8', distance_km: '' }
];

const FAQ_ITEMS: Array<{ question: string; answer: string }> = [
  {
    question: 'Czy to wydarzenie jest dla kazdego?',
    answer:
      'To propozycja dla osob gotowych na nocna droge, wysilek i skupienie. Nie trzeba miec wynikow sportowych, ale trzeba podejsc do tej drogi dojrzale i odpowiedzialnie.'
  },
  {
    question: 'Czy idziemy w ciszy?',
    answer:
      'Tak. Miedzy stacjami chcemy zachowac cisze i ograniczyc rozmowy do minimum. Na stacjach zatrzymujemy sie wspolnie na rozwazanie i modlitwe.'
  },
  {
    question: 'Od czego zaczynamy?',
    answer:
      'Spotykamy sie w piatek 27 marca 2026. EDK rozpoczynamy Msza Swieta o godzinie 18:30 w kosciele parafii sw. Jana na Pradniku w Krakowie, a po niej wyruszamy na trase.'
  },
  {
    question: 'Czy organizowany jest powrot?',
    answer:
      'Tak. Po zakonczeniu drogi organizujemy powrot w sobote rano, okolo godziny 8:00. Szczegoly przekazemy uczestnikom po zapisach.'
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

export function Edk26EventPage(
  props: SharedEventPageProps & { page: EventInnerPage; event: EventDefinition }
) {
  const { showProfileMenu } = props;
  const [site, setSite] = useState<EdkSite | null>(null);
  const [siteLoading, setSiteLoading] = useState(true);
  const [siteError, setSiteError] = useState<string | null>(null);
  const [provisionPending, setProvisionPending] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);

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
      'Kameralna EDK 2026 z Krakowa do Dobczyc. Msza Swieta na rozpoczecie, wspolna nocna droga, rozwazania Drogi Krzyzowej i troska o siebie nawzajem.'
    );
    ensureMeta('meta[property="og:title"]', 'property', 'og:title', 'EDK 2026 | REcreatio');
    ensureMeta(
      'meta[property="og:description"]',
      'property',
      'og:description',
      'Nocna droga w malej wspolnocie. 27/28.03.2026, Krakow -> Dobczyce.'
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
        setSiteError(error instanceof Error ? error.message : 'Nie udalo sie pobrac konfiguracji wydarzenia.');
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
          setOrganizerError('Brak uprawnien do podgladu panelu zapisow.');
          return;
        }
        setOrganizerError(error instanceof Error ? error.message : 'Nie udalo sie pobrac listy uczestnikow.');
      })
      .finally(() => {
        if (!active) return;
        setOrganizerPending(false);
      });

    return () => {
      active = false;
    };
  }, [showProfileMenu, site?.id]);

  const participantRows = useMemo(() => {
    return [...(organizerDashboard?.registrations ?? [])].sort((a, b) => {
      return new Date(b.createdUtc).getTime() - new Date(a.createdUtc).getTime();
    });
  }, [organizerDashboard]);

  const routeStructure = useMemo(() => {
    return mergeRoutePointsWithDefaults(site?.site.routePoints, EDK26_ROUTE_STRUCTURE);
  }, [site?.site.routePoints]);

  const handleSubmit = async (eventForm: FormEvent) => {
    eventForm.preventDefault();
    setRegistrationError(null);
    setRegistrationSuccess(null);

    const fullName = registrationForm.fullName.trim();
    const phone = normalizePolishPhone(registrationForm.phone);
    if (!fullName || !phone) {
      setRegistrationError('Uzupelnij imie i nazwisko oraz poprawny numer telefonu (+48 i 9 cyfr).');
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
        'Dziekujemy za zgloszenie. Skontaktujemy sie z Toba w sprawach organizacyjnych dotyczacych EDK 2026.'
      );
    } catch (error: unknown) {
      setRegistrationError(error instanceof Error ? error.message : 'Nie udalo sie wyslac zgloszenia.');
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
      setProvisionError(error instanceof Error ? error.message : 'Nie udalo sie aktywowac wydarzenia.');
    } finally {
      setProvisionPending(false);
    }
  };

  const handleExportRegistrations = async () => {
    if (!site?.id) {
      setExportError('Eksport jest dostepny dopiero po aktywacji wydarzenia.');
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
      setExportError('Nie udalo sie wyeksportowac listy zapisow.');
    } finally {
      setExportPending(false);
    }
  };

  const slides: EventTemplateSlide[] = [
    {
      id: 'start',
      menuLabel: 'Start',
      title: 'EDK 2026',
      heightMode: 'content',
      tone: 'tone-5',
      layers: [
        {
          id: 'bg',
          className: 'edk26-layer edk26-layer-bg',
          minHeightPx: 1700,
          content: <div className="edk26-layer-bg-fill" />
        },
        {
          id: 'type',
          className: 'edk26-layer edk26-layer-type',
          minHeightPx: 1880,
          content: (
            <div className="edk26-type-banner" aria-hidden="true">
              <span className="edk26-type-word">EDK</span>
              <span className="edk26-type-word edk26-type-word-alt">2026</span>
            </div>
          )
        },
        {
          id: 'content',
          className: 'event-template-slide-content-layer edk26-content-layer',
          interactive: true,
          minHeightPx: 1200,
          content: (
            <div className="edk26-content">
              <section className="edk-section">
                <p className="edk-hero-badge">27/28.03.2026 - Krakow -&gt; Dobczyce - prowadzi ks. Michal Mleczek</p>
                <h1 className="event-template-title">EDK 2026</h1>
                <p className="event-template-description">Nocna droga w malej wspolnocie.</p>
                <div className="event-template-body">
                  <p>
                    W nocy z 27 na 28 marca 2026 wyruszamy z Krakowa do Dobczyc. Zaczynamy Msza Swieta o 18:30,
                    a potem idziemy razem w ciszy, modlitwie i odpowiedzialnosci za siebie nawzajem.
                  </p>
                  <p>
                    To nie jest wydarzenie sportowe. To droga skupienia, wysilku i duchowej decyzji.
                  </p>
                </div>
              </section>
            </div>
          )
        }
      ]
    },
    {
      id: 'jak-idziemy',
      menuLabel: 'Jak idziemy',
      title: 'Jak idziemy',
      heightMode: 'content',
      tone: 'tone-4',
      layers: [
        {
          id: 'bg',
          className: 'edk26-layer edk26-layer-bg',
          minHeightPx: 1800,
          content: <div className="edk26-layer-bg-fill edk26-layer-bg-fill-2" />
        },
        {
          id: 'type',
          className: 'edk26-layer edk26-layer-type',
          minHeightPx: 1900,
          content: (
            <div className="edk26-type-banner" aria-hidden="true">
              <span className="edk26-type-word">CISZA</span>
              <span className="edk26-type-word edk26-type-word-alt">DROGA</span>
            </div>
          )
        },
        {
          id: 'content',
          className: 'event-template-slide-content-layer edk26-content-layer',
          interactive: true,
          minHeightPx: 1520,
          content: (
            <div className="edk26-content">
              <section className="edk-section">
                <header>
                  <h2>Jak idziemy</h2>
                  <p>Mala grupa, cisza i odpowiedzialnosc.</p>
                </header>
                <div className="edk-card-grid">
                  <article className="edk-card">
                    <h3>Mala grupa</h3>
                    <p>Idziemy razem, bez tlumu i bez pospiechu.</p>
                  </article>
                  <article className="edk-card">
                    <h3>Wspolna troska</h3>
                    <p>Nie zostawiamy nikogo samego na trasie.</p>
                  </article>
                  <article className="edk-card">
                    <h3>Cisza miedzy stacjami</h3>
                    <p>Rozmowy ograniczamy do tego, co konieczne.</p>
                  </article>
                  <article className="edk-card">
                    <h3>Wspolna modlitwa</h3>
                    <p>Przy stacjach zatrzymujemy sie i rozwazamy Droge Krzyzowa.</p>
                  </article>
                  <article className="edk-card">
                    <h3>Bez rywalizacji</h3>
                    <p>Nie chodzi o rekord, tylko o uczciwe przejscie drogi.</p>
                  </article>
                  <article className="edk-card">
                    <h3>Droga duchowa</h3>
                    <p>Wysilek ma prowadzic do modlitwy i przemiany.</p>
                  </article>
                </div>
              </section>

              <section className="edk-section">
                <header>
                  <h2>Plan i logistyka</h2>
                </header>
                <div className="edk-plan-layout">
                  <div className="edk-timeline">
                    <article className="edk-step-card">
                      <h3>1. Rozpoczecie</h3>
                      <p>Piatek, 27.03.2026, Msza Swieta o 18:30.</p>
                    </article>
                    <article className="edk-step-card">
                      <h3>2. Wyjscie na trase</h3>
                      <p>Po Mszy i informacjach organizacyjnych ruszamy razem.</p>
                    </article>
                    <article className="edk-step-card">
                      <h3>3. Nocna droga</h3>
                      <p>Cisza, stacje, modlitwa i wzajemna odpowiedzialnosc.</p>
                    </article>
                    <article className="edk-step-card">
                      <h3>4. Zakonczenie i powrot</h3>
                      <p>Powrot organizowany w sobote rano, okolo 8:00.</p>
                    </article>
                  </div>
                  <aside className="edk-summary-card">
                    <h3>W skrocie</h3>
                    <ul>
                      <li>Start: piatek, 27.03.2026</li>
                      <li>Msza: 18:30</li>
                      <li>Trasa: Krakow -&gt; Dobczyce</li>
                      <li>Powrot: sobota rano, okolo 8:00</li>
                    </ul>
                  </aside>
                </div>
              </section>
            </div>
          )
        }
      ]
    },
    {
      id: 'trasa',
      menuLabel: 'Trasa',
      title: 'Trasa',
      heightMode: 'content',
      tone: 'tone-3',
      layers: [
        {
          id: 'bg',
          className: 'edk26-layer edk26-layer-bg',
          minHeightPx: 2200,
          content: <div className="edk26-layer-bg-fill edk26-layer-bg-fill-3" />
        },
        {
          id: 'type',
          className: 'edk26-layer edk26-layer-type',
          minHeightPx: 2300,
          content: (
            <div className="edk26-type-banner" aria-hidden="true">
              <span className="edk26-type-word">KRAKOW</span>
              <span className="edk26-type-word edk26-type-word-alt">DOBCZYCE</span>
            </div>
          )
        },
        {
          id: 'content',
          className: 'event-template-slide-content-layer edk26-content-layer',
          interactive: true,
          minHeightPx: 1960,
          content: (
            <div className="edk26-content">
              <section className="edk-section">
                <header>
                  <h2>Trasa</h2>
                  <p>Krakow -&gt; Dobczyce</p>
                </header>
                <div className="edk-section-body">
                  <p>
                    To wymagajaca nocna droga. Kazdy etap ma byc przestrzenia skupienia, modlitwy i wiernego trwania.
                  </p>
                </div>

                <div className="edk-route-meta">
                  <article>
                    <h4>Start</h4>
                    <p>sw. Jana w Krakowie-Pradnik</p>
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
                    <h4>Powrot</h4>
                    <p>Sobota rano, okolo 8:00</p>
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
                          <a href={item.url} target="_blank" rel="noreferrer">Otworz punkt</a>
                        ) : (
                          <p>[link / do uzupelnienia]</p>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            </div>
          )
        }
      ]
    },
    {
      id: 'zapisy',
      menuLabel: 'Zapisy',
      title: 'Zapisy',
      heightMode: 'content',
      tone: 'tone-2',
      layers: [
        {
          id: 'bg',
          className: 'edk26-layer edk26-layer-bg',
          minHeightPx: 2100,
          content: <div className="edk26-layer-bg-fill edk26-layer-bg-fill-4" />
        },
        {
          id: 'type',
          className: 'edk26-layer edk26-layer-type',
          minHeightPx: 2400,
          content: (
            <div className="edk26-type-banner" aria-hidden="true">
              <span className="edk26-type-word">ZAPISY</span>
              <span className="edk26-type-word edk26-type-word-alt">EDK</span>
            </div>
          )
        },
        {
          id: 'content',
          className: 'event-template-slide-content-layer edk26-content-layer',
          interactive: true,
          minHeightPx: 1860,
          content: (
            <div className="edk26-content">
              <section className="edk-section edk-section-cta">
                <header>
                  <h2>Zapisy</h2>
                  <h3>Zapisz sie na EDK 2026</h3>
                  <p>
                    Jesli chcesz przezyc te noc w malej wspolnocie i skupieniu, wypelnij formularz.
                  </p>
                </header>

                {siteLoading ? <p className="edk-inline-note">Ladowanie konfiguracji zapisow...</p> : null}
                {siteError ? <p className="pilgrimage-error">{siteError}</p> : null}

                <form className="edk-form" onSubmit={(eventForm) => void handleSubmit(eventForm)}>
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
                    <small>Wpisz tutaj wazne informacje organizacyjne lub zdrowotne.</small>
                  </label>

                  <p className="edk-consent">
                    Klikajac \"Wyslij zgloszenie\", potwierdzasz chec udzialu w wydarzeniu i akceptujesz kontakt
                    organizacyjny. <a href="/#/legal">Polityka prywatnosci REcreatio</a>
                  </p>

                  <button className="cta" type="submit" disabled={registrationPending}>
                    {registrationPending ? 'Wysylanie...' : 'Wyslij zgloszenie'}
                  </button>

                  {registrationError ? <p className="pilgrimage-error">{registrationError}</p> : null}
                  {registrationSuccess ? <p className="pilgrimage-success">{registrationSuccess}</p> : null}
                </form>

                {showProfileMenu ? (
                  <section className="edk-admin-block">
                    <header>
                      <h3>Panel zapisow (administracja)</h3>
                      <p>Widok pelnej listy zgloszen EDK 2026.</p>
                    </header>

                    {!site?.isProvisioned ? (
                      <div className="edk-admin-warning">
                        <p>
                          Wydarzenie nie jest jeszcze aktywowane w bazie. Aktywacja przygotuje zapisy i panel admina.
                        </p>
                        <button className="ghost" type="button" onClick={() => void handleProvisionEdk()} disabled={provisionPending}>
                          {provisionPending ? 'Aktywowanie...' : 'Aktywuj EDK 2026 w systemie'}
                        </button>
                        {provisionError ? <p className="pilgrimage-error">{provisionError}</p> : null}
                      </div>
                    ) : null}

                    {organizerPending ? <p className="edk-inline-note">Ladowanie listy uczestnikow...</p> : null}
                    {organizerError ? <p className="pilgrimage-error">{organizerError}</p> : null}

                    {organizerDashboard ? (
                      <>
                        <div className="edk-admin-tools">
                          <button className="ghost" type="button" onClick={() => void handleExportRegistrations()} disabled={exportPending}>
                            {exportPending ? 'Eksportowanie...' : 'Eksportuj liste zapisow'}
                          </button>
                          {exportError ? <p className="pilgrimage-error">{exportError}</p> : null}
                        </div>

                        <div className="edk-admin-table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Imie i nazwisko</th>
                                <th>Telefon</th>
                                <th>Status uczestnika</th>
                                <th>Dodatkowe informacje</th>
                                <th>Data zgloszenia</th>
                              </tr>
                            </thead>
                            <tbody>
                              {participantRows.map((row) => (
                                <tr key={row.id}>
                                  <td>{row.fullName}</td>
                                  <td>{row.phone}</td>
                                  <td>{mapParticipantStatusLabel(row.participantStatus)}</td>
                                  <td>{row.additionalInfo ?? '-'}</td>
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
            </div>
          )
        }
      ]
    },
    {
      id: 'faq-kontakt',
      menuLabel: 'FAQ i Kontakt',
      title: 'FAQ i Kontakt',
      heightMode: 'content',
      tone: 'tone-1',
      layers: [
        {
          id: 'bg',
          className: 'edk26-layer edk26-layer-bg',
          minHeightPx: 1700,
          content: <div className="edk26-layer-bg-fill edk26-layer-bg-fill-5" />
        },
        {
          id: 'type',
          className: 'edk26-layer edk26-layer-type',
          minHeightPx: 1900,
          content: (
            <div className="edk26-type-banner" aria-hidden="true">
              <span className="edk26-type-word">KONTAKT</span>
              <span className="edk26-type-word edk26-type-word-alt">WSPOLNOTA</span>
            </div>
          )
        },
        {
          id: 'content',
          className: 'event-template-slide-content-layer edk26-content-layer',
          interactive: true,
          minHeightPx: 1320,
          content: (
            <div className="edk26-content">
              <section className="edk-section">
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

              <section className="edk-section">
                <header>
                  <h2>Kontakt</h2>
                </header>
                <div className="edk-section-body">
                  <p>
                    Masz pytania dotyczace przygotowania, zapisow albo przebiegu drogi? Skontaktuj sie bezposrednio.
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
                  <a className="ghost" href="mailto:mleczek_pradnik@outlook.com">Napisz wiadomosc</a>
                </div>
              </section>
            </div>
          )
        }
      ]
    }
  ];

  return <EventSinglePageTemplate {...props} event={props.event} slides={slides} />;
}
