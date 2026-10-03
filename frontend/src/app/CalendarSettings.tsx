/**
 * EIN KALENDER ALS GANZES (0058) — anlegen und seine Regeln stellen.
 *
 * Bevor der erste Termin darin steht, sagt der Kalender, wie seine Termine
 * funktionieren: wer sie führt, wer sie sieht, was sie sind (Treffen, Messen
 * …), wie lange sie dauern, und ob und von wem sie reserviert werden können.
 * Jeder neue Termin übernimmt das; ein einzelner kann es für sich ändern.
 *
 * <code>
 *   Kto prowadzi          die Gruppe des Kalenders — wer dort schreibt, trägt ein
 *   Kto widzi             dieselbe Gruppe, oder eine andere (die ganze Pfarrei)
 *   Rezerwacje            niemand · jeder Termin · nur oznaczone —
 *                         wie viele Plätze, wer bestätigt, wer reservieren darf
 * </code>
 */

import { useState } from 'react';

import { ensurePrivateArea } from './agenda';
import { areaPath, type AreaRow } from './area';
import { AreaOptions } from './AreaOptions';
import {
  addCalendar, CALENDAR_KIND_LABEL, saveCalendarRules, type CalendarKind, type CalendarRow, type CalendarRules
} from './calendar';
import type { Me } from './me';
import { Modal } from './Modal';
import { WorkspaceError } from './session';
import { PRIVATE, writableGroups } from './WhoSees';

const KINDS: readonly CalendarKind[] = ['appointment', 'mass', 'confession', 'devotion', 'visit'];
const DURATIONS: readonly number[] = [15, 20, 30, 40, 45, 60, 90, 120, 180, 240];

type BookingMode = 'none' | 'all' | 'marked';

