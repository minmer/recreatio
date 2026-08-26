/**
 * Kalender — Termine, Aufgaben, Wiederholungen.
 *
 * Drei Dinge trägt diese Ansicht:
 *
 *   1. **Die drei Arten von „kein Titel" sehen verschieden aus.** *Belegt*
 *      heisst „es gibt nichts Öffentliches zu sagen"; *versiegelt* heisst
 *      „hier steht etwas, das du nicht öffnen kannst". Beides gleich
 *      darzustellen wäre die Art Fehler, die niemandem auffällt — und die
 *      dazu führt, dass jemand einen Tag für leer hält, an dem er es nicht
 *      ist.
 *
 *   2. **Überschneidungen werden gemeldet.** Das ist der sichtbare Gegenwert
 *      dafür, dass die Zeiten im Klartext liegen — der Satz daneben sagt das
 *      auch so.
 *
 *   3. **Was öffentlich wird und was nicht, steht an den Feldern.** Wie beim
 *      Formular für eine Intention: zwei Eingaben, die gleich aussehen und es
 *      nicht sind, brauchen verschiedene Ränder und je einen Satz darunter.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { rcCopy, rcPlural, type RcLang } from './i18n';
import type { RcArea, RcRole } from './lib/rcChat';
import {
  RC_REPEAT_KINDS, RC_VISIBILITIES, RC_WEEKDAY_BITS,
  rcAddItem, rcByDay, rcCalendars, rcCancelOccurrence, rcCreateCalendar,
  rcOccurrenceLabel, rcOccurrences, rcOverlaps,
  type RcCalendar, type RcOccurrence, type RcRepeatKind, type RcVisibility
} from './lib/rcCalendar';
import { useRcError } from './RcThreads';

export function RcCalendarSection({
  lang, areas, roles, unlocked, onError
}: {
  lang: RcLang;
  areas: readonly RcArea[];
  roles: readonly RcRole[];
  unlocked: boolean;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].cal;
  const describe = useRcError(lang);

  const [list, setList] = useState<readonly RcCalendar[]>([]);
  const [open, setOpen] = useState<RcCalendar | null>(null);

  const refresh = useCallback(async () => {
    if (!unlocked) return;
    try { setList((await rcCalendars()).calendars ?? []); }
    catch (e) { onError(describe(e)); }
  }, [unlocked, describe, onError]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (!unlocked) return <p className="rc-note">{rcCopy[lang].chat.locked}</p>;

  if (open !== null) {
    return (
      <RcCalendarDetail
        lang={lang}
        calendar={open}
        roles={roles}
        onBack={() => { setOpen(null); void refresh(); }}
        onError={onError}
      />
    );
  }

  const usable = areas.filter((a) => a.canCertify);

  return (
    <div className="rc-panel">
      {list.length === 0 && <p className="rc-note">{t.none}</p>}

      <ul className="rc-event-list">
        {list.map((calendar) => (
          <li key={calendar.calendarId} className="rc-event-row">
            <button type="button" className="rc-event-open" onClick={() => setOpen(calendar)}>
              <span className="rc-event-title">{calendar.title}</span>
              <span className="rc-event-meta">
                <code>{calendar.timeZone}</code> · {calendar.items}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {usable.length > 0 && (
        <RcNewCalendar lang={lang} areas={usable} onDone={refresh} onError={onError} />
      )}
    </div>
  );
}

function RcNewCalendar({
  lang, areas, onDone, onError
}: {
  lang: RcLang;
  areas: readonly RcArea[];
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].cal;
  const describe = useRcError(lang);

  const [areaId, setAreaId] = useState(areas[0]?.areaId ?? '');
  const [title, setTitle] = useState('');

  // Die Zone des Browsers ist der beste Vorschlag, den es gibt — und sie ist
  // sichtbar, damit sie jemand ändern kann, statt sie zu erben.
  const [zone, setZone] = useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
    catch { return 'Europe/Warsaw'; }
  });

  const [busy, setBusy] = useState(false);

  return (
    <form
      className="rc-new-event"
      onSubmit={async (e) => {
        e.preventDefault();
        if (title.trim().length === 0 || busy) return;
        setBusy(true);
        try {
          await rcCreateCalendar(areaId, title, zone);
          setTitle('');
          await onDone();
        } catch (err) {
          onError(describe(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h5 className="rc-chat-h">{t.create}</h5>

      {areas.length > 1 && (
        <label className="rc-inline-field">
          <span>{rcCopy[lang].chat.areas}</span>
          <select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            {areas.map((a) => (
              <option key={a.areaId} value={a.areaId}>{a.title ?? a.areaId.slice(0, 8)}</option>
            ))}
          </select>
        </label>
      )}

      <label className="rc-field">
        <span>{t.title}</span>
        <input type="text" value={title} disabled={busy} onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label className="rc-field">
        <span>{t.zone}</span>
        <input type="text" value={zone} disabled={busy} onChange={(e) => setZone(e.target.value)} />
      </label>
      <p className="rc-note rc-hint">{t.zoneWhy}</p>

      <button type="submit" className="rc-btn" disabled={busy || title.trim().length === 0}>
        {t.make}
      </button>
    </form>
  );
}

// -- Ein Kalender -------------------------------------------------------------

function RcCalendarDetail({
  lang, calendar, roles, onBack, onError
}: {
  lang: RcLang;
  calendar: RcCalendar;
  roles: readonly RcRole[];
  onBack: () => void;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].cal;
  const describe = useRcError(lang);

  // Ein Fenster von vier Wochen ab heute. Weiter zu blättern ist eine eigene
  // Handlung — eine Liste, die stillschweigend ein Jahr lädt, ist langsam
  // und niemand hat darum gebeten.
  const [from] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 1);
    return d.toISOString();
  });
  const [weeks, setWeeks] = useState(4);

  const to = useMemo(() => {
    const d = new Date(from);
    d.setDate(d.getDate() + weeks * 7);
    return d.toISOString();
  }, [from, weeks]);

  const [occurrences, setOccurrences] = useState<readonly RcOccurrence[]>([]);

  const refresh = useCallback(async () => {
    try { setOccurrences((await rcOccurrences(calendar.calendarId, from, to)).occurrences ?? []); }
    catch (e) { onError(describe(e)); }
  }, [calendar.calendarId, from, to, describe, onError]);

  useEffect(() => { void refresh(); }, [refresh]);

  const days = useMemo(
    () => rcByDay(occurrences, lang, calendar.timeZone),
    [occurrences, lang, calendar.timeZone]);

  const clashes = useMemo(() => rcOverlaps(occurrences), [occurrences]);

  const writable = roles.find((r) => r.hasKey) ?? roles[0];

  return (
    <div className="rc-panel">
      <header className="rc-event-head">
        <button type="button" className="rc-link" onClick={onBack}>←</button>
        <h3>{calendar.title}</h3>
        <span className="rc-event-meta"><code>{calendar.timeZone}</code></span>
      </header>

      {/* Der sichtbare Gegenwert dafür, dass die Zeiten im Klartext liegen. */}
      {clashes.length > 0 && (
        <div className="rc-clash">
          <strong>{rcPlural(lang, t.clashes, clashes.length)}</strong>
          <p className="rc-note">{t.clashWhy}</p>
        </div>
      )}

      {days.length === 0 && <p className="rc-note">{t.nothing}</p>}

      {days.map(([day, ofDay]) => (
        <section key={day} className="rc-cal-day">
          <h5>{day}</h5>
          {ofDay.map((occurrence) => (
            <RcOccurrenceRow
              key={`${occurrence.itemId}:${occurrence.originalStartUtc}`}
              lang={lang}
              occurrence={occurrence}
              timeZone={calendar.timeZone}
              onChanged={refresh}
              onError={onError}
            />
          ))}
        </section>
      ))}

      <div className="rc-cal-more">
        <button type="button" className="rc-btn rc-btn-quiet" onClick={() => setWeeks(weeks + 4)}>
          + 4
        </button>
      </div>

      {writable && (
        <RcNewItem
          lang={lang}
          calendarId={calendar.calendarId}
          role={writable}
          onDone={refresh}
          onError={onError}
        />
      )}
    </div>
  );
}

