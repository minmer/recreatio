/**
 * Was eine Pfarrseite ausmacht: Aufbau, Menü und Inhalt.
 *
 * <b>Drei Dinge, ein Dokument.</b> Der Aufbau sagt, was auf der Startseite
 * steht und wie gross; das Menü sagt, welche Unterseiten es gibt; der Inhalt
 * füllt sie. Getrennt gespeichert liefen sie auseinander — eine Unterseite im
 * Menü ohne Inhalt, ein Inhalt zu einer Seite, die niemand erreicht.
 *
 * <b>Welche Angaben gebraucht werden, folgt aus der Auswahl.</b> Niemand soll
 * eine Liste von vierzig Feldern ausfüllen, von denen dreissig auf seiner Seite
 * gar nicht vorkommen. Wer „Kancelaria" ins Menü nimmt, braucht Öffnungszeiten;
 * wer es weglässt, nicht. Das rechnet `rcNeededFields` aus — aus dem Menü UND
 * aus den Bausteinen der Startseite, denn beide zeigen Inhalt.
 *
 * <b>Ältere Fassungen bleiben lesbar.</b> Früher stand in `modules` nur eine
 * flache Liste von Bausteinnamen. `rcReadSite` erkennt das und macht daraus ein
 * Dokument, statt die Seite leer zu lassen.
 */

import type { RcModule } from './rcLayout';

/* -- Die Seiten, die es geben kann ---------------------------------------- */

export type RcFieldKind = 'line' | 'text' | 'hours';

export type RcFieldDef = {
  readonly key: string;
  readonly label: string;
  readonly kind: RcFieldKind;
  /** Ein Beispiel, kein Vorgabewert — es wird nicht gespeichert. */
  readonly hint?: string;
};

export type RcPageDef = {
  readonly id: string;
  readonly label: string;
  /** Unter welcher Überschrift die Seite im Menü vorgeschlagen wird. */
  readonly group: string;
  /** Was diese Seite braucht, um nicht leer zu sein. */
  readonly fields: readonly RcFieldDef[];
};

/**
 * Der Seitenkatalog.
 *
 * Die Gliederung stammt aus dem Menü der alten Seite (`Parafia`, `Aktualne`,
 * `Sakramenty`, `Wspólnoty`, `Kontakt`). Die Felder daneben sind das, was auf
 * jenen Seiten wirklich stand — nicht ausgedacht, sondern abgelesen.
 */
