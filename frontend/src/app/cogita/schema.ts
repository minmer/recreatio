/**
 * COGITA — DAS SCHEMA, das der Mensch selbst erklärt (COGITA.md §2.2).
 *
 * <b>Eine Art ist DATEN.</b> Bisher stand jede Art der Bibliothek im Code
 * (`libraryKinds.ts`): wer eine neue wollte, brauchte eine neue Fassung der
 * Seite. Hier ist eine Art ein Eintrag wie jeder andere — versiegelt in der
 * Bibliothek, mit ihren Feldern, einem Muster für das Etikett und dem Feld, das
 * Gleichnamige auseinanderhält. Der Code kennt nur die Mechanik: Feldtypen,
 * Werte mit ihrer Unsicherheit, Daten mit Genauigkeit, Spannen aus mehreren
 * Stücken, Verweise mit einem Namen für die Gegenseite.
 *
 * <b>Ein Eintrag kann mehrere Arten haben</b> [B11] — ein Mensch, der Autor und
 * zugleich eine Gestalt der Erzählung ist. Seine Felder sind die Vereinigung
 * aller seiner Arten; das Etikett kommt von der ersten.
 *
 * <b>Ein Wert kann unsicher sein</b> [B3, B5], aber nur, wo das Feld es
 * erlaubt: dann trägt er einen Stand (sicher, ungefähr, strittig …), eine
 * Quelle — ein Werk der Bibliothek samt Stelle, damit die Fußnote aus dem
 * vorhandenen Zitierteil kommt [B4] — und eine Notiz. Drei Geburtsjahre aus
 * drei Quellen stehen nebeneinander; keines wird weggerechnet.
 *
 * <b>Rein und duldsam</b>, wie `part.ts`: was nicht passt, fällt weg oder nimmt
 * die Vorgabe an; geworfen wird nie. Was ein Eintrag trägt und das Schema nicht
 * (mehr) kennt, bleibt stehen und heisst „poza schematem" [B13] — es wird
 * gezeigt, nicht gelöscht.
 */

import { plainText } from '../library/libraryMarkup';
import { blocksIn, blocksTitle, type CommentBlock } from '../library/blocks';
import { formatBible, parseBible } from '../library/bible';
import { findUnit, fromSI, guessKind, kindById, measures, quantityText, siUnitOf, toSI, unitById, type Unit } from '../core/quantities';

/* -- Wörterbücher ------------------------------------------------------------------ */

/*
 * 2026-10-23 — `blocks` (Treść w blokach: Absätze, Listen, Tabellen mit echten
 * Verweisen, `library/blocks.ts`) ist ein Typ wie jeder andere: ein Rodzaj mit
 * einem solchen Feld ist eine AUSSAGE (Teza, Frage, Informacja/Interpretacja),
 * etwa der Komentarz aus `templates/cogita/komentarz.json`.
 */
export const FIELD_TYPES = ['line', 'text', 'markup', 'blocks', 'number', 'date', 'bool', 'choice', 'ref', 'media', 'url', 'list', 'geo', 'range'] as const;
/** `outline` (Zarys eines Projekts) gehört den Arten des Skryptorium — gelesen, nie angeboten. */
export type FieldType = (typeof FIELD_TYPES)[number] | 'outline';

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  line: 'Wiersz tekstu',
  text: 'Dłuższy tekst',
  markup: 'Tekst z przypisami',
  number: 'Liczba z jednostką',
  date: 'Data (rok, miesiąc albo dzień)',
  bool: 'Tak / nie / nie wiadomo',
  choice: 'Wybór z listy',
  ref: 'Odwołanie',
  media: 'Obraz, dźwięk, film, dokument',
  url: 'Adres strony',
  list: 'Lista w kolejności',
  geo: 'Miejsce na mapie',
  range: 'Zakres z kilku odcinków',
  outline: 'Plan (nagłówki i teksty)',
  blocks: 'Treść w blokach (akapity, listy, tabele)'
};

/**
 * `outline` gehört nur dem Projekt der eingebauten Arten (Gliederung aus
 * Überschriften und Texten). Angeboten wird es nicht — gelesen schon, damit
 * der Plan eines Buches beim Umzug in das Schema nicht verloren geht.
 */
const KNOWN_TYPES: ReadonlySet<string> = new Set<string>([...FIELD_TYPES, 'outline']);

export const VALUE_STATES = ['known', 'approximate', 'disputed', 'unknown', 'na', 'pending'] as const;
export type ValueState = (typeof VALUE_STATES)[number];

export const VALUE_STATE_LABEL: Record<ValueState, string> = {
  known: 'pewne',
  approximate: 'w przybliżeniu',
  disputed: 'sporne',
  unknown: 'nieznane',
  na: 'nie dotyczy',
  pending: 'do ustalenia'
};

/** Ein Stand, der keinen Wert trägt — „nieznane" ist eine Auskunft, kein leeres Feld. */
const WITHOUT_VALUE: ReadonlySet<ValueState> = new Set<ValueState>(['unknown', 'na', 'pending']);

