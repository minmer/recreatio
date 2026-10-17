/**
 * EINEN TERMINARZ WÄHLEN — die Termine einer Gruppe, statt einer Kennung.
 *
 * Der Messplan fragte nach „Kennung kalendarza", und eingetippt hat die
 * niemand. Seit 0054 hat jede Gruppe genau einen Terminarz; gewählt wird also
 * die GRUPPE, mit ihrem Namen. Leer heisst weiterhin: alle offenen zusammen —
 * der Plan eines Dekanats.
 */

import { useEffect, useState } from 'react';

import { loadCalendars, loadItems, type CalendarRow, type Occurrence } from './calendar';
import { termsText } from '../steps/candidateTasks';
import { areaKeys } from '../chat/chat';
import { aad, Field, fromBase64Url, openText } from '../core/crypto';
import { keysFor } from '../core/ringOf';
import { whoIsThere } from '../core/session';
import { Loading } from '../ui/Loading';

export function PickCalendar({ value, busy, onPick, allowAll = true }: {
  value: string;
  busy: boolean;
  onPick: (calendarId: string) => void;
  /** 0099 — ohne „Wszystkie jawne razem": wo ein einzelner Kalender gemeint ist. */
  allowAll?: boolean;
}) {
  const [rows, setRows] = useState<readonly CalendarRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    loadCalendars()
      .then(({ calendars }) => { if (alive) setRows(calendars); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, []);

  if (rows === null) return <Loading label="Wczytywanie terminarzy…" />;

  const known = value === '' || rows.some((r) => r.calendarId === value);

  return (
    <>
      <select value={known ? value : ''} disabled={busy} onChange={(e) => onPick(e.target.value)}>
        <option value="">{allowAll ? 'Wszystkie jawne razem (plan zbiorczy)' : '— wybierz kalendarz —'}</option>
        {rows.map((r) => (
          <option key={r.calendarId} value={r.calendarId}>
            {r.areaName}{r.title !== r.areaName ? ` (${r.title})` : ''}
          </option>
        ))}
      </select>

      {!known && (
        <span className="wk-blocker">
          Teraz stoi tu „{value}" — to nie jest terminarz żadnej z Twoich grup. Wybierz właściwy.
        </span>
      )}
    </>
  );
}

export default PickCalendar;

/**
 * MEHRERE KALENDER WÄHLEN (0058) — für den Baustein „Kalendarz": welche
 * Termine er zeigt. Gespeichert als Kennungen mit Komma.
 */
export function PickCalendars({ value, busy, onPick }: {
  value: string;
  busy: boolean;
  onPick: (calendarIds: string) => void;
}) {
  const [rows, setRows] = useState<readonly CalendarRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    loadCalendars()
      .then(({ calendars }) => { if (alive) setRows(calendars.filter((c) => c.archived !== true)); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, []);

  if (rows === null) return <Loading label="Wczytywanie kalendarzy…" />;

  const chosen = value.split(',').map((one) => one.trim()).filter((one) => one !== '');
  const toggle = (id: string) => onPick((chosen.includes(id) ? chosen.filter((one) => one !== id) : [...chosen, id]).join(','));

  if (rows.length === 0) return <p className="wk-hint">Nie masz jeszcze żadnego kalendarza grupy.</p>;

  return (
    <div className="wk-pick-cals">
      {rows.map((r) => (
        <label key={r.calendarId} className="wk-check">
          <input type="checkbox" checked={chosen.includes(r.calendarId)} disabled={busy} onChange={() => toggle(r.calendarId)} />
          <span>{r.title}{r.title !== r.areaName ? <span className="wk-hint"> · {r.areaName}</span> : null}</span>
        </label>
      ))}
      {chosen.some((id) => !rows.some((r) => r.calendarId === id)) && (
        <span className="wk-blocker">Jeden z wybranych kalendarzy nie jest już dostępny — zaznacz właściwe.</span>
      )}
      <span className="wk-hint">
        Na stronie każdy zobaczy terminy, które może widzieć. W pełnym ekranie osoby prowadzące kalendarz mogą też dodawać i zmieniać terminy.
      </span>
    </div>
  );
}

/**
 * 0070 — EINEN TERMIN WÄHLEN: für den Baustein „Program" — welches Ganze er
 * zeigt. Angeboten werden die Termine des gewählten Kalenders vom letzten
 * Monat bis ein Jahr voraus, mit geöffnetem Titel; wer Teile hat, steht oben.
 */
export function PickCalendarItem({ calendarId, value, busy, onPick, withParts = true }: {
  calendarId: string;
  value: string;
  busy: boolean;
  /** 0099 — mit dem ersten und letzten Termin (und wie viele), damit ein Zeitraum daran anschliessen kann. */
  onPick: (itemId: string, found?: { readonly start: Date; readonly last: Date; readonly count: number }) => void;
  /** Der Hinweis auf Programmpunkte (für den Baustein „Program"). */
  withParts?: boolean;
}) {
  const [rows, setRows] = useState<readonly { itemId: string; title: string; start: Date; last: Date; count: number; parts: number }[] | null>(null);

  useEffect(() => {
    if (calendarId === '') { setRows([]); return undefined; }
    let alive = true;
    void (async () => {
      try {
        const now = Date.now();
        const days = await loadItems(calendarId, new Date(now - 31 * 86400_000), new Date(now + 365 * 86400_000));
        const who = await whoIsThere();
        const ring = who === null ? null : (await keysFor(who)).ring;
        const firsts = new Map<string, Occurrence>();
        const lasts = new Map<string, Occurrence>();
        const counts = new Map<string, number>();
        for (const o of days.occurrences) {
          if (!firsts.has(o.itemId)) firsts.set(o.itemId, o);
          lasts.set(o.itemId, o);
          counts.set(o.itemId, (counts.get(o.itemId) ?? 0) + 1);
        }
        const parts = new Map<string, number>();
        for (const o of firsts.values()) {
          const parent = o.parentItemId;
          if (parent != null) parts.set(parent, (parts.get(parent) ?? 0) + 1);
        }
        const out: { itemId: string; title: string; start: Date; last: Date; count: number; parts: number }[] = [];
        for (const o of firsts.values()) {
          let title = o.titlePublic ?? 'Termin';
          const sealedTitle = o.fields.find((f) => f.field === 'title');
          if (ring !== null && sealedTitle !== undefined) {
            try {
              const key = (await areaKeys(ring, sealedTitle.areaId)).get(sealedTitle.epoch);
              if (key !== undefined) {
                title = await openText(key, aad('calendar', 'item', o.itemId, Field.CalendarEventTitle, 1), fromBase64Url(sealedTitle.sealed));
              }
            } catch { /* der offene Titel */ }
          }
          out.push({
            itemId: o.itemId, title, start: new Date(o.startsAt), last: new Date((lasts.get(o.itemId) ?? o).startsAt),
            count: counts.get(o.itemId) ?? 1, parts: parts.get(o.itemId) ?? 0
          });
        }
        out.sort((a, b) => (b.parts > 0 ? 1 : 0) - (a.parts > 0 ? 1 : 0) || a.start.getTime() - b.start.getTime());
        if (alive) setRows(out);
      } catch {
        if (alive) setRows([]);
      }
    })();
    return () => { alive = false; };
  }, [calendarId]);

  if (calendarId === '') return <p className="wk-hint">Najpierw wybierz kalendarz.</p>;
  if (rows === null) return <Loading label="Wczytywanie terminów…" />;
  if (rows.length === 0) return <p className="wk-hint">W tym kalendarzu nie ma terminów w najbliższym roku.</p>;

  const known = value === '' || rows.some((r) => r.itemId === value);

  return (
    <>
      <select value={known ? value : ''} disabled={busy} data-pick-item=""
        onChange={(e) => onPick(e.target.value, rows.find((r) => r.itemId === e.target.value))}>
        <option value="">— wybierz termin —</option>
        {rows.map((r) => (
          <option key={r.itemId} value={r.itemId}>
            {r.start.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })} · {r.title}
            {r.count > 1 ? ` (seria: ${termsText(r.count)})` : ''}
            {r.parts > 0 ? ` (${r.parts} pkt. programu)` : ''}
          </option>
        ))}
      </select>
      {!known && <span className="wk-blocker">Wybrany termin nie należy do tego kalendarza (albo jest dawno) — wybierz inny.</span>}
      {withParts && <span className="wk-hint">Punkty programu dodasz w kalendarzu: otwórz termin i „Dodaj punkt programu".</span>}
    </>
  );
}
