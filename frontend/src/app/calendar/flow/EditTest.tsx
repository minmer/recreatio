/**
 * 2026-10-26 — WAS EIN KNOTEN „Warunek" PRÜFT (`Test`) bearbeiten.
 *
 * Im Plan: Wochentag, welche Messe, Uhrzeit, Abschnitt des Kirchenjahres, Woche,
 * Rang, Obchód, Sonntag/Feiertag, ein Datum, eine Spanne im Jahr, eine
 * Variable. In einer Regel: Art des Eintrags, wie viele es schon gibt, wer
 * einträgt, ein Feld des Eintrags.
 *
 * Dazu die Plättchen, die auch andere Knoten brauchen (`DayChips`, `ChipSet`).
 */

import type { SchemeChoice, SchemeField } from '../scheme';
import { EditDateRule } from './EditDateRule';
import { SEASONS, type Compare, type Season, type Test, type Weekday } from './flowModel';
import {
  COMPARE_LABEL, COMPARES, monthNames, PLAN_TESTS, RANK_LABEL, RULE_TESTS, WEEKDAY_NAME, WEEKDAY_SHORT, WEEKDAYS
} from './FlowNodes';
import { useT } from '../../core/i18n';

/* -- Plättchen ------------------------------------------------------------------------------ */

/** Mehrere aus wenigen — als Plättchen, die man an- und abschaltet. */
export function ChipSet<T extends string | number>({ options, value, onChange, disabled = false, label }: {
  options: readonly { readonly value: T; readonly label: string; readonly title?: string }[];
  value: readonly T[];
  onChange: (next: readonly T[]) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className="wk-days" role="group" aria-label={label}>
      {options.map((one) => {
        const on = value.includes(one.value);
        return (
          <button key={String(one.value)} type="button" disabled={disabled} title={one.title}
            className={`wk-day-chip${on ? ' is-on' : ''}`} aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== one.value) : [...value, one.value])}>
            {one.label}
          </button>
        );
      })}
    </div>
  );
}

export function DayChips({ value, onChange, disabled, label }: {
  value: readonly Weekday[]; onChange: (days: readonly Weekday[]) => void; disabled?: boolean; label?: string;
}) {
  const t = useT();
  return (
    <ChipSet label={label ?? t('calendarApp.test.weekdays')} disabled={disabled} value={value}
      options={WEEKDAYS.map((d) => ({ value: d, label: WEEKDAY_SHORT[d], title: WEEKDAY_NAME[d] }))}
      onChange={(next) => onChange([...next].sort((a, b) => a - b) as Weekday[])} />
  );
}

/** Vergleich und Zahl — „≥ 2". */
function CompareNumber({ op, n, onChange, disabled, label, min = 0, max = 999 }: {
  op: Compare; n: number; onChange: (op: Compare, n: number) => void; disabled?: boolean; label: string; min?: number; max?: number;
}) {
  const t = useT();
  return (
    <span className="wk-flow-inline">
      <select value={op} disabled={disabled} aria-label={t('calendarApp.test.compareOf', { label })} onChange={(e) => onChange(e.target.value as Compare, n)}>
        {COMPARES.map((c) => <option key={c} value={c}>{COMPARE_LABEL[c]}</option>)}
      </select>
      <input type="number" min={min} max={max} value={n} disabled={disabled} aria-label={t('calendarApp.test.numberOf', { label })} className="wk-flow-num"
        onChange={(e) => onChange(op, Math.max(min, Math.min(max, Math.round(Number(e.target.value)) || 0)))} />
    </span>
  );
}

