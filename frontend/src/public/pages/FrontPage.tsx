/**
 * Die Startseite — das Zeichen, drei Szenen, die vier Werke.
 *
 *    0            Das Zeichen.
 *    1 … 4        Der Mensch ist ein Ganzes.        (vier Blasen)
 *    5 … 7        Der Mensch braucht den Menschen.  (drei)
 *    8 … 10       Zurück zu den Quellen.            (drei)
 *   11            Die vier Werke.
 *
 * <b>Die Zahl der Blasen ist nicht überall dieselbe</b>, und der Fahrplan
 * rechnet sich daraus. Kommt eine Blase dazu, verschiebt sich alles Weitere von
 * selbst — im Code steht keine Zustandszahl von Hand.
 *
 * <b>Eine Szene ist EIN Ding.</b> Ihre Blasen stehen gemeinsam da, hängen an
 * einem Faden und wachsen zusammen. Was wandert, ist allein die Hervorhebung.
 *
 * <b>Gerastet wird nur zwischen den Szenen.</b> Innerhalb einer Szene ist der
 * Bildlauf frei: dort lässt sich jede Zwischenlage halten, und damit ist jede
 * Blase als hervorgehobene erreichbar. Der Zug greift erst, wenn ein
 * Szenenanfang nah genug ist (`CAPTURE`).
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
 *   `watch`  Eine Hand ist am Werk. Der Browser bewegt, wir lesen nur mit und
 *            schreiben den Schwung geglättet mit. Kein `scrollTo`.
 *   `drive`  Die Hand ist seit `INPUT_GRACE` still. Wir übernehmen — MIT dem
 *            Schwung, den die Seite gerade hat, nicht erst wenn sie steht.
 *
 * Der Unterschied ist der zwischen flüssig und stockend. Eine frühere Fassung
 * wartete, bis der native Nachlauf ausgelaufen war: die Bewegung bremste auf
 * null ab und wurde dann von der Feder wieder beschleunigt. Jetzt läuft sie
 * ohne Halt weiter, weil `v` beim Wechsel schon die richtige Geschwindigkeit
 * trägt.
 *
 * Jede Eingabe schaltet sofort zurück auf `watch`. Abgefangen wird nichts —
 * alle Horcher sind passiv, kein `preventDefault`.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { PublicCopy, SceneBubble } from '../content';
import { PublicText } from '../PublicText';
import { publicHref, type PublicPage } from '../publicRoutes';

const WORK_PAGES: readonly PublicPage[] = ['osrodek', 'wydarzenia', 'cogita', 'biblioteka'];

/**
 * Bildlaufweg je Übergang.
 *
 * War 120vh und damit zu mühsam: bis zur Mitte eines Schrittes waren rund 500
 * Pixel zu scrollen, und wer davor aufhörte, wurde zurückgezogen. Bei 60vh
 * liegt die Mitte bei gut 250 Pixeln — zwei, drei Radrasten. Die Rastung musste
 * dafür NICHT schwächer werden; sie war nie das Problem, der Weg war zu lang.
 */
const STEP_VH = 60;

/**
 * So lange nach der letzten Hand-Eingabe gehört die Bewegung dem Browser.
 * Danach wird übernommen — mit dem Schwung, den sie in dem Augenblick hat.
 */
const INPUT_GRACE = 130;

/** Wie stark der mitgeschriebene Schwung geglättet wird. */
const SMOOTH = 0.55;

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
const DAMP = 0.895;

/** Der Zug des Rasters. Die zweite Kraft. */
const PULL = 0.014;

/** Darunter ist die Bewegung zu Ende. */
const REST = 0.12;

/** Wie nah an einem Rastpunkt der Zug überhaupt greift. */
const CAPTURE = 0.7;

type Point = readonly [number, number];

/**
 * Wo die Blasen einer Szene liegen — in Prozent der Bühne.
 *
 * <b>Gerechnet, nicht eingetragen.</b> Die Szenen haben verschieden viele
 * Blasen (vier, drei, drei), und eine Tabelle von Hand müsste bei jeder
 * Textänderung mitgepflegt werden — genau dort geraten Faden und Blasen
 * auseinander. Die Punkte kommen deshalb aus der ANZAHL: gleichmässig auf einer
 * Ellipse verteilt, je Szene gedreht, damit zwei Szenen nicht gleich aussehen.
 *
 * Dieselben Zahlen tragen die Blasen (als Mittelpunkt) UND der Faden.
 */
