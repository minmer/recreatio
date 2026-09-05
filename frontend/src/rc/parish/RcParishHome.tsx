/**
 * Die Startseite, gezeichnet aus dem gespeicherten Aufbau.
 *
 * <b>Was der Editor setzt, zeigt diese Datei — und sonst nichts.</b> Vorher
 * stand die Startseite fest im Code: der Editor konnte schieben, was er wollte,
 * die Seite sah immer gleich aus. Ein Editor, dessen Ergebnis man nicht sieht,
 * ist ein Spielzeug.
 *
 * <b>Dieselben Rasterzahlen wie im Editor</b> — 6/4/2 Spalten, Breiten 2/3/4/6.
 * Sie kommen aus `rcLayout.ts`, damit es nur eine Wahrheit gibt: was im Editor
 * drei Spalten breit ist, ist es hier auch.
 *
 * <b>Bausteine ohne Inhalt bleiben sichtbar.</b> Ein Baustein, der verschwindet,
 * weil sein Feld leer ist, lässt den Verwalter im Glauben, er habe ihn nie
 * abgelegt. Er zeigt stattdessen, was fehlt — aber nur dem, der bearbeiten
 * darf; ein Besucher sieht ihn gar nicht.
 */

import { useMemo, type CSSProperties } from 'react';

import { RcMassWidget } from './RcMassWidget';
import { RC_COLUMNS, rcFrameFor, rcSnapColSpan, rcSnapRowSpan, type RcBreakpoint, type RcModule } from './rcLayout';
import { rcModuleLabel } from './rcModules';
import type { RcSite } from './rcSite';

/**
 * Welche Bildschirmgrösse gerade gilt.
 *
 * Die Grenzen sind dieselben wie im Stilblatt (860 und 640): stimmten sie
 * nicht überein, sprängen Raster und Anordnung an verschiedenen Stellen um,
 * und dazwischen sähe die Seite falsch aus.
 */
function useBreakpoint(): RcBreakpoint {
  return useMemo(() => {
    if (typeof window === 'undefined') return 'desktop';
    if (window.matchMedia('(max-width: 640px)').matches) return 'mobile';
    if (window.matchMedia('(max-width: 860px)').matches) return 'tablet';
    return 'desktop';
  }, []);
}

export function RcParishHome({
  site, mayEdit, at, slug
}: {
  site: RcSite;
  /** Welche Pfarrei — der Messplan kommt vom Dienst und nicht aus dem Dokument. */
  slug: string;
  /** Wer bearbeiten darf, sieht auch leere Bausteine — als Aufgabe. */
  mayEdit: boolean;
  /** Die Adresse einer Unterseite — damit „Więcej" ein Verweis ist und kein Knopf. */
  at: (pageId: string) => string;
}) {
  const breakpoint = useBreakpoint();
  const columns = RC_COLUMNS[breakpoint];

  if (site.modules.length === 0) {
    return (
      <p className="ps-muted ps-empty-home">
        {mayEdit
          ? 'Strona główna jest pusta. Włącz tryb edycji i przeciągnij pierwszy moduł.'
          : 'Ta strona jest jeszcze w budowie.'}
      </p>
    );
  }

  return (
    <div
      className="ps-live-grid"
      style={{ '--ps-cols': columns } as CSSProperties}
    >
      {site.modules.map((module) => (
        <Block
          key={module.id}
          module={module}
          columns={columns}
          breakpoint={breakpoint}
          site={site}
          mayEdit={mayEdit}
          at={at}
          slug={slug}
        />
      ))}
    </div>
  );
}

