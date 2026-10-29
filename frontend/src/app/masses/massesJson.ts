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

import { describe, keyLines, pretty, textNode, type JsonNode } from '../core/jsonTree';
import { plural } from '../core/plural';
import type { Duty, RepeatKind } from '../calendar/calendar';
import { dutyOf, peopleWord } from '../calendar/eventWords';
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
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[łŁ]/g, 'l').toLowerCase().trim();

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

const WD_SHORT = ['nd', 'pn', 'wt', 'śr', 'czw', 'pt', 'sob'];
const clockShort = (time: string): string => time.replace(/^0(\d)/, '$1');

/** „pn 2.11 7:00" — so steht ein Vorkommen in der Vorschau. */
export const whenLabel = (day: string, time: string | null): string => {
  const d = dateOf(day);
  return `${WD_SHORT[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}${time === null ? '' : ` ${clockShort(time)}`}`;
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
export const WEEKDAY_WORDS = ['pn', 'wt', 'śr', 'cz', 'pt', 'so', 'nd'] as const;

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

export const MASSES_TOP_KEYS: Readonly<Record<string, string>> = {
  format: `"${MASSES_FORMAT}"`,
  version: `${MASSES_VERSION}`,
  calendar: 'kalendarz (terminarz grupy): "id" z eksportu albo nazwa grupy lub kalendarza; brak — kalendarz wybrany u góry w „Msze i nabożeństwa”',
  calendarName: 'nazwa kalendarza — tylko informacja (eksport ją wpisuje, import pomija)',
  from: 'pierwszy dzień okresu "RRRR-MM-DD" — eksport go wpisuje; import czyta msze od tego dnia (brak: od najwcześniejszej daty w dokumencie)',
  to: 'ostatni dzień okresu "RRRR-MM-DD", włącznie',
  masses: 'msze, nabożeństwa i spowiedź — pojedyncze i serie (niżej); można pominąć, gdy msze już są w kalendarzu',
  occurrences: 'msze w konkretne dni z ich intencjami (niżej) — tu wpisuje się księgę intencji'
};

export const MASS_KEYS: Readonly<Record<string, string>> = {
  id: '"id" z eksportu — wpis zmieniany w miejscu (tylko to, co dokument podaje); bez "id" powstaje nowy',
  key: 'krótka nazwa (litery, cyfry, - i _) — pozycje w "occurrences" wskazują wpis przez "mass": "@nazwa" (np. nowy, który nie ma jeszcze "id")',
  calendar: 'kalendarz nowego wpisu, gdy inny niż kalendarz dokumentu (id albo nazwa); istniejący wpis zostaje w swoim',
  kind: '"mass" — msza (domyślnie), "devotion" — nabożeństwo (różaniec, droga krzyżowa…; bez intencji), "confession" — spowiedź (bez intencji); rodzaju istniejącego wpisu import nie zmienia',
  title: `nazwa w planie i w gablocie (jawna), np. "Msza św. z udziałem dzieci", "Różaniec"; "" — „Msza”, „Nabożeństwo”, „Spowiedź”; do ${TITLE_MAX} znaków`,
  date: 'dzień mszy albo pierwszy dzień serii "RRRR-MM-DD" (nowy wpis: wymagany)',
  time: 'godzina "GG:MM", czas miejscowy — 18:00 to osiemnasta także po zmianie czasu (nowy wpis: wymagana)',
  minutes: `czas trwania w minutach, 5–1440 (domyślnie: msza ${DEFAULT_MINUTES.mass} albo jak w kalendarzu, spowiedź ${DEFAULT_MINUTES.confession}, nabożeństwo ${DEFAULT_MINUTES.devotion}); przy spowiedzi gablota pokazuje „do …”`,
  repeat: '"none" — raz (domyślnie), "daily" — codziennie, "weekly" — w wybrane dni tygodnia, "monthly" — co miesiąc tego samego dnia ("yearly" — co rok, bywa w eksporcie)',
  every: 'co ile dni, tygodni albo miesięcy (1–99, domyślnie 1)',
  weekdays: `przy "weekly": dni tygodnia ${JSON.stringify([...WEEKDAY_WORDS])}; brak — dzień pierwszego terminu`,
  until: 'ostatni dzień serii "RRRR-MM-DD"; null (albo brak w nowej serii) — bez końca; wcześniejsze "until" kończy serię',
  place: `miejsce, np. "kaplica cmentarna" — szyfrowane kluczem grupy kalendarza; "" usuwa; do ${PLACE_MAX} znaków`,
  celebrants: `kto odprawia mszę, prowadzi nabożeństwo, spowiada — w całej serii: osoby grupy kalendarza, imię i nazwisko jak w grupie (np. "ks. Jan Kowalski") albo id osoby; [] — nikt; najwyżej ${MAX_PEOPLE}`,
  changeFrom: 'tylko przy serii z "id": zmiana obowiązuje od tego dnia "RRRR-MM-DD" (ta i następne) — stara seria kończy się dzień wcześniej, nowa przejmuje intencje i osoby; bez "changeFrom" zmienia się cała seria, także minione msze'
};

export const OCCURRENCE_KEYS: Readonly<Record<string, string>> = {
  date: 'dzień mszy "RRRR-MM-DD" (wymagany)',
  time: 'godzina mszy "GG:MM" — wymagana bez "mass": wtedy msza jest szukana po dniu i godzinie wśród mszy kalendarza',
  mass: 'która msza: "id" wpisu z "masses" eksportu albo "@nazwa" z "key"; brak — po "date" i "time"',
  calendar: 'kalendarz, gdy dokument obejmuje kilka (id albo nazwa); brak — kalendarz dokumentu',
  free: 'true — „wolna”: msza bez intencji; import nic nie dopisuje (ostrzega, gdy w kalendarzu jednak ma intencję)',
  collective: 'true — msza zbiorowa: wszystkie jej intencje bez własnego "kind" są zbiorowe (jeden kapłan odprawia je razem)',
  cancelled: 'true — odwołaj tę mszę tylko w tym dniu (seria zostaje; nie, gdy ma przyjęte intencje); false — przywróć odwołaną',
  celebrants: 'kto odprawia tę jedną mszę — osoby jak w "masses"; brak — bez zmian (jak w serii)',
  intentions: `intencje tej mszy w kolejności czytania — tekst ("Za śp. Jana Kowalskiego") albo obiekt (niżej); najwyżej ${MAX_INTENTIONS}; dwie pojedyncze w jednej mszy to dwóch kapłanów`
};

export const INTENTION_KEYS: Readonly<Record<string, string>> = {
  id: '"id" z eksportu — intencja zmieniana w miejscu; wpisana pod inną mszą (inny dzień albo godzina) — przeniesiona tam; bez "id" — nowa, chyba że ta msza ma już tę samą treść',
  text: `treść czytana na mszy i wywieszona w gablocie (wymagana, do ${TEXT_MAX} znaków)`,
  kind: `"single" — ${KIND_LABEL.single} (domyślnie), "collective" — ${KIND_LABEL.collective}; przy istniejącej intencji brak znaczy: bez zmiany`,
  status: `"accepted" — ${INTENTION_STATUS_LABEL.accepted} (domyślnie), "celebrated" — ${INTENTION_STATUS_LABEL.celebrated}, "cancelled" — ${INTENTION_STATUS_LABEL.cancelled} (znika z gabloty, zostaje w kancelarii)`,
  giver: `kto zamówił, np. "rodzina Kowalskich, tel. 600 100 200" — szyfrowane, nie ma go w gablocie ani na wydruku; do ${GIVER_MAX} znaków; "" usuwa`,
  offering: `ofiara, np. "50 zł" — szyfrowana jak ofiarodawca; do ${OFFERING_MAX} znaków; "" usuwa`,
  celebrant: 'kto odprawia tę intencję — osoba grupy jak w "celebrants"; trafia też do tej mszy jako odprawiający; null albo "" — nikt'
};

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
      { date: '2026-11-02', time: '07:00', intentions: ['Za śp. Jana Kowalskiego w 1. rocznicę śmierci'] },
      {
        date: '2026-11-02', time: '18:00', collective: true,
        intentions: [
          'Za zmarłych polecanych w wypominkach',
          { text: 'Za śp. Annę i Józefa Nowaków', giver: 'córka Maria', offering: '50 zł' },
          'Za śp. Stanisława Wójcika'
        ]
      },
      { date: '2026-11-03', time: '07:00', free: true },
      {
        date: '2026-11-03', time: '18:00',
        intentions: [
          { text: 'O zdrowie i Boże błogosławieństwo dla Zofii w 80. rocznicę urodzin', giver: 'wnuki' },
          { text: 'Za śp. Henryka Lisa — od sąsiadów', celebrant: 'ks. Marek Nowak' }
        ]
      },
      { date: '2026-11-04', time: '07:00', intentions: [{ text: 'Dziękczynna za 25 lat małżeństwa Ewy i Piotra', status: 'accepted' }] }
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
        key: 'rano', kind: 'mass', title: 'Msza św.', date: '2026-11-02', time: '07:00',
        repeat: 'weekly', weekdays: ['pn', 'wt', 'śr', 'cz', 'pt', 'so'], until: '2027-06-30', celebrants: ['ks. Jan Kowalski']
      },
      {
        key: 'dzieci', kind: 'mass', title: 'Msza św. z udziałem dzieci', date: '2026-11-08', time: '10:00', minutes: 60,
        repeat: 'weekly', weekdays: ['nd'], every: 1, until: null
      },
      { kind: 'devotion', title: 'Różaniec', date: '2026-11-02', time: '17:30', minutes: 30, repeat: 'daily', until: '2026-11-30', place: 'kaplica MB Częstochowskiej' },
      { kind: 'confession', title: '', date: '2026-11-06', time: '17:00', minutes: 60, repeat: 'weekly', weekdays: ['pt'], until: '2026-12-31', celebrants: ['ks. Marek Nowak'] }
    ],
    occurrences: [
      { date: '2026-11-02', mass: '@rano', intentions: ['Za śp. Jana Kowalskiego'] },
      { date: '2026-11-11', mass: '@rano', cancelled: true, celebrants: ['ks. Marek Nowak'] },
      { date: '2026-11-08', mass: '@dzieci', collective: true, intentions: ['Za dzieci przygotowujące się do I Komunii Świętej', { text: 'Za katechetów i rodziców', kind: 'collective' }] }
    ]
  };
}

