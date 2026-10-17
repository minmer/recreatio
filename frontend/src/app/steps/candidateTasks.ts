/**
 * ZADANIA DLA OSÓB (0098) — die Rechnung, bei der Kanzlei und beim Menschen dieselbe.
 *
 * Eine Aufgabe steht eine Zeit lang da: „W październiku różaniec w kościele,
 * codziennie o 18:00", „Różaniec po angielsku — piątki października",
 * „Obejrzyj film (do końca miesiąca)". Der Mensch sagt przyjmuję, pomijam oder
 * odmawiam, und er trägt die Tage ein, an denen er es getan hat. Erfüllt ist
 * sie mit so vielen Tagen, wie sie verlangt (`needed`, sonst einer).
 *
 * <code>
 *   hidden     vor „widoczne od" — der Mensch sieht sie noch nicht
 *   upcoming   sichtbar, der Zeitraum hat noch nicht begonnen (schon annehmen)
 *   active     im Zeitraum
 *   reporting  vorbei, aber Tage lassen sich noch eintragen (bis report_until)
 *   over       vorbei — eintragen nur noch über die Kanzlei
 * </code>
 *
 * Alles hier rechnet mit Tagen als `YYYY-MM-DD` in der Zeit des Geräts — wie
 * der Dienst in der Zeit der Pfarrei; für Menschen in Polen dasselbe.
 *
 * <b>0099 — ZAPROSZENIA:</b> eine Aufgabe an den TERMINEN eines Kalenders
 * (`schedule: 'item'`). Ihre Tage sind die Termine (`plan.dates`, vom Dienst
 * aus dem Kalender gerechnet). Mit `presence` sagt der Mensch VOR jedem
 * Termin będę / jeszcze nie wiem / nie będę und wählt eine Funktion darin;
 * danach steht, ob er da war (ein Tag in `days`) oder nicht (`absence`).
 */

import type { Absence, PresenceAnswer, PresenceState, TaskAnswer, TaskDate, TaskPlan, TaskState } from './steps';
import { plural } from '../core/plural';

export type TaskPhase = 'hidden' | 'upcoming' | 'active' | 'reporting' | 'over';

/** Die Wochentage, wie die Bits sie zählen: pn 1 … ndz 64. */
export const WEEKDAYS = [
  { bit: 1, short: 'pn', many: 'poniedziałki' },
  { bit: 2, short: 'wt', many: 'wtorki' },
  { bit: 4, short: 'śr', many: 'środy' },
  { bit: 8, short: 'czw', many: 'czwartki' },
  { bit: 16, short: 'pt', many: 'piątki' },
  { bit: 32, short: 'sob', many: 'soboty' },
  { bit: 64, short: 'ndz', many: 'niedziele' }
] as const;

/** Ein Tag als `YYYY-MM-DD` — in der Zeit des Geräts. */
export const isoDay = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Mittags, damit keine Zeitumstellung den Tag verschiebt. */
export const dateOf = (day: string): Date => new Date(`${day}T12:00:00`);

const plusDays = (day: string, n: number): string => {
  const d = dateOf(day);
  d.setDate(d.getDate() + n);
  return isoDay(d);
};

/** Das Bit des Wochentags (pn 1 … ndz 64). */
export const weekdayBit = (day: string): number => 1 << ((dateOf(day).getDay() + 6) % 7);

/** 0099 — die Termine im Zeitraum (bei einer Aufgabe ohne Termine: keine). */
export const datesOf = (plan: TaskPlan): readonly TaskDate[] =>
  plan.schedule !== 'item' ? [] : (plan.dates ?? []).filter((d) => d.day >= plan.startsOn && d.day <= plan.endsOn);

/** Gilt dieser Tag für den Plan? */
export const taskDay = (plan: TaskPlan, day: string): boolean =>
  day >= plan.startsOn && day <= plan.endsOn && (plan.schedule !== 'weekly' || ((plan.weekdays ?? 0) & weekdayBit(day)) !== 0)
  && (plan.schedule !== 'item' || datesOf(plan).some((d) => d.day === day));