function ringPoints(count: number, scene: number, portrait: boolean): readonly Point[] {
  const cx = portrait ? 50 : 52;
  const cy = portrait ? 50 : 52;
  const rx = portrait ? 17 : 27;
  const ry = portrait ? 31 : 24;

  // Eine Drittelumdrehung Versatz je Szene, plus ein Viertel nach oben, damit
  // die erste Blase oben steht und nicht rechts.
  const turn = scene * 0.37 - 0.25;

  return Array.from({ length: count }, (_, index) => {
    const a = 2 * Math.PI * (index / count + turn);
    return [
      Number((cx + rx * Math.cos(a)).toFixed(2)),
      Number((cy + ry * Math.sin(a)).toFixed(2))
    ] as Point;
  });
}

/**
 * Die fünf Wörter, aus denen der Name kommt.
 *
 * Das **RE** steht gross — dasselbe RE wie in REcreatio. Es ist der gemeinsame
 * Anfang aller fünf und der Grund, warum die Einrichtung so heisst; deshalb
 * trägt es die Betonung und der Rest folgt klein.
 *
 * Grundlage je Wort: Richtung vom Zeichen aus, Abstand, TIEFE, Deckkraft,
 * Grösse. Die Tiefe ist der eigentliche Trick — sie bestimmt, wie schnell ein
 * Wort nach aussen läuft. Fünf verschiedene Tiefen ergeben fünf
 * Geschwindigkeiten, und daraus entsteht der räumliche Eindruck.
 */
const WORDS = [
  { tail: 'colligere', angle: 203, radius: 46, depth: 1.15, alpha: 0.50, size: 2.2 },
  { tail: 'novatio', angle: 331, radius: 41, depth: 0.80, alpha: 0.44, size: 2.6 },
  { tail: 'conciliatio', angle: 148, radius: 52, depth: 1.34, alpha: 0.34, size: 1.9 },
  { tail: 'fectio', angle: 26, radius: 38, depth: 0.66, alpha: 0.56, size: 2.9 },
  { tail: 'dintegratio', angle: 287, radius: 54, depth: 1.02, alpha: 0.30, size: 2.0 }
] as const;

/**
 * Die Sperrzone um das Zeichen, als halbe Achsen in vmin.
 *
 * Das Logo ist breit und flach (210 zu 74), also ist die Zone eine Ellipse und
 * kein Kreis. Ein Wort, das nach dem Würfeln darin läge, wird auf seiner
 * eigenen Richtung nach aussen geschoben, bis es frei steht — so darf die Lage
 * kräftig streuen, ohne dass je etwas über dem Zeichen landet.
 */
const KEEP_X = 40;
const KEEP_Y = 19;

/**
 * Die vier Werke kommen NICHT als Block, sondern jedes in sein Viertel.
 *
 *   links oben  →  links unten  →  rechts oben  →  rechts unten
 *
 * `from` ist die Seite, von der es hereinfährt (-1 links, +1 rechts), `at` der
 * Zustand, ab dem es losläuft. Der Versatz von 0.15 zwischen ihnen ist klein
 * genug, dass es eine Bewegung bleibt, und gross genug, dass man vier Dinge
 * nacheinander sieht statt eines Blocks, der aufblendet.
 *
 * Alle vier stehen bei 9.85 — also vor Zustand 10, damit dort wirklich Ruhe
 * ist und nicht noch etwas nachläuft.
 */
const QUARTERS = [
  { from: -1, lead: 1.15 },
  { from: -1, lead: 1.00 },
  { from: 1, lead: 0.85 },
  { from: 1, lead: 0.70 }
] as const;

/**
 * Eine Blase. Die ART entscheidet, was darin steht — nicht der Platz.
 *
 * `title` trägt eine Überschrift zweiter Ordnung: jede Szene ist ein Abschnitt
 * mit einer Aussage, und die soll auch in der Gliederung stehen. Die `h1` der
 * Seite bleibt der Satz unter dem Zeichen.
 */
