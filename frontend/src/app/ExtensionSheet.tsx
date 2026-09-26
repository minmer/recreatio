/**
 * DIE ERWEITERUNG EINES FORMULARS, AUS SICHT DER KANZLEI (0047).
 *
 * <b>Eine Zeile je Mensch des erweiterten Formulars</b> — nicht je Einsendung
 * der Erweiterung. Der Koordinator sucht „Kowalski" und schreibt dazu, was er
 * über ihn wissen muss; ob es dazu schon etwas gibt, sieht er an der Zeile.
 *
 * <code>
 *   ExtensionEntry   was EIN Mensch ergänzt hat — lesen, und wo erlaubt: schreiben
 *   ExtensionSheet   alle Menschen des Formulars, mit ihrer Ergänzung
 * </code>
 *
 * <b>Schreiben darf die Kanzlei nur, was sie selbst ausfüllt</b>
 * (`audience = office`). Was der Mensch ergänzt, liest sie; es für ihn zu
 * schreiben hiesse, ihm eine Angabe unterzuschieben, die er in seinem Portal
 * nie gesehen hat.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  addOfficeEntry, fullNameOf, reviseAcrossAsOffice,
  type Audience, type OpenField, type Submission
} from './form';
import { evaluate, layoutWith, missingIn } from './formDesign';
import { FormFlow, isRequired } from './FormFlow';
import { readForm, type ReadForm } from './formRead';
import { keysFor } from './ringOf';
import { WorkspaceError, type Who } from './session';

/** Wie ein Mensch in einer Liste heisst — sein voller Name, sonst die erste Antwort. */
export function nameIn(values: ReadonlyMap<string, string> | undefined, fields: readonly OpenField[]): string {
  if (values === undefined) return '— zapieczętowane —';

  const full = fullNameOf(fields, (fieldId) => values.get(fieldId));
  if (full !== null) return full;

  const first = fields.find((f) => f.kind === 'line' && (values.get(f.fieldId)?.trim() ?? '') !== '');
  return first === undefined ? '— bez imienia —' : values.get(first.fieldId)!.trim();
}

/* -- Was EIN Mensch ergänzt hat -------------------------------------------------- */

/**
 * @param entry Die Ergänzung dieses Menschen — oder `undefined`: noch keine.
 * @param editable Darf die Kanzlei hier schreiben? Nur bei einer Erweiterung,
 *   die sie selbst ausfüllt.
 */
export function ExtensionEntry({ extensionId, ext, baseRegistrationId, entry, editable, onSaved }: {
  extensionId: string;
  ext: ReadForm;
  baseRegistrationId: string;
  entry: Submission | undefined;
  editable: boolean;
  onSaved: () => void;
}) {
  const values = entry === undefined ? undefined : ext.opened.get(entry.registrationId);

  const [editing, setEditing] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const byId = useMemo(() => new Map(ext.fields.map((f) => [f.fieldId, f])), [ext.fields]);
  const layout = useMemo(
    () => layoutWith(ext.design?.layout ?? [], ext.fields.map((f) => f.fieldId)), [ext.design, ext.fields]);
  const outcome = useMemo(
    () => evaluate({ version: 1, layout, nodes: ext.design?.nodes ?? [], edges: ext.design?.edges ?? [] }, answers),
    [layout, ext.design, answers]);

  const start = () => {
    const from: Record<string, string> = {};
    for (const f of ext.fields) from[f.fieldId] = values?.get(f.fieldId) ?? '';
    setAnswers(from);
    setFailed(null);
    setEditing(true);
  };

  const missing = missingIn(layout, isRequired(byId, outcome), answers, outcome);

  const save = async () => {
    setBusy(true);
    setFailed(null);

    try {
      /* Nur, was zu sehen war — eine verborgene Frage schreibt nichts. */
      const shown = ext.fields.filter((f) => !outcome.hidden.has(f.fieldId));
      const keys = { intakes: ext.intakes, areaOf: ext.areaOf, seatKey: null };

      if (entry === undefined) {
        await addOfficeEntry(extensionId, baseRegistrationId,
          shown.map((f) => ({ fieldId: f.fieldId, value: answers[f.fieldId] ?? '' })), keys);
      } else {
        const changed = shown.filter((f) => (answers[f.fieldId] ?? '') !== (values?.get(f.fieldId) ?? ''));
        if (changed.length > 0) {
          await reviseAcrossAsOffice(entry.registrationId,
            changed.map((f) => ({ fieldId: f.fieldId, value: answers[f.fieldId] ?? '' })), keys);
        }
      }

      setEditing(false);
      onSaved();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <form className="wk-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <FormFlow
          items={layout}
          fields={byId}
          answers={answers}
          outcome={outcome}
          onAnswer={(fieldId, value) => setAnswers((before) => ({ ...before, [fieldId]: value }))}
        />

        {failed !== null && <p className="wk-error">{failed}</p>}

        <div className="wk-actions">
          <button type="submit" className="wk-btn" disabled={busy || missing.length > 0}>
            {busy ? 'Zapisywanie…' : 'Zapisz'}
          </button>
          <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setEditing(false)}>
            Anuluj
          </button>
          {missing.length > 0 && (
            <span className="wk-blocker">
              Brakuje: {missing.map((id) => byId.get(id)?.label ?? 'zapieczętowane').join(', ')}
            </span>
          )}
        </div>
      </form>
    );
  }

  return (
    <>
      {entry === undefined ? (
        <p className="wk-empty">Jeszcze nic nie uzupełniono.</p>
      ) : values === undefined || values.size === 0 ? (
        <p className="wk-empty">Uzupełnione {new Date(entry.submittedAt).toLocaleDateString('pl-PL')} — tych odpowiedzi nie otworzysz tym kluczem.</p>
      ) : (
        <dl className="wk-card-lines">
          {ext.fields.filter((f) => values.has(f.fieldId)).map((f) => (
            <div key={f.fieldId}>
              <dt className="wk-row-side">{f.label ?? 'zapieczętowane pytanie'}</dt>
              <dd>{values.get(f.fieldId) === '' ? '—' : values.get(f.fieldId)}</dd>
            </div>
          ))}
        </dl>
      )}

      {editable && (
        <div className="wk-actions">
          <button type="button" className="wk-link-btn" onClick={start} disabled={ext.fields.length === 0}>
            {entry === undefined ? 'Uzupełnij' : 'Edytuj'}
          </button>
          {ext.fields.length === 0 && <span className="wk-hint">To rozszerzenie nie ma jeszcze pytań.</span>}
        </div>
      )}
    </>
  );
}

