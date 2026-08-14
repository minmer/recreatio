import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  COPY_STATUSES,
  READING_STATUSES,
  getCopies,
  getShelves,
  type LibraryCopyFilters,
  type LibraryCopyListItem,
  type LibraryShelf
} from './libraryApi';
import { languageLabel, type LibraryCopyStrings } from './libraryCopy';
import {
  Badge,
  EmptyState,
  ErrorBanner,
  LanguageSelect,
  Loading,
  NumberInput,
  Pagination,
  Rating,
  Select,
  Toggle,
  formatDate,
  vocabularyOptions
} from './libraryComponents';
import { LibraryScanDialog } from './LibraryScanDialog';

const PAGE_SIZE = 40;

export function LibraryShelfPage({ t, initialShelfId }: { t: LibraryCopyStrings; initialShelfId: number | null }) {
  const navigate = useNavigate();

  const [term, setTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [shelfId, setShelfId] = useState(initialShelfId === null ? '' : String(initialShelfId));
  const [status, setStatus] = useState('');
  const [readingStatus, setReadingStatus] = useState('');
  const [language, setLanguage] = useState('');
  const [favourite, setFavourite] = useState(false);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [sort, setSort] = useState('added');
  const [skip, setSkip] = useState(0);

  const [items, setItems] = useState<LibraryCopyListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [shelves, setShelves] = useState<LibraryShelf[]>([]);
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
    getShelves()
      .then((result) => {
        if (active) setShelves(result);
      })
      .catch(() => {
        if (active) setError(t.common.loadFailed);
      });
    return () => {
      active = false;
    };
  }, [t.common.loadFailed]);

  const filters = useMemo<LibraryCopyFilters>(
    () => ({
      term: debouncedTerm || undefined,
      shelfId: shelfId ? Number(shelfId) : undefined,
      status: status || undefined,
      readingStatus: readingStatus || undefined,
      language: language || undefined,
      favourite: favourite || undefined,
      minRating: minRating ?? undefined,
      sort,
      skip,
      take: PAGE_SIZE
    }),
    [debouncedTerm, shelfId, status, readingStatus, language, favourite, minRating, sort, skip]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    getCopies(filters)
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
    Boolean(debouncedTerm || shelfId || status || readingStatus || language) || favourite || minRating !== null;

  const clearFilters = () => {
    setTerm('');
    setShelfId('');
    setStatus('');
    setReadingStatus('');
    setLanguage('');
    setFavourite(false);
    setMinRating(null);
    setSkip(0);
  };

  return (
    <div className="lib-shelf">
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <header className="lib-page-head">
        <div>
          <h1 className="lib-page-title">{t.shelfView.title}</h1>
          <p className="lib-page-subtitle">{t.shelfView.subtitle}</p>
        </div>
        <div className="lib-head-actions">
          <span className="lib-total">
            {total} {t.common.total}
          </span>
          <button type="button" className="lib-btn lib-btn-ghost" onClick={() => setScanOpen(true)}>
            {t.scan.button}
          </button>
        </div>
      </header>

      <div className="lib-filters">
        <input
          className="lib-input lib-search"
          value={term}
          placeholder={t.shelfView.searchPlaceholder}
          onChange={(event) => setTerm(event.target.value)}
        />
        <Select
          value={shelfId}
          onChange={(value) => {
            setShelfId(value);
            setSkip(0);
          }}
          options={shelves.map((shelf) => ({ value: String(shelf.id), label: shelf.name }))}
          placeholder={t.shelfView.filterShelf}
        />
        <Select
          value={status}
          onChange={(value) => {
            setStatus(value);
            setSkip(0);
          }}
          options={vocabularyOptions(COPY_STATUSES, t.statuses)}
          placeholder={t.shelfView.filterStatus}
        />
        <Select
          value={readingStatus}
          onChange={(value) => {
            setReadingStatus(value);
            setSkip(0);
          }}
          options={vocabularyOptions(READING_STATUSES, t.readingStatuses)}
          placeholder={t.shelfView.filterReading}
        />
        <LanguageSelect
          t={t}
          value={language}
          onChange={(value) => {
            setLanguage(value);
            setSkip(0);
          }}
          placeholder={t.shelfView.filterLanguage}
        />
        <Select
          value={sort}
          onChange={(value) => {
            setSort(value);
            setSkip(0);
          }}
          options={[
            { value: 'added', label: t.shelfView.sortAdded },
            { value: 'rating', label: t.shelfView.sortRating },
            { value: 'acquired', label: t.shelfView.sortAcquired },
            { value: 'signature', label: t.shelfView.sortSignature }
          ]}
        />
        <div className="lib-filter-inline">
          <span>{t.shelfView.minRating}</span>
          <NumberInput
            value={minRating}
            onChange={(value) => {
              setMinRating(value);
              setSkip(0);
            }}
            min={1}
            max={10}
          />
        </div>
        <Toggle
          checked={favourite}
          onChange={(value) => {
            setFavourite(value);
            setSkip(0);
          }}
          label={t.shelfView.onlyFavourites}
        />
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
          text={t.shelfView.empty}
          action={
            hasFilters ? (
              <button type="button" className="lib-btn lib-btn-ghost" onClick={clearFilters}>
                {t.common.clear}
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul className="lib-copy-grid">
            {items.map((copy) => (
              <li key={copy.id}>
                <button
                  type="button"
                  className="lib-copy-card"
                  onClick={() => navigate(`/library/editions/${copy.editionId}`)}
                >
                  <span className="lib-copy-card-title">{copy.editionTitle}</span>
                  {copy.isTranslation && copy.workOriginalTitle !== copy.editionTitle ? (
                    <span className="lib-copy-card-original">{copy.workOriginalTitle}</span>
                  ) : null}
                  <span className="lib-copy-card-authors">
                    {copy.authors.length > 0 ? copy.authors.join(', ') : t.common.unknown}
                  </span>
                  <span className="lib-copy-card-meta">
                    {[copy.publisherName, copy.publishedYear ? String(copy.publishedYear) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span className="lib-copy-card-badges">
                    <Badge tone={copy.isTranslation ? 'translation' : 'original'}>
                      {languageLabel(t, copy.language)}
                    </Badge>
                    <Badge tone="muted">{t.readingStatuses[copy.readingStatus] ?? copy.readingStatus}</Badge>
                    {copy.status !== 'shelf' ? (
                      <Badge tone="warn">{t.statuses[copy.status] ?? copy.status}</Badge>
                    ) : null}
                    {copy.isFavourite ? <Badge>★</Badge> : null}
                    <Rating value={copy.rating} />
                  </span>
                  <span className="lib-copy-card-shelf">
                    {copy.shelfName ?? t.shelfView.unshelved}
                    {copy.signature ? ` · ${copy.signature}` : ''}
                  </span>
                  {copy.openLoan ? (
                    <span className="lib-copy-card-loan">
                      {copy.openLoan.direction === 'out' ? t.copy.onLoanTo : t.copy.borrowedFrom}{' '}
                      {copy.openLoan.counterpartName}
                      {copy.openLoan.dueOn ? ` · ${t.copy.due} ${formatDate(copy.openLoan.dueOn)}` : ''}
                    </span>
                  ) : null}
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
