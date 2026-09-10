/**
 * Die vier vorbereiteten Seiten (Abschnitt 5).
 *
 * <b>Eine echte Seite, kein ausgegrauter Menuepunkt.</b> Der Unterschied ist
 * nicht kosmetisch: ein toter Menuepunkt sagt „hier ist nichts", eine Seite
 * sagt „hier kommt dies". Und sie liegt schon an ihrer endgueltigen Adresse,
 * damit spaeter nichts umgeleitet werden muss.
 *
 * <b>Kein Datum, kein Zaehlwerk, kein Ladekreisel.</b> Ein Datum waere eine
 * erfundene Tatsache (Abschnitt 0); ein Kreisel behauptete, es laufe gerade
 * etwas.
 */

import type { PlaceholderCopy, PublicCopy } from '../content';

export function PlaceholderPage({ copy, page }: { copy: PublicCopy; page: PlaceholderCopy }) {
  return (
    <article className="pub-page pub-placeholder">
      <h1 className="pub-h1">{page.title}</h1>
      <p className="pub-lead">{page.body}</p>
      <p className="pub-standing">{page.preparing}</p>

      <p className="pub-onward">
        <a href={`mailto:${copy.contact.email}`}>{copy.contact.email}</a>
      </p>
    </article>
  );
}
