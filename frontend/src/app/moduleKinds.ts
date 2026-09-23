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

import { call } from './session';

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

  /**
   * Nimmt dieser Baustein EINSENDUNGEN an?
   *
   * <b>Nur dann ist die Frage sinnvoll, wovon er handelt.</b> Ein Aushangtext
   * handelt von niemandem; ihn danach zu fragen hiesse, eine Auswahl
   * hinzustellen, deren einzige richtige Antwort „keine" ist. Ein Bogen
   * dagegen erzeugt einen Platz, und ein Platz muss jemandem gehören.
   */
  readonly takes?: boolean;
}

export const CATALOG: readonly ModuleDef[] = [
  {
    /*
     * ÜBER DIE GANZE BREITE, nicht über die halbe.
     *
     * Dieser Baustein trägt den Fliesstext einer Seite — bei der Firmung sind
     * das mehrere Absätze am Stück. Mit `colSpan: 3` bekam jeder davon die
     * halbe Spalte, und wer eine Seite schrieb, musste JEDEN einzeln breiter
     * ziehen; wer es vergass, hatte eine Seite, die zur Hälfte leer aussieht.
     *
     * Eine Vorgabe ist keine Fessel: nebeneinander stellt man zwei Texte
     * weiterhin, indem man sie schmaler zieht. Nur ist das jetzt der seltenere
     * Fall, und der seltenere Fall soll die Arbeit machen.
     */
    kind: 'text', label: 'Tekst', colSpan: 6, rowSpan: 3,
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
    kind: 'form', label: 'Formularz', colSpan: 3, rowSpan: 3, live: true, takes: true,
    fields: [
      { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Zgłoszenie' },

      /*
       * DIE NACHRICHT, EINMAL GESCHRIEBEN. Sie steht im Baustein und nicht in
       * einer Einstellung des Bereichs: wer dieses Formular führt, schreibt
       * auch, was danach verschickt wird.
       */
      {
        key: 'sms', label: 'Szablon wiadomości', kind: 'text',
        hint: 'Cześć {Imię i nazwisko}! Twoja strona: {link}'
      }
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
  /* -- Was nur in einem PORTAL etwas zeigt (0028) ------------------------- */

  /*
   * Drei Bausteine, die ihren Inhalt aus dem PLATZ nehmen und nicht aus ihrem
   * `config`. Deshalb `live`: sonst fielen sie aus der Seite, weil sie leer
   * aussehen — dieselbe Ausnahme wie beim Messplan und beim Formular.
   *
   * Auf einer gewöhnlichen Seite sagen sie, dass sie hier nichts zeigen können.
   * Das ist besser als nichts: wer sie versehentlich dorthin legt, erfährt es,
   * statt sich zu wundern.
   */
  {
    kind: 'seat-submission', label: 'Zgłoszenie osoby', colSpan: 3, rowSpan: 3, live: true, takes: true,
    fields: [
      { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Twoje zgłoszenie' },
      {
        key: 'editable', label: 'Czy można poprawiać', kind: 'line',
        hint: 'tak albo nie — puste znaczy tak'
      }
    ]
  },
  {
    kind: 'seat-note', label: 'Wiadomość dla osoby', colSpan: 3, rowSpan: 2, live: true,
    fields: [
      { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Od kancelarii' }
    ]
  },
  {
    kind: 'seat-shared', label: 'Wspólne terminy', colSpan: 3, rowSpan: 3, live: true,
    fields: [
      { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Najbliższe spotkania' }
    ]
  },

  {
    /*
     * TERMINE ZUM AUSSUCHEN (0029). Der Baustein nennt einen KALENDER — dieselbe
     * Form wie beim Messplan (0020): ein Baustein weiss nicht, unter welcher
     * Adresse er hängt, wohl aber, woraus er seinen Inhalt nimmt.
     *
     * Deshalb steht hier nichts über die Firmung. Derselbe Baustein trägt die
     * Termine einer Beichte, eines Elterngesprächs oder einer Probe; was ihn
     * unterscheidet, ist der Kalender, den er nennt.
     */
    kind: 'slots', label: 'Terminy do wyboru', colSpan: 3, rowSpan: 3, live: true,
    fields: [
      { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Wybierz termin spotkania' },
      { key: 'calendar', label: 'Kalendarz', kind: 'line', hint: 'Kennung kalendarza z terminami' }
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

/** Erzeugt diese Art Plätze? Dann muss dastehen, wem sie gehören. */
export const takesEntries = (kind: string): boolean => moduleDef(kind)?.takes === true;

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

/* -- Die Bausteine selbst (0036) ------------------------------------------- */

/**
 * Ein Baustein ist ein DING, kein Platz auf einer Seite.
 *
 * <b>Er gehört in einen Bereich</b> — dort liegen seine Daten. Die Seite zeigt
 * ihn; sie besitzt ihn nicht. Deshalb ist „derselbe Bogen auf zwei Seiten" kein
 * Sonderfall mehr, sondern zwei Verwendungen eines Bausteins, mit EINEM Satz
 * Fragen und EINEM Satz Antworten.
 *
 * <b>`areaId` darf fehlen.</b> Ein Text trägt nichts Versiegeltes; sein Inhalt
 * steht offen, weil er auf einem Aushang steht. Für ihn entscheidet die Seite.
 */
/**
 * WOVON ein Baustein handelt (0038).
 *
 * <b>Daran hängt, woran der Platz hängt, den eine Einsendung erzeugt.</b> Ein
 * Link muss zu etwas gehören — zu einem Menschen, zu einer Gruppe, zu einem
 * Amt. „Zu irgendetwas" ist keine Antwort, und genau deshalb steht es am
 * Baustein und nicht im Kopf dessen, der ihn gebaut hat.
 */
export const SUBJECTS = ['none', 'person', 'group', 'role'] as const;
export type Subject = (typeof SUBJECTS)[number];

export const SUBJECT_LABEL: Record<Subject, string> = {
  none: 'Niczyj — zwykły formularz',
  person: 'Osoby',
  group: 'Grupy',
  role: 'Roli'
};

export interface ModuleRow {
  readonly moduleId: string;
  readonly areaId: string | null;
  readonly areaName: string | null;
  readonly kind: string;
  readonly name: string;
  readonly config: string | null;
  readonly createdAt: string;

  /** Wovon er handelt — `'none'` heisst: von nichts Benanntem. */
  readonly forKind: Subject;

  /** Auf wie vielen Seiten er steht. `0` ist ein echter Zustand. */
  readonly usedOnPages: number;

  /** Wie viel er trägt — ein Bogen mit Antworten lässt sich nicht mehr umziehen. */
  readonly fields: number;
  readonly entries: number;
}

export const loadModules = (): Promise<{ modules: readonly ModuleRow[] }> =>
  call('/workspace/modules');

export const createModule = (
  moduleId: string, kind: string, name: string, areaId: string | null,
  forKind: Subject = 'none', config?: string
): Promise<{ moduleId: string }> =>
  call('/workspace/module', {
    method: 'POST',
    body: JSON.stringify({ moduleId, kind, name, areaId, forKind, config: config ?? '{}' })
  });

/**
 * Umbenennen, den Bereich setzen, die Einstellung ändern.
 *
 * <b>Den Bereich zu WECHSELN geht nur, solange er leer ist.</b> Was unter dem
 * alten Schlüssel liegt, bleibt darunter — der Dienst kann es nicht
 * umschlüsseln, er hat keinen Schlüssel. Der Dienst lehnt das ab; hier steht
 * es, damit die Oberfläche es vorher sagen kann.
 */
export const updateModule = (
  moduleId: string,
  change: {
    name?: string; areaId?: string; clearArea?: boolean; config?: string;

    /** Nur solange nichts eingegangen ist — sonst lehnt der Dienst ab (409). */
    forKind?: Subject;
  }
): Promise<{ moduleId: string; areaId: string | null; name: string }> =>
  call(`/workspace/module/${encodeURIComponent(moduleId)}`, {
    method: 'POST',
    body: JSON.stringify(change)
  });

export const removeModule = (moduleId: string): Promise<{ removed: boolean }> =>
  call(`/workspace/module/${encodeURIComponent(moduleId)}`, { method: 'DELETE' });
