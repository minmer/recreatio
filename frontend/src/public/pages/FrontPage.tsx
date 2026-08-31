/**
 * Die Startseite — ein Bogen mit acht Sätzen.
 *
 *   These    Der Mensch wird in Teile zerlegt. Dagegen ist das hier gebaut.
 *   Bereiche Sechs Tafeln, die wechseln — was das konkret heisst.
 *   Ort      Zuerst das Haus.
 *   Beleg    Es geschieht bereits.
 *   Werk     Cogita, das meistgenutzte Stück.
 *   Haltung  Kein Verwalter. Wie gebaut wird, ist selbst eine Aussage.
 *   Plan     Acht Schritte MIT ZUSTAND — und der, auf dem wir stehen.
 *   Schluss  Die vier Wörter und die ehrliche Zeile.
 *
 * <b>Drei Stellen bewegen sich, und jede trägt Inhalt.</b> Die Zahlen zählen
 * hoch, die Bereiche wechseln, der Plan zeigt seinen Zustand. Bewegung ohne
 * Inhalt gibt es nicht: eine Seite, auf der etwas wackelt, damit sie lebendig
 * wirkt, ist eine Seite, die nichts zu sagen hat.
 *
 * <b>Der Zustand im Plan ist der ehrlichste Teil der Seite.</b> Acht Vorhaben
 * ohne Angabe, was davon läuft, sind ein Wunschzettel. Mit „läuft / im Bau /
 * geplant" wird daraus eine Auskunft — und drei der acht stehen auf „läuft",
 * weil sie seit Jahren laufen.
 *
 * <b>Der Farbwechsel ist Inhalt.</b> Die ersten fünf Sätze liegen auf Papier,
 * die letzten drei auf dem dunklen Grund der Werkstatt: dieselbe Kante wie in
 * der Plattform — hell ist, was offen liegt, dunkel, was verschlossen ist.
 */

import { useEffect, useRef, useState } from 'react';
import type { Fact, PublicCopy, Slide } from '../content';
import { publicHref, type PublicPage } from '../publicRoutes';

/* -- Zahlen, die hochzählen -------------------------------------------------
 *
 * Nur der führende Zahlenteil zählt; „64 MiB" behält sein Mass. Wer die
 * Einheit mitzählen liesse, bekäme „6 MiB, 24 MiB, 64 MiB" — eine Angabe, die
 * unterwegs dreimal falsch war.
 */
function CountUp({ fact, run }: { fact: Fact; run: boolean }) {
  const match = /^(\d+)(.*)$/.exec(fact.value);
  const target = match === null ? 0 : Number(match[1]);
  const suffix = match === null ? '' : match[2];

  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!run || match === null || target === 0) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setShown(target); return; }

    const started = performance.now();
    const span = 900;
    let frame = 0;

    const tick = (now: number) => {
      const part = Math.min(1, (now - started) / span);
      // Am Ende langsamer: eine Zahl, die abrupt stehen bleibt, wirkt wie ein
      // Sprung, keine Bewegung.
      const eased = 1 - Math.pow(1 - part, 3);
      setShown(Math.round(target * eased));
      if (part < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [run, target, match]);

  if (match === null) return <dt>{fact.value}</dt>;
  return <dt>{shown}{suffix}</dt>;
}

function Facts({ facts, run }: { facts: readonly Fact[]; run: boolean }) {
  return (
    <dl className="pub-facts">
      {facts.map((fact) => (
        <div key={fact.label}>
          <CountUp fact={fact} run={run} />
          <dd>{fact.label}</dd>
        </div>
      ))}
    </dl>
  );
}

/* -- Die Seite -------------------------------------------------------------- */

interface Panel {
  readonly key: string;
  readonly page: PublicPage;
  readonly slide: Slide;
  readonly tone: 'paper' | 'sealed';
  readonly lead?: boolean;
}

