/**
 * Einen Termin anlegen und ändern: Art, Zeit, Wiederholung, wer sieht ihn, wer ist dabei („ten i następne").
 *
 * 2026-10-17 — PUNKTE DES PROGRAMMS TEILEN ALLES MIT IHREM GANZEN: ein neuer
 * Punkt übernimmt Kalender, Sichtbarkeit, Ort, Link und wer dabei ist; wird
 * das Ganze geändert (oder verschoben), ziehen die Punkte nach — jeder Punkt,
 * der das betreffende Feld noch so hat wie das Ganze vorher. Wer bei einem
 * Punkt etwas anders einträgt, behält es (`followParent`).
 */

import { useState } from 'react';

import type { AreaRow } from '../areas/area';
import { AreaPick } from '../areas/AreaPick';
import { PRIVATE, Weekdays, bitOf, fromLocal, groupName, localDate, localTime, writableGroups } from '../areas/WhoSees';
import type { Ring } from '../core/keys';
import type { Me } from '../core/me';
import { useRecent } from '../core/prefs';
import { WorkspaceError } from '../core/session';
import { IntentionsPanel } from '../masses/IntentionsPanel';
import { DEVOTION_NAMES } from '../masses/mass';
import { askText } from '../ui/dialogs';
import { Modal } from '../ui/Modal';
import { type OpenedItem, type RepeatKind, cancelOne, deleteEvent, draftOf, endSeriesBefore, ensurePrivateArea, forever, handover, isLiturgy, moveOne, saveEvent } from './agenda';
import { CALENDAR_KIND_LABEL, type CalendarRow, ITEM_LABEL, type ItemKind, safeLink, setPeople, setProgramParent } from './calendar';
import { calendarLabel } from './calendarLabel';
import type { CalEvent } from './calendarModel';
import { ProgramOf } from './EventDetails';
import type { EventTarget } from './EventDialog';
import { dutyOf, peopleWord } from './eventWords';
import { ItemLink } from './ItemLink';
import { PeoplePicker, type Pinned, useAreaPeople } from './PeoplePicker';

const REPEATS: readonly { value: RepeatKind; label: string }[] = [
  { value: 'none', label: 'Nie powtarza się' },
  { value: 'daily', label: 'Codziennie' },
  { value: 'weekly', label: 'Co tydzień' },
  { value: 'monthly', label: 'Co miesiąc' },
  { value: 'yearly', label: 'Co rok' }
];

/** Die Arten, die ein Eintrag in einem Kalender einer Gruppe haben kann — in dieser Reihenfolge angeboten. */
const KINDS_OFFERED: readonly ItemKind[] = ['appointment', 'mass', 'confession', 'devotion', 'visit'];

/* -- Anlegen und ändern -------------------------------------------------------------- */