/** Alle Tage des Plans — bis `until` (einschliesslich), wenn genannt. */
export function taskDays(plan: TaskPlan, until?: string): string[] {
  const last = until !== undefined && until < plan.endsOn ? until : plan.endsOn;
  if (plan.schedule === 'item') return datesOf(plan).map((d) => d.day).filter((day) => day <= last);
  const out: string[] = [];
  for (let day = plan.startsOn; day <= last; day = plusDays(day, 1)) if (taskDay(plan, day)) out.push(day);
  return out;
}

/** Bis wann eingetragen werden kann — ohne Angabe eine Woche nach dem Ende (wie der Dienst). */
export const reportsUntil = (plan: TaskPlan): string => plan.reportUntil ?? plusDays(plan.endsOn, 7);

export function phaseOf(plan: TaskPlan, today: string): TaskPhase {
  /* 0099 — eine EINLADUNG steht gleich da (ohne „widoczne od"): man sagt vorher, ob man kommt. */
  if (plan.showFrom != null ? today < plan.showFrom : plan.schedule !== 'item' && today < plan.startsOn) return 'hidden';
  if (today < plan.startsOn) return 'upcoming';
  if (today <= plan.endsOn) return 'active';
  if (today <= reportsUntil(plan)) return 'reporting';
  return 'over';
}

/**
 * Wie viele Tage es braucht — `null`: keine Zahl. Dann ist die Aufgabe
 * erledigt, sobald der Mensch sich dazu GESTELLT hat (`respondedTo`): darum
 * geht es meist (Wunsch der Kanzlei, 2026-10-11) — nicht, wie oft er da war.
 */
export const neededOf = (plan: TaskPlan): number | null => (plan.needed == null ? null : Math.max(1, plan.needed));

/**
 * HAT ER SICH DAZU GESTELLT? Ohne Fragen vorher: przyjmuję, pomijam oder
 * odmawiam (oder schon Tage eingetragen). Mit Fragen vor den Terminen: zu
 * JEDEM Termin będę oder nie będę („jeszcze nie wiem" ist noch keine
 * Antwort) — oder es steht schon fest, ob er da war.
 */
export function respondedTo(plan: TaskPlan, state: TaskState | undefined, today: string = isoDay(new Date())): boolean {
  const settled = (day: string) => {
    if ((state?.days ?? []).includes(day)) return true;
    const said = presenceOn(state, day);
    return said?.answer === 'yes' || said?.answer === 'no' || said?.absence != null;
  };
  if (plan.presence === true) {
    const dates = datesOf(plan);
    return dates.length > 0 && dates.every((d) => settled(d.day));
  }

  /*
   * 0100/0101 — JE TAG IM KALENDER: erfüllt (und grün) ist, wer zu JEDEM Tag
   * bis heute tak oder nie gesagt hat. Kommende Tage halten es nicht auf —
   * sonst wäre ein Sonntag im Juni schon im Oktober fällig. Vor dem ersten Tag
   * ist noch nichts erfüllt. Die Entscheidung für das Ganze (0098) zählt nicht
   * mehr: sie wird nicht mehr angeboten, und sie stand neben „czeka na
   * odpowiedź" im selben Kasten.
   *
   * „Raz, w dowolnym dniu" (`any`): EIN Tag, an dem tak oder nie steht, genügt.
   */
  const all = taskDays(plan);
  if (plan.schedule === 'any') return all.some(settled);
  const past = all.filter((day) => day <= today);
  return past.length > 0 && past.every(settled);
}

/**
 * 0100 — DIE GETANEN TAGE: was eingetragen ist (`days`), und ein „tak" an einem
 * Tag, der vorbei ist. Bei Terminen mit Fragen vorher nur die Liste — dort
 * heisst „tak" „będę", nicht „byłem".
 */
export function doneDays(plan: TaskPlan, state: TaskState | undefined, today: string = isoDay(new Date())): string[] {
  const days = new Set((state?.days ?? []).filter((day) => taskDay(plan, day)));
  if (plan.presence !== true) {
    for (const p of state?.presence ?? []) if (p.answer === 'yes' && p.day <= today && taskDay(plan, p.day)) days.add(p.day);
  }
  return [...days].sort();
}