const INTRO = (): string => `Msze, nabożeństwa i spowiedź jednego kalendarza (terminarza grupy) z intencjami mszy — dzień po dniu. Import pokazuje najpierw listę zmian: która msza którego dnia dostaje którą intencję; zapisuje dopiero „Importuj”.
Co robi import (Msze i nabożeństwa → „Więcej” → „Import i eksport (JSON)”):
- Wpis z "id" z eksportu jest zmieniany w miejscu — tylko to, co dokument podaje; czego nie podaje, zostaje. Wpis bez "id" w "masses" powstaje nowy (pojedynczy albo seria).
- Intencja należy do mszy w KONKRETNYM DNIU. Taka msza jest szukana po "mass" (id z eksportu albo "@nazwa" z "masses") i "date" — albo po "date" i "time" wśród mszy kalendarza.
- Intencja bez "id" dochodzi do swojej mszy, chyba że ta msza ma już tę samą treść — wtedy niczego nie dubluje.
- Msza, która w kalendarzu ma już INNĄ intencję niż w dokumencie, to konflikt: domyślnie nowe intencje do niej nie dochodzą (ostrzeżenie mówi które); w podglądzie można wybrać „dopisz obok”.
- Niczego nie usuwa. Intencję wycofuje "status": "cancelled", serię kończy "until", mszę w jednym dniu odwołuje "cancelled": true.
- Ofiarodawca, ofiara i miejsce są szyfrowane w tej przeglądarce kluczem grupy kalendarza. Treść intencji i nazwa mszy są jawne: czyta się je na mszy i wiszą w gablocie.
Zwróć JEDEN obiekt JSON, bez komentarzy: najwyżej ${MAX_MASSES} wpisów w "masses", ${MAX_OCCURRENCES} pozycji w "occurrences", ${MAX_INTENTIONS} intencji przy jednej mszy, okres do ${MAX_DAYS} dni.

Dokument:
${keyLines(MASSES_TOP_KEYS)}`;

const MASS_TEXT = (): string => `Wpis w "masses" — msza, nabożeństwo albo spowiedź; jeden raz albo seria:
${keyLines(MASS_KEYS)}
Nazwy nabożeństw, jak się je zwykle pisze: Różaniec, Droga Krzyżowa, Gorzkie Żale, Nabożeństwo majowe, Koronka do Miłosierdzia Bożego, Adoracja Najświętszego Sakramentu, Nieszpory.`;

const OCCURRENCE_TEXT = (): string => `Pozycja w "occurrences" — jedna msza jednego dnia, tak jak wiersz w księdze intencji:
${keyLines(OCCURRENCE_KEYS)}
Ta sama msza drugi raz w dokumencie jest łączona z pierwszą (z ostrzeżeniem).`;

const INTENTION_TEXT = (): string => `Intencja w "intentions" — sam tekst ("Za śp. Jana Kowalskiego") albo obiekt:
${keyLines(INTENTION_KEYS)}
Treść „wolna” zamiast intencji znaczy "free": true.`;

const BOOK_TEXT = (): string => `Najczęstsza praca: kancelaria przepisuje miesiąc z księgi intencji (np. AI ze zdjęcia stron).
1. Najprościej zacząć od eksportu tego miesiąca: każda msza stoi w "occurrences" z "date", "time" i "mass" — z intencjami, które już są, albo z "free": true. Wpisz intencje do tych pozycji (zamiast "free": true — "intentions"); pozycji nie dopisuj ani nie usuwaj.
2. Bez eksportu: jedna pozycja na każdą mszę z księgi, z "date" i "time" (msza musi już być w kalendarzu albo w "masses" tego dokumentu).
3. „wolna” → "free": true. Kilka intencji przy jednej mszy → kilka pozycji w "intentions", w kolejności z księgi. Msza zbiorowa → "collective": true i wszystkie jej intencje.
4. Treść przepisuj dokładnie jak w księdze („Za śp. …”, „O zdrowie i Boże błogosławieństwo dla …”), bez numerów porządkowych. Nieczytelne słowo: najlepsze odczytanie i „[?]” na końcu treści — kancelaria poprawi.
5. Ofiarodawcę i ofiarę wpisz tylko, gdy są w księdze ("giver", "offering"); nie zgaduj.
6. Ta sama treść przy tej samej mszy nie zostanie dodana drugi raz. Inna treść przy mszy, która ma już intencję, to konflikt — podgląd go pokaże, zanim cokolwiek się zapisze.
Przykład — msze 7:00 i 18:00 już są w kalendarzu:
${pretty(bookSample())}`;

const SERIES_TEXT = (): string => `Nowe msze i nabożeństwa razem z intencjami — nowa seria nie ma jeszcze "id", więc pozycje wskazują ją przez "@nazwa":
${pretty(seriesSample())}
Zmiana godzin od wybranego dnia (np. msza wieczorna od 1 grudnia o 17:00): wpis z "id" z eksportu, "time": "17:00", "changeFrom": "2026-12-01".`;

