import { CogitaShell } from '../../../CogitaShell';
import type { Copy } from '../../../../../content/types';
import type { RouteKey } from '../../../../../types/navigation';
import { CogitaCollectionSearch as CogitaCollectionSearchList } from '../../shared/search/CogitaCollectionSearch';

export function CogitaCollectionSearch({
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
  const baseHref = `/#/cogita/workspace/libraries/${libraryId}`;

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
                    <p className="cogita-user-kicker">{copy.cogita.library.collections.listKicker}</p>
                  </div>
                </div>
              </div>

              <div className="cogita-library-panel">
                <CogitaCollectionSearch
                  libraryId={libraryId}
                  searchLabel={copy.cogita.library.collections.searchPlaceholder}
                  searchPlaceholder={copy.cogita.library.collections.searchPlaceholder}
                  searchingLabel={copy.cogita.library.collections.loading}
                  readyLabel={copy.cogita.library.collections.ready}
                  emptyLabel={copy.cogita.library.collections.emptyTitle}
                  failedLabel={copy.cogita.library.modules.loadFailed}
                  collectionLabel={copy.cogita.library.collections.collectionLabel}
                  itemCountLabel={copy.cogita.library.collections.itemCountLabel}
                  noNotesLabel={copy.cogita.library.collections.noNotes}
                  countLabelTemplate={copy.cogita.library.collections.countLabel}
                  emptyActionLabel={copy.cogita.library.collections.emptyAction}
                  emptyActionHref={`${baseHref}/collections/new`}
                  buildCollectionHref={(collection) => `${baseHref}/collections/${collection.collectionId}`}
                  openActionLabel={copy.cogita.library.list.editInfo}
                  loadMoreLabel={copy.cogita.library.list.loadMore}
                  inputAriaLabel={copy.cogita.library.collections.searchPlaceholder}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
