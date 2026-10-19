/**
 * MEHRERE TERMINE ZUGLEICH (2026-10-17) — zaznaczyć, wyciąć, skopiować,
 * wkleić, usunąć.
 *
 * <b>Wählen</b> (`usePickGestures.ts`): mit der Maus ein Rechteck über die
 * Termine ziehen (Lasso, mit Strg/Umschalt dazu), mit dem Finger lange auf
 * einen Termin drücken (dann tippen, oder weiterziehen: Lasso) — oder Strg +
 * Klick. Solange etwas gewählt ist, wählt ein Klick auf einen Termin, statt
 * ihn zu öffnen; ein Klick ins Leere hebt die Auswahl auf.
 *
 * <b>Verschieben und kopieren</b>: „Wytnij" / „Kopiuj" (Strg+X / Strg+C)
 * legen die Termine in den Schoss des Kalenders; ein Klick auf einen Tag (der
 * Kopf eines Tages, eine Zelle im Monat) oder auf eine Stunde legt sie dort
 * hin (Strg+V: in der Tagesansicht auf diesen Tag). Mit der Maus geht es auch
 * direkt: gewählte Termine ziehen und fallen lassen (mit Strg/Alt: Kopie).
 * Wie beim Einfügen gilt (`plan`): der früheste Termin landet am Ziel, die
 * anderen behalten ihren Abstand zu ihm; auf einem Tag (ohne Stunde) bleiben
 * die Uhrzeiten. Punkte des Programms gehen mit ihrem Ganzen mit
 * (`withParts`). Jedes Verschieben und Kopieren lässt sich zurücknehmen
 * („Cofnij" in der Meldung).
 *
 * <b>Wie verschoben wird</b> (`moveTo`): ein einzelner Termin wird neu
 * gespeichert (wie im Editor — Reservierungen, Anwesenheit und Intentionen
 * wandern mit); ein Vorkommen einer Reihe (oder ein schon verlegter Termin)
 * bekommt eine Ausnahme, und die Reihe bleibt. Eine Kopie ist ein neuer,
 * einzelner Termin mit allem, was der alte hatte — ein Punkt bleibt Punkt
 * seines Ganzen, wenn er in dessen Zeit landet.
 *
 * <b>Löschen</b>: „Usuń tylko te" (ein Vorkommen einer Reihe wird abgesagt,
 * ein einzelner Termin gelöscht), „Te i następne" (`endSeriesBefore`),
 * „Całe serie" — und „Przesuń" um einen Tag, eine Woche, eine Stunde.
 *
 * <b>Um einen eigenen Zeitraum</b> (2026-10-20, `Period`): wie viele Minuten,
 * Stunden, Tage, Wochen oder Monate, früher oder später — verschoben oder als
 * Kopie, mit den Punkten des Programms, zurücknehmbar wie das Einfügen. Tage,
 * Wochen und Monate sind Kalendertage: die Uhrzeit bleibt, auch über die
 * Zeitumstellung; Ganztägiges rückt nur um ganze Tage.
 *
 * Wählbar ist nur, was ich ändern darf (eigene Art, Schreibrecht). Lehnt der
 * Dienst einen ab (eine Messe mit Intentionen), laufen die übrigen weiter und
 * es wird gesagt, wie viele nicht gingen.
 */

import { useState } from 'react';

import { localDate, localTime } from '../areas/WhoSees';
import { monthOfName, startOfDay, WEEK_HEADS } from '../core/dayMath';
import type { Ring } from '../core/keys';
import type { Me } from '../core/me';
import { WorkspaceError } from '../core/session';
import { askText, toast } from '../ui/dialogs';
import { MenuButton } from '../ui/Menu';
import { Segment } from '../ui/Segment';
import { cancelOne, deleteEvent, draftOf, endSeriesBefore, moveOne, repeats, restoreOne, saveEvent, type OpenedItem } from './agenda';
import { setPeople } from './calendar';
import type { CalEvent } from './calendarModel';