/** 2026-10-29 — DIE MESSEN ALS JSON: der Baum, aus dem die Beschreibung neben dem Import (und für MCP) entsteht. */
export const MASSES_JSON: JsonNode = {
  key: 'masses',
  title: `Msze i intencje jako JSON ("${MASSES_FORMAT}", wersja ${MASSES_VERSION})`,
  short: 'Msze i intencje',
  text: INTRO,
  inside: () => [
    textNode('masses.mass', 'Msza, nabożeństwo, spowiedź ("masses")', MASS_TEXT),
    textNode('masses.occurrence', 'Msza w danym dniu ("occurrences")', OCCURRENCE_TEXT),
    textNode('masses.intention', 'Intencja ("intentions")', INTENTION_TEXT),
    textNode('masses.book', 'Księga intencji — miesiąc w JSON', BOOK_TEXT),
    textNode('masses.series', 'Przykład: nowe msze z intencjami', SERIES_TEXT)
  ],
  samples: () => [
    { label: 'księga intencji: trzy dni (msze już są w kalendarzu)', doc: bookSample },
    { label: 'nowe msze, różaniec i spowiedź z intencjami', doc: seriesSample }
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
    'Przepisz intencje mszalne z załączonych zdjęć księgi intencji do JSON w formacie "recreatio/masses" (opis niżej).',
    'Niżej jest też eksport kalendarza parafii na ten okres: wszystkie msze z "date", "time" i "mass" — z intencjami, które już są, albo z "free": true.',
    'Zwróć JEDEN obiekt JSON (bez komentarzy): ten eksport z intencjami z księgi wpisanymi do właściwych pozycji. Pozycji nie dopisuj i nie usuwaj; mszę z księgi, której nie ma w eksporcie, opisz osobno, poza JSON-em.',
    'Treść przepisuj dokładnie; nieczytelne słowo — najlepsze odczytanie i „[?]” na końcu treści. Ofiarodawcę i ofiarę wpisz tylko, gdy są w księdze.',
    '',
    massesDescription(),
    '',
    'Eksport kalendarza:',
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
  for (const key of Object.keys(o)) if (!has(known, key)) warnings.push(`${where}: nieznany klucz "${key}" — pominięty.`);
}

/** Ein Text bis zur Grenze — was darüber geht, wird abgeschnitten und gesagt. */
function readText(value: unknown, max: number, where: string, what: string, warnings: string[]): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') { warnings.push(`${where}: "${what}" to nie tekst — pominięte.`); return undefined; }
  const text = value.trim().replace(/\s+/g, ' ');
  if (text.length > max) { warnings.push(`${where}: "${what}" dłuższe niż ${max} znaków — skrócone.`); return text.slice(0, max); }
  return text;
}

function readPeopleList(value: unknown, where: string, warnings: string[]): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (value === null) return [];
  const list = typeof value === 'string' ? [value] : Array.isArray(value) ? value : null;
  if (list === null) { warnings.push(`${where}: "celebrants" to lista osób — pominięte.`); return undefined; }
  const out: string[] = [];
  for (const one of list) {
    if (typeof one === 'string' && one.trim() !== '') { if (!out.includes(one.trim())) out.push(one.trim()); } else warnings.push(`${where}: osoba ${cut(JSON.stringify(one) ?? '?', 30)} to nie imię ani id — pominięta.`);
  }
  return out;
}

function readMass(raw: unknown, n: number, warnings: string[]): MassDoc | null {
  if (!isObject(raw)) { warnings.push(`Msza ${n}: to nie obiekt — pominięta.`); return null; }
  const named = [typeof raw.title === 'string' ? raw.title.trim() : '', typeof raw.time === 'string' ? raw.time.trim() : ''].filter((s) => s !== '').join(' ');
  const where = named === '' ? `Msza ${n}` : `Msza ${n} (${cut(named, 40)})`;
  unknownKeys(raw, MASS_KEYS, where, warnings);

  let id: string | null = null;
  if (raw.id !== undefined && raw.id !== null) {
    if (typeof raw.id === 'string' && raw.id.trim() !== '') id = raw.id.trim().toLowerCase();
    else warnings.push(`${where}: "id" to tekst z eksportu — bez "id" (nowy wpis).`);
  }
  let key: string | null = null;
  if (raw.key !== undefined) {
    const wanted = typeof raw.key === 'string' ? raw.key.trim().replace(/^@/, '') : '';
    if (KEY.test(wanted)) key = wanted; else warnings.push(`${where}: "key" to krótka nazwa (litery, cyfry, - i _) — bez nazwy.`);
  }
  const calendar = typeof raw.calendar === 'string' && raw.calendar.trim() !== '' ? raw.calendar.trim() : null;
  if (raw.calendar !== undefined && raw.calendar !== null && calendar === null) warnings.push(`${where}: "calendar" to id albo nazwa kalendarza — pominięte.`);

  let kind: ServiceKind | undefined;
  if (raw.kind !== undefined) {
    kind = typeof raw.kind === 'string' ? KIND_OF[fold(raw.kind)] : undefined;
    if (kind === undefined) warnings.push(`${where}: "kind" to "mass", "devotion" albo "confession" — ${String(raw.kind)} pominięte.`);
  }
  const title = readText(raw.title, TITLE_MAX, where, 'title', warnings);
  const date = raw.date === undefined ? undefined : readDay(raw.date) ?? undefined;
  if (raw.date !== undefined && date === undefined) warnings.push(`${where}: "date" to "RRRR-MM-DD" (dzień, który istnieje) — pominięte.`);
  const time = raw.time === undefined ? undefined : readClock(raw.time) ?? undefined;
  if (raw.time !== undefined && time === undefined) warnings.push(`${where}: "time" to "GG:MM" — pominięte.`);

  let minutes: number | undefined;
  if (raw.minutes !== undefined) {
    const value = typeof raw.minutes === 'string' ? Number(raw.minutes) : raw.minutes;
    if (typeof value === 'number' && Number.isInteger(value) && value >= 5 && value <= 1440) minutes = value;
    else warnings.push(`${where}: "minutes" to liczba minut 5–1440 — pominięte.`);
  }
  let repeat: SeriesRepeat | undefined;
  if (raw.repeat !== undefined) {
    repeat = typeof raw.repeat === 'string' ? REPEAT_OF[fold(raw.repeat)] : undefined;
    if (repeat === undefined) warnings.push(`${where}: "repeat" to "none", "daily", "weekly" albo "monthly" — pominięte.`);
  }
  let every: number | undefined;
  if (raw.every !== undefined) {
    if (typeof raw.every === 'number' && Number.isInteger(raw.every) && raw.every >= 1 && raw.every <= 99) every = raw.every;
    else warnings.push(`${where}: "every" to liczba 1–99 — pominięte.`);
  }
  let weekdays: number | undefined;
  if (raw.weekdays !== undefined) {
    const list = typeof raw.weekdays === 'string' ? raw.weekdays.split(/[,\s]+/) : Array.isArray(raw.weekdays) ? raw.weekdays : null;
    if (list === null) warnings.push(`${where}: "weekdays" to lista dni, np. ["pn","śr"] — pominięte.`);
    else {
      let bits = 0;
      for (const one of list) {
        const word = fold(String(one)).replace(/\.$/, '');
        if (word === '') continue;
        const at = WEEKDAY_OF[word];
        if (at === undefined) warnings.push(`${where}: dzień ${quote(String(one))} — dni to ${WEEKDAY_WORDS.join(', ')}.`); else bits |= 1 << at;
      }
      weekdays = bits;
    }
  }
  let until: string | null | undefined;
  if (raw.until !== undefined) {
    if (raw.until === null || raw.until === '') until = null;
    else {
      until = readDay(raw.until) ?? undefined;
      if (until === undefined) warnings.push(`${where}: "until" to "RRRR-MM-DD" albo null (bez końca) — pominięte.`);
    }
  }
  const place = readText(raw.place, PLACE_MAX, where, 'place', warnings);
  const celebrants = readPeopleList(raw.celebrants, where, warnings);
  let changeFrom: string | undefined;
  if (raw.changeFrom !== undefined && raw.changeFrom !== null) {
    changeFrom = readDay(raw.changeFrom) ?? undefined;
    if (changeFrom === undefined) warnings.push(`${where}: "changeFrom" to "RRRR-MM-DD" — pominięte.`);
  }
  return { label: where, id, key, calendar, kind, title, date, time, minutes, repeat, every, weekdays, until, place, celebrants, changeFrom };
}

