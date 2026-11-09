/**
 * 2026-10-29 — MESSEN, NABOŻEŃSTWA UND INTENTIONEN ALS JSON ("recreatio/masses", Fassung 1).
 *
 * Wie jedes JSON der App (Erinnerung „json-import-export"): Export, Import mit
 * Vorschau, daneben die Beschreibung — dieselbe, die ein Assistent über MCP
 * liest. Der Hauptweg ist die KANZLEI MIT DEM BUCH: ein Monat der Księga
 * intencji, abfotografiert, von einem Assistenten in dieses Format gebracht,
 * hier mit Vorschau eingelesen.
 *
 * <code>
 *   "masses"       Gottesdienste — Messe, Nabożeństwo, Beichte; einzeln oder als Reihe.
 *                  Mit "id": an Ort und Stelle (nur, was das Dokument nennt); ohne: neu;
 *                  "changeFrom": „ta i następne" (0079 — `handover`).
 *   "occurrences"  EINE Messe an EINEM Tag mit ihren Intentionen — gefunden über
 *                  "mass" ("id" oder "@key") + "date", oder Kalender + "date" + "time".
 * </code>
 *
 * <b>Angesprochen wird das Vorkommen über Messe und TAG</b>, nicht über
 * `occurrenceAt`: der ursprüngliche Beginn steht auf keinem Zettel, und er
 * ändert sich, wenn die Reihe eine neue Uhrzeit bekommt (der Dienst trägt die
 * Intentionen dann zum selben Tag mit, `Mass.Carry.cs`). Deshalb ordnet der
 * Import nach dem Anlegen und Ändern der Messen die Tage NEU zu.
 *
 * <b>Wiedererkannt wird eine Intention</b> an ihrem "id" — oder, ohne, an
 * derselben Treść an derselben Messe: zweimal abgeschrieben, entsteht sie nicht
 * doppelt. Trägt die Messe schon eine ANDERE, ist das ein Konflikt (zwei
 * pojedyncze heissen zwei Priester): dann kommt nichts dazu, ausser die Kanzlei
 * wählt „dopisz".
 *
 * <b>Gelöscht wird nichts.</b> Wycofana ist "status": "cancelled", eine Reihe
 * endet mit "until", ein Tag fällt mit "cancelled": true aus.
 *
 * Rein — kein Dienst, kein Schlüssel. Geladen und geschrieben wird in
 * `massesImport.ts`; nachgemessen in `scripts/app-json-masses-check.mjs`.
 */

import { t } from '../core/i18n';
import { describe, keyLines, pretty, textNode, type JsonNode } from '../core/jsonTree';
import type { Duty, RepeatKind } from '../calendar/calendar';
import { dutyOf } from '../calendar/eventWords';
import { CONFESSION, DEVOTION, INTENTION_STATUS_LABEL, KIND_LABEL, MASS, SERVICE_LABEL, type IntentionKind } from './mass';

export const MASSES_FORMAT = 'recreatio/masses';
export const MASSES_VERSION = 1;

/* Grenzen: ein Dokument ist ein Monat der Księga (höchstens ein Jahr), keine Sicherung. */
export const MAX_MASSES = 100;
export const MAX_OCCURRENCES = 1500;
export const MAX_INTENTIONS = 40;
export const MAX_DAYS = 366;
/** Wie `Mass.MaxText` am Dienst. */
export const TEXT_MAX = 400;
/** Wie die Felder „Kto zamówił" und „Ofiara" in der Kanzlei. */
export const GIVER_MAX = 200;
export const OFFERING_MAX = 100;
/** Wie `Calendar.MaxTitle`. */
export const TITLE_MAX = 200;
export const PLACE_MAX = 200;
/** Wie am Dienst: höchstens 20 Personen an einem Termin. */
export const MAX_PEOPLE = 20;

export type ServiceKind = typeof MASS | typeof DEVOTION | typeof CONFESSION;
export type IntentionStatus = 'accepted' | 'celebrated' | 'cancelled';
export type SeriesRepeat = RepeatKind;

/** Wie lange, wenn niemand es sagt — wie „Nowy wpis" (`ServiceForm.tsx`). */
export const DEFAULT_MINUTES: Readonly<Record<ServiceKind, number>> = { mass: 45, confession: 60, devotion: 30 };

/* -- Kleine Helfer ------------------------------------------------------------------------------ */

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const has = (o: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(o, key);

/** Ohne Akzente, klein, „ł" als „l" — zum Vergleichen, nicht zum Anzeigen. */
const fold = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[łŁ]/g, 'l').toLowerCase().trim(); // i18n-ignore

/** Ein Text als Schlüssel: dieselbe Intention, auch anders geschrieben („Za śp. Jana" — „za sp jana"). */
export const textKey = (s: string): string => fold(s).replace(/[^a-z0-9]+/g, ' ').trim();

const quote = (s: string): string => `„${s}”`;
const two = (n: number): string => String(n).padStart(2, '0');
const short = (id: string): string => id.slice(0, 8);
const cut = (s: string, n = 60): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[a-z0-9][a-z0-9_-]{0,40}$/i;

/* -- Tage und Uhrzeiten — in Ortszeit, wie die Kanzlei sie sieht (`mass.dayKey`) ----------------- */

const DAY = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const CLOCK = /^(\d{1,2})[:.](\d{2})$/;

export const dayOfDate = (d: Date): string => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
export const timeOfDate = (d: Date): string => `${two(d.getHours())}:${two(d.getMinutes())}`;
export const dateOf = (day: string): Date => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (day: string, n: number): string => {
  const d = dateOf(day);
  d.setDate(d.getDate() + n);
  return dayOfDate(d);
};
const addYears = (day: string, n: number): string => {
  const d = dateOf(day);
  return dayOfDate(new Date(d.getFullYear() + n, d.getMonth(), d.getDate()));
};
/* Gerundet: zwischen zwei Mitternächten liegen an den Umstellungstagen 23 oder 25 Stunden. */
export const daysBetween = (a: string, b: string): number => Math.round((dateOf(b).getTime() - dateOf(a).getTime()) / 86_400_000);
const weekdayIndex = (day: string): number => (dateOf(day).getDay() + 6) % 7;
const lastDayOf = (year: number, month0: number): number => new Date(year, month0 + 1, 0).getDate();

/** Ein Tag, den es gibt — „2026-02-30" gibt es nicht. */
export function readDay(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = DAY.exec(value.trim());
  if (m === null) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const at = new Date(y, mo - 1, d);
  return at.getFullYear() === y && at.getMonth() === mo - 1 && at.getDate() === d ? dayOfDate(at) : null;
}

/** „7:00", „07:00", „7.00" → „07:00". */
export function readClock(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = CLOCK.exec(value.trim());
  if (m === null) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h > 23 || min > 59 ? null : `${two(h)}:${two(min)}`;
}

const clockShort = (time: string): string => time.replace(/^0(\d)/, '$1');

/* Die kurzen Namen des Plans („pn", „wt" …) — als Texte, nicht aus `Intl` („pon.") — so stehen sie in der Kanzlei. */
const WD_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/** „pn 2.11 7:00" — so steht ein Vorkommen in der Vorschau. */
export const whenLabel = (day: string, time: string | null): string => {
  const d = dateOf(day);
  return `${t(`massesJson.wd.${WD_KEYS[d.getDay()]}`)} ${d.getDate()}.${d.getMonth() + 1}${time === null ? '' : ` ${clockShort(time)}`}`;
};
const dateWords = (day: string): string => {
  const d = dateOf(day);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
};

/* -- Wochentage ------------------------------------------------------------------------------- */

/**
 * Wie im JSON der Termine (`calendar/appointmentsJson.ts`): „so" für Samstag.
 * Gelesen wird duldsam — „sb" wie im Formular der Kanzlei, ganze Namen, 1–7.
 */
export const WEEKDAY_WORDS = ['pn', 'wt', 'śr', 'cz', 'pt', 'so', 'nd'] as const; // i18n-ignore — Werte des Formats

const WEEKDAY_OF: Readonly<Record<string, number>> = (() => {
  const out: Record<string, number> = {};
  const add = (i: number, ...names: string[]) => { for (const n of names) out[n] = i; };
  add(0, 'pn', 'pon', 'poniedzialek', 'mon', 'monday', '1');
  add(1, 'wt', 'wto', 'wtorek', 'tue', 'tuesday', '2');
  add(2, 'sr', 'sro', 'sroda', 'wed', 'wednesday', '3');
  add(3, 'cz', 'czw', 'czwartek', 'thu', 'thursday', '4');
  add(4, 'pt', 'pia', 'piatek', 'fri', 'friday', '5');
  add(5, 'so', 'sb', 'sob', 'sobota', 'sat', 'saturday', '6');
  add(6, 'nd', 'ndz', 'nie', 'niedziela', 'sun', 'sunday', '7');
  return out;
})();

export const weekdayWords = (bits: number): string[] => WEEKDAY_WORDS.filter((_, i) => (bits & (1 << i)) !== 0);

/* -- Was im Kalender ist (gefüllt von `massesImport.ts`) ---------------------------------------- */

export interface Person {
  readonly roleId: string;
  /** Wie die Gruppe ihn kennt — leer, wenn der Name nicht aufgeht. */
  readonly name: string;
}

export interface PinnedNow {
  readonly roleId: string;
  readonly duty: Duty;
}

export interface CalendarNow {
  readonly calendarId: string;
  readonly title: string;
  readonly areaName: string;
  readonly mayWrite: boolean;
  readonly durationMinutes?: number;
}

/** Eine Reihe (oder ein einzelner Gottesdienst), wie sie jetzt gespeichert ist. */
export interface SeriesNow {
  readonly itemId: string;
  readonly calendarId: string;
  readonly kind: string;
  /** Der offene Name — leer: es heisst nach seiner Art („Msza"). */
  readonly title: string;
  /** Erster Tag und Uhrzeit der Reihe, Ortszeit. */
  readonly date: string;
  readonly time: string;
  readonly minutes: number;
  readonly repeat: SeriesRepeat;
  readonly every: number;
  readonly weekdays: number;
  /** Letzter Tag — `null`: ohne Ende (zehn Jahre, wie der Kalender es anlegt). */
  readonly until: string | null;
  /** `null`: versiegelt und hier nicht zu öffnen. */
  readonly place: string | null;
  /** Wer da ist — für die Reihe (am häufigsten an ihren Vorkommen). */
  readonly people: readonly PinnedNow[];
  readonly editable: boolean;
}

export interface IntentionNow {
  readonly id: string;
  readonly ordinal: number;
  readonly text: string;
  readonly kind: IntentionKind;
  readonly status: IntentionStatus;
  readonly celebrant: string | null;
  /** `null`: versiegelt und hier nicht zu öffnen; `''`: keiner. */
  readonly giver: string | null;
  readonly offering: string | null;
}

export interface OccurrenceNow {
  readonly itemId: string;
  readonly calendarId: string;
  readonly kind: string;
  /** Die Adresse der Intentionen — der ursprüngliche Beginn. */
  readonly occurrenceAt: string;
  /** Tag und Uhrzeit, wie sie im Plan stehen (eine verlegte Messe: die neue Zeit). */
  readonly date: string;
  readonly time: string;
  /** Der Tag der Adresse — nach ihm trägt der Dienst Intentionen mit. */
  readonly addressDate: string;
  readonly status: string;
  /** Nur dieser Tag abgesagt (zurückholbar). */
  readonly skipped: boolean;
  readonly moved: boolean;
  readonly people: readonly PinnedNow[];
  readonly intentions: readonly IntentionNow[];
}

export interface MassesState {
  readonly calendars: readonly CalendarNow[];
  /** Der oben in der Kanzlei gewählte Kalender. */
  readonly chosen: string;
  /** Die Kalender, deren Vorkommen geladen sind. */
  readonly loaded: readonly string[];
  /** Geladen von — bis (einschliesslich), Ortszeit. */
  readonly from: string;
  readonly to: string;
  readonly series: ReadonlyMap<string, SeriesNow>;
  readonly occurrences: readonly OccurrenceNow[];
  /** Die Menschen der Gruppe jedes Kalenders. */
  readonly people: ReadonlyMap<string, readonly Person[]>;
  readonly today: string;
}

/* -- Die Beschreibung ---------------------------------------------------------------------------- */

type DescParams = Readonly<Record<string, string | number>>;

