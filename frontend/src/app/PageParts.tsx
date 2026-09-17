/**
 * Die Bausteine einer öffentlichen Seite — gezeichnet, nicht bearbeitet.
 *
 * <b>Ein leerer Baustein verschwindet für den Besucher</b> und bleibt für den,
 * der die Seite führt: der eine soll ihn füllen, dem anderen sagt er nichts.
 * Dieselbe Regel wie im Altbestand, und sie ist die richtige — eine Kachel mit
 * einer Überschrift und nichts darunter sieht aus wie ein Fehler.
 *
 * <b>Die Bildschirmgrösse wird hier entschieden</b> und nicht per Medienabfrage:
 * die Anordnung liegt je Grösse als Rechteck vor, und ein Rechteck lässt sich
 * nicht in CSS umrechnen, ohne es noch einmal zu beschreiben.
 */

import { useEffect, useState, type CSSProperties } from 'react';

import {
  byReadingOrder, COLUMNS, frameFor, snapColSpan, snapRowSpan, type Breakpoint
} from './layout';
import { FormCard } from './FormCard';
import { MassCard } from './MassCard';
import { isEmpty, moduleDef, readLink } from './modules';
import { pagePath } from './routes';
import type { DraftPart } from './page';

/** Dieselben Schwellen wie die Zeichenflächen des Editors. */
const breakpointFor = (width: number): Breakpoint =>
  width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';

