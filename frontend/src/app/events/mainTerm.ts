/**
 * 0131 — DER HAUPTTERMIN EINES NEUEN WYDARZENIE aus vier Feldern: Beginn (Tag,
 * Uhrzeit) und Ende (Tag, Uhrzeit). Ohne Uhrzeit ganztägig (über alle Tage bis
 * zum Ende); ohne Ende zwei Stunden, mit Endtag ohne Uhrzeit bis zur Uhrzeit des
 * Beginns an jenem Tag. Ortszeit, wie das Formular eines Termins (`EventDraft`).
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

const dayNumber = (s: string): number => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) / 86_400_000;
const minuteOf = (s: string): number => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

export interface MainTerm {
  readonly date: string;
  readonly time: string;
  readonly minutes: number;
  readonly allDay: boolean;
}

/** `null`: kein Beginn — dann entsteht kein Haupttermin. */
export function mainTermOf(input: { date: string; time: string; endDate: string; endTime: string }): MainTerm | null {
  if (!DAY.test(input.date)) return null;
  const end = DAY.test(input.endDate) && input.endDate >= input.date ? input.endDate : input.date;
  const days = dayNumber(end) - dayNumber(input.date);

  if (!TIME.test(input.time)) return { date: input.date, time: '00:00', minutes: (days + 1) * 1440, allDay: true };

  const start = minuteOf(input.time);
  const stop = TIME.test(input.endTime)
    ? days * 1440 + minuteOf(input.endTime)
    : days === 0 ? start + 120 : days * 1440 + start;
  return { date: input.date, time: input.time, minutes: Math.max(15, stop - start), allDay: false };
}

/**
 * Der Vorspann der neuen Seite: wann und wo, in Worten — er steht auf der Karte, auch
 * wenn der Haupttermin selbst (noch) nicht öffentlich ist.
 */
export function leadOf(term: MainTerm | null, place: string): string | null {
  const where = place.trim();
  if (term === null) return where === '' ? null : where;
  const start = new Date(`${term.date}T${term.time}:00`);
  const end = new Date(start.getTime() + term.minutes * 60_000 - (term.allDay ? 1 : 0));
  const day = (d: Date) => d.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  const time = (d: Date) => d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  const sameDay = start.toDateString() === end.toDateString();
  const when = term.allDay
    ? (sameDay ? day(start) : `${day(start)} – ${day(end)}`)
    : (sameDay ? `${day(start)}, ${time(start)}–${time(end)}` : `${day(start)}, ${time(start)} – ${day(end)}, ${time(end)}`);
  return where === '' ? when : `${when} · ${where}`;
}