/** Darf dieser Termin mit anderen zusammen geändert werden? */
export const pickable = (event: CalEvent): boolean => (event.source === 'item' || event.source === 'offer') && event.item?.editable === true;

/** Was im Schoss liegt: zum Verschieben (`cut`) oder zum Kopieren. */
export interface Clip {
  readonly mode: 'cut' | 'copy';
  readonly events: readonly CalEvent[];
}

/** Wohin eingefügt wird: ein Tag — und, wenn auf eine Stunde geklickt wurde, die Zeit. */
export interface PasteAt {
  readonly day: Date;
  readonly at?: Date;
}

type Undo = () => Promise<unknown>;

const DAY = 86400_000;
const HOUR = 3600_000;

/** „3 terminy", „1 termin", „5 terminów". */
export function terms(n: number): string {
  if (n === 1) return '1 termin';
  const last = n % 10;
  const teen = n % 100 >= 12 && n % 100 <= 14;
  return `${n} ${last >= 2 && last <= 4 && !teen ? 'terminy' : 'terminów'}`;
}

function series(n: number): string {
  if (n === 1) return '1 serię';
  const last = n % 10;
  const teen = n % 100 >= 12 && n % 100 <= 14;
  return `${n} ${last >= 2 && last <= 4 && !teen ? 'serie' : 'serii'}`;
}

/** Ganze Kalendertage weiter, dieselbe Uhrzeit (auch über die Zeitumstellung). */
const shiftDays = (at: Date, days: number): Date =>
  new Date(at.getFullYear(), at.getMonth(), at.getDate() + days, at.getHours(), at.getMinutes(), at.getSeconds());

const dayDiff = (from: Date, to: Date): number => Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY);

/* -- 2026-10-20: um einen Zeitraum ------------------------------------------------------- */

export const PERIOD_UNITS = ['minute', 'hour', 'day', 'week', 'month'] as const;
export type PeriodUnit = (typeof PERIOD_UNITS)[number];

/** Um wie viel: `amount` mit Vorzeichen (weniger als null — früher). */
export interface Period {
  readonly amount: number;
  readonly unit: PeriodUnit;
}

/** Ganze Monate weiter, derselbe Tag (am Monatsende der letzte), dieselbe Uhrzeit. */
const shiftMonths = (at: Date, months: number): Date => {
  const first = new Date(at.getFullYear(), at.getMonth() + months, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(at.getDate(), last), at.getHours(), at.getMinutes(), at.getSeconds());
};

/** Tage, Wochen, Monate: ganze Kalendertage (die Uhrzeit bleibt); Minuten und Stunden: die Zeit selbst. */
export function shiftBy(at: Date, period: Period): Date {
  switch (period.unit) {
    case 'minute': return new Date(at.getTime() + period.amount * 60_000);
    case 'hour': return new Date(at.getTime() + period.amount * HOUR);
    case 'day': return shiftDays(at, period.amount);
    case 'week': return shiftDays(at, 7 * period.amount);
    case 'month': return shiftMonths(at, period.amount);
  }
}

/** Ganztägiges rückt nur um ganze Tage. */
export const wholeDays = (unit: PeriodUnit): boolean => unit === 'day' || unit === 'week' || unit === 'month';

/** Das Wort nach „o": 1 godzinę, 2 godziny, 5 godzin … */
export function unitWord(unit: PeriodUnit, n: number): string {
  const few = n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14);
  switch (unit) {
    case 'minute': return n === 1 ? 'minutę' : few ? 'minuty' : 'minut';
    case 'hour': return n === 1 ? 'godzinę' : few ? 'godziny' : 'godzin';
    case 'day': return n === 1 ? 'dzień' : 'dni';
    case 'week': return n === 1 ? 'tydzień' : few ? 'tygodnie' : 'tygodni';
    case 'month': return n === 1 ? 'miesiąc' : few ? 'miesiące' : 'miesięcy';
  }
}

