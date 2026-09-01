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
 * Faden und wachsen GEMEINSAM. Was wandert, ist nur die Hervorhebung.
 *
 * ---------------------------------------------------------------------------
 * DAS ZEICHEN ALS MASKE, MIT SEINEN FÜNF WÖRTERN
 *
 * Der Schleier trägt das Logo als Loch — CSS-Maske aus `logo_new.svg` mit
 * `mask-composite: exclude`, `mask-position: center`. Es wächst aus der Mitte,
 * ohne dass irgendwo ein Mittelpunkt gerechnet wird; es KANN nicht verrutschen.
 *
 * Um das Zeichen stehen die fünf Wörter, aus denen der Name kommt. Jedes hat
 * seine eigene TIEFE: wie schnell es nach aussen fliegt und wie stark es dabei
 * wächst. Weil die Tiefen verschieden sind, laufen sie unterschiedlich schnell
 * auseinander — das ist Parallaxe, und daher kommt der räumliche Eindruck. Alle
 * fünf fliegen mit dem Zeichen, nicht davor und nicht dahinter.
 *
 * ---------------------------------------------------------------------------
 * ZWEI KRÄFTE — UND WARUM NUR NACH DEM LOSLASSEN
 *
 * Sobald die Hand los ist, läuft in jedem Bild:
 *
 *     v = v · DÄMPFUNG + Abstand_zum_nächsten_Zustand · ZUG
 *
 * `v` trägt den Schwung, der Summand daneben ist der Zug des Rasters. Beides in
 * derselben Zeile, addiert. <b>Das Ziel wird nirgends gewählt</b> — ein
 * kräftiger Wisch schiesst über den nächsten Zustand hinaus, und dann zieht ihn
 * der übernächste, weil `nearest` in jedem Bild neu aus der Lage kommt.
 *
 * <b>Während die Hand scrollt, wird NICHTS angefasst.</b> Ein früherer Versuch
 * legte den Zug als kleinen Zuschlag schon während der Geste dazu — und machte
 * damit den Bildlauf unbrauchbar: `scrollTo` bricht in Chrome und Firefox den
 * laufenden nativen Bildlauf ab, also hat jedes Bild die eigene Geste des
 * Besuchers gelöscht und durch einen Ruck ersetzt. Man kann einer Bewegung,
 * die der Browser gerade selbst führt, keine zweite Kraft aufaddieren.
 *
 * Deshalb zwei Betriebsarten:
 *
 *   `watch`  Der Browser bewegt. Wir lesen nur mit und merken uns den Schwung.
 *            Kein `scrollTo`, keine Einmischung.
 *   `drive`  Der native Bildlauf steht (zwei Bilder ohne Weg) und keine Hand
 *            ist am Werk. Erst jetzt rechnen wir die beiden Kräfte.
 *
 * Jede Eingabe schaltet sofort zurück auf `watch`. Abgefangen wird nichts —
 * alle Horcher sind passiv, kein `preventDefault`.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { PublicCopy, Text } from '../content';
import { PublicText } from '../PublicText';
import { publicHref, type PublicPage } from '../publicRoutes';

const WORK_PAGES: readonly PublicPage[] = ['osrodek', 'wydarzenia', 'cogita', 'biblioteka'];

/** Elf Zustände — und damit zehn Übergänge. */
const STATES = 11;

/** Bildlaufweg je Übergang. Der Regler für „langsamer". */
const STEP_VH = 120;

/** So lange nach der letzten Hand-Eingabe wird nicht übernommen. */
const INPUT_GRACE = 140;

/** So viele Bilder ohne Weg gelten als „der native Bildlauf steht". */
const STILL_FRAMES = 2;

