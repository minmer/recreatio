import { useEffect, useMemo, useRef, useState, type ChangeEvent, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LanguageSelect } from '../../components/LanguageSelect';
import { AuthAction } from '../../components/AuthAction';
import {
  ApiError,
  createPilgrimageAnnouncement,
  createPilgrimageContactInquiry,
  createPilgrimageParticipantIssue,
  createPilgrimageRegistration,
  createPilgrimageTask,
  deletePilgrimageInquiry,
  exportPilgrimageRegistrations,
  getPilgrimagePublicInquiryAnswers,
  getPilgrimageExportUrl,
  getPilgrimageOrganizerDashboard,
  getPilgrimageParticipantZone,
  getPilgrimageSite,
  importPilgrimageRegistrations,
  updatePilgrimageIssue,
  updatePilgrimageInquiry,
  updatePilgrimageParticipant,
  updatePilgrimageTask,
  type PilgrimageOrganizerDashboard,
  type PilgrimagePublicInquiryAnswer,
  type PilgrimageRegistrationTransferRow,
  type PilgrimageParticipantZone,
  type PilgrimageSection,
  type PilgrimageSite
} from '../../lib/api';
import { normalizePolishPhone } from '../../lib/phone';
import { PILGRIMAGE_START_SVG } from './pilgrimageStartSvg';
import type { EventDefinition, EventInnerPage, SharedEventPageProps } from './eventTypes';
import { InformationPage } from './InformationPage';
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
  isPublicQuestion: boolean;
  email: string;
  topic: string;
  message: string;
};

const defaultContactForm: ContactFormState = {
  name: '',
  phone: '',
  isPublicQuestion: false,
  email: '',
  topic: 'Pytanie organizacyjne',
  message: ''
};

function buildInquirySmsHref(phone: string | null | undefined, topic: string, answer: string) {
  const rawPhone = (phone ?? '').trim();
  if (!rawPhone) {
    return '';
  }
  const smsPhone = rawPhone.replace(/[^\d+]/g, '');
  const answerText = answer.trim();
  if (!answerText) {
    return '';
  }
  const message =
    `Szczęść Boże,\n` +
    `odpowiedź na pytanie: ${topic}\n\n` +
    `${answerText}\n\n` +
    `Pozdrawiamy,\nOrganizatorzy pielgrzymki`;
  return `sms:${smsPhone}?body=${encodeURIComponent(message)}`;
}

function PilgrimageStoneMap() {
  const graphicRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = graphicRef.current;
    if (!root) {
      return;
    }
    const svgElement = root.querySelector('svg');
    if (svgElement) {
      svgElement.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    }

    const jumpToClickableGroup = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      const target = root.querySelector<SVGGraphicsElement>('#path1064');
      if (!target) {
        return;
      }
      const top = window.scrollY + target.getBoundingClientRect().top - 24;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    };

    const jumpIds = ['path6244', 'text80535', 'text123617', 'tspan91363', 'tspan123615'];
    const boundElements: Element[] = [];
    const textIds = ['text80535', 'text123617', 'tspan91363', 'tspan123615'];
    const textBoundElements: Element[] = [];
    const headerPath = root.querySelector<SVGGraphicsElement>('#path6244');
    const ctaGlowConfig = [
      { textId: 'cta-info', pathId: 'path1066', glowClass: 'text-hover-glow-red' },
      { textId: 'cta-plan', pathId: 'path1064', glowClass: 'text-hover-glow-green' },
      { textId: 'cta-zapisy', pathId: 'path884', glowClass: 'text-hover-glow-yellow' },
      { textId: 'cta-faq', pathId: 'path15214', glowClass: 'text-hover-glow-green' },
      { textId: 'cta-historia', pathId: 'path14290', glowClass: 'text-hover-glow-red' },
      { textId: 'cta-galeria', pathId: 'path14294', glowClass: 'text-hover-glow-yellow' }
    ] as const;
    const ctaHoverBoundElements: Array<{
      element: Element;
      onEnter: () => void;
      onLeave: () => void;
    }> = [];

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

    for (const { textId, pathId, glowClass } of ctaGlowConfig) {
      const textElement = root.querySelector(`#${textId}`);
      const pathElement = root.querySelector<SVGGraphicsElement>(`#${pathId}`);
      if (!textElement || !pathElement) {
        continue;
      }
      const onEnter = () => {
        pathElement.classList.add(glowClass);
        pathElement.classList.add('text-hover-scale');
      };
      const onLeave = () => {
        pathElement.classList.remove(glowClass);
        pathElement.classList.remove('text-hover-scale');
      };
      textElement.addEventListener('mouseenter', onEnter);
      textElement.addEventListener('mouseleave', onLeave);
      textElement.addEventListener('focus', onEnter);
      textElement.addEventListener('blur', onLeave);
      ctaHoverBoundElements.push({ element: textElement, onEnter, onLeave });
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
      for (const { element, onEnter, onLeave } of ctaHoverBoundElements) {
        element.removeEventListener('mouseenter', onEnter);
        element.removeEventListener('mouseleave', onLeave);
        element.removeEventListener('focus', onEnter);
        element.removeEventListener('blur', onLeave);
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

function Kal26FaqPage({ eventSlug }: { eventSlug: string }) {
  const items: Array<{ question: string; answers: string[] }> = [
    {
      question: 'Czym jest ta pielgrzymka?',
      answers: [
        'Kalwaria Zebrzydowska na Wielkanoc to dwudniowa piesza pielgrzymka z Krakowa do Matki Bożej Kalwaryjskiej. Ma charakter modlitewny, wspólnotowy i skupiony. Jej centrum stanowią Tradycja, Cisza i Liturgia.'
      ]
    },
    {
      question: 'Kiedy odbywa się pielgrzymka?',
      answers: ['Pielgrzymka odbędzie się w dniach 17–18 kwietnia 2026.']
    },
    {
      question: 'Skąd wyruszamy?',
      answers: [
        'Pielgrzymkę rozpoczynamy w piątek o 15:30 Mszą Świętą w kościele św. Józefa w Krakowie na Podgórzu.'
      ]
    },
    {
      question: 'Dokąd idziemy pierwszego dnia?',
      answers: ['Pierwszego dnia idziemy z Krakowa do Tyńca. Tam przewidziany jest nocleg.']
    },
    {
      question: 'Dokąd idziemy drugiego dnia?',
      answers: ['Drugiego dnia wychodzimy z Tyńca i idziemy do Kalwarii Zebrzydowskiej.']
    },
    {
      question: 'Czy trzeba mieć doświadczenie pielgrzymkowe?',
      answers: [
        'Nie. Nie trzeba mieć wcześniejszego doświadczenia, ale trzeba być gotowym na pieszą drogę, prostsze warunki i modlitewny charakter pielgrzymki.'
      ]
    },
    {
      question: 'Czy to jest pielgrzymka dla każdego?',
      answers: [
        'Jest to pielgrzymka dla osób, które chcą wejść w jej duch: ciszy, modlitwy, prostoty i wspólnej drogi. To dobra propozycja dla tych, którzy szukają bardziej skupionej formy pielgrzymowania.'
      ]
    },
    {
      question: 'Jak wygląda nocleg?',
      answers: [
        'Nocleg przewidziany jest w Tyńcu. Szczegółowe informacje o jego formie oraz o tym, co trzeba ze sobą zabrać, będą przekazane zapisanym uczestnikom.'
      ]
    },
    {
      question: 'Co trzeba zabrać?',
      answers: [
        'Na pewno potrzebne będą: wygodne obuwie, ubranie odpowiednie do pogody, rzeczy osobiste, coś do siedzenia na postoju, a w przypadku noclegu także wyposażenie potrzebne na noc. Szczegółowa lista zostanie podana osobom zapisanym.'
      ]
    },
    {
      question: 'Czy będzie możliwość przewozu bagażu?',
      answers: [
        'W miarę możliwości organizacyjnych planowany jest przewóz części bagaży [do doprecyzowania zakres i zasady]. Dokładne informacje zostaną przekazane uczestnikom.'
      ]
    },
    {
      question: 'Czy udział jest płatny?',
      answers: [
        'Informacje o ewentualnych kosztach i składce organizacyjnej zostaną podane w aktualnej edycji zapisów [do uzupełnienia].'
      ]
    },
    {
      question: 'Czy można dołączyć tylko na część trasy?',
      answers: [
        'To zależy od zasad przyjętych na daną edycję. Jeśli chcesz dołączyć tylko na część drogi, skontaktuj się wcześniej z organizatorami.'
      ]
    },
    {
      question: 'Czy można wziąć udział tylko jednego dnia?',
      answers: [
        'To również zależy od organizacji konkretnej edycji. Najlepiej skontaktować się wcześniej z organizatorami.'
      ]
    },
    {
      question: 'Czy osoby niepełnoletnie mogą uczestniczyć?',
      answers: ['To wymaga dodatkowych ustaleń oraz spełnienia warunków organizacyjnych [do doprecyzowania].']
    },
    {
      question: 'Co jeśli pogoda będzie zła?',
      answers: [
        'Pielgrzymka odbywa się niezależnie od zwykłych warunków pogodowych, dlatego warto przygotować odpowiednie ubranie i zabezpieczenie przed deszczem lub chłodem. W przypadku wyjątkowych sytuacji organizatorzy przekażą uczestnikom odpowiednie informacje.'
      ]
    },
    {
      question: 'Czy podczas drogi jest czas na ciszę?',
      answers: [
        'Tak. Cisza jest jednym z ważnych elementów tej pielgrzymki. Obok wspólnej modlitwy i śpiewu przewidziany jest również czas na milczenie i modlitwę osobistą.'
      ]
    },
    {
      question: 'Czy na pielgrzymce jest tylko cisza?',
      answers: [
        'Nie. Pielgrzymka nie polega na całkowitym milczeniu. Są momenty wspólnej modlitwy, śpiewu, konferencji i rozmowy, ale jest też wyraźnie chroniona przestrzeń ciszy i skupienia.'
      ]
    },
    {
      question: 'Jak wygląda liturgia podczas pielgrzymki?',
      answers: [
        'Liturgia zajmuje centralne miejsce w całej pielgrzymce. Jej szczytem jest Msza Święta, a ważną częścią drogi są także wspólna modlitwa, śpiew i, w miarę możliwości, Liturgia Godzin.'
      ]
    },
    {
      question: 'Czy mogę pomóc w organizacji pielgrzymki?',
      answers: [
        'Tak. Pielgrzymka żyje dzięki zaangażowaniu ludzi. Jeśli chcesz pomóc organizacyjnie, technicznie, muzycznie, logistycznie lub w inny sposób, skontaktuj się z organizatorami.'
      ]
    },
    {
      question: 'Gdzie mogę zadać dodatkowe pytania?',
      answers: ['Najprościej przez stronę kontaktową. Organizatorzy odpowiedzą na pytania dotyczące udziału i organizacji.']
    }
  ];

  return (
    <div className="kal-text-layout">
      <aside className="kal-text-sidebar">
        <h1>FAQ</h1>
        <p>Najczęściej zadawane pytania i odpowiedzi dotyczące udziału, organizacji i charakteru pielgrzymki.</p>
        <ul>
          <li>20 odpowiedzi na najczęstsze pytania</li>
          <li>Informacje praktyczne przed zapisem</li>
          <li>Szybki kontakt z organizatorami</li>
        </ul>
        <div className="kal-text-actions">
          <a className="ghost" href={`/#/event/${eventSlug}/kontakt`}>Skontaktuj się z nami</a>
        </div>
      </aside>

      <div className="kal-text-content">
        <section className="kal-text-section">
          <h2>Pytania i odpowiedzi</h2>
          <p>Kliknij pytanie, aby rozwinąć odpowiedź.</p>
          <div className="kal-text-faq">
            {items.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                {item.answers.map((answer) => (
                  <p key={`${item.question}-${answer}`}>{answer}</p>
                ))}
              </details>
            ))}
          </div>
        </section>

        <section className="kal-text-section">
          <h2>Nie znalazłeś odpowiedzi?</h2>
          <p>Jeśli Twoje pytanie nie pojawia się powyżej, napisz do nas. Chętnie pomożemy.</p>
          <div className="kal-text-actions">
            <a className="cta" href={`/#/event/${eventSlug}/kontakt`}>Skontaktuj się z nami</a>
          </div>
        </section>
      </div>
    </div>
  );
}

