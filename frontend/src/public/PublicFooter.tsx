/**
 * Die Fusszeile.
 *
 * <b>Das Zeichen, nicht der Schriftzug.</b> Die alte Fusszeile trug eine
 * Textzeile; das Zeichen stand nur oben. Auf dem dunklen Balken gehört
 * `logo_inv.svg` — die helle Fassung —, sonst steht ein dunkles Zeichen auf
 * dunklem Grund (Abschnitt 8).
 *
 * <b>Impressum und Datenschutz sind hier KEINE Fusszeilenlinks im üblichen
 * Sinn.</b> Bei einer Einrichtung, die sich vorstellt, ist die Frage „wer seid
 * ihr und wie haltet ihr es mit dem Geld" eine eigene Seite und keine
 * Kleinschrift. Deshalb stehen `o-nas` und `przejrzystosc` hier mit demselben
 * Gewicht wie der Kontakt.
 */

import type { PublicCopy } from './content';
import { publicHref } from './publicRoutes';

export function PublicFooter({ copy }: { copy: PublicCopy }) {
  return (
    <footer className="pub-foot">
      <div className="pub-foot-mark">
        <img src="/logo_inv.svg" alt={copy.footer.logoAlt} width="132" height="30" />
        <span>{copy.footer.initiative}</span>
      </div>

      <nav className="pub-foot-nav" aria-label={copy.nav.menu}>
        <a href={publicHref('o-nas')}>{copy.nav['o-nas']}</a>
        <a href={publicHref('przejrzystosc')}>{copy.nav.przejrzystosc}</a>
        <a href={publicHref('kontakt')}>{copy.nav.kontakt}</a>
        <a href={`mailto:${copy.contact.email}`}>{copy.contact.email}</a>
      </nav>
    </footer>
  );
}
