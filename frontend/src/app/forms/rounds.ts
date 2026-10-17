/**
 * DER ZEITRAUM EINER WIEDERKEHRENDEN ERWEITERUNG (0077).
 *
 * Eine Erweiterung eines Formulars (0047) gab es je Mensch einmal. Vieles ist
 * aber dasselbe Blatt, immer wieder: die Kranken, die jeden Monat besucht
 * werden, die Anwesenheit bei jedem Treffen, der Beitrag. Eine Erweiterung
 * sagt deshalb, WIE OFT sie ausgefüllt wird, und jede ihrer Einsendungen trägt
 * den Zeitraum, für den sie gilt — als Schlüssel:
 *
 * <code>
 *   once    ''
 *   day     2026-10-02
 *   week    2026-W40      (ISO 8601: Montag bis Sonntag; das Jahr der Woche)
 *   month   2026-10
 *   year    2026
 * </code>
 *
 * <b>Der Schlüssel entsteht HIER</b>, aus dem Tag, wie er bei diesem Menschen
 * ist (seine Uhr, sein Ort); der Dienst prüft nur die Gestalt und dass er
 * nicht aus der Zukunft kommt (`Rounds.cs`). Beide Rechnungen werden gegen
 * dieselbe Tabelle geprüft (`backend/Api.Tests/round-keys.json`).
 *
 * Innerhalb einer Art ordnen sich die Schlüssel als Text so, wie die Zeit
 * läuft — damit holt die Liste ein Jahr mit „von–bis".
 *
 * Rein — ohne Dienst, ohne Seite; geprüft in `app-platform-check.mjs`.
 */

export type Repeat = 'once' | 'day' | 'week' | 'month' | 'year';

export const REPEATS: readonly Repeat[] = ['once', 'day', 'week', 'month', 'year'];

export const REPEAT_LABEL: Record<Repeat, string> = {
  once: 'jednorazowo',
  day: 'co dzień',
  week: 'co tydzień',
  month: 'co miesiąc',
  year: 'co rok'
};

/** Was fehlt oder unbekannt ist, heisst „einmal" — so stand es vor 0077 überall. */
export const repeatOf = (value: unknown): Repeat =>
  (typeof value === 'string' && (REPEATS as readonly string[]).includes(value) ? value as Repeat : 'once');

const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const MONTHS_OF = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const MONTHS_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const WEEKDAYS = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

/*
 * Tage als UTC-Mitternacht GERECHNET — nicht, weil der Tag in UTC gemeint wäre,
 * sondern damit die Zeitumstellung keinen Tag verschluckt. Hinein geht der Tag
 * dieses Ortes (Jahr, Monat, Tag), heraus kommt wieder nur Jahr, Monat, Tag.
 */
