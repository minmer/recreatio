/**
 * 2026-10-26 — EIN FELD EINES SCHEMAS, ZUM AUSFÜLLEN: je nach Art ein Text,
 * eine Zahl mit Einheit, eine Wahl, eine liturgische Farbe (mit Plättchen), ein
 * Tag, eine Uhrzeit, ja/nein, ein Fragment Pisma, eine Person, ein Link. Der
 * Wert ist immer Text (`schemeValues.ts`).
 */

import { LITURGICAL_COLOURS, colourClass, type SchemeField } from './scheme';
import type { Candidate } from './PeoplePicker';

export function SchemeInput({ field, value, onChange, people, autoFocus = false, disabled = false, id }: {
  field: SchemeField;
  value: string;
  onChange: (next: string) => void;
  /** Für `person`: wer zur Wahl steht. */
  people?: readonly Candidate[] | null;
  autoFocus?: boolean;
  disabled?: boolean;
  id?: string;
}) {
  const label = field.label;
  switch (field.type) {
    case 'longtext':
      return <textarea id={id} aria-label={label} rows={3} value={value} disabled={disabled} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />;
    case 'number':
      return (
        <span className="wk-sc-number">
          <input id={id} type="number" inputMode="decimal" aria-label={label} value={value} disabled={disabled} autoFocus={autoFocus}
            onChange={(e) => onChange(e.target.value)} />
          {field.unit && <span className="wk-sc-unit">{field.unit}</span>}
        </span>
      );
    case 'choice':
      return (
        <select id={id} aria-label={label} value={value} disabled={disabled} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          {value !== '' && !(field.options ?? []).some((o) => o.value === value) && <option value={value}>{value}</option>}
        </select>
      );
    case 'colour': {
      const options = field.options && field.options.length > 0 ? field.options : LITURGICAL_COLOURS;
      const swatch = colourClass(options.find((o) => o.value === value)?.label ?? value);
      return (
        <span className="wk-sc-colour">
          <span className={`wk-lc${swatch === null ? ' is-none' : ` ${swatch}`}`} aria-hidden="true" />
          <select id={id} aria-label={label} value={value} disabled={disabled} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)}>
            <option value="">—</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            {value !== '' && !options.some((o) => o.value === value) && <option value={value}>{value}</option>}
          </select>
        </span>
      );
    }
    case 'date':
      return <input id={id} type="date" aria-label={label} value={value} disabled={disabled} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />;
    case 'time':
      return <input id={id} type="time" step={300} aria-label={label} value={value} disabled={disabled} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />;
    case 'bool':
      return (
        <select id={id} aria-label={label} value={value} disabled={disabled} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          <option value="tak">tak</option>
          <option value="nie">nie</option>
        </select>
      );
    case 'person':
      return (
        <select id={id} aria-label={label} value={value} disabled={disabled || people === null} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)}>
          <option value="">{people === null ? 'Wczytywanie osób…' : '—'}</option>
          {(people ?? []).map((p) => <option key={p.roleId} value={p.roleId}>{p.name}</option>)}
          {value !== '' && !(people ?? []).some((p) => p.roleId === value) && <option value={value}>{value}</option>}
        </select>
      );
    case 'link':
      return <input id={id} type="text" inputMode="url" spellCheck={false} aria-label={label} value={value} maxLength={1000} disabled={disabled}
        autoFocus={autoFocus} placeholder="https://…" onChange={(e) => onChange(e.target.value)} />;
    case 'bible':
      return <input id={id} aria-label={label} value={value} maxLength={400} disabled={disabled} autoFocus={autoFocus}
        placeholder="np. Iz 7,10-14; Ps 24; Rz 1,1-7; Mt 1,18-24" onChange={(e) => onChange(e.target.value)} />;
    case 'text':
    default:
      return <input id={id} aria-label={label} value={value} maxLength={400} disabled={disabled} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />;
  }
}

/** Ein Wert zum Lesen — mit dem Plättchen einer Farbe. */
export function SchemeValue({ field, text }: { field: SchemeField | null; text: string }) {
  const swatch = field?.type === 'colour' || field === null ? colourClass(text) : null;
  return (
    <span className="wk-sc-value">
      {swatch !== null && <span className={`wk-lc ${swatch}`} aria-hidden="true" />}
      {text}
    </span>
  );
}