export function Editor({ me, areas, calendars, scope: allowed, target, events, onClose, onSaved, onOpenPart }: {
  me: Me;
  areas: readonly AreaRow[];
  calendars: readonly CalendarRow[];
  scope?: readonly string[];
  target: EventTarget;
  events?: readonly CalEvent[];
  onClose: () => void;
  onSaved: () => void;
  onOpenPart?: (part: CalEvent) => void;
}) {
  const recent = useRecent('calendar.cal');
  const item: OpenedItem | undefined = target.at === 'event' ? target.event.item : undefined;
  const occurrence = item?.occurrence;
  const series = occurrence?.series;
  const personal = areas.find((a) => a.personal === true);

  /* 2026-10-17 — das Ganze, unter dem ein NEUER Punkt entsteht: von ihm übernimmt er, was er nicht anders sagt. */
  const parentItem = target.at === 'new' && target.parentItemId !== undefined
    ? events?.find((e) => e.item?.occurrence.itemId === target.parentItemId)?.item : undefined;
  /* Wovon ein bestehender Punkt abhängt — für den Hinweis. */
  const ownParent = occurrence?.parentItemId == null ? undefined
    : events?.find((e) => e.item?.occurrence.itemId === occurrence.parentItemId)?.item;
  /* Die Punkte dieses Termins, je Punkt einmal (eine Reihe steht sonst mit jedem Vorkommen da). */
  const parts = item === undefined || events === undefined ? [] : [...new Map(events
    .filter((e) => e.item !== undefined && e.item.occurrence.parentItemId === item.occurrence.itemId)
    .map((e) => [e.item!.occurrence.itemId, e.item!] as const)).values()];

  /*
   * IN WELCHE KALENDER: die, in denen ich schreibe (auf einer Seite nur die
   * des Bausteins); private zuerst. Gibt es noch keinen privaten, steht
   * „Tylko ja" trotzdem da — er entsteht beim Speichern.
   */
  const writable = calendars.filter((c) => c.mayWrite === true && c.archived !== true
    && (allowed === undefined || allowed.includes(c.calendarId)));
  const privateCals = writable.filter((c) => c.areaId === personal?.areaId);
  const groupCals = writable.filter((c) => c.areaId !== personal?.areaId);
  const offerPrivate = allowed === undefined && privateCals.length === 0;

  /* Was vorher dastand: beim neuen die angeklickte Zeit, beim bestehenden die REIHE (für „cała seria"). */
  const start = target.at === 'new' ? target.start : new Date(target.event.start);
  const end = target.at === 'new' ? target.end : new Date(target.event.end);
  const seriesStart = series !== undefined ? new Date(series.startsAt) : start;
  const seriesEnd = series !== undefined ? new Date(series.endsAt) : end;
  const repeating = series !== undefined && series.repeatKind !== 'none';

  const [calendarId, setCalendarId] = useState<string>(() => {
    if (occurrence !== undefined) return occurrence.calendarId;
    if (target.at === 'new' && target.calendarId !== undefined && writable.some((c) => c.calendarId === target.calendarId)) return target.calendarId;
    const last = recent.ids.find((id) => writable.some((c) => c.calendarId === id));
    return last ?? privateCals[0]?.calendarId ?? (offerPrivate ? PRIVATE : writable[0]?.calendarId ?? PRIVATE);
  });
  const calendar = calendars.find((c) => c.calendarId === calendarId);
  const calendarArea = calendar?.areaId ?? personal?.areaId ?? null;
  const isPrivate = calendarId === PRIVATE || calendarArea === personal?.areaId;
  const defaultVisibility = calendar?.visibilityAreaId ?? calendar?.areaId ?? personal?.areaId ?? PRIVATE;

  /*
   * 0079 — „TA I NASTĘPNE": ab diesem Vorkommen. So ändert eine Pfarrei ihre
   * Messzeiten („ab November um 17:00"); die ganze Reihe zu ändern schriebe
   * die vergangenen Messen um. Beim Gottesdienst ist es deshalb die Vorgabe,
   * sobald es Vorkommen davor gibt.
   */
  const hasEarlier = series !== undefined && occurrence !== undefined && repeating
    && new Date(occurrence.occurrenceAt).getTime() > new Date(series.startsAt).getTime();
  const [scope, setScope] = useState<'one' | 'following' | 'all'>(() => (hasEarlier && isLiturgy(occurrence?.kind) ? 'following' : 'all'));

  /* Ein Eintrag ohne eigenen Namen („Msza") bekommt ein leeres Feld — sonst hiesse er nach dem Speichern so. */
  const [title, setTitle] = useState(item !== undefined && !item.named ? '' : item?.title ?? (target.at === 'new' ? target.title ?? '' : ''));

  /* 0079 — WAS es ist. Vorher entschied das allein der Kalender — und jedes geänderte Ding wurde zum Treffen. */
  const [kind, setKind] = useState<ItemKind>(() => (occurrence?.kind as ItemKind | undefined) ?? calendar?.itemKind ?? 'appointment');

  /* 0070 — Teil welches Termins: `undefined` heisst „bleibt", `null` „keiner mehr". */
  const [parentItemId, setParentItemId] = useState<string | null | undefined>(
    target.at === 'new' ? target.parentItemId : undefined);
  const [location, setLocation] = useState(item?.location ?? parentItem?.location ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  /* 0073 — „Więcej informacji": wohin, und was auf dem Knopf steht. */
  const [link, setLink] = useState(item?.link ?? parentItem?.link ?? '');
  const [linkLabel, setLinkLabel] = useState(item?.linkLabel ?? parentItem?.linkLabel ?? '');

  /* Wer ihn sieht: was der Kalender sagt — ausser, dieser Termin (oder beim neuen Punkt: sein Ganzes) sagt es anders. */
  const seenFrom = occurrence ?? (parentItem?.occurrence.calendarId === calendarId ? parentItem.occurrence : undefined);
  const [visibility, setVisibility] = useState<string | null>(
    seenFrom !== undefined && seenFrom.visibilityAreaId !== defaultVisibility ? seenFrom.visibilityAreaId : null);
  const [allDay, setAllDay] = useState(target.at === 'new' ? target.allDay : target.event.allDay);

  /* Die Felder zeigen die Reihe, wenn „cała seria" gemeint ist, sonst dieses Vorkommen. Ein neuer dauert, wie sein Kalender sagt. */
  const initialEnd = target.at === 'new' && !target.allDay && calendar?.durationMinutes !== undefined
    ? new Date(start.getTime() + calendar.durationMinutes * 60_000) : (repeating ? seriesEnd : end);
  const followStart = occurrence !== undefined ? new Date(occurrence.occurrenceAt) : start;
  const followEnd = new Date(followStart.getTime() + (seriesEnd.getTime() - seriesStart.getTime()));
  const opening = scope === 'following' ? { s: followStart, e: followEnd } : repeating ? { s: seriesStart, e: initialEnd } : { s: start, e: initialEnd };
  const [date, setDate] = useState(localDate(opening.s));
  const [from, setFrom] = useState(localTime(opening.s));
  const [endDate, setEndDate] = useState(localDate(new Date(opening.e.getTime() - (allDay ? 1 : 0))));
  const [to, setTo] = useState(localTime(opening.e));
  const [endTouched, setEndTouched] = useState(target.at !== 'new');

  const [repeat, setRepeat] = useState<RepeatKind>(series?.repeatKind ?? 'none');
  const [every, setEvery] = useState(series?.repeatEvery ?? 1);
  const [weekdays, setWeekdays] = useState(series?.repeatWeekdays ?? bitOf(start));
  const [ends, setEnds] = useState<'never' | 'date' | 'count'>(
    series?.repeatCount != null ? 'count' : series?.repeatUntil != null && new Date(series.repeatUntil).getFullYear() - seriesStart.getFullYear() < 9 ? 'date' : 'never');
  const [until, setUntil] = useState(series?.repeatUntil != null ? localDate(new Date(series.repeatUntil)) : localDate(new Date(start.getTime() + 90 * 86400_000)));
  const [count, setCount] = useState(series?.repeatCount ?? 10);

  /* 0058 — fürs Reservieren: \`null\` heisst „wie der Kalender". */
  const [bookable, setBookable] = useState<boolean | null>(occurrence?.bookable ?? null);
  const [capacity, setCapacity] = useState<string>(occurrence?.capacity != null ? String(occurrence.capacity) : '');
  const [reserveArea, setReserveArea] = useState<string>(occurrence?.reserveAreaId ?? '');

  /* 0058 — wer da sein muss. */
  const candidates = useAreaPeople(me, isPrivate ? null : calendarArea);
  const [pinned, setPinned] = useState<readonly Pinned[]>(occurrence?.people ?? parentItem?.occurrence.people ?? []);
  const pinnedChanged = JSON.stringify(pinned) !== JSON.stringify(occurrence?.people ?? []);

  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const booking = isPrivate ? null : calendar?.booking ?? null;
  const bookableNow = bookable ?? booking?.mode === 'all';

  /* Nur dieses Vorkommen: dann gelten sein Tag und seine Zeit. */
  const pickScope = (next: 'one' | 'following' | 'all') => {
    setScope(next);
    const base = next === 'one' ? { s: start, e: end } : next === 'following' ? { s: followStart, e: followEnd } : { s: seriesStart, e: seriesEnd };
    setDate(localDate(base.s)); setFrom(localTime(base.s));
    setEndDate(localDate(new Date(base.e.getTime() - (allDay ? 1 : 0)))); setTo(localTime(base.e));
  };

  /* Ein anderer Kalender: seine Dauer, solange das Ende nicht von Hand gesetzt wurde. */
  const pickCalendar = (next: string) => {
    setCalendarId(next);
    const chosen = calendars.find((c) => c.calendarId === next);
    /* Ein neuer Eintrag ist, was sein Kalender führt (Msze → msza) — man kann es danach ändern. */
    if (item === undefined) setKind(chosen?.itemKind ?? 'appointment');
    if (!endTouched && !allDay && chosen?.durationMinutes !== undefined) {
      const endAt = new Date(fromLocal(date, from).getTime() + chosen.durationMinutes * 60_000);
      setEndDate(localDate(endAt)); setTo(localTime(endAt));
    }
    setVisibility(null);
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
      if (pinnedChanged) await setPeople(item.occurrence.itemId, pinned, item.occurrence.occurrenceAt);
      return;
    }

    /* „Tylko ja" ohne eigenen Kalender: der private Bereich (und sein Standardkalender) entsteht jetzt. */
    const privateArea = calendarId === PRIVATE ? await ensurePrivateArea(me.ring, me.person, areas) : null;
    const seenBy = privateArea ?? (visibility ?? (defaultVisibility === PRIVATE ? personal?.areaId ?? PRIVATE : defaultVisibility));
    if (calendarId !== PRIVATE) recent.touch(calendarId);

    const cap = capacity.trim() === '' ? null : Math.max(1, Number(capacity) || 1);
    const following = item !== undefined && repeating && scope === 'following' && hasEarlier;
    const id = await saveEvent(me.ring, {
      /* Im eigenen Kalender gibt es keinen Gottesdienst — sonst bleibt die Art, was sie ist (auch ein Zadanie). */
      kind: isPrivate && isLiturgy(kind) ? 'appointment' : kind,
      parentItemId: following ? null : parentItemId,
      origin: target.at === 'new' ? target.origin ?? undefined : undefined,
      title, location, notes, link, linkLabel, areaId: seenBy,
      ownerRoleId: me.person.id,
      date, time: from, minutes, allDay,
      repeat, every, weekdays,
      until: repeat === 'none' ? null : ends === 'never' ? forever(startAt) : ends === 'date' ? until : null,
      count: repeat !== 'none' && ends === 'count' ? count : null,
      calendarId: calendarId === PRIVATE ? undefined : calendarId,
      bookable: booking === null ? null : bookable,
      capacity: booking === null ? null : cap,
      reserveAreaId: booking === null || reserveArea === '' ? null : reserveArea
    }, following ? undefined : item?.occurrence.itemId);

    /*
     * „TA I NASTĘPNE": die neue Reihe steht; jetzt endet die alte vor diesem
     * Tag und gibt ab, was an ihren Vorkommen hängt. Lehnt der Dienst ab (einer
     * Intention fehlte die Messe), fällt die neue Reihe wieder weg — sie trägt
     * noch nichts.
     */
    if (following && item !== undefined) {
      try {
        await handover(item.occurrence.itemId, id, item.occurrence.occurrenceAt);
      } catch (e) {
        await deleteEvent(id).catch(() => undefined);
        throw e;
      }
    }

    if (pinnedChanged && !isPrivate) await setPeople(id, pinned);

    /* Das Ganze ist geändert — seine Punkte ziehen nach („ten i następne" ist eine neue Reihe: deren Punkte bleiben am alten Teil). */
    if (item !== undefined && !following && parts.length > 0) {
      const failed = await followParent(me.ring, item, parts, {
        calendarId: calendarId === PRIVATE ? item.occurrence.calendarId : calendarId,
        areaId: seenBy, location, link, linkLabel,
        people: isPrivate ? null : pinned,
        shift: repeating || repeat !== 'none' ? 0 : startAt.getTime() - seriesStart.getTime()
      });
      if (failed > 0) throw new WorkspaceError(`Termin zapisany, ale ${failed} z ${parts.length} punktów programu nie udało się zmienić razem z nim.`);
    }
  });

  /* 0079 — die Reihe vor diesem Tag beenden: „od tego dnia już nie" (`endSeriesBefore`). */
  const endBefore = () => run(async () => {
    if (item !== undefined) await endSeriesBefore(me.ring, item);
  });

  const remove = async () => {
    if (item === undefined) return;
    if (repeating && scope === 'following' && hasEarlier) {
      if (await askText('Zakończyć serię przed tym dniem? Wcześniejsze terminy zostają.')) void endBefore();
      return;
    }
    const one = repeating && scope === 'one';
    if (!(await askText(one ? 'Odwołać tylko ten termin?' : 'Usunąć ten termin (całą serię)?'))) return;
    void run(() => one ? cancelOne(item.occurrence.itemId, item.occurrence.occurrenceAt) : deleteEvent(item.occurrence.itemId));
  };

  const onlyTime = item !== undefined && repeating && scope === 'one';
  const liturgy = !isPrivate && isLiturgy(kind);

  return (
    <Modal title={item === undefined ? `Nowy wpis: ${ITEM_LABEL[kind] ?? 'termin'}` : liturgy ? (ITEM_LABEL[kind] ?? 'Termin').replace(/^./, (c) => c.toUpperCase()) : 'Termin'} onClose={onClose} wide>
      {/* 0079 — was an dieser Messe gelesen wird, hier und nicht in einer anderen Ansicht. */}
      {item !== undefined && item.occurrence.kind === 'mass' && (
        <IntentionsPanel calendarId={item.occurrence.calendarId} itemId={item.occurrence.itemId}
          occurrenceAt={item.occurrence.occurrenceAt} start={start} editable />
      )}

      <form className="wk-form wk-ev-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        {repeating && (
          <div className="wk-seg wk-ev-scope" role="group" aria-label="Co zmieniasz">
            <button type="button" aria-pressed={scope === 'one'} className={scope === 'one' ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
              onClick={() => pickScope('one')}>Tylko ten termin</button>
            {hasEarlier && (
              <button type="button" aria-pressed={scope === 'following'} className={scope === 'following' ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
                onClick={() => pickScope('following')}>Ten i następne</button>
            )}
            <button type="button" aria-pressed={scope === 'all'} className={scope === 'all' ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
              onClick={() => pickScope('all')}>Cała seria</button>
          </div>
        )}

        {scope === 'following' && hasEarlier && (
          <p className="wk-hint">Zmiana obowiązuje od tego dnia — wcześniejsze terminy zostają, jak były. Intencje, obsada i zapisy przechodzą na nowe godziny według dnia.</p>
        )}
        {scope === 'all' && repeating && liturgy && hasEarlier && (
          <p className="wk-hint">Zmieniasz całą serię — także terminy, które już były. Zwykle właściwe jest „Ten i następne".</p>
        )}

        {!isPrivate && !onlyTime && (
          <label className="wk-field">
            <span>Rodzaj</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as ItemKind)}>
              {(KINDS_OFFERED.includes(kind) ? KINDS_OFFERED : [...KINDS_OFFERED, kind]).map((one) => <option key={one} value={one}>{ITEM_LABEL[one]}</option>)}
            </select>
            {kind === 'mass' && <span className="wk-hint">Msza przyjmuje intencje — tutaj i w „Msze i nabożeństwa".</span>}
          </label>
        )}

        <label className="wk-field">
          <span>{liturgy ? 'Nazwa (widoczna w gablocie)' : 'Tytuł'}</span>
          <input value={title} disabled={onlyTime} maxLength={200} list={kind === 'devotion' ? 'wk-devotion-names' : undefined}
            placeholder={kind === 'mass' ? 'np. Msza św. niedzielna — puste: sama godzina' : kind === 'devotion' ? 'np. Różaniec' : kind === 'confession' ? 'puste: „Spowiedź"' : 'np. Spotkanie z rodzicami'}
            onChange={(e) => setTitle(e.target.value)} />
          {kind === 'devotion' && <datalist id="wk-devotion-names">{DEVOTION_NAMES.map((n) => <option key={n} value={n} />)}</datalist>}
          {liturgy && <span className="wk-hint">Nazwa jest jawna — stoi w planie i w gablocie. Miejsce i notatka zostają zaszyfrowane.</span>}
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
            <input type="date" value={endDate} min={date} onChange={(e) => { setEndDate(e.target.value); setEndTouched(true); }} />
          </label>
          {!allDay && (
            <label className="wk-field">
              <span>godz.</span>
              <input type="time" value={to} step={300} onChange={(e) => { setTo(e.target.value); setEndTouched(true); }} />
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

            {/* 0058 — der Kalender: er sagt, wer sieht, wie lange, und ob man reservieren kann. */}
            <label className="wk-field">
              <span>Kalendarz</span>
              <select value={calendarId} onChange={(e) => pickCalendar(e.target.value)}>
                {offerPrivate && <option value={PRIVATE}>Tylko ja (prywatny)</option>}
                {privateCals.length > 0 && (
                  <optgroup label="Tylko ja">
                    {privateCals.map((c) => <option key={c.calendarId} value={c.calendarId}>{calendarLabel(areas, c)}</option>)}
                  </optgroup>
                )}
                {groupCals.length > 0 && (
                  <optgroup label="Kalendarze grup">
                    {groupCals.map((c) => <option key={c.calendarId} value={c.calendarId}>{calendarLabel(areas, c)}</option>)}
                  </optgroup>
                )}
              </select>
              <span className="wk-hint">
                {isPrivate ? 'Nikt poza Tobą — zaszyfrowane Twoim kluczem.'
                  : <>Widzą: <strong>{groupName(areas, visibility ?? defaultVisibility)}</strong>
                    {calendar?.itemKind !== undefined && calendar.itemKind !== 'appointment' && <> · terminy to {CALENDAR_KIND_LABEL[calendar.itemKind]}</>}</>}
              </span>
            </label>

            {calendar?.description && <p className="wk-ev-rules">{calendar.description}</p>}

            {!isPrivate && (
              <details className="wk-ev-more" open={visibility !== null}>
                <summary>Widoczność tego terminu</summary>
                <label className="wk-field">
                  <span>Kto widzi ten termin</span>
                  <AreaPick
                    label="Kto widzi ten termin" value={visibility ?? ''} onChange={(v) => setVisibility(v === '' ? null : v)}
                    areas={areas} only={writableGroups(areas)}
                    extras={[{ value: '', label: `jak w kalendarzu (${groupName(areas, defaultVisibility)})` }]}
                  />
                </label>
              </details>
            )}

            {booking !== null && (
              <fieldset className="wk-ev-booking">
                <legend>Rezerwacja</legend>
                <label className="wk-check">
                  <input type="checkbox" checked={bookableNow}
                    onChange={(e) => setBookable(e.target.checked === (booking.mode === 'all') ? null : e.target.checked)} />
                  <span>Ten termin można rezerwować</span>
                </label>
                {bookableNow && (
                  <div className="wk-ev-when-row">
                    <label className="wk-field wk-ev-every">
                      <span>Miejsc</span>
                      <input type="number" min={1} max={10000} value={capacity} placeholder={String(booking.capacity)}
                        onChange={(e) => setCapacity(e.target.value)} />
                    </label>
                    <label className="wk-field">
                      <span>Kto może rezerwować</span>
                      <AreaPick
                        label="Kto może rezerwować" value={reserveArea} onChange={setReserveArea}
                        areas={areas} only={areas.filter((a) => a.personal !== true)}
                        extras={[{ value: '', label: `jak w kalendarzu (${booking.reserveAreaId === null ? 'każdy, kto znajdzie termin' : groupName(areas, booking.reserveAreaId)})` }]}
                      />
                    </label>
                  </div>
                )}
              </fieldset>
            )}

            {!isPrivate && calendarArea !== null && (
              <div className="wk-field">
                <span>{peopleWord(kind)}</span>
                <PeoplePicker me={me} candidates={candidates} value={pinned} onChange={setPinned}
                  defaultDuty={dutyOf(kind)} />
              </div>
            )}

            <label className="wk-field">
              <span>Miejsce</span>
              <input value={location} maxLength={300} placeholder="np. salka parafialna" onChange={(e) => setLocation(e.target.value)} />
            </label>

            <label className="wk-field">
              <span>Notatka</span>
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>

            <div className="wk-ev-link">
              <label className="wk-field">
                <span>Link do informacji</span>
                <input type="text" inputMode="url" autoComplete="url" spellCheck={false} value={link} maxLength={1000} placeholder="https://… albo adres strony na recreatio.pl"
                  onChange={(e) => setLink(e.target.value)} />
              </label>
              <label className="wk-field">
                <span>Napis na przycisku</span>
                <input value={linkLabel} maxLength={60} placeholder="Więcej informacji" disabled={link.trim() === ''} onChange={(e) => setLinkLabel(e.target.value)} />
              </label>
              {link.trim() !== '' && safeLink(link) === null && <p className="wk-warn">Link musi zaczynać się od https:// (albo #/ dla strony na recreatio.pl).</p>}
              {link.trim() !== '' && safeLink(link) !== null && <p className="wk-hint">Na terminie: <ItemLink url={link} label={linkLabel} compact /></p>}
            </div>

            {/* 0070 — Teil eines Programms, oder ein Ganzes mit Teilen. 2026-10-17: was geteilt wird, steht dabei. */}
            {target.at === 'new' && target.parentItemId !== undefined && parentItemId === target.parentItemId && (
              <p className="wk-note">
                Punkt programu: <strong>{target.parentTitle ?? 'termin nadrzędny'}</strong> — kalendarz, widoczność, miejsce, link i osoby
                są wspólne z nim. Zmień tutaj tylko to, co w tym punkcie ma być inaczej.
              </p>
            )}
            {item !== undefined && ownParent !== undefined && parentItemId === undefined && (
              <p className="wk-note">
                Punkt programu: <strong>{ownParent.title}</strong> — to, co ma tak samo jak on, zmienia się razem z nim; to, co tu wpiszesz inaczej, zostaje.
              </p>
            )}
            {target.at === 'new' && target.origin !== undefined && (
              <p className="wk-note">Z rozmowy — termin zapamięta, z której wiadomości powstał.</p>
            )}
            {events !== undefined && (
              <ProgramOf
                itemId={item?.occurrence.itemId ?? null}
                start={fromLocal(date, allDay ? '00:00' : from)}
                end={allDay ? undefined : fromLocal(endDate, to)}
                events={events}
                parentId={parentItemId === undefined ? item?.occurrence.parentItemId ?? null : parentItemId}
                onParent={setParentItemId}
                onQuickAdd={item === undefined || !item.editable ? undefined : async (partTitle, at, minutes) => {
                  /* Der Punkt teilt alles mit dem Ganzen, wie es gespeichert ist — nur Name und Zeit sind seine. */
                  const id = await saveEvent(me.ring, {
                    ...draftOf(item), kind: 'appointment', title: partTitle, notes: '',
                    date: localDate(at), time: localTime(at), minutes, allDay: false,
                    repeat: 'none', every: 1, weekdays: 0, until: null, count: null,
                    parentItemId: item.occurrence.itemId
                  });
                  const people = item.occurrence.people ?? [];
                  if (people.length > 0) await setPeople(id, people);
                  onSaved();
                }}
                onOpen={onOpenPart}
                onLink={item === undefined ? undefined : async (child) => {
                  try { await setProgramParent(child, item.occurrence.itemId); onSaved(); }
                  catch (e) { setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się podłączyć terminu.'); }
                }}
                onUnlink={item === undefined ? undefined : async (child) => {
                  try { await setProgramParent(child, null); onSaved(); }
                  catch (e) { setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się odłączyć terminu.'); }
                }} />
            )}
            {parentItemId === null && item?.occurrence.parentItemId != null && (
              <p className="wk-hint">Po zapisaniu ten termin nie będzie już częścią programu.</p>
            )}
          </>
        )}

        {onlyTime && (
          <>
            <p className="wk-hint">Przesuwasz tylko ten jeden termin — reszta serii zostaje, jak była. Rezerwacje przechodzą razem z nim.</p>
            {!isPrivate && calendarArea !== null && (
              <div className="wk-field">
                <span>{peopleWord(kind)} — ten termin</span>
                <PeoplePicker me={me} candidates={candidates} value={pinned} onChange={setPinned}
                  defaultDuty={dutyOf(kind)} />
              </div>
            )}
          </>
        )}

        {failed !== null && <p className="wk-error">{failed}</p>}

        <div className="wk-actions">
          <button type="submit" className="wk-btn" disabled={busy}>{busy ? 'Zapisywanie…' : 'Zapisz'}</button>
          <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={onClose}>Anuluj</button>
          {item !== undefined && (
            <button type="button" className="wk-link-btn wk-danger wk-ev-delete" disabled={busy} onClick={remove}>
              {repeating && scope === 'one' ? 'Odwołaj ten termin' : repeating && scope === 'following' && hasEarlier ? 'Zakończ serię przed tym dniem' : 'Usuń'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

/** Was das Ganze nach dem Speichern sagt — `people: null`: dort niemanden (privat). */
interface ParentNow {
  readonly calendarId: string;
  readonly areaId: string;
  readonly location: string;
  readonly link: string;
  readonly linkLabel: string;
  readonly people: readonly Pinned[] | null;
  /** Um wie viel das Ganze (ein einzelner Termin) verschoben wurde — einzelne Punkte rücken mit. */
  readonly shift: number;
}

/**
 * 2026-10-17 — DIE PUNKTE ZIEHEN DEM GANZEN NACH. Ein Feld eines Punktes
 * folgt, wenn es vorher dasselbe war wie beim Ganzen; was ein Punkt anders
 * hat, bleibt. Punkte, die ich nicht ändern darf, bleiben, wie sie sind.
 * Gibt zurück, wie viele nicht gingen.
 */
async function followParent(ring: Ring, before: OpenedItem, parts: readonly OpenedItem[], now: ParentNow): Promise<number> {
  const was = before.occurrence;
  const samePeople = (a: readonly Pinned[] | undefined, b: readonly Pinned[] | undefined) =>
    JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
  let failed = 0;

  for (const part of parts) {
    if (!part.editable) continue;
    const draft = draftOf(part);
    const next = {
      ...draft,
      calendarId: part.occurrence.calendarId === was.calendarId ? now.calendarId : draft.calendarId,
      areaId: part.occurrence.visibilityAreaId === was.visibilityAreaId ? now.areaId : draft.areaId,
      location: (part.location ?? '') === (before.location ?? '') ? now.location : draft.location,
      link: (part.link ?? '') === (before.link ?? '') ? now.link : draft.link,
      linkLabel: (part.linkLabel ?? '') === (before.linkLabel ?? '') ? now.linkLabel : draft.linkLabel
    };
    if (now.shift !== 0 && part.occurrence.series.repeatKind === 'none') {
      const at = new Date(new Date(part.occurrence.series.startsAt).getTime() + now.shift);
      next.date = localDate(at);
      next.time = localTime(at);
    }

    try {
      if (JSON.stringify(next) !== JSON.stringify(draft)) await saveEvent(ring, next, part.occurrence.itemId);
      if (now.people !== null && samePeople(part.occurrence.people, was.people) && !samePeople(now.people, was.people)) {
        await setPeople(part.occurrence.itemId, now.people);
      }
    } catch {
      failed += 1;
    }
  }
  return failed;
}
