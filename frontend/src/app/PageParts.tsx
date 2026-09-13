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

import { COLUMNS, frameFor, snapColSpan, snapRowSpan, type Breakpoint } from './layout';
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

export function PageParts({ parts }: { parts: readonly DraftPart[] }) {
  const breakpoint = useBreakpoint();
  const columns = COLUMNS[breakpoint];

  const shown = parts.filter((part) => !isEmpty(part.config));
  if (shown.length === 0) return null;

  return (
    <div
      className="wk-page-grid"
      style={{ '--page-cols': columns } as CSSProperties}
    >
      {shown.map((part) => {
        const frame = frameFor(part, breakpoint);

        return (
          <article
            key={part.id}
            className={`wk-card wk-card-${part.kind}`}
            style={{
              gridColumn: `${frame.position.col} / span ${snapColSpan(frame.size.colSpan, columns)}`,
              gridRow: `span ${snapRowSpan(frame.size.rowSpan)}`
            }}
          >
            <Body kind={part.kind} config={part.config} />
          </article>
        );
      })}
    </div>
  );
}

/** Zeilen eines mehrzeiligen Feldes, ohne die leeren dazwischen. */
const lines = (text: string): readonly string[] =>
  text.split('\n').map((line) => line.trim()).filter((line) => line !== '');

function Body({ kind, config }: { kind: string; config: Record<string, string> }) {
  const title = (config.title ?? '').trim();
  const body = (config.body ?? '').trim();

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
