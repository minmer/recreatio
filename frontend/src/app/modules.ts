/**
 * Der Bausteinkatalog.
 *
 * <b>Nur, was sich heute zeigen lässt.</b> Der Altbestand hatte zwölf Arten —
 * Intencje, Msze, Kalendarz, Galeria. Die meisten hingen an Quellen, die es im
 * Neubau nicht gab. Eine Kachel anzubieten, die dauerhaft leer bleibt, ist
 * keine Vorbereitung, sondern ein Versprechen, das die Seite nicht hält.
 *
 * <b>Die Messen haben ihre Quelle inzwischen</b> (`app.calendar_item` mit
 * `kind = 'mass'` und die Intentionen an ihren Vorkommen), und deshalb stehen
 * sie hier. Die Galerie nicht: dort fehlt sie weiterhin, und solange sie fehlt,
 * gehört sie nicht in diese Liste.
 *
 * Alles andere hier trägt seinen Inhalt selbst und erscheint sofort. Was ihn
 * woanders herholt, sagt es mit `live` — sonst blendet die Seite es aus.
 *
 * <b>Die Felder folgen der Art.</b> Wer „Kontakt" auf die Seite legt, bekommt
 * Adresse, Telefon und E-Mail — und nicht eine Liste von vierzig Feldern, von
 * denen dreissig auf seiner Seite nicht vorkommen. Das war die beste Idee des
 * alten Editors, und sie kostet nichts.
 *
 * <b>Die Vorgabegrössen sind abgelesen, nicht geraten:</b> ein Text ist breit
 * und hoch, ein Hinweis schmal und flach.
 */

export type FieldKind = 'line' | 'text';

export interface FieldDef {
  readonly key: string;
  readonly label: string;
  readonly kind: FieldKind;
  /** Ein Beispiel, kein Vorgabewert — es wird nicht gespeichert. */
  readonly hint?: string;
}

export interface ModuleDef {
  readonly kind: string;
  readonly label: string;
  readonly colSpan: number;
  readonly rowSpan: number;
  readonly fields: readonly FieldDef[];

  /**
   * Holt dieser Baustein seinen Inhalt WOANDERS her?
   *
   * <b>Ohne diese Angabe verschwände er.</b> Die Seite blendet aus, was ein
   * leeres `config` hat (`isEmpty`) — und das ist für Text und Kontakt richtig:
   * eine Kachel mit einer Überschrift und nichts darunter sieht aus wie ein
   * Fehler. In einem Messplan steht aber nur, WELCHER Kalender und wie er
   * aussehen soll; sein Inhalt liegt in `app.calendar_item` und kommt erst beim
   * Aufruf. Er fiele damit lautlos aus der Seite, und zwar genau dann, wenn er
   * richtig eingerichtet ist.
   *
   * Die Ausnahme steht deshalb hier am Baustein und nicht als Sonderfall in
   * der Zeichnung: dort wäre sie eine Bedingung auf einen Namen, und der
   * nächste Baustein dieser Art hätte sie wieder nicht.
   */
  readonly live?: boolean;
}