function Block({
  module, columns, breakpoint, site, mayEdit, at, slug
}: {
  module: RcModule;
  slug: string;
  columns: number;
  breakpoint: RcBreakpoint;
  site: RcSite;
  mayEdit: boolean;
  at: (pageId: string) => string;
}) {
  const frame = rcFrameFor(module, breakpoint);

  /*
   * DIE GROESSE GEHT MIT IN DEN INHALT.
   *
   * Ein Baustein, der seine eigene Groesse nicht kennt, kann nur EINE Gestalt
   * haben — und muss sie dann abschneiden, wenn der Platz nicht reicht. Ein
   * abgeschnittener Messplan sieht vollstaendig aus und ist es nicht: wer „7:00,
   * 9:00" liest, kommt um neun und erfaehrt nie, dass es auch achtzehn Uhr gab.
   */
  const body = renderBody(module.type, site, slug, frame.size);

  // Ein leerer Baustein bleibt für den Verwalter stehen und verschwindet für
  // den Besucher: der eine soll ihn füllen, dem anderen sagt er nichts.
  if (body === null && !mayEdit) return null;

  return (
    <article
      className={`ps-card${body === null ? ' ps-card-todo' : ''}`}
      style={{
        gridColumn: `${frame.position.col} / span ${rcSnapColSpan(frame.size.colSpan, columns)}`,
        gridRow: `span ${rcSnapRowSpan(frame.size.rowSpan)}`
      }}
    >
      <h2>{rcModuleLabel(module.type)}</h2>

      {body ?? <p className="ps-muted">Ten moduł nie ma jeszcze treści — uzupełnij ją w zakładce „Treść".</p>}

      {/* Ein Verweis und kein Knopf: mit der mittleren Maustaste in einem
          neuen Reiter, als Lesezeichen, zum Weitergeben. */}
      {LINKS[module.type] !== undefined && body !== null && (
        <a className="ps-more" href={at(LINKS[module.type])}>Więcej</a>
      )}
    </article>
  );
}

/** Wohin ein Baustein führt, wenn man mehr sehen will. */
const LINKS: Record<string, string> = {
  intentions: 'intentions',
  news: 'announcements',
  announcements: 'announcements',
  masses: 'masses',
  hours: 'office',
  calendar: 'calendar',
  contact: 'contact',
  sacraments: 'sacrament-baptism',
  groups: 'community'
};

/**
 * Der Inhalt eines Bausteins aus den eingegebenen Angaben.
 *
 * <c>null</c> heisst: dazu ist nichts eingetragen. Die Entscheidung, was dann
 * geschieht, trifft der Aufrufer — hier steht nur die Auskunft.
 */
function renderBody(
  type: string, site: RcSite, slug: string,
  size: { readonly colSpan: number; readonly rowSpan: number }
): React.ReactNode | null {
  const value = (key: string) => (site.content[key] ?? '').trim();
  const lines = (key: string) =>
    value(key).split('\n').map((l) => l.trim()).filter((l) => l !== '');

  switch (type) {
    case 'hours': {
      const rows = lines('office.hours');
      return rows.length === 0 ? null : <Rows rows={rows} />;
    }

    /*
     * DER MESSPLAN KOMMT JETZT AUS DEM KALENDER.
     *
     * Hier standen die von Hand eingetragenen Zeilen („7:00 — cicha"). Die
     * bleiben als Rueckfall stehen: eine Pfarrei, die ihre Messen noch nicht
     * als Termine angelegt hat, verliert ihre Seite nicht — sie zeigt weiter,
     * was jemand hingeschrieben hat.
     *
     * Sobald es Termine gibt, gewinnen sie. Zwei Quellen fuer dieselbe Auskunft
     * laufen sonst auseinander, und die abgetippte ist die, die niemand
     * nachfuehrt.
     */
    case 'masses':
      return (
        <RcMassWidget
          slug={slug}
          colSpan={size.colSpan}
          rowSpan={size.rowSpan}
          fallback={lines('masses.sunday')}
        />
      );

    case 'intentions':
      return (
        <RcMassWidget
          slug={slug}
          colSpan={size.colSpan}
          rowSpan={size.rowSpan}
          onlyIntentions
        />
      );

    case 'contact': {
      const parts = [
        ['Adres', value('contact.address')],
        ['Telefon', value('contact.phone')],
        ['E-mail', value('contact.email')]
      ].filter(([, v]) => v !== '');

      return parts.length === 0 ? null : (
        <ul className="ps-rows">
          {parts.map(([label, v]) => (
            <li key={label}><span>{label}</span><em>{v}</em></li>
          ))}
        </ul>
      );
    }

    case 'sticky': {
      const text = value('about.description');
      return text === '' ? null : <p>{text}</p>;
    }

    case 'groups': {
      const rows = lines('community.list');
      return rows.length === 0 ? null : <Rows rows={rows} />;
    }

    /*
     * Diese Bausteine zeigen Dinge, die es je Pfarrei erst geben muss —
     * Intentionen, Ankündigungen, Termine. Solange dafür keine Einträge
     * angelegt werden können, gibt es hier nichts zu zeigen, und das ist die
     * ehrliche Antwort.
     */
    case 'news':
    case 'announcements':
    case 'calendar':
    case 'events':
    case 'gallery':
    case 'sacraments':
    default:
      return null;
  }
}

/**
 * Zeilen der Form „7:00 — cicha".
 *
 * Der Gedankenstrich trennt Zeit und Sache, weil so ein Messplan geschrieben
 * wird. Fehlt er, steht die ganze Zeile als Sache da — besser als eine Zeile
 * zu verschlucken, die jemand anders gemeint hat.
 */
function Rows({ rows }: { rows: readonly string[] }) {
  return (
    <ul className="ps-rows">
      {rows.map((row, i) => {
        const cut = row.split(/\s+[—–-]\s+/);
        const head = cut.length > 1 ? cut[0] : '';
        const rest = cut.length > 1 ? cut.slice(1).join(' — ') : row;

        return (
          <li key={`${row}-${i}`}>
            {head !== '' ? <time>{head}</time> : <span />}
            <span>{rest}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default RcParishHome;
