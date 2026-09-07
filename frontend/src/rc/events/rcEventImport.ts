/**
 * Eine Veranstaltung aus fertigem JSON.
 *
 * <b>Wofuer.</b> Eine Veranstaltung von Hand zusammenzuklicken — vier Seiten,
 * einundzwanzig Abschnitte — dauert einen Nachmittag. Wer die vom letzten Jahr
 * schon hat, will sie einspielen und dann aendern.
 *
 * <b>Warum das Lesen hier steht und nicht im Bauteil.</b> Fremdes JSON ist die
 * Stelle, an der ein Programm am leisesten danebengeht: ein Feld heisst anders,
 * eine Liste ist keine, eine Art gibt es nicht — und das Ergebnis ist eine
 * Veranstaltung, der still die Haelfte fehlt. Als reine Funktion laesst sich
 * jeder dieser Faelle durchrechnen, ohne etwas anzulegen.
 *
 * <b>Was NICHT stillschweigend verschwindet.</b> Eine unbekannte Art wird
 * gemeldet, nicht uebergangen. Wer eine Datei mit einem `roster` einspielt und
 * hinterher keinen findet, sucht den Fehler bei sich.
 */

import { asArray, asOptionalText, asRecord, asText } from './parts/contracts';
import { getPartModule } from './parts/registry';

export type RcImportPart = {
  readonly kind: string;
  readonly menuLabel: string | null;
  readonly title: string | null;
  readonly intro: string | null;
  readonly configJson: string | null;
  readonly isPublic: boolean;
};

export type RcImportPage = {
  readonly slug: string;
  readonly title: string;
  readonly parts: readonly RcImportPart[];
};

export type RcImportPlan = {
  readonly title: string;
  readonly pages: readonly RcImportPage[];
  /**
   * Was gelesen wurde, aber nicht gebaut werden kann — mit Grund.
   *
   * Sie stehen NEBEN dem Plan, nicht statt seiner: eine Datei mit einem
   * unbekannten Abschnitt soll den Rest trotzdem einspielen koennen, und wer
   * sie schickt, soll wissen, was fehlen wird.
   */
  readonly skipped: readonly string[];
};

export type RcImportResult =
  | { readonly ok: true; readonly plan: RcImportPlan }
  | { readonly ok: false; readonly error: string };

/**
 * JSON lesen und in einen Bauplan verwandeln.
 *
 * <b>Streng an der Wurzel, nachsichtig in den Blaettern.</b> Ohne Titel oder
 * ohne Seiten gibt es nichts zu bauen — das ist ein Fehler und wird gesagt.
 * Ein fehlender Vorspann in einem Abschnitt ist keiner: er ist eben leer.
 */
export function rcReadImport(text: string): RcImportResult {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: false, error: 'Nie wklejono niczego.' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: 'To nie jest poprawny JSON.' };
  }

  const root = asRecord(parsed);

  const title = asText(root.title).trim();
  if (title === '') return { ok: false, error: 'Brakuje pola „title".' };

  const rawPages = asArray(root.pages);
  if (rawPages.length === 0) return { ok: false, error: 'Brakuje stron („pages").' };

  const skipped: string[] = [];
  const pages: RcImportPage[] = [];

  for (const [index, rawPage] of rawPages.entries()) {
    const page = asRecord(rawPage);

    const pageSlug = asText(page.slug).trim();
    const pageTitle = asText(page.title).trim();

    if (pageSlug === '' || pageTitle === '') {
      skipped.push(`Strona ${index + 1}: brak adresu albo tytułu.`);
      continue;
    }

    const parts: RcImportPart[] = [];

    for (const [n, rawPart] of asArray(page.parts).entries()) {
      const part = asRecord(rawPart);
      const kind = asText(part.kind).trim();

      /*
       * EINE UNBEKANNTE ART WIRD GEMELDET, NICHT UEBERGANGEN.
       *
       * Sie stillschweigend wegzulassen hiesse: die Veranstaltung entsteht,
       * sieht vollstaendig aus, und es fehlt ein Abschnitt, den niemand
       * vermisst — bis jemand ihn sucht.
       */
      if (getPartModule(kind) === null) {
        skipped.push(`${pageTitle} · część ${n + 1}: nieznany rodzaj „${kind || '?'}".`);
        continue;
      }

      /*
       * Die Einstellung darf als Text ODER als Objekt kommen. Wer eine Datei
       * von Hand schreibt, schreibt ein Objekt; wer eine ausgibt, bekommt
       * Text. Beides abzulehnen waere Pedanterie, beides zu deuten ist eine
       * Zeile.
       */
      const config = part.configJson ?? part.config ?? null;
      const configJson = config === null || config === undefined
        ? null
        : typeof config === 'string' ? config : JSON.stringify(config, null, 2);

      parts.push({
        kind,
        menuLabel: asOptionalText(part.menuLabel),
        title: asOptionalText(part.title),
        intro: asOptionalText(part.intro),
        configJson,
        // Oeffentlich, wenn nichts anderes dasteht: eine eingespielte
        // Veranstaltung ist ein Plakat, kein Geheimnis.
        isPublic: part.isPublic !== false
      });
    }

    pages.push({ slug: pageSlug, title: pageTitle, parts });
  }

  if (pages.length === 0) {
    return { ok: false, error: 'Żadnej strony nie dało się odczytać.' };
  }

  return { ok: true, plan: { title, pages, skipped } };
}

/** Wie viele Abschnitte der Plan anlegen wird — fuer die Vorschau. */
export function rcImportSize(plan: RcImportPlan): { pages: number; parts: number } {
  return {
    pages: plan.pages.length,
    parts: plan.pages.reduce((sum, page) => sum + page.parts.length, 0)
  };
}
