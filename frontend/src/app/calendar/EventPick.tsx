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
 * Wählbar ist nur, was ich ändern darf (eigene Art, Schreibrecht). Lehnt der
 * Dienst einen ab (eine Messe mit Intentionen), laufen die übrigen weiter und
 * es wird gesagt, wie viele nicht gingen.
 */

import { useState } from 'react';

import { localDate, localTime } from '../areas/WhoSees';
import { startOfDay } from '../core/dayMath';
import type { Ring } from '../core/keys';
import type { Me } from '../core/me';
import { WorkspaceError } from '../core/session';
import { askText, toast } from '../ui/dialogs';
import { MenuButton } from '../ui/Menu';
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
  readonly undo: (() => Promise<void>) | null;
}

/**
 * EINFÜGEN — verschieben (`cut`) oder kopieren, mit den Punkten des
 * Programms. Was scheitert, hält die übrigen nicht auf.
 */
export async function pasteClip(ring: Ring, clip: Clip, target: PasteAt, all: readonly CalEvent[]): Promise<PasteResult> {
  const placed = plan(withParts(clip.events.filter(pickable), all), target);
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
    done, failed, why,
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
  if (result.failed === 0) toast(`${word} ${terms(result.done)}.`, { action, ms: 8000 });
  else toast(`${word} ${terms(result.done)}, nie udało się: ${result.failed}${result.why !== null ? ` — ${result.why}` : ''}`, { kind: 'error', action, ms: 10000 });
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

  /* Ganztägiges rückt nur um ganze Tage. */
  const moveBy = (ms: number) => {
    const moving = picked.filter((e) => e.item !== undefined && (ms % DAY === 0 || !e.allDay));
    void runAll(moving.map((e) => () => moveTo(me.ring, e, new Date(e.start.getTime() + ms))), `Przesunięto ${terms(moving.length)}.`);
  };

  return { busy, anySeries, removeThese, endFollowing, removeSeries, moveBy };
}

export type PickActions = ReturnType<typeof usePickActions>;

/**
 * DIE LEISTE: was gewählt ist und was damit geht — und, solange etwas im
 * Schoss liegt, wohin es kommt.
 */
export function PickBar({ picked, clip, actions, onCut, onCopy, onClear, onClearClip }: {
  picked: readonly CalEvent[];
  clip: Clip | null;
  actions: PickActions;
  onCut: () => void;
  onCopy: () => void;
  onClear: () => void;
  onClearClip: () => void;
}) {
  const { busy } = actions;
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
            { label: 'O dzień wcześniej', onSelect: () => actions.moveBy(-DAY) },
            { label: 'O dzień później', onSelect: () => actions.moveBy(DAY) },
            { label: 'O tydzień później', onSelect: () => actions.moveBy(7 * DAY) },
            { label: 'O godzinę wcześniej', onSelect: () => actions.moveBy(-HOUR) },
            { label: 'O godzinę później', onSelect: () => actions.moveBy(HOUR) }
          ]} />
          <button type="button" className="wk-btn wk-btn-quiet wk-cal2-pickdone" disabled={busy} title="Esc" onClick={onClear}>Gotowe</button>
        </div>
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
