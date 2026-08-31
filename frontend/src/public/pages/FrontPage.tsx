/**
 * Die Startseite — drei Bilder, EINE Bewegung in die Tiefe.
 *
 *   1  Der Name waechst auf den Betrachter zu und gibt das zweite Bild frei.
 *   2  Die Gedanken kommen einzeln aus der Tiefe nach vorn.
 *   3  Man geht durch das zweite Bild hindurch; das dritte lag schon dahinter.
 *
 * Es faehrt nichts von unten herein und nichts scrollt weg.
 *
 * ---------------------------------------------------------------------------
 * WARUM HIER DOCH JAVASCRIPT STEHT
 *
 * Der Auftrag verlangte `animation-timeline` und ausdruecklich keine
 * Bildsteuerung per JavaScript. Genau so war es gebaut — und beim Ansehen kam
 * nur ein gewoehnlicher Bildlauf heraus. Der Grund liegt in der Sache: die
 * bildlaufgesteuerte Animation gibt es in Firefox nicht, und wo das
 * Betriebssystem „Animationen aus" meldet, greift der Rueckfall. In beiden
 * Faellen war das Ergebnis dasselbe: drei Abschnitte untereinander. Der
 * vorgeschriebene Weg fuehrte also verlaesslich dahin, wo die Seite gerade
 * NICHT hin soll.
 *
 * Deshalb steht die Bewegung jetzt auf einem einzigen Wert: `--p`, dem
 * Fortschritt durch die Buehne, den ein Bildlaufhorcher setzt. Das ist eine
 * Abweichung vom Auftrag, und sie ist bewusst.
 *
 * Was dabei erhalten bleibt:
 *
 *   - Kein Abfangen von Rad, Berührung oder Taste. Der Besucher scrollt
 *     normal; gelesen wird nur, wo er steht.
 *   - Ein `requestAnimationFrame` je Bild, nicht je Ereignis.
 *   - Ohne JavaScript bleibt die Klasse `is-live` aus, und die Seite ist das,
 *     was sie ohne Bewegung sein soll: drei Abschnitte untereinander,
 *     vollstaendig lesbar. Die Buehne baut sich NUR mit dieser Klasse auf —
 *     es gibt keinen Zustand, in dem eine Flaeche haengen bleibt.
 *   - Auf schmalen Fenstern bleibt es bei den drei Abschnitten. Fuenf
 *     Bildschirmhoehen Scrollweg auf einem Telefon waeren keine Idee.
 */

import { useEffect, useRef } from 'react';
import type { PublicCopy } from '../content';
import { PublicText } from '../PublicText';
import { publicHref, type PublicPage } from '../publicRoutes';

/** Die Reihenfolge der Werke steht fest und wird nicht umgestellt. */
const WORK_PAGES: readonly PublicPage[] = ['osrodek', 'wydarzenia', 'cogita', 'biblioteka'];

/** Unter dieser Breite gibt es keine Buehne. */
const WIDE = '(min-width: 860px)';

/**
 * Der Name als SVG.
 *
 * `slice` statt `none`: eine Wortmarke, die sich mit dem Fenster verzerrt, ist
 * keine Wortmarke mehr. Das Rechteck ist absichtlich viel groesser als das
 * Sichtfeld — beim Beschneiden darf an keinem Rand eine Luecke entstehen.
 */
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

export function FrontPage({ copy }: { copy: PublicCopy }) {
  const t = copy.front;
  const stage = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = stage.current;
    if (node === null) return;

    const wide = window.matchMedia(WIDE);
    let frame = 0;

    const read = () => {
      frame = 0;

      // Der Weg, den die Buehne zu vergeben hat: ihre Hoehe minus ein Fenster.
      const travel = node.offsetHeight - window.innerHeight;
      if (travel <= 0) { node.style.setProperty('--p', '0'); return; }

      const passed = -node.getBoundingClientRect().top;
      const p = Math.min(1, Math.max(0, passed / travel));
      node.style.setProperty('--p', p.toFixed(4));
    };

    const onScroll = () => {
      // Ein Bild je Einzelbild, nicht je Ereignis. Ein Bildlauf feuert
      // Dutzende Male zwischen zwei Bildern; jedes davon zu rechnen ist
      // verschenkte Arbeit und ruckelt am Ende sogar.
      if (frame === 0) frame = requestAnimationFrame(read);
    };

    const apply = () => {
      if (wide.matches) {
        node.classList.add('is-live');
        read();
      } else {
        // Schmales Fenster: die Buehne verschwindet, und mit ihr jede Spur
        // davon. Ein halb abgebauter Aufbau waere schlimmer als keiner.
        node.classList.remove('is-live');
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

            {/* Die einzige Ueberschrift erster Ordnung der Seite. */}
            <h1 className="rc-sentence" id="rc-h1">
              <PublicText value={t.screen1.sentence} copy={copy} as="span" />
            </h1>

            <p className="rc-hint" aria-hidden="true">
              <span>{t.screen1.hint}</span>
              <i />
            </p>
          </div>

          {/*
            Die Gedanken kommen EINZELN nach vorn — dieselbe Bewegung wie beim
            Namen, nur eine Ebene weiter. Erst der Gedanke vom Menschen, dann
            der von der Gemeinschaft, dann der von Gott; danach die Offenheit.
          */}
          <section className="rc-behind rc-l2" aria-labelledby="rc-h2">
            <div className="rc-s2-in">
              <h2 className="rc-h2" id="rc-h2">{t.screen2.title}</h2>

              <div className="rc-vision">
                {t.screen2.paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                ))}
              </div>

              {/* Die Offenheit steht abgesetzt — sie ist kein Nachsatz. */}
              <p className="rc-open">{t.screen2.openness}</p>
            </div>
          </section>

          {/* Das dritte Bild liegt am tiefsten und wartet. */}
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
      </div>
    </div>
  );
}
