/**
 * Zakładanie mszy — jednorazowej albo na cały okres.
 *
 * <b>Msza to wpis kalendarza.</b> Nie ma osobnej tabeli mszy i nie powinno jej
 * być: czas, powtórzenie i wyjątki kalendarz już umie. „W dni powszednie o
 * 18:00" to JEDEN wpis, który daje msze na wszystkie te dni — i każdą z nich
 * można potem osobno przesunąć albo odwołać.
 *
 * <b>Dni tygodnia to maska bitowa.</b> Wartości muszą zgadzać się co do bitu z
 * `RcRecurrence.WeekdayBit` po stronie serwera. Gdyby się rozjechały, msze
 * wypadałyby w inne dni niż wpisane — i nikt by tego nie zobaczył przy
 * zakładaniu, tylko tydzień później, w pustym kościele.
 */

import { rcAddItem, rcCalendars, rcCreateCalendar } from '../lib/rcCalendar';

/** Te same bity co `RcRecurrence.WeekdayBit`. Poniedziałek jest pierwszy. */
export const RC_WEEKDAY_BITS: readonly { readonly bit: number; readonly label: string }[] = [
  { bit: 1, label: 'pn' },
  { bit: 2, label: 'wt' },
  { bit: 4, label: 'śr' },
  { bit: 8, label: 'cz' },
  { bit: 16, label: 'pt' },
  { bit: 32, label: 'sb' },
  { bit: 64, label: 'nd' }
];

/** Dni powszednie — poniedziałek do soboty. */
export const RC_WEEKDAYS_MASK = 1 + 2 + 4 + 8 + 16 + 32;

/** Sama niedziela. */
export const RC_SUNDAY_MASK = 64;

/**
 * Bit dnia, w którym wypada dana data.
 *
 * `Date.getDay()` liczy od niedzieli (0), serwer od poniedziałku (1). Ta
 * różnica jest dokładnie tym rodzajem rzeczy, która działa sześć dni w
 * tygodniu.
 */
export function rcBitOf(date: Date): number {
  const day = date.getDay();
  return day === 0 ? RC_SUNDAY_MASK : 1 << (day - 1);
}

/** Ile trwa msza, jeśli nikt nie powiedział inaczej. */
export const RC_MASS_MINUTES = 45;

/**
 * Kalendarz parafii — istniejący albo nowo założony.
 *
 * Parafia ma jeden kalendarz i nie potrzebuje wyboru. Pytanie „do którego
 * kalendarza wpisać mszę" nie ma dla niej sensu, więc się go nie zadaje.
 */
export async function rcParishCalendar(areaId: string, title: string): Promise<string> {
  const found = await rcCalendars();
  const mine = (found.calendars ?? []).find((c) => c.areaId === areaId);
  if (mine !== undefined) return mine.calendarId;

  const made = await rcCreateCalendar(areaId, title, 'Europe/Warsaw');
  return made.calendarId;
}

export type RcNewMass = {
  /** Dzień pierwszej mszy, „2026-09-08". */
  readonly date: string;
  /** Godzina, „18:00". */
  readonly time: string;
  readonly minutes: number;
  /** Co widać w gablocie. Puste znaczy: sama godzina. */
  readonly titlePublic: string;
  /** `none` dla jednej mszy; `weekly` dla całego okresu. */
  readonly repeat: 'none' | 'weekly' | 'daily';
  /** Maska dni tygodnia przy `weekly`. */
  readonly weekdays: number;
  /** Ostatni dzień okresu, albo puste — bez końca. */
  readonly until: string;
};

/**
 * Założyć mszę.
 *
 * <b>Widoczność publiczna, bo msza jest publiczna.</b> Kalendarz domyślnie
 * zakłada prywatność — słusznie, bo większość wpisów to czyjeś terminy. Msza
 * jest wyjątkiem i musi go zadeklarować wprost, inaczej nie trafi do gabloty.
 *
 * <b>Tytuł idzie do `titlePublic`, nie do zapieczętowanego.</b> „Msza św. z
 * udziałem dzieci" ma stać na afiszu. Zapieczętowany tytuł byłby tu pusty
 * gest: publiczna droga i tak by go nie otworzyła.
 */
export async function rcAddMass(
  calendarId: string, ownerRoleId: string, mass: RcNewMass
): Promise<string> {
  const starts = new Date(`${mass.date}T${mass.time}:00`);
  if (Number.isNaN(starts.getTime())) throw new Error('Nie ma takiej daty albo godziny.');

  const ends = new Date(starts);
  ends.setMinutes(ends.getMinutes() + Math.max(5, mass.minutes));

  /*
   * Przy powtórzeniu tygodniowym bez wybranych dni obowiązuje dzień, w który
   * wypada pierwsza msza. Pusta maska dałaby serię, która nie wypada nigdy —
   * wpis istnieje, a mszy nie ma i nic tego nie tłumaczy.
   */
  const weekdays = mass.repeat === 'weekly'
    ? (mass.weekdays === 0 ? rcBitOf(starts) : mass.weekdays)
    : null;

  const made = await rcAddItem(
    calendarId, ownerRoleId, starts.toISOString(), ends.toISOString(), {
      itemType: 'mass',
      visibility: 'public',
      status: 'confirmed',
      titlePublic: mass.titlePublic.trim() === '' ? undefined : mass.titlePublic.trim(),
      repeatKind: mass.repeat,
      repeatEvery: 1,
      repeatWeekdays: weekdays ?? undefined,
      repeatUntil: mass.until === '' ? undefined : new Date(`${mass.until}T23:59:59`).toISOString()
    });

  return made.itemId;
}

/** Podpis serii, tak jak czyta ją człowiek: „w pn, śr, pt o 18:00 do 24 grudnia". */
export function rcRepeatLabel(mass: RcNewMass): string {
  if (mass.repeat === 'none') return `raz, ${mass.date} o ${mass.time}`;

  const days = mass.repeat === 'daily'
    ? 'codziennie'
    : `w ${RC_WEEKDAY_BITS.filter((d) => (mass.weekdays & d.bit) !== 0)
        .map((d) => d.label).join(', ') || 'dniu pierwszej mszy'}`;

  const till = mass.until === '' ? 'bez końca' : `do ${mass.until}`;
  return `${days} o ${mass.time}, ${till}`;
}
