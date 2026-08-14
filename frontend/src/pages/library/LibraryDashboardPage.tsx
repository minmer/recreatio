import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOverview, type LibraryCountByKey, type LibraryOverview } from './libraryApi';
import { languageLabel, type LibraryCopyStrings } from './libraryCopy';
import { Badge, EmptyState, ErrorBanner, Loading, Rating, Section } from './libraryComponents';
import { LibraryScanDialog } from './LibraryScanDialog';

function StatTile({ label, value, tone }: { label: string; value: number; tone?: 'warn' }) {
  return (
    <div className={`lib-stat${tone ? ` lib-stat-${tone}` : ''}`}>
      <span className="lib-stat-value">{value}</span>
      <span className="lib-stat-label">{label}</span>
    </div>
  );
}

/** Horizontal bars scaled against the largest count in the group. */
function BarList({ title, items, empty }: { title: string; items: LibraryCountByKey[]; empty: string }) {
  const max = items.reduce((peak, item) => Math.max(peak, item.count), 0);
  return (
    <div className="lib-barlist">
      <h3 className="lib-barlist-title">{title}</h3>
      {items.length === 0 ? (
        <p className="lib-muted">{empty}</p>
      ) : (
        <ul>
          {items.slice(0, 8).map((item) => (
            <li key={item.key || '__none__'}>
              <span className="lib-barlist-label">{item.label}</span>
              <span className="lib-barlist-track">
                <span className="lib-barlist-fill" style={{ width: `${max > 0 ? (item.count / max) * 100 : 0}%` }} />
              </span>
              <span className="lib-barlist-count">{item.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LibraryDashboardPage({ t }: { t: LibraryCopyStrings }) {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<LibraryOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getOverview()
      .then((data) => {
        if (active) setOverview(data);
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
  }, [reloadToken, t.common.loadFailed]);

  if (loading) return <Loading text={t.common.loading} />;

  return (
    <div className="lib-dashboard">
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <header className="lib-page-head">
        <div>
          <h1 className="lib-page-title">{t.dashboard.title}</h1>
          <p className="lib-page-subtitle">{t.dashboard.subtitle}</p>
        </div>
        <div className="lib-head-actions">
          <button type="button" className="lib-btn lib-btn-ghost" onClick={() => setScanOpen(true)}>
            {t.scan.addTitle}
          </button>
          <button type="button" className="lib-btn" onClick={() => navigate('/library/works/new')}>
            {t.works.newWork}
          </button>
        </div>
      </header>

      {overview && overview.works === 0 ? (
        <Section title={t.dashboard.quickStart}>
          <EmptyState
            text={t.dashboard.quickStartText}
            action={
              <button type="button" className="lib-btn" onClick={() => navigate('/library/works/new')}>
                {t.dashboard.addFirstWork}
              </button>
            }
          />
        </Section>
      ) : null}

      {overview ? (
        <>
          <div className="lib-stat-grid">
            <StatTile label={t.dashboard.works} value={overview.works} />
            <StatTile label={t.dashboard.editions} value={overview.editions} />
            <StatTile label={t.dashboard.copies} value={overview.copies} />
            <StatTile label={t.dashboard.translations} value={overview.translations} />
            <StatTile label={t.dashboard.read} value={overview.read} />
            <StatTile label={t.dashboard.reading} value={overview.reading} />
            <StatTile label={t.dashboard.unread} value={overview.unread} />
            <StatTile label={t.dashboard.lentOut} value={overview.openLoansOut} />
            <StatTile label={t.dashboard.borrowed} value={overview.openLoansIn} />
            <StatTile
              label={t.dashboard.overdue}
              value={overview.overdueLoans}
              tone={overview.overdueLoans > 0 ? 'warn' : undefined}
            />
            <StatTile label={t.dashboard.people} value={overview.people} />
            <StatTile label={t.dashboard.publishers} value={overview.publishers} />
          </div>

          <div className="lib-chart-grid">
            <BarList
              title={t.dashboard.byLanguage}
              items={overview.byLanguage.map((item) => ({ ...item, label: languageLabel(t, item.key) }))}
              empty={t.common.nothingYet}
            />
            <BarList
              title={t.dashboard.byOriginalLanguage}
              items={overview.byOriginalLanguage.map((item) => ({ ...item, label: languageLabel(t, item.key) }))}
              empty={t.common.nothingYet}
            />
            <BarList
              title={t.dashboard.byKind}
              items={overview.byKind.map((item) => ({ ...item, label: t.kinds[item.key] ?? item.key }))}
              empty={t.common.nothingYet}
            />
            <BarList
              title={t.dashboard.byShelf}
              items={overview.byShelf.map((item) => ({
                ...item,
                label: item.label || t.dashboard.unshelved
              }))}
              empty={t.common.nothingYet}
            />
            <BarList title={t.dashboard.topAuthors} items={overview.topAuthors} empty={t.common.nothingYet} />
          </div>

          <Section title={t.dashboard.recentlyAdded}>
            {overview.recentlyAdded.length === 0 ? (
              <p className="lib-muted">{t.common.nothingYet}</p>
            ) : (
              <ul className="lib-card-list">
                {overview.recentlyAdded.map((copy) => (
                  <li key={copy.id}>
                    <button
                      type="button"
                      className="lib-card"
                      onClick={() => navigate(`/library/editions/${copy.editionId}`)}
                    >
                      <span className="lib-card-title">{copy.editionTitle}</span>
                      <span className="lib-card-meta">
                        {copy.authors.length > 0 ? copy.authors.join(', ') : t.common.unknown}
                        {copy.publishedYear ? ` · ${copy.publishedYear}` : ''}
                        {copy.publisherName ? ` · ${copy.publisherName}` : ''}
                      </span>
                      <span className="lib-card-tags">
                        <Badge tone={copy.isTranslation ? 'translation' : 'original'}>
                          {languageLabel(t, copy.language)}
                        </Badge>
                        <Badge tone="muted">{t.statuses[copy.status] ?? copy.status}</Badge>
                        <Rating value={copy.rating} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      ) : null}

      {scanOpen ? (
        <LibraryScanDialog
          t={t}
          onClose={() => {
            setScanOpen(false);
            setReloadToken((current) => current + 1);
          }}
        />
      ) : null}
    </div>
  );
}
