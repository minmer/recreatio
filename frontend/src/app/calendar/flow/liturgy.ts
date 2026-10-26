/**
 * 2026-10-26 — DAS KIRCHENJAHR, GERECHNET (D6 B).
 *
 * Hier steht NUR, was sich jedes Jahr verschiebt und sich ausrechnen lässt:
 * Ostern (gregorianisch, nach Meeus/Jones/Butcher) und was daran hängt, der
 * erste Adventssonntag, die Taufe des Herrn, die Heilige Familie, der
 * Abschnitt des Kirchenjahres, seine Woche, der Rang des TAGES selbst (die
 * Tabelle der liturgischen Tage ohne Heilige) und wie Sonntage und Wochentage
 * heissen („III Niedziela Adwentu", „Środa XXX tygodnia zwykłego").
 *
 * Was gefeiert wird — Namen der Heiligen, Ränge der Feste, Farben — gehört dem
 * Nutzer und steht in seinem Ablauf (die Vorlage `templates/planTemplates.ts`
 * füllt es einmal vor). Polnische Ordnung: Erscheinung des Herrn fest am
 * 6. Januar, also Taufe des Herrn am Sonntag danach.
 *
 * Ein Tag ist überall „YYYY-MM-DD" (Ortszeit, ohne Uhrzeit); gerechnet wird in
 * UTC-Tagen, damit keine Zeitumstellung einen Tag verschluckt.
 */

import { SEASON_LABEL, type DateRule, type Season, type Weekday } from './flowModel';

/* -- Tage ------------------------------------------------------------------------------ */

const DAY = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

/** „YYYY-MM-DD" aus Jahr, Monat (1–12), Tag. */
export const ymd = (year: number, month: number, day: number): string => `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;

const parts = (date: string): [number, number, number] => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (m === null) throw new Error(`Nieczytelna data: ${date}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};

const toUtc = (date: string): number => {
  const [y, m, d] = parts(date);
  return Date.UTC(y, m - 1, d);
};

const fromUtc = (ms: number): string => {
  const at = new Date(ms);
  return ymd(at.getUTCFullYear(), at.getUTCMonth() + 1, at.getUTCDate());
};

/** Ein gültiger Tag? („2026-02-30" ist keiner.) */
export const isDate = (date: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return fromUtc(toUtc(date)) === date;
};

export const addDays = (date: string, n: number): string => fromUtc(toUtc(date) + n * DAY);

/** a − b in Tagen. */
export const diffDays = (a: string, b: string): number => Math.round((toUtc(a) - toUtc(b)) / DAY);

/** 1 = Montag … 7 = Sonntag. */
export const weekdayOf = (date: string): Weekday => (((new Date(toUtc(date)).getUTCDay() + 6) % 7) + 1) as Weekday;

export const yearOf = (date: string): number => parts(date)[0];

/** Der Sonntag an oder vor diesem Tag. */
export const sundayOnOrBefore = (date: string): string => addDays(date, -(weekdayOf(date) % 7));

/** Der erste Sonntag NACH diesem Tag (nie er selbst). */
export const sundayAfter = (date: string): string => addDays(date, 7 - (weekdayOf(date) % 7));

/* -- Die beweglichen Tage --------------------------------------------------------------- */

const easterCache = new Map<number, string>();

/** Ostersonntag (gregorianisch, Meeus/Jones/Butcher). */
export function easter(year: number): string {
  const hit = easterCache.get(year);
  if (hit !== undefined) return hit;
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const found = ymd(year, month, day);
  easterCache.set(year, found);
  return found;
}

/** Der erste Adventssonntag: der vierte Sonntag vor Weihnachten (zwischen 27. November und 3. Dezember). */
export function adventStart(year: number): string {
  const christmas = ymd(year, 12, 25);
  /* Der letzte Sonntag VOR dem 25. — ist der 25. selbst ein Sonntag, der eine Woche davor. */
  const lastSunday = addDays(christmas, -(weekdayOf(christmas) === 7 ? 7 : weekdayOf(christmas)));
  return addDays(lastSunday, -21);
}

/** Chrzest Pański: der Sonntag nach dem 6. Januar (in Polen bleibt die Erscheinung am 6. Januar). */
export const baptismOfTheLord = (year: number): string => sundayAfter(ymd(year, 1, 6));

