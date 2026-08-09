import type { ReactNode } from 'react';

/**
 * Shared editor primitives. Every part builds its editor from these, so the
 * builder looks and behaves the same no matter which part you are editing.
 */

export function TextRow({
  label,
  value,
  onChange,
  hint,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <label className="eve-row">
      <span>{label}</span>
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function AreaRow({
  label,
  value,
  onChange,
  rows = 3,
  hint
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="eve-row">
      <span>{label}</span>
      <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function NumberRow({
  label,
  value,
  onChange,
  step = 1,
  hint
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  step?: number;
  hint?: string;
}) {
  return (
    <label className="eve-row">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number.parseFloat(event.target.value))}
      />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function CheckRow({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="eve-check">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function SelectRow<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (next: T) => void;
}) {
  return (
    <label className="eve-row">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Newline-separated text mapped to and from a string array. */
export function LinesRow({
  label,
  values,
  onChange,
  rows = 4,
  hint
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  rows?: number;
  hint?: string;
}) {
  return (
    <AreaRow
      label={label}
      rows={rows}
      hint={hint ?? 'Jedna pozycja na linię.'}
      value={values.join('\n')}
      onChange={(next) =>
        onChange(
          next
            .split('\n')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0)
        )
      }
    />
  );
}

export function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="eve-group">
      <legend>{legend}</legend>
      {children}
    </fieldset>
  );
}

/**
 * Add / remove / reorder for a list of structured items. The part supplies how
 * to render one row and how to build a blank one.
 */
export function ListEditor<T>({
  legend,
  items,
  onChange,
  blank,
  addLabel = 'Dodaj',
  renderItem,
  titleOf
}: {
  legend: string;
  items: T[];
  onChange: (next: T[]) => void;
  blank: () => T;
  addLabel?: string;
  renderItem: (item: T, update: (next: T) => void) => ReactNode;
  titleOf: (item: T, index: number) => string;
}) {
  const replace = (index: number, next: T) => {
    const copy = [...items];
    copy[index] = next;
    onChange(copy);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const copy = [...items];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    onChange(copy);
  };

  const remove = (index: number) => {
    onChange(items.filter((_, entryIndex) => entryIndex !== index));
  };

  return (
    <Fieldset legend={legend}>
      <div className="eve-list">
        {items.map((item, index) => (
          <article className="eve-item" key={index}>
            <header>
              <strong>{titleOf(item, index)}</strong>
              <div className="eve-item-tools">
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Wyżej">
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  aria-label="Niżej"
                >
                  ↓
                </button>
                <button type="button" className="eve-remove" onClick={() => remove(index)} aria-label="Usuń">
                  ×
                </button>
              </div>
            </header>
            <div className="eve-item-body">{renderItem(item, (next) => replace(index, next))}</div>
          </article>
        ))}
      </div>
      <button type="button" className="eve-add" onClick={() => onChange([...items, blank()])}>
        + {addLabel}
      </button>
    </Fieldset>
  );
}
