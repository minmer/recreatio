/**
 * EIN TERMIN — anlegen, ändern, löschen; so, wie man es aus jedem Kalender
 * kennt: Titel, wann, ganztägig, Wiederholung, Ort, Notiz, und wer ihn sieht.
 *
 * <b>Bei einer Reihe wird gefragt, was gemeint ist</b>: nur dieser Termin
 * (verschieben oder absagen — mehr kann ein einzelnes Vorkommen nicht) oder
 * die ganze Reihe.
 *
 * <b>Was man hier nicht ändert, sagt es</b>: eine Messe (an ihr hängen
 * Intentionen), eine Buchung (sie gehört dem, der sie genommen hat).
 */

import { useState } from 'react';

import {
  cancelOne, deleteEvent, ensurePrivateArea, forever, moveOne, saveEvent, type OpenedItem, type RepeatKind
} from './agenda';
import type { AreaRow } from './area';
import type { CalEvent } from './calendarModel';
import { longDate } from './dayMath';
import type { Me } from './me';
import { Modal } from './Modal';
import { useRecent } from './prefs';
import { viewPath } from './routes';
import { WorkspaceError } from './session';
import {
  bitOf, fromLocal, groupName, localDate, localTime, PRIVATE, Weekdays, WhoSees
} from './WhoSees';

const REPEATS: readonly { value: RepeatKind; label: string }[] = [
  { value: 'none', label: 'Nie powtarza się' },
  { value: 'daily', label: 'Codziennie' },
  { value: 'weekly', label: 'Co tydzień' },
  { value: 'monthly', label: 'Co miesiąc' },
  { value: 'yearly', label: 'Co rok' }
];

const time = (at: Date) => at.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

/** Ein neuer Termin ab dieser Zeit — oder ein bestehender. */
export type EventTarget = { readonly at: 'new'; readonly start: Date; readonly end: Date; readonly allDay: boolean }
  | { readonly at: 'event'; readonly event: CalEvent };

export function EventDialog({ me, areas, target, onClose, onSaved }: {
  me: Me;
  areas: readonly AreaRow[];
  target: EventTarget;
  onClose: () => void;
  onSaved: () => void;
}) {
  if (target.at === 'event' && (target.event.source !== 'item' || !target.event.item?.editable)) {
    return <Details areas={areas} event={target.event} onClose={onClose} />;
  }

  return <Editor me={me} areas={areas} target={target} onClose={onClose} onSaved={onSaved} />;
}

/* -- Nur ansehen ------------------------------------------------------------------ */

function Details({ areas, event, onClose }: { areas: readonly AreaRow[]; event: CalEvent; onClose: () => void }) {
  const item = event.item;
  const when = event.allDay
    ? longDate(event.start)
    : `${longDate(event.start)}, ${time(event.start)}–${time(event.end)}`;

  return (
    <Modal title={event.title} onClose={onClose}>
      <p className="wk-ev-when">{when}</p>
      <p className="wk-hint">Widzi: {groupName(areas, event.areaId)}</p>
      {item?.location && <p><strong>Miejsce:</strong> {item.location}</p>}
      {item?.notes && <p className="wk-ev-notes">{item.notes}</p>}

      {event.source === 'claim' && (
        <p className="wk-note">
          To Twoja rezerwacja ({event.claim?.status === 'confirmed' ? 'potwierdzona' : 'czeka na potwierdzenie'}).
          Zmienisz ją tam, gdzie ją zrobiłeś.
        </p>
      )}

      {item !== undefined && !item.editable && (item.occurrence.kind === 'mass' || item.occurrence.kind === 'confession') && (
        <p className="wk-note">
          Msze i spowiedzi zmienia się w <a className="wk-link" href={viewPath('masses')}>Msze i intencje</a> — wiszą
          na nich intencje.
        </p>
      )}

      {item !== undefined && !item.editable && item.occurrence.kind !== 'mass' && item.occurrence.kind !== 'confession' && (
        <p className="wk-hint">Ten termin możesz tylko oglądać — w jego grupie nie piszesz.</p>
      )}

      <div className="wk-actions">
        <button type="button" className="wk-btn" onClick={onClose}>Zamknij</button>
      </div>
    </Modal>
  );
}

/* -- Anlegen und ändern -------------------------------------------------------------- */