/** Eine Tabelle Schlüssel → Satz, deren Sätze beim Lesen aus `massesJson.desc.<gruppe>.<schlüssel>` kommen. */
function described(group: string, keys: readonly string[], params: () => Readonly<Record<string, DescParams>> = () => ({})): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const k of keys) Object.defineProperty(out, k, { enumerable: true, get: () => t(`massesJson.desc.${group}.${k}`, params()[k]) });
  return out;
}

export const MASSES_TOP_KEYS: Readonly<Record<string, string>> = described('top',
  ['format', 'version', 'calendar', 'calendarName', 'from', 'to', 'masses', 'occurrences'],
  () => ({ format: { format: MASSES_FORMAT }, version: { version: MASSES_VERSION } }));

export const MASS_KEYS: Readonly<Record<string, string>> = described('mass',
  ['id', 'key', 'calendar', 'kind', 'title', 'date', 'time', 'minutes', 'repeat', 'every', 'weekdays', 'until', 'place', 'celebrants', 'changeFrom'],
  () => ({
    title: { max: TITLE_MAX },
    minutes: { mass: DEFAULT_MINUTES.mass, confession: DEFAULT_MINUTES.confession, devotion: DEFAULT_MINUTES.devotion },
    weekdays: { days: JSON.stringify([...WEEKDAY_WORDS]) },
    place: { max: PLACE_MAX },
    celebrants: { max: MAX_PEOPLE }
  }));

export const OCCURRENCE_KEYS: Readonly<Record<string, string>> = described('occurrence',
  ['date', 'time', 'mass', 'calendar', 'free', 'collective', 'cancelled', 'celebrants', 'intentions'],
  () => ({ intentions: { max: MAX_INTENTIONS } }));

export const INTENTION_KEYS: Readonly<Record<string, string>> = described('intention',
  ['id', 'text', 'kind', 'status', 'giver', 'offering', 'celebrant'],
  () => ({
    text: { max: TEXT_MAX },
    kind: { single: KIND_LABEL.single, collective: KIND_LABEL.collective },
    status: { accepted: INTENTION_STATUS_LABEL.accepted, celebrated: INTENTION_STATUS_LABEL.celebrated, cancelled: INTENTION_STATUS_LABEL.cancelled },
    giver: { max: GIVER_MAX },
    offering: { max: OFFERING_MAX }
  }));

/** Jeder beschriebene Schlüssel als Pfad (`masses[].title`, `occurrences[].intentions[].giver`) — für die Prüfung. */
export function massesKeyPaths(): Record<string, string> {
  const out: Record<string, string> = { ...MASSES_TOP_KEYS };
  for (const [k, v] of Object.entries(MASS_KEYS)) out[`masses[].${k}`] = v;
  for (const [k, v] of Object.entries(OCCURRENCE_KEYS)) out[`occurrences[].${k}`] = v;
  for (const [k, v] of Object.entries(INTENTION_KEYS)) out[`occurrences[].intentions[].${k}`] = v;
  return out;
}

/** Ein Monat der Księga — die Messen stehen schon im Kalender (7:00 und 18:00). */
export function bookSample(): Record<string, unknown> {
  return {
    format: MASSES_FORMAT,
    version: MASSES_VERSION,
    from: '2026-11-02',
    to: '2026-11-04',
    occurrences: [
      { date: '2026-11-02', time: '07:00', intentions: ['Za śp. Jana Kowalskiego w 1. rocznicę śmierci'] }, // i18n-ignore — Beispielinhalt
      {
        date: '2026-11-02', time: '18:00', collective: true,
        intentions: [
          'Za zmarłych polecanych w wypominkach', // i18n-ignore
          { text: 'Za śp. Annę i Józefa Nowaków', giver: 'córka Maria', offering: '50 zł' }, // i18n-ignore
          'Za śp. Stanisława Wójcika' // i18n-ignore
        ]
      },
      { date: '2026-11-03', time: '07:00', free: true },
      {
        date: '2026-11-03', time: '18:00',
        intentions: [
          { text: 'O zdrowie i Boże błogosławieństwo dla Zofii w 80. rocznicę urodzin', giver: 'wnuki' }, // i18n-ignore
          { text: 'Za śp. Henryka Lisa — od sąsiadów', celebrant: 'ks. Marek Nowak' } // i18n-ignore
        ]
      },
      { date: '2026-11-04', time: '07:00', intentions: [{ text: 'Dziękczynna za 25 lat małżeństwa Ewy i Piotra', status: 'accepted' }] } // i18n-ignore
    ]
  };
}

/** Neue Messen und ein Nabożeństwo — mit Intentionen an der neuen Reihe ("@rano"). */
export function seriesSample(): Record<string, unknown> {
  return {
    format: MASSES_FORMAT,
    version: MASSES_VERSION,
    masses: [
      {
        key: 'rano', kind: 'mass', title: 'Msza św.', date: '2026-11-02', time: '07:00', // i18n-ignore — Beispielinhalt
        repeat: 'weekly', weekdays: ['pn', 'wt', 'śr', 'cz', 'pt', 'so'], until: '2027-06-30', celebrants: ['ks. Jan Kowalski'] // i18n-ignore
      },
      {
        key: 'dzieci', kind: 'mass', title: 'Msza św. z udziałem dzieci', date: '2026-11-08', time: '10:00', minutes: 60, // i18n-ignore
        repeat: 'weekly', weekdays: ['nd'], every: 1, until: null
      },
      { kind: 'devotion', title: 'Różaniec', date: '2026-11-02', time: '17:30', minutes: 30, repeat: 'daily', until: '2026-11-30', place: 'kaplica MB Częstochowskiej' }, // i18n-ignore
      { kind: 'confession', title: '', date: '2026-11-06', time: '17:00', minutes: 60, repeat: 'weekly', weekdays: ['pt'], until: '2026-12-31', celebrants: ['ks. Marek Nowak'] }
    ],
    occurrences: [
      { date: '2026-11-02', mass: '@rano', intentions: ['Za śp. Jana Kowalskiego'] }, // i18n-ignore
      { date: '2026-11-11', mass: '@rano', cancelled: true, celebrants: ['ks. Marek Nowak'] },
      { date: '2026-11-08', mass: '@dzieci', collective: true, intentions: ['Za dzieci przygotowujące się do I Komunii Świętej', { text: 'Za katechetów i rodziców', kind: 'collective' }] } // i18n-ignore
    ]
  };
}

const INTRO = (): string => t('massesJson.desc.intro', {
  masses: MAX_MASSES, occurrences: MAX_OCCURRENCES, intentions: MAX_INTENTIONS, days: MAX_DAYS, keys: keyLines(MASSES_TOP_KEYS)
});

const MASS_TEXT = (): string => t('massesJson.desc.massText', { keys: keyLines(MASS_KEYS) });

const OCCURRENCE_TEXT = (): string => t('massesJson.desc.occurrenceText', { keys: keyLines(OCCURRENCE_KEYS) });

const INTENTION_TEXT = (): string => t('massesJson.desc.intentionText', { keys: keyLines(INTENTION_KEYS) });

const BOOK_TEXT = (): string => t('massesJson.desc.bookText', { sample: pretty(bookSample()) });

const SERIES_TEXT = (): string => t('massesJson.desc.seriesText', { sample: pretty(seriesSample()) });

/*
 * 2026-10-30 — WAS DIE APP MIT MESSEN UND INTENTIONEN TUT: Termine wie jeder andere (`CalendarApp.tsx`: „N int.",
 * „Przypisane do mnie" aus `Agenda.cs` `mine`); die Kanzlei (`MassOffice.tsx`, `officeDays.ts`: zwei Wochen); der
 * offene Plan ohne Konto (`Mass.Show.cs` — nur offengelegte Bereiche, ohne Geber, Gabe, Ort, Priester und
 * Zurückgezogenes; `MassParts.tsx`, `Widget.tsx`) und der Bogen daraus (`PrintSheet.tsx`, `sheet.ts`); „odprawiona" nur
 * von Hand (`IntentionEntry.tsx`); das Mitwandern nach dem Tag (`Mass.Carry.cs`); keine Erinnerung, kein Push (`Push.cs`).
 */
const USAGE_TEXT = (): string => t('massesJson.desc.usage');

/** 2026-10-29 — DIE MESSEN ALS JSON: der Baum, aus dem die Beschreibung neben dem Import (und für MCP) entsteht. */
export const MASSES_JSON: JsonNode = {
  key: 'masses',
  get title() { return t('massesJson.desc.title', { format: MASSES_FORMAT, version: MASSES_VERSION }); },
  get short() { return t('massesJson.desc.short'); },
  text: INTRO,
  inside: () => [
    textNode('masses.usage', t('massesJson.desc.section.usage'), USAGE_TEXT),
    textNode('masses.mass', t('massesJson.desc.section.mass'), MASS_TEXT),
    textNode('masses.occurrence', t('massesJson.desc.section.occurrence'), OCCURRENCE_TEXT),
    textNode('masses.intention', t('massesJson.desc.section.intention'), INTENTION_TEXT),
    textNode('masses.book', t('massesJson.desc.section.book'), BOOK_TEXT),
    textNode('masses.series', t('massesJson.desc.section.series'), SERIES_TEXT)
  ],
  samples: () => [
    { label: t('massesJson.desc.sampleBook'), doc: bookSample },
    { label: t('massesJson.desc.sampleSeries'), doc: seriesSample }
  ]
};

/** Die Beschreibung als Text — ohne jeden Zusammenhang der App aufrufbar (MCP, `import-formats.mjs`). */
export const massesDescription = (): string => describe(MASSES_JSON);

/**
 * Der Auftrag für die eigene KI (Erinnerung „ai-stays-outside"): die Księga
 * vom Foto in dieses Format — mit dem Export des Zeitraums als Vorlage, damit
 * sie die Messen nicht raten muss.
 */
export function massesPrompt(exported: unknown): string {
  return [
    t('massesJson.prompt.task'),
    t('massesJson.prompt.export'),
    t('massesJson.prompt.answer'),
    t('massesJson.prompt.exact'),
    '',
    massesDescription(),
    '',
    t('massesJson.prompt.exportHead'),
    pretty(exported)
  ].join('\n');
}

/* -- Das Dokument lesen ---------------------------------------------------------------------------- */

export interface IntentionDoc {
  readonly id: string | null;
  readonly text: string;
  readonly kind: IntentionKind | undefined;
  readonly status: IntentionStatus | undefined;
  readonly giver: string | undefined;
  readonly offering: string | undefined;
  /** `null`: niemand mehr. */
  readonly celebrant: string | null | undefined;
}

export interface MassDoc {
  /** Wie die Messe in Warnungen heisst: „Msza 2 (Różaniec 17:30)". */
  readonly label: string;
  readonly id: string | null;
  readonly key: string | null;
  readonly calendar: string | null;
  readonly kind: ServiceKind | undefined;
  readonly title: string | undefined;
  readonly date: string | undefined;
  readonly time: string | undefined;
  readonly minutes: number | undefined;
  readonly repeat: SeriesRepeat | undefined;
  readonly every: number | undefined;
  readonly weekdays: number | undefined;
  /** `null`: ohne Ende. */
  readonly until: string | null | undefined;
  readonly place: string | undefined;
  readonly celebrants: readonly string[] | undefined;
  readonly changeFrom: string | undefined;
}

export interface OccurrenceDoc {
  readonly label: string;
  readonly date: string;
  readonly time: string | undefined;
  readonly mass: string | undefined;
  readonly calendar: string | null;
  readonly free: boolean;
  readonly collective: boolean;
  readonly cancelled: boolean | undefined;
  readonly celebrants: readonly string[] | undefined;
  readonly intentions: readonly IntentionDoc[];
}

export interface MassesDoc {
  readonly calendar: string | null;
  readonly from: string | null;
  readonly to: string | null;
  readonly masses: readonly MassDoc[];
  readonly occurrences: readonly OccurrenceDoc[];
}

const KIND_OF: Readonly<Record<string, ServiceKind>> = {
  mass: MASS, msza: MASS, devotion: DEVOTION, nabozenstwo: DEVOTION, confession: CONFESSION, spowiedz: CONFESSION
};
const REPEAT_OF: Readonly<Record<string, SeriesRepeat>> = {
  none: 'none', raz: 'none', daily: 'daily', codziennie: 'daily', weekly: 'weekly', 'co tydzien': 'weekly',
  monthly: 'monthly', 'co miesiac': 'monthly', yearly: 'yearly', 'co rok': 'yearly'
};
const INTENTION_KIND_OF: Readonly<Record<string, IntentionKind>> = {
  single: 'single', pojedyncza: 'single', collective: 'collective', zbiorowa: 'collective'
};
const STATUS_OF: Readonly<Record<string, IntentionStatus>> = {
  accepted: 'accepted', przyjeta: 'accepted', celebrated: 'celebrated', odprawiona: 'celebrated', cancelled: 'cancelled', wycofana: 'cancelled'
};