function Kal26HistoryPage({ eventSlug }: { eventSlug: string }) {
  return (
    <div className="kal-text-layout">
      <aside className="kal-text-sidebar">
        <h1>Historia pielgrzymki</h1>
        <p>Jak zrodziła się droga do Kalwarii Zebrzydowskiej na Wielkanoc i jak dojrzewała jej obecna forma.</p>
        <ul>
          <li>Początek: rok 2020</li>
          <li>Pierwsza edycja: 17.04.2021</li>
          <li>Duch drogi: Tradycja, Cisza, Liturgia</li>
        </ul>
        <div className="kal-text-actions">
          <a className="cta" href={`/#/event/${eventSlug}/zapisy`}>Zapisz się</a>
          <a className="ghost" href={`/#/event/${eventSlug}/plan`}>Zobacz plan</a>
        </div>
      </aside>

      <div className="kal-text-content">
        <section className="kal-text-section">
          <h2>Początek w roku 2020</h2>
          <p>
            Historia tej pielgrzymki zaczyna się w roku 2020. Obostrzenia pandemiczne i związane z nimi trudności
            sprawiły, że wiele osób nie mogło uczestniczyć w pielgrzymce krakowskiej. Sama potrzeba drogi, modlitwy i
            pielgrzymowania jednak nie zniknęła.
          </p>
          <p>
            Po kilku spotkaniach zrodziła się inicjatywa, aby pójść pieszo na Jasną Górę. Nie była to klasyczna
            pielgrzymka, ale raczej prosty pielgrzymkowy spacer: w małych grupach, dwójkami i trójkami, z wyznaczonymi
            miejscami spotkań. Było w tym dużo ciszy, dużo modlitwy osobistej i dużo wzajemnego wsparcia w drodze.
          </p>
        </section>

        <section className="kal-text-section">
          <h2>Od pragnienia drogi do konkretnej inicjatywy</h2>
          <p>
            Kiedy wyruszaliśmy na ostatni odcinek tamtej drogi, zrodziło się pragnienie, aby także w przyszłości
            organizować taki pielgrzymkowy spacer. Rzucony mimochodem termin — sobota po Niedzieli Miłosierdzia Bożego —
            stał się początkiem pielgrzymki do Kalwarii Zebrzydowskiej.
          </p>
          <p>
            Nie była to inicjatywa odgórna. Powstała z potrzeby ludzi, którzy pragnęli ciszy. W ciągu jednego tygodnia
            zorganizowała się grupa 10 osób z parafii św. Maksymiliana. I tak, 17 kwietnia 2021 roku, wyruszyli oni z
            Tyńca do Matki Bożej Kalwaryjskiej.
          </p>
        </section>

        <section className="kal-text-section">
          <h2>Pierwsze pielgrzymowanie</h2>
          <p>
            Pierwsza pielgrzymka zakończyła się Mszą Świętą w kaplicy III Upadku. W kolejnych latach dołączali pielgrzymi
            z następnych parafii, a sama droga zaczęła się rozwijać. Część uczestników wyruszała już z centrum Krakowa —
            z Wawelu — a część z Tyńca, by razem iść do Kalwarii Zebrzydowskiej.
          </p>
          <p>
            Z czasem rozeznaliśmy, że dłuższą trasę warto podzielić na dwa dni, aby pielgrzymka mogła zachować swój
            modlitewny charakter i rytm. Tak ukształtowała się obecna forma: pierwszy dzień z Krakowa do Tyńca, drugi
            dzień z Tyńca do Kalwarii Zebrzydowskiej.
          </p>
        </section>

        <section className="kal-text-section">
          <h2>Pielgrzymka, która wyrasta z potrzeby ciszy</h2>
          <p>
            Ta pielgrzymka od początku nie była budowana wokół rozmachu, liczby atrakcji czy dużej oprawy. Powstała
            oddolnie i do dziś zachowuje ten sam duch: prostotę, skupienie, modlitwę i otwartość na to, co naprawdę
            istotne.
          </p>
          <p>
            Jest próbą odzyskiwania przestrzeni na ciszę, na liturgię przeżywaną z uwagą, na drogę przeżywaną razem, ale
            bez nadmiaru bodźców. To właśnie ten duch sprawia, że pielgrzymka pozostaje żywa i potrzebna.
          </p>
        </section>

        <section className="kal-text-section">
          <h2>To, co kształtuje tę drogę</h2>
          <p>Od początku pielgrzymka koncentruje się wokół trzech słów: Tradycja, Cisza, Liturgia.</p>
          <p>
            Tradycja oznacza dla nas nie tylko pamięć o dawnych zwyczajach, ale żywe wejście w dziedzictwo Kościoła —
            przez śpiew, modlitwę, prostotę i sposób przeżywania drogi.
          </p>
          <p>
            Cisza oznacza pragnienie wewnętrznego skupienia i uwolnienia się od codziennego hałasu. Nie chodzi tylko o
            brak słów, ale o stworzenie przestrzeni, w której człowiek może naprawdę być przed Bogiem.
          </p>
          <p>
            Liturgia zajmuje miejsce centralne. Wszystko ma do niej prowadzić i z niej wypływać. To właśnie wokół niej
            układa się sens tej pielgrzymki.
          </p>
        </section>

        <section className="kal-text-section">
          <h2>Patrzymy dalej</h2>
          <p>
            Na razie pielgrzymka ma formę dwóch dni drogi połączonych noclegiem w Tyńcu. W kolejnych latach chcielibyśmy
            rozwijać także część wieczorną: spotkania, warsztaty muzyczno-liturgiczne oraz wspólną adorację Najświętszego
            Sakramentu — na tyle, na ile będzie to możliwe.
          </p>
          <p>
            Zależy nam, aby pielgrzymka była nie tylko drogą do celu, ale także przestrzenią odkrywania piękna modlitwy,
            liturgii i wspólnoty Kościoła.
          </p>
        </section>

        <section className="kal-text-section">
          <h2>Ta historia wciąż się pisze</h2>
          <p>
            Każda kolejna edycja pielgrzymki dopisuje do tej historii nowe osoby, nowe doświadczenia i nowe świadectwa.
            Jeśli chcesz wyruszyć z nami, zapraszamy do wspólnej drogi.
          </p>
          <div className="kal-text-actions">
            <a className="cta" href={`/#/event/${eventSlug}/zapisy`}>Zapisz się</a>
            <a className="ghost" href={`/#/event/${eventSlug}/plan`}>Zobacz plan</a>
          </div>
        </section>
      </div>
    </div>
  );
}

