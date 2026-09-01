/**
 * Die Startseite — das Zeichen, drei Szenen, die vier Werke.
 *
 *    0            Das Zeichen.
 *    1 … 4        Der Mensch ist ein Ganzes.        (vier Blasen)
 *    5 … 7        Der Mensch braucht den Menschen.  (drei)
 *    8 … 10       Zurück zu den Quellen.            (drei)
 *   11            Die vier Werke.
 *   12            Kontakt.
 *
 * <b>Die Zahl der Blasen ist nicht überall dieselbe</b>, und der Fahrplan
 * rechnet sich daraus. Kommt eine Blase dazu, verschiebt sich alles Weitere von
 * selbst — im Code steht keine Zustandszahl von Hand.
 *
 * <b>Eine Szene ist EIN Ding.</b> Ihre Blasen stehen gemeinsam da, hängen an
 * einem Faden und wachsen zusammen. Was wandert, ist allein die Hervorhebung.
 *
 * ---------------------------------------------------------------------------
 * DAS ERSTE BILD IST EIN RAUM
 *
 * Kein Schleier, keine Maske: eine echte Perspektive. Alles darin ist ein
 * Gegenstand mit einem z — die Wörter, das Zeichen, der Satz —, und bewegt wird
 * die KAMERA. Grösse, Parallaxe und das Vorbeifliegen fallen aus der Projektion
 * heraus und werden nirgends gerechnet.
 *
 * Das Zeichen steht der Kamera näher als der Satz und zieht deshalb zuerst
 * vorbei; der Satz wird gross und bleibt einen Augenblick allein.
 *
 * ---------------------------------------------------------------------------
 * DER BILDLAUF: EINE GESTE, EIN ÜBERGANG
 *
 * Der Bildlauf wird abgefangen, und das ist diesmal Absicht. Alle Versuche, ihn
 * dem Browser zu lassen und nur nachzuhelfen, scheiterten an derselben Stelle:
 * eine native Bewegung lässt sich nicht mitsteuern, ohne sie abzubrechen.
 *
 * Jetzt gilt eine einzige Regel — <b>eine Geste bewegt um einen Zustand.</b>
 * Die Zeitstempel sagen, was eine Geste ist: nach einer Ruhe von GESTURE_GAP
 * beginnt eine neue; alles, was innerhalb einer Geste noch eintrifft (ein
 * Trackpad schickt Dutzende Ereignisse), zählt nicht weiter mit.
 *
 * Damit ist beides erledigt, was vorher nicht ging:
 *
 *   - Langsam scrollen fällt nicht zurück. Es gibt keine Feder mehr, die
 *     zurückzieht; jede Geste geht einen Schritt weiter.
 *   - Schnell scrollen überspringt nichts. Eine Geste bleibt eine Geste, wie
 *     kräftig sie auch ist.
 *
 * <b>Der Übergang fängt dort an, wo die Hand ist.</b> Er beginnt mit genau der
 * Geschwindigkeit, mit der gerade geschoben wird — eine einzige Bewegung, nicht
 * eine zweite, die daneben neu anfängt. Danach zieht ihn seine eigene Zeit auf
 * sein eigenes Mass: er läuft über GLIDE_MS aus und kommt von selbst zur Ruhe,
 * gleichgültig, was die Hand inzwischen tut.
 *
 * Das leistet eine Hermite-Kurve: Anfangssteigung aus der Geste, Endsteigung
 * null. Eine gewöhnliche Ein-und-Ausblendkurve kann das nicht — sie fängt immer
 * bei null an, und genau deshalb las sich der Übergang als etwas Zweites, das
 * nach der Geste einsetzt, statt als deren Fortsetzung.
 *
 * Über der Steigung 3 schwänge die Kurve über das Ziel hinaus; dort wird ihre
 * Ableitung gerade noch nicht negativ. Deshalb ist genau dort gedeckelt: ein
 * sehr harter Wurf fährt schnell an, aber die Seite läuft nie zurück.
 *
 * Wer dauerhaft weiterschiebt, kommt trotzdem voran: nach REPEAT_MS im selben
 * Zug folgt der nächste Schritt. Dabei wird die Geschwindigkeit des laufenden
 * Übergangs mitgenommen, damit auch eine Kette aus Schritten eine Bewegung
 * bleibt. Die Tastatur ist eigens bedient, damit die Seite ohne Zeigegerät
 * begehbar bleibt.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { PublicCopy, SceneBubble } from '../content';
import { PublicText } from '../PublicText';
import { publicHref, type PublicPage } from '../publicRoutes';

const WORK_PAGES: readonly PublicPage[] = ['osrodek', 'wydarzenia', 'cogita', 'biblioteka'];

/**
 * Bildlaufweg je Übergang — und damit die Höhe der Bühne.
 *
 * Seit der Bildlauf abgefangen wird, ist das kein Kraftaufwand mehr für den
 * Besucher, sondern nur noch die Strecke, die ein Übergang zurücklegt.
 */