/** „wolna", „wolne", „—" — kein Text, sondern ein freier Termin. */
const FREE_WORDS = new Set(['wolna', 'wolne', 'wolny', 'free']);

function unknownKeys(o: Record<string, unknown>, known: Readonly<Record<string, string>>, where: string, warnings: string[]): void {
  for (const key of Object.keys(o)) if (!has(known, key)) warnings.push(t('massesJson.read.unknownKey', { where, key }));
}

/** Ein Text bis zur Grenze — was darüber geht, wird abgeschnitten und gesagt. */
function readText(value: unknown, max: number, where: string, what: string, warnings: string[]): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') { warnings.push(t('massesJson.read.notText', { where, what })); return undefined; }
  const text = value.trim().replace(/\s+/g, ' ');
  if (text.length > max) { warnings.push(t('massesJson.read.tooLong', { where, what, max })); return text.slice(0, max); }
  return text;
}

function readPeopleList(value: unknown, where: string, warnings: string[]): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (value === null) return [];
  const list = typeof value === 'string' ? [value] : Array.isArray(value) ? value : null;
  if (list === null) { warnings.push(t('massesJson.read.celebrantsList', { where })); return undefined; }
  const out: string[] = [];
  for (const one of list) {
    if (typeof one === 'string' && one.trim() !== '') { if (!out.includes(one.trim())) out.push(one.trim()); } else warnings.push(t('massesJson.read.notPerson', { where, value: cut(JSON.stringify(one) ?? '?', 30) }));
  }
  return out;
}

function readMass(raw: unknown, n: number, warnings: string[]): MassDoc | null {
  if (!isObject(raw)) { warnings.push(t('massesJson.read.massNotObject', { n })); return null; }
  const named = [typeof raw.title === 'string' ? raw.title.trim() : '', typeof raw.time === 'string' ? raw.time.trim() : ''].filter((s) => s !== '').join(' ');
  const where = named === '' ? t('massesJson.read.massAt', { n }) : t('massesJson.read.massAtNamed', { n, name: cut(named, 40) });
  unknownKeys(raw, MASS_KEYS, where, warnings);

  let id: string | null = null;
  if (raw.id !== undefined && raw.id !== null) {
    if (typeof raw.id === 'string' && raw.id.trim() !== '') id = raw.id.trim().toLowerCase();
    else warnings.push(t('massesJson.read.massId', { where }));
  }
  let key: string | null = null;
  if (raw.key !== undefined) {
    const wanted = typeof raw.key === 'string' ? raw.key.trim().replace(/^@/, '') : '';
    if (KEY.test(wanted)) key = wanted; else warnings.push(t('massesJson.read.massKey', { where }));
  }
  const calendar = typeof raw.calendar === 'string' && raw.calendar.trim() !== '' ? raw.calendar.trim() : null;
  if (raw.calendar !== undefined && raw.calendar !== null && calendar === null) warnings.push(t('massesJson.read.calendar', { where }));

  let kind: ServiceKind | undefined;
  if (raw.kind !== undefined) {
    kind = typeof raw.kind === 'string' ? KIND_OF[fold(raw.kind)] : undefined;
    if (kind === undefined) warnings.push(t('massesJson.read.kind', { where, value: String(raw.kind) }));
  }
  const title = readText(raw.title, TITLE_MAX, where, 'title', warnings);
  const date = raw.date === undefined ? undefined : readDay(raw.date) ?? undefined;
  if (raw.date !== undefined && date === undefined) warnings.push(t('massesJson.read.date', { where }));
  const time = raw.time === undefined ? undefined : readClock(raw.time) ?? undefined;
  if (raw.time !== undefined && time === undefined) warnings.push(t('massesJson.read.time', { where }));

  let minutes: number | undefined;
  if (raw.minutes !== undefined) {
    const value = typeof raw.minutes === 'string' ? Number(raw.minutes) : raw.minutes;
    if (typeof value === 'number' && Number.isInteger(value) && value >= 5 && value <= 1440) minutes = value;
    else warnings.push(t('massesJson.read.minutes', { where }));
  }
  let repeat: SeriesRepeat | undefined;
  if (raw.repeat !== undefined) {
    repeat = typeof raw.repeat === 'string' ? REPEAT_OF[fold(raw.repeat)] : undefined;
    if (repeat === undefined) warnings.push(t('massesJson.read.repeat', { where }));
  }
  let every: number | undefined;
  if (raw.every !== undefined) {
    if (typeof raw.every === 'number' && Number.isInteger(raw.every) && raw.every >= 1 && raw.every <= 99) every = raw.every;
    else warnings.push(t('massesJson.read.every', { where }));
  }
  let weekdays: number | undefined;
  if (raw.weekdays !== undefined) {
    const list = typeof raw.weekdays === 'string' ? raw.weekdays.split(/[,\s]+/) : Array.isArray(raw.weekdays) ? raw.weekdays : null;
    if (list === null) warnings.push(t('massesJson.read.weekdays', { where }));
    else {
      let bits = 0;
      for (const one of list) {
        const word = fold(String(one)).replace(/\.$/, '');
        if (word === '') continue;
        const at = WEEKDAY_OF[word];
        if (at === undefined) warnings.push(t('massesJson.read.weekday', { where, day: quote(String(one)), days: WEEKDAY_WORDS.join(', ') })); else bits |= 1 << at;
      }
      weekdays = bits;
    }
  }
  let until: string | null | undefined;
  if (raw.until !== undefined) {
    if (raw.until === null || raw.until === '') until = null;
    else {
      until = readDay(raw.until) ?? undefined;
      if (until === undefined) warnings.push(t('massesJson.read.until', { where }));
    }
  }
  const place = readText(raw.place, PLACE_MAX, where, 'place', warnings);
  const celebrants = readPeopleList(raw.celebrants, where, warnings);
  let changeFrom: string | undefined;
  if (raw.changeFrom !== undefined && raw.changeFrom !== null) {
    changeFrom = readDay(raw.changeFrom) ?? undefined;
    if (changeFrom === undefined) warnings.push(t('massesJson.read.changeFrom', { where }));
  }
  return { label: where, id, key, calendar, kind, title, date, time, minutes, repeat, every, weekdays, until, place, celebrants, changeFrom };
}

function readIntention(raw: unknown, where: string, warnings: string[]): IntentionDoc | 'free' | null {
  if (typeof raw === 'string') {
    const text = raw.trim().replace(/\s+/g, ' ');
    if (text === '') { warnings.push(t('massesJson.read.emptyIntention', { where })); return null; }
    if (FREE_WORDS.has(textKey(text))) return 'free';
    if (text.length > TEXT_MAX) warnings.push(t('massesJson.read.intentionTooLong', { where, text: quote(cut(text)), max: TEXT_MAX }));
    return { id: null, text: text.slice(0, TEXT_MAX), kind: undefined, status: undefined, giver: undefined, offering: undefined, celebrant: undefined };
  }
  if (!isObject(raw)) { warnings.push(t('massesJson.read.intentionShape', { where, value: cut(JSON.stringify(raw) ?? '?', 30) })); return null; }
  const text = readText(raw.text, TEXT_MAX, where, 'text', warnings);
  const label = `${where}${text === undefined || text === '' ? '' : `, ${quote(cut(text, 40))}`}`;
  unknownKeys(raw, INTENTION_KEYS, label, warnings);
  if (text === undefined || text === '') { warnings.push(t('massesJson.read.intentionNoText', { where })); return null; }
  if (FREE_WORDS.has(textKey(text)) && raw.id === undefined) return 'free';
  let id: string | null = null;
  if (raw.id !== undefined && raw.id !== null) {
    if (typeof raw.id === 'string' && raw.id.trim() !== '') id = raw.id.trim().toLowerCase();
    else warnings.push(t('massesJson.read.intentionId', { where: label }));
  }
  let kind: IntentionKind | undefined;
  if (raw.kind !== undefined) {
    kind = typeof raw.kind === 'string' ? INTENTION_KIND_OF[fold(raw.kind)] : undefined;
    if (kind === undefined) warnings.push(t('massesJson.read.intentionKind', { where: label }));
  }
  let status: IntentionStatus | undefined;
  if (raw.status !== undefined) {
    status = typeof raw.status === 'string' ? STATUS_OF[fold(raw.status)] : undefined;
    if (status === undefined) warnings.push(t('massesJson.read.intentionStatus', { where: label }));
  }
  const giver = readText(raw.giver, GIVER_MAX, label, 'giver', warnings);
  const offering = readText(raw.offering, OFFERING_MAX, label, 'offering', warnings);
  let celebrant: string | null | undefined;
  if (raw.celebrant !== undefined) {
    if (raw.celebrant === null || (typeof raw.celebrant === 'string' && raw.celebrant.trim() === '')) celebrant = null;
    else if (typeof raw.celebrant === 'string') celebrant = raw.celebrant.trim();
    else warnings.push(t('massesJson.read.intentionCelebrant', { where: label }));
  }
  return { id, text, kind, status, giver, offering, celebrant };
}

function readOccurrence(raw: unknown, n: number, warnings: string[]): OccurrenceDoc | null {
  if (!isObject(raw)) { warnings.push(t('massesJson.read.slotNotObject', { n })); return null; }
  /* Duldsam: „2026-11-02T07:00" trägt Tag und Stunde zugleich. */
  let dateText = typeof raw.date === 'string' ? raw.date.trim() : '';
  let timeFromDate: string | undefined;
  const joined = /^(\d{4}-\d{1,2}-\d{1,2})[T ](\d{1,2}[:.]\d{2})$/.exec(dateText);
  if (joined !== null) { dateText = joined[1]; timeFromDate = readClock(joined[2]) ?? undefined; }
  const date = readDay(dateText);
  const timeRaw = typeof raw.time === 'string' ? raw.time.trim() : '';
  const where = date === null ? t('massesJson.read.slotAt', { n }) : t('massesJson.read.slotAtWhen', { n, when: whenLabel(date, readClock(timeRaw) ?? timeFromDate ?? null) });
  unknownKeys(raw, OCCURRENCE_KEYS, where, warnings);
  if (date === null) { warnings.push(t('massesJson.read.slotDate', { where })); return null; }
  let time = timeFromDate;
  if (raw.time !== undefined) {
    time = readClock(raw.time) ?? undefined;
    if (time === undefined) warnings.push(t('massesJson.read.time', { where }));
  }
  let mass: string | undefined;
  if (raw.mass !== undefined && raw.mass !== null) {
    if (typeof raw.mass === 'string' && raw.mass.trim() !== '') mass = raw.mass.trim();
    else warnings.push(t('massesJson.read.slotMass', { where }));
  }
  const calendar = typeof raw.calendar === 'string' && raw.calendar.trim() !== '' ? raw.calendar.trim() : null;
  const flag = (key: 'free' | 'collective' | 'cancelled'): boolean | undefined => {
    const value = raw[key];
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'boolean') return value;
    warnings.push(t('massesJson.read.flag', { where, key }));
    return undefined;
  };
  let free = flag('free') === true;
  const collective = flag('collective') === true;
  const cancelled = flag('cancelled');
  const celebrants = readPeopleList(raw.celebrants, where, warnings);

  const intentions: IntentionDoc[] = [];
  if (raw.intentions !== undefined && raw.intentions !== null) {
    const list = typeof raw.intentions === 'string' ? [raw.intentions] : Array.isArray(raw.intentions) ? raw.intentions : null;
    if (list === null) warnings.push(t('massesJson.read.intentionsList', { where }));
    else {
      for (const one of list) {
        const read = readIntention(one, where, warnings);
        if (read === 'free') { if (list.length > 1) warnings.push(t('massesJson.read.freeAmong', { where })); else free = true; continue; }
        if (read === null) continue;
        if (intentions.length >= MAX_INTENTIONS) { warnings.push(t('massesJson.read.maxIntentions', { where, max: MAX_INTENTIONS })); break; }
        intentions.push(read);
      }
    }
  }
  if (free && intentions.length > 0) { warnings.push(t('massesJson.read.freeAndIntentions', { where })); free = false; }
  return { label: where, date, time, mass, calendar, free, collective, cancelled, celebrants, intentions };
}

