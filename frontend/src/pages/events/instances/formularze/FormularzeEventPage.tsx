import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ApiError,
  claimFormsAdmin,
  createForm,
  createFormQuestion,
  deleteForm,
  deleteFormQuestion,
  deleteFormResponse,
  getFormDetail,
  getFormResponses,
  getFormsList,
  getFormsAdminStatus,
  importForm,
  publishForm,
  updateForm,
  updateFormQuestion,
  type FormDetail,
  type FormQuestion,
  type FormResponsesData,
  type FormSummary,
  type FormsAdminStatus
} from '../../../../lib/api';
import type { EventDefinition, EventInnerPage, SharedEventPageProps } from '../../eventTypes';
import '../../../../styles/formularze-event.css';

type View =
  | { kind: 'loading' }
  | { kind: 'claim'; hasAdmin: boolean; adminName: string | null }
  | { kind: 'list'; forms: FormSummary[] }
  | { kind: 'editor'; form: FormDetail }
  | { kind: 'responses'; data: FormResponsesData };

type QuestionEditState = {
  id: string | null;
  text: string;
  type: 'text' | 'multiselect' | 'scale';
  options: string[];
  isRequired: boolean;
  conditionQuestionId: string | null;
  conditionValue: string | null;
};

function emptyQuestionEdit(): QuestionEditState {
  return { id: null, text: '', type: 'text', options: [''], isRequired: false, conditionQuestionId: null, conditionValue: null };
}

type ResponseViewMode = 'person' | 'question';