function Bubble({
  index, at, bubble, copy
}: {
  index: number;
  at: Point;
  bubble: SceneBubble;
  copy: PublicCopy;
}) {
  const style = {
    '--i': index,
    '--x': `${at[0]}%`,
    '--y': `${at[1]}%`
  } as CSSProperties;

  return (
    <div className="rc-bubble" data-kind={bubble.kind} style={style}>
      {bubble.kind === 'title' && (
        <h2 className="rc-bub-title">{bubble.lines[0]}</h2>
      )}

      {bubble.kind === 'body' && bubble.lines.map((line) => (
        <p className="rc-bub-body" key={line.slice(0, 32)}>{line}</p>
      ))}

      {bubble.kind === 'close' && (
        <p className="rc-bub-close">
          {bubble.lines.map((line) => <span key={line}>{line}</span>)}
        </p>
      )}

      {bubble.kind === 'note' && (
        <p className="rc-bub-note">{bubble.lines[0]}</p>
      )}

      {bubble.kind === 'image' && (
        <>
          {bubble.image !== undefined && (
            <PublicText value={bubble.image} copy={copy} as="div" />
          )}
          <p className="rc-bub-over">
            {bubble.lines.map((line) => <span key={line}>{line}</span>)}
          </p>
        </>
      )}
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

  /*
   * Der Fahrplan folgt dem INHALT, nicht umgekehrt.
   *
   *   Zustand 0            das Zeichen
   *   dann je Szene so viele Zustände, wie sie Blasen hat
   *   zuletzt              die vier Werke
   *
   * Bekommt eine Szene eine Blase mehr, verschiebt sich alles Weitere von
   * selbst. Eine Zahl von Hand an dieser Stelle wäre die erste, die bei der
   * nächsten Textänderung nicht mehr stimmt.
   */
  const plan = useMemo(() => {
    const starts: number[] = [];
    let at = 1;
    for (const scene of t.scenes) { starts.push(at); at += scene.bubbles.length; }

    const works = at;
    const contact = at + 1;

    return {
      starts,
      works,
      contact,
      states: contact + 1,
      /*
       * Gerastet wird NUR am Anfang einer Szene — und am Zeichen und an den
       * Werken. Innerhalb einer Szene ist der Bildlauf frei: dort lässt sich
       * jede Zwischenlage halten, und damit ist jede Blase als hervorgehobene
       * erreichbar. Genau das war gewünscht: eine Strecke ohne Rastung.
       */
      snaps: [0, ...starts, works, contact]
    };
  }, [t.scenes]);

  // Die Physik liest den Fahrplan, ohne dass ihr Effekt neu aufgesetzt wird.
  const planRef = useRef(plan);
  planRef.current = plan;

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
      const angle = ((word.angle + jitter(30)) * Math.PI) / 180;
      const radius = word.radius + jitter(18);

      let dx = Math.cos(angle) * radius;
      let dy = Math.sin(angle) * radius * 0.72;

      // Liegt der Punkt in der Sperrzone, auf seiner eigenen Richtung
      // hinausschieben — mit etwas Luft, damit nichts das Zeichen streift.
      const inside = Math.hypot(dx / KEEP_X, dy / KEEP_Y);
      if (inside < 1) {
        const push = (1 / Math.max(inside, 0.001)) * 1.08;
        dx *= push;
        dy *= push;
      }

      return {
        tail: word.tail,
        dx,
        dy,
        depth: word.depth + jitter(0.3),
        alpha: Math.max(0.24, word.alpha + jitter(0.18)),
        size: Math.max(1.4, word.size + jitter(0.55))
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
      const outside = here < -0.6 || here > planRef.current.states - 0.4;

      if (mode === 'watch') {
        // Nur mitlesen und den Schwung glätten. Der Browser führt, und dem wird
        // nicht ins Lenkrad gegriffen — daran ist eine frühere Fassung
        // gescheitert.
        v = v * SMOOTH + observed * (1 - SMOOTH);

        if (performance.now() - lastInput <= INPUT_GRACE) {
          frame = requestAnimationFrame(step);
          return;
        }

        /*
         * Übernommen wird, WÄHREND die Seite noch läuft — nicht erst, wenn sie
         * steht. Der Schwung ist schon in `v`, also geht es ohne Halt weiter.
         *
         * Die Fassung davor wartete auf zwei Bilder ohne Weg. Damit bremste die
         * Bewegung erst auf null ab und wurde dann von der Feder wieder
         * beschleunigt — sichtbar als Stocken. Dass `scrollTo` den nativen
         * Nachlauf abbricht, ist hier kein Schaden, sondern genau die Übergabe:
         * wir setzen ihn mit derselben Geschwindigkeit fort.
         */
        mode = 'drive';
      }

      if (outside) { mode = 'watch'; v = 0; return; }

      /*
       * Nur die Rastpunkte ziehen — und nur, wenn einer nah genug ist.
       *
       * Zwischen ihnen liegt die freie Strecke: dort ist der Zug null, und es
       * bleibt allein die Dämpfung. Die Bewegung läuft also aus und hält, wo
       * sie hält. Dadurch ist innerhalb einer Szene JEDE Lage erreichbar und
       * jede Blase kann die hervorgehobene sein.
       */
      const snaps = planRef.current.snaps;
      let nearest = snaps[0];
      for (const candidate of snaps) {
        if (Math.abs(candidate - here) < Math.abs(nearest - here)) nearest = candidate;
      }

      const captured = Math.abs(nearest - here) <= CAPTURE;
      const gap = captured ? top + nearest * stepPx - y : 0;

      // Die eine Zeile: Schwung und Zug, addiert.
      v = reduce.matches ? gap : v * DAMP + gap * PULL;

      if (Math.abs(v) > REST) {
        window.scrollTo(0, y + v);
        lastY = y + v;
        frame = requestAnimationFrame(step);
        return;
      }

      if (captured && Math.abs(gap) > 0.5) {
        window.scrollTo(0, top + nearest * stepPx);
        lastY = top + nearest * stepPx;
      }

      v = 0;
      mode = 'watch';
    };

    const wake = () => {
      if (frame === 0) frame = requestAnimationFrame(step);
    };

    /** Jede Eingabe gibt die Bewegung sofort zurück. */
    const onInput = () => {
      lastInput = performance.now();
      mode = 'watch';
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

  const stageStyle = {
    '--states': plan.states - 1,
    '--step': `${STEP_VH}vh`,
    // Die beiden letzten Zustände als Zahl: das Stilblatt rechnet damit, statt
    // sie aus `--states` zurückzuschliessen — das ginge beim nächsten Zusatz schief.
    '--works': plan.works,
    '--contact': plan.contact
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

          {/*
            Die drei Szenen. Alle Blasen einer Szene stehen GEMEINSAM da; was
            beim Scrollen wandert, ist allein die Hervorhebung. `--c` ist der
            Zustand der ersten Blase, `--n` die Anzahl — daraus rechnet das
            Stilblatt Auftritt, Wachsen und Abgang.
          */}
          {t.scenes.map((scene, index) => {
            const points = ringPoints(scene.bubbles.length, index, portrait);
            return (
              <section
                className="rc-wave"
                key={scene.label}
                aria-label={scene.label}
                style={{
                  '--c': plan.starts[index],
                  '--n': scene.bubbles.length,
                  // Lebensdauer der Szene in Zuständen. Hier gerechnet und
                  // nicht im Stilblatt: eine Division durch einen
                  // Benutzerwert ist in `calc()` heikel, eine Zahl nicht.
                  '--life': scene.bubbles.length + 1.4
                } as CSSProperties}
              >
                <Thread points={points} />
                {scene.bubbles.map((bubble, at) => (
                  <Bubble
                    key={bubble.kind + at}
                    index={at}
                    at={points[at]}
                    bubble={bubble}
                    copy={copy}
                  />
                ))}
              </section>
            );
          })}

          <section className="rc-s3 rc-l3" aria-labelledby="rc-h3">
            <div className="rc-s3-in">
              <h2 className="rc-h2" id="rc-h3">{t.screen3.title}</h2>
              <p className="rc-stages">{t.screen3.stages}</p>

              <div className="rc-works">
                {t.screen3.works.map((work, index) => (
                  <article
                    className="rc-work"
                    key={work.name}
                    style={{
                      '--from': QUARTERS[index].from,
                      '--at': plan.works - QUARTERS[index].lead
                    } as CSSProperties}
                  >
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

          {/*
            Der Kreis in der Mitte der vier Sektoren. Er wächst zum Grund des
            letzten Bildes — deshalb ist er dieselbe Fläche und keine zweite:
            was man am Ende sieht, ist der Kreis von vorhin, nur gross.
          */}
          <div className="rc-orb" aria-hidden="true" />

          {/*
            Das Zeichen, das mitgeht. Es sitzt erst mitten im Kreis und wandert
            beim Wachsen in die obere linke Ecke — dorthin, wo im letzten Bild
            die Anschrift darunter steht.
          */}
          <div className="rc-mark-fly">
            <img src="/logo_inv.svg" alt={t.screen1.wordmark} />
          </div>

          <section className="rc-contact" aria-labelledby="rc-h4">
            <div className="rc-contact-in">
              <h2 className="rc-h2" id="rc-h4">{copy.contact.title}</h2>
              <p className="rc-contact-lead">{copy.contact.lead}</p>

              <p className="rc-contact-mail">
                <a href={`mailto:${copy.contact.email}`}>{copy.contact.email}</a>
              </p>

              <PublicText value={copy.contact.address} copy={copy} as="div" />

              {/* Die ehrliche Zeile steht auch hier — sie ist das Letzte, was
                  jemand liest, und sie muss stimmen. */}
              <p className="rc-contact-note">{t.screen1.wordmark}: {copy.manifest.opening.inFormation}</p>

              <p className="rc-contact-more">
                <a href={publicHref('o-nas')}>{copy.nav['o-nas']}</a>
                <a href={publicHref('przejrzystosc')}>{copy.nav.przejrzystosc}</a>
                <a href={publicHref('kontakt')}>{copy.nav.kontakt}</a>
              </p>
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
                key={word.tail}
                className="rc-word"
                style={{
                  '--dx': `${word.dx.toFixed(2)}vmin`,
                  '--dy': `${word.dy.toFixed(2)}vmin`,
                  '--depth': word.depth.toFixed(3),
                  '--alpha': word.alpha.toFixed(3),
                  '--size': `${word.size.toFixed(2)}rem`
                } as CSSProperties}
              >
                <b className="rc-word-re">RE</b>{word.tail}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
