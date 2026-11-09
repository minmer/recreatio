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
 *
 * <b>0141 — RAZ W TYGODNIU / RAZ W MIESIĄCU</b> (`week`, `month`): jeder Tag
 * des Zeitraums gilt, aber JEDE Woche (Mo–So) bzw. jeder Monat braucht
 * `needed` getane Tage (sonst einen) — `periodProgress`.
 */

import type { Absence, PresenceAnswer, PresenceState, TaskAnswer, TaskDate, TaskPlan, TaskState } from './steps';
import { appLang, fmtDate, localeOf, t, texts } from '../core/i18n';

export type TaskPhase = 'hidden' | 'upcoming' | 'active' | 'reporting' | 'over';

/** Die Wochentage, wie die Bits sie zählen: pn 1 … ndz 64. */
const weekday = (bit: number, day: string) => ({
  bit,
  get short(): string { return t(`steps.weekday.${day}.short`); },
  get many(): string { return t(`steps.weekday.${day}.many`); }
});
export const WEEKDAYS = [
  weekday(1, 'mon'), weekday(2, 'tue'), weekday(4, 'wed'), weekday(8, 'thu'), weekday(16, 'fri'), weekday(32, 'sat'), weekday(64, 'sun')
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

/* -- 0141: raz w tygodniu / raz w miesiącu ----------------------------------------------------------- */

/** Eine Aufgabe, die JE Woche (`week`) oder JE Monat (`month`) getan sein will. */
export const perPeriod = (plan: Pick<TaskPlan, 'schedule'>): plan is Pick<TaskPlan, 'schedule'> & { schedule: 'week' | 'month' } =>
  plan.schedule === 'week' || plan.schedule === 'month';

/** Eine Woche (ein Monat) des Zeitraums — am Rand nur mit ihren Tagen darin. */
export interface PeriodUnit {
  readonly first: string;
  readonly last: string;
  /** Wie viele Tage sie im Zeitraum hat. */
  readonly length: number;
}

/** Die Wochen (Mo–So) oder Monate des Zeitraums, der Reihe nach. */
export function unitsOf(plan: TaskPlan): PeriodUnit[] {
  if (!perPeriod(plan)) return [];
  const out: { first: string; last: string; length: number }[] = [];
  let key = '';
  for (let day = plan.startsOn; day <= plan.endsOn; day = plusDays(day, 1)) {
    const here = plan.schedule === 'month' ? day.slice(0, 7) : plusDays(day, -((dateOf(day).getDay() + 6) % 7));
    if (here !== key || out.length === 0) { key = here; out.push({ first: day, last: day, length: 0 }); }
    const unit = out[out.length - 1];
    unit.last = day;
    unit.length += 1;
  }
  return out;
}

/** Wie oft es je Woche (Monat) braucht — fehlt die Zahl: einmal. */
export const perUnitOf = (plan: TaskPlan): number => Math.max(1, plan.needed ?? 1);

/**
 * 0141 — WIE WEIT, JE WOCHE (MONAT): eine Woche ist geschafft mit so vielen
 * getanen Tagen, wie verlangt — eine angebrochene am Rand mit höchstens so
 * vielen, wie sie Tage im Zeitraum hat. Vorbei ist eine Woche, wenn ihr letzter
 * Tag vor heute liegt; vorbei und nicht geschafft heisst VERPASST.
 */
export interface PeriodProgress {
  readonly unit: 'week' | 'month';
  /** Wie oft je Woche (Monat). */
  readonly per: number;
  readonly total: number;
  /** Geschafft (auch die laufende, wenn schon genug). */
  readonly done: number;
  /** Schon vorbei. */
  readonly ended: number;
  /** Vorbei und nicht geschafft. */
  readonly missed: number;
  /** Die Woche (der Monat) von heute — `null`: heute liegt nicht im Zeitraum. */
  readonly current: { readonly first: string; readonly last: string; readonly done: number; readonly need: number } | null;
}

export function periodProgress(plan: TaskPlan, state: TaskState | undefined, today: string = isoDay(new Date())): PeriodProgress | null {
  if (!perPeriod(plan)) return null;
  const per = perUnitOf(plan);
  const days = doneDays(plan, state, today);
  let done = 0;
  let ended = 0;
  let missed = 0;
  let current: PeriodProgress['current'] = null;
  const units = unitsOf(plan);
  for (const u of units) {
    const need = Math.min(per, u.length);
    const count = days.filter((d) => d >= u.first && d <= u.last).length;
    const ok = count >= need;
    const over = u.last < today;
    if (ok) done += 1;
    if (over) ended += 1;
    if (over && !ok) missed += 1;
    if (u.first <= today && today <= u.last) current = { first: u.first, last: u.last, done: count, need };
  }
  return { unit: plan.schedule as 'week' | 'month', per, total: units.length, done, ended, missed, current };
}

/**
 * Was der Mensch dazu gesagt hat, wie viele Tage er hat — und ob es reicht (mit Zahl: genug Tage; ohne: eine Antwort).
 *
 * 0141 — JE WOCHE (MONAT): erfüllt, solange keine vorbei ist, ohne geschafft zu sein, und schon eine geschafft
 * ist — die laufende hält es nicht auf (es ist noch Zeit: „na bieżąco"). Nach dem Zeitraum also: jede geschafft.
 * `needed` bleibt dann `null` (gezählt wird je Woche, in `units`).
 */
export function progressOf(plan: TaskPlan, state: TaskState | undefined, today: string = isoDay(new Date())): {
  answer: TaskAnswer | null; done: number; needed: number | null; fulfilled: boolean; units: PeriodProgress | null;
} {
  const done = doneDays(plan, state, today).length;
  const units = periodProgress(plan, state, today);
  if (units !== null) return { answer: state?.answer ?? null, done, needed: null, fulfilled: units.missed === 0 && units.done > 0, units };
  const needed = neededOf(plan);
  return { answer: state?.answer ?? null, done, needed, fulfilled: needed === null ? respondedTo(plan, state, today) : done >= needed, units: null };
}

/** Der nächste Tag, der zählt — heute eingeschlossen; `null`: keiner mehr. */
export function nextDay(plan: TaskPlan, today: string): string | null {
  if (plan.schedule === 'item') return datesOf(plan).find((d) => d.day >= today)?.day ?? null;
  for (let day = today < plan.startsOn ? plan.startsOn : today; day <= plan.endsOn; day = plusDays(day, 1)) if (taskDay(plan, day)) return day;
  return null;
}

/** „3 października" — Tag und Monat in der Sprache der Anwendung. */
export const dayText = (day: string): string => fmtDate(dateOf(day), { day: 'numeric', month: 'long' });

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
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) return t('steps.date.sameMonth', { from: a.getDate(), to: dayText(plan.endsOn) });
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
  const long = plan.minutes === null ? null : plan.minutes >= 60 && plan.minutes % 60 === 0 ? t('steps.time.hours', { count: plan.minutes / 60 }) : t('steps.time.minutes', { count: plan.minutes });
  return at === null && long === null ? null : [at, long].filter((x) => x !== null).join(', ');
}

