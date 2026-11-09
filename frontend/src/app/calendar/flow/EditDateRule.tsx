/**
 * 2026-10-26 — EINE REGEL FÜR EIN DATUM bearbeiten (`DateRule`): ein fester Tag,
 * ein Tag um Ostern oder den ersten Advent, Święta Rodzina, Chrzest Pański, der
 * n-te Wochentag eines Monats, der erste Sonntag nach einem Tag. Was sich jedes
 * Jahr verschiebt, rechnet die App (`liturgy.ts`); hier steht nur die Regel.
 */

import type { DateRule, Weekday } from './flowModel';
import { ADVENT_PRESETS, EASTER_PRESETS, monthNames, NTH_LABEL, WEEKDAY_NAME, WEEKDAYS } from './FlowNodes';
import { useT } from '../../core/i18n';

/* Bezeichnungen: `calendarApp.dateRule.kind.<r>`. */
const KINDS: readonly DateRule['r'][] = ['fixed', 'easter', 'advent', 'christmas-sunday', 'baptism', 'nth-weekday', 'sunday-after'];

/** Womit eine Regel einer anderen Art anfängt — vom bisherigen Monat und Tag, wo es passt. */
function fresh(kind: DateRule['r'], was: DateRule): DateRule {
  const month = 'month' in was && was.month !== undefined ? was.month : 1;
  const day = 'day' in was ? was.day : 1;
  switch (kind) {
    case 'fixed': return { r: 'fixed', month, day };
    case 'easter': return { r: 'easter', offset: 0 };
    case 'advent': return { r: 'advent', offset: 0 };
    case 'christmas-sunday': return { r: 'christmas-sunday' };
    case 'baptism': return { r: 'baptism' };
    case 'nth-weekday': return { r: 'nth-weekday', n: 1, weekday: 5 };
    case 'sunday-after': return { r: 'sunday-after', month, day };
  }
}

const clampDay = (n: number) => Math.max(1, Math.min(31, Math.round(n) || 1));

/** Tag und Monat — zwei Felder nebeneinander. */
function DayMonth({ day, month, disabled, label, onChange }: {
  day: number; month: number; disabled?: boolean; label: string; onChange: (day: number, month: number) => void;
}) {
  const t = useT();
  return (
    <span className="wk-flow-inline">
      <input type="number" min={1} max={31} value={day} disabled={disabled} aria-label={t('calendarApp.test.dayOf', { label })} className="wk-flow-num"
        onChange={(e) => onChange(clampDay(Number(e.target.value)), month)} />
      <select value={month} disabled={disabled} aria-label={t('calendarApp.test.monthOf', { label })} onChange={(e) => onChange(day, Number(e.target.value))}>
        {monthNames(t.lang).map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
      </select>
    </span>
  );
}

/** Tage vor (−) oder nach (+) einem Bezugstag, mit den bekannten Tagen zur Wahl. */
function Offset({ offset, presets, disabled, label, onChange }: {
  offset: number; presets: readonly { offset: number; label: string }[]; disabled?: boolean; label: string;
  onChange: (offset: number) => void;
}) {
  const t = useT();
  const known = presets.find((p) => p.offset === offset);
  return (
    <span className="wk-flow-inline">
      <select value={known === undefined ? '' : String(offset)} disabled={disabled} aria-label={t('calendarApp.dateRule.knownDay', { label })}
        onChange={(e) => { if (e.target.value !== '') onChange(Number(e.target.value)); }}>
        <option value="">{t('calendarApp.dateRule.otherDay')}</option>
        {presets.map((p) => <option key={p.offset} value={p.offset}>{p.label}</option>)}
      </select>
      <input type="number" min={-120} max={120} value={offset} disabled={disabled} aria-label={t('calendarApp.dateRule.daysOf', { label })} className="wk-flow-num"
        onChange={(e) => onChange(Math.max(-120, Math.min(120, Math.round(Number(e.target.value)) || 0)))} />
      <span className="wk-flow-unit">{t('calendarApp.dateRule.days')}</span>
    </span>
  );
}

export function EditDateRule({ rule, onChange, disabled = false, label: own }: {
  rule: DateRule;
  onChange: (rule: DateRule) => void;
  disabled?: boolean;
  label?: string;
}) {
  const t = useT();
  const label = own ?? t('calendarApp.dateRule.when');
  return (
    <div className="wk-flow-rule">
      <select value={rule.r} disabled={disabled} aria-label={t('calendarApp.dateRule.kindOf', { label })} onChange={(e) => onChange(fresh(e.target.value as DateRule['r'], rule))}>
        {KINDS.map((k) => <option key={k} value={k}>{t(`calendarApp.dateRule.kind.${k}`)}</option>)}
      </select>

      {rule.r === 'fixed' && (
        <DayMonth day={rule.day} month={rule.month} disabled={disabled} label={label}
          onChange={(day, month) => onChange({ r: 'fixed', day, month })} />
      )}

      {rule.r === 'easter' && (
        <Offset offset={rule.offset} presets={EASTER_PRESETS} disabled={disabled} label={label}
          onChange={(offset) => onChange({ r: 'easter', offset })} />
      )}

      {rule.r === 'advent' && (
        <Offset offset={rule.offset} presets={ADVENT_PRESETS} disabled={disabled} label={label}
          onChange={(offset) => onChange({ r: 'advent', offset })} />
      )}

      {rule.r === 'nth-weekday' && (
        <span className="wk-flow-inline">
          <select value={String(rule.n)} disabled={disabled} aria-label={t('calendarApp.dateRule.whichOf', { label })}
            onChange={(e) => onChange({ ...rule, n: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 | -1 })}>
            {['1', '2', '3', '4', '5', '-1'].map((n) => <option key={n} value={n}>{NTH_LABEL[n]}</option>)}
          </select>
          <select value={rule.weekday} disabled={disabled} aria-label={t('calendarApp.dateRule.weekdayOf', { label })}
            onChange={(e) => onChange({ ...rule, weekday: Number(e.target.value) as Weekday })}>
            {WEEKDAYS.map((d) => <option key={d} value={d}>{WEEKDAY_NAME[d]}</option>)}
          </select>
          <select value={rule.month ?? 0} disabled={disabled} aria-label={t('calendarApp.test.monthOf', { label })}
            onChange={(e) => {
              const month = Number(e.target.value);
              onChange(month === 0 ? { r: 'nth-weekday', n: rule.n, weekday: rule.weekday } : { ...rule, month });
            }}>
            <option value={0}>{t('calendarApp.dateRule.everyMonth')}</option>
            {monthNames(t.lang).map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
          </select>
        </span>
      )}

      {rule.r === 'sunday-after' && (
        <DayMonth day={rule.day} month={rule.month} disabled={disabled} label={label}
          onChange={(day, month) => onChange({ r: 'sunday-after', day, month })} />
      )}
    </div>
  );
}

export default EditDateRule;
