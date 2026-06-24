import { useEffect, useState } from 'react';
import {
  ApiError,
  getPublicForm,
  submitPublicForm,
  type FormQuestion,
  type PublicFormResponse,
  type PublicFormAnswerInput
} from '../../lib/api';
import '../../styles/formularze-event.css';

type Props = {
  token: string;
};

type AnswerMap = Record<string, { text: string; selectedOptions: Set<string> }>;

function isQuestionVisible(
  q: FormQuestion,
  allQuestions: FormQuestion[],
  answers: AnswerMap
): boolean {
  if (!q.conditionQuestionId || !q.conditionValue) return true;
  const condQuestion = allQuestions.find((x) => x.id === q.conditionQuestionId);
  if (!condQuestion) return false;
  if (!isQuestionVisible(condQuestion, allQuestions, answers)) return false;
  const condAnswer = answers[q.conditionQuestionId];
  if (!condAnswer) return false;
  if (condQuestion.type === 'multiselect') {
    return condAnswer.selectedOptions.has(q.conditionValue);
  }
  return condAnswer.text === q.conditionValue;
}

export function PublicFormPage({ token }: Props) {
  const [form, setForm] = useState<PublicFormResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [respondentName, setRespondentName] = useState('');
  const [slideIndex, setSlideIndex] = useState(0);
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
      if (current.has(option)) current.delete(option);
      else current.add(option);
      return { ...prev, [questionId]: { ...prev[questionId], selectedOptions: current } };
    });
  }

  function setScaleAnswer(questionId: string, value: number) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], text: String(value) }
    }));
  }

  // ── Derived slide state ──────────────────────────────────────────────────────

  const visibleQuestions = form
    ? form.questions.filter((q) => isQuestionVisible(q, form.questions, answers))
    : [];
  const totalSlides = visibleQuestions.length + 1; // last slide = name + submit
  const safeIdx = Math.min(slideIndex, totalSlides - 1);
  const isNameSlide = safeIdx >= visibleQuestions.length;
  const currentQ = isNameSlide ? null : (visibleQuestions[safeIdx] ?? null);
  const progress =
    totalSlides > 1 ? Math.round((safeIdx / (totalSlides - 1)) * 100) : 100;

  function handleNext() {
    setError(null);
    if (currentQ?.isRequired) {
      const a = answers[currentQ.id];
      const answered =
        (currentQ.type === 'text' && !!a?.text.trim()) ||
        (currentQ.type === 'scale' && !!a?.text) ||
        (currentQ.type === 'multiselect' && (a?.selectedOptions.size ?? 0) > 0);
      if (!answered) {
        setError('To pytanie jest wymagane.');
        return;
      }
    }
    setSlideIndex((prev) => prev + 1);
  }

  function handlePrev() {
    setError(null);
    setSlideIndex((prev) => Math.max(0, prev - 1));
  }

  async function handleSubmit() {
    if (!form || submitting) return;
    setSubmitting(true);
    setError(null);

    const visibleIds = new Set(visibleQuestions.map((q) => q.id));
    const payload: PublicFormAnswerInput[] = form.questions
      .filter((q) => visibleIds.has(q.id))
      .map((q) => {
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
                const parsed = JSON.parse(e.message) as { error?: string };
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

  // ── Non-form states ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="frm-slide-page frm-slide-page--centered">
        <div className="frm-loading">Ładowanie formularza…</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="frm-slide-page frm-slide-page--centered">
        <div className="frm-status error" style={{ maxWidth: 480 }}>
          Formularz nie istnieje lub nie jest dostępny.
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="frm-slide-page frm-slide-page--centered">
        <div className="frm-thankyou">
          <div className="frm-thankyou-icon">✓</div>
          <h2>Dziękujemy!</h2>
          <p>Twoja odpowiedź została zapisana.</p>
        </div>
      </div>
    );
  }

  if (!form) return null;

  // ── Slide form ───────────────────────────────────────────────────────────────

  return (
    <div className="frm-slide-page">
      {/* Progress bar */}
      <div className="frm-slide-progress-track">
        <div className="frm-slide-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Topbar: form title + step counter */}
      <div className="frm-slide-topbar">
        <div className="frm-slide-form-title">{form.title}</div>
        <div className="frm-slide-step-label">
          {isNameSlide
            ? 'Ostatni krok'
            : `${safeIdx + 1} / ${visibleQuestions.length}`}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="frm-slide-body">
        <div className="frm-slide-card">
          {error && <div className="frm-status error">{error}</div>}

          {/* Description shown only on first slide */}
          {safeIdx === 0 && form.description && (
            <p className="frm-slide-description">{form.description}</p>
          )}

          {/* Current question */}
          {currentQ && (
            <div key={currentQ.id} className="frm-slide-question">
              <div className="frm-slide-q-text">
                {currentQ.text}
                {currentQ.isRequired && (
                  <span className="frm-slide-required"> *</span>
                )}
              </div>

              {currentQ.type === 'text' && (
                <textarea
                  key={currentQ.id}
                  className="frm-textarea frm-slide-textarea"
                  value={answers[currentQ.id]?.text ?? ''}
                  onChange={(e) => setTextAnswer(currentQ.id, e.target.value)}
                  rows={4}
                  placeholder="Twoja odpowiedź…"
                  autoFocus
                />
              )}

              {currentQ.type === 'scale' && (
                <div className="frm-scale-buttons frm-slide-scale">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`frm-scale-btn ${
                        answers[currentQ.id]?.text === String(n) ? 'selected' : ''
                      }`}
                      onClick={() => setScaleAnswer(currentQ.id, n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}

              {currentQ.type === 'multiselect' && currentQ.options && (
                <div className="frm-slide-checkboxes">
                  {currentQ.options.map((opt) => (
                    <label key={opt} className="frm-slide-checkbox-label">
                      <input
                        type="checkbox"
                        className="frm-slide-checkbox"
                        checked={answers[currentQ.id]?.selectedOptions.has(opt) ?? false}
                        onChange={() => toggleOption(currentQ.id, opt)}
                      />
                      <span className="frm-slide-checkbox-box" />
                      {opt}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Name + submit slide */}
          {isNameSlide && (
            <div className="frm-slide-question">
              <div className="frm-slide-q-text">
                {visibleQuestions.length > 0
                  ? 'Gotowe! Podaj swoje imię (opcjonalnie):'
                  : 'Podaj swoje imię (opcjonalnie):'}
              </div>
              <input
                className="frm-input frm-slide-name-input"
                value={respondentName}
                onChange={(e) => setRespondentName(e.target.value)}
                placeholder="Imię i nazwisko"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSubmit();
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="frm-slide-nav-wrapper">
        <div className="frm-slide-nav">
          <button
            className="frm-btn ghost frm-slide-nav-btn"
            type="button"
            onClick={handlePrev}
            style={{ visibility: safeIdx === 0 ? 'hidden' : 'visible' }}
          >
            ← Wróć
          </button>

          {!isNameSlide && (
            <button
              className="frm-btn primary frm-slide-nav-btn"
              type="button"
              onClick={handleNext}
            >
              Dalej →
            </button>
          )}

          {isNameSlide && (
            <button
              className="frm-btn primary frm-slide-nav-btn"
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
            >
              {submitting ? 'Wysyłam…' : 'Wyślij odpowiedź →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