function readIntention(raw: unknown, where: string, warnings: string[]): IntentionDoc | 'free' | null {
  if (typeof raw === 'string') {
    const text = raw.trim().replace(/\s+/g, ' ');
    if (text === '') { warnings.push(`${where}: pusta intencja — pominięta.`); return null; }
    if (FREE_WORDS.has(textKey(text))) return 'free';
    if (text.length > TEXT_MAX) warnings.push(`${where}: intencja ${quote(cut(text))} dłuższa niż ${TEXT_MAX} znaków — skrócona.`);
    return { id: null, text: text.slice(0, TEXT_MAX), kind: undefined, status: undefined, giver: undefined, offering: undefined, celebrant: undefined };
  }
  if (!isObject(raw)) { warnings.push(`${where}: intencja to tekst albo obiekt — ${cut(JSON.stringify(raw) ?? '?', 30)} pominięte.`); return null; }
  const text = readText(raw.text, TEXT_MAX, where, 'text', warnings);
  const label = `${where}${text === undefined || text === '' ? '' : `, ${quote(cut(text, 40))}`}`;
  unknownKeys(raw, INTENTION_KEYS, label, warnings);
  if (text === undefined || text === '') { warnings.push(`${where}: intencja bez "text" — pominięta.`); return null; }
  if (FREE_WORDS.has(textKey(text)) && raw.id === undefined) return 'free';
  let id: string | null = null;
  if (raw.id !== undefined && raw.id !== null) {
    if (typeof raw.id === 'string' && raw.id.trim() !== '') id = raw.id.trim().toLowerCase();
    else warnings.push(`${label}: "id" to tekst z eksportu — jak nowa.`);
  }
  let kind: IntentionKind | undefined;
  if (raw.kind !== undefined) {
    kind = typeof raw.kind === 'string' ? INTENTION_KIND_OF[fold(raw.kind)] : undefined;
    if (kind === undefined) warnings.push(`${label}: "kind" to "single" albo "collective" — pominięte.`);
  }
  let status: IntentionStatus | undefined;
  if (raw.status !== undefined) {
    status = typeof raw.status === 'string' ? STATUS_OF[fold(raw.status)] : undefined;
    if (status === undefined) warnings.push(`${label}: "status" to "accepted", "celebrated" albo "cancelled" — pominięte.`);
  }
  const giver = readText(raw.giver, GIVER_MAX, label, 'giver', warnings);
  const offering = readText(raw.offering, OFFERING_MAX, label, 'offering', warnings);
  let celebrant: string | null | undefined;
  if (raw.celebrant !== undefined) {
    if (raw.celebrant === null || (typeof raw.celebrant === 'string' && raw.celebrant.trim() === '')) celebrant = null;
    else if (typeof raw.celebrant === 'string') celebrant = raw.celebrant.trim();
    else warnings.push(`${label}: "celebrant" to imię i nazwisko albo id osoby — pominięte.`);
  }
  return { id, text, kind, status, giver, offering, celebrant };
}

function readOccurrence(raw: unknown, n: number, warnings: string[]): OccurrenceDoc | null {
  if (!isObject(raw)) { warnings.push(`Pozycja ${n}: to nie obiekt — pominięta.`); return null; }
  /* Duldsam: „2026-11-02T07:00" trägt Tag und Stunde zugleich. */
  let dateText = typeof raw.date === 'string' ? raw.date.trim() : '';
  let timeFromDate: string | undefined;
  const joined = /^(\d{4}-\d{1,2}-\d{1,2})[T ](\d{1,2}[:.]\d{2})$/.exec(dateText);
  if (joined !== null) { dateText = joined[1]; timeFromDate = readClock(joined[2]) ?? undefined; }
  const date = readDay(dateText);
  const timeRaw = typeof raw.time === 'string' ? raw.time.trim() : '';
  const where = `Pozycja ${n}${date === null ? '' : ` (${whenLabel(date, readClock(timeRaw) ?? timeFromDate ?? null)})`}`;
  unknownKeys(raw, OCCURRENCE_KEYS, where, warnings);
  if (date === null) { warnings.push(`${where}: "date" to "RRRR-MM-DD" (dzień, który istnieje) — pominięta.`); return null; }
  let time = timeFromDate;
  if (raw.time !== undefined) {
    time = readClock(raw.time) ?? undefined;
    if (time === undefined) warnings.push(`${where}: "time" to "GG:MM" — pominięte.`);
  }
  let mass: string | undefined;
  if (raw.mass !== undefined && raw.mass !== null) {
    if (typeof raw.mass === 'string' && raw.mass.trim() !== '') mass = raw.mass.trim();
    else warnings.push(`${where}: "mass" to "id" albo "@nazwa" — pominięte.`);
  }
  const calendar = typeof raw.calendar === 'string' && raw.calendar.trim() !== '' ? raw.calendar.trim() : null;
  const flag = (key: 'free' | 'collective' | 'cancelled'): boolean | undefined => {
    const value = raw[key];
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'boolean') return value;
    warnings.push(`${where}: "${key}" to true albo false — pominięte.`);
    return undefined;
  };
  let free = flag('free') === true;
  const collective = flag('collective') === true;
  const cancelled = flag('cancelled');
  const celebrants = readPeopleList(raw.celebrants, where, warnings);

  const intentions: IntentionDoc[] = [];
  if (raw.intentions !== undefined && raw.intentions !== null) {
    const list = typeof raw.intentions === 'string' ? [raw.intentions] : Array.isArray(raw.intentions) ? raw.intentions : null;
    if (list === null) warnings.push(`${where}: "intentions" to lista — pominięte.`);
    else {
      for (const one of list) {
        const read = readIntention(one, where, warnings);
        if (read === 'free') { if (list.length > 1) warnings.push(`${where}: „wolna” obok innych intencji — pominięta.`); else free = true; continue; }
        if (read === null) continue;
        if (intentions.length >= MAX_INTENTIONS) { warnings.push(`${where}: najwyżej ${MAX_INTENTIONS} intencji przy jednej mszy — reszta pominięta.`); break; }
        intentions.push(read);
      }
    }
  }
  if (free && intentions.length > 0) { warnings.push(`${where}: "free": true i intencje naraz — liczą się intencje.`); free = false; }
  return { label: where, date, time, mass, calendar, free, collective, cancelled, celebrants, intentions };
}

