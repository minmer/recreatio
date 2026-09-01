/**
 * Die Startseite — elf Zustände, EINE Bewegung in die Tiefe.
 *
 *    0        Der Name.
 *    1  2  3  Erste Welle: Titel, der Gedanke, ein Bild.
 *    4  5  6  Zweite Welle: in sich — in Gemeinschaft — mit Gott.
 *    7  8  9  Dritte Welle: wer glaubt — wer sucht — wer nicht glaubt.
 *   10        Die vier Werke.
 *
 * <b>Eine Welle ist EIN Ding, nicht drei.</b> Die drei Blasen einer Welle
 * hängen an einem Faden und wachsen GEMEINSAM — die Vergrösserung sitzt auf der
 * Welle, nicht auf der einzelnen Blase. Was wandert, ist nur die Hervorhebung:
 * erst die erste Blase, dann die zweite, dann die dritte. Läge die Bewegung auf
 * den Blasen einzeln, wären es drei Dinge, die zufällig nebeneinander liegen.
 *
 * <b>Man sieht immer, wohin es geht.</b> Die nächste Welle ist schon da, klein
 * und halb durchsichtig, während die laufende noch vorbeizieht. Deshalb zeigt
 * jeder Zwischenstand die Richtung — auch mitten im Übergang, wo nicht gerastet
 * wird.
 *
 * <b>Rastpunkte liegen auf den Hervorhebungen</b>, nicht auf den Wellen. Es
 * gibt also wirklich einen Augenblick, in dem die zweite Blase dran ist. Was
 * zwischen zwei Zuständen liegt, ist Übergang und kein Ort.
 *
 * ---------------------------------------------------------------------------
 * Die Bewegung hängt an einem Wert: `--p`, dem Fortschritt durch die Bühne,
 * den ein Bildlaufhorcher setzt. `animation-timeline` war der erste Weg und
 * fiel aus — in Firefox gibt es das nicht, und dort blieb ein gewöhnlicher
 * Bildlauf übrig.
 *
 * Der TEXT hängt nicht daran. Er steht vollständig im Markup; die Bewegung
 * bewegt ihn nur. Ohne `is-live` — schmales Fenster oder kein JavaScript —
 * steht alles untereinander und ist lesbar.
 */

import { useEffect, useRef, type CSSProperties } from 'react';
import type { PublicCopy, Text } from '../content';
import { PublicText } from '../PublicText';
import { publicHref, type PublicPage } from '../publicRoutes';

const WORK_PAGES: readonly PublicPage[] = ['osrodek', 'wydarzenia', 'cogita', 'biblioteka'];

/** Unter dieser Breite gibt es keine Bühne. */
const WIDE = '(min-width: 860px)';

/** Elf Zustände — und damit zehn Übergänge. */
const STATES = 11;

/**
 * Wie viel Bildlaufweg ein Übergang bekommt.
 *
 * Das ist der Regler für „langsamer". Mehr Weg heisst: die Rastbewegung des
 * Browsers legt eine längere Strecke zurück und ein freier Bildlauf braucht
 * länger, bis der nächste Zustand erreicht ist.
 */
const STEP_VH = 120;

/**
 * Wo die drei Blasen einer Welle liegen — in Prozent der Bühne.
 *
 * Dieselben Zahlen tragen die Blasen (als Mittelpunkt) UND der Faden zwischen
 * ihnen. Stünden sie an zwei Stellen, liefe der Faden früher oder später an
 * den Blasen vorbei.
 */
const WAVE_POINTS: readonly (readonly (readonly [number, number])[])[] = [
  [[26, 30], [52, 57], [78, 28]],
  [[24, 34], [50, 61], [76, 31]],
  [[28, 31], [50, 58], [74, 33]]
];

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

/**
 * Der Faden zwischen den drei Blasen.
 *
 * `preserveAspectRatio="none"` bildet die Koordinaten direkt auf Prozent der
 * Fläche ab — dieselbe Rechnung wie bei den Blasen. `non-scaling-stroke`
 * verhindert, dass die ungleiche Streckung die Linie mit verzerrt.
 */
function Thread({ points }: { points: readonly (readonly [number, number])[] }) {
  return (
    <svg className="rc-thread" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={points.map(([x, y]) => `${x},${y}`).join(' ')}
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Bubble({
  index, at, name, body, gap, copy, big, children
}: {
  index: number;
  at: readonly [number, number];
  name?: string;
  body?: string;
  gap?: Text;
  copy: PublicCopy;
  big?: boolean;
  children?: React.ReactNode;
}) {
  const style = {
    '--i': index,
    '--x': `${at[0]}%`,
    '--y': `${at[1]}%`
  } as CSSProperties;

  return (
    <div className={`rc-bubble ${big === true ? 'is-big' : ''}`} style={style}>
      {children}
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
      node.style.setProperty('--p', p.toFixed(5));
    };

    const onScroll = () => {
      // Ein Bild je Einzelbild, nicht je Ereignis.
      if (frame === 0) frame = requestAnimationFrame(read);
    };

    const apply = () => {
      if (wide.matches) {
        node.classList.add('is-live');
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

  const stageStyle = {
    '--states': STATES - 1,
    '--step': `${STEP_VH}vh`
  } as CSSProperties;

  return (
    <div className="rc-home">
      <div className="rc-stage" ref={stage} style={stageStyle}>
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
            <Thread points={WAVE_POINTS[0]} />
            <Bubble index={0} at={WAVE_POINTS[0][0]} copy={copy} big>
              <h2 className="rc-bubble-h" id="rc-h2">{t.screen2.title}</h2>
            </Bubble>
            <Bubble index={1} at={WAVE_POINTS[0][1]} body={t.screen2.lead} copy={copy} big />
            <Bubble index={2} at={WAVE_POINTS[0][2]} gap={t.screen2.image} copy={copy} />
          </section>

          <section className="rc-wave" data-wave="2" aria-label={t.screen2.title}>
            <Thread points={WAVE_POINTS[1]} />
            {t.screen2.relations.map((item, index) => (
              <Bubble
                key={item.name}
                index={index}
                at={WAVE_POINTS[1][index]}
                name={item.name}
                body={item.body}
                copy={copy}
              />
            ))}
          </section>

          <section className="rc-wave" data-wave="3" aria-label={t.screen2.title}>
            <Thread points={WAVE_POINTS[2]} />
            {t.screen2.openness.map((item, index) => (
              <Bubble
                key={item.name}
                index={index}
                at={WAVE_POINTS[2][index]}
                name={item.name}
                body={item.body}
                copy={copy}
              />
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
          Die Rastpunkte. Unsichtbar, tragen nichts — sie sagen dem Browser nur,
          wo ein Zustand liegt. Einer je Hervorhebung, damit es den Augenblick
          wirklich gibt, in dem die zweite Blase dran ist.
        */}
        <div className="rc-steps" aria-hidden="true">
          {Array.from({ length: STATES }, (_, index) => (
            <div
              className="rc-step"
              key={index}
              style={{ top: `calc(${index} * var(--step))` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