export function FormularzeEventPage(props: SharedEventPageProps & { event: EventDefinition; page: EventInnerPage }) {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Editor state
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editingQuestion, setEditingQuestion] = useState<QuestionEditState | null>(null);
  const [savingMeta, setSavingMeta] = useState(false);

  // New form creation
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // JSON import
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Responses navigation
  const [responseViewMode, setResponseViewMode] = useState<ResponseViewMode>('person');
  const [responseIdx, setResponseIdx] = useState(0);
  const [questionIdx, setQuestionIdx] = useState(0);

  useEffect(() => {
    void loadStatus();
  }, []);

  async function loadStatus() {
    setView({ kind: 'loading' });
    try {
      const status: FormsAdminStatus = await getFormsAdminStatus();
      if (status.isCurrentUserAdmin) {
        await loadList();
      } else {
        setView({ kind: 'claim', hasAdmin: status.hasAdmin, adminName: status.adminDisplayName });
      }
    } catch {
      setView({ kind: 'claim', hasAdmin: false, adminName: null });
    }
  }

  async function loadList() {
    setView({ kind: 'loading' });
    try {
      const forms = await getFormsList();
      setView({ kind: 'list', forms });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Błąd ładowania formularzy.');
      setView({ kind: 'list', forms: [] });
    }
  }

  async function openEditor(formId: string) {
    setBusy(true);
    try {
      const form = await getFormDetail(formId);
      setEditTitle(form.title);
      setEditDesc(form.description ?? '');
      setEditingQuestion(null);
      setView({ kind: 'editor', form });
    } catch {
      setError('Nie udało się załadować formularza.');
    } finally {
      setBusy(false);
    }
  }

  async function openResponses(formId: string) {
    setBusy(true);
    try {
      const data = await getFormResponses(formId);
      setResponseIdx(0);
      setQuestionIdx(0);
      setResponseViewMode('person');
      setView({ kind: 'responses', data });
    } catch {
      setError('Nie udało się załadować odpowiedzi.');
    } finally {
      setBusy(false);
    }
  }

  async function handleClaim() {
    if (!props.showProfileMenu) {
      props.onAuthAction();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await claimFormsAdmin();
      await loadList();
    } catch {
      setError('Nie udało się przejąć roli admina.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateForm(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const form = await createForm(newTitle.trim(), newDesc.trim() || null);
      setEditTitle(form.title);
      setEditDesc(form.description ?? '');
      setEditingQuestion(null);
      setNewTitle('');
      setNewDesc('');
      setView({ kind: 'editor', form });
    } catch {
      setError('Nie udało się utworzyć formularza.');
    } finally {
      setCreating(false);
    }
  }

  async function handleImport() {
    setImportError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(importJson);
    } catch {
      setImportError('Nieprawidłowy JSON.');
      return;
    }
    const obj = parsed as Record<string, unknown>;
    const title = typeof obj.title === 'string' ? obj.title.trim() : '';
    if (!title) { setImportError('Brak pola "title".'); return; }
    const description = typeof obj.description === 'string' ? obj.description : null;
    const raw = Array.isArray(obj.questions) ? obj.questions : [];
    const questions: {
      text: string;
      type: string;
      options: string[] | null;
      isRequired: boolean;
      conditionQuestionIndex: number | null;
      conditionValue: string | null;
    }[] = [];
    for (let qi = 0; qi < raw.length; qi++) {
      const q = raw[qi];
      if (typeof q !== 'object' || q === null) { setImportError('Pytanie musi być obiektem.'); return; }
      const qo = q as Record<string, unknown>;
      const text = typeof qo.text === 'string' ? qo.text.trim() : '';
      if (!text) { setImportError('Każde pytanie wymaga pola "text".'); return; }
      const type = typeof qo.type === 'string' ? qo.type : 'text';
      if (!['text', 'multiselect', 'scale'].includes(type)) {
        setImportError(`Nieznany typ pytania: "${type}". Dozwolone: text, multiselect, scale.`);
        return;
      }
      const options = Array.isArray(qo.options)
        ? (qo.options as unknown[]).filter((o): o is string => typeof o === 'string')
        : null;
      const isRequired = qo.isRequired === true;
      const conditionQuestionIndex = typeof qo.conditionQuestionIndex === 'number'
        ? Math.floor(qo.conditionQuestionIndex) : null;
      const conditionValue = typeof qo.conditionValue === 'string' ? qo.conditionValue : null;
      if (conditionQuestionIndex !== null) {
        if (conditionQuestionIndex < 0 || conditionQuestionIndex >= qi) {
          setImportError(`Pytanie ${qi}: conditionQuestionIndex musi być < ${qi}.`);
          return;
        }
        if (!conditionValue) {
          setImportError(`Pytanie ${qi}: conditionValue jest wymagane gdy conditionQuestionIndex jest ustawiony.`);
          return;
        }
      }
      questions.push({
        text, type, options: options?.length ? options : null, isRequired,
        conditionQuestionIndex, conditionValue
      });
    }
    setImporting(true);
    try {
      const form = await importForm(title, description, questions);
      setEditTitle(form.title);
      setEditDesc(form.description ?? '');
      setEditingQuestion(null);
      setImportJson('');
      setShowImport(false);
      setView({ kind: 'editor', form });
    } catch (e) {
      setImportError(e instanceof ApiError ? e.message : 'Błąd importu.');
    } finally {
      setImporting(false);
    }
  }

  async function handleSaveMeta() {
    if (view.kind !== 'editor') return;
    setSavingMeta(true);
    setError(null);
    try {
      await updateForm(view.form.id, editTitle.trim(), editDesc.trim() || null);
      const updated = await getFormDetail(view.form.id);
      setView({ kind: 'editor', form: updated });
    } catch {
      setError('Nie udało się zapisać.');
    } finally {
      setSavingMeta(false);
    }
  }

  async function handleTogglePublish(formId: string) {
    setError(null);
    try {
      await publishForm(formId);
      if (view.kind === 'editor') {
        const updated = await getFormDetail(formId);
        setView({ kind: 'editor', form: updated });
      } else {
        await loadList();
      }
    } catch {
      setError('Nie udało się zmienić statusu publikacji.');
    }
  }

  async function handleDeleteForm(formId: string) {
    if (!window.confirm('Usunąć formularz wraz ze wszystkimi odpowiedziami?')) return;
    setError(null);
    try {
      await deleteForm(formId);
      await loadList();
    } catch {
      setError('Nie udało się usunąć formularza.');
    }
  }

  async function handleSaveQuestion() {
    if (!editingQuestion || view.kind !== 'editor') return;
    const { id, text, type, options, isRequired, conditionQuestionId, conditionValue } = editingQuestion;
    if (!text.trim()) return;
    if (conditionQuestionId && !conditionValue) {
      setError('Wybierz wartość warunku wyświetlenia.');
      return;
    }
    const filteredOptions = options.filter((o) => o.trim());

    setBusy(true);
    setError(null);
    try {
      if (id) {
        await updateFormQuestion(
          view.form.id, id, text.trim(), type,
          filteredOptions.length ? filteredOptions : null, isRequired,
          conditionQuestionId, conditionValue
        );
      } else {
        await createFormQuestion(
          view.form.id, text.trim(), type,
          filteredOptions.length ? filteredOptions : null, isRequired,
          conditionQuestionId, conditionValue
        );
      }
      const updated = await getFormDetail(view.form.id);
      setView({ kind: 'editor', form: updated });
      setEditingQuestion(null);
    } catch {
      setError('Nie udało się zapisać pytania.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteResponse(formId: string, responseId: string) {
    if (!window.confirm('Usunąć tę odpowiedź?')) return;
    setError(null);
    try {
      await deleteFormResponse(formId, responseId);
      if (view.kind === 'responses') {
        const updated = view.data.responses.filter((r) => r.responseId !== responseId);
        setView({ kind: 'responses', data: { ...view.data, responses: updated } });
        setResponseIdx((prev) => Math.min(prev, Math.max(0, updated.length - 1)));
      }
    } catch {
      setError('Nie udało się usunąć odpowiedzi.');
    }
  }

  async function handleDeleteQuestion(questionId: string) {
    if (view.kind !== 'editor') return;
    if (!window.confirm('Usunąć pytanie?')) return;
    setError(null);
    try {
      await deleteFormQuestion(view.form.id, questionId);
      const updated = await getFormDetail(view.form.id);
      setView({ kind: 'editor', form: updated });
    } catch {
      setError('Nie udało się usunąć pytania.');
    }
  }

  function startEditQuestion(q: FormQuestion) {
    setEditingQuestion({
      id: q.id,
      text: q.text,
      type: q.type,
      options: q.options?.length ? [...q.options] : [''],
      isRequired: q.isRequired,
      conditionQuestionId: q.conditionQuestionId,
      conditionValue: q.conditionValue
    });
  }

  function getFillLink(token: string) {
    return `${window.location.origin}/#/form/${token}`;
  }

  return (
    <div className="frm-page">
      <header className="frm-header">
        <div className="frm-header-brand">
          <a href="/#/event">REcreatio</a>
          <span>/</span>
          {view.kind === 'editor' || view.kind === 'responses' ? (
            <>
              <button
                className="frm-btn ghost small"
                onClick={() => void loadList()}
                style={{ padding: '3px 8px', fontSize: '0.8rem' }}
              >
                ← Formularze
              </button>
            </>
          ) : (
            <span>Formularze</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {props.showProfileMenu ? (
            <button className="frm-btn ghost small" onClick={props.onLogout}>
              Wyloguj
            </button>
          ) : (
            <button className="frm-btn ghost small" onClick={props.onAuthAction}>
              Zaloguj
            </button>
          )}
        </div>
      </header>

      <main className="frm-main">
        {error && <div className="frm-status error">{error}</div>}

        {view.kind === 'loading' && <div className="frm-loading">Ładowanie…</div>}

        {view.kind === 'claim' && (
          <div className="frm-claim-panel">
            <h2>Panel formularzy</h2>
            {view.hasAdmin && view.adminName ? (
              <p>
                Panel administracyjny jest już przypisany do konta{' '}
                <strong>{view.adminName}</strong>. Zaloguj się na to konto, aby zarządzać
                formularzami.
              </p>
            ) : (
              <p>
                Żaden administrator nie jest jeszcze przypisany. Zaloguj się i przejmij
                panel, aby tworzyć formularze i zbierać odpowiedzi.
              </p>
            )}
            {!view.hasAdmin && (
              <button
                className="frm-btn primary"
                onClick={() => void handleClaim()}
                disabled={busy}
              >
                {props.showProfileMenu ? 'Przejmij panel' : 'Zaloguj się'}
              </button>
            )}
          </div>
        )}

        {view.kind === 'list' && (
          <>
            <div className="frm-list-actions">
              <div>
                <div className="frm-section-title">Formularze</div>
                <div className="frm-section-sub">
                  Twórz formularze i wysyłaj linki do uczestników.
                </div>
              </div>
              <button
                className="frm-btn ghost small"
                onClick={() => { setShowImport((v) => !v); setImportError(null); }}
              >
                {showImport ? 'Anuluj import' : 'Importuj JSON'}
              </button>
            </div>

            {/* JSON import panel */}
            {showImport && (
              <div
                style={{
                  background: 'var(--frm-bg-card)',
                  border: '1px solid var(--frm-accent)',
                  borderRadius: 10,
                  padding: '18px 20px',
                  marginBottom: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}
              >
                <strong style={{ fontSize: '0.875rem' }}>Import z JSON</strong>
                <div style={{ fontSize: '0.78rem', opacity: 0.7 }}>
                  Format: {'{'}&#34;title&#34;: &#34;…&#34;, &#34;questions&#34;: [{'{'}&#34;text&#34;: &#34;…&#34;, &#34;type&#34;: &#34;text|multiselect|scale&#34;, &#34;conditionQuestionIndex&#34;: null, &#34;conditionValue&#34;: null{'}'}]{'}'}
                </div>
                <textarea
                  className="frm-textarea"
                  rows={8}
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  placeholder='{"title": "Mój formularz", "questions": [{"text": "Pytanie 1", "type": "scale", "isRequired": true}, {"text": "Dlaczego?", "type": "text", "conditionQuestionIndex": 0, "conditionValue": "1"}]}'
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                />
                {importError && <div className="frm-status error">{importError}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="frm-btn primary"
                    type="button"
                    onClick={() => void handleImport()}
                    disabled={importing || !importJson.trim()}
                  >
                    {importing ? 'Importuję…' : 'Importuj'}
                  </button>
                  <button
                    className="frm-btn ghost"
                    type="button"
                    onClick={() => { setShowImport(false); setImportJson(''); setImportError(null); }}
                  >
                    Anuluj
                  </button>
                </div>
              </div>
            )}

            {/* Create new form */}
            <form
              onSubmit={(e) => void handleCreateForm(e)}
              style={{
                background: 'var(--frm-bg-card)',
                border: '1px solid var(--frm-line)',
                borderRadius: 10,
                padding: '18px 20px',
                marginBottom: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}
            >
              <strong style={{ fontSize: '0.875rem' }}>Nowy formularz</strong>
              <input
                className="frm-input"
                placeholder="Nazwa formularza"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
              />
              <input
                className="frm-input"
                placeholder="Opis (opcjonalny)"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
              <div>
                <button className="frm-btn primary" type="submit" disabled={creating || !newTitle.trim()}>
                  {creating ? 'Tworzę…' : '+ Utwórz'}
                </button>
              </div>
            </form>

            {view.forms.length === 0 ? (
              <div className="frm-empty">Brak formularzy. Utwórz pierwszy powyżej.</div>
            ) : (
              <div className="frm-cards">
                {view.forms.map((f) => (
                  <div key={f.id} className="frm-card">
                    <div className="frm-card-info">
                      <h3>
                        {f.title}{' '}
                        <span className={`frm-badge ${f.isPublished ? 'published' : 'draft'}`}>
                          {f.isPublished ? 'Opublikowany' : 'Szkic'}
                        </span>
                      </h3>
                      <div className="frm-card-meta">
                        <span>{f.questionCount} pyt.</span>
                        <span>{f.responseCount} odp.</span>
                        <span>{new Date(f.createdUtc).toLocaleDateString('pl-PL')}</span>
                      </div>
                      {f.description && (
                        <div className="frm-card-description">{f.description}</div>
                      )}
                    </div>
                    <div className="frm-card-actions">
                      <button
                        className="frm-btn ghost small"
                        onClick={() => void openEditor(f.id)}
                        disabled={busy}
                      >
                        Edytuj
                      </button>
                      <button
                        className="frm-btn ghost small"
                        onClick={() => void openResponses(f.id)}
                        disabled={busy}
                      >
                        Odpowiedzi ({f.responseCount})
                      </button>
                      <button
                        className="frm-btn ghost small"
                        onClick={() => {
                          void navigator.clipboard.writeText(getFillLink(f.fillToken));
                        }}
                        title="Skopiuj link"
                      >
                        Kopiuj link
                      </button>
                      <button
                        className="frm-btn ghost small"
                        onClick={() => void handleTogglePublish(f.id)}
                      >
                        {f.isPublished ? 'Cofnij publikację' : 'Opublikuj'}
                      </button>
                      <button
                        className="frm-btn danger small"
                        onClick={() => void handleDeleteForm(f.id)}
                      >
                        Usuń
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {view.kind === 'editor' && (
          <div className="frm-editor">
            <div className="frm-editor-header">
              <div>
                <div className="frm-section-title">{view.form.title}</div>
                <div className="frm-section-sub">Edytor formularza</div>
              </div>
              <button
                className={`frm-btn ${view.form.isPublished ? 'ghost' : 'primary'}`}
                onClick={() => void handleTogglePublish(view.form.id)}
              >
                {view.form.isPublished ? 'Cofnij publikację' : 'Opublikuj'}
              </button>
            </div>

            {/* Meta editor */}
            <div className="frm-editor-meta">
              <div>
                <label className="frm-label">Nazwa</label>
                <input
                  className="frm-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="frm-label">Opis (opcjonalny)</label>
                <textarea
                  className="frm-textarea"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="frm-editor-link-row">
                <span className="frm-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Link:</span>
                <span className="frm-editor-link">{getFillLink(view.form.fillToken)}</span>
                <button
                  className="frm-btn ghost small"
                  onClick={() => void navigator.clipboard.writeText(getFillLink(view.form.fillToken))}
                >
                  Kopiuj
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="frm-btn primary"
                  onClick={() => void handleSaveMeta()}
                  disabled={savingMeta}
                >
                  {savingMeta ? 'Zapisuję…' : 'Zapisz'}
                </button>
                <button
                  className="frm-btn ghost"
                  onClick={() => void openResponses(view.form.id)}
                  disabled={busy}
                >
                  Odpowiedzi ({view.form.questions.length > 0 ? '…' : '0'})
                </button>
              </div>
            </div>

            {/* Questions */}
            <div>
              <div className="frm-questions-head">
                <h3>Pytania</h3>
                <button
                  className="frm-btn primary small"
                  onClick={() => setEditingQuestion(emptyQuestionEdit())}
                  disabled={!!editingQuestion}
                >
                  + Dodaj pytanie
                </button>
              </div>

              <div className="frm-questions">
                {view.form.questions.map((q) => {
                  const condQ = q.conditionQuestionId
                    ? view.form.questions.find((x) => x.id === q.conditionQuestionId)
                    : null;
                  return (
                    <div
                      key={q.id}
                      className={`frm-question-card ${editingQuestion?.id === q.id ? 'editing' : ''}`}
                    >
                      <div className="frm-question-row">
                        <div style={{ flex: 1 }}>
                          <div className="frm-question-text">
                            {q.text}
                            {q.isRequired && (
                              <span style={{ color: 'var(--frm-error)', marginLeft: 4 }}>*</span>
                            )}
                          </div>
                          <span className="frm-question-type-badge">
                            {q.type === 'text' ? 'Tekst' : q.type === 'multiselect' ? 'Wielokrotny wybór' : 'Skala 1–5'}
                          </span>
                          {q.options && q.options.length > 0 && (
                            <div className="frm-question-opts">
                              {q.options.map((o, i) => (
                                <span key={i} className="frm-opt-chip">{o}</span>
                              ))}
                            </div>
                          )}
                          {condQ && q.conditionValue && (
                            <div className="frm-condition-indicator">
                              ↳ widoczne gdy:{' '}
                              <em>{condQ.text.length > 50 ? condQ.text.substring(0, 50) + '…' : condQ.text}</em>
                              {' '}={' '}
                              <strong>„{q.conditionValue}"</strong>
                            </div>
                          )}
                        </div>
                        <div className="frm-question-actions">
                          <button
                            className="frm-btn ghost small"
                            onClick={() => startEditQuestion(q)}
                            disabled={!!editingQuestion}
                          >
                            Edytuj
                          </button>
                          <button
                            className="frm-btn danger small"
                            onClick={() => void handleDeleteQuestion(q.id)}
                          >
                            Usuń
                          </button>
                        </div>
                      </div>

                      {editingQuestion?.id === q.id && (
                        <QuestionEditForm
                          state={editingQuestion}
                          onChange={setEditingQuestion}
                          onSave={() => void handleSaveQuestion()}
                          onCancel={() => setEditingQuestion(null)}
                          busy={busy}
                          precedingQuestions={view.form.questions.filter((x) => x.sortOrder < q.sortOrder)}
                        />
                      )}
                    </div>
                  );
                })}

                {/* New question form */}
                {editingQuestion && editingQuestion.id === null && (
                  <div className="frm-question-card editing">
                    <QuestionEditForm
                      state={editingQuestion}
                      onChange={setEditingQuestion}
                      onSave={() => void handleSaveQuestion()}
                      onCancel={() => setEditingQuestion(null)}
                      busy={busy}
                      precedingQuestions={view.form.questions}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {view.kind === 'responses' && (
          <ResponsesViewer
            data={view.data}
            viewMode={responseViewMode}
            onViewModeChange={setResponseViewMode}
            personIdx={responseIdx}
            onPersonIdxChange={setResponseIdx}
            questionIdx={questionIdx}
            onQuestionIdxChange={setQuestionIdx}
            onDeleteResponse={(id) => void handleDeleteResponse(view.data.formId, id)}
          />
        )}
      </main>
    </div>
  );
}

// ─── Question edit sub-form ───────────────────────────────────────────────────

type QuestionEditFormProps = {
  state: QuestionEditState;
  onChange: (s: QuestionEditState) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
  precedingQuestions: FormQuestion[];
};

function QuestionEditForm({ state, onChange, onSave, onCancel, busy, precedingQuestions }: QuestionEditFormProps) {
  function set(patch: Partial<QuestionEditState>) {
    onChange({ ...state, ...patch });
  }

  function setOption(i: number, val: string) {
    const opts = [...state.options];
    opts[i] = val;
    set({ options: opts });
  }

  function addOption() {
    set({ options: [...state.options, ''] });
  }

  function removeOption(i: number) {
    set({ options: state.options.filter((_, idx) => idx !== i) });
  }

  const conditionCandidates = precedingQuestions.filter(
    (q) => q.type === 'scale' || (q.type === 'multiselect' && q.options && q.options.length > 0)
  );

  const selectedCondQ = state.conditionQuestionId
    ? precedingQuestions.find((q) => q.id === state.conditionQuestionId) ?? null
    : null;

  return (
    <div className="frm-qedit">
      <div>
        <label className="frm-label">Treść pytania</label>
        <input
          className="frm-input"
          value={state.text}
          onChange={(e: ChangeEvent<HTMLInputElement>) => set({ text: e.target.value })}
          placeholder="Napisz pytanie…"
          autoFocus
        />
      </div>
      <div className="frm-qedit-row">
        <div style={{ flex: 1 }}>
          <label className="frm-label">Typ</label>
          <select
            className="frm-select"
            value={state.type}
            onChange={(e) => set({ type: e.target.value as QuestionEditState['type'], options: [''] })}
          >
            <option value="text">Tekst (wolna odpowiedź)</option>
            <option value="multiselect">Wielokrotny wybór</option>
            <option value="scale">Skala 1–5</option>
          </select>
        </div>
        <label className="frm-checkbox-row" style={{ marginTop: 22 }}>
          <input
            type="checkbox"
            checked={state.isRequired}
            onChange={(e) => set({ isRequired: e.target.checked })}
          />
          Wymagane
        </label>
      </div>

      {state.type === 'multiselect' && (
        <div>
          <label className="frm-label">Opcje wyboru</label>
          <div className="frm-options-editor">
            {state.options.map((opt, i) => (
              <div key={i} className="frm-option-row">
                <input
                  className="frm-input"
                  value={opt}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setOption(i, e.target.value)}
                  placeholder={`Opcja ${i + 1}`}
                />
                {state.options.length > 1 && (
                  <button
                    className="frm-btn danger small"
                    type="button"
                    onClick={() => removeOption(i)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button className="frm-btn ghost small" type="button" onClick={addOption}>
              + Dodaj opcję
            </button>
          </div>
        </div>
      )}

      {/* Condition section — only shown when preceding scale/multiselect questions exist */}
      {conditionCandidates.length > 0 && (
        <div className="frm-condition-section">
          <label className="frm-label">Warunek wyświetlenia (opcjonalnie)</label>
          <select
            className="frm-select"
            value={state.conditionQuestionId ?? ''}
            onChange={(e) =>
              set({ conditionQuestionId: e.target.value || null, conditionValue: null })
            }
          >
            <option value="">— zawsze widoczne —</option>
            {conditionCandidates.map((q) => (
              <option key={q.id} value={q.id}>
                {q.text.length > 70 ? q.text.substring(0, 70) + '…' : q.text}
              </option>
            ))}
          </select>

          {selectedCondQ && (
            <div style={{ marginTop: 8 }}>
              <label className="frm-label">Pokaż gdy odpowiedź wynosi:</label>
              {selectedCondQ.type === 'scale' && (
                <div className="frm-scale-buttons" style={{ marginTop: 4 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`frm-scale-btn ${state.conditionValue === String(n) ? 'selected' : ''}`}
                      onClick={() => set({ conditionValue: String(n) })}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
              {selectedCondQ.type === 'multiselect' && selectedCondQ.options && (
                <select
                  className="frm-select"
                  style={{ marginTop: 4 }}
                  value={state.conditionValue ?? ''}
                  onChange={(e) => set({ conditionValue: e.target.value || null })}
                >
                  <option value="">— wybierz opcję —</option>
                  {selectedCondQ.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      )}

      <div className="frm-qedit-actions">
        <button
          className="frm-btn primary"
          type="button"
          onClick={onSave}
          disabled={busy || !state.text.trim()}
        >
          {busy ? 'Zapisuję…' : 'Zapisz pytanie'}
        </button>
        <button className="frm-btn ghost" type="button" onClick={onCancel}>
          Anuluj
        </button>
      </div>
    </div>
  );
}

// ─── Responses viewer ─────────────────────────────────────────────────────────

type ResponsesViewerProps = {
  data: FormResponsesData;
  viewMode: ResponseViewMode;
  onViewModeChange: (m: ResponseViewMode) => void;
  personIdx: number;
  onPersonIdxChange: (i: number) => void;
  questionIdx: number;
  onQuestionIdxChange: (i: number) => void;
  onDeleteResponse: (responseId: string) => void;
};

function ResponsesViewer({
  data,
  viewMode,
  onViewModeChange,
  personIdx,
  onPersonIdxChange,
  questionIdx,
  onQuestionIdxChange,
  onDeleteResponse
}: ResponsesViewerProps) {
  const { responses, questions } = data;
  const total = responses.length;
  const qTotal = questions.length;

  return (
    <div className="frm-responses">
      <div>
        <div className="frm-section-title">{data.title}</div>
        <div className="frm-section-sub">
          {total} {total === 1 ? 'odpowiedź' : total < 5 ? 'odpowiedzi' : 'odpowiedzi'}
        </div>
      </div>

      <div className="frm-responses-header">
        <div className="frm-view-toggle">
          <button
            className={viewMode === 'person' ? 'active' : ''}
            onClick={() => onViewModeChange('person')}
          >
            Wg osoby
          </button>
          <button
            className={viewMode === 'question' ? 'active' : ''}
            onClick={() => onViewModeChange('question')}
          >
            Wg pytania
          </button>
        </div>

        {viewMode === 'person' && total > 0 && (
          <div className="frm-nav-row">
            <button
              className="frm-btn ghost small"
              onClick={() => onPersonIdxChange(personIdx - 1)}
              disabled={personIdx === 0}
            >
              ←
            </button>
            <div>
              <div className="frm-nav-label">
                {responses[personIdx]?.respondentName ?? `Osoba ${personIdx + 1}`}
              </div>
              <div className="frm-nav-sub">
                {personIdx + 1} / {total}
              </div>
            </div>
            <button
              className="frm-btn ghost small"
              onClick={() => onPersonIdxChange(personIdx + 1)}
              disabled={personIdx >= total - 1}
            >
              →
            </button>
          </div>
        )}

        {viewMode === 'question' && qTotal > 0 && (
          <div className="frm-nav-row">
            <button
              className="frm-btn ghost small"
              onClick={() => onQuestionIdxChange(questionIdx - 1)}
              disabled={questionIdx === 0}
            >
              ←
            </button>
            <div>
              <div className="frm-nav-label" style={{ fontSize: '0.82rem', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {questions[questionIdx]?.text}
              </div>
              <div className="frm-nav-sub">
                Pytanie {questionIdx + 1} / {qTotal}
              </div>
            </div>
            <button
              className="frm-btn ghost small"
              onClick={() => onQuestionIdxChange(questionIdx + 1)}
              disabled={questionIdx >= qTotal - 1}
            >
              →
            </button>
          </div>
        )}
      </div>

      {total === 0 && (
        <div className="frm-empty">Brak odpowiedzi na ten formularz.</div>
      )}

      {viewMode === 'person' && total > 0 && (() => {
        const resp = responses[personIdx];
        if (!resp) return null;
        return (
          <div className="frm-response-card">
            <div className="frm-response-card-head">
              <span className="frm-response-name">
                {resp.respondentName ?? `Anonimowy respondent`}
              </span>
              <span className="frm-response-date">
                {new Date(resp.submittedUtc).toLocaleString('pl-PL')}
              </span>
              <button
                className="frm-btn danger small"
                onClick={() => onDeleteResponse(resp.responseId)}
                title="Usuń odpowiedź"
              >
                Usuń
              </button>
            </div>
            <div className="frm-answers">
              {questions.map((q) => {
                const answer = resp.answers.find((a) => a.questionId === q.id) ?? null;
                return (
                  <div key={q.id} className="frm-answer-row">
                    <div className="frm-answer-q">{q.text}</div>
                    <AnswerDisplay question={q} answer={answer} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {viewMode === 'question' && qTotal > 0 && (() => {
        const q = questions[questionIdx];
        if (!q) return null;
        return (
          <div className="frm-response-card">
            <div className="frm-response-card-head">
              <span className="frm-response-name">{q.text}</span>
              <span className={`frm-badge ${q.type === 'text' ? 'draft' : 'draft'}`}>
                {q.type === 'text' ? 'Tekst' : q.type === 'multiselect' ? 'Wielokrotny wybór' : 'Skala 1–5'}
              </span>
            </div>
            <div className="frm-answers">
              {total === 0 ? (
                <div className="frm-empty">Brak odpowiedzi.</div>
              ) : (
                responses.map((resp) => {
                  const answer = resp.answers.find((a) => a.questionId === q.id) ?? null;
                  return (
                    <div key={resp.responseId} className="frm-answer-row">
                      <div className="frm-answer-q" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>
                          {resp.respondentName ?? 'Anonim'} —{' '}
                          <span style={{ opacity: 0.6, fontSize: '0.74rem' }}>
                            {new Date(resp.submittedUtc).toLocaleString('pl-PL')}
                          </span>
                        </span>
                        <button
                          className="frm-btn danger small"
                          style={{ marginLeft: 'auto', flexShrink: 0 }}
                          onClick={() => onDeleteResponse(resp.responseId)}
                          title="Usuń odpowiedź"
                        >
                          Usuń
                        </button>
                      </div>
                      <AnswerDisplay question={q} answer={answer} />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Answer display ───────────────────────────────────────────────────────────

type AnswerDisplayProps = {
  question: FormQuestion;
  answer: { textValue: string | null; selectedOptions: string[] | null } | null;
};

function AnswerDisplay({ question, answer }: AnswerDisplayProps) {
  if (!answer) {
    return <div className="frm-answer-val empty">brak odpowiedzi</div>;
  }

  if (question.type === 'text') {
    return (
      <div className="frm-answer-val">
        {answer.textValue?.trim() || <span className="empty">brak odpowiedzi</span>}
      </div>
    );
  }

  if (question.type === 'scale') {
    const val = answer.textValue ? parseInt(answer.textValue, 10) : null;
    return (
      <div className="frm-scale-display">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className={`frm-scale-dot ${val === n ? 'selected' : ''}`}>
            {n}
          </div>
        ))}
      </div>
    );
  }

  if (question.type === 'multiselect') {
    const selected = answer.selectedOptions ?? [];
    if (selected.length === 0) {
      return <div className="frm-answer-val empty">brak odpowiedzi</div>;
    }
    return (
      <div className="frm-multiselect-chips">
        {selected.map((opt, i) => (
          <span key={i} className="frm-multiselect-chip">{opt}</span>
        ))}
      </div>
    );
  }

  return <div className="frm-answer-val empty">—</div>;
}
