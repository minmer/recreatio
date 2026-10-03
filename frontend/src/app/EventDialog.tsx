/**
 * EIN TERMIN — anlegen, ändern, löschen; so, wie man es aus jedem Kalender
 * kennt: Titel, wann, ganztägig, Wiederholung, Ort, Notiz — und in welchem
 * Kalender.
 *
 * <b>Der Kalender gibt die Regeln vor</b> (0058): wer den Termin sieht, wie
 * lange er dauert, was er ist (Treffen, Messe), ob und von wem er reserviert
 * werden kann. Hier lässt sich jede davon für DIESEN Termin ändern — mehr
 * Plätze, nur für eine Gruppe, für andere Leute sichtbar.
 *
 * <b>Wer da sein muss</b>: Menschen der Gruppe, an den Termin geheftet — für
 * die ganze Reihe oder nur für dieses Vorkommen.
 *
 * <b>Bei einer Reihe wird gefragt, was gemeint ist</b>: nur dieser Termin
 * (verschieben oder absagen — mehr kann ein einzelnes Vorkommen nicht) oder
 * die ganze Reihe.
 *
 * <b>Was man hier nicht ändert, sagt es</b>: eine Messe (an ihr hängen
 * Intentionen) — nur, wer sie feiert; eine Buchung (sie gehört dem, der sie
 * genommen hat).
 */

import { useState } from 'react';

import {
  cancelOne, deleteEvent, ensurePrivateArea, forever, handover, isLiturgy, moveOne, saveEvent, type OpenedItem, type RepeatKind
} from './agenda';
import { areaPath, type AreaRow } from './area';
import { AreaOptions } from './AreaOptions';
import {
  CALENDAR_KIND_LABEL, DUTY_LABEL, ITEM_LABEL, safeLink, setPeople, setProgramParent,
  type CalendarRow, type Duty, type ItemKind
} from './calendar';
import { programOf, type CalEvent } from './calendarModel';
import { longDate } from './dayMath';
import type { Me } from './me';
import { ItemLink } from './ItemLink';
import { IntentionsPanel } from './IntentionsPanel';
import { DEVOTION_NAMES } from './mass';
import { Modal } from './Modal';
import { nameOfPinned, PeoplePicker, useAreaPeople, type Pinned } from './PeoplePicker';
import { useRecent } from './prefs';
import { WorkspaceError } from './session';
import { bitOf, fromLocal, groupName, localDate, localTime, PRIVATE, Weekdays, writableGroups } from './WhoSees';

const REPEATS: readonly { value: RepeatKind; label: string }[] = [
  { value: 'none', label: 'Nie powtarza się' },
  { value: 'daily', label: 'Codziennie' },
  { value: 'weekly', label: 'Co tydzień' },
  { value: 'monthly', label: 'Co miesiąc' },
  { value: 'yearly', label: 'Co rok' }
];

const time = (at: Date) => at.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

/**
 * Ein neuer Termin ab dieser Zeit — oder ein bestehender.
 *
 * 0070 — ein neuer kann ein TEIL eines anderen sein (`parentItemId`: ein
 * Punkt im Programm) und aus einer Rozmowa kommen (`origin`, mit Titel).
 */
export type EventTarget = {
    readonly at: 'new'; readonly start: Date; readonly end: Date; readonly allDay: boolean; readonly calendarId?: string;
    readonly parentItemId?: string; readonly parentTitle?: string;
    readonly origin?: { readonly chatId: string; readonly topicId: string | null };
    readonly title?: string;
  }
  | { readonly at: 'event'; readonly event: CalEvent };

/**
 * 0079 — WIE „wer da sein muss" heisst, nach der Art: wer die Messe feiert,
 * wer Beichte hört, wer das Nabożeństwo leitet. Und mit welcher Pflicht ein
 * neuer Name hineinkommt.
 */
const peopleWord = (kind: string): string =>
  kind === 'mass' ? 'Kto odprawia' : kind === 'confession' ? 'Kto spowiada' : kind === 'devotion' ? 'Kto prowadzi' : 'Kto musi być';
const dutyOf = (kind: string): Duty => (kind === 'mass' ? 'celebrant' : kind === 'devotion' ? 'lead' : 'present');

