import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { LibraryCopyStrings } from './libraryCopy';
import { languageLabel } from './libraryCopy';
import { LANGUAGE_CODES, type LibraryContribution, type LibraryContributionSave, type LibraryPerson } from './libraryApi';

// ── Primitives ───────────────────────────────────────────────────────────────

export function Field({
  label,
  hint,
  required,
  children
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="lib-field">
      <span className="lib-field-label">
        {label}
        {required ? <span className="lib-field-required">*</span> : null}
      </span>
      {children}
      {hint ? <span className="lib-field-hint">{hint}</span> : null}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  maxLength,
  autoFocus
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
}) {
  return (
    <input
      className="lib-input"
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      autoFocus={autoFocus}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function TextArea({
  value,
  onChange,
  rows = 4,
  placeholder
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      className="lib-input lib-textarea"
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  placeholder
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}) {
  return (
    <input
      className="lib-input"
      type="number"
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onChange={(event) => {
        const raw = event.target.value;
        if (raw === '') {
          onChange(null);
          return;
        }
        const parsed = Number(raw);
        onChange(Number.isFinite(parsed) ? parsed : null);
      }}
    />
  );
}

export function DateInput({
  value,
  onChange
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <input
      className="lib-input"
      type="date"
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
    />
  );
}

export type SelectOption = { value: string; label: string };

export function Select({
  value,
  onChange,
  options,
  placeholder
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
}) {
  return (
    <select className="lib-input lib-select" value={value} onChange={(event) => onChange(event.target.value)}>
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="lib-toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Section({
  title,
  hint,
  actions,
  children
}: {
  title: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="lib-section">
      <header className="lib-section-head">
        <div>
          <h2 className="lib-section-title">{title}</h2>
          {hint ? <p className="lib-section-hint">{hint}</p> : null}
        </div>
        {actions ? <div className="lib-section-actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="lib-error" role="alert" onClick={onDismiss}>
      {message}
    </div>
  );
}

export function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="lib-empty">
      <p>{text}</p>
      {action}
    </div>
  );
}

export function Loading({ text }: { text: string }) {
  return <div className="lib-loading">{text}</div>;
}

export function Badge({ children, tone }: { children: ReactNode; tone?: 'translation' | 'original' | 'warn' | 'muted' }) {
  return <span className={`lib-badge${tone ? ` lib-badge-${tone}` : ''}`}>{children}</span>;
}

export function Rating({ value }: { value: number | null }) {
  if (value === null) return null;
  return (
    <span className="lib-rating" title={`${value}/10`}>
      {value}
      <span className="lib-rating-max">/10</span>
    </span>
  );
}

/** Modal shell. Escape closes; the backdrop is a button so it stays keyboard reachable. */
export function Modal({
  title,
  onClose,
  children,
  footer
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="lib-modal-layer">
      <button type="button" className="lib-modal-scrim" aria-label={title} onClick={onClose} />
      <div className="lib-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="lib-modal-head">
          <h2>{title}</h2>
          <button type="button" className="lib-btn lib-btn-ghost lib-btn-sm" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="lib-modal-body">{children}</div>
        {footer ? <footer className="lib-modal-foot">{footer}</footer> : null}
      </div>
    </div>
  );
}

export function Pagination({
  t,
  skip,
  take,
  total,
  onSkip
}: {
  t: LibraryCopyStrings;
  skip: number;
  take: number;
  total: number;
  onSkip: (skip: number) => void;
}) {
  if (total <= take) return null;
  const from = total === 0 ? 0 : skip + 1;
  const to = Math.min(skip + take, total);
  return (
    <div className="lib-pagination">
      <button
        type="button"
        className="lib-btn lib-btn-ghost lib-btn-sm"
        disabled={skip <= 0}
        onClick={() => onSkip(Math.max(0, skip - take))}
      >
        {t.common.previous}
      </button>
      <span className="lib-pagination-info">
        {t.common.showing} {from}–{to} {t.common.of} {total}
      </span>
      <button
        type="button"
        className="lib-btn lib-btn-ghost lib-btn-sm"
        disabled={to >= total}
        onClick={() => onSkip(skip + take)}
      >
        {t.common.next}
      </button>
    </div>
  );
}

// ── Composite pickers ────────────────────────────────────────────────────────

/** Language picker over the known codes; any other code already in use stays selectable. */
export function LanguageSelect({
  t,
  value,
  onChange,
  placeholder
}: {
  t: LibraryCopyStrings;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const options = useMemo<SelectOption[]>(() => {
    const known: SelectOption[] = LANGUAGE_CODES.map((code) => ({
      value: code,
      label: `${languageLabel(t, code)} (${code})`
    }));
    if (value && !LANGUAGE_CODES.includes(value as (typeof LANGUAGE_CODES)[number])) {
      known.unshift({ value, label: value });
    }
    return known;
  }, [t, value]);

  return <Select value={value} onChange={onChange} options={options} placeholder={placeholder} />;
}

export function vocabularyOptions(values: readonly string[], labels: Record<string, string>): SelectOption[] {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

/**
 * Type-ahead person picker. Filters the already-loaded people list rather than
 * hitting the API on each keystroke — a private library's cast stays small.
 */
export function PersonPicker({
  t,
  people,
  onPick,
  placeholder
}: {
  t: LibraryCopyStrings;
  people: LibraryPerson[];
  onPick: (person: LibraryPerson) => void;
  placeholder?: string;
}) {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const matches = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return people.slice(0, 8);
    return people
      .filter(
        (person) =>
          person.displayName.toLowerCase().includes(needle) ||
          (person.sortName ?? '').toLowerCase().includes(needle)
      )
      .slice(0, 8);
  }, [people, term]);

  return (
    <div className="lib-picker" ref={containerRef}>
      <input
        className="lib-input"
        value={term}
        placeholder={placeholder ?? t.people.searchPlaceholder}
        onFocusCapture={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setTerm(event.target.value);
          setOpen(true);
        }}
      />
      {open && matches.length > 0 ? (
        <ul className="lib-picker-list">
          {matches.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(person);
                  setTerm('');
                  setOpen(false);
                }}
              >
                <span>{person.displayName}</span>
                {person.birthYear || person.deathYear ? (
                  <span className="lib-picker-meta">
                    {person.birthYear ?? '?'}–{person.deathYear ?? ''}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Editor for the contribution list of a work or an edition. Order is meaningful
 * (first author reads first), so rows can be moved up and down.
 */
export function ContributionEditor({
  t,
  people,
  contributions,
  roles,
  onChange
}: {
  t: LibraryCopyStrings;
  people: LibraryPerson[];
  contributions: LibraryContributionSave[];
  roles: readonly string[];
  onChange: (contributions: LibraryContributionSave[]) => void;
}) {
  const nameById = useMemo(() => new Map(people.map((person) => [person.id, person.displayName])), [people]);
  const roleOptions = useMemo(() => vocabularyOptions(roles, t.roles), [roles, t.roles]);

  const move = (index: number, delta: number) => {
    const next = [...contributions];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="lib-contributions">
      {contributions.length === 0 ? (
        <p className="lib-muted">{t.common.none}</p>
      ) : (
        <ul className="lib-contribution-list">
          {contributions.map((contribution, index) => (
            <li key={`${contribution.personId}-${index}`} className="lib-contribution-row">
              <span className="lib-contribution-name">
                {nameById.get(contribution.personId) ?? t.common.unknown}
              </span>
              <Select
                value={contribution.role}
                onChange={(role) => {
                  const next = [...contributions];
                  next[index] = { ...next[index], role };
                  onChange(next);
                }}
                options={roleOptions}
              />
              <div className="lib-contribution-actions">
                <button
                  type="button"
                  className="lib-btn lib-btn-ghost lib-btn-sm"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label="↑"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="lib-btn lib-btn-ghost lib-btn-sm"
                  disabled={index === contributions.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label="↓"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="lib-btn lib-btn-danger lib-btn-sm"
                  onClick={() => onChange(contributions.filter((_, i) => i !== index))}
                >
                  {t.common.remove}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <PersonPicker
        t={t}
        people={people}
        onPick={(person) => {
          if (contributions.some((item) => item.personId === person.id)) return;
          onChange([...contributions, { personId: person.id, role: roles[0] }]);
        }}
      />
    </div>
  );
}

export function toContributionSaves(contributions: LibraryContribution[]): LibraryContributionSave[] {
  return contributions.map((item) => ({ personId: item.personId, role: item.role }));
}

/** Trims a form string down to the null the API expects for "not set". */
export function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  return value.slice(0, 10);
}
