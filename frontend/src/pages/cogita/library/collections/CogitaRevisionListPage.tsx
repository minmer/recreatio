import { useEffect, useMemo, useState } from 'react';
import { getCogitaRevisions, type CogitaRevision } from '../../../../lib/api';
import { CogitaShell } from '../../CogitaShell';
import type { Copy } from '../../../../content/types';
import type { RouteKey } from '../../../../types/navigation';
import { getRevisionType, revisionTypes } from '../../../../cogita/revision/registry';
import { getCachedCollections } from '../cogitaMetaCache';

export function CogitaRevisionListPage({
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
  libraryId,
  collectionId
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
  collectionId?: string;
}) {
  const baseHref = `/#/cogita/library/${libraryId}`;
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [revisions, setRevisions] = useState<CogitaRevision[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [collectionNameById, setCollectionNameById] = useState<Record<string, string>>({});

  useEffect(() => {
    getCachedCollections(libraryId)
      .then((items) => {
        const next = items.reduce<Record<string, string>>((acc, item) => {
          acc[item.collectionId] = item.name;
          return acc;
        }, {});
        setCollectionNameById(next);
      })
      .catch(() => setCollectionNameById({}));
  }, [libraryId]);

  useEffect(() => {
    setStatus('loading');
    getCogitaRevisions({ libraryId, collectionId })
      .then((items) => {
        setRevisions(items);
        setStatus('ready');
      })
      .catch(() => {
        setRevisions([]);
        setStatus('ready');
      });
  }, [libraryId, collectionId]);

  const revisionTypeOptions = useMemo(() => revisionTypes.map((type) => type.id), []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return revisions.filter((revision) => {
      const typeKey = (revision.revisionType ?? revision.mode ?? 'random').toLowerCase();
      if (typeFilter !== 'all' && typeKey !== typeFilter) return false;
      if (!needle) return true;
      const collectionLabel = collectionNameById[revision.collectionId] ?? '';
      return (
        revision.name.toLocaleLowerCase().includes(needle) ||
        typeKey.includes(needle) ||
        collectionLabel.toLocaleLowerCase().includes(needle)
      );
    });
  }, [collectionNameById, query, revisions, typeFilter]);

  const createHref = `${baseHref}/revisions/new`;

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
      <section className="cogita-library-dashboard" data-mode="list">
        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div className="cogita-library-grid">
              <div className="cogita-library-pane">
                <div className="cogita-library-controls">
                  <div className="cogita-library-search">
                    <p className="cogita-user-kicker">{copy.cogita.workspace.infoMode.search}</p>
                    <div className="cogita-search-field">
                      <input
                        type="text"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={copy.cogita.workspace.revisionForm.namePlaceholder}
                      />
                    </div>
                    <label className="cogita-field">
                      <span>{copy.cogita.library.revision.modeLabel}</span>
                      <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                        <option value="all">{copy.cogita.library.infoTypes.any}</option>
                        {revisionTypeOptions.map((typeKey) => (
                          <option key={`type:${typeKey}`} value={typeKey}>
                            {copy.cogita.library.revision[getRevisionType(typeKey).labelKey]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="cogita-card-count">
                  <span>{`${filtered.length} / ${revisions.length}`}</span>
                  <span>{status === 'loading' ? copy.cogita.library.revision.loading : copy.cogita.library.collections.ready}</span>
                </div>

                <div className="cogita-card-list" data-view="list">
                  {filtered.length ? (
                    filtered.map((revision) => {
                      const typeKey = (revision.revisionType ?? revision.mode ?? 'random').toLowerCase();
                      const href = `${baseHref}/revisions/${encodeURIComponent(revision.revisionId)}`;
                      return (
                        <div key={revision.revisionId} className="cogita-card-item">
                          <a className="cogita-card-select" href={href}>
                            <div className="cogita-card-type">
                              {copy.cogita.library.revision[getRevisionType(typeKey).labelKey]}
                            </div>
                            <h3 className="cogita-card-title">{revision.name}</h3>
                            <p className="cogita-card-subtitle">
                              {collectionNameById[revision.collectionId] ?? revision.collectionId}
                            </p>
                          </a>
                        </div>
                      );
                    })
                  ) : (
                    <div className="cogita-card-empty">
                      <p>{copy.cogita.workspace.status.noRevisions}</p>
                      <a className="ghost" href={createHref}>
                        {copy.cogita.workspace.revisionForm.createAction}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="cogita-library-panel">
                <section className="cogita-library-detail">
                  <div className="cogita-detail-header">
                    <div>
                      <p className="cogita-user-kicker">{copy.cogita.workspace.targets.allRevisions}</p>
                      <h3 className="cogita-detail-title">{copy.cogita.workspace.infoMode.search}</h3>
                    </div>
                  </div>
                  <div className="cogita-detail-body">
                    <p>{copy.cogita.library.revision.previewBody1}</p>
                    <p>{copy.cogita.library.revision.previewBody2}</p>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