/** Was der Mensch dazu gesagt hat, wie viele Tage er hat — und ob es reicht (mit Zahl: genug Tage; ohne: eine Antwort). */
export function progressOf(plan: TaskPlan, state: TaskState | undefined): {
  answer: TaskAnswer | null; done: number; needed: number | null; fulfilled: boolean;
} {
  const done = doneDays(plan, state).length;
  const needed = neededOf(plan);
  return { answer: state?.answer ?? null, done, needed, fulfilled: needed === null ? respondedTo(plan, state) : done >= needed };
}

/** Der nächste Tag, der zählt — heute eingeschlossen; `null`: keiner mehr. */
export function nextDay(plan: TaskPlan, today: string): string | null {
  if (plan.schedule === 'item') return datesOf(plan).find((d) => d.day >= today)?.day ?? null;
  for (let day = today < plan.startsOn ? plan.startsOn : today; day <= plan.endsOn; day = plusDays(day, 1)) if (taskDay(plan, day)) return day;
  return null;
}

const months = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];

/** „3 października". */
export const dayText = (day: string): string => {
  const d = dateOf(day);
  return `${d.getDate()} ${months[d.getMonth()]}`;
};

/** „pt 17.10" — für die Knöpfe der Tage. */
export const chipText = (day: string): string => {
  const d = dateOf(day);
  return `${WEEKDAYS[(d.getDay() + 6) % 7].short} ${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** „1–31 października", „28 września – 4 października". */
export function periodText(plan: TaskPlan): string {
  const a = dateOf(plan.startsOn);
  const b = dateOf(plan.endsOn);
  if (plan.startsOn === plan.endsOn) return dayText(plan.startsOn);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${months[b.getMonth()]}`;
  return `${dayText(plan.startsOn)} – ${dayText(plan.endsOn)}`;
}

/** 0099 — „18:00" eines Termins (in der Zeit des Geräts). */
export const clockOf = (at: string): string => {
  const d = new Date(at);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** 0099 — „18:00–19:30" eines Termins. */
export const hoursOf = (date: TaskDate): string => `${clockOf(date.startsAt)}–${clockOf(date.endsAt)}`;

/** „18:00, 30 min" — was man nachschlägt, um hinzugehen. 0099 — bei Terminen: ihre Stunde, wenn alle dieselbe haben. */
export function timeText(plan: TaskPlan): string | null {
  if (plan.schedule === 'item') {
    const dates = datesOf(plan);
    if (dates.length === 0) return null;
    const hours = new Set(dates.map(hoursOf));
    return hours.size === 1 ? hoursOf(dates[0]) : null;
  }
  const at = plan.atMinute === null ? null : `${Math.floor(plan.atMinute / 60)}:${String(plan.atMinute % 60).padStart(2, '0')}`;
  const long = plan.minutes === null ? null : plan.minutes >= 60 && plan.minutes % 60 === 0 ? `${plan.minutes / 60} godz.` : `${plan.minutes} min`;
  return at === null && long === null ? null : [at, long].filter((x) => x !== null).join(', ');
}

/** „1 termin", „3 terminy", „12 terminów". */
export const termsText = (n: number): string =>
  `${n} ${plural(n, 'termin', 'terminy', 'terminów')}`;

/** „codziennie", „w piątki", „w poniedziałki i środy", „w dowolnym dniu"; 0099 — „12 terminów". */
export function scheduleWord(plan: TaskPlan): string {
  if (plan.schedule === 'item') {
    const n = datesOf(plan).length;
    return n === 0 ? 'brak terminów w tym okresie' : termsText(n);
  }
  if (plan.schedule === 'daily') return 'codziennie';
  if (plan.schedule === 'any') return 'w dowolnym dniu';
  const days = WEEKDAYS.filter((w) => ((plan.weekdays ?? 0) & w.bit) !== 0).map((w) => w.many);
  return days.length <= 1 ? `w ${days[0] ?? '—'}` : `w ${days.slice(0, -1).join(', ')} i ${days[days.length - 1]}`;
}

/**
 * Die ganze Zeile: „1–31 października · codziennie · 18:00, 30 min". 0099 —
 * ein Termin: „sobota, 18 października · 10:00–12:00"; mehrere: „12 terminów ·
 * 5 października – 21 grudnia · 19:00–20:30".
 */
export function planText(plan: TaskPlan): string {
  if (plan.schedule === 'item') {
    const dates = datesOf(plan);
    if (dates.length === 1) return `${longDay(dates[0].day)} · ${hoursOf(dates[0])}`;
    if (dates.length > 1) {
      const span = periodText({ ...plan, startsOn: dates[0].day, endsOn: dates[dates.length - 1].day });
      return [termsText(dates.length), span, timeText(plan)].filter((x) => x !== null).join(' · ');
    }
    return 'brak terminów w tym okresie (termin zmieniony albo usunięty z kalendarza)';
  }
  return [periodText(plan), scheduleWord(plan), timeText(plan)].filter((x) => x !== null).join(' · ');
}

const DAY_NAMES = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];