/** Das Dokument duldsam lesen — was nicht passt, fällt mit einem Wort weg. */
export function readMassesDocument(value: unknown): { doc: MassesDoc; warnings: string[] } | { error: string } {
  if (!isObject(value)) return { error: Array.isArray(value) ? 'To lista — dokument mszy to obiekt z "masses" i "occurrences".' : 'To nie jest dokument mszy.' };
  if (value.format !== undefined && value.format !== MASSES_FORMAT) return { error: `Inny format: "${String(value.format)}" — oczekiwano "${MASSES_FORMAT}".` };
  if (value.masses === undefined && value.occurrences === undefined) return { error: 'Dokument nie ma ani "masses", ani "occurrences" — nie ma czego importować.' };
  const warnings: string[] = [];
  if (value.version !== undefined && value.version !== MASSES_VERSION) warnings.push(`"version": ${String(value.version)} — znam wersję ${MASSES_VERSION}; czytam, co rozumiem.`);
  unknownKeys(value, MASSES_TOP_KEYS, 'Dokument', warnings);

  const calendar = typeof value.calendar === 'string' && value.calendar.trim() !== '' ? value.calendar.trim() : null;
  if (value.calendar !== undefined && value.calendar !== null && calendar === null) warnings.push('"calendar" to id albo nazwa kalendarza — pominięte.');
  const day = (key: 'from' | 'to'): string | null => {
    if (value[key] === undefined || value[key] === null) return null;
    const read = readDay(value[key]);
    if (read === null) warnings.push(`"${key}" to "RRRR-MM-DD" — pominięte.`);
    return read;
  };
  let from = day('from');
  let to = day('to');
  if (from !== null && to !== null && to < from) { warnings.push('"to" przed "from" — zamienione.'); [from, to] = [to, from]; }

  const list = (key: 'masses' | 'occurrences', max: number): readonly unknown[] => {
    const raw = value[key];
    if (raw === undefined || raw === null) return [];
    if (!Array.isArray(raw)) { warnings.push(`"${key}" to lista — pominięte.`); return []; }
    if (raw.length > max) { warnings.push(`"${key}": najwyżej ${max} pozycji — reszta pominięta.`); return raw.slice(0, max); }
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
  const t = ref.trim();
  if (UUID.test(t)) {
    const id = t.toLowerCase();
    return people.some((p) => p.roleId === id) || pinned.has(id) ? { roleId: id } : { problem: `${quote(t)} — takiej osoby nie ma w grupie kalendarza` };
  }
  const named = people.filter((p) => p.name !== '');
  const exact = named.filter((p) => textKey(p.name) === textKey(t));
  if (exact.length === 1) return { roleId: exact[0].roleId };
  const bare = personKey(t);
  if (bare !== '') {
    const same = named.filter((p) => personKey(p.name) === bare);
    if (same.length === 1) return { roleId: same[0].roleId };
    if (same.length > 1) return { problem: `${quote(t)} — kilka osób o tym imieniu i nazwisku; podaj id` };
    const words = bare.split(' ');
    if (words.length === 1) {
      const surname = named.filter((p) => personKey(p.name).split(' ').includes(words[0]));
      if (surname.length === 1) return { roleId: surname[0].roleId };
      if (surname.length > 1) return { problem: `${quote(t)} — pasuje kilka osób (${surname.map((p) => p.name).join(', ')})` };
    }
  }
  return { problem: `${quote(t)} — nie znam takiej osoby w grupie kalendarza` };
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

const serviceName = (kind: string, title: string): string => title || SERVICE_LABEL[kind] || 'Wpis';

function patternText(def: SeriesDef): string {
  const time = clockShort(def.time);
  const every = Math.max(1, def.every);
  switch (def.repeat) {
    case 'none': return `${dateWords(def.date)} ${time}`;
    case 'daily': return `${every === 1 ? 'codziennie' : `co ${every} dni`} ${time}`;
    case 'weekly': return `${every === 1 ? 'co tydzień' : `co ${every} ${plural(every, 'tydzień', 'tygodnie', 'tygodni')}`} (${weekdayWords(def.weekdays).join(', ')}) ${time}`;
    case 'monthly': return `${every === 1 ? 'co miesiąc' : `co ${every} ${plural(every, 'miesiąc', 'miesiące', 'miesięcy')}`} (${dateOf(def.date).getDate()}.) ${time}`;
    case 'yearly': return `co rok ${time}`;
    default: return time;
  }
}

const spanText = (def: SeriesDef): string =>
  def.repeat === 'none' ? '' : `, od ${dateWords(def.date)}${def.until === null ? ', bez końca' : ` do ${dateWords(def.until)}`}`;

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
  if (daysBetween(from, to) > MAX_DAYS) return { error: `Za długi okres: ${dateWords(from)} – ${dateWords(to)}; jeden dokument obejmuje najwyżej ${MAX_DAYS} dni.` };
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
    if (found === null) return { error: `Nie znam kalendarza ${quote(doc.calendar)} — wybierz go u góry albo usuń "calendar" z dokumentu.` };
    home = found;
  } else {
    home = state.calendars.find((c) => c.calendarId === state.chosen);
    if (home === undefined) return { error: 'Wybierz u góry kalendarz, do którego ma iść import.' };
  }
  if (!home.mayWrite) return { error: `W kalendarzu ${quote(calendarName(home))} możesz tylko czytać — import niczego by nie zapisał.` };
  const homeCalendar = home;

  const calendarOf = (ref: string | null, where: string): CalendarNow | null => {
    if (ref === null) return homeCalendar;
    const found = findCalendar(ref, state.calendars);
    if (found === null) { warnings.push(`${where}: nie znam kalendarza ${quote(ref)} (albo jest kilka o tej nazwie) — pominięte.`); return null; }
    if (!found.mayWrite) { warnings.push(`${where}: w kalendarzu ${quote(calendarName(found))} możesz tylko czytać — pominięte.`); return null; }
    if (!state.loaded.includes(found.calendarId)) { warnings.push(`${where}: kalendarz ${quote(calendarName(found))} nie jest wczytany — pominięte.`); return null; }
    return found;
  };
  const peopleOf = (calendarId: string): readonly Person[] => state.people.get(calendarId) ?? [];
  const nameOf = (roleId: string, calendarId: string): string =>
    peopleOf(calendarId).find((p) => p.roleId === roleId)?.name || `osoba ${short(roleId)}`;
  const namesOf = (list: readonly PinnedNow[], calendarId: string): string =>
    list.length === 0 ? 'nikt' : list.map((p) => nameOf(p.roleId, calendarId)).join(', ');

  /** Personen eines Dokuments → Kennungen. Kennt sie einer nicht, bleibt alles, wie es ist. */
  const resolvePeople = (refs: readonly string[], calendarId: string, pinned: ReadonlySet<string>, where: string): string[] | null => {
    const ids: string[] = [];
    const problems: string[] = [];
    for (const ref of refs) {
      const found = findPerson(ref, peopleOf(calendarId), pinned);
      if ('problem' in found) problems.push(found.problem);
      else if (!ids.includes(found.roleId)) ids.push(found.roleId);
    }
    if (problems.length > 0) { warnings.push(`${where}: ${problems.join('; ')} — osoby bez zmian.`); return null; }
    if (ids.length > MAX_PEOPLE) { warnings.push(`${where}: najwyżej ${MAX_PEOPLE} osób przy jednym terminie — osoby bez zmian.`); return null; }
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
    if (refs.has(key)) { warnings.push(`${where}: nazwa "@${key}" już jest — bez nazwy.`); return; }
    refs.set(key, ref);
  };

  for (const m of doc.masses) {
    const where = m.label;
    if (m.id !== null) {
      const s = state.series.get(m.id);
      if (s === undefined) { warnings.push(`${where}: nie znam wpisu o tym "id" (${short(m.id)}) w tym okresie — pominięty; bez "id" powstałby nowy.`); continue; }
      if (seen.has(s.itemId)) { warnings.push(`${where}: ten sam wpis drugi raz — liczy się pierwszy.`); continue; }
      seen.add(s.itemId);
      nameKey(m.key, { existing: s.itemId }, where);
      const calendar = state.calendars.find((c) => c.calendarId === s.calendarId);
      if (m.calendar !== null) {
        const named = findCalendar(m.calendar, state.calendars);
        if (named?.calendarId !== s.calendarId) warnings.push(`${where}: wpis należy do kalendarza ${quote(calendar === undefined ? '?' : calendarName(calendar))} — tam zostaje.`);
      }
      if (calendar === undefined || !calendar.mayWrite || !s.editable) { warnings.push(`${where}: tego wpisu nie możesz zmieniać — pominięty.`); continue; }
      if (m.kind !== undefined && m.kind !== s.kind) warnings.push(`${where}: rodzaju istniejącego wpisu import nie zmienia (zostaje: ${SERVICE_LABEL[s.kind] ?? s.kind}).`);

      const change: { -readonly [K in keyof SeriesDef]?: SeriesDef[K] } = {};
      const said: string[] = [];
      if (m.title !== undefined && m.title !== s.title) { change.title = m.title; said.push(`nazwa ${quote(serviceName(s.kind, m.title))}`); }
      if (m.date !== undefined && m.date !== s.date && m.changeFrom === undefined) { change.date = m.date; said.push(`początek ${dateWords(s.date)} → ${dateWords(m.date)}`); }
      if (m.date !== undefined && m.date !== s.date && m.changeFrom !== undefined) warnings.push(`${where}: przy "changeFrom" nowa seria zaczyna się od tego dnia — "date" pominięte.`);
      if (m.time !== undefined && m.time !== s.time) { change.time = m.time; said.push(`godzina ${clockShort(s.time)} → ${clockShort(m.time)}`); }
      if (m.minutes !== undefined && m.minutes !== s.minutes) { change.minutes = m.minutes; said.push(`czas ${s.minutes} → ${m.minutes} min`); }
      if (m.repeat !== undefined && m.repeat !== s.repeat) { change.repeat = m.repeat; said.push(`powtarzanie ${m.repeat}`); }
      const repeat = change.repeat ?? s.repeat;
      if (m.every !== undefined && repeat !== 'none' && m.every !== s.every) { change.every = m.every; said.push(`co ${m.every}`); }
      if (repeat === 'weekly') {
        const wanted = m.weekdays !== undefined && m.weekdays !== 0 ? m.weekdays : s.weekdays !== 0 ? s.weekdays : 1 << weekdayIndex(change.date ?? s.date);
        if (wanted !== s.weekdays) { change.weekdays = wanted; said.push(`dni ${weekdayWords(wanted).join(', ')}`); }
      } else if (m.weekdays !== undefined && m.weekdays !== 0) warnings.push(`${where}: "weekdays" tylko przy "weekly" — pominięte.`);
      if (m.until !== undefined && repeat !== 'none') {
        const until = m.until === null ? null : untilOf(change.date ?? s.date, m.until);
        if (until !== s.until) { change.until = until; said.push(until === null ? 'bez końca' : `do ${dateWords(until)}`); }
      }
      if (m.place !== undefined && m.place !== s.place) {
        change.place = m.place;
        said.push(m.place === '' ? 'bez miejsca' : `miejsce ${quote(m.place)}`);
        if (s.place === null) warnings.push(`${where}: obecnego miejsca nie da się tu odczytać — zostanie zastąpione.`);
      }
      const duty = dutyOf(s.kind);
      let people: PinnedNow[] | null = null;
      if (m.celebrants !== undefined) {
        const ids = resolvePeople(m.celebrants, s.calendarId, new Set(s.people.map((p) => p.roleId)), where);
        if (ids !== null) {
          const next = withDuty(s.people, ids, duty);
          if (!samePeople(next, s.people)) { people = next; said.push(`${peopleWord(s.kind).toLowerCase()}: ${namesOf(next.filter((p) => p.duty === duty), s.calendarId)}`); }
        }
      }
      const next: SeriesDef = { ...defOf(s), ...change };
      if (next.repeat !== 'none' && next.until !== null && next.until < next.date) { warnings.push(`${where}: "until" przed początkiem serii — pominięty.`); continue; }
      const label = `${serviceName(s.kind, next.title)} — ${patternText(defOf(s))}`;

      /* „Ta i następne": die alte Reihe endet am Vortag, eine neue übernimmt (0079). */
      if (m.changeFrom !== undefined && s.repeat !== 'none' && m.changeFrom > s.date) {
        if (s.until !== null && m.changeFrom > s.until) { warnings.push(`${where}: seria kończy się ${dateWords(s.until)}, przed "changeFrom" — pominięty.`); continue; }
        if (said.length === 0) { unchangedMasses++; continue; }
        /* Der Takt der alten Reihe (Monatstag, „co 2 tygodnie") — die neue beginnt am ersten Tag ab dann. */
        const first = firstDayFrom({ ...next, date: s.date }, m.changeFrom);
        if (first === null) { warnings.push(`${where}: od ${dateWords(m.changeFrom)} ta seria nie ma już żadnego dnia — pominięty.`); continue; }
        const def: SeriesDef = { ...next, date: first, until: next.until };
        const lost = (occurrencesOf.get(s.itemId) ?? []).filter((o) => o.addressDate >= m.changeFrom! && hasLive(o) && !seriesHas(def, o.addressDate));
        if (lost.length > 0) {
          warnings.push(`${where}: po zmianie te msze z przyjętymi intencjami nie byłyby w planie: ${lost.slice(0, 4).map((o) => whenLabel(o.date, o.time)).join(', ')}${lost.length > 4 ? ' …' : ''} — zmiana pominięta; przenieś najpierw te intencje.`);
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
        massLines.push(`Zmiana od ${dateWords(m.changeFrom)} (ta i następne): ${label}: ${said.join('; ')}.`);
        continue;
      }
      if (m.changeFrom !== undefined && s.repeat === 'none') warnings.push(`${where}: to nie seria — "changeFrom" pominięte.`);
      if (said.length === 0) { unchangedMasses++; continue; }
      const days = change.date !== undefined || change.repeat !== undefined || change.every !== undefined || change.weekdays !== undefined || change.until !== undefined;
      if (days) {
        const lost = (occurrencesOf.get(s.itemId) ?? []).filter((o) => hasLive(o) && !seriesHas(next, o.addressDate));
        if (lost.length > 0) {
          warnings.push(`${where}: po zmianie te msze z przyjętymi intencjami nie byłyby w planie: ${lost.slice(0, 4).map((o) => whenLabel(o.date, o.time)).join(', ')}${lost.length > 4 ? ' …' : ''} — zmiana pominięta; przenieś najpierw te intencje albo podaj "changeFrom".`);
          continue;
        }
      }
      if (days || change.time !== undefined) reshaped.set(s.itemId, next);
      if (people !== null) repeopled.set(s.itemId, { was: s.people, now: people });
      updates.push({ itemId: s.itemId, calendarId: s.calendarId, change, people, label });
      massLines.push(`Zmiana: ${label}: ${said.join('; ')}${m.changeFrom !== undefined && s.repeat !== 'none' ? ' (od początku serii — cała seria)' : ''}.`);
      continue;
    }

    /* Neu. */
    const calendar = calendarOf(m.calendar, where);
    if (calendar === null) continue;
    if (m.date === undefined || m.time === undefined) { warnings.push(`${where}: nowy wpis potrzebuje "date" i "time" — pominięty.`); continue; }
    if (m.changeFrom !== undefined) warnings.push(`${where}: "changeFrom" tylko przy wpisie z "id" — pominięte.`);
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
    if (def.until !== null && def.until < def.date) { warnings.push(`${where}: "until" przed "date" — pominięty.`); continue; }
    if (repeat === 'none' && m.weekdays !== undefined && m.weekdays !== 0) warnings.push(`${where}: "weekdays" tylko przy "weekly" — pominięte.`);
    let people: PinnedNow[] | null = null;
    if (m.celebrants !== undefined && m.celebrants.length > 0) {
      const ids = resolvePeople(m.celebrants, calendar.calendarId, new Set(), where);
      if (ids !== null) people = ids.map((roleId) => ({ roleId, duty: dutyOf(kind) }));
    }
    /* Dieselbe Stunde an denselben Tagen schon im Kalender? Dann ist es wohl dieselbe Messe — gesagt, nicht verhindert. */
    const twin = [...state.series.values()].find((s) => s.calendarId === calendar.calendarId && s.kind === kind && s.time === def.time
      && (occurrencesOf.get(s.itemId) ?? []).some((o) => o.status !== 'cancelled' && seriesHas(def, o.date)));
    if (twin !== undefined) warnings.push(`${where}: w tym kalendarzu jest już ${serviceName(twin.kind, twin.title)} o ${clockShort(def.time)} w te dni (${patternText(defOf(twin))}) — nowa będzie druga o tej samej godzinie; jeśli to ta sama, użyj jej "id".`);
    const fresh = creates.length;
    const label = `${serviceName(kind, def.title)} — ${patternText(def)}`;
    creates.push({ fresh, calendarId: calendar.calendarId, def, people, handover: null, label });
    nameKey(m.key, { fresh }, where);
    massLines.push(`Nowy: ${label}${spanText(def)}${def.place === '' ? '' : `, ${def.place}`}${calendar.calendarId === homeCalendar.calendarId ? '' : ` — ${calendarName(calendar)}`}${people === null ? '' : `; ${peopleWord(kind).toLowerCase()}: ${namesOf(people, calendar.calendarId)}`}.`);
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
  const onDay = (itemId: string, date: string): OccurrenceNow | null => (occurrencesOf.get(itemId) ?? []).find((o) => o.date === date) ?? null;

  const slots = new Map<string, Slot>();
  let skippedSlots = 0;

  const resolve = (o: OccurrenceDoc): Omit<Slot, 'free' | 'collective' | 'cancelled' | 'celebrants' | 'intentions'> | null => {
    const where = o.label;
    let ref: MassRef | undefined;
    if (o.mass !== undefined) {
      if (o.mass.startsWith('@')) {
        ref = refs.get(o.mass.slice(1));
        if (ref === undefined) { warnings.push(`${where}: nie ma wpisu "${o.mass}" w "masses" — pominięta.`); return null; }
      } else {
        const id = o.mass.toLowerCase();
        if (!state.series.has(id) && !occurrencesOf.has(id)) { warnings.push(`${where}: nie znam mszy o "mass" ${short(id)} w tym okresie — pominięta.`); return null; }
        ref = { existing: id };
      }
      if ('fresh' in ref) {
        const create = creates[ref.fresh];
        if (!seriesHas(create.def, o.date)) { warnings.push(`${where}: nowy wpis ${quote(create.label)} nie wypada w tym dniu — pominięta.`); return null; }
        if (o.time !== undefined && o.time !== create.def.time) warnings.push(`${where}: ten wpis jest o ${clockShort(create.def.time)} — liczy się "mass".`);
        return { key: `${refKey(ref)}|${o.date}`, mass: ref, calendarId: create.calendarId, date: o.date, time: create.def.time, kind: create.def.kind, existing: null, label: whenLabel(o.date, create.def.time) };
      }
      const itemId = ref.existing;
      const existing = onDay(itemId, o.date);
      const s = state.series.get(itemId);
      const calendarId = s?.calendarId ?? existing?.calendarId ?? homeCalendar.calendarId;
      const kind = s?.kind ?? existing?.kind ?? MASS;
      const calendar = state.calendars.find((c) => c.calendarId === calendarId);
      if (calendar === undefined || !calendar.mayWrite) { warnings.push(`${where}: w kalendarzu tej mszy możesz tylko czytać — pominięta.`); return null; }
      const h = handovers.get(itemId);
      let mass: MassRef = ref;
      let time: string;
      if (h !== undefined && o.date >= h.from) {
        const def = creates[h.fresh].def;
        if (!seriesHas(def, o.date)) { warnings.push(`${where}: po zmianie od ${dateWords(h.from)} tej mszy w tym dniu nie ma — pominięta.`); return null; }
        mass = { fresh: h.fresh };
        time = def.time;
      } else if (reshaped.has(itemId)) {
        const def = reshaped.get(itemId)!;
        if (!(existing?.moved === true) && !seriesHas(def, existing?.addressDate ?? o.date)) { warnings.push(`${where}: po zmianie serii tej mszy w tym dniu nie ma — pominięta.`); return null; }
        time = existing === null ? def.time : timeAfter(existing);
      } else {
        if (existing === null) { warnings.push(`${where}: tej mszy nie ma w planie w tym dniu — pominięta.`); return null; }
        time = existing.time;
      }
      if (o.time !== undefined && o.time !== time) warnings.push(`${where}: ta msza jest o ${clockShort(time)} — liczy się "mass", nie godzina.`);
      return { key: `${refKey(mass)}|${o.date}`, mass, calendarId, date: o.date, time, kind, existing, label: whenLabel(o.date, time) };
    }

    const calendar = calendarOf(o.calendar, where);
    if (calendar === null) return null;
    if (o.time === undefined) { warnings.push(`${where}: bez "mass" potrzebna jest "time" — pominięta.`); return null; }
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
      return { key: `${refKey(f.ref)}|${o.date}`, mass: f.ref, calendarId: calendar.calendarId, date: o.date, time: o.time, kind: f.kind, existing: f.existing, label: whenLabel(o.date, o.time) };
    }
    if (found.length > 1) { warnings.push(`${where}: o tej godzinie jest kilka mszy — dodaj "mass" (id z eksportu); pominięta.`); return null; }
    if (others.length > 0) { warnings.push(`${where}: o tej godzinie jest ${others[0].toLowerCase()}, nie msza — pominięta.`); return null; }
    const times = [...new Set(state.occurrences.filter((one) => one.calendarId === calendar.calendarId && one.date === o.date && one.kind === MASS).map(timeAfter))].sort();
    warnings.push(`${where}: w tym dniu nie ma mszy o ${clockShort(o.time)}${times.length === 0 ? ' (nie ma żadnej)' : ` (są: ${times.map(clockShort).join(', ')})`} — pominięta; dopisz ją w "masses" albo popraw godzinę.`);
    return null;
  };

  for (const o of doc.occurrences) {
    const at = resolve(o);
    if (at === null) { skippedSlots++; continue; }
    const known = slots.get(at.key);
    if (known !== undefined) {
      warnings.push(`${o.label}: ta sama msza (${known.label}) drugi raz — połączone z wcześniejszą pozycją.`);
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
      if (target.has(d.id)) warnings.push(`${slot.label}: intencja ${quote(cut(d.text, 40))} (to samo "id") drugi raz — liczy się pierwsze miejsce.`);
      else target.set(d.id, slot.key);
    }
  }
  const sameOcc = (a: OccurrenceNow | null, b: OccurrenceNow): boolean => a !== null && a.itemId === b.itemId && a.occurrenceAt === b.occurrenceAt;

  const plans: OccurrencePlan[] = [];
  const count = { added: 0, changed: 0, moved: 0, free: 0, unchanged: 0, conflicts: 0, cancels: 0, restores: 0, people: 0 };

  for (const slot of slots.values()) {
    const current = slot.existing === null ? [] : [...slot.existing.intentions].sort((a, b) => a.ordinal - b.ordinal || a.id.localeCompare(b.id));
    const isMassSlot = slot.kind === MASS;
    const said: string[] = [];
    if (!isMassSlot && slot.intentions.length > 0) {
      warnings.push(`${slot.label}: ${(SERVICE_LABEL[slot.kind] ?? 'ten wpis').toLowerCase()} nie ma intencji — pominięte.`);
      slot.intentions.length = 0;
    }

    const claimed = new Set<string>();
    const changes: IntentionChange[] = [];
    let adds: IntentionAdd[] = [];
    const order: ({ id: string; here: boolean } | { add: IntentionAdd })[] = [];
    const celebrantOf = (ref: string | null | undefined, where: string): string | null | undefined => {
      if (ref === undefined) return undefined;
      if (ref === null) return null;
      const found = findPerson(ref, peopleOf(slot.calendarId), new Set(slot.existing?.people.map((p) => p.roleId) ?? []));
      if ('problem' in found) { warnings.push(`${slot.label}, ${where}: ${found.problem} — bez zmiany osoby.`); return undefined; }
      return found.roleId;
    };

    for (const d of slot.intentions) {
      const where = quote(cut(d.text, 40));
      let match: IntentionNow | null = null;
      let byIdMatch = false;
      let moved: OccurrenceNow | null = null;
      if (d.id !== null) {
        const known = byId.get(d.id);
        if (known === undefined) warnings.push(`${slot.label}: nie znam intencji o "id" ${short(d.id)} — będzie nowa.`);
        else if (target.get(d.id) !== slot.key) continue;
        else {
          match = known.intention;
          byIdMatch = true;
          if (!sameOcc(slot.existing, known.occ)) moved = known.occ;
        }
      }
      if (match === null) {
        const wanted = textKey(d.text);
        match = current.find((i) => !claimed.has(i.id) && !target.has(i.id) && textKey(i.text) === wanted) ?? null;
      }
      const kind = d.kind ?? (slot.collective ? 'collective' : undefined);
      if (match !== null) {
        claimed.add(match.id);
        const c: ChangeFields = {};
        const bits: string[] = [];
        if (byIdMatch && d.text !== match.text) { c.text = d.text; bits.push(`treść ${quote(cut(match.text, 40))} → ${quote(cut(d.text, 40))}`); }
        if (kind !== undefined && kind !== match.kind) { c.kind = kind; bits.push(KIND_LABEL[kind]); }
        if (d.status !== undefined && d.status !== match.status) { c.status = d.status; bits.push(INTENTION_STATUS_LABEL[d.status]); }
        if (d.giver !== undefined && d.giver !== match.giver) { c.giver = d.giver; bits.push(d.giver === '' ? 'bez ofiarodawcy' : 'ofiarodawca'); }
        if (d.offering !== undefined && d.offering !== match.offering) { c.offering = d.offering; bits.push(d.offering === '' ? 'bez ofiary' : 'ofiara'); }
        const celebrant = celebrantOf(d.celebrant, where);
        if (celebrant !== undefined && (celebrant ?? null) !== match.celebrant) { c.celebrant = celebrant ?? ''; bits.push(celebrant === null ? 'bez odprawiającego' : `odprawia ${nameOf(celebrant, slot.calendarId)}`); }
        if (moved !== null) { c.move = true; bits.unshift(`przeniesiona tu (z ${whenLabel(moved.date, moved.time)})`); }
        if (Object.keys(c).length > 0) {
          changes.push({ id: match.id, ...c });
          said.push(`${quote(cut(d.text, 60))}: ${bits.join(', ')}`);
          if (moved !== null) count.moved++; else count.changed++;
        } else count.unchanged++;
        order.push({ id: match.id, here: moved === null });
        continue;
      }
      const celebrant = celebrantOf(d.celebrant, where);
      const add: IntentionAdd = {
        text: d.text, kind: kind ?? 'single', status: d.status ?? 'accepted',
        giver: d.giver ?? '', offering: d.offering ?? '', celebrant: celebrant ?? null, ordinal: null
      };
      adds.push(add);
      order.push({ add });
    }

    /* Was an der Messe hängt und im Dokument nicht vorkommt — und nicht anderswohin geht. */
    const movedAway = (i: IntentionNow) => target.has(i.id) && target.get(i.id) !== slot.key;
    const unaccounted = current.filter((i) => isLive(i) && !claimed.has(i.id) && !movedAway(i));
    const listed = unaccounted.map((i) => quote(cut(i.text, 50))).join(', ');
    if (adds.length > 0 && unaccounted.length > 0) {
      const single = adds.some((a) => a.kind === 'single') || unaccounted.some((i) => i.kind === 'single');
      if (single) {
        count.conflicts++;
        if (options.conflicts === 'skip') {
          warnings.push(`${slot.label}: ma już intencję ${listed}; w dokumencie inna: ${adds.map((a) => quote(cut(a.text, 50))).join(', ')} — nie dopisuję (zaznacz niżej „dopisz obok”, jeśli to dodatkowa intencja).`);
          const dropped = new Set(adds);
          for (let i = order.length - 1; i >= 0; i--) { const one = order[i]; if ('add' in one && dropped.has(one.add)) order.splice(i, 1); }
          adds = [];
        } else warnings.push(`${slot.label}: ma już intencję ${listed} — nowe dopisane obok (dwie pojedyncze to dwóch kapłanów).`);
      } else warnings.push(`${slot.label}: w kalendarzu są też ${listed}, których nie ma w dokumencie — zostają; nowe zbiorowe dochodzą.`);
    } else if (unaccounted.length > 0 && (slot.free || slot.intentions.length > 0)) {
      warnings.push(slot.free
        ? `${slot.label}: w dokumencie wolna, a w kalendarzu ma intencję ${listed} — zostaje.`
        : `${slot.label}: w kalendarzu jest też ${listed}, czego nie ma w dokumencie — zostaje bez zmian.`);
    }
    if (slot.free && slot.intentions.length === 0) count.free++;

    /* Abgesagt — oder zurückgeholt. */
    const offNow = slot.existing?.status === 'cancelled';
    let restore = false;
    if (slot.cancelled === false && offNow) {
      if (slot.existing!.skipped) { restore = true; said.unshift('przywrócona'); count.restores++; } else warnings.push(`${slot.label}: odwołana jest cała msza (nie tylko ten dzień) — przywróć ją w kalendarzu.`);
    }
    /* Eine abgesagte Messe nimmt nichts an (der Dienst weist es ab) — hier gesagt statt beim Speichern. */
    if (offNow && !restore) {
      const comingIn = changes.filter((c) => c.move === true);
      if (adds.length > 0 || comingIn.length > 0) {
        warnings.push(`${slot.label}: msza jest odwołana — intencje do niej pominięte (przywróć ją: "cancelled": false).`);
        for (const c of comingIn) changes.splice(changes.indexOf(c), 1);
        for (let i = order.length - 1; i >= 0; i--) { const one = order[i]; if ('add' in one || !one.here) order.splice(i, 1); }
        count.moved -= comingIn.length;
        adds = [];
      }
    }
    const movesIn = changes.filter((c) => c.move === true);
    let cancel = false;
    if (slot.cancelled === true && !offNow) {
      const stays = current.filter((i) => isLive(i) && !movedAway(i) && changes.find((c) => c.id === i.id)?.status !== 'cancelled').length
        + adds.filter((a) => a.status !== 'cancelled').length + movesIn.length;
      if (stays > 0) warnings.push(`${slot.label}: nie odwołuję — msza ma przyjęte intencje; przenieś je najpierw na inną mszę.`);
      else { cancel = true; said.push('odwołana (tylko ten dzień)'); count.cancels++; }
    }

    /* Die Reihenfolge des Vorlesens: nur, wenn das Dokument die Messe ganz nennt und sie anders ordnet. */
    const whole = current.length > 0 && current.every((i) => claimed.has(i.id));
    const docOrder = order.flatMap((one) => ('id' in one && one.here ? [one.id] : []));
    const addsBefore = order.some((one, i) => 'add' in one && order.slice(i + 1).some((later) => 'id' in later));
    if (whole && (docOrder.join(',') !== current.map((i) => i.id).join(',') || addsBefore || movesIn.length > 0)) {
      const byOrdinal = new Map(current.map((i) => [i.id, i.ordinal]));
      let reordered = false;
      order.forEach((one, k) => {
        if ('add' in one) { const at = adds.indexOf(one.add); if (at >= 0) adds[at] = { ...one.add, ordinal: k }; return; }
        if (byOrdinal.get(one.id) === k && one.here) return;
        const at = changes.findIndex((c) => c.id === one.id);
        if (at >= 0) changes[at] = { ...changes[at], ordinal: k }; else changes.push({ id: one.id, ordinal: k });
        if (one.here) reordered = true;
      });
      if (reordered) said.push('nowa kolejność czytania');
    }

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
      if (next.length > MAX_PEOPLE) warnings.push(`${slot.label}: najwyżej ${MAX_PEOPLE} osób przy jednym terminie — osoby bez zmian.`);
      else { people = next; said.push(`${peopleWord(slot.kind).toLowerCase()}: ${namesOf(next.filter((p) => p.duty === duty || readers.has(p.roleId)), slot.calendarId)}`); count.people++; }
    }

    /* Zwei pojedyncze — zwei Priester: gesagt, wo der Import daran etwas ändert. */
    if (isMassSlot && (adds.length > 0 || changes.length > 0)) {
      const kindAfter = (i: IntentionNow) => changes.find((c) => c.id === i.id)?.kind ?? i.kind;
      const statusAfter = (i: IntentionNow) => changes.find((c) => c.id === i.id)?.status ?? i.status;
      const singles = current.filter((i) => !movedAway(i) && statusAfter(i) !== 'cancelled' && kindAfter(i) === 'single').length
        + adds.filter((a) => a.kind === 'single' && a.status !== 'cancelled').length
        + movesIn.filter((c) => c.kind === undefined ? byId.get(c.id)?.intention.kind === 'single' : c.kind === 'single').length;
      if (singles > 1) warnings.push(`${slot.label}: ${singles} intencje pojedyncze — potrzeba ${singles} kapłanów (koncelebra).`);
    }

    for (const a of adds) {
      const details = [
        a.kind === 'collective' ? KIND_LABEL.collective : '',
        a.status === 'accepted' ? '' : INTENTION_STATUS_LABEL[a.status],
        a.giver === '' ? '' : 'ofiarodawca',
        a.offering === '' ? '' : 'ofiara',
        a.celebrant === null ? '' : `odprawia ${nameOf(a.celebrant, slot.calendarId)}`
      ].filter((s) => s !== '');
      said.push(`nowa ${quote(a.text)}${details.length === 0 ? '' : ` (${details.join(', ')})`}`);
    }
    count.added += adds.length;

    if (adds.length === 0 && changes.length === 0 && !restore && !cancel && people === null) continue;
    const calendar = state.calendars.find((c) => c.calendarId === slot.calendarId);
    const where = calendar === undefined || slot.calendarId === homeCalendar.calendarId ? '' : ` (${calendarName(calendar)})`;
    const newMass = 'fresh' in slot.mass && creates[slot.mass.fresh].handover === null ? ' [nowa msza]' : '';
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
  const lines: string[] = [`Kalendarz: ${calendarName(homeCalendar)}${calendars.size > 1 ? ` (i ${calendars.size - 1} inne)` : ''}.`];
  if (doc.masses.length > 0) {
    const fresh = creates.filter((c) => c.handover === null).length;
    lines.push(`Msze i nabożeństwa: nowe ${fresh}, zmienione ${updates.length + creates.length - fresh}, bez zmian ${unchangedMasses}.`);
  }
  if (doc.occurrences.length > 0) {
    lines.push(`Intencje: nowe ${count.added}, zmienione ${count.changed}, przeniesione ${count.moved}, bez zmian ${count.unchanged}; msze wolne: ${count.free}${skippedSlots > 0 ? `; pozycje pominięte: ${skippedSlots}` : ''}.`);
  }
  if (count.cancels + count.restores > 0) lines.push(`Odwołane w jednym dniu: ${count.cancels}, przywrócone: ${count.restores}.`);
  if (empty) lines.push('Bez zmian — wszystko z dokumentu już jest w kalendarzu.');
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
