/**
 * Die Startseite — das Zeichen, drei Szenen, die vier Werke.
 *
 *    0   Das Zeichen.
 *    1   Der Mensch ist ein Ganzes.        (vier Blasen)
 *    2   Der Mensch braucht den Menschen.  (drei)
 *    3   Zurück zu den Quellen.            (drei)
 *    4   Die vier Werke.
 *    5   Kontakt.
 *
 * <b>Eine Szene ist EIN Zustand</b>, gleichgültig wie viele Blasen sie trägt.
 * Ihre Blasen hängen an einem Faden: sie sind ein Gedanke mit Teilen und nicht
 * ein Stapel von Gedanken. Jede einzeln anzufahren machte daraus eine Liste —
 * und aus dem Weg durch sechs Bilder einen durch dreizehn.
 *
 * Sie kommen deshalb gemeinsam, aber nicht im selben Augenblick: der Versatz
 * steckt IN dem einen Übergang (`--i` im Stilblatt). Am Rastpunkt steht die
 * ganze Szene da.
 *
 * Der Fahrplan rechnet sich weiterhin aus dem Text: eine Szene mehr, und alles
 * Weitere verschiebt sich von selbst.
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
 * Für diesen Augenblick <b>hält die Fahrt kurz inne</b>: die Kamerakurve im
 * Stilblatt hat drei Rampen, und die mittlere — langsame — liegt genau dort,
 * wo das Zeichen schon fort und der Satz noch nicht am Verblassen ist. Und der
 * Fluchtpunkt liegt beim Satz, nicht in der Bildmitte, damit dieser beim
 * Näherkommen stehen bleibt und nur wächst, statt aus dem Bild zu rutschen.
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
 * Trackpad schickt Dutzende Ereignisse), löst keinen zweiten Schritt aus.
 *
 * <b>Und eine Geste muss etwas kosten.</b> Gesammelt wird der Weg, nicht das
 * blosse Auftreten: erst STEP_PUSH gescrollte Pixel lösen aus. Der gesammelte
 * Weg verfällt über PUSH_FADE, aber nie ganz — sonst käme jemand, der langsam,
 * aber stetig schiebt, nie an, weil jede einzelne Rastung von vorn anfinge.
 *
 * Damit ist alles drei erledigt, was vorher nicht ging:
 *
 *   - Langsam scrollen fällt nicht zurück. Es gibt keine Feder mehr, die
 *     zurückzieht; stetiges Schieben sammelt sich, bis es reicht.
 *   - Schnell scrollen überspringt nichts. Eine Geste bleibt eine Geste, wie
 *     kräftig sie auch ist.
 *   - Nichts geschieht von selbst. Ein Zucken auf dem Trackpad bewegt die
 *     Seite nicht mehr um ein ganzes Bild.
 *
 * <b>Und nach einem Übergang ist nichts mehr übrig.</b> Während er läuft, wird
 * überhaupt nichts gesammelt: die Hand darf ihn lenken, aber nicht schon den
 * nächsten Schritt anzahlen. Am Ende sind auch die gemessene Geschwindigkeit
 * und der Rest des Weges bei null — wer weiterwill, schiebt von vorn an. Sonst
 * käme man in einem Zug durch mehrere Bilder, ohne je eines gesehen zu haben,
 * und das ist das Gegenteil dessen, wofür die Rastpunkte da sind.
 *
 * <b>Der Übergang fängt dort an, wo die Hand ist.</b> Er beginnt mit genau der
 * Geschwindigkeit, mit der gerade geschoben wird — eine einzige Bewegung, nicht
 * eine zweite, die daneben neu anfängt. Danach zieht ihn seine eigene Zeit auf
 * sein eigenes Mass: er läuft über GLIDE_MS aus und kommt von selbst zur Ruhe,
 * gleichgültig, was die Hand inzwischen tut.
 *
 * Solange die Hand weiterschiebt, folgt der Übergang ihr auch: jedes weitere
 * Ereignis derselben Geste zieht seine Geschwindigkeit an die der Hand heran —
 * ohne einen zweiten Schritt auszulösen und ohne den Zeitpunkt zu verschieben,
 * an dem er ankommt. Hört die Hand auf, hört auch das Ziehen auf, und die Kurve
 * bringt die Bewegung von selbst zu Ende. Das ist der Magnet: gezogen wird
 * immer auf das Mass des Übergangs, nie über dieses hinaus.
 *
 * Das leistet eine Hermite-Kurve: Anfangssteigung aus der Geste, Endsteigung
 * null. Eine gewöhnliche Ein-und-Ausblendkurve kann das nicht — sie fängt immer
 * bei null an, und genau deshalb las sich der Übergang als etwas Zweites, das
 * nach der Geste einsetzt, statt als deren Fortsetzung.
 *
 * Über der Steigung 3 schwänge die Kurve über das Ziel hinaus; dort wird ihre
 * Ableitung gerade noch nicht negativ. Deshalb ist genau dort gedeckelt: ein
 * sehr harter Wurf fährt schnell an, aber die Seite läuft nie zurück. Die
 * Kurve selbst steht in rcGlide — dort hängt eine Prüfreihe an ihr, denn ein
 * Überschwingen zeigt sich nirgends als Fehler, sondern nur als ein schlechtes
 * Gefühl beim Scrollen.
 *
 * Die Tastatur ist eigens bedient, damit die Seite ohne Zeigegerät begehbar
 * bleibt — sie sammelt nichts, ein Tastendruck ist ein Schritt.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { PublicCopy, SceneBubble } from '../content';
import { PublicText } from '../PublicText';
import { rcGlide, rcGlideSlope, rcGlideLead } from '../../rc/lib/rcGlide';
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

/**
 * Wie weit geschoben werden muss, ehe ein Schritt fällt.
 *
 * Vorher genügte das blosse Auftreten einer Geste, wie klein sie auch war —
 * eine Rastung, ein Zucken auf dem Trackpad, und die Seite war einen Zustand
 * weiter. Dreizehn Zustände flogen so vorbei, ohne dass jemand etwas dafür tun
 * musste; es fehlte das Gewicht.
 *
 * Jetzt wird der Weg innerhalb einer Geste gesammelt. Erst dieses Mass löst
 * aus, und danach fängt die Sammlung bei null an — kein Rest, der in den
 * nächsten Schritt hineinträgt.
 */
