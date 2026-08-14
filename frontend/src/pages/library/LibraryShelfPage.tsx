import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ITEM_STATUSES,
  READING_STATUSES,
  getItems,
  getShelves,
  type LibraryItemFilters,
  type LibraryItemListItem,
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

/** The physical view: what actually stands on the shelves. */
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

  const [items, setItems] = useState<LibraryItemListItem[]>([]);
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

  const filters = useMemo<LibraryItemFilters>(
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
    getItems(filters)
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
          <h1 className="lib-page-title">{t.nav.shelf}</h1>
          <p className="lib-page-subtitle">{t.dashboard.items}</p>
        </div>
        <div className="lib-head-actions">
          <span className="lib-total">
            {total} {t.common.total}
          </span>
          <button type="button" className="lib-btn lib-btn-ghost" onClick={() => navigate('/library/arrangement')}>
            {t.nav.arrangement}
          </button>
          <button type="button" className="lib-btn lib-btn-ghost" onClick={() => setScanOpen(true)}>
            {t.scan.button}
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
          value={shelfId}
          onChange={(value) => {
            setShelfId(value);
            setSkip(0);
          }}
          options={shelves.map((shelf) => ({ value: String(shelf.id), label: shelf.name }))}
          placeholder={t.shelves.title}
        />
        <Select
          value={status}
          onChange={(value) => {
            setStatus(value);
            setSkip(0);
          }}
          options={vocabularyOptions(ITEM_STATUSES, t.statuses)}
          placeholder={t.item.status}
        />
        <Select
          value={readingStatus}
          onChange={(value) => {
            setReadingStatus(value);
            setSkip(0);
          }}
          options={vocabularyOptions(READING_STATUSES, t.readingStatuses)}
          placeholder={t.item.readingStatus}
        />
        <LanguageSelect
          t={t}
          value={language}
          onChange={(value) => {
            setLanguage(value);
            setSkip(0);
          }}
          placeholder={t.common.language}
        />
        <Select
          value={sort}
          onChange={(value) => {
            setSort(value);
            setSkip(0);
          }}
          options={[
            { value: 'added', label: t.works.sortCreated },
            { value: 'rating', label: t.item.rating },
            { value: 'acquired', label: t.item.acquiredDate },
            { value: 'signature', label: t.item.signature },
            { value: 'shelf', label: t.item.shelf }
          ]}
        />
        <div className="lib-filter-inline">
          <span>{t.item.rating}</span>
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
          label={t.item.favourite}
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
          text={hasFilters ? t.works.emptyFiltered : t.common.nothingYet}
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
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="lib-copy-card"
                  onClick={() => navigate(`/library/manifestations/${item.manifestationId}`)}
                >
                  {item.imageUrl ? (
                    <img className="lib-copy-card-cover" src={item.imageUrl} alt="" loading="lazy" />
                  ) : null}
                  <span className="lib-copy-card-title">{item.manifestationTitle}</span>
                  {item.isTranslation && item.workTitle !== item.manifestationTitle ? (
                    <span className="lib-copy-card-original">{item.workTitle}</span>
                  ) : null}
                  <span className="lib-copy-card-authors">
                    {item.authors.length > 0 ? item.authors.join(', ') : t.common.unknown}
                  </span>
                  <span className="lib-copy-card-meta">
                    {[item.publisherName, item.publishedYear ? String(item.publishedYear) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span className="lib-copy-card-badges">
                    <Badge tone={item.isTranslation ? 'translation' : 'original'}>
                      {languageLabel(t, item.language)}
                    </Badge>
                    <Badge tone="muted">{t.readingStatuses[item.readingStatus] ?? item.readingStatus}</Badge>
                    {item.status !== 'shelf' ? (
                      <Badge tone="warn">{t.statuses[item.status] ?? item.status}</Badge>
                    ) : null}
                    {item.isFavourite ? <Badge>★</Badge> : null}
                    <Rating value={item.rating} />
                  </span>
                  <span className="lib-copy-card-shelf">
                    {item.shelfName ?? t.dashboard.unshelved}
                    {item.signature ? ` · ${item.signature}` : ''}
                  </span>
                  {item.openLoan ? (
                    <span className="lib-copy-card-loan">
                      {item.openLoan.direction === 'out' ? t.item.onLoanTo : t.item.borrowedFrom}{' '}
                      {item.openLoan.counterpartName}
                      {item.openLoan.dueOn ? ` · ${t.item.due} ${formatDate(item.openLoan.dueOn)}` : ''}
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
