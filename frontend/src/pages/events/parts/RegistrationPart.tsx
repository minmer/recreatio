import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { getOwnRegistration, updateOwnRegistration, type EventOwnRegistration } from '../../../lib/api';
import { asOptionalText, asRecord, definePart } from './contracts';
import { AreaRow, TextRow } from './editorKit';
import { FormFields, serializeValue, valuesFrom, type FieldValues } from './formFields';

type RegistrationConfig = {
  saveLabel: string | null;
  savedMessage: string | null;
  note: string | null;
};

function formatMoment(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pl-PL', { dateStyle: 'long', timeStyle: 'short' });
}

/**
 * The reader's own submission, opened for correction.
 *
 * Only ever useful behind an individual link: the token decides whose
 * registration comes back, so this part shows nothing at all on the public page.
 * Correcting is also the practical face of RODO art. 16 — the right to have
 * inaccurate data rectified — done by the person rather than by mail to the
 * organizer.
 */
export const registrationPart = definePart<RegistrationConfig>({
  kind: 'registration',
  label: 'Twoje zgłoszenie',
  description: 'Pozwala osobie z linkiem osobistym poprawić dane, które wysłała w formularzu zapisów.',

  defaultConfig: () => ({
    saveLabel: 'Zapisz poprawki',
    savedMessage: 'Dane zostały zaktualizowane.',
    note: 'Możesz poprawić swoje dane w każdej chwili — organizator widzi zawsze aktualną wersję.'
  }),

  parse: (raw) => {
    const record = asRecord(raw);
    return {
      saveLabel: asOptionalText(record.saveLabel),
      savedMessage: asOptionalText(record.savedMessage),
      note: asOptionalText(record.note)
    };
  },

  Renderer: ({ config, ctx }) => {
    const token = ctx.accessToken;
    const [data, setData] = useState<EventOwnRegistration | null>(null);
    const [values, setValues] = useState<FieldValues>({});
    const [loading, setLoading] = useState(true);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState<string | null>(null);

    const load = useCallback(async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const response = await getOwnRegistration(token);
        setData(response);
        if (response) setValues(valuesFrom(response.fields, response.values));
      } catch (loadError: unknown) {
        setError(loadError instanceof Error ? loadError.message : 'Nie udało się pobrać zgłoszenia.');
      } finally {
        setLoading(false);
      }
    }, [token]);

    useEffect(() => {
      void load();
    }, [load]);

    const fields = useMemo(
      () => (data ? [...data.fields].sort((a, b) => a.sortOrder - b.sortOrder) : []),
      [data]
    );

    if (!token) {
      return <p className="ev-note">Ta sekcja działa tylko z linku osobistego.</p>;
    }
    if (loading) {
      return <p className="ev-note">Wczytywanie zgłoszenia…</p>;
    }
    if (error && !data) {
      return <p className="ev-error">{error}</p>;
    }
    if (!data) {
      return <p className="ev-note">Do tego linku nie jest przypisane żadne zgłoszenie z formularza.</p>;
    }

    const setValue = (id: string, value: string | string[] | boolean) =>
      setValues((previous) => ({ ...previous, [id]: value }));

    const save = async (event: FormEvent) => {
      event.preventDefault();
      setError(null);
      setSaved(null);

      const payload = fields.map((field) => ({
        fieldId: field.id,
        value: serializeValue(field, values[field.id])
      }));
      const missing = fields.find(
        (field) => field.isRequired && payload.find((entry) => entry.fieldId === field.id)?.value === null
      );
      if (missing) {
        setError(`Uzupełnij pole „${missing.label}”.`);
        return;
      }

      setPending(true);
      try {
        await updateOwnRegistration(token, payload);
        setSaved(config.savedMessage ?? 'Dane zostały zapisane.');
        // Re-read rather than trust the local copy: the answer that comes back
        // is what the organizer will actually see.
        await load();
      } catch (saveError: unknown) {
        setError(saveError instanceof Error ? saveError.message : 'Nie udało się zapisać poprawek.');
      } finally {
        setPending(false);
      }
    };

    return (
      <div className="ev-own">
        <p className="ev-own-meta">
          Zgłoszenie wysłane {formatMoment(data.submittedUtc)}
          {data.updatedUtc ? ` · poprawione ${formatMoment(data.updatedUtc)}` : ''}
        </p>

        {config.note ? <p className="ev-note">{config.note}</p> : null}

        <form className="ev-form" onSubmit={(event) => void save(event)}>
          <FormFields fields={fields} values={values} onChange={setValue} />

          <button className="ev-cta" type="submit" disabled={pending}>
            {pending ? 'Zapisywanie…' : (config.saveLabel ?? 'Zapisz poprawki')}
          </button>

          {error ? <p className="ev-error">{error}</p> : null}
          {saved ? <p className="ev-success">{saved}</p> : null}
        </form>
      </div>
    );
  },

  Editor: ({ config, onChange }) => (
    <>
      <p className="eve-hint">
        Ta sekcja pokazuje osobie z linkiem jej własne zgłoszenie z formularza zapisów i pozwala je poprawić. Pola
        biorą się z formularza — tutaj nie ustawia się ich osobno.
      </p>
      <TextRow
        label="Napis na przycisku"
        value={config.saveLabel ?? ''}
        onChange={(saveLabel) => onChange({ ...config, saveLabel: saveLabel || null })}
      />
      <AreaRow
        label="Komunikat po zapisaniu"
        rows={2}
        value={config.savedMessage ?? ''}
        onChange={(savedMessage) => onChange({ ...config, savedMessage: savedMessage || null })}
      />
      <AreaRow
        label="Wyjaśnienie nad formularzem"
        rows={2}
        value={config.note ?? ''}
        onChange={(note) => onChange({ ...config, note: note || null })}
      />
    </>
  )
});