/** „1 termin", „3 terminy", „12 terminów". */
export const termsText = (n: number): string => t('steps.terms', { count: n });

/** „codziennie", „w piątki", „w poniedziałki i środy", „w dowolnym dniu"; 0099 — „12 terminów". */
export function scheduleWord(plan: TaskPlan): string {
  if (plan.schedule === 'item') {
    const n = datesOf(plan).length;
    return n === 0 ? t('steps.schedule.noDates') : termsText(n);
  }
  if (plan.schedule === 'daily') return t('steps.schedule.daily');
  if (plan.schedule === 'any') return t('steps.schedule.any');
  /* 0141 — „raz w tygodniu", „2 razy w miesiącu". */
  if (plan.schedule === 'week') return t('steps.schedule.perWeek', { count: perUnitOf(plan) });
  if (plan.schedule === 'month') return t('steps.schedule.perMonth', { count: perUnitOf(plan) });
  const days = WEEKDAYS.filter((w) => ((plan.weekdays ?? 0) & w.bit) !== 0).map((w) => w.many);
  return t('steps.schedule.onDays', { days: days.length === 0 ? '—' : new (Intl as unknown as { ListFormat: new (l: string, o: { type: string }) => { format(x: readonly string[]): string } }).ListFormat(localeOf(appLang()), { type: 'conjunction' }).format(days) });
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
    return t('steps.schedule.noDatesChanged');
  }
  return [periodText(plan), scheduleWord(plan), timeText(plan)].filter((x) => x !== null).join(' · ');
}

/** „sobota, 18 października". */
export const longDay = (day: string): string => fmtDate(dateOf(day), { weekday: 'long', day: 'numeric', month: 'long' });

/* -- 0099: zu einem Termin ------------------------------------------------------------------------- */

/** Was der Mensch sagt — in seinen Worten … */
export const PRESENCE_WORD: Record<PresenceAnswer, string> = texts({ yes: 'steps.presence.yes', maybe: 'steps.presence.maybe', no: 'steps.presence.no' });

/** … und wie es die Kanzlei liest. */
export const PRESENCE_THEY: Record<PresenceAnswer, string> = texts({ yes: 'steps.presenceThey.yes', maybe: 'steps.presenceThey.maybe', no: 'steps.presenceThey.no' });

/** Nach dem Termin: da gewesen, nicht da, entschuldigt — oder noch nicht eingetragen. */
export type Attendance = 'present' | Absence | null;

export const ATTENDANCE_WORD: Record<Exclude<Attendance, null>, string> = texts({
  present: 'steps.attendance.present', absent: 'steps.attendance.absent', excused: 'steps.attendance.excused'
});

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
  /* 0141 — je Woche / Monat steht die Zahl schon im Plan („2 razy w tygodniu"). */
  if (perPeriod(plan)) return null;
  const n = neededOf(plan);
  return n === null || n === 1 ? null : t('steps.times', { count: n });
};