/** „MM-DD" ↔ Tag und Monat. */
function MonthDayInput({ value, onChange, disabled, label }: { value: string; onChange: (v: string) => void; disabled?: boolean; label: string }) {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(value);
  const month = m === null ? 1 : Number(m[1]);
  const day = m === null ? 1 : Number(m[2]);
  const t = useT();
  const put = (d: number, mo: number) => onChange(`${String(mo).padStart(2, '0')}-${String(Math.max(1, Math.min(31, d))).padStart(2, '0')}`);
  return (
    <span className="wk-flow-inline">
      <input type="number" min={1} max={31} value={day} disabled={disabled} aria-label={t('calendarApp.test.dayOf', { label })} className="wk-flow-num"
        onChange={(e) => put(Math.round(Number(e.target.value)) || 1, month)} />
      <select value={month} disabled={disabled} aria-label={t('calendarApp.test.monthOf', { label })} onChange={(e) => put(day, Number(e.target.value))}>
        {monthNames(t.lang).map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
      </select>
    </span>
  );
}

/* -- Der Warunek ----------------------------------------------------------------------------- */

/** Womit eine Prüfung einer anderen Art anfängt. */
function fresh(t: Test['t'], fields: readonly SchemeField[] | undefined): Test {
  switch (t) {
    case 'weekday': return { t, days: [7] };
    case 'slot': return { t, keys: [] };
    case 'time': return { t, from: '17:00', to: '20:00' };
    case 'season': return { t, seasons: ['adwent'] };
    case 'week': return { t, op: '=', n: 1 };
    case 'rank': return { t, op: '<', n: 10 };
    case 'celebration': return { t, is: 'any' };
    case 'festive': return { t };
    case 'sunday': return { t };
    case 'date': return { t, rule: { r: 'fixed', month: 1, day: 1 } };
    case 'between': return { t, from: '12-17', to: '12-24' };
    case 'var': return { t, name: 'colour', op: '=', value: '' };
    case 'mode': return { t, modes: [] };
    case 'count': return { t, scope: 'occurrence', status: 'live', op: '>=', n: 1 };
    case 'actor': return { t, is: 'outside' };
    case 'field': return { t, key: fields?.[0]?.key ?? '', op: 'set' };
  }
}

export function EditTest({ test, kind, onChange, modes, fields, slotKeys = [], disabled = false }: {
  test: Test;
  kind: 'plan' | 'rule';
  onChange: (test: Test) => void;
  /** Regel: die Arten der Liste (pojedyncza / zbiorowa). */
  modes?: readonly SchemeChoice[];
  /** Regel: die Felder eines Eintrags. */
  fields?: readonly SchemeField[];
  /** Plan: die Schlüssel der Messen aus den Knoten „Godziny mszy" (mit Uhrzeit). */
  slotKeys?: readonly { readonly key: string; readonly label: string }[];
  disabled?: boolean;
}) {
  const t = useT();
  const kinds: readonly Test['t'][] = kind === 'plan' ? PLAN_TESTS : RULE_TESTS;
  const shownKinds = kinds.includes(test.t) ? kinds : [...kinds, test.t];

  return (
    <div className="wk-flow-test">
      <label className="wk-field">
        <span>{t('calendarApp.test.what')}</span>
        <select value={test.t} disabled={disabled} onChange={(e) => onChange(fresh(e.target.value as Test['t'], fields))}>
          {shownKinds.map((k) => <option key={k} value={k}>{t(`calendarApp.flowUi.testLabel.${k}`)}</option>)}
        </select>
      </label>

      {test.t === 'weekday' && <DayChips value={test.days} disabled={disabled} onChange={(days) => onChange({ t: 'weekday', days })} />}

      {test.t === 'slot' && (
        <div className="wk-flow-stack">
          {slotKeys.length > 0 && (
            <ChipSet label={t('calendarApp.test.masses')} disabled={disabled} value={test.keys}
              options={slotKeys.map((s) => ({ value: s.key, label: s.label, title: s.key }))}
              onChange={(keys) => onChange({ t: 'slot', keys })} />
          )}
          <label className="wk-field">
            <span>{t('calendarApp.test.slotKeys')}</span>
            <input value={test.keys.join(', ')} disabled={disabled} placeholder={t('calendarApp.test.slotKeysPlaceholder')}
              onChange={(e) => onChange({ t: 'slot', keys: e.target.value.split(',').map((k) => k.trim()).filter((k) => k !== '') })} />
          </label>
        </div>
      )}

      {test.t === 'time' && (
        <span className="wk-flow-inline">
          <span className="wk-flow-unit">{t('calendarApp.test.from')}</span>
          <input type="time" value={test.from ?? ''} disabled={disabled} aria-label={t('calendarApp.test.fromTime')} onChange={(e) => onChange({ ...test, from: e.target.value || undefined })} />
          <span className="wk-flow-unit">{t('calendarApp.test.to')}</span>
          <input type="time" value={test.to ?? ''} disabled={disabled} aria-label={t('calendarApp.test.toTime')} onChange={(e) => onChange({ ...test, to: e.target.value || undefined })} />
        </span>
      )}

      {test.t === 'season' && (
        <ChipSet label={t('calendarApp.test.seasons')} disabled={disabled} value={test.seasons}
          options={SEASONS.map((s) => ({ value: s, label: t(`calendarApp.flow.season.${s}`) }))}
          onChange={(seasons) => onChange({ t: 'season', seasons: seasons as Season[] })} />
      )}

      {test.t === 'week' && (
        <CompareNumber label={t('calendarApp.test.week')} op={test.op} n={test.n} min={0} max={34} disabled={disabled}
          onChange={(op, n) => onChange({ t: 'week', op, n })} />
      )}

      {test.t === 'rank' && (
        <div className="wk-flow-stack">
          <span className="wk-flow-inline">
            <select value={test.op} disabled={disabled} aria-label={t('calendarApp.test.compareOf', { label: t('calendarApp.test.rank') })} onChange={(e) => onChange({ ...test, op: e.target.value as Compare })}>
              {COMPARES.map((c) => <option key={c} value={c}>{COMPARE_LABEL[c]}</option>)}
            </select>
            <select value={test.n} disabled={disabled} aria-label={t('calendarApp.test.rank')} onChange={(e) => onChange({ ...test, n: Number(e.target.value) })}>
              {Object.entries(RANK_LABEL).map(([n, label]) => <option key={n} value={n}>{n}. {label}</option>)}
            </select>
          </span>
          <span className="wk-flow-note">{t('calendarApp.test.rankNote')}</span>
        </div>
      )}

      {test.t === 'celebration' && (
        <div className="wk-flow-stack">
          <select value={test.is} disabled={disabled} aria-label={t('calendarApp.test.celebration')} onChange={(e) => onChange({ ...test, is: e.target.value as 'any' | 'none' | 'name' })}>
            <option value="any">{t('calendarApp.test.celebrationAny')}</option>
            <option value="none">{t('calendarApp.test.celebrationNone')}</option>
            <option value="name">{t('calendarApp.test.celebrationName')}</option>
          </select>
          {test.is === 'name' && (
            <input value={test.name ?? ''} disabled={disabled} aria-label={t('calendarApp.test.celebrationNameLabel')} placeholder={t('calendarApp.test.celebrationPlaceholder')}
              onChange={(e) => onChange({ ...test, name: e.target.value })} />
          )}
        </div>
      )}

      {test.t === 'date' && <EditDateRule rule={test.rule} disabled={disabled} label={t('common.date')} onChange={(rule) => onChange({ t: 'date', rule })} />}

      {test.t === 'between' && (
        <div className="wk-flow-stack">
          <span className="wk-flow-inline"><span className="wk-flow-unit">{t('calendarApp.test.from')}</span>
            <MonthDayInput value={test.from} disabled={disabled} label={t('common.from')} onChange={(from) => onChange({ ...test, from })} /></span>
          <span className="wk-flow-inline"><span className="wk-flow-unit">{t('calendarApp.test.to')}</span>
            <MonthDayInput value={test.to} disabled={disabled} label={t('common.to')} onChange={(to) => onChange({ ...test, to })} /></span>
          <span className="wk-flow-note">{t('calendarApp.test.betweenNote')}</span>
        </div>
      )}

      {test.t === 'var' && (
        <span className="wk-flow-inline">
          <input value={test.name} disabled={disabled} aria-label={t('calendarApp.test.varName')} placeholder={t('calendarApp.test.varPlaceholder')} className="wk-flow-key"
            onChange={(e) => onChange({ ...test, name: e.target.value.trim() })} />
          <select value={test.op} disabled={disabled} aria-label={t('calendarApp.test.compare')} onChange={(e) => onChange({ ...test, op: e.target.value as '=' | '!=' | 'contains' })}>
            <option value="=">=</option>
            <option value="!=">≠</option>
            <option value="contains">{t('calendarApp.test.contains')}</option>
          </select>
          <input value={test.value} disabled={disabled} aria-label={t('calendarApp.test.value')} onChange={(e) => onChange({ ...test, value: e.target.value })} />
        </span>
      )}

      {test.t === 'mode' && (
        (modes ?? []).length > 0 ? (
          <ChipSet label={t('calendarApp.test.modes')} disabled={disabled} value={test.modes}
            options={(modes ?? []).map((m) => ({ value: m.value, label: m.label }))}
            onChange={(next) => onChange({ t: 'mode', modes: next as string[] })} />
        ) : (
          <label className="wk-field">
            <span>{t('calendarApp.test.modeKeys')}</span>
            <input value={test.modes.join(', ')} disabled={disabled}
              onChange={(e) => onChange({ t: 'mode', modes: e.target.value.split(',').map((m) => m.trim()).filter((m) => m !== '') })} />
          </label>
        )
      )}

      {test.t === 'count' && (
        <div className="wk-flow-stack">
          <select value={test.scope === 'occurrence' ? 'occurrence' : test.per === 'occurrence' ? 'week-occ' : 'week'} disabled={disabled} aria-label={t('calendarApp.test.countWhere')}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v === 'occurrence' ? { ...test, scope: 'occurrence', per: undefined }
                : v === 'week-occ' ? { ...test, scope: 'week', per: 'occurrence' } : { ...test, scope: 'week', per: 'record' });
            }}>
            <option value="occurrence">{t('calendarApp.test.countOccurrence')}</option>
            <option value="week">{t('calendarApp.test.countWeek')}</option>
            <option value="week-occ">{t('calendarApp.test.countWeekOcc')}</option>
          </select>
          <span className="wk-flow-inline">
            <select value={test.mode ?? ''} disabled={disabled} aria-label={t('calendarApp.test.ofKind')}
              onChange={(e) => onChange({ ...test, mode: e.target.value === '' ? undefined : e.target.value })}>
              <option value="">{t('calendarApp.test.anyKind')}</option>
              {(modes ?? []).map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select value={test.status ?? 'live'} disabled={disabled} aria-label={t('calendarApp.test.which')}
              onChange={(e) => onChange({ ...test, status: e.target.value as 'live' | 'all' })}>
              <option value="live">{t('calendarApp.test.statusLive')}</option>
              <option value="all">{t('calendarApp.test.statusAll')}</option>
            </select>
          </span>
          <CompareNumber label={t('calendarApp.test.number')} op={test.op} n={test.n} disabled={disabled} onChange={(op, n) => onChange({ ...test, op, n })} />
        </div>
      )}

      {test.t === 'actor' && (
        <select value={test.is} disabled={disabled} aria-label={t('calendarApp.flowUi.testLabel.actor')} onChange={(e) => onChange({ t: 'actor', is: e.target.value as 'office' | 'outside' })}>
          <option value="office">{t('calendarApp.test.actorOffice')}</option>
          <option value="outside">{t('calendarApp.test.actorOutside')}</option>
        </select>
      )}

      {test.t === 'field' && (
        <div className="wk-flow-stack">
          {(fields ?? []).length > 0 ? (
            <select value={test.key} disabled={disabled} aria-label={t('calendarApp.test.field')} onChange={(e) => onChange({ ...test, key: e.target.value })}>
              {!(fields ?? []).some((f) => f.key === test.key) && <option value={test.key}>{test.key || t('calendarApp.test.pickField')}</option>}
              {(fields ?? []).map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          ) : (
            <input value={test.key} disabled={disabled} aria-label={t('calendarApp.test.fieldKey')} className="wk-flow-key" onChange={(e) => onChange({ ...test, key: e.target.value.trim() })} />
          )}
          <span className="wk-flow-inline">
            <select value={test.op} disabled={disabled} aria-label={t('calendarApp.test.fieldTest')} onChange={(e) => onChange({ ...test, op: e.target.value as 'set' | 'empty' | '=' })}>
              <option value="set">{t('calendarApp.test.filled')}</option>
              <option value="empty">{t('calendarApp.test.empty')}</option>
              <option value="=">{t('calendarApp.test.equals')}</option>
            </select>
            {test.op === '=' && <input value={test.value ?? ''} disabled={disabled} aria-label={t('calendarApp.test.fieldValue')} onChange={(e) => onChange({ ...test, value: e.target.value })} />}
          </span>
        </div>
      )}
    </div>
  );
}

export default EditTest;