/* -- Alle Menschen, mit ihrer Ergänzung -------------------------------------------- */

/**
 * Die Liste des Koordinators — auf der Seite, auf der das Formular steht, und
 * im Reiter „Osoby" der Erweiterung selbst.
 */
export function ExtensionSheet({ extensionId, baseId, audience, who }: {
  extensionId: string;
  baseId: string;
  audience: Audience;
  who: Who;
}) {
  const [base, setBase] = useState<ReadForm | null>(null);
  const [ext, setExt] = useState<ReadForm | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [only, setOnly] = useState<'all' | 'missing'>('all');

  const look = useCallback(async () => {
    try {
      const { ring } = await keysFor(who);
      if (ring === null) throw new WorkspaceError('Bez hasła w tej karcie nie da się otworzyć zgłoszeń.');

      const [b, e] = await Promise.all([readForm(baseId, ring), readForm(extensionId, ring)]);
      setBase(b);
      setExt(e);
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się otworzyć zgłoszeń.');
    }
  }, [who, baseId, extensionId]);

  useEffect(() => { void look(); }, [look]);

  if (failed !== null) return <p className="wk-error">{failed}</p>;
  if (base === null || ext === null) return <p className="wk-card-text">Otwieranie…</p>;

  const entryOf = (registrationId: string) => ext.registrations.find((r) => r.baseId === registrationId);

  const rows = base.registrations
    .filter((r) => r.withdrawnAt === null)
    .map((r) => ({ r, name: nameIn(base.opened.get(r.registrationId), base.fields), entry: entryOf(r.registrationId) }))
    .filter((one) => only === 'all' || one.entry === undefined)
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'));

  const missingCount = base.registrations.filter((r) => r.withdrawnAt === null && entryOf(r.registrationId) === undefined).length;

  return (
    <section className="wk-panel">
      <div className="wk-sms-bar">
        <h3 className="wk-h2">Osoby ({base.registrations.filter((r) => r.withdrawnAt === null).length})</h3>
        <label className="wk-inline">
          <span className="wk-hint">Pokaż:</span>
          <select value={only} onChange={(e) => setOnly(e.target.value === 'missing' ? 'missing' : 'all')}>
            <option value="all">wszystkie osoby</option>
            <option value="missing">bez uzupełnienia ({missingCount})</option>
          </select>
        </label>
      </div>

      <p className="wk-hint">
        {audience === 'office'
          ? 'To wypełnia tylko koordynator — osoba nie widzi ani pytań, ani odpowiedzi.'
          : 'To uzupełnia osoba przez swój link. Tutaj widzisz, co wpisała.'}
      </p>

      {rows.length === 0 ? (
        <p className="wk-empty">{only === 'missing' ? 'Wszyscy mają uzupełnione.' : 'Nikt się jeszcze nie zapisał.'}</p>
      ) : (
        <ul className="wk-entry-list">
          {rows.map(({ r, name, entry }) => {
            const open = openId === r.registrationId;

            return (
              <li key={r.registrationId} className="wk-entry">
                <div className="wk-entry-head">
                  <strong className="wk-entry-name">{name}</strong>
                  <span className="wk-tags">
                    {entry === undefined
                      ? <span className="wk-tag">brak</span>
                      : <span className="wk-tag wk-tag-open">uzupełnione</span>}
                  </span>
                  <button
                    type="button" className="wk-link-btn wk-entry-more" aria-expanded={open}
                    onClick={() => setOpenId(open ? null : r.registrationId)}
                  >
                    {open ? 'Mniej' : audience === 'office' && entry === undefined ? 'Uzupełnij' : 'Więcej'}
                  </button>
                </div>

                {open && (
                  <div className="wk-entry-body">
                    <ExtensionEntry
                      extensionId={extensionId}
                      ext={ext}
                      baseRegistrationId={r.registrationId}
                      entry={entry}
                      editable={audience === 'office'}
                      onSaved={() => void look()}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