const STEP_VH = 60;

/**
 * Ruhe, nach der eine neue Geste beginnt.
 *
 * Ein Rad schickt einzelne Ereignisse, ein Trackpad einen Strom. Erst dieser
 * Abstand macht aus beidem dasselbe: eine Geste.
 */
const GESTURE_GAP = 150;

/** Wer im selben Zug weiterschiebt, kommt nach dieser Zeit einen Schritt weiter. */
const REPEAT_MS = 500;

/** Wie lange ein Übergang dauert. Seine eigene Zeit, nicht die der Geste. */
const GLIDE_MS = 700;

/** So weit muss ein Finger wandern, ehe es als Geste zählt. */
const TOUCH_MIN = 26;

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
const WORDS = ['colligere', 'novatio', 'conciliatio', 'fectio', 'dintegratio'] as const;

/**
 * Der Raum des ersten Bildes.
 *
 * <b>Eine echte Perspektive, keine nachgebaute.</b> Alles steht als Gegenstand
 * mit einem z im selben Raum; bewegt wird die KAMERA. Grösse, Parallaxe und das
 * Vorbeifliegen fallen dann aus der Projektion heraus und müssen nicht einzeln
 * gerechnet werden — vorher war jedes davon eine eigene Formel, und genau
 * deshalb wirkten die Wörter wie eine zweite Ebene neben dem Zeichen.
 *
 * Die Kamera fährt nach vorn, auf den Satz zu. Das Zeichen steht ihr näher und
 * zieht deshalb zuerst vorbei; der Satz liegt dahinter, wird gross und bleibt
 * einen Augenblick allein, bevor auch er vorbeizieht.
 */
const PERSPECTIVE = 1000;
const LOGO_Z = -320;
const SENTENCE_Z = -980;
const SENTENCE_Y = 11;

/** Wie weit die Kamera insgesamt fährt. Beide müssen daran vorbeikommen. */
const CAM_END = 2200;

/**
 * Ein Wort im Raum setzen.
 *
 * <b>Die Liste darf wachsen.</b> Ein Wort mehr in `WORDS` genügt — Richtung,
 * Abstand und Tiefe kommen aus dem Index, nicht aus einer Tabelle. Der Winkel
 * läuft im goldenen Schnitt weiter, damit sich auch bei zwölf Wörtern keine
 * Speiche wiederholt.
 *
 * Eine Sperrzone braucht es nicht mehr: im Raum liegt ein Wort ENTWEDER vor dem
 * Zeichen ODER dahinter, und beides ist richtig. Nur ganz nah an der Achse
 * würde es davorstehen — deshalb ein Mindestabstand zur Mitte.
 */
