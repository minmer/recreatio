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

import { lazy, Suspense, useState } from 'react';

import { ensurePrivateArea } from './agenda';
import { areaPath, type AreaRow } from '../areas/area';
import { AreaPick } from '../areas/AreaPick';
import {
  addCalendar, saveCalendarRules, type CalendarKind, type CalendarRow, type CalendarRules
} from './calendar';
import type { Me } from '../core/me';
import { Modal } from '../ui/Modal';
import { WorkspaceError } from '../core/session';
import { PRIVATE, writableGroups } from '../areas/WhoSees';
import { askText } from '../ui/dialogs';
import { useT } from '../core/i18n';
/* 0132 — erst, wenn die Einstellungen eines bestehenden Kalenders offen sind: die Vorlagen sind gross. */
const CalendarDocsSection = lazy(() => import('./CalendarDocsSection'));
/* 2026-10-29 — die Termine als JSON, neben Schematen und Plänen; ebenso erst, wenn sie gebraucht werden. */
const CalendarJsonSection = lazy(() => import('./CalendarJsonSection'));

const KINDS: readonly CalendarKind[] = ['appointment', 'mass', 'confession', 'devotion', 'visit'];
const DURATIONS: readonly number[] = [15, 20, 30, 40, 45, 60, 90, 120, 180, 240];

type BookingMode = 'none' | 'all' | 'marked';

