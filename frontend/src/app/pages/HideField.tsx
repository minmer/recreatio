/**
 * 2026-10-25 — „CO POKAZUJE": was ein Baustein weglassen darf, als Häkchen
 * (Feldart `hide`, `part.ts`). Ein Häkchen heisst „zeigen"; gespeichert wird,
 * was WEGBLEIBT, durch Kommas — leer heisst: alles, wie bisher. So bleibt jede
 * Kachel, die vor dieser Einstellung stand, wie sie war.
 *
 * Für den Editor der Seite und den Bausteinverwalter dieselbe Zeichnung.
 */

import type { FieldDef } from './part';

/** Was weggelassen ist — aus dem gespeicherten Wert. */
export const hiddenOf = (value: string | undefined): ReadonlySet<string> =>
  new Set((value ?? '').split(',').map((one) => one.trim()).filter((one) => one !== ''));

export function HideField({ field, value, busy, onChange }: {
  field: FieldDef;
  value: string;
  busy: boolean;
  onChange: (next: string) => void;
}) {
  const hidden = hiddenOf(value);
  const options = field.options ?? [];

  return (
    <div className="wk-checks" data-hide-field={field.key}>
      {options.map((one) => (
        <label key={one.value} className="wk-inline">
          <input
            type="checkbox" checked={!hidden.has(one.value)} disabled={busy}
            onChange={(e) => onChange(options
              .filter((o) => (o.value === one.value ? !e.target.checked : hidden.has(o.value)))
              .map((o) => o.value)
              .join(','))}
          />
          <span>{one.label}</span>
        </label>
      ))}
    </div>
  );
}