/** „o 2 godziny później", „o tydzień wcześniej". */
export function periodText(period: Period): string {
  const n = Math.abs(period.amount);
  return `o ${n === 1 ? '' : `${n} `}${unitWord(period.unit, n)} ${period.amount < 0 ? 'wcześniej' : 'później'}`;
}

/** Jeder um denselben Zeitraum — Ganztägiges nur um ganze Tage (die übrigen bleiben, wo sie sind). */
export function planShift(events: readonly CalEvent[], period: Period): { placed: { event: CalEvent; start: Date }[]; skipped: number } {
  const moving = events.filter((e) => wholeDays(period.unit) || !e.allDay);
  return { placed: moving.map((event) => ({ event, start: shiftBy(event.start, period) })), skipped: events.length - moving.length };
}

const isPeriod = (target: PasteAt | Period): target is Period => 'unit' in target;

/** „pn 19 paź, 10:00" — wo ein Termin beginnt, kurz. */
const whenShort = (at: Date, allDay: boolean): string =>
  `${WEEK_HEADS[(at.getDay() + 6) % 7]} ${at.getDate()} ${monthOfName(at).slice(0, 3)}${allDay ? '' : `, ${at.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`}`;

/**
 * Die Punkte des Programms gehen mit: zu jedem Termin die Punkte (beliebig
 * tief), die in SEINER Zeit liegen — bei einer Reihe die dieses Vorkommens.
 */
export function withParts(events: readonly CalEvent[], all: readonly CalEvent[]): CalEvent[] {
  const out = new Map(events.map((e) => [e.key, e]));
  for (let depth = 0; depth < 8; depth++) {
    let added = false;
    for (const parent of [...out.values()]) {
      const id = parent.item?.occurrence.itemId;
      if (id === undefined) continue;
      for (const e of all) {
        if (out.has(e.key) || !pickable(e) || e.item?.occurrence.parentItemId !== id) continue;
        const within = parent.allDay
          ? e.start >= startOfDay(parent.start) && e.start < parent.end
          : e.start >= parent.start && e.start <= parent.end;
        if (within) { out.set(e.key, e); added = true; }
      }
    }
    if (!added) break;
  }
  return [...out.values()];
}

/**
 * Wohin jeder Termin kommt: der früheste landet am Ziel (auf einer Stunde:
 * um diese Zeit; auf einem Tag: um seine eigene), die anderen behalten ihren
 * Abstand — Ganztägiges rückt nur um Tage.
 */
export function plan(events: readonly CalEvent[], target: PasteAt): { event: CalEvent; start: Date }[] {
  if (events.length === 0) return [];
  const earliest = (list: readonly CalEvent[]) => list.reduce((a, b) => (b.start < a.start ? b : a));
  const timed = events.filter((e) => !e.allDay);
  const anchor = target.at !== undefined && timed.length > 0 ? earliest(timed) : earliest(events);
  const days = dayDiff(anchor.start, target.day);
  const shift = target.at !== undefined && !anchor.allDay ? target.at.getTime() - shiftDays(anchor.start, days).getTime() : 0;
  return events.map((event) => ({
    event,
    start: event.allDay ? shiftDays(event.start, days) : new Date(shiftDays(event.start, days).getTime() + shift)
  }));
}

/**
 * Einen Termin an einen neuen Beginn legen — und wie man es zurücknimmt.
 * Einzelne neu speichern (wie der Editor: was am Termin hängt, wandert mit);
 * ein Vorkommen einer Reihe, oder was schon verlegt ist: als Ausnahme.
 */
async function moveTo(ring: Ring, event: CalEvent, start: Date): Promise<Undo> {
  const item = event.item!;
  const o = item.occurrence;
  if (repeats(item) || o.moved) {
    await moveOne(o.itemId, o.occurrenceAt, start);
    return o.moved
      ? () => moveOne(o.itemId, o.occurrenceAt, event.start)
      /* Erst zurück (die Reservierungen folgen der Zeit), dann die Ausnahme fort. */
      : async () => { await moveOne(o.itemId, o.occurrenceAt, event.start); await restoreOne(o.itemId, o.occurrenceAt); };
  }
  await saveEvent(ring, { ...draftOf(item), date: localDate(start), time: localTime(start) }, o.itemId);
  return () => saveEvent(ring, draftOf(item), o.itemId);
}

/** Eine Kopie: ein neuer, einzelner Termin mit allem, was der alte hat. */
async function copyTo(ring: Ring, event: CalEvent, start: Date, parentItemId: string | null): Promise<string> {
  const item = event.item!;
  const minutes = Math.max(1, Math.round((event.end.getTime() - event.start.getTime()) / 60_000));
  const id = await saveEvent(ring, {
    ...draftOf(item),
    date: localDate(start), time: localTime(start), minutes,
    repeat: 'none', every: 1, weekdays: 0, until: null, count: null,
    parentItemId
  });
  const people = item.occurrence.people ?? [];
  if (people.length > 0) await setPeople(id, people);
  return id;
}

export interface PasteResult {
  readonly done: number;
  readonly failed: number;
  readonly why: string | null;
  /** 2026-10-20 — ganztägige, die um weniger als einen Tag nicht rücken. */
  readonly skipped: number;
  readonly undo: (() => Promise<void>) | null;
}

/**
 * EINFÜGEN — verschieben (`cut`) oder kopieren, mit den Punkten des
 * Programms: an einen Tag, eine Stunde — oder 2026-10-20 um einen Zeitraum.
 * Was scheitert, hält die übrigen nicht auf.
 */
export async function pasteClip(ring: Ring, clip: Clip, target: PasteAt | Period, all: readonly CalEvent[]): Promise<PasteResult> {
  const events = withParts(clip.events.filter(pickable), all);
  const shifted = isPeriod(target) ? planShift(events, target) : null;
  const placed = shifted?.placed ?? plan(events, target as PasteAt);
  const undos: Undo[] = [];
  let done = 0;
  let failed = 0;
  let why: string | null = null;
  const fail = (e: unknown) => { failed += 1; why ??= e instanceof WorkspaceError ? e.message : null; };

  if (clip.mode === 'cut') {
    for (const { event, start } of placed) {
      if (start.getTime() === event.start.getTime()) continue;
      try { undos.push(await moveTo(ring, event, start)); done += 1; } catch (e) { fail(e); }
    }
  } else {
    /* Erst die Ganzen, dann ihre Punkte — die bekommen das neue Ganze. */
    const ids = new Set(placed.map((p) => p.event.item!.occurrence.itemId));
    const depth = (e: CalEvent): number => {
      let n = 0;
      for (let up = e.item?.occurrence.parentItemId ?? null; up !== null && ids.has(up) && n < 8; n += 1) {
        up = placed.find((p) => p.event.item!.occurrence.itemId === up)?.event.item?.occurrence.parentItemId ?? null;
      }
      return n;
    };
    const copied = new Map<string, string>();
    for (const { event, start } of [...placed].sort((a, b) => depth(a.event) - depth(b.event))) {
      const parent = event.item!.occurrence.parentItemId ?? null;
      const end = new Date(start.getTime() + (event.end.getTime() - event.start.getTime()));
      /* Ein Punkt bleibt Punkt seines Ganzen, wenn er in dessen Zeit landet (zweimal derselbe Punkt im Programm). */
      const stays = parent !== null && all.some((p) => p.item?.occurrence.itemId === parent && p.start <= start && end <= p.end);
      try {
        const id = await copyTo(ring, event, start, parent === null ? null : copied.get(parent) ?? (stays ? parent : null));
        copied.set(event.item!.occurrence.itemId, id);
        undos.push(() => deleteEvent(id).catch(() => undefined));
        done += 1;
      } catch (e) { fail(e); }
    }
  }

  return {
    done, failed, why, skipped: shifted?.skipped ?? 0,
    undo: undos.length === 0 ? null : async () => { for (const one of [...undos].reverse()) await one(); }
  };
}

/** Die Meldung nach dem Einfügen — mit „Cofnij". */
export function tellPasted(result: PasteResult, mode: Clip['mode'], reload: () => void): void {
  const word = mode === 'cut' ? 'Przeniesiono' : 'Skopiowano';
  const undo = result.undo;
  const action = undo === null ? undefined : {
    label: 'Cofnij',
    run: () => void undo().then(
      () => { toast('Cofnięto.'); reload(); },
      (e: unknown) => { toast(e instanceof WorkspaceError ? e.message : 'Nie udało się cofnąć.', { kind: 'error' }); reload(); })
  };
  const left = result.skipped === 0 ? '' : ` Całodniowe przesuwają się tylko o pełne dni — bez zmian: ${terms(result.skipped)}.`;
  if (result.failed === 0) toast(`${word} ${terms(result.done)}.${left}`, { action, ms: 8000 });
  else toast(`${word} ${terms(result.done)}, nie udało się: ${result.failed}${result.why !== null ? ` — ${result.why}` : ''}.${left}`, { kind: 'error', action, ms: 10000 });
}

/**
 * Was die Leiste mit der Auswahl tut — als Hook, damit auch die Tasten
 * (Entf, Strg+X/C) dieselben Handgriffe nehmen.
 */
export function usePickActions(me: Me, picked: readonly CalEvent[], onDone: () => void) {
  const [busy, setBusy] = useState(false);

  const items = picked.map((e) => e.item).filter((item): item is OpenedItem => item !== undefined);
  const byItem = new Map<string, OpenedItem[]>();
  for (const item of items) byItem.set(item.occurrence.itemId, [...(byItem.get(item.occurrence.itemId) ?? []), item]);
  const anySeries = items.some(repeats);

  /* Jede Handlung einzeln — was scheitert, hält die übrigen nicht auf; was sich zurücknehmen lässt, steht in der Meldung. */
  const runAll = async (steps: readonly (() => Promise<Undo | unknown>)[], done: string) => {
    setBusy(true);
    let failed = 0;
    let why: string | null = null;
    const undos: Undo[] = [];
    for (const step of steps) {
      try {
        const back = await step();
        if (typeof back === 'function') undos.push(back as Undo);
      } catch (e) {
        failed++;
        why ??= e instanceof WorkspaceError ? e.message : null;
      }
    }
    setBusy(false);
    const action = undos.length === 0 ? undefined : {
      label: 'Cofnij',
      run: () => void (async () => { for (const one of [...undos].reverse()) await one(); })().then(onDone, onDone)
    };
    if (failed === 0) toast(done, { action });
    else toast(`Nie udało się: ${failed} z ${steps.length}${why !== null ? ` — ${why}` : ''}`, { kind: 'error', action });
    onDone();
  };

  /* Ein einzelner Termin hat nur sich selbst: löschen. Ein Vorkommen einer Reihe: absagen. */
  const removeThese = async () => {
    if (items.length === 0 || busy) return;
    if (!(await askText(`Usunąć ${terms(items.length)}?${anySeries ? ' Z serii znikną tylko te dni.' : ''}`))) return;
    const singles = [...byItem.values()].filter((list) => !repeats(list[0])).map((list) => list[0]);
    const occurrences = items.filter(repeats);
    void runAll([
      ...singles.map((item) => () => deleteEvent(item.occurrence.itemId)),
      ...occurrences.map((item) => () => cancelOne(item.occurrence.itemId, item.occurrence.occurrenceAt))
    ], `Usunięto ${terms(items.length)}.`);
  };

  /* Je Reihe zählt das früheste gewählte Vorkommen. */
  const endFollowing = async () => {
    const firsts = [...byItem.values()].map((list) => [...list].sort((a, b) => a.occurrence.occurrenceAt.localeCompare(b.occurrence.occurrenceAt))[0]);
    if (!(await askText(`Zakończyć ${series(firsts.length)} przed zaznaczonym dniem? Wcześniejsze terminy zostają, pojedyncze terminy znikną.`))) return;
    void runAll(firsts.map((item) => () => repeats(item) ? endSeriesBefore(me.ring, item) : deleteEvent(item.occurrence.itemId)),
      'Gotowe — serie kończą się przed zaznaczonymi dniami.');
  };

  const removeSeries = async () => {
    if (!(await askText(`Usunąć ${series(byItem.size)} w całości — także terminy, które już były?`))) return;
    void runAll([...byItem.keys()].map((itemId) => () => deleteEvent(itemId)), `Usunięto ${series(byItem.size)}.`);
  };

  return { busy, anySeries, removeThese, endFollowing, removeSeries };
}

export type PickActions = ReturnType<typeof usePickActions>;

/**
 * DIE LEISTE: was gewählt ist und was damit geht — und, solange etwas im
 * Schoss liegt, wohin es kommt.
 */
export function PickBar({ picked, clip, actions, onCut, onCopy, onShift, onClear, onClearClip }: {
  picked: readonly CalEvent[];
  clip: Clip | null;
  actions: PickActions;
  onCut: () => void;
  onCopy: () => void;
  /** 2026-10-20 — die Auswahl um einen Zeitraum verschieben oder kopieren. */
  onShift: (period: Period, mode: Clip['mode']) => void;
  onClear: () => void;
  onClearClip: () => void;
}) {
  const { busy } = actions;
  /* Die Zeile „um einen eigenen Zeitraum": offen zum Verschieben oder Kopieren; das Gewählte bleibt für das nächste Mal. */
  const [shifting, setShifting] = useState<Clip['mode'] | null>(null);
  const [amount, setAmount] = useState('1');
  const [unit, setUnit] = useState<PeriodUnit>('week');
  const [later, setLater] = useState(true);
  const n = Number(amount);
  const valid = Number.isInteger(n) && n >= 1 && n <= 999;
  const period: Period = { amount: (later ? 1 : -1) * (valid ? n : 1), unit };
  const shown = picked.filter((e) => wholeDays(unit) || !e.allDay);
  const first = shown.length === 0 ? null : shown.reduce((a, b) => (b.start < a.start ? b : a));
  const run = () => { if (valid && shifting !== null && shown.length > 0) { onShift(period, shifting); setShifting(null); } };

  return (
    <div className="wk-cal2-pickbar" role="toolbar" aria-label="Zaznaczone terminy" aria-busy={busy || undefined}>
      {picked.length > 0 && (
        <div className="wk-cal2-pickrow">
          <span className="wk-cal2-pickcount">Zaznaczone: {terms(picked.length)}</span>
          <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} title="Ctrl + X — potem kliknij dzień albo godzinę" onClick={onCut}>Wytnij</button>
          <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} title="Ctrl + C — potem kliknij dzień albo godzinę" onClick={onCopy}>Kopiuj</button>
          <button type="button" className="wk-btn wk-btn-quiet wk-danger" disabled={busy} title="Delete" onClick={() => void actions.removeThese()}>
            {actions.anySeries ? 'Usuń tylko te' : 'Usuń'}
          </button>
          {actions.anySeries && (
            <MenuButton label="Usuń z seriami" text="Serie…" disabled={busy} items={[
              { label: 'Te i następne — zakończ serie', onSelect: () => void actions.endFollowing(), danger: true },
              { label: 'Całe serie', onSelect: () => void actions.removeSeries(), danger: true }
            ]} />
          )}
          <MenuButton label="Przesuń zaznaczone" text="Przesuń…" disabled={busy} items={[
            { label: 'O dzień wcześniej', onSelect: () => onShift({ amount: -1, unit: 'day' }, 'cut') },
            { label: 'O dzień później', onSelect: () => onShift({ amount: 1, unit: 'day' }, 'cut') },
            { label: 'O tydzień wcześniej', onSelect: () => onShift({ amount: -1, unit: 'week' }, 'cut') },
            { label: 'O tydzień później', onSelect: () => onShift({ amount: 1, unit: 'week' }, 'cut') },
            { label: 'O godzinę wcześniej', onSelect: () => onShift({ amount: -1, unit: 'hour' }, 'cut') },
            { label: 'O godzinę później', onSelect: () => onShift({ amount: 1, unit: 'hour' }, 'cut') },
            { label: 'O inny okres…', onSelect: () => setShifting('cut') },
            { label: 'Kopiuj o okres…', onSelect: () => setShifting('copy') }
          ]} />
          <button type="button" className="wk-btn wk-btn-quiet wk-cal2-pickdone" disabled={busy} title="Esc" onClick={onClear}>Gotowe</button>
        </div>
      )}
      {/* 2026-10-20 — um einen eigenen Zeitraum: wie viel, wovon, früher oder später; daneben, wohin der erste kommt. */}
      {shifting !== null && picked.length > 0 && (
        <form className="wk-cal2-pickrow wk-cal2-shift" aria-label="Przesuń o okres"
          onSubmit={(e) => { e.preventDefault(); run(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setShifting(null); } }}>
          <Segment now={shifting} busy={busy} onPick={setShifting} options={[{ value: 'cut', label: 'Przesuń' }, { value: 'copy', label: 'Kopiuj' }]} />
          <span>o</span>
          <input className="wk-cal2-shiftn" type="number" inputMode="numeric" min={1} max={999} step={1} value={amount} disabled={busy}
            aria-label="Ile" aria-invalid={!valid} autoFocus onChange={(e) => setAmount(e.target.value)} />
          <select value={unit} disabled={busy} aria-label="Czego" onChange={(e) => setUnit(e.target.value as PeriodUnit)}>
            {PERIOD_UNITS.map((one) => <option key={one} value={one}>{unitWord(one, valid ? n : 1)}</option>)}
          </select>
          <Segment now={later ? 'later' : 'earlier'} busy={busy} onPick={(v) => setLater(v === 'later')}
            options={[{ value: 'earlier', label: 'wcześniej' }, { value: 'later', label: 'później' }]} />
          <button type="submit" className="wk-btn" disabled={busy || !valid || shown.length === 0}>{shifting === 'cut' ? 'Przesuń' : 'Kopiuj'}</button>
          <button type="button" className="wk-btn wk-btn-quiet" onClick={() => setShifting(null)}>Anuluj</button>
          <span className="wk-cal2-shiftsee">
            {first === null ? 'Całodniowe przesuwają się tylko o pełne dni.'
              : `${whenShort(first.start, first.allDay)} → ${whenShort(shiftBy(first.start, period), first.allDay)}${shown.length < picked.length ? ` · całodniowe zostają: ${picked.length - shown.length}` : ''}`}
          </span>
        </form>
      )}
      {clip !== null && (
        <div className="wk-cal2-pickrow is-clip">
          <span className="wk-cal2-pickcount">
            {clip.mode === 'cut' ? 'Do przeniesienia' : 'Do skopiowania'}: {terms(clip.events.length)} — kliknij dzień albo godzinę, gdzie mają trafić
          </span>
          <button type="button" className="wk-btn wk-btn-quiet" onClick={onClearClip}>Anuluj</button>
        </div>
      )}
    </div>
  );
}

export default PickBar;