function Kal26ContactPage({
  eventSlug,
  contactForm,
  setContactForm,
  handleContactSubmit,
  contactPending,
  contactError,
  contactSuccess,
  publicContactAnswers,
  publicContactAnswersPending,
  publicContactAnswersError,
  showProfileMenu,
  organizerDashboard,
  inquiryDrafts,
  setInquiryDrafts,
  handleInquiryUpdate,
  handleInquiryDelete,
  organizerSavingId,
  organizerActionError
}: {
  eventSlug: string;
  contactForm: ContactFormState;
  setContactForm: Dispatch<SetStateAction<ContactFormState>>;
  handleContactSubmit: (eventForm: FormEvent) => Promise<void>;
  contactPending: boolean;
  contactError: string | null;
  contactSuccess: string | null;
  publicContactAnswers: PilgrimagePublicInquiryAnswer[];
  publicContactAnswersPending: boolean;
  publicContactAnswersError: string | null;
  showProfileMenu: boolean;
  organizerDashboard: PilgrimageOrganizerDashboard | null;
  inquiryDrafts: Record<string, { status: string; publicAnswer: string }>;
  setInquiryDrafts: Dispatch<SetStateAction<Record<string, { status: string; publicAnswer: string }>>>;
  handleInquiryUpdate: (inquiryId: string) => Promise<void>;
  handleInquiryDelete: (inquiryId: string) => Promise<void>;
  organizerSavingId: string | null;
  organizerActionError: string | null;
}) {
  return (
    <div className="kal-text-layout">
      <aside className="kal-text-sidebar">
        <h1>Kontakt</h1>
        <p>Masz pytanie? Napisz do organizatorów pielgrzymki.</p>
        <ul>
          <li>Kontakt główny: ks. Michał Mleczek</li>
          <li>Formularz działa także dla osób niezalogowanych</li>
          <li>Odpowiedzi organizatorów publikowane są poniżej</li>
        </ul>
      </aside>

      <div className="kal-text-content">
        <section className="kal-text-section">
          <h2>Napisz do nas</h2>
          <form onSubmit={(eventForm) => void handleContactSubmit(eventForm)}>
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
                  required={!contactForm.isPublicQuestion}
                />
                <small>
                  {contactForm.isPublicQuestion
                    ? 'Przy pytaniu publicznym telefon jest zalecany (ułatwia szybki kontakt), ale nieobowiązkowy.'
                    : 'Przy pytaniu prywatnym telefon jest wymagany.'}
                </small>
              </label>
              <label>
                Rodzaj odpowiedzi
                <select
                  value={contactForm.isPublicQuestion ? 'public' : 'private'}
                  onChange={(eventInput) =>
                    setContactForm((previous) => ({ ...previous, isPublicQuestion: eventInput.target.value === 'public' }))
                  }
                >
                  <option value="private">Odpowiedź prywatna (telefon wymagany)</option>
                  <option value="public">Odpowiedź publiczna (telefon zalecany, pytanie może być opublikowane)</option>
                </select>
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

        <section className="kal-text-section">
          <h2>Publiczne odpowiedzi organizatorów</h2>
          {publicContactAnswersPending ? <p>Ladowanie odpowiedzi...</p> : null}
          {publicContactAnswersError ? <p className="pilgrimage-error">{publicContactAnswersError}</p> : null}
          {!publicContactAnswersPending && publicContactAnswers.length === 0 ? (
            <p>Brak opublikowanych odpowiedzi.</p>
          ) : null}
          <div className="kal-public-answers">
            {publicContactAnswers.map((answer) => (
              <article key={answer.id} className="kal-public-answer">
                <h3>{answer.topic}</h3>
                <p><strong>Pytanie:</strong> {answer.message}</p>
                <p><strong>Odpowiedz:</strong> {answer.publicAnswer}</p>
                <small>
                  {answer.publicAnsweredBy ?? 'Organizator'}{' '}
                  {answer.publicAnsweredUtc ? `• ${new Date(answer.publicAnsweredUtc).toLocaleString()}` : ''}
                </small>
              </article>
            ))}
          </div>
        </section>

        {showProfileMenu && organizerDashboard ? (
          <section className="kal-text-section">
            <h2>Panel odpowiedzi (zalogowani)</h2>
            {organizerActionError ? <p className="pilgrimage-error">{organizerActionError}</p> : null}
            <div className="kal-contact-admin-list">
              {organizerDashboard.inquiries.map((entry) => (
                <article key={entry.id} className="kal-contact-admin-item">
                  <h3>{entry.topic} - {entry.name}</h3>
                  <p>{entry.message}</p>
                  <small>{entry.isPublicQuestion ? 'Pytanie publiczne' : 'Pytanie prywatne'}</small>
                  <label>
                    Status
                    <select
                      value={inquiryDrafts[entry.id]?.status ?? entry.status}
                      onChange={(eventInput) =>
                        setInquiryDrafts((previous) => ({
                          ...previous,
                          [entry.id]: {
                            status: eventInput.target.value,
                            publicAnswer: previous[entry.id]?.publicAnswer ?? entry.publicAnswer ?? ''
                          }
                        }))
                      }
                    >
                      <option value="new">new</option>
                      <option value="in-progress">in-progress</option>
                      <option value="resolved">resolved</option>
                      <option value="closed">closed</option>
                    </select>
                  </label>
                  <label>
                    Publiczna odpowiedz
                    <textarea
                      value={inquiryDrafts[entry.id]?.publicAnswer ?? entry.publicAnswer ?? ''}
                      onChange={(eventInput) =>
                        setInquiryDrafts((previous) => ({
                          ...previous,
                          [entry.id]: {
                            status: previous[entry.id]?.status ?? entry.status,
                            publicAnswer: eventInput.target.value
                          }
                        }))
                      }
                      placeholder="Ta odpowiedz bedzie widoczna publicznie na stronie kontaktu."
                    />
                  </label>
                  <button
                    className="ghost"
                    onClick={() => void handleInquiryUpdate(entry.id)}
                    disabled={organizerSavingId === `inquiry:${entry.id}`}
                  >
                    {organizerSavingId === `inquiry:${entry.id}` ? 'Zapisywanie...' : 'Zapisz odpowiedz'}
                  </button>
                  {entry.phone ? (
                    <a
                      className="ghost"
                      href={buildInquirySmsHref(
                        entry.phone,
                        entry.topic,
                        inquiryDrafts[entry.id]?.publicAnswer ?? entry.publicAnswer ?? ''
                      ) || undefined}
                      onClick={(eventClick) => {
                        const href = buildInquirySmsHref(
                          entry.phone,
                          entry.topic,
                          inquiryDrafts[entry.id]?.publicAnswer ?? entry.publicAnswer ?? ''
                        );
                        if (!href) {
                          eventClick.preventDefault();
                        }
                      }}
                    >
                      Wyślij SMS z odpowiedzią
                    </a>
                  ) : null}
                  <button
                    className="ghost"
                    onClick={() => void handleInquiryDelete(entry.id)}
                    disabled={organizerSavingId === `inquiry:${entry.id}`}
                  >
                    {organizerSavingId === `inquiry:${entry.id}` ? 'Usuwanie...' : 'Usun pytanie'}
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="kal-text-section">
          <h2>Kontakt bezpośredni</h2>
          <p>Osoba kontaktowa: ks. Michał Mleczek.</p>
          <div className="kal-text-actions">
            <a className="ghost" href={`/#/event/${eventSlug}/faq`}>Zobacz FAQ</a>
          </div>
        </section>
      </div>
    </div>
  );
}

function Kal26GalleryPage() {
  return (
    <div className="kal-text-layout">
      <aside className="kal-text-sidebar">
        <h1>Galeria</h1>
        <p>Podstrona w budowie.</p>
        <ul>
          <li>Zdjęcia z trasy</li>
          <li>Nagrania śpiewu i modlitwy</li>
          <li>Materiały z kolejnych edycji</li>
        </ul>
      </aside>

      <div className="kal-text-content">
        <section className="kal-text-section">
          <h2>Co będzie tutaj?</h2>
          <p>
            W tej sekcji pojawi się galeria zdjęć i materiałów z pielgrzymki: wyjście z Krakowa, droga do Tyńca, nocleg,
            sobotni etap oraz dojście do Kalwarii Zebrzydowskiej.
          </p>
          <p>
            Na ten moment podstrona jest przygotowana jako miejsce docelowe pod materiały archiwalne i bieżące relacje.
          </p>
        </section>
      </div>
    </div>
  );
}

function Kal26RegisterPage({
  registrationForm,
  setRegistrationForm,
  handleSimpleRegistrationSubmit,
  registrationPending,
  registrationError,
  registrationNotice,
  registrationResult
}: {
  registrationForm: RegistrationFormState;
  setRegistrationForm: Dispatch<SetStateAction<RegistrationFormState>>;
  handleSimpleRegistrationSubmit: (eventForm: FormEvent) => Promise<void>;
  registrationPending: boolean;
  registrationError: string | null;
  registrationNotice: string | null;
  registrationResult: { link: string; token: string } | null;
}) {
  return (
    <div className="kal-text-layout">
      <aside className="kal-text-sidebar">
        <h1>Zapisy</h1>
        <p>Wypełnij formularz i zapisz się na pielgrzymkę.</p>
        <ul>
          <li>Imię i nazwisko</li>
          <li>Numer telefonu</li>
          <li>Miejsce rozpoczęcia drogi</li>
          <li>Zgody formalne</li>
        </ul>
      </aside>

      <div className="kal-text-content">
        <section className="kal-text-section">
          <h2>Formularz zapisów</h2>
          <form onSubmit={(eventForm) => void handleSimpleRegistrationSubmit(eventForm)}>
            <div className="pilgrimage-form-grid">
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
                Numer telefonu
                <input
                  value={registrationForm.phone}
                  onChange={(eventInput) =>
                    setRegistrationForm((previous) => ({ ...previous, phone: eventInput.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Gdzie chcesz rozpocząć pielgrzymkę?
                <select
                  value={registrationForm.parish}
                  onChange={(eventInput) =>
                    setRegistrationForm((previous) => ({ ...previous, parish: eventInput.target.value }))
                  }
                  required
                >
                  <option value="">Wybierz miejsce startu</option>
                  <option value="Kraków Podgórze (kościół św. Józefa, 15:30)">Kraków Podgórze (kościół św. Józefa)</option>
                  <option value="Tyniec (start drugiego dnia)">Tyniec (start drugiego dnia)</option>
                  <option value="Dołączenie po drodze (do uzgodnienia)">Dołączenie po drodze (do uzgodnienia)</option>
                </select>
              </label>
              <label className="full-width">
                Dodatkowe informacje
                <textarea
                  value={registrationForm.healthNotes}
                  onChange={(eventInput) =>
                    setRegistrationForm((previous) => ({ ...previous, healthNotes: eventInput.target.value }))
                  }
                  placeholder="Np. ważne informacje organizacyjne, pytania lub uwagi."
                />
              </label>
            </div>

            <div className="pilgrimage-form-checks">
              <p>
                Zasady przetwarzania danych i formalności znajdziesz tutaj:{' '}
                <a href="/#/legal">RODO i regulaminy Recreatio</a>.
              </p>
              <p>
                Klikając przycisk zapisu, akceptujesz wymagane zgody formalne, w tym RODO i zgodę na wykorzystanie
                materiałów zdjęciowych do celów promocyjnych pielgrzymki.
              </p>
            </div>

            <button className="cta" type="submit" disabled={registrationPending}>
              {registrationPending ? 'Wysyłanie...' : 'Zapisz się i akceptuję zgody'}
            </button>
            {registrationError ? <p className="pilgrimage-error">{registrationError}</p> : null}
            {registrationNotice ? <p className="pilgrimage-success">{registrationNotice}</p> : null}
            {registrationResult ? (
              <p className="pilgrimage-success">
                Zapis został przyjęty. Link uczestnika: <a href={registrationResult.link}>{registrationResult.link}</a>
              </p>
            ) : null}
          </form>
        </section>
      </div>
    </div>
  );
}

function Kal26PlanPage({ eventSlug }: { eventSlug: string }) {
  const friday = [
    {
      date: '17.04.2026',
      time: '15:30',
      place: 'Kościół św. Józefa, Kraków Podgórze',
      title: 'Msza Święta na rozpoczęcie pielgrzymki',
      description:
        'Naszą drogę rozpoczynamy wspólną Mszą Świętą w kościele św. Józefa na krakowskim Podgórzu. To moment powierzenia pielgrzymki Panu Bogu i spokojnego wejścia w rytm wspólnej drogi.'
    },
    {
      date: '17.04.2026',
      time: 'po Mszy Świętej',
      place: 'Kraków Podgórze',
      title: 'Wyjście na trasę',
      description:
        'Po zakończeniu Mszy Świętej wyruszamy pieszo w drogę do Tyńca. Pierwszy etap prowadzi nas z Krakowa wzdłuż Wisły.'
    },
    {
      date: '17.04.2026',
      time: 'po południu / wieczorem',
      place: 'Trasa Kraków – Tyniec',
      title: 'Przejście pierwszego etapu pielgrzymki',
      description:
        'Pierwszego dnia idziemy wspólnie z Krakowa do Tyńca. To czas wejścia w pielgrzymkę, modlitwy, skupienia i spokojnego rytmu drogi.'
    },
    {
      date: '17.04.2026',
      time: 'wieczorem',
      place: 'Tyniec',
      title: 'Przyjście do Tyńca',
      description: 'Pod koniec dnia docieramy do Tyńca, gdzie kończy się pierwszy etap pielgrzymki.'
    },
    {
      date: '17.04.2026',
      time: 'po przyjściu',
      place: 'Tyniec',
      title: 'Nocleg',
      description: 'Po dojściu do Tyńca przewidziany jest nocleg i odpoczynek przed drugim dniem drogi.'
    }
  ] as const;

  const saturday = [
    {
      date: '18.04.2026',
      time: '7:30',
      place: 'Tyniec',
      title: 'Wyjście na trasę',
      description:
        'Drugiego dnia rano wyruszamy z Tyńca w stronę Kalwarii Zebrzydowskiej. Ten układ godzin odpowiada planowi sobotniego przejścia z poprzedniej edycji.'
    },
    {
      date: '18.04.2026',
      time: '9:45',
      place: 'Kopanka',
      title: 'Przyjście na pierwszy postój',
      description:
        'O tej porze planowane jest dojście do Kopanki, gdzie przewidziany jest pierwszy dłuższy odpoczynek.'
    },
    {
      date: '18.04.2026',
      time: '9:45–10:45',
      place: 'Kopanka – miejsce rekreacyjne / pętla',
      title: 'Postój',
      description: 'Czas na odpoczynek, zebranie sił i przygotowanie do dalszej drogi.'
    },
    {
      date: '18.04.2026',
      time: '10:45',
      place: 'Kopanka',
      title: 'Wyjście z postoju',
      description: 'Po odpoczynku ruszamy dalej w kierunku Sosnowic.'
    },
    {
      date: '18.04.2026',
      time: '12:15',
      place: 'Sosnowice',
      title: 'Przyjście na drugi postój',
      description:
        'Około południa docieramy do Sosnowic. W poprzednim planie właśnie tutaj przewidziany był dłuższy postój i ciepły posiłek.'
    },
    {
      date: '18.04.2026',
      time: '12:15–13:15',
      place: 'Sosnowice – Szkoła Podstawowa im. Marii Konopnickiej',
      title: 'Postój i ciepły posiłek',
      description: 'To moment na odpoczynek, posiłek i krótką regenerację przed dalszą częścią trasy.'
    },
    {
      date: '18.04.2026',
      time: '13:15',
      place: 'Sosnowice',
      title: 'Wyjście z postoju',
      description: 'Po odpoczynku wyruszamy dalej w stronę Przytkowic.'
    },
    {
      date: '18.04.2026',
      time: '14:45',
      place: 'Przytkowice',
      title: 'Przyjście na trzeci postój',
      description:
        'Po kolejnym etapie drogi docieramy do Przytkowic, gdzie przewidziany jest ostatni dłuższy postój przed dojściem do celu.'
    },
    {
      date: '18.04.2026',
      time: '14:45–15:45',
      place: 'Przytkowice – przystanek kolejowy',
      title: 'Postój',
      description: 'Ostatni większy odpoczynek przed końcowym odcinkiem pielgrzymki.'
    },
    {
      date: '18.04.2026',
      time: '15:45',
      place: 'Przytkowice',
      title: 'Wyjście z postoju',
      description: 'Ruszamy na ostatni etap drogi do Kalwarii Zebrzydowskiej.'
    },
    {
      date: '18.04.2026',
      time: '17:00',
      place: 'Kalwaria Zebrzydowska',
      title: 'Przyjście do celu pielgrzymki',
      description:
        'Planowane dojście do Kalwarii Zebrzydowskiej i zakończenie wspólnej drogi. W poprzednich materiałach ten moment był przewidziany właśnie na około 17:00.'
    }
  ] as const;

  const renderPlanTable = (
    rows: ReadonlyArray<{
      date: string;
      time: string;
      place: string;
      title: string;
      description: string;
    }>
  ) => (
    <>
      <div className="kal-plan-table-wrap kal-plan-desktop-wrap">
        <table className="kal-plan-table">
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Godzina</th>
              <th scope="col">Miejsce</th>
              <th scope="col">Wydarzenie</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={`${item.date}-${item.time}-${item.title}`}>
                <td>{item.date}</td>
                <td>{item.time}</td>
                <td>{item.place}</td>
                <td>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="kal-plan-mobile-list">
        {rows.map((item) => (
          <details key={`mobile-${item.date}-${item.time}-${item.title}`} className="kal-plan-mobile-item">
            <summary>
              <span className="kal-plan-mobile-meta">
                <strong>Data:</strong> {item.date}
              </span>
              <span className="kal-plan-mobile-meta">
                <strong>Godzina:</strong> {item.time}
              </span>
              <span className="kal-plan-mobile-meta">
                <strong>Miejsce:</strong> {item.place}
              </span>
              <span className="kal-plan-mobile-title">{item.title}</span>
            </summary>
            <div className="kal-plan-mobile-description">
              <p>{item.description}</p>
            </div>
          </details>
        ))}
      </div>
    </>
  );

  return (
    <div className="kal-text-layout">
      <aside className="kal-text-sidebar">
        <h1>Plan pielgrzymki</h1>
        <p>Harmonogram wspólnej drogi z Krakowa do Kalwarii Zebrzydowskiej.</p>
        <ul>
          <li>Piątek: 17 kwietnia 2026</li>
          <li>Sobota: 18 kwietnia 2026</li>
          <li>Trasa: Kraków – Tyniec – Kalwaria Zebrzydowska</li>
        </ul>
        <div className="kal-text-actions">
          <a className="cta" href={`/#/event/${eventSlug}/zapisy`}>Zapisz się</a>
          <a className="ghost" href={`/#/event/${eventSlug}/informacje`}>Informacje</a>
        </div>
      </aside>

      <div className="kal-text-content">
        <section className="kal-text-section">
          <h2>Piątek, 17 kwietnia 2026</h2>
          {renderPlanTable(friday)}
        </section>

        <section className="kal-text-section">
          <h2>Sobota, 18 kwietnia 2026</h2>
          {renderPlanTable(saturday)}
        </section>
      </div>
    </div>
  );
}

export function Kal26EventPage({
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
  const isTextPage =
    page.slug === 'niezbednik' ||
    page.slug === 'program' ||
    page.slug === 'zapisy' ||
    page.slug === 'faq' ||
    page.slug === 'o-pielgrzymce' ||
    page.slug === 'kontakt' ||
    page.slug === 'galeria';
  const location = useLocation();
  const navigate = useNavigate();
  const queryToken = useMemo(() => new URLSearchParams(location.search).get('token') ?? '', [location.search]);
  const [site, setSite] = useState<PilgrimageSite | null>(null);
  const [siteLoading, setSiteLoading] = useState(true);
  const [siteError, setSiteError] = useState<string | null>(null);

  const [registrationForm, setRegistrationForm] = useState<RegistrationFormState>(defaultRegistrationForm);
  const [registrationPending, setRegistrationPending] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [registrationResult, setRegistrationResult] = useState<{ link: string; token: string } | null>(null);
  const [registrationNotice, setRegistrationNotice] = useState<string | null>(null);
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
  const [inquiryDrafts, setInquiryDrafts] = useState<Record<string, { status: string; publicAnswer: string }>>({});
  const [participantSearch, setParticipantSearch] = useState('');
  const [participantStatusFilter, setParticipantStatusFilter] = useState('all');
  const [participantPaymentFilter, setParticipantPaymentFilter] = useState('all');
  const [participantVariantFilter, setParticipantVariantFilter] = useState('all');
  const [organizerActionError, setOrganizerActionError] = useState<string | null>(null);
  const [organizerSavingId, setOrganizerSavingId] = useState<string | null>(null);
  const [registrationTransferBusy, setRegistrationTransferBusy] = useState(false);
  const [registrationTransferInfo, setRegistrationTransferInfo] = useState<string | null>(null);
  const [registrationTransferError, setRegistrationTransferError] = useState<string | null>(null);
  const [registrationImportReplaceExisting, setRegistrationImportReplaceExisting] = useState(false);
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
  const [publicContactAnswers, setPublicContactAnswers] = useState<PilgrimagePublicInquiryAnswer[]>([]);
  const [publicContactAnswersPending, setPublicContactAnswersPending] = useState(false);
  const [publicContactAnswersError, setPublicContactAnswersError] = useState<string | null>(null);
  const registrationImportFileRef = useRef<HTMLInputElement | null>(null);
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
    if (organizerPending) {
      return;
    }
    if (!showProfileMenu) {
      setOrganizerDashboard(null);
      setOrganizerError(null);
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
    if (!showProfileMenu) {
      setOrganizerDashboard(null);
      setOrganizerError(null);
      return;
    }
    if (!site?.id) {
      return;
    }
    void loadOrganizerDashboard();
  }, [showProfileMenu, site?.id]);

  useEffect(() => {
    if (page.slug !== 'organizator') return;
    void loadOrganizerDashboard();
  }, [page.slug, showProfileMenu, site?.id]);

  useEffect(() => {
    if (page.slug !== 'kontakt') return;
    let active = true;
    setPublicContactAnswersPending(true);
    setPublicContactAnswersError(null);
    getPilgrimagePublicInquiryAnswers(event.slug)
      .then((answers) => {
        if (!active) return;
        setPublicContactAnswers(answers);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setPublicContactAnswersError(error instanceof Error ? error.message : 'Nie udalo sie pobrac odpowiedzi.');
      })
      .finally(() => {
        if (!active) return;
        setPublicContactAnswersPending(false);
      });

    if (showProfileMenu) {
      void loadOrganizerDashboard();
    }

    return () => {
      active = false;
    };
  }, [event.slug, page.slug, showProfileMenu, site?.id]);

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

    const inquiryMap: Record<string, { status: string; publicAnswer: string }> = {};
    organizerDashboard.inquiries.forEach((inquiry) => {
      inquiryMap[inquiry.id] = { status: inquiry.status, publicAnswer: inquiry.publicAnswer ?? '' };
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
  const kal26HeaderCopy = copy.events.kal26Header;
  const headerMenuPages = useMemo(() => {
    const pages = [
      {
        targetSlug: 'niezbednik',
        localizedSlug: { pl: 'informacje', en: 'information', de: 'informationen' },
        label: kal26HeaderCopy.information
      },
      {
        targetSlug: 'program',
        localizedSlug: { pl: 'plan', en: 'plan', de: 'plan' },
        label: kal26HeaderCopy.plan
      },
      {
        targetSlug: 'zapisy',
        localizedSlug: { pl: 'zapisy', en: 'register', de: 'anmeldung' },
        label: kal26HeaderCopy.register
      },
      {
        targetSlug: 'faq',
        localizedSlug: { pl: 'faq', en: 'faq', de: 'faq' },
        label: kal26HeaderCopy.faq
      },
      {
        targetSlug: 'o-pielgrzymce',
        localizedSlug: { pl: 'historia', en: 'history', de: 'geschichte' },
        label: kal26HeaderCopy.history
      },
      {
        targetSlug: 'galeria',
        localizedSlug: { pl: 'galeria', en: 'gallery', de: 'galerie' },
        label: kal26HeaderCopy.gallery
      },
      {
        targetSlug: 'kontakt',
        localizedSlug: { pl: 'kontakt', en: 'contact', de: 'kontakt' },
        label: kal26HeaderCopy.contact
      }
    ] as Array<{
      targetSlug: string;
      localizedSlug: { pl: string; en: string; de: string };
      label: string;
    }>;

    if (showProfileMenu && (organizerDashboard || page.slug === 'organizator')) {
      pages.push({
        targetSlug: 'organizator',
        localizedSlug: { pl: 'organizator', en: 'organizer', de: 'organisator' },
        label: kal26HeaderCopy.organizer
      });
    }

    return pages;
  }, [
    kal26HeaderCopy.contact,
    kal26HeaderCopy.faq,
    kal26HeaderCopy.gallery,
    kal26HeaderCopy.history,
    kal26HeaderCopy.information,
    kal26HeaderCopy.organizer,
    kal26HeaderCopy.plan,
    kal26HeaderCopy.register,
    organizerDashboard,
    page.slug,
    showProfileMenu
  ]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [page.slug]);

  useEffect(() => {
    if (page.slug !== 'formalnosci') return;
    navigate('/legal', { replace: true });
  }, [navigate, page.slug]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [event.slug, page.slug]);

  const handleRegistrationSubmit = async (eventForm: FormEvent) => {
    eventForm.preventDefault();
    if (registrationStep < 4) {
      goToNextRegistrationStep();
      return;
    }

    setRegistrationPending(true);
    setRegistrationError(null);
    setRegistrationResult(null);
    setRegistrationNotice(null);

    try {
      const normalizedPhone = normalizePolishPhone(registrationForm.phone);
      const normalizedEmergencyPhone = normalizePolishPhone(registrationForm.emergencyContactPhone);
      if (!normalizedPhone || !normalizedEmergencyPhone) {
        setRegistrationError('Numer telefonu musi mieć format +48 i 9 cyfr.');
        return;
      }
      const response = await createPilgrimageRegistration(event.slug, {
        fullName: registrationForm.fullName,
        phone: normalizedPhone,
        email: registrationForm.email || null,
        parish: registrationForm.parish || null,
        birthDate: registrationForm.birthDate || null,
        isMinor: registrationForm.isMinor,
        participationVariant: registrationForm.participationVariant,
        needsLodging: registrationForm.needsLodging,
        needsBaggageTransport: registrationForm.needsBaggageTransport,
        emergencyContactName: registrationForm.emergencyContactName,
        emergencyContactPhone: normalizedEmergencyPhone,
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

  const handleSimpleRegistrationSubmit = async (eventForm: FormEvent) => {
    eventForm.preventDefault();
    setRegistrationError(null);
    setRegistrationResult(null);
    setRegistrationNotice(null);

    const fullName = registrationForm.fullName.trim();
    const phone = normalizePolishPhone(registrationForm.phone);
    const startPlace = registrationForm.parish.trim();
    if (!fullName || !phone || !startPlace) {
      setRegistrationError('Uzupełnij imię i nazwisko, miejsce startu oraz poprawny telefon (+48 i 9 cyfr).');
      return;
    }
    const participationVariant = startPlace.toLowerCase().includes('tyniec') ? 'saturday' : 'full';
    const additionalInfo = registrationForm.healthNotes.trim();
    const mergedNotes = additionalInfo
      ? `Miejsce startu: ${startPlace}\n${additionalInfo}`
      : `Miejsce startu: ${startPlace}`;

    setRegistrationPending(true);
    try {
      if (!site?.isProvisioned) {
        await createPilgrimageContactInquiry(event.slug, {
          name: fullName,
          phone,
          isPublicQuestion: false,
          email: null,
          topic: 'Zapis pielgrzymki (awaryjnie)',
          message: mergedNotes
        });
        setRegistrationNotice(
          'Wydarzenie nie jest jeszcze aktywne w systemie zapisów. Twoje zgłoszenie zostało zapisane awaryjnie i organizator skontaktuje się telefonicznie.'
        );
        setRegistrationError(null);
        setRegistrationResult(null);
        setRegistrationForm({
          ...defaultRegistrationForm,
          needsLodging: false,
          needsBaggageTransport: false
        });
        return;
      }

      const response = await createPilgrimageRegistration(event.slug, {
        fullName,
        phone,
        email: null,
        parish: startPlace,
        birthDate: null,
        isMinor: false,
        participationVariant,
        needsLodging: false,
        needsBaggageTransport: false,
        emergencyContactName: fullName,
        emergencyContactPhone: phone,
        healthNotes: mergedNotes,
        dietNotes: null,
        acceptedTerms: true,
        acceptedRodo: true,
        acceptedImageConsent: true
      });
      setRegistrationResult({ link: response.accessLink, token: response.accessToken });
      setParticipantToken(response.accessToken);
      setRegistrationNotice(null);
      setRegistrationForm({
        ...defaultRegistrationForm,
        needsLodging: false,
        needsBaggageTransport: false
      });
    } catch (error: unknown) {
      if (error instanceof ApiError && (error.status === 404 || error.status === 503)) {
        try {
          await createPilgrimageContactInquiry(event.slug, {
            name: fullName,
            phone,
            isPublicQuestion: false,
            email: null,
            topic: 'Zapis pielgrzymki (awaryjnie)',
            message: mergedNotes
          });
          setRegistrationNotice(
            'Zapis główny jest chwilowo niedostępny. Twoje zgłoszenie zostało zapisane awaryjnie i organizator skontaktuje się telefonicznie.'
          );
          setRegistrationError(null);
          setRegistrationResult(null);
          setRegistrationForm({
            ...defaultRegistrationForm,
            needsLodging: false,
            needsBaggageTransport: false
          });
        } catch (fallbackError: unknown) {
          setRegistrationError(
            fallbackError instanceof Error
              ? fallbackError.message
              : 'Nie udało się wysłać zapisu ani zgłoszenia awaryjnego.'
          );
        }
      } else {
        setRegistrationError(error instanceof Error ? error.message : 'Nie udało się wysłać zapisu.');
      }
    } finally {
      setRegistrationPending(false);
    }
  };

  const goToNextRegistrationStep = () => {
    setRegistrationError(null);
    if (registrationStep === 1) {
      if (!registrationForm.fullName.trim() || !normalizePolishPhone(registrationForm.phone)) {
        setRegistrationError('W kroku 1 uzupelnij imie i nazwisko oraz poprawny telefon (+48 i 9 cyfr).');
        return;
      }
    }

    if (registrationStep === 3) {
      if (!registrationForm.emergencyContactName.trim() || !normalizePolishPhone(registrationForm.emergencyContactPhone)) {
        setRegistrationError('W kroku 3 uzupelnij kontakt awaryjny i poprawny telefon (+48 i 9 cyfr).');
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
    const normalizedPhone = normalizePolishPhone(contactForm.phone);
    if (!contactForm.isPublicQuestion && !normalizedPhone) {
      setContactError('Dla odpowiedzi prywatnej podaj numer telefonu.');
      return;
    }
    if (contactForm.phone.trim() && !normalizedPhone) {
      setContactError('Telefon musi mieć format +48 i 9 cyfr.');
      return;
    }
    setContactPending(true);
    setContactError(null);
    setContactSuccess(null);
    try {
      await createPilgrimageContactInquiry(event.slug, {
        name: contactForm.name,
        phone: normalizedPhone,
        isPublicQuestion: contactForm.isPublicQuestion,
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

  const handleExportRegistrations = async () => {
    if (!site?.id) return;
    setRegistrationTransferBusy(true);
    setRegistrationTransferError(null);
    setRegistrationTransferInfo(null);
    try {
      const payload = await exportPilgrimageRegistrations(site.id);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `pilgrimage-registrations-${event.slug}-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setRegistrationTransferInfo(`Wyeksportowano ${payload.rows.length} zapisów.`);
    } catch {
      setRegistrationTransferError('Nie udało się wyeksportować zapisów.');
    } finally {
      setRegistrationTransferBusy(false);
    }
  };

  const handleImportRegistrationsFileChange = async (eventInput: ChangeEvent<HTMLInputElement>) => {
    if (!site?.id) return;
    const file = eventInput.target.files?.[0];
    if (!file) return;

    setRegistrationTransferBusy(true);
    setRegistrationTransferError(null);
    setRegistrationTransferInfo(null);
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as { rows?: unknown[] };
      if (!payload || !Array.isArray(payload.rows)) {
        setRegistrationTransferError('Plik importu ma nieprawidłowy format JSON.');
        return;
      }
      const rows = payload.rows as PilgrimageRegistrationTransferRow[];

      const result = await importPilgrimageRegistrations(site.id, {
        rows,
        replaceExisting: registrationImportReplaceExisting
      });
      setRegistrationTransferInfo(
        `Import zakończony: ${result.importedRegistrations} zapisów, pominięto ${result.skippedRegistrations}.`
      );
      await loadOrganizerDashboard();
    } catch {
      setRegistrationTransferError('Nie udało się zaimportować zapisów.');
    } finally {
      setRegistrationTransferBusy(false);
      if (registrationImportFileRef.current) {
        registrationImportFileRef.current.value = '';
      }
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
      await updatePilgrimageInquiry(site.id, inquiryId, {
        status: draft.status,
        publicAnswer: draft.publicAnswer || null
      });
      await loadOrganizerDashboard();
      const answers = await getPilgrimagePublicInquiryAnswers(event.slug);
      setPublicContactAnswers(answers);
    } catch (error: unknown) {
      setOrganizerActionError(error instanceof Error ? error.message : 'Nie udalo sie zaktualizowac zapytania.');
    } finally {
      setOrganizerSavingId(null);
    }
  };

  const handleInquiryDelete = async (inquiryId: string) => {
    if (!site?.id) return;

    setOrganizerActionError(null);
    setOrganizerSavingId(`inquiry:${inquiryId}`);
    try {
      await deletePilgrimageInquiry(site.id, inquiryId);
      setInquiryDrafts((previous) => {
        const next = { ...previous };
        delete next[inquiryId];
        return next;
      });
      await loadOrganizerDashboard();
    } catch (error: unknown) {
      setOrganizerActionError(error instanceof Error ? error.message : 'Nie udalo sie usunac pytania.');
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
              <button
                type="button"
                className="ghost"
                onClick={() => void handleExportRegistrations()}
                disabled={registrationTransferBusy}
              >
                {registrationTransferBusy ? 'Przetwarzanie...' : 'Eksport JSON zapisów'}
              </button>
              <label className="ghost" style={{ display: 'inline-flex', cursor: registrationTransferBusy ? 'not-allowed' : 'pointer' }}>
                Import JSON zapisów
                <input
                  ref={registrationImportFileRef}
                  type="file"
                  accept="application/json"
                  onChange={(eventInput) => void handleImportRegistrationsFileChange(eventInput)}
                  disabled={registrationTransferBusy}
                  style={{ display: 'none' }}
                />
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <input
                  type="checkbox"
                  checked={registrationImportReplaceExisting}
                  onChange={(eventInput) => setRegistrationImportReplaceExisting(eventInput.target.checked)}
                  disabled={registrationTransferBusy}
                />
                Zastąp istniejące zapisy
              </label>
            </div>
          ) : null}
          {registrationTransferError ? <p className="pilgrimage-error">{registrationTransferError}</p> : null}
          {registrationTransferInfo ? <p className="pilgrimage-success">{registrationTransferInfo}</p> : null}
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
                        [entry.id]: {
                          status: eventInput.target.value,
                          publicAnswer: previous[entry.id]?.publicAnswer ?? entry.publicAnswer ?? ''
                        }
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
                {entry.phone ? (
                  <a
                    className="ghost"
                    href={
                      buildInquirySmsHref(
                        entry.phone,
                        entry.topic,
                        inquiryDrafts[entry.id]?.publicAnswer ?? entry.publicAnswer ?? ''
                      ) || undefined
                    }
                    onClick={(eventClick) => {
                      const href = buildInquirySmsHref(
                        entry.phone,
                        entry.topic,
                        inquiryDrafts[entry.id]?.publicAnswer ?? entry.publicAnswer ?? ''
                      );
                      if (!href) {
                        eventClick.preventDefault();
                      }
                    }}
                  >
                    Wyślij SMS z odpowiedzią
                  </a>
                ) : null}
                <button
                  className="ghost"
                  onClick={() => void handleInquiryDelete(entry.id)}
                  disabled={organizerSavingId === `inquiry:${entry.id}`}
                >
                  {organizerSavingId === `inquiry:${entry.id}` ? 'Usuwanie...' : 'Usun pytanie'}
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
            <a
              key={item.targetSlug}
              href={`/#/event/${event.slug}/${item.localizedSlug[language]}`}
              className={item.targetSlug === page.slug ? 'active' : ''}
            >
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
                <a
                  key={item.targetSlug}
                  href={`/#/event/${event.slug}/${item.localizedSlug[language]}`}
                  className={item.targetSlug === page.slug ? 'active' : ''}
                >
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

      <main className={`kal-main${page.slug === 'start' ? ' kal-main--start' : ''}${isTextPage ? ' kal-main--text' : ''}`}>
        <section
          className={`kal-content pilgrimage-content${page.slug === 'start' ? ' pilgrimage-content--start' : ''}${isTextPage ? ' kal-content--plain' : ''}`}
        >
          {page.slug === 'start' ? (
            <section className="pilgrimage-start-stage" aria-label="Wielkanocna Kalwaria background">
              <div className="start-graphic-wrap">
                <PilgrimageStoneMap />
              </div>
            </section>
          ) : null}
          {page.slug === 'niezbednik' ? <InformationPage eventSlug={event.slug} /> : null}
          {page.slug === 'program' ? <Kal26PlanPage eventSlug={event.slug} /> : null}
          {page.slug === 'zapisy' ? (
            <Kal26RegisterPage
              registrationForm={registrationForm}
              setRegistrationForm={setRegistrationForm}
              handleSimpleRegistrationSubmit={handleSimpleRegistrationSubmit}
              registrationPending={registrationPending}
              registrationError={registrationError}
              registrationNotice={registrationNotice}
              registrationResult={registrationResult}
            />
          ) : null}
          {page.slug === 'faq' ? <Kal26FaqPage eventSlug={event.slug} /> : null}
          {page.slug === 'o-pielgrzymce' ? <Kal26HistoryPage eventSlug={event.slug} /> : null}
          {page.slug === 'kontakt' ? (
            <Kal26ContactPage
              eventSlug={event.slug}
              contactForm={contactForm}
              setContactForm={setContactForm}
              handleContactSubmit={handleContactSubmit}
              contactPending={contactPending}
              contactError={contactError}
              contactSuccess={contactSuccess}
              publicContactAnswers={publicContactAnswers}
              publicContactAnswersPending={publicContactAnswersPending}
              publicContactAnswersError={publicContactAnswersError}
              showProfileMenu={showProfileMenu}
              organizerDashboard={organizerDashboard}
              inquiryDrafts={inquiryDrafts}
              setInquiryDrafts={setInquiryDrafts}
              handleInquiryUpdate={handleInquiryUpdate}
              handleInquiryDelete={handleInquiryDelete}
              organizerSavingId={organizerSavingId}
              organizerActionError={organizerActionError}
            />
          ) : null}
          {page.slug === 'galeria' ? <Kal26GalleryPage /> : null}
          <div style={{ display: 'none' }} aria-hidden="true">
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
          </div>
        </section>
      </main>

      <footer className={`kal-footer${page.slug === 'start' ? ' kal-footer--overlay' : ''}`}>
        <a href="/#/" className="kal-logo">Recreatio</a>
        <nav className="kal-footer-links" aria-label="Footer navigation">
          <a href={`/#/event/${event.slug}/kontakt`}>Kontakt</a>
          <a href="/#/legal">Regulamin i RODO</a>
        </nav>
      </footer>
    </div>
  );
}
