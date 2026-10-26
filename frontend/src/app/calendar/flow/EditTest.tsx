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
import { SEASON_LABEL, SEASONS, type Compare, type Season, type Test, type Weekday } from './flowModel';
import {
  COMPARE_LABEL, COMPARES, MONTH_NAME, PLAN_TESTS, RANK_LABEL, RULE_TESTS, TEST_LABEL, WEEKDAY_NAME, WEEKDAY_SHORT, WEEKDAYS
} from './FlowNodes';

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

export function DayChips({ value, onChange, disabled, label = 'Dni tygodnia' }: {
  value: readonly Weekday[]; onChange: (days: readonly Weekday[]) => void; disabled?: boolean; label?: string;
}) {
  return (
    <ChipSet label={label} disabled={disabled} value={value}
      options={WEEKDAYS.map((d) => ({ value: d, label: WEEKDAY_SHORT[d], title: WEEKDAY_NAME[d] }))}
      onChange={(next) => onChange([...next].sort((a, b) => a - b) as Weekday[])} />
  );
}

/** Vergleich und Zahl — „≥ 2". */
function CompareNumber({ op, n, onChange, disabled, label, min = 0, max = 999 }: {
  op: Compare; n: number; onChange: (op: Compare, n: number) => void; disabled?: boolean; label: string; min?: number; max?: number;
}) {
  return (
    <span className="wk-flow-inline">
      <select value={op} disabled={disabled} aria-label={`${label}: porównanie`} onChange={(e) => onChange(e.target.value as Compare, n)}>
        {COMPARES.map((c) => <option key={c} value={c}>{COMPARE_LABEL[c]}</option>)}
      </select>
      <input type="number" min={min} max={max} value={n} disabled={disabled} aria-label={`${label}: liczba`} className="wk-flow-num"
        onChange={(e) => onChange(op, Math.max(min, Math.min(max, Math.round(Number(e.target.value)) || 0)))} />
    </span>
  );
}

