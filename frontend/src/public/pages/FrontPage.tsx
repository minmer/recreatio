/**
 * Die Startseite — elf Zustände, EINE Bewegung in die Tiefe.
 *
 *    0        Das Zeichen.
 *    1  2  3  Erste Welle: Titel, der Gedanke, ein Bild.
 *    4  5  6  Zweite Welle: in sich — in Gemeinschaft — mit Gott.
 *    7  8  9  Dritte Welle: wer glaubt — wer sucht — wer nicht glaubt.
 *   10        Die vier Werke.
 *
 * <b>Eine Welle ist EIN Ding, nicht drei.</b> Die drei Blasen hängen an einem
 * Faden und wachsen GEMEINSAM — die Vergrösserung sitzt auf der Welle, nicht
 * auf der einzelnen Blase. Was wandert, ist nur die Hervorhebung.
 *
 * <b>Man sieht immer, wohin es geht.</b> Die nächste Welle ist schon da, klein
 * und halb durchsichtig, während die laufende vorbeizieht.
 *
 * ---------------------------------------------------------------------------
 * DAS ZEICHEN ALS MASKE
 *
 * Der Schleier trägt das Logo als Loch — als CSS-Maske aus `logo_new.svg`, mit
 * `mask-composite: exclude`. Die Datei hat 600 kB Pfaddaten; sie in das Bauteil
 * zu schreiben hiesse, jede Seite damit zu belasten. Als Maske lädt sie einmal
 * und liegt im Zwischenspeicher.
 *
 * `mask-position: center` heisst: das Zeichen wächst aus der Mitte heraus, und
 * zwar ohne dass irgendwo ein Mittelpunkt gerechnet wird. Es KANN nicht
 * verrutschen.
 *
 * ---------------------------------------------------------------------------
 * TRÄGHEIT STATT RASTUNG
 *
 * `scroll-snap` kennt nur „nächster Punkt" — ein kräftiger Wisch am Ende sieht
 * dort genauso aus wie ein Antippen. Deshalb wird jetzt in JavaScript
 * eingerastet: aus den letzten Positionen und Zeitstempeln kommt die
 * Geschwindigkeit, und die entscheidet, wie weit es trägt. Langsam heisst
 * nächster Zustand, ein Wisch trägt bis zu zwei weiter.
 *
 * Abgefangen wird dabei nichts: `wheel` und `touchstart` werden nur passiv
 * mitgehört, um eine laufende Einrastbewegung abzubrechen, sobald der Besucher
 * wieder selbst scrollt. Kein `preventDefault`, nirgends.
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { PublicCopy, Text } from '../content';
import { PublicText } from '../PublicText';
import { publicHref, type PublicPage } from '../publicRoutes';

const WORK_PAGES: readonly PublicPage[] = ['osrodek', 'wydarzenia', 'cogita', 'biblioteka'];

/** Elf Zustände — und damit zehn Übergänge. */
const STATES = 11;

/** Bildlaufweg je Übergang. Der Regler für „langsamer". */
const STEP_VH = 120;

/** So lange muss der Bildlauf ruhen, bevor eingerastet wird. */
const IDLE_MS = 110;

/** Darunter gilt es als Antippen: es geht zum nächsten Zustand. */
const SLOW = 0.35;

/** Je so viel Geschwindigkeit ein Zustand weiter — höchstens zwei. */
const CARRY = 1.6;

type Points = readonly (readonly (readonly [number, number])[])[];

/**
 * Wo die drei Blasen einer Welle liegen — in Prozent der Bühne.
 *
 * Dieselben Zahlen tragen die Blasen (als Mittelpunkt) UND der Faden. Stünden
 * sie an zwei Stellen, liefe der Faden an den Blasen vorbei.
 *
 * Im Hochformat ist die Breite knapp: dort liegen sie fast übereinander, nur
 * leicht versetzt, damit der Faden eine Bewegung beschreibt und keine gerade
 * Linie.
 */
const LANDSCAPE: Points = [
  [[26, 30], [52, 57], [78, 28]],
  [[24, 34], [50, 61], [76, 31]],
  [[28, 31], [50, 58], [74, 33]]
];

const PORTRAIT: Points = [
  [[40, 20], [60, 50], [42, 80]],
  [[60, 22], [38, 52], [60, 81]],
  [[42, 21], [62, 51], [40, 79]]
];

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

