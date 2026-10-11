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
 */

import type { TaskAnswer, TaskPlan, TaskState } from './steps';

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

export const ANSWER_WORD: Record<TaskAnswer, string> = {
  accepted: 'przyjęte',
  passed: 'pominięte',
  refused: 'odmówione'
};

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

/** Gilt dieser Tag für den Plan? */
export const taskDay = (plan: TaskPlan, day: string): boolean =>
  day >= plan.startsOn && day <= plan.endsOn && (plan.schedule !== 'weekly' || ((plan.weekdays ?? 0) & weekdayBit(day)) !== 0);

/** Alle Tage des Plans — bis `until` (einschliesslich), wenn genannt. */
export function taskDays(plan: TaskPlan, until?: string): string[] {
  const out: string[] = [];
  const last = until !== undefined && until < plan.endsOn ? until : plan.endsOn;
  for (let day = plan.startsOn; day <= last; day = plusDays(day, 1)) if (taskDay(plan, day)) out.push(day);
  return out;
}

/** Bis wann eingetragen werden kann — ohne Angabe eine Woche nach dem Ende (wie der Dienst). */
export const reportsUntil = (plan: TaskPlan): string => plan.reportUntil ?? plusDays(plan.endsOn, 7);

export function phaseOf(plan: TaskPlan, today: string): TaskPhase {
  if (today < (plan.showFrom ?? plan.startsOn)) return 'hidden';
  if (today < plan.startsOn) return 'upcoming';
  if (today <= plan.endsOn) return 'active';
  if (today <= reportsUntil(plan)) return 'reporting';
  return 'over';
}

/** Wie viele Tage es braucht. */
export const neededOf = (plan: TaskPlan): number => Math.max(1, plan.needed ?? 1);

/** Was der Mensch dazu gesagt hat, wie viele Tage er hat — und ob es reicht. */
export function progressOf(plan: TaskPlan, state: TaskState | undefined): {
  answer: TaskAnswer | null; done: number; needed: number; fulfilled: boolean;
} {
  const done = (state?.days ?? []).filter((day) => taskDay(plan, day)).length;
  const needed = neededOf(plan);
  return { answer: state?.answer ?? null, done, needed, fulfilled: done >= needed };
}

/** Der nächste Tag, der zählt — heute eingeschlossen; `null`: keiner mehr. */
export function nextDay(plan: TaskPlan, today: string): string | null {
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

/** „18:00, 30 min" — was man nachschlägt, um hinzugehen. */
export function timeText(plan: TaskPlan): string | null {
  const at = plan.atMinute === null ? null : `${Math.floor(plan.atMinute / 60)}:${String(plan.atMinute % 60).padStart(2, '0')}`;
  const long = plan.minutes === null ? null : plan.minutes >= 60 && plan.minutes % 60 === 0 ? `${plan.minutes / 60} godz.` : `${plan.minutes} min`;
  return at === null && long === null ? null : [at, long].filter((x) => x !== null).join(', ');
}

/** „codziennie", „w piątki", „w poniedziałki i środy", „w dowolnym dniu". */
export function scheduleWord(plan: TaskPlan): string {
  if (plan.schedule === 'daily') return 'codziennie';
  if (plan.schedule === 'any') return 'w dowolnym dniu';
  const days = WEEKDAYS.filter((w) => ((plan.weekdays ?? 0) & w.bit) !== 0).map((w) => w.many);
  return days.length <= 1 ? `w ${days[0] ?? '—'}` : `w ${days.slice(0, -1).join(', ')} i ${days[days.length - 1]}`;
}

/** Die ganze Zeile: „1–31 października · codziennie · 18:00, 30 min". */
export const planText = (plan: TaskPlan): string =>
  [periodText(plan), scheduleWord(plan), timeText(plan)].filter((x) => x !== null).join(' · ');

/** Wie viel es braucht, in Worten — „5 razy", oder nichts bei einmal. */
export const neededText = (plan: TaskPlan): string | null => {
  const n = neededOf(plan);
  return n === 1 ? null : `${n} razy`;
};
