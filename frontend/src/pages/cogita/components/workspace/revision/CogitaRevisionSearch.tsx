import { useEffect, useMemo, useState } from 'react';
import { CogitaShell } from '../../../CogitaShell';
import type { Copy } from '../../../../../content/types';
import type { RouteKey } from '../../../../../types/navigation';
import { getRevisionType, revisionTypes } from '../../../features/revision/registry';
import { getCachedCollections } from '../cogitaMetaCache';
import { CogitaRevisionSearch as CogitaRevisionSearchList } from '../../shared/search/CogitaRevisionSearch';

export function CogitaRevisionSearch({
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
  const baseHref = `/#/cogita/workspace/libraries/${libraryId}`;
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

  const revisionTypeOptions = useMemo(() => revisionTypes.map((type) => type.id), []);

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
      <section className="cogita-library-dashboard cogita-flat-search-list" data-mode="list">
        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div className="cogita-library-grid">
              <div className="cogita-flat-search-header">
                <div className="cogita-library-controls">
                  <div className="cogita-library-search">
                    <p className="cogita-user-kicker">{copy.cogita.workspace.infoMode.search}</p>
                  </div>
                </div>
              </div>

              <div className="cogita-library-panel">
                <CogitaRevisionSearch
                  libraryId={libraryId}
                  collectionId={collectionId}
                  searchLabel={copy.cogita.workspace.infoMode.search}
                  searchPlaceholder={copy.cogita.workspace.revisionForm.namePlaceholder}
                  modeLabel={copy.cogita.library.revision.modeLabel}
                  anyTypeLabel={copy.cogita.library.infoTypes.any}
                  searchingLabel={copy.cogita.library.revision.loading}
                  readyLabel={copy.cogita.library.collections.ready}
                  emptyLabel={copy.cogita.workspace.status.noRevisions}
                  failedLabel={copy.cogita.library.modules.loadFailed}
                  countLabelTemplate="{shown} / {total}"
                  revisionTypeOptions={revisionTypeOptions}
                  collectionNameById={collectionNameById}
                  resolveRevisionTypeLabel={(typeKey) => copy.cogita.library.revision[getRevisionType(typeKey).labelKey]}
                  emptyActionLabel={copy.cogita.workspace.revisionForm.createAction}
                  emptyActionHref={createHref}
                  buildRevisionHref={(revision) => `${baseHref}/revisions/${encodeURIComponent(revision.revisionId)}`}
                  openActionLabel={copy.cogita.library.list.editInfo}
                  inputAriaLabel={copy.cogita.workspace.revisionForm.namePlaceholder}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