const STEP_PUSH = 180;

/** In dieser Zeit ohne Schub verfällt der gesammelte Weg. */
const PUSH_FADE = 900;

/**
 * Wie viel ein einzelnes Ereignis dem Verfall mindestens abringt.
 *
 * Ohne diese Schranke gibt es eine tote Zone: schiebt jemand langsamer, als
 * der Weg verfällt, fängt jede Rastung wieder bei null an und die Seite rührt
 * sich NIE. Eine Seite, die auf gemächliches Scrollen gar nicht reagiert, ist
 * für den Besucher kaputt, nicht ruhig.
 *
 * Mit der Schranke läuft die Sammlung gegen das Dreifache einer einzelnen
 * Rastung, ganz gleich wie langsam geschoben wird. Alles ab etwa 54 Pixeln je
 * Rastung kommt damit an — der eine nach zwei, der andere nach vier. Kleinere
 * Schritte meldet nur ein hochauflösendes Rad, und das meldet sie im Strom,
 * wo ohnehin nichts verfällt.
 */
const PUSH_KEEP = 0.7;

/** Wie lange ein Übergang dauert. Seine eigene Zeit, nicht die der Geste. */
const GLIDE_MS = 700;

/** Wie lange der erste dauert — der durch den Raum, mit dem Innehalten darin. */
const OPENING_MS = 1300;

/** So weit muss ein Finger wandern, ehe es als Geste zählt. */
const TOUCH_MIN = 26;

/**
 * Wie lange eine Rastung des Mausrades dauert.
 *
 * Ein Rad meldet eine Strecke, keine Geschwindigkeit: deltaY sagt, wie weit
 * gescrollt werden soll, nicht wie schnell. Erst diese Zeit macht daraus ein
 * Mass — es ist ungefähr die Spanne, die ein Browser sich für eine Rastung
 * nimmt. Mit einem Vollbild gerechnet käme jede Rastung an den Anschlag, und
 * jeder Übergang führe gleich hart an.
 */
const NOTCH_MS = 110;

