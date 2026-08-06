import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ApiError,
  bootstrapRowerowa26Event,
  createRowerowaRegistration,
  exportRowerowaRegistrations,
  getRowerowaOrganizerDashboard,
  getRowerowaSite,
  type RowerowaOrganizerDashboard,
  type RowerowaSite
} from '../../../../lib/api';
import { normalizePolishPhone } from '../../../../lib/phone';
import type { EventDefinition, EventInnerPage, SharedEventPageProps } from '../../eventTypes';
import { EventSinglePageTemplate, type EventTemplateSlide } from '../../templates/EventSinglePageTemplate';

const ROWEROWA_SLUG = 'rowerowa26';

const JOIN_POINTS = ['Kraków', 'Mistrzejowice', 'Zielonki', 'Ojców', 'Domaniewice (start w sobotę)', 'Pilica', 'Żarki'];

const FRIDAY_ACCOMMODATION_OPTIONS = [
  'Tak, hostel (śpiwór)',
  'Tak, własny namiot',
  'Nie, wracam do domu na noc',
  'Nie, dołączam dopiero w sobotę'
];

const MEAL_OPTIONS = [
  'Kolacja w piątek',
  'Śniadanie w sobotę',
  'Obiad w sobotę',
  'Kolacja w sobotę',
  'Przekąski w drodze',
  'Wolę wozić własne jedzenie'
];

const POST_PLAN_OPTIONS = [
  'Proszę o zorganizowanie powrotu',
  'Wracam samodzielnie',
  'Mam wolne miejsca w samochodzie i mogę kogoś zabrać',
  'Zostaję w Częstochowie na noc'
];

const BIKE_RETURN_OPTIONS = [
  'Oddaję rower w Częstochowie, odbiorę w Krakowie',
  'Oddaję rower w Częstochowie, odbiorę w Mistrzejowicach',
  'Oddaję rower w Częstochowie, odbiorę w Zielonkach',
  'Wracam na rowerze lub mam własny transport'
];

const LUGGAGE_DROPOFF_OPTIONS = ['Kraków', 'Mistrzejowice', 'Zielonki', 'Domaniewice'];
const LUGGAGE_PICKUP_OPTIONS = ['Częstochowa', 'Zielonki', 'Mistrzejowice', 'Kraków'];

const SKILL_LEVEL_OPTIONS = [
  'Poradzę sobie i pomogę innym (mam doświadczenie w dłuższych wyjazdach rowerowych)',
  'Jadę samodzielnie (nie potrzebuję szczególnego wsparcia)',
  'Jadę spokojnie (czasem mogę potrzebować doraźnej pomocy)',
  'Mogę potrzebować wsparcia (nie mam jeszcze dużego doświadczenia)'
];

type RegistrationFormState = {
  fullName: string;
  phone: string;
  email: string;
  joinPoint: string;
  fridayAccommodation: string;
  meals: string[];
  postPilgrimagePlan: string;
  bikeReturn: string;
  luggageDropoff: string;
  luggagePickup: string;
  hasHelmet: boolean;
  bikeRoadworthy: boolean;
  knowsSafetyRules: boolean;
  skillLevel: string;
  helpOffer: string;
};

const DEFAULT_FORM: RegistrationFormState = {
  fullName: '',
  phone: '',
  email: '',
  joinPoint: JOIN_POINTS[0],
  fridayAccommodation: FRIDAY_ACCOMMODATION_OPTIONS[0],
  meals: [],
  postPilgrimagePlan: POST_PLAN_OPTIONS[0],
  bikeReturn: BIKE_RETURN_OPTIONS[0],
  luggageDropoff: LUGGAGE_DROPOFF_OPTIONS[0],
  luggagePickup: LUGGAGE_PICKUP_OPTIONS[0],
  hasHelmet: false,
  bikeRoadworthy: false,
  knowsSafetyRules: false,
  skillLevel: SKILL_LEVEL_OPTIONS[0],
  helpOffer: ''
};