export function CalendarSettings({ me, areas, calendar, calendars = [], onClose, onSaved }: {
  me: Me;
  areas: readonly AreaRow[];
  /** 0132 — die Kalender, in denen ich schreibe (für „Zastosuj…" eines Plans). */
  calendars?: readonly CalendarRow[];
  /** Ein bestehender — oder \`null\` für einen neuen. */
  calendar: CalendarRow | null;
  onClose: () => void;
  onSaved: (calendarId: string) => void;
}) {
  const t = useT();
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
    if (title.trim() === '' && !archive) { setFailed(t('calendarApp.settings.needsName')); return; }
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
      setFailed(e instanceof WorkspaceError ? e.message : t('calendarApp.settings.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const ownerName = calendar === null ? null
    : calendar.areaId === personal?.areaId ? t('calendarApp.settings.onlyMe') : areaPath(areas, calendar.areaId).full || calendar.areaName;

  return (
    <Modal title={calendar === null ? t('calendarApp.settings.newTitle') : t('calendarApp.settings.title')} onClose={onClose} wide>
      <form className="wk-form wk-calset" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <p className="wk-hint">
          {t('calendarApp.settings.intro')}
        </p>

        <label className="wk-field">
          <span>{t('common.name')}</span>
          <input value={title} maxLength={200} placeholder={t('calendarApp.settings.namePlaceholder')} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <label className="wk-field">
          <span>{t('calendarApp.settings.description')}</span>
          <textarea rows={3} maxLength={1000} value={description}
            placeholder={t('calendarApp.settings.descriptionPlaceholder')}
            onChange={(e) => setDescription(e.target.value)} />
          <span className="wk-hint">{t('calendarApp.settings.descriptionHint')}</span>
        </label>

        <div className="wk-calset-row">
          <label className="wk-field">
            <span>{t('calendarApp.settings.ownerLong')}</span>
            {calendar === null ? (
              <AreaPick
                label={t('calendarApp.settings.owner')} value={owner} onChange={setOwner} areas={areas} only={writable}
                extras={[{ value: personal?.areaId ?? PRIVATE, label: t('calendarApp.settings.onlyMe') }]}
              />
            ) : (
              <strong className="wk-calset-fixed">{ownerName}</strong>
            )}
          </label>

          {!ownerIsPrivate && (
            <label className="wk-field">
              <span>{t('calendarApp.settings.sees')}</span>
              <AreaPick
                label={t('calendarApp.settings.sees')} value={visibility} onChange={setVisibility}
                areas={areas} only={writable.filter((a) => a.areaId !== owner)}
                extras={[{ value: '', label: t('calendarApp.settings.sameGroup') }]}
              />
            </label>
          )}
        </div>

        <div className="wk-calset-row">
          <label className="wk-field">
            <span>{t('calendarApp.settings.kind')}</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as CalendarKind)}>
              {KINDS.map((one) => <option key={one} value={one}>{t(`calendarApp.calendarKind.${one}`)}</option>)}
            </select>
          </label>
          <label className="wk-field">
            <span>{t('calendarApp.settings.duration')}</span>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {[...new Set([...DURATIONS, duration])].sort((a, b) => a - b).map((m) => (
                <option key={m} value={m}>{m < 60 ? t('calendarApp.minutesShort', { count: m }) : t('calendarApp.hoursShort', { count: m / 60 })}</option>
              ))}
            </select>
          </label>
        </div>

        {kind === 'mass' && (
          <p className="wk-hint">{t('calendarApp.settings.massHint')}</p>
        )}

        {!ownerIsPrivate && (
          <fieldset className="wk-calset-booking">
            <legend>{t('calendarApp.settings.booking')}</legend>
            <div className="wk-seg" role="group" aria-label={t('calendarApp.settings.booking')}>
              {(['none', 'all', 'marked'] as const).map((value) => (
                <button key={value} type="button" aria-pressed={mode === value}
                  className={mode === value ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'} onClick={() => setMode(value)}>
                  {t(`calendarApp.settings.bookingMode.${value}`)}
                </button>
              ))}
            </div>

            {mode !== 'none' && (
              <>
                <div className="wk-calset-row">
                  <label className="wk-field">
                    <span>{t('calendarApp.settings.capacity')}</span>
                    <input type="number" min={1} max={10000} value={capacity}
                      onChange={(e) => setCapacity(Math.max(1, Number(e.target.value) || 1))} />
                  </label>
                  <label className="wk-field">
                    <span>{t('calendarApp.settings.perPerson')}</span>
                    <input type="number" min={0} max={1000} value={perPerson}
                      onChange={(e) => setPerPerson(Math.max(0, Number(e.target.value) || 0))} />
                    <span className="wk-hint">{t('calendarApp.settings.noLimit')}</span>
                  </label>
                  <label className="wk-field">
                    <span>{t('calendarApp.settings.approval')}</span>
                    <select value={approval} onChange={(e) => setApproval(e.target.value as 'none' | 'office')}>
                      <option value="none">{t('calendarApp.settings.approvalNone')}</option>
                      <option value="office">{t('calendarApp.settings.approvalOffice')}</option>
                    </select>
                  </label>
                </div>

                <label className="wk-field">
                  <span>{t('calendarApp.settings.reserve')}</span>
                  <AreaPick
                    label={t('calendarApp.settings.reserve')} value={reserveArea} onChange={setReserveArea}
                    areas={areas} only={areas.filter((a) => a.personal !== true)}
                    extras={[{ value: '', label: t('calendarApp.settings.reserveAnyone'), hint: t('calendarApp.settings.reserveAnyoneHint') }]}
                  />
                  <span className="wk-hint">
                    {t('calendarApp.settings.reserveHint')}
                  </span>
                </label>
              </>
            )}
          </fieldset>
        )}

        {failed !== null && <p className="wk-error">{failed}</p>}

        <div className="wk-actions">
          <button type="submit" className="wk-btn" disabled={busy}>{busy ? t('common.saving') : calendar === null ? t('calendarApp.settings.create') : t('common.save')}</button>
          <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={onClose}>{t('common.cancel')}</button>
          {calendar !== null && !calendar.isDefault && (
            <button type="button" className="wk-link-btn wk-danger" disabled={busy} onClick={async () => {
              if (await askText(t('calendarApp.settings.archiveAsk'))) void save(true);
            }}>
              {t('calendarApp.settings.archive')}
            </button>
          )}
        </div>
      </form>

      {/* 0132 — was die Termine dieses Kalenders sind (Schematy) und wie sie für Wochen entstehen (Plany). */}
      {calendar !== null && calendar.mayWrite === true && (
        <Suspense fallback={null}><CalendarDocsSection me={me} areas={areas} calendar={calendar} calendars={calendars.length > 0 ? calendars : [calendar]}
          onChanged={() => onSaved(calendar.calendarId)} /></Suspense>
      )}
      {/* 2026-10-29 — die Termine dieses Kalenders als JSON: Export eines Zeitraums, Import an Ort und Stelle. */}
      {calendar !== null && calendar.mayWrite === true && (
        <Suspense fallback={null}><CalendarJsonSection me={me} areas={areas} calendar={calendar} writer
          onChanged={() => onSaved(calendar.calendarId)} /></Suspense>
      )}
    </Modal>
  );
}

export default CalendarSettings;
