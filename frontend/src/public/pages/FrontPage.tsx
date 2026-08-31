/**
 * Die Startseite — fünf Folien in fester Reihenfolge.
 *
 * Die Reihenfolge ist die Einladung, und sie ist gewollt:
 *
 *   1. die Initiative kennenlernen
 *   2. das Haus ansehen
 *   3. die Veranstaltungen — es gibt sie seit Jahren, sie werden fortgesetzt
 *   4. Cogita, der bekannteste Teil
 *   5. die übrigen Werkzeuge
 *
 * <b>Bildlaufrasterung statt eigener Bildlaufsteuerung.</b> Der Foliensatz im
 * Altbestand rechnete `round(scrollTop / height)` in einem entprellten
 * Behandler und schrieb daraus die Adresse. Das ist die Stelle, an der solche
 * Seiten kaputtgehen: auf einem Telefon ändert sich die Höhe beim Ein- und
 * Ausblenden der Adressleiste, und der Sprung landet dann zwischen zwei
 * Folien. `scroll-snap` überlässt das dem Browser, der es besser weiss.
 *
 * <b>Genau eine Überschrift erster Ordnung.</b> Elf `h1` hatte der alte
 * Foliensatz, eine je Folie. Hier trägt der Name die eine, und die Folien
 * tragen `h2` — sie sind Abschnitte einer Seite, nicht elf Dokumente.
 */

import { useEffect, useRef, useState } from 'react';
import type { PublicCopy, Slide } from '../content';
import { publicHref, type PublicPage } from '../publicRoutes';

interface Panel {
  readonly page: PublicPage;
  readonly slide: Slide;
}

export function FrontPage({ copy }: { copy: PublicCopy }) {
  const t = copy.front;

  const panels: readonly Panel[] = [
    { page: 'recreatio', slide: t.initiative },
    { page: 'osrodek', slide: t.osrodek },
    { page: 'wydarzenia', slide: t.wydarzenia },
    { page: 'cogita', slide: t.cogita },
    { page: 'narzedzia', slide: t.narzedzia }
  ];

  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  // Welche Folie sichtbar ist, beantwortet der Browser — nicht eine Rechnung
  // aus Bildlaufstand und Fensterhöhe.
  useEffect(() => {
    const watcher = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = refs.current.indexOf(entry.target as HTMLElement);
          if (index >= 0) setActive(index);
        }
      },
      { threshold: 0.55 }
    );

    for (const node of refs.current) if (node !== null) watcher.observe(node);
    return () => watcher.disconnect();
  }, []);

  return (
    <div className="pub-front">
      <h1 className="pub-sr">{copy.meta.siteName}</h1>

      {panels.map((panel, index) => (
        <section
          key={panel.page}
          className="pub-slide"
          data-index={index}
          ref={(node) => { refs.current[index] = node; }}
          aria-labelledby={`slide-${panel.page}`}
        >
          <div className="pub-slide-in">
            <p className="pub-eyebrow">{panel.slide.eyebrow}</p>
            <h2 className="pub-slide-h" id={`slide-${panel.page}`}>{panel.slide.title}</h2>
            <p className="pub-slide-b">{panel.slide.body}</p>
            <a className="pub-slide-cta" href={publicHref(panel.page)}>
              {panel.slide.cta}
            </a>
          </div>

          {index === 0 && <p className="pub-scroll">{t.scrollHint}</p>}
        </section>
      ))}

      {/* Die Punkte sind echte Verweise auf die Abschnitte: sie funktionieren
          auch mit der Tastatur und ohne JavaScript. */}
      <nav className="pub-dots" aria-label={copy.nav.menu}>
        {panels.map((panel, index) => (
          <a
            key={panel.page}
            href={`#slide-${panel.page}`}
            className="pub-dot"
            aria-current={active === index ? 'true' : undefined}
            onClick={(event) => {
              event.preventDefault();
              refs.current[index]?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <span className="pub-sr">{panel.slide.title}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