/** Święta Rodzina: der Sonntag in der Oktav von Weihnachten — gibt es keinen, der 30. Dezember. */
export function holyFamily(year: number): string {
  for (let day = 26; day <= 31; day += 1) {
    const date = ymd(year, 12, day);
    if (weekdayOf(date) === 7) return date;
  }
  return ymd(year, 12, 30);
}

/* -- Der Tag im Kirchenjahr --------------------------------------------------------------- */

export type SpecialDay = 'gaudete' | 'laetare' | 'palm' | 'goodFriday' | 'pentecost';

export interface DayInfo {
  readonly season: Season;
  readonly week: number;
  readonly sunday: boolean;
  readonly weekday: Weekday;
  /** Der Rang des Tages selbst (ohne Heilige): 1 Triduum, 2 privilegierte Tage, 6 Sonntag, 9 privilegierte Wochentage, 13 Wochentag. */
  readonly dayRank: number;
  readonly seasonName: string;
  /** An Sonntagen: „III Niedziela Adwentu" … — sonst leer. */
  readonly sundayName: string;
  /** Wie der Tag heisst, auch werktags: „Środa XXX tygodnia zwykłego", „Środa Popielcowa", „17 grudnia". */
  readonly dayName: string;
  readonly special: SpecialDay | null;
}

const ROMAN: readonly [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];

/** 34 → „XXXIV" (0 und weniger: leer). */
export function roman(n: number): string {
  let rest = Math.floor(n);
  if (rest <= 0) return '';
  let out = '';
  for (const [value, sign] of ROMAN) {
    while (rest >= value) { out += sign; rest -= value; }
  }
  return out;
}

/** Montag … Sonntag, wie am Anfang eines Satzes. */
export const WEEKDAY_NAME: Record<Weekday, string> = {
  1: 'Poniedziałek', 2: 'Wtorek', 3: 'Środa', 4: 'Czwartek', 5: 'Piątek', 6: 'Sobota', 7: 'Niedziela'
};

const MONTH_OF = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];

const OCTAVE_DAY = ['', 'Pierwszy', 'Drugi', 'Trzeci', 'Czwarty', 'Piąty', 'Szósty', 'Siódmy', 'Ósmy'];

const infoCache = new Map<string, DayInfo>();

/** Was an einem Tag gerechnet wird. Unabhängig von jedem Ablauf. */
export function dayInfo(date: string): DayInfo {
  const hit = infoCache.get(date);
  if (hit !== undefined) return hit;
  const found = computeDayInfo(date);
  if (infoCache.size > 4000) infoCache.clear();
  infoCache.set(date, found);
  return found;
}