function placeWord(index: number, roll: () => number) {
  const angle = index * 2.39996 + (roll() - 0.5) * 0.7;
  const radius = 22 + roll() * 30;

  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius * 0.78,
    // Von weit hinten bis dicht vor die Kamera. Nah heisst gross und schnell
    // vorbei, fern heisst klein und lange da.
    z: -1650 + roll() * 1500,
    size: 1.5 + roll() * 1.5,
    alpha: 0.34 + roll() * 0.42
  };
}

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
      states: contact + 1
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
    () => WORDS.map((tail, index) => ({ tail, ...placeWord(index, Math.random) })),
    []
  );

  useEffect(() => {
    const node = stage.current;
    if (node === null) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    let frame = 0;

    /** Der Zustand, auf den zugefahren wird. Immer eine ganze Zahl. */
    let target = 0;

    /*
     * Der laufende Übergang: von wo, wohin, seit wann, wie lange — und mit
     * welcher Steigung er angefangen hat.
     */
    let fromY = 0;
    let toY = 0;
    let startedAt = 0;
    let span = GLIDE_MS;
    let lead = 0;
    let gliding = false;

    /** Die Zeitstempel: das letzte Ereignis, der letzte Schritt. */
    let lastEvent = 0;
    let lastStep = 0;

    /** Die Hand: wo der Finger zuletzt war, wie schnell sie schiebt (px/ms). */
    let touchAt = 0;
    let speed = 0;

    const measure = () => {
      const pin = node.firstElementChild as HTMLElement | null;
      const headH = pin === null ? 0 : parseFloat(getComputedStyle(pin).top) || 0;
      return {
        origin: window.scrollY + node.getBoundingClientRect().top - headH,
        stepPx: (STEP_VH / 100) * window.innerHeight,
        last: planRef.current.states - 1
      };
    };

    const paint = () => {
      const { origin, stepPx, last } = measure();
      if (stepPx <= 0 || last <= 0) { node.style.setProperty('--p', '0'); return; }

      const here = (window.scrollY - origin) / stepPx;
      node.style.setProperty('--p', Math.min(1, Math.max(0, here / last)).toFixed(5));
    };

    /*
     * Die Kurve des Übergangs.
     *
     * Eine kubische Hermite-Kurve mit vorgegebener Anfangssteigung m und der
     * Endsteigung null:  p(k) = m·k·(k−1)² + k²·(3−2k).
     *
     * Sie fängt mit der Geschwindigkeit an, mit der die Hand geschoben hat, und
     * kommt von selbst zur Ruhe. Bei m = 0 ist sie die gewöhnliche
     * Ausblendkurve; bei m = 3 ist sie gerade noch monoton (ihre Ableitung wird
     * dann 3(k−1)² und berührt die Null nur am Ende).
     */
    const curve = (k: number, m: number) => m * k * (k - 1) * (k - 1) + k * k * (3 - 2 * k);

    /** Ihre Ableitung — gebraucht, wenn ein Übergang in den nächsten übergeht. */
    const slope = (k: number, m: number) => m * (3 * k - 1) * (k - 1) + 6 * k * (1 - k);

    const tick = () => {
      frame = 0;
      if (!gliding) return;

      const k = span <= 0 ? 1 : Math.min(1, (performance.now() - startedAt) / span);
      window.scrollTo(0, fromY + (toY - fromY) * curve(k, lead));
      paint();

      if (k < 1) frame = requestAnimationFrame(tick);
      else gliding = false;
    };

    /**
     * Einen Zustand weiter — als Fortsetzung dessen, was die Hand gerade tut.
     *
     * <b>hand</b> ist deren Geschwindigkeit in Pixeln je Millisekunde. Läuft
     * schon ein Übergang, wird auch dessen Geschwindigkeit mitgenommen: eine
     * Kette aus Schritten soll eine Bewegung bleiben und nicht bei jedem
     * Schritt neu anfahren.
     */
    const go = (dir: number, hand: number) => {
      const { origin, stepPx, last } = measure();
      const next = Math.min(last, Math.max(0, target + dir));
      if (next === target && gliding) return;

      const now = performance.now();

      // Noch vor dem Überschreiben: wie schnell der laufende Übergang gerade ist.
      const running = gliding && span > 0
        ? (slope(Math.min(1, (now - startedAt) / span), lead) * (toY - fromY)) / span
        : 0;

      target = next;
      lastStep = now;

      fromY = window.scrollY;
      toY = origin + target * stepPx;

      // Wer während eines Übergangs weiterschiebt, soll nicht warten müssen:
      // der nächste läuft etwas straffer.
      span = reduce.matches ? 0 : (gliding ? GLIDE_MS * 0.72 : GLIDE_MS);
      startedAt = now;
      gliding = true;

      if (span === 0) { window.scrollTo(0, toY); gliding = false; paint(); return; }

      /*
       * Die Anfangssteigung in den Einheiten der Kurve: welchen Anteil der
       * ganzen Strecke die Hand in der ganzen Zeit des Übergangs schaffte.
       *
       * Gezählt wird nur, was in die Richtung des Schrittes zeigt — eine Hand,
       * die dagegen schiebt, soll den Übergang nicht rückwärts anfahren lassen.
       */
      const reach = toY - fromY;
      const v = dir > 0 ? Math.max(hand, running, 0) : Math.min(hand, running, 0);
      lead = reach === 0 ? 0 : Math.min(3, Math.max(0, (v * span) / reach));

      if (frame === 0) frame = requestAnimationFrame(tick);
    };

    /*
     * EINE GESTE, EIN SCHRITT.
     *
     * Die Zeitstempel entscheiden, was eine Geste ist: nach einer Ruhe von
     * GESTURE_GAP fängt eine neue an. Alles, was innerhalb einer Geste noch
     * kommt — und ein Rad oder ein Trackpad schickt Dutzende Ereignisse —,
     * zählt nicht weiter mit.
     *
     * Damit ist beides erledigt: langsames Scrollen fällt nicht zurück, denn
     * jede Geste geht einen Schritt weiter; schnelles Scrollen überspringt
     * nichts, denn eine Geste bleibt eine Geste, wie kräftig sie auch ist.
     *
     * Gemessen wird dabei mit, wie schnell geschoben wird — nicht um daraus
     * mehr Schritte zu machen, sondern damit der Übergang dort anfängt, wo die
     * Hand gerade ist.
     */
    const gesture = (dir: number, px: number) => {
      const now = performance.now();
      const fresh = now - lastEvent > GESTURE_GAP;
      const held = now - lastStep > REPEAT_MS;

      // Beim ersten Ereignis einer Geste gibt es noch keinen Abstand, aus dem
      // sich eine Geschwindigkeit ergäbe; dann gilt ein Vollbild als Mass.
      const dt = fresh ? 16 : Math.min(120, Math.max(4, now - lastEvent));
      const v = px / dt;
      speed = fresh ? v : speed * 0.55 + v * 0.45;
      lastEvent = now;

      if (fresh || held) go(dir, speed);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.deltaY === 0) return;

      // deltaMode: 0 Pixel, 1 Zeilen, 2 Seiten. Ohne Umrechnung führe ein
      // zeilenweise meldendes Rad den Übergang um ein Vielfaches zu langsam an.
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      const px = event.deltaY * unit;
      gesture(px > 0 ? 1 : -1, px);
    };

    const onTouchStart = (event: TouchEvent) => {
      touchAt = event.touches[0]?.clientY ?? 0;
      lastEvent = 0;
      speed = 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      event.preventDefault();
      const y = event.touches[0]?.clientY ?? 0;
      const dy = touchAt - y;
      if (Math.abs(dy) < TOUCH_MIN) return;

      touchAt = y;
      gesture(dy > 0 ? 1 : -1, dy);
    };

    // Die Tastatur muss weiter funktionieren — sie ist für manche der einzige
    // Weg durch die Seite. Sie schiebt nicht, also fängt ihr Übergang bei null
    // an; allein ein schon laufender wird mitgenommen.
    const onKey = (event: KeyboardEvent) => {
      const down = event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ';
      const up = event.key === 'ArrowUp' || event.key === 'PageUp';
      if (!down && !up) return;

      event.preventDefault();
      go(down ? 1 : -1, 0);
    };

    const onResize = () => {
      const { origin, stepPx } = measure();
      window.scrollTo(0, origin + target * stepPx);
      paint();
    };

    node.classList.add('is-live');

    // Da anfangen, wo die Seite gerade steht — ein Neuladen mitten im Verlauf
    // soll nicht nach oben springen.
    const start = measure();
    target = Math.min(start.last, Math.max(0, Math.round((window.scrollY - start.origin) / start.stepPx)));
    paint();

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      node.classList.remove('is-live');
    };
  }, []);

  const stageStyle = {
    '--states': plan.states - 1,
    '--step': `${STEP_VH}vh`,
    // Die beiden letzten Zustände als Zahl: das Stilblatt rechnet damit, statt
    // sie aus `--states` zurückzuschliessen — das ginge beim nächsten Zusatz schief.
    '--works': plan.works,
    '--contact': plan.contact,

    // Der Raum des ersten Bildes. Beide Zahlen stehen nur hier: das Stilblatt
    // rechnet damit, statt sie ein zweites Mal zu führen.
    '--persp': `${PERSPECTIVE}px`,
    '--cam-end': CAM_END
  } as CSSProperties;

  return (
    <div className="rc-home">
      <div className="rc-stage" ref={stage} style={stageStyle}>
        <div className="rc-pin">
          {/*
            EIN Raum. Alles darin ist ein Gegenstand mit einem z; bewegt wird
            die Kamera. Näher heisst grösser und früher vorbei, ferner heisst
            kleiner und länger da — das rechnet die Perspektive, nicht wir.
          */}
          <div className="rc-space">
            <div className="rc-cam">
              {halo.map((word) => (
                <span
                  key={word.tail}
                  className="rc-item rc-word"
                  aria-hidden="true"
                  style={{
                    '--x': `${word.x.toFixed(2)}vmin`,
                    '--y': `${word.y.toFixed(2)}vmin`,
                    '--z': word.z.toFixed(0),
                    '--alpha': word.alpha.toFixed(3),
                    '--size': `${word.size.toFixed(2)}rem`
                  } as CSSProperties}
                >
                  <b className="rc-word-re">RE</b>{word.tail}
                </span>
              ))}

              <div
                className="rc-item rc-logo"
                style={{ '--x': '0vmin', '--y': '0vmin', '--z': LOGO_Z } as CSSProperties}
              >
                <img src="/logo_inv.svg" alt={t.screen1.wordmark} />
              </div>

              {/*
                Die einzige Überschrift erster Ordnung der Seite. Sie steht
                etwas unter dem Zeichen und WEITER HINTEN — deshalb zieht das
                Zeichen zuerst vorbei und sie bleibt einen Augenblick allein.
              */}
              <h1
                className="rc-item rc-sentence"
                id="rc-h1"
                style={{
                  '--x': '0vmin',
                  '--y': `${SENTENCE_Y}vmin`,
                  '--z': SENTENCE_Z
                } as CSSProperties}
              >
                <PublicText value={t.screen1.sentence} copy={copy} as="span" />
              </h1>
            </div>

            {/* Der Hinweis gehört nicht in den Raum — er fliegt nicht mit. */}
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

        </div>
      </div>
    </div>
  );
}