function RcOccurrenceRow({
  lang, occurrence, timeZone, onChanged, onError
}: {
  lang: RcLang;
  occurrence: RcOccurrence;
  timeZone: string;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].cal;
  const describe = useRcError(lang);
  const label = rcOccurrenceLabel(occurrence);

  const time = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString(lang,
        { hour: '2-digit', minute: '2-digit', timeZone });
    } catch {
      return new Date(iso).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
    }
  };

  return (
    <article className="rc-cal-item" data-kind={label.kind} data-status={occurrence.status}>
      <time dateTime={occurrence.startsUtc}>
        {occurrence.allDay ? '—' : `${time(occurrence.startsUtc)}–${time(occurrence.endsUtc)}`}
      </time>

      <div className="rc-cal-main">
        {/* Drei Arten von „kein Titel", drei Darstellungen. Sie gleich zu
            setzen hiesse, einen verschlossenen Termin für einen leeren Tag
            zu halten. */}
        {label.kind === 'named' && (
          <span className="rc-cal-title" data-detailed={label.detailed}>{label.text}</span>
        )}
        {label.kind === 'busy' && <span className="rc-cal-busy">{t.busy}</span>}
        {label.kind === 'sealed' && <span className="rc-cal-sealed">{t.sealedItem}</span>}

        {occurrence.location !== null && occurrence.location !== undefined && (
          <span className="rc-cal-where">{occurrence.location}</span>
        )}

        {occurrence.moved && <span className="rc-cal-moved">{t.moved}</span>}
      </div>

      {occurrence.mine && (
        <button
          type="button"
          className="rc-msg-action"
          title={t.seriesKept}
          onClick={async () => {
            try {
              await rcCancelOccurrence(occurrence.itemId, occurrence.originalStartUtc);
              await onChanged();
            } catch (e) {
              onError(describe(e));
            }
          }}
        >
          {t.cancelOne}
        </button>
      )}
    </article>
  );
}

