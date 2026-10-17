/**
 * MEHRERE TERMINE ZUGLEICH (2026-10-17) — zaznaczyć i zmienić razem.
 *
 * „Zaznacz" im Kalender (oder Strg/Umschalt + Klick auf einen Termin) macht
 * aus dem Klick auf einen Termin ein Häkchen; die Auswahl hält über das
 * Blättern hinweg. Dann gilt für alle auf einmal, was der Editor für einen
 * tut (`EventEditor.tsx`):
 *
 * <code>
 *   Usuń tylko te       ein Vorkommen einer Reihe wird abgesagt, ein einzelner Termin gelöscht
 *   Te i następne       die Reihe endet vor dem frühesten gewählten Vorkommen (`endSeriesBefore`)
 *   Całe serie          jede berührte Reihe fällt ganz
 *   Przesuń             jedes gewählte Vorkommen um einen Tag, eine Woche, eine Stunde
 * </code>
 *
 * Wählbar ist nur, was ich ändern darf (eigene Art, Schreibrecht). Lehnt der
 * Dienst einen ab (eine Messe mit Intentionen), laufen die übrigen weiter und
 * es wird gesagt, wie viele nicht gingen.
 */

import { useState } from 'react';

import type { Me } from '../core/me';
import { WorkspaceError } from '../core/session';
import { askText, toast } from '../ui/dialogs';
import { MenuButton } from '../ui/Menu';
import { cancelOne, deleteEvent, endSeriesBefore, moveOne, repeats, type OpenedItem } from './agenda';
import type { CalEvent } from './calendarModel';

/** Darf dieser Termin mit anderen zusammen geändert werden? */
export const pickable = (event: CalEvent): boolean => (event.source === 'item' || event.source === 'offer') && event.item?.editable === true;

const DAY = 86400_000;
const HOUR = 3600_000;

/** „3 terminy", „1 termin", „5 terminów". */
function terms(n: number): string {
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

export function PickBar({ me, picked, onClear, onDone }: {
  me: Me;
  picked: readonly CalEvent[];
  onClear: () => void;
  /** Etwas wurde geändert — Auswahl leeren, neu laden. */
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const items = picked.map((e) => e.item).filter((item): item is OpenedItem => item !== undefined);
  const byItem = new Map<string, OpenedItem[]>();
  for (const item of items) byItem.set(item.occurrence.itemId, [...(byItem.get(item.occurrence.itemId) ?? []), item]);
  const anySeries = items.some(repeats);

  /* Jede Handlung einzeln — was scheitert, hält die übrigen nicht auf. */
  const runAll = async (steps: readonly (() => Promise<unknown>)[], done: string) => {
    setBusy(true);
    let failed = 0;
    let why: string | null = null;
    for (const step of steps) {
      try {
        await step();
      } catch (e) {
        failed++;
        why ??= e instanceof WorkspaceError ? e.message : null;
      }
    }
    setBusy(false);
    if (failed === 0) toast(done);
    else toast(`Nie udało się: ${failed} z ${steps.length}${why !== null ? ` — ${why}` : ''}`, { kind: 'error' });
    onDone();
  };

  /* Ein einzelner Termin hat nur sich selbst: löschen. Ein Vorkommen einer Reihe: absagen. */
  const removeThese = async () => {
    if (!(await askText(`Usunąć ${terms(items.length)}? Z serii znikną tylko te dni.`))) return;
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
    void runAll(moving.map((e) => () => moveOne(e.item!.occurrence.itemId, e.item!.occurrence.occurrenceAt, new Date(e.start.getTime() + ms))),
      `Przesunięto ${terms(moving.length)}.`);
  };

  return (
    <div className="wk-cal2-pickbar" role="toolbar" aria-label="Zaznaczone terminy" aria-busy={busy || undefined}>
      <span className="wk-cal2-pickcount">
        {picked.length === 0 ? 'Kliknij terminy, które chcesz zmienić razem' : `Zaznaczone: ${terms(picked.length)}`}
      </span>
      {picked.length > 0 && (
        <>
          <button type="button" className="wk-btn wk-btn-quiet wk-danger" disabled={busy} onClick={() => void removeThese()}>
            {anySeries ? 'Usuń tylko te' : 'Usuń'}
          </button>
          {anySeries && (
            <MenuButton label="Usuń z seriami" text="Serie…" disabled={busy} items={[
              { label: 'Te i następne — zakończ serie', onSelect: () => void endFollowing(), danger: true },
              { label: 'Całe serie', onSelect: () => void removeSeries(), danger: true }
            ]} />
          )}
          <MenuButton label="Przesuń zaznaczone" text="Przesuń…" disabled={busy} items={[
            { label: 'O dzień wcześniej', onSelect: () => moveBy(-DAY) },
            { label: 'O dzień później', onSelect: () => moveBy(DAY) },
            { label: 'O tydzień później', onSelect: () => moveBy(7 * DAY) },
            { label: 'O godzinę wcześniej', onSelect: () => moveBy(-HOUR) },
            { label: 'O godzinę później', onSelect: () => moveBy(HOUR) }
          ]} />
        </>
      )}
      <button type="button" className="wk-btn wk-btn-quiet wk-cal2-pickdone" disabled={busy} onClick={onClear}>Gotowe</button>
    </div>
  );
}

export default PickBar;