/** Wie stark ein Ereignis den laufenden Übergang an die Hand heranzieht. */
const PULL = 0.4;

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
 * Wie viele Wörter im Raum stehen.
 *
 * Die fünf sind die Sache; diese Zahl ist die Wirkung. Fünf Wörter waren fünf
 * Beschriftungen, die um das Zeichen herum lagen — man las sie ab. Sechsunddreissig
 * sind eine Wolke, in der man steht: dasselbe Wort taucht in verschiedener
 * Tiefe, Grösse und Helligkeit mehrfach auf, und keines davon liest man einzeln.
 *
 * Ein Vielfaches der fünf, damit keines häufiger vorkommt als ein anderes.
 */
const WORD_COUNT = 35;

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

/*
 * Zeichen und Satz stehen auseinander, nicht ineinander.
 *
 * <b>Der Satz liegt AUF dem Fluchtpunkt</b> (im Stilblatt: 56% der Hoehe, also
 * 6 unter der Mitte). Das ist kein Zufallswert, sondern die Bedingung dafuer,
 * dass er beim Naeherkommen stehen bleibt und nur waechst: alles andere dehnt
 * sich vom Fluchtpunkt weg, er allein nicht. Lag er daneben, so rutschte er
 * genau dann aus dem Bild, wenn er gross und allein sein soll.
 *
 * Das Zeichen darf daneben liegen — es SOLL vorbeiziehen. Bei z = -320 kommen
 * von seinen 10 gut drei Viertel auf dem Bild an; es steht also rund 12 Prozent
 * der Hoehe ueber dem Satz und zieht nach oben davon.
 */
const LOGO_Y = -10;
const SENTENCE_Y = 6;

/** Die Tiefe der Woerter: von ganz hinten bis dicht vor die Kamera. */
const WORD_FAR = -1650;
const WORD_NEAR = -150;

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

  // Nah heisst gross und schnell vorbei, fern heisst klein und lange da.
  const z = WORD_FAR + roll() * (WORD_NEAR - WORD_FAR);

  /*
   * Der Abstand zur Mitte wird um die Tiefe VORGERECHNET.
   *
   * Ein fernes Wort verkleinert die Perspektive; derselbe Abstand kam bei ihm
   * also viel naeher an der Mitte an als bei einem nahen. Genau daher kam der
   * Eindruck, die Woerter draengten sich um das Zeichen: sie standen zwar
   * gestreut im Raum, aber nicht auf dem Bild. Mit diesem Faktor streuen sie
   * auf dem Bild gleich weit — und die aeusseren duerfen ueber den Rand
   * hinausragen.
   */
  const shrink = (PERSPECTIVE - z) / PERSPECTIVE;
  const radius = (30 + roll() * 46) * shrink;

  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius * 0.78,
    z,
    size: 1.5 + roll() * 1.5,
    /*
     * Nur noch die Handschrift des einzelnen Wortes; was die Tiefe an
     * Durchsichtigkeit ausmacht, rechnet das Stilblatt aus `--ze`.
     *
     * Blasser als zuvor, weil es jetzt fünfunddreissig sind: bei der alten
     * Sättigung wäre das keine Wolke, sondern eine Wand, und das Zeichen
     * stünde in einem Gedränge statt in einem Raum.
     */
    alpha: 0.35 + roll() * 0.45
  };
}

/**
 * Die vier Werke kommen NICHT als Block, sondern jedes in sein Viertel.
 *
 *   links oben  →  links unten  →  rechts oben  →  rechts unten
 *
 * `from` ist die Seite, von der es hereinfährt (-1 links, +1 rechts), `lead`
 * der Vorlauf vor dem Zustand der Werke. Der Versatz von 0.15 zwischen ihnen
 * ist klein genug, dass es eine Bewegung bleibt, und gross genug, dass man vier
 * Dinge nacheinander sieht statt eines Blocks, der aufblendet.
 *
 * <b>Kein Vorlauf ist grösser als 1.</b> Das ist die Bedingung dafür, dass am
 * vorigen Rastpunkt wirklich Ruhe ist: bei 1.15 fing das erste Viertel schon
 * an hereinzufahren, während die letzte Szene noch stand, und lag dort mit
 * einem Viertel Deckkraft über ihr. Dieselbe Sache, die die Szenen selbst
 * halb übereinander stehen liess.
 */