/*
 * DÄMPFUNG und ZUG sind nicht geraten, sondern durchgerechnet.
 *
 * Geprüft gegen vier Forderungen — ein Antippen fällt zurück; knapp über der
 * Mitte trägt es weiter; eine klare Rückwärtsgeste gewinnt; ein kräftiger Wisch
 * trägt mehrere Zustände — und gegen die Bedingung, dass es ÜBERALL zur Ruhe
 * kommt. Über jede Lage und jede Geschwindigkeit: längster Lauf rund eine
 * Sekunde, kein Fall bleibt offen.
 *
 * Zwei Wege sind dabei durchgefallen und stehen hier, damit sie niemand noch
 * einmal einbaut:
 *
 *   - Den Anzieher mit dem Schwung verschieben (`round(here + v · k)`) ist
 *     rückgekoppelt: mehr Schwung schiebt das Ziel weiter, was mehr Schwung
 *     erzeugt. Eine von drei Abstimmungen kam nie zur Ruhe.
 *   - Eine SCHWACHE Rückwärtsgeste dicht vor einem Zustand gewinnen lassen:
 *     keine stabile Abstimmung kann das. Der Zug ist dort am stärksten, wo man
 *     am ehesten umkehren will. Eine deutliche Rückwärtsgeste gewinnt.
 */

/** Wie viel Schwung ein Bild ins nächste mitnimmt. Kleiner = zäher. */
const DAMP = 0.80;

/** Der Zug des Rasters. Die zweite Kraft. */
const PULL = 0.030;

/** Darunter ist die Bewegung zu Ende. */
const REST = 0.12;

/** Darunter gilt ein Bild als „ohne Weg". */
const QUIET = 0.6;

type Points = readonly (readonly (readonly [number, number])[])[];

/**
 * Wo die drei Blasen einer Welle liegen — in Prozent der Bühne.
 *
 * Dieselben Zahlen tragen die Blasen (als Mittelpunkt) UND der Faden. Stünden
 * sie an zwei Stellen, liefe der Faden an den Blasen vorbei.
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

/**
 * Die fünf Wörter, aus denen der Name kommt.
 *
 * Grundlage: Richtung vom Zeichen aus, Abstand, TIEFE, Deckkraft, Grösse. Die
 * Tiefe ist der eigentliche Trick — sie bestimmt, wie schnell ein Wort nach
 * aussen läuft. Fünf verschiedene Tiefen ergeben fünf Geschwindigkeiten, und
 * daraus entsteht der räumliche Eindruck.
 */
