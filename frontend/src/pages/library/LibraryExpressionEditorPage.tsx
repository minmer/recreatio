import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CONTRIBUTION_ROLES,
  createExpression,
  deleteExpression,
  getExpression,
  getPeople,
  getWork,
  saveExpressionContributions,
  updateExpression,
  type LibraryContributionSave,
  type LibraryExpressionDetail,
  type LibraryExpressionSave,
  type LibraryPerson
} from './libraryApi';
import { languageLabel, type LibraryCopyStrings } from './libraryCopy';
import {
  Badge,
  ContributionEditor,
  ErrorBanner,
  Field,
  LanguageSelect,
  Loading,
  Section,
  TextArea,
  TextInput,
  orNull,
  toContributionSaves
} from './libraryComponents';

/**
 * A language version of a work: a translation, or the original text where it
 * needs naming. This is the level a scripture citation points at, which is why
 * it exists separately from the printed edition.
 */
export function LibraryExpressionEditorPage({
  t,
  expressionId,
  newForWorkId
}: {
  t: LibraryCopyStrings;
  expressionId: number | null;
  newForWorkId: number | null;
}) {
  const navigate = useNavigate();
  const isNew = expressionId === null;

  const [form, setForm] = useState<LibraryExpressionSave>({ language: 'pl', name: null, notes: null });
  const [detail, setDetail] = useState<LibraryExpressionDetail | null>(null);
  const [workTitle, setWorkTitle] = useState('');
  const [workLanguage, setWorkLanguage] = useState('');
  const [workId, setWorkId] = useState<number | null>(newForWorkId);
  const [contributions, setContributions] = useState<LibraryContributionSave[]>([]);
  const [people, setPeople] = useState<LibraryPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(0);

  const isTranslation = Boolean(workLanguage) && form.language !== workLanguage;

  const loadDetail = useCallback(async (id: number) => {
    const data = await getExpression(id);
    setDetail(data);
    setWorkId(data.workId);
    setWorkTitle(data.workTitle);
    setWorkLanguage(data.workOriginalLanguage);
    setForm({ language: data.language, name: data.name, notes: data.notes });
    setContributions(toContributionSaves(data.contributions));
  }, []);

  useEffect(() => {
    let active = true;
    getPeople()
      .then((result) => {
        if (active) setPeople(result);
      })
      .catch(() => {
        if (active) setError(t.common.loadFailed);
      });
    return () => {
      active = false;
    };
  }, [t.common.loadFailed]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const load = async () => {
      if (expressionId !== null) {
        await loadDetail(expressionId);
        return;
      }
      if (newForWorkId !== null) {
        const work = await getWork(newForWorkId);
        if (!active) return;
        setWorkTitle(work.uniformTitle || work.originalTitle);
        setWorkLanguage(work.originalLanguage);
        // A new version starts in the work's own language; switching it is the
        // single click that turns it into a translation.
        setForm({ language: work.originalLanguage, name: null, notes: null });
      }
    };

    load()
      .catch(() => {
        if (active) setError(t.common.loadFailed);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [expressionId, newForWorkId, loadDetail, t.common.loadFailed]);

  async function handleSave() {
    if (!form.language) return;
    setSaving(true);
    setError(null);
    try {
      if (expressionId === null) {
        if (newForWorkId === null) return;
        const created = await createExpression(newForWorkId, form);
        if (contributions.length > 0) await saveExpressionContributions(created.id, contributions);
        navigate(`/library/expressions/${created.id}`, { replace: true });
        return;
      }
      await updateExpression(expressionId, form);
      await saveExpressionContributions(expressionId, contributions);
      await loadDetail(expressionId);
      setSavedAt(Date.now());
    } catch {
      setError(t.common.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (expressionId === null || !confirm(t.expression.deleteConfirm)) return;
    try {
      await deleteExpression(expressionId, true);
      navigate(workId ? `/library/works/${workId}` : '/library/works');
    } catch {
      setError(t.common.deleteFailed);
    }
  }

  if (loading) return <Loading text={t.common.loading} />;

  return (
    <div className="lib-editor">
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <header className="lib-page-head">
        <div>
          <button
            type="button"
            className="lib-back"
            onClick={() => navigate(workId ? `/library/works/${workId}` : '/library/works')}
          >
            ← {t.expression.ofWork}: {workTitle || t.common.unknown}
          </button>
          <h1 className="lib-page-title">
            {isNew ? t.expression.newTitle : form.name || languageLabel(t, form.language)}{' '}
            <Badge tone={isTranslation ? 'translation' : 'original'}>
              {isTranslation ? t.expression.translationBadge : t.expression.originalBadge}
            </Badge>
          </h1>
        </div>
        <div className="lib-head-actions">
          {savedAt > 0 ? <span className="lib-saved">{t.common.saved}</span> : null}
          <button type="button" className="lib-btn" disabled={saving} onClick={handleSave}>
            {saving ? t.common.saving : t.common.save}
          </button>
          {!isNew ? (
            <button type="button" className="lib-btn lib-btn-danger" onClick={handleDelete}>
              {t.expression.deleteExpression}
            </button>
          ) : null}
        </div>
      </header>

      <Section title={t.expression.editTitle}>
        <div className="lib-form-grid">
          <Field label={t.expression.language} hint={t.expression.languageHint} required>
            <LanguageSelect
              t={t}
              value={form.language}
              onChange={(value) => setForm((current) => ({ ...current, language: value }))}
            />
          </Field>
          <Field label={t.expression.name} hint={t.expression.nameHint}>
            <TextInput
              value={form.name ?? ''}
              onChange={(value) => setForm((current) => ({ ...current, name: orNull(value) }))}
              maxLength={240}
            />
          </Field>
          <div className="lib-form-wide">
            <Field label={t.expression.notes}>
              <TextArea
                value={form.notes ?? ''}
                onChange={(value) => setForm((current) => ({ ...current, notes: orNull(value) }))}
              />
            </Field>
          </div>
        </div>
      </Section>

      <Section title={t.expression.translatorsSection} hint={t.expression.translatorsHint}>
        <ContributionEditor
          t={t}
          people={people}
          contributions={contributions}
          roles={CONTRIBUTION_ROLES}
          onChange={setContributions}
        />
      </Section>

      <Section
        title={t.expression.manifestationsSection}
        actions={
          isNew || workId === null ? null : (
            <button
              type="button"
              className="lib-btn lib-btn-sm"
              onClick={() => navigate(`/library/works/${workId}/manifestations/new?expressionId=${expressionId}`)}
            >
              {t.expression.addManifestation}
            </button>
          )
        }
      >
        {isNew ? (
          <p className="lib-muted">{t.work.createFirst}</p>
        ) : !detail || detail.manifestations.length === 0 ? (
          <p className="lib-muted">{t.work.noManifestations}</p>
        ) : (
          <ul className="lib-edition-list">
            {detail.manifestations.map((manifestation) => (
              <li key={manifestation.id}>
                <button
                  type="button"
                  className="lib-edition-row"
                  onClick={() => navigate(`/library/manifestations/${manifestation.id}`)}
                >
                  <span className="lib-edition-main">
                    <span className="lib-edition-title">{manifestation.title}</span>
                    <span className="lib-edition-meta">
                      {[manifestation.publisherName, manifestation.publishedYear]
                        .filter(Boolean)
                        .join(' · ') || t.common.none}
                    </span>
                  </span>
                  <span className="lib-edition-counts">
                    {manifestation.itemCount} {t.works.itemCount}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
