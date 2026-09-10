/**
 * Wann eine Veranstaltung gegruendet werden darf.
 *
 * <b>Warum das nicht im Formular steht.</b> Es ist keine Frage der Darstellung,
 * sondern die Bedingung, unter der ueberhaupt etwas entstehen darf — und sie
 * war schon einmal falsch: das alte Formular fragte nach Bereich, Titel und
 * Adresse und liess eine Veranstaltung entstehen, die Anmeldungen annehmen
 * konnte, ohne dass irgendwo stand, WER fuer die Daten einsteht.
 *
 * <b>Der Server prueft dasselbe.</b> Das hier ist nicht die Schranke, sondern
 * die Freundlichkeit: der Knopf bleibt grau, statt dass jemand absendet und
 * eine Absage liest. Laufen beide auseinander, ist das kein stiller Fehler —
 * der Server lehnt ab.
 *
 * <b>Getrimmt wird hier, nicht erst beim Senden.</b> Ein Feld mit einem
 * Leerzeichen darin ist leer. Wer es anders herum macht, hat einen Knopf, der
 * angeht und dann eine 400 holt.
 */

import { rcIsSlug } from '../lib/rcSlugs';

export type RcFoundDraft = {
  /** Die Rolle, unter deren Schluessel der neue Bereich verschlossen wird. */
  readonly founderRoleId: string;
  readonly slug: string;
  readonly title: string;

  /** Name und Anschrift des Verantwortlichen — die Klausel braucht beide. */
  readonly organizerName: string;
  readonly organizerAddress: string;
};

/** Serverseitige Laengen (`FoundAsync`), damit der Knopf nicht in eine 400 fuehrt. */
const MAX_TITLE = 200;
const MAX_NAME = 200;
const MAX_ADDRESS = 400;

const filled = (value: string, max: number): boolean => {
  const t = value.trim();
  return t.length > 0 && t.length <= max;
};

/**
 * Darf abgesendet werden?
 *
 * Eine leere Adresse ist NICHT „noch nicht getippt, also in Ordnung": ohne
 * Adresse gibt es die Veranstaltung nirgends. Die Unterscheidung — leer gegen
 * falsch geschrieben — trifft das Formular fuer seinen Hinweistext, nicht diese
 * Bedingung.
 */
export function rcFoundReady(draft: RcFoundDraft): boolean {
  return draft.founderRoleId.trim() !== ''
    && rcIsSlug(draft.slug)
    && filled(draft.title, MAX_TITLE)
    && filled(draft.organizerName, MAX_NAME)
    && filled(draft.organizerAddress, MAX_ADDRESS);
}

/**
 * Soll unter dem Adressfeld der Hinweis zur Schreibweise stehen?
 *
 * Nur, wenn schon etwas dasteht. Ein Formular, das beim Oeffnen sofort ruegt,
 * was noch niemand getippt hat, liest sich wie ein Vorwurf.
 */
export function rcSlugComplaint(slug: string): boolean {
  return slug !== '' && !rcIsSlug(slug);
}
