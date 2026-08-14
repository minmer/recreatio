import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CITATION_SCHEMES,
  deleteQuote,
  getCitationStyles,
  getPeople,
  getQuotes,
  getTags,
  type LibraryCitationStyleSpec,
  type LibraryPerson,
  type LibraryQuote,
  type LibraryQuoteFilters,
  type LibraryTag
} from './libraryApi';
import type { LibraryCopyStrings } from './libraryCopy';
import { copyToClipboard, useCitationStyle } from './libraryPrefs';
import {
  Badge,
  EmptyState,
  ErrorBanner,
  Loading,
  Pagination,
  Select,
  vocabularyOptions
} from './libraryComponents';

const PAGE_SIZE = 20;

/**
 * The page used while writing: find a quote, read its reference, paste it.
 * The citation style is chosen here rather than stored on the data, because it
 * governs how a reference is written, never where the quote sits.
 */
export function LibraryQuotesPage({
  t,
  language,
  initialWorkId,
  initialTagId
}: {
  t: LibraryCopyStrings;
  language: string;
  initialWorkId: number | null;
  initialTagId: number | null;
}) {
  const navigate = useNavigate();
  const [style, setStyle] = useCitationStyle();

  const [term, setTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [tagId, setTagId] = useState(initialTagId === null ? '' : String(initialTagId));
  const [personId, setPersonId] = useState('');
  const [scheme, setScheme] = useState('');
  const [sort, setSort] = useState('newest');
  const [skip, setSkip] = useState(0);

  const [items, setItems] = useState<LibraryQuote[]>([]);
  const [total, setTotal] = useState(0);
  const [tags, setTags] = useState<LibraryTag[]>([]);
  const [people, setPeople] = useState<LibraryPerson[]>([]);
  const [styles, setStyles] = useState<LibraryCitationStyleSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
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
    Promise.all([getTags(), getPeople(), getCitationStyles()])
      .then(([tagList, peopleList, styleList]) => {
        if (!active) return;
        setTags(tagList);
        setPeople(peopleList);
        setStyles(styleList);
      })
      .catch(() => {
        if (active) setError(t.common.loadFailed);
      });
    return () => {
      active = false;
    };
  }, [t.common.loadFailed]);

  const filters = useMemo<LibraryQuoteFilters>(
    () => ({
      term: debouncedTerm || undefined,
      workId: initialWorkId ?? undefined,
      tagId: tagId ? Number(tagId) : undefined,
      personId: personId ? Number(personId) : undefined,
      citationScheme: scheme || undefined,
      lang: language,
      style,
      sort,
      skip,
      take: PAGE_SIZE
    }),
    [debouncedTerm, initialWorkId, tagId, personId, scheme, language, style, sort, skip]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    getQuotes(filters)
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

  async function handleCopy(quote: LibraryQuote, what: 'reference' | 'quote' | 'both') {
    const text =
      what === 'reference'
        ? quote.reference
        : what === 'quote'
          ? quote.quoteText
          : `„${quote.quoteText}” ${quote.reference}`;
    if (await copyToClipboard(text)) {
      setCopiedId(quote.id);
      window.setTimeout(() => setCopiedId((current) => (current === quote.id ? null : current)), 1600);
    }
  }

  async function handleDelete(quote: LibraryQuote) {
    if (!confirm(t.quote.deleteConfirm)) return;
    try {
      await deleteQuote(quote.id);
      setReloadToken((current) => current + 1);
    } catch {
      setError(t.common.deleteFailed);
    }
  }

  const hasFilters = Boolean(debouncedTerm || tagId || personId || scheme);

  const clearFilters = () => {
    setTerm('');
    setTagId('');
    setPersonId('');
    setScheme('');
    setSkip(0);
  };

  return (
    <div className="lib-quotes">
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <header className="lib-page-head">
        <div>
          <h1 className="lib-page-title">{t.quotes.title}</h1>
          <p className="lib-page-subtitle">{t.quotes.subtitle}</p>
        </div>
        <button type="button" className="lib-btn" onClick={() => navigate('/library/quotes/new')}>
          {t.quotes.newQuote}
        </button>
      </header>

      <div className="lib-filters">
        <input
          className="lib-input lib-search"
          value={term}
          placeholder={t.quotes.searchPlaceholder}
          onChange={(event) => setTerm(event.target.value)}
        />
        <Select
          value={tagId}
          onChange={(value) => {
            setTagId(value);
            setSkip(0);
          }}
          options={tags.map((tag) => ({ value: String(tag.id), label: tag.name }))}
          placeholder={t.quotes.filterTag}
        />
        <Select
          value={personId}
          onChange={(value) => {
            setPersonId(value);
            setSkip(0);
          }}
          options={people.map((person) => ({ value: String(person.id), label: person.displayName }))}
          placeholder={t.quotes.filterAuthor}
        />
        <Select
          value={scheme}
          onChange={(value) => {
            setScheme(value);
            setSkip(0);
          }}
          options={vocabularyOptions(CITATION_SCHEMES, t.schemes)}
          placeholder={t.quotes.filterScheme}
        />
        <Select
          value={sort}
          onChange={(value) => {
            setSort(value);
            setSkip(0);
          }}
          options={[
            { value: 'newest', label: t.quotes.sortNewest },
            { value: 'oldest', label: t.quotes.sortOldest },
            { value: 'updated', label: t.quotes.sortUpdated },
            { value: 'locator', label: t.quotes.sortLocator }
          ]}
        />
        {hasFilters ? (
          <button type="button" className="lib-btn lib-btn-ghost lib-btn-sm" onClick={clearFilters}>
            {t.common.clear}
          </button>
        ) : null}
      </div>

      {/* The style picker sits with the results, not in a settings page:
          it is a reading choice made while writing. */}
      <div className="lib-style-bar">
        <label className="lib-style-pick">
          <span>{t.quotes.style}</span>
          <Select
            value={style}
            onChange={setStyle}
            options={styles.map((item) => ({ value: item.key, label: item.displayName }))}
          />
        </label>
        <p className="lib-style-sample">
          {styles.find((item) => item.key === style)?.sampleNote ?? t.quotes.styleHint}
        </p>
      </div>

      {loading ? (
        <Loading text={t.common.loading} />
      ) : items.length === 0 ? (
        <EmptyState
          text={hasFilters ? t.quotes.emptyFiltered : t.quotes.empty}
          action={
            hasFilters ? (
              <button type="button" className="lib-btn lib-btn-ghost" onClick={clearFilters}>
                {t.common.clear}
              </button>
            ) : (
              <button type="button" className="lib-btn" onClick={() => navigate('/library/quotes/new')}>
                {t.quotes.newQuote}
              </button>
            )
          }
        />
      ) : (
        <>
          <ul className="lib-quote-list">
            {items.map((quote) => (
              <li key={quote.id} className="lib-quote-card">
                <blockquote className="lib-quote-text">{quote.quoteText}</blockquote>

                <p className="lib-quote-reference">{quote.reference}</p>

                {expandedId === quote.id ? (
                  <p className="lib-quote-bibliography">
                    <span className="lib-quote-biblabel">{t.quotes.bibliography}</span>
                    {quote.bibliography}
                  </p>
                ) : null}

                {quote.description || quote.context ? (
                  <div className="lib-quote-notes">
                    {quote.context ? (
                      <p>
                        <span className="lib-quote-notelabel">{t.quote.context}</span>
                        {quote.context}
                      </p>
                    ) : null}
                    {quote.description ? (
                      <p>
                        <span className="lib-quote-notelabel">{t.quote.description}</span>
                        {quote.description}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="lib-quote-foot">
                  <span className="lib-quote-badges">
                    <Badge tone="original">{t.schemes[quote.workCitationScheme] ?? quote.workCitationScheme}</Badge>
                    {quote.tags.map((tag) => (
                      <Badge key={tag.id}>{tag.name}</Badge>
                    ))}
                  </span>
                  <span className="lib-quote-actions">
                    {copiedId === quote.id ? <span className="lib-saved">{t.common.copied}</span> : null}
                    <button
                      type="button"
                      className="lib-btn lib-btn-ghost lib-btn-sm"
                      onClick={() => handleCopy(quote, 'both')}
                    >
                      {t.quotes.copyBoth}
                    </button>
                    <button
                      type="button"
                      className="lib-btn lib-btn-ghost lib-btn-sm"
                      onClick={() => handleCopy(quote, 'reference')}
                    >
                      {t.quotes.copyReference}
                    </button>
                    <button
                      type="button"
                      className="lib-btn lib-btn-ghost lib-btn-sm"
                      onClick={() => setExpandedId((current) => (current === quote.id ? null : quote.id))}
                    >
                      {t.quotes.showBibliography}
                    </button>
                    <button
                      type="button"
                      className="lib-btn lib-btn-ghost lib-btn-sm"
                      onClick={() => navigate(`/library/quotes/${quote.id}`)}
                    >
                      {t.common.edit}
                    </button>
                    <button
                      type="button"
                      className="lib-btn lib-btn-danger lib-btn-sm"
                      onClick={() => handleDelete(quote)}
                    >
                      {t.common.delete}
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <Pagination t={t} skip={skip} take={PAGE_SIZE} total={total} onSkip={setSkip} />
        </>
      )}
    </div>
  );
}
