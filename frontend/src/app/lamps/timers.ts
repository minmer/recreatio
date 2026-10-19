/**
 * TIMER (2026-10-18) — zu Uhrzeiten, an gewählten Wochentagen, eine oder mehrere
 * Aktionen (Gerät + Sygnał) nacheinander. Gespeichert wie die Geräte (`lampStore.ts`);
 * ausgeführt vom Telefon, auch bei geschlossener App (`LampTimers.java`).
 *
 * <code>
 *   Timer (versiegelt, im Dienst)  →  timerPlan  →  Plan (im Telefon: Minute, Tage, Ramki)
 *                                                    →  Wecker  →  senden  →  Protokoll
 * </code>
 *
 * Der Plan wird neu abgelegt, wann immer sich Geräte oder Timer auf dem Telefon
 * ändern und beim Start der App (`timerStart.ts`) — ein im Browser geänderter Timer
 * gilt also ab dem nächsten Öffnen der App auf dem Telefon.
 */

import { actionOf, lampTitle, type Lamp, type LampTimer, type LampTimerData } from './lampStore';
import type { LampNative, NativeTimer, TimerStatus } from './native';
import { prepareSignal } from './transmit';

export const DAY_SHORT = ['pn', 'wt', 'śr', 'cz', 'pt', 'so', 'nd'] as const;
export const WORKDAYS: readonly number[] = [1, 2, 3, 4, 5];
export const WEEKEND: readonly number[] = [6, 7];

/** Die Tage als Bits für das Telefon: Montag = Bit 0 … Sonntag = Bit 6; leer = 0 (jeden Tag). */
export const daysMask = (days: readonly number[]): number =>
  days.reduce((mask, d) => (d >= 1 && d <= 7 ? mask | (1 << (d - 1)) : mask), 0);

const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** „codziennie", „pn–pt", „weekend", „pn, śr, pt". */
export function daysText(days: readonly number[]): string {
  const sorted = [...new Set(days)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
  if (sorted.length === 0 || sorted.length === 7) return 'codziennie';
  if (same(sorted, WORKDAYS)) return 'pn–pt';
  if (same(sorted, WEEKEND)) return 'weekend';
  return sorted.map((d) => DAY_SHORT[d - 1]).join(', ');
}

/** Montag = 1 … Sonntag = 7. */
const isoDay = (d: Date): number => ((d.getDay() + 6) % 7) + 1;

/**
 * Wann der Timer das nächste Mal dran ist (Ortszeit) — `null`, wenn er aus ist.
 * Dieselbe Rechnung wie `LampTimers.next` im Telefon.
 */
export function nextRun(timer: Pick<LampTimerData, 'minute' | 'days' | 'enabled'>, now: number): number | null {
  if (!timer.enabled || !Number.isInteger(timer.minute) || timer.minute < 0 || timer.minute >= 1440) return null;
  const today = new Date(now);
  for (let i = 0; i <= 7; i++) {
    const at = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i, Math.floor(timer.minute / 60), timer.minute % 60, 0, 0);
    if (at.getTime() > now && (timer.days.length === 0 || timer.days.includes(isoDay(at)))) return at.getTime();
  }
  return null;
}

const two = (n: number) => String(n).padStart(2, '0');

/** „dziś 07:00", „jutro 22:30", „śr 07:00". */
export function whenText(at: number, now: number): string {
  const d = new Date(at);
  const clock = `${two(d.getHours())}:${two(d.getMinutes())}`;
  const start = new Date(now);
  const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    - new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()) / 86_400_000);
  if (days === 0) return `dziś ${clock}`;
  if (days === 1) return `jutro ${clock}`;
  if (days > 1 && days < 7) return `${DAY_SHORT[isoDay(d) - 1]} ${clock}`;
  return `${two(d.getDate())}.${two(d.getMonth() + 1)} ${clock}`;
}

/** „18.10 07:00" — wann ein Timer lief. */
export function stampText(at: number): string {
  const d = new Date(at);
  return `${two(d.getDate())}.${two(d.getMonth() + 1)} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** Was der Timer tut, kurz: „Sypialnia: Włącz, Salon: Ciepłe". */
export function actionsText(timer: LampTimerData, lamps: readonly Lamp[]): string {
  return timer.actions.map((a) => {
    const found = actionOf(lamps, a);
    return found === null ? '(usunięty sygnał)' : `${lampTitle(found.lamp)}: ${found.signal.label}`;
  }).join(', ');
}

export interface Plan {
  readonly timers: NativeTimer[];
  /** Was nicht in den Plan kam, und warum. */
  readonly problems: string[];
}

/**
 * Die Timer → der Plan für das Telefon: nur eingeschaltete, je Aktion die Ramki
 * ihres Sygnał (wie beim Drücken, `prepareSignal`) — im Tempo DES TIMERS (seine
 * eigenen Regler; die Pause steht auch zwischen den Aktionen). Die Regler der Knöpfe
 * gelten hier nicht. Was nicht gesendet werden kann (gelöschtes Gerät, kaputtes
 * Paket), bleibt draussen und wird genannt.
 */
export function timerPlan(lamps: readonly Lamp[], timers: readonly LampTimer[]): Plan {
  const out: NativeTimer[] = [];
  const problems: string[] = [];
  for (const t of timers) {
    if (!t.enabled || t.minute < 0 || t.minute >= 1440) continue;
    const name = t.name.trim() || `Timer ${two(Math.floor(t.minute / 60))}:${two(t.minute % 60)}`;
    const actions: NativeTimer['actions'][number][] = [];
    t.actions.forEach((a, i) => {
      const found = actionOf(lamps, a);
      if (found === null) { problems.push(`${name}, akcja ${i + 1}: tego urządzenia albo sygnału już nie ma.`); return; }
      const prepared = prepareSignal(found.signal, t.pace);
      if (prepared.problem !== null) { problems.push(`${name}, ${found.signal.label}: ${prepared.problem}`); return; }
      actions.push({ label: `${lampTitle(found.lamp)}: ${found.signal.label}`, frames: prepared.frames });
    });
    if (actions.length > 0) out.push({ id: t.id, name, minute: t.minute, days: daysMask(t.days), pauseMs: t.pace.pauseMs, actions });
  }
  return { timers: out, problems };
}

/**
 * Den Plan im Telefon ablegen. `enable`: auf diesem Telefon ein-/ausschalten; ohne
 * Angabe bleibt es, wie es ist — nur der erste Timer, der hier gespeichert wird,
 * schaltet ein Telefon ein, das sich noch nie entschieden hat (`firstTimer`).
 */
export async function syncTimers(
  radio: LampNative, lamps: readonly Lamp[], timers: readonly LampTimer[],
  options: { enable?: boolean; firstTimer?: boolean } = {}
): Promise<{ status: TimerStatus; problems: string[] }> {
  const plan = timerPlan(lamps, timers);
  let enable = options.enable;
  if (enable === undefined && options.firstTimer === true && !(await radio.timerStatus()).decided) enable = true;
  const status = await radio.setTimers(enable === undefined ? { timers: plan.timers } : { timers: plan.timers, enable });
  return { status, problems: plan.problems };
}
