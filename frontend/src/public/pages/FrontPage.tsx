/**
 * Die Startseite — das Zeichen, drei Szenen, die vier Werke.
 *
 *    0        Das Zeichen.                     ← Rastpunkt
 *    1 … 4    Der Mensch ist ein Ganzes.       ← Rastpunkt bei 1, dann frei
 *    5 … 7    Der Mensch braucht den Menschen. ← Rastpunkt bei 5, dann frei
 *    8 … 10   Zurück zu den Quellen.           ← Rastpunkt bei 8, dann frei
 *   11        Die vier Werke.                  ← Rastpunkt
 *   12        Kontakt.                         ← Rastpunkt
 *
 * <b>Eine Szene ist eine STRECKE, kein Punkt.</b> Jede Blase hat ihre Stelle
 * auf der Achse, aber gerastet wird nur an den sechs Stellen oben. Dazwischen
 * läuft der Bildlauf frei, und die Betonung wandert mit — von Blase zu Blase,
 * ohne Halten und Anfahren.
 *
 * Das ist der Unterschied zwischen einer Liste und einem Gedanken mit Teilen.
 * Die Blasen einer Szene hängen an einem Faden; jede einzeln anzurasten machte
 * aus dem Zusammenhang eine Aufzählung.
 *
 * <b>Und die Szene geht der Betonung nach.</b> Die betonte Blase wird in die
 * Mitte gefahren (`--panx`/`--pany`, gerechnet in `pan()`), damit sie ganz im
 * Bild steht und lesbar ist. Auf schmalen Schirmen ist das keine Verzierung,
 * sondern die einzige Art, an die äussere Blase des Rings heranzukommen.
 *
 * Der Fahrplan rechnet sich weiterhin aus dem Text: eine Szene mehr oder eine
 * Blase mehr, und alles Weitere verschiebt sich von selbst.
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
 * Es gibt <b>zwei Bewegungen</b>, und sie fühlen sich mit Absicht verschieden
 * an:
 *
 *   - INNERHALB einer Szene läuft es frei. Der Weg der Hand wird zur Strecke,
 *     ein kurzer Nachlauf glättet das Rad, und man kann überall stehenbleiben.
 *     Nichts rastet ein — die Betonung wandert einfach.
 *   - ZWISCHEN zwei Gruppen wird gesprungen. Das ist der Übergang, den der Rest
 *     dieses Textes beschreibt.
 *
 * <b>Finger und Rad werden dabei verschieden behandelt</b>, und zwar weil sie
 * verschieden sind: ein Finger hat eine Bildschirmhöhe Weg, ein Rad hat
 * unendlich viel. Bei gleichem Mass kostete jede Blase auf dem Telefon einen
 * halben Schirm Wischweg — dort wirkte es zäh, am Schreibtisch nicht. Der
 * Finger zählt deshalb mit TOUCH_GAIN, und sein Nachlauf ist viel kürzer: was
 * beim Rad Sprünge glättet, ist bei ihm nur Verzug.
 *
 * Für den Sprung gilt eine einzige Regel — <b>eine Geste bewegt um eine
 * Gruppe.</b> Die Zeitstempel sagen, was eine Geste ist: nach einer Ruhe von
 * GESTURE_GAP beginnt eine neue; alles, was innerhalb einer Geste noch
 * eintrifft (ein Trackpad schickt Dutzende Ereignisse), löst keinen zweiten
 * Sprung aus.
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

/**
 * Bereiche, die ihren eigenen Bildlauf behalten dürfen.
 *
 * Der Rest der Seite fährt in Zuständen; diese beiden müssen in sich rollen
 * können, sonst ist ein Teil ihres Inhalts unerreichbar: das aufgeklappte Menü
 * auf dem Telefon und die Anschrift im letzten Bild, wenn sie auf einem hohen,
 * schmalen Schirm länger ist als ihr Platz.
 */
const FREE_SCROLL = '.pub-nav, .rc-contact-in';

const WORK_PAGES: readonly PublicPage[] = ['osrodek', 'wydarzenia', 'cogita', 'biblioteka'];

/**
 * Bildlaufweg je Übergang — und damit die Höhe der Bühne.
 *
 * Seit der Bildlauf abgefangen wird, ist das kein Kraftaufwand mehr für den
 * Besucher, sondern nur noch die Strecke, die ein Übergang zurücklegt.
 */
const STEP_VH = 60;