const dayOf = (year: number, month: number, day: number): Date => new Date(Date.UTC(year, month, day));
const localDay = (date: Date): Date => dayOf(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (day: Date, by: number): Date => new Date(day.getTime() + by * 86400_000);

/** Die ISO-Woche eines Tages — die Woche gehört dem Jahr ihres Donnerstags. */
function isoWeek(day: Date): { year: number; week: number } {
  const weekday = day.getUTCDay() || 7;
  const thursday = addDays(day, 4 - weekday);
  const year = thursday.getUTCFullYear();
  const week = Math.ceil(((thursday.getTime() - Date.UTC(year, 0, 1)) / 86400_000 + 1) / 7);
  return { year, week };
}

/** Wie viele Wochen das ISO-Jahr hat: 52 oder 53. Der 28. Dezember liegt immer in der letzten. */
const weeksIn = (year: number): number => isoWeek(dayOf(year, 11, 28)).week;

/** Der Montag der ersten ISO-Woche: der 4. Januar liegt immer darin. */
function weekStart(year: number, week: number): Date {
  const fourth = dayOf(year, 0, 4);
  const monday = addDays(fourth, 1 - (fourth.getUTCDay() || 7));
  return addDays(monday, (week - 1) * 7);
}

const dayKey = (day: Date): string => `${pad(day.getUTCFullYear(), 4)}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`;

function keyOfDay(repeat: Repeat, day: Date): string {
  switch (repeat) {
    case 'day': return dayKey(day);
    case 'week': { const w = isoWeek(day); return `${pad(w.year, 4)}-W${pad(w.week)}`; }
    case 'month': return `${pad(day.getUTCFullYear(), 4)}-${pad(day.getUTCMonth() + 1)}`;
    case 'year': return pad(day.getUTCFullYear(), 4);
    default: return '';
  }
}

/** Der Schlüssel des Zeitraums, in dem dieser Tag liegt — nach der Uhr dieses Ortes. */
export const roundOf = (repeat: Repeat, date: Date = new Date()): string => keyOfDay(repeat, localDay(date));

/** Hat der Schlüssel die Gestalt seiner Art — und gibt es den Zeitraum? */
export function roundValid(repeat: Repeat | string, key: string): boolean {
  const year = (text: string): number | null => (/^\d{4}$/.test(text) && Number(text) >= 1900 && Number(text) <= 2999 ? Number(text) : null);

  switch (repeat) {
    case 'once': return key === '';
    case 'day': {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
      if (m === null || year(m[1]) === null) return false;
      const day = dayOf(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return dayKey(day) === key;
    }
    case 'week': {
      const m = /^(\d{4})-W(\d{2})$/.exec(key);
      if (m === null) return false;
      const y = year(m[1]);
      return y !== null && Number(m[2]) >= 1 && Number(m[2]) <= weeksIn(y);
    }
    case 'month': {
      const m = /^(\d{4})-(\d{2})$/.exec(key);
      return m !== null && year(m[1]) !== null && Number(m[2]) >= 1 && Number(m[2]) <= 12;
    }
    case 'year': return year(key) !== null;
    default: return false;
  }
}

/** Der erste und der letzte Tag eines Zeitraums. */
function span(repeat: Repeat, key: string): { first: Date; last: Date } | null {
  if (repeat === 'once' || !roundValid(repeat, key)) return null;

  switch (repeat) {
    case 'day': {
      const [y, m, d] = key.split('-').map(Number);
      const day = dayOf(y, m - 1, d);
      return { first: day, last: day };
    }
    case 'week': {
      const first = weekStart(Number(key.slice(0, 4)), Number(key.slice(6)));
      return { first, last: addDays(first, 6) };
    }
    case 'month': {
      const [y, m] = key.split('-').map(Number);
      return { first: dayOf(y, m - 1, 1), last: dayOf(y, m, 0) };
    }
    default: {
      const y = Number(key);
      return { first: dayOf(y, 0, 1), last: dayOf(y, 11, 31) };
    }
  }
}

/** Um `by` Zeiträume weiter (oder zurück). */
export function shiftRound(repeat: Repeat, key: string, by: number): string {
  const at = span(repeat, key);
  if (at === null || by === 0) return key;

  switch (repeat) {
    case 'day': return dayKey(addDays(at.first, by));
    case 'week': return keyOfDay('week', addDays(at.first, by * 7));
    case 'month': {
      const months = at.first.getUTCFullYear() * 12 + at.first.getUTCMonth() + by;
      return `${pad(Math.floor(months / 12), 4)}-${pad((months % 12 + 12) % 12 + 1)}`;
    }
    default: return pad(Number(key) + by, 4);
  }
}

const dotted = (day: Date, withYear: boolean): string =>
  `${day.getUTCDate()}.${pad(day.getUTCMonth() + 1)}${withYear ? `.${day.getUTCFullYear()}` : ''}`;

/** Wie ein Zeitraum heisst: „październik 2026", „tydzień 40 (28.09–4.10.2026)", „2 października 2026 (pt)", „2026". */
export function roundLabel(repeat: Repeat, key: string): string {
  const at = span(repeat, key);
  if (at === null) return repeat === 'once' ? '' : key;

  switch (repeat) {
    case 'day':
      return `${at.first.getUTCDate()} ${MONTHS_OF[at.first.getUTCMonth()]} ${at.first.getUTCFullYear()} (${WEEKDAYS[at.first.getUTCDay()]})`;
    case 'week':
      return `tydzień ${Number(key.slice(6))} (${dotted(at.first, at.first.getUTCFullYear() !== at.last.getUTCFullYear())}–${dotted(at.last, true)})`;
    case 'month':
      return `${MONTHS[at.first.getUTCMonth()]} ${at.first.getUTCFullYear()}`;
    default:
      return key;
  }
}

/** Kurz, für eine Spalte: „paź", „T40", „2.10", „2026". */
export function roundShort(repeat: Repeat, key: string): string {
  const at = span(repeat, key);
  if (at === null) return key;

  switch (repeat) {
    case 'day': return dotted(at.first, false);
    case 'week': return `T${Number(key.slice(6))}`;
    case 'month': return MONTHS_SHORT[at.first.getUTCMonth()];
    default: return key;
  }
}

/**
 * DER ABSCHNITT, DEN DIE LISTE AUF EINMAL HOLT — der grössere Zeitraum um den
 * gewählten: ein Tag steht in seinem Monat, eine Woche und ein Monat in ihrem
 * Jahr, ein Jahr in seinen letzten zehn. Daraus rechnen sich die Summen
 * („razem w 2026") und der Verlauf eines Menschen.
 */
export function roundRange(repeat: Repeat, key: string): { from: string; to: string; label: string } | null {
  const at = span(repeat, key);
  if (at === null) return null;

  const y = at.first.getUTCFullYear();

  switch (repeat) {
    case 'day': {
      const month = at.first.getUTCMonth();
      return {
        from: dayKey(dayOf(y, month, 1)), to: dayKey(dayOf(y, month + 1, 0)),
        label: `${MONTHS[month]} ${y}`
      };
    }
    case 'week': {
      const year = Number(key.slice(0, 4));
      return { from: `${pad(year, 4)}-W01`, to: `${pad(year, 4)}-W${pad(weeksIn(year))}`, label: String(year) };
    }
    case 'month':
      return { from: `${pad(y, 4)}-01`, to: `${pad(y, 4)}-12`, label: String(y) };
    default:
      return { from: pad(y - 9, 4), to: pad(y, 4), label: `${y - 9}–${y}` };
  }
}

/** Alle Zeiträume von–bis (einschliesslich), der Reihe nach — höchstens 400. */
export function roundsBetween(repeat: Repeat, from: string, to: string): string[] {
  const out: string[] = [];
  if (repeat === 'once' || !roundValid(repeat, from) || !roundValid(repeat, to)) return out;

  for (let key = from; key <= to && out.length < 400; key = shiftRound(repeat, key, 1)) out.push(key);
  return out;
}

/** Liegt der Zeitraum in der Zukunft (nach der Uhr dieses Ortes)? Dorthin trägt niemand etwas ein. */
export const roundAhead = (repeat: Repeat, key: string, now: Date = new Date()): boolean =>
  repeat !== 'once' && key > roundOf(repeat, now);