function Editor({ me, areas, target, onClose, onSaved }: {
  me: Me;
  areas: readonly AreaRow[];
  target: EventTarget;
  onClose: () => void;
  onSaved: () => void;
}) {
  const recent = useRecent('calendar.who');
  const item: OpenedItem | undefined = target.at === 'event' ? target.event.item : undefined;
  const occurrence = item?.occurrence;
  const series = occurrence?.series;
  const personal = areas.find((a) => a.personal === true);

  /* Was vorher dastand: beim neuen die angeklickte Zeit, beim bestehenden die REIHE (für „cała seria"). */
  const start = target.at === 'new' ? target.start : new Date(target.event.start);
  const end = target.at === 'new' ? target.end : new Date(target.event.end);
  const seriesStart = series !== undefined ? new Date(series.startsAt) : start;
  const seriesEnd = series !== undefined ? new Date(series.endsAt) : end;
  const repeating = series !== undefined && series.repeatKind !== 'none';

  const [scope, setScope] = useState<'one' | 'all'>('all');
  const [title, setTitle] = useState(item?.title ?? '');
  const [location, setLocation] = useState(item?.location ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [who, setWho] = useState<string>(() => {
    if (occurrence !== undefined) return occurrence.visibilityAreaId;
    const last = recent.ids.find((id) => areas.some((a) => a.areaId === id && (a.myLevel === 'write' || a.myLevel === 'admin')));
    return last ?? personal?.areaId ?? PRIVATE;
  });
  const [allDay, setAllDay] = useState(target.at === 'new' ? target.allDay : target.event.allDay);

  /* Die Felder zeigen die Reihe, wenn „cała seria" gemeint ist, sonst dieses Vorkommen. */
  const [date, setDate] = useState(localDate(repeating ? seriesStart : start));
  const [from, setFrom] = useState(localTime(repeating ? seriesStart : start));
  const [endDate, setEndDate] = useState(localDate(new Date((repeating ? seriesEnd : end).getTime() - (allDay ? 1 : 0))));
  const [to, setTo] = useState(localTime(repeating ? seriesEnd : end));

  const [repeat, setRepeat] = useState<RepeatKind>(series?.repeatKind ?? 'none');
  const [every, setEvery] = useState(series?.repeatEvery ?? 1);
  const [weekdays, setWeekdays] = useState(series?.repeatWeekdays ?? bitOf(start));
  const [ends, setEnds] = useState<'never' | 'date' | 'count'>(
    series?.repeatCount != null ? 'count' : series?.repeatUntil != null && new Date(series.repeatUntil).getFullYear() - seriesStart.getFullYear() < 9 ? 'date' : 'never');
  const [until, setUntil] = useState(series?.repeatUntil != null ? localDate(new Date(series.repeatUntil)) : localDate(new Date(start.getTime() + 90 * 86400_000)));
  const [count, setCount] = useState(series?.repeatCount ?? 10);

  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /* Nur dieses Vorkommen: dann gelten sein Tag und seine Zeit. */
  const pickScope = (next: 'one' | 'all') => {
    setScope(next);
    const base = next === 'one' ? { s: start, e: end } : { s: seriesStart, e: seriesEnd };
    setDate(localDate(base.s)); setFrom(localTime(base.s));
    setEndDate(localDate(new Date(base.e.getTime() - (allDay ? 1 : 0)))); setTo(localTime(base.e));
  };

  const run = async (todo: () => Promise<unknown>) => {
    setBusy(true);
    setFailed(null);
    try {
      await todo();
      onSaved();
      onClose();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  const save = () => run(async () => {
    const startAt = allDay ? fromLocal(date, '00:00') : fromLocal(date, from);
    const endAt = allDay ? new Date(fromLocal(endDate, '00:00').getTime() + 86400_000) : fromLocal(endDate, to);
    const minutes = Math.round((endAt.getTime() - startAt.getTime()) / 60_000);
    if (minutes <= 0) throw new WorkspaceError('Koniec musi być po początku.');

    if (item !== undefined && repeating && scope === 'one') {
      await moveOne(item.occurrence.itemId, item.occurrence.occurrenceAt, startAt);
      return;
    }

    const areaId = who === PRIVATE ? await ensurePrivateArea(me.ring, me.person, areas) : who;
    if (who !== PRIVATE && areas.find((a) => a.areaId === who)?.personal !== true) recent.touch(who);

    await saveEvent(me.ring, {
      title, location, notes, areaId,
      ownerRoleId: me.person.id,
      date, time: from, minutes, allDay,
      repeat, every, weekdays,
      until: repeat === 'none' ? null : ends === 'never' ? forever(startAt) : ends === 'date' ? until : null,
      count: repeat !== 'none' && ends === 'count' ? count : null
    }, item?.occurrence.itemId);
  });

  const remove = () => {
    if (item === undefined) return;
    const one = repeating && scope === 'one';
    if (!window.confirm(one ? 'Odwołać tylko ten termin?' : 'Usunąć ten termin (całą serię)?')) return;
    void run(() => one ? cancelOne(item.occurrence.itemId, item.occurrence.occurrenceAt) : deleteEvent(item.occurrence.itemId));
  };

  const onlyTime = item !== undefined && repeating && scope === 'one';

  return (
    <Modal title={item === undefined ? 'Nowy termin' : 'Termin'} onClose={onClose} wide>
      <form className="wk-form wk-ev-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        {repeating && (
          <div className="wk-seg wk-ev-scope" role="group" aria-label="Co zmieniasz">
            <button type="button" aria-pressed={scope === 'one'} className={scope === 'one' ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
              onClick={() => pickScope('one')}>Tylko ten termin</button>
            <button type="button" aria-pressed={scope === 'all'} className={scope === 'all' ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
              onClick={() => pickScope('all')}>Cała seria</button>
          </div>
        )}

        <label className="wk-field">
          <span>Tytuł</span>
          <input value={title} disabled={onlyTime} maxLength={200} placeholder="np. Spotkanie z rodzicami"
            onChange={(e) => setTitle(e.target.value)} />
        </label>

        <div className="wk-ev-when-row">
          <label className="wk-field">
            <span>{allDay ? 'Od dnia' : 'Początek'}</span>
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value); }} />
          </label>
          {!allDay && (
            <label className="wk-field">
              <span>godz.</span>
              <input type="time" value={from} step={300} onChange={(e) => setFrom(e.target.value)} />
            </label>
          )}
          <label className="wk-field">
            <span>{allDay ? 'Do dnia' : 'Koniec'}</span>
            <input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          {!allDay && (
            <label className="wk-field">
              <span>godz.</span>
              <input type="time" value={to} step={300} onChange={(e) => setTo(e.target.value)} />
            </label>
          )}
        </div>

        <label className="wk-check">
          <input type="checkbox" checked={allDay} disabled={onlyTime} onChange={(e) => setAllDay(e.target.checked)} />
          <span>Cały dzień</span>
        </label>

        {!onlyTime && (
          <>
            <div className="wk-ev-repeat">
              <label className="wk-field">
                <span>Powtarzanie</span>
                <select value={repeat} onChange={(e) => setRepeat(e.target.value as RepeatKind)}>
                  {REPEATS.map((one) => <option key={one.value} value={one.value}>{one.label}</option>)}
                </select>
              </label>

              {repeat !== 'none' && (
                <label className="wk-field wk-ev-every">
                  <span>co ile</span>
                  <input type="number" min={1} max={52} value={every} onChange={(e) => setEvery(Math.max(1, Number(e.target.value) || 1))} />
                </label>
              )}

              {repeat !== 'none' && (
                <label className="wk-field">
                  <span>Kończy się</span>
                  <select value={ends} onChange={(e) => setEnds(e.target.value as typeof ends)}>
                    <option value="never">nigdy</option>
                    <option value="date">w dniu…</option>
                    <option value="count">po … razach</option>
                  </select>
                </label>
              )}

              {repeat !== 'none' && ends === 'date' && (
                <label className="wk-field">
                  <span>ostatni dzień</span>
                  <input type="date" value={until} min={date} onChange={(e) => setUntil(e.target.value)} />
                </label>
              )}

              {repeat !== 'none' && ends === 'count' && (
                <label className="wk-field wk-ev-every">
                  <span>ile razy</span>
                  <input type="number" min={1} max={999} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} />
                </label>
              )}
            </div>

            {repeat === 'weekly' && <Weekdays value={weekdays} onChange={setWeekdays} />}

            <WhoSees areas={areas} recent={recent.ids} value={who} onChange={setWho} />

            <label className="wk-field">
              <span>Miejsce</span>
              <input value={location} maxLength={300} placeholder="np. salka parafialna" onChange={(e) => setLocation(e.target.value)} />
            </label>

            <label className="wk-field">
              <span>Notatka</span>
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </>
        )}

        {onlyTime && (
          <p className="wk-hint">Przesuwasz tylko ten jeden termin — reszta serii zostaje, jak była.</p>
        )}

        {failed !== null && <p className="wk-error">{failed}</p>}

        <div className="wk-actions">
          <button type="submit" className="wk-btn" disabled={busy}>{busy ? 'Zapisywanie…' : 'Zapisz'}</button>
          <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={onClose}>Anuluj</button>
          {item !== undefined && (
            <button type="button" className="wk-link-btn wk-danger wk-ev-delete" disabled={busy} onClick={remove}>
              {repeating && scope === 'one' ? 'Odwołaj ten termin' : 'Usuń'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

export default EventDialog;
