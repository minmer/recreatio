/**
 * Der Baustein „Wspólnoty" auf der Startseite der Pfarrei.
 *
 * <b>Dieselbe Entscheidung wie beim Messplan, und aus demselben Grund.</b> Hier
 * standen abgetippte Zeilen aus dem Dokument („Schola — soboty 10:00"). Die
 * bleiben als RUECKFALL stehen: eine Pfarrei, die ihre Gruppen noch nicht
 * angelegt hat, verliert ihre Seite nicht.
 *
 * Sobald es angelegte Gruppen gibt, gewinnen sie. Zwei Quellen fuer dieselbe
 * Auskunft laufen auseinander — und die abgetippte ist die, die niemand
 * nachfuehrt: die Schola verlegt ihre Probe, sagt es im Gruppenchat, und im
 * Schaukasten steht ein Jahr lang die alte Zeit.
 *
 * <b>Ohne Konto.</b> Der Baustein haengt auf der oeffentlichen Startseite; wer
 * ihn liest, sucht meist gerade erst eine Gruppe. Er liest den Aushang
 * (`/rc/public/parishes/{slug}/groups`) und nichts dahinter.
 */

import { useEffect, useState } from 'react';

import { rcPublicGroups, type RcPublicGroup } from './rcGroups';

export function RcGroupsWidget({
  slug, fallback, href
}: {
  slug: string;
  /** Die abgetippten Zeilen aus dem Dokument, falls es noch keine Gruppen gibt. */
  fallback: readonly string[];
  /** Wohin „Więcej" fuehrt — die Seite baut die Adresse, nicht dieser Baustein. */
  href: string;
}) {
  const [groups, setGroups] = useState<readonly RcPublicGroup[] | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const found = await rcPublicGroups(slug);
        if (alive) setGroups(found.groups ?? []);
      } catch {
        /*
         * Ein Fehlschlag heisst „nichts angelegt", nicht „kaputt": dann gilt
         * der Rueckfall, und im Schaukasten steht weiter, was jemand
         * hingeschrieben hat. Eine Fehlermeldung an dieser Stelle waere fuer
         * den Besucher ohne jeden Wert.
         */
        if (alive) setGroups([]);
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  // Solange noch nichts da ist, gilt der Rueckfall — kein Flackern, kein
  // „Wczytywanie…" in einer Kachel von drei Zeilen Hoehe.
  if (groups === null || groups.length === 0) {
    return fallback.length === 0 ? null : <Lines rows={fallback} />;
  }

  return (
    <ul className="ps-rows wg-widget">
      {groups.map((group) => (
        <li key={group.slug}>
          <span className="wg-widget-name">
            <a href={`${href}/${group.slug}`}>{group.name}</a>
          </span>
          <span>{group.meets ?? group.summary ?? ''}</span>
        </li>
      ))}
    </ul>
  );
}

/** Die abgetippte Form: „Schola — soboty 10:00". */
function Lines({ rows }: { rows: readonly string[] }) {
  return (
    <ul className="ps-rows">
      {rows.map((row, i) => {
        const cut = row.split(/\s+[—–-]\s+/);
        const head = cut.length > 1 ? cut[0] : '';
        const rest = cut.length > 1 ? cut.slice(1).join(' — ') : row;

        return (
          <li key={`${row}-${i}`}>
            {head !== '' ? <span>{head}</span> : <span />}
            <span>{rest}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default RcGroupsWidget;
