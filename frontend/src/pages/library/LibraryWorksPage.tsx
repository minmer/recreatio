import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CITATION_SCHEMES,
  WORK_KINDS,
  getPeople,
  getPublishers,
  getTags,
  getWorks,
  type LibraryPerson,
  type LibraryPublisher,
  type LibraryTag,
  type LibraryWorkFilters,
  type LibraryWorkListItem
} from './libraryApi';
import { languageLabel, type LibraryCopyStrings } from './libraryCopy';
import {
  Badge,
  EmptyState,
  ErrorBanner,
  LanguageSelect,
  Loading,
  Pagination,
  Select,
  Toggle,
  vocabularyOptions
} from './libraryComponents';
import { LibraryScanDialog } from './LibraryScanDialog';

const PAGE_SIZE = 25;

export function LibraryWorksPage({
  t,
  initialPersonId,
  initialTagId
}: {
  t: LibraryCopyStrings;
  initialPersonId: number | null;
  initialTagId: number | null;
}) {
  const navigate = useNavigate();

  const [term, setTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [kind, setKind] = useState('');
  const [citationScheme, setCitationScheme] = useState('');
  const [originalLanguage, setOriginalLanguage] = useState('');
  const [expressionLanguage, setExpressionLanguage] = useState('');
  const [personId, setPersonId] = useState(initialPersonId === null ? '' : String(initialPersonId));
  const [tagId, setTagId] = useState(initialTagId === null ? '' : String(initialTagId));
  const [publisherId, setPublisherId] = useState('');
  const [onlyTranslated, setOnlyTranslated] = useState(false);
  const [onlyOwned, setOnlyOwned] = useState(false);
  const [onlyQuoted, setOnlyQuoted] = useState(false);
  const [sort, setSort] = useState('title');
  const [skip, setSkip] = useState(0);

  const [items, setItems] = useState<LibraryWorkListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [people, setPeople] = useState<LibraryPerson[]>([]);
  const [tags, setTags] = useState<LibraryTag[]>([]);
  const [publishers, setPublishers] = useState<LibraryPublisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedTerm(term);
      setSkip(0);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [term]);

  useEffect(() => {
    let active = true;
    Promise.all([getPeople(), getTags(), getPublishers()])
      .then(([peopleResult, tagsResult, publishersResult]) => {
        if (!active) return;
        setPeople(peopleResult);
        setTags(tagsResult);
        setPublishers(publishersResult);
      })
      .catch(() => {
        if (active) setError(t.common.loadFailed);
      });
    return () => {
      active = false;
    };
  }, [t.common.loadFailed]);

  const filters = useMemo<LibraryWorkFilters>(
    () => ({
      term: debouncedTerm || undefined,
      kind: kind || undefined,
      citationScheme: citationScheme || undefined,
      originalLanguage: originalLanguage || undefined,
      expressionLanguage: expressionLanguage || undefined,
      personId: personId ? Number(personId) : undefined,
      tagId: tagId ? Number(tagId) : undefined,
      publisherId: publisherId ? Number(publisherId) : undefined,
      onlyTranslated: onlyTranslated || undefined,
      onlyOwned: onlyOwned || undefined,
      onlyQuoted: onlyQuoted || undefined,
      sort,
      skip,
      take: PAGE_SIZE
    }),
    [
      debouncedTerm, kind, citationScheme, originalLanguage, expressionLanguage,
      personId, tagId, publisherId, onlyTranslated, onlyOwned, onlyQuoted, sort, skip
    ]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    getWorks(filters)
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setTotal(result.total);
      })
      .catch(() => {
        if (active) setError(t.common.loadFailed);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filters, reloadToken, t.common.loadFailed]);

  const hasFilters =
    Boolean(debouncedTerm || kind || citationScheme || originalLanguage || expressionLanguage || personId || tagId || publisherId) ||
    onlyTranslated || onlyOwned || onlyQuoted;

  const clearFilters = () => {
    setTerm('');
    setKind('');
    setCitationScheme('');
    setOriginalLanguage('');
    setExpressionLanguage('');
    setPersonId('');
    setTagId('');
    setPublisherId('');
    setOnlyTranslated(false);
    setOnlyOwned(false);
    setOnlyQuoted(false);
    setSkip(0);
  };

  return (
    <div className="lib-works">
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <header className="lib-page-head">
        <div>
          <h1 className="lib-page-title">{t.works.title}</h1>
          <p className="lib-page-subtitle">{t.works.subtitle}</p>
        </div>
        <div className="lib-head-actions">
          <button type="button" className="lib-btn lib-btn-ghost" onClick={() => setScanOpen(true)}>
            {t.scan.button}
          </button>
          <button type="button" className="lib-btn" onClick={() => navigate('/library/works/new')}>
            {t.works.newWork}
          </button>
        </div>
      </header>

      <div className="lib-filters">
        <input
          className="lib-input lib-search"
          value={term}
          placeholder={t.works.searchPlaceholder}
          onChange={(event) => setTerm(event.target.value)}
        />
        <Select
          value={kind}
          onChange={(value) => { setKind(value); setSkip(0); }}
          options={vocabularyOptions(WORK_KINDS, t.kinds)}
          placeholder={t.works.filterKind}
        />
        <Select
          value={citationScheme}
          onChange={(value) => { setCitationScheme(value); setSkip(0); }}
          options={vocabularyOptions(CITATION_SCHEMES, t.schemes)}
          placeholder={t.works.filterScheme}
        />
        <LanguageSelect
          t={t}
          value={originalLanguage}
          onChange={(value) => { setOriginalLanguage(value); setSkip(0); }}
          placeholder={t.works.filterOriginalLanguage}
        />
        <LanguageSelect
          t={t}
          value={expressionLanguage}
          onChange={(value) => { setExpressionLanguage(value); setSkip(0); }}
          placeholder={t.works.filterExpressionLanguage}
        />
        <Select
          value={personId}
          onChange={(value) => { setPersonId(value); setSkip(0); }}
          options={people.map((person) => ({ value: String(person.id), label: person.displayName }))}
          placeholder={t.works.filterAuthor}
        />
        <Select
          value={tagId}
          onChange={(value) => { setTagId(value); setSkip(0); }}
          options={tags.map((tag) => ({ value: String(tag.id), label: tag.name }))}
          placeholder={t.works.filterTag}
        />
        <Select
          value={publisherId}
          onChange={(value) => { setPublisherId(value); setSkip(0); }}
          options={publishers.map((publisher) => ({ value: String(publisher.id), label: publisher.name }))}
          placeholder={t.works.filterPublisher}
        />
        <Select
          value={sort}
          onChange={(value) => { setSort(value); setSkip(0); }}
          options={[
            { value: 'title', label: t.works.sortTitle },
            { value: 'created', label: t.works.sortCreated },
            { value: 'updated', label: t.works.sortUpdated },
            { value: 'year', label: t.works.sortYearAsc },
            { value: 'year_desc', label: t.works.sortYearDesc }
          ]}
        />
        <Toggle checked={onlyTranslated} onChange={(v) => { setOnlyTranslated(v); setSkip(0); }} label={t.works.onlyTranslated} />
        <Toggle checked={onlyOwned} onChange={(v) => { setOnlyOwned(v); setSkip(0); }} label={t.works.onlyOwned} />
        <Toggle checked={onlyQuoted} onChange={(v) => { setOnlyQuoted(v); setSkip(0); }} label={t.works.onlyQuoted} />
        {hasFilters ? (
          <button type="button" className="lib-btn lib-btn-ghost lib-btn-sm" onClick={clearFilters}>
            {t.common.clear}
          </button>
        ) : null}
      </div>

      {loading ? (
        <Loading text={t.common.loading} />
      ) : items.length === 0 ? (
        <EmptyState
          text={hasFilters ? t.works.emptyFiltered : t.works.empty}
          action={
            hasFilters ? (
              <button type="button" className="lib-btn lib-btn-ghost" onClick={clearFilters}>
                {t.common.clear}
              </button>
            ) : (
              <button type="button" className="lib-btn" onClick={() => navigate('/library/works/new')}>
                {t.works.newWork}
              </button>
            )
          }
        />
      ) : (
        <>
          <ul className="lib-work-list">
            {items.map((work) => (
              <li key={work.id}>
                <button type="button" className="lib-work-row" onClick={() => navigate(`/library/works/${work.id}`)}>
                  <span className="lib-work-main">
                    <span className="lib-work-title">{work.uniformTitle || work.originalTitle}</span>
                    {work.uniformTitle && work.uniformTitle !== work.originalTitle ? (
                      <span className="lib-work-original">{work.originalTitle}</span>
                    ) : null}
                    <span className="lib-work-authors">
                      {work.authors.length > 0 ? work.authors.join(', ') : t.common.unknown}
                      {work.firstPublishedYear ? ` · ${work.firstPublishedYear}` : ''}
                    </span>
                  </span>
                  <span className="lib-work-side">
                    <Badge tone="original">{languageLabel(t, work.originalLanguage)}</Badge>
                    <Badge tone="muted">{t.schemes[work.citationScheme] ?? work.citationScheme}</Badge>
                    {work.expressionLanguages
                      .filter((code) => code !== work.originalLanguage)
                      .map((code) => (
                        <Badge key={code} tone="translation">
                          {languageLabel(t, code)}
                        </Badge>
                      ))}
                    {work.tags.map((tag) => (
                      <Badge key={tag.id}>{tag.name}</Badge>
                    ))}
                    <span className="lib-work-counts">
                      {work.manifestationCount} {t.works.manifestationCount} · {work.itemCount} {t.works.itemCount}
                      {work.quoteCount > 0 ? ` · ${work.quoteCount} ${t.works.quoteCount}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Pagination t={t} skip={skip} take={PAGE_SIZE} total={total} onSkip={setSkip} />
        </>
      )}

      {scanOpen ? (
        <LibraryScanDialog
          t={t}
          onClose={() => {
            setScanOpen(false);
            setReloadToken((current) => current + 1);
          }}
          onSearchCode={(code) => setTerm(code)}
        />
      ) : null}
    </div>
  );
}