export const RC_PAGES: readonly RcPageDef[] = [
  {
    id: 'about', label: 'O parafii', group: 'Parafia',
    fields: [
      { key: 'about.patron', label: 'Patron', kind: 'line', hint: 'np. św. Grzegorz Wielki' },
      { key: 'about.history', label: 'Historia parafii', kind: 'text' },
      { key: 'about.description', label: 'Opis', kind: 'text' }
    ]
  },
  {
    id: 'clergy', label: 'Duszpasterze', group: 'Parafia',
    fields: [
      { key: 'clergy.list', label: 'Duszpasterze', kind: 'text', hint: 'Jedna osoba w wierszu: imię — funkcja' }
    ]
  },
  {
    id: 'office', label: 'Kancelaria', group: 'Parafia',
    fields: [
      { key: 'office.hours', label: 'Godziny kancelarii', kind: 'hours' },
      { key: 'office.note', label: 'Uwagi', kind: 'text', hint: 'np. w sprawach pogrzebu o każdej porze' }
    ]
  },
  {
    id: 'announcements', label: 'Ogłoszenia', group: 'Aktualne',
    fields: []
  },
  {
    id: 'intentions', label: 'Intencje', group: 'Aktualne',
    fields: []
  },
  {
    id: 'masses', label: 'Msze i nabożeństwa', group: 'Aktualne',
    fields: [
      { key: 'masses.sunday', label: 'Niedziela', kind: 'hours', hint: '7:00 — cicha' },
      { key: 'masses.weekdays', label: 'Dni powszednie', kind: 'hours' },
      { key: 'masses.devotions', label: 'Nabożeństwa', kind: 'hours' },
      { key: 'masses.confession', label: 'Spowiedź', kind: 'hours' }
    ]
  },
  {
    id: 'calendar', label: 'Kalendarz', group: 'Aktualne',
    fields: []
  },
  {
    id: 'sacrament-baptism', label: 'Chrzest', group: 'Sakramenty',
    fields: sacramentFields('baptism')
  },
  {
    id: 'sacrament-communion', label: 'I Komunia', group: 'Sakramenty',
    fields: sacramentFields('communion')
  },
  {
    id: 'sacrament-confirmation', label: 'Bierzmowanie', group: 'Sakramenty',
    fields: sacramentFields('confirmation')
  },
  {
    id: 'sacrament-marriage', label: 'Małżeństwo', group: 'Sakramenty',
    fields: sacramentFields('marriage')
  },
  {
    id: 'sacrament-funeral', label: 'Pogrzeb', group: 'Sakramenty',
    fields: sacramentFields('funeral')
  },
  {
    id: 'sacrament-sick', label: 'Sakrament chorych', group: 'Sakramenty',
    fields: sacramentFields('sick')
  },
  {
    id: 'community', label: 'Wspólnoty', group: 'Wspólnoty',
    fields: [
      { key: 'community.list', label: 'Wspólnoty', kind: 'text', hint: 'Jedna w wierszu: nazwa — kiedy się spotyka' }
    ]
  },
  {
    id: 'contact', label: 'Kontakt', group: 'Kontakt',
    fields: [
      { key: 'contact.address', label: 'Adres', kind: 'line', hint: 'ul. …, 00-000 Miasto' },
      { key: 'contact.phone', label: 'Telefon', kind: 'line' },
      { key: 'contact.email', label: 'E-mail', kind: 'line' }
    ]
  }
];

/**
 * Jede Sakramentenseite trägt dieselben drei Fragen.
 *
 * Das ist keine Vereinfachung, sondern das, womit jemand kommt: was muss ich
 * mitbringen, an wen wende ich mich, wann ist es. Drei Absätze Fliesstext
 * beantworten dieselbe Frage schlechter.
 */
function sacramentFields(name: string): readonly RcFieldDef[] {
  return [
    { key: `sacrament.${name}.lead`, label: 'Kiedy i jak', kind: 'text' },
    { key: `sacrament.${name}.bring`, label: 'Co przygotować', kind: 'text', hint: 'Jedna rzecz w wierszu' },
    { key: `sacrament.${name}.who`, label: 'Kto prowadzi', kind: 'line' }
  ];
}

export const rcPage = (id: string): RcPageDef | undefined =>
  RC_PAGES.find((p) => p.id === id);

/* -- Das Menü -------------------------------------------------------------- */

/**
 * Ein Menüpunkt. Entweder er zeigt auf eine Seite, oder er trägt Kinder —
 * beides zugleich gibt es nicht.
 *
 * Zwei Ebenen und nicht mehr: ein drittes Untermenü ist auf einer Pfarrseite
 * noch nie nötig gewesen, und es wäre auf dem Telefon nicht bedienbar.
 */
export type RcMenuNode = {
  readonly label: string;
  readonly pageId?: string;
  readonly children?: readonly { readonly label: string; readonly pageId: string }[];
};

/** Welche Seiten das Menü wirklich erreicht — flach gelesen. */
export function rcMenuPages(menu: readonly RcMenuNode[]): readonly string[] {
  const found: string[] = [];
  for (const node of menu) {
    if (node.pageId !== undefined) found.push(node.pageId);
    for (const child of node.children ?? []) found.push(child.pageId);
  }
  return [...new Set(found)];
}

/* -- Was Bausteine an Inhalt brauchen -------------------------------------- */