/** Die Arten, die ein Eintrag in einem Kalender einer Gruppe haben kann — in dieser Reihenfolge angeboten. */
const KINDS_OFFERED: readonly ItemKind[] = ['appointment', 'mass', 'confession', 'devotion', 'visit'];

/** Wie ein Kalender in einer Auswahl heisst: sein Name, und wessen er ist. */
export function calendarLabel(areas: readonly AreaRow[], calendar: CalendarRow): string {
  const area = areas.find((a) => a.areaId === calendar.areaId);
  if (area?.personal === true) return `${calendar.title} (tylko ja)`;
  const group = area !== undefined ? areaPath(areas, area.areaId).full : calendar.areaName;
  return calendar.title === calendar.areaName || calendar.title === group ? group : `${calendar.title} · ${group}`;
}

export function EventDialog({ me, areas, calendars, scope, target, events, onClose, onSaved, onAddPart }: {
  me: Me;
  areas: readonly AreaRow[];
  calendars: readonly CalendarRow[];
  /** Nur diese Kalender (ein Kalender-Baustein auf einer Seite) — fehlt: alle, in denen ich schreibe. */
  scope?: readonly string[];
  target: EventTarget;
  /** 0070 — die geladenen Termine: daraus die Teile dieses Termins und sein Ganzes. */
  events?: readonly CalEvent[];
  onClose: () => void;
  onSaved: () => void;
  /** 0070 — einen Punkt ins Programm dieses Termins (öffnet einen neuen Termin unter ihm). */
  onAddPart?: (parent: CalEvent) => void;
}) {
  if (target.at === 'event' && (target.event.source !== 'item' || !target.event.item?.editable)) {
    return <Details me={me} areas={areas} calendars={calendars} event={target.event} onClose={onClose} onSaved={onSaved} />;
  }

  return <Editor me={me} areas={areas} calendars={calendars} scope={scope} target={target} events={events}
    onClose={onClose} onSaved={onSaved} onAddPart={onAddPart} />;
}

/**
 * 0070 — DAS PROGRAMM EINES TERMINS: seine Teile (aus den geladenen
 * Terminen), in Reihenfolge — und, wenn er selbst ein Teil ist, sein Ganzes.
 */
