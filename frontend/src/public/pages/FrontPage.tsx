/**
 * Die Startseite — fünf Zustände, eine Bewegung in die Tiefe.
 *
 *   0  Der Name.
 *   1  Erste Welle: Titel, der Gedanke, ein Bild.
 *   2  Zweite Welle: in sich — in Gemeinschaft — mit Gott.
 *   3  Dritte Welle: wer glaubt — wer sucht — wer nicht glaubt.
 *   4  Die vier Werke.
 *
 * <b>Zwischen den Zuständen kann man nicht stehenbleiben.</b> Jeder Zustand ist
 * ein Rastpunkt; der Bildlauf rastet immer auf einem davon ein. Was dazwischen
 * liegt, ist ein Übergang und kein Ort — genau deshalb gibt es dort nichts zu
 * lesen und nichts zu verpassen.
 *
 * <b>Die Blasen kommen aus der Tiefe, ziehen vorbei und vergehen.</b> Sie
 * werden nicht eingeblendet: sie sind klein und fern, wachsen auf den
 * Betrachter zu, sind einen Augenblick da und sind dann hinter ihm. Innerhalb
 * einer Welle versetzt, damit drei Blasen nicht als Block auftreten.
 *
 * ---------------------------------------------------------------------------
 * WARUM DIE BEWEGUNG AN JAVASCRIPT HÄNGT
 *
 * Der erste Bau folgte dem Auftrag und benutzte `animation-timeline`. In
 * Firefox kam davon nichts an — die bildlaufgesteuerte Animation gibt es dort
 * nicht —, und dasselbe geschah, wo das Betriebssystem „Animationen aus"
 * meldet. Beide Male blieb ein gewöhnlicher Bildlauf übrig, also genau das,
 * was die Seite nicht sein soll. Jetzt hängt alles an einem Wert: `--p`, dem
 * Fortschritt durch die Bühne.
 *
 * <b>Der Text bleibt davon unberührt.</b> Er steht vollständig im Markup und
 * wird von der Bewegung nur bewegt, nicht erzeugt: kein Absatz entsteht durch
 * ein Ereignis, keiner wartet auf einen Beobachter. Ohne `is-live` — schmales
 * Fenster oder kein JavaScript — steht alles untereinander und ist lesbar.
 *
 * Kein Abfangen von Rad, Berührung oder Taste: gerastet wird vom Browser,
 * gelesen wird nur, wo der Besucher steht. Ein `requestAnimationFrame` je Bild.
 */

import { useEffect, useRef } from 'react';
import type { PublicCopy, Text } from '../content';
import { PublicText } from '../PublicText';
import { publicHref, type PublicPage } from '../publicRoutes';

const WORK_PAGES: readonly PublicPage[] = ['osrodek', 'wydarzenia', 'cogita', 'biblioteka'];

/** Unter dieser Breite gibt es keine Bühne. */
const WIDE = '(min-width: 860px)';

/** Fünf Zustände — und damit fünf Rastpunkte. */
const STEPS = 5;

function Wordmark({ text, masked }: { text: string; masked: boolean }) {
  return (
    <svg
      className={masked ? 'rc-veil-svg' : 'rc-mark-svg'}
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      {masked ? (
        <>
          <defs>
            <mask id="rc-mark-mask" maskUnits="userSpaceOnUse" x="-3000" y="-3000" width="9000" height="7000">
              <rect x="-3000" y="-3000" width="9000" height="7000" fill="#fff" />
              <text className="rc-veil-text" x="800" y="450" textAnchor="middle" fill="#000">
                {text}
              </text>
            </mask>
          </defs>
          <rect
            x="-3000" y="-3000" width="9000" height="7000"
            fill="currentColor"
            mask="url(#rc-mark-mask)"
          />
        </>
      ) : (
        <text className="rc-mark-text" x="800" y="450" textAnchor="middle" fill="currentColor">
          {text}
        </text>
      )}
    </svg>
  );
}

function Bubble({
  name, body, gap, copy, big
}: {
  name?: string;
  body?: string;
  gap?: Text;
  copy: PublicCopy;
  big?: boolean;
}) {
  return (
    <div className={`rc-bubble ${big === true ? 'is-big' : ''}`}>
      {name !== undefined && <p className="rc-bubble-n">{name}</p>}
      {body !== undefined && <p className="rc-bubble-b">{body}</p>}
      {gap !== undefined && <PublicText value={gap} copy={copy} as="div" />}
    </div>
  );
}

