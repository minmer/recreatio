import { useEffect, useMemo, useState } from 'react';
import {
  getCogitaCollections,
  getCogitaItemDependencies,
  getCogitaRevisions,
  searchCogitaCards
} from '../../../lib/api';
import { CogitaShell } from '../CogitaShell';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { useCogitaLibraryMeta } from './useCogitaLibraryMeta';

type MetricKey = 'infos' | 'collections' | 'revisions' | 'storyboards' | 'texts';

function PieChart({
  slices
}: {
  slices: Array<{ value: number; color: string; label: string }>;
}) {
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  const gradient = useMemo(() => {
    if (total <= 0) {
      return 'conic-gradient(rgba(120, 160, 200, 0.3) 0deg 360deg)';
    }
    let cursor = 0;
    const parts = slices.map((slice) => {
      const value = Math.max(0, slice.value);
      const deg = (value / total) * 360;
      const from = cursor;
      const to = cursor + deg;
      cursor = to;
      return `${slice.color} ${from}deg ${to}deg`;
    });
    return `conic-gradient(${parts.join(',')})`;
  }, [slices, total]);

  return (
    <div className="cogita-overview-pie-wrap">
      <div className="cogita-overview-pie" style={{ background: gradient }} />
      <div className="cogita-overview-legend">
        {slices.map((slice) => (
          <div key={slice.label} className="cogita-overview-legend-item">
            <span style={{ background: slice.color }} />
            <strong>{slice.value}</strong>
            <small>{slice.label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CogitaLibraryOverviewPage({
  copy,
  authLabel,
  showProfileMenu,
  onProfileNavigate,
  onToggleSecureMode,
  onLogout,
  secureMode,
  onNavigate,
  language,
  onLanguageChange,
  libraryId
}: {
  copy: Copy;
  authLabel: string;
  showProfileMenu: boolean;
  onProfileNavigate: () => void;
  onToggleSecureMode: () => void;
  onLogout: () => void;
  secureMode: boolean;
  onNavigate: (route: RouteKey) => void;
  language: 'pl' | 'en' | 'de';
  onLanguageChange: (language: 'pl' | 'en' | 'de') => void;
  libraryId: string;
}) {
  const { libraryName, stats } = useCogitaLibraryMeta(libraryId);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('infos');
  const [revisionCount, setRevisionCount] = useState(0);
  const [excludedInfoCount, setExcludedInfoCount] = useState(0);
  const [availableCheckCount, setAvailableCheckCount] = useState(0);

  const totalInfos = stats?.totalInfos ?? 0;
  const totalCollections = stats?.totalCollections ?? 0;
  const totalStoryboards = 0;
  const totalTexts = 0;
  const knownCount = 0;
  const unknownCount = Math.max(0, totalInfos - knownCount - excludedInfoCount);
  const unavailableChecks = Math.max(0, totalInfos - excludedInfoCount - availableCheckCount);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const collectionBundle = await getCogitaCollections({ libraryId, limit: 200 });
        const revisionLists = await Promise.all(
          collectionBundle.items.map((collection) =>
            getCogitaRevisions({ libraryId, collectionId: collection.collectionId }).catch(() => [])
          )
        );
        if (cancelled) return;
        setRevisionCount(revisionLists.reduce((sum, list) => sum + list.length, 0));
      } catch {
        if (!cancelled) {
          setRevisionCount(0);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [libraryId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [computed, source, deps] = await Promise.all([
          searchCogitaCards({ libraryId, type: 'computed', limit: 1 }).catch(() => ({ total: 0 })),
          searchCogitaCards({ libraryId, type: 'source', limit: 1 }).catch(() => ({ total: 0 })),
          getCogitaItemDependencies({ libraryId }).catch(() => ({ items: [] }))
        ]);
        if (cancelled) return;
        setExcludedInfoCount((computed.total ?? 0) + (source.total ?? 0));
        const uniqueCheckableInfos = new Set(
          deps.items
            .filter((item) => item.childItemType.toLowerCase() === 'info')
            .map((item) => item.childItemId)
            .filter(Boolean)
        );
        setAvailableCheckCount(uniqueCheckableInfos.size);
      } catch {
        if (!cancelled) {
          setExcludedInfoCount(0);
          setAvailableCheckCount(0);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [libraryId]);

  const counters = [
    { key: 'infos' as const, label: copy.cogita.library.overview.stats.totalInfos, value: totalInfos },
    { key: 'collections' as const, label: copy.cogita.library.overview.stats.collections, value: totalCollections },
    { key: 'revisions' as const, label: copy.cogita.library.overview.stats.revisions, value: revisionCount },
    { key: 'storyboards' as const, label: copy.cogita.library.overview.stats.storyboards, value: totalStoryboards },
    { key: 'texts' as const, label: copy.cogita.library.overview.stats.texts, value: totalTexts }
  ];

  return (
    <CogitaShell
      copy={copy}
      authLabel={authLabel}
      showProfileMenu={showProfileMenu}
      onProfileNavigate={onProfileNavigate}
      onToggleSecureMode={onToggleSecureMode}
      onLogout={onLogout}
      secureMode={secureMode}
      onNavigate={onNavigate}
      language={language}
      onLanguageChange={onLanguageChange}
    >
      <section className="cogita-library-dashboard" data-mode="detail">
        <header className="cogita-library-dashboard-header">
          <div>
            <h1 className="cogita-library-title">{libraryName}</h1>
          </div>
        </header>

        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div className="cogita-overview-counters">
              {counters.map((counter) => (
                <button
                  key={counter.key}
                  type="button"
                  className={`cogita-overview-counter ${selectedMetric === counter.key ? 'active' : ''}`}
                  onClick={() => setSelectedMetric(counter.key)}
                >
                  <span>{counter.label}</span>
                  <strong>{counter.value}</strong>
                </button>
              ))}
            </div>

            <section className="cogita-overview-main-card">
              <header>
                <h2>{copy.cogita.library.overview.statsCardTitle}</h2>
              </header>
              {selectedMetric === 'infos' ? (
                <div className="cogita-overview-main-grid">
                  <article>
                    <h3>{copy.cogita.library.overview.knownChartTitle}</h3>
                    <PieChart
                      slices={[
                        { label: copy.cogita.library.overview.known, value: knownCount, color: '#75d79a' },
                        { label: copy.cogita.library.overview.unknown, value: unknownCount, color: '#85b9ff' },
                        { label: copy.cogita.library.overview.excluded, value: excludedInfoCount, color: '#9ca6bb' }
                      ]}
                    />
                  </article>
                  <article>
                    <h3>{copy.cogita.library.overview.checksChartTitle}</h3>
                    <PieChart
                      slices={[
                        { label: copy.cogita.library.overview.availableChecks, value: availableCheckCount, color: '#75d79a' },
                        {
                          label: copy.cogita.library.overview.unavailableChecks,
                          value: unavailableChecks,
                          color: '#7ea4d6'
                        }
                      ]}
                    />
                  </article>
                </div>
              ) : (
                <div className="cogita-overview-placeholder">
                  <p>{copy.cogita.library.overview.statsCardHint}</p>
                  <p className="cogita-help">{copy.cogita.library.modules.draftInfo}</p>
                </div>
              )}
            </section>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