const FAQ_ITEMS: Array<{ question: string; answer: string }> = [
  {
    question: 'Czy trzeba mieć doświadczenie rowerowe?',
    answer:
      'Nie, ale trzeba liczyć się z dwoma dniami jazdy na dystansie łącznie ponad 130 km. Jadziemy w grupie, w tempie dostosowanym do słabszych uczestników, i pytamy o Twój poziom doświadczenia w formularzu zgłoszeniowym.'
  },
  {
    question: 'Czy mogę dołączyć tylko w sobotę?',
    answer:
      'Tak. Można dołączyć w Domaniewicach w sobotę rano, o godzinie startu drugiego etapu (8:00), albo w innym punkcie na trasie po wcześniejszym uzgodnieniu z organizatorem.'
  },
  {
    question: 'Gdzie nocujemy w piątek?',
    answer:
      'Nocleg w piątek jest w Domaniewicach. Do wyboru jest hostel (własny śpiwór) albo własny namiot. W formularzu zaznaczasz, z której opcji korzystasz.'
  },
  {
    question: 'Co z bagażem?',
    answer:
      'Bagaże są przewożone samochodem wsparcia. Wskazujesz w formularzu, gdzie oddajesz bagaż przed startem i gdzie chcesz go odebrać po pielgrzymce.'
  },
  {
    question: 'Co z rowerem po dojechaniu do Częstochowy?',
    answer:
      'Możesz oddać rower do transportu powrotnego (do Krakowa, Mistrzejowic albo Zielonek) albo wracać na rowerze lub własnym transportem — wybierasz to w formularzu.'
  },
  {
    question: 'Czy kask jest obowiązkowy?',
    answer:
      'Tak. Udział w pielgrzymce wymaga posiadania i używania kasku przez cały czas jazdy, a także sprawnego technicznie roweru (hamulce, oświetlenie, opony).'
  },
  {
    question: 'Czy jest organizowany powrót z Częstochowy?',
    answer:
      'Tak, dla osób, które o to poproszą w formularzu. Możesz też wracać samodzielnie, zaoferować wolne miejsca w aucie innym uczestnikom albo zostać w Częstochowie na noc.'
  }
];