export function FrontPage({ copy }: { copy: PublicCopy }) {
  const t = copy.front;
  const stage = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = stage.current;
    if (node === null) return;

    const wide = window.matchMedia(WIDE);
    const root = document.documentElement;
    let frame = 0;

    const read = () => {
      frame = 0;
      const travel = node.offsetHeight - window.innerHeight;
      if (travel <= 0) { node.style.setProperty('--p', '0'); return; }

      const passed = -node.getBoundingClientRect().top;
      const p = Math.min(1, Math.max(0, passed / travel));
      node.style.setProperty('--p', p.toFixed(4));
    };

    const onScroll = () => {
      // Ein Bild je Einzelbild, nicht je Ereignis.
      if (frame === 0) frame = requestAnimationFrame(read);
    };

    const apply = () => {
      if (wide.matches) {
        node.classList.add('is-live');
        // Das Rasten gehoert an den Scroller, und das ist das Wurzelelement.
        root.classList.add('rc-snap');
        read();
      } else {
        node.classList.remove('is-live');
        root.classList.remove('rc-snap');
        node.style.removeProperty('--p');
      }
    };

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    wide.addEventListener('change', apply);

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      wide.removeEventListener('change', apply);
      node.classList.remove('is-live');
      // Ohne dieses Aufraeumen rastete jede andere Seite weiter.
      root.classList.remove('rc-snap');
    };
  }, []);

  return (
    <div className="rc-home">
      <div className="rc-stage" ref={stage}>
        <div className="rc-pin">
          <div className="rc-first">
            <div className="rc-mark-static">
              <Wordmark text={t.screen1.wordmark} masked={false} />
            </div>

            {/* Die einzige Überschrift erster Ordnung der Seite. */}
            <h1 className="rc-sentence" id="rc-h1">
              <PublicText value={t.screen1.sentence} copy={copy} as="span" />
            </h1>

            <p className="rc-hint" aria-hidden="true">
              <span>{t.screen1.hint}</span>
              <i />
            </p>
          </div>

          <section className="rc-wave" data-wave="1" aria-labelledby="rc-h2">
            <div className="rc-bubble is-big">
              <h2 className="rc-bubble-h" id="rc-h2">{t.screen2.title}</h2>
            </div>
            <Bubble body={t.screen2.lead} copy={copy} big />
            <Bubble gap={t.screen2.image} copy={copy} />
          </section>

          <section className="rc-wave" data-wave="2" aria-label={t.screen2.title}>
            {t.screen2.relations.map((item) => (
              <Bubble key={item.name} name={item.name} body={item.body} copy={copy} />
            ))}
          </section>

          <section className="rc-wave" data-wave="3" aria-label={t.screen2.title}>
            {t.screen2.openness.map((item) => (
              <Bubble key={item.name} name={item.name} body={item.body} copy={copy} />
            ))}
          </section>

          {/* Das vierte Bild liegt am tiefsten und wartet. */}
          <section className="rc-s3 rc-l3" aria-labelledby="rc-h3">
            <div className="rc-s3-in">
              <h2 className="rc-h2" id="rc-h3">{t.screen3.title}</h2>
              <p className="rc-stages">{t.screen3.stages}</p>

              <div className="rc-works">
                {t.screen3.works.map((work, index) => (
                  <article className="rc-work" key={work.name}>
                    <h3 className="rc-work-h">{work.name}</h3>
                    <p className="rc-work-b">{work.body}</p>
                    <a className="rc-work-a" href={publicHref(WORK_PAGES[index])}>
                      {work.cta}
                    </a>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <div className="rc-veil" aria-hidden="true">
            <Wordmark text={t.screen1.wordmark} masked />
          </div>
        </div>

        {/*
          Die Rastpunkte. Sie sind unsichtbar und tragen nichts — sie sagen dem
          Browser nur, wo ein Zustand liegt. Deshalb kann der Bildlauf nicht
          mitten in einem Übergang zur Ruhe kommen.
        */}
        <div className="rc-steps" aria-hidden="true">
          {Array.from({ length: STEPS }, (_, index) => (
            <div className="rc-step" key={index} style={{ top: `${index * 100}vh` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
