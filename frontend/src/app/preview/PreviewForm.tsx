/**
 * 2026-10-27 — EIN FORMULAR, DESSEN FRAGEN ERST DER IMPORT ANLEGT, in der
 * Vorschau: gezeichnet aus dem Dokument selbst — seine Fragen
 * (`readQuestions`), sein Aufbau (`readDesign`, Seiten, Reiter, Gruppen) und
 * seine Logik (`evaluate`: was erscheint, was Pflicht wird) — mit derselben
 * Gestalt wie auf der Seite (`FormFlow`, `wk-form`, „Wyślij").
 *
 * <b>Was fehlt, sagt er:</b> die Klausel des Administratora danych kommt aus
 * dem Bereich, in den die Antworten gehen, und den wählt erst, wer importiert;
 * absenden geht nicht. Man kann ihn aber ausfüllen — die Logik antwortet.
 */

import { useMemo, useState } from 'react';

import type { OpenField } from '../forms/form';
import { FormFlow, isRequired } from '../forms/FormFlow';
import { evaluate, layoutWith, readDesign } from '../forms/formDesign';
import { readQuestions } from '../forms/formJson';

/** Eine Frage des Dokuments als offenes Feld — wie es nach dem Import aufgemacht wäre. */
function fieldOf(q: ReturnType<typeof readQuestions>[number], id: string, position: number): OpenField {
  return {
    fieldId: id,
    areaId: '',
    labelAreaId: '',
    labelEpoch: 0,
    kind: q.kind,
    position,
    labelSealed: '',
    helpSealed: null,
    optionsSealed: null,
    epoch: 0,
    isRequired: q.required,
    isHalfWidth: q.halfWidth,
    identityRole: q.identity,
    selfEdit: q.selfEdit,
    personOnly: q.personOnly,
    linkCheck: false,
    label: q.label,
    help: q.help,
    options: q.options
  };
}

export function PreviewForm({ title, questions, design }: { title: string; questions: unknown; design: unknown }) {
  const fields = useMemo(() => {
    const read = readQuestions(questions, []);
    return new Map(read.map((q, i) => {
      const id = q.id !== '' ? q.id : `q${i + 1}`;
      return [id, fieldOf(q, id, i)] as const;
    }));
  }, [questions]);
  const plan = useMemo(() => readDesign(design), [design]);
  const layout = useMemo(() => layoutWith(plan.layout, [...fields.keys()]), [plan, fields]);
  const [answers, setAnswers] = useState<Readonly<Record<string, string>>>({});
  const outcome = useMemo(() => evaluate({ ...plan, layout }, answers), [plan, layout, answers]);
  const required = isRequired(fields, outcome);
  const missing = [...fields.values()].filter((f) => !outcome.hidden.has(f.fieldId) && required(f.fieldId) && (answers[f.fieldId] ?? '').trim() === '');

  return (
    <>
      {title !== '' && <h2 className="wk-card-title">{title}</h2>}
      <p className="wk-note" data-preview-form="">
        Podgląd: ten formularz powstanie przy imporcie. Nad pytaniami stanie klauzula administratora danych obszaru, do którego trafią odpowiedzi; wysyłanie jest tu wyłączone.
      </p>
      <form className="wk-form" onSubmit={(e) => e.preventDefault()}>
        <FormFlow
          items={layout}
          fields={fields}
          answers={answers}
          outcome={outcome}
          onAnswer={(fieldId, value) => setAnswers((was) => ({ ...was, [fieldId]: value }))}
        />
        <div className="wk-actions">
          <button type="submit" className="wk-btn" disabled>Wyślij</button>
          {missing.length > 0 && (
            <span className="wk-blocker">Brakuje: {missing.map((f) => outcome.labels.get(f.fieldId) ?? f.label ?? '').join(', ')}</span>
          )}
        </div>
      </form>
    </>
  );
}

export default PreviewForm;