function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() =>
    typeof window === 'undefined' ? 'desktop' : breakpointFor(window.innerWidth));

  useEffect(() => {
    const onResize = () => setBreakpoint(breakpointFor(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return breakpoint;
}

/*
 * OHNE die Adresse. Sie stand hier, weil der Messplan sie brauchte, um seinen
 * Inhalt zu holen — seit 0020 nennt er statt ihrer einen KALENDER, der in
 * seinem `config` steht. Damit braucht kein Baustein mehr zu wissen, unter
 * welcher Adresse er gerade gezeichnet wird, und das ist die richtige Ordnung:
 * ein Baustein ist dasselbe, gleich wo er hängt.
 */
export function PageParts({ parts }: {
  parts: readonly DraftPart[];
}) {
  const breakpoint = useBreakpoint();
  const columns = COLUMNS[breakpoint];

  /*
   * Ein leerer Baustein verschwindet für den Besucher — ausser er holt seinen
   * Inhalt woanders her. Der Messplan hat NIE etwas im `config` stehen; ohne
   * diese Ausnahme fiele er genau dann aus der Seite, wenn er richtig
   * eingerichtet ist, und niemand käme darauf, warum.
   */
  const visible = parts.filter(
    (part) => !isEmpty(part.config) || moduleDef(part.kind)?.live === true);

  /*
   * DIE STELLE IM RASTER ENTSCHEIDET, auch hier.
   *
   * Die Spalte steht unten ausdrücklich (`gridColumn`), die ZEILE nicht: sie
   * ergibt sich aus der Reihenfolge, in der die Bausteine hier stehen. Und die
   * kam bisher aus `slug_part.position`, also aus der Reihenfolge des
   * Hinzufügens — ein Baustein, den jemand nach oben schob, blieb unten.
   *
   * Eine feste Zeile (`gridRow: row / span n`) wäre die andere Möglichkeit und
   * die schlechtere: die Höhe einer Kachel hängt hier an ihrem INHALT, nicht an
   * einer Rasterzeile. Ein längerer Text liefe in die nächste Kachel hinein,
   * und eine Lücke im Entwurf risse ein Loch in die Seite.
   *
   * Also die Leserichtung, dieselbe Regel wie im Editor — und sie wirkt sofort,
   * auch auf Seiten, die seit der Änderung niemand neu gespeichert hat.
   */
  const shown = byReadingOrder(visible);

  if (shown.length === 0) return null;

  return (
    <div
      className="wk-page-grid"
      style={{ '--page-cols': columns } as CSSProperties}
    >
      {shown.map((part) => {
        const frame = frameFor(part, breakpoint);

        /*
         * Einmal gerechnet und weitergereicht: der Messplan entscheidet an
         * DIESEN Zahlen, was er zeigt. Sie im Stil noch einmal auszurechnen
         * hiesse, zwei Stellen zu haben, die sich einig sein müssen.
         */
        const colSpan = snapColSpan(frame.size.colSpan, columns);
        const rowSpan = snapRowSpan(frame.size.rowSpan);

        return (
          <article
            key={part.id}
            className={`wk-card wk-card-${part.kind}`}
            style={{
              gridColumn: `${frame.position.col} / span ${colSpan}`,
              gridRow: `span ${rowSpan}`
            }}
          >
            <Body
              kind={part.kind}
              partId={part.id}
              config={part.config}
              colSpan={colSpan}
              rowSpan={rowSpan}
            />
          </article>
        );
      })}
    </div>
  );
}

/** Zeilen eines mehrzeiligen Feldes, ohne die leeren dazwischen. */
const lines = (text: string): readonly string[] =>
  text.split('\n').map((line) => line.trim()).filter((line) => line !== '');

/*
 * OHNE `path`. Der Messplan war der einzige Baustein, der die Adresse brauchte —
 * und er nennt seit 0020 einen KALENDER, der in seinem `config` steht. Die
 * Adresse weiterzureichen, damit niemand sie liest, sähe aus wie ein Zweck.
 */
function Body({ kind, partId, config, colSpan, rowSpan }: {
  kind: string;

  /*
   * Der Baustein selbst. Das Formular braucht ihn: seine Felder hängen NICHT
   * im `config`, sondern als Zeilen an genau diesem Baustein — eine Antwort
   * zeigt auf ein Feld, und dafür muss es das Feld geben.
   */
  partId: string;

  config: Record<string, string>;
  colSpan: number;
  rowSpan: number;
}) {
  const title = (config.title ?? '').trim();
  const body = (config.body ?? '').trim();

  /*
   * Der einzige Baustein, der etwas holt. Er steht vor allen anderen, weil er
   * mit `config` nichts anfängt — dort steht nur, wie er aussehen soll.
   */
  if (kind === 'masses') {
    return <MassCard config={config} colSpan={colSpan} rowSpan={rowSpan} />;
  }

  if (kind === 'form') {
    return <FormCard partId={partId} config={config} />;
  }

  if (kind === 'notice') {
    return <p className="wk-card-notice">{body}</p>;
  }

  if (kind === 'hours') {
    return (
      <>
        {title !== '' && <h2 className="wk-card-title">{title}</h2>}
        <ul className="wk-card-lines">
          {lines(body).map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      </>
    );
  }

  if (kind === 'contact') {
    const address = (config.address ?? '').trim();
    const phone = (config.phone ?? '').trim();
    const email = (config.email ?? '').trim();

    return (
      <>
        <h2 className="wk-card-title">Kontakt</h2>
        <ul className="wk-card-lines">
          {address !== '' && <li>{address}</li>}
          {/* Auf einem Telefon ist eine Nummer zum Anrufen da, nicht zum Abtippen. */}
          {phone !== '' && <li><a className="wk-link" href={`tel:${phone.replace(/\s+/g, '')}`}>{phone}</a></li>}
          {email !== '' && <li><a className="wk-link" href={`mailto:${email}`}>{email}</a></li>}
        </ul>
      </>
    );
  }

  if (kind === 'links') {
    return (
      <>
        {title !== '' && <h2 className="wk-card-title">{title}</h2>}
        <ul className="wk-card-lines">
          {lines(body).map((line, i) => {
            const link = readLink(line);
            if (link === null) return null;

            return (
              <li key={i}>
                <a className="wk-link" href={pagePath(link.path)}>{link.label}</a>
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  // `text` und alles, was diese Fassung noch nicht kennt: Überschrift und
  // Absätze. Ein unbekannter Baustein zeigt lieber seinen Text als nichts.
  return (
    <>
      {title !== '' && <h2 className="wk-card-title">{title}</h2>}
      {lines(body).map((line, i) => <p key={i} className="wk-card-text">{line}</p>)}
      {moduleDef(kind) === undefined && (
        <p className="wk-card-unknown">Moduł „{kind}" nie jest znany tej wersji strony.</p>
      )}
    </>
  );
}

export default PageParts;
