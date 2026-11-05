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

import { t, useT } from '../core/i18n';
import { areaPath, type AreaRow } from './area';
import { AreaPick } from './AreaPick';

/** Der Wert für „Tylko ja", solange es den eigenen Bereich noch nicht gibt. */
export const PRIVATE = 'private';

/** Wo ich schreiben darf — ohne den eigenen Bereich, der hat seine eigene Zeile. */
export const writableGroups = (areas: readonly AreaRow[]) =>
  areas.filter((a) => a.personal !== true && (a.myLevel === 'write' || a.myLevel === 'admin'));

/** Wie eine Gruppe heisst — „Tylko ja" für den eigenen Bereich, sonst ihr Weg. */
export const groupName = (areas: readonly AreaRow[], areaId: string): string => {
  const found = areas.find((a) => a.areaId === areaId);
  if (found === undefined) return t('areas.whoSees.otherGroup');
  if (found.personal === true) return t('areas.whoSees.onlyMe');
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
  const t = useT();
  const groups = writableGroups(areas);
  const lately = recent.map((id) => groups.find((g) => g.areaId === id)).filter((g): g is AreaRow => g !== undefined).slice(0, 3);
  const personal = areas.find((a) => a.personal === true);

  return (
    <label className="wk-field">
      <span>{t('areas.whoSees.label')}</span>
      <AreaPick
        label={t('areas.whoSees.label')} value={value} onChange={onChange} disabled={disabled}
        areas={areas} only={groups} recent={lately.map((g) => g.areaId)}
        extras={[{ value: personal?.areaId ?? PRIVATE, label: t('areas.whoSees.onlyMePrivate') }]}
      />
      <span className="wk-hint">
        {value === PRIVATE || value === personal?.areaId
          ? t('areas.whoSees.privateHint')
          : t('areas.whoSees.groupHint')}
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
  { bit: 1, get label() { return t('areas.week.mon'); } }, { bit: 2, get label() { return t('areas.week.tue'); } },
  { bit: 4, get label() { return t('areas.week.wed'); } }, { bit: 8, get label() { return t('areas.week.thu'); } },
  { bit: 16, get label() { return t('areas.week.fri'); } }, { bit: 32, get label() { return t('areas.week.sat'); } },
  { bit: 64, get label() { return t('areas.week.sun'); } }
];

const WEEK_KEY: Readonly<Record<number, string>> = {
  1: 'areas.week.mon', 2: 'areas.week.tue', 4: 'areas.week.wed', 8: 'areas.week.thu', 16: 'areas.week.fri', 32: 'areas.week.sat', 64: 'areas.week.sun'
};

export const bitOf = (at: Date) => WEEK_BITS[(at.getDay() + 6) % 7].bit;

export function Weekdays({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const t = useT();
  return (
    <div className="wk-days" role="group" aria-label={t('areas.week.label')}>
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
          {t(WEEK_KEY[one.bit] ?? '')}
        </button>
      ))}
    </div>
  );
}
