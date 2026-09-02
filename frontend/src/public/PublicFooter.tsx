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
      {/*
        Hier wechselt das Zeichen GENAU ANDERSHERUM als in der Kopfleiste.

        Der Balken ist der Gegensatz zur Seite: dunkel auf hellem Grund, hell
        auf dunklem. Also braucht er in der hellen Ansicht die helle Fassung und
        in der dunklen die dunkle — beide Male die umgekehrte von oben.
      */}
      <div className="pub-foot-mark">
        <picture>
          <source srcSet="/logo_new.svg" media="(prefers-color-scheme: dark)" />
          <img src="/logo_inv.svg" alt={copy.footer.logoAlt} width="132" height="30" />
        </picture>
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
