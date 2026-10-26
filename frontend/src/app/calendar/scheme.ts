/**
 * 2026-10-26 — SCHEMATA DER TERMINE (0132).
 *
 * <b>Ein Termin hat einen kleinen Kern</b> (Zeit, Wiederholung, Kalender, wer
 * sieht, Titel/Ort/Notiz/Link, Programm, Menschen). Was ihn zu einer Messe, zu
 * einem Treffen mit Anmeldung, zu einem Nabożeństwo macht, sagt sein
 * <b>Schema</b>: Felder am Termin (`level: 'item'`) oder an einem einzelnen
 * Vorkommen (`level: 'day'`), und Listen von Einträgen an jedem Vorkommen
 * (Intentionen, Anmeldungen) — jede mit ihrer Regel als Ablauf (`flow/`).
 *
 * <b>Schemata gehören einem Kalender</b> und liegen VERSIEGELT
 * (`app.calendar_doc`) unter dem Schlüssel des Bereichs, der die Termine sieht:
 * wer einen Termin liest, muss das Schema lesen können, das seine Werte
 * erklärt. Pläne (`PlanDef`) liegen unter dem Schlüssel des eigenen Bereichs
 * des Kalenders — sie braucht nur, wer dort schreibt. Vorlagen gibt es
 * (`templates/`), aber sie kommen nur von Hand in einen Kalender.
 *
 * <b>Der Dienst kennt kein Schema.</b> Er speichert versiegelte Werte und, wo
 * ein Feld offen ist, Beschriftung und Wert im Klartext (der Aushang, die
 * Gablota, der Druck lesen nur das). Regeln laufen im Browser.
 *
 * <b>Das universelle Schema</b> steht hier im Code und gilt für jeden Termin
 * ohne eigenes (`scheme_id` NULL): es kann alles, was Termine bisher konnten —
 * Treffen, Messe, Beichte, Nabożeństwo, Odwiedziny, Intentionen.
 */

import { areaKeys, newestKey } from '../chat/chat';
import { aad, Field, fromBase64Url, openText, sealText, toBase64Url } from '../core/crypto';
import { newId } from '../core/ids';
import type { Ring } from '../core/keys';
import { call, WorkspaceError } from '../core/session';
import type { CalendarRow, ItemKind } from './calendar';
import type { FlowDoc } from './flow/flowModel';

/* -- Das Modell -------------------------------------------------------------------------- */

export const SCHEME_FIELD_TYPES = ['text', 'longtext', 'number', 'choice', 'colour', 'date', 'time', 'bool', 'bible', 'person', 'link'] as const;
export type SchemeFieldType = (typeof SCHEME_FIELD_TYPES)[number];

export const SCHEME_FIELD_LABEL: Record<SchemeFieldType, string> = {
  text: 'tekst', longtext: 'dłuższy tekst', number: 'liczba', choice: 'wybór', colour: 'kolor liturgiczny',
  date: 'data', time: 'godzina', bool: 'tak / nie', bible: 'fragment Pisma', person: 'osoba', link: 'link'
};

export interface SchemeChoice {
  readonly value: string;
  readonly label: string;
}

export interface SchemeField {
  /** Der Schlüssel des Wertes — `[a-z0-9_.-]{1,64}`, bleibt beim Umbenennen der Beschriftung. */
  readonly key: string;
  readonly label: string;
  readonly type: SchemeFieldType;
  /** `item` (Vorgabe): am Termin; `day`: an einem Vorkommen (der Tag einer Reihe). */
  readonly level?: 'item' | 'day';
  /** Offen: geht als Beschriftung und Wert im Klartext hinaus (Aushang, Gablota, Druck). */
  readonly public?: boolean;
  /** `choice` (und `colour`, wenn eigene Farben gewollt sind). */
  readonly options?: readonly SchemeChoice[];
  /** `number`: was hinter der Zahl steht. */
  readonly unit?: string;
  readonly required?: boolean;
  /** Nur bei diesen Arten (das universelle Schema: Intentionen nur an der Messe). */
  readonly onlyKinds?: readonly ItemKind[];
  /** Was das Feld bedeutet — für die Beschreibung neben dem JSON. */
  readonly says?: string;
}

