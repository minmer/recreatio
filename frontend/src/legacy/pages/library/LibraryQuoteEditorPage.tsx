import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createQuote,
  deleteQuote,
  getBibleBooks,
  getCitationSchemes,
  getQuote,
  getTags,
  getWork,
  getWorks,
  updateQuote,
  type LibraryBibleBook,
  type LibraryCitationSchemeSpec,
  type LibraryQuoteSave,
  type LibraryTag,
  type LibraryWorkDetail,
  type LibraryWorkListItem
} from './libraryApi';
import { languageLabel, type LibraryCopyStrings } from './libraryCopy';
import { useCitationStyle } from './libraryPrefs';
import {
  Badge,
  ErrorBanner,
  Field,
  Loading,
  NumberInput,
  Section,
  Select,
  TextArea,
  TextInput,
  orNull
} from './libraryComponents';

/** One level of a StructuredWork locator, e.g. { key: "question", abbr: "q." }. */
type StructurePart = { key: string; abbr: string };

/** Free-form locator state; which keys matter depends on the work's scheme. */
type LocatorState = Record<string, string>;

function parseStructureTemplate(json: string | null): StructurePart[] {
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

/** Builds the LocatorJson the API stores, shaped by the scheme. */
function buildLocatorJson(scheme: string, state: LocatorState, parts: StructurePart[]): string | null {
  const value = (key: string) => state[key]?.trim() ?? '';

  if (scheme === 'Page') {
    if (!value('page')) return null;
    const locator: Record<string, string> = { scheme, page: value('page') };
    if (value('pageEnd')) locator.pageEnd = value('pageEnd');
    return JSON.stringify(locator);
  }

  if (scheme === 'BibleReference') {
    if (!value('book')) return null;
    const locator: Record<string, string | number> = { scheme, book: value('book') };
    for (const key of ['chapter', 'verse', 'verseEnd']) {
      const raw = value(key);
      if (raw) locator[key] = Number(raw);
    }
    return JSON.stringify(locator);
  }

  if (scheme === 'StructuredWork') {
    const filled = parts
      .map((part) => ({ abbr: part.abbr, value: value(part.key) }))
      .filter((part) => part.value.length > 0);
    if (filled.length > 0) return JSON.stringify({ scheme, parts: filled });
    // A work with no template still supports a single bare value.
    return value('thesis') ? JSON.stringify({ scheme, thesis: value('thesis') }) : null;
  }

  if (scheme === 'DocumentParagraph') {
    if (!value('paragraph')) return null;
    const locator: Record<string, string> = { scheme, paragraph: value('paragraph') };
    if (value('paragraphEnd')) locator.paragraphEnd = value('paragraphEnd');
    return JSON.stringify(locator);
  }

  return null;
}

/** Reads a stored locator back into form state. */
function readLocatorJson(json: string | null, parts: StructurePart[]): LocatorState {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return {};

    const state: LocatorState = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key === 'scheme' || key === 'parts') continue;
      if (value !== null && value !== undefined) state[key] = String(value);
    }

    if (Array.isArray(parsed.parts)) {
      parsed.parts.forEach((part: { value?: unknown }, index: number) => {
        const key = parts[index]?.key;
        if (key && part?.value !== undefined) state[key] = String(part.value);
      });
    }

    return state;
  } catch {
    return {};
  }
}