/** Das Dokument duldsam lesen — was nicht passt, fällt mit einem Wort weg. */
export function readMassesDocument(value: unknown): { doc: MassesDoc; warnings: string[] } | { error: string } {
  if (!isObject(value)) return { error: Array.isArray(value) ? t('massesJson.read.isList') : t('massesJson.read.notDocument') };
  if (value.format !== undefined && value.format !== MASSES_FORMAT) return { error: t('massesJson.read.otherFormat', { format: String(value.format), expected: MASSES_FORMAT }) };
  if (value.masses === undefined && value.occurrences === undefined) return { error: t('massesJson.read.nothing') };
  const warnings: string[] = [];
  if (value.version !== undefined && value.version !== MASSES_VERSION) warnings.push(t('massesJson.read.version', { version: String(value.version), known: MASSES_VERSION }));
  unknownKeys(value, MASSES_TOP_KEYS, t('massesJson.read.document'), warnings);

  const calendar = typeof value.calendar === 'string' && value.calendar.trim() !== '' ? value.calendar.trim() : null;
  if (value.calendar !== undefined && value.calendar !== null && calendar === null) warnings.push(t('massesJson.read.docCalendar'));
  const day = (key: 'from' | 'to'): string | null => {
    if (value[key] === undefined || value[key] === null) return null;
    const read = readDay(value[key]);
    if (read === null) warnings.push(t('massesJson.read.docDay', { key }));
    return read;
  };
  let from = day('from');
  let to = day('to');
  if (from !== null && to !== null && to < from) { warnings.push(t('massesJson.read.swapped')); [from, to] = [to, from]; }

  const list = (key: 'masses' | 'occurrences', max: number): readonly unknown[] => {
    const raw = value[key];
    if (raw === undefined || raw === null) return [];
    if (!Array.isArray(raw)) { warnings.push(t('massesJson.read.notList', { key })); return []; }
    if (raw.length > max) { warnings.push(t('massesJson.read.maxList', { key, max })); return raw.slice(0, max); }
    return raw;
  };
  const masses = list('masses', MAX_MASSES).map((one, i) => readMass(one, i + 1, warnings)).filter((m): m is MassDoc => m !== null);
  const occurrences = list('occurrences', MAX_OCCURRENCES).map((one, i) => readOccurrence(one, i + 1, warnings)).filter((o): o is OccurrenceDoc => o !== null);
  return { doc: { calendar, from, to, masses, occurrences }, warnings };
}

/* -- Kalender und Menschen finden --------------------------------------------------------------- */

export const calendarName = (c: CalendarNow): string => (c.title !== '' && c.title !== c.areaName ? `${c.areaName} (${c.title})` : c.areaName || c.title);

/** Ein Kalender nach seinem "id" — oder seinem Namen (der Gruppe oder dem eigenen), wenn er eindeutig ist. */
export function findCalendar(ref: string, calendars: readonly CalendarNow[]): CalendarNow | null {
  const id = ref.trim().toLowerCase();
  const exact = calendars.find((c) => c.calendarId.toLowerCase() === id);
  if (exact !== undefined) return exact;
  const key = textKey(ref);
  if (key === '') return null;
  const named = calendars.filter((c) => textKey(c.title) === key || textKey(c.areaName) === key || textKey(`${c.areaName} ${c.title}`) === key);
  return named.length === 1 ? named[0] : null;
}

/** Was vor einem Namen stehen kann und nicht zum Namen gehört. */
const TITLE_WORDS = new Set([
  'ks', 'ksiadz', 'o', 'ojciec', 'br', 'brat', 's', 'siostra', 'bp', 'biskup', 'abp', 'arcybiskup', 'dk', 'diakon',
  'kl', 'kleryk', 'pan', 'pani', 'p', 'x', 'prob', 'proboszcz', 'wik', 'wikariusz', 'mgr', 'dr', 'prof'
]);
const personKey = (s: string): string => textKey(s).split(' ').filter((w) => w !== '' && !TITLE_WORDS.has(w)).join(' ');

/**
 * Wer gemeint ist — eine Kennung, oder ein Name, wie die Gruppe ihn kennt.
 * Erst genau, dann ohne „ks."; ein einzelnes Wort als Nachname, wenn er nur
 * einmal vorkommt. Mehrdeutig ist so schlecht wie unbekannt: lieber keiner als
 * der falsche Priester an der Messe.
 */
export function findPerson(ref: string, people: readonly Person[], pinned: ReadonlySet<string>): { roleId: string } | { problem: string } {
  const said = ref.trim();
  if (UUID.test(said)) {
    const id = said.toLowerCase();
    return people.some((p) => p.roleId === id) || pinned.has(id) ? { roleId: id } : { problem: t('massesJson.person.noSuchId', { who: quote(said) }) };
  }
  const named = people.filter((p) => p.name !== '');
  const exact = named.filter((p) => textKey(p.name) === textKey(said));
  if (exact.length === 1) return { roleId: exact[0].roleId };
  const bare = personKey(said);
  if (bare !== '') {
    const same = named.filter((p) => personKey(p.name) === bare);
    if (same.length === 1) return { roleId: same[0].roleId };
    if (same.length > 1) return { problem: t('massesJson.person.sameName', { who: quote(said) }) };
    const words = bare.split(' ');
    if (words.length === 1) {
      const surname = named.filter((p) => personKey(p.name).split(' ').includes(words[0]));
      if (surname.length === 1) return { roleId: surname[0].roleId };
      if (surname.length > 1) return { problem: t('massesJson.person.several', { who: quote(said), names: surname.map((p) => p.name).join(', ') }) };
    }
  }
  return { problem: t('massesJson.person.unknown', { who: quote(said) }) };
}

/**
 * Wie eine Person ins JSON geht: ihr Name — wenn er beim Import wieder genau
 * sie trifft (eindeutig in der Gruppe); sonst ihre Kennung.
 */
export function personOut(roleId: string, people: readonly Person[]): string {
  const one = people.find((p) => p.roleId === roleId);
  if (one === undefined || one.name === '') return roleId;
  const back = findPerson(one.name, people, new Set());
  return 'roleId' in back && back.roleId === roleId ? one.name : roleId;
}

const samePeople = (a: readonly PinnedNow[], b: readonly PinnedNow[]): boolean => {
  const key = (list: readonly PinnedNow[]) => list.map((p) => `${p.roleId}|${p.duty}`).sort().join(',');
  return key(a) === key(b);
};

/* -- Reihen ------------------------------------------------------------------------------------- */

export interface SeriesDef {
  readonly kind: string;
  readonly title: string;
  readonly date: string;
  readonly time: string;
  readonly minutes: number;
  readonly repeat: SeriesRepeat;
  readonly every: number;
  readonly weekdays: number;
  /** `null`: ohne Ende. */
  readonly until: string | null;
  readonly place: string;
}

/**
 * Fällt eine Reihe auf diesen Tag?
 *
 * <b>Nur für die Vorschau</b> neuer und geänderter Reihen. Welche Tage eine
 * Reihe hat, rechnet der Dienst (`Calendar.Occurrences`) — eingetragen wird
 * erst nach dem Anlegen, an den Vorkommen, die er dann nennt. Dieselbe Regel
 * wie dort: täglich in Schritten, wöchentlich nach der Maske (bei „co 2
 * tygodnie" ab dem Montag der ersten Woche), monatlich derselbe Tag oder der
 * letzte des Monats, wenn es ihn nicht gibt.
 */
export function seriesHas(def: Pick<SeriesDef, 'date' | 'repeat' | 'every' | 'weekdays' | 'until'>, day: string): boolean {
  if (day < def.date) return false;
  if (def.repeat === 'none') return day === def.date;
  if (def.until !== null && day > def.until) return false;
  const every = Math.max(1, def.every);
  const start = dateOf(def.date);
  const at = dateOf(day);
  switch (def.repeat) {
    case 'daily':
      return daysBetween(def.date, day) % every === 0;
    case 'weekly': {
      if ((def.weekdays & (1 << weekdayIndex(day))) === 0) return false;
      if (every === 1) return true;
      const monday = addDays(def.date, -weekdayIndex(def.date));
      return Math.floor(daysBetween(monday, day) / 7) % every === 0;
    }
    case 'monthly': {
      const months = (at.getFullYear() - start.getFullYear()) * 12 + (at.getMonth() - start.getMonth());
      if (months % every !== 0) return false;
      return at.getDate() === Math.min(start.getDate(), lastDayOf(at.getFullYear(), at.getMonth()));
    }
    case 'yearly': {
      const years = at.getFullYear() - start.getFullYear();
      if (years % every !== 0 || at.getMonth() !== start.getMonth()) return false;
      return at.getDate() === Math.min(start.getDate(), lastDayOf(at.getFullYear(), at.getMonth()));
    }
    default:
      return false;
  }
}

/** Der erste Tag ab `from`, an dem die Reihe stattfindet — oder `null` im nächsten Jahr keiner. */
function firstDayFrom(def: SeriesDef, from: string): string | null {
  for (let i = 0; i <= MAX_DAYS; i++) {
    const day = addDays(from, i);
    if (def.until !== null && day > def.until) return null;
    if (seriesHas(def, day)) return day;
  }
  return null;
}

/** Ohne Ende: der Kalender legt „bez końca" zehn Jahre voraus an — was so weit reicht, gilt als ohne Ende. */
export const untilOf = (start: string, until: string | null): string | null =>
  until === null || until >= addYears(start, 9) ? null : until;

const defOf = (s: SeriesNow): SeriesDef => ({
  kind: s.kind, title: s.title, date: s.date, time: s.time, minutes: s.minutes, repeat: s.repeat,
  every: s.every, weekdays: s.weekdays, until: s.until, place: s.place ?? ''
});

const serviceName = (kind: string, title: string): string => title || SERVICE_LABEL[kind] || t('massesJson.plan.entry');

/** Wie der Plan der Kanzlei sagt, wer da ist (`MassPlan.PeopleLine`): „odprawia", „prowadzi", „spowiada". */
const dutyWord = (kind: string): string =>
  t(kind === MASS ? 'massesJson.plan.duty.celebrates' : kind === DEVOTION ? 'massesJson.plan.duty.leads' : kind === CONFESSION ? 'massesJson.plan.duty.hears' : 'massesJson.plan.duty.present');

function patternText(def: SeriesDef): string {
  const time = clockShort(def.time);
  const every = Math.max(1, def.every);
  switch (def.repeat) {
    case 'none': return `${dateWords(def.date)} ${time}`;
    case 'daily': return every === 1 ? t('massesJson.plan.pattern.daily', { time }) : t('massesJson.plan.pattern.dailyEvery', { count: every, time });
    case 'weekly': return every === 1
      ? t('massesJson.plan.pattern.weekly', { days: weekdayWords(def.weekdays).join(', '), time })
      : t('massesJson.plan.pattern.weeklyEvery', { count: every, days: weekdayWords(def.weekdays).join(', '), time });
    case 'monthly': return every === 1
      ? t('massesJson.plan.pattern.monthly', { day: dateOf(def.date).getDate(), time })
      : t('massesJson.plan.pattern.monthlyEvery', { count: every, day: dateOf(def.date).getDate(), time });
    case 'yearly': return t('massesJson.plan.pattern.yearly', { time });
    default: return time;
  }
}

const spanText = (def: SeriesDef): string =>
  def.repeat === 'none' ? '' : def.until === null
    ? t('massesJson.plan.spanForever', { from: dateWords(def.date) })
    : t('massesJson.plan.span', { from: dateWords(def.date), until: dateWords(def.until) });

/* -- Der Plan ------------------------------------------------------------------------------------ */

export interface MassesOptions {
  /** Eine Messe, die schon eine ANDERE Intention trägt: nichts dazu (Vorgabe) — oder neben die alte. */
  readonly conflicts: 'skip' | 'add';
}

export const DEFAULT_OPTIONS: MassesOptions = { conflicts: 'skip' };

/** Eine Messe des Plans: eine, die es gibt — oder die n-te, die der Import anlegt. */
export type MassRef = { readonly existing: string } | { readonly fresh: number };

export interface MassCreate {
  readonly fresh: number;
  readonly calendarId: string;
  readonly def: SeriesDef;
  /** Wer da ist, für die ganze Reihe — `null`: niemand. */
  readonly people: readonly PinnedNow[] | null;
  /** „Ta i następne": die alte Reihe endet vor `from`, diese übernimmt. */
  readonly handover: { readonly itemId: string; readonly from: string } | null;
  readonly label: string;
}

