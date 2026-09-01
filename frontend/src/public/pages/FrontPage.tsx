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
 * ZWEI KRÄFTE, DIE SICH ADDIEREN
 *
 * Schwung und Rastung wirken GLEICHZEITIG, nicht nacheinander.
 *
 * Der erste Anlauf machte es nacheinander: warten, bis der Bildlauf steht, dann
 * aus der Geschwindigkeit ein Ziel ausrechnen, dann dorthin gleiten. Das ist
 * eine Entscheidung, keine Bewegung — und man sieht es: die Seite hält an und
 * fährt noch einmal los.
 *
 * Jetzt läuft in jedem Bild eine kleine Rechnung:
 *
 *     v = v · DÄMPFUNG + Abstand_zum_nächsten_Zustand · ZUG
 *
 * `v` trägt den Schwung des Besuchers, der Summand daneben ist der Zug des
 * Rasters. Beides steht in derselben Zeile und wird addiert.
 *
 * <b>Das Ziel wird nirgends gewählt.</b> Es ergibt sich: ein kräftiger Wisch
 * hat so viel `v`, dass er über den nächsten Zustand hinausschiesst — und dann
 * zieht ihn der übernächste an, weil `nächster Zustand` in jedem Bild neu aus
 * der aktuellen Lage kommt. Wie weit es trägt, ist Physik und keine Fallunter-
 * scheidung. Die frühere Rechnung `min(2, floor(|v| / 1.6))` ist damit weg.
 *
 * <b>Während der Besucher selbst scrollt</b>, bewegt der Browser die Seite; der
 * Zug kommt dann als kleiner Zuschlag im selben Bild dazu (`PULL_LIVE`) — es
 * zieht also schon magnetisch, während man noch scrollt. Der Schwung wird dabei
 * nur mitgeschrieben und NICHT noch einmal aufgeschlagen; täte man das, liefe
 * die Seite doppelt so schnell wie die Hand.
 *
 * Abgefangen wird nichts: `wheel` und `touchstart` werden nur passiv mitgehört,
 * um zu wissen, ob gerade eine Hand am Werk ist. Kein `preventDefault`.
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

/**
 * So lange nach der letzten Hand-Eingabe gilt der Bildlauf als „geführt".
 * Solange zieht das Raster nur leicht (`PULL_LIVE`), damit es sich nicht gegen
 * die Hand stemmt.
 */
const INPUT_GRACE = 90;

/*
 * DÄMPFUNG und ZUG sind nicht geraten, sondern durchgerechnet.
 *
 * Geprüft wurde gegen vier Forderungen — ein Antippen fällt zurück; knapp über
 * der Mitte trägt es weiter; eine klare Rückwärtsgeste gewinnt; ein kräftiger
 * Wisch trägt mehrere Zustände — und gegen die Bedingung, dass die Bewegung
 * ÜBERALL zur Ruhe kommt. Über den ganzen Raum (jede Lage, jede
 * Geschwindigkeit) liegt der längste Lauf bei rund einer Sekunde, und es bleibt
 * kein Fall offen.
 *
 * Zwei Wege, die dabei durchgefallen sind und deshalb hier stehen, damit sie
 * niemand noch einmal einbaut:
 *
 *   - Den Anzieher mit dem Schwung verschieben (`round(here + v · k)`). Das ist
 *     rückgekoppelt: mehr Schwung schiebt das Ziel weiter nach vorn, was noch
 *     mehr Schwung erzeugt. Eine von drei Abstimmungen lief davon und kam nie
 *     zur Ruhe.
 *   - Eine SCHWACHE Rückwärtsgeste dicht vor einem Zustand gewinnen lassen.
 *     Keine einzige stabile Abstimmung kann das. Der Zug ist dort am stärksten,
 *     wo man am ehesten umkehren will — das ist der Preis der Magnetik und
 *     genau das Verhalten, das man von einer Rasterung kennt. Eine deutliche
 *     Rückwärtsgeste gewinnt.
 */