/** „sobota, 18 października". */
export const longDay = (day: string): string => `${DAY_NAMES[dateOf(day).getDay()]}, ${dayText(day)}`;

/* -- 0099: zu einem Termin ------------------------------------------------------------------------- */

/** Was der Mensch sagt — in seinen Worten … */
export const PRESENCE_WORD: Record<PresenceAnswer, string> = { yes: 'będę', maybe: 'jeszcze nie wiem', no: 'nie będę' };

/** … und wie es die Kanzlei liest. */
export const PRESENCE_THEY: Record<PresenceAnswer, string> = { yes: 'będzie', maybe: 'nie wie', no: 'nie będzie' };

/** Nach dem Termin: da gewesen, nicht da, entschuldigt — oder noch nicht eingetragen. */
export type Attendance = 'present' | Absence | null;

export const ATTENDANCE_WORD: Record<Exclude<Attendance, null>, string> = {
  present: 'obecność', absent: 'nieobecność', excused: 'nieobecność usprawiedliwiona'
};

/** Was jemand zu diesem Termin gesagt hat. */
export const presenceOn = (state: TaskState | undefined, day: string): PresenceState | undefined =>
  state?.presence?.find((p) => p.day === day);

/** Da gewesen (ein Tag in `days`), nicht da (`absence`), oder nichts eingetragen. */
export const attendanceOn = (state: TaskState | undefined, day: string): Attendance =>
  (state?.days ?? []).includes(day) ? 'present' : presenceOn(state, day)?.absence ?? null;

/**
 * Hat er zu JEDEM Termin abgesagt (oder fehlte entschuldigt)? Dann ist die
 * Aufgabe nicht überfällig — er hat es gesagt. Ohne Fragen vorher: nie.
 */
export function declinedAll(plan: TaskPlan, state: TaskState | undefined): boolean {
  /* 0100 — für jede Aufgabe: zu jedem ihrer Tage „nie" (oder entschuldigt gefehlt). */
  const days = taskDays(plan);
  return days.length > 0 && days.every((day) => {
    if ((state?.days ?? []).includes(day)) return false;
    const said = presenceOn(state, day);
    return said?.answer === 'no' || said?.absence === 'excused';
  });
}

/** Wie viele eine Funktion an einem Termin schon nehmen — und ob noch Platz ist. */
export function dutyRoom(capacity: number | null, taken: number): { readonly free: number | null; readonly full: boolean } {
  if (capacity === null) return { free: null, full: false };
  const free = Math.max(0, capacity - taken);
  return { free, full: free === 0 };
}

/** Bis wann der Mensch selbst antwortet: bis der Termin beginnt. */
export const answerOpen = (date: TaskDate, now: Date = new Date()): boolean => new Date(date.startsAt) > now;

/** Wie viel es braucht, in Worten — „5 razy", oder nichts (einmal, oder: es zählt die Antwort). */
export const neededText = (plan: TaskPlan): string | null => {
  const n = neededOf(plan);
  return n === null || n === 1 ? null : `${n} razy`;
};