export interface MassUpdate {
  readonly itemId: string;
  readonly calendarId: string;
  /** Nur, was sich ändert. */
  readonly change: Partial<SeriesDef>;
  /** `null`: bleibt. */
  readonly people: readonly PinnedNow[] | null;
  readonly label: string;
}

export interface IntentionAdd {
  readonly text: string;
  readonly kind: IntentionKind;
  readonly status: IntentionStatus;
  readonly giver: string;
  readonly offering: string;
  readonly celebrant: string | null;
  /** `null`: hinten angestellt. */
  readonly ordinal: number | null;
}

/** Was sich an einer Intention ändert — ohne ihre Kennung (zum Zusammensetzen). */
type ChangeFields = { -readonly [K in Exclude<keyof IntentionChange, 'id'>]?: IntentionChange[K] };

export interface IntentionChange {
  readonly id: string;
  readonly text?: string;
  readonly kind?: IntentionKind;
  readonly status?: IntentionStatus;
  readonly giver?: string;
  readonly offering?: string;
  /** `''`: niemand mehr. */
  readonly celebrant?: string;
  readonly ordinal?: number;
  /** An DIESE Messe verlegen. */
  readonly move?: boolean;
}

export interface OccurrencePlan {
  readonly mass: MassRef;
  readonly calendarId: string;
  readonly date: string;
  readonly label: string;
  /** Die Adresse, wie sie vor dem Import ist (nach dem Ändern der Messen ordnet der Import neu zu). */
  readonly occurrenceAt: string | null;
  readonly restore: boolean;
  readonly cancel: boolean;
  /** `null`: bleibt. */
  readonly people: readonly PinnedNow[] | null;
  readonly adds: readonly IntentionAdd[];
  readonly changes: readonly IntentionChange[];
}

export interface MassesPlan {
  readonly calendarId: string;
  readonly calendars: readonly string[];
  readonly from: string;
  readonly to: string;
  readonly creates: readonly MassCreate[];
  readonly updates: readonly MassUpdate[];
  readonly occurrences: readonly OccurrencePlan[];
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
  /** Wie viele Messen schon eine ANDERE Intention tragen — dann steht die Wahl „dopisz" da. */
  readonly conflicts: number;
  /** Nichts zu tun. */
  readonly empty: boolean;
}

/** Welcher Zeitraum und welche Kalender geladen sein müssen, um ein Dokument zu planen. */
export interface MassesNeeds {
  readonly calendars: readonly string[];
  readonly from: string;
  readonly to: string;
}

export function needsOf(
  doc: MassesDoc, calendars: readonly CalendarNow[], chosen: string, today: string, series?: ReadonlyMap<string, SeriesNow>
): MassesNeeds | { error: string } {
  const ids = new Set<string>();
  const home = doc.calendar === null ? chosen : findCalendar(doc.calendar, calendars)?.calendarId ?? chosen;
  if (home !== '') ids.add(home);
  for (const m of doc.masses) {
    if (m.calendar !== null) { const c = findCalendar(m.calendar, calendars); if (c !== null) ids.add(c.calendarId); }
    const s = m.id === null ? undefined : series?.get(m.id);
    if (s !== undefined) ids.add(s.calendarId);
  }
  for (const o of doc.occurrences) {
    if (o.calendar !== null) { const c = findCalendar(o.calendar, calendars); if (c !== null) ids.add(c.calendarId); }
    const s = o.mass === undefined || o.mass.startsWith('@') ? undefined : series?.get(o.mass.toLowerCase());
    if (s !== undefined) ids.add(s.calendarId);
  }
  const days = [
    ...(doc.from === null ? [] : [doc.from]), ...(doc.to === null ? [] : [doc.to]),
    ...doc.occurrences.map((o) => o.date),
    ...doc.masses.flatMap((m) => (m.changeFrom === undefined ? [] : [m.changeFrom]))
  ].sort();
  const from = days[0] ?? today;
  const to = days.length > 0 ? days[days.length - 1] : addDays(from, 31);
  if (daysBetween(from, to) > MAX_DAYS) return { error: t('massesJson.plan.tooLong', { from: dateWords(from), to: dateWords(to), max: MAX_DAYS }) };
  return { calendars: [...ids], from, to };
}

/** Ist geladen, was das Dokument braucht? */
export const coversNeeds = (state: MassesState, needs: MassesNeeds): boolean =>
  needs.calendars.every((c) => state.loaded.includes(c)) && state.from <= needs.from && state.to >= needs.to;

interface Slot {
  readonly key: string;
  readonly mass: MassRef;
  readonly calendarId: string;
  readonly date: string;
  readonly time: string;
  readonly kind: string;
  readonly existing: OccurrenceNow | null;
  readonly label: string;
  free: boolean;
  collective: boolean;
  cancelled: boolean | undefined;
  celebrants: readonly string[] | undefined;
  readonly intentions: IntentionDoc[];
}

/**
 * DER PLAN: was der Import mit diesem Dokument täte — Zeile für Zeile, mit
 * Warnungen. Ausgeführt wird er in `massesImport.ts` (`runMassesImport`).
 */