const QUARTERS = [
  { from: -1, lead: 0.85 },
  { from: -1, lead: 0.70 },
  { from: 1, lead: 0.55 },
  { from: 1, lead: 0.40 }
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
    /*
     * EINE Szene ist EIN Zustand — nicht eine je Blase.
     *
     * Die Blasen einer Szene hängen an einem Faden; sie sind ein Gedanke mit
     * Teilen, kein Stapel von Gedanken. Jede einzeln anzufahren machte aus
     * einem Zusammenhang eine Liste, und aus einem Bildlauf durch vier Bilder
     * einen durch dreizehn. Sie kommen jetzt gemeinsam, nur nicht im selben
     * Augenblick: der Versatz steckt IN dem einen Übergang.
     */
    const starts = t.scenes.map((_, index) => index + 1);

    const works = t.scenes.length + 1;
    const contact = works + 1;

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
    () => Array.from({ length: WORD_COUNT }, (_, index) => ({
      tail: WORDS[index % WORDS.length],
      ...placeWord(index, Math.random)
    })),
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

    /** Der Zeitstempel des letzten Ereignisses. */
    let lastEvent = 0;

    /** Die Hand: wo der Finger zuletzt war, wann, und wie schnell (px/ms). */
    let touchAt = 0;
    let touchTime = 0;
    let speed = 0;

    /** Der gesammelte Weg, seit zuletzt ein Schritt fiel. */
    let push = 0;

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

    const tick = () => {
      frame = 0;
      if (!gliding) return;

      const k = span <= 0 ? 1 : Math.min(1, (performance.now() - startedAt) / span);
      window.scrollTo(0, fromY + (toY - fromY) * rcGlide(k, lead));
      paint();

      if (k < 1) { frame = requestAnimationFrame(tick); return; }

      /*
       * Angekommen — und damit ist wirklich nichts mehr übrig.
       *
       * Weder die gemessene Geschwindigkeit noch der gesammelte Weg tragen in
       * den nächsten Zustand hinein. Wer weiterwill, schiebt von vorn an. Sonst
       * käme man in einem Zug durch mehrere Bilder, ohne je eines gesehen zu
       * haben — das Gegenteil dessen, wofür die Rastpunkte da sind.
       */
      gliding = false;
      speed = 0;
      push = 0;
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
        ? (rcGlideSlope(Math.min(1, (now - startedAt) / span), lead) * (toY - fromY)) / span
        : 0;

      /*
       * Der erste Übergang dauert länger als die anderen.
       *
       * Er ist auch mehr: die übrigen wechseln eine Szene, dieser durchfliegt
       * einen ganzen Raum — an den Wörtern vorbei, am Zeichen vorbei, bis der
       * Satz allein steht. Und das Innehalten unterwegs, das die Kamerakurve im
       * Stilblatt vorsieht, braucht Zeit, um überhaupt als Innehalten
       * anzukommen: bei GLIDE_MS wären es keine 200 Millisekunden.
       */
      const opening = next === 0 || target === 0;

      target = next;

      fromY = window.scrollY;
      toY = origin + target * stepPx;

      // Wer während eines Übergangs weiterschiebt, soll nicht warten müssen:
      // der nächste läuft etwas straffer.
      span = reduce.matches
        ? 0
        : opening ? OPENING_MS : (gliding ? GLIDE_MS * 0.72 : GLIDE_MS);
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
      lead = rcGlideLead(v, span, reach);

      if (frame === 0) frame = requestAnimationFrame(tick);
    };

    /**
     * Den laufenden Übergang an die Hand heranziehen — ohne einen Schritt.
     *
     * Die verbleibende Zeit bleibt dabei stehen: der Übergang kommt an, wann er
     * ohnehin angekommen wäre. Gezogen wird allein an seiner Geschwindigkeit,
     * und zwar von der jetzigen aus, damit es keinen Sprung gibt. Hört die Hand
     * auf, hört auch das Ziehen auf, und die Kurve läuft von selbst aus.
     */
    const steer = (hand: number) => {
      if (!gliding || span <= 0) return;

      const now = performance.now();
      const k = Math.min(1, (now - startedAt) / span);
      const left = span * (1 - k);

      // Kurz vor dem Ziel nicht mehr rühren: dort wird jede Änderung der
      // Steigung zu einem sichtbaren Ruck.
      if (left < 80) return;

      const y = fromY + (toY - fromY) * rcGlide(k, lead);
      const reach = toY - y;
      if (reach === 0) return;

      const here = (rcGlideSlope(k, lead) * (toY - fromY)) / span;
      const want = reach > 0 ? Math.max(hand, 0) : Math.min(hand, 0);
      const v = here + (want - here) * PULL;

      fromY = y;
      startedAt = now;
      span = left;
      lead = rcGlideLead(v, left, reach);
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
    const gesture = (px: number, dt: number) => {
      const now = performance.now();
      const idle = now - lastEvent;
      const fresh = idle > GESTURE_GAP;
      lastEvent = now;

      const v = px / Math.max(4, dt);
      speed = fresh ? v : speed * 0.55 + v * 0.45;

      /*
       * Während eines Übergangs wird NICHTS gesammelt.
       *
       * Die Seite spricht gerade. Die Hand darf den Übergang lenken, aber
       * nicht schon den nächsten Schritt anzahlen — sonst trüge ein einziger
       * langer Wisch durch mehrere Bilder, ohne dass eines zu sehen gewesen
       * wäre. Das ist die ganze Regel, die vorher REPEAT_MS und ein Merkzeichen
       * gebraucht hätte.
       */
      if (gliding) { steer(speed); return; }

      /*
       * Der gesammelte Weg VERFÄLLT mit der Zeit, statt an einer Gestengrenze
       * ganz wegzufallen — und nie um mehr als PUSH_KEEP.
       *
       * Fiele er ganz weg, käme jemand, der langsam, aber stetig schiebt, nie
       * an: jede einzelne Rastung finge wieder bei null an und bliebe für
       * immer unter dem Mass.
       */
      push *= Math.max(PUSH_KEEP, 1 - idle / PUSH_FADE);

      // Wer umkehrt, meint etwas anderes.
      if (px * push < 0) push = 0;
      push += px;

      if (Math.abs(push) < STEP_PUSH) return;

      const dir = push > 0 ? 1 : -1;
      push = 0;
      go(dir, speed);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.deltaY === 0) return;

      /*
       * deltaMode: 0 Pixel, 1 Zeilen, 2 Seiten.
       *
       * Ohne Umrechnung führe ein zeilenweise meldendes Rad den Übergang um ein
       * Vielfaches zu langsam an — und käme, seit ein Mass gesammelt werden
       * muss, überhaupt nicht mehr an: 40 statt 16 je Zeile, weil eine Rastung
       * dort drei Zeilen meldet und erst so wieder ungefähr die 120 Pixel
       * ergibt, die dieselbe Rastung anderswo meldet.
       */
      const unit = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? window.innerHeight : 1;

      const gap = performance.now() - lastEvent;
      gesture(event.deltaY * unit, gap > GESTURE_GAP ? NOTCH_MS : gap);
    };

    const onTouchStart = (event: TouchEvent) => {
      touchAt = event.touches[0]?.clientY ?? 0;
      touchTime = performance.now();
      lastEvent = 0;
      speed = 0;
      push = 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      event.preventDefault();
      const y = event.touches[0]?.clientY ?? 0;
      const dy = touchAt - y;
      if (Math.abs(dy) < TOUCH_MIN) return;

      // Der Finger ist das einzige Zeigegerät, das wirklich eine
      // Geschwindigkeit hergibt: Weg und Zeit sind beide gemessen.
      const now = performance.now();
      gesture(dy, now - touchTime);
      touchAt = y;
      touchTime = now;
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
              {halo.map((word, index) => (
                <span
                  key={index}
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
                style={{ '--x': '0vmin', '--y': `${LOGO_Y}vmin`, '--z': LOGO_Z } as CSSProperties}
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
                  // Lebensdauer in Zuständen. Eine Szene ist ein Zustand, also
                  // einer: sie kommt im Übergang davor an und geht im Übergang
                  // danach. Gerastet wird genau in ihrer Mitte.
                  '--life': 1
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