/** Wie viel Schwung ein Bild ins nächste mitnimmt. Kleiner = zäher. */
const DAMP = 0.80;

/** Der Zug des Rasters, während die Hand scrollt. Nur ein Zuschlag. */
const PULL_LIVE = 0.020;

/** Der Zug des Rasters, sobald die Hand los ist. Die zweite Kraft. */
const PULL_FREE = 0.030;

/** Darunter ist die Bewegung zu Ende und die Schleife hört auf. */
const REST = 0.12;

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
    let lastY = window.scrollY;
    let lastInput = 0;
    /** Der Schwung. Trägt, was die Hand hinterlassen hat. */
    let v = 0;

    /**
     * Ein Bild: ablesen, beide Kräfte addieren, weiterschieben.
     *
     * Die Schleife läuft nur, solange sich etwas bewegt oder etwas zu ziehen
     * ist. Steht alles still, hört sie auf und wartet auf das nächste Ereignis.
     */
    const step = () => {
      frame = 0;

      const y = window.scrollY;
      const box = node.getBoundingClientRect();
      const top = y + box.top;
      const travel = node.offsetHeight - window.innerHeight;
      const stepPx = (STEP_VH / 100) * window.innerHeight;

      if (travel <= 0 || stepPx <= 0) { node.style.setProperty('--p', '0'); return; }

      node.style.setProperty('--p', Math.min(1, Math.max(0, (y - top) / travel)).toFixed(5));

      // Was der Browser seit dem letzten Bild bewegt hat — die Hand, samt dem
      // Nachlauf, den das Gerät selbst erzeugt.
      const observed = y - lastY;
      lastY = y;

      const here = (y - top) / stepPx;
      if (here < -0.6 || here > STATES - 0.4) { v = 0; return; }

      const nearest = Math.min(STATES - 1, Math.max(0, Math.round(here)));
      const gap = top + nearest * stepPx - y;

      const guided = performance.now() - lastInput < INPUT_GRACE;

      if (guided) {
        // Die Hand bewegt. Der Schwung wird nur MITGESCHRIEBEN — ihn hier noch
        // einmal aufzuschlagen liesse die Seite doppelt so schnell laufen wie
        // die Hand. Dazu kommt der Zug des Rasters als kleiner Zuschlag: es
        // zieht schon magnetisch, während man noch scrollt.
        v = observed;
        const nudge = gap * (reduce.matches ? 0 : PULL_LIVE);
        if (Math.abs(nudge) > 0.3) window.scrollTo(0, y + nudge);
        frame = requestAnimationFrame(step);
        return;
      }

      // Die Hand ist los. Jetzt die eine Zeile, um die es geht: Schwung und
      // Zug in derselben Rechnung. Wie weit es traegt, wird nirgends gewaehlt —
      // ein kraeftiger Wisch schiesst ueber den naechsten Zustand hinaus, und
      // dann zieht ihn der uebernaechste, weil `nearest` jedes Bild neu kommt.
      v = reduce.matches ? gap : v * DAMP + gap * PULL_FREE;

      if (Math.abs(v) > REST) {
        window.scrollTo(0, y + v);
        frame = requestAnimationFrame(step);
        return;
      }

      // Zur Ruhe gekommen: den Rest genau setzen, dann aufhoeren.
      if (Math.abs(gap) > 0.5) window.scrollTo(0, top + nearest * stepPx);
      v = 0;
    };

    const wake = () => {
      if (frame === 0) frame = requestAnimationFrame(step);
    };

    const onInput = () => {
      lastInput = performance.now();
      wake();
    };

    node.classList.add('is-live');
    wake();
    // `scroll` weckt nur; `wheel`, `touch` und die Tastatur sagen zusätzlich,
    // dass eine Hand am Werk ist. Alle passiv — nichts wird abgefangen.
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