/** Eine Liste von Einträgen an jedem Vorkommen — Intentionen, Anmeldungen, Dienste. */
export interface RecordList {
  readonly key: string;
  /** „Intencje". */
  readonly label: string;
  /** „intencja" — ein Eintrag. */
  readonly itemLabel?: string;
  /** Die Arten eines Eintrags (pojedyncza / zbiorowa). */
  readonly modes?: readonly SchemeChoice[];
  /** Beschriftung des OFFENEN Textes (die vorgelesene Intention) — fehlt: kein solcher Text. */
  readonly textLabel?: string;
  /** Beschriftung der angehefteten Person (Kto odprawia, Kto się zapisał) — fehlt: keine. */
  readonly person?: string;
  /** Weitere Felder (offen oder versiegelt unter dem Schlüssel des Kalenderbereichs). */
  readonly fields: readonly SchemeField[];
  /** Mitglieder und Linkhalter dürfen eintragen — ihr Eintrag wartet auf die Kanzlei. */
  readonly outside?: boolean;
  readonly onlyKinds?: readonly ItemKind[];
  /** Die Regel als Ablauf (`flow/flowRun.ts`, `runRule`) — fehlt: die Kanzlei nimmt an, von aussen wartet. */
  readonly rule?: FlowDoc | null;
  readonly says?: string;
}

export interface SchemeDef {
  readonly name: string;
  /** Die offene Art seiner Termine (Messplan, Gablota): Messe, Beichte … Fehlt: `appointment`. */
  readonly kind?: ItemKind;
  /** Zur Wahl gestellte Arten (das universelle Schema: alle wie bisher). */
  readonly kinds?: readonly ItemKind[];
  /** Der Titel geht offen hinaus. Fehlt: wie bisher — offen bei Messe, Beichte, Nabożeństwo. */
  readonly publicTitle?: boolean;
  readonly fields: readonly SchemeField[];
  readonly lists: readonly RecordList[];
  readonly says?: string;
}

/** Ein Plan: ein Ablauf, der Termine für einen Zeitraum anlegt (D8–D12). */
export interface PlanDef {
  readonly name: string;
  /** Welches Schema die angelegten Termine bekommen (Kennung eines Schemas dieses Kalenders) — fehlt: das universelle. */
  readonly schemeId?: string | null;
  /** Die Art der angelegten Termine (Messe). */
  readonly kind?: ItemKind;
  /** Wie viele Wochen die Vorschau vorschlägt. */
  readonly weeks?: number;
  readonly flow: FlowDoc;
  readonly says?: string;
}

/** Die Farben der Liturgie — Wert = Wort, wie es im Aushang steht. */
export const LITURGICAL_COLOURS: readonly SchemeChoice[] = [
  { value: 'biały', label: 'biały' },
  { value: 'czerwony', label: 'czerwony' },
  { value: 'zielony', label: 'zielony' },
  { value: 'fioletowy', label: 'fioletowy' },
  { value: 'różowy', label: 'różowy' },
  { value: 'czarny', label: 'czarny' },
  { value: 'złoty', label: 'złoty' },
  { value: 'niebieski', label: 'niebieski' }
];

/** Für ein Farbfeld: die CSS-Klasse des Plättchens (`.wk-lc-…`) — fremde Wörter ohne Plättchen. */
export const colourClass = (word: string | null | undefined): string | null => {
  const w = (word ?? '').trim().toLowerCase();
  const map: Record<string, string> = {
    'biały': 'white', 'bialy': 'white', 'czerwony': 'red', 'zielony': 'green', 'fioletowy': 'violet',
    'różowy': 'rose', 'rozowy': 'rose', 'czarny': 'black', 'złoty': 'gold', 'zloty': 'gold', 'niebieski': 'blue'
  };
  return map[w] === undefined ? null : `wk-lc-${map[w]}`;
};