export const MEDIA_TYPES = ['image', 'audio', 'video', 'document'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const RANGE_OF = ['number', 'date', 'text'] as const;
export type RangeOf = (typeof RANGE_OF)[number];

/**
 * DIE ROLLEN EINES FELDES — woran die eingebauten Werkzeuge es erkennen [B1].
 *
 * Fußnoten, Veröffentlichung, ISBN-Suche und LaTeX fragen nicht nach dem
 * Schlüssel eines Feldes (den darf jeder ändern), sondern nach seiner Rolle:
 * „wer sind die Autoren", „welcher Titel". Die Namen sind die Schlüssel der
 * bisherigen Arten, damit deren Einträge unverändert weiterlaufen.
 */
export const FIELD_ROLES: readonly { readonly role: string; readonly label: string }[] = [
  { role: 'title', label: 'Tytuł' },
  { role: 'subtitle', label: 'Podtytuł' },
  { role: 'name', label: 'Nazwa' },
  { role: 'givenNames', label: 'Imiona' },
  { role: 'surname', label: 'Nazwisko' },
  { role: 'authors', label: 'Autorzy' },
  { role: 'editors', label: 'Redakcja' },
  { role: 'translators', label: 'Tłumaczenie' },
  { role: 'container', label: 'Zawarte w' },
  { role: 'volume', label: 'Tom' },
  { role: 'issue', label: 'Numer' },
  { role: 'edition', label: 'Wydanie' },
  { role: 'publisher', label: 'Wydawca' },
  { role: 'place', label: 'Miejsce wydania' },
  { role: 'year', label: 'Rok' },
  { role: 'series', label: 'Seria' },
  { role: 'pages', label: 'Strony' },
  { role: 'isbn', label: 'ISBN' },
  { role: 'doi', label: 'DOI' },
  { role: 'url', label: 'Adres' },
  { role: 'siglum', label: 'Skrót przekładu' },
  { role: 'text', label: 'Tekst cytatu' },
  { role: 'work', label: 'Źródło' },
  { role: 'locator', label: 'Miejsce w źródle' },
  { role: 'description', label: 'Opis' },
  { role: 'body', label: 'Treść' }
];

/* -- Das Modell ---------------------------------------------------------------------- */

export interface ChoiceOption {
  readonly value: string;
  readonly label: string;
}

export interface FieldDef {
  /** Der Schlüssel in den Daten des Eintrags — ASCII, bleibt beim Umbenennen der Beschriftung. */
  readonly key: string;
  readonly label: string;
  readonly type: FieldType;
  /** Mehrere Werte, in ihrer Reihenfolge [B5]. */
  readonly multi: boolean;
  /** Jeder Wert trägt Stand, Quelle und Notiz [B3]. */
  readonly uncertain: boolean;
  /** `number`: die Einheit, die hinter der Zahl steht. */
  readonly unit?: string;
  /**
   * 2026-10-23 (Schritt 13) — `number`: WELCHE GRÖSSE (eine Art aus
   * `core/quantities.ts`, QUDT: `Torque`, `Mass` …). Dann darf ein Wert in
   * jeder Einheit dieser Art eingegeben werden; gespeichert wird er so, wie er
   * eingegeben wurde, und dazu in SI (`{ value, unit, si }`). Fehlt sie, gilt
   * die Art der Einheit, wenn diese eindeutig ist (`kg` → Masse; `N·m` nicht).
   */
  readonly quantity?: string;
  /** `choice`: was zur Wahl steht. */
  readonly options?: readonly ChoiceOption[];
  /** `ref`: auf welche Arten der Verweis zeigen darf — leer: auf jede [B9]. */
  readonly to?: readonly string[];
  /** `ref`: wie die Gegenseite heisst („napisał" ↔ „napisane przez"). */
  readonly inverse?: string;
  /** `ref`: gilt in beide Richtungen und steht nur einmal da [B10]. */
  readonly symmetric?: boolean;
  /**
   * 2026-10-22 (Schritt 11) — `ref` MIT STELLE: jeder Wert nennt dazu ein
   * Miejsce (`{ value, locator }`) — ein Psalm ist „Biblia, Ps 110", ein
   * Hasło „Leksykon, s. 23". Der Text der Bibel liegt nicht im Speicher: die
   * Stelle wird gelesen (`library/bible.ts`), gesucht („Fragment Pisma") und gezeigt.
   */
  readonly locator?: boolean;
  /**
   * 2026-10-25 (Wywód) — `ref` ALS VERBINDUNG IN EINER STRUKTUR, vom Besitzer
   * erklärt: `up` — dieser Eintrag liegt UNTER dem, worauf er zeigt („Należy
   * do", „Odpowiada na"); `down` — was er nennt, liegt unter IHM („Argumenty
   * za"). Die Struktura folgt solchen Feldern in die Tiefe, und für
   * Informacja / Interpretacja zählen sie nicht: der Zusammenhang eines Wywód
   * ist kein Urteil über die Quelle.
   */
  readonly structure?: 'up' | 'down';
  /**
   * 2026-10-27 — `ref` IN DER REIHENFOLGE DES LERNENS, vom Besitzer erklärt: `up` — was er nennt,
   * muss man VORHER können („Najpierw trzeba znać", „Wymaga": Orbital → Elektron, Atom); `down` —
   * was er nennt, baut auf IHM auf („Na tym budują"). Die Maschine liest daraus EINEN Graphen der
   * Voraussetzungen (`prerequisites.ts`): Ebenen von den Grundlagen her, gesperrte Karten, neue
   * Karten in dieser Reihenfolge, die Ścieżka in der Nauka. Eine Struktur (`structure`) ist etwas
   * anderes: wer worunter liegt, nicht was man zuerst können muss.
   */
  readonly prerequisite?: 'up' | 'down';
  /**
   * 2026-10-27 — NUR FÜR EINIGE WERTE EINES WAHLFELDES desselben Rodzaj („Pokaż, gdy"): ein Rodzaj
   * mit einem Feld „Rodzaj pytania" (oder „Typ") und Feldern, die nur zu einigen Typen gehören — EIN
   * Schema statt eines je Typ. Der Editor zeigt das Feld nur, wenn das Wahlfeld einen dieser Werte
   * hat; ein Wert, der schon dasteht, bleibt gespeichert, wenn der Typ wechselt.
   */
  readonly when?: FieldWhen;
  /** `media`: welche Dateien. */
  readonly media?: readonly MediaType[];
  /** `range`: woraus die Stücke bestehen. */
  readonly rangeOf?: RangeOf;
  /** Woran die eingebauten Werkzeuge das Feld erkennen (`FIELD_ROLES`). */
  readonly role?: string;
  /** Was das Feld bedeutet — für die Beschreibung neben dem JSON. */
  readonly says?: string;
  /* 2026-10-22 — keine „privaten" Felder mehr: wer ein Feld liest, entscheidet der Bereich, nicht das Feld. */
}

/** 2026-10-27 — wann ein Feld gilt: das Wahlfeld (`field`) hat einen dieser Werte. */
export interface FieldWhen {
  readonly field: string;
  readonly values: readonly string[];
}

/** Gilt das Feld für diese Daten? Ohne `when` immer; mit `when` nur, wenn das Wahlfeld einen der Werte hat (leer: nicht). */
export function fieldShown(field: Pick<FieldDef, 'when'>, data: Readonly<Record<string, unknown>>): boolean {
  if (field.when === undefined) return true;
  const raw = data[field.when.field];
  const values = (Array.isArray(raw) ? raw : [raw]).map((v) => (typeof v === 'string' ? v : isObject(v) && typeof v.value === 'string' ? v.value : ''));
  return values.some((v) => v !== '' && field.when!.values.includes(v));
}

/**
 * Die Systemarten, die der Motor versteht [C1]. Sie sind fest; Felder darf
 * man ihnen trotzdem hinzufügen.
 */
/* 2026-10-23 (Schritt 5) — ohne `topic`: Themen gibt es nicht mehr. */
export const SYSTEM_KINDS = ['text', 'question'] as const;
export type SystemKind = (typeof SYSTEM_KINDS)[number];

export interface KindDef {
  /** Die Kennung des Eintrags, der die Art beschreibt. */
  readonly id: string;
  readonly name: string;
  /** Das Muster des Etiketts, etwa „{givenNames} {surname}" [B8]. */
  readonly label: string;
  /** Das Feld, das Gleichnamige in der Suche unterscheidet [F4]. */
  readonly tells?: string;
  /**
   * 2026-10-31 — WIE EIN EINTRAG ZUM LESEN AUSSIEHT („Nowy temat", die Erklärung nach einer Antwort): ein Zapis mit
   * Feldern in Klammern, etwa „{streszczenie}\n\n{opis}\n\n**Wydarzenia**\n{wydarzenia}" (`reading.ts` `formatReading`).
   * Fehlt er: das Streszczenie oder der erste Absatz, dann die Felder mit Text, Daten und Stellen. Im JSON "reading"
   * („show" ist schon ein Feld der Frage: wie viele Paare auf einmal).
   */
  readonly reading?: string;
  readonly fields: readonly FieldDef[];
  /*
    2026-10-17 — „Postać — może mówić" ist fort: sprechen darf in einem Ablauf
    jeder Eintrag (eine Zeile, ein Schritt „Postać mówi" nennt ihn). Ein altes
    `speaks` im Dokument wird überlesen.
  */
  /** Eine der festen Arten des Motors. */
  readonly system?: SystemKind;
}

export interface Entity {
  readonly id: string;
  /** In ihrer Reihenfolge — die erste gibt das Etikett. */
  readonly kinds: readonly string[];
  readonly data: Readonly<Record<string, unknown>>;
}

/** Die Quelle eines Wertes: ein Werk der Bibliothek und die Stelle darin [B4]. */
export interface SourceRef {
  readonly work: string;
  readonly locator?: string;
}

export interface MediaRef {
  readonly file: string;
  readonly type: MediaType;
  readonly name?: string;
  /** Die genaue Art der Datei (image/png) — zum Öffnen im Browser. */
  readonly mime?: string;
  /** 0110 — in welcher Bibliothek (oder Baza wiedzy) sie liegt; fehlt: in der, deren Eintrag sie zeigt. */
  readonly library?: string;
}

export interface GeoPoint {
  readonly lat: number;
  readonly lon: number;
}

export interface Segment {
  readonly from: number | string;
  /** Fehlt: ein einzelner Punkt — oder, mit `toState: 'open'`, kein bekanntes Ende. */
  readonly to?: number | string;
  readonly fromState: 'inclusive' | 'exclusive' | 'approximate' | 'unknown';
  readonly toState: 'inclusive' | 'exclusive' | 'approximate' | 'open';
}

export interface RangeValue {
  readonly segments: readonly Segment[];
}

export type OutlineItem = { readonly heading: string } | { readonly text: string };

/** `bool` kennt drei Antworten [B2]; „nie wiadomo" ist eine davon, kein leeres Feld. */
export type BoolValue = boolean | 'unknown';

export type FieldValue = string | number | BoolValue | MediaRef | GeoPoint | RangeValue | readonly string[] | readonly OutlineItem[] | readonly CommentBlock[];

/** Ein Wert, wie ihn alles Weitere sieht — gleich, wie er gespeichert ist. */
export interface Value {
  /** `null`: der Stand sagt, dass es keinen Wert gibt (unbekannt, nicht zutreffend, offen). */
  readonly value: FieldValue | null;
  readonly state: ValueState;
  readonly source?: SourceRef;
  readonly note?: string;
  /** 2026-10-22 (Schritt 11) — die Stelle eines Verweises mit Stelle (`FieldDef.locator`). */
  readonly locator?: string;
  /**
   * 2026-10-23 (Schritt 13) — eine Grösse, wie sie eingegeben wurde (die Zahl
   * und die Kennung ihrer Einheit); `value` ist dann dieselbe Grösse in der
   * Einheit des Feldes, `si` in SI.
   */
  readonly entered?: { readonly value: number; readonly unit: string };
  readonly si?: number;
}

/** Wie man Arten und Einträge findet — im Speicher des Browsers. */
export interface Lookup {
  kind(id: string): KindDef | undefined;
  entity(id: string): Entity | undefined;
}

export function lookupOf(kinds: readonly KindDef[], entities: readonly Entity[]): Lookup {
  const byKind = new Map(kinds.map((k) => [k.id, k]));
  const byEntity = new Map(entities.map((e) => [e.id, e]));
  return { kind: (id) => byKind.get(id), entity: (id) => byEntity.get(id) };
}

/* -- Duldsame Leser ------------------------------------------------------------------- */

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const clip = (v: string, n: number): string => (v.length <= n ? v : v.slice(0, n));

/** Ein Schlüssel muss in JSON, in Mustern und in Pfaden ohne Umschreibung stehen können. */
export const FIELD_KEY = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

const pick = <T extends string>(allowed: readonly T[], v: unknown): T | undefined =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;

/** 2026-10-27 — „Pokaż, gdy": ein anderes Feld (nicht dieses) und mindestens ein Wert. */
function readWhen(raw: unknown, own: string): FieldWhen | undefined {
  if (!isObject(raw)) return undefined;
  const field = str(raw.field).trim();
  const values = (Array.isArray(raw.values) ? raw.values : [raw.values]).map((v) => str(v).trim()).filter((v) => v !== '');
  return FIELD_KEY.test(field) && field !== own && values.length > 0 ? { field, values: [...new Set(values)] } : undefined;
}

export function readField(raw: unknown): FieldDef | null {
  if (!isObject(raw)) return null;
  const key = str(raw.key);
  if (!FIELD_KEY.test(key)) return null;
  const type = typeof raw.type === 'string' && KNOWN_TYPES.has(raw.type) ? (raw.type as FieldType) : 'line';
  const label = clip(str(raw.label).trim(), 120) || key;

  const options = Array.isArray(raw.options)
    ? raw.options.flatMap((o): ChoiceOption[] => {
      if (typeof o === 'string' && o.trim() !== '') return [{ value: o.trim(), label: o.trim() }];
      if (!isObject(o)) return [];
      const value = str(o.value).trim();
      return value === '' ? [] : [{ value, label: str(o.label).trim() || value }];
    })
    : undefined;
  const to = Array.isArray(raw.to) ? raw.to.filter((t): t is string => typeof t === 'string' && t !== '') : undefined;
  const media = Array.isArray(raw.media) ? raw.media.filter((m): m is MediaType => pick(MEDIA_TYPES, m) !== undefined) : undefined;

  return {
    key,
    label,
    type,
    multi: raw.multi === true,
    uncertain: raw.uncertain === true,
    unit: type === 'number' && str(raw.unit).trim() !== '' ? clip(str(raw.unit).trim(), 24) : undefined,
    quantity: type === 'number' && kindById(str(raw.quantity)) !== undefined ? str(raw.quantity) : undefined,
    options: type === 'choice' ? options ?? [] : undefined,
    to: type === 'ref' ? to ?? [] : undefined,
    inverse: type === 'ref' && str(raw.inverse).trim() !== '' ? clip(str(raw.inverse).trim(), 120) : undefined,
    symmetric: type === 'ref' && raw.symmetric === true ? true : undefined,
    locator: type === 'ref' && raw.locator === true ? true : undefined,
    structure: type === 'ref' && (raw.structure === 'up' || raw.structure === 'down') ? raw.structure : undefined,
    prerequisite: type === 'ref' && (raw.prerequisite === 'up' || raw.prerequisite === 'down') ? raw.prerequisite : undefined,
    when: readWhen(raw.when, key),
    media: type === 'media' ? (media && media.length > 0 ? media : [...MEDIA_TYPES]) : undefined,
    rangeOf: type === 'range' ? pick(RANGE_OF, raw.rangeOf) ?? 'number' : undefined,
    role: str(raw.role).trim() !== '' ? clip(str(raw.role).trim(), 40) : undefined,
    says: str(raw.says).trim() !== '' ? clip(str(raw.says).trim(), 400) : undefined
  };
}

/**
 * Eine Art aus ihrem Dokument. Doppelte Schlüssel: der erste bleibt — ein
 * zweites Feld gleichen Namens überschriebe still die Werte des ersten.
 */
export function readKind(id: string, raw: unknown): KindDef {
  const doc = isObject(raw) ? raw : {};
  const seen = new Set<string>();
  const fields: FieldDef[] = [];
  for (const one of Array.isArray(doc.fields) ? doc.fields : []) {
    const field = readField(one);
    if (field === null || seen.has(field.key)) continue;
    seen.add(field.key);
    fields.push(field);
  }
  const name = clip(str(doc.name).trim(), 80) || 'Rodzaj';
  const tells = str(doc.tells);
  const reading = clip(str(doc.reading).replace(/\r\n?/g, '\n').trim(), 4000);
  return {
    id,
    name,
    label: clip(str(doc.label).trim(), 200) || (fields[0] ? `{${fields[0].key}}` : ''),
    tells: seen.has(tells) ? tells : undefined,
    ...(reading === '' ? {} : { reading }),
    fields,
    system: pick(SYSTEM_KINDS, doc.system)
  };
}

/** Was die Art falsch beschreibt — für den Editor und den JSON-Import. */
export function problemsOf(kind: KindDef, look: Pick<Lookup, 'kind'>): string[] {
  const out: string[] = [];
  const keys = new Set(kind.fields.map((f) => f.key));
  for (const token of patternKeys(kind.label)) {
    if (!keys.has(token)) out.push(`Wzór etykiety używa pola „${token}", którego ten rodzaj nie ma.`);
  }
  for (const token of patternKeys(kind.reading ?? '')) {
    if (!keys.has(token)) out.push(`Wzór tekstu do czytania używa pola „${token}", którego ten rodzaj nie ma.`);
  }
  for (const field of kind.fields) {
    for (const target of field.to ?? []) {
      if (target !== kind.id && look.kind(target) === undefined) out.push(`Pole „${field.label}" odwołuje się do rodzaju, którego nie ma.`);
    }
    if (field.type === 'choice' && (field.options ?? []).length === 0) out.push(`Pole „${field.label}" nie ma nic do wyboru.`);
    /* 2026-10-27 — „Pokaż, gdy": das Wahlfeld muss es in diesem Rodzaj geben. */
    if (field.when !== undefined) {
      const by = kind.fields.find((f) => f.key === field.when!.field);
      if (by === undefined) out.push(`Pole „${field.label}" pokazuje się tylko przy wartościach pola „${field.when.field}", którego ten rodzaj nie ma.`);
      else if (by.type !== 'choice') out.push(`Pole „${field.label}" zależy od pola „${by.label}", które nie jest wyborem z listy.`);
      else {
        const missing = field.when.values.filter((v) => !(by.options ?? []).some((o) => o.value === v));
        if (missing.length > 0) out.push(`Pole „${field.label}" zależy od wartości ${missing.map((v) => `„${v}"`).join(', ')}, których nie ma w polu „${by.label}".`);
      }
    }
  }
  if (kind.fields.length === 0) out.push('Rodzaj nie ma jeszcze żadnego pola.');
  return out;
}

/* -- Daten mit Genauigkeit ------------------------------------------------------------ */

export type DatePrecision = 'year' | 'month' | 'day';

export interface DateValue {
  /** Negativ: vor Christus. Ein Jahr 0 gibt es nicht. */
  readonly y: number;
  readonly m?: number;
  readonly d?: number;
}

const DATE = /^(-?)(\d{1,6})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/;

/** `"1999"`, `"1999-05"`, `"1999-05-03"`, `"-1000"` (vor Christus). Anderes: `null`. */
export function readDate(raw: unknown): DateValue | null {
  const match = DATE.exec(str(raw).trim());
  if (!match) return null;
  const y = Number(match[2]) * (match[1] === '-' ? -1 : 1);
  if (y === 0) return null;
  if (match[3] === undefined) return { y };
  const m = Number(match[3]);
  if (m < 1 || m > 12) return null;
  if (match[4] === undefined) return { y, m };
  const d = Number(match[4]);
  if (d < 1 || d > daysIn(y, m)) return null;
  return { y, m, d };
}

function daysIn(y: number, m: number): number {
  if (m === 2) {
    const leap = y > 0 && ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

export const precisionOf = (date: DateValue): DatePrecision => (date.d !== undefined ? 'day' : date.m !== undefined ? 'month' : 'year');

export function dateKey(date: DateValue): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.y < 0 ? `-${String(-date.y).padStart(4, '0')}` : String(date.y).padStart(4, '0');
  return date.m === undefined ? year : date.d === undefined ? `${year}-${pad(date.m)}` : `${year}-${pad(date.m)}-${pad(date.d)}`;
}

/** Eine Zahl zum Ordnen: früher ist kleiner, auch vor Christus. */
export const dateOrdinal = (date: DateValue): number => date.y * 10000 + (date.m ?? 0) * 100 + (date.d ?? 0);

/** Auf eine gröbere Genauigkeit gekürzt — ein Tag auf sein Jahr. */
export function coarsen(date: DateValue, to: DatePrecision): DateValue {
  if (to === 'year') return { y: date.y };
  if (to === 'month') return date.m === undefined ? { y: date.y } : { y: date.y, m: date.m };
  return date;
}

const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const MONTHS_OF = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];

export function dateText(date: DateValue): string {
  const year = date.y < 0 ? `${-date.y} przed Chr.` : String(date.y);
  if (date.m === undefined) return year;
  if (date.d === undefined) return `${MONTHS[date.m - 1]} ${year}`;
  return `${date.d} ${MONTHS_OF[date.m - 1]} ${year}`;
}

/* -- Spannen ---------------------------------------------------------------------- */

const FROM_STATES = ['inclusive', 'exclusive', 'approximate', 'unknown'] as const;
const TO_STATES = ['inclusive', 'exclusive', 'approximate', 'open'] as const;

function readPoint(raw: unknown, of: RangeOf): number | string | undefined {
  if (of === 'number') {
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw.trim().replace(',', '.')) : Number.NaN;
    return Number.isFinite(n) ? n : undefined;
  }
  if (of === 'date') {
    const date = readDate(raw);
    return date === null ? undefined : dateKey(date);
  }
  const text = str(raw).trim();
  return text === '' ? undefined : text;
}

export function readRange(raw: unknown, of: RangeOf): RangeValue | null {
  const list = isObject(raw) && Array.isArray(raw.segments) ? raw.segments : Array.isArray(raw) ? raw : null;
  if (list === null) return null;
  const segments: Segment[] = [];
  for (const one of list) {
    if (!isObject(one)) continue;
    const from = readPoint(one.from, of);
    if (from === undefined) continue;
    const to = readPoint(one.to, of);
    segments.push({
      from,
      to,
      fromState: pick(FROM_STATES, one.fromState) ?? 'inclusive',
      toState: pick(TO_STATES, one.toState) ?? 'inclusive'
    });
  }
  return segments.length === 0 ? null : { segments };
}

function pointText(point: number | string, of: RangeOf): string {
  if (of === 'number' && typeof point === 'number') return String(point).replace('.', ',');
  if (of === 'date') {
    const date = readDate(point);
    return date === null ? String(point) : dateText(date);
  }
  return String(point);
}

/** `992–1000, 1002–1025` · `ok. 960–992` · `1990–` (bez znanego końca). */
export function rangeText(range: RangeValue, of: RangeOf): string {
  return range.segments.map((s) => {
    const approx = s.fromState === 'approximate' || s.toState === 'approximate' ? 'ok. ' : '';
    const from = s.fromState === 'unknown' ? '?' : pointText(s.from, of);
    if (s.toState === 'open') return `${approx}${from}–`;
    if (s.to === undefined) return `${approx}${from}`;
    return `${approx}${from}–${pointText(s.to, of)}`;
  }).join(', ');
}

/**
 * Wo eine Spanne geteilt wird. Der Gedankenstrich trennt immer. Ein einfacher
 * Bindestrich ist dagegen auch das Minus eines Jahres vor Christus und der
 * Trenner in „1999-05": bei Daten trennt er nur mit Leerraum davor
 * („1999-05 - 2000"), bei Zahlen nur zwischen zwei Werten.
 */
function splitSpan(body: string, of: RangeOf): [string, string | undefined] {
  const dash = body.search(/[–—]/);
  if (dash >= 0) return [body.slice(0, dash), body.slice(dash + 1)];
  const spaced = /\s-(\s|$)/.exec(body);
  if (spaced) return [body.slice(0, spaced.index), body.slice(spaced.index + 2)];
  if (of !== 'date') {
    const between = /^(-?[^-]+)-(-?.*)$/.exec(body);
    if (between) return [between[1], between[2]];
  }
  return [body, undefined];
}

/** Der umgekehrte Weg — was jemand in ein Feld tippt: „992–1000, 1002–1025". */
export function parseRange(text: string, of: RangeOf): RangeValue | null {
  const segments: Segment[] = [];
  for (const piece of text.split(/[,;]\s*/)) {
    let body = piece.trim();
    if (body === '') continue;
    let approximate = false;
    if (/^(ok\.|około|ca\.?|c\.)\s*/i.test(body)) {
      approximate = true;
      body = body.replace(/^(ok\.|około|ca\.?|c\.)\s*/i, '');
    }
    const [rawFrom, rawTo] = splitSpan(body, of);
    const from = readPoint(rawFrom, of);
    if (from === undefined) return null;
    const open = rawTo !== undefined && rawTo.trim() === '';
    const to = rawTo === undefined || open ? undefined : readPoint(rawTo, of);
    if (rawTo !== undefined && !open && to === undefined) return null;
    segments.push({
      from,
      to,
      fromState: approximate ? 'approximate' : 'inclusive',
      toState: open ? 'open' : approximate ? 'approximate' : 'inclusive'
    });
  }
  return segments.length === 0 ? null : { segments };
}

/* -- Werte ------------------------------------------------------------------------- */

/** Zahlen dürfen ihre Einheit tragen: „20,5 cm" ist 20,5. */
export function readNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  const match = /-?\d[\d\s]*(?:[.,]\d+)?/.exec(raw.replace(/ /g, ' '));
  if (!match) return null;
  const n = Number(match[0].replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function readBool(raw: unknown): BoolValue | null {
  if (raw === true || raw === false) return raw;
  const text = str(raw).trim().toLowerCase();
  /* 2026-10-27 — auch „prawda" / „fałsz": so schreibt man die Antwort eines Pytania „Prawda czy fałsz" in eine Zeile. */
  if (['tak', 'yes', 'true', 't', 'prawda'].includes(text)) return true;
  if (['nie', 'no', 'false', 'n', 'fałsz', 'falsz'].includes(text)) return false;
  if (['unknown', 'nie wiadomo', '?'].includes(text)) return 'unknown';
  return null;
}

/**
 * EIN Wert, nach dem Typ seines Feldes gelesen. `undefined`: passt nicht —
 * der Wert gehört dann nicht zum Feld, sondern steht „poza schematem".
 */
export function readTyped(field: FieldDef, raw: unknown): FieldValue | undefined {
  switch (field.type) {
    case 'line':
    case 'text':
    case 'markup':
    case 'url': {
      const text = str(raw);
      return text.trim() === '' ? undefined : text;
    }
    case 'number': {
      const n = readNumber(raw);
      return n === null ? undefined : n;
    }
    case 'date': {
      const date = readDate(raw);
      return date === null ? undefined : dateKey(date);
    }
    case 'bool': {
      const b = readBool(raw);
      return b === null ? undefined : b;
    }
    case 'choice': {
      const text = str(raw).trim();
      if (text === '') return undefined;
      const options = field.options ?? [];
      if (options.length === 0) return text;
      const found = options.find((o) => o.value === text || o.label.toLowerCase() === text.toLowerCase());
      return found ? found.value : undefined;
    }
    case 'ref': {
      const id = str(raw).trim();
      return id === '' ? undefined : id;
    }
    case 'media': {
      if (!isObject(raw)) return undefined;
      const file = str(raw.file).trim();
      const type = pick(MEDIA_TYPES, raw.type);
      if (file === '' || type === undefined || !(field.media ?? MEDIA_TYPES).includes(type)) return undefined;
      const name = str(raw.name).trim();
      const mime = str(raw.mime).trim();
      const library = str(raw.library).trim();
      return {
        file, type, ...(name === '' ? {} : { name: clip(name, 200) }), ...(/^[a-z]+\/[a-z0-9.+-]+$/i.test(mime) ? { mime: clip(mime, 100) } : {}),
        ...(/^[0-9a-f-]{32,36}$/i.test(library) ? { library } : {})
      };
    }
    case 'list': {
      if (!Array.isArray(raw)) return undefined;
      const items = raw.map((one) => str(one).trim()).filter((one) => one !== '');
      return items.length === 0 ? undefined : items;
    }
    case 'geo': {
      if (!isObject(raw)) return undefined;
      const lat = readNumber(raw.lat);
      const lon = readNumber(raw.lon);
      if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return undefined;
      return { lat, lon };
    }
    case 'range': {
      const range = readRange(raw, field.rangeOf ?? 'number');
      return range === null ? undefined : range;
    }
    case 'blocks': {
      const blocks = blocksIn(raw);
      return blocks.length === 0 ? undefined : blocks;
    }
    case 'outline': {
      if (!Array.isArray(raw)) return undefined;
      const items: OutlineItem[] = [];
      for (const one of raw) {
        if (!isObject(one)) continue;
        if (typeof one.text === 'string' && one.text !== '') items.push({ text: one.text });
        else if (typeof one.heading === 'string') items.push({ heading: one.heading });
      }
      return items;
    }
  }
}

/** Ein gespeicherter Wert ist entweder der Wert selbst oder seine Hülle mit Stand, Quelle und Notiz. */
const isEnvelope = (raw: unknown): raw is Record<string, unknown> =>
  isObject(raw) && ('state' in raw || 'value' in raw) && !('segments' in raw) && !('file' in raw) && !('lat' in raw);

function readSource(raw: unknown): SourceRef | undefined {
  if (!isObject(raw)) return undefined;
  const work = str(raw.work).trim();
  if (work === '') return undefined;
  const locator = str(raw.locator).trim();
  return locator === '' ? { work } : { work, locator: clip(locator, 120) };
}

/* -- 2026-10-23 (Schritt 13): Grössen ------------------------------------------------------------------ */

/** Welche Grösse ein Zahlenfeld misst: die genannte — sonst die seiner Einheit, wenn diese eindeutig ist. */
export function fieldKind(field: FieldDef): string | undefined {
  if (field.type !== 'number') return undefined;
  return field.quantity ?? guessKind(field.unit);
}

/** In welcher Einheit das Feld seine Zahlen zeigt: seine Einheit (wenn sie die Grösse misst), sonst die SI-Einheit der Grösse. */
export function fieldUnit(field: FieldDef): Unit | undefined {
  const kind = fieldKind(field);
  const own = findUnit(field.unit);
  if (own !== undefined && (kind === undefined || measures(own, kind))) return own;
  return kind === undefined ? undefined : siUnitOf(kind);
}

/**
 * EIN WERT EINES GRÖSSENFELDES, wie er gespeichert wird: die eingegebene Zahl,
 * die Kennung ihrer Einheit und SI (Entscheidung 15). Ohne Einheit: in der
 * des Feldes. `error`: eine Einheit einer anderen Grösse, oder eine unbekannte.
 */
export function quantityEnvelope(field: FieldDef, value: number, unit: Unit | undefined): { value: number; unit: string; si: number } | { error: string } {
  const kind = fieldKind(field);
  const own = unit ?? fieldUnit(field);
  if (own === undefined) return { error: 'To pole nie ma jednostki.' };
  if (kind !== undefined && !measures(own, kind)) return { error: `„${own.symbol}” nie mierzy wielkości: ${kindById(kind)?.label ?? kind}.` };
  return { value, unit: own.id, si: toSI(value, own) };
}

/** Die Zahl eines Grössenfeldes — in seiner Einheit, mit der Eingabe und SI daneben. */
function measured(field: FieldDef, raw: unknown, value: number): Pick<Value, 'entered' | 'si'> & { value: number } {
  const shown = fieldUnit(field);
  const env = isEnvelope(raw) ? raw : null;
  const typed = env === null || typeof env.unit !== 'string' ? undefined : unitById(env.unit) ?? findUnit(env.unit);
  if (typed === undefined) return shown === undefined ? { value } : { value, si: toSI(value, shown) };
  const si = toSI(value, typed);
  const same = shown !== undefined && typed.kinds.some((k) => shown.kinds.includes(k));
  return { value: same ? fromSI(si, shown) : value, entered: { value, unit: typed.id }, si };
}

/** Eine Grösse in Worten, wie sie eingegeben wurde („1,5 kN"). */
export const enteredText = (entered: { readonly value: number; readonly unit: string }): string => quantityText(entered.value, unitById(entered.unit));

function readOne(field: FieldDef, raw: unknown): Value | undefined {
  /* 2026-10-22 (Schritt 11) — die Stelle eines Verweises mit Stelle. */
  const locator = field.locator === true && isEnvelope(raw) ? clip(str(raw.locator).trim(), 120) : '';
  const place = locator === '' ? {} : { locator };
  if (field.uncertain && isEnvelope(raw)) {
    const state = pick(VALUE_STATES, raw.state) ?? 'known';
    const note = str(raw.note).trim();
    const source = readSource(raw.source);
    const extra = { ...(source ? { source } : {}), ...(note !== '' ? { note: clip(note, 1000) } : {}), ...place };
    if (WITHOUT_VALUE.has(state)) return { value: null, state, ...extra };
    const value = readTyped(field, raw.value);
    if (value === undefined) return undefined;
    return typeof value === 'number' ? { ...measured(field, raw, value), state, ...extra } : { value, state, ...extra };
  }
  const value = readTyped(field, isEnvelope(raw) ? raw.value : raw);
  if (value === undefined) return undefined;
  return typeof value === 'number' ? { ...measured(field, raw, value), state: 'known', ...place } : { value, state: 'known', ...place };
}

/**
 * DIE WERTE EINES FELDES, gleich wie sie gespeichert sind: ein Wert, eine
 * Liste, mit oder ohne Hülle. Ein Feld mit einem Wert gibt höchstens einen
 * zurück. `list` und `outline` sind EIN Wert (die Reihenfolge ist der Wert).
 */
export function valuesOf(entity: Entity, field: FieldDef): Value[] {
  const raw = entity.data[field.key];
  if (raw === undefined || raw === null) return [];
  const whole = field.type === 'list' || field.type === 'outline' || field.type === 'blocks';
  const many = Array.isArray(raw) && !(whole && !raw.some((one) => Array.isArray(one) || isEnvelope(one)));
  const list: unknown[] = many ? (raw as unknown[]) : [raw];
  const out: Value[] = [];
  for (const one of list) {
    const value = readOne(field, one);
    if (value !== undefined) out.push(value);
  }
  return field.multi ? out : out.slice(0, 1);
}

/* -- Felder mehrerer Arten -------------------------------------------------------- */

/** Die Arten eines Eintrags, die es gibt — unbekannte fallen weg. */
export const kindsOf = (entity: Entity, look: Pick<Lookup, 'kind'>): KindDef[] =>
  entity.kinds.map((id) => look.kind(id)).filter((k): k is KindDef => k !== undefined);

/** Die Vereinigung der Felder aller Arten; bei gleichem Schlüssel gilt die frühere Art. */
export function fieldsOf(entity: Entity, look: Pick<Lookup, 'kind'>): FieldDef[] {
  const seen = new Set<string>();
  const out: FieldDef[] = [];
  for (const kind of kindsOf(entity, look)) {
    for (const field of kind.fields) {
      if (seen.has(field.key)) continue;
      seen.add(field.key);
      out.push(field);
    }
  }
  return out;
}

export function fieldOf(entity: Entity, look: Pick<Lookup, 'kind'>, key: string): FieldDef | undefined {
  return fieldsOf(entity, look).find((f) => f.key === key);
}

/** Das Feld einer Rolle — wonach die eingebauten Werkzeuge fragen [B1]. */
export function roleField(entity: Entity, look: Pick<Lookup, 'kind'>, role: string): FieldDef | undefined {
  return fieldsOf(entity, look).find((f) => (f.role ?? f.key) === role);
}

export interface Outside {
  readonly key: string;
  readonly raw: unknown;
  /** `removed`: das Feld gibt es nicht mehr · `retyped`: der Wert passt nicht zu seinem Typ. */
  readonly reason: 'removed' | 'retyped';
}

/**
 * „POZA SCHEMATEM" [B13] — was ein Eintrag trägt und sein Schema nicht (mehr)
 * versteht. Es bleibt gespeichert, bis jemand entscheidet.
 */
export function outsideOf(entity: Entity, look: Pick<Lookup, 'kind'>): Outside[] {
  const fields = new Map(fieldsOf(entity, look).map((f) => [f.key, f]));
  const out: Outside[] = [];
  for (const [key, raw] of Object.entries(entity.data)) {
    if (raw === undefined || raw === null) continue;
    const field = fields.get(key);
    if (field === undefined) { out.push({ key, raw, reason: 'removed' }); continue; }
    const whole = field.type === 'list' || field.type === 'outline' || field.type === 'blocks';
    const count = Array.isArray(raw) && !whole ? raw.length : 1;
    if (count > 0 && valuesOf(entity, field).length < Math.min(count, field.multi ? count : 1)) out.push({ key, raw, reason: 'retyped' });
  }
  return out;
}

/* -- Etiketten ---------------------------------------------------------------------- */

const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;

export function patternKeys(pattern: string): string[] {
  const out: string[] = [];
  let match: RegExpExecArray | null;
  const scan = new RegExp(PLACEHOLDER.source, 'g');
  while ((match = scan.exec(pattern)) !== null) if (!out.includes(match[1])) out.push(match[1]);
  return out;
}

/**
 * Was von einer Auszeichnung lesbar bleibt: `[[Księgi Samuela|@samuel]]` →
 * „Księgi Samuela", Verweise und Fussnoten fallen weg. 2026-10-22 — derselbe
 * Leser wie in der Bibliothek (`plainText`), in einer Zeile.
 */
export function plainOf(markup: string): string {
  if (!/[[*_#>^`\\]/.test(markup)) return markup.replace(/\s+/g, ' ').trim();
  return plainText(markup.replace(/!\[@[^\]]+\]/g, '')).replace(/\s+/g, ' ').replace(/ +([.,;:!?])/g, '$1').trim();
}

/** Ein Wert in Worten, wie er in Listen, Etiketten und Karten steht. `whole` (2026-10-26): eine Aussage ungekürzt. */
export function valueText(field: FieldDef, value: FieldValue | null, look: Lookup, depth = 0, whole = false): string {
  if (value === null) return '';
  switch (field.type) {
    case 'markup': return typeof value === 'string' ? plainOf(value) : '';
    case 'line':
    case 'text':
    case 'url': return typeof value === 'string' ? value.trim() : '';
    case 'number': return typeof value === 'number' ? `${String(value).replace('.', ',')}${field.unit ? ` ${field.unit}` : ''}` : '';
    case 'date': {
      const date = readDate(value);
      return date === null ? '' : dateText(date);
    }
    case 'bool': return value === true ? 'tak' : value === false ? 'nie' : value === 'unknown' ? 'nie wiadomo' : '';
    case 'choice': return typeof value === 'string' ? (field.options ?? []).find((o) => o.value === value)?.label ?? value : '';
    case 'ref': {
      if (typeof value !== 'string') return '';
      const target = look.entity(value);
      return target === undefined ? '…' : depth >= 2 ? '…' : labelOf(target, look, depth + 1);
    }
    case 'media': return isObject(value) && 'file' in value ? str((value as MediaRef).name) || 'plik' : '';
    case 'list': return Array.isArray(value) ? (value as readonly string[]).join(', ') : '';
    case 'geo': return isObject(value) && 'lat' in value ? `${(value as GeoPoint).lat}, ${(value as GeoPoint).lon}` : '';
    case 'range': return isObject(value) && 'segments' in value ? rangeText(value as RangeValue, field.rangeOf ?? 'number') : '';
    case 'outline': return Array.isArray(value) ? `${value.length} poz.` : '';
    /* Eine Aussage heisst nach ihrer Teza (dem ersten Satz) — sonst nach dem Anfang ihrer Liste oder Tabelle. */
    case 'blocks': return blocksTitle(blocksIn(value), whole);
  }
}

/** Alle Werte eines Feldes in Worten, mit Komma getrennt; unsichere tragen ihren Stand. */
/**
 * 2026-10-22 (Schritt 11) — ein Verweis mit Stelle in Worten: auf eine Bibel
 * die Stelle selbst (gelesen und einheitlich geschrieben: „Ps 110,1-7") mit
 * dem Sigel der Ausgabe, sonst „Werk, s. 23".
 */
export function placeText(target: Entity | undefined, locator: string, label: string): string {
  if (target !== undefined && target.data.workType === 'bible') {
    const spans = parseBible(locator);
    const siglum = typeof target.data.siglum === 'string' && target.data.siglum.trim() !== '' ? ` (${target.data.siglum.trim()})` : '';
    return `${spans.length > 0 ? formatBible(spans) : locator}${siglum}`;
  }
  return label === '' || label === '…' ? locator : `${label}, ${locator}`;
}

export function fieldText(entity: Entity, field: FieldDef, look: Lookup, depth = 0, whole = false): string {
  return valuesOf(entity, field)
    .map((v) => {
      /* 2026-10-23 (Schritt 13) — eine Grösse zeigt sich so, wie sie eingegeben wurde. */
      const plain = v.entered !== undefined ? enteredText(v.entered) : valueText(field, v.value, look, depth, whole);
      const text = v.locator === undefined || typeof v.value !== 'string' ? plain : placeText(look.entity(v.value), v.locator, plain);
      if (v.value === null) return `(${VALUE_STATE_LABEL[v.state]})`;
      return v.state === 'approximate' ? `ok. ${text}` : v.state === 'disputed' ? `${text} (?)` : text;
    })
    .filter((t) => t !== '')
    .join(', ');
}

/**
 * Was übrig bleibt, wenn ein Muster leere Stellen hatte: kein „ , " und keine
 * leeren Klammern, kein Trenner am Anfang oder Ende.
 */
function tidy(text: string): string {
  return text
    .replace(/\(\s*\)|\[\s*\]/g, '')
    .replace(/\s+([,.;:)\]])/g, '$1')
    .replace(/([(\[])\s+/g, '$1')
    .replace(/([,;:–—-])(\s*[,;:–—-])+/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, '')
    .trim();
}

/** Ein Muster mit den Werten eines Eintrags gefüllt. */
export function fill(pattern: string, entity: Entity, look: Lookup, depth = 0, whole = false): string {
  const fields = new Map(fieldsOf(entity, look).map((f) => [f.key, f]));
  return tidy(pattern.replace(new RegExp(PLACEHOLDER.source, 'g'), (_whole, key: string) => {
    const field = fields.get(key);
    return field === undefined ? '' : fieldText(entity, field, look, depth, whole);
  }));
}

/**
 * DAS ETIKETT eines Eintrags — immer aus einem Muster [B8], und zwar dem der
 * ersten Art, die eines hat. Steht nichts darin, heisst er nach seiner Art und
 * einem Stück seiner Kennung, damit er in keiner Liste leer dasteht.
 * 2026-10-26 — `whole`: eine Aussage darin ungekürzt (die Struktura mit „Całe tezy"); Verweise bleiben kurz.
 */
export function labelOf(entity: Entity, look: Lookup, depth = 0, whole = false): string {
  const kinds = kindsOf(entity, look);
  for (const kind of kinds) {
    if (kind.label === '') continue;
    const text = fill(kind.label, entity, look, depth, whole);
    if (text !== '') return text;
  }
  /* Das ENDE der Kennung: der Anfang einer UUIDv7 ist die Zeit und bei Einträgen derselben Stunde gleich. */
  return `${kinds[0]?.name ?? 'Wpis'} ${entity.id.slice(-4)}`;
}

/** Was Gleichnamige unterscheidet: „Dawid · król Izraela" [F4]. */
export function tellOf(entity: Entity, look: Lookup): string {
  for (const kind of kindsOf(entity, look)) {
    if (kind.tells === undefined) continue;
    const field = kind.fields.find((f) => f.key === kind.tells);
    if (field === undefined) continue;
    const text = fieldText(entity, field, look);
    if (text !== '') return text;
  }
  return '';
}

/* -- Verweise und ihre Gegenseite ------------------------------------------------------- */

export interface Backlink {
  /** Wer verweist. */
  readonly from: string;
  readonly field: FieldDef;
  /** Wie es auf der Gegenseite heisst — „napisane przez" oder, symmetrisch, wie auf dieser. */
  readonly label: string;
}

/**
 * Wer auf wen zeigt — einmal gerechnet, für alle Einträge. Ein symmetrischer
 * Verweis steht nur bei einem der beiden und erscheint bei beiden [B10].
 */
export function refIndex(entities: Iterable<Entity>, look: Pick<Lookup, 'kind'>): Map<string, Backlink[]> {
  const index = new Map<string, Backlink[]>();
  for (const entity of entities) {
    for (const field of fieldsOf(entity, look)) {
      if (field.type !== 'ref') continue;
      for (const v of valuesOf(entity, field)) {
        if (typeof v.value !== 'string' || v.value === entity.id) continue;
        const list = index.get(v.value) ?? [];
        list.push({ from: entity.id, field, label: field.symmetric ? field.label : field.inverse ?? field.label });
        index.set(v.value, list);
      }
    }
  }
  return index;
}

/**
 * DAS ZUSAMMENFÜHREN [B16]: jeder Verweis auf `from` zeigt danach auf `to`.
 * Gibt den geänderten Eintrag zurück oder `null`, wenn er nicht verwies. Ein
 * Verweis, der dadurch auf sich selbst zeigte, fällt weg.
 */
export function replaceRef(entity: Entity, look: Pick<Lookup, 'kind'>, from: string, to: string): Entity | null {
  const idOf = (one: unknown): unknown => (isEnvelope(one) ? one.value : one);
  const swap = (one: unknown): unknown => (isEnvelope(one) ? (one.value === from ? { ...one, value: to } : one) : one === from ? to : one);
  const data: Record<string, unknown> = { ...entity.data };
  let changed = 0;
  for (const field of fieldsOf(entity, look)) {
    if (field.type !== 'ref') continue;
    const raw = data[field.key];
    if (raw === undefined || raw === null) continue;
    const list = Array.isArray(raw) ? raw : [raw];
    if (!list.some((one) => idOf(one) === from)) continue;
    changed += 1;
    const kept = list.map(swap).filter((one, i, all) => {
      const id = idOf(one);
      return id !== entity.id && all.findIndex((other) => idOf(other) === id) === i;
    });
    if (kept.length === 0) delete data[field.key];
    else data[field.key] = Array.isArray(raw) ? kept : kept[0];
  }
  return changed > 0 ? { ...entity, data } : null;
}