function computeDayInfo(date: string): DayInfo {
  const year = yearOf(date);
  const weekday = weekdayOf(date);
  const sunday = weekday === 7;
  const name = WEEKDAY_NAME[weekday];

  const easterDay = easter(year);
  const fromEaster = diffDays(date, easterDay);
  const ashWednesday = addDays(easterDay, -46);
  const advent1 = adventStart(year);
  const christKing = addDays(advent1, -7);
  const baptism = baptismOfTheLord(year);
  const [, month, day] = parts(date);

  let season: Season;
  let week: number;
  let dayRank: number;
  let sundayName = '';
  let dayName: string;
  let special: SpecialDay | null = null;

  if (diffDays(date, advent1) >= 0 && (month < 12 || day <= 24)) {
    /* Advent. */
    season = 'adwent';
    week = Math.floor(diffDays(date, advent1) / 7) + 1;
    if (sunday) {
      dayRank = 2;
      sundayName = `${roman(week)} Niedziela Adwentu`;
      if (week === 3) special = 'gaudete';
    } else {
      dayRank = month === 12 && day >= 17 ? 9 : 13;
    }
    dayName = sunday ? sundayName : month === 12 && day >= 17 ? `${day} grudnia` : `${name} ${roman(week)} tygodnia Adwentu`;
  } else if ((month === 12 && day >= 25) || diffDays(date, baptism) <= 0) {
    /* Weihnachtszeit: vom 25. Dezember bis zur Taufe des Herrn. */
    season = 'narodzenie';
    week = month === 12 ? 1 : 2;
    const inOctave = (month === 12 && day >= 25) || (month === 1 && day === 1);
    if (sunday) {
      dayRank = 6;
      sundayName = inOctave
        ? 'Niedziela w oktawie Narodzenia Pańskiego'
        : diffDays(date, baptism) === 0 ? 'Niedziela Chrztu Pańskiego'
          : day <= 5 ? 'II Niedziela po Narodzeniu Pańskim' : 'Niedziela okresu Narodzenia Pańskiego';
      dayName = sundayName;
    } else {
      dayRank = inOctave ? 9 : 13;
      if (month === 12) dayName = `${OCTAVE_DAY[day - 24]} dzień w oktawie Narodzenia Pańskiego`;
      else if (day === 1) dayName = 'Ósmy dzień w oktawie Narodzenia Pańskiego';
      else if (day <= 5) dayName = `${day} stycznia`;
      else if (day === 6) dayName = '6 stycznia';
      else dayName = `${name} po Objawieniu Pańskim`;
    }
  } else if (diffDays(date, ashWednesday) < 0) {
    /* Die Zeit im Jahreskreis vor der Fastenzeit: Woche 1 beginnt am Montag nach der Taufe. */
    season = 'zwykly';
    week = Math.floor(diffDays(date, baptism) / 7) + 1;
    dayRank = sunday ? 6 : 13;
    if (sunday) sundayName = `${roman(week)} Niedziela zwykła`;
    dayName = sunday ? sundayName : `${name} ${roman(week)} tygodnia zwykłego`;
  } else if (fromEaster < -3) {
    /* Fastenzeit: Aschermittwoch bis Mittwoch der Karwoche. */
    season = 'post';
    week = fromEaster < -42 ? 0 : Math.floor((fromEaster + 42) / 7) + 1;
    if (sunday) {
      dayRank = 2;
      if (week === 6) { sundayName = 'Niedziela Palmowa Męki Pańskiej'; special = 'palm'; }
      else {
        sundayName = `${roman(week)} Niedziela Wielkiego Postu`;
        if (week === 4) special = 'laetare';
      }
      dayName = sundayName;
    } else if (fromEaster === -46) {
      dayRank = 2;
      dayName = 'Środa Popielcowa';
    } else if (week === 0) {
      dayRank = 9;
      dayName = `${name} po Popielcu`;
    } else if (week === 6) {
      /* Montag bis Mittwoch der Karwoche. */
      dayRank = 2;
      dayName = weekday === 1 ? 'Wielki Poniedziałek' : weekday === 2 ? 'Wielki Wtorek' : 'Wielka Środa';
    } else {
      dayRank = 9;
      dayName = `${name} ${roman(week)} tygodnia Wielkiego Postu`;
    }
  } else if (fromEaster < 0) {
    /* Triduum: Gründonnerstag, Karfreitag, Karsamstag. */
    season = 'triduum';
    week = 6;
    dayRank = 1;
    dayName = fromEaster === -3 ? 'Wielki Czwartek' : fromEaster === -2 ? 'Wielki Piątek' : 'Wielka Sobota';
    if (fromEaster === -2) special = 'goodFriday';
  } else if (fromEaster <= 49) {
    /* Osterzeit: die Oktav ist Woche 1; Pfingsten bleibt in Woche 7. */
    season = 'wielkanoc';
    week = Math.min(7, Math.floor(fromEaster / 7) + 1);
    if (fromEaster === 0) {
      dayRank = 1;
      sundayName = 'Niedziela Zmartwychwstania Pańskiego';
      dayName = sundayName;
    } else if (fromEaster === 49) {
      dayRank = 2;
      sundayName = 'Niedziela Zesłania Ducha Świętego';
      dayName = sundayName;
      special = 'pentecost';
    } else if (sunday) {
      dayRank = 2;
      sundayName = week === 2 ? 'II Niedziela Wielkanocna, czyli Miłosierdzia Bożego' : `${roman(week)} Niedziela Wielkanocna`;
      dayName = sundayName;
    } else if (fromEaster <= 7) {
      dayRank = 2;
      dayName = `${name} w oktawie Wielkanocy`;
    } else {
      dayRank = 13;
      dayName = `${name} ${roman(week)} tygodnia wielkanocnego`;
    }
  } else {
    /* Die Zeit im Jahreskreis nach Pfingsten: rückwärts gezählt, Christkönig beginnt Woche 34. */
    season = 'zwykly';
    week = 34 - Math.floor(diffDays(christKing, sundayOnOrBefore(date)) / 7);
    dayRank = sunday ? 6 : 13;
    if (sunday) sundayName = `${roman(week)} Niedziela zwykła`;
    dayName = sunday ? sundayName : `${name} ${roman(week)} tygodnia zwykłego`;
  }

  return { season, week, sunday, weekday, dayRank, seasonName: SEASON_LABEL[season], sundayName, dayName, special };
}