export const KEY_PATTERN = /^[a-z0-9_.-]{1,64}$/;

/** Ein Schlüssel aus einer Beschriftung: „Kolor szat" → `kolor_szat`. */
export function keyOf(label: string, taken: readonly string[] = []): string {
  const base = label.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'pole';
  let key = base;
  for (let n = 2; taken.includes(key); n += 1) key = `${base}_${n}`;
  return key;
}

/* -- Das universelle Schema ---------------------------------------------------------------- */

export const UNIVERSAL_ID = 'universal';

export const INTENTION_MODES: readonly SchemeChoice[] = [
  { value: 'single', label: 'pojedyncza' },
  { value: 'collective', label: 'zbiorowa' }
];

/**
 * Was Termine bisher konnten, als Schema: jede Art, und an der Messe die
 * Intentionen — offener Text, Art, wer odprawia, Ofiarodawca und Ofiara
 * versiegelt. Die Liste heisst `intencje`; „Msze i nabożeństwa" liest sie.
 */
export const UNIVERSAL: SchemeDef = {
  name: 'Uniwersalny',
  kinds: ['appointment', 'mass', 'confession', 'devotion', 'visit'],
  fields: [],
  lists: [{
    key: 'intencje',
    label: 'Intencje',
    itemLabel: 'intencja',
    modes: INTENTION_MODES,
    textLabel: 'Treść intencji',
    person: 'Kto odprawia',
    fields: [
      { key: 'giver', label: 'Ofiarodawca', type: 'text', says: 'Kto zamówił — nie jest odczytywany, zostaje w kancelarii.' },
      { key: 'offering', label: 'Ofiara', type: 'text', says: 'Ofiara — zostaje w kancelarii.' }
    ],
    onlyKinds: ['mass'],
    says: 'Intencje mszy: treść czytana na mszy i w gablocie, rodzaj (pojedyncza / zbiorowa), kto odprawia.'
  }],
  says: 'Schemat, który ma każdy dawny termin: wszystkie rodzaje i intencje mszy.'
};

/** Was an diesem Termin gilt: seine Felder und Listen, nach seiner Art gefiltert. */
export function shownFields(scheme: SchemeDef, kind: string, level: 'item' | 'day' = 'item'): readonly SchemeField[] {
  return scheme.fields.filter((f) => (f.level ?? 'item') === level && (f.onlyKinds === undefined || f.onlyKinds.includes(kind as ItemKind)));
}

export function shownLists(scheme: SchemeDef, kind: string): readonly RecordList[] {
  return scheme.lists.filter((l) => l.onlyKinds === undefined || l.onlyKinds.includes(kind as ItemKind));
}

/** Wie ein Wert dasteht: bei einer Wahl ihr Wort, bei ja/nein „tak"/„nie". */
export function shownValue(field: SchemeField, text: string): string {
  if (text === '') return '';
  if ((field.type === 'choice' || field.type === 'colour') && field.options !== undefined) {
    return field.options.find((o) => o.value === text)?.label ?? text;
  }
  if (field.type === 'bool') return text === 'tak' ? 'tak' : text === 'nie' ? 'nie' : text;
  if (field.type === 'number' && field.unit) return `${text} ${field.unit}`;
  return text;
}

/* -- Gespeichert: versiegelt je Kalender (`app.calendar_doc`) -------------------------------- */

export type DocKind = 'scheme' | 'plan';

export interface DocRow {
  readonly docId: string;
  readonly kind: DocKind;
  readonly areaId: string;
  readonly epoch: number;
  readonly sealed: string;
  readonly version: number;
  readonly updatedAt: string;
}

