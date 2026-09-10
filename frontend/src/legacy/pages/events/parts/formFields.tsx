import type { EventFieldKind, EventPartField } from '../../../lib/api';

/**
 * Rendering and (de)serializing the fields of a form part. Shared by the public
 * form and by the page where a person corrects what they already sent, so the
 * two can never drift into showing the same field differently.
 */
export type FieldValues = Record<string, string | string[] | boolean>;

export function blankValues(fields: EventPartField[]): FieldValues {
  const values: FieldValues = {};
  for (const field of fields) {
    if (field.kind === 'multiselect') values[field.id] = [];
    else if (field.kind === 'checkbox') values[field.id] = false;
    else if (field.kind === 'select') values[field.id] = field.options[0] ?? '';
    else values[field.id] = '';
  }
  return values;
}

/** Turns one field's UI state into the scalar the API stores. */
export function serializeValue(field: EventPartField, value: string | string[] | boolean): string | null {
  if (field.kind === 'multiselect') {
    const picked = Array.isArray(value) ? value : [];
    return picked.length > 0 ? JSON.stringify(picked) : null;
  }
  if (field.kind === 'checkbox') return value === true ? 'true' : null;
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length > 0 ? text : null;
}

/** The inverse: stored answers back into the shapes the inputs expect. */
export function valuesFrom(
  fields: EventPartField[],
  stored: Array<{ fieldId: string; value: string | null }>
): FieldValues {
  const byField = new Map(stored.map((entry) => [entry.fieldId, entry.value]));
  const values = blankValues(fields);

  for (const field of fields) {
    const raw = byField.get(field.id) ?? null;
    if (raw === null) continue;

    if (field.kind === 'multiselect') {
      try {
        const parsed: unknown = JSON.parse(raw);
        values[field.id] = Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        // A multiselect answer written before the field changed kind.
        values[field.id] = [];
      }
    } else if (field.kind === 'checkbox') {
      values[field.id] = raw === 'true';
    } else {
      values[field.id] = raw;
    }
  }

  return values;
}

export function inputType(kind: EventFieldKind): string {
  if (kind === 'email') return 'email';
  if (kind === 'number') return 'number';
  if (kind === 'date') return 'date';
  if (kind === 'phone') return 'tel';
  return 'text';
}

/** The fields themselves. The surrounding <form>, button and messages are the caller's. */
export function FormFields({
  fields,
  values,
  onChange
}: {
  fields: EventPartField[];
  values: FieldValues;
  onChange: (fieldId: string, value: string | string[] | boolean) => void;
}) {
  const toggleMulti = (field: EventPartField, option: string) => {
    const current = Array.isArray(values[field.id]) ? (values[field.id] as string[]) : [];
    onChange(
      field.id,
      current.includes(option) ? current.filter((entry) => entry !== option) : [...current, option]
    );
  };

  return (
    <>
      {fields.map((field) => {
        const value = values[field.id];

        if (field.kind === 'checkbox') {
          return (
            <label className="ev-check-row" key={field.id}>
              <input
                type="checkbox"
                checked={value === true}
                onChange={(event) => onChange(field.id, event.target.checked)}
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
                      onChange={() => toggleMulti(field, option)}
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
                onChange={(event) => onChange(field.id, event.target.value)}
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
                onChange={(event) => onChange(field.id, event.target.value)}
                required={field.isRequired}
              />
            ) : (
              <input
                type={inputType(field.kind)}
                value={typeof value === 'string' ? value : ''}
                onChange={(event) => onChange(field.id, event.target.value)}
                required={field.isRequired}
              />
            )}

            {field.helpText ? <small>{field.helpText}</small> : null}
          </label>
        );
      })}
    </>
  );
}