export function Rowerowa26EventPage(
  props: SharedEventPageProps & { page: EventInnerPage; event: EventDefinition }
) {
  const { showProfileMenu } = props;
  const [site, setSite] = useState<RowerowaSite | null>(null);
  const [siteLoading, setSiteLoading] = useState(true);
  const [siteError, setSiteError] = useState<string | null>(null);
  const [provisionPending, setProvisionPending] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);

  const [form, setForm] = useState<RegistrationFormState>(DEFAULT_FORM);
  const [registrationPending, setRegistrationPending] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState<string | null>(null);

  const [organizerDashboard, setOrganizerDashboard] = useState<RowerowaOrganizerDashboard | null>(null);
  const [organizerPending, setOrganizerPending] = useState(false);
  const [organizerError, setOrganizerError] = useState<string | null>(null);
  const [exportPending, setExportPending] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Rowerowa Częstochowa 2026 | REcreatio';

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
      'Rowerowa Częstochowa 2026: dwudniowa pielgrzymka rowerowa z Krakowa do Częstochowy z noclegiem w Domaniewicach.'
    );
    ensureMeta('meta[property="og:title"]', 'property', 'og:title', 'Rowerowa Częstochowa 2026 | REcreatio');
    ensureMeta(
      'meta[property="og:description"]',
      'property',
      'og:description',
      'Pielgrzymka rowerowa 28-29.08.2026, Kraków -> Częstochowa, z noclegiem w Domaniewicach.'
    );

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', '/#/event/rowerowa26');
  }, []);

  useEffect(() => {
    let active = true;
    setSiteLoading(true);
    setSiteError(null);

    getRowerowaSite(ROWEROWA_SLUG)
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

    getRowerowaOrganizerDashboard(site.id)
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

  const participantRows = useMemo(() => {
    return [...(organizerDashboard?.registrations ?? [])].sort((a, b) => {
      return new Date(b.createdUtc).getTime() - new Date(a.createdUtc).getTime();
    });
  }, [organizerDashboard]);

  const toggleMeal = (meal: string) => {
    setForm((previous) => {
      const has = previous.meals.includes(meal);
      return {
        ...previous,
        meals: has ? previous.meals.filter((entry) => entry !== meal) : [...previous.meals, meal]
      };
    });
  };

  const handleSubmit = async (eventForm: FormEvent) => {
    eventForm.preventDefault();
    setRegistrationError(null);
    setRegistrationSuccess(null);

    const fullName = form.fullName.trim();
    const phone = normalizePolishPhone(form.phone);
    const email = form.email.trim();

    if (!fullName || !phone) {
      setRegistrationError('Uzupełnij imię i nazwisko oraz poprawny numer telefonu (+48 i 9 cyfr).');
      return;
    }
    if (!email || !email.includes('@')) {
      setRegistrationError('Podaj poprawny adres e-mail.');
      return;
    }
    if (form.meals.length === 0) {
      setRegistrationError('Zaznacz co najmniej jeden posiłek, z którego chcesz korzystać.');
      return;
    }
    if (!form.hasHelmet || !form.bikeRoadworthy || !form.knowsSafetyRules) {
      setRegistrationError('Potwierdź wszystkie oświadczenia dotyczące bezpieczeństwa.');
      return;
    }

    setRegistrationPending(true);
    try {
      await createRowerowaRegistration(ROWEROWA_SLUG, {
        fullName,
        phone,
        email,
        joinPoint: form.joinPoint,
        fridayAccommodation: form.fridayAccommodation,
        meals: form.meals,
        postPilgrimagePlan: form.postPilgrimagePlan,
        bikeReturn: form.bikeReturn,
        luggageDropoff: form.luggageDropoff,
        luggagePickup: form.luggagePickup,
        hasHelmet: form.hasHelmet,
        bikeRoadworthy: form.bikeRoadworthy,
        knowsSafetyRules: form.knowsSafetyRules,
        skillLevel: form.skillLevel,
        helpOffer: form.helpOffer.trim() || null
      });

      try {
        const refreshedSite = await getRowerowaSite(ROWEROWA_SLUG);
        setSite(refreshedSite);
      } catch {
        // Registration succeeded; site refresh is best-effort only.
      }

      setForm(DEFAULT_FORM);
      setRegistrationSuccess(
        'Dziękujemy za zgłoszenie. Skontaktujemy się w sprawach organizacyjnych dotyczących Rowerowej Częstochowy 2026.'
      );
    } catch (error: unknown) {
      setRegistrationError(error instanceof Error ? error.message : 'Nie udało się wysłać zgłoszenia.');
    } finally {
      setRegistrationPending(false);
    }
  };

  const handleProvisionRowerowa = async () => {
    setProvisionPending(true);
    setProvisionError(null);
    try {
      const response = await bootstrapRowerowa26Event();
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
      const payload = await exportRowerowaRegistrations(site.id);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `rowerowa26-registrations-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('Nie udało się wyeksportować listy zapisów.');
    } finally {
      setExportPending(false);
    }
  };

  const slides: EventTemplateSlide[] = [
    {
      id: 'o-wydarzeniu',
      menuLabel: 'O wydarzeniu',
      title: 'O wydarzeniu',
      heightMode: 'content',
      tone: 'tone-2',
      layers: [
        {
          id: 'bg',
          className: 'rw-layer rw-layer-bg',
          minHeightPx: 1750,
          content: <div className="rw-layer-bg-fill" />
        },
        {
          id: 'type',
          className: 'rw-layer rw-layer-type',
          minHeightPx: 1880,
          content: (
            <div className="rw-type-banner" aria-hidden="true">
              <span className="rw-type-word">ROWEROWA</span>
              <span className="rw-type-word rw-type-word-alt">CZĘSTOCHOWA</span>
            </div>
          )
        },
        {
          id: 'content',
          className: 'event-template-slide-content-layer rw-content-layer',
          interactive: true,
          scrollReference: true,
          content: (
            <div className="rw-content">
              <div className="event-template-slide-inner">
                <section className="rw-hero" aria-labelledby="rw-hero-title">
                  <div className="rw-hero-media" />
                  <div className="rw-hero-overlay">
                    <p className="rw-hero-badge">28-29.08.2026 - Kraków -&gt; Częstochowa</p>
                    <h1 id="rw-hero-title">
                      Rowerowa Częstochowa
                      <span>Pielgrzymka rowerowa z Krakowa do Częstochowy</span>
                    </h1>
                    <p>
                      Parafia Narodzenia NMP w Zielonkach z mistrzejowicką grupą pielgrzymkową 24 zapraszają na
                      dwudniową pielgrzymkę rowerową z Krakowa do Częstochowy.
                    </p>
                    <p>
                      Jedziemy razem, w duchu modlitwy i wysiłku, z noclegiem w Domaniewicach po pierwszym etapie.
                    </p>
                    <div className="rw-hero-actions">
                      <a className="cta" href="/#/event/rowerowa26?sekcja=zapisy">Zapisz się</a>
                      <a className="ghost" href="/#/event/rowerowa26?sekcja=trasa">Zobacz trasę</a>
                    </div>
                    <small>Zapisy przez formularz poniżej. Liczba miejsc może być ograniczona.</small>
                  </div>
                </section>

                <section className="rw-section">
                  <header>
                    <h2>O wydarzeniu</h2>
                    <p>Dwa dni w drodze, wspólnota na trasie i cel w postaci Jasnej Góry.</p>
                  </header>
                  <div className="rw-section-body">
                    <p>
                      Rowerowa Częstochowa to pielgrzymka łącząca wysiłek fizyczny z modlitwą. Wyruszamy z Krakowa,
                      dołączając kolejnych uczestników w Mistrzejowicach i Zielonkach, i jedziemy w stronę
                      Częstochowy.
                    </p>
                    <p>
                      Pierwszy dzień kończymy noclegiem w Domaniewicach. Drugiego dnia kontynuujemy jazdę aż do
                      Częstochowy, gdzie pielgrzymka osiąga swój cel — sanktuarium na Jasnej Górze.
                    </p>
                    <p>
                      Trasa jest wymagająca dystansem i przewyższeniami, dlatego jedziemy w grupie, dbając o siebie
                      nawzajem i dostosowując tempo do możliwości uczestników.
                    </p>
                  </div>
                </section>
              </div>
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
          className: 'rw-layer rw-layer-bg',
          minHeightPx: 1850,
          content: <div className="rw-layer-bg-fill rw-layer-bg-fill-2" />
        },
        {
          id: 'type',
          className: 'rw-layer rw-layer-type',
          minHeightPx: 1980,
          content: (
            <div className="rw-type-banner" aria-hidden="true">
              <span className="rw-type-word">KRAKÓW</span>
              <span className="rw-type-word rw-type-word-alt">CZĘSTOCHOWA</span>
            </div>
          )
        },
        {
          id: 'content',
          className: 'event-template-slide-content-layer rw-content-layer',
          interactive: true,
          scrollReference: true,
          content: (
            <div className="rw-content">
              <div className="event-template-slide-inner">
                <section className="rw-section">
                  <header>
                    <h2>Trasa</h2>
                    <p>Dwa etapy, łącznie ponad 130 km, z noclegiem w Domaniewicach.</p>
                  </header>
                  <div className="rw-card-grid">
                    <article className="rw-card rw-card--day">
                      <h3>Dzień 1 — 28.08.2026 (piątek)</h3>
                      <ul>
                        <li><span>Godziny:</span> 14:00-20:00</li>
                        <li><span>Dystans:</span> 53,1 km</li>
                        <li><span>Podjazdy:</span> ↗ 580 m</li>
                        <li><span>Zjazdy:</span> ↘ 470 m</li>
                        <li><span>Start:</span> Kraków (z dołączeniem w Mistrzejowicach i Zielonkach)</li>
                        <li><span>Meta dnia / nocleg:</span> Domaniewice</li>
                      </ul>
                    </article>
                    <article className="rw-card rw-card--day">
                      <h3>Dzień 2 — 29.08.2026 (sobota)</h3>
                      <ul>
                        <li><span>Godziny:</span> 8:00-18:00</li>
                        <li><span>Dystans:</span> 78,3 km</li>
                        <li><span>Podjazdy:</span> ↗ 890 m</li>
                        <li><span>Zjazdy:</span> ↘ 570 m</li>
                        <li><span>Start:</span> Domaniewice</li>
                        <li><span>Meta:</span> Częstochowa</li>
                      </ul>
                    </article>
                  </div>
                  <p className="rw-inline-note">
                    Dokładne godziny dołączenia w poszczególnych punktach (Kraków, Mistrzejowice, Zielonki i dalej
                    na trasie) organizator potwierdzi bliżej terminu wydarzenia.
                  </p>
                </section>
              </div>
            </div>
          )
        }
      ]
    },
    {
      id: 'nocleg-i-logistyka',
      menuLabel: 'Nocleg i logistyka',
      title: 'Nocleg i logistyka',
      heightMode: 'content',
      tone: 'tone-4',
      layers: [
        {
          id: 'bg',
          className: 'rw-layer rw-layer-bg',
          minHeightPx: 1750,
          content: <div className="rw-layer-bg-fill rw-layer-bg-fill-3" />
        },
        {
          id: 'type',
          className: 'rw-layer rw-layer-type',
          minHeightPx: 1880,
          content: (
            <div className="rw-type-banner" aria-hidden="true">
              <span className="rw-type-word">NOCLEG</span>
              <span className="rw-type-word rw-type-word-alt">BAGAŻE</span>
            </div>
          )
        },
        {
          id: 'content',
          className: 'event-template-slide-content-layer rw-content-layer',
          interactive: true,
          scrollReference: true,
          content: (
            <div className="rw-content">
              <div className="event-template-slide-inner">
                <section className="rw-section">
                  <header>
                    <h2>Nocleg i logistyka</h2>
                    <p>To, co warto wiedzieć przed zgłoszeniem — dokładne wybory podajesz w formularzu zapisu.</p>
                  </header>
                  <div className="rw-card-grid">
                    <article className="rw-card">
                      <h3>Nocleg w piątek</h3>
                      <p>Domaniewice: hostel (własny śpiwór) albo własny namiot. Możliwy jest też powrót do domu na noc lub dołączenie dopiero w sobotę.</p>
                    </article>
                    <article className="rw-card">
                      <h3>Posiłki</h3>
                      <p>Do wyboru: kolacja w piątek, śniadanie i obiad w sobotę, kolacja w sobotę oraz przekąski w drodze. Możesz też wozić własne jedzenie.</p>
                    </article>
                    <article className="rw-card">
                      <h3>Bagaż</h3>
                      <p>Bagaże jedzie samochodem wsparcia. Wskazujesz punkt oddania bagażu (Kraków, Mistrzejowice, Zielonki lub Domaniewice) i punkt odbioru (Częstochowa, Zielonki, Mistrzejowice lub Kraków).</p>
                    </article>
                    <article className="rw-card">
                      <h3>Rower po pielgrzymce</h3>
                      <p>Rower można oddać do transportu powrotnego (odbiór w Krakowie, Mistrzejowicach lub Zielonkach) albo wracać na rowerze lub własnym transportem.</p>
                    </article>
                    <article className="rw-card">
                      <h3>Powrót z Częstochowy</h3>
                      <p>Możesz poprosić o zorganizowanie powrotu, wracać samodzielnie, zaoferować wolne miejsca w aucie innym uczestnikom albo zostać w Częstochowie na noc.</p>
                    </article>
                  </div>
                </section>
              </div>
            </div>
          )
        }
      ]
    },
    {
      id: 'bezpieczenstwo',
      menuLabel: 'Bezpieczeństwo',
      title: 'Bezpieczeństwo',
      heightMode: 'content',
      tone: 'tone-2',
      layers: [
        {
          id: 'bg',
          className: 'rw-layer rw-layer-bg',
          minHeightPx: 1650,
          content: <div className="rw-layer-bg-fill rw-layer-bg-fill-4" />
        },
        {
          id: 'type',
          className: 'rw-layer rw-layer-type',
          minHeightPx: 1780,
          content: (
            <div className="rw-type-banner" aria-hidden="true">
              <span className="rw-type-word">KASK</span>
              <span className="rw-type-word rw-type-word-alt">ZASADY</span>
            </div>
          )
        },
        {
          id: 'content',
          className: 'event-template-slide-content-layer rw-content-layer',
          interactive: true,
          scrollReference: true,
          content: (
            <div className="rw-content">
              <div className="event-template-slide-inner">
                <section className="rw-section">
                  <header>
                    <h2>Bezpieczeństwo</h2>
                    <p>Jedziemy razem, ale każdy uczestnik odpowiada za swoje przygotowanie i sprzęt.</p>
                  </header>
                  <div className="rw-section-body">
                    <ul>
                      <li>Kask jest obowiązkowy i musi być używany przez cały czas jazdy.</li>
                      <li>Rower musi być sprawny technicznie: hamulce, oświetlenie, opony.</li>
                      <li>Każdy uczestnik jedzie zgodnie z przepisami ruchu drogowego i na własną odpowiedzialność.</li>
                      <li>W formularzu zapisu prosimy o ocenę własnego poziomu przygotowania rowerowego, żeby dobrze zaplanować tempo grupy.</li>
                    </ul>
                    <p className="rw-important-note">
                      Zgłoszenie na pielgrzymkę wymaga potwierdzenia powyższych zasad bezpieczeństwa w formularzu.
                    </p>
                  </div>
                </section>
              </div>
            </div>
          )
        }
      ]
    },
    {
      id: 'faq',
      menuLabel: 'FAQ',
      title: 'FAQ',
      heightMode: 'content',
      tone: 'tone-3',
      layers: [
        {
          id: 'bg',
          className: 'rw-layer rw-layer-bg',
          minHeightPx: 1850,
          content: <div className="rw-layer-bg-fill" />
        },
        {
          id: 'type',
          className: 'rw-layer rw-layer-type',
          minHeightPx: 2000,
          content: (
            <div className="rw-type-banner" aria-hidden="true">
              <span className="rw-type-word">FAQ</span>
              <span className="rw-type-word rw-type-word-alt">ODPOWIEDZI</span>
            </div>
          )
        },
        {
          id: 'content',
          className: 'event-template-slide-content-layer rw-content-layer',
          interactive: true,
          scrollReference: true,
          content: (
            <div className="rw-content">
              <div className="event-template-slide-inner">
                <section className="rw-section">
                  <header>
                    <h2>FAQ</h2>
                  </header>
                  <div className="rw-faq-list">
                    {FAQ_ITEMS.map((item) => (
                      <details key={item.question}>
                        <summary>{item.question}</summary>
                        <p>{item.answer}</p>
                      </details>
                    ))}
                  </div>
                </section>
              </div>
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
      tone: 'tone-4',
      layers: [
        {
          id: 'bg',
          className: 'rw-layer rw-layer-bg',
          minHeightPx: 2500,
          content: <div className="rw-layer-bg-fill rw-layer-bg-fill-2" />
        },
        {
          id: 'type',
          className: 'rw-layer rw-layer-type',
          minHeightPx: 2650,
          content: (
            <div className="rw-type-banner" aria-hidden="true">
              <span className="rw-type-word">ZAPISY</span>
              <span className="rw-type-word rw-type-word-alt">2026</span>
            </div>
          )
        },
        {
          id: 'content',
          className: 'event-template-slide-content-layer rw-content-layer',
          interactive: true,
          scrollReference: true,
          content: (
            <div className="rw-content">
              <div className="event-template-slide-inner">
                <section className="rw-section rw-section-cta">
                  <header>
                    <h2>Zapisy</h2>
                    <h3>Zapisz się na Rowerową Częstochowę 2026</h3>
                    <p>
                      Wypełnij formularz, żeby zgłosić swój udział. Pomoże nam to zaplanować nocleg, posiłki,
                      transport bagażu i bezpieczeństwo na trasie.
                    </p>
                  </header>

                  {siteLoading ? <p className="rw-inline-note">Ładowanie konfiguracji zapisów...</p> : null}
                  {siteError ? <p className="pilgrimage-error">{siteError}</p> : null}

                  <form className="rw-form" onSubmit={(eventForm) => void handleSubmit(eventForm)}>
                    <div className="rw-form-grid">
                      <label>
                        Imię i nazwisko
                        <input
                          value={form.fullName}
                          onChange={(eventInput) => setForm((previous) => ({ ...previous, fullName: eventInput.target.value }))}
                          required
                        />
                      </label>
                      <label>
                        Telefon
                        <input
                          value={form.phone}
                          onChange={(eventInput) => setForm((previous) => ({ ...previous, phone: eventInput.target.value }))}
                          required
                        />
                      </label>
                      <label>
                        E-mail
                        <input
                          type="email"
                          value={form.email}
                          onChange={(eventInput) => setForm((previous) => ({ ...previous, email: eventInput.target.value }))}
                          required
                        />
                      </label>
                    </div>

                    <label>
                      Gdzie dołączasz do pielgrzymki?
                      <select
                        value={form.joinPoint}
                        onChange={(eventInput) => setForm((previous) => ({ ...previous, joinPoint: eventInput.target.value }))}
                      >
                        {JOIN_POINTS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Czy korzystasz z noclegu w piątek?
                      <select
                        value={form.fridayAccommodation}
                        onChange={(eventInput) => setForm((previous) => ({ ...previous, fridayAccommodation: eventInput.target.value }))}
                      >
                        {FRIDAY_ACCOMMODATION_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </label>

                    <fieldset className="rw-fieldset">
                      <legend>Z których posiłków chcesz korzystać?</legend>
                      <div className="rw-checkbox-grid">
                        {MEAL_OPTIONS.map((meal) => (
                          <label key={meal} className="rw-checkbox-row">
                            <input
                              type="checkbox"
                              checked={form.meals.includes(meal)}
                              onChange={() => toggleMeal(meal)}
                            />
                            {meal}
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <label>
                      Co robisz po pielgrzymce?
                      <select
                        value={form.postPilgrimagePlan}
                        onChange={(eventInput) => setForm((previous) => ({ ...previous, postPilgrimagePlan: eventInput.target.value }))}
                      >
                        {POST_PLAN_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Co się dzieje z Twoim rowerem po pielgrzymce?
                      <select
                        value={form.bikeReturn}
                        onChange={(eventInput) => setForm((previous) => ({ ...previous, bikeReturn: eventInput.target.value }))}
                      >
                        {BIKE_RETURN_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </label>

                    <div className="rw-form-grid">
                      <label>
                        Gdzie oddajesz swoje bagaże?
                        <select
                          value={form.luggageDropoff}
                          onChange={(eventInput) => setForm((previous) => ({ ...previous, luggageDropoff: eventInput.target.value }))}
                        >
                          {LUGGAGE_DROPOFF_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Gdzie odbierasz swoje bagaże?
                        <select
                          value={form.luggagePickup}
                          onChange={(eventInput) => setForm((previous) => ({ ...previous, luggagePickup: eventInput.target.value }))}
                        >
                          {LUGGAGE_PICKUP_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <fieldset className="rw-fieldset">
                      <legend>Czy jesteś świadomy zasad bezpieczeństwa?</legend>
                      <div className="rw-checkbox-grid">
                        <label className="rw-checkbox-row">
                          <input
                            type="checkbox"
                            checked={form.hasHelmet}
                            onChange={(eventInput) => setForm((previous) => ({ ...previous, hasHelmet: eventInput.target.checked }))}
                            required
                          />
                          Oświadczam, że podczas pielgrzymki będę posiadać kask i będę go używać.
                        </label>
                        <label className="rw-checkbox-row">
                          <input
                            type="checkbox"
                            checked={form.bikeRoadworthy}
                            onChange={(eventInput) => setForm((previous) => ({ ...previous, bikeRoadworthy: eventInput.target.checked }))}
                            required
                          />
                          Rower jest w sprawnym stanie technicznym (hamulce, oświetlenie, opony itd.).
                        </label>
                        <label className="rw-checkbox-row">
                          <input
                            type="checkbox"
                            checked={form.knowsSafetyRules}
                            onChange={(eventInput) => setForm((previous) => ({ ...previous, knowsSafetyRules: eventInput.target.checked }))}
                            required
                          />
                          Znam i będę przestrzegać zasad bezpiecznej jazdy i przepisów; jadę na własną odpowiedzialność.
                        </label>
                      </div>
                    </fieldset>

                    <label>
                      Jak oceniasz swoje możliwości jazdy?
                      <select
                        value={form.skillLevel}
                        onChange={(eventInput) => setForm((previous) => ({ ...previous, skillLevel: eventInput.target.value }))}
                      >
                        {SKILL_LEVEL_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </label>

                    <label>
                      W czym możesz pomóc?
                      <textarea
                        value={form.helpOffer}
                        onChange={(eventInput) => setForm((previous) => ({ ...previous, helpOffer: eventInput.target.value }))}
                        rows={3}
                      />
                      <small>Pole opcjonalne — np. serwis rowerowy, prowadzenie grupy, pierwsza pomoc, auto wsparcia.</small>
                    </label>

                    <p className="rw-consent">
                      Klikając "Wyślij zgłoszenie", potwierdzasz chęć udziału i akceptujesz kontakt organizacyjny.
                      {' '}
                      <a href="/#/legal">Polityka prywatności REcreatio</a>
                    </p>

                    <button className="cta" type="submit" disabled={registrationPending}>
                      {registrationPending ? 'Wysyłanie...' : 'Wyślij zgłoszenie'}
                    </button>

                    {registrationError ? <p className="pilgrimage-error">{registrationError}</p> : null}
                    {registrationSuccess ? <p className="pilgrimage-success">{registrationSuccess}</p> : null}
                  </form>

                  {showProfileMenu ? (
                    <section className="rw-admin-block">
                      <header>
                        <h3>Panel zapisów (administracja)</h3>
                        <p>Widok pełnej listy zgłoszeń Rowerowej Częstochowy 2026.</p>
                      </header>

                      {!site?.isProvisioned ? (
                        <div className="rw-admin-warning">
                          <p>
                            Wydarzenie nie jest jeszcze aktywowane w bazie. Aktywacja przygotuje zapisy i panel admina.
                          </p>
                          <button className="ghost" type="button" onClick={() => void handleProvisionRowerowa()} disabled={provisionPending}>
                            {provisionPending ? 'Aktywowanie...' : 'Aktywuj Rowerową Częstochowę 2026 w systemie'}
                          </button>
                          {provisionError ? <p className="pilgrimage-error">{provisionError}</p> : null}
                        </div>
                      ) : null}

                      {organizerPending ? <p className="rw-inline-note">Ładowanie listy uczestników...</p> : null}
                      {organizerError ? <p className="pilgrimage-error">{organizerError}</p> : null}

                      {organizerDashboard ? (
                        <>
                          <div className="rw-admin-tools">
                            <span className="rw-admin-stat">Zgłoszeń: {organizerDashboard.stats.registrations}</span>
                            <span className="rw-admin-stat">Z Krakowa: {organizerDashboard.stats.joiningFromKrakow}</span>
                            <span className="rw-admin-stat">Hostel w piątek: {organizerDashboard.stats.stayingHostelFriday}</span>
                            <button className="ghost" type="button" onClick={() => void handleExportRegistrations()} disabled={exportPending}>
                              {exportPending ? 'Eksportowanie...' : 'Eksportuj listę zapisów'}
                            </button>
                            {exportError ? <p className="pilgrimage-error">{exportError}</p> : null}
                          </div>

                          <div className="rw-admin-table-wrap">
                            <table>
                              <thead>
                                <tr>
                                  <th>Imię i nazwisko</th>
                                  <th>Telefon</th>
                                  <th>E-mail</th>
                                  <th>Dołączenie</th>
                                  <th>Nocleg piątek</th>
                                  <th>Posiłki</th>
                                  <th>Rower po dojeździe</th>
                                  <th>Poziom</th>
                                  <th>Data zgłoszenia</th>
                                </tr>
                              </thead>
                              <tbody>
                                {participantRows.map((row) => (
                                  <tr key={row.id}>
                                    <td>{row.fullName}</td>
                                    <td>{row.phone}</td>
                                    <td>{row.email}</td>
                                    <td>{row.joinPoint}</td>
                                    <td>{row.fridayAccommodation}</td>
                                    <td>{row.meals.join(', ')}</td>
                                    <td>{row.bikeReturn}</td>
                                    <td>{row.skillLevel}</td>
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
            </div>
          )
        }
      ]
    },
    {
      id: 'kontakt',
      menuLabel: 'Kontakt',
      title: 'Kontakt',
      heightMode: 'content',
      tone: 'tone-5',
      layers: [
        {
          id: 'bg',
          className: 'rw-layer rw-layer-bg',
          minHeightPx: 1500,
          content: <div className="rw-layer-bg-fill rw-layer-bg-fill-3" />
        },
        {
          id: 'type',
          className: 'rw-layer rw-layer-type',
          minHeightPx: 1700,
          content: (
            <div className="rw-type-banner" aria-hidden="true">
              <span className="rw-type-word">KONTAKT</span>
              <span className="rw-type-word rw-type-word-alt">PIELGRZYMKA</span>
            </div>
          )
        },
        {
          id: 'content',
          className: 'event-template-slide-content-layer rw-content-layer',
          interactive: true,
          scrollReference: true,
          content: (
            <div className="rw-content">
              <div className="event-template-slide-inner">
                <section className="rw-section">
                  <header>
                    <h2>Kontakt</h2>
                  </header>
                  <div className="rw-section-body">
                    <p>
                      Organizatorem jest Parafia Narodzenia NMP w Zielonkach z mistrzejowicką grupą pielgrzymkową 24.
                      Masz pytania dotyczące zapisów, trasy albo logistyki? Skontaktuj się bezpośrednio.
                    </p>
                  </div>
                  <div className="rw-contact-grid">
                    <article className="rw-contact-card">
                      <h3>E-mail</h3>
                      <p>
                        <a href="mailto:mleczek_pradnik@outlook.com">mleczek_pradnik@outlook.com</a>
                      </p>
                    </article>
                    <article className="rw-contact-card">
                      <h3>Telefon</h3>
                      <p>
                        <a href="tel:+48505548677">+48 505 548 677</a>
                      </p>
                    </article>
                  </div>
                  <div className="rw-contact-actions">
                    <a className="ghost" href="mailto:mleczek_pradnik@outlook.com">Napisz wiadomość</a>
                  </div>
                </section>
              </div>
            </div>
          )
        }
      ]
    }
  ];

  return <EventSinglePageTemplate {...props} event={props.event} slides={slides} />;
}
