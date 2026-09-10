import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CITATION_SCHEMES,
  CONTRIBUTION_ROLES,
  WORK_KINDS,
  createWork,
  deleteWork,
  getCitationSchemes,
  getPeople,
  getTags,
  getWork,
  saveWorkContributions,
  saveWorkTags,
  updateWork,
  type LibraryCitationSchemeSpec,
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

type StructurePart = { key: string; abbr: string };

const emptyForm: LibraryWorkSave = {
  originalTitle: '',
  originalSubtitle: null,
  originalLanguage: 'pl',
  uniformTitle: null,
  kind: 'book',
  citationScheme: 'Page',
  structureTemplateJson: null,
  citationSigil: null,
  firstPublishedYear: null,
  notes: null
};

function parseTemplate(json: string | null): StructurePart[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    const list = Array.isArray(parsed) ? parsed : parsed?.parts;
    if (!Array.isArray(list)) return [];
    return list
      .filter((part) => part && typeof part === 'object')
      .map((part) => ({ key: String(part.key ?? ''), abbr: String(part.abbr ?? '') }))
      .filter((part) => part.key.length > 0);
  } catch {
    return [];
  }
}

export function LibraryWorkEditorPage({ t, workId }: { t: LibraryCopyStrings; workId: number | null }) {
  const navigate = useNavigate();
  const isNew = workId === null;

  const [form, setForm] = useState<LibraryWorkSave>(emptyForm);
  const [detail, setDetail] = useState<LibraryWorkDetail | null>(null);
  const [contributions, setContributions] = useState<LibraryContributionSave[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [structure, setStructure] = useState<StructurePart[]>([]);
  const [people, setPeople] = useState<LibraryPerson[]>([]);
  const [tags, setTags] = useState<LibraryTag[]>([]);
  const [schemes, setSchemes] = useState<LibraryCitationSchemeSpec[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(0);

  const schemeSpec = useMemo(
    () => schemes.find((item) => item.scheme === form.citationScheme),
    [schemes, form.citationScheme]
  );

  const loadDetail = useCallback(async (id: number) => {
    const data = await getWork(id);
    setDetail(data);
    setForm({
      originalTitle: data.originalTitle,
      originalSubtitle: data.originalSubtitle,
      originalLanguage: data.originalLanguage,
      uniformTitle: data.uniformTitle,
      kind: data.kind,
      citationScheme: data.citationScheme,
      structureTemplateJson: data.structureTemplateJson,
      citationSigil: data.citationSigil,
      firstPublishedYear: data.firstPublishedYear,
      notes: data.notes
    });
    setContributions(toContributionSaves(data.contributions));
    setSelectedTagIds(data.tagIds);
    setStructure(parseTemplate(data.structureTemplateJson));
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getPeople(), getTags(), getCitationSchemes()])
      .then(([peopleResult, tagsResult, schemeResult]) => {
        if (!active) return;
        setPeople(peopleResult);
        setTags(tagsResult);
        setSchemes(schemeResult);
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
      // The template only means anything for the structured scheme.
      const body: LibraryWorkSave = {
        ...form,
        structureTemplateJson:
          form.citationScheme === 'StructuredWork' && structure.length > 0
            ? JSON.stringify({ parts: structure })
            : null
      };

      if (workId === null) {
        const created = await createWork(body);
        if (contributions.length > 0) await saveWorkContributions(created.id, contributions);
        if (selectedTagIds.length > 0) await saveWorkTags(created.id, selectedTagIds);
        navigate(`/library/works/${created.id}`, { replace: true });
        return;
      }

      await updateWork(workId, body);
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
    const hasQuotes = (detail?.quoteCount ?? 0) > 0;
    if (!confirm(hasQuotes ? t.work.deleteWorkHasQuotes : t.work.deleteWorkConfirm)) return;
    try {
      await deleteWork(workId, hasQuotes);
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
          {!isNew && (detail?.quoteCount ?? 0) > 0 ? (
            <button
              type="button"
              className="lib-btn lib-btn-ghost"
              onClick={() => navigate(`/library/quotes?workId=${workId}`)}
            >
              {t.work.viewQuotes} ({detail?.quoteCount})
            </button>
          ) : null}
          <button type="button" className="lib-btn" disabled={saving || !form.originalTitle.trim()} onClick={handleSave}>
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
            <Select value={form.kind} onChange={(value) => update('kind', value)} options={vocabularyOptions(WORK_KINDS, t.kinds)} />
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

      {/* The scheme decides which locator fields every quote from this work gets. */}
      <Section title={t.work.citationSection} hint={t.work.citationHint}>
        <div className="lib-form-grid">
          <Field label={t.work.scheme} hint={t.work.schemeHint}>
            <Select
              value={form.citationScheme}
              onChange={(value) => update('citationScheme', value)}
              options={vocabularyOptions(CITATION_SCHEMES, t.schemes)}
            />
          </Field>
          <Field label={t.work.sigil} hint={t.work.sigilHint}>
            <TextInput
              value={form.citationSigil ?? ''}
              onChange={(value) => update('citationSigil', orNull(value))}
              maxLength={40}
            />
          </Field>
        </div>

        <p className="lib-field-hint">
          {t.schemeHints[form.citationScheme] ?? ''}
          {schemeSpec ? ` — ${schemeSpec.example}` : ''}
        </p>

        {form.citationScheme === 'StructuredWork' ? (
          <div className="lib-structure">
            <p className="lib-field-hint">{t.work.structureTemplateHint}</p>
            {structure.map((part, index) => (
              <div key={index} className="lib-structure-row">
                <TextInput
                  value={part.key}
                  onChange={(value) =>
                    setStructure((current) => current.map((x, i) => (i === index ? { ...x, key: value } : x)))
                  }
                  placeholder={t.work.structureKey}
                />
                <TextInput
                  value={part.abbr}
                  onChange={(value) =>
                    setStructure((current) => current.map((x, i) => (i === index ? { ...x, abbr: value } : x)))
                  }
                  placeholder={t.work.structureAbbr}
                />
                <button
                  type="button"
                  className="lib-btn lib-btn-danger lib-btn-sm"
                  onClick={() => setStructure((current) => current.filter((_, i) => i !== index))}
                >
                  {t.common.remove}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="lib-btn lib-btn-ghost lib-btn-sm"
              onClick={() => setStructure((current) => [...current, { key: '', abbr: '' }])}
            >
              {t.work.structureAdd}
            </button>
          </div>
        ) : null}
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
        title={t.work.expressionsSection}
        hint={t.work.expressionsHint}
        actions={
          isNew ? null : (
            <button
              type="button"
              className="lib-btn lib-btn-sm"
              onClick={() => navigate(`/library/works/${workId}/expressions/new`)}
            >
              {t.work.addExpression}
            </button>
          )
        }
      >
        {isNew ? (
          <p className="lib-muted">{t.work.createFirst}</p>
        ) : !detail || detail.expressions.length === 0 ? (
          <p className="lib-muted">{t.work.noExpressions}</p>
        ) : (
          <ul className="lib-edition-list">
            {detail.expressions.map((expression) => (
              <li key={expression.id}>
                <button
                  type="button"
                  className="lib-edition-row"
                  onClick={() => navigate(`/library/expressions/${expression.id}`)}
                >
                  <span className="lib-edition-main">
                    <span className="lib-edition-title">
                      {expression.name || languageLabel(t, expression.language)}
                    </span>
                    {expression.translators.length > 0 ? (
                      <span className="lib-edition-translators">
                        {t.roles.translator}: {expression.translators.join(', ')}
                      </span>
                    ) : null}
                  </span>
                  <span className="lib-edition-side">
                    <Badge tone={expression.isTranslation ? 'translation' : 'original'}>
                      {languageLabel(t, expression.language)}
                    </Badge>
                    <span className="lib-edition-counts">
                      {expression.manifestationCount} {t.works.manifestationCount}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={t.work.manifestationsSection}
        hint={t.work.manifestationsHint}
        actions={
          isNew ? null : (
            <button
              type="button"
              className="lib-btn lib-btn-sm"
              onClick={() => navigate(`/library/works/${workId}/manifestations/new`)}
            >
              {t.work.addManifestation}
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
                      {[
                        manifestation.publisherName,
                        manifestation.publishedPlace,
                        manifestation.publishedYear ? String(manifestation.publishedYear) : null,
                        manifestation.editionStatement
                      ]
                        .filter(Boolean)
                        .join(' · ') || t.common.none}
                    </span>
                  </span>
                  <span className="lib-edition-side">
                    <Badge tone="muted">{t.formats[manifestation.format] ?? manifestation.format}</Badge>
                    {manifestation.expressionLanguage ? (
                      <Badge tone="translation">{languageLabel(t, manifestation.expressionLanguage)}</Badge>
                    ) : null}
                    <span className="lib-edition-counts">
                      {manifestation.itemCount} {t.works.itemCount}
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