export function LibraryQuoteEditorPage({
  t,
  language,
  quoteId,
  presetWorkId
}: {
  t: LibraryCopyStrings;
  language: string;
  quoteId: number | null;
  presetWorkId: number | null;
}) {
  const navigate = useNavigate();
  const isNew = quoteId === null;
  const [style] = useCitationStyle();

  const [workId, setWorkId] = useState<number | null>(presetWorkId);
  const [work, setWork] = useState<LibraryWorkDetail | null>(null);
  const [expressionId, setExpressionId] = useState<number | null>(null);
  const [manifestationId, setManifestationId] = useState<number | null>(null);
  const [quoteText, setQuoteText] = useState('');
  const [locator, setLocator] = useState<LocatorState>({});
  const [description, setDescription] = useState('');
  const [context, setContext] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const [schemes, setSchemes] = useState<LibraryCitationSchemeSpec[]>([]);
  const [bibleBooks, setBibleBooks] = useState<LibraryBibleBook[]>([]);
  const [tags, setTags] = useState<LibraryTag[]>([]);
  const [workResults, setWorkResults] = useState<LibraryWorkListItem[]>([]);
  const [workTerm, setWorkTerm] = useState('');

  const [loading, setLoading] = useState(!isNew || presetWorkId !== null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ locator: string | null; reference: string } | null>(null);

  const structureParts = useMemo(
    () => parseStructureTemplate(work?.structureTemplateJson ?? null),
    [work?.structureTemplateJson]
  );
  const scheme = work?.citationScheme ?? 'Page';
  const schemeSpec = schemes.find((item) => item.scheme === scheme);

  // Reference data.
  useEffect(() => {
    let active = true;
    Promise.all([getCitationSchemes(), getBibleBooks(), getTags()])
      .then(([schemeList, bookList, tagList]) => {
        if (!active) return;
        setSchemes(schemeList);
        setBibleBooks(bookList);
        setTags(tagList);
      })
      .catch(() => {
        if (active) setError(t.common.loadFailed);
      });
    return () => {
      active = false;
    };
  }, [t.common.loadFailed]);

  const loadWork = useCallback(async (id: number) => {
    const detail = await getWork(id);
    setWork(detail);
    return detail;
  }, []);

  // Existing quote, or a preset work for "quote this work".
  useEffect(() => {
    let active = true;
    setLoading(quoteId !== null || presetWorkId !== null);

    const load = async () => {
      if (quoteId !== null) {
        const quote = await getQuote(quoteId, language);
        if (!active) return;
        setWorkId(quote.workId);
        setExpressionId(quote.expressionId);
        setManifestationId(quote.manifestationId);
        setQuoteText(quote.quoteText);
        setDescription(quote.description ?? '');
        setContext(quote.context ?? '');
        setSelectedTagIds(quote.tags.map((tag) => tag.id));

        const detail = await loadWork(quote.workId);
        if (!active) return;
        setLocator(readLocatorJson(quote.locatorJson, parseStructureTemplate(detail.structureTemplateJson)));
        setPreview({ locator: quote.locatorDisplay, reference: quote.reference });
        return;
      }

      if (presetWorkId !== null) await loadWork(presetWorkId);
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
  }, [quoteId, presetWorkId, language, loadWork, t.common.loadFailed]);

  // Work picker.
  const searchTimer = useRef(0);
  useEffect(() => {
    window.clearTimeout(searchTimer.current);
    if (workTerm.trim().length < 2) {
      setWorkResults([]);
      return;
    }
    searchTimer.current = window.setTimeout(() => {
      getWorks({ term: workTerm, take: 8 })
        .then((result) => setWorkResults(result.items))
        .catch(() => undefined);
    }, 250);
    return () => window.clearTimeout(searchTimer.current);
  }, [workTerm]);

  async function pickWork(id: number) {
    setWorkId(id);
    setExpressionId(null);
    setManifestationId(null);
    setLocator({});
    setWorkTerm('');
    setWorkResults([]);
    try {
      await loadWork(id);
    } catch {
      setError(t.common.loadFailed);
    }
  }

  const setLocatorValue = (key: string, value: string) =>
    setLocator((current) => ({ ...current, [key]: value }));

  async function handleSave() {
    if (workId === null || !quoteText.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const body: LibraryQuoteSave = {
        workId,
        expressionId,
        manifestationId,
        quoteText: quoteText.trim(),
        locatorJson: buildLocatorJson(scheme, locator, structureParts),
        description: orNull(description),
        context: orNull(context),
        tagIds: selectedTagIds
      };

      const saved = isNew ? await createQuote(body, language) : await updateQuote(quoteId!, body, language);

      // Read back so the preview shows exactly what was stored and rendered.
      const stored = await getQuote(saved.id, language);
      setPreview({ locator: stored.locatorDisplay, reference: stored.reference });

      if (isNew) navigate(`/library/quotes/${saved.id}`, { replace: true });
    } catch {
      setError(t.common.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (quoteId === null || !confirm(t.quote.deleteConfirm)) return;
    try {
      await deleteQuote(quoteId);
      navigate('/library/quotes');
    } catch {
      setError(t.common.deleteFailed);
    }
  }

  if (loading) return <Loading text={t.common.loading} />;

  const bibleOptions = bibleBooks.map((book) => ({
    value: book.id,
    label: book.names[language]?.name ?? book.names.la?.name ?? book.id
  }));

  return (
    <div className="lib-editor">
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <header className="lib-page-head">
        <div>
          <button type="button" className="lib-back" onClick={() => navigate('/library/quotes')}>
            ← {t.quotes.title}
          </button>
          <h1 className="lib-page-title">{isNew ? t.quote.newTitle : t.quote.editTitle}</h1>
        </div>
        <div className="lib-head-actions">
          <button
            type="button"
            className="lib-btn"
            disabled={saving || workId === null || !quoteText.trim()}
            onClick={handleSave}
          >
            {saving ? t.common.saving : t.common.save}
          </button>
          {!isNew ? (
            <button type="button" className="lib-btn lib-btn-danger" onClick={handleDelete}>
              {t.quote.deleteQuote}
            </button>
          ) : null}
        </div>
      </header>

      {/* Source first: the locator fields cannot be drawn until the work — and
          therefore the citation scheme — is known. */}
      <Section title={t.quote.sourceSection} hint={t.quote.sourceHint}>
        {work ? (
          <div className="lib-quote-source">
            <div className="lib-quote-workline">
              <strong>{work.uniformTitle || work.originalTitle}</strong>
              <Badge tone="original">{t.schemes[work.citationScheme] ?? work.citationScheme}</Badge>
              <Badge tone="muted">{languageLabel(t, work.originalLanguage)}</Badge>
              <button
                type="button"
                className="lib-btn lib-btn-ghost lib-btn-sm"
                onClick={() => navigate(`/library/works/${work.id}`)}
              >
                {t.common.open}
              </button>
              <button type="button" className="lib-btn lib-btn-ghost lib-btn-sm" onClick={() => setWork(null)}>
                {t.common.edit}
              </button>
            </div>
            <p className="lib-field-hint">{t.schemeHints[work.citationScheme] ?? ''}</p>

            <div className="lib-form-grid">
              <Field label={t.quote.expression} hint={t.quote.expressionHint}>
                <Select
                  value={expressionId === null ? '' : String(expressionId)}
                  onChange={(value) => setExpressionId(value === '' ? null : Number(value))}
                  options={work.expressions.map((expression) => ({
                    value: String(expression.id),
                    label: expression.name
                      ? `${expression.name} (${languageLabel(t, expression.language)})`
                      : languageLabel(t, expression.language)
                  }))}
                  placeholder={t.quote.expressionNone}
                />
              </Field>
              <Field label={t.quote.manifestation} hint={t.quote.manifestationHint}>
                <Select
                  value={manifestationId === null ? '' : String(manifestationId)}
                  onChange={(value) => setManifestationId(value === '' ? null : Number(value))}
                  options={work.manifestations.map((manifestation) => ({
                    value: String(manifestation.id),
                    label: [manifestation.title, manifestation.publisherName, manifestation.publishedYear]
                      .filter(Boolean)
                      .join(' · ')
                  }))}
                  placeholder={t.quote.manifestationNone}
                />
              </Field>
            </div>
          </div>
        ) : (
          <div className="lib-picker">
            <input
              className="lib-input"
              value={workTerm}
              placeholder={t.quote.pickWork}
              autoFocus
              onChange={(event) => setWorkTerm(event.target.value)}
            />
            {workResults.length > 0 ? (
              <ul className="lib-picker-list">
                {workResults.map((result) => (
                  <li key={result.id}>
                    <button type="button" onClick={() => pickWork(result.id)}>
                      <span>{result.uniformTitle || result.originalTitle}</span>
                      <span className="lib-picker-meta">
                        {result.authors.join(', ') || t.common.unknown}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="lib-field-hint">{t.quote.workRequired}</p>
          </div>
        )}
      </Section>

      <Section title={t.quote.textSection}>
        <Field label={t.quote.quoteText} hint={t.quote.quoteTextHint} required>
          <TextArea value={quoteText} onChange={setQuoteText} rows={6} />
        </Field>
      </Section>

      {/* The locator fields are generated from the scheme, so a new scheme on the
          server appears here without a frontend change. */}
      <Section title={t.quote.locatorSection} hint={t.quote.locatorHint}>
        {!work ? (
          <p className="lib-muted">{t.quote.workRequired}</p>
        ) : scheme === 'BibleReference' ? (
          <div className="lib-form-grid">
            <Field label={t.quote.bookField} required>
              <Select
                value={locator.book ?? ''}
                onChange={(value) => setLocatorValue('book', value)}
                options={bibleOptions}
                placeholder={t.common.none}
              />
            </Field>
            <Field label={t.quote.chapterField} required>
              <NumberInput
                value={locator.chapter ? Number(locator.chapter) : null}
                onChange={(value) => setLocatorValue('chapter', value === null ? '' : String(value))}
                min={1}
              />
            </Field>
            <Field label={t.quote.verseField}>
              <NumberInput
                value={locator.verse ? Number(locator.verse) : null}
                onChange={(value) => setLocatorValue('verse', value === null ? '' : String(value))}
                min={1}
              />
            </Field>
            <Field label={t.quote.verseEndField}>
              <NumberInput
                value={locator.verseEnd ? Number(locator.verseEnd) : null}
                onChange={(value) => setLocatorValue('verseEnd', value === null ? '' : String(value))}
                min={1}
              />
            </Field>
          </div>
        ) : scheme === 'StructuredWork' ? (
          structureParts.length === 0 ? (
            <>
              <p className="lib-muted">{t.quote.structuredNoTemplate}</p>
              <Field label={t.quote.locatorSection}>
                <TextInput value={locator.thesis ?? ''} onChange={(value) => setLocatorValue('thesis', value)} />
              </Field>
            </>
          ) : (
            <>
              <p className="lib-field-hint">{t.quote.structuredHint}</p>
              <div className="lib-form-grid">
                {structureParts.map((part) => (
                  <Field key={part.key} label={part.abbr ? `${part.key} (${part.abbr})` : part.key}>
                    <TextInput
                      value={locator[part.key] ?? ''}
                      onChange={(value) => setLocatorValue(part.key, value)}
                    />
                  </Field>
                ))}
              </div>
            </>
          )
        ) : scheme === 'DocumentParagraph' ? (
          <div className="lib-form-grid">
            <Field label={t.quote.paragraphField} required>
              <TextInput
                value={locator.paragraph ?? ''}
                onChange={(value) => setLocatorValue('paragraph', value)}
              />
            </Field>
            <Field label={t.quote.paragraphEndField}>
              <TextInput
                value={locator.paragraphEnd ?? ''}
                onChange={(value) => setLocatorValue('paragraphEnd', value)}
              />
            </Field>
          </div>
        ) : (
          <div className="lib-form-grid">
            <Field label={t.quote.pageField} required>
              <TextInput value={locator.page ?? ''} onChange={(value) => setLocatorValue('page', value)} />
            </Field>
            <Field label={t.quote.pageEndField}>
              <TextInput value={locator.pageEnd ?? ''} onChange={(value) => setLocatorValue('pageEnd', value)} />
            </Field>
          </div>
        )}

        {schemeSpec ? <p className="lib-field-hint">{t.quote.locatorPreview}: {schemeSpec.example}</p> : null}
      </Section>

      {preview ? (
        <Section title={t.quote.referencePreview}>
          <p className="lib-quote-reference">{preview.reference}</p>
          <p className="lib-field-hint">
            {t.quotes.style}: {style}
          </p>
        </Section>
      ) : null}

      <Section title={t.quote.interpretationSection} hint={t.quote.optionalNote}>
        <div className="lib-form-grid">
          <div className="lib-form-wide">
            <Field label={t.quote.context} hint={t.quote.contextHint}>
              <TextArea value={context} onChange={setContext} rows={3} />
            </Field>
          </div>
          <div className="lib-form-wide">
            <Field label={t.quote.description} hint={t.quote.descriptionHint}>
              <TextArea value={description} onChange={setDescription} rows={3} />
            </Field>
          </div>
        </div>
      </Section>

      <Section title={t.quote.tagsSection}>
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
    </div>
  );
}