/**
 * Ein zweites Mass für den Schritt, das an der BREITE hängt — und ein Deckel.
 *
 * <b>Der Bildlaufweg darf im Querformat nicht zusammenbrechen.</b> Ein Telefon
 * quer ist nur rund 340 Pixel hoch; sechzig Prozent davon sind 200 Pixel je
 * Blase, gegen 474 im Hochformat. Derselbe Wisch kam damit quer mehr als
 * doppelt so weit — die Seite raste im einen Format und ging im anderen
 * gemächlich, obwohl es dasselbe Gerät und dieselbe Hand ist.
 *
 * Der Deckel sorgt dafür, dass dieses zweite Mass NUR auf kurzen Schirmen
 * greift: auf jedem Schreibtisch gewinnt die Höhe ohnehin, und dort bleibt
 * alles genau, wie es war.
 */
const STEP_VW = 34;
const STEP_WIDE = 900;

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

/** Wie lange ein Übergang zwischen zwei Gruppen dauert. Seine eigene Zeit. */
const GLIDE_MS = 700;

/**
 * Der Nachlauf beim freien Laufen INNERHALB einer Szene.
 *
 * Kurz genug, dass die Seite der Hand folgt, und lang genug, dass ein Mausrad
 * nicht ruckt: es meldet in Sprüngen von hundert Pixeln, und ohne diesen
 * Nachlauf sähe man jeden davon einzeln.
 */
const FREE_MS = 220;

/**
 * Derselbe Nachlauf für den Finger — viel kürzer.
 *
 * Er ist beim Rad dazu da, aus Sprüngen von hundert Pixeln eine Bewegung zu
 * machen. Der Finger hat dieses Problem nicht: er meldet ohnehin dicht und
 * stetig, und was ihm hier zugefügt wird, ist nur Verzug. Ein Finger erwartet,
 * dass der Inhalt an ihm klebt.
 */
const FREE_TOUCH_MS = 90;

/**
 * Wie stark der Weg des Fingers zählt.
 *
 * <b>Ein Finger hat nur eine Bildschirmhöhe Weg, ein Rad hat unendlich viel.</b>
 * Bei gleichem Mass muss auf dem Telefon jede Blase mit einem halben Schirm
 * Wischweg bezahlt werden, und das ist der Grund, warum es dort zäh wirkt und
 * am Schreibtisch nicht.
 *
 * Dazu kommt das Verweilen der Gangkurve: bei einer Blase läuft sie mit einem
 * Viertel der Geschwindigkeit, und genau dort wirkt ein Finger, der zieht,
 * ohne dass sich etwas rührt, festgefahren. Mit diesem Faktor bleibt es im
 * Mittel knapp beim Weg des Fingers.
 */
const TOUCH_GAIN = 2.1;

/**
 * Der Auslauf — und warum er an einer Blase schneller stirbt als dazwischen.
 *
 * Wer die Hand hebt, während es noch läuft, soll nicht auf der Stelle stehen:
 * die Bewegung rollt aus. <b>Wie schnell sie ausrollt, hängt aber davon ab, wo
 * sie gerade ist.</b> An einer Blase ist die Halbwertszeit kurz — die Bewegung
 * versickert dort binnen eines Augenblicks. Zwischen zwei Blasen ist sie
 * mehrfach länger, und der Rest der Bewegung trägt hinüber.
 *
 * Zusammen ist das ein Gefälle: der Auslauf sucht sich eine Blase. Er wird
 * nicht dorthin gezogen und nicht eingerastet — man kann überall stehenbleiben,
 * wenn man will. Aber wer loslässt, kommt meistens an einer Blase zur Ruhe, und
 * genau das war gewünscht.
 *
 * Die Zahlen sind gerechnet, nicht geraten: ein zügiger Wisch trägt rund eine
 * Blase weit, ein sanfter aus der Mitte gerade bis zur nächsten, und ein
 * Loslassen AN einer Blase bewegt so gut wie nichts mehr.
 */
const COAST_STICK = 35;
const COAST_SLIDE = 150;

/** Darunter lohnt der Auslauf nicht mehr — Achseneinheiten je Millisekunde. */
const COAST_MIN = 0.0004;

/**
 * So frisch muss die letzte Bewegung sein, damit überhaupt ausgerollt wird.
 *
 * Sonst rollte auch aus, wer die Hand eine Sekunde stillhält und dann hebt: die
 * gemessene Geschwindigkeit ist dann alt und meint nichts mehr.
 */
const COAST_HAND = 300;

/**
 * Wie stark der Gang von Blase zu Blase bei jeder verweilt.
 *
 * 0 wäre gleichmässig — jede Blase nur ein Durchgangspunkt. 1 wäre eine
 * Glättung, die bei jeder Blase auf null Geschwindigkeit geht: der Bildlauf
 * bliebe dort stehen, obwohl die Hand weiterschiebt, und das läse sich als
 * Haken. Dazwischen liegt das Gemeinte — die Bewegung wird bei einer Blase
 * bei einer Blase rund achtzehnmal langsamer als auf halbem Weg und bleibt
 * doch in Fahrt.
 */
