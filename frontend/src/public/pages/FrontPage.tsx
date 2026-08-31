/**
 * Die Startseite — drei Bilder, EIN Dokument.
 *
 *   1  Der Name. Sonst nichts.
 *   2  Worum es geht.
 *   3  Wie es geschieht.
 *
 * <b>Kein JavaScript ist an der Darstellung beteiligt.</b> Keine Beobachter,
 * kein Zustand, keine Einblendung, die Text ins Dasein holt. Der Übergang ist
 * eine bildlaufgesteuerte CSS-Animation; fällt sie aus, stehen drei Abschnitte
 * untereinander und die Seite ist vollständig. Deshalb hat dieses Bauteil
 * keinen einzigen Haken — das ist Absicht und kein Versäumnis.
 *
 * <b>Der Name ist echter Text.</b> Er steht als `<text>` in einem eingebetteten
 * SVG, nicht als Bild und nicht in einem `alt`. Zweimal: einmal sichtbar für
 * den Fall ohne Bildlaufzeitachse, einmal als Maske im Schleier. Beide tragen
 * dieselbe Zeichenkette aus der Sprachdatei.
 *
 * <b>Der Schleier ist eine Maske, keine Vergrösserung.</b> Die Buchstaben sind
 * ein LOCH in einer undurchsichtigen Fläche; wächst die Maske, wächst das Loch,
 * bis die Fläche fort ist. Man sieht durch das Wort hindurch. Ein `scale()` auf
 * einem Bild sähe aus wie eine Diaschau und verlöre genau diese Bedeutung.
 *
 * Ohne Unterstützung für `animation-timeline` (derzeit Firefox) erscheint der
 * Schleier gar nicht: dann steht der Name still auf dunklem Grund, und darunter
 * folgt der nächste Abschnitt. Nie ein halber Zustand.
 */

import type { PublicCopy } from '../content';
import { PublicText } from '../PublicText';
import { publicHref, type PublicPage } from '../publicRoutes';

/** Die Reihenfolge der Werke steht fest und wird nicht umgestellt. */
const WORK_PAGES: readonly PublicPage[] = ['osrodek', 'wydarzenia', 'cogita', 'biblioteka'];

/**
 * Der Name als SVG.
 *
 * `slice` statt `none`: eine Wortmarke, die sich mit dem Fenster verzerrt, ist
 * keine Wortmarke mehr. Das Rechteck ist absichtlich viel grösser als das
 * Sichtfeld — beim Beschneiden darf an keinem Rand eine Lücke entstehen.
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

  return (
    <div className="rc-home">
      {/*
        Die Bühne. Sie ist hoch, damit es Weg zum Scrollen gibt — aber NICHTS
        an ihr wandert nach oben: der innere Teil steht fest, während der Name
        auf den Betrachter zuwächst und das zweite Bild hinter ihm sichtbar
        wird. Es scrollt also, ohne dass etwas wegscrollt.

        Reihenfolge im Baum: erst der Satz, dann das zweite Bild, dann der
        Schleier. So liest ein Vorleseprogramm die Überschrift zuerst; gestapelt
        wird über den Stapelindex und nicht über die Reihenfolge.
      */}
      <div className="rc-stage">
        <div className="rc-pin">
          <div className="rc-first rc-keep">
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

          {/*
            Die Gedanken kommen EINZELN nach vorn — dieselbe Bewegung wie beim
            Namen, nur eine Ebene weiter. Erst der Gedanke vom Menschen, dann
            der von der Gemeinschaft, dann der von Gott; danach die Offenheit.
            Sie stehen nicht schon da und blenden auf, sie kommen aus der
            Tiefe.
          */}
          <section className="rc-behind rc-l2 rc-keep" aria-labelledby="rc-h2">
            <div className="rc-s2-in">
              <h2 className="rc-h2 rc-keep" id="rc-h2">{t.screen2.title}</h2>

              <div className="rc-vision">
                {t.screen2.paragraphs.map((paragraph) => (
                  <p className="rc-keep" key={paragraph.slice(0, 40)}>{paragraph}</p>
                ))}
              </div>

              {/* Die Offenheit steht abgesetzt — sie ist kein Nachsatz. */}
              <p className="rc-open rc-keep">{t.screen2.openness}</p>
            </div>
          </section>

          {/*
            Das dritte Bild liegt am tiefsten und wartet. Man kommt hinein,
            indem man durch das zweite hindurchgeht — dieselbe Bewegung zum
            dritten Mal.
          */}
          <section className="rc-s3 rc-l3 rc-keep" aria-labelledby="rc-h3">
            <div className="rc-s3-in">
              <h2 className="rc-h2 rc-keep" id="rc-h3">{t.screen3.title}</h2>
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

          <div className="rc-veil rc-keep" aria-hidden="true">
            <Wordmark text={t.screen1.wordmark} masked />
          </div>
        </div>
      </div>
    </div>
  );
}
