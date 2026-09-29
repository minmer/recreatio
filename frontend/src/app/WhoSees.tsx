/**
 * „KTO WIDZI" — die eine Frage, die ein Termin oder eine Aufgabe beim Anlegen
 * stellt. Früher hiess sie „welcher Kalender"; gemeint war immer: welche Leute.
 *
 * <code>
 *   Tylko ja        der eigene Bereich — beim ersten Mal angelegt
 *   Ostatnio        die Gruppen, in die man zuletzt eingetragen hat
 *   Wszystkie       jede Gruppe, in der man schreiben darf, im Baum
 * </code>
 */

import { areaPath, type AreaRow } from './area';
import { AreaOptions } from './AreaOptions';

/** Der Wert für „Tylko ja", solange es den eigenen Bereich noch nicht gibt. */
export const PRIVATE = 'private';

/** Wo ich schreiben darf — ohne den eigenen Bereich, der hat seine eigene Zeile. */
export const writableGroups = (areas: readonly AreaRow[]) =>
  areas.filter((a) => a.personal !== true && (a.myLevel === 'write' || a.myLevel === 'admin'));

/** Wie eine Gruppe heisst — „Tylko ja" für den eigenen Bereich, sonst ihr Weg. */
export const groupName = (areas: readonly AreaRow[], areaId: string): string => {
  const found = areas.find((a) => a.areaId === areaId);
  if (found === undefined) return 'inna grupa';
  if (found.personal === true) return 'Tylko ja';
  return areaPath(areas, areaId).full;
};

export function WhoSees({ areas, recent, value, onChange, disabled = false }: {
  areas: readonly AreaRow[];
  /** Die zuletzt benutzten Gruppen, zuerst die letzte. */
  recent: readonly string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const groups = writableGroups(areas);
  const lately = recent.map((id) => groups.find((g) => g.areaId === id)).filter((g): g is AreaRow => g !== undefined).slice(0, 3);
  const personal = areas.find((a) => a.personal === true);

  return (
    <label className="wk-field">
      <span>Kto widzi</span>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value={personal?.areaId ?? PRIVATE}>Tylko ja (prywatne)</option>
        {lately.length > 0 && (
          <optgroup label="Ostatnio">
            {lately.map((g) => <option key={`r-${g.areaId}`} value={g.areaId}>{areaPath(areas, g.areaId).full}</option>)}
          </optgroup>
        )}
        {groups.length > 0 && (
          <optgroup label="Grupy, w których piszesz">
            <AreaOptions areas={areas} only={groups.filter((g) => !lately.includes(g))} />
          </optgroup>
        )}
      </select>
      <span className="wk-hint">
        {value === PRIVATE || value === personal?.areaId
          ? 'Nikt poza Tobą — zaszyfrowane Twoim kluczem.'
          : 'Wszyscy z tej grupy — zaszyfrowane jej kluczem.'}
      </span>
    </label>
  );
}

/* -- Datum und Uhrzeit, wie ein Formular sie will ---------------------------------- */

export const localDate = (at: Date) =>
  `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;

export const localTime = (at: Date) =>
  `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;

/** „2026-10-04" und „18:00" in Ortszeit — als Augenblick. */
export const fromLocal = (date: string, time: string): Date => {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = (time || '00:00').split(':').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, h ?? 0, min ?? 0);
};

/** Die Tage der Woche als Knöpfe — pn=1 … nd=64, wie am Dienst. */
export const WEEK_BITS: readonly { readonly bit: number; readonly label: string }[] = [
  { bit: 1, label: 'pn' }, { bit: 2, label: 'wt' }, { bit: 4, label: 'śr' }, { bit: 8, label: 'czw' },
  { bit: 16, label: 'pt' }, { bit: 32, label: 'sob' }, { bit: 64, label: 'nd' }
];

export const bitOf = (at: Date) => WEEK_BITS[(at.getDay() + 6) % 7].bit;

export function Weekdays({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="wk-days" role="group" aria-label="Dni tygodnia">
      {WEEK_BITS.map((one) => (
        <button
          key={one.bit}
          type="button"
          className={`wk-day-chip${(value & one.bit) !== 0 ? ' is-on' : ''}`}
          aria-pressed={(value & one.bit) !== 0}
          onClick={() => {
            const next = value ^ one.bit;
            onChange(next === 0 ? value : next);
          }}
        >
          {one.label}
        </button>
      ))}
    </div>
  );
}