/**
 * Ein Baustein auf der Startseite zeigt denselben Inhalt wie eine Unterseite.
 *
 * Wer „Godziny" auf die Startseite legt, braucht die Öffnungszeiten — auch
 * wenn „Kancelaria" nicht im Menü steht. Ohne diese Zuordnung bliebe der
 * Baustein leer und niemand wüsste, welches Feld ihn füllt.
 */
const MODULE_PAGES: Record<string, string> = {
  intentions: 'intentions',
  news: 'announcements',
  announcements: 'announcements',
  masses: 'masses',
  hours: 'office',
  calendar: 'calendar',
  sacraments: 'sacrament-baptism',
  groups: 'community',
  contact: 'contact'
};

/* -- Das Dokument ---------------------------------------------------------- */

export type RcSite = {
  readonly modules: readonly RcModule[];
  readonly menu: readonly RcMenuNode[];
  readonly content: Readonly<Record<string, string>>;
};

export const RC_EMPTY_SITE: RcSite = { modules: [], menu: [], content: {} };

/**
 * Welche Felder ausgefüllt werden müssen — aus Menü UND Startseite.
 *
 * Die Reihenfolge folgt dem Katalog und nicht der Reihenfolge des Anklickens:
 * eine Liste, die sich umsortiert, sobald jemand einen Menüpunkt hinzufügt,
 * ist beim zweiten Mal nicht wiederzuerkennen.
 */
export function rcNeededFields(site: RcSite): readonly { page: RcPageDef; fields: readonly RcFieldDef[] }[] {
  const wanted = new Set(rcMenuPages(site.menu));

  for (const module of site.modules) {
    const pageId = MODULE_PAGES[module.type];
    if (pageId !== undefined) wanted.add(pageId);
  }

  return RC_PAGES
    .filter((page) => wanted.has(page.id) && page.fields.length > 0)
    .map((page) => ({ page, fields: page.fields }));
}

/** Wie viele der gebrauchten Felder noch leer sind. */
export function rcMissingCount(site: RcSite): number {
  let missing = 0;
  for (const { fields } of rcNeededFields(site)) {
    for (const field of fields) {
      if ((site.content[field.key] ?? '').trim() === '') missing += 1;
    }
  }
  return missing;
}

/**
 * Das gespeicherte Dokument lesen.
 *
 * <b>Drei Formen müssen durch:</b> das heutige Dokument, die ältere flache
 * Liste von Bausteinnamen, und kaputter Text. Nur die letzte ergibt eine leere
 * Seite — und selbst die nimmt der Pfarrei nicht ihre Website, sie zeigt dann
 * die Vorgabe.
 */
export function rcReadSite(text: string | null | undefined): RcSite {
  if (text === null || text === undefined || text.trim() === '') return RC_EMPTY_SITE;

  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return RC_EMPTY_SITE; }

  // Die alte Form: eine Liste. Entweder Namen oder schon ganze Bausteine.
  if (Array.isArray(parsed)) {
    return { ...RC_EMPTY_SITE, modules: parsed.filter(isModule) };
  }

  if (typeof parsed !== 'object' || parsed === null) return RC_EMPTY_SITE;
  const doc = parsed as Partial<RcSite>;

  return {
    modules: Array.isArray(doc.modules) ? doc.modules.filter(isModule) : [],
    menu: Array.isArray(doc.menu) ? doc.menu.filter(isMenuNode) : [],
    content: typeof doc.content === 'object' && doc.content !== null
      ? Object.fromEntries(
          Object.entries(doc.content).filter(([, v]) => typeof v === 'string')
        ) as Record<string, string>
      : {}
  };
}

const isModule = (m: unknown): m is RcModule =>
  typeof m === 'object' && m !== null
  && typeof (m as RcModule).id === 'string'
  && typeof (m as RcModule).type === 'string'
  && typeof (m as RcModule).layouts === 'object';

const isMenuNode = (n: unknown): n is RcMenuNode =>
  typeof n === 'object' && n !== null && typeof (n as RcMenuNode).label === 'string';
