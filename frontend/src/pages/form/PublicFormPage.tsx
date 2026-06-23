import { useEffect, useState, type FormEvent } from 'react';
import {
  ApiError,
  getPublicForm,
  submitPublicForm,
  type PublicFormData,
  type PublicFormAnswerInput
} from '../../lib/api';
import '../../styles/formularze-event.css';

type Props = {
  token: string;
};

type AnswerMap = Record<string, { text: string; selectedOptions: Set<string> }>;

export function PublicFormPage({ token }: Props) {
  const [form, setForm] = useState<PublicFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [respondentName, setRespondentName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadForm();
  }, [token]);

  async function loadForm() {
    setLoading(true);
    setNotFound(false);
    try {
      const data = await getPublicForm(token);
      setForm(data);
      const initial: AnswerMap = {};
      data.questions.forEach((q) => {
        initial[q.id] = { text: '', selectedOptions: new Set() };
      });
      setAnswers(initial);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setNotFound(true);
      } else {
        setError('Nie udało się załadować formularza.');
      }
    } finally {
      setLoading(false);
    }
  }

  function setTextAnswer(questionId: string, text: string) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], text }
    }));
  }

  function toggleOption(questionId: string, option: string) {
    setAnswers((prev) => {
      const current = new Set(prev[questionId]?.selectedOptions ?? []);
      if (current.has(option)) {
        current.delete(option);
      } else {
        current.add(option);
      }
      return { ...prev, [questionId]: { ...prev[questionId], selectedOptions: current } };
    });
  }

  function setScaleAnswer(questionId: string, value: number) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], text: String(value) }
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;

    for (const q of form.questions) {
      if (!q.isRequired) continue;
      const a = answers[q.id];
      const hasAnswer =
        (q.type === 'text' && a?.text.trim()) ||
        (q.type === 'scale' && a?.text) ||
        (q.type === 'multiselect' && (a?.selectedOptions.size ?? 0) > 0);
      if (!hasAnswer) {
        setError(`Pytanie "${q.text}" jest wymagane.`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    const payload: PublicFormAnswerInput[] = form.questions.map((q) => {
      const a = answers[q.id];
      return {
        questionId: q.id,
        textValue: q.type !== 'multiselect' ? (a?.text ?? null) || null : null,
        selectedOptions:
          q.type === 'multiselect' ? Array.from(a?.selectedOptions ?? []) : null
      };
    });

    try {
      await submitPublicForm(token, respondentName.trim() || null, payload);
      setSubmitted(true);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? (() => {
              try {
                const parsed = JSON.parse(e.message);
                return parsed.error ?? e.message;
              } catch {
                return e.message;
              }
            })()
          : 'Błąd podczas wysyłania formularza.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="frm-public-page">
        <div className="frm-loading">Ładowanie formularza…</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="frm-public-page">
        <div className="frm-public-card">
          <div className="frm-status error">
            Formularz nie istnieje lub nie jest dostępny.
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="frm-public-page">
        <div className="frm-thankyou">
          <div className="frm-thankyou-icon">✓</div>
          <h2>Dziękujemy!</h2>
          <p>Twoja odpowiedź została zapisana.</p>
        </div>
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className="frm-public-page">
      <form className="frm-public-card" onSubmit={(e) => void handleSubmit(e)}>
        <div className="frm-public-header">
          <h1>{form.title}</h1>
          {form.description && <p>{form.description}</p>}
        </div>

        {error && <div className="frm-status error">{error}</div>}

        {form.questions.map((q) => {
          const answer = answers[q.id];
          return (
            <div key={q.id} className="frm-public-question">
              <div className="frm-public-q-label">
                {q.text}
                {q.isRequired && <span className="required">*</span>}
              </div>

              {q.type === 'text' && (
                <textarea
                  className="frm-textarea"
                  value={answer?.text ?? ''}
                  onChange={(e) => setTextAnswer(q.id, e.target.value)}
                  rows={3}
                  placeholder="Twoja odpowiedź…"
                />
              )}

              {q.type === 'scale' && (
                <div className="frm-scale-buttons">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`frm-scale-btn ${answer?.text === String(n) ? 'selected' : ''}`}
                      onClick={() => setScaleAnswer(q.id, n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}

              {q.type === 'multiselect' && q.options && (
                <div className="frm-public-checkboxes">
                  {q.options.map((opt) => (
                    <label key={opt} className="frm-public-checkbox-label">
                      <input
                        type="checkbox"
                        checked={answer?.selectedOptions.has(opt) ?? false}
                        onChange={() => toggleOption(q.id, opt)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="frm-public-name-section">
          <label className="frm-label">Twoje imię (opcjonalnie)</label>
          <input
            className="frm-input"
            value={respondentName}
            onChange={(e) => setRespondentName(e.target.value)}
            placeholder="Imię i nazwisko"
          />
        </div>

        <div className="frm-public-submit">
          <button className="frm-btn primary" type="submit" disabled={submitting}>
            {submitting ? 'Wysyłam…' : 'Wyślij odpowiedź'}
          </button>
        </div>
      </form>
    </div>
  );
}