const WORDS = [
  { text: 'recolligere', angle: 203, radius: 33, depth: 1.15, alpha: 0.50, size: 1.55 },
  { text: 'renovatio', angle: 331, radius: 29, depth: 0.80, alpha: 0.44, size: 1.85 },
  { text: 'reconciliatio', angle: 148, radius: 39, depth: 1.34, alpha: 0.34, size: 1.25 },
  { text: 'refectio', angle: 26, radius: 25, depth: 0.66, alpha: 0.56, size: 2.05 },
  { text: 'redintegratio', angle: 287, radius: 41, depth: 1.02, alpha: 0.30, size: 1.35 }
] as const;

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

  const [portrait, setPortrait] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(orientation: portrait)').matches
  );

  useEffect(() => {
    const query = window.matchMedia('(orientation: portrait)');
    const onChange = () => setPortrait(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  /*
   * Die Streuung wird EINMAL gewürfelt und dann behalten. Bei jedem Bild neu
   * zu würfeln hiesse: die Wörter zittern, statt zu fliegen.
   */
  const halo = useMemo(
    () => WORDS.map((word) => {
      const jitter = (span: number) => (Math.random() - 0.5) * span;
      const angle = ((word.angle + jitter(14)) * Math.PI) / 180;
      const radius = word.radius + jitter(7);
      return {
        text: word.text,
        dx: Math.cos(angle) * radius,
        dy: Math.sin(angle) * radius,
        depth: word.depth + jitter(0.22),
        alpha: Math.max(0.2, word.alpha + jitter(0.16)),
        size: Math.max(0.9, word.size + jitter(0.3))
      };
    }),
    []
  );

  useEffect(() => {
    const node = stage.current;
    if (node === null) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    let frame = 0;
    let mode: 'watch' | 'drive' = 'watch';
    let lastY = window.scrollY;
    let lastInput = performance.now();
    let still = 0;
    let v = 0;

    const step = () => {
      frame = 0;

      const y = window.scrollY;
      const box = node.getBoundingClientRect();
      const top = y + box.top;
      const travel = node.offsetHeight - window.innerHeight;
      const stepPx = (STEP_VH / 100) * window.innerHeight;

      if (travel <= 0 || stepPx <= 0) { node.style.setProperty('--p', '0'); return; }

      node.style.setProperty('--p', Math.min(1, Math.max(0, (y - top) / travel)).toFixed(5));

      const observed = y - lastY;
      lastY = y;

      const here = (y - top) / stepPx;
      const outside = here < -0.6 || here > STATES - 0.4;

      if (mode === 'watch') {
        // Nur mitlesen. Der Browser führt, und dem wird nicht ins Lenkrad
        // gegriffen — genau daran ist die erste Fassung gescheitert.
        v = observed;
        still = Math.abs(observed) < QUIET ? still + 1 : 0;

        const handsOff = performance.now() - lastInput > INPUT_GRACE;
        if (still < STILL_FRAMES || !handsOff || outside) {
          if (!outside || still < STILL_FRAMES) frame = requestAnimationFrame(step);
          return;
        }

        mode = 'drive';
      }

      if (outside) { mode = 'watch'; v = 0; return; }

      const nearest = Math.min(STATES - 1, Math.max(0, Math.round(here)));
      const gap = top + nearest * stepPx - y;

      // Die eine Zeile: Schwung und Zug, addiert.
      v = reduce.matches ? gap : v * DAMP + gap * PULL;

      if (Math.abs(v) > REST) {
        window.scrollTo(0, y + v);
        lastY = y + v;
        frame = requestAnimationFrame(step);
        return;
      }

      if (Math.abs(gap) > 0.5) {
        window.scrollTo(0, top + nearest * stepPx);
        lastY = top + nearest * stepPx;
      }

      v = 0;
      still = 0;
      mode = 'watch';
    };

    const wake = () => {
      if (frame === 0) frame = requestAnimationFrame(step);
    };

    /** Jede Eingabe gibt die Bewegung sofort zurück. */
    const onInput = () => {
      lastInput = performance.now();
      mode = 'watch';
      still = 0;
      wake();
    };

    node.classList.add('is-live');
    wake();

    window.addEventListener('scroll', wake, { passive: true });
    window.addEventListener('resize', wake, { passive: true });
    window.addEventListener('wheel', onInput, { passive: true });
    window.addEventListener('touchstart', onInput, { passive: true });
    window.addEventListener('touchmove', onInput, { passive: true });
    window.addEventListener('keydown', onInput, { passive: true });

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', wake);
      window.removeEventListener('resize', wake);
      window.removeEventListener('wheel', onInput);
      window.removeEventListener('touchstart', onInput);
      window.removeEventListener('touchmove', onInput);
      window.removeEventListener('keydown', onInput);
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

          {/*
            Die fünf Wörter liegen ÜBER dem Schleier — im Loch wären sie mit
            ausgeschnitten. Für ein Vorleseprogramm sind sie ausgeblendet: fünf
            lateinische Wörter ohne Satz ergeben dort keinen Sinn, und was der
            Name bedeutet, steht im Manifest ausgeschrieben.
          */}
          <div className="rc-halo" aria-hidden="true">
            {halo.map((word) => (
              <span
                key={word.text}
                className="rc-word"
                style={{
                  '--dx': `${word.dx.toFixed(2)}vmin`,
                  '--dy': `${word.dy.toFixed(2)}vmin`,
                  '--depth': word.depth.toFixed(3),
                  '--alpha': word.alpha.toFixed(3),
                  '--size': `${word.size.toFixed(2)}rem`
                } as CSSProperties}
              >
                {word.text}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