/**
 * Der Faden zwischen den drei Blasen.
 *
 * `preserveAspectRatio="none"` bildet die Koordinaten direkt auf Prozent ab —
 * dieselbe Rechnung wie bei den Blasen. `non-scaling-stroke` verhindert, dass
 * die ungleiche Streckung die Linie mit verzerrt.
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

export function FrontPage({ copy }: { copy: PublicCopy }) {
  const t = copy.front;
  const stage = useRef<HTMLDivElement | null>(null);

  // Die Punkte müssen zu der Ausrichtung passen, in der wirklich gezeichnet
  // wird — sie über CSS zu verschieben würde den Faden zurücklassen.
  const [portrait, setPortrait] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(orientation: portrait)').matches
  );

  useEffect(() => {
    const query = window.matchMedia('(orientation: portrait)');
    const onChange = () => setPortrait(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const node = stage.current;
    if (node === null) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let idle = 0;
    let settling = false;
    let lastY = window.scrollY;
    let lastT = performance.now();
    let speed = 0;

    const read = () => {
      frame = 0;
      const travel = node.offsetHeight - window.innerHeight;
      if (travel <= 0) { node.style.setProperty('--p', '0'); return; }

      const passed = -node.getBoundingClientRect().top;
      const p = Math.min(1, Math.max(0, passed / travel));
      node.style.setProperty('--p', p.toFixed(5));
    };

    /** Einrasten — mit Schwung. */
    const settle = () => {
      const step = (STEP_VH / 100) * window.innerHeight;
      const top = window.scrollY + node.getBoundingClientRect().top;
      const passed = window.scrollY - top;

      if (passed < -step || passed > (STATES - 1) * step + step) return;

      const here = passed / step;
      const dir = speed >= 0 ? 1 : -1;

      // Langsam: der nächstgelegene Zustand. Schnell: in Richtung des Wischs,
      // und je nach Schwung ein oder zwei weiter.
      const target = Math.abs(speed) < SLOW
        ? Math.round(here)
        : (dir > 0 ? Math.ceil(here) : Math.floor(here))
          + dir * Math.min(2, Math.floor(Math.abs(speed) / CARRY));

      const clamped = Math.min(STATES - 1, Math.max(0, target));
      const goal = top + clamped * step;

      if (Math.abs(goal - window.scrollY) < 2) return;

      settling = true;
      window.scrollTo({ top: goal, behavior: reduce.matches ? 'auto' : 'smooth' });
    };

    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(read);

      // Geschwindigkeit aus Weg und Zeit. Zeitstempel sind genau das, was
      // einen kräftigen Wisch von einem Antippen unterscheidet.
      const now = performance.now();
      const dt = now - lastT;
      if (dt > 0) {
        speed = (window.scrollY - lastY) / dt;
        lastY = window.scrollY;
        lastT = now;
      }

      if (settling) return;
      window.clearTimeout(idle);
      idle = window.setTimeout(settle, IDLE_MS);
    };

    // Sobald der Besucher selbst scrollt, gehört die Bewegung wieder ihm.
    const release = () => { settling = false; };

    const start = () => {
      node.classList.add('is-live');
      read();
    };

    start();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    window.addEventListener('wheel', release, { passive: true });
    window.addEventListener('touchstart', release, { passive: true });

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.clearTimeout(idle);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('wheel', release);
      window.removeEventListener('touchstart', release);
      node.classList.remove('is-live');
    };
  }, []);

  const points = portrait ? PORTRAIT : LANDSCAPE;

  const stageStyle = {
    '--states': STATES - 1,
    '--step': `${STEP_VH}vh`
  } as CSSProperties;

  return (
    <div className="rc-home">
      <div className="rc-stage" ref={stage} style={stageStyle}>
        <div className="rc-pin">
          <div className="rc-first">
            {/* Ohne Schleier steht das Zeichen still auf dunklem Grund. */}
            <div className="rc-mark-static">
              <img src="/logo_inv.svg" alt={t.screen1.wordmark} />
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
            <Thread points={points[0]} />
            <Bubble index={0} at={points[0][0]} copy={copy} big>
              <h2 className="rc-bubble-h" id="rc-h2">{t.screen2.title}</h2>
            </Bubble>
            <Bubble index={1} at={points[0][1]} body={t.screen2.lead} copy={copy} big />
            <Bubble index={2} at={points[0][2]} gap={t.screen2.image} copy={copy} />
          </section>

          <section className="rc-wave" data-wave="2" aria-label={t.screen2.title}>
            <Thread points={points[1]} />
            {t.screen2.relations.map((item, index) => (
              <Bubble
                key={item.name}
                index={index}
                at={points[1][index]}
                name={item.name}
                body={item.body}
                copy={copy}
              />
            ))}
          </section>

          <section className="rc-wave" data-wave="3" aria-label={t.screen2.title}>
            <Thread points={points[2]} />
            {t.screen2.openness.map((item, index) => (
              <Bubble
                key={item.name}
                index={index}
                at={points[2][index]}
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

          {/* Das Zeichen als Loch. Die Maske steckt im Stilblatt. */}
          <div className="rc-veil" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
