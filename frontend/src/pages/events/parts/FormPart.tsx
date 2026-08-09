import { useMemo, useState, type FormEvent } from 'react';
import {
  createEventField,
  deleteEventField,
  reorderEventFields,
  submitEventForm,
  updateEventField,
  type EventFieldKind,
  type EventPart,
  type EventPartField
} from '../../../lib/api';
import { asOptionalText, asRecord, definePart } from './contracts';
import { AreaRow, CheckRow, LinesRow, SelectRow, TextRow } from './editorKit';

type FormConfig = {
  submitLabel: string | null;
  successMessage: string | null;
  consentNote: string | null;
};

const FIELD_KINDS: Array<{ value: EventFieldKind; label: string }> = [
  { value: 'text', label: 'Tekst (jedna linia)' },
  { value: 'textarea', label: 'Tekst (wiele linii)' },
  { value: 'select', label: 'Lista wyboru (jedna opcja)' },
  { value: 'multiselect', label: 'Lista wyboru (wiele opcji)' },
  { value: 'checkbox', label: 'Potwierdzenie' },
  { value: 'number', label: 'Liczba' },
  { value: 'date', label: 'Data' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefon' }
];

const IDENTITY_ROLES: Array<{ value: string; label: string }> = [
  { value: 'none', label: 'Zwykłe pole' },
  { value: 'name', label: 'To jest imię i nazwisko uczestnika' },
  { value: 'contact', label: 'To jest kontakt do uczestnika' }
];

type Values = Record<string, string | string[] | boolean>;

function blankValues(fields: EventPartField[]): Values {
  const values: Values = {};
  for (const field of fields) {
    if (field.kind === 'multiselect') values[field.id] = [];
    else if (field.kind === 'checkbox') values[field.id] = false;
    else if (field.kind === 'select') values[field.id] = field.options[0] ?? '';
    else values[field.id] = '';
  }
  return values;
}

/** Turns one field's UI state into the scalar the API stores. */
function serialize(field: EventPartField, value: string | string[] | boolean): string | null {
  if (field.kind === 'multiselect') {
    const picked = Array.isArray(value) ? value : [];
    return picked.length > 0 ? JSON.stringify(picked) : null;
  }
  if (field.kind === 'checkbox') return value === true ? 'true' : null;
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length > 0 ? text : null;
}

function inputType(kind: EventFieldKind): string {
  if (kind === 'email') return 'email';
  if (kind === 'number') return 'number';
  if (kind === 'date') return 'date';
  if (kind === 'phone') return 'tel';
  return 'text';
}

/** Registration. Fields live in the database, not in ConfigJson. */
export const formPart = definePart<FormConfig>({
  kind: 'form',
  label: 'Formularz',
  description: 'Zapisy: pola wyboru i wpisu, zapisywane jako zgłoszenia.',

  defaultConfig: () => ({
    submitLabel: 'Wyślij zgłoszenie',
    successMessage: 'Dziękujemy za zgłoszenie.',
    consentNote: 'Wysyłając formularz, zgadzasz się na kontakt organizacyjny.'
  }),

  parse: (raw) => {
    const record = asRecord(raw);
    return {
      submitLabel: asOptionalText(record.submitLabel),
      successMessage: asOptionalText(record.successMessage),
      consentNote: asOptionalText(record.consentNote)
    };
  },

  Renderer: ({ config, ctx }) => {
    const fields = useMemo(
      () => [...ctx.part.fields].sort((a, b) => a.sortOrder - b.sortOrder),
      [ctx.part.fields]
    );
    const [values, setValues] = useState<Values>(() => blankValues(fields));
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    if (fields.length === 0) {
      return <p className="ev-note">Ten formularz nie ma jeszcze żadnych pól.</p>;
    }

    const setValue = (id: string, value: string | string[] | boolean) =>
      setValues((previous) => ({ ...previous, [id]: value }));

    const toggleMulti = (id: string, option: string) =>
      setValues((previous) => {
        const current = Array.isArray(previous[id]) ? (previous[id] as string[]) : [];
        return {
          ...previous,
          [id]: current.includes(option) ? current.filter((entry) => entry !== option) : [...current, option]
        };
      });

    const submit = async (event: FormEvent) => {
      event.preventDefault();
      setError(null);
      setSuccess(null);

      const payload = fields.map((field) => ({ fieldId: field.id, value: serialize(field, values[field.id]) }));
      const missing = fields.find(
        (field) => field.isRequired && payload.find((entry) => entry.fieldId === field.id)?.value === null
      );
      if (missing) {
        setError(`Uzupełnij pole „${missing.label}”.`);
        return;
      }

      setPending(true);
      try {
        await submitEventForm(ctx.siteSlug, ctx.part.id, payload, ctx.accessToken);
        setValues(blankValues(fields));
        setSuccess(config.successMessage ?? 'Dziękujemy, zgłoszenie zostało zapisane.');
      } catch (submitError: unknown) {
        setError(submitError instanceof Error ? submitError.message : 'Nie udało się wysłać zgłoszenia.');
      } finally {
        setPending(false);
      }
    };

    return (
      <form className="ev-form" onSubmit={(event) => void submit(event)}>
        {fields.map((field) => {
          const value = values[field.id];

          if (field.kind === 'checkbox') {
            return (
              <label className="ev-check-row" key={field.id}>
                <input
                  type="checkbox"
                  checked={value === true}
                  onChange={(event) => setValue(field.id, event.target.checked)}
                  required={field.isRequired}
                />
                <span>
                  {field.label}
                  {field.helpText ? <small>{field.helpText}</small> : null}
                </span>
              </label>
            );
          }

          if (field.kind === 'multiselect') {
            const picked = Array.isArray(value) ? value : [];
            return (
              <fieldset className="ev-fieldset" key={field.id}>
                <legend>{field.label}</legend>
                {field.helpText ? <small>{field.helpText}</small> : null}
                <div className="ev-check-grid">
                  {field.options.map((option) => (
                    <label className="ev-check-row" key={option}>
                      <input
                        type="checkbox"
                        checked={picked.includes(option)}
                        onChange={() => toggleMulti(field.id, option)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          }

          return (
            <label className={`ev-field ${field.isHalfWidth ? 'is-half' : ''}`} key={field.id}>
              <span className="ev-field-label">
                {field.label}
                {field.isRequired ? <em aria-hidden="true"> *</em> : null}
              </span>

              {field.kind === 'select' ? (
                <select
                  value={typeof value === 'string' ? value : ''}
                  onChange={(event) => setValue(field.id, event.target.value)}
                  required={field.isRequired}
                >
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : field.kind === 'textarea' ? (
                <textarea
                  rows={4}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(event) => setValue(field.id, event.target.value)}
                  required={field.isRequired}
                />
              ) : (
                <input
                  type={inputType(field.kind)}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(event) => setValue(field.id, event.target.value)}
                  required={field.isRequired}
                />
              )}

              {field.helpText ? <small>{field.helpText}</small> : null}
            </label>
          );
        })}

        {config.consentNote ? <p className="ev-consent">{config.consentNote}</p> : null}

        <button className="ev-cta" type="submit" disabled={pending}>
          {pending ? 'Wysyłanie…' : (config.submitLabel ?? 'Wyślij')}
        </button>

        {error ? <p className="ev-error">{error}</p> : null}
        {success ? <p className="ev-success">{success}</p> : null}
      </form>
    );
  },

  Editor: ({ config, onChange, ctx }) => (
    <>
      <TextRow
        label="Napis na przycisku"
        value={config.submitLabel ?? ''}
        onChange={(submitLabel) => onChange({ ...config, submitLabel: submitLabel || null })}
      />
      <AreaRow
        label="Podziękowanie po wysłaniu"
        rows={2}
        value={config.successMessage ?? ''}
        onChange={(successMessage) => onChange({ ...config, successMessage: successMessage || null })}
      />
      <AreaRow
        label="Klauzula pod formularzem"
        rows={2}
        value={config.consentNote ?? ''}
        onChange={(consentNote) => onChange({ ...config, consentNote: consentNote || null })}
      />
      <FieldsEditor part={ctx.part} onChanged={ctx.onStructureChanged} />
    </>
  )
});

// ── Field management ─────────────────────────────────────────────────────────
// Fields are rows in the database rather than config, so they are edited through
// the API instead of the surrounding ConfigJson save.

function FieldsEditor({ part, onChanged }: { part: EventPart; onChanged: () => void }) {
  const fields = useMemo(() => [...part.fields].sort((a, b) => a.sortOrder - b.sortOrder), [part.fields]);
  const [draft, setDraft] = useState({
    kind: 'text' as EventFieldKind,
    label: '',
    helpText: '',
    options: [] as string[],
    isRequired: false,
    isHalfWidth: false,
    identityRole: 'none'
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsOptions = draft.kind === 'select' || draft.kind === 'multiselect';
  const hasName = fields.some((field) => field.identityRole === 'name');

  const add = async () => {
    if (draft.label.trim().length === 0) {
      setError('Podaj etykietę pola.');
      return;
    }
    if (needsOptions && draft.options.length === 0) {
      setError('Pole wyboru wymaga co najmniej jednej opcji.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await createEventField(part.id, {
        kind: draft.kind,
        label: draft.label.trim(),
        helpText: draft.helpText.trim() || null,
        options: needsOptions ? draft.options : null,
        isRequired: draft.isRequired,
        isHalfWidth: draft.isHalfWidth,
        identityRole: draft.identityRole
      });
      setDraft({
        kind: 'text',
        label: '',
        helpText: '',
        options: [],
        isRequired: false,
        isHalfWidth: false,
        identityRole: 'none'
      });
      onChanged();
    } catch (addError: unknown) {
      setError(addError instanceof Error ? addError.message : 'Nie udało się dodać pola.');
    } finally {
      setBusy(false);
    }
  };

  const patch = async (field: EventPartField, changes: Partial<EventPartField>) => {
    const next = { ...field, ...changes };
    await updateEventField(field.id, {
      kind: next.kind,
      label: next.label,
      helpText: next.helpText,
      options: next.options.length > 0 ? next.options : null,
      isRequired: next.isRequired,
      isHalfWidth: next.isHalfWidth,
      identityRole: next.identityRole
    });
    onChanged();
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const ordered = [...fields];
    const [moved] = ordered.splice(index, 1);
    ordered.splice(target, 0, moved);
    await reorderEventFields(part.id, ordered.map((field) => field.id));
    onChanged();
  };

  const remove = async (fieldId: string) => {
    if (!window.confirm('Usunąć to pole? Odpowiedzi na nie zostaną skasowane.')) return;
    await deleteEventField(fieldId);
    onChanged();
  };

  return (
    <fieldset className="eve-group">
      <legend>Pola formularza</legend>

      {!hasName ? (
        <p className="eve-warn">
          Żadne pole nie jest oznaczone jako imię i nazwisko. Bez tego zgłoszenia będą anonimowe i nie da się z nich
          wprost nadać linku osobistego.
        </p>
      ) : null}

      {fields.length === 0 ? (
        <p className="eve-hint">Ten formularz nie ma jeszcze pól.</p>
      ) : (
        <div className="eve-list">
          {fields.map((field, index) => (
            <article className="eve-item" key={field.id}>
              <header>
                <strong>{field.label}</strong>
                <div className="eve-item-tools">
                  <button type="button" onClick={() => void move(index, -1)} disabled={index === 0}>
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => void move(index, 1)}
                    disabled={index === fields.length - 1}
                  >
                    ↓
                  </button>
                  <button type="button" className="eve-remove" onClick={() => void remove(field.id)}>
                    ×
                  </button>
                </div>
              </header>
              <div className="eve-item-body">
                <p className="eve-hint">
                  {FIELD_KINDS.find((entry) => entry.value === field.kind)?.label ?? field.kind}
                  {field.options.length > 0 ? ` · ${field.options.length} opcji` : ''}
                </p>
                <CheckRow
                  label="Wymagane"
                  checked={field.isRequired}
                  onChange={(isRequired) => void patch(field, { isRequired })}
                />
                <CheckRow
                  label="Pół szerokości"
                  checked={field.isHalfWidth}
                  onChange={(isHalfWidth) => void patch(field, { isHalfWidth })}
                />
                <SelectRow
                  label="Rola pola"
                  value={field.identityRole}
                  options={IDENTITY_ROLES}
                  onChange={(identityRole) => void patch(field, { identityRole })}
                />
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="eve-item-body">
        <SelectRow<EventFieldKind>
          label="Typ nowego pola"
          value={draft.kind}
          options={FIELD_KINDS}
          onChange={(kind) => setDraft({ ...draft, kind })}
        />
        <TextRow label="Etykieta" value={draft.label} onChange={(label) => setDraft({ ...draft, label })} />
        <TextRow
          label="Podpowiedź"
          value={draft.helpText}
          onChange={(helpText) => setDraft({ ...draft, helpText })}
        />
        {needsOptions ? (
          <LinesRow label="Opcje" values={draft.options} onChange={(options) => setDraft({ ...draft, options })} />
        ) : null}
        <CheckRow
          label="Wymagane"
          checked={draft.isRequired}
          onChange={(isRequired) => setDraft({ ...draft, isRequired })}
        />
        <CheckRow
          label="Pół szerokości"
          checked={draft.isHalfWidth}
          onChange={(isHalfWidth) => setDraft({ ...draft, isHalfWidth })}
        />
        <SelectRow
          label="Rola pola"
          value={draft.identityRole}
          options={IDENTITY_ROLES}
          onChange={(identityRole) => setDraft({ ...draft, identityRole })}
        />

        {error ? <p className="eve-error">{error}</p> : null}

        <button type="button" className="eve-add" onClick={() => void add()} disabled={busy}>
          + {busy ? 'Dodawanie…' : 'Dodaj pole'}
        </button>
      </div>
    </fieldset>
  );
}