export const CATALOG: readonly ModuleDef[] = [
  {
    kind: 'text', label: 'Tekst', colSpan: 3, rowSpan: 3,
    fields: [
      { key: 'title', label: 'Nagłówek', kind: 'line' },
      { key: 'body', label: 'Treść', kind: 'text' }
    ]
  },
  {
    /*
     * Der einzige Baustein, der seinen Inhalt NICHT im `config` trägt: die
     * Messen stehen in `app.calendar_item`, die Intentionen an ihren
     * Vorkommen. Hier steht nur, WELCHER Kalender und wie er aussehen soll —
     * deshalb `live`.
     */
    kind: 'masses', label: 'Msze i intencje', colSpan: 3, rowSpan: 3, live: true,
    fields: [
      { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Porządek mszy' },
      /*
       * Der Kalender, dessen Messen hier hängen — leer heisst: ALLE, die offen
       * liegen, mit der Angabe woher. Gezeigt wird davon ohnehin nur, was unter
       * einem Bereich mit offengelegter Epoche steht; ein fremder Kalender ist
       * also kein Einbruch, sondern eine Auskunft, die jemand offengelegt hat.
       */
      { key: 'calendar', label: 'Kalendarz', kind: 'line', hint: 'Kennung — puste: wszystkie jawne' },
      { key: 'days', label: 'Ile dni pokazać', kind: 'line', hint: '7' }
    ]
  },
  {
    /*
     * Das Formular. Wie der Messplan holt es seinen Inhalt woanders her — aber
     * anders als dieser hat es keinen Verweis im `config`: die FELDER hängen
     * am Baustein selbst (`app.slug_field`), denn eine Antwort zeigt auf ein
     * Feld, und ein Feld muss eine Zeile sein, damit sie darauf zeigen kann.
     *
     * Deshalb `live`: `config` trägt nur die Überschrift, und ohne diese
     * Ausnahme fiele der Baustein genau dann aus der Seite, wenn er richtig
     * eingerichtet ist.
     */
    kind: 'form', label: 'Formularz', colSpan: 3, rowSpan: 3, live: true,
    fields: [
      { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Zgłoszenie' }
    ]
  },
  {
    kind: 'notice', label: 'Ogłoszenie', colSpan: 2, rowSpan: 1,
    fields: [
      { key: 'body', label: 'Treść', kind: 'text', hint: 'Krótko — to ma rzucać się w oczy' }
    ]
  },
  {
    kind: 'hours', label: 'Godziny', colSpan: 2, rowSpan: 3,
    fields: [
      { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Kancelaria' },
      { key: 'body', label: 'Godziny', kind: 'text', hint: 'Jedna pozycja w wierszu: wtorek — 16:00–18:00' }
    ]
  },
  {
    kind: 'contact', label: 'Kontakt', colSpan: 2, rowSpan: 3,
    fields: [
      { key: 'address', label: 'Adres', kind: 'line', hint: 'ul. …, 00-000 Miasto' },
      { key: 'phone', label: 'Telefon', kind: 'line' },
      { key: 'email', label: 'E-mail', kind: 'line' }
    ]
  },
  {
    kind: 'links', label: 'Odnośniki', colSpan: 2, rowSpan: 3,
    fields: [
      { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Zobacz też' },
      {
        key: 'body', label: 'Odnośniki', kind: 'text',
        hint: 'Jeden w wierszu: Ogłoszenia — parish/ogloszenia'
      }
    ]
  }
];

export const moduleDef = (kind: string): ModuleDef | undefined =>
  CATALOG.find((m) => m.kind === kind);

/** Der Name einer Art — oder ihr Schlüssel, wenn es sie nicht (mehr) gibt. */
export const moduleLabel = (kind: string): string => moduleDef(kind)?.label ?? kind;

/**
 * Der Inhalt eines Bausteins, aus seinem gespeicherten `config` gelesen.
 *
 * <b>Duldsam gegenüber allem, was nicht passt.</b> Was hier ankommt, hat den
 * Dienst als Zeichenkette passiert — er liest es nicht und prüft es nicht. Ein
 * kaputter Eintrag darf deshalb die Seite nicht leeren, sondern nur sich
 * selbst: aus Unlesbarem wird ein leerer Baustein, und der Rest steht weiter da.
 */
export function readConfig(text: string | null | undefined): Record<string, string> {
  if (text === null || text === undefined || text.trim() === '') return {};

  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return {}; }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};

  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>)
      .filter(([, value]) => typeof value === 'string')
  ) as Record<string, string>;
}

/** Ob ein Baustein überhaupt etwas zu zeigen hat. */
export const isEmpty = (config: Record<string, string>): boolean =>
  Object.values(config).every((value) => value.trim() === '');

/**
 * Eine Zeile eines Odnośniki-Bausteins: „Beschriftung — adresse".
 *
 * Der Gedankenstrich trennt, weil er in einer Beschriftung selten vorkommt und
 * in einer Adresse gar nicht. Fehlt er, ist die ganze Zeile die Adresse — und
 * die Beschriftung auch.
 */
export function readLink(line: string): { label: string; path: string } | null {
  const text = line.trim();
  if (text === '') return null;

  const at = text.indexOf('—') >= 0 ? text.indexOf('—') : text.indexOf(' - ');
  if (at < 0) return { label: text, path: text };

  const label = text.slice(0, at).trim();
  const path = text.slice(at + (text[at] === '—' ? 1 : 3)).trim().replace(/^\/+/, '');

  return path === '' ? null : { label: label === '' ? path : label, path };
}