// -- Anlegen ------------------------------------------------------------------

/**
 * Der Kern des Formulars: zwei Titelfelder, die gleich aussehen und es nicht
 * sind. Unter jedem steht, was mit dem geschieht, was man hineinschreibt.
 */
function RcNewItem({
  lang, calendarId, role, onDone, onError
}: {
  lang: RcLang;
  calendarId: string;
  role: RcRole;
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].cal;
  const describe = useRcError(lang);

  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [titlePublic, setTitlePublic] = useState('');
  const [title, setTitle] = useState('');
  const [where, setWhere] = useState('');
  const [notes, setNotes] = useState('');
  const [visibility, setVisibility] = useState<RcVisibility>('area');
  const [repeat, setRepeat] = useState<RcRepeatKind>('none');
  const [every, setEvery] = useState(1);
  const [count, setCount] = useState(4);
  const [weekdays, setWeekdays] = useState(0);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="rc-new-intention"
      onSubmit={async (e) => {
        e.preventDefault();
        if (start === '' || end === '' || busy) return;
        setBusy(true);
        try {
          await rcAddItem(calendarId, role.roleId,
            new Date(start).toISOString(), new Date(end).toISOString(), {
              allDay,
              titlePublic: titlePublic.trim() || undefined,
              title: title.trim() || undefined,
              location: where.trim() || undefined,
              notes: notes.trim() || undefined,
              visibility,
              repeatKind: repeat,
              repeatEvery: every,
              repeatWeekdays: repeat === 'weekly' && weekdays > 0 ? weekdays : undefined,
              repeatCount: repeat === 'none' ? undefined : count
            });

          setTitlePublic(''); setTitle(''); setWhere(''); setNotes('');
          await onDone();
        } catch (err) {
          onError(describe(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h5 className="rc-chat-h">{t.add}</h5>

      <div className="rc-poll-opts">
        <label className="rc-inline-field">
          <span>{t.when}</span>
          <input type="datetime-local" value={start} disabled={busy}
            onChange={(e) => {
              setStart(e.target.value);
              // Ein Ende vor dem Anfang weist der Dienst ab. Es gleich
              // mitzusetzen erspart die Absage, statt sie zu erklären.
              if (end === '' || end < e.target.value) {
                const d = new Date(e.target.value);
                d.setHours(d.getHours() + 1);
                setEnd(d.toISOString().slice(0, 16));
              }
            }} />
        </label>

        <label className="rc-inline-field">
          <span>{t.until}</span>
          <input type="datetime-local" value={end} disabled={busy}
            onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>

      <label className="rc-check">
        <input type="checkbox" checked={allDay} disabled={busy}
          onChange={(e) => setAllDay(e.target.checked)} />
        <span>{t.allDay}</span>
      </label>

      {/* Öffentlich: Klartext. */}
      <label className="rc-field rc-field-public">
        <span>{t.publicTitle}</span>
        <input type="text" value={titlePublic} disabled={busy}
          onChange={(e) => setTitlePublic(e.target.value)} />
      </label>
      <p className="rc-note rc-why-public">{t.publicWhy}</p>

      {/* Versiegelt. */}
      <label className="rc-field rc-field-internal">
        <span>{t.privateTitle}</span>
        <input type="text" value={title} disabled={busy}
          onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label className="rc-field rc-field-internal">
        <span>{t.where}</span>
        <input type="text" value={where} disabled={busy} onChange={(e) => setWhere(e.target.value)} />
      </label>

      <label className="rc-field rc-field-internal">
        <span>{t.notes}</span>
        <textarea rows={2} value={notes} disabled={busy} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <p className="rc-note rc-why-internal">{t.privateWhy}</p>

      <div className="rc-poll-opts">
        <label className="rc-inline-field">
          <span>{t.visibility}</span>
          <select value={visibility} disabled={busy}
            onChange={(e) => setVisibility(e.target.value as RcVisibility)}>
            {RC_VISIBILITIES.map((v) => (
              <option key={v} value={v}>{t.visibilities[v] ?? v}</option>
            ))}
          </select>
        </label>

        <label className="rc-inline-field">
          <span>{t.repeat}</span>
          <select value={repeat} disabled={busy}
            onChange={(e) => setRepeat(e.target.value as RcRepeatKind)}>
            {RC_REPEAT_KINDS.map((r) => (
              <option key={r} value={r}>{t.repeats[r] ?? r}</option>
            ))}
          </select>
        </label>
      </div>

      {repeat !== 'none' && (
        <>
          <div className="rc-poll-opts">
            <label className="rc-inline-field">
              <span>{t.every}</span>
              <input type="number" min={1} max={52} value={every} disabled={busy}
                onChange={(e) => setEvery(Number(e.target.value))} />
            </label>

            {/* Eine Wiederholung braucht ein Ende. Es steht deshalb da, sobald
                eine gewählt wird — nicht als Absage hinterher. */}
            <label className="rc-inline-field">
              <span>{t.times}</span>
              <input type="number" min={1} max={200} value={count} disabled={busy}
                onChange={(e) => setCount(Number(e.target.value))} />
            </label>
          </div>

          {repeat === 'weekly' && (
            <div className="rc-weekdays">
              {t.weekdays.map((name, i) => (
                <label key={name} className="rc-weekday">
                  <input
                    type="checkbox"
                    checked={(weekdays & RC_WEEKDAY_BITS[i]) !== 0}
                    disabled={busy}
                    onChange={(e) => setWeekdays(e.target.checked
                      ? weekdays | RC_WEEKDAY_BITS[i]
                      : weekdays & ~RC_WEEKDAY_BITS[i])}
                  />
                  <span>{name}</span>
                </label>
              ))}
            </div>
          )}

          <p className="rc-note rc-hint">{t.repeatWhy}</p>
        </>
      )}

      <button type="submit" className="rc-btn" disabled={busy || start === '' || end === ''}>
        {t.add}
      </button>
    </form>
  );
}
