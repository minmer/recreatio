/**
 * 2026-10-26 — DIE MESSEN EINES TAGES (Knoten „Godziny mszy") bearbeiten:
 * eine Liste für Sonntage und gebotene Feiertage, eine für die übrigen Tage
 * (je Zeile die Wochentage). Jede Messe hat einen Schlüssel („n1213"), der
 * bleibt: an ihm erkennen Bedingungen („Która msza") und die Vorschau („schon
 * geplant") dieselbe Messe wieder.
 */

import { DayChips } from './EditTest';
import type { SlotRow, SlotsData, Weekday } from './flowModel';
import { useT } from '../../core/i18n';

const WORKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6];

/** Ein Schlüssel aus der Uhrzeit: „n1213" an Sonntagen, „p1800" an Wochentagen — eindeutig gemacht. */
function keyFor(prefix: string, time: string, taken: readonly string[]): string {
  const base = `${prefix}${time.replace(':', '') || '0000'}`;
  let key = base;
  for (let n = 2; taken.includes(key); n += 1) key = `${base}-${n}`;
  return key;
}

function SlotTable({ title, rows, prefix, withDays, taken, onChange, disabled }: {
  title: string;
  rows: readonly SlotRow[];
  prefix: string;
  withDays: boolean;
  taken: readonly string[];
  onChange: (rows: readonly SlotRow[]) => void;
  disabled: boolean;
}) {
  const t = useT();
  const patch = (i: number, change: Partial<SlotRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...change } : r)));
  const add = () => {
    const last = rows[rows.length - 1];
    const time = last === undefined ? (withDays ? '18:00' : '09:00') : last.time;
    onChange([...rows, { key: keyFor(prefix, time, taken), time, minutes: last?.minutes ?? 60, ...(withDays ? { days: WORKDAYS } : {}) }]);
  };

  return (
    <section className="wk-flow-stack" aria-label={title}>
      <h4 className="wk-flow-sub">{title}</h4>
      {rows.length === 0 && <p className="wk-empty">{t('calendarApp.slots.empty')}</p>}
      <ul className="wk-flow-slots">
        {rows.map((row, i) => (
          <li key={i} className="wk-flow-slot">
            <span className="wk-flow-inline">
              <input type="time" value={row.time} disabled={disabled} aria-label={t('calendarApp.slots.time')} step={60}
                onChange={(e) => patch(i, { time: e.target.value })} />
              <input type="number" min={5} max={600} value={row.minutes} disabled={disabled} aria-label={t('calendarApp.slots.minutes')} className="wk-flow-num"
                onChange={(e) => patch(i, { minutes: Math.max(5, Math.min(600, Math.round(Number(e.target.value)) || 60)) })} />
              <span className="wk-flow-unit">{t('calendarApp.slots.min')}</span>
              {!disabled && (
                <button type="button" className="wk-link-btn wk-danger" aria-label={t('calendarApp.slots.remove', { time: row.time })}
                  onClick={() => onChange(rows.filter((_, j) => j !== i))}>{t('common.delete')}</button>
              )}
            </span>
            <span className="wk-flow-inline">
              <input value={row.key} disabled={disabled} aria-label={t('calendarApp.slots.key')} className="wk-flow-key" title={t('calendarApp.slots.keyHint')}
                onChange={(e) => patch(i, { key: e.target.value.trim().replace(/[^A-Za-z0-9_.-]/g, '') })} />
              <input value={row.label ?? ''} disabled={disabled} aria-label={t('calendarApp.slots.label')} placeholder={t('calendarApp.slots.labelPlaceholder')}
                onChange={(e) => patch(i, { label: e.target.value === '' ? undefined : e.target.value })} />
            </span>
            {withDays && (
              <DayChips label={t('calendarApp.slots.days', { time: row.time })} value={row.days ?? WORKDAYS} disabled={disabled}
                onChange={(days) => patch(i, { days })} />
            )}
            {/* `taken` hat die Schlüssel beider Listen, diesen eingeschlossen. */}
            {(row.key === '' || taken.filter((k) => k === row.key).length > 1) && (
              <span className="wk-flow-problem">{row.key === '' ? t('calendarApp.slots.needsKey') : t('calendarApp.slots.keyTaken')}</span>
            )}
          </li>
        ))}
      </ul>
      {!disabled && <button type="button" className="wk-btn wk-btn-quiet wk-flow-add" onClick={add}>{t('calendarApp.slots.add')}</button>}
    </section>
  );
}

export function EditSlots({ data, onChange, disabled = false }: {
  data: SlotsData; onChange: (data: SlotsData) => void; disabled?: boolean;
}) {
  const t = useT();
  const festive = data.festive ?? [];
  const weekdays = data.weekdays ?? [];
  const taken = [...festive, ...weekdays].map((r) => r.key);

  return (
    <div className="wk-flow-stack">
      <p className="wk-flow-note">
        {t('calendarApp.slots.note')}
      </p>
      <SlotTable title={t('calendarApp.slots.festive')} rows={festive} prefix="n" withDays={false} taken={taken} disabled={disabled}
        onChange={(rows) => onChange({ ...data, festive: rows })} />
      <SlotTable title={t('calendarApp.slots.weekdays')} rows={weekdays} prefix="p" withDays taken={taken} disabled={disabled}
        onChange={(rows) => onChange({ ...data, weekdays: rows })} />
    </div>
  );
}

export default EditSlots;