const WALK_HOLD = 0.9;

/** Wie lange der erste dauert — der durch den Raum, mit dem Innehalten darin. */
const OPENING_MS = 1700;

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
/** Die Mitte des Rings. Von ihr weg weichen die unbetonten Blasen aus. */
function ringCentre(portrait: boolean): Point {
  return portrait ? [50, 50] : [52, 52];
}

/**
 * Wie weit eine unbetonte Blase nach aussen weicht, in Prozent der Bühne.
 *
 * <b>Damit sich zwei Blasen nicht durcheinander schieben.</b> Wandert die
 * Betonung von einer zur nächsten, wächst die eine, während die andere
 * schrumpft — standen sie dicht beieinander, schob sich dabei die eine durch
 * die andere hindurch. Jetzt weicht jede Blase, die nicht dran ist, ein Stück
 * radial nach aussen: die beiden gehen auseinander, statt sich zu kreuzen.
 *
 * Klein genug, dass der Faden weiterhin sichtbar in der Blase endet — er
 * verbindet die festen Ringpunkte und wandert nicht mit.
 */
const BUBBLE_YIELD = 5;

function ringPoints(count: number, scene: number, portrait: boolean): readonly Point[] {
  const [cx, cy] = ringCentre(portrait);
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
 * Anfang aller und der Grund, warum die Einrichtung so heisst; deshalb trägt es
 * die Betonung und der Rest folgt klein.
 *
 * Hier steht nur der Rest nach dem RE. Ein Wort mehr ist ein Eintrag mehr —
 * Richtung, Abstand, Tiefe, Deckkraft und Grösse kommen aus dem Index.
 *
 * Grundlage je Wort: Richtung vom Zeichen aus, Abstand, TIEFE, Deckkraft,
 * Grösse. Die Tiefe ist der eigentliche Trick — sie bestimmt, wie schnell ein
 * Wort nach aussen läuft. Verschiedene Tiefen ergeben verschiedene
 * Geschwindigkeiten, und daraus entsteht der räumliche Eindruck.
 */
const WORDS = [
  'colligere',    // REcolligere    — wieder sammeln
  'novatio',      // REnovatio      — Erneuerung
  'conciliatio',  // REconciliatio  — Versöhnung
  'fectio',       // REfectio       — Stärkung, Erquickung
  'dintegratio',  // REdintegratio  — Wiederherstellung des Ganzen
  'ditus',        // REditus        — Rückkehr
  'cognitio',     // REcognitio     — Wiedererkennen
  'stitutio',     // REstitutio     — Wiedergutmachung
  'generatio',    // REgeneratio    — Wiedergeburt
  'paratio',      // REparatio      — Ausbesserung
  'latio',        // RElatio        — Beziehung
  'quies',        // REquies        — Ruhe
  'surrectio'     // REsurrectio    — Auferstehung
] as const;

/**
 * Wie viele Wörter im Raum stehen.
 *
 * Die Wörter sind die Sache; diese Zahl ist die Wirkung. Wenige wären wenige
 * Beschriftungen, die um das Zeichen herum liegen — man liest sie ab. Erst
 * viele sind eine Wolke, in der man steht: dasselbe Wort taucht in
 * verschiedener Tiefe, Grösse und Helligkeit mehrfach auf, und keines davon
 * liest man einzeln.
 *
 * <b>Ein Vielfaches der Wortzahl</b>, damit keines häufiger vorkommt als ein
 * anderes — bei dreizehn Wörtern also dreimal jedes.
 */
const WORD_COUNT = 39;

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
const LOGO_Y = -13;
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

  /** Wie weit draussen das Wort steht: 0 dicht am Zeichen, 1 ganz am Rand. */
  const out = roll();
  const radius = (30 + out * 46) * shrink;

  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius * 0.78,
    z,
    /*
     * AUSSEN IST GROSS.
     *
     * Vorher war die Grösse rein zufällig, und die Wolke bekam dadurch etwas
     * Gleichförmiges: überall dieselbe Streuung, nichts, dem das Auge folgt.
     * Mit der Kopplung an den Abstand hat sie eine Ordnung — die Mitte gehört
     * dem Zeichen, und nach aussen hin werden die Wörter gross, so wie es die
     * Nähe zum Betrachter am Rand eines weiten Raumes tut.
     *
     * Der Zufallsanteil bleibt, sonst wäre es ein Muster statt einer Wolke.
     */
    size: 1.5 + out * 3.4 + roll() * 1.3,
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
  index, at, yield: away, bubble, copy
}: {
  index: number;
  at: Point;
  yield: Point;
  bubble: SceneBubble;
  copy: PublicCopy;
}) {
  const style = {
    '--i': index,
    '--x': `${at[0]}%`,
    '--y': `${at[1]}%`,
    // Die Richtung, in die sie ausweicht, wenn sie nicht dran ist.
    '--ox': `${away[0].toFixed(2)}%`,
    '--oy': `${away[1].toFixed(2)}%`
  } as CSSProperties;

  return (
    <div className="rc-bubble" data-kind={bubble.kind} style={style}>
      {bubble.kind === 'title' && (
        <h2 className="rc-bub-title">{bubble.lines[0]}</h2>
      )}

      {bubble.kind === 'body' && bubble.lines.map((line) => (
        <p className="rc-bub-body" key={line.slice(0, 32)}>{line}</p>
      ))}

      {/*
        Der Schlüssel ist die Stelle, nicht die Zeile: eine Leerzeile trennt
        Gedankengruppen, und zwei davon wären als Schlüssel dasselbe.
      */}
      {bubble.kind === 'close' && (
        <p className="rc-bub-close">
          {bubble.lines.map((line, at) => <span key={at}>{line}</span>)}
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
     * EINE SZENE IST EINE STRECKE, KEIN PUNKT.
     *
     * Auf der Achse `--s` bekommt jede Blase ihre eigene Stelle — die vierte
     * Szenenblase liegt bei c+3. Gerastet wird darauf aber NICHT: Rastpunkte
     * sind allein die Szenenanfänge, das Zeichen, die Werke und der Kontakt.
     *
     * Dazwischen läuft der Bildlauf frei. Die Blasen einer Szene hängen an
     * einem Faden; sie sind ein Gedanke mit Teilen. Jede einzeln anzufahren
     * machte daraus eine Liste aus Halten und Anfahren — dieselbe Strecke frei
     * zu durchlaufen macht daraus eine Bewegung, in der die Betonung wandert.
     *
     * `zones` sagt beides in einem: wo gerastet wird (`at`) und wie weit man
     * von dort aus frei kommt (`to`). Ein Punkt ohne Strecke ist `at === to`
     * und verhält sich genau wie vorher.
     */
    const starts: number[] = [];
    const zones: { at: number; to: number }[] = [{ at: 0, to: 0 }];

    let at = 1;
    for (const scene of t.scenes) {
      starts.push(at);
      zones.push({ at, to: at + scene.bubbles.length - 1 });
      at += scene.bubbles.length;
    }

    const works = at;
    const contact = at + 1;
    zones.push({ at: works, to: works }, { at: contact, to: contact });

    return {
      starts,
      zones,
      works,
      contact,
      states: contact + 1
    };
  }, [t.scenes]);

  // Die Physik liest den Fahrplan, ohne dass ihr Effekt neu aufgesetzt wird.
  const planRef = useRef(plan);
  planRef.current = plan;

  /*
   * Die Ringpunkte einmal für beide: die Blasen werden danach gesetzt, und der
   * Bildlauf rechnet daraus, wie weit die Szene geschoben werden muss, damit
   * die betonte Blase in der Mitte steht.
   */
  const rings = useMemo(
    () => t.scenes.map((scene, index) => ringPoints(scene.bubbles.length, index, portrait)),
    [t.scenes, portrait]
  );

  const ringsRef = useRef(rings);
  ringsRef.current = rings;

  /*
   * Die Ausweichrichtung je Blase: vom Mittelpunkt des Rings weg.
   *
   * Einmal gerechnet und nicht bei jedem Bild — es hängt nur am Ring und am
   * Format, nicht am Bildlauf.
   */
  const yields = useMemo(() => {
    const [cx, cy] = ringCentre(portrait);

    return rings.map((points) => points.map((point) => {
      const dx = point[0] - cx;
      const dy = point[1] - cy;
      const len = Math.hypot(dx, dy) || 1;
      return [(dx / len) * BUBBLE_YIELD, (dy / len) * BUBBLE_YIELD] as Point;
    }));
  }, [rings, portrait]);

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

    /** Laeuft gerade ein Uebergang zwischen Gruppen (im Gegensatz zum freien Lauf)? */
    let snapping = false;

    /** Der Auslauf nach der Geste: Geschwindigkeit in Achseneinheiten je ms. */
    let coasting = false;
    let vel = 0;
    let coastAt = 0;

    /** Der Zeitstempel des letzten Ereignisses. */
    let lastEvent = 0;

    /** Die Hand: wo der Finger zuletzt war, wann, und wie schnell (px/ms). */
    let touchAt = 0;
    let touchTime = 0;
    let speed = 0;

    /** Der gesammelte Weg, seit zuletzt ein Schritt fiel. */
    let push = 0;

    /*
     * Die Masse der Bühne — in Pixeln, und nur hier gerechnet.
     *
     * <b>Das Stilblatt darf sie nicht ein zweites Mal ausrechnen.</b> Vorher
     * stand in der CSS `100vh` und hier `window.innerHeight`, und auf dem
     * Telefon sind das zwei verschiedene Zahlen: `vh` meint dort die grosse
     * Ansicht (Adressleiste eingefahren), `innerHeight` die gerade sichtbare.
     * Der Weg der Bühne und der Weg, den dieser Code fährt, gingen damit
     * auseinander, und die Rastpunkte lagen daneben — genau das, was auf dem
     * Schreibtisch nie auffällt.
     *
     * Auch die Kopfleiste wird gemessen statt geglaubt. `--head-h` ist eine
     * feste Zahl für den Schreibtisch; unter 900 Pixeln bricht die Leiste um
     * und ist in Wirklichkeit mal niedriger, mal (bei offenem Menü) deutlich
     * höher. Der angeheftete Teil klebte dann an der falschen Stelle.
     */
    let headH = 0;
    let pinH = 0;
    let stepPx = 0;

    const layout = () => {
      const head = document.querySelector('.pub-head');
      headH = head === null ? 0 : Math.round(head.getBoundingClientRect().height);
      pinH = Math.max(320, window.innerHeight - headH);

      // Die Höhe gibt das Mass — ausser sie ist zu klein dafür, dann die
      // Breite. Siehe STEP_VW: sonst rast das Telefon im Querformat.
      stepPx = Math.round(Math.max(
        (pinH * STEP_VH) / 100,
        (Math.min(window.innerWidth, STEP_WIDE) * STEP_VW) / 100
      ));

      node.style.setProperty('--head-h', `${headH}px`);
      node.style.setProperty('--pin-h', `${pinH}px`);
      node.style.setProperty('--step', `${stepPx}px`);
    };

    const measure = () => ({
      origin: window.scrollY + node.getBoundingClientRect().top - headH,
      stepPx,
      last: planRef.current.states - 1
    });

    const paint = () => {
      const { origin, stepPx, last } = measure();
      if (stepPx <= 0 || last <= 0) { node.style.setProperty('--p', '0'); return; }

      const here = (window.scrollY - origin) / stepPx;
      node.style.setProperty('--p', Math.min(1, Math.max(0, here / last)).toFixed(5));

      /*
       * Der Gang von Blase zu Blase folgt einer eigenen Kurve.
       *
       * Gleichmässig gelesen wäre jede Blase nur ein Durchgangspunkt. Mit
       * WALK_HOLD verweilt die Bewegung bei jeder und läuft dazwischen rasch
       * hinüber — das Verweilen IST der Augenblick, in dem eine Blase dran
       * ist, und dazwischen soll man nicht lesen, sondern ankommen.
       *
       * Betonung und Verschiebung hängen beide daran, sonst liefen sie
       * auseinander.
       */
      const base = Math.floor(here);
      const t = here - base;
      const smooth = t * t * t * (t * (t * 6 - 15) + 10);
      const walk = base + t + WALK_HOLD * (smooth - t);

      /*
       * Wie weit die Bewegung zwischen zwei Blasen steht: 0 bei einer, 1 in
       * der Mitte dazwischen. Nur INNERHALB einer Szene — der Wechsel von
       * einer Gruppe zur nächsten blendet ohnehin über.
       */
      const zone = zoneOf(here);
      const between = zone.to > zone.at && here > zone.at && here < zone.to
        ? 1 - Math.abs(2 * t - 1)
        : 0;

      node.style.setProperty('--sw', walk.toFixed(4));
      node.style.setProperty('--travel', between.toFixed(3));
      pan(walk);
    };

    /**
     * Die Szene so verschieben, dass die betonte Blase in der Mitte steht.
     *
     * <b>Das ist eine Zusage, keine Verzierung.</b> Die Blasen liegen auf einem
     * Ring; auf einem schmalen Schirm ragt die äussere über den Rand, und wer
     * nur sie lesen will, kann es nicht. Verschoben wird deshalb die GANZE
     * Szene — mitsamt Faden und Nachbarn —, nicht die einzelne Blase: der Ring
     * bleibt steif, und der Faden hängt weiter an allen.
     *
     * Gerechnet wird als Summe über alle Blasen. Die Betonungen `--f` sind
     * Dreiecke, die sich zu jedem Zeitpunkt zu 1 addieren — die Summe ist also
     * genau die Strecke zwischen zwei Ringpunkten, und die Szene wandert
     * gleichmässig von einer Blase zur nächsten statt zu springen.
     */
    const pan = (here: number) => {
      const { zones } = planRef.current;
      let x = 0;
      let y = 0;

      for (let index = 0; index < ringsRef.current.length; index++) {
        const points = ringsRef.current[index];
        const at = zones[index + 1]?.at;
        if (at === undefined) continue;

        for (let bubble = 0; bubble < points.length; bubble++) {
          const weight = Math.max(0, 1 - Math.abs(here - (at + bubble)));
          if (weight === 0) continue;
          x += (50 - points[bubble][0]) * weight;
          y += (50 - points[bubble][1]) * weight;
        }
      }

      node.style.setProperty('--panx', `${x.toFixed(2)}%`);
      node.style.setProperty('--pany', `${y.toFixed(2)}%`);
    };

    /** Wie weit die Stelle zwischen zwei Blasen liegt: 0 an einer, 1 mittig. */
    const betweenAt = (at: number) => {
      const zone = zoneOf(at);
      if (zone.to <= zone.at) return 0;

      const t = at - Math.floor(at);
      return 1 - Math.abs(2 * t - 1);
    };

    const tick = () => {
      frame = 0;
      const now = performance.now();

      if (gliding) {
        const k = span <= 0 ? 1 : Math.min(1, (now - startedAt) / span);
        window.scrollTo(0, fromY + (toY - fromY) * rcGlide(k, lead));
        paint();

        if (k < 1) { frame = requestAnimationFrame(tick); return; }

        gliding = false;

        /*
         * War die Hand beim Ende noch dran, rollt es aus.
         *
         * Nur nach einem FREIEN Lauf: ein Übergang zwischen zwei Gruppen endet
         * ohnehin mit der Geschwindigkeit null, und noch etwas anzuhängen hiesse,
         * über den Rastpunkt hinauszuschiessen.
         */
        if (!snapping && now - lastEvent < COAST_HAND && Math.abs(speed / stepPx) > COAST_MIN) {
          vel = speed / stepPx;
          coastAt = now;
          coasting = true;
          frame = requestAnimationFrame(tick);
        }

        /*
         * Angekommen — und damit ist von der GESTE nichts mehr übrig. Weder die
         * gemessene Geschwindigkeit noch der gesammelte Weg tragen in die
         * nächste Gruppe hinein; wer weiterwill, schiebt von vorn an.
         */
        snapping = false;
        speed = 0;
        push = 0;
        return;
      }

      if (!coasting) return;

      /*
       * Der Auslauf. Die Halbwertszeit hängt davon ab, WO er gerade ist: an
       * einer Blase kurz, dazwischen lang. Damit sucht er sich eine Blase,
       * ohne dorthin gezogen zu werden.
       */
      const dt = Math.min(64, now - coastAt);
      coastAt = now;

      const half = COAST_STICK + (COAST_SLIDE - COAST_STICK) * betweenAt(target);
      vel *= Math.pow(0.5, dt / half);

      const { origin } = measure();
      const zone = zoneOf(target);
      const next = Math.min(zone.to, Math.max(zone.at, target + vel * dt));
      const stuck = next === target;

      target = next;
      window.scrollTo(0, origin + target * stepPx);
      paint();

      if (stuck || Math.abs(vel) < COAST_MIN) { coasting = false; vel = 0; return; }
      frame = requestAnimationFrame(tick);
    };

    /**
     * Einen Zustand weiter — als Fortsetzung dessen, was die Hand gerade tut.
     *
     * <b>hand</b> ist deren Geschwindigkeit in Pixeln je Millisekunde. Läuft
     * schon ein Übergang, wird auch dessen Geschwindigkeit mitgenommen: eine
     * Kette aus Schritten soll eine Bewegung bleiben und nicht bei jedem
     * Schritt neu anfahren.
     */
    /**
     * Auf eine Stelle zufahren. Die Stelle ist eine Bruchzahl, kein Zustand.
     *
     * <b>snap</b> unterscheidet die beiden Bewegungen, die es gibt: das freie
     * Laufen innerhalb einer Szene (kurz, wird vom nächsten Ereignis einfach
     * weitergeschoben) und den Übergang zwischen zwei Gruppen (lang, läuft in
     * seiner eigenen Zeit zu Ende und lässt sich nur noch lenken).
     */
    const go = (to: number, hand: number, ms: number, snap: boolean) => {
      const { origin, stepPx, last } = measure();
      const next = Math.min(last, Math.max(0, to));

      const now = performance.now();

      // Noch vor dem Überschreiben: wie schnell der laufende Übergang gerade ist.
      const running = gliding && span > 0
        ? (rcGlideSlope(Math.min(1, (now - startedAt) / span), lead) * (toY - fromY)) / span
        : 0;

      target = next;
      snapping = snap;

      // Eine neue Bewegung loest den Auslauf ab.
      coasting = false;
      vel = 0;

      fromY = window.scrollY;
      toY = origin + target * stepPx;

      span = reduce.matches ? 0 : ms;
      startedAt = now;
      gliding = true;

      if (span === 0) { window.scrollTo(0, toY); gliding = false; paint(); return; }

      /*
       * Die Anfangssteigung in den Einheiten der Kurve: welchen Anteil der
       * ganzen Strecke die Hand in der ganzen Zeit des Übergangs schaffte.
       *
       * Gezählt wird nur, was in die Richtung der Fahrt zeigt — eine Hand, die
       * dagegen schiebt, soll den Übergang nicht rückwärts anfahren lassen.
       */
      const reach = toY - fromY;
      const v = reach >= 0 ? Math.max(hand, running, 0) : Math.min(hand, running, 0);
      lead = rcGlideLead(v, span, reach);

      if (frame === 0) frame = requestAnimationFrame(tick);
    };

    /** Die Strecke, auf der diese Stelle liegt. */
    const zoneOf = (at: number) => {
      const { zones } = planRef.current;
      for (const zone of zones) {
        if (at >= zone.at - 1e-4 && at <= zone.to + 1e-4) return zone;
      }

      let best = zones[0];
      for (const zone of zones) {
        if (Math.abs(zone.at - at) < Math.abs(best.at - at)) best = zone;
      }
      return best;
    };

    /**
     * Eine Stelle weiter — für die Tastatur.
     *
     * Sie fährt immer ganze Stellen an: innerhalb einer Szene von Blase zu
     * Blase, an deren Rand zur nächsten Gruppe. Ohne Zeigegerät soll der Weg
     * durch die Seite vorhersagbar sein, nicht gleitend.
     */
    const stepBy = (dir: number) => {
      const { zones } = planRef.current;
      const zone = zoneOf(target);
      const want = Math.round(target) + dir;

      if (want >= zone.at && want <= zone.to) { go(want, 0, GLIDE_MS, true); return; }

      const next = zones[zones.indexOf(zone) + dir];
      if (next === undefined) return;

      const opening = zone.at === 0 || next.at === 0;
      go(dir > 0 ? next.at : next.to, 0, opening ? OPENING_MS : GLIDE_MS, true);
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
    const gesture = (px: number, dt: number, follow: number) => {
      const now = performance.now();
      const idle = now - lastEvent;
      const fresh = idle > GESTURE_GAP;
      lastEvent = now;

      const v = px / Math.max(4, dt);
      speed = fresh ? v : speed * 0.55 + v * 0.45;

      /*
       * Während eines ÜBERGANGS wird nichts gesammelt.
       *
       * Die Seite spricht gerade. Die Hand darf ihn lenken, aber nicht schon
       * den nächsten Schritt anzahlen — sonst trüge ein einziger langer Wisch
       * durch mehrere Bilder, ohne dass eines zu sehen gewesen wäre.
       *
       * Das freie Laufen ist davon ausgenommen: dort SOLL das nächste Ereignis
       * weiterschieben, sonst wäre es kein Laufen, sondern eine Kette kurzer
       * Sprünge.
       */
      if (gliding && snapping) { steer(speed); return; }

      const { zones } = planRef.current;
      const zone = zoneOf(target);
      const want = target + px / stepPx;

      /*
       * INNERHALB einer Szene: frei, unmittelbar, ohne Sammeln.
       *
       * Der Weg der Hand wird eins zu eins zur Strecke, und der kurze Nachlauf
       * macht daraus auch beim Mausrad eine Bewegung statt einer Folge von
       * Rucken. Hier wird nichts eingerastet — die Betonung wandert einfach
       * mit, und man kann zwischen zwei Blasen stehenbleiben.
       */
      if (want >= zone.at - 1e-4 && want <= zone.to + 1e-4) {
        push = 0;
        go(want, speed, follow, false);
        return;
      }

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

      // Noch nicht genug für den Sprung: bis an den Rand der eigenen Strecke,
      // und dort warten. Sonst bliebe die Szene mitten im Lauf stehen.
      const dir = push > 0 ? 1 : -1;
      const edge = dir > 0 ? zone.to : zone.at;

      if (Math.abs(push) < STEP_PUSH) {
        if (Math.abs(edge - target) > 1e-4) go(edge, speed, follow, false);
        return;
      }

      push = 0;

      const next = zones[zones.indexOf(zone) + dir];
      if (next === undefined) return;

      // Rückwärts landet man am ENDE der vorigen Gruppe, nicht an ihrem Anfang:
      // wer zurückgeht, kommt dort an, wo er sie verlassen hat.
      const opening = zone.at === 0 || next.at === 0;
      go(dir > 0 ? next.at : next.to, speed, opening ? OPENING_MS : GLIDE_MS, true);
    };

    /*
     * Rollt der Bereich unter dem Zeiger selbst?
     *
     * Geprüft wird, ob dort wirklich etwas überläuft. Bloss auf den Bereich zu
     * sehen genügte nicht: über der geschlossenen Kopfleiste liesse ein Rad
     * dann die Seite frei scrollen und umginge die Zustände.
     */
    const rolls = (event: Event) => {
      const box = event.target instanceof Element ? event.target.closest(FREE_SCROLL) : null;
      return box !== null && box.scrollHeight > box.clientHeight + 1;
    };

    const onWheel = (event: WheelEvent) => {
      if (rolls(event)) return;
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
      gesture(event.deltaY * unit, gap > GESTURE_GAP ? NOTCH_MS : gap, FREE_MS);
    };

    const onTouchStart = (event: TouchEvent) => {
      touchAt = event.touches[0]?.clientY ?? 0;
      touchTime = performance.now();
      lastEvent = 0;
      speed = 0;
      push = 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (rolls(event)) return;
      event.preventDefault();
      const y = event.touches[0]?.clientY ?? 0;
      const dy = touchAt - y;
      if (Math.abs(dy) < TOUCH_MIN) return;

      // Der Finger ist das einzige Zeigegerät, das wirklich eine
      // Geschwindigkeit hergibt: Weg und Zeit sind beide gemessen.
      const now = performance.now();
      gesture(dy * TOUCH_GAIN, now - touchTime, FREE_TOUCH_MS);
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
      stepBy(down ? 1 : -1);
    };

    /*
     * Neu vermessen und den Zustand halten.
     *
     * Läuft nicht nur beim Ändern der Fenstergrösse: auch beim Drehen des
     * Geräts, und immer dann, wenn die Kopfleiste ihre Höhe ändert — auf dem
     * Telefon klappt dort ein Menü auf, und das ist kein Fenstermass.
     */
    const relayout = () => {
      coasting = false;
      vel = 0;
      layout();
      const { origin } = measure();
      window.scrollTo(0, origin + target * stepPx);
      paint();
    };

    node.classList.add('is-live');
    layout();

    const head = document.querySelector('.pub-head');
    const watch = head === null ? null : new ResizeObserver(relayout);
    if (head !== null && watch !== null) watch.observe(head);

    // Da anfangen, wo die Seite gerade steht — ein Neuladen mitten im Verlauf
    // soll nicht nach oben springen.
    const start = measure();
    target = Math.min(start.last, Math.max(0, Math.round((window.scrollY - start.origin) / start.stepPx)));
    paint();

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', relayout, { passive: true });
    window.addEventListener('orientationchange', relayout, { passive: true });

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', relayout);
      window.removeEventListener('orientationchange', relayout);
      if (watch !== null) watch.disconnect();
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

    /*
     * Der Abstand des Satzes von der Mitte — und damit auch die Lage des
     * Fluchtpunktes im Stilblatt. EINE Zahl fuer beides: nur wenn der Satz
     * genau auf dem Fluchtpunkt liegt, bleibt er beim Naeherkommen stehen.
     * Vorher stand der Abstand in `vmin` und der Fluchtpunkt in Prozent der
     * Hoehe — im Hochformat sind das zwei verschiedene Orte.
     */
    '--sy': `calc(${SENTENCE_Y} * var(--uy, 1vmin))`,
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
                    '--x': `calc(${word.x.toFixed(2)} * var(--ux, 1vmin))`,
                    '--y': `calc(${word.y.toFixed(2)} * var(--uy, 1vmin))`,
                    '--z': word.z.toFixed(0),
                    '--alpha': word.alpha.toFixed(3),
                    '--size': `${word.size.toFixed(2)}vmin`
                  } as CSSProperties}
                >
                  <b className="rc-word-re">RE</b>{word.tail}
                </span>
              ))}

              <div
                className="rc-item rc-logo"
                style={{
                  '--x': '0px',
                  '--y': `calc(${LOGO_Y} * var(--uy, 1vmin))`,
                  '--z': LOGO_Z
                } as CSSProperties}
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
                  '--x': '0px',
                  // Genau der Fluchtpunkt — dieselbe Zahl wie im Stilblatt.
                  '--y': 'var(--sy)',
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
            const points = rings[index];
            return (
              <section
                className="rc-wave"
                key={scene.label}
                aria-label={scene.label}
                style={{
                  '--c': plan.starts[index],
                  '--n': scene.bubbles.length,
                  // Lebensdauer in Stellen: so viele, wie sie Blasen hat. Ganz
                  // da ist sie auf ihrer ganzen Strecke — gewechselt wird nur
                  // in der Lücke zur nächsten Gruppe, auf der nie geruht wird.
                  '--life': scene.bubbles.length
                } as CSSProperties}
              >
                <Thread points={points} />
                {scene.bubbles.map((bubble, at) => (
                  <Bubble
                    key={bubble.kind + at}
                    index={at}
                    at={points[at]}
                    yield={yields[index][at]}
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