export function planMasses(doc: MassesDoc, state: MassesState, options: MassesOptions = DEFAULT_OPTIONS): MassesPlan | { error: string } {
  const warnings: string[] = [];
  const massLines: string[] = [];
  const slotLines: string[] = [];

  /* -- Der Kalender des Dokuments — sonst der oben gewählte -------------------------------- */
  let home: CalendarNow | undefined;
  if (doc.calendar !== null) {
    const found = findCalendar(doc.calendar, state.calendars);
    if (found === null) return { error: t('massesJson.plan.unknownCalendar', { name: quote(doc.calendar) }) };
    home = found;
  } else {
    home = state.calendars.find((c) => c.calendarId === state.chosen);
    if (home === undefined) return { error: t('massesJson.plan.pickCalendar') };
  }
  if (!home.mayWrite) return { error: t('massesJson.plan.readOnly', { name: quote(calendarName(home)) }) };
  const homeCalendar = home;

  const calendarOf = (ref: string | null, where: string): CalendarNow | null => {
    if (ref === null) return homeCalendar;
    const found = findCalendar(ref, state.calendars);
    if (found === null) { warnings.push(t('massesJson.plan.calendarUnknown', { where, name: quote(ref) })); return null; }
    if (!found.mayWrite) { warnings.push(t('massesJson.plan.calendarReadOnly', { where, name: quote(calendarName(found)) })); return null; }
    if (!state.loaded.includes(found.calendarId)) { warnings.push(t('massesJson.plan.calendarNotLoaded', { where, name: quote(calendarName(found)) })); return null; }
    return found;
  };
  const peopleOf = (calendarId: string): readonly Person[] => state.people.get(calendarId) ?? [];
  const nameOf = (roleId: string, calendarId: string): string =>
    peopleOf(calendarId).find((p) => p.roleId === roleId)?.name || t('massesJson.plan.personId', { id: short(roleId) });
  const namesOf = (list: readonly PinnedNow[], calendarId: string): string =>
    list.length === 0 ? t('massesJson.plan.nobody') : list.map((p) => nameOf(p.roleId, calendarId)).join(', ');

  /** Personen eines Dokuments → Kennungen. Kennt sie einer nicht, bleibt alles, wie es ist. */
  const resolvePeople = (refs: readonly string[], calendarId: string, pinned: ReadonlySet<string>, where: string): string[] | null => {
    const ids: string[] = [];
    const problems: string[] = [];
    for (const ref of refs) {
      const found = findPerson(ref, peopleOf(calendarId), pinned);
      if ('problem' in found) problems.push(found.problem);
      else if (!ids.includes(found.roleId)) ids.push(found.roleId);
    }
    if (problems.length > 0) { warnings.push(t('massesJson.plan.peopleProblems', { where, problems: problems.join('; ') })); return null; }
    if (ids.length > MAX_PEOPLE) { warnings.push(t('massesJson.plan.maxPeople', { where, max: MAX_PEOPLE })); return null; }
    return ids;
  };
  /** Die neue Liste: wer eine andere Aufgabe hat, bleibt; die mit dieser Aufgabe sind die genannten. */
  const withDuty = (base: readonly PinnedNow[], ids: readonly string[], duty: Duty): PinnedNow[] =>
    [...base.filter((p) => p.duty !== duty && !ids.includes(p.roleId)), ...ids.map((roleId) => ({ roleId, duty }))];

  const occurrencesOf = new Map<string, OccurrenceNow[]>();
  for (const o of state.occurrences) occurrencesOf.set(o.itemId, [...(occurrencesOf.get(o.itemId) ?? []), o]);
  const isLive = (i: IntentionNow) => i.status !== 'cancelled';
  const hasLive = (o: OccurrenceNow) => o.intentions.some(isLive);

  /* -- 1. Die Messen ------------------------------------------------------------------------- */
  const creates: MassCreate[] = [];
  const updates: MassUpdate[] = [];
  const refs = new Map<string, MassRef>();
  const handovers = new Map<string, { fresh: number; from: string }>();
  /** Reihen, deren Tage oder Stunde sich ändern: wie sie danach sind. */
  const reshaped = new Map<string, SeriesDef>();
  /** Reihen, deren Menschen sich ändern: alte und neue Liste. */
  const repeopled = new Map<string, { was: readonly PinnedNow[]; now: readonly PinnedNow[] }>();
  const seen = new Set<string>();
  let unchangedMasses = 0;

  const nameKey = (key: string | null, ref: MassRef, where: string) => {
    if (key === null) return;
    if (refs.has(key)) { warnings.push(t('massesJson.plan.keyTaken', { where, key })); return; }
    refs.set(key, ref);
  };

  for (const m of doc.masses) {
    const where = m.label;
    if (m.id !== null) {
      const s = state.series.get(m.id);
      if (s === undefined) { warnings.push(t('massesJson.plan.unknownId', { where, id: short(m.id) })); continue; }
      if (seen.has(s.itemId)) { warnings.push(t('massesJson.plan.sameTwice', { where })); continue; }
      seen.add(s.itemId);
      nameKey(m.key, { existing: s.itemId }, where);
      const calendar = state.calendars.find((c) => c.calendarId === s.calendarId);
      if (m.calendar !== null) {
        const named = findCalendar(m.calendar, state.calendars);
        if (named?.calendarId !== s.calendarId) warnings.push(t('massesJson.plan.staysInCalendar', { where, name: quote(calendar === undefined ? '?' : calendarName(calendar)) }));
      }
      if (calendar === undefined || !calendar.mayWrite || !s.editable) { warnings.push(t('massesJson.plan.notEditable', { where })); continue; }
      if (m.kind !== undefined && m.kind !== s.kind) warnings.push(t('massesJson.plan.kindStays', { where, kind: SERVICE_LABEL[s.kind] ?? s.kind }));

      const change: { -readonly [K in keyof SeriesDef]?: SeriesDef[K] } = {};
      const said: string[] = [];
      if (m.title !== undefined && m.title !== s.title) { change.title = m.title; said.push(t('massesJson.plan.said.title', { name: quote(serviceName(s.kind, m.title)) })); }
      if (m.date !== undefined && m.date !== s.date && m.changeFrom === undefined) { change.date = m.date; said.push(t('massesJson.plan.said.start', { from: dateWords(s.date), to: dateWords(m.date) })); }
      if (m.date !== undefined && m.date !== s.date && m.changeFrom !== undefined) warnings.push(t('massesJson.plan.dateWithChangeFrom', { where }));
      if (m.time !== undefined && m.time !== s.time) { change.time = m.time; said.push(t('massesJson.plan.said.time', { from: clockShort(s.time), to: clockShort(m.time) })); }
      if (m.minutes !== undefined && m.minutes !== s.minutes) { change.minutes = m.minutes; said.push(t('massesJson.plan.said.minutes', { from: s.minutes, to: m.minutes })); }
      if (m.repeat !== undefined && m.repeat !== s.repeat) { change.repeat = m.repeat; said.push(t('massesJson.plan.said.repeat', { repeat: m.repeat })); }
      const repeat = change.repeat ?? s.repeat;
      if (m.every !== undefined && repeat !== 'none' && m.every !== s.every) { change.every = m.every; said.push(t('massesJson.plan.said.every', { every: m.every })); }
      if (repeat === 'weekly') {
        const wanted = m.weekdays !== undefined && m.weekdays !== 0 ? m.weekdays : s.weekdays !== 0 ? s.weekdays : 1 << weekdayIndex(change.date ?? s.date);
        if (wanted !== s.weekdays) { change.weekdays = wanted; said.push(t('massesJson.plan.said.days', { days: weekdayWords(wanted).join(', ') })); }
      } else if (m.weekdays !== undefined && m.weekdays !== 0) warnings.push(t('massesJson.plan.weekdaysOnlyWeekly', { where }));
      if (m.until !== undefined && repeat !== 'none') {
        const until = m.until === null ? null : untilOf(change.date ?? s.date, m.until);
        if (until !== s.until) { change.until = until; said.push(until === null ? t('massesJson.plan.said.forever') : t('massesJson.plan.said.until', { until: dateWords(until) })); }
      }
      if (m.place !== undefined && m.place !== s.place) {
        change.place = m.place;
        said.push(m.place === '' ? t('massesJson.plan.said.noPlace') : t('massesJson.plan.said.place', { place: quote(m.place) }));
        if (s.place === null) warnings.push(t('massesJson.plan.placeUnreadable', { where }));
      }
      const duty = dutyOf(s.kind);
      let people: PinnedNow[] | null = null;
      if (m.celebrants !== undefined) {
        const ids = resolvePeople(m.celebrants, s.calendarId, new Set(s.people.map((p) => p.roleId)), where);
        if (ids !== null) {
          const next = withDuty(s.people, ids, duty);
          if (!samePeople(next, s.people)) { people = next; said.push(`${dutyWord(s.kind)}: ${namesOf(next.filter((p) => p.duty === duty), s.calendarId)}`); }
        }
      }
      const next: SeriesDef = { ...defOf(s), ...change };
      if (next.repeat !== 'none' && next.until !== null && next.until < next.date) { warnings.push(t('massesJson.plan.untilBeforeStart', { where })); continue; }
      const label = `${serviceName(s.kind, next.title)} — ${patternText(defOf(s))}`;

      /* „Ta i następne": die alte Reihe endet am Vortag, eine neue übernimmt (0079). */
      if (m.changeFrom !== undefined && s.repeat !== 'none' && m.changeFrom > s.date) {
        if (s.until !== null && m.changeFrom > s.until) { warnings.push(t('massesJson.plan.endsBeforeChange', { where, until: dateWords(s.until) })); continue; }
        if (said.length === 0) { unchangedMasses++; continue; }
        /* Der Takt der alten Reihe (Monatstag, „co 2 tygodnie") — die neue beginnt am ersten Tag ab dann. */
        const first = firstDayFrom({ ...next, date: s.date }, m.changeFrom);
        if (first === null) { warnings.push(t('massesJson.plan.noDayFrom', { where, from: dateWords(m.changeFrom) })); continue; }
        const def: SeriesDef = { ...next, date: first, until: next.until };
        const lost = (occurrencesOf.get(s.itemId) ?? []).filter((o) => o.addressDate >= m.changeFrom! && hasLive(o) && !seriesHas(def, o.addressDate));
        if (lost.length > 0) {
          warnings.push(t('massesJson.plan.wouldLose', { where, list: `${lost.slice(0, 4).map((o) => whenLabel(o.date, o.time)).join(', ')}${lost.length > 4 ? ' …' : ''}` }));
          continue;
        }
        const fresh = creates.length;
        creates.push({
          fresh, calendarId: s.calendarId, def,
          people: people ?? (s.people.length > 0 ? s.people : null),
          handover: { itemId: s.itemId, from: m.changeFrom }, label
        });
        handovers.set(s.itemId, { fresh, from: m.changeFrom });
        if (people !== null) repeopled.set(s.itemId, { was: s.people, now: people });
        massLines.push(t('massesJson.plan.lineChangeFrom', { from: dateWords(m.changeFrom), label, said: said.join('; ') }));
        continue;
      }
      if (m.changeFrom !== undefined && s.repeat === 'none') warnings.push(t('massesJson.plan.notSeries', { where }));
      if (said.length === 0) { unchangedMasses++; continue; }
      const days = change.date !== undefined || change.repeat !== undefined || change.every !== undefined || change.weekdays !== undefined || change.until !== undefined;
      if (days) {
        const lost = (occurrencesOf.get(s.itemId) ?? []).filter((o) => hasLive(o) && !seriesHas(next, o.addressDate));
        if (lost.length > 0) {
          warnings.push(t('massesJson.plan.wouldLoseOrChangeFrom', { where, list: `${lost.slice(0, 4).map((o) => whenLabel(o.date, o.time)).join(', ')}${lost.length > 4 ? ' …' : ''}` }));
          continue;
        }
      }
      if (days || change.time !== undefined) reshaped.set(s.itemId, next);
      if (people !== null) repeopled.set(s.itemId, { was: s.people, now: people });
      updates.push({ itemId: s.itemId, calendarId: s.calendarId, change, people, label });
      massLines.push(m.changeFrom !== undefined && s.repeat !== 'none'
        ? t('massesJson.plan.lineChangeWhole', { label, said: said.join('; ') })
        : t('massesJson.plan.lineChange', { label, said: said.join('; ') }));
      continue;
    }

    /* Neu. */
    const calendar = calendarOf(m.calendar, where);
    if (calendar === null) continue;
    if (m.date === undefined || m.time === undefined) { warnings.push(t('massesJson.plan.newNeedsDate', { where })); continue; }
    if (m.changeFrom !== undefined) warnings.push(t('massesJson.plan.changeFromOnlyId', { where }));
    const kind: ServiceKind = m.kind ?? MASS;
    const repeat = m.repeat ?? 'none';
    const def: SeriesDef = {
      kind, title: m.title ?? '', date: m.date, time: m.time,
      minutes: m.minutes ?? (kind === MASS ? calendar.durationMinutes ?? DEFAULT_MINUTES.mass : DEFAULT_MINUTES[kind]),
      repeat, every: repeat === 'none' ? 1 : m.every ?? 1,
      weekdays: repeat === 'weekly' ? (m.weekdays !== undefined && m.weekdays !== 0 ? m.weekdays : 1 << weekdayIndex(m.date)) : 0,
      until: repeat === 'none' ? null : m.until ?? null,
      place: m.place ?? ''
    };
    if (def.until !== null && def.until < def.date) { warnings.push(t('massesJson.plan.untilBeforeDate', { where })); continue; }
    if (repeat === 'none' && m.weekdays !== undefined && m.weekdays !== 0) warnings.push(t('massesJson.plan.weekdaysOnlyWeekly', { where }));
    let people: PinnedNow[] | null = null;
    if (m.celebrants !== undefined && m.celebrants.length > 0) {
      const ids = resolvePeople(m.celebrants, calendar.calendarId, new Set(), where);
      if (ids !== null) people = ids.map((roleId) => ({ roleId, duty: dutyOf(kind) }));
    }
    /* Dieselbe Stunde an denselben Tagen schon im Kalender? Dann ist es wohl dieselbe Messe — gesagt, nicht verhindert. */
    const twin = [...state.series.values()].find((s) => s.calendarId === calendar.calendarId && s.kind === kind && s.time === def.time
      && (occurrencesOf.get(s.itemId) ?? []).some((o) => o.status !== 'cancelled' && seriesHas(def, o.date)));
    if (twin !== undefined) warnings.push(t('massesJson.plan.twin', { where, name: serviceName(twin.kind, twin.title), time: clockShort(def.time), pattern: patternText(defOf(twin)) }));
    const fresh = creates.length;
    const label = `${serviceName(kind, def.title)} — ${patternText(def)}`;
    creates.push({ fresh, calendarId: calendar.calendarId, def, people, handover: null, label });
    nameKey(m.key, { fresh }, where);
    const what = `${label}${spanText(def)}${def.place === '' ? '' : `, ${def.place}`}${calendar.calendarId === homeCalendar.calendarId ? '' : ` — ${calendarName(calendar)}`}`;
    massLines.push(people === null
      ? t('massesJson.plan.lineNew', { what })
      : t('massesJson.plan.lineNewPeople', { what, duty: dutyWord(kind), names: namesOf(people, calendar.calendarId) }));
  }

  /* -- 2. Die Messen an ihren Tagen ---------------------------------------------------------- */
  /** Die Stunde eines Vorkommens NACH dem Import (eine neue Stunde der Reihe gilt nicht für einen verlegten Tag). */
  const timeAfter = (o: OccurrenceNow): string => {
    if (o.moved) return o.time;
    const h = handovers.get(o.itemId);
    if (h !== undefined && o.date >= h.from) return creates[h.fresh].def.time;
    return reshaped.get(o.itemId)?.time ?? o.time;
  };
  const refKey = (ref: MassRef): string => ('existing' in ref ? `e:${ref.existing}` : `f:${ref.fresh}`);
  /* Zwei Vorkommen einer Reihe an einem Tag gibt es nur, wenn eines dorthin verlegt ist — dann entscheidet die Stunde. */
  const onDay = (itemId: string, date: string, time: string | undefined): OccurrenceNow | null => {
    const found = (occurrencesOf.get(itemId) ?? []).filter((o) => o.date === date);
    return found.find((o) => o.time === time) ?? found[0] ?? null;
  };
  /* Dieselbe Messe, wie auch immer genannt: das Vorkommen, das es gibt — sonst Messe und Tag. */
  const slotKey = (ref: MassRef, date: string, existing: OccurrenceNow | null): string =>
    existing !== null ? `o:${existing.itemId}|${existing.occurrenceAt}` : `${refKey(ref)}|${date}`;

  const slots = new Map<string, Slot>();
  let skippedSlots = 0;

  const resolve = (o: OccurrenceDoc): Omit<Slot, 'free' | 'collective' | 'cancelled' | 'celebrants' | 'intentions'> | null => {
    const where = o.label;
    let ref: MassRef | undefined;
    if (o.mass !== undefined) {
      if (o.mass.startsWith('@')) {
        ref = refs.get(o.mass.slice(1));
        if (ref === undefined) { warnings.push(t('massesJson.plan.noKeyEntry', { where, mass: o.mass })); return null; }
      } else {
        const id = o.mass.toLowerCase();
        if (!state.series.has(id) && !occurrencesOf.has(id)) { warnings.push(t('massesJson.plan.unknownMass', { where, id: short(id) })); return null; }
        ref = { existing: id };
      }
      if ('fresh' in ref) {
        const create = creates[ref.fresh];
        if (!seriesHas(create.def, o.date)) { warnings.push(t('massesJson.plan.newNotOnDay', { where, label: quote(create.label) })); return null; }
        if (o.time !== undefined && o.time !== create.def.time) warnings.push(t('massesJson.plan.entryAtTime', { where, time: clockShort(create.def.time) }));
        return { key: slotKey(ref, o.date, null), mass: ref, calendarId: create.calendarId, date: o.date, time: create.def.time, kind: create.def.kind, existing: null, label: whenLabel(o.date, create.def.time) };
      }
      const itemId = ref.existing;
      const existing = onDay(itemId, o.date, o.time);
      const s = state.series.get(itemId);
      const calendarId = s?.calendarId ?? existing?.calendarId ?? homeCalendar.calendarId;
      const kind = s?.kind ?? existing?.kind ?? MASS;
      const calendar = state.calendars.find((c) => c.calendarId === calendarId);
      if (calendar === undefined || !calendar.mayWrite) { warnings.push(t('massesJson.plan.massReadOnly', { where })); return null; }
      const h = handovers.get(itemId);
      let mass: MassRef = ref;
      let time: string;
      if (h !== undefined && o.date >= h.from) {
        const def = creates[h.fresh].def;
        if (!seriesHas(def, o.date)) { warnings.push(t('massesJson.plan.goneAfterChangeFrom', { where, from: dateWords(h.from) })); return null; }
        mass = { fresh: h.fresh };
        time = def.time;
      } else if (reshaped.has(itemId)) {
        const def = reshaped.get(itemId)!;
        if (!(existing?.moved === true) && !seriesHas(def, existing?.addressDate ?? o.date)) { warnings.push(t('massesJson.plan.goneAfterChange', { where })); return null; }
        time = existing === null ? def.time : timeAfter(existing);
      } else {
        if (existing === null) { warnings.push(t('massesJson.plan.notOnDay', { where })); return null; }
        time = existing.time;
      }
      /* Die Stunde von jetzt (vor der Änderung der Reihe) ist kein Widerspruch — so steht sie im Export. */
      if (o.time !== undefined && o.time !== time && o.time !== existing?.time) warnings.push(t('massesJson.plan.massAtTime', { where, time: clockShort(time) }));
      return { key: slotKey(mass, o.date, existing), mass, calendarId, date: o.date, time, kind, existing, label: whenLabel(o.date, time) };
    }

    const calendar = calendarOf(o.calendar, where);
    if (calendar === null) return null;
    if (o.time === undefined) { warnings.push(t('massesJson.plan.needTime', { where })); return null; }
    type Found = { ref: MassRef; existing: OccurrenceNow | null; kind: string };
    const found: Found[] = [];
    const others: string[] = [];
    for (const one of state.occurrences) {
      if (one.calendarId !== calendar.calendarId || one.date !== o.date) continue;
      const h = handovers.get(one.itemId);
      const ref: MassRef = h !== undefined && one.date >= h.from ? { fresh: h.fresh } : { existing: one.itemId };
      if (timeAfter(one) !== o.time) continue;
      if (one.kind === MASS) { if (!found.some((f) => refKey(f.ref) === refKey(ref))) found.push({ ref, existing: one, kind: one.kind }); } else others.push(SERVICE_LABEL[one.kind] ?? one.kind);
    }
    for (const c of creates) {
      if (c.handover !== null || c.calendarId !== calendar.calendarId || c.def.time !== o.time || !seriesHas(c.def, o.date)) continue;
      if (c.def.kind === MASS) found.push({ ref: { fresh: c.fresh }, existing: null, kind: c.def.kind }); else others.push(SERVICE_LABEL[c.def.kind] ?? c.def.kind);
    }
    if (found.length === 1) {
      const f = found[0];
      return { key: slotKey(f.ref, o.date, f.existing), mass: f.ref, calendarId: calendar.calendarId, date: o.date, time: o.time, kind: f.kind, existing: f.existing, label: whenLabel(o.date, o.time) };
    }
    if (found.length > 1) { warnings.push(t('massesJson.plan.severalAtTime', { where })); return null; }
    if (others.length > 0) { warnings.push(t('massesJson.plan.otherAtTime', { where, what: others[0].toLowerCase() })); return null; }
    const times = [...new Set(state.occurrences.filter((one) => one.calendarId === calendar.calendarId && one.date === o.date && one.kind === MASS).map(timeAfter))].sort();
    warnings.push(times.length === 0
      ? t('massesJson.plan.noMassAtNone', { where, time: clockShort(o.time) })
      : t('massesJson.plan.noMassAt', { where, time: clockShort(o.time), times: times.map(clockShort).join(', ') }));
    return null;
  };

  for (const o of doc.occurrences) {
    const at = resolve(o);
    if (at === null) { skippedSlots++; continue; }
    const known = slots.get(at.key);
    if (known !== undefined) {
      warnings.push(t('massesJson.plan.slotTwice', { where: o.label, label: known.label }));
      known.free = known.free && o.free && known.intentions.length === 0 && o.intentions.length === 0;
      known.collective = known.collective || o.collective;
      known.cancelled = o.cancelled ?? known.cancelled;
      known.celebrants = o.celebrants ?? known.celebrants;
      known.intentions.push(...o.intentions);
      continue;
    }
    slots.set(at.key, { ...at, free: o.free, collective: o.collective, cancelled: o.cancelled, celebrants: o.celebrants, intentions: [...o.intentions] });
  }

  /* Wo jede Intention mit "id" am Ende stehen soll — die erste Nennung zählt. */
  const byId = new Map<string, { occ: OccurrenceNow; intention: IntentionNow }>();
  for (const occ of state.occurrences) for (const intention of occ.intentions) byId.set(intention.id, { occ, intention });
  const target = new Map<string, string>();
  for (const slot of slots.values()) {
    for (const d of slot.intentions) {
      if (d.id === null || !byId.has(d.id)) continue;
      if (target.has(d.id)) warnings.push(t('massesJson.plan.idTwice', { where: slot.label, text: quote(cut(d.text, 40)) }));
      else target.set(d.id, slot.key);
    }
  }
  const sameOcc = (a: OccurrenceNow | null, b: OccurrenceNow): boolean => a !== null && a.itemId === b.itemId && a.occurrenceAt === b.occurrenceAt;

  const plans: OccurrencePlan[] = [];
  const count = { added: 0, changed: 0, moved: 0, free: 0, unchanged: 0, conflicts: 0, cancels: 0, restores: 0, people: 0 };

  /* Eine Intention des Dokuments an ihrer Messe: eine, die es gibt (vielleicht hierher verlegt) — oder eine neue. */
  type Have = { readonly type: 'have'; readonly intention: IntentionNow; readonly change: ChangeFields; readonly from: OccurrenceNow | null; readonly text: string };
  type Add = { readonly type: 'add'; readonly add: { -readonly [K in keyof IntentionAdd]: IntentionAdd[K] } };
  type Entry = Have | Add;

  for (const slot of slots.values()) {
    const current = slot.existing === null ? [] : [...slot.existing.intentions].sort((a, b) => a.ordinal - b.ordinal || a.id.localeCompare(b.id));
    const isMassSlot = slot.kind === MASS;
    if (!isMassSlot && slot.intentions.length > 0) {
      warnings.push(t('massesJson.plan.noIntentionsHere', { where: slot.label, what: (SERVICE_LABEL[slot.kind] ?? t('massesJson.plan.thisEntry')).toLowerCase() }));
      slot.intentions.length = 0;
    }
    const celebrantOf = (ref: string | null | undefined, where: string): string | null | undefined => {
      if (ref === undefined) return undefined;
      if (ref === null) return null;
      const found = findPerson(ref, peopleOf(slot.calendarId), new Set(slot.existing?.people.map((p) => p.roleId) ?? []));
      if ('problem' in found) { warnings.push(t('massesJson.plan.celebrantProblem', { where: slot.label, text: where, problem: found.problem })); return undefined; }
      return found.roleId;
    };

    /* Jede Intention des Dokuments: an ihrem "id", sonst an derselben Treść an dieser Messe — sonst neu. */
    const claimed = new Set<string>();
    let entries: Entry[] = [];
    for (const d of slot.intentions) {
      const where = quote(cut(d.text, 40));
      let match: IntentionNow | null = null;
      let byIdMatch = false;
      let from: OccurrenceNow | null = null;
      if (d.id !== null) {
        const known = byId.get(d.id);
        if (known === undefined) warnings.push(t('massesJson.plan.unknownIntention', { where: slot.label, id: short(d.id) }));
        else if (target.get(d.id) !== slot.key) continue;
        else {
          match = known.intention;
          byIdMatch = true;
          if (!sameOcc(slot.existing, known.occ)) from = known.occ;
        }
      }
      if (match === null) {
        const wanted = textKey(d.text);
        match = current.find((i) => !claimed.has(i.id) && !target.has(i.id) && textKey(i.text) === wanted) ?? null;
      }
      const kind = d.kind ?? (slot.collective ? 'collective' : undefined);
      const celebrant = celebrantOf(d.celebrant, where);
      if (match === null) {
        entries.push({ type: 'add', add: { text: d.text, kind: kind ?? 'single', status: d.status ?? 'accepted', giver: d.giver ?? '', offering: d.offering ?? '', celebrant: celebrant ?? null, ordinal: null } });
        continue;
      }
      claimed.add(match.id);
      const change: ChangeFields = {};
      /* Die Treść nur, wo das "id" sie meint: „za sp. jana" an derselben Messe ist dieselbe — und die bessere Schreibung bleibt. */
      if (byIdMatch && d.text !== match.text) change.text = d.text;
      if (kind !== undefined && kind !== match.kind) change.kind = kind;
      if (d.status !== undefined && d.status !== match.status) change.status = d.status;
      if (d.giver !== undefined && d.giver !== match.giver) change.giver = d.giver;
      if (d.offering !== undefined && d.offering !== match.offering) change.offering = d.offering;
      if (celebrant !== undefined && celebrant !== match.celebrant) change.celebrant = celebrant ?? '';
      if (from !== null) change.move = true;
      entries.push({ type: 'have', intention: match, change, from, text: d.text });
    }
    const addsNow = (): Add[] => entries.filter((e): e is Add => e.type === 'add');

    /* Was an der Messe hängt und im Dokument nicht vorkommt — und nicht anderswohin geht. */
    const movedAway = (i: IntentionNow) => target.has(i.id) && target.get(i.id) !== slot.key;
    const unaccounted = current.filter((i) => isLive(i) && !claimed.has(i.id) && !movedAway(i));
    const listed = unaccounted.map((i) => quote(cut(i.text, 50))).join(', ');
    if (addsNow().length > 0 && unaccounted.length > 0) {
      const single = addsNow().some((e) => e.add.kind === 'single') || unaccounted.some((i) => i.kind === 'single');
      if (single) {
        count.conflicts++;
        if (options.conflicts === 'skip') {
          warnings.push(t('massesJson.plan.conflictSkip', { where: slot.label, listed, other: addsNow().map((e) => quote(cut(e.add.text, 50))).join(', ') }));
          entries = entries.filter((e) => e.type !== 'add');
        } else warnings.push(t('massesJson.plan.conflictAdd', { where: slot.label, listed }));
      } else warnings.push(t('massesJson.plan.alsoCollective', { where: slot.label, listed }));
    } else if (unaccounted.length > 0 && (slot.free || slot.intentions.length > 0)) {
      warnings.push(slot.free
        ? t('massesJson.plan.freeButHas', { where: slot.label, listed })
        : t('massesJson.plan.alsoStays', { where: slot.label, listed }));
    }
    if (slot.free && slot.intentions.length === 0) count.free++;

    /* Abgesagt — oder zurückgeholt. Eine abgesagte Messe nimmt nichts an (der Dienst weist es ab): hier gesagt, nicht erst beim Speichern. */
    const offNow = slot.existing?.status === 'cancelled';
    let restore = false;
    if (slot.cancelled === false && offNow) {
      if (slot.existing!.skipped) restore = true;
      else warnings.push(t('massesJson.plan.wholeCancelled', { where: slot.label }));
    }
    if (offNow && !restore && entries.some((e) => e.type === 'add' || e.from !== null)) {
      warnings.push(t('massesJson.plan.massCancelled', { where: slot.label }));
      entries = entries.filter((e): e is Have => e.type === 'have' && e.from === null);
    }
    const finalOf = (e: Have) => ({
      kind: e.change.kind ?? e.intention.kind,
      status: e.change.status ?? e.intention.status,
      celebrant: e.change.celebrant === undefined ? e.intention.celebrant : e.change.celebrant === '' ? null : e.change.celebrant
    });
    let cancel = false;
    if (slot.cancelled === true && !offNow) {
      const stays = unaccounted.length + entries.filter((e) => (e.type === 'add' ? e.add.status : finalOf(e).status) !== 'cancelled').length;
      if (stays > 0) warnings.push(t('massesJson.plan.notCancelling', { where: slot.label }));
      else cancel = true;
    }

    /* Ein Priester liest an einer Messe EINE pojedyncza (der Dienst weist die zweite ab): die spätere verliert ihn — mit einem Wort. */
    if (isMassSlot) {
      const taken = new Set<string>();
      for (const i of unaccounted) if (i.kind === 'single' && i.celebrant !== null) taken.add(i.celebrant);
      for (const e of entries) {
        if (e.type === 'add') {
          if (e.add.kind !== 'single' || e.add.status === 'cancelled' || e.add.celebrant === null) continue;
          if (!taken.has(e.add.celebrant)) { taken.add(e.add.celebrant); continue; }
          warnings.push(t('massesJson.plan.priestTaken', { where: slot.label, name: nameOf(e.add.celebrant, slot.calendarId), text: quote(cut(e.add.text, 40)) }));
          e.add.celebrant = null;
          continue;
        }
        const f = finalOf(e);
        if (f.kind !== 'single' || f.status === 'cancelled' || f.celebrant === null) continue;
        if (!taken.has(f.celebrant)) { taken.add(f.celebrant); continue; }
        if (e.change.celebrant !== undefined) {
          warnings.push(t('massesJson.plan.priestTakenChange', { where: slot.label, name: nameOf(f.celebrant, slot.calendarId), text: quote(cut(e.text, 40)) }));
          delete e.change.celebrant;
        }
      }
    }

    /* Die Reihenfolge des Vorlesens: nur, wenn das Dokument die Messe ganz nennt und sie anders ordnet. */
    let reordered = false;
    const whole = current.length > 0 && current.every((i) => claimed.has(i.id));
    const docOrder = entries.flatMap((e) => (e.type === 'have' && e.from === null ? [e.intention.id] : []));
    const addsBefore = entries.some((e, i) => e.type === 'add' && entries.slice(i + 1).some((later) => later.type === 'have'));
    const comingIn = entries.some((e) => e.type === 'have' && e.from !== null);
    if (whole && (docOrder.join(',') !== current.map((i) => i.id).join(',') || addsBefore || comingIn)) {
      for (let k = 0; k < entries.length; k++) {
        const e = entries[k];
        if (e.type === 'add') { e.add.ordinal = k; continue; }
        if (e.from === null && e.intention.ordinal === k) continue;
        e.change.ordinal = k;
        if (e.from === null) reordered = true;
      }
    }

    /* Was der Import an dieser Messe tut — in der Reihenfolge des Vorlesens. */
    const said: string[] = restore ? [t('massesJson.plan.said.restored')] : [];
    const adds: IntentionAdd[] = [];
    const changes: IntentionChange[] = [];
    for (const e of entries) {
      if (e.type === 'add') {
        const a = e.add;
        adds.push({ ...a });
        const details = [
          a.kind === 'collective' ? KIND_LABEL.collective : '',
          a.status === 'accepted' ? '' : INTENTION_STATUS_LABEL[a.status],
          a.giver === '' ? '' : t('massesJson.plan.said.giver'),
          a.offering === '' ? '' : t('massesJson.plan.said.offering'),
          a.celebrant === null ? '' : t('massesJson.plan.said.celebrant', { name: nameOf(a.celebrant, slot.calendarId) })
        ].filter((s) => s !== '');
        said.push(details.length === 0
          ? t('massesJson.plan.said.new', { text: quote(a.text) })
          : t('massesJson.plan.said.newDetails', { text: quote(a.text), details: details.join(', ') }));
        continue;
      }
      const c = e.change;
      if (Object.keys(c).length > 0) changes.push({ id: e.intention.id, ...c });
      const bits = [
        c.move === true && e.from !== null ? t('massesJson.plan.said.movedHere', { from: whenLabel(e.from.date, e.from.time) }) : '',
        c.text === undefined ? '' : t('massesJson.plan.said.text', { from: quote(cut(e.intention.text, 40)), to: quote(cut(c.text, 40)) }),
        c.kind === undefined ? '' : KIND_LABEL[c.kind],
        c.status === undefined ? '' : INTENTION_STATUS_LABEL[c.status],
        c.giver === undefined ? '' : c.giver === '' ? t('massesJson.plan.said.noGiver') : t('massesJson.plan.said.giver'),
        c.offering === undefined ? '' : c.offering === '' ? t('massesJson.plan.said.noOffering') : t('massesJson.plan.said.offering'),
        c.celebrant === undefined ? '' : c.celebrant === '' ? t('massesJson.plan.said.noCelebrant') : t('massesJson.plan.said.celebrant', { name: nameOf(c.celebrant, slot.calendarId) })
      ].filter((s) => s !== '');
      if (bits.length === 0) { count.unchanged++; continue; }
      said.push(`${quote(cut(e.text, 60))}: ${bits.join(', ')}`);
      if (c.move === true) count.moved++; else count.changed++;
    }
    if (reordered) said.push(t('massesJson.plan.said.reordered'));
    if (cancel) said.push(t('massesJson.plan.said.cancelled'));
    count.added += adds.length;
    if (restore) count.restores++;
    if (cancel) count.cancels++;

    /* Wer feiert: die Liste der Messe — und jeder, der eine Intention liest, steht dort (wie in der Kanzlei). */
    const duty = dutyOf(slot.kind);
    let base: readonly PinnedNow[];
    if (slot.existing !== null) {
      const re = repeopled.get(slot.existing.itemId);
      base = re !== undefined && samePeople(slot.existing.people, re.was) ? re.now : slot.existing.people;
    } else if ('fresh' in slot.mass) base = creates[slot.mass.fresh].people ?? [];
    else base = repeopled.get(slot.mass.existing)?.now ?? state.series.get(slot.mass.existing)?.people ?? [];
    let next: PinnedNow[] = [...base];
    if (slot.celebrants !== undefined) {
      const ids = resolvePeople(slot.celebrants, slot.calendarId, new Set(base.map((p) => p.roleId)), slot.label);
      if (ids !== null) next = withDuty(base, ids, duty);
    }
    const readers = new Set<string>();
    for (const a of adds) if (a.celebrant !== null) readers.add(a.celebrant);
    for (const c of changes) if (c.celebrant !== undefined && c.celebrant !== '') readers.add(c.celebrant);
    for (const roleId of readers) if (!next.some((p) => p.roleId === roleId)) next.push({ roleId, duty: 'celebrant' });
    const peopleNow = slot.existing?.people ?? base;
    let people: PinnedNow[] | null = null;
    if (!samePeople(next, peopleNow)) {
      if (next.length > MAX_PEOPLE) warnings.push(t('massesJson.plan.maxPeople', { where: slot.label, max: MAX_PEOPLE }));
      else { people = next; said.push(`${dutyWord(slot.kind)}: ${namesOf(next.filter((p) => p.duty === duty || readers.has(p.roleId)), slot.calendarId)}`); count.people++; }
    }

    /* Zwei pojedyncze — zwei Priester: gesagt, wo der Import an der Messe etwas ändert. */
    if (isMassSlot && (adds.length > 0 || changes.length > 0)) {
      const singles = unaccounted.filter((i) => i.kind === 'single').length
        + entries.filter((e) => (e.type === 'add'
          ? e.add.kind === 'single' && e.add.status !== 'cancelled'
          : finalOf(e).kind === 'single' && finalOf(e).status !== 'cancelled')).length;
      if (singles > 1) warnings.push(t('massesJson.plan.concelebration', { where: slot.label, count: singles }));
    }

    if (adds.length === 0 && changes.length === 0 && !restore && !cancel && people === null) continue;
    const calendar = state.calendars.find((c) => c.calendarId === slot.calendarId);
    const where = calendar === undefined || slot.calendarId === homeCalendar.calendarId ? '' : ` (${calendarName(calendar)})`;
    const newMass = 'fresh' in slot.mass && creates[slot.mass.fresh].handover === null ? ` ${t('massesJson.plan.newMassTag')}` : '';
    slotLines.push(`${slot.label}${where}${newMass} — ${said.join('; ')}`);
    plans.push({
      mass: slot.mass, calendarId: slot.calendarId, date: slot.date, label: slot.label,
      occurrenceAt: slot.existing?.occurrenceAt ?? null, restore, cancel, people, adds, changes
    });
  }

  /* -- 3. Die Zeilen --------------------------------------------------------------------------- */
  const calendars = new Set<string>([homeCalendar.calendarId]);
  for (const c of creates) calendars.add(c.calendarId);
  for (const u of updates) calendars.add(u.calendarId);
  for (const p of plans) calendars.add(p.calendarId);
  const empty = creates.length === 0 && updates.length === 0 && plans.length === 0;
  const lines: string[] = [calendars.size > 1
    ? t('massesJson.plan.lineCalendarMore', { name: calendarName(homeCalendar), more: calendars.size - 1 })
    : t('massesJson.plan.lineCalendar', { name: calendarName(homeCalendar) })];
  if (doc.masses.length > 0) {
    const fresh = creates.filter((c) => c.handover === null).length;
    lines.push(t('massesJson.plan.lineMasses', { fresh, changed: updates.length + creates.length - fresh, same: unchangedMasses }));
  }
  if (doc.occurrences.length > 0) {
    const params = { added: count.added, changed: count.changed, moved: count.moved, same: count.unchanged, free: count.free, skipped: skippedSlots };
    lines.push(skippedSlots > 0 ? t('massesJson.plan.lineIntentionsSkipped', params) : t('massesJson.plan.lineIntentions', params));
  }
  if (count.cancels + count.restores > 0) lines.push(t('massesJson.plan.lineCancels', { cancels: count.cancels, restores: count.restores }));
  if (empty) lines.push(t('massesJson.plan.lineEmpty'));
  lines.push(...massLines, ...slotLines);

  const range = needsOf(doc, state.calendars, state.chosen, state.today);
  return {
    calendarId: homeCalendar.calendarId,
    calendars: [...calendars],
    from: 'error' in range ? state.from : range.from,
    to: 'error' in range ? state.to : range.to,
    creates, updates, occurrences: plans, lines, warnings, conflicts: count.conflicts, empty
  };
}