export function FrontPage({ copy }: { copy: PublicCopy }) {
  const t = copy.front;

  const before: readonly Panel[] = [
    { key: 'thesis', page: 'recreatio', slide: t.thesis, tone: 'paper', lead: true }
  ];

  const middle: readonly Panel[] = [
    { key: 'osrodek', page: 'osrodek', slide: t.osrodek, tone: 'paper' },
    { key: 'wydarzenia', page: 'wydarzenia', slide: t.wydarzenia, tone: 'paper' },
    { key: 'cogita', page: 'cogita', slide: t.cogita, tone: 'paper' },
    { key: 'narzedzia', page: 'bezpieczenstwo', slide: t.narzedzia, tone: 'sealed' }
  ];

  const order = [
    'thesis', 'areas', 'osrodek', 'wydarzenia', 'cogita', 'narzedzia', 'road', 'close'
  ];

  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set());
  const [area, setArea] = useState(0);
  const refs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const watcher = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const node = entry.target as HTMLElement;
          const key = node.dataset.key ?? '';

          if (entry.isIntersecting) {
            node.dataset.seen = 'true';
            setSeen((current) => (current.has(key) ? current : new Set(current).add(key)));
          }

          if (entry.intersectionRatio >= 0.55) {
            const index = order.indexOf(key);
            if (index >= 0) setActive(index);
          }
        }
      },
      { threshold: [0.15, 0.55] }
    );

    for (const node of Object.values(refs.current)) if (node !== null) watcher.observe(node);
    return () => watcher.disconnect();
    // `order` ist konstant; die Abhängigkeit würde den Beobachter bei jedem
    // Bild neu aufsetzen und damit jede Einblendung zurücknehmen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bind = (key: string) => (node: HTMLElement | null) => { refs.current[key] = node; };

  const slide = (panel: Panel, showScroll = false) => (
    <section
      key={panel.key}
      id={`slide-${panel.key}`}
      className="pub-slide"
      data-tone={panel.tone}
      data-key={panel.key}
      ref={bind(panel.key)}
      aria-labelledby={`h-${panel.key}`}
    >
      <div className="pub-slide-in">
        <p className="pub-eyebrow">{panel.slide.eyebrow}</p>

        {panel.lead === true ? (
          <h1 className="pub-slide-h" id={`h-${panel.key}`}>{panel.slide.title}</h1>
        ) : (
          <h2 className="pub-slide-h" id={`h-${panel.key}`}>{panel.slide.title}</h2>
        )}

        <p className="pub-slide-b">{panel.slide.body}</p>

        {panel.slide.facts !== undefined && (
          <Facts facts={panel.slide.facts} run={seen.has(panel.key)} />
        )}

        <a className="pub-slide-cta" href={publicHref(panel.page)}>{panel.slide.cta}</a>
      </div>

      {showScroll && (
        <p className="pub-scroll" aria-hidden="true">
          <span>{t.scrollHint}</span>
          <i />
        </p>
      )}
    </section>
  );

  return (
    <div className="pub-front">
      {before.map((panel) => slide(panel, true))}

      {/* Die sechs Bereiche als wechselnde Tafeln. Eine Liste stünde hier
          still; sechs Absätze untereinander liest niemand. */}
      <section
        id="slide-areas"
        className="pub-slide pub-areas-slide"
        data-tone="paper"
        data-key="areas"
        ref={bind('areas')}
        aria-labelledby="h-areas"
      >
        <div className="pub-slide-in">
          <p className="pub-eyebrow">{t.areas.eyebrow}</p>
          <h2 className="pub-slide-h" id="h-areas">{t.areas.title}</h2>

          <div className="pub-tabs">
            <div className="pub-tab-list" role="tablist" aria-label={t.areas.title}>
              {t.areas.panels.map((panel, index) => (
                <button
                  key={panel.name}
                  type="button"
                  role="tab"
                  id={`tab-${index}`}
                  aria-selected={area === index}
                  aria-controls={`panel-${index}`}
                  className="pub-tab"
                  onClick={() => setArea(index)}
                  onMouseEnter={() => setArea(index)}
                >
                  <span className="pub-tab-n">{String(index + 1).padStart(2, '0')}</span>
                  {panel.name}
                </button>
              ))}
            </div>

            <div
              className="pub-tab-body"
              role="tabpanel"
              id={`panel-${area}`}
              aria-labelledby={`tab-${area}`}
              key={area}
            >
              <p>{t.areas.panels[area].body}</p>
            </div>
          </div>
        </div>
      </section>

      {middle.map((panel) => slide(panel))}

      {/* Der Plan. Nummeriert, weil er wirklich eine Reihenfolge ist — und mit
          Zustand, weil eine Liste ohne ihn ein Wunschzettel wäre. */}
      <section
        id="slide-road"
        className="pub-slide pub-road-slide"
        data-tone="sealed"
        data-key="road"
        ref={bind('road')}
        aria-labelledby="h-road"
      >
        <div className="pub-slide-in">
          <p className="pub-eyebrow">{t.road.eyebrow}</p>
          <h2 className="pub-slide-h" id="h-road">{t.road.title}</h2>

          <ol className="pub-steps">
            {t.road.steps.map((step, index) => (
              <li key={step.title} data-state={step.state}>
                <span className="pub-step-n">{String(index + 1).padStart(2, '0')}</span>
                <span className="pub-step-t">{step.title}</span>
                <span className="pub-step-note">{step.note}</span>
                <span className="pub-step-state">{t.road.legend[step.state]}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="slide-close"
        className="pub-slide pub-close"
        data-tone="sealed"
        data-key="close"
        ref={bind('close')}
        aria-labelledby="h-close"
      >
        <div className="pub-slide-in">
          <h2 className="pub-close-words" id="h-close">
            {t.close.words.map((word) => <span key={word}>{word}</span>)}
          </h2>
          <p className="pub-close-body">{t.close.body}</p>
          <p className="pub-close-do">
            <a className="pub-slide-cta" href={publicHref('wesprzyj')}>{t.close.primary}</a>
            <a className="pub-close-quiet" href={publicHref('kontakt')}>{t.close.secondary}</a>
          </p>
        </div>
      </section>

      <nav className="pub-rail" aria-label={copy.nav.menu}>
        {order.map((key, index) => (
          <a
            key={key}
            href={`#slide-${key}`}
            className="pub-rail-step"
            aria-current={active === index ? 'true' : undefined}
            onClick={(event) => {
              event.preventDefault();
              refs.current[key]?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <span className="pub-sr">{String(index + 1)}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