export interface OpenedDoc<T> {
  readonly docId: string;
  readonly kind: DocKind;
  readonly version: number;
  readonly updatedAt: string;
  readonly def: T;
}

const docAad = (docId: string) => aad('calendar', 'doc', docId, Field.CalendarDoc, 1);

/** Unter welchem Bereich: ein Schema unter dem, der die Termine sieht; ein Plan unter dem eigenen des Kalenders. */
export const docAreaOf = (calendar: CalendarRow, kind: DocKind): string =>
  kind === 'scheme' ? calendar.visibilityAreaId ?? calendar.areaId : calendar.areaId;

export const loadDocs = (calendarId: string): Promise<{ docs: readonly DocRow[] }> =>
  call(`/workspace/calendar/${encodeURIComponent(calendarId)}/docs`);

/** Die Schemata und Pläne eines Kalenders, geöffnet — was nicht aufgeht, fehlt. */
export async function openDocs(ring: Ring, calendarId: string): Promise<{
  schemes: readonly OpenedDoc<SchemeDef>[]; plans: readonly OpenedDoc<PlanDef>[];
}> {
  const { docs } = await loadDocs(calendarId);
  const schemes: OpenedDoc<SchemeDef>[] = [];
  const plans: OpenedDoc<PlanDef>[] = [];
  for (const row of docs) {
    try {
      const key = (await areaKeys(ring, row.areaId)).get(row.epoch);
      if (key === undefined) continue;
      const def = JSON.parse(await openText(key, docAad(row.docId), fromBase64Url(row.sealed))) as SchemeDef & PlanDef;
      if (row.kind === 'scheme') schemes.push({ docId: row.docId, kind: row.kind, version: row.version, updatedAt: row.updatedAt, def });
      else plans.push({ docId: row.docId, kind: row.kind, version: row.version, updatedAt: row.updatedAt, def });
    } catch {
      /* Nicht lesbar — dann eben ohne. */
    }
  }
  const byName = (a: OpenedDoc<{ name: string }>, b: OpenedDoc<{ name: string }>) => a.def.name.localeCompare(b.def.name, 'pl');
  return { schemes: schemes.sort(byName), plans: plans.sort(byName) };
}

/**
 * Ein Schema oder einen Plan speichern — neu (ohne `docId`) oder ändernd
 * (`version`: die zuletzt gelesene; hat inzwischen jemand anders gespeichert,
 * sagt der Dienst es und nichts wird überschrieben).
 */
export async function saveDoc(
  ring: Ring, calendar: CalendarRow, kind: DocKind, def: SchemeDef | PlanDef, docId?: string, version?: number
): Promise<{ docId: string; version: number }> {
  const id = docId ?? newId();
  const areaId = docAreaOf(calendar, kind);
  const newest = newestKey(await areaKeys(ring, areaId, true));
  if (newest === null) throw new WorkspaceError('Nie masz klucza tego obszaru — nie da się tu zapisać.');
  const sealed = toBase64Url(await sealText(newest.key, docAad(id), JSON.stringify(def)));
  return call(`/workspace/calendar/${encodeURIComponent(calendar.calendarId)}/doc`, {
    method: 'POST',
    body: JSON.stringify({ docId: id, kind, areaId, epoch: newest.epoch, sealed, version: version ?? null })
  });
}

export const deleteDoc = (docId: string): Promise<{ deleted: boolean }> =>
  call(`/workspace/calendar-doc/${encodeURIComponent(docId)}/delete`, { method: 'POST' });

/** Das Schema eines Termins: sein eigenes, sonst das universelle. */
export function schemeOf(schemes: readonly OpenedDoc<SchemeDef>[], schemeId: string | null | undefined): { id: string; def: SchemeDef } {
  const found = schemeId == null ? undefined : schemes.find((s) => s.docId === schemeId);
  return found === undefined ? { id: UNIVERSAL_ID, def: UNIVERSAL } : { id: found.docId, def: found.def };
}