/** Lesen und planen in einem — für Vorschau und Import. */
export function planMassesImport(value: unknown, state: MassesState, options: MassesOptions = DEFAULT_OPTIONS): MassesPlan | { error: string } {
  const read = readMassesDocument(value);
  if ('error' in read) return read;
  const plan = planMasses(read.doc, state, options);
  return 'error' in plan ? plan : { ...plan, warnings: [...read.warnings, ...plan.warnings] };
}

/* -- Export ------------------------------------------------------------------------------------- */

/** Was im Zeitraum steht: die Gottesdienste mit ihren Reihen, die Messen Tag für Tag mit Intentionen (oder „wolna"). */
export function exportMasses(state: MassesState, calendarId: string, from: string, to: string): Record<string, unknown> {
  const calendar = state.calendars.find((c) => c.calendarId === calendarId);
  const people = state.people.get(calendarId) ?? [];
  const inRange = state.occurrences
    .filter((o) => o.calendarId === calendarId && o.date >= from && o.date <= to)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const KIND_ORDER = [MASS, DEVOTION, CONFESSION];
  const series = [...new Set(inRange.map((o) => o.itemId))]
    .map((id) => state.series.get(id))
    .filter((s): s is SeriesNow => s !== undefined)
    .sort((a, b) => (KIND_ORDER.indexOf(a.kind as ServiceKind) - KIND_ORDER.indexOf(b.kind as ServiceKind)) || a.time.localeCompare(b.time) || a.date.localeCompare(b.date));
  const seriesPeople = new Map(series.map((s) => [s.itemId, s.people]));

  const massOut = (s: SeriesNow): Record<string, unknown> => {
    const duty = dutyOf(s.kind);
    const celebrants = s.people.filter((p) => p.duty === duty).map((p) => personOut(p.roleId, people));
    return {
      id: s.itemId, kind: s.kind,
      ...(s.title === '' ? {} : { title: s.title }),
      date: s.date, time: s.time, minutes: s.minutes,
      ...(s.repeat === 'none' ? {} : {
        repeat: s.repeat,
        ...(s.every > 1 ? { every: s.every } : {}),
        ...(s.repeat === 'weekly' ? { weekdays: weekdayWords(s.weekdays) } : {}),
        ...(s.until === null ? {} : { until: s.until })
      }),
      ...(s.place === null || s.place === '' ? {} : { place: s.place }),
      ...(celebrants.length === 0 ? {} : { celebrants })
    };
  };

  const occurrenceOut = (o: OccurrenceNow): Record<string, unknown> => {
    const intentions = [...o.intentions].sort((a, b) => a.ordinal - b.ordinal || a.id.localeCompare(b.id));
    const allCollective = intentions.length > 0 && intentions.every((i) => i.kind === 'collective');
    const duty = dutyOf(o.kind);
    const own = !samePeople(o.people, seriesPeople.get(o.itemId) ?? []);
    const celebrants = o.people.filter((p) => p.duty === duty).map((p) => personOut(p.roleId, people));
    const cancelled = o.status === 'cancelled';
    return {
      date: o.date, time: o.time, mass: o.itemId,
      ...(cancelled ? { cancelled: true } : {}),
      ...(allCollective ? { collective: true } : {}),
      ...(own ? { celebrants } : {}),
      ...(intentions.length === 0
        ? (cancelled ? {} : { free: true })
        : {
            intentions: intentions.map((i) => ({
              id: i.id, text: i.text,
              ...(i.kind === 'collective' && !allCollective ? { kind: 'collective' } : {}),
              ...(i.status === 'accepted' ? {} : { status: i.status }),
              ...(i.giver === null || i.giver === '' ? {} : { giver: i.giver }),
              ...(i.offering === null || i.offering === '' ? {} : { offering: i.offering }),
              ...(i.celebrant === null ? {} : { celebrant: personOut(i.celebrant, people) })
            }))
          })
    };
  };

  return {
    format: MASSES_FORMAT,
    version: MASSES_VERSION,
    calendar: calendarId,
    ...(calendar === undefined ? {} : { calendarName: calendarName(calendar) }),
    from, to,
    masses: series.map(massOut),
    occurrences: inRange.filter((o) => o.kind === MASS).map(occurrenceOut)
  };
}