/** Der Monat im Genitiv — „5 października". */
export const dayAndMonth = (date: string): string => {
  const [, month, day] = parts(date);
  return `${day} ${MONTH_OF[month - 1]}`;
};

/* -- Regeln für ein Datum ------------------------------------------------------------------- */

/** Der n-te (−1: letzte) Wochentag eines Monats — oder nichts (der fünfte gibt es nicht immer). */
function nthWeekday(year: number, month: number, n: number, weekday: Weekday): string | null {
  if (n === -1) {
    const last = addDays(ymd(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1), -1);
    return addDays(last, -((weekdayOf(last) - weekday + 7) % 7));
  }
  const first = ymd(year, month, 1);
  const found = addDays(first, ((weekday - weekdayOf(first) + 7) % 7) + (n - 1) * 7);
  return parts(found)[1] === month ? found : null;
}

/** Alle Tage eines Jahres, an denen die Regel gilt (meist einer; „jeden Monat" zwölf). */
export function datesOf(rule: DateRule, year: number): string[] {
  switch (rule.r) {
    case 'fixed': {
      const date = ymd(year, rule.month, rule.day);
      return isDate(date) ? [date] : [];
    }
    case 'easter':
      return [addDays(easter(year), rule.offset)].filter((d) => yearOf(d) === year);
    case 'advent':
      return [addDays(adventStart(year), rule.offset)].filter((d) => yearOf(d) === year);
    case 'christmas-sunday':
      return [holyFamily(year)];
    case 'baptism':
      return [baptismOfTheLord(year)];
    case 'nth-weekday': {
      const months = rule.month === undefined ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [rule.month];
      return months.map((m) => nthWeekday(year, m, rule.n, rule.weekday)).filter((d): d is string => d !== null);
    }
    case 'sunday-after': {
      const from = ymd(year, rule.month, rule.day);
      return isDate(from) ? [sundayAfter(from)].filter((d) => yearOf(d) === year) : [];
    }
  }
}

/** Gilt die Regel an diesem Tag? */
export function matches(rule: DateRule, date: string): boolean {
  const [year, month, day] = parts(date);
  switch (rule.r) {
    case 'fixed':
      return rule.month === month && rule.day === day;
    case 'nth-weekday':
      if (rule.month !== undefined && rule.month !== month) return false;
      return nthWeekday(year, month, rule.n, rule.weekday) === date;
    default:
      return datesOf(rule, year).includes(date);
  }
}

/** Eine Regel in Worten — für Vorschau und Beschreibung. */
export function describeDateRule(rule: DateRule): string {
  const signed = (n: number, unit: string) => (n === 0 ? unit : `${unit} ${n > 0 ? '+' : '−'}${Math.abs(n)} dni`);
  switch (rule.r) {
    case 'fixed': return `${rule.day} ${MONTH_OF[rule.month - 1] ?? '?'}`;
    case 'easter': return signed(rule.offset, 'Wielkanoc');
    case 'advent': return signed(rule.offset, 'I Niedziela Adwentu');
    case 'christmas-sunday': return 'niedziela w oktawie Narodzenia (albo 30 grudnia)';
    case 'baptism': return 'niedziela po 6 stycznia';
    case 'nth-weekday': {
      const which = rule.n === -1 ? 'ostatni' : `${rule.n}.`;
      const where = rule.month === undefined ? 'każdego miesiąca' : MONTH_OF[rule.month - 1] ?? '?';
      return `${which} ${WEEKDAY_NAME[rule.weekday].toLowerCase()} ${where}`;
    }
    case 'sunday-after': return `pierwsza niedziela po ${rule.day} ${MONTH_OF[rule.month - 1] ?? '?'}`;
  }
}