function ProgramOf({ itemId, start, events, parentId, onParent, onAdd, onLink, onUnlink }: {
  /** `null`: ein neuer Termin — er kann ein Teil werden, aber noch keine haben. */
  itemId: string | null;
  start: Date;
  events: readonly CalEvent[];
  /** Das Ganze, wie es im Formular steht (gespeichert wird mit dem Termin). */
  parentId: string | null;
  onParent: (parentId: string | null) => void;
  onAdd?: () => void;
  /** 0074 — einen BESTEHENDEN Termin als Punkt einhängen (sofort, ohne ihn zu öffnen). */
  onLink?: (childItemId: string) => Promise<void>;
  onUnlink?: (childItemId: string) => Promise<void>;
}) {
  const [linking, setLinking] = useState(false);

  /* Je Termin einmal — eine Reihe steht sonst mit jedem Vorkommen da. */
  const items = new Map<string, CalEvent>();
  for (const e of events) {
    const place = programOf(e);
    if (place !== null && e.source === 'item' && !items.has(place.itemId)) items.set(place.itemId, e);
  }
  const parentOf = (id: string) => (items.get(id) === undefined ? null : programOf(items.get(id)!)?.parentItemId ?? null);
  const ancestors = new Set<string>();
  for (let up = parentId, depth = 0; up !== null && depth < 10; up = parentOf(up), depth += 1) ancestors.add(up);
  const isBelow = (id: string): boolean => {
    for (let up: string | null = id, depth = 0; up !== null && depth < 10; up = parentOf(up), depth += 1) if (up === itemId) return true;
    return false;
  };

  const parts = itemId === null ? [] : [...items.values()]
    .filter((e) => programOf(e)?.parentItemId === itemId)
    .sort((a, b) => ((programOf(a)?.position ?? 1e9) - (programOf(b)?.position ?? 1e9)) || a.start.getTime() - b.start.getTime());

  /* Nach Nähe in der Zeit — wer einen Ausflug baut, sucht die Termine desselben Tages. */
  const near = (a: CalEvent, b: CalEvent) => Math.abs(a.start.getTime() - start.getTime()) - Math.abs(b.start.getTime() - start.getTime());
  const parentChoices = [...items.entries()].filter(([id]) => id !== itemId && (itemId === null || !isBelow(id))).map(([, e]) => e).sort(near).slice(0, 60);
  const childChoices = itemId === null ? [] : [...items.entries()]
    .filter(([id, e]) => id !== itemId && !ancestors.has(id) && programOf(e)?.parentItemId !== itemId)
    .map(([, e]) => e).sort(near).slice(0, 60);
  const label = (e: CalEvent) => `${e.title} · ${e.allDay ? longDate(e.start) : `${longDate(e.start)} ${time(e.start)}`}`;

  return (
    <section className="wk-ev-program">
      <label className="wk-field">
        <span>Część programu</span>
        <select value={parentId ?? ''} onChange={(e) => onParent(e.target.value === '' ? null : e.target.value)}>
          <option value="">— osobny termin —</option>
          {parentId !== null && !items.has(parentId) && <option value={parentId}>(termin spoza widoku)</option>}
          {parentChoices.map((e) => <option key={programOf(e)!.itemId} value={programOf(e)!.itemId}>{label(e)}</option>)}
        </select>
        <span className="wk-hint">Punkt programu pokazuje się w kalendarzu wewnątrz swojego terminu.</span>
      </label>

      {itemId !== null && (
        <>
          <h3 className="wk-h3">Program</h3>
          {parts.length > 0 ? (
            <ol className="wk-ev-parts">
              {parts.map((p) => (
                <li key={programOf(p)!.itemId}>
                  <span className="wk-ev-part-time">{p.allDay ? longDate(p.start) : `${longDate(p.start)} ${time(p.start)}`}</span>
                  {' '}<span>{p.title}</span>
                  {p.item?.location != null && <span className="wk-hint"> · {p.item.location}</span>}
                  {onUnlink !== undefined && (
                    <> · <button type="button" className="wk-link-btn" disabled={linking}
                      onClick={() => { setLinking(true); void onUnlink(programOf(p)!.itemId).finally(() => setLinking(false)); }}>odłącz</button></>
                  )}
                </li>
              ))}
            </ol>
          ) : <p className="wk-hint">Ten termin nie ma jeszcze punktów programu.</p>}
          <div className="wk-actions wk-ev-program-add">
            {onAdd !== undefined && <button type="button" className="wk-link-btn" onClick={onAdd}>+ Nowy punkt programu</button>}
            {onLink !== undefined && childChoices.length > 0 && (
              <select value="" disabled={linking} aria-label="Podłącz istniejący termin"
                onChange={(e) => {
                  if (e.target.value === '') return;
                  setLinking(true);
                  void onLink(e.target.value).finally(() => setLinking(false));
                }}>
                <option value="">{linking ? 'Podłączanie…' : '+ Podłącz istniejący termin…'}</option>
                {childChoices.map((e) => <option key={programOf(e)!.itemId} value={programOf(e)!.itemId}>{label(e)}</option>)}
              </select>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/* -- Nur ansehen (und, wer den Kalender führt: wer da sein muss) --------------------------- */

function Details({ me, areas, calendars, event, onClose, onSaved }: {
  me: Me;
  areas: readonly AreaRow[];
  calendars: readonly CalendarRow[];
  event: CalEvent;
  onClose: () => void;
  onSaved: () => void;
}) {
  const item = event.item;
  const occurrence = item?.occurrence;
  const calendar = occurrence === undefined ? undefined : calendars.find((c) => c.calendarId === occurrence.calendarId);
  const mayPin = calendar?.mayWrite === true && occurrence !== undefined;
  const candidates = useAreaPeople(me, mayPin || (occurrence?.people?.length ?? 0) > 0 ? occurrence!.areaId : null);

  const [editing, setEditing] = useState(false);
  const [pinned, setPinned] = useState<readonly Pinned[]>(occurrence?.people ?? []);
  const [scope, setScope] = useState<'one' | 'all'>('all');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const when = event.allDay
    ? longDate(event.start)
    : `${longDate(event.start)}, ${time(event.start)}–${time(event.end)}`;
  const repeating = occurrence !== undefined && occurrence.series.repeatKind !== 'none';

  const savePeople = async () => {
    if (occurrence === undefined) return;
    setBusy(true);
    setFailed(null);
    try {
      await setPeople(occurrence.itemId, pinned, repeating && scope === 'one' ? occurrence.occurrenceAt : undefined);
      onSaved();
      setEditing(false);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={event.title} onClose={onClose}>
      <p className="wk-ev-when">{when}</p>
      <p className="wk-hint">
        {calendar !== undefined ? <>Kalendarz: {calendarLabel(areas, calendar)} · </> : null}
        Widzi: {groupName(areas, event.areaId)}
      </p>
      {calendar?.description && <p className="wk-ev-rules">{calendar.description}</p>}
      {item?.location && <p><strong>Miejsce:</strong> {item.location}</p>}
      {item?.notes && <p className="wk-ev-notes">{item.notes}</p>}
      {item?.link && <p><ItemLink url={item.link} label={item.linkLabel} /></p>}

      {/* 0079 — was an dieser Messe gelesen wird. */}
      {occurrence?.kind === 'mass' && (
        <IntentionsPanel calendarId={occurrence.calendarId} itemId={occurrence.itemId} occurrenceAt={occurrence.occurrenceAt}
          start={event.start} editable={calendar?.mayWrite === true} />
      )}

      {/* 0058 — wer da sein muss. */}
      {occurrence !== undefined && (occurrence.people?.length ?? 0) > 0 && !editing && (
        <p className="wk-ev-people">
          {occurrence.people!.map((p) => (
            <span key={p.roleId} className={`wk-ev-person${me.ring.has(p.roleId) ? ' is-me' : ''}`}>
              {DUTY_LABEL[p.duty]}: <strong>{me.ring.has(p.roleId) ? 'Ty' : nameOfPinned(me, candidates, p.roleId)}</strong>
            </span>
          ))}
        </p>
      )}

      {mayPin && editing && (
        <div className="wk-ev-pin">
          {repeating && (
            <div className="wk-seg" role="group" aria-label="Dla których terminów">
              <button type="button" aria-pressed={scope === 'one'} className={scope === 'one' ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
                onClick={() => setScope('one')}>Tylko ten termin</button>
              <button type="button" aria-pressed={scope === 'all'} className={scope === 'all' ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
                onClick={() => setScope('all')}>Cała seria</button>
            </div>
          )}
          <PeoplePicker me={me} candidates={candidates} value={pinned} onChange={setPinned} defaultDuty={dutyOf(occurrence?.kind ?? '')} />
          {failed !== null && <p className="wk-error">{failed}</p>}
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={busy} onClick={() => void savePeople()}>{busy ? 'Zapisywanie…' : 'Zapisz'}</button>
            <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={() => setEditing(false)}>Anuluj</button>
          </div>
        </div>
      )}

      {event.source === 'claim' && (
        <p className="wk-note">
          To Twoja rezerwacja ({event.claim?.status === 'confirmed' ? 'potwierdzona' : 'czeka na potwierdzenie'}).
          Zmienisz ją tam, gdzie ją zrobiłeś.
        </p>
      )}

      {item !== undefined && !item.editable && !mayPin && (
        <p className="wk-hint">Ten termin możesz tylko oglądać — w jego kalendarzu nie piszesz.</p>
      )}

      <div className="wk-actions">
        {mayPin && !editing && (
          <button type="button" className="wk-btn wk-btn-quiet" onClick={() => setEditing(true)}>
            {peopleWord(occurrence?.kind ?? '')}
          </button>
        )}
        <button type="button" className="wk-btn" onClick={onClose}>Zamknij</button>
      </div>
    </Modal>
  );
}

/* -- Anlegen und ändern -------------------------------------------------------------- */

function Editor({ me, areas, calendars, scope: allowed, target, events, onClose, onSaved, onAddPart }: {
  me: Me;
  areas: readonly AreaRow[];
  calendars: readonly CalendarRow[];
  scope?: readonly string[];
  target: EventTarget;
  events?: readonly CalEvent[];
  onClose: () => void;
  onSaved: () => void;
  onAddPart?: (parent: CalEvent) => void;
}) {
  const recent = useRecent('calendar.cal');
  const item: OpenedItem | undefined = target.at === 'event' ? target.event.item : undefined;
  const occurrence = item?.occurrence;
  const series = occurrence?.series;
  const personal = areas.find((a) => a.personal === true);

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
  const [location, setLocation] = useState(item?.location ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  /* 0073 — „Więcej informacji": wohin, und was auf dem Knopf steht. */
  const [link, setLink] = useState(item?.link ?? '');
  const [linkLabel, setLinkLabel] = useState(item?.linkLabel ?? '');

  /* Wer ihn sieht: was der Kalender sagt — ausser, dieser Termin sagt es anders. */
  const [visibility, setVisibility] = useState<string | null>(
    occurrence !== undefined && occurrence.visibilityAreaId !== defaultVisibility ? occurrence.visibilityAreaId : null);
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
  const [pinned, setPinned] = useState<readonly Pinned[]>(occurrence?.people ?? []);
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
  });

  /*
   * 0079 — DIE REIHE VOR DIESEM TAG BEENDEN: „od tego dnia już nie". Die
   * vergangenen Vorkommen bleiben, mit allem, was an ihnen hing. Hängen an
   * späteren noch Intentionen, sagt der Dienst welche, und ändert nichts.
   */
  const endBefore = () => run(async () => {
    if (item === undefined || series === undefined) return;
    const last = new Date(item.occurrence.occurrenceAt);
    last.setDate(last.getDate() - 1);
    await saveEvent(me.ring, {
      kind: (item.occurrence.kind as ItemKind) ?? 'appointment',
      title: item.named ? item.title : '', location: item.location ?? '', notes: item.notes ?? '',
      link: item.link ?? '', linkLabel: item.linkLabel ?? '',
      areaId: item.occurrence.visibilityAreaId, ownerRoleId: item.occurrence.ownerRoleId,
      date: localDate(seriesStart), time: localTime(seriesStart),
      minutes: Math.round((seriesEnd.getTime() - seriesStart.getTime()) / 60_000), allDay: item.occurrence.allDay,
      repeat: series.repeatKind as RepeatKind, every: series.repeatEvery, weekdays: series.repeatWeekdays ?? 0,
      until: localDate(last), count: series.repeatCount ?? null,
      calendarId: item.occurrence.calendarId,
      bookable: item.occurrence.bookable ?? null, capacity: item.occurrence.capacity ?? null,
      reserveAreaId: item.occurrence.reserveAreaId ?? null
    }, item.occurrence.itemId);
  });

  const remove = () => {
    if (item === undefined) return;
    if (repeating && scope === 'following' && hasEarlier) {
      if (window.confirm('Zakończyć serię przed tym dniem? Wcześniejsze terminy zostają.')) void endBefore();
      return;
    }
    const one = repeating && scope === 'one';
    if (!window.confirm(one ? 'Odwołać tylko ten termin?' : 'Usunąć ten termin (całą serię)?')) return;
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
                  <select value={visibility ?? ''} onChange={(e) => setVisibility(e.target.value === '' ? null : e.target.value)}>
                    <option value="">jak w kalendarzu ({groupName(areas, defaultVisibility)})</option>
                    <optgroup label="Inna grupa">
                      <AreaOptions areas={areas} only={writableGroups(areas)} />
                    </optgroup>
                  </select>
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
                      <select value={reserveArea} onChange={(e) => setReserveArea(e.target.value)}>
                        <option value="">jak w kalendarzu ({booking.reserveAreaId === null ? 'każdy, kto znajdzie termin' : groupName(areas, booking.reserveAreaId)})</option>
                        <optgroup label="Tylko osoby z grupy (i grup pod nią)">
                          <AreaOptions areas={areas} only={areas.filter((a) => a.personal !== true)} />
                        </optgroup>
                      </select>
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

            {/* 0070 — Teil eines Programms, oder ein Ganzes mit Teilen. */}
            {target.at === 'new' && target.parentItemId !== undefined && parentItemId === target.parentItemId && (
              <p className="wk-note">Punkt programu: <strong>{target.parentTitle ?? 'termin nadrzędny'}</strong></p>
            )}
            {target.at === 'new' && target.origin !== undefined && (
              <p className="wk-note">Z rozmowy — termin zapamięta, z której wiadomości powstał.</p>
            )}
            {events !== undefined && (
              <ProgramOf
                itemId={item?.occurrence.itemId ?? null}
                start={fromLocal(date, allDay ? '00:00' : from)}
                events={events}
                parentId={parentItemId === undefined ? item?.occurrence.parentItemId ?? null : parentItemId}
                onParent={setParentItemId}
                onAdd={onAddPart === undefined || target.at !== 'event' ? undefined : () => onAddPart(target.event)}
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

export default EventDialog;