/** „MM-DD" ↔ Tag und Monat. */
function MonthDayInput({ value, onChange, disabled, label }: { value: string; onChange: (v: string) => void; disabled?: boolean; label: string }) {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(value);
  const month = m === null ? 1 : Number(m[1]);
  const day = m === null ? 1 : Number(m[2]);
  const put = (d: number, mo: number) => onChange(`${String(mo).padStart(2, '0')}-${String(Math.max(1, Math.min(31, d))).padStart(2, '0')}`);
  return (
    <span className="wk-flow-inline">
      <input type="number" min={1} max={31} value={day} disabled={disabled} aria-label={`${label}: dzień`} className="wk-flow-num"
        onChange={(e) => put(Math.round(Number(e.target.value)) || 1, month)} />
      <select value={month} disabled={disabled} aria-label={`${label}: miesiąc`} onChange={(e) => put(day, Number(e.target.value))}>
        {MONTH_NAME.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
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
  const kinds: readonly Test['t'][] = kind === 'plan' ? PLAN_TESTS : RULE_TESTS;
  const shownKinds = kinds.includes(test.t) ? kinds : [...kinds, test.t];

  return (
    <div className="wk-flow-test">
      <label className="wk-field">
        <span>Co sprawdzić</span>
        <select value={test.t} disabled={disabled} onChange={(e) => onChange(fresh(e.target.value as Test['t'], fields))}>
          {shownKinds.map((k) => <option key={k} value={k}>{TEST_LABEL[k]}</option>)}
        </select>
      </label>

      {test.t === 'weekday' && <DayChips value={test.days} disabled={disabled} onChange={(days) => onChange({ t: 'weekday', days })} />}

      {test.t === 'slot' && (
        <div className="wk-flow-stack">
          {slotKeys.length > 0 && (
            <ChipSet label="Msze" disabled={disabled} value={test.keys}
              options={slotKeys.map((s) => ({ value: s.key, label: s.label, title: s.key }))}
              onChange={(keys) => onChange({ t: 'slot', keys })} />
          )}
          <label className="wk-field">
            <span>Klucze godzin (oddzielone przecinkami)</span>
            <input value={test.keys.join(', ')} disabled={disabled} placeholder="np. n1213, p1800"
              onChange={(e) => onChange({ t: 'slot', keys: e.target.value.split(',').map((k) => k.trim()).filter((k) => k !== '') })} />
          </label>
        </div>
      )}

      {test.t === 'time' && (
        <span className="wk-flow-inline">
          <span className="wk-flow-unit">od</span>
          <input type="time" value={test.from ?? ''} disabled={disabled} aria-label="Od godziny" onChange={(e) => onChange({ ...test, from: e.target.value || undefined })} />
          <span className="wk-flow-unit">do</span>
          <input type="time" value={test.to ?? ''} disabled={disabled} aria-label="Do godziny" onChange={(e) => onChange({ ...test, to: e.target.value || undefined })} />
        </span>
      )}

      {test.t === 'season' && (
        <ChipSet label="Okresy" disabled={disabled} value={test.seasons}
          options={SEASONS.map((s) => ({ value: s, label: SEASON_LABEL[s] }))}
          onChange={(seasons) => onChange({ t: 'season', seasons: seasons as Season[] })} />
      )}

      {test.t === 'week' && (
        <CompareNumber label="Tydzień" op={test.op} n={test.n} min={0} max={34} disabled={disabled}
          onChange={(op, n) => onChange({ t: 'week', op, n })} />
      )}

      {test.t === 'rank' && (
        <div className="wk-flow-stack">
          <span className="wk-flow-inline">
            <select value={test.op} disabled={disabled} aria-label="Ranga: porównanie" onChange={(e) => onChange({ ...test, op: e.target.value as Compare })}>
              {COMPARES.map((c) => <option key={c} value={c}>{COMPARE_LABEL[c]}</option>)}
            </select>
            <select value={test.n} disabled={disabled} aria-label="Ranga" onChange={(e) => onChange({ ...test, n: Number(e.target.value) })}>
              {Object.entries(RANK_LABEL).map(([n, label]) => <option key={n} value={n}>{n}. {label}</option>)}
            </select>
          </span>
          <span className="wk-flow-note">1 to najwyższa ranga, 13 — zwykły dzień powszedni. „&lt; 10” znaczy: ważniejsze niż wspomnienie obowiązkowe.</span>
        </div>
      )}

      {test.t === 'celebration' && (
        <div className="wk-flow-stack">
          <select value={test.is} disabled={disabled} aria-label="Obchód" onChange={(e) => onChange({ ...test, is: e.target.value as 'any' | 'none' | 'name' })}>
            <option value="any">jest obchód z kalendarza świąt</option>
            <option value="none">nie ma obchodu (dzień okresu)</option>
            <option value="name">obchód o nazwie zawierającej…</option>
          </select>
          {test.is === 'name' && (
            <input value={test.name ?? ''} disabled={disabled} aria-label="Nazwa obchodu" placeholder="np. Matki Bożej"
              onChange={(e) => onChange({ ...test, name: e.target.value })} />
          )}
        </div>
      )}

      {test.t === 'date' && <EditDateRule rule={test.rule} disabled={disabled} label="Data" onChange={(rule) => onChange({ t: 'date', rule })} />}

      {test.t === 'between' && (
        <div className="wk-flow-stack">
          <span className="wk-flow-inline"><span className="wk-flow-unit">od</span>
            <MonthDayInput value={test.from} disabled={disabled} label="Od" onChange={(from) => onChange({ ...test, from })} /></span>
          <span className="wk-flow-inline"><span className="wk-flow-unit">do</span>
            <MonthDayInput value={test.to} disabled={disabled} label="Do" onChange={(to) => onChange({ ...test, to })} /></span>
          <span className="wk-flow-note">Co roku, włącznie z obu końcami (np. 17–24 grudnia). „Do” wcześniejsze niż „od” przechodzi przez Nowy Rok.</span>
        </div>
      )}

      {test.t === 'var' && (
        <span className="wk-flow-inline">
          <input value={test.name} disabled={disabled} aria-label="Nazwa zmiennej" placeholder="np. colour" className="wk-flow-key"
            onChange={(e) => onChange({ ...test, name: e.target.value.trim() })} />
          <select value={test.op} disabled={disabled} aria-label="Porównanie" onChange={(e) => onChange({ ...test, op: e.target.value as '=' | '!=' | 'contains' })}>
            <option value="=">=</option>
            <option value="!=">≠</option>
            <option value="contains">zawiera</option>
          </select>
          <input value={test.value} disabled={disabled} aria-label="Wartość" onChange={(e) => onChange({ ...test, value: e.target.value })} />
        </span>
      )}

      {test.t === 'mode' && (
        (modes ?? []).length > 0 ? (
          <ChipSet label="Rodzaje" disabled={disabled} value={test.modes}
            options={(modes ?? []).map((m) => ({ value: m.value, label: m.label }))}
            onChange={(next) => onChange({ t: 'mode', modes: next as string[] })} />
        ) : (
          <label className="wk-field">
            <span>Rodzaje (klucze, oddzielone przecinkami)</span>
            <input value={test.modes.join(', ')} disabled={disabled}
              onChange={(e) => onChange({ t: 'mode', modes: e.target.value.split(',').map((m) => m.trim()).filter((m) => m !== '') })} />
          </label>
        )
      )}

      {test.t === 'count' && (
        <div className="wk-flow-stack">
          <select value={test.scope === 'occurrence' ? 'occurrence' : test.per === 'occurrence' ? 'week-occ' : 'week'} disabled={disabled} aria-label="Gdzie liczyć"
            onChange={(e) => {
              const v = e.target.value;
              onChange(v === 'occurrence' ? { ...test, scope: 'occurrence', per: undefined }
                : v === 'week-occ' ? { ...test, scope: 'week', per: 'occurrence' } : { ...test, scope: 'week', per: 'record' });
            }}>
            <option value="occurrence">wpisy na tym terminie</option>
            <option value="week">wpisy w tym tygodniu (pn–nd)</option>
            <option value="week-occ">inne terminy tego tygodnia, które mają takie wpisy</option>
          </select>
          <span className="wk-flow-inline">
            <select value={test.mode ?? ''} disabled={disabled} aria-label="Jakiego rodzaju"
              onChange={(e) => onChange({ ...test, mode: e.target.value === '' ? undefined : e.target.value })}>
              <option value="">każdego rodzaju</option>
              {(modes ?? []).map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select value={test.status ?? 'live'} disabled={disabled} aria-label="Które"
              onChange={(e) => onChange({ ...test, status: e.target.value as 'live' | 'all' })}>
              <option value="live">przyjęte i odprawione</option>
              <option value="all">także czekające</option>
            </select>
          </span>
          <CompareNumber label="Liczba" op={test.op} n={test.n} disabled={disabled} onChange={(op, n) => onChange({ ...test, op, n })} />
        </div>
      )}

      {test.t === 'actor' && (
        <select value={test.is} disabled={disabled} aria-label="Kto dodaje" onChange={(e) => onChange({ t: 'actor', is: e.target.value as 'office' | 'outside' })}>
          <option value="office">kancelaria (piszący w kalendarzu)</option>
          <option value="outside">ktoś z zewnątrz (członek, link)</option>
        </select>
      )}

      {test.t === 'field' && (
        <div className="wk-flow-stack">
          {(fields ?? []).length > 0 ? (
            <select value={test.key} disabled={disabled} aria-label="Pole" onChange={(e) => onChange({ ...test, key: e.target.value })}>
              {!(fields ?? []).some((f) => f.key === test.key) && <option value={test.key}>{test.key || '— wybierz pole —'}</option>}
              {(fields ?? []).map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          ) : (
            <input value={test.key} disabled={disabled} aria-label="Klucz pola" className="wk-flow-key" onChange={(e) => onChange({ ...test, key: e.target.value.trim() })} />
          )}
          <span className="wk-flow-inline">
            <select value={test.op} disabled={disabled} aria-label="Warunek pola" onChange={(e) => onChange({ ...test, op: e.target.value as 'set' | 'empty' | '=' })}>
              <option value="set">wypełnione</option>
              <option value="empty">puste</option>
              <option value="=">równe</option>
            </select>
            {test.op === '=' && <input value={test.value ?? ''} disabled={disabled} aria-label="Wartość pola" onChange={(e) => onChange({ ...test, value: e.target.value })} />}
          </span>
        </div>
      )}
    </div>
  );
}

export default EditTest;
