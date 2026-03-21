import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type MouseEvent } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ApiError,
  bootstrapLimanowaEvent,
  claimLimanowaAdmin,
  createLimanowaAdminAnnouncement,
  createLimanowaGroupAdminParticipant,
  createLimanowaGroupAdminQuestion,
  createLimanowaGroupRegistration,
  createLimanowaParticipantQuestion,
  generateLimanowaGroupAdminAccess,
  generateLimanowaParticipantAccess,
  getLimanowaAdminDashboard,
  getLimanowaAdminExportUrl,
  getLimanowaAdminStatus,
  getLimanowaEventSite,
  getLimanowaGroupAdminZone,
  getLimanowaParticipantZone,
  replyLimanowaAdminThread,
  updateLimanowaAdminAccommodation,
  updateLimanowaAdminEventSettings,
  updateLimanowaAdminGroupStatus,
  updateLimanowaAdminParticipantStatus,
  updateLimanowaGroupAdminGroup,
  updateLimanowaGroupAdminParticipant,
  updateLimanowaParticipantProfile,
  type LimanowaAccessLink,
  type LimanowaAdminDashboard,
  type LimanowaAdminStatus,
  type LimanowaEventSite,
  type LimanowaGroup,
  type LimanowaGroupAdminZone,
  type LimanowaParticipant,
  type LimanowaParticipantZone,
  type LimanowaQuestionThread
} from '../../lib/api';
import type { EventDefinition, EventInnerPage, SharedEventPageProps } from './eventTypes';
import { LimanowaPointCloud } from './LimanowaPointCloud';
import '../../styles/limanowa-event.css';

const LIMANOWA_SLUG = 'limanowa';
const GROUP_STATUSES = [
  'nowe zgłoszenie',
  'oczekuje na kontakt',
  'oczekuje na uzupełnienie',
  'gotowe organizacyjnie',
  'zamknięte'
] as const;
const PARTICIPANT_STATUSES = ['nieuzupełniony', 'w trakcie', 'gotowy', 'wymaga poprawy'] as const;

type GroupRegistrationForm = {
  parishName: string;
  responsibleName: string;
  phone: string;
  email: string;
  expectedParticipantCount: string;
  expectedGuardianCount: string;
  notes: string;
};

type GroupPanelParticipantForm = {
  fullName: string;
  phone: string;
  parishName: string;
  parentContactName: string;
  parentContactPhone: string;
  guardianName: string;
  guardianPhone: string;
  notes: string;
  healthNotes: string;
  accommodationType: string;
  status: string;
};

type ParticipantSelfForm = {
  fullName: string;
  phone: string;
  parishName: string;
  parentContactName: string;
  parentContactPhone: string;
  guardianName: string;
  guardianPhone: string;
  notes: string;
  healthNotes: string;
  rulesAccepted: boolean;
  truthConfirmed: boolean;
  rulesRead: boolean;
  privacyRead: boolean;
};

type AnnouncementForm = {
  title: string;
  body: string;
  audienceType: 'all' | 'group-admin' | 'participant' | 'admin';
};

const DEFAULT_GROUP_REGISTRATION_FORM: GroupRegistrationForm = {
  parishName: '',
  responsibleName: '',
  phone: '',
  email: '',
  expectedParticipantCount: '8',
  expectedGuardianCount: '1',
  notes: ''
};

const DEFAULT_GROUP_PANEL_PARTICIPANT_FORM: GroupPanelParticipantForm = {
  fullName: '',
  phone: '',
  parishName: '',
  parentContactName: '',
  parentContactPhone: '',
  guardianName: '',
  guardianPhone: '',
  notes: '',
  healthNotes: '',
  accommodationType: '',
  status: 'nieuzupełniony'
};

const DEFAULT_PARTICIPANT_SELF_FORM: ParticipantSelfForm = {
  fullName: '',
  phone: '',
  parishName: '',
  parentContactName: '',
  parentContactPhone: '',
  guardianName: '',
  guardianPhone: '',
  notes: '',
  healthNotes: '',
  rulesAccepted: false,
  truthConfirmed: false,
  rulesRead: false,
  privacyRead: false
};

const DEFAULT_ANNOUNCEMENT_FORM: AnnouncementForm = {
  title: '',
  body: '',
  audienceType: 'all'
};

function parseApiError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const raw = error.message.trim();
    if (!raw) {
      return fallback;
    }
    try {
      const parsed = JSON.parse(raw) as { error?: string };
      if (parsed?.error) {
        return parsed.error;
      }
    } catch {
      return raw;
    }
    return raw;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function smoothStep01(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function ensureMeta(selector: string, attribute: 'name' | 'property', value: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, value);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function useLimanowaSeo(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    document.title = 'Gra o wolność | REcreatio';
    ensureMeta(
      'meta[name="description"]',
      'name',
      'description',
      'Weekendowa gra terenowa w Limanowej dla chłopaków z parafii i wspólnot. Historia, przygoda, modlitwa, współpraca i formacja w duchu Zośki, Parasola oraz Kamieni na szaniec.'
    );
    ensureMeta('meta[property="og:title"]', 'property', 'og:title', 'Gra o wolność | REcreatio');
    ensureMeta(
      'meta[property="og:description"]',
      'property',
      'og:description',
      'Zośka i parasol: Przygoda, która uczy. Historia, która porusza. Wspólnota, która formuje.'
    );

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', '/#/event/limanowa/start');
  }, [enabled]);
}

function decodeTokenFromPath(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const value = segments[3] ?? '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function StatusBadge({ value }: { value: string }) {
  return <span className="lim26-status-pill">{value}</span>;
}

function threadStatusLabel(value: string): string {
  if (value === 'open') return 'otwarte';
  if (value === 'answered') return 'odpowiedziane';
  if (value === 'closed') return 'zamknięte';
  return value;
}

function authorTypeLabel(value: string): string {
  if (value === 'admin') return 'organizator';
  if (value === 'group-admin') return 'opiekun grupy';
  if (value === 'participant') return 'uczestnik';
  return 'wiadomość systemowa';
}

