/**
 * Die Startseite — ein Bogen, keine Angebotsliste.
 *
 *   These   Der Mensch wird in Teile zerlegt. Dagegen ist das hier gebaut.
 *   Ort     Zuerst das Haus — dort wird es konkret.
 *   Beleg   Es geschieht bereits; es ist nicht erst geplant.
 *   Werk    Cogita, das meistgenutzte Stück.
 *   Haltung Kein Verwalter. Wie gebaut wird, ist selbst eine Aussage.
 *   Schluss Die vier Wörter — und die ehrliche Zeile darunter.
 *
 * <b>Der Farbwechsel ist Inhalt, nicht Abwechslung.</b> Die ersten vier Folien
 * liegen auf Papier, die letzten beiden auf dem dunklen Grund der Werkstatt.
 * Das ist dieselbe Kante wie in der Plattform: hell ist, was offen liegt,
 * dunkel ist, was verschlossen ist. Wer bis dorthin scrollt, hat den Übergang
 * gesehen, bevor er ihn gelesen hat.
 *
 * <b>Bildlaufrasterung überlässt der Browser sich selbst.</b> Der alte
 * Foliensatz rechnete `round(scrollTop / height)` in einem entprellten
 * Behandler — genau dort gehen solche Seiten kaputt, weil sich auf einem
 * Telefon die Fensterhöhe beim Ein- und Ausblenden der Adressleiste ändert.
 *
 * <b>Eine Überschrift erster Ordnung.</b> Der alte Satz hatte elf, eine je
 * Folie. Hier trägt die These sie, und die übrigen Folien tragen `h2`: es ist
 * eine Seite mit Abschnitten, nicht elf Dokumente.
 */

import { useEffect, useRef, useState } from 'react';
import type { PublicCopy, Slide } from '../content';
import { publicHref, type PublicPage } from '../publicRoutes';

interface Panel {
  readonly key: string;
  readonly page: PublicPage;
  readonly slide: Slide;
  readonly tone: 'paper' | 'sealed';
  /** Die These trägt die h1; alles andere ist ein Abschnitt darunter. */
  readonly lead?: boolean;
}

export function FrontPage({ copy }: { copy: PublicCopy }) {
  const t = copy.front;

  const panels: readonly Panel[] = [
    { key: 'thesis', page: 'recreatio', slide: t.thesis, tone: 'paper', lead: true },
    { key: 'osrodek', page: 'osrodek', slide: t.osrodek, tone: 'paper' },
    { key: 'wydarzenia', page: 'wydarzenia', slide: t.wydarzenia, tone: 'paper' },
    { key: 'cogita', page: 'cogita', slide: t.cogita, tone: 'paper' },
    { key: 'narzedzia', page: 'bezpieczenstwo', slide: t.narzedzia, tone: 'sealed' }
  ];

  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);
  const total = panels.length + 1;

  useEffect(() => {
    const watcher = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const node = entry.target as HTMLElement;
          // Einblenden bleibt eingeblendet: ein Abschnitt, der beim
          // Zurückscrollen wieder verschwindet, wirkt kaputt.
          if (entry.isIntersecting) node.dataset.seen = 'true';

          if (entry.intersectionRatio >= 0.55) {
            const index = refs.current.indexOf(node);
            if (index >= 0) setActive(index);
          }
        }
      },
      { threshold: [0.15, 0.55] }
    );

    for (const node of refs.current) if (node !== null) watcher.observe(node);
    return () => watcher.disconnect();
  }, []);

  const bind = (index: number) => (node: HTMLElement | null) => {
    refs.current[index] = node;
  };

  return (
    <div className="pub-front">
      {panels.map((panel, index) => (
        <section
          key={panel.key}
          id={`slide-${panel.key}`}
          className="pub-slide"
          data-tone={panel.tone}
          ref={bind(index)}
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
              <dl className="pub-facts">
                {panel.slide.facts.map((fact) => (
                  <div key={fact.label}>
                    <dt>{fact.value}</dt>
                    <dd>{fact.label}</dd>
                  </div>
                ))}
              </dl>
            )}

            <a className="pub-slide-cta" href={publicHref(panel.page)}>
              {panel.slide.cta}
            </a>
          </div>

          {index === 0 && <p className="pub-scroll">{t.scrollHint}</p>}
        </section>
      ))}

      {/* Der Schluss trägt keine Werbezeile, sondern die vier Wörter und die
          Auskunft darunter. Sie ist die letzte Zeile der Seite, weil sie die
          ist, die stimmen muss. */}
      <section
        id="slide-close"
        className="pub-slide pub-close"
        data-tone="sealed"
        ref={bind(panels.length)}
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
        {Array.from({ length: total }, (_, index) => {
          const id = index < panels.length ? `slide-${panels[index].key}` : 'slide-close';
          const name = index < panels.length ? panels[index].slide.title : t.close.words.join(' ');
          return (
            <a
              key={id}
              href={`#${id}`}
              className="pub-rail-step"
              aria-current={active === index ? 'true' : undefined}
              onClick={(event) => {
                event.preventDefault();
                refs.current[index]?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <span className="pub-sr">{name}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}
