/**
 * Eine Veranstaltung aus fertigem JSON.
 *
 * <b>Wofuer.</b> Eine Veranstaltung von Hand zusammenzuklicken — drei Seiten,
 * vierzehn Formularfelder, vierzehn Abschnitte mit Hintergruenden — dauert einen
 * Nachmittag. Wer die vom letzten Jahr schon hat, will sie einspielen und dann
 * aendern.
 *
 * <b>Warum das Lesen hier steht und nicht im Bauteil.</b> Fremdes JSON ist die
 * Stelle, an der ein Programm am leisesten danebengeht: ein Feld heisst anders,
 * eine Liste ist keine, eine Art gibt es nicht — und das Ergebnis ist eine
 * Veranstaltung, der still die Haelfte fehlt. Sie SIEHT vollstaendig aus. Als
 * reine Funktion laesst sich jeder dieser Faelle durchrechnen, ohne etwas
 * anzulegen.
 *
 * <b>Was NICHT stillschweigend verschwindet.</b> Eine unbekannte Art wird
 * gemeldet, nicht uebergangen. Wer eine Datei mit einem `roster` einspielt und
 * hinterher keinen findet, sucht den Fehler bei sich.
 *
 * <b>Die Datei behaelt die Form des alten Moduls</b> — `config` und `layers`
 * getrennt, `fields` am Formular, Katalogfelder oben. Sie ist von Hand zu lesen
 * und zu schreiben, und die vorhandenen Dateien passen ohne Umbau. Dass rc die
 * Schichten INNEN in der Einstellung fuehrt, ist eine Frage der Ablage und
 * gehoert nicht in ein Dokument, das ein Mensch tippt: der Leser fuegt sie
 * zusammen.
 */

import { asArray, asBool, asOptionalText, asRecord, asText, asStringList } from './parts/contracts';
import { getPartModule } from './parts/registry';

export type RcImportField = {
  readonly kind: string;
  readonly label: string;
  readonly helpText: string | null;
  readonly options: readonly string[] | null;
  readonly isRequired: boolean;
  readonly isHalfWidth: boolean;
  readonly identityRole: 'none' | 'name' | 'contact';
};

export type RcImportPart = {
  readonly kind: string;
  readonly menuLabel: string | null;
  readonly title: string | null;
  readonly intro: string | null;
  readonly configJson: string | null;
  readonly isPublic: boolean;
  /** Nur am Formular. Sie sind eigene Zeilen, keine Einstellung. */
  readonly fields: readonly RcImportField[];
};

export type RcImportPage = {
  readonly slug: string;
  readonly title: string;
  readonly menuLabel: string | null;
  /**
   * ABSICHT, keine Ableitung. Eine noch leere interne Seite gaebe sich sonst
   * als oeffentlich aus, und die erste Zuteilung liefe ins Leere.
   */
  readonly kind: 'public' | 'internal';
  readonly parts: readonly RcImportPart[];
};

/** Was der Katalog von der Veranstaltung wissen will. */
export type RcImportHead = {
  /**
   * Die Adresse, die in der Datei steht — als VORSCHLAG.
   *
   * Sie entscheidet nicht: die Adresse ist oeffentlich und bleibt, und wer
   * eine Datei einspielt, soll sehen, welche er vergibt, statt eine
   * zugeteilt zu bekommen. Aber sie ungenutzt zu lassen hiess, sie
   * abtippen zu muessen, obwohl sie danebensteht.
   */
  readonly slug: string | null;
  readonly subtitle: string | null;
  readonly summary: string | null;
  readonly category: string | null;
  readonly audience: string | null;
  readonly places: readonly string[];
  readonly thumbnailUrl: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly dateLabel: string | null;
  readonly themeJson: string | null;
};

export type RcImportPlan = {
  readonly title: string;
  readonly head: RcImportHead;
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

/** Ein Tag als `RRRR-MM-TT`, oder nichts. Alles andere ist kein Datum. */
function asDay(value: unknown): string | null {
  const text = asText(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

/**
 * Einstellung und Schichten zu EINEM Text.
 *
 * In der Datei stehen sie getrennt, weil sich das von Hand besser liest; in rc
 * gehoeren die Schichten in die Einstellung, weil sie Teil dessen sind, was ein
 * Abschnitt IST — in zwei Feldern gefuehrt gehen sie beim Kopieren auseinander:
 * der Text zieht um, die Farbe bleibt.
 */
function readConfig(part: Record<string, unknown>): string | null {
  const raw = part.configJson ?? part.config ?? null;

  let base: Record<string, unknown> = {};
  if (typeof raw === 'string' && raw.trim() !== '') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        base = parsed as Record<string, unknown>;
      }
    } catch { /* Kaputte Einstellung kostet die Einstellung, nicht den Abschnitt. */ }
  } else if (raw !== null && raw !== undefined) {
    base = asRecord(raw);
  }

  const layers = part.layers;
  if (Array.isArray(layers) && layers.length > 0) base = { ...base, layers };

  return Object.keys(base).length === 0 ? null : JSON.stringify(base, null, 2);
}