function LimanowaStartPage({
  onNavigate
}: Pick<SharedEventPageProps, 'onNavigate'>) {
  useLimanowaSeo(true);
  const location = useLocation();
  const [site, setSite] = useState<LimanowaEventSite | null>(null);
  const [siteLoading, setSiteLoading] = useState(true);
  const [siteError, setSiteError] = useState<string | null>(null);

  const [form, setForm] = useState<GroupRegistrationForm>(DEFAULT_GROUP_REGISTRATION_FORM);
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSiteLoading(true);
    setSiteError(null);

    getLimanowaEventSite(LIMANOWA_SLUG)
      .then((response) => {
        if (!active) return;
        setSite(response);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setSiteError(parseApiError(error, 'Nie udało się pobrać danych wydarzenia.'));
      })
      .finally(() => {
        if (!active) return;
        setSiteLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleFormField = (key: keyof GroupRegistrationForm) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    const expectedParticipantCount = Number.parseInt(form.expectedParticipantCount, 10);
    const expectedGuardianCount = Number.parseInt(form.expectedGuardianCount, 10);

    if (!Number.isFinite(expectedParticipantCount) || !Number.isFinite(expectedGuardianCount)) {
      setSubmitError('Podaj poprawne liczby uczestników i opiekunów.');
      return;
    }

    setPending(true);
    try {
      await createLimanowaGroupRegistration(LIMANOWA_SLUG, {
        parishName: form.parishName,
        responsibleName: form.responsibleName,
        phone: form.phone,
        email: form.email,
        expectedParticipantCount,
        expectedGuardianCount,
        notes: form.notes
      });

      setSubmitSuccess('Dziękujemy. Zgłoszenie grupy zostało przyjęte. Skontaktujemy się w sprawach organizacyjnych i dalszych kroków.');
      setForm(DEFAULT_GROUP_REGISTRATION_FORM);
    } catch (error: unknown) {
      setSubmitError(parseApiError(error, 'Nie udało się wysłać zgłoszenia grupy.'));
    } finally {
      setPending(false);
    }
  };

  const privacyLink = site?.policyLinks.privacyPolicyUrl ?? '/#/legal';
  const rulesLink = site?.policyLinks.eventRulesUrl ?? '/#/event/limanowa/start?sekcja=faq';

  const scrollToSection = useCallback((sectionId: string, behavior: ScrollBehavior = 'smooth') => {
    const target = document.getElementById(sectionId);
    if (!target) return;

    const header = document.querySelector<HTMLElement>('.lim26-header');
    const headerOffset = (header?.offsetHeight ?? 0) + 10;
    const top = target.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top: Math.max(top, 0), behavior });
  }, []);

  const handleSectionLink = useCallback((sectionId: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    scrollToSection(sectionId);
  }, [scrollToSection]);

  useEffect(() => {
    const section = new URLSearchParams(location.search).get('sekcja');
    if (!section) return;
    const frame = window.requestAnimationFrame(() => scrollToSection(section, 'auto'));
    return () => window.cancelAnimationFrame(frame);
  }, [location.search, scrollToSection]);

  useEffect(() => {
    document.documentElement.classList.add('lim26-scroll-snap');
    document.body.classList.add('lim26-scroll-snap');
    return () => {
      document.documentElement.classList.remove('lim26-scroll-snap');
      document.body.classList.remove('lim26-scroll-snap');
    };
  }, []);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.lim26-start-page');
    const scenes = Array.from(document.querySelectorAll<HTMLElement>('.lim26-scene'));
    if (!root || scenes.length === 0) {
      return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sceneNodes = scenes.map((scene) => ({
      scene,
      textNodes: Array.from(scene.querySelectorAll<HTMLElement>('.lim26-motion-text')),
      mediaNodes: Array.from(scene.querySelectorAll<HTMLElement>('.lim26-motion-media'))
    }));
    type SceneMetric = {
      start: number;
      end: number;
      center: number;
      anchor: number;
    };

    let metrics: SceneMetric[] = [];
    let disposed = false;
    let frame: number | null = null;

    const getHeaderOffset = () => {
      const header = document.querySelector<HTMLElement>('.lim26-header');
      return (header?.offsetHeight ?? 0) + 10;
    };

    const rebuildMetrics = () => {
      const viewportHeight = Math.max(1, window.innerHeight);
      const headerOffset = getHeaderOffset();
      metrics = scenes.map((scene) => {
        const rect = scene.getBoundingClientRect();
        const top = window.scrollY + rect.top;
        const height = Math.max(rect.height, viewportHeight * 0.9);
        return {
          start: top - viewportHeight * 0.58,
          end: top + height - viewportHeight * 0.42,
          center: top + height * 0.5,
          anchor: Math.max(0, top - headerOffset)
        };
      });
    };

    const applyMotion = () => {
      frame = null;
      if (disposed) return;
      if (metrics.length !== scenes.length) {
        rebuildMetrics();
      }

      const viewportHeight = Math.max(1, window.innerHeight);
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const scrollY = window.scrollY;
      const scrollCenter = scrollY + viewportHeight * 0.52;
      const masterProgress = clamp01(scrollY / maxScroll);

      let activeIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < metrics.length; index += 1) {
        const distance = Math.abs(scrollCenter - metrics[index].center);
        if (distance < bestDistance) {
          bestDistance = distance;
          activeIndex = index;
        }
      }

      let handoffIndex = Math.max(0, Math.min(activeIndex, metrics.length - 2));
      let handoff = 0;
      if (metrics.length > 1) {
        if (scrollCenter <= metrics[0].center) {
          handoffIndex = 0;
          handoff = 0;
        } else if (scrollCenter >= metrics[metrics.length - 1].center) {
          handoffIndex = metrics.length - 2;
          handoff = 1;
        } else {
          for (let index = 0; index < metrics.length - 1; index += 1) {
            const from = metrics[index].center;
            const to = metrics[index + 1].center;
            if (scrollCenter >= from && scrollCenter <= to) {
              handoffIndex = index;
              const raw = clamp01((scrollCenter - from) / Math.max(1, to - from));
              handoff = raw < 0.7
                ? smoothStep01(raw / 0.7) * 0.22
                : 0.22 + smoothStep01((raw - 0.7) / 0.3) * 0.78;
              break;
            }
          }
        }
      }
      const sceneBlend = (handoffIndex + handoff) / Math.max(1, metrics.length - 1);

      const bgDriftY = (sceneBlend - 0.5) * 48;
      const bgDriftX = Math.sin(sceneBlend * Math.PI * 1.7) * 16;
      const bgGrainOpacity = 0.09 + (1 - masterProgress) * 0.08;
      const bgTopoOpacity = 0.07 + sceneBlend * 0.14;
      const bgHazeOpacity = 0.08 + Math.sin((sceneBlend + 0.12) * Math.PI) * 0.12;
      root.style.setProperty('--lim26-bg-drift-y', `${bgDriftY.toFixed(2)}px`);
      root.style.setProperty('--lim26-bg-drift-x', `${bgDriftX.toFixed(2)}px`);
      root.style.setProperty('--lim26-bg-grain-opacity', bgGrainOpacity.toFixed(3));
      root.style.setProperty('--lim26-bg-topo-opacity', bgTopoOpacity.toFixed(3));
      root.style.setProperty('--lim26-bg-haze-opacity', bgHazeOpacity.toFixed(3));
      root.style.setProperty('--lim26-scene-blend', sceneBlend.toFixed(3));

      let activeVisibility = 0;
      for (let index = 0; index < sceneNodes.length; index += 1) {
        const { scene, textNodes, mediaNodes } = sceneNodes[index];
        const metric = metrics[index];
        const progress = clamp01((scrollCenter - metric.start) / Math.max(1, metric.end - metric.start));
        const enter = smoothStep01((progress - 0.04) / 0.18);
        const settle = smoothStep01((progress - 0.2) / 0.2);
        const exit = smoothStep01((progress - 0.84) / 0.12);
        const visibility = clamp01(enter * (1 - exit));
        const hold = clamp01(settle * (1 - exit * 0.9));
        const isActive = index === activeIndex;
        if (isActive) {
          activeVisibility = visibility;
        }

        let phase = 'pre';
        if (progress >= 0.08 && progress < 0.3) phase = 'enter';
        else if (progress >= 0.3 && progress < 0.84) phase = 'active';
        else if (progress >= 0.84 && progress < 0.98) phase = 'exit';
        else if (progress >= 0.98) phase = 'post';

        scene.dataset.phase = phase;
        scene.dataset.active = isActive ? 'true' : 'false';
        scene.style.setProperty('--lim26-scene-progress', progress.toFixed(3));
        scene.style.setProperty('--lim26-scene-visibility', visibility.toFixed(3));
        scene.style.setProperty('--lim26-scene-enter', enter.toFixed(3));
        scene.style.setProperty('--lim26-scene-exit', exit.toFixed(3));

        textNodes.forEach((node, nodeIndex) => {
          const delayedEnter = smoothStep01((progress - (0.08 + nodeIndex * 0.04)) / 0.16);
          const delayedExit = smoothStep01((progress - (0.8 + nodeIndex * 0.03)) / 0.11);
          const nodeVisibility = clamp01(delayedEnter * (1 - delayedExit));
          const y = (1 - delayedEnter) * (26 + nodeIndex * 8) + delayedExit * (-30 - nodeIndex * 7) + (hold - 0.5) * (5 + nodeIndex * 2);
          const x = delayedExit * (nodeIndex % 2 === 0 ? -10 : 10);
          if (!reducedMotion) {
            node.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
            node.style.filter = `blur(${((1 - nodeVisibility) * 1.7 + delayedExit * 0.9).toFixed(2)}px)`;
          } else {
            node.style.transform = 'none';
            node.style.filter = 'none';
          }
          node.style.opacity = clamp01(nodeVisibility * (0.98 - nodeIndex * 0.06)).toFixed(3);
        });

        mediaNodes.forEach((node, nodeIndex) => {
          const delayedEnter = smoothStep01((progress - (0.03 + nodeIndex * 0.02)) / 0.2);
          const delayedExit = smoothStep01((progress - (0.84 + nodeIndex * 0.02)) / 0.1);
          const nodeVisibility = clamp01(delayedEnter * (1 - delayedExit));
          const direction = nodeIndex % 2 === 0 ? -1 : 1;
          const y = (1 - delayedEnter) * (18 + nodeIndex * 6) + delayedExit * (-24 - nodeIndex * 6) + (hold - 0.5) * 4;
          const x = (1 - delayedEnter) * (12 + nodeIndex * 4) * direction + delayedExit * (-14 - nodeIndex * 4) * direction;
          const scale = 0.96 + nodeVisibility * 0.04;
          if (!reducedMotion) {
            node.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`;
            node.style.filter = `blur(${((1 - nodeVisibility) * 1.2 + delayedExit * 0.45).toFixed(2)}px)`;
          } else {
            node.style.transform = 'none';
            node.style.filter = 'none';
          }
          node.style.opacity = clamp01(0.08 + nodeVisibility * 0.92).toFixed(3);
        });
      }

      const pointOpacity = reducedMotion ? 0.62 : clamp01(0.98 - activeVisibility * 0.2);
      root.style.setProperty('--lim26-point-opacity', pointOpacity.toFixed(3));
      root.style.setProperty('--lim26-point-contrast', (1.08 + activeVisibility * 0.12).toFixed(3));
      root.style.setProperty('--lim26-active-scene-index', String(activeIndex));
    };

    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(applyMotion);
    };

    const onScroll = () => {
      schedule();
    };

    const onResize = () => {
      rebuildMetrics();
      schedule();
    };

    rebuildMetrics();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    const resizeObserver = new ResizeObserver(() => {
      rebuildMetrics();
      schedule();
    });
    for (const scene of scenes) {
      resizeObserver.observe(scene);
    }

    schedule();

    return () => {
      disposed = true;
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      resizeObserver.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return (
    <div className="lim26-page lim26-start-page">
      <div className="lim26-bg-haze" aria-hidden="true" />
      <LimanowaPointCloud className="lim26-pointcloud--pinned" />

      <header className="lim26-header">
        <a className="lim26-back" href="/#/event" onClick={() => onNavigate('events')}>Wydarzenia</a>
        <nav className="lim26-top-nav" aria-label="Nawigacja sekcji">
          <a href="/#/event/limanowa/start?sekcja=o-wydarzeniu" onClick={handleSectionLink('o-wydarzeniu')}>O wydarzeniu</a>
          <a href="/#/event/limanowa/start?sekcja=dla-kogo" onClick={handleSectionLink('dla-kogo')}>Dla kogo</a>
          <a href="/#/event/limanowa/start?sekcja=weekend" onClick={handleSectionLink('weekend')}>Weekend</a>
          <a href="/#/event/limanowa/start?sekcja=gra" onClick={handleSectionLink('gra')}>Gra</a>
          <a href="/#/event/limanowa/start?sekcja=historia-i-wartosci" onClick={handleSectionLink('historia-i-wartosci')}>Historia i wartości</a>
          <a href="/#/event/limanowa/start?sekcja=baza-i-nocleg" onClick={handleSectionLink('baza-i-nocleg')}>Baza i nocleg</a>
          <a href="/#/event/limanowa/start?sekcja=zapisy" onClick={handleSectionLink('zapisy')}>Zapisy</a>
          <a href="/#/event/limanowa/start?sekcja=faq" onClick={handleSectionLink('faq')}>FAQ</a>
          <a href="/#/event/limanowa/start?sekcja=kontakt" onClick={handleSectionLink('kontakt')}>Kontakt</a>
        </nav>
      </header>

      <main className="lim26-main">
        <section className="lim26-hero lim26-scene" id="top">
          <img
            className="lim26-hero-image lim26-motion-media"
            src="/event/limanowa/hero-gra-o-wolnosc-limanowa-2026.png"
            alt="Gra o wolność"
            loading="eager"
          />
          <div className="lim26-hero-overlay" />
          <div className="lim26-hero-content lim26-motion-text">
            <p className="lim26-eyebrow">19–21.06.2026 · Limanowa · zapisy grupowe otwarte</p>
            <h1>Gra o wolność</h1>
            <p className="lim26-subtitle">
              Zośka i parasol: Przygoda, która uczy. Historia, która porusza. Wspólnota, która formuje.
            </p>
            <p className="lim26-tagline">Śladami tych, którzy byli gotowi.</p>
            <div className="lim26-hero-actions">
              <a className="lim26-btn lim26-btn--primary" href="/#/event/limanowa/start?sekcja=zapisy" onClick={handleSectionLink('zapisy')}>Zgłoś grupę</a>
              <a className="lim26-btn lim26-btn--quiet" href="/#/event/limanowa/start?sekcja=weekend" onClick={handleSectionLink('weekend')}>Zobacz, jak wygląda weekend</a>
            </div>
          </div>
        </section>

        <section id="o-wydarzeniu" className="lim26-section lim26-section--alt lim26-scene">
          <div className="lim26-text-col lim26-motion-text">
            <h2>O wydarzeniu</h2>
            <p className="lim26-lead">To wejście w opowieść, która zaczyna się w terenie i dojrzewa we wspólnocie.</p>
            <p>
              Gra o wolność to trzy dni ruchu, decyzji i współpracy. Wchodzisz z grupą w klimat, który buduje napięcie od pierwszego spotkania aż do finału.
            </p>
            <p>
              W centrum jest historia, modlitwa i relacje, ale wszystko dzieje się przez działanie: kontakt z terenem, zadaniami i innymi drużynami.
            </p>
            <p>
              To nie rekonstrukcja i nie stylizacja. To przygoda, która stawia pytania o gotowość, odpowiedzialność i to, jak działać razem, kiedy liczy się każdy krok.
            </p>
          </div>
        </section>

        <section id="dla-kogo" className="lim26-section lim26-scene">
          <div className="lim26-two-col">
            <div className="lim26-motion-text">
              <h2>Dla kogo</h2>
              <p className="lim26-lead">Dla ekip, które chcą wejść razem w mocną przygodę i stanąć do rywalizacji z innymi parafiami.</p>
              <p>
                Zapraszamy grupy parafialne zgłaszane przez osobę pełnoletnią odpowiedzialną za całość wyjazdu. Najbardziej naturalnie odnajdą się tu wspólnoty ministranckie i chłopcy związani z parafią.
              </p>
              <p><strong>Wiek uczestników:</strong> 10–25 lat</p>
              <p>
                <strong>Dla kogo szczególnie:</strong> Od 5 klasy szkoły podstawowej do końca szkoły średniej oraz dla starszych uczestników i opiekunów, którzy chcą iść z grupą jednym rytmem.
              </p>
              <p>
                <strong>Jak zgłasza się udział:</strong> Nie zapisujemy pojedynczych osób przez stronę publiczną. Startuje grupa, a nie pojedynczy zawodnik.
              </p>
            </div>
            <div className="lim26-motion-media">
              <ul className="lim26-feature-list">
                <li>chłopcy z parafii i wspólnot</li>
                <li>grupy ministranckie</li>
                <li>odpowiedzialni dorośli i opiekunowie</li>
                <li>ekipy gotowe na współpracę, wysiłek i rywalizację</li>
              </ul>
            </div>
          </div>
        </section>

        <section id="weekend" className="lim26-section lim26-section--alt lim26-scene">
          <div className="lim26-text-col lim26-motion-text">
            <h2>Jak wygląda weekend</h2>
            <p className="lim26-lead">Weekend prowadzi od wejścia w klimat, przez dzień decyzji, aż po wspólny finał.</p>
            <div className="lim26-flow">
              <article>
                <h3>Piątek — przyjazd i wspólny początek</h3>
                <p>
                  Od 17:00 trwa przyjazd, a o 19:00 ruszamy razem. To moment wejścia w opowieść i pierwsze ustawienie drużyn.
                </p>
              </article>
              <article>
                <h3>Sobota — gra, modlitwa i wielka przygoda</h3>
                <p>
                  Dzień zaczyna Msza Święta o 6:30 i śniadanie o 7:30. O 8:30 otwiera się główna rozgrywka: teren, tempo, decyzje, punkty i starcia między grupami. Wieczorem adoracja (19:00) i finał przy ognisku (20:00).
                </p>
              </article>
              <article>
                <h3>Niedziela — Msza, śniadanie i powrót</h3>
                <p>
                  Domykamy wyjazd wspólnym śniadaniem i Mszą Świętą o 10:30. Około 12:00 wracacie ze swoją historią przeżytą razem.
                </p>
              </article>
            </div>
            <small>Dodatkowy element wieczorny lub nocny może pojawić się jako niespodzianka — jeśli pozwolą na to pogoda i siły uczestników.</small>
          </div>
        </section>

        <section id="gra" className="lim26-section lim26-scene">
          <div className="lim26-two-col lim26-two-col--media">
            <div className="lim26-motion-text">
              <h2>Na czym polega gra</h2>
              <p className="lim26-lead">To nie jest jedna trasa. To żywa rozgrywka, w której Twoja grupa buduje przewagę krok po kroku.</p>
              <p>
                Wchodzicie w teren, pracujecie pod presją czasu i punktów, zbieracie tropy, przekazujecie meldunki i podejmujecie decyzje, które od razu zmieniają sytuację.
              </p>
              <p>
                Obok ruchu działa warstwa interakcji na żywo: dynamiczne komunikaty, bezpośrednie pojedynki wiedzy i odpowiedzi na to, co robią inne parafie.
              </p>
              <p>
                Zaplecze gry korzysta z obszernej bazy wiedzy o „Zośce i Parasolu”, „Kamieniach na szaniec” i realiach epoki, dlatego każda drużyna trafia na inne ścieżki i inne pytania.
              </p>
              <ul className="lim26-feature-lines">
                <li>zadania terenowe</li>
                <li>szyfry i meldunki</li>
                <li>interakcja na żywo</li>
                <li>wiedza: „Zośka i parasol”</li>
                <li>punkty, czas i statystyki</li>
                <li>rywalizacja między parafiami</li>
                <li>współpraca, która decyduje o wyniku</li>
              </ul>
              <p className="lim26-emphasis">Wasza grupa nie odtwarza scenariusza. Wasza grupa pisze własny przebieg tej historii.</p>
            </div>
            <img className="lim26-motion-media" src="/event/limanowa/section-gra-terenowa-ruch.png" alt="Gra terenowa" loading="lazy" />
          </div>
        </section>

        <section id="historia-i-wartosci" className="lim26-section lim26-section--alt lim26-scene">
          <div className="lim26-two-col lim26-two-col--media">
            <div className="lim26-motion-text">
              <h2>Historia i wartości</h2>
              <p className="lim26-lead">Inspiracją jest historia Szarych Szeregów, „Kamienie na szaniec” i książka naukowa „Zośka i parasol”.</p>
              <p>
                Wchodzicie w realne tropy lat 1939–1944: ludzi, decyzji i relacji, które miały cenę. To punkt wyjścia do pytań, które stają przed Wami dzisiaj.
              </p>
              <p>
                Nie chodzi o hasła i dekoracje. Chodzi o odwagę, wierność i odpowiedzialność przeżyte we wspólnocie, w działaniu i w konkretnych wyborach.
              </p>
              <p>
                Dlatego historia nie jest dodatkiem do gry. Jest osią, która porządkuje tempo, relacje i sens całego weekendu.
              </p>
              <blockquote>Każdy ma swoje Westerplatte.</blockquote>
              <ul className="lim26-values">
                <li>przyjaźń</li>
                <li>dojrzałość</li>
                <li>odpowiedzialność</li>
                <li>wierność</li>
                <li>gotowość</li>
                <li>pamięć</li>
                <li>wspólnota</li>
              </ul>
            </div>
            <img className="lim26-motion-media" src="/event/limanowa/section-historia-zoska-parasol.png" alt="Historia i wartości" loading="lazy" />
          </div>
        </section>

        <section id="baza-i-nocleg" className="lim26-section lim26-scene">
          <div className="lim26-two-col">
            <div className="lim26-motion-text">
              <h2>Baza i nocleg</h2>
              <p className="lim26-lead">Wydarzenie ma swoją bazę, ale gra wychodzi szerzej w teren Limanowej.</p>
              <p>
                Bazą wydarzenia jest prywatny teren w Limanowej, przygotowany do przyjęcia uczestników na pobyt i nocleg. Na miejscu dostępne są sanitariaty, prysznic, prąd, woda, przestrzeń wspólna oraz miejsce na duże ognisko.
              </p>
              <p>
                Nocleg odbywa się częściowo w domku letniskowym, częściowo na podłodze oraz w namiotach — własnych albo zapewnionych przez organizatora w granicach możliwości. Liczba miejsc jest ograniczona przez realną pojemność bazy, dlatego przyjmujemy tyle osób, ile jesteśmy w stanie dobrze i odpowiedzialnie przyjąć.
              </p>
              <p>
                Dokładniejsze informacje o bazie, przydziale miejsc i sprawach technicznych otrzyma osoba odpowiedzialna za grupę po zgłoszeniu.
              </p>
            </div>
            <div className="lim26-key-lines lim26-motion-media">
              <p><span>baza:</span> Limanowa</p>
              <p><span>nocleg:</span> domek, podłoga, namioty</p>
              <p><span>sanitariaty:</span> tak</p>
              <p><span>prysznic:</span> tak</p>
              <p><span>prąd i woda:</span> tak</p>
              <p><span>ognisko:</span> tak</p>
              <p><span>parking:</span> tak</p>
            </div>
          </div>
        </section>

        <section id="co-zabrac" className="lim26-section lim26-section--alt lim26-scene">
          <div className="lim26-text-col lim26-motion-text">
            <h2>Co zabrać</h2>
            <p className="lim26-lead">Warto przyjechać przygotowanym, żeby dobrze wejść w cały weekend.</p>
            <p>
              Ta gra wymaga ruchu, uwagi, współpracy i gotowości do działania w terenie. Nie chodzi o przesadną ilość sprzętu, ale o rozsądne przygotowanie.
            </p>
            <ul className="lim26-checklist">
              <li>śpiwór</li>
              <li>rzeczy do noclegu</li>
              <li>ubranie na zmienną pogodę</li>
              <li>wygodne buty do chodzenia</li>
              <li>telefon</li>
              <li>powerbank</li>
              <li>rzeczy osobiste i higieniczne</li>
              <li>prowiant według własnego rozeznania</li>
              <li>coś do notowania, jeśli chcesz</li>
              <li>otwartość na współpracę i uważność</li>
            </ul>
            <p className="lim26-important-note">
              Na wydarzeniu nie przewidujemy alkoholu ani napojów energetycznych — również dla dorosłych.
            </p>
          </div>
        </section>

        <section id="zapisy" className="lim26-section lim26-section--registration lim26-scene">
          <div className="lim26-registration-wrap">
            <div className="lim26-motion-text">
              <h2>Zapisy grup</h2>
              <h3>Zgłoś swoją grupę</h3>
              <p className="lim26-lead">
                Zapisy odbywają się grupowo przez osobę pełnoletnią odpowiedzialną za parafię, wspólnotę albo konkretną ekipę uczestników.
              </p>
              <p>
                Po wysłaniu zgłoszenia organizator kontaktuje się w sprawach organizacyjnych. Następnie osoba odpowiedzialna otrzymuje dalsze informacje i przechodzi do uzupełniania składu grupy przez osobny link.
              </p>
              <p className="lim26-deadlines">
                Zapisy grup do 24.05.2026<br />
                Uzupełnianie uczestników do 01.06.2026
              </p>
              <small>Koszt udziału i szczegóły organizacyjne są przekazywane w dalszym etapie zapisów.</small>
            </div>

            <form className="lim26-form lim26-motion-media" onSubmit={handleSubmit}>
              <label>
                Parafia / wspólnota
                <input value={form.parishName} onChange={handleFormField('parishName')} required />
              </label>
              <label>
                Imię i nazwisko osoby odpowiedzialnej
                <input value={form.responsibleName} onChange={handleFormField('responsibleName')} required />
              </label>
              <label>
                Telefon
                <input value={form.phone} onChange={handleFormField('phone')} required />
              </label>
              <label>
                E-mail
                <input value={form.email} onChange={handleFormField('email')} type="email" required />
              </label>
              <label>
                Przewidywana liczba uczestników
                <input value={form.expectedParticipantCount} onChange={handleFormField('expectedParticipantCount')} type="number" min={0} required />
              </label>
              <small>Jedna grupa może liczyć maksymalnie 12 osób łącznie z opiekunami.</small>
              <label>
                Przewidywana liczba opiekunów
                <input value={form.expectedGuardianCount} onChange={handleFormField('expectedGuardianCount')} type="number" min={1} required />
              </label>
              <small>Jedna grupa może liczyć maksymalnie 12 osób łącznie z opiekunami.</small>
              <label>
                Dodatkowe informacje
                <textarea value={form.notes} onChange={handleFormField('notes')} rows={4} />
              </label>

              <p className="lim26-consent-text">
                Klikając „Wyślij zgłoszenie”, potwierdzasz chęć zgłoszenia grupy na wydarzenie oraz akceptujesz kontakt organizacyjny związany z zapisami. Dane będą przetwarzane zgodnie z polityką prywatności REcreatio oraz regulaminem wydarzenia.
              </p>
              <p className="lim26-links-row">
                <a href={privacyLink}>Polityka prywatności REcreatio</a>
                <a href={rulesLink}>Regulamin wydarzenia</a>
              </p>

              <button type="submit" className="lim26-btn lim26-btn--primary" disabled={pending || siteLoading}>
                {pending ? 'Wysyłanie…' : 'Wyślij zgłoszenie'}
              </button>

              {submitError ? <p className="lim26-error">{submitError}</p> : null}
              {submitSuccess ? <p className="lim26-success">{submitSuccess}</p> : null}
              {siteError ? <p className="lim26-error">{siteError}</p> : null}
            </form>
          </div>
        </section>

        <section id="faq" className="lim26-section lim26-section--alt lim26-scene">
          <div className="lim26-text-col lim26-motion-text">
            <h2>FAQ</h2>
            <div className="lim26-faq-list">
              <details>
                <summary>Kto może wziąć udział?</summary>
                <p>Wydarzenie jest przygotowane dla chłopaków z parafii i wspólnot, szczególnie ministranckich. Zgłoszenia odbywają się grupowo przez osobę pełnoletnią odpowiedzialną za całą ekipę.</p>
              </details>
              <details>
                <summary>Czy można zgłosić się indywidualnie?</summary>
                <p>Nie przez stronę publiczną. Punktem wyjścia jest zgłoszenie grupy przez odpowiedzialnego dorosłego, który później uzupełnia skład uczestników.</p>
              </details>
              <details>
                <summary>Jak wygląda nocleg?</summary>
                <p>Nocleg odbywa się w domku letniskowym, na podłodze oraz w namiotach — własnych albo zapewnionych przez organizatora w granicach możliwości.</p>
              </details>
              <details>
                <summary>Czy trzeba dużo chodzić?</summary>
                <p>Tak. To wydarzenie terenowe, więc trzeba liczyć się z ruchem, zadaniami w przestrzeni miasta i dłuższym wysiłkiem w ciągu dnia.</p>
              </details>
              <details>
                <summary>Czy to bardziej nauka czy bardziej przygoda?</summary>
                <p>Jedno i drugie. Historia nie jest dodatkiem do zabawy, a przygoda nie jest dodatkiem do historii. Te dwie warstwy są ze sobą połączone.</p>
              </details>
              <details>
                <summary>Czy będzie też modlitwa?</summary>
                <p>Tak. W programie są Msza Święta, Jutrznia, Nieszpory, modlitwa przed posiłkami, Apel Jasnogórski i sobotnia adoracja.</p>
              </details>
              <details>
                <summary>Czy trzeba mieć własny transport?</summary>
                <p>Tak. Dojazd odbywa się we własnym zakresie. Na miejscu dostępny jest parking dla większej liczby samochodów.</p>
              </details>
              <details>
                <summary>Czy po zgłoszeniu od razu podaje się wszystkich uczestników?</summary>
                <p>Nie. Najpierw zgłaszana jest grupa przez osobę odpowiedzialną. Następnie przekazywany jest osobny link do dalszego uzupełnienia składu.</p>
              </details>
              <details>
                <summary>Czy będzie ognisko?</summary>
                <p>Tak. Finał sobotniego dnia planowany jest przy ognisku.</p>
              </details>
              <details>
                <summary>Czy może pojawić się dodatkowy nocny element gry?</summary>
                <p>Tak, ale tylko jako dodatkowa niespodzianka i pod warunkiem, że pozwolą na to pogoda oraz siły uczestników.</p>
              </details>
            </div>
          </div>
        </section>

        <section id="kontakt" className="lim26-section lim26-scene">
          <div className="lim26-two-col">
            <div className="lim26-motion-text">
              <h2>Kontakt</h2>
              <p>Masz pytania dotyczące zapisów, organizacji albo samej formuły wydarzenia? Skontaktuj się bezpośrednio z organizatorem.</p>
            </div>
            <div className="lim26-contact-list lim26-motion-media">
              <p><span>Organizator</span>ks. Michał Mleczek</p>
              <p><span>Telefon</span>+48 505 548 677</p>
              <p><span>E-mail</span>mleczek_pradnik@outlook.com</p>
              <a className="lim26-btn lim26-btn--quiet" href="mailto:mleczek_pradnik@outlook.com">Napisz wiadomość</a>
            </div>
          </div>
        </section>

        <section className="lim26-section lim26-section--alt lim26-gallery-placeholder lim26-scene">
          <p className="lim26-motion-text">Po wydarzeniu pojawi się tutaj galeria zdjęć.</p>
        </section>
      </main>

      <footer className="lim26-footer">
        <p>Gra o wolność · 19–21.06.2026 · Limanowa</p>
        <p>Zośka i parasol: Przygoda, która uczy. Historia, która porusza. Wspólnota, która formuje.</p>
        <p>Organizator: ks. Michał Mleczek</p>
        <p>Wydarzenie w ekosystemie REcreatio</p>
      </footer>
    </div>
  );
}

function LimanowaGroupAdminPage({ token }: { token: string }) {
  const [zone, setZone] = useState<LimanowaGroupAdminZone | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [groupPending, setGroupPending] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [groupSuccess, setGroupSuccess] = useState<string | null>(null);

  const [participantPending, setParticipantPending] = useState(false);
  const [participantError, setParticipantError] = useState<string | null>(null);
  const [participantSuccess, setParticipantSuccess] = useState<string | null>(null);

  const [questionPending, setQuestionPending] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);

  const [groupForm, setGroupForm] = useState({
    parishName: '',
    responsibleName: '',
    phone: '',
    email: '',
    expectedParticipantCount: '0',
    expectedGuardianCount: '1',
    notes: ''
  });

  const [participantForm, setParticipantForm] = useState<GroupPanelParticipantForm>(DEFAULT_GROUP_PANEL_PARTICIPANT_FORM);
  const [questionText, setQuestionText] = useState('');
  const [participantStatuses, setParticipantStatuses] = useState<Record<string, string>>({});

  const loadZone = async () => {
    if (!token) {
      setError('Brak tokenu dostępu.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await getLimanowaGroupAdminZone(token);
      setZone(response);
      setGroupForm({
        parishName: response.group.parishName,
        responsibleName: response.group.responsibleName,
        phone: response.group.phone,
        email: response.group.email,
        expectedParticipantCount: String(response.group.expectedParticipantCount),
        expectedGuardianCount: String(response.group.expectedGuardianCount),
        notes: response.group.notes ?? ''
      });
      setParticipantForm((current) => ({ ...current, parishName: response.group.parishName }));
      const statusMap: Record<string, string> = {};
      for (const participant of response.participants) {
        statusMap[participant.id] = participant.status;
      }
      setParticipantStatuses(statusMap);
    } catch (loadError: unknown) {
      setError(parseApiError(loadError, 'Nie udało się pobrać panelu grupy.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadZone();
  }, [token]);

  const handleGroupField =
    (key: keyof typeof groupForm) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setGroupForm((current) => ({ ...current, [key]: event.target.value }));
    };

  const handleSaveGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGroupPending(true);
    setGroupError(null);
    setGroupSuccess(null);

    const expectedParticipantCount = Number.parseInt(groupForm.expectedParticipantCount, 10);
    const expectedGuardianCount = Number.parseInt(groupForm.expectedGuardianCount, 10);
    if (!Number.isFinite(expectedParticipantCount) || !Number.isFinite(expectedGuardianCount)) {
      setGroupError('Podaj poprawne liczby uczestników i opiekunów.');
      setGroupPending(false);
      return;
    }

    try {
      const updatedGroup = await updateLimanowaGroupAdminGroup(token, {
        parishName: groupForm.parishName,
        responsibleName: groupForm.responsibleName,
        phone: groupForm.phone,
        email: groupForm.email,
        expectedParticipantCount,
        expectedGuardianCount,
        notes: groupForm.notes
      });
      setZone((current) =>
        current
          ? {
              ...current,
              group: updatedGroup
            }
          : current
      );
      setGroupSuccess('Dane grupy zostały zapisane.');
    } catch (updateError: unknown) {
      setGroupError(parseApiError(updateError, 'Nie udało się zapisać danych grupy.'));
    } finally {
      setGroupPending(false);
    }
  };

  const handleParticipantField =
    (key: keyof GroupPanelParticipantForm) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setParticipantForm((current) => ({ ...current, [key]: event.target.value }));
    };

  const handleAddParticipant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setParticipantPending(true);
    setParticipantError(null);
    setParticipantSuccess(null);

    try {
      const participant = await createLimanowaGroupAdminParticipant(token, {
        fullName: participantForm.fullName,
        phone: participantForm.phone,
        parishName: participantForm.parishName,
        parentContactName: participantForm.parentContactName,
        parentContactPhone: participantForm.parentContactPhone,
        guardianName: participantForm.guardianName,
        guardianPhone: participantForm.guardianPhone,
        notes: participantForm.notes,
        healthNotes: participantForm.healthNotes,
        accommodationType: participantForm.accommodationType,
        status: participantForm.status
      });

      setZone((current) =>
        current
          ? {
              ...current,
              participants: [...current.participants, participant]
            }
          : current
      );
      setParticipantStatuses((current) => ({ ...current, [participant.id]: participant.status }));
      setParticipantForm((current) => ({
        ...DEFAULT_GROUP_PANEL_PARTICIPANT_FORM,
        parishName: current.parishName
      }));
      setParticipantSuccess('Uczestnik został dodany.');
    } catch (createError: unknown) {
      setParticipantError(parseApiError(createError, 'Nie udało się dodać uczestnika.'));
    } finally {
      setParticipantPending(false);
    }
  };

  const handleParticipantStatusSave = async (participant: LimanowaParticipant) => {
    const status = participantStatuses[participant.id] ?? participant.status;
    setParticipantError(null);

    try {
      const updated = await updateLimanowaGroupAdminParticipant(token, participant.id, {
        fullName: participant.fullName,
        phone: participant.phone,
        parishName: participant.parishName,
        parentContactName: participant.parentContactName ?? null,
        parentContactPhone: participant.parentContactPhone ?? null,
        guardianName: participant.guardianName ?? null,
        guardianPhone: participant.guardianPhone ?? null,
        notes: participant.notes ?? null,
        healthNotes: participant.healthNotes ?? null,
        accommodationType: participant.accommodationType ?? null,
        status
      });

      setZone((current) =>
        current
          ? {
              ...current,
              participants: current.participants.map((entry) => (entry.id === updated.id ? updated : entry))
            }
          : current
      );
    } catch (statusError: unknown) {
      setParticipantError(parseApiError(statusError, 'Nie udało się zaktualizować statusu uczestnika.'));
    }
  };

  const handleAskQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!questionText.trim()) {
      return;
    }

    setQuestionPending(true);
    setQuestionError(null);
    try {
      const updatedThread = await createLimanowaGroupAdminQuestion(token, questionText.trim());
      setZone((current) =>
        current
          ? {
              ...current,
              questionThread: updatedThread
            }
          : current
      );
      setQuestionText('');
    } catch (questionCreateError: unknown) {
      setQuestionError(parseApiError(questionCreateError, 'Nie udało się wysłać pytania.'));
    } finally {
      setQuestionPending(false);
    }
  };

  if (loading) {
    return <div className="lim26-panel-page"><main className="lim26-panel-main"><p>Ładowanie panelu grupy…</p></main></div>;
  }

  if (error || !zone) {
    return (
      <div className="lim26-panel-page">
        <main className="lim26-panel-main">
          <h1>Panel grupy</h1>
          <p className="lim26-error">{error ?? 'Nie udało się załadować panelu grupy.'}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="lim26-panel-page">
      <main className="lim26-panel-main">
        <section className="lim26-panel-section">
          <h1>Panel grupy</h1>
          <h2>Witaj w panelu Twojej grupy</h2>
          <p>Tutaj uzupełnisz skład grupy, sprawdzisz status zgłoszenia, przeczytasz komunikaty organizacyjne i prześlesz pytania do organizatora.</p>
        </section>

        <section className="lim26-panel-section">
          <h3>Status zgłoszenia</h3>
          <StatusBadge value={zone.group.status} />
          <p>Dostępne statusy: Zgłoszenie przyjęte, Czeka na uzupełnienie składu, Skład grupy uzupełniony, Wymaga uzupełnienia danych, Gotowe organizacyjnie.</p>
        </section>

        <section className="lim26-panel-section">
          <h3>Dane grupy</h3>
          <form className="lim26-form" onSubmit={handleSaveGroup}>
            <label>Parafia / wspólnota<input value={groupForm.parishName} onChange={handleGroupField('parishName')} required /></label>
            <label>Osoba odpowiedzialna<input value={groupForm.responsibleName} onChange={handleGroupField('responsibleName')} required /></label>
            <label>Telefon<input value={groupForm.phone} onChange={handleGroupField('phone')} required /></label>
            <label>E-mail<input value={groupForm.email} onChange={handleGroupField('email')} required type="email" /></label>
            <label>Planowana liczba osób<input value={groupForm.expectedParticipantCount} onChange={handleGroupField('expectedParticipantCount')} type="number" min={0} required /></label>
            <label>Liczba opiekunów<input value={groupForm.expectedGuardianCount} onChange={handleGroupField('expectedGuardianCount')} type="number" min={1} required /></label>
            <label>Uwagi<textarea value={groupForm.notes} onChange={handleGroupField('notes')} rows={3} /></label>
            <div className="lim26-inline-actions">
              <button className="lim26-btn lim26-btn--primary" type="submit" disabled={groupPending}>{groupPending ? 'Zapisywanie…' : 'Edytuj dane grupy'}</button>
              <a className="lim26-btn lim26-btn--quiet" href={zone.policyLinks.eventRulesUrl}>Zobacz regulamin</a>
            </div>
            {groupError ? <p className="lim26-error">{groupError}</p> : null}
            {groupSuccess ? <p className="lim26-success">{groupSuccess}</p> : null}
          </form>
        </section>

        <section className="lim26-panel-section">
          <h3>Skład grupy</h3>
          {zone.participants.length === 0 ? (
            <p>Nie dodano jeszcze żadnych uczestników.</p>
          ) : (
            <div className="lim26-table-wrap">
              <table className="lim26-table">
                <thead>
                  <tr>
                    <th>Imię i nazwisko</th>
                    <th>Status</th>
                    <th>Opiekun</th>
                    <th>Zgody</th>
                    <th>Uwagi</th>
                    <th>Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {zone.participants.map((participant) => (
                    <tr key={participant.id}>
                      <td>{participant.fullName}</td>
                      <td>
                        <select
                          value={participantStatuses[participant.id] ?? participant.status}
                          onChange={(event) =>
                            setParticipantStatuses((current) => ({
                              ...current,
                              [participant.id]: event.target.value
                            }))
                          }
                        >
                          {PARTICIPANT_STATUSES.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </td>
                      <td>{participant.guardianName || '—'}</td>
                      <td>{participant.rulesAccepted && participant.privacyAccepted ? 'uzupełnione' : 'brak pełnych zgód'}</td>
                      <td>{participant.healthNotes || participant.notes || '—'}</td>
                      <td>
                        <button type="button" className="lim26-btn lim26-btn--quiet" onClick={() => void handleParticipantStatusSave(participant)}>
                          Zapisz status
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form className="lim26-form lim26-panel-subform" onSubmit={handleAddParticipant}>
            <h4>Dodaj uczestnika</h4>
            <label>Imię i nazwisko<input value={participantForm.fullName} onChange={handleParticipantField('fullName')} required /></label>
            <label>Telefon<input value={participantForm.phone} onChange={handleParticipantField('phone')} required /></label>
            <label>Parafia / wspólnota<input value={participantForm.parishName} onChange={handleParticipantField('parishName')} required /></label>
            <label>Status
              <select value={participantForm.status} onChange={handleParticipantField('status')}>
                {PARTICIPANT_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
            <button className="lim26-btn lim26-btn--primary" type="submit" disabled={participantPending}>
              {participantPending ? 'Dodawanie…' : 'Dodaj uczestnika'}
            </button>
            {participantError ? <p className="lim26-error">{participantError}</p> : null}
            {participantSuccess ? <p className="lim26-success">{participantSuccess}</p> : null}
          </form>
        </section>

        <section className="lim26-panel-section">
          <h3>Status uczestników</h3>
          <ul className="lim26-link-list">
            {PARTICIPANT_STATUSES.map((status) => (
              <li key={status}>
                {status}: {zone.participants.filter((participant) => participant.status === status).length}
              </li>
            ))}
          </ul>
        </section>

        <section className="lim26-panel-section">
          <h3>Nocleg i organizacja</h3>
          <p>Tutaj pojawią się informacje dotyczące noclegu, przyjazdu, rzeczy do zabrania oraz ważnych ustaleń organizacyjnych dla Twojej grupy.</p>
        </section>

        <section className="lim26-panel-section">
          <h3>Ważne komunikaty</h3>
          {zone.announcements.length === 0 ? <p>Brak nowych komunikatów.</p> : null}
          <ul className="lim26-announcements">
            {zone.announcements.map((announcement) => (
              <li key={announcement.id}>
                <strong>{announcement.title}</strong>
                <p>{announcement.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="lim26-panel-section">
          <h3>Pytania i odpowiedzi</h3>
          <p>Jeśli chcesz o coś dopytać, napisz tutaj. Odpowiedzi organizatora pojawią się w tym samym miejscu.</p>

          <form className="lim26-form" onSubmit={handleAskQuestion}>
            <label>
              Zadaj pytanie
              <textarea
                value={questionText}
                onChange={(event) => setQuestionText(event.target.value)}
                placeholder="Napisz krótko, czego dotyczy pytanie."
                rows={3}
              />
            </label>
            <button className="lim26-btn lim26-btn--primary" type="submit" disabled={questionPending}>
              {questionPending ? 'Wysyłanie…' : 'Wyślij pytanie'}
            </button>
            {questionError ? <p className="lim26-error">{questionError}</p> : null}
          </form>

          {zone.questionThread?.messages?.length ? (
            <div className="lim26-thread">
              {zone.questionThread.messages.map((message) => (
                <article key={message.id} className={`lim26-thread-message lim26-thread-message--${message.authorType}`}>
                  <p className="lim26-thread-author">
                    {message.authorType === 'admin' ? 'Odpowiedź organizatora' : 'Wiadomość'}
                  </p>
                  <p>{message.message}</p>
                </article>
              ))}
            </div>
          ) : null}
        </section>

        <section className="lim26-panel-section">
          <h3>Dokumenty i zasady</h3>
          <ul className="lim26-link-list">
            <li><a href={zone.policyLinks.eventRulesUrl}>Regulamin wydarzenia</a></li>
            <li><a href={zone.policyLinks.privacyPolicyUrl}>Polityka prywatności REcreatio</a></li>
            <li><a href={zone.policyLinks.thingsToBringUrl}>Lista rzeczy do zabrania</a></li>
          </ul>
        </section>

        <section className="lim26-panel-section">
          <h3>Kontakt do organizatora</h3>
          <p>W sprawach pilnych możesz skontaktować się bezpośrednio z organizatorem.</p>
          <p>ks. Michał Mleczek · +48 505 548 677 · mleczek_pradnik@outlook.com</p>
        </section>
      </main>
    </div>
  );
}

function LimanowaParticipantPage({ token }: { token: string }) {
  const [zone, setZone] = useState<LimanowaParticipantZone | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<ParticipantSelfForm>(DEFAULT_PARTICIPANT_SELF_FORM);
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const [questionText, setQuestionText] = useState('');
  const [questionPending, setQuestionPending] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);

  const loadZone = async () => {
    if (!token) {
      setError('Brak tokenu uczestnika.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await getLimanowaParticipantZone(token);
      setZone(response);
      setForm({
        fullName: response.participant.fullName,
        phone: response.participant.phone,
        parishName: response.participant.parishName,
        parentContactName: response.participant.parentContactName ?? '',
        parentContactPhone: response.participant.parentContactPhone ?? '',
        guardianName: response.participant.guardianName ?? '',
        guardianPhone: response.participant.guardianPhone ?? '',
        notes: response.participant.notes ?? '',
        healthNotes: response.participant.healthNotes ?? '',
        rulesAccepted: response.participant.rulesAccepted,
        truthConfirmed: response.participant.rulesAccepted,
        rulesRead: response.participant.rulesAccepted,
        privacyRead: response.participant.privacyAccepted
      });
    } catch (loadError: unknown) {
      setError(parseApiError(loadError, 'Nie udało się pobrać panelu uczestnika.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadZone();
  }, [token]);

  const handleField =
    (key: keyof ParticipantSelfForm) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const nextValue = event.target.type === 'checkbox'
        ? (event.target as HTMLInputElement).checked
        : event.target.value;
      setForm((current) => ({
        ...current,
        [key]: nextValue
      }));
    };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const participant = await updateLimanowaParticipantProfile(token, {
        fullName: form.fullName,
        phone: form.phone,
        parishName: form.parishName,
        parentContactName: form.parentContactName,
        parentContactPhone: form.parentContactPhone,
        guardianName: form.guardianName,
        guardianPhone: form.guardianPhone,
        notes: form.notes,
        healthNotes: form.healthNotes,
        rulesAccepted: form.rulesAccepted && form.truthConfirmed && form.rulesRead,
        privacyAccepted: form.privacyRead
      });

      setZone((current) =>
        current
          ? {
              ...current,
              participant
            }
          : current
      );
      setSaveSuccess('Dane uczestnika zostały zapisane.');
    } catch (saveProfileError: unknown) {
      setSaveError(parseApiError(saveProfileError, 'Nie udało się zapisać danych uczestnika.'));
    } finally {
      setPending(false);
    }
  };

  const handleQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!questionText.trim()) {
      return;
    }

    setQuestionPending(true);
    setQuestionError(null);
    try {
      const thread = await createLimanowaParticipantQuestion(token, questionText.trim());
      setZone((current) =>
        current
          ? {
              ...current,
              questionThread: thread
            }
          : current
      );
      setQuestionText('');
    } catch (questionCreateError: unknown) {
      setQuestionError(parseApiError(questionCreateError, 'Nie udało się wysłać pytania.'));
    } finally {
      setQuestionPending(false);
    }
  };

  if (loading) {
    return <div className="lim26-panel-page"><main className="lim26-panel-main"><p>Ładowanie panelu uczestnika…</p></main></div>;
  }

  if (error || !zone) {
    return (
      <div className="lim26-panel-page">
        <main className="lim26-panel-main">
          <h1>Panel uczestnika</h1>
          <p className="lim26-error">{error ?? 'Nie udało się załadować panelu uczestnika.'}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="lim26-panel-page">
      <main className="lim26-panel-main lim26-panel-main--participant">
        <section className="lim26-panel-section">
          <h1>Panel uczestnika</h1>
          <h2>Twoje informacje o wyjeździe</h2>
          <p>Tutaj znajdziesz najważniejsze informacje dotyczące Twojego udziału oraz uzupełnisz potrzebne dane.</p>
        </section>

        <section className="lim26-panel-section">
          <h3>Status zgłoszenia</h3>
          <StatusBadge value={zone.participant.status} />
          <p>Dostępne statusy: Oczekuje na uzupełnienie, Dane uzupełnione, Wymaga poprawy, Gotowe organizacyjnie.</p>
        </section>

        <section className="lim26-panel-section">
          <form className="lim26-form" onSubmit={handleSave}>
            <h3>Dane uczestnika</h3>
            <label>Imię i nazwisko<input value={form.fullName} onChange={handleField('fullName')} required /></label>
            <label>Telefon<input value={form.phone} onChange={handleField('phone')} required /></label>
            <label>Parafia / wspólnota<input value={form.parishName} onChange={handleField('parishName')} required /></label>

            <h3>Kontakt do rodzica / opiekuna</h3>
            <label>Imię i nazwisko<input value={form.parentContactName} onChange={handleField('parentContactName')} /></label>
            <label>Telefon<input value={form.parentContactPhone} onChange={handleField('parentContactPhone')} /></label>

            <h3>Opiekun podczas wyjazdu</h3>
            <label>Osoba odpowiedzialna<input value={form.guardianName} onChange={handleField('guardianName')} /></label>
            <label>Telefon kontaktowy<input value={form.guardianPhone} onChange={handleField('guardianPhone')} /></label>

            <h3>Uwagi organizacyjne i zdrowotne</h3>
            <label>
              Dodatkowe informacje
              <textarea
                value={form.healthNotes || form.notes}
                onChange={handleField('healthNotes')}
                placeholder="Wpisz tutaj ważne informacje zdrowotne lub organizacyjne."
                rows={4}
              />
            </label>

            <h3>Zgody i zasady</h3>
            <label className="lim26-checkbox-row">
              <input type="checkbox" checked={form.rulesAccepted} onChange={handleField('rulesAccepted')} />
              Akceptuję zasady udziału w wydarzeniu
            </label>
            <label className="lim26-checkbox-row">
              <input type="checkbox" checked={form.truthConfirmed} onChange={handleField('truthConfirmed')} />
              Potwierdzam prawdziwość podanych danych
            </label>
            <label className="lim26-checkbox-row">
              <input type="checkbox" checked={form.rulesRead} onChange={handleField('rulesRead')} />
              Zapoznałem się z regulaminem wydarzenia
            </label>
            <label className="lim26-checkbox-row">
              <input type="checkbox" checked={form.privacyRead} onChange={handleField('privacyRead')} />
              Zapoznałem się z polityką prywatności REcreatio
            </label>

            <button className="lim26-btn lim26-btn--primary" type="submit" disabled={pending}>
              {pending ? 'Zapisywanie…' : 'Zapisz dane'}
            </button>
            {saveError ? <p className="lim26-error">{saveError}</p> : null}
            {saveSuccess ? <p className="lim26-success">{saveSuccess}</p> : null}
          </form>
        </section>

        <section className="lim26-panel-section">
          <h3>Ważne informacje przed wyjazdem</h3>
          <p>Zadbaj o nocleg, ubranie na zmienną pogodę, wygodne buty, telefon, powerbank i rzeczy osobiste. Pamiętaj też, że na wydarzeniu nie przewidujemy alkoholu ani energetyków.</p>
        </section>

        <section className="lim26-panel-section">
          <h3>Pytania i odpowiedzi</h3>
          <p>Jeśli masz pytanie dotyczące udziału, możesz zadać je tutaj.</p>
          <form className="lim26-form" onSubmit={handleQuestion}>
            <label>
              Twoje pytanie
              <textarea value={questionText} onChange={(event) => setQuestionText(event.target.value)} rows={3} />
            </label>
            <button className="lim26-btn lim26-btn--primary" type="submit" disabled={questionPending}>
              {questionPending ? 'Wysyłanie…' : 'Wyślij pytanie'}
            </button>
            {questionError ? <p className="lim26-error">{questionError}</p> : null}
          </form>

          {zone.questionThread?.messages?.length ? (
            <div className="lim26-thread">
              {zone.questionThread.messages.map((message) => (
                <article key={message.id} className={`lim26-thread-message lim26-thread-message--${message.authorType}`}>
                  <p className="lim26-thread-author">
                    {message.authorType === 'admin' ? 'Odpowiedź organizatora' : 'Wiadomość'}
                  </p>
                  <p>{message.message}</p>
                </article>
              ))}
            </div>
          ) : null}
        </section>

        <section className="lim26-panel-section">
          <h3>Kontakt</h3>
          <p>W razie ważnych spraw organizacyjnych możesz skontaktować się z organizatorem.</p>
          <p>ks. Michał Mleczek · +48 505 548 677 · mleczek_pradnik@outlook.com</p>
        </section>
      </main>
    </div>
  );
}

function LimanowaAdminPage({ showProfileMenu, onAuthAction }: Pick<SharedEventPageProps, 'showProfileMenu' | 'onAuthAction'>) {
  const [adminStatus, setAdminStatus] = useState<LimanowaAdminStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<LimanowaAdminDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const [claimPending, setClaimPending] = useState(false);
  const [bootstrapPending, setBootstrapPending] = useState(false);
  const [adminActionError, setAdminActionError] = useState<string | null>(null);

  const [settingsPending, setSettingsPending] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  const [announcementForm, setAnnouncementForm] = useState<AnnouncementForm>(DEFAULT_ANNOUNCEMENT_FORM);
  const [announcementPending, setAnnouncementPending] = useState(false);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);

  const [groupStatusMap, setGroupStatusMap] = useState<Record<string, string>>({});
  const [participantStatusMap, setParticipantStatusMap] = useState<Record<string, string>>({});
  const [accommodationTypeMap, setAccommodationTypeMap] = useState<Record<string, string>>({});
  const [accommodationNoteMap, setAccommodationNoteMap] = useState<Record<string, string>>({});

  const [groupLinks, setGroupLinks] = useState<Record<string, LimanowaAccessLink>>({});
  const [participantLinks, setParticipantLinks] = useState<Record<string, LimanowaAccessLink>>({});

  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [replyStatusMap, setReplyStatusMap] = useState<Record<string, string>>({});

  const [settingsForm, setSettingsForm] = useState({
    title: 'Gra o wolność',
    subtitle: 'Zośka i parasol: Przygoda, która uczy. Historia, która porusza. Wspólnota, która formuje.',
    tagline: 'Śladami tych, którzy byli gotowi.',
    capacityTotal: '40',
    registrationOpen: true,
    registrationGroupsDeadline: '2026-05-24',
    registrationParticipantsDeadline: '2026-06-01',
    published: true,
    privacyPolicyUrl: '/#/legal',
    eventRulesUrl: '/#/event/limanowa/start?sekcja=faq',
    thingsToBringUrl: '/#/event/limanowa/start?sekcja=co-zabrac'
  });

  const eventId = dashboard?.event.id ?? null;

  const loadStatus = async () => {
    if (!showProfileMenu) {
      setStatusLoading(false);
      return;
    }

    setStatusLoading(true);
    setStatusError(null);
    try {
      const response = await getLimanowaAdminStatus();
      setAdminStatus(response);
    } catch (error: unknown) {
      setStatusError(parseApiError(error, 'Nie udało się pobrać statusu administratora.'));
    } finally {
      setStatusLoading(false);
    }
  };

  const loadDashboard = async (targetEventId: string) => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const response = await getLimanowaAdminDashboard(targetEventId);
      setDashboard(response);
      setSettingsForm({
        title: response.event.title,
        subtitle: response.event.subtitle,
        tagline: response.event.tagline,
        capacityTotal: String(response.event.capacityTotal),
        registrationOpen: response.event.registrationOpen,
        registrationGroupsDeadline: response.event.registrationGroupsDeadline,
        registrationParticipantsDeadline: response.event.registrationParticipantsDeadline,
        published: response.event.published,
        privacyPolicyUrl: response.policyLinks.privacyPolicyUrl,
        eventRulesUrl: response.policyLinks.eventRulesUrl,
        thingsToBringUrl: response.policyLinks.thingsToBringUrl
      });

      const nextGroupStatusMap: Record<string, string> = {};
      for (const group of response.groups) {
        nextGroupStatusMap[group.id] = group.status;
      }
      setGroupStatusMap(nextGroupStatusMap);

      const nextParticipantStatusMap: Record<string, string> = {};
      const nextAccommodationTypeMap: Record<string, string> = {};
      for (const participant of response.participants) {
        nextParticipantStatusMap[participant.id] = participant.status;
        nextAccommodationTypeMap[participant.id] = participant.accommodationType ?? 'nieprzypisano';
      }
      setParticipantStatusMap(nextParticipantStatusMap);
      setAccommodationTypeMap(nextAccommodationTypeMap);
    } catch (error: unknown) {
      setDashboardError(parseApiError(error, 'Nie udało się pobrać panelu głównego.'));
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, [showProfileMenu]);

  useEffect(() => {
    if (!showProfileMenu || !adminStatus?.hasAdmin || !adminStatus.limanowaProvisioned) {
      setDashboard(null);
      return;
    }

    let active = true;
    getLimanowaEventSite(LIMANOWA_SLUG)
      .then((site) => {
        if (!active) return;
        if (site.id) {
          void loadDashboard(site.id);
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setDashboardError(parseApiError(error, 'Nie udało się ustalić identyfikatora wydarzenia.'));
      });

    return () => {
      active = false;
    };
  }, [adminStatus, showProfileMenu]);

  const handleClaim = async () => {
    setClaimPending(true);
    setAdminActionError(null);
    try {
      await claimLimanowaAdmin();
      await loadStatus();
    } catch (error: unknown) {
      setAdminActionError(parseApiError(error, 'Nie udało się przypisać administratora.'));
    } finally {
      setClaimPending(false);
    }
  };

  const handleBootstrap = async () => {
    setBootstrapPending(true);
    setAdminActionError(null);
    try {
      const site = await bootstrapLimanowaEvent();
      await loadStatus();
      if (site.id) {
        await loadDashboard(site.id);
      }
    } catch (error: unknown) {
      setAdminActionError(parseApiError(error, 'Nie udało się przygotować wydarzenia Limanowa.'));
    } finally {
      setBootstrapPending(false);
    }
  };

  const handleSettingsField =
    (key: keyof typeof settingsForm) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const nextValue = event.target.type === 'checkbox'
        ? (event.target as HTMLInputElement).checked
        : event.target.value;
      setSettingsForm((current) => ({
        ...current,
        [key]: nextValue
      }));
    };

  const handleSaveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!eventId) {
      setSettingsError('Brak identyfikatora wydarzenia.');
      return;
    }

    setSettingsPending(true);
    setSettingsError(null);
    setSettingsSuccess(null);

    try {
      await updateLimanowaAdminEventSettings(eventId, {
        title: settingsForm.title,
        subtitle: settingsForm.subtitle,
        tagline: settingsForm.tagline,
        capacityTotal: Number.parseInt(settingsForm.capacityTotal, 10) || 1,
        registrationOpen: settingsForm.registrationOpen,
        registrationGroupsDeadline: settingsForm.registrationGroupsDeadline,
        registrationParticipantsDeadline: settingsForm.registrationParticipantsDeadline,
        published: settingsForm.published,
        privacyPolicyUrl: settingsForm.privacyPolicyUrl,
        eventRulesUrl: settingsForm.eventRulesUrl,
        thingsToBringUrl: settingsForm.thingsToBringUrl
      });
      await loadDashboard(eventId);
      setSettingsSuccess('Ustawienia wydarzenia zostały zapisane.');
    } catch (error: unknown) {
      setSettingsError(parseApiError(error, 'Nie udało się zapisać ustawień wydarzenia.'));
    } finally {
      setSettingsPending(false);
    }
  };

  const handleGroupStatus = async (group: LimanowaGroup) => {
    if (!eventId) {
      return;
    }
    const status = groupStatusMap[group.id] ?? group.status;
    try {
      await updateLimanowaAdminGroupStatus(eventId, group.id, status);
      await loadDashboard(eventId);
    } catch (error: unknown) {
      setDashboardError(parseApiError(error, 'Nie udało się zaktualizować statusu grupy.'));
    }
  };

  const handleParticipantStatus = async (participant: LimanowaParticipant) => {
    if (!eventId) {
      return;
    }
    const status = participantStatusMap[participant.id] ?? participant.status;
    try {
      await updateLimanowaAdminParticipantStatus(eventId, participant.id, status);
      await loadDashboard(eventId);
    } catch (error: unknown) {
      setDashboardError(parseApiError(error, 'Nie udało się zaktualizować statusu uczestnika.'));
    }
  };

  const handleParticipantAccommodation = async (participant: LimanowaParticipant) => {
    if (!eventId) {
      return;
    }
    const type = accommodationTypeMap[participant.id] ?? 'nieprzypisano';
    const note = accommodationNoteMap[participant.id] ?? '';
    try {
      await updateLimanowaAdminAccommodation(eventId, participant.id, { type, note });
      await loadDashboard(eventId);
    } catch (error: unknown) {
      setDashboardError(parseApiError(error, 'Nie udało się zapisać noclegu.'));
    }
  };

  const handleAnnouncementField =
    (key: keyof AnnouncementForm) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setAnnouncementForm((current) => ({
        ...current,
        [key]: event.target.value
      }));
    };

  const handleCreateAnnouncement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!eventId) {
      return;
    }

    setAnnouncementPending(true);
    setAnnouncementError(null);
    try {
      await createLimanowaAdminAnnouncement(eventId, announcementForm);
      setAnnouncementForm(DEFAULT_ANNOUNCEMENT_FORM);
      await loadDashboard(eventId);
    } catch (error: unknown) {
      setAnnouncementError(parseApiError(error, 'Nie udało się opublikować komunikatu.'));
    } finally {
      setAnnouncementPending(false);
    }
  };

  const handleGenerateGroupAccess = async (groupId: string) => {
    if (!eventId) {
      return;
    }
    try {
      const access = await generateLimanowaGroupAdminAccess(eventId, groupId);
      setGroupLinks((current) => ({ ...current, [groupId]: access }));
    } catch (error: unknown) {
      setDashboardError(parseApiError(error, 'Nie udało się wygenerować linku grupy.'));
    }
  };

  const handleGenerateParticipantAccess = async (participantId: string) => {
    if (!eventId) {
      return;
    }
    try {
      const access = await generateLimanowaParticipantAccess(eventId, participantId);
      setParticipantLinks((current) => ({ ...current, [participantId]: access }));
    } catch (error: unknown) {
      setDashboardError(parseApiError(error, 'Nie udało się wygenerować linku uczestnika.'));
    }
  };

  const handleReplyThread = async (thread: LimanowaQuestionThread) => {
    if (!eventId) {
      return;
    }
    const message = (replyTextMap[thread.id] ?? '').trim();
    if (!message) {
      return;
    }
    const status = (replyStatusMap[thread.id] ?? 'answered') as 'open' | 'answered' | 'closed';

    try {
      await replyLimanowaAdminThread(eventId, thread.id, { message, status });
      setReplyTextMap((current) => ({ ...current, [thread.id]: '' }));
      await loadDashboard(eventId);
    } catch (error: unknown) {
      setDashboardError(parseApiError(error, 'Nie udało się wysłać odpowiedzi organizatora.'));
    }
  };

  if (!showProfileMenu) {
    return (
      <div className="lim26-panel-page">
        <main className="lim26-panel-main">
          <h1>Panel główny wydarzenia</h1>
          <p>To strefa wewnętrzna. Zaloguj się, aby zarządzać wydarzeniem.</p>
          <button className="lim26-btn lim26-btn--primary" type="button" onClick={onAuthAction}>Przejdź do logowania</button>
        </main>
      </div>
    );
  }

  return (
    <div className="lim26-panel-page">
      <main className="lim26-panel-main">
        <section className="lim26-panel-section">
          <h1>Panel główny wydarzenia</h1>
          <p>Panel wewnętrzny dla wydarzenia „Gra o wolność”.</p>
          {statusLoading ? <p>Sprawdzanie statusu administratora…</p> : null}
          {statusError ? <p className="lim26-error">{statusError}</p> : null}
          {adminStatus ? (
            <>
              <p>
                {adminStatus.hasAdmin
                  ? `Administrator: ${adminStatus.adminDisplayName ?? 'użytkownik systemowy'}`
                  : 'Brak przypisanego administratora.'}
              </p>
              {!adminStatus.hasAdmin ? (
                <button className="lim26-btn lim26-btn--primary" type="button" onClick={() => void handleClaim()} disabled={claimPending}>
                  {claimPending ? 'Przypisywanie…' : 'Ustaw administratora'}
                </button>
              ) : null}
              {adminStatus.hasAdmin && !adminStatus.limanowaProvisioned ? (
                <button className="lim26-btn lim26-btn--primary" type="button" onClick={() => void handleBootstrap()} disabled={bootstrapPending}>
                  {bootstrapPending ? 'Przygotowywanie…' : 'Przygotuj wydarzenie Limanowa'}
                </button>
              ) : null}
            </>
          ) : null}
          {adminActionError ? <p className="lim26-error">{adminActionError}</p> : null}
        </section>

        {dashboardLoading ? <p>Ładowanie panelu administracyjnego…</p> : null}
        {dashboardError ? <p className="lim26-error">{dashboardError}</p> : null}

        {dashboard ? (
          <>
            <section className="lim26-panel-section">
              <h2>Statystyki</h2>
              <div className="lim26-stats-grid">
                <p><span>Grupy</span>{dashboard.stats.groups}</p>
                <p><span>Uczestnicy</span>{dashboard.stats.participants}</p>
                <p><span>Gotowi uczestnicy</span>{dashboard.stats.participantsReady}</p>
                <p><span>Wymaga poprawy</span>{dashboard.stats.participantsNeedsFix}</p>
                <p><span>Przypisany nocleg</span>{dashboard.stats.accommodationAssigned}</p>
                <p><span>Otwarte pytania</span>{dashboard.stats.openThreads}</p>
              </div>
            </section>

            <section className="lim26-panel-section">
              <h2>Ustawienia publiczne wydarzenia</h2>
              <form className="lim26-form" onSubmit={handleSaveSettings}>
                <label>Tytuł<input value={settingsForm.title} onChange={handleSettingsField('title')} required /></label>
                <label>Podtytuł<textarea value={settingsForm.subtitle} onChange={handleSettingsField('subtitle')} rows={3} required /></label>
                <label>Tagline<input value={settingsForm.tagline} onChange={handleSettingsField('tagline')} required /></label>
                <label>Pojemność całkowita<input value={settingsForm.capacityTotal} onChange={handleSettingsField('capacityTotal')} type="number" min={1} required /></label>
                <label>Termin zapisów grup<input value={settingsForm.registrationGroupsDeadline} onChange={handleSettingsField('registrationGroupsDeadline')} type="date" required /></label>
                <label>Termin uzupełniania uczestników<input value={settingsForm.registrationParticipantsDeadline} onChange={handleSettingsField('registrationParticipantsDeadline')} type="date" required /></label>
                <label>Polityka prywatności<input value={settingsForm.privacyPolicyUrl} onChange={handleSettingsField('privacyPolicyUrl')} required /></label>
                <label>Regulamin wydarzenia<input value={settingsForm.eventRulesUrl} onChange={handleSettingsField('eventRulesUrl')} required /></label>
                <label>Lista rzeczy do zabrania<input value={settingsForm.thingsToBringUrl} onChange={handleSettingsField('thingsToBringUrl')} required /></label>
                <label className="lim26-checkbox-row"><input type="checkbox" checked={settingsForm.registrationOpen} onChange={handleSettingsField('registrationOpen')} />Zapisy otwarte</label>
                <label className="lim26-checkbox-row"><input type="checkbox" checked={settingsForm.published} onChange={handleSettingsField('published')} />Strona opublikowana</label>
                <button className="lim26-btn lim26-btn--primary" type="submit" disabled={settingsPending}>{settingsPending ? 'Zapisywanie…' : 'Zapisz ustawienia'}</button>
                {settingsError ? <p className="lim26-error">{settingsError}</p> : null}
                {settingsSuccess ? <p className="lim26-success">{settingsSuccess}</p> : null}
              </form>
            </section>

            <section className="lim26-panel-section">
              <h2>Grupy</h2>
              <div className="lim26-table-wrap">
                <table className="lim26-table">
                  <thead>
                    <tr>
                      <th>Parafia / wspólnota</th>
                      <th>Osoba odpowiedzialna</th>
                      <th>Status</th>
                      <th>Link panelu grupy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.groups.map((group) => (
                      <tr key={group.id}>
                        <td>{group.parishName}</td>
                        <td>{group.responsibleName}<br />{group.phone}</td>
                        <td>
                          <select value={groupStatusMap[group.id] ?? group.status} onChange={(event) => setGroupStatusMap((current) => ({ ...current, [group.id]: event.target.value }))}>
                            {GROUP_STATUSES.map((status) => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                          <button className="lim26-btn lim26-btn--quiet" type="button" onClick={() => void handleGroupStatus(group)}>Zapisz</button>
                        </td>
                        <td>
                          <button className="lim26-btn lim26-btn--quiet" type="button" onClick={() => void handleGenerateGroupAccess(group.id)}>
                            Generuj / odśwież link
                          </button>
                          {groupLinks[group.id] ? (
                            <div className="lim26-access-links">
                              <a href={groupLinks[group.id].link} target="_blank" rel="noreferrer">Otwórz link</a>
                              <a href={groupLinks[group.id].smsHref}>Wyślij SMS</a>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="lim26-panel-section">
              <h2>Uczestnicy</h2>
              <div className="lim26-table-wrap">
                <table className="lim26-table">
                  <thead>
                    <tr>
                      <th>Imię i nazwisko</th>
                      <th>Status</th>
                      <th>Nocleg</th>
                      <th>Panel uczestnika</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.participants.map((participant) => (
                      <tr key={participant.id}>
                        <td>{participant.fullName}<br />{participant.phone}</td>
                        <td>
                          <select value={participantStatusMap[participant.id] ?? participant.status} onChange={(event) => setParticipantStatusMap((current) => ({ ...current, [participant.id]: event.target.value }))}>
                            {PARTICIPANT_STATUSES.map((status) => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                          <button className="lim26-btn lim26-btn--quiet" type="button" onClick={() => void handleParticipantStatus(participant)}>Zapisz</button>
                        </td>
                        <td>
                          <input value={accommodationTypeMap[participant.id] ?? ''} onChange={(event) => setAccommodationTypeMap((current) => ({ ...current, [participant.id]: event.target.value }))} />
                          <input placeholder="Notatka" value={accommodationNoteMap[participant.id] ?? ''} onChange={(event) => setAccommodationNoteMap((current) => ({ ...current, [participant.id]: event.target.value }))} />
                          <button className="lim26-btn lim26-btn--quiet" type="button" onClick={() => void handleParticipantAccommodation(participant)}>Zapisz nocleg</button>
                        </td>
                        <td>
                          <button className="lim26-btn lim26-btn--quiet" type="button" onClick={() => void handleGenerateParticipantAccess(participant.id)}>
                            Generuj / odśwież link
                          </button>
                          {participantLinks[participant.id] ? (
                            <div className="lim26-access-links">
                              <a href={participantLinks[participant.id].link} target="_blank" rel="noreferrer">Otwórz link</a>
                              <a href={participantLinks[participant.id].smsHref}>Wyślij SMS</a>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="lim26-panel-section">
              <h2>Pytania i odpowiedzi</h2>
              {dashboard.questionThreads.length === 0 ? <p>Brak aktywnych wątków pytań.</p> : null}
              {dashboard.questionThreads.map((thread) => (
                <article key={thread.id} className="lim26-admin-thread">
                  <h4>{thread.relatedType === 'group' ? 'Wątek grupy' : 'Wątek uczestnika'} · {thread.relatedId}</h4>
                  <StatusBadge value={threadStatusLabel(thread.status)} />
                  <div className="lim26-thread">
                    {thread.messages.map((message) => (
                      <article key={message.id} className={`lim26-thread-message lim26-thread-message--${message.authorType}`}>
                        <p className="lim26-thread-author">{authorTypeLabel(message.authorType)}</p>
                        <p>{message.message}</p>
                      </article>
                    ))}
                  </div>
                  <textarea
                    rows={3}
                    value={replyTextMap[thread.id] ?? ''}
                    onChange={(event) => setReplyTextMap((current) => ({ ...current, [thread.id]: event.target.value }))}
                    placeholder="Odpowiedź organizatora"
                  />
                  <select
                    value={replyStatusMap[thread.id] ?? 'answered'}
                    onChange={(event) => setReplyStatusMap((current) => ({ ...current, [thread.id]: event.target.value }))}
                  >
                    <option value="open">otwarte</option>
                    <option value="answered">odpowiedziane</option>
                    <option value="closed">zamknięte</option>
                  </select>
                  <button className="lim26-btn lim26-btn--quiet" type="button" onClick={() => void handleReplyThread(thread)}>
                    Wyślij odpowiedź
                  </button>
                </article>
              ))}
            </section>

            <section className="lim26-panel-section">
              <h2>Komunikaty</h2>
              <form className="lim26-form" onSubmit={handleCreateAnnouncement}>
                <label>Tytuł<input value={announcementForm.title} onChange={handleAnnouncementField('title')} required /></label>
                <label>Treść<textarea value={announcementForm.body} onChange={handleAnnouncementField('body')} rows={4} required /></label>
                <label>Odbiorcy
                  <select value={announcementForm.audienceType} onChange={handleAnnouncementField('audienceType')}>
                    <option value="all">wszyscy</option>
                    <option value="group-admin">panel grupy</option>
                    <option value="participant">panel uczestnika</option>
                    <option value="admin">panel administratora</option>
                  </select>
                </label>
                <button className="lim26-btn lim26-btn--primary" type="submit" disabled={announcementPending}>
                  {announcementPending ? 'Publikowanie…' : 'Opublikuj komunikat'}
                </button>
                {announcementError ? <p className="lim26-error">{announcementError}</p> : null}
              </form>

              <ul className="lim26-announcements">
                {dashboard.announcements.map((announcement) => (
                  <li key={announcement.id}>
                    <strong>{announcement.title}</strong>
                    <p>{announcement.body}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="lim26-panel-section">
              <h2>Eksport CSV</h2>
              <div className="lim26-export-links">
                <a href={getLimanowaAdminExportUrl(eventId!, 'groups')} target="_blank" rel="noreferrer">Grupy</a>
                <a href={getLimanowaAdminExportUrl(eventId!, 'participants')} target="_blank" rel="noreferrer">Uczestnicy</a>
                <a href={getLimanowaAdminExportUrl(eventId!, 'statuses')} target="_blank" rel="noreferrer">Statusy</a>
                <a href={getLimanowaAdminExportUrl(eventId!, 'accommodation')} target="_blank" rel="noreferrer">Nocleg</a>
                <a href={getLimanowaAdminExportUrl(eventId!, 'consents')} target="_blank" rel="noreferrer">Zgody</a>
                <a href={getLimanowaAdminExportUrl(eventId!, 'questions')} target="_blank" rel="noreferrer">Pytania</a>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

export function LimanowaEventPage(props: SharedEventPageProps & { page: EventInnerPage; event: EventDefinition }) {
  const { page } = props;
  const location = useLocation();
  const token = useMemo(() => decodeTokenFromPath(location.pathname), [location.pathname]);

  if (page.slug === 'group-admin') {
    return <LimanowaGroupAdminPage token={token} />;
  }

  if (page.slug === 'participant') {
    return <LimanowaParticipantPage token={token} />;
  }

  if (page.slug === 'admin') {
    return <LimanowaAdminPage showProfileMenu={props.showProfileMenu} onAuthAction={props.onAuthAction} />;
  }

  return (
    <LimanowaStartPage
      onNavigate={props.onNavigate}
    />
  );
}