export function CalendarSettings({ me, areas, calendar, onClose, onSaved }: {
  me: Me;
  areas: readonly AreaRow[];
  /** Ein bestehender — oder \`null\` für einen neuen. */
  calendar: CalendarRow | null;
  onClose: () => void;
  onSaved: (calendarId: string) => void;
}) {
  const personal = areas.find((a) => a.personal === true);
  const writable = writableGroups(areas);

  const [title, setTitle] = useState(calendar?.title ?? '');
  const [description, setDescription] = useState(calendar?.description ?? '');
  const [owner, setOwner] = useState(calendar?.areaId ?? personal?.areaId ?? PRIVATE);
  const [visibility, setVisibility] = useState(calendar?.visibilityAreaId ?? '');
  const [kind, setKind] = useState<CalendarKind>(calendar?.itemKind ?? 'appointment');
  const [duration, setDuration] = useState(calendar?.durationMinutes ?? 60);
  const [mode, setMode] = useState<BookingMode>(calendar?.booking?.mode ?? 'none');
  const [capacity, setCapacity] = useState(calendar?.booking?.capacity ?? 1);
  const [approval, setApproval] = useState<'none' | 'office'>(calendar?.booking?.approval ?? 'none');
  const [reserveArea, setReserveArea] = useState(calendar?.booking?.reserveAreaId ?? '');
  const [perPerson, setPerPerson] = useState(calendar?.booking?.perPerson ?? 0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const ownerIsPrivate = owner === PRIVATE || owner === personal?.areaId;

  const save = async (archive = false) => {
    if (title.trim() === '' && !archive) { setFailed('Kalendarz potrzebuje nazwy.'); return; }
    setBusy(true);
    setFailed(null);
    try {
      const rules: CalendarRules = archive ? { archived: true } : {
        title: title.trim(),
        description: description.trim(),
        itemKind: kind,
        /* Prywatny kalendarz widzi tylko jego właściciel — innej widoczności tu nie ma. */
        visibilityAreaId: ownerIsPrivate ? '' : visibility,
        durationMinutes: duration,
        booking: mode === 'none' || ownerIsPrivate
          ? { mode: 'none' }
          : { mode, capacity, approval, reserveAreaId: reserveArea, perPerson }
      };

      if (calendar !== null) {
        await saveCalendarRules(calendar.calendarId, rules);
        onSaved(calendar.calendarId);
      } else {
        const areaId = owner === PRIVATE ? await ensurePrivateArea(me.ring, me.person, areas) : owner;
        const made = await addCalendar(areaId, title.trim(), rules);
        onSaved(made.calendarId);
      }
      onClose();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać kalendarza.');
    } finally {
      setBusy(false);
    }
  };

  const ownerName = calendar === null ? null
    : calendar.areaId === personal?.areaId ? 'Tylko ja (prywatny)' : areaPath(areas, calendar.areaId).full || calendar.areaName;

  return (
    <Modal title={calendar === null ? 'Nowy kalendarz' : 'Ustawienia kalendarza'} onClose={onClose} wide>
      <form className="wk-form wk-calset" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <p className="wk-hint">
          Ustawienia kalendarza są domyślne dla każdego nowego terminu — pojedynczy termin może je potem zmienić.
        </p>

        <label className="wk-field">
          <span>Nazwa</span>
          <input value={title} maxLength={200} placeholder="np. Spotkania z kandydatami" onChange={(e) => setTitle(e.target.value)} />
        </label>

        <label className="wk-field">
          <span>Jak działają terminy w tym kalendarzu</span>
          <textarea rows={3} maxLength={1000} value={description}
            placeholder="np. Rozmowa trwa 40 minut. Przyjdź 5 minut wcześniej. Potwierdzenie przychodzi z kancelarii."
            onChange={(e) => setDescription(e.target.value)} />
          <span className="wk-hint">Ten opis zobaczą wszyscy, którzy widzą kalendarz.</span>
        </label>

        <div className="wk-calset-row">
          <label className="wk-field">
            <span>Kto prowadzi (dodaje i zmienia terminy)</span>
            {calendar === null ? (
              <select value={owner} onChange={(e) => setOwner(e.target.value)}>
                <option value={personal?.areaId ?? PRIVATE}>Tylko ja (prywatny)</option>
                {writable.length > 0 && (
                  <optgroup label="Grupy, w których piszesz">
                    <AreaOptions areas={areas} only={writable} />
                  </optgroup>
                )}
              </select>
            ) : (
              <strong className="wk-calset-fixed">{ownerName}</strong>
            )}
          </label>

          {!ownerIsPrivate && (
            <label className="wk-field">
              <span>Kto widzi</span>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                <option value="">ta sama grupa</option>
                <optgroup label="Albo szerzej / inaczej">
                  <AreaOptions areas={areas} only={writable.filter((a) => a.areaId !== owner)} />
                </optgroup>
              </select>
            </label>
          )}
        </div>

        <div className="wk-calset-row">
          <label className="wk-field">
            <span>Terminy w tym kalendarzu to</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as CalendarKind)}>
              {KINDS.map((one) => <option key={one} value={one}>{CALENDAR_KIND_LABEL[one]}</option>)}
            </select>
          </label>
          <label className="wk-field">
            <span>Zwykle trwają</span>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {[...new Set([...DURATIONS, duration])].sort((a, b) => a - b).map((m) => (
                <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} godz.`}</option>
              ))}
            </select>
          </label>
        </div>

        {kind === 'mass' && (
          <p className="wk-hint">Intencje przyjmuje się przy mszy — w kalendarzu albo w „Msze i nabożeństwa". Kto odprawia, wpiszesz przy terminie.</p>
        )}

        {!ownerIsPrivate && (
          <fieldset className="wk-calset-booking">
            <legend>Rezerwacje</legend>
            <div className="wk-seg" role="group" aria-label="Rezerwacje">
              {([['none', 'nikt'], ['all', 'każdy termin'], ['marked', 'tylko oznaczone']] as const).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={mode === value}
                  className={mode === value ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'} onClick={() => setMode(value)}>
                  {label}
                </button>
              ))}
            </div>

            {mode !== 'none' && (
              <>
                <div className="wk-calset-row">
                  <label className="wk-field">
                    <span>Miejsc na termin</span>
                    <input type="number" min={1} max={10000} value={capacity}
                      onChange={(e) => setCapacity(Math.max(1, Number(e.target.value) || 1))} />
                  </label>
                  <label className="wk-field">
                    <span>Terminów na osobę</span>
                    <input type="number" min={0} max={1000} value={perPerson}
                      onChange={(e) => setPerPerson(Math.max(0, Number(e.target.value) || 0))} />
                    <span className="wk-hint">0 — bez limitu</span>
                  </label>
                  <label className="wk-field">
                    <span>Potwierdzenie</span>
                    <select value={approval} onChange={(e) => setApproval(e.target.value as 'none' | 'office')}>
                      <option value="none">od razu</option>
                      <option value="office">potwierdzają prowadzący</option>
                    </select>
                  </label>
                </div>

                <label className="wk-field">
                  <span>Kto może rezerwować</span>
                  <select value={reserveArea} onChange={(e) => setReserveArea(e.target.value)}>
                    <option value="">każdy, kto znajdzie termin (np. na stronie)</option>
                    <optgroup label="Tylko osoby z grupy (i grup pod nią)">
                      <AreaOptions areas={areas} only={areas.filter((a) => a.personal !== true)} />
                    </optgroup>
                  </select>
                  <span className="wk-hint">
                    Np. kandydaci do bierzmowania: tylko osoby z tej grupy — także te z osobistym linkiem.
                  </span>
                </label>
              </>
            )}
          </fieldset>
        )}

        {failed !== null && <p className="wk-error">{failed}</p>}

        <div className="wk-actions">
          <button type="submit" className="wk-btn" disabled={busy}>{busy ? 'Zapisywanie…' : calendar === null ? 'Utwórz kalendarz' : 'Zapisz'}</button>
          <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={onClose}>Anuluj</button>
          {calendar !== null && !calendar.isDefault && (
            <button type="button" className="wk-link-btn wk-danger" disabled={busy} onClick={() => {
              if (window.confirm('Zarchiwizować ten kalendarz? Jego terminy znikną z widoku, ale nie zostaną usunięte.')) void save(true);
            }}>
              Zarchiwizuj
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

export default CalendarSettings;
