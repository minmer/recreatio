import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CONTRIBUTION_ROLES,
  WORK_KINDS,
  createWork,
  deleteWork,
  getPeople,
  getTags,
  getWork,
  saveWorkContributions,
  saveWorkTags,
  updateWork,
  type LibraryContributionSave,
  type LibraryPerson,
  type LibraryTag,
  type LibraryWorkDetail,
  type LibraryWorkSave
} from './libraryApi';
import { languageLabel, type LibraryCopyStrings } from './libraryCopy';
import {
  Badge,
  ContributionEditor,
  ErrorBanner,
  Field,
  LanguageSelect,
  Loading,
  NumberInput,
  Section,
  Select,
  TextArea,
  TextInput,
  orNull,
  toContributionSaves,
  vocabularyOptions
} from './libraryComponents';

const emptyForm: LibraryWorkSave = {
  originalTitle: '',
  originalSubtitle: null,
  originalLanguage: 'pl',
  uniformTitle: null,
  kind: 'book',
  firstPublishedYear: null,
  notes: null
};

export function LibraryWorkEditorPage({ t, workId }: { t: LibraryCopyStrings; workId: number | null }) {
  const navigate = useNavigate();
  const isNew = workId === null;

  const [form, setForm] = useState<LibraryWorkSave>(emptyForm);
  const [detail, setDetail] = useState<LibraryWorkDetail | null>(null);
  const [contributions, setContributions] = useState<LibraryContributionSave[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [people, setPeople] = useState<LibraryPerson[]>([]);
  const [tags, setTags] = useState<LibraryTag[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(0);

  const loadDetail = useCallback(
    async (id: number) => {
      const data = await getWork(id);
      setDetail(data);
      setForm({
        originalTitle: data.originalTitle,
        originalSubtitle: data.originalSubtitle,
        originalLanguage: data.originalLanguage,
        uniformTitle: data.uniformTitle,
        kind: data.kind,
        firstPublishedYear: data.firstPublishedYear,
        notes: data.notes
      });
      setContributions(toContributionSaves(data.contributions));
      setSelectedTagIds(data.tagIds);
    },
    []
  );

  useEffect(() => {
    let active = true;
    Promise.all([getPeople(), getTags()])
      .then(([peopleResult, tagsResult]) => {
        if (!active) return;
        setPeople(peopleResult);
        setTags(tagsResult);
      })
      .catch(() => {
        if (active) setError(t.common.loadFailed);
      });
    return () => {
      active = false;
    };
  }, [t.common.loadFailed]);

  useEffect(() => {
    if (workId === null) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    loadDetail(workId)
      .catch(() => {
        if (active) setError(t.common.loadFailed);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadDetail, t.common.loadFailed, workId]);

  const update = <K extends keyof LibraryWorkSave>(key: K, value: LibraryWorkSave[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function handleSave() {
    if (!form.originalTitle.trim() || !form.originalLanguage) return;
    setSaving(true);
    setError(null);
    try {
      if (workId === null) {
        const created = await createWork(form);
        // Contributions and tags need the work's id, so they go in right after.
        if (contributions.length > 0) await saveWorkContributions(created.id, contributions);
        if (selectedTagIds.length > 0) await saveWorkTags(created.id, selectedTagIds);
        navigate(`/library/works/${created.id}`, { replace: true });
        return;
      }

      await updateWork(workId, form);
      await saveWorkContributions(workId, contributions);
      await saveWorkTags(workId, selectedTagIds);
      await loadDetail(workId);
      setSavedAt(Date.now());
    } catch {
      setError(t.common.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (workId === null) return;
    if (!confirm(t.work.deleteWorkConfirm)) return;
    try {
      await deleteWork(workId);
      navigate('/library/works');
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
          <button type="button" className="lib-back" onClick={() => navigate('/library/works')}>
            ← {t.works.title}
          </button>
          <h1 className="lib-page-title">{isNew ? t.work.newTitle : form.originalTitle || t.work.editTitle}</h1>
        </div>
        <div className="lib-head-actions">
          {savedAt > 0 ? <span className="lib-saved">{t.common.saved}</span> : null}
          <button
            type="button"
            className="lib-btn"
            disabled={saving || !form.originalTitle.trim()}
            onClick={handleSave}
          >
            {saving ? t.common.saving : t.common.save}
          </button>
          {!isNew ? (
            <button type="button" className="lib-btn lib-btn-danger" onClick={handleDelete}>
              {t.work.deleteWork}
            </button>
          ) : null}
        </div>
      </header>

      <Section title={t.work.editTitle}>
        <div className="lib-form-grid">
          <Field label={t.work.originalTitle} hint={t.work.originalTitleHint} required>
            <TextInput
              value={form.originalTitle}
              onChange={(value) => update('originalTitle', value)}
              maxLength={400}
              autoFocus={isNew}
            />
          </Field>
          <Field label={t.work.originalSubtitle}>
            <TextInput
              value={form.originalSubtitle ?? ''}
              onChange={(value) => update('originalSubtitle', orNull(value))}
              maxLength={400}
            />
          </Field>
          <Field label={t.work.originalLanguage} hint={t.work.originalLanguageHint} required>
            <LanguageSelect t={t} value={form.originalLanguage} onChange={(value) => update('originalLanguage', value)} />
          </Field>
          <Field label={t.work.uniformTitle} hint={t.work.uniformTitleHint}>
            <TextInput
              value={form.uniformTitle ?? ''}
              onChange={(value) => update('uniformTitle', orNull(value))}
              maxLength={400}
            />
          </Field>
          <Field label={t.work.kind}>
            <Select
              value={form.kind}
              onChange={(value) => update('kind', value)}
              options={vocabularyOptions(WORK_KINDS, t.kinds)}
            />
          </Field>
          <Field label={t.work.firstPublishedYear}>
            <NumberInput
              value={form.firstPublishedYear}
              onChange={(value) => update('firstPublishedYear', value)}
              min={-3000}
              max={3000}
            />
          </Field>
          <div className="lib-form-wide">
            <Field label={t.work.notes}>
              <TextArea value={form.notes ?? ''} onChange={(value) => update('notes', orNull(value))} />
            </Field>
          </div>
        </div>
      </Section>

      <Section title={t.work.authorsSection} hint={t.work.authorsHint}>
        <ContributionEditor
          t={t}
          people={people}
          contributions={contributions}
          roles={CONTRIBUTION_ROLES}
          onChange={setContributions}
        />
      </Section>

      <Section title={t.work.tagsSection}>
        {tags.length === 0 ? (
          <p className="lib-muted">{t.tags.empty}</p>
        ) : (
          <div className="lib-tag-picker">
            {tags.map((tag) => {
              const active = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  className={`lib-tag-chip${active ? ' is-active' : ''}`}
                  onClick={() =>
                    setSelectedTagIds((current) =>
                      active ? current.filter((id) => id !== tag.id) : [...current, tag.id]
                    )
                  }
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        )}
      </Section>

      <Section
        title={t.work.editionsSection}
        hint={t.work.editionsHint}
        actions={
          isNew ? null : (
            <button
              type="button"
              className="lib-btn lib-btn-sm"
              onClick={() => navigate(`/library/works/${workId}/editions/new`)}
            >
              {t.work.addEdition}
            </button>
          )
        }
      >
        {isNew ? (
          <p className="lib-muted">{t.work.createFirst}</p>
        ) : !detail || detail.editions.length === 0 ? (
          <p className="lib-muted">{t.work.noEditions}</p>
        ) : (
          <ul className="lib-edition-list">
            {detail.editions.map((edition) => (
              <li key={edition.id}>
                <button
                  type="button"
                  className="lib-edition-row"
                  onClick={() => navigate(`/library/editions/${edition.id}`)}
                >
                  <span className="lib-edition-main">
                    <span className="lib-edition-title">{edition.title}</span>
                    <span className="lib-edition-meta">
                      {[
                        edition.publisherName,
                        edition.publishedPlace,
                        edition.publishedYear ? String(edition.publishedYear) : null,
                        edition.editionStatement
                      ]
                        .filter(Boolean)
                        .join(' · ') || t.common.none}
                    </span>
                    {edition.translators.length > 0 ? (
                      <span className="lib-edition-translators">
                        {t.roles.translator}: {edition.translators.join(', ')}
                      </span>
                    ) : null}
                  </span>
                  <span className="lib-edition-side">
                    <Badge tone={edition.isTranslation ? 'translation' : 'original'}>
                      {languageLabel(t, edition.language)}
                    </Badge>
                    <Badge tone="muted">
                      {edition.isTranslation ? t.work.translation : t.work.originalEdition}
                    </Badge>
                    <span className="lib-edition-counts">
                      {edition.copyCount} {t.works.copyCount}
                    </span>
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