const IDENTITY = ['none', 'name', 'contact'] as const;

function readFields(part: Record<string, unknown>, where: string, skipped: string[]): RcImportField[] {
  const fields: RcImportField[] = [];

  for (const [n, raw] of asArray(part.fields).entries()) {
    const field = asRecord(raw);
    const label = asText(field.label).trim();
    const kind = asText(field.kind).trim();

    if (label === '' || kind === '') {
      skipped.push(`${where} · pole ${n + 1}: brak nazwy albo rodzaju.`);
      continue;
    }

    const options = asStringList(field.options);
    const role = asText(field.identityRole).trim();

    fields.push({
      kind,
      label,
      helpText: asOptionalText(field.helpText),
      options: options.length === 0 ? null : options,
      isRequired: asBool(field.isRequired),
      isHalfWidth: asBool(field.isHalfWidth),
      identityRole: (IDENTITY as readonly string[]).includes(role)
        ? (role as RcImportField['identityRole'])
        : 'none'
    });
  }

  return fields;
}

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

    const internal = asText(page.kind).trim() === 'internal';
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

      parts.push({
        kind,
        menuLabel: asOptionalText(part.menuLabel),
        title: asOptionalText(part.title),
        intro: asOptionalText(part.intro),
        configJson: readConfig(part),

        /*
         * DIE SEITE KANN NUR VERSIEGELN, NIE OEFFNEN.
         *
         * Auf einer internen Seite ist jeder Abschnitt versiegelt, was auch
         * immer die Datei behauptet: stuende dort „oeffentlich", laege der
         * Inhalt im Klartext, und die Adresse allein genuegte zum Lesen.
         *
         * Umgekehrt gilt das NICHT. Auf einer oeffentlichen Seite darf ein
         * einzelner Abschnitt versiegelt sein — „dieser Teil nur fuer
         * Mitglieder" ist eine Sache, die rc kann und die das alte Modul nicht
         * kannte. Die Seite zur alleinigen Entscheiderin zu machen haette sie
         * beim Einspielen stillschweigend geoeffnet.
         */
        isPublic: !internal && part.isPublic !== false,
        fields: readFields(part, `${pageTitle} · część ${n + 1}`, skipped)
      });
    }

    pages.push({
      slug: pageSlug,
      title: pageTitle,
      menuLabel: asOptionalText(page.menuLabel),
      kind: internal ? 'internal' : 'public',
      parts
    });
  }

  if (pages.length === 0) {
    return { ok: false, error: 'Żadnej strony nie dało się odczytać.' };
  }

  const theme = root.theme;
  const places = asStringList(root.places);

  return {
    ok: true,
    plan: {
      title,
      head: {
        slug: asOptionalText(root.slug),
        subtitle: asOptionalText(root.subtitle),
        summary: asOptionalText(root.summary),
        category: asOptionalText(root.category),
        audience: asOptionalText(root.audience),
        places,
        thumbnailUrl: asOptionalText(root.thumbnailUrl),
        startDate: asDay(root.startDate),
        endDate: asDay(root.endDate),
        dateLabel: asOptionalText(root.dateLabel),
        themeJson: theme === null || theme === undefined || Object.keys(asRecord(theme)).length === 0
          ? null
          : JSON.stringify(asRecord(theme))
      },
      pages,
      skipped
    }
  };
}

/** Wie viel der Plan anlegen wird — fuer die Vorschau vor dem Einspielen. */
export function rcImportSize(plan: RcImportPlan): { pages: number; parts: number; fields: number } {
  return {
    pages: plan.pages.length,
    parts: plan.pages.reduce((sum, page) => sum + page.parts.length, 0),
    fields: plan.pages.reduce(
      (sum, page) => sum + page.parts.reduce((n, part) => n + part.fields.length, 0), 0)
  };
}
